// PDF read/render/write. No DOM, so scripts/check.ts can run it under Bun.
// MuPDF reads text (with fonts), renders pages and truly removes old text (redaction).
// pdf-lib writes the new text with embedded fonts so it stays selectable for ATS parsers.
import * as mupdf from "mupdf";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export type Rect = { x: number; y: number; w: number; h: number };
export type Style = { font: string; size: number; color: string };

// All coordinates are PDF points from the page's top-left corner, y down.
export type El = Style & {
  id: string;
  page: number;
  text: string;
  x: number;
  y: number;
  ascent: number; // baseline offset from y, as a fraction of size
  srcFont: string; // font name in the original PDF, "" for added text
  bold: boolean;
  italic: boolean;
  deleted?: boolean;
  orig?: Style & { text: string; x: number; y: number; rect: Rect };
  align?: "left" | "center" | "right"; // which edge of the text sits at x
};

export type PageInfo = { w: number; h: number; rotated: boolean };

export const LINE_HEIGHT = 1.2;

export const STANDARD_FONTS: Record<string, { css: string; weight: number; italic: boolean }> = {};
for (const [fam, css, faces] of [
  ["Helvetica", "Helvetica, Arial, sans-serif", ["", "-Bold", "-Oblique", "-BoldOblique"]],
  ["Times", '"Times New Roman", Times, serif', ["-Roman", "-Bold", "-Italic", "-BoldItalic"]],
  ["Courier", '"Courier New", Courier, monospace', ["", "-Bold", "-Oblique", "-BoldOblique"]],
] as const) {
  faces.forEach((face, i) => (STANDARD_FONTS[fam + face] = { css, weight: i % 2 ? 700 : 400, italic: i >= 2 }));
}

// Metric-compatible free fonts (same character widths) for common Microsoft fonts.
const ALTERNATIVES: Record<string, string> = {
  calibri: "Carlito",
  cambria: "Caladea",
  arial: "Arimo",
  helvetica: "Arimo",
  timesnewroman: "Tinos",
  times: "Tinos",
  couriernew: "Cousine",
  georgia: "Gelasio",
};

export const cleanFontName = (n: string) => n.replace(/^[A-Z]{6}\+/, "");
export const compact = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, "");

