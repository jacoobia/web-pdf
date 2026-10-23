// PDF read/render/write. No DOM, so scripts/check.ts can run it under Bun.
// MuPDF reads text (with fonts), renders pages and truly removes old text (redaction).
// pdf-lib writes the new text with embedded fonts so it stays selectable for ATS parsers.
import * as mupdf from "mupdf";
import { PDFDocument, StandardFontEmbedder, rgb, type PDFFont, type PDFImage } from "pdf-lib";
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
  // Set for images (text fields unused then). `page`/`index` locate the original image; its pixels are only
  // decoded when it's moved, because converting every photo up front made big PDFs slow to open.
  image?: { w: number; h: number; page: number; index: number };
  wrap?: number; // box width in points; text wraps to it. Unset = one line per line break
  lineHeight?: number; // line spacing as a multiple of size, default LINE_HEIGHT
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

const measurers = new Map<string, (text: string, size: number) => number>();

/** Text width in points, measured the way pdf-lib will draw it, so preview and file wrap identically. */
export function measure(font: string, fonts: Map<string, Uint8Array>): (text: string, size: number) => number {
  const file = fonts.get(font);
  // ponytail: cached by font name; reloading a different file under the same name keeps the first metrics
  let m = measurers.get(font);
  if (!m && file) {
    const fk = fontkit.create(file);
    m = (t, s) => (fk.layout(t).glyphs.reduce((w, g) => w + g.advanceWidth, 0) * s) / fk.unitsPerEm;
  } else if (!m && STANDARD_FONTS[font]) {
    const std = StandardFontEmbedder.for(font as Parameters<typeof StandardFontEmbedder.for>[0]);
    m = (t, s) => {
      try {
        return std.widthOfTextAtSize(t.replace(HYPHENS, "-"), s);
      } catch {
        return t.length * s * 0.5; // a character it can't draw; saving reports it properly
      }
    };
  }
  if (!m) return (t, s) => t.length * s * 0.5;
  measurers.set(font, m);
  return m;
}

/** Word-wrap to `width` points (no width: just the line breaks). Words longer than a line get split. */
export function wrapLines(text: string, width: number | undefined, w: (t: string) => number): string[] {
  if (!width) return text.split("\n");
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (w(next) <= width) {
        line = next;
        continue;
      }
      if (line) out.push(line);
      line = word;
      while (line.length > 1 && w(line) > width) {
        let n = line.length - 1;
        while (n > 1 && w(line.slice(0, n)) > width) n--;
        out.push(line.slice(0, n));
        line = line.slice(n);
      }
    }
    out.push(line);
  }
  return out;
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
    el.size !== o.size || el.color !== o.color || el.font !== o.font ||
    el.wrap !== undefined || el.lineHeight !== undefined
  );
}

