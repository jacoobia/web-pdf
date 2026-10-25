import fontkit from "@pdf-lib/fontkit";
import { StandardFontEmbedder } from "pdf-lib";

export const HYPHEN_CHARS = "\u2010\u2011\u2212";
export const HYPHENS = new RegExp(`[${HYPHEN_CHARS}]`, "g");

export type Rect = { x: number; y: number; w: number; h: number };
export type Style = { font: string; size: number; color: string };

export type El = Style & {
  id: string;
  page: number;
  text: string;
  x: number;
  y: number;
  ascent: number;
  srcFont: string;
  bold: boolean;
  italic: boolean;
  deleted?: boolean;
  orig?: Style & { text: string; x: number; y: number; rect: Rect; link?: string };
  align?: "left" | "center" | "right";
  image?: { w: number; h: number; page: number; index: number };
  wrap?: number;
  lineHeight?: number;
  link?: string;
};

export type PageInfo = { w: number; h: number; rotated: boolean; blank?: boolean };

/** One page as shown: `src` indexes `pages`, `rotate` is extra clockwise rotation in degrees. */
export type Slot = { src: number; rotate: number };
export const identityOrder = (pages: PageInfo[]): Slot[] => pages.map((_, src) => ({ src, rotate: 0 }));

const quarter = (rotate: number) => (((rotate % 360) + 360) % 360) / 90;
export const turned = (rotate: number) => quarter(rotate) % 2 === 1;

export function contentTransform(rotate: number, w: number, h: number) {
  return [
    undefined,
    `translateX(${h}px) rotate(90deg)`,
    `translate(${w}px, ${h}px) rotate(180deg)`,
    `translateY(${w}px) rotate(270deg)`,
  ][quarter(rotate)];
}

/** A point (u, v) on a page shown rotated, back in the page's own unrotated coordinates (w x h). */
export function unrotate(rotate: number, u: number, v: number, w: number, h: number): [number, number] {
  return (
    [
      [u, v],
      [v, h - u],
      [w - u, h - v],
      [w - v, u],
    ] as [number, number][]
  )[quarter(rotate)];
}

export function unrotateDelta(rotate: number, du: number, dv: number): [number, number] {
  return (
    [
      [du, dv],
      [dv, -du],
      [-du, -dv],
      [-dv, du],
    ] as [number, number][]
  )[quarter(rotate)];
}

export const LINE_HEIGHT = 1.2;

export const STANDARD_FONTS: Record<string, { css: string; weight: number; italic: boolean }> = {};
for (const [fam, css, faces] of [
  ["Helvetica", "Helvetica, Arial, sans-serif", ["", "-Bold", "-Oblique", "-BoldOblique"]],
  ["Times", '"Times New Roman", Times, serif', ["-Roman", "-Bold", "-Italic", "-BoldItalic"]],
  ["Courier", '"Courier New", Courier, monospace', ["", "-Bold", "-Oblique", "-BoldOblique"]],
] as const) {
  faces.forEach((face, i) => {
    STANDARD_FONTS[fam + face] = { css, weight: i % 2 ? 700 : 400, italic: i >= 2 };
  });
}

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