/** "ABCDEF+TimesNewRomanPS-BoldMT" -> "Times New Roman" */
export function fontFamily(name: string): string {
  return cleanFontName(name)
    .split(/[-,]/)[0]
    .replace(/(PS)?MT$|PS$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function fontHelp(name: string): { family: string; googleUrl: string; alternative?: { family: string; url: string } } {
  const family = fontFamily(name);
  const alt = ALTERNATIVES[compact(family)];
  return {
    family,
    googleUrl: `https://fonts.google.com/?query=${encodeURIComponent(family)}`,
    alternative: alt ? { family: alt, url: `https://fonts.google.com/specimen/${alt}` } : undefined,
  };
}

export const isBoldName = (n: string) => /bold|black|heavy|semibold/i.test(n);
export const isItalicName = (n: string) => /italic|oblique/i.test(n);

/** "Times-BoldItalic" -> "Times", "Arial-BoldMT" -> "Arial" */
export const familyOf = (key: string) => (STANDARD_FONTS[key] ? key.split("-")[0] : fontFamily(key));

/** The face of `family` closest to the wanted weight and style, from built-ins or loaded `keys`. */
export function pickFace(family: string, keys: string[], bold: boolean, italic: boolean): string {
  if (["Helvetica", "Times", "Courier"].includes(family)) return fallbackFont(family, bold, italic);
  // Plain "Bold" beats Black/Semibold, and faces with extra variants (Light, Narrow…) lose ties.
  const score = (k: string) =>
    (isBoldName(k) === bold ? 4 : 0) + (isItalicName(k) === italic ? 2 : 0) + (bold && /bold/i.test(k) ? 1 : 0) -
    (/black|heavy|light|thin|narrow|condensed|semi|demi|medium|extra|ultra/i.test(k) ? 1 : 0);
  return keys.filter((k) => familyOf(k) === family).reduce((a, b) => (score(b) > score(a) ? b : a));
}

export function fallbackFont(name: string, bold: boolean, italic: boolean): string {
  const n = name.toLowerCase();
  // ponytail: name sniffing, mupdf's serif flag is unreliable (it calls Calibri serif)
  const fam = /courier|mono|consol/.test(n)
    ? "Courier"
    : /times|roman|georgia|garamond|cambria|serif|book|minion/.test(n) && !/sans/.test(n)
      ? "Times"
      : "Helvetica";
  if (fam === "Times") return `Times-${bold && italic ? "BoldItalic" : bold ? "Bold" : italic ? "Italic" : "Roman"}`;
  return bold || italic ? `${fam}-${bold ? "Bold" : ""}${italic ? "Oblique" : ""}` : fam;
}

export type HeaderFooter = Style & {
  header: string[]; // left, centre, right
  footer: string[];
  margin: number; // points from the page edge
  skipFirst: boolean;
};

const ALIGNS = ["left", "center", "right"] as const;

/** Header/footer text as plain new elements, with {page} and {pages} filled in. */
export function headerFooterEls(hf: HeaderFooter, pages: PageInfo[]): El[] {
  const els: El[] = [];
  pages.forEach((pg, p) => {
    if (hf.skipFirst && p === 0) return;
    const rows = [["h", hf.header, hf.margin], ["f", hf.footer, pg.h - hf.margin - hf.size]] as const;
    for (const [row, texts, y] of rows)
      texts.forEach((text, i) => {
        if (!text.trim()) return;
        els.push({
          id: `hf-${row}${i}-${p}`, page: p, y, ascent: 0.8, align: ALIGNS[i],
          x: [hf.margin, pg.w / 2, pg.w - hf.margin][i],
          text: text.replace(/\{page\}/g, String(p + 1)).replace(/\{pages\}/g, String(pages.length)),
          font: hf.font, size: hf.size, color: hf.color,
          srcFont: "", bold: isBoldName(hf.font), italic: isItalicName(hf.font),
        });
      });
  });
  return els;
}

export function isDirty(el: El): boolean {
  const o = el.orig;
  return (
    !o || !!el.deleted || el.text !== o.text || el.x !== o.x || el.y !== o.y ||
    el.size !== o.size || el.color !== o.color || el.font !== o.font
  );
}

const open = (bytes: Uint8Array) => mupdf.Document.openDocument(bytes, "application/pdf") as mupdf.PDFDocument;
const round = (n: number) => Math.round(n * 100) / 100;
const hex = (c: mupdf.Color) => {
  const [r, g, b] =
    c.length === 4 ? [0, 1, 2].map((i) => (1 - c[i]) * (1 - c[3])) : c.length === 3 ? c : [c[0], c[0], c[0]];
  return "#" + [r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
};

type Ch = { c: string; ox: number; oy: number; l: number; r: number; t: number; b: number };
type Run = { name: string; size: number; color: string; bold: boolean; italic: boolean; chars: Ch[] };

/** One element per run of same-styled text on a line; big gaps (right-aligned dates) split runs. */
export function extract(bytes: Uint8Array): { pages: PageInfo[]; els: El[] } {
  const doc = open(bytes);
  const pages: PageInfo[] = [];
  const els: El[] = [];
  for (let p = 0; p < doc.countPages(); p++) {
    const page = doc.loadPage(p);
    const [x0, y0, x1, y1] = page.getBounds();
    const rotate = page.getObject().getInheritable("Rotate");
    pages.push({ w: x1 - x0, h: y1 - y0, rotated: rotate.isNumber() && rotate.asNumber() % 360 !== 0 });

    let run = null as Run | null;
    const flush = () => {
      const ink = run?.chars.filter((ch) => ch.c.trim()) ?? [];
      if (run && ink.length) {
        const l = Math.min(...ink.map((c) => c.l)), t = Math.min(...ink.map((c) => c.t));
        const rect = { x: l, y: t, w: Math.max(...ink.map((c) => c.r)) - l, h: Math.max(...ink.map((c) => c.b)) - t };
        const style = { font: fallbackFont(run.name, run.bold, run.italic), size: round(run.size), color: run.color };
        const text = run.chars.map((c) => c.c).join("").trim();
        const x = round(ink[0].ox), y = round(t);
        els.push({
          id: `p${p}-${els.length}`, page: p, text, x, y, ...style,
          ascent: (ink[0].oy - t) / run.size,
          srcFont: cleanFontName(run.name), bold: run.bold, italic: run.italic,
          orig: { ...style, text, x, y, rect },
        });
      }
      run = null;
    };
    page.toStructuredText("preserve-whitespace").walk({
      beginLine: flush,
      endLine: flush,
      onChar(c, origin, font, size, quad, color) {
        const name = font.getName(), col = hex(color);
        const last = run?.chars.at(-1);
        if (run && (run.name !== name || run.size !== size || run.color !== col || (last && origin[0] - last.r > size)))
          flush();
        run ??= {
          name, size, color: col,
          bold: font.isBold() || isBoldName(name),
          italic: font.isItalic() || isItalicName(name),
          chars: [],
        };
        run.chars.push({
          c, ox: origin[0], oy: origin[1],
          l: Math.min(quad[0], quad[4]), r: Math.max(quad[2], quad[6]),
          t: Math.min(quad[1], quad[3]), b: Math.max(quad[5], quad[7]),
        });
      },
    });
  }
  return { pages, els };
}

function redact(page: mupdf.PDFPage, rects: Rect[]) {
  if (!rects.length) return;
  for (const r of rects) {
    // Shrunk so glyphs on neighbouring lines that overlap the box edge survive.
    const dy = r.h * 0.25;
    page.createAnnotation("Redact").setRect([r.x + 0.5, r.y + dy, r.x + r.w - 0.5, r.y + r.h - dy]);
  }
  page.applyRedactions(
    false,
    mupdf.PDFPage.REDACT_IMAGE_NONE,
    mupdf.PDFPage.REDACT_LINE_ART_NONE,
    mupdf.PDFPage.REDACT_TEXT_REMOVE,
  );
}

const removedRects = (els: El[], page: number) =>
  els.filter((e) => e.page === page && e.orig && isDirty(e)).map((e) => e.orig!.rect);

/** PNG of a page with the original text of edited/moved/deleted elements removed. */
export function renderPage(bytes: Uint8Array, page: number, scale: number, els: El[]): Uint8Array {
  // ponytail: reopens the document per render, fine for CV-sized files; cache docs if big PDFs lag
  const p = open(bytes).loadPage(page);
  redact(p, removedRects(els, page));
  return p.toPixmap([scale, 0, 0, scale, 0, 0], mupdf.ColorSpace.DeviceRGB, false).asPNG();
}

export async function exportPdf(
  bytes: Uint8Array,
  els: El[],
  fonts: Map<string, Uint8Array>,
): Promise<{ pdf: Uint8Array; problems: string[] }> {
  const doc = open(bytes);
  for (let p = 0; p < doc.countPages(); p++) redact(doc.loadPage(p), removedRects(els, p));
  // garbage collection drops the old content streams, so the removed text is gone from the file bytes too
  const cleaned = doc.saveToBuffer("garbage=compact,compress").asUint8Array();

  const out = await PDFDocument.load(cleaned);
  out.registerFontkit(fontkit);
  const embedded = new Map<string, { font: PDFFont; has: (ch: string) => boolean }>();
  const embed = async (key: string) => {
    if (!embedded.has(key)) {
      const file = fonts.get(key);
      if (!file && !STANDARD_FONTS[key]) throw new Error(`Font "${key}" isn't loaded.`);
      const font = await (file ? out.embedFont(file, { subset: true }) : out.embedFont(key));
      // Loaded fonts silently draw a blank box for missing glyphs, so ask the font file itself.
      const fk = file && fontkit.create(file);
      const has = fk
        ? (ch: string) => fk.hasGlyphForCodePoint(ch.codePointAt(0)!)
        : (ch: string) => {
            try {
              font.encodeText(ch);
              return true;
            } catch {
              return false;
            }
          };
      embedded.set(key, { font, has });
    }
    return embedded.get(key)!;
  };

  const pages = out.getPages();
  for (const el of els) {
    if (!isDirty(el) || el.deleted) continue;
    const { font, has } = await embed(el.font);
    const page = pages[el.page];
    const box = page.getCropBox();
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(el.color.slice(i, i + 2), 16) / 255);
    el.text.split("\n").forEach((raw, i) => {
      if (!raw.trim()) return;
      // A font lacking a fancy hyphen gets the identical-looking plain one.
      const line = [...raw].map((ch) => (!has(ch) && HYPHEN_CHARS.includes(ch) && has("-") ? "-" : ch)).join("");
      const bad = [...line].find((ch) => !has(ch));
      if (bad)
        throw new Error(
          `${el.font} has no "${bad}" (U+${bad.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}), used in "${line}". ` +
            `Load the original font (or one that has this character) and choose it for this text.`,
        );
      const w = el.align && el.align !== "left" ? font.widthOfTextAtSize(line, el.size) : 0;
      page.drawText(line, {
        x: box.x + el.x - (el.align === "center" ? w / 2 : w),
        y: box.y + box.height - el.y - el.ascent * el.size - i * el.size * LINE_HEIGHT,
        size: el.size,
        font,
        color: rgb(r, g, b),
      });
    });
  }
  const pdf = await out.save();
  return { pdf, problems: verify(pdf, els) };
}

// Hyphen, non-breaking hyphen, minus sign. Often the same glyph as "-", so they read back as "-".
const HYPHEN_CHARS = "\u2010\u2011\u2212";
const HYPHENS = new RegExp(`[${HYPHEN_CHARS}]`, "g");
const norm = (s: string) => s.replace(HYPHENS, "-").replace(/\s+/g, " ").trim();

/** Re-read the output: old text must be gone, new text must be extractable. */
function verify(pdf: Uint8Array, els: El[]): string[] {
  const doc = open(pdf);
  const problems: string[] = [];
  for (let p = 0; p < doc.countPages(); p++) {
    const found = norm(doc.loadPage(p).toStructuredText("preserve-whitespace").asText());
    const live = els.filter((e) => e.page === p && !e.deleted);
    const current = norm(live.map((e) => e.text).join(" "));
    for (const el of els.filter((e) => e.page === p)) {
      const old = el.orig && norm(el.orig.text);
      if (old && (el.deleted || el.text !== el.orig!.text) && found.includes(old) && !current.includes(old))
        problems.push(`Old text is still in the file: "${el.orig!.text}"`);
    }
    for (const el of live.filter(isDirty))
      for (const line of el.text.split("\n").map(norm))
        if (line && !found.includes(line)) problems.push(`New text can't be read back as text: "${line}"`);
  }
  return problems;
}

export const fontKey = (bytes: Uint8Array) => fontkit.create(bytes).postscriptName ?? "";
