import type { El, PageInfo, Removed } from "./pdf";

export type WorkerIn =
  | { type: "open"; id: number; bytes: Uint8Array }
  | { type: "render"; page: number; key: string; scale: number; removed: Removed; original?: boolean }
  | { type: "image"; id: number; page: number; index: number }
  | { type: "export"; id: number; els: El[]; fonts: Map<string, Uint8Array> };

export type Replies = {
  open: { pages: PageInfo[]; els: El[] };
  image: { png: Uint8Array };
  export: { pdf: Uint8Array; problems: string[] };
};

const lib = import("./pdf");
let bytes: Uint8Array | undefined;
let preview: import("./pdf").Previewer | undefined;

const reply = (id: number, body: object, transfer: Transferable[] = []) =>
  self.postMessage({ type: "reply", id, ...body }, { transfer });

self.onmessage = async ({ data }: MessageEvent<WorkerIn>) => {
  const { Previewer, exportPdf, extract } = await lib;
  try {
    if (data.type === "open") {
      preview?.destroy();
      bytes = data.bytes;
      preview = new Previewer(bytes);
      return reply(data.id, extract(bytes));
    }
    if (!bytes || !preview) throw new Error("No PDF is open.");
    if (data.type === "render") {
      const { w, h, rgba } = data.original
        ? preview.renderOriginal(data.page, data.scale)
        : preview.render(data.page, data.scale, data.removed);
      const bitmap = await createImageBitmap(new ImageData(rgba, w, h));
      return self.postMessage({ type: "render", page: data.page, key: data.key, bitmap }, { transfer: [bitmap] });
    }
    if (data.type === "image") {
      const png = preview.imagePng(data.page, data.index);
      return reply(data.id, { png }, [png.buffer as ArrayBuffer]);
    }
    const { pdf, problems } = await exportPdf(bytes, data.els, data.fonts);
    reply(data.id, { pdf, problems }, [pdf.buffer as ArrayBuffer]);
  } catch (err) {
    if (data.type === "render")
      self.postMessage({ type: "render", page: data.page, key: data.key, error: String(err) });
    else reply(data.id, { error: (err as Error).message });
  }
};
