import { memo } from "react";
import { cx } from "../lib/cx";
import { drawnStyle, shownText } from "../lib/drawn";
import type { ElHandlers } from "../lib/editor";
import { type El, isDirty } from "../lib/model";

const boxOf = (el: El, scale: number) => {
  const r = el.orig?.rect;
  const dirty = isDirty(el);
  if (el.image && dirty)
    return { left: el.x * scale, top: el.y * scale, width: el.image.w * scale, height: el.image.h * scale };
  if (dirty || !r) return drawnStyle(el, scale);
  return { left: r.x * scale, top: r.y * scale, width: r.w * scale, height: r.h * scale };
};

export const PageItem = memo(function PageItem({
  el,
  scale,
  selected,
  single,
  fonts,
  on,
  imageSrc,
}: {
  el: El;
  scale: number;
  selected: boolean;
  single: boolean;
  fonts: Map<string, Uint8Array>;
  on: ElHandlers;
  imageSrc?: string;
}) {
  const dirty = isDirty(el);
  const drawn = dirty || !el.orig?.rect;
  const kind = el.image ? (dirty ? "img moved" : "img hit") : drawn ? "drawn" : "hit";
  return (
    <div
      data-id={el.id}
      className={cx("el", kind, selected && "sel", el.link && "linked")}
      style={boxOf(el, scale)}
      title={el.srcFont || undefined}
      onPointerDown={(e) => on.down(e, el)}
      onPointerMove={on.move}
      onPointerUp={on.up}
      onDoubleClick={on.focusText}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={el.image ? "Image" : el.text}
      onFocus={() => on.focus(el)}
      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), on.focusText())}
    >
      {el.image
        ? dirty && imageSrc && <img src={imageSrc} alt="" draggable={false} />
        : drawn
          ? shownText(el, fonts) || "\u00a0"
          : null}
      {single && !el.image && (
        <span
          className="resize"
          title="Drag to set the width so text wraps. Double-click for automatic width."
          onPointerDown={on.resizeStart}
          onPointerMove={(e) => on.resizeMove(e, el)}
          onPointerUp={on.resizeEnd}
          onDoubleClick={(e) => (e.stopPropagation(), on.unwrap(el.id))}
        />
      )}
      {single && el.image && (
        <span
          className="resize corner"
          title="Drag to resize"
          onPointerDown={on.resizeStart}
          onPointerMove={(e) => on.resizeMove(e, el)}
          onPointerUp={on.resizeEnd}
        />
      )}
    </div>
  );
});

export const HeaderFooterItem = ({ el, scale }: { el: El; scale: number }) => (
  <div className="el drawn hf" style={drawnStyle(el, scale)}>
    {el.text}
  </div>
);
