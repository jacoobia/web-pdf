// Builds a small CV-like PDF with a subset-embedded TTF, for scripts/check.ts.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

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
  // tight 13pt leading at 12pt, to prove removing one line leaves its neighbours alone
  page.drawText("Built widgets for 5 years.", { x: 40, y: 712, size: 12, font: sans, color: rgb(0.3, 0.3, 0.3) });
  page.drawText("Led a team of four.", { x: 40, y: 699, size: 12, font: sans });
  page.drawText("Cut costs by half.", { x: 40, y: 686, size: 12, font: sans });
  return doc.save();
}

if (import.meta.main) await Bun.write("scripts/sample.pdf", await makeSample());
