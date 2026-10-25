import assert from "node:assert/strict";
import * as mupdf from "mupdf";
import { PDFDocument as LibDoc } from "pdf-lib";
import {
  alignShift,
  atsCheck,
  compress,
  type El,
  exportPdf,
  extract,
  familyOf,
  fontKey,
  headerFooterEls,
  identityOrder,
  measure,
  normaliseLink,
  Previewer,
  pickFace,
  removedOn,
  renderPage,
  unrotate,
  unrotateDelta,
  wrapLines,
} from "../src/lib/pdf";
import { confine, snap } from "../src/lib/snap";
import { CALIBRI, makeLargeSample, makeSample, photo } from "./sample";

const src = await makeSample();
const { pages, els } = extract(src);
const find = (t: string) =>
  els.find((e) => e.text === t) ?? assert.fail(`no element "${t}" in ${els.map((e) => e.text)}`);

assert.equal(pages.length, 1);
assert.equal(els.filter((e) => !e.image).length, 6, "date on the same line should be its own element");
const img = els.find((e) => e.image)!;
assert.deepEqual([img.x, img.y, img.image!.w, img.image!.h].map(Math.round), [470, 92, 60, 30]);
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
  id: "new",
  page: 0,
  text: "Café latte two\u2010liner\nsecond line",
  x: 40,
  y: 300,
  ascent: 0.8,
  size: 11,
  color: "#000000",
  font: "Helvetica",
  srcFont: "",
  bold: false,
  italic: false,
});

const shot = renderPage(src, 0, 1, removedOn(els, 0));
assert.equal(shot.rgba.length, shot.w * shot.h * 4, "renders RGBA pixels");
assert.deepEqual([shot.w, shot.h], [595, 842]);

{
  const all = extract(src).els.filter((e) => !e.image);
  const removeFirst = (n: number) =>
    removedOn(
      all.map((e, i) => (i < n ? { ...e, deleted: true } : e)),
      0,
    );
  const same = (a: { rgba: Uint8ClampedArray }, b: { rgba: Uint8ClampedArray }) =>
    Buffer.compare(Buffer.from(a.rgba), Buffer.from(b.rgba)) === 0;
  const live = new Previewer(src);
  for (const n of [1, 3, 5, 2, 0])
    assert.ok(
      same(live.render(0, 1, removeFirst(n)), renderPage(src, 0, 1, removeFirst(n))),
      `preview after ${n} removals`,
    );
  live.destroy();
}
const { pdf, problems } = await exportPdf(src, els, new Map([[key, calibri]]));
assert.deepEqual(problems, []);

const text = mupdf.Document.openDocument(pdf, "application/pdf")
  .loadPage(0)
  .toStructuredText("preserve-whitespace")
  .asText();
for (const t of [
  "Jane Example",
  "2019 - 2024",
  "Built widgets for 5 years.",
  "Led a team of six engineers.",
  "Senior Widget Engineer at Acme Ltd",
  "Café latte two-liner",
  "second line",
])
  assert.ok(text.includes(t), `missing "${t}" in:\n${text}`);
for (const t of ["Led a team of four", "Cut costs by half"]) assert.ok(!text.includes(t), `"${t}" should be gone`);
assert.ok(!Buffer.from(pdf).includes("Cut costs"), "old text gone from raw bytes");

const baseline = (e: El) => e.y + e.ascent * e.size;
const before = find("Senior Widget Engineer at Acme Ltd");
const moved = extract(pdf).els.find((e) => e.text.startsWith("Senior"))!;
assert.ok(
  Math.abs(baseline(moved) - (before.orig!.y + before.ascent * before.size - 20)) < 0.5,
  `moved baseline ${baseline(moved)}`,
);

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

const arial = await Bun.file("C:/Windows/Fonts/arial.ttf").bytes();
const one = extract(src).els;
Object.assign(one.find((e) => e.text === "Led a team of four.")!, { text: "Led 2019\u20102024", font: fontKey(arial) });
const fixed = await exportPdf(src, one, new Map([[fontKey(arial), arial]]));
assert.deepEqual(fixed.problems, []);
assert.ok(extract(fixed.pdf).els.some((e) => e.text === "Led 2019-2024"));

