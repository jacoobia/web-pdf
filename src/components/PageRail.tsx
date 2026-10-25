import { useState } from "react";
import { cx } from "../lib/cx";
import type { Editor } from "../lib/editor";
import { contentTransform, turned } from "../lib/model";
import { pageActions } from "./pageActions";
import { Dot, Menu } from "./ui";
import "./PageRail.css";

const THUMB = 96;

export function PageRail({ editor }: { editor: Editor }) {
  const { pages, order, currentPage, editedPages, previews } = editor;
  const [menu, setMenu] = useState<{ at: number; left: number; top: number } | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  return (
    <nav className="rail" aria-label="Pages">
      <p className="rail-title">Pages</p>
      {order.map(({ src: p, rotate }, at) => {
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
            onDragOver={(e) => dragging !== null && (e.preventDefault(), setDropAt(at))}
            onDragEnd={() => (setDragging(null), setDropAt(null))}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (dragging !== null) editor.movePage(dragging, at);
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
      })}
      {menu && <Menu at={menu} onClose={() => setMenu(null)} items={pageActions(editor, menu.at)} />}
    </nav>
  );
}
