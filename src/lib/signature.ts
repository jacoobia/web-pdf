export const SCRIPT_FONT = '"Segoe Script", "Brush Script MT", "Snell Roundhand", cursive';
const KEY = "signature";

export const savedSignature = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
export const rememberSignature = (url: string | null) => {
  try {
    url ? localStorage.setItem(KEY, url) : localStorage.removeItem(KEY);
  } catch {}
};

/** The inked part of `canvas`, with a small margin, or null when nothing is drawn. */
export function trimmed(canvas: HTMLCanvasElement) {
  const { width: w, height: h } = canvas;
  const alpha = canvas.getContext("2d")!.getImageData(0, 0, w, h).data;
  let [l, t, r, b] = [w, h, -1, -1];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (alpha[(y * w + x) * 4 + 3] > 8)
        [l, t, r, b] = [Math.min(l, x), Math.min(t, y), Math.max(r, x), Math.max(b, y)];
  if (r < 0) return null;
  const pad = 4;
  const out = document.createElement("canvas");
  out.width = r - l + 1 + pad * 2;
  out.height = b - t + 1 + pad * 2;
  out.getContext("2d")!.drawImage(canvas, l - pad, t - pad, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

export function typedSignature(name: string, color: string) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const font = `96px ${SCRIPT_FONT}`;
  ctx.font = font;
  canvas.width = Math.ceil(ctx.measureText(name).width) + 96;
  canvas.height = 192;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(name, 48, 96);
  return trimmed(canvas);
}
