// Renders page previews off the main thread, so dragging and typing never wait on MuPDF.
import { renderPage, type Removed } from "./pdf";

type Job = { page: number; key: string; scale: number; removed: Removed };
let bytes: Uint8Array | undefined;

self.onmessage = async ({ data }: MessageEvent<{ bytes: Uint8Array } | Job>) => {
  if ("bytes" in data) return void (bytes = data.bytes);
  if (!bytes) return;
  try {
    const { w, h, rgba } = renderPage(bytes, data.page, data.scale, data.removed);
    const bitmap = await createImageBitmap(new ImageData(rgba, w, h));
    self.postMessage({ page: data.page, key: data.key, bitmap }, { transfer: [bitmap] });
  } catch (err) {
    self.postMessage({ page: data.page, key: data.key, error: String(err) });
  }
};
