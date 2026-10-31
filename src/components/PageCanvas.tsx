import { type ReactElement, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { Editor } from "../lib/editor";
import { contentTransform, type El, type FormField, isDirty, type Slot, turned } from "../lib/model";
import { ZoomTools } from "./EditorTools";
import { FormFieldInput } from "./FormFieldInput";
import { InlineText } from "./InlineText";
import { HeaderFooterItem, PageItem } from "./PageItem";
import { StartScreen } from "./StartScreen";
import { AddBar, Callout } from "./ui";
import "./PageCanvas.css";

type Cached = { deps: unknown[]; node: ReactElement };

export function PageCanvas({ editor }: { editor: Editor }) {
  const { file, pages, order, scale, adding, margin, band, guides, fonts, one, sel, byPage, hfByPage, previews } =
    editor;
  const pagesRef = editor.pagesRef;

  // biome-ignore lint/correctness/useExhaustiveDependencies: these change the scroll area's size, so re-measure on them
  useEffect(() => {
    const m = pagesRef.current;
    if (!m) return;
    const measure = () => {
      m.parentElement!.style.setProperty("--scrollbar-w", `${m.offsetWidth - m.clientWidth}px`);
      m.parentElement!.style.setProperty("--scrollbar-h", `${m.offsetHeight - m.clientHeight}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(m);
    for (const child of m.children) ro.observe(child);
    return () => ro.disconnect();
  }, [file, order, scale, editor.canvasStyle]);

  // Zoom around a point: remember where it was, then scroll so it stays put once the pages have resized.
  const live = useRef({ scale, zoomTo: editor.zoomTo, cancel: editor.cancelGesture });
  live.current = { scale, zoomTo: editor.zoomTo, cancel: editor.cancelGesture };
  const anchor = useRef<{ x: number; y: number; from: number } | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per zoom step; the refs it reads are set just before
  useLayoutEffect(() => {
    const m = pagesRef.current,
      a = anchor.current;
    if (!m || !a) return;
    const k = scale / a.from;
    m.scrollLeft = (m.scrollLeft + a.x) * k - a.x;
    m.scrollTop = (m.scrollTop + a.y) * k - a.y;
    anchor.current = null;
  }, [scale]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: listeners read the latest values through refs
  useEffect(() => {
    const m = pagesRef.current;
    if (!m) return;
    const zoomAround = (to: number, clientX: number, clientY: number) => {
      const r = m.getBoundingClientRect();
      anchor.current ??= { x: clientX - r.left, y: clientY - r.top, from: live.current.scale };
      live.current.zoomTo(to);
    };
    let pinch: { dist: number; scale: number } | null = null;
    const spread = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      live.current.cancel();
      pinch = { dist: spread(e.touches), scale: live.current.scale };
    };
    const onMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const [a, b] = [e.touches[0], e.touches[1]];
      zoomAround(
        (pinch.scale * spread(e.touches)) / pinch.dist,
        (a.clientX + b.clientX) / 2,
        (a.clientY + b.clientY) / 2,
      );
    };
    const onEnd = (e: TouchEvent) => void (e.touches.length < 2 && (pinch = null));
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomAround(live.current.scale * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    };
    m.addEventListener("touchstart", onStart, { passive: true });
    m.addEventListener("touchmove", onMove, { passive: false });
    m.addEventListener("touchend", onEnd);
    m.addEventListener("touchcancel", onEnd);
    m.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      m.removeEventListener("touchstart", onStart);
      m.removeEventListener("touchmove", onMove);
      m.removeEventListener("touchend", onEnd);
      m.removeEventListener("touchcancel", onEnd);
      m.removeEventListener("wheel", onWheel);
    };
  }, [file]);

  const selSet = new Set(sel);
  const views = useRef(new WeakMap<El, { key: string; fonts: Map<string, Uint8Array>; node: ReactElement }>());
  const itemView = (el: El) => {
    const selected = selSet.has(el.id),
      single = one?.id === el.id;
    const imageSrc = el.image && isDirty(el) ? editor.imageSrcOf(el.image) : undefined;
    const key = `${scale}|${selected}|${single}|${imageSrc}`;
    const hit = views.current.get(el);
    if (hit && hit.key === key && hit.fonts === fonts) return hit.node;
    const node = (
      <PageItem
        key={el.id}
        el={el}
        scale={scale}
        selected={selected}
        single={single}
        fonts={fonts}
        on={editor.elHandlers}
        imageSrc={imageSrc}
      />
    );
    views.current.set(el, { key, fonts, node });
    return node;
  };

  const fieldsByPage = useMemo(() => {
    const m = new Map<number, FormField[]>();
    for (const f of editor.fields) m.set(f.page, [...(m.get(f.page) ?? []), f]);
    return m;
  }, [editor.fields]);
  const signedOn = (els: El[], r: FormField["rect"]) =>
    els.some(
      (e) =>
        e.image?.key &&
        !e.deleted &&
        e.x < r.x + r.w &&
        e.x + e.image.w > r.x &&
        e.y < r.y + r.h &&
        e.y + e.image.h > r.y,
    );
  const editingEl = editor.editing ? editor.elById.get(editor.editing) : undefined;
  const endEditing = (id: string) => {
    editor.setEditing(null);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`.el[data-id="${id}"]`)?.focus());
  };

  const selByPage = new Map<number, string>();
  for (const id of sel) {
    const e = editor.elById.get(id);
    if (e) selByPage.set(e.page, `${(selByPage.get(e.page) ?? "") + id},`);
  }
  const pageViews = useRef(new Map<number, Cached>());
  const pageView = ({ src: p, rotate }: Slot, at: number) => {
    const pg = pages[p];
    const isNear = previews.near.has(p);
    const deps = [
      pg,
      rotate,
      at,
      scale,
      adding,
      isNear,
      isNear && byPage.get(p),
      margin,
      band?.page === p && band,
      guides?.page === p && guides,
      isNear && hfByPage.get(p),
      isNear && (selByPage.get(p) ?? "") + (one?.page === p ? one.id : ""),
      fonts,
      previews.imageVersion,
      editingEl?.page === p && editingEl,
      isNear && fieldsByPage.get(p),
    ];
    const hit = pageViews.current.get(p);
    if (hit?.deps.every((d, i) => d === deps[i])) return hit.node;
    const on = editor.pageHandlers;
    const [w, h] = [pg.w * scale, pg.h * scale];
    const node = (
      <div
        key={p}
        ref={previews.observePage}
        data-page={p}
        className={adding ? "page adding" : "page"}
        style={turned(rotate) ? { width: h, height: w } : { width: w, height: h }}
        onPointerDown={(e) => (e.stopPropagation(), on.down(e, p))}
        onPointerMove={on.move}
        onPointerUp={on.up}
        onContextMenu={(e) => on.menu(e, p)}
      >
        <div className="page-content" style={{ width: w, height: h, transform: contentTransform(rotate, w, h) }}>
          <canvas ref={previews.canvasRef(p)} />
          {margin !== null && <div className="margin-guide" style={{ inset: margin * scale }} />}
          {band?.page === p && (
            <div
              className="marquee"
              style={{
                left: band.l * scale,
                top: band.t * scale,
                width: (band.r - band.l) * scale,
                height: (band.b - band.t) * scale,
              }}
            />
          )}
          {guides?.page === p && guides.x !== undefined && (
            <div className="guide v" style={{ left: guides.x * scale }} />
          )}
          {guides?.page === p && guides.y !== undefined && (
            <div className="guide h" style={{ top: guides.y * scale }} />
          )}
          {isNear &&
            (byPage.get(p) ?? [])
              .filter((el) => !el.deleted)
              .sort((a, b) => +!!b.image - +!!a.image)
              .map((el) =>
                el === editingEl ? (
                  <InlineText
                    key={el.id}
                    el={el}
                    scale={scale}
                    fonts={fonts}
                    onChange={(text) => editor.patch([el.id], { text }, `text:${el.id}`)}
                    onDone={() => endEditing(el.id)}
                  />
                ) : (
                  itemView(el)
                ),
              )}
          {isNear && (hfByPage.get(p) ?? []).map((el) => <HeaderFooterItem key={el.id} el={el} scale={scale} />)}
          {isNear &&
            (fieldsByPage.get(p) ?? []).map((f) =>
              f.kind === "signature" && signedOn(byPage.get(p) ?? [], f.rect) ? null : (
                <FormFieldInput key={f.id} f={f} scale={scale} onChange={editor.setField} onSign={editor.setSigning} />
              ),
            )}
        </div>
      </div>
    );
    pageViews.current.set(p, { deps, node });
    return node;
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: pageHandlers is stable
  const bars = useMemo(
    () =>
      order.map((slot, at) => {
        const pg = pages[slot.src];
        return (
          <AddBar
            key={`add-${slot.src}`}
            className="page-add"
            style={{ width: (turned(slot.rotate) ? pg.h : pg.w) * scale }}
            label={`Add a blank page after page ${at + 1}`}
            onAdd={() => editor.pageHandlers.add(at)}
          />
        );
      }),
    [order, pages, scale],
  );

  return (
    <>
      <main
        className="pages"
        ref={pagesRef}
        onScroll={editor.onPagesScroll}
        onPointerDown={() => adding || editor.setSel([])}
      >
        {!file && <StartScreen editor={editor} />}
        {editor.rotated && (
          <Callout tone="danger">
            This PDF has rotated pages. Edits on those pages will land in the wrong place.
          </Callout>
        )}
        {order.flatMap((slot, at) => [pageView(slot, at), bars[at]])}
      </main>
      {file && (
        <div className="zoom-float" role="group" aria-label="Zoom">
          <ZoomTools editor={editor} />
        </div>
      )}
    </>
  );
}