const box = { l: 10, r: 50, t: 100, b: 112, base: 110 };
const other = { l: 40, r: 90, t: 196, b: 214, base: 210 };
let s = snap(box, [other], 31, 98, 3, 595);
assert.deepEqual([s.dx, s.dy, s.guides], [30, 100, { x: 40, y: 210 }]);
s = snap(box, [other], 0, 0, 3, 595);
assert.deepEqual([s.dx, s.dy, s.guides], [0, 0, { x: undefined, y: undefined }]);
s = snap(box, [], 268, 0, 3, 595);
assert.equal(s.guides.x, 297.5);

const hfCfg = {
  header: ["", "", "Jane Example CV"],
  footer: ["", "Page {page} of {pages}", ""],
  margin: 36,
  skipFirst: false,
  font: "Helvetica",
  size: 9,
  color: "#555555",
};
const hf = headerFooterEls(hfCfg, pages);
assert.deepEqual(
  hf.map((e) => e.text),
  ["Jane Example CV", "Page 1 of 1"],
);
const withHf = extract((await exportPdf(src, hf, new Map())).pdf).els;
const right = withHf.find((e) => e.text === "Jane Example CV")!.orig!.rect;
assert.ok(Math.abs(right.x + right.w - (595 - 36)) < 1, `right edge ${right.x + right.w}`);
const centre = withHf.find((e) => e.text === "Page 1 of 1")!.orig!.rect;
assert.ok(Math.abs(centre.x + centre.w / 2 - 595 / 2) < 1, `centre ${centre.x + centre.w / 2}`);
assert.equal(headerFooterEls({ ...hfCfg, skipFirst: true }, pages).length, 0, "only page is skipped");

// links: typed addresses get a scheme; links follow their text, and removing one removes the annotation
assert.equal(normaliseLink(" jane@example.com "), "mailto:jane@example.com");
assert.equal(normaliseLink("example.com/cv"), "https://example.com/cv");
assert.equal(normaliseLink("https://a.b"), "https://a.b");
assert.equal(normaliseLink("  "), undefined);
const linked = extract(src).els;
linked.find((e) => e.text === "Led a team of four.")!.link = "example.com";
const withLink = extract((await exportPdf(src, linked, new Map())).pdf);
const led = withLink.els.find((e) => e.text === "Led a team of four.")!;
assert.equal(led.link, "https://example.com", "link added to unchanged text");
const pdfWithLink = (await exportPdf(src, linked, new Map())).pdf;
const relinked = extract(pdfWithLink).els;
const mv2 = relinked.find((e) => e.text === "Led a team of four.")!;
mv2.y += 100;
const movedOut = extract((await exportPdf(pdfWithLink, relinked, new Map())).pdf).els;
assert.equal(
  movedOut.find((e) => e.text === "Led a team of four.")!.link,
  "https://example.com",
  "link moves with text",
);
assert.equal(movedOut.filter((e) => e.link).length, 1, "old link removed when the text moves");
const unlinked = extract(pdfWithLink).els;
unlinked.find((e) => e.text === "Led a team of four.")!.link = undefined;
const unlinkedPdf = mupdf.Document.openDocument(
  (await exportPdf(pdfWithLink, unlinked, new Map())).pdf,
  "application/pdf",
);
assert.equal(unlinkedPdf.loadPage(0).getLinks().length, 0, "removed link is gone");

// alignment: wrapped lines centre on x, matching the preview's text-align inside a translated box
assert.deepEqual([alignShift(), alignShift("center"), alignShift("right")], [0, 0.5, 1]);
const centred = (): El => ({
  id: "c",
  page: 0,
  text: "Centred text that wraps onto a second line",
  x: 297.5,
  y: 400,
  ascent: 0.8,
  size: 12,
  color: "#000000",
  font: "Helvetica",
  srcFont: "",
  bold: false,
  italic: false,
  align: "center",
  wrap: 150,
});
const centredOut = extract((await exportPdf(src, [centred()], new Map())).pdf).els.filter((e) => e.orig!.rect.y > 380);
assert.equal(centredOut.length, 2, "wrapped onto two lines");
for (const e of centredOut)
  assert.ok(Math.abs(e.orig!.rect.x + e.orig!.rect.w / 2 - 297.5) < 1, `line centred: ${e.text}`);

