// Figma-style snapping while dragging. Boxes are in PDF points, y down.
export type Box = { l: number; r: number; t: number; b: number; base: number };
export type Guides = { x?: number; y?: number };

export type Area = { l: number; t: number; r: number; b: number };

/** Limit a move so `box` stays inside `area`. A box too big to fit is pinned to the top/left edge. */
export function confine(box: Box, dx: number, dy: number, area: Area): [number, number] {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)));
  return [clamp(dx, area.l - box.l, area.r - box.r), clamp(dy, area.t - box.t, area.b - box.b)];
}

const mid = (a: number, b: number) => (a + b) / 2;

function closest(from: number[], to: number[], threshold: number) {
  let hit: { diff: number; at: number } | undefined;
  for (const f of from)
    for (const at of to) {
      const diff = at - f;
      if (Math.abs(diff) <= threshold && (!hit || Math.abs(diff) < Math.abs(hit.diff))) hit = { diff, at };
    }
  return hit;
}

/** Adjust a drag delta so `moving` (its box at drag start) lines up with one of `others`. */
export function snap(moving: Box, others: Box[], dx: number, dy: number, threshold: number, pageW: number) {
  const x = closest(
    [moving.l, mid(moving.l, moving.r), moving.r].map((v) => v + dx),
    [...others.flatMap((o) => [o.l, mid(o.l, o.r), o.r]), pageW / 2],
    threshold,
  );
  // Baselines win, so text placed beside other text sits on the same line rather than matching box edges.
  const y =
    closest([moving.base + dy], others.map((o) => o.base), threshold) ??
    closest([moving.t, mid(moving.t, moving.b), moving.b].map((v) => v + dy), others.flatMap((o) => [o.t, mid(o.t, o.b), o.b]), threshold);
  return { dx: dx + (x?.diff ?? 0), dy: dy + (y?.diff ?? 0), guides: { x: x?.at, y: y?.at } as Guides };
}