export function fontFamily(name: string): string {
  return cleanFontName(name)
    .split(/[-,]/)[0]
    .replace(/(PS)?MT$|PS$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function fontHelp(name: string): {
  family: string;
  googleUrl: string;
  alternative?: { family: string; url: string };
} {
  const family = fontFamily(name);
  const alt = ALTERNATIVES[compact(family)];
  return {
    family,
    googleUrl: `https://fonts.google.com/?query=${encodeURIComponent(family)}`,
    alternative: alt ? { family: alt, url: `https://fonts.google.com/specimen/${alt}` } : undefined,
  };
}

export type Align = NonNullable<El["align"]>;
export const alignShift = (a?: Align) => (a === "center" ? 0.5 : a === "right" ? 1 : 0);

export const isBoldName = (n: string) => /bold|black|heavy|semibold/i.test(n);
export const isItalicName = (n: string) => /italic|oblique/i.test(n);

export const familyOf = (key: string) => (STANDARD_FONTS[key] ? key.split("-")[0] : fontFamily(key));

export function pickFace(family: string, keys: string[], bold: boolean, italic: boolean): string {
  if (["Helvetica", "Times", "Courier"].includes(family)) return fallbackFont(family, bold, italic);
  const score = (k: string) =>
    (isBoldName(k) === bold ? 4 : 0) +
    (isItalicName(k) === italic ? 2 : 0) +
    (bold && /bold/i.test(k) ? 1 : 0) -
    (/black|heavy|light|thin|narrow|condensed|semi|demi|medium|extra|ultra/i.test(k) ? 1 : 0);
  return keys.filter((k) => familyOf(k) === family).reduce((a, b) => (score(b) > score(a) ? b : a));
}

export function fallbackFont(name: string, bold: boolean, italic: boolean): string {
  const n = name.toLowerCase();
  const fam = /courier|mono|consol/.test(n)
    ? "Courier"
    : /times|roman|georgia|garamond|cambria|serif|book|minion/.test(n) && !/sans/.test(n)
      ? "Times"
      : "Helvetica";
  if (fam === "Times") return `Times-${bold && italic ? "BoldItalic" : bold ? "Bold" : italic ? "Italic" : "Roman"}`;
  return bold || italic ? `${fam}-${bold ? "Bold" : ""}${italic ? "Oblique" : ""}` : fam;
}

const measurers = new Map<string, (text: string, size: number) => number>();

export function measure(font: string, fonts: Map<string, Uint8Array>): (text: string, size: number) => number {
  const file = fonts.get(font);
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
        return t.length * s * 0.5;
      }
    };
  }
  if (!m) return (t, s) => t.length * s * 0.5;
  measurers.set(font, m);
  return m;
}

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
  header: string[];
  footer: string[];
  margin: number;
  skipFirst: boolean;
};

const ALIGNS = ["left", "center", "right"] as const;

export function headerFooterEls(hf: HeaderFooter, pages: PageInfo[], order = identityOrder(pages)): El[] {
  const els: El[] = [];
  order.forEach(({ src }, n) => {
    const pg = pages[src];
    if (hf.skipFirst && n === 0) return;
    const rows = [
      ["h", hf.header, hf.margin],
      ["f", hf.footer, pg.h - hf.margin - hf.size],
    ] as const;
    for (const [row, texts, y] of rows)
      texts.forEach((text, i) => {
        if (!text.trim()) return;
        els.push({
          id: `hf-${row}${i}-${src}`,
          page: src,
          y,
          ascent: 0.8,
          align: ALIGNS[i],
          x: [hf.margin, pg.w / 2, pg.w - hf.margin][i],
          text: text.replace(/\{page\}/g, String(n + 1)).replace(/\{pages\}/g, String(order.length)),
          font: hf.font,
          size: hf.size,
          color: hf.color,
          srcFont: "",
          bold: isBoldName(hf.font),
          italic: isItalicName(hf.font),
        });
      });
  });
  return els;
}

export function isDirty(el: El): boolean {
  const o = el.orig;
  return (
    !o ||
    !!el.deleted ||
    el.text !== o.text ||
    el.x !== o.x ||
    el.y !== o.y ||
    el.size !== o.size ||
    el.color !== o.color ||
    el.font !== o.font ||
    el.wrap !== undefined ||
    el.lineHeight !== undefined ||
    el.align !== undefined
  );
}

export function normaliseLink(raw?: string) {
  const s = raw?.trim();
  if (!s) return undefined;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
  if (/^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(s)) return `mailto:${s}`;
  return `https://${s}`;
}

export const linkChanged = (el: El) => normaliseLink(el.link) !== el.orig?.link;

/** Where the text of `el` is drawn, in page points. */
export function textBounds(el: El, fonts: Map<string, Uint8Array>): Rect {
  if (!isDirty(el) && el.orig) return el.orig.rect;
  const w = measure(el.font, fonts);
  const lines = wrapLines(el.text, el.wrap, (t) => w(t, el.size));
  const width = Math.max(...lines.map((l) => w(l, el.size)));
  const lh = el.lineHeight ?? LINE_HEIGHT;
  return {
    x: el.x - width * alignShift(el.align),
    y: el.y,
    w: width,
    h: (lines.length - 1) * el.size * lh + el.size,
  };
}

export type Removed = { text: Rect[]; images: Rect[] };

export function removedOn(els: El[], page: number): Removed {
  const gone = els.filter((e) => e.page === page && e.orig && isDirty(e));
  return {
    text: gone.filter((e) => !e.image).map((e) => e.orig!.rect),
    images: gone.filter((e) => e.image).map((e) => e.orig!.rect),
  };
}

export const fontKey = (bytes: Uint8Array) => fontkit.create(bytes).postscriptName ?? "";
