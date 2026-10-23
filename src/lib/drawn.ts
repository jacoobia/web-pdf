import { type El, LINE_HEIGHT, measure, STANDARD_FONTS, wrapLines } from "./model";

const cssBaseline = (lineHeight: number) => 0.35 + lineHeight / 2;

export const cssFont = (key: string) => {
  const std = STANDARD_FONTS[key];
  return std
    ? { fontFamily: std.css, fontWeight: std.weight, fontStyle: std.italic ? "italic" : "normal" }
    : { fontFamily: `"pf-${key}"`, fontWeight: 400, fontStyle: "normal" };
};

export const drawnStyle = (el: El, scale: number) => ({
  left: el.x * scale,
  top: (el.y + (el.ascent - cssBaseline(el.lineHeight ?? LINE_HEIGHT)) * el.size) * scale,
  width: el.wrap ? el.wrap * scale : undefined,
  lineHeight: el.lineHeight ?? LINE_HEIGHT,
  fontSize: el.size * scale,
  color: el.color,
  transform: el.align === "center" ? "translateX(-50%)" : el.align === "right" ? "translateX(-100%)" : undefined,
  ...cssFont(el.font),
});

export const shownText = (el: El, fonts: Map<string, Uint8Array>) =>
  el.wrap ? wrapLines(el.text, el.wrap, (t) => measure(el.font, fonts)(t, el.size)).join("\n") : el.text;
