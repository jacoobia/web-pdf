import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import {
  STANDARD_FONTS, compact, exportPdf, extract, familyOf, fontHelp, fontKey, isBoldName, isDirty, isItalicName,
  pickFace, renderPage,
  type El, type PageInfo,
} from "./pdf";
import { snap, type Box, type Guides } from "./snap";

// Where the first baseline sits inside a CSS line box (line-height 1.2), as a fraction of font size.
const CSS_BASELINE = 0.95;

const cssFont = (key: string) => {
  const std = STANDARD_FONTS[key];
  return std
    ? { fontFamily: std.css, fontWeight: std.weight, fontStyle: std.italic ? "italic" : "normal" }
    : { fontFamily: `"pf-${key}"`, fontWeight: 400, fontStyle: "normal" };
};

/** useState that survives reloads. Storage can be blocked, so it's best-effort. */
function usePref(key: string, initial: string) {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) ?? initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, value);
    } catch {}
  }, [key, value]);
  return [value, setValue] as const;
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button className="btn icon" aria-label={label} title={label} onClick={onClick}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);

export default function App() {
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [els, setEls] = useState<El[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [fonts, setFonts] = useState(new Map<string, Uint8Array>());
  const [scale, setScale] = useState(1.5);
  const [adding, setAdding] = useState(false);
  const [report, setReport] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const [, rerender] = useState(0);
  const [theme, setTheme] = usePref("theme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  useEffect(() => void (document.documentElement.dataset.theme = theme), [theme]);
  const [side, setSide] = usePref("side", "right");
  const [swap, setSwap] = useState({ family: "Helvetica", scope: "all" });

  const elsRef = useRef<El[]>([]);
  const past = useRef<El[][]>([]);
  const lastTouch = useRef("");
  const images = useRef(new Map<number, { key: string; url: string }>());
  const drag = useRef<{
    x: number; y: number; touch: string; start: Map<string, { x: number; y: number }>;
    page: number; box: Box; others: Box[];
  } | null>(null);
  const [guides, setGuides] = useState<(Guides & { page: number }) | null>(null);
  const textBox = useRef<HTMLTextAreaElement>(null);

  // `touch` groups rapid edits (typing, dragging) into one undo step.
  const commit = (next: El[], touch = "") => {
    if (!touch || touch !== lastTouch.current) {
      past.current.push(elsRef.current);
      if (past.current.length > 300) past.current.shift();
    }
    lastTouch.current = touch;
    elsRef.current = next;
    setEls(next);
  };
  const patch = (ids: string[], p: Partial<El> | ((e: El) => Partial<El>), touch = "") =>
    commit(elsRef.current.map((e) => (ids.includes(e.id) ? { ...e, ...(typeof p === "function" ? p(e) : p) } : e)), touch);
  const undo = () => {
    const prev = past.current.pop();
    if (!prev) return;
    lastTouch.current = "";
    elsRef.current = prev;
    setEls(prev);
  };
  const remove = (ids: string[]) => {
    commit(elsRef.current.filter((e) => !(ids.includes(e.id) && !e.orig)).map((e) => (ids.includes(e.id) ? { ...e, deleted: true } : e)));
    setSel([]);
  };

  /** Use `key` whenever text originally in font `src` is redrawn. Untouched text stays untouched. */
  const fontForSource = (list: El[], src: string, key: string) =>
    list.map((e) =>
      e.srcFont && compact(e.srcFont) === compact(src)
        ? { ...e, font: key, orig: e.orig && !isDirty(e) ? { ...e.orig, font: key } : e.orig }
        : e,
    );

  const openPdf = async (f: File) => {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const { pages, els } = extract(bytes);
      let list = els;
      for (const key of fonts.keys()) list = fontForSource(list, key, key);
      for (const img of images.current.values()) URL.revokeObjectURL(img.url);
      images.current.clear();
      past.current = [];
      elsRef.current = list;
      setFile({ name: f.name, bytes });
      setPages(pages);
      setEls(list);
      setSel([]);
      setReport(null);
      const have = [...fonts.keys(), ...Object.keys(STANDARD_FONTS)].map(compact);
      const need = [...new Set(list.map((e) => e.srcFont).filter((s) => s && !have.includes(compact(s))))];
      if (need.length && "queryLocalFonts" in window) await findInstalled(need, true);
    } catch (err) {
      setReport({ ok: false, lines: [`Couldn't open ${f.name}: ${(err as Error).message}`] });
    }
  };

  const addFont = async (bytes: Uint8Array, label: string) => {
    try {
      const key = fontKey(bytes);
      if (!key) throw new Error("it has no name, or is a font collection (.ttc). Load a single .ttf or .otf.");
      document.fonts.add(await new FontFace(`pf-${key}`, bytes as BufferSource).load());
      setFonts((m) => new Map(m).set(key, bytes));
      if (elsRef.current.some((e) => compact(e.srcFont) === compact(key)))
        commit(fontForSource(elsRef.current, key, key));
      return key;
    } catch (err) {
      setReport({ ok: false, lines: [`Couldn't load font ${label}: ${(err as Error).message}`] });
    }
  };

  const openFiles = async (files: FileList | null) => {
    for (const f of files ?? []) {
      if (/\.pdf$/i.test(f.name)) await openPdf(f);
      else if (/\.(ttf|otf)$/i.test(f.name)) await addFont(new Uint8Array(await f.arrayBuffer()), f.name);
      else setReport({ ok: false, lines: [`${f.name}: open a .pdf, or a .ttf/.otf font.`] });
    }
  };

  const sourceFonts = [...new Set(els.map((e) => e.srcFont).filter(Boolean))];
  const available = [...fonts.keys(), ...Object.keys(STANDARD_FONTS)];
  const missing = sourceFonts.filter((s) => !available.some((k) => compact(k) === compact(s)));
  const families = [...new Set(available.map(familyOf))];

  const swapFonts = () => {
    const keys = [...fonts.keys()];
    commit(elsRef.current.map((e) => {
      if (e.deleted || (swap.scope !== "all" && e.page !== +swap.scope)) return e;
      // added text has no source style, so read weight/style off its current font
      const bold = e.orig ? e.bold : isBoldName(e.font), italic = e.orig ? e.italic : isItalicName(e.font);
      return { ...e, font: pickFace(swap.family, keys, bold, italic) };
    }));
  };

  // Chrome/Edge only: pull exact matches from fonts installed on this PC.
  // `auto` runs straight after opening a PDF; the browser may refuse without a click, so stay quiet on failure.
  async function findInstalled(wanted: string[], auto = false) {
    try {
      const local: { postscriptName: string; blob(): Promise<Blob> }[] = await (window as any).queryLocalFonts();
      if (auto && !local.length) return;
      const found: string[] = [];
      for (const s of wanted) {
        const hit = local.find((f) => compact(f.postscriptName) === compact(s));
        if (hit && (await addFont(new Uint8Array(await (await hit.blob()).arrayBuffer()), hit.postscriptName)))
          found.push(hit.postscriptName);
      }
      const left = wanted.filter((s) => !found.some((f) => compact(f) === compact(s)));
      if (auto && !found.length) return;
      setReport({
        ok: !left.length,
        lines: [
          found.length ? `Loaded from this PC: ${found.join(", ")}` : "None of the missing fonts are installed on this PC.",
          ...(left.length ? [`Still missing: ${left.join(", ")}`] : []),
        ],
      });
    } catch (err) {
      if (!auto) setReport({ ok: false, lines: [`Couldn't read installed fonts: ${(err as Error).message}`] });
    }
  }

  const save = async () => {
    if (!file) return;
    try {
      const { pdf, problems } = await exportPdf(file.bytes, elsRef.current, fonts);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([pdf as BlobPart], { type: "application/pdf" }));
      a.download = file.name.replace(/\.pdf$/i, "") + "-edited.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      setReport({
        ok: !problems.length,
        lines: problems.length
          ? [`Saved ${a.download}, but check these:`, ...problems]
          : [`Saved ${a.download}. Checked: old text is gone and all new text reads back correctly.`],
      });
    } catch (err) {
      setReport({ ok: false, lines: [`Not saved: ${(err as Error).message}`] });
    }
  };

  // Re-render a page image only when the set of removed originals on it changes.
  useEffect(() => {
    if (!file) return;
    const t = setTimeout(() => {
      let changed = false;
      pages.forEach((_, p) => {
        const key = `${scale}|` + els.filter((e) => e.page === p && e.orig && isDirty(e)).map((e) => e.id).join();
        const old = images.current.get(p);
        if (old?.key === key) return;
        const png = renderPage(file.bytes, p, scale * devicePixelRatio, els);
        if (old) URL.revokeObjectURL(old.url);
        images.current.set(p, { key, url: URL.createObjectURL(new Blob([png as BlobPart], { type: "image/png" })) });
        changed = true;
      });
      if (changed) rerender((n) => n + 1);
    }, 60);
    return () => clearTimeout(t);
  }, [file, pages, els, scale]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (!isTyping(e.target)) (e.preventDefault(), undo());
        return;
      }
      if (isTyping(e.target)) return;
      if (e.key === "Escape") (setSel([]), setAdding(false));
      if (!sel.length) return;
      if (e.key === "Delete" || e.key === "Backspace") (e.preventDefault(), remove(sel));
      const step = e.shiftKey ? 10 : 1;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (d) {
        e.preventDefault();
        patch(sel, (el) => ({ x: el.x + d[0], y: el.y + d[1] }), "nudge:" + sel.join());
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => past.current.length && e.preventDefault();
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => (window.removeEventListener("keydown", onKey), window.removeEventListener("beforeunload", onLeave));
  });

  const onElDown = (e: RPointerEvent, el: El) => {
    if (adding) return;
    e.stopPropagation();
    const ids = e.shiftKey
      ? sel.includes(el.id) ? sel.filter((i) => i !== el.id) : [...sel, el.id]
      : sel.includes(el.id) ? sel : [el.id];
    setSel(ids);
    const start = new Map(elsRef.current.filter((x) => ids.includes(x.id)).map((x) => [x.id, { x: x.x, y: x.y }]));
    // Measured from what's on screen, since redrawn text's width depends on the browser's font rendering.
    const boxOf = (x: El): Box => {
      const n = document.querySelector<HTMLElement>(`[data-id="${CSS.escape(x.id)}"]`);
      const l = n ? n.offsetLeft / scale : x.x, t = n ? n.offsetTop / scale : x.y;
      return { l, t, r: l + (n?.offsetWidth ?? 0) / scale, b: t + (n ? n.offsetHeight / scale : x.size), base: x.y + x.ascent * x.size };
    };
    const onPage = elsRef.current.filter((o) => o.page === el.page && !o.deleted);
    const group = onPage.filter((o) => ids.includes(o.id)).map(boxOf);
    const box = group.length
      ? {
          l: Math.min(...group.map((g) => g.l)), r: Math.max(...group.map((g) => g.r)),
          t: Math.min(...group.map((g) => g.t)), b: Math.max(...group.map((g) => g.b)),
          base: boxOf(el).base,
        }
      : boxOf(el);
    const others = onPage.filter((o) => !ids.includes(o.id)).map(boxOf);
    drag.current = { x: e.clientX, y: e.clientY, touch: "drag:" + performance.now(), start, page: el.page, box, others };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onElMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const rawX = (e.clientX - d.x) / scale, rawY = (e.clientY - d.y) / scale;
    if (Math.abs(rawX) + Math.abs(rawY) < 2 / scale && lastTouch.current !== d.touch) return;
    const s = e.altKey
      ? { dx: rawX, dy: rawY, guides: {} as Guides }
      : snap(d.box, d.others, rawX, rawY, 5 / scale, pages[d.page].w);
    setGuides({ page: d.page, ...s.guides });
    // Snapped axes stay exact; free ones round to 0.1pt.
    const r = (n: number, snapped?: number) => (snapped === undefined ? Math.round(n * 10) / 10 : n);
    patch(
      [...d.start.keys()],
      (el) => ({ x: r(d.start.get(el.id)!.x + s.dx, s.guides.x), y: r(d.start.get(el.id)!.y + s.dy, s.guides.y) }),
      d.touch,
    );
  };
  const endDrag = () => {
    drag.current = null;
    setGuides(null);
  };

  const onPageDown = (e: RPointerEvent, page: number) => {
    if (!adding) return e.shiftKey || setSel([]);
    e.preventDefault(); // otherwise the click's mousedown steals focus from the new text box
    const box = e.currentTarget.getBoundingClientRect();
    const last = elsRef.current.find((x) => x.id === sel[0]);
    const el: El = {
      id: "new-" + performance.now(), page, text: "",
      x: Math.round((e.clientX - box.left) / scale), y: Math.round((e.clientY - box.top) / scale),
      ascent: 0.8, size: last?.size ?? 11, color: last?.color ?? "#000000", font: last?.font ?? "Helvetica",
      srcFont: "", bold: false, italic: false,
    };
    commit([...elsRef.current, el]);
    setSel([el.id]);
    setAdding(false);
  };

  const selected = els.filter((e) => sel.includes(e.id));
  const one = selected.length === 1 ? selected[0] : null;
  const rotated = pages.some((p) => p.rotated);

  return (
    <div
      className={`app side-${side}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => (e.preventDefault(), openFiles(e.dataTransfer.files))}
    >
      <header className="toolbar">
        <label className="btn primary">
          Open PDF
          <input type="file" accept=".pdf" hidden onChange={(e) => (openFiles(e.target.files), (e.target.value = ""))} />
        </label>
        <button className={adding ? "btn on" : "btn"} disabled={!file} onClick={() => setAdding(!adding)}>
          {adding ? "Click the page…" : "Add text"}
        </button>
        <button className="btn" disabled={!past.current.length} onClick={undo}>Undo</button>
        <span className="zoom">
          <button className="btn" onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}>−</button>
          {Math.round(scale * 100)}%
          <button className="btn" onClick={() => setScale((s) => Math.min(4, s + 0.25))}>+</button>
        </span>
        <span className="grow">{file?.name}</span>
        <IconButton
          label={side === "right" ? "Move sidebar to the left" : "Move sidebar to the right"}
          onClick={() => setSide(side === "right" ? "left" : "right")}
        >
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d={side === "right" ? "M9 4v16" : "M15 4v16"} />
        </IconButton>
        <IconButton
          label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? (
            <>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </>
          ) : (
            <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
          )}
        </IconButton>
        <button className="btn primary" disabled={!file} onClick={save}>Save edited PDF</button>
      </header>

      <main className="pages" onPointerDown={() => adding || setSel([])}>
        {!file && (
          <div className="empty">
            <p>Open a PDF or drop one here.</p>
            <p className="muted">Everything stays on this computer. Nothing is uploaded.</p>
          </div>
        )}
        {rotated && <div className="warn">This PDF has rotated pages. Edits on those pages will land in the wrong place.</div>}
        {pages.map((pg, p) => (
          <div
            key={p}
            className={adding ? "page adding" : "page"}
            style={{ width: pg.w * scale, height: pg.h * scale }}
            onPointerDown={(e) => (e.stopPropagation(), onPageDown(e, p))}
          >
            {images.current.get(p) && <img src={images.current.get(p)!.url} alt="" draggable={false} />}
            {guides?.page === p && guides.x !== undefined && <div className="guide v" style={{ left: guides.x * scale }} />}
            {guides?.page === p && guides.y !== undefined && <div className="guide h" style={{ top: guides.y * scale }} />}
            {els.filter((el) => el.page === p && !el.deleted).map((el) => {
              const dirty = isDirty(el);
              const r = el.orig?.rect;
              const box = dirty || !r
                ? {
                    left: el.x * scale,
                    top: (el.y + (el.ascent - CSS_BASELINE) * el.size) * scale,
                    fontSize: el.size * scale,
                    color: el.color,
                    ...cssFont(el.font),
                  }
                : { left: r.x * scale, top: r.y * scale, width: r.w * scale, height: r.h * scale };
              return (
                <div
                  key={el.id}
                  data-id={el.id}
                  className={`el ${dirty || !r ? "drawn" : "hit"} ${sel.includes(el.id) ? "sel" : ""}`}
                  style={box}
                  title={el.srcFont || undefined}
                  onPointerDown={(e) => onElDown(e, el)}
                  onPointerMove={onElMove}
                  onPointerUp={endDrag}
                  onDoubleClick={() => (textBox.current?.focus(), textBox.current?.select())}
                >
                  {dirty || !r ? el.text || "\u00a0" : null}
                </div>
              );
            })}
          </div>
        ))}
      </main>

      <aside className="side">
        {report && (
          <div className={report.ok ? "note ok" : "note bad"}>
            {report.lines.map((l, i) => <p key={i}>{l}</p>)}
            <button className="link" onClick={() => setReport(null)}>Dismiss</button>
          </div>
        )}

        {!selected.length && file && (
          <p className="muted">
            Click text to select it, then drag to move. Shift+click selects several. Text snaps into line with other text; hold Alt to drag freely. Double-click to reword.
            Arrow keys nudge (Shift for 10pt), Delete removes, Ctrl+Z undoes.
          </p>
        )}

        {selected.length > 0 && (
          <section>
            <h2>{one ? (one.orig ? "Text" : "New text") : `${selected.length} selected`}</h2>
            {one && (
              <textarea
                ref={textBox}
                key={one.id}
                autoFocus={!one.orig && !one.text}
                value={one.text}
                rows={Math.max(2, one.text.split("\n").length)}
                placeholder="Type your text"
                onChange={(e) => patch([one.id], { text: e.target.value }, "text:" + one.id)}
              />
            )}
            <div className="grid">
              <label className="wide">
                Font
                <select value={one?.font ?? ""} onChange={(e) => patch(sel, { font: e.target.value })}>
                  {!one && <option value="">(mixed)</option>}
                  {available.map((f) => <option key={f}>{f}</option>)}
                </select>
              </label>
              <label>
                Size
                <input type="number" step="0.5" min="1" value={one?.size ?? ""} placeholder="mixed"
                  onChange={(e) => +e.target.value > 0 && patch(sel, { size: +e.target.value }, "size:" + sel)} />
              </label>
              <label>
                Colour
                <input type="color" value={one?.color ?? "#000000"} onChange={(e) => patch(sel, { color: e.target.value }, "color:" + sel)} />
              </label>
              {one && (["x", "y"] as const).map((k) => (
                <label key={k}>
                  {k.toUpperCase()} (pt)
                  <input type="number" step="1" value={one[k]}
                    onChange={(e) => e.target.value !== "" && patch([one.id], { [k]: +e.target.value }, k + one.id)} />
                </label>
              ))}
            </div>
            {one?.srcFont && <FontNote el={one} loaded={!missing.includes(one.srcFont)}
              onUseForAll={() => commit(fontForSource(elsRef.current, one.srcFont, one.font))} />}
            <div className="row">
              {selected.some((e) => e.orig && isDirty(e)) && (
                <button className="btn" onClick={() => patch(sel, (e) => (e.orig ? { ...e.orig, deleted: false } : {}))}>
                  Reset to original
                </button>
              )}
              <button className="btn danger" onClick={() => remove(sel)}>Delete</button>
            </div>
          </section>
        )}

        {file && (
          <section>
            <h2>Fonts in this PDF</h2>
            {!sourceFonts.length && <p className="muted">No text found. This might be a scanned image.</p>}
            <ul className="fonts">
              {sourceFonts.map((s) => {
                const ok = !missing.includes(s);
                const used = els.find((e) => e.srcFont === s)!.font;
                const help = fontHelp(s);
                return (
                  <li key={s}>
                    <strong>{s}</strong>
                    <span className={ok ? "tag ok" : "tag"}>{ok ? "loaded" : `edits use ${used}`}</span>
                    {!ok && (
                      <span className="muted">
                        <a href={help.googleUrl} target="_blank" rel="noreferrer">Find “{help.family}” on Google Fonts</a>
                        {help.alternative && (
                          <> · or the free lookalike{" "}
                            <a href={help.alternative.url} target="_blank" rel="noreferrer">{help.alternative.family}</a>
                          </>
                        )}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="row">
              <label className="btn">
                Load font file…
                <input type="file" accept=".ttf,.otf" multiple hidden onChange={(e) => (openFiles(e.target.files), (e.target.value = ""))} />
              </label>
              {"queryLocalFonts" in window && missing.length > 0 && (
                <button className="btn" onClick={() => findInstalled(missing)}>Find on this PC</button>
              )}
            </div>
            <p className="muted">
              Only text you change is redrawn. Untouched text keeps its original font. On Windows, installed fonts are
              in C:\Windows\Fonts.
            </p>
          </section>
        )}

        {file && (
          <section>
            <h2>Change font</h2>
            <div className="grid">
              <label>
                Font
                <select value={swap.family} onChange={(e) => setSwap({ ...swap, family: e.target.value })}>
                  {families.map((f) => <option key={f}>{f}</option>)}
                </select>
              </label>
              <label>
                Apply to
                <select value={swap.scope} onChange={(e) => setSwap({ ...swap, scope: e.target.value })}>
                  <option value="all">All pages</option>
                  {pages.map((_, i) => <option key={i} value={i}>Page {i + 1}</option>)}
                </select>
              </label>
            </div>
            <div className="row">
              <button className="btn" onClick={swapFonts}>Change all text to {swap.family}</button>
            </div>
            <p className="muted">
              Bold and italic are kept when the font has those styles. Load each style's file (e.g. Arial and Arial Bold)
              for an exact match. All of that text gets redrawn; Ctrl+Z undoes it.
            </p>
          </section>
        )}
      </aside>
    </div>
  );
}

function FontNote({ el, loaded, onUseForAll }: { el: El; loaded: boolean; onUseForAll: () => void }) {
  const help = fontHelp(el.srcFont);
  const exact = compact(el.font) === compact(el.srcFont);
  return (
    <div className={exact ? "note ok" : "note"}>
      <p>Original font: <strong>{el.srcFont}</strong></p>
      {exact ? (
        <p>Loaded, so edits match exactly.</p>
      ) : (
        <>
          <p>
            {loaded ? "You picked a different font. " : "This font isn't loaded. "}
            Changed text will be drawn in <strong>{el.font}</strong>.
          </p>
          {!loaded && (
            <p>
              <a href={help.googleUrl} target="_blank" rel="noreferrer">Search Google Fonts</a>
              {help.alternative && (
                <> or get <a href={help.alternative.url} target="_blank" rel="noreferrer">{help.alternative.family}</a>,
                  a free font with the same character widths</>
              )}, then load the .ttf.
            </p>
          )}
          <button className="link" onClick={onUseForAll}>Use {el.font} for all {el.srcFont} text</button>
        </>
      )}
    </div>
  );
}
