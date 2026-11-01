import { type PointerEvent, useRef } from "react";
import "./SheetHandle.css";

/** Animates a sheet to `to`, then runs `done` and hands the transform back to CSS. */
export function slide(sheet: HTMLElement, to: string, done?: () => void) {
  Object.assign(sheet.style, { transition: "transform 200ms ease", transform: to });
  setTimeout(() => {
    done?.();
    requestAnimationFrame(() => Object.assign(sheet.style, { transition: "", transform: "" }));
  }, 200);
}

type Drag = { begin(): boolean; move(dy: number): void; end(close: boolean): void };

/** Grab bar for a bottom sheet on phones: drag it down to close the sheet it sits in. `drag` replaces the slide. */
export function SheetHandle({ onClose, drag }: { onClose: () => void; drag?: Drag }) {
  const start = useRef<number | null>(null);
  const custom = useRef(false);
  const sheet = (e: PointerEvent) => (e.currentTarget as HTMLElement).parentElement!;
  const end = (e: PointerEvent, close: boolean) => {
    if (start.current === null) return;
    const dy = e.clientY - start.current;
    start.current = null;
    if (custom.current) return drag?.end(close && dy > 80);
    if (close && dy > 80) slide(sheet(e), "translateY(100%)", onClose);
    else slide(sheet(e), "translateY(0)");
  };
  return (
    <div
      className="sheet-handle"
      aria-hidden="true"
      onPointerDown={(e) => {
        start.current = e.clientY;
        e.currentTarget.setPointerCapture(e.pointerId);
        custom.current = !!drag?.begin();
        if (!custom.current) sheet(e).style.transition = "none";
      }}
      onPointerMove={(e) => {
        if (start.current === null) return;
        const dy = Math.max(0, e.clientY - start.current);
        if (custom.current) drag?.move(dy);
        else sheet(e).style.transform = `translateY(${dy}px)`;
      }}
      onPointerUp={(e) => end(e, true)}
      onPointerCancel={(e) => end(e, false)}
    />
  );
}
