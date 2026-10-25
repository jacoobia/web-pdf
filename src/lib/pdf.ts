import fontkit from "@pdf-lib/fontkit";
import * as mupdf from "mupdf";
import { PDFDocument, type PDFFont, type PDFImage, rgb } from "pdf-lib";
import {
  type AtsReport,
  type Compression,
  cleanFontName,
  type El,
  fallbackFont,
  HYPHEN_CHARS,
  HYPHENS,
  isBoldName,
  isDirty,
  isItalicName,
  LINE_HEIGHT,
  linkChanged,
  measure,
  normaliseLink,
  type PageInfo,
  type Rect,
  type Removed,
  removedOn,
  type Slot,
  STANDARD_FONTS,
  textBounds,
  wrapLines,
} from "./model";

export * from "./model";

const open = (bytes: Uint8Array) => mupdf.Document.openDocument(bytes, "application/pdf") as mupdf.PDFDocument;
const round = (n: number) => Math.round(n * 100) / 100;
const hex = (c: mupdf.Color) => {
  const [r, g, b] =
    c.length === 4 ? [0, 1, 2].map((i) => (1 - c[i]) * (1 - c[3])) : c.length === 3 ? c : [c[0], c[0], c[0]];
  return (
    "#" +
    [r, g, b]
      .map((v) =>
        Math.round(v * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
};

const STEXT = "preserve-whitespace,preserve-images";

const overlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const toRect = ([x0, y0, x1, y1]: mupdf.Rect): Rect => ({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });

function webLinks(page: mupdf.PDFPage) {
  return page
    .getLinks()
    .filter((l) => l.isExternal())
    .map((link) => ({ link, uri: link.getURI(), rect: toRect(link.getBounds()) }));
}

function imagePng(doc: mupdf.PDFDocument, page: number, index: number): Uint8Array {
  let n = 0,
    png: Uint8Array | undefined;
  doc
    .loadPage(page)
    .toStructuredText(STEXT)
    .walk({
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
        const l = Math.min(...ink.map((c) => c.l)),
          t = Math.min(...ink.map((c) => c.t));
        const rect = { x: l, y: t, w: Math.max(...ink.map((c) => c.r)) - l, h: Math.max(...ink.map((c) => c.b)) - t };
        const style = { font: fallbackFont(run.name, run.bold, run.italic), size: round(run.size), color: run.color };
        const text = run.chars
          .map((c) => c.c)
          .join("")
          .trim();
        const x = round(ink[0].ox),
          y = round(t);
        els.push({
          id: `p${p}-${els.length}`,
          page: p,
          text,
          x,
          y,
          ...style,
          ascent: (ink[0].oy - t) / run.size,
          srcFont: cleanFontName(run.name),
          bold: run.bold,
          italic: run.italic,
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
        if (rect.w * rect.h > 0.8 * (x1 - x0) * (y1 - y0) || !image.getColorSpace()) return;
        const x = round(rect.x),
          y = round(rect.y);
        const none = { font: "", size: 0, color: "" };
        els.push({
          id: `p${p}-${els.length}`,
          page: p,
          text: "",
          x,
          y,
          ascent: 0,
          ...none,
          srcFont: "",
          bold: false,
          italic: false,
          image: { w: rect.w, h: rect.h, page: p, index },
          orig: { ...none, text: "", x, y, rect },
        });
      },
      beginLine: flush,
      endLine: flush,
      onChar(c, origin, font, size, quad, color) {
        const name = font.getName(),
          col = hex(color);
        const last = run?.chars.at(-1);
        if (run && (run.name !== name || run.size !== size || run.color !== col || (last && origin[0] - last.r > size)))
          flush();
        run ??= {
          name,
          size,
          color: col,
          bold: font.isBold() || isBoldName(name),
          italic: font.isItalic() || isItalicName(name),
          chars: [],
        };
        run.chars.push({
          c,
          ox: origin[0],
          oy: origin[1],
          l: Math.min(quad[0], quad[4]),
          r: Math.max(quad[2], quad[6]),
          t: Math.min(quad[1], quad[3]),
          b: Math.max(quad[5], quad[7]),
        });
      },
    });
    const links = webLinks(page);
    for (const el of els)
      if (el.page === p && !el.image && el.orig) {
        const r = el.orig.rect;
        const hit = links.find((l) => overlap(l.rect, r) > 0.5 * r.w * r.h);
        if (hit) el.link = el.orig.link = hit.uri;
      }
  }
  return { pages, els };
}

function rewriteLinks(doc: mupdf.PDFDocument, els: El[], fonts: Map<string, Uint8Array>) {
  for (let p = 0; p < doc.countPages(); p++) {
    const changed = els.filter((e) => e.page === p && !e.image && (isDirty(e) || linkChanged(e)));
    if (!changed.length) continue;
    const page = doc.loadPage(p);
    const links = webLinks(page);
    for (const el of changed) {
      const old = el.orig?.link && links.find((l) => l.uri === el.orig!.link && overlap(l.rect, el.orig!.rect) > 0);
      if (old) page.deleteLink(old.link);
      const uri = !el.deleted && normaliseLink(el.link);
      if (!uri) continue;
      const r = textBounds(el, fonts);
      page.createLink([r.x, r.y, r.x + r.w, r.y + r.h], uri);
    }
  }
}

function redact(page: mupdf.PDFPage, rects: Rect[], images: boolean) {
  if (!rects.length) return;
  for (const r of rects) {
    const dx = images ? Math.min(1, r.w / 4) : 0.5,
      dy = images ? Math.min(1, r.h / 4) : r.h * 0.25;
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

function pixels(page: mupdf.PDFPage, scale: number) {
  const pix = page.toPixmap([scale, 0, 0, scale, 0, 0], mupdf.ColorSpace.DeviceRGB, false);
  const w = pix.getWidth(),
    h = pix.getHeight(),
    stride = pix.getStride(),
    src = pix.getPixels();
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

export class Previewer {
  private doc: mupdf.PDFDocument;
  private source?: mupdf.PDFDocument;
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
  renderOriginal(page: number, scale: number) {
    const p = (this.source ??= open(this.bytes)).loadPage(page);
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

export function renderPage(bytes: Uint8Array, page: number, scale: number, removed: Removed) {
  const preview = new Previewer(bytes);
  try {
    return preview.render(page, scale, removed);
  } finally {
    preview.destroy();
  }
}

export type Layout = { pages: PageInfo[]; order: Slot[] };

const isIdentity = ({ pages, order }: Layout) =>
  order.length === pages.length && order.every((s, i) => s.src === i && s.rotate === 0);

function arrange(pdf: Uint8Array, { order }: Layout) {
  const doc = open(pdf);
  for (const { src, rotate } of order) {
    if (!rotate) continue;
    const page = doc.findPage(src);
    const now = page.getInheritable("Rotate");
    page.put("Rotate", ((now.isNumber() ? now.asNumber() : 0) + rotate) % 360);
  }
  doc.rearrangePages(order.map((s) => s.src));
  const buf = doc.saveToBuffer("garbage=compact,compress");
  const out = buf.asUint8Array().slice();
  buf.destroy();
  doc.destroy();
  return out;
}

const LEVELS = { balanced: { max: 2000, quality: 80 }, small: { max: 1200, quality: 60 } };

const save = (doc: mupdf.PDFDocument, options: string) => {
  const buf = doc.saveToBuffer(options);
  const out = buf.asUint8Array().slice();
  buf.destroy();
  return out;
};

export function compress(pdf: Uint8Array, level: Exclude<Compression, "off">) {
  const { max, quality } = LEVELS[level];
  const doc = open(pdf);
  const isImage = (o: mupdf.PDFObject) => o.isStream() && o.get("Subtype").toString() === "/Image";
  const masks = new Set<number>();
  for (let i = 1; i < doc.countObjects(); i++) {
    const o = doc.newIndirect(i);
    if (isImage(o) && o.get("SMask").isIndirect()) masks.add(o.get("SMask").asIndirect());
  }
  for (let i = 1; i < doc.countObjects(); i++) {
    const o = doc.newIndirect(i);
    if (!isImage(o) || masks.has(i) || o.get("ImageMask").toString() === "true") continue;
    try {
      const image = doc.loadImage(o);
      const [w, h] = [image.getWidth(), image.getHeight()];
      const k = Math.min(1, max / Math.max(w, h));
      let pix = image.toPixmap();
      const gray = pix.getColorSpace()?.getNumberOfComponents() === 1;
      pix = pix.convertToColorSpace(gray ? mupdf.ColorSpace.DeviceGray : mupdf.ColorSpace.DeviceRGB, false);
      const [nw, nh] = [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
      if (k < 1)
        pix = pix.warp(
          [
            [0, 0],
            [w, 0],
            [w, h],
            [0, h],
          ],
          nw,
          nh,
        );
      const jpeg = pix.asJPEG(quality);
      if (jpeg.length >= o.readRawStream().asUint8Array().length) continue;
      o.writeRawStream(jpeg);
      o.put("Filter", doc.newName("DCTDecode"));
      o.put("Width", nw);
      o.put("Height", nh);
      o.put("ColorSpace", doc.newName(gray ? "DeviceGray" : "DeviceRGB"));
      o.put("BitsPerComponent", 8);
      o.delete("DecodeParms");
      o.delete("Decode");
    } catch {}
  }
  try {
    doc.subsetFonts();
  } catch {}
  const out = save(doc, "garbage=compact,compress,compress-fonts,compress-images,objstms");
  doc.destroy();
  return out.length < pdf.length ? out : pdf;
}

export async function exportPdf(
  bytes: Uint8Array,
  els: El[],
  fonts: Map<string, Uint8Array>,
  layout?: Layout,
  compression: Compression = "off",
): Promise<{ pdf: Uint8Array; problems: string[] }> {
  const doc = open(bytes);
  for (const pg of layout?.pages.slice(doc.countPages()) ?? [])
    doc.insertPage(doc.countPages(), doc.addPage([0, 0, pg.w, pg.h], 0, doc.newDictionary(), ""));
  const pngs = new Map<string, Uint8Array>();
  for (const el of els)
    if (el.image && !el.deleted && isDirty(el)) {
      const key = `${el.image.page}:${el.image.index}`;
      if (!pngs.has(key)) pngs.set(key, imagePng(doc, el.image.page, el.image.index));
    }
  for (let p = 0; p < doc.countPages(); p++) removeEdited(doc.loadPage(p), removedOn(els, p));
  rewriteLinks(doc, els, fonts);
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
  const images = new Map<string, PDFImage>();
  for (const el of els) {
    if (!isDirty(el) || el.deleted) continue;
    const page = pages[el.page];
    const box = page.getCropBox();
    if (el.image) {
      const key = `${el.image.page}:${el.image.index}`;
      if (!images.has(key)) images.set(key, await out.embedPng(pngs.get(key)!));
      page.drawImage(images.get(key)!, {
        x: box.x + el.x,
        y: box.y + box.height - el.y - el.image.h,
        width: el.image.w,
        height: el.image.h,
      });
      continue;
    }
    const { font, has } = await embed(el.font);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(el.color.slice(i, i + 2), 16) / 255);
    const lh = el.lineHeight ?? LINE_HEIGHT;
    const width = measure(el.font, fonts);
    wrapLines(el.text, el.wrap, (t) => width(t, el.size)).forEach((raw, i) => {
      if (!raw.trim()) return;
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
  const drawn = await out.save();
  const squeeze = (pdf: Uint8Array) => (compression === "off" ? pdf : compress(pdf, compression));
  if (!layout || isIdentity(layout)) {
    const pdf = squeeze(drawn);
    return { pdf, problems: verify(pdf, els) };
  }
  const pdf = squeeze(arrange(drawn, layout));
  const at = new Map(layout.order.map((s, i) => [s.src, i]));
  const shown = els.filter((e) => at.has(e.page)).map((e) => ({ ...e, page: at.get(e.page)! }));
  return { pdf, problems: verify(pdf, shown) };
}

const SMALL_TEXT = 8;

const ATS_ISSUES = {
  scanned: ["has", "have", "no selectable text, only images. ATS software can't read scanned pages."],
  unreadable: [
    "has",
    "have",
    "characters that won't read back as normal text. The font may be missing a text encoding.",
  ],
  ligatures: ["uses", "use", 'joined letters such as "ﬁ" or "ﬂ". Some ATS software reads these as one odd character.'],
  small: ["has", "have", `text smaller than ${SMALL_TEXT} pt, which can be hard to parse.`],
  columns: [
    "has",
    "have",
    "text in columns. ATS software reads it in the order shown below, so check it still makes sense.",
  ],
} as const;

const pageList = (ns: number[]) =>
  ns.length === 1
    ? `Page ${ns[0]}`
    : ns.every((n, i) => !i || n === ns[i - 1] + 1)
      ? `Pages ${ns[0]} to ${ns.at(-1)}`
      : `Pages ${ns.slice(0, -1).join(", ")} and ${ns.at(-1)}`;

export function atsCheck(pdf: Uint8Array): AtsReport {
  const doc = open(pdf);
  const pages: string[] = [];
  const found = new Map<keyof typeof ATS_ISSUES, number[]>();
  const flag = (kind: keyof typeof ATS_ISSUES, n: number) => found.set(kind, [...(found.get(kind) ?? []), n]);
  for (let p = 0; p < doc.countPages(); p++) {
    const page = doc.loadPage(p);
    const st = page.toStructuredText(STEXT);
    const text = st.asText().trim();
    pages.push(text);
    const n = p + 1;
    let images = 0,
      smallest = Infinity;
    const lines: mupdf.Rect[] = [];
    st.walk({
      onImageBlock: () => void images++,
      beginLine: (box) => void lines.push(box),
      onChar: (c, _o, _f, size) => void (c.trim() && (smallest = Math.min(smallest, size))),
    });
    if (!text) {
      if (images) flag("scanned", n);
      continue;
    }
    if (/[\uFFFD\uE000-\uF8FF]/.test(text)) flag("unreadable", n);
    if (/[\uFB00-\uFB06]/.test(text)) flag("ligatures", n);
    if (smallest < SMALL_TEXT) flag("small", n);
    const [x0, , x1] = page.getBounds();
    const wide = lines.filter((l) => l[2] - l[0] > 0.25 * (x1 - x0));
    const rows = wide.filter((a) =>
      wide.some(
        (c) => c[0] >= a[2] && Math.min(a[3], c[3]) - Math.max(a[1], c[1]) > 0.5 * Math.min(a[3] - a[1], c[3] - c[1]),
      ),
    );
    if (rows.length >= 3) flag("columns", n);
  }
  doc.destroy();
  const issues = [...found].map(([kind, ns]) => {
    const [one, many, rest] = ATS_ISSUES[kind];
    return `${pageList(ns)} ${ns.length === 1 ? one : many} ${rest}`;
  });
  return { pages, issues };
}

const norm = (s: string) => s.replace(HYPHENS, "-").replace(/\s+/g, " ").trim();

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
