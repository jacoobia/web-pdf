import assert from "node:assert/strict";
import * as mupdf from "mupdf";
import { PDFDocument as LibDoc, PDFName } from "pdf-lib";
import { blankPdf } from "../src/lib/model";
import {
  alignShift,
  atsCheck,
  combinePdfs,
  compress,
  type El,
  exportPdf,
  extract,
  familyOf,
  findMatches,
  fontKey,
  headerFooterEls,
  identityOrder,
  isDirty,
  measure,
  mergePdf,
  normaliseLink,
  Previewer,
  parsePageList,
  pickFace,
  removedOn,
  renderPage,
  replaceMatches,
  unrotate,
  unrotateDelta,
  wrapLines,
} from "../src/lib/pdf";
import { confine, snap } from "../src/lib/snap";
import { CALIBRI, makeForm, makeLargeSample, makeSample, photo } from "./sample";

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

// text drawn by MuPDF reads back with plain spaces and the WinAnsi extras of the built-in fonts
const spaced = extract(src).els;
const lead = spaced.find((e) => e.text === "Led a team of four.")!;
Object.assign(lead, { text: "Led a team of six.", font: key });
const quotes = { ...centred(), id: "q", text: "Price €5 – “quoted” it’s", align: undefined, wrap: undefined, y: 600 };
const drawn = (await exportPdf(src, [...spaced, quotes], new Map([[key, calibri]]))).pdf;
const drawnText = pageText(drawn, 0);
assert.ok(drawnText.includes("Led a team of six."), "spaces in a loaded font are U+0020");
assert.ok(!drawnText.includes("\u00a0"), "no non-breaking spaces");
assert.ok(drawnText.includes("Price €5 – “quoted” it’s"), `WinAnsi extras: ${drawnText}`);

// find and replace: every occurrence, case-insensitive unless asked, replaced from the end
const findEls = [
  { ...centred(), id: "a", text: "Agent agent AGENT" },
  { ...centred(), id: "b", text: "aaaa" },
];
assert.deepEqual(
  findMatches(findEls, "agent", false).map((m) => `${m.id}${m.at}`),
  ["a0", "a6", "a12"],
);
assert.deepEqual(
  findMatches(findEls, "Agent", true).map((m) => `${m.id}${m.at}`),
  ["a0"],
);
assert.deepEqual(
  findMatches(findEls, "aa", false).map((m) => `${m.id}${m.at}`),
  ["b0", "b2"],
  "back-to-back matches don't overlap",
);
assert.deepEqual(findMatches(findEls, "", false), []);
assert.equal(replaceMatches("cat sat cat", [0, 8], 3, "tiger"), "tiger sat tiger");
assert.equal(replaceMatches("cat sat cat", [0, 8], 3, "x"), "x sat x");

// page lists for "save some pages"
assert.deepEqual(parsePageList("1-3, 5", 6), [0, 1, 2, 4]);
assert.deepEqual(parsePageList("3-1", 6), [2, 1, 0], "ranges can count down");
assert.deepEqual(parsePageList("2, 2, 1-2", 6), [1, 0], "duplicates dropped");
for (const bad of ["0", "7", "a", "", "1-", "1,,"])
  assert.deepEqual(parsePageList(bad, 6), bad === "1,," ? [0] : null, bad);

// merging: pages are appended after any blank pages, and existing element ids don't change
const merged = mergePdf(src, big, []);
const mergedDoc = mupdf.Document.openDocument(merged.pdf, "application/pdf");
assert.equal(mergedDoc.countPages(), 5);
assert.equal(merged.first, 1);
assert.equal(pageText(merged.pdf, 0), pageText(src, 0));
assert.equal(pageText(merged.pdf, 1), pageText(big, 0));
assert.equal(pageText(merged.pdf, 4), pageText(big, 3));
const withBlank = mergePdf(src, big, [{ w: 300, h: 400, rotated: false, blank: true }]);
assert.equal(withBlank.first, 2, "the blank page became a real page first");
assert.deepEqual(
  mupdf.Document.openDocument(withBlank.pdf, "application/pdf").loadPage(1).getBounds().map(Math.round),
  [0, 0, 300, 400],
);
const idsBefore = extract(src).els.map((e) => e.id);
assert.deepEqual(
  extract(merged.pdf)
    .els.filter((e) => e.page === 0)
    .map((e) => e.id),
  idsBefore,
  "ids for the original pages are unchanged",
);
const combined = combinePdfs([big, src, big]);
assert.equal(mupdf.Document.openDocument(combined, "application/pdf").countPages(), 9);
assert.equal(pageText(combined, 0), pageText(big, 0), "files join in the order given");
assert.equal(pageText(combined, 4), pageText(src, 0));
assert.equal(pageText(combined, 8), pageText(big, 3));

