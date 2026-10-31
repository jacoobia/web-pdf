import { type DragEvent, useMemo, useState } from "react";
import { cx } from "../lib/cx";
import type { Editor } from "../lib/editor";
import { contentTransform, turned } from "../lib/model";
import { pageActions } from "./pageActions";
import { Dot, Menu } from "./ui";
import "./PageRail.css";

const THUMB = 96;
const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes("Files");

export function PageRail({ editor }: { editor: Editor }) {
  const { pages, order, currentPage, editedPages, previews } = editor;
  const [menu, setMenu] = useState<{ at: number; left: number; top: number } | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const edited = [...editedPages].join();
  const mergeDropped = (e: DragEvent, at: number) => {
    const pdfs = [...e.dataTransfer.files].filter((f) => /\.pdf$/i.test(f.name));
    if (!pdfs.length) return;
    e.preventDefault();
    e.stopPropagation();
    editor.mergeFiles(pdfs, at);
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: rebuilt only when thumbnails change, not on every keystroke; its handlers read refs
  const thumbs = useMemo(
    () =>
      order.map(({ src: p, rotate }, at) => {
        const pg = pages[p];
        const tall = THUMB * (turned(rotate) ? pg.w / pg.h : pg.h / pg.w);
        const [w, h] = turned(rotate) ? [tall, THUMB] : [THUMB, tall];
        return (
          <button
            type="button"
            key={p}
            ref={previews.observeThumb}
            data-page={p}
            draggable
            className={cx("thumb", p === currentPage && "on", dropAt === at && "drop")}
            aria-label={`Page ${at + 1}${editedPages.has(p) ? ", edited" : ""}`}
            aria-current={p === currentPage ? "page" : undefined}
            onClick={() => editor.goToPage(p)}
            onContextMenu={(e) => (e.preventDefault(), setMenu({ at, left: e.clientX, top: e.clientY }))}
            onDragStart={(e) => (e.dataTransfer.setData("text/x-web-pdf-page", ""), setDragging(at))}
            onDragOver={(e) => (dragging !== null || hasFiles(e)) && (e.preventDefault(), setDropAt(at))}
            onDragLeave={() => setDropAt(null)}
            onDragEnd={() => (setDragging(null), setDropAt(null))}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (dragging !== null) editor.movePage(dragging, at);
              else mergeDropped(e, at);
              setDragging(null);
              setDropAt(null);
            }}
          >
            <span className="thumb-page" style={{ height: tall }}>
              <span
                className="thumb-content"
                style={{ width: w, height: h, transform: contentTransform(rotate, w, h) }}
              >
                {!pg.blank && <canvas ref={previews.thumbRef(p)} />}
              </span>
            </span>
            <span className="thumb-label">
              {at + 1}
              {editedPages.has(p) && <Dot />}
            </span>
          </button>
        );
      }),
    [pages, order, currentPage, edited, dragging, dropAt],
  );
  return (
    <nav
      className="rail"
      aria-label="Pages"
      onDragOver={(e) => hasFiles(e) && e.preventDefault()}
      onDrop={(e) => mergeDropped(e, order.length)}
    >
      <p className="rail-title">Pages</p>
      {thumbs}
      {menu && <Menu at={menu} onClose={() => setMenu(null)} items={pageActions(editor, menu.at)} />}
    </nav>
  );
}
