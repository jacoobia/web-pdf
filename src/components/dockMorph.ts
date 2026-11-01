// On phones the edit panel grows out of the floating dock and shrinks back into it, following the finger.
const app = () => document.querySelector<HTMLElement>(".app");
const panel = () => document.querySelector<HTMLElement>(".panel");
const dock = () => document.querySelector<HTMLElement>(".zoom-float");

let travel = 0;
let pending = 0;
const clamp = (p: number) => Math.min(1, Math.max(0, p));

/** Shows the dock alongside the open panel and measures the morph; false when there is no dock to morph from. */
export function beginMorph() {
  clearTimeout(pending);
  app()?.classList.add("morphing");
  panel()?.classList.add("hush");
  const s = panel()?.getBoundingClientRect();
  const d = dock()?.getBoundingClientRect();
  travel = s && d?.width ? d.top - s.top : 0;
  if (travel <= 0) {
    app()?.classList.remove("morphing");
    panel()?.classList.remove("hush");
  }
  return travel > 0;
}

/** Draws the panel `p` of the way from the dock's shape (0) to a full sheet (1). */
export function morph(p: number, animate = false) {
  const s = panel();
  const d = dock();
  if (!s || !d) return;
  const S = s.getBoundingClientRect();
  const D = d.getBoundingClientRect();
  const at = (from: number, to: number) => from + (to - from) * p;
  const top = at(10, 14);
  const bottom = at(10, 0);
  Object.assign(s.style, {
    transition: animate ? "clip-path 200ms ease" : "none",
    clipPath: `inset(${at(D.top - S.top, 0)}px ${at(S.right - D.right, 0)}px ${at(S.bottom - D.bottom, 0)}px ${at(D.left - S.left, 0)}px round ${top}px ${top}px ${bottom}px ${bottom}px)`,
  });
}

export const morphOpen = (up: number) => morph(clamp(up / travel));
export const morphClose = (down: number) => morph(clamp(1 - down / travel));

/** Finishes the gesture open or closed, then hands styling back to CSS. */
export function settle(open: boolean, done?: () => void) {
  morph(open ? 1 : 0, true);
  pending = window.setTimeout(() => {
    done?.();
    requestAnimationFrame(() => {
      const s = panel();
      if (s) Object.assign(s.style, { transition: "", clipPath: "" });
      app()?.classList.remove("morphing");
      panel()?.classList.remove("hush");
    });
  }, 200);
}