const open = (bytes: Uint8Array) => mupdf.Document.openDocument(bytes, "application/pdf") as mupdf.PDFDocument;
const round = (n: number) => Math.round(n * 100) / 100;
const hex = (c: mupdf.Color) => {
  const [r, g, b] =
    c.length === 4 ? [0, 1, 2].map((i) => (1 - c[i]) * (1 - c[3])) : c.length === 3 ? c : [c[0], c[0], c[0]];
  return "#" + [r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
};

const STEXT = "preserve-whitespace,preserve-images";

/** PNG of the `index`th image on a page, counted in the same order `extract` sees them. */
function imagePng(doc: mupdf.PDFDocument, page: number, index: number): Uint8Array {
  let n = 0, png: Uint8Array | undefined;
  doc.loadPage(page).toStructuredText(STEXT).walk({
    onImageBlock(_bbox, _transform, image) {
      if (n++ !== index) return;
      let pix = image.toPixmap();
      const c = pix.getColorSpace()?.getNumberOfComponents();
      if (c !== 1 && c !== 3) pix = pix.convertToColorSpace(mupdf.ColorSpace.DeviceRGB, true);
      png = pix.asPNG();
    },
  });
  if (!png) throw new Error(`Image ${index + 1} on page ${page + 1} is missing.`);
  return png;
}

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
    let images = 0;
    page.toStructuredText(STEXT).walk({
      onImageBlock(bbox, _transform, image) {
        const index = images++;
        const rect = { x: bbox[0], y: bbox[1], w: bbox[2] - bbox[0], h: bbox[3] - bbox[1] };
        // ponytail: page-sized backgrounds would swallow every click, so they stay part of the page
        if (rect.w * rect.h > 0.8 * (x1 - x0) * (y1 - y0) || !image.getColorSpace()) return;
        const x = round(rect.x), y = round(rect.y);
        const none = { font: "", size: 0, color: "" };
        els.push({
          id: `p${p}-${els.length}`, page: p, text: "", x, y, ascent: 0, ...none,
          srcFont: "", bold: false, italic: false,
          image: { w: rect.w, h: rect.h, page: p, index },
          orig: { ...none, text: "", x, y, rect },
        });
      },
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

export type Removed = { text: Rect[]; images: Rect[] };

/** Where the originals of edited, moved or deleted items sit on a page: those get removed. */
export function removedOn(els: El[], page: number): Removed {
  const gone = els.filter((e) => e.page === page && e.orig && isDirty(e));
  return { text: gone.filter((e) => !e.image).map((e) => e.orig!.rect), images: gone.filter((e) => e.image).map((e) => e.orig!.rect) };
}

/** Text and images go in separate passes so removing one never touches the other. */
function redact(page: mupdf.PDFPage, rects: Rect[], images: boolean) {
  if (!rects.length) return;
  for (const r of rects) {
    // Shrunk so glyphs on neighbouring lines (or images just touching) that overlap the edge survive.
    const dx = images ? Math.min(1, r.w / 4) : 0.5, dy = images ? Math.min(1, r.h / 4) : r.h * 0.25;
    page.createAnnotation("Redact").setRect([r.x + dx, r.y + dy, r.x + r.w - dx, r.y + r.h - dy]);
  }
  page.applyRedactions(
    false,
    images ? mupdf.PDFPage.REDACT_IMAGE_REMOVE : mupdf.PDFPage.REDACT_IMAGE_NONE,
    mupdf.PDFPage.REDACT_LINE_ART_NONE,
    images ? mupdf.PDFPage.REDACT_TEXT_NONE : mupdf.PDFPage.REDACT_TEXT_REMOVE,
  );
}

function removeEdited(page: mupdf.PDFPage, removed: Removed) {
  redact(page, removed.text, false);
  redact(page, removed.images, true);
}

/** RGBA pixels of a page. Raw pixels, because PNG encoding was the slow part. */
function pixels(page: mupdf.PDFPage, scale: number) {
  const pix = page.toPixmap([scale, 0, 0, scale, 0, 0], mupdf.ColorSpace.DeviceRGB, false);
  const w = pix.getWidth(), h = pix.getHeight(), stride = pix.getStride(), src = pix.getPixels();
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0, s = y * stride, d = y * w * 4; x < w; x++, s += 3, d += 4) {
      rgba[d] = src[s];
      rgba[d + 1] = src[s + 1];
      rgba[d + 2] = src[s + 2];
      rgba[d + 3] = 255;
    }
  pix.destroy();
  return { w, h, rgba };
}

const rectKey = (kind: string, r: Rect) => `${kind}${r.x},${r.y},${r.w},${r.h}`;

/**
 * Keeps one document open for previews. Removing an original changes the open document for good, so
 * new removals are applied on top of earlier ones; only taking one back (undo, reset) reopens it.
 */
export class Previewer {
  private doc: mupdf.PDFDocument;
  private source?: mupdf.PDFDocument; // untouched copy, for decoding images whose original has been removed
  private applied = new Map<number, Set<string>>();
  constructor(private bytes: Uint8Array) {
    this.doc = open(bytes);
  }
  render(page: number, scale: number, removed: Removed) {
    const want = new Set([...removed.text.map((r) => rectKey("t", r)), ...removed.images.map((r) => rectKey("i", r))]);
    const have = this.applied.get(page) ?? new Set<string>();
    if ([...have].some((k) => !want.has(k))) {
      this.doc.destroy();
      this.doc = open(this.bytes);
      this.applied.clear();
      have.clear();
    }
    const p = this.doc.loadPage(page);
    removeEdited(p, {
      text: removed.text.filter((r) => !have.has(rectKey("t", r))),
      images: removed.images.filter((r) => !have.has(rectKey("i", r))),
    });
    this.applied.set(page, want);
    const out = pixels(p, scale);
    p.destroy();
    return out;
  }
  imagePng(page: number, index: number) {
    return imagePng((this.source ??= open(this.bytes)), page, index);
  }
  destroy() {
    this.doc.destroy();
    this.source?.destroy();
  }
}

/** One-off render from a freshly opened document. */
export function renderPage(bytes: Uint8Array, page: number, scale: number, removed: Removed) {
  const preview = new Previewer(bytes);
  try {
    return preview.render(page, scale, removed);
  } finally {
    preview.destroy();
  }
}

export async function exportPdf(
  bytes: Uint8Array,
  els: El[],
  fonts: Map<string, Uint8Array>,
): Promise<{ pdf: Uint8Array; problems: string[] }> {
  const doc = open(bytes);
  // Decode moved images before their originals are removed below.
  const pngs = new Map<string, Uint8Array>();
  for (const el of els)
    if (el.image && !el.deleted && isDirty(el)) {
      const key = `${el.image.page}:${el.image.index}`;
      if (!pngs.has(key)) pngs.set(key, imagePng(doc, el.image.page, el.image.index));
    }
  for (let p = 0; p < doc.countPages(); p++) removeEdited(doc.loadPage(p), removedOn(els, p));
  // garbage collection drops the old content streams, so the removed text is gone from the file bytes too
  // Copied out: asUint8Array is a view into MuPDF's memory, which goes blank if that memory grows while
  // pdf-lib (async) is still reading it, e.g. when a preview renders in the same worker meanwhile.
  const saved = doc.saveToBuffer("garbage=compact,compress");
  const cleaned = saved.asUint8Array().slice();
  saved.destroy();

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
  const images = new Map<string, PDFImage>(); // embedded once even when copies share an image
  for (const el of els) {
    if (!isDirty(el) || el.deleted) continue;
    const page = pages[el.page];
    const box = page.getCropBox();
    if (el.image) {
      const key = `${el.image.page}:${el.image.index}`;
      if (!images.has(key)) images.set(key, await out.embedPng(pngs.get(key)!));
      // ponytail: redrawn upright at its box size, so a rotated or skewed image comes back straight
      page.drawImage(images.get(key)!, {
        x: box.x + el.x, y: box.y + box.height - el.y - el.image.h, width: el.image.w, height: el.image.h,
      });
      continue;
    }
    const { font, has } = await embed(el.font);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(el.color.slice(i, i + 2), 16) / 255);
    const lh = el.lineHeight ?? LINE_HEIGHT;
    const width = measure(el.font, fonts);
    wrapLines(el.text, el.wrap, (t) => width(t, el.size)).forEach((raw, i) => {
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
        y: box.y + box.height - el.y - el.ascent * el.size - i * el.size * lh,
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
