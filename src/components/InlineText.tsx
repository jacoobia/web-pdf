import { useEffect, useRef } from "react";
import { drawnStyle } from "../lib/drawn";
import { type El, LINE_HEIGHT, measure, wrapLines } from "../lib/model";
import "./InlineText.css";

export function InlineText({
  el,
  scale,
  fonts,
  onChange,
  onDone,
}: {
  el: El;
  scale: number;
  fonts: Map<string, Uint8Array>;
  onChange: (text: string) => void;
  onDone: () => void;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => box.current?.focus(), []);
  const width = (t: string) => measure(el.font, fonts)(t, el.size);
  const lines = el.wrap ? wrapLines(el.text, el.wrap, width) : el.text.split("\n");
  return (
    <textarea
      className="inline-text"
      aria-label="Text"
      placeholder="Type your text"
      ref={box}
      value={el.text}
      style={{
        ...drawnStyle(el, scale),
        width: (el.wrap ?? Math.max(...lines.map(width))) * scale + el.size * scale,
        height: lines.length * el.size * (el.lineHeight ?? LINE_HEIGHT) * scale,
      }}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onDone}
      onKeyDown={(e) => (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) && onDone()}
      onPointerDown={(e) => e.stopPropagation()}
    />
  );
}