// pages: a point shown on a rotated page maps back to the same spot on the unrotated page
for (const rot of [0, 90, 180, 270]) {
  const [w, h] = [600, 800];
  const css = {
    0: (x: number, y: number) => [x, y],
    90: (x: number, y: number) => [h - y, x],
    180: (x: number, y: number) => [w - x, h - y],
    270: (x: number, y: number) => [y, w - x],
  }[rot]!;
  const [u, v] = css(120, 340);
  assert.deepEqual(unrotate(rot, u, v, w, h), [120, 340], `unrotate ${rot}`);
  const [du, dv] = css(130, 345).map((n, i) => n - [u, v][i]);
  assert.deepEqual(unrotateDelta(rot, du, dv), [10, 5], `unrotateDelta ${rot}`);
}
const big = await makeLargeSample();
const four = extract(big);
const pageText = (pdf: Uint8Array, p: number) =>
  mupdf.Document.openDocument(pdf, "application/pdf").loadPage(p).toStructuredText("preserve-whitespace").asText();
const blank = { w: 300, h: 400, rotated: false, blank: true };
const layout = {
  pages: [...four.pages, blank],
  order: [
    { src: 3, rotate: 0 },
    { src: 0, rotate: 90 },
    { src: 4, rotate: 0 },
  ],
};
const onBlank: El = {
  ...centred(),
  id: "b",
  page: 4,
  text: "On the blank page",
  x: 40,
  y: 60,
  align: undefined,
  wrap: undefined,
};
const arranged = await exportPdf(big, [...four.els, onBlank], new Map(), layout);
assert.deepEqual(arranged.problems, []);
const out3 = mupdf.Document.openDocument(arranged.pdf, "application/pdf") as mupdf.PDFDocument;
assert.equal(out3.countPages(), 3, "two pages deleted, one blank added");
assert.equal(pageText(arranged.pdf, 0), pageText(big, 3), "last page moved to the front");
assert.equal(out3.findPage(1).get("Rotate").asNumber(), 90, "second page rotated");
assert.deepEqual(out3.loadPage(2).getBounds().map(Math.round), [0, 0, 300, 400], "blank page has its own size");
assert.match(pageText(arranged.pdf, 2), /On the blank page/);
const numbered = headerFooterEls(
  { ...hfCfg, header: ["", "", ""], footer: ["", "{page}/{pages}", ""] },
  layout.pages,
  layout.order,
);
assert.deepEqual(
  numbered.map((e) => [e.page, e.text]),
  [
    [3, "1/3"],
    [0, "2/3"],
    [4, "3/3"],
  ],
  "numbers follow the new order",
);
assert.deepEqual(
  identityOrder(four.pages).map((s) => s.src),
  [0, 1, 2, 3],
);

const imgs = (els: El[]) => els.filter((e) => e.image);
assert.equal(imgs(extract(pdf).els).length, 1, "untouched image survives text edits");
const del = extract(src).els;
imgs(del)[0].deleted = true;
const noImg = extract((await exportPdf(src, del, new Map())).pdf).els;
assert.equal(imgs(noImg).length, 0, "deleted image is gone");
assert.ok(
  noImg.some((e) => e.text === "2019 - 2024"),
  "text under the image survives",
);
const mv = extract(src).els;
Object.assign(imgs(mv)[0], { x: 100, y: 400 });
const moved2 = imgs(extract((await exportPdf(src, mv, new Map())).pdf).els);
assert.deepEqual(
  moved2.map((e) => [e.x, e.y].map(Math.round)),
  [[100, 400]],
  "moved image lands at the new spot",
);

const area = { l: 36, t: 36, r: 559, b: 806 };
assert.deepEqual(confine(box, -100, 0, area), [26, 0], "left edge stops at 36");
assert.deepEqual(confine(box, 600, 800, area), [509, 694], "right/bottom edges stop inside");
assert.deepEqual(confine({ l: 0, r: 700, t: 50, b: 60, base: 0 }, 5, 0, area), [36, 0], "too wide pins left");

