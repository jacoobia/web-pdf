// Test files and readers for what the editor saves.
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as mupdf from "mupdf";
import { PDFDocument, PDFName } from "pdf-lib";

const dir = join(tmpdir(), "web-pdf-e2e");
mkdirSync(dir, { recursive: true });
export const SAMPLE = "scripts/sample.pdf";
export const FORM = "scripts/form.pdf";
export const LARGE = "scripts/large.pdf";

export const metaPdf = await (async () => {
  const d = await PDFDocument.create();
  d.addPage([595, 842]).drawText("Metadata page", { x: 40, y: 760, size: 14 });
  d.setTitle("Old title");
  d.setAuthor("Jane Example");
  d.setCreator("Word Processor 9");
  d.setProducer("PDF Maker 2");
  d.catalog.set(
    PDFName.of("Metadata"),
    d.context.register(d.context.stream("<x:xmpmeta xmlns:x='adobe:ns:meta/'/>", { Type: "Metadata", Subtype: "XML" })),
  );
  const file = join(dir, "meta.pdf");
  writeFileSync(file, await d.save());
  return file;
})();
export const plainPdf = (() => {
  const doc = new mupdf.PDFDocument();
  doc.insertPage(0, doc.addPage([0, 0, 595, 842], 0, doc.newDictionary(), ""));
  const file = join(dir, "plain.pdf");
  writeFileSync(file, doc.saveToBuffer("compress").asUint8Array());
  return file;
})();
const pix = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, 400, 200], false);
pix.clear(60);
export const PNG = { name: "logo.png", mimeType: "image/png", buffer: Buffer.from(pix.asPNG()) };
export const JPG = { name: "photo.jpg", mimeType: "image/jpeg", buffer: Buffer.from(pix.asJPEG(80)) };

export const pdfText = (bytes: Uint8Array, p: number) =>
  mupdf.Document.openDocument(bytes, "application/pdf").loadPage(p).toStructuredText("preserve-whitespace").asText();
export const pageCount = (bytes: Uint8Array) => mupdf.Document.openDocument(bytes, "application/pdf").countPages();
export const imageCount = (bytes: Uint8Array, p: number) => {
  let n = 0;
  mupdf.Document.openDocument(bytes, "application/pdf")
    .loadPage(p)
    .toStructuredText("preserve-images")
    .walk({ onImageBlock: () => void n++ });
  return n;
};

export const formValues = (bytes: Uint8Array) =>
  (mupdf.Document.openDocument(bytes, "application/pdf") as mupdf.PDFDocument)
    .loadPage(0)
    .getWidgets()
    .map((w) => `${w.getName()}=${w.getValue()}`);
