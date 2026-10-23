import { useEffect, useRef, useState } from "react";
import { type El, type PageInfo, removedOn } from "./model";
import type { Replies, WorkerIn } from "./render.worker";

type Rendered =
  | { type: "render"; page: number; key: string; bitmap?: ImageBitmap; error?: string }
  | { type: "reply"; id: number; error?: string };

const FIRST_PAGES = () => new Set([0, 1, 2]);

const draw = (canvas: HTMLCanvasElement, bitmap: ImageBitmap) => {
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
};

function useVisible(root: string, rootMargin: string, initial: () => Set<number>, keepSeen = false) {
  const [visible, setVisible] = useState(initial);
  const observer = useRef<IntersectionObserver | null>(null);
  const observe = (node: HTMLElement | null) => {
    if (!node) return;
    observer.current ??= new IntersectionObserver(
      (entries) =>
        setVisible((old) => {
          const next = new Set(old);
          for (const e of entries) {
            const p = +(e.target as HTMLElement).dataset.page!;
            if (e.isIntersecting) next.add(p);
            else if (!keepSeen) next.delete(p);
          }
          return next.size === old.size && [...next].every((p) => old.has(p)) ? old : next;
        }),
      { root: node.closest(root), rootMargin },
    );
    observer.current.observe(node);
  };
  const reset = () => {
    observer.current?.disconnect();
    observer.current = null;
    setVisible(initial());
  };
  return [visible, observe, reset] as const;
}

export function usePreviews({
  open,
  pages,
  byPage,
  scale,
  thumbs,
}: {
  open: boolean;
  pages: PageInfo[];
  byPage: Map<number, El[]>;
  scale: number;
  thumbs: boolean;
}) {
  const worker = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, (r: { error?: string }) => void>());
  const nextId = useRef(0);
  const canvases = useRef(new Map<number, HTMLCanvasElement>());
  const wanted = useRef(new Map<number, string>());
  const thumbCanvases = useRef(new Map<number, HTMLCanvasElement>());
  const thumbsAsked = useRef(new Set<number>());
  const imageUrls = useRef(new Map<string, string | null>());
  const [imageVersion, imageLoaded] = useState(0);
  const [near, observePage, resetNear] = useVisible(".pages", "100% 0px", FIRST_PAGES);
  const [thumbNear, observeThumb, resetThumbs] = useVisible(".rail", "300px 0px", () => new Set(), true);

  const post = (msg: WorkerIn, transfer: Transferable[] = []) => worker.current?.postMessage(msg, { transfer });
  const request = <T extends keyof Replies>(
    msg: Omit<Extract<WorkerIn, { type: T }>, "id">,
    transfer: Transferable[] = [],
  ) =>
    new Promise<Replies[T]>((resolve, reject) => {
      const id = ++nextId.current;
      pending.current.set(id, (r) => (r.error ? reject(new Error(r.error)) : resolve(r as Replies[T])));
      post({ ...msg, id } as unknown as WorkerIn, transfer);
    });

  useEffect(() => {
    const w = new Worker(new URL("./render.worker.ts", import.meta.url), { type: "module" });
    w.onerror = (e) => {
      for (const done of pending.current.values()) done({ error: `The background worker failed: ${e.message}` });
      pending.current.clear();
    };
    w.onmessage = ({ data }: MessageEvent<Rendered>) => {
      if (data.type === "reply") {
        pending.current.get(data.id)?.(data);
        pending.current.delete(data.id);
        return;
      }
      if (data.error) console.warn(`Preview of page ${data.page + 1} failed:`, data.error);
      const thumb = data.key.startsWith("t|");
      const canvas = (thumb ? thumbCanvases : canvases).current.get(data.page);
      if (data.bitmap && canvas && (thumb || wanted.current.get(data.page) === data.key)) draw(canvas, data.bitmap);
      data.bitmap?.close();
    };
    worker.current = w;
    return () => w.terminate();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: post is stable
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      pages.forEach((_, p) => {
        if (!near.has(p)) {
          if (wanted.current.delete(p)) canvases.current.get(p)!.width = 0;
          return;
        }
        const removed = removedOn(byPage.get(p) ?? [], p);
        const key = `${scale}|${JSON.stringify(removed)}`;
        if (wanted.current.get(p) === key) return;
        wanted.current.set(p, key);
        post({ type: "render", page: p, key, scale: scale * devicePixelRatio, removed });
      });
    }, 30);
    return () => clearTimeout(t);
  }, [open, pages, byPage, scale, near]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: post is stable
  useEffect(() => {
    if (!open || !thumbs) return;
    for (const p of thumbNear)
      if (!thumbsAsked.current.has(p)) {
        thumbsAsked.current.add(p);
        post({
          type: "render",
          page: p,
          key: `t|${p}`,
          scale: 0.17 * devicePixelRatio,
          removed: { text: [], images: [] },
          original: true,
        });
      }
  }, [open, thumbs, thumbNear]);

  const imageUrl = (img: NonNullable<El["image"]>) => {
    const key = `${img.page}:${img.index}`;
    const known = imageUrls.current.get(key);
    if (known !== undefined) return known ?? undefined;
    imageUrls.current.set(key, null);
    request<"image">({ type: "image", page: img.page, index: img.index }).then(
      ({ png }) => {
        imageUrls.current.set(key, URL.createObjectURL(new Blob([png as BlobPart], { type: "image/png" })));
        imageLoaded((n) => n + 1);
      },
      () => imageUrls.current.delete(key),
    );
  };

  const clear = () => {
    for (const url of imageUrls.current.values()) if (url) URL.revokeObjectURL(url);
    imageUrls.current.clear();
    wanted.current.clear();
    for (const c of canvases.current.values()) c.width = 0;
    thumbsAsked.current.clear();
    for (const c of thumbCanvases.current.values()) c.width = 0;
    resetThumbs();
    resetNear();
  };

  const canvasRef = (p: number) => (c: HTMLCanvasElement | null) =>
    void (c ? canvases.current.set(p, c) : canvases.current.delete(p));
  const thumbRef = (p: number) => (c: HTMLCanvasElement | null) =>
    void (c ? thumbCanvases.current.set(p, c) : thumbCanvases.current.delete(p));

  return { request, near, observePage, observeThumb, canvasRef, thumbRef, imageUrl, imageVersion, clear };
}
