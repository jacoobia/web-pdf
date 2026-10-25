import fontkit from "@pdf-lib/fontkit";
import * as mupdf from "mupdf";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export const CALIBRI = "C:/Windows/Fonts/calibri.ttf";

export async function makeSample(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const page = doc.addPage([595, 842]);
  const sans = await doc.embedFont(await Bun.file(CALIBRI).bytes(), { subset: true });
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  page.drawRectangle({ x: 40, y: 760, width: 515, height: 2, color: rgb(0.2, 0.4, 0.8) });
  page.drawText("Jane Example", { x: 40, y: 780, size: 24, font: bold });
  page.drawText("Senior Widget Engineer at Acme Ltd", { x: 40, y: 730, size: 12, font: sans });
  page.drawText("2019 - 2024", { x: 480, y: 730, size: 12, font: sans });
  const pix = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, 20, 10], false);
  pix.clear(200);
  page.drawImage(await doc.embedPng(pix.asPNG()), { x: 470, y: 720, width: 60, height: 30 });
  page.drawText("Built widgets for 5 years.", { x: 40, y: 712, size: 12, font: sans, color: rgb(0.3, 0.3, 0.3) });
  page.drawText("Led a team of four.", { x: 40, y: 699, size: 12, font: sans });
  page.drawText("Cut costs by half.", { x: 40, y: 686, size: 12, font: sans });
  return doc.save();
}

const WORDS = (
  "designed built led shipped migrated owned scaled improved services platform pipelines Kafka Spring " +
  "Boot AWS microservices team graduates customers vehicles data events latency reliability cost releases " +
  "architecture reviews standards stakeholders metrics dashboards features subscriptions onboarding"
).split(" ");

export async function makeLargeSample(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const sans = await doc.embedFont(await Bun.file(CALIBRI).bytes(), { subset: true });
  const bold = await doc.embedFont(await Bun.file("C:/Windows/Fonts/calibrib.ttf").bytes(), { subset: true });
  const pix = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, 120, 16], false);
  pix.clear(170);
  const logo = await doc.embedPng(pix.asPNG());
  const orange = rgb(0.9, 0.55, 0.2),
    grey = rgb(0.35, 0.35, 0.35);
  let seed = 7;
  const word = () => WORDS[(seed = (seed * 31 + 11) % 997) % WORDS.length];
  const sentence = (n: number) => Array.from({ length: n }, word).join(" ");
  for (let p = 0; p < 4; p++) {
    const page = doc.addPage([612, 792]);
    page.drawImage(logo, { x: 42, y: 756, width: 92, height: 12 });
    if (p === 0) page.drawText("Jane Example", { x: 36, y: 700, size: 34, font: bold, color: orange });
    let y = p === 0 ? 650 : 740;
    for (let role = 0; y > 90; role++) {
      page.drawText(`Example Company ${p * 4 + role} /`, { x: 36, y, size: 13, font: bold });
      page.drawText("JAN 2020 - DEC 2022", { x: 210, y, size: 8, font: sans, color: grey });
      page.drawText("Senior Software Engineer", { x: 36, y: (y -= 16), size: 11, font: sans });
      y -= 16;
      for (let b = 0; b < 6 && y > 70; b++, y -= 12.5) page.drawText(sentence(9), { x: 36, y, size: 9, font: sans });
      page.drawText("Java, Spring Boot, Kafka, AWS, TypeScript", {
        x: 36,
        y: (y -= 6),
        size: 9,
        font: sans,
        color: grey,
      });
      y -= 24;
    }
    for (let row = 0, ry = p === 0 ? 650 : 740; row < 30; row++, ry -= 18)
      page.drawText(row % 6 === 0 ? "SECTION" : sentence(6), {
        x: 330,
        y: ry,
        size: row % 6 === 0 ? 10 : 9,
        font: row % 6 === 0 ? bold : sans,
        color: row % 6 === 0 ? orange : grey,
      });
    page.drawText("Updated 2026", { x: 512, y: 20, size: 8, font: sans, color: grey });
  }
  return doc.save();
}

export function photo(w: number, h: number, seed: number): Uint8Array {
  const pix = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, w, h], false);
  const px = pix.getPixels();
  for (let i = 0, s = seed; i < px.length; i++) px[i] = (s = (s * 1103515245 + 12345) >>> 0) >>> 24;
  return pix.asJPEG(92);
}

export async function makeHeavySample(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const sans = await doc.embedFont(await Bun.file(CALIBRI).bytes(), { subset: true });
  const bold = await doc.embedFont(await Bun.file("C:/Windows/Fonts/calibrib.ttf").bytes(), { subset: true });
  const photos = await Promise.all([1, 2, 3, 4, 5, 6].map((i) => doc.embedJpg(photo(2400, 1800, i))));
  let seed = 3;
  const word = () => WORDS[(seed = (seed * 31 + 11) % 997) % WORDS.length];
  const sentence = (n: number) => Array.from({ length: n }, word).join(" ");
  const line = rgb(0.75, 0.75, 0.8);
  for (let p = 0; p < 60; p++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`Section ${p + 1}`, { x: 36, y: 750, size: 16, font: bold });
    if (p % 10 === 3) page.drawImage(photos[(p / 10) | 0], { x: 36, y: 520, width: 300, height: 225 });
    const top = p % 10 === 3 ? 505 : 730;
    for (let col = 0; col < 2; col++)
      for (let y = top; y > 250; y -= 11) page.drawText(sentence(7), { x: 36 + col * 280, y, size: 8.5, font: sans });
    for (let r = 0; r <= 8; r++)
      page.drawLine({ start: { x: 36, y: 230 - r * 22 }, end: { x: 576, y: 230 - r * 22 }, color: line });
    for (let c = 0; c <= 6; c++)
      page.drawLine({ start: { x: 36 + c * 90, y: 230 }, end: { x: 36 + c * 90, y: 54 }, color: line });
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 6; c++)
        page.drawText(sentence(2), { x: 40 + c * 90, y: 214 - r * 22, size: 8, font: r ? sans : bold });
    page.drawText(`Page ${p + 1} of 60`, { x: 270, y: 30, size: 8, font: sans });
  }
  return doc.save();
}

if (import.meta.main) {
  await Bun.write("scripts/sample.pdf", await makeSample());
  await Bun.write("scripts/large.pdf", await makeLargeSample());
  if (Bun.argv.includes("--heavy")) await Bun.write("scripts/heavy.pdf", await makeHeavySample());
}
