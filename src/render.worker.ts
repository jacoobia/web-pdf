// Page previews and saving run here, off the main thread, so dragging, typing and the save toast never wait on them.
import type { El, Removed } from "./pdf";

export type WorkerIn =
  | { type: "load"; bytes: Uint8Array }
  | { type: "render"; page: number; key: string; scale: number; removed: Removed }
  | { type: "export"; id: number; els: El[]; fonts: Map<string, Uint8Array> };

// Loaded dynamically: MuPDF's wasm takes a moment, and a module still loading drops messages sent to it.
// Listening straight away and awaiting the library inside the handler keeps every message, in order.
const lib = import("./pdf");
let bytes: Uint8Array | undefined;
let preview: import("./pdf").Previewer | undefined;

self.onmessage = async ({ data }: MessageEvent<WorkerIn>) => {
  const { Previewer, exportPdf } = await lib;
  if (data.type === "load") {
    preview?.destroy();
    bytes = data.bytes;
    preview = new Previewer(bytes);
    return;
  }
  if (!bytes || !preview) return;
  if (data.type === "render") {
    try {
      const { w, h, rgba } = preview.render(data.page, data.scale, data.removed);
      const bitmap = await createImageBitmap(new ImageData(rgba, w, h));
      self.postMessage({ type: "render", page: data.page, key: data.key, bitmap }, { transfer: [bitmap] });
    } catch (err) {
      self.postMessage({ type: "render", page: data.page, key: data.key, error: String(err) });
    }
    return;
  }
  try {
    const { pdf, problems } = await exportPdf(bytes, data.els, data.fonts);
    self.postMessage({ type: "export", id: data.id, pdf, problems }, { transfer: [pdf.buffer as ArrayBuffer] });
  } catch (err) {
    self.postMessage({ type: "export", id: data.id, error: (err as Error).message });
  }
};