// document info: read the four fields and the hidden details, write changes, strip on request
const metaDoc = await LibDoc.create();
metaDoc.addPage([595, 842]).drawText("Metadata page", { x: 40, y: 760, size: 14 });
metaDoc.setTitle("Old title");
metaDoc.setAuthor("Jane Example");
metaDoc.setSubject("A CV");
metaDoc.setKeywords(["cv", "widgets"]);
metaDoc.setCreator("Word Processor 9");
metaDoc.setProducer("PDF Maker 2");
metaDoc.setCreationDate(new Date(2020, 0, 1));
metaDoc.setModificationDate(new Date(2021, 0, 1));
metaDoc.catalog.set(
  PDFName.of("Metadata"),
  metaDoc.context.register(
    metaDoc.context.stream("<x:xmpmeta xmlns:x='adobe:ns:meta/'/>", { Type: "Metadata", Subtype: "XML" }),
  ),
);
const metaPdf = await metaDoc.save({ updateFieldAppearances: false });
const meta = extract(metaPdf).meta;
assert.deepEqual(
  [meta.title, meta.author, meta.subject, meta.keywords],
  ["Old title", "Jane Example", "A CV", "cv widgets"],
);
assert.equal(meta.hidden.length, 4, `hidden details: ${meta.hidden}`);
const info = (pdf: Uint8Array, key: string) =>
  mupdf.Document.openDocument(pdf, "application/pdf").getMetaData(`info:${key}`) ?? "";
const metaEls = extract(metaPdf).els;
const renamed = (
  await exportPdf(metaPdf, metaEls, new Map(), undefined, "off", { ...meta, title: "New title", author: "" })
).pdf;
assert.equal(info(renamed, "Title"), "New title");
assert.equal(info(renamed, "Author"), "", "cleared author is removed");
assert.equal(info(renamed, "Creator"), "Word Processor 9", "hidden details kept unless stripped");
const stripped = await exportPdf(metaPdf, metaEls, new Map(), undefined, "off", { ...meta, strip: true });
assert.deepEqual(stripped.problems, []);
for (const k of ["Creator", "Producer", "CreationDate", "ModDate"])
  assert.equal(info(stripped.pdf, k), "", `${k} stripped`);
const strippedDoc = mupdf.Document.openDocument(stripped.pdf, "application/pdf") as mupdf.PDFDocument;
assert.ok(!strippedDoc.getTrailer().get("Root").get("Metadata").isStream(), "XMP stripped");
assert.equal(info(stripped.pdf, "Title"), "Old title", "visible fields kept when stripping");
assert.match(pageText(stripped.pdf, 0), /Metadata page/);
const untouched = (await exportPdf(metaPdf, metaEls, new Map())).pdf;
for (const k of ["Title", "Creator", "ModDate"]) assert.equal(info(untouched, k), info(metaPdf, k), `${k} unchanged`);
assert.equal(info(untouched, "Producer"), "Web PDF", "saved files are marked as made with Web PDF");
assert.equal(
  info((await exportPdf(src, extract(src).els, new Map())).pdf, "Producer"),
  "Web PDF",
  "even without an Info dictionary edit",
);

// added images: PNG and JPEG keys are embedded where placed; a missing key is reported
const pngPix = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, 40, 20], false);
pngPix.clear(90);
const added = new Map([
  ["png", { bytes: pngPix.asPNG(), type: "png" as const }],
  ["jpg", { bytes: photo(80, 40, 3), type: "jpg" as const }],
]);
const addedEl = (id: string, key: string, x: number): El => ({
  ...centred(),
  id,
  text: "",
  x,
  y: 300,
  size: 0,
  font: "",
  align: undefined,
  wrap: undefined,
  image: { w: 100, h: 50, page: -1, index: -1, key },
});
const withImages = await exportPdf(
  src,
  [...extract(src).els, addedEl("i1", "png", 50), addedEl("i2", "jpg", 300)],
  new Map(),
  undefined,
  "off",
  undefined,
  added,
);
const boxes: number[][] = [];
mupdf.Document.openDocument(withImages.pdf, "application/pdf")
  .loadPage(0)
  .toStructuredText("preserve-images")
  .walk({ onImageBlock: (b) => void boxes.push(b.map(Math.round)) });