const mono = (t: string) => t.length * 10;
assert.deepEqual(wrapLines("aaa bbb ccc", 75, mono), ["aaa bbb", "ccc"]);
assert.deepEqual(wrapLines("abcdefghij", 40, mono), ["abcd", "efgh", "ij"]);
assert.deepEqual(wrapLines("one\ntwo", undefined, mono), ["one", "two"]);
const helv = measure("Helvetica", new Map());
assert.ok(Math.abs(helv("Hello", 10) - 22.78) < 0.01, `Helvetica width ${helv("Hello", 10)}`);
const para = "Led a team that built and maintained seven services for vehicles";
const wrapped = extract(src).els;
Object.assign(wrapped.find((e) => e.text === "Cut costs by half.")!, { text: para, wrap: 150, lineHeight: 1.5 });
const expectLines = wrapLines(para, 150, (t) => helv(t, 12));
assert.ok(expectLines.length >= 3, `wrapped into ${expectLines.length}`);
const outEls = extract((await exportPdf(src, wrapped, new Map())).pdf).els.filter(
  (e) => e.y > 140 && e.y < 230 && !e.image,
);
assert.deepEqual(
  outEls.map((e) => e.text),
  expectLines,
  "file breaks lines like the preview",
);
const bases = outEls.map((e) => e.y + e.ascent * e.size);
assert.ok(Math.abs(bases[1] - bases[0] - 18) < 0.3, `line spacing ${bases[1] - bases[0]}`);

assert.ok(
  !/from "mupdf"/.test(await Bun.file("src/lib/model.ts").text()),
  "model.ts is loaded by the page, so MuPDF must stay out of it",
);

// compression: a big photo is downscaled and re-encoded, the text stays, and the file shrinks
const photoDoc = await LibDoc.create();
const photoPage = photoDoc.addPage([595, 842]);
photoPage.drawImage(await photoDoc.embedJpg(photo(2400, 1800, 1)), { x: 40, y: 400, width: 400, height: 300 });
photoPage.drawText("Photo page", { x: 40, y: 760, size: 14 });
const photoPdf = await photoDoc.save();
const small = compress(photoPdf, "small");
assert.ok(small.length < photoPdf.length / 4, `compressed ${photoPdf.length} -> ${small.length}`);
const smallDoc = mupdf.Document.openDocument(small, "application/pdf") as mupdf.PDFDocument;
let widest = 0;
smallDoc
  .loadPage(0)
  .toStructuredText("preserve-images")
  .walk({ onImageBlock: (_b, _t, im) => void (widest = im.getWidth()) });
assert.ok(widest > 0 && widest <= 1200, `image downscaled to ${widest}px`);
assert.match(smallDoc.loadPage(0).toStructuredText("preserve-whitespace").asText(), /Photo page/);
assert.ok(compress(small, "small").length <= small.length, "compressing twice never grows the file");

// ats check: clean text passes; small text, image-only pages and columns are flagged
assert.deepEqual(atsCheck(src).issues, [], "the sample reads cleanly");
assert.match(atsCheck(src).pages[0], /^Jane Example/);
const tiny = await exportPdf(src, [{ ...centred(), align: undefined, wrap: undefined, size: 6 }], new Map());
assert.ok(
  atsCheck(tiny.pdf).issues.some((i) => i.includes("smaller than 8 pt")),
  "small text flagged",
);
const scanDoc = await LibDoc.create();
scanDoc
  .addPage([595, 842])
  .drawImage(await scanDoc.embedJpg(photo(300, 200, 2)), { x: 0, y: 0, width: 595, height: 842 });
assert.ok(atsCheck(await scanDoc.save()).issues[0].includes("only images"), "scanned page flagged");
assert.ok(
  atsCheck(big).issues.some((i) => i.includes("columns")),
  "two-column layout flagged",
);

await Bun.write("scripts/out.pdf", pdf);
console.log("ok: all checks passed, wrote scripts/out.pdf");
