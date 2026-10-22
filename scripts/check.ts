// End-to-end check of src/pdf.ts: edit, move, delete, add, then read the output back.
import assert from "node:assert/strict";
import * as mupdf from "mupdf";
import { extract, exportPdf, familyOf, fontKey, headerFooterEls, pickFace, renderPage, type El } from "../src/pdf";
import { snap } from "../src/snap";
import { makeSample, CALIBRI } from "./sample";

const src = await makeSample();
const { pages, els } = extract(src);
const find = (t: string) => els.find((e) => e.text === t) ?? assert.fail(`no element "${t}" in ${els.map((e) => e.text)}`);

assert.equal(pages.length, 1);
assert.equal(els.length, 6, "date on the same line should be its own element");
assert.equal(find("Jane Example").font, "Helvetica-Bold");
assert.match(find("Led a team of four.").srcFont, /^Calibri/);
assert.equal(find("Built widgets for 5 years.").color, "#4d4d4d");

const calibri = await Bun.file(CALIBRI).bytes();
const key = fontKey(calibri);
const set = (t: string, patch: Partial<El>) => Object.assign(find(t), patch);
set("Led a team of four.", { text: "Led a team of six engineers.", font: key });
set("Senior Widget Engineer at Acme Ltd", { y: find("Senior Widget Engineer at Acme Ltd").y - 20 });
set("Cut costs by half.", { deleted: true });
els.push({
  id: "new", page: 0, text: "Café latte two\u2010liner\nsecond line", x: 40, y: 300, ascent: 0.8,
  size: 11, color: "#000000", font: "Helvetica", srcFont: "", bold: false, italic: false,
});

assert.ok(renderPage(src, 0, 1, els).length > 1000, "renders a PNG");
const { pdf, problems } = await exportPdf(src, els, new Map([[key, calibri]]));
assert.deepEqual(problems, []);

const text = mupdf.Document.openDocument(pdf, "application/pdf").loadPage(0).toStructuredText("preserve-whitespace").asText();
for (const t of ["Jane Example", "2019 - 2024", "Built widgets for 5 years.", "Led a team of six engineers.",
  "Senior Widget Engineer at Acme Ltd", "Café latte two-liner", "second line"])
  assert.ok(text.includes(t), `missing "${t}" in:\n${text}`);
for (const t of ["Led a team of four", "Cut costs by half"]) assert.ok(!text.includes(t), `"${t}" should be gone`);
assert.ok(!Buffer.from(pdf).includes("Cut costs"), "old text gone from raw bytes");

// moved line's baseline is 20pt higher (top edge differs: it's redrawn in the fallback font)
const baseline = (e: El) => e.y + e.ascent * e.size;
const before = find("Senior Widget Engineer at Acme Ltd");
const moved = extract(pdf).els.find((e) => e.text.startsWith("Senior"))!;
assert.ok(Math.abs(baseline(moved) - (before.orig!.y + before.ascent * before.size - 20)) < 0.5, `moved baseline ${baseline(moved)}`);

// font swapping keeps weight and style
assert.equal(familyOf("Arial-BoldMT"), "Arial");
assert.equal(familyOf("Times-BoldItalic"), "Times");
assert.equal(pickFace("Times", [], true, false), "Times-Bold");
assert.equal(pickFace("Courier", [], false, true), "Courier-Oblique");
const calibriFaces = ["Calibri", "Calibri-Bold", "Calibri-Italic", "Calibri-BoldItalic"];
assert.equal(pickFace("Calibri", calibriFaces, true, false), "Calibri-Bold");
assert.equal(pickFace("Calibri", calibriFaces, true, true), "Calibri-BoldItalic");
assert.equal(pickFace("Calibri", ["Calibri"], true, false), "Calibri", "falls back to the only face");
const arialFaces = ["Arial-Black", "ArialMT", "Arial-BoldMT", "Arial-ItalicMT"];
assert.equal(pickFace("Arial", arialFaces, true, false), "Arial-BoldMT", "Bold, not Black");
assert.equal(pickFace("Arial", arialFaces, false, false), "ArialMT");

// Arial has no U+2010: drawn as a plain hyphen instead of a blank box
const arial = await Bun.file("C:/Windows/Fonts/arial.ttf").bytes();
const one = extract(src).els;
Object.assign(one.find((e) => e.text === "Led a team of four.")!, { text: "Led 2019\u20102024", font: fontKey(arial) });
const fixed = await exportPdf(src, one, new Map([[fontKey(arial), arial]]));
assert.deepEqual(fixed.problems, []);
assert.ok(extract(fixed.pdf).els.some((e) => e.text === "Led 2019-2024"));

// snapping: left edges and baselines line up, far-off targets are ignored
const box = { l: 10, r: 50, t: 100, b: 112, base: 110 };
const other = { l: 40, r: 90, t: 196, b: 214, base: 210 };
let s = snap(box, [other], 31, 98, 3, 595); // l 41 -> 40, base 208 -> 210
assert.deepEqual([s.dx, s.dy, s.guides], [30, 100, { x: 40, y: 210 }]);
s = snap(box, [other], 0, 0, 3, 595);
assert.deepEqual([s.dx, s.dy, s.guides], [0, 0, { x: undefined, y: undefined }]);
s = snap(box, [], 268, 0, 3, 595); // centre 298 -> page centre 297.5
assert.equal(s.guides.x, 297.5);

// header and footer: page numbers filled in, right-aligned text ends at the margin
const hfCfg = { header: ["", "", "Jane Example CV"], footer: ["", "Page {page} of {pages}", ""], margin: 36,
  skipFirst: false, font: "Helvetica", size: 9, color: "#555555" };
const hf = headerFooterEls(hfCfg, pages);
assert.deepEqual(hf.map((e) => e.text), ["Jane Example CV", "Page 1 of 1"]);
const withHf = extract((await exportPdf(src, hf, new Map())).pdf).els;
const right = withHf.find((e) => e.text === "Jane Example CV")!.orig!.rect;
assert.ok(Math.abs(right.x + right.w - (595 - 36)) < 1, `right edge ${right.x + right.w}`);
const centre = withHf.find((e) => e.text === "Page 1 of 1")!.orig!.rect;
assert.ok(Math.abs(centre.x + centre.w / 2 - 595 / 2) < 1, `centre ${centre.x + centre.w / 2}`);
assert.equal(headerFooterEls({ ...hfCfg, skipFirst: true }, pages).length, 0, "only page is skipped");

await Bun.write("scripts/out.pdf", pdf);
console.log("ok: all checks passed, wrote scripts/out.pdf");
