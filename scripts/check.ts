// End-to-end check of src/pdf.ts: edit, move, delete, add, then read the output back.
import assert from "node:assert/strict";
import * as mupdf from "mupdf";
import { extract, exportPdf, fontKey, renderPage, type El } from "../src/pdf";
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
  id: "new", page: 0, text: "Café latte two-liner\nsecond line", x: 40, y: 300, ascent: 0.8,
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

await Bun.write("scripts/out.pdf", pdf);
console.log("ok: all checks passed, wrote scripts/out.pdf");
