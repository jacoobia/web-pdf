import { cx } from "../lib/cx";
import type { Editor } from "../lib/editor";
import { Dot } from "./ui";
import "./PageRail.css";

export function PageRail({ editor }: { editor: Editor }) {
  const { pages, currentPage, editedPages, previews } = editor;
  return (
    <nav className="rail" aria-label="Pages">
      <p className="rail-title">Pages</p>
      {pages.map((pg, p) => (
        <button
          type="button"
          key={p}
          ref={previews.observeThumb}
          data-page={p}
          className={cx("thumb", p === currentPage && "on")}
          aria-label={`Page ${p + 1}${editedPages.has(p) ? ", edited" : ""}`}
          aria-current={p === currentPage ? "page" : undefined}
          onClick={() => editor.goToPage(p)}
        >
          <span className="thumb-page" style={{ aspectRatio: `${pg.w} / ${pg.h}` }}>
            <canvas ref={previews.thumbRef(p)} />
          </span>
          <span className="thumb-label">
            {p + 1}
            {editedPages.has(p) && <Dot />}
          </span>
        </button>
      ))}
    </nav>
  );
}
