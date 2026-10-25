import { type ReactElement, useEffect, useRef } from "react";
import type { Editor } from "../lib/editor";
import { contentTransform, type El, isDirty, type Slot, turned } from "../lib/model";
import { ZoomTools } from "./EditorTools";
import { HeaderFooterItem, PageItem } from "./PageItem";
import { StartScreen } from "./StartScreen";
import { Callout } from "./ui";
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

  const selSet = new Set(sel);
  const views = useRef(new WeakMap<El, { key: string; fonts: Map<string, Uint8Array>; node: ReactElement }>());
  const itemView = (el: El) => {
    const selected = selSet.has(el.id),
      single = one?.id === el.id;
    const imageSrc = el.image && isDirty(el) ? previews.imageUrl(el.image) : undefined;
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

  const selByPage = new Map<number, string>();
  for (const id of sel) {
    const e = editor.elById.get(id);
    if (e) selByPage.set(e.page, `${(selByPage.get(e.page) ?? "") + id},`);
  }
  const pageViews = useRef(new Map<number, Cached>());
  const pageView = ({ src: p, rotate }: Slot) => {
    const pg = pages[p];
    const isNear = previews.near.has(p);
    const deps = [
      pg,
      rotate,
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
              .map(itemView)}
          {isNear && (hfByPage.get(p) ?? []).map((el) => <HeaderFooterItem key={el.id} el={el} scale={scale} />)}
        </div>
      </div>
    );
    pageViews.current.set(p, { deps, node });
    return node;
  };

  return (
    <>
      <main
        className="pages"
        data-bugdrop-mask
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
        {order.map(pageView)}
      </main>
      {editor.canvasStyle && file && (
        <div className="zoom-float" role="group" aria-label="Zoom">
          <ZoomTools editor={editor} />
        </div>
      )}
    </>
  );
}