assert.equal(boxes.length, 3, "two added images plus the original");
assert.ok(
  boxes.some((b) => b[0] === 50 && b[1] === 300 && b[2] === 150 && b[3] === 350),
  `png placed: ${JSON.stringify(boxes)}`,
);
assert.ok(
  boxes.some((b) => b[0] === 300 && b[2] === 400),
  "jpeg placed",
);
await assert.rejects(
  exportPdf(src, [addedEl("i3", "gone", 0)], new Map(), undefined, "off", undefined, added),
  /missing/,
);
const resized = extract(src).els.find((e) => e.image)!;
assert.equal(isDirty(resized), false);
resized.image = { ...resized.image!, w: resized.image!.w * 2, h: resized.image!.h * 2 };
assert.equal(isDirty(resized), true, "resizing an original image redraws it");

for (const [locale, w, h] of [
  ["en-GB", 595, 842],
  ["en-US", 612, 792],
] as const) {
  const blank = blankPdf(locale);
  const opened = extract(blank);
  assert.equal(opened.els.length, 0, "a new document starts empty");
  const [page] = opened.pages;
  assert.deepEqual([Math.round(page.w), Math.round(page.h)], [w, h], `${locale} paper size`);
  const typed = { ...hf[0], id: "new", page: 0, text: "Hello" };
  const out = extract((await exportPdf(blank, [typed], new Map())).pdf).els;
  assert.deepEqual(
    out.map((e) => e.text),
    ["Hello"],
    "text saves onto a new document",
  );
}

// forms: fields are read with their kind and state, and filled values are written back
const formPdf = await makeForm();
const fields = extract(formPdf).fields;
assert.deepEqual(
  fields.map((f) => `${f.name}:${f.kind}`),
  [
    "name:text",
    "notes:text",
    "subscribe:check",
    "size:radio",
    "size:radio",
    "country:choice",
    "ref:text",
    "signature:signature",
  ],
);
assert.equal(fields.find((f) => f.name === "ref")!.readOnly, true);
assert.equal(fields.find((f) => f.name === "notes")!.multiline, true);
assert.deepEqual(fields.find((f) => f.kind === "choice")!.options, ["United Kingdom", "Ireland", "France"]);
const filled = fields.map((f) =>
  f.name === "name"
    ? { ...f, value: "Leon S. Kennedy" }
    : f.name === "country"
      ? { ...f, value: "Ireland" }
      : f.name === "subscribe" || f.id === "w0-4"
        ? { ...f, checked: true }
        : f.name === "ref"
          ? { ...f, value: "changed" }
          : f,
);
const back = extract(
  (await exportPdf(formPdf, [], new Map(), undefined, "off", undefined, new Map(), filled)).pdf,
).fields;
const byId = new Map(back.map((f) => [f.id, f]));
assert.equal(byId.get("w0-0")!.value, "Leon S. Kennedy");
assert.equal(byId.get("w0-5")!.value, "Ireland");
assert.equal(byId.get("w0-2")!.checked, true, "checkbox ticked");
assert.deepEqual([byId.get("w0-3")!.checked, byId.get("w0-4")!.checked], [false, true], "second radio chosen");
assert.equal(byId.get("w0-6")!.value, "ABC-123", "read-only fields are left alone");
const unchanged = await exportPdf(formPdf, [], new Map(), undefined, "off", undefined, new Map(), fields);
assert.deepEqual(
  extract(unchanged.pdf).fields.map((f) => [f.value, f.checked]),
  fields.map((f) => [f.value, f.checked]),
);
assert.ok(new Previewer(formPdf).render(0, 1, { text: [], images: [] }).w > 0, "renders without its fields");

await Bun.write("scripts/out.pdf", pdf);
console.log("ok: all checks passed, wrote scripts/out.pdf");
