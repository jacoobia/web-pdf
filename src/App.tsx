import { memo, useEffect, useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent, type ReactElement, type ReactNode } from "react";
import {
  STANDARD_FONTS, compact, exportPdf, extract, familyOf, fontHelp, fontKey, headerFooterEls, isBoldName, isDirty,
  isItalicName, LINE_HEIGHT, measure, pickFace, removedOn, wrapLines, type HeaderFooter,
  type El, type PageInfo,
} from "./pdf";
import { confine, snap, type Area, type Box, type Guides } from "./snap";

// Where the first baseline sits inside a CSS line box, as a fraction of font size (0.95 at line-height 1.2).
const cssBaseline = (lineHeight: number) => 0.35 + lineHeight / 2;

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

const TABS = [["edit", "Edit"], ["fonts", "Fonts"], ["page", "Page"]] as const;

const PDF_TYPE = { description: "PDF", accept: { "application/pdf": [".pdf"] } };

// Recently opened. Browsers never reveal file paths, so names and dates go in localStorage, and file
// handles (Chrome/Edge only) in IndexedDB, the only storage that can hold them.
type Recent = { name: string; openedAt: number; handle: boolean };
const readRecent = (): Recent[] => {
  try {
    return JSON.parse(localStorage.getItem("recent") ?? "[]");
  } catch {
    return [];
  }
};
const handles = <T,>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    const open = indexedDB.open("pdf-editor", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("handles");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const req = run(open.result.transaction("handles", mode).objectStore("handles"));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    };
  });
const openedAt = (t: number) =>
  new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

type LocalFont = { postscriptName: string; blob(): Promise<Blob> };

const drawnStyle = (el: El, scale: number) => ({
  left: el.x * scale,
  top: (el.y + (el.ascent - cssBaseline(el.lineHeight ?? LINE_HEIGHT)) * el.size) * scale,
  width: el.wrap ? el.wrap * scale : undefined,
  lineHeight: el.lineHeight ?? LINE_HEIGHT,
  fontSize: el.size * scale,
  color: el.color,
  transform: el.align === "center" ? "translateX(-50%)" : el.align === "right" ? "translateX(-100%)" : undefined,
  ...cssFont(el.font),
});

// Same wrapping code and font metrics as the saved file, so the preview breaks lines where the PDF will.
const shownText = (el: El, fonts: Map<string, Uint8Array>) =>
  el.wrap ? wrapLines(el.text, el.wrap, (t) => measure(el.font, fonts)(t, el.size)).join("\n") : el.text;

type ElHandlers = {
  down(e: RPointerEvent, el: El): void;
  move(e: RPointerEvent): void;
  up(): void;
  focusText(): void;
  resizeStart(e: RPointerEvent): void;
  resizeMove(e: RPointerEvent, el: El): void;
  resizeEnd(): void;
  unwrap(id: string): void;
  pngUrl(png: Uint8Array): string;
};

/** One item on the page. Memoised: while dragging, only the items that actually moved re-render. */
const ElView = memo(function ElView({ el, scale, selected, single, fonts, on }: {
  el: El; scale: number; selected: boolean; single: boolean; fonts: Map<string, Uint8Array>; on: ElHandlers;
}) {
  const dirty = isDirty(el);
  const r = el.orig?.rect;
  const box = el.image && dirty
    ? { left: el.x * scale, top: el.y * scale, width: el.image.w * scale, height: el.image.h * scale }
    : dirty || !r
      ? drawnStyle(el, scale)
      : { left: r.x * scale, top: r.y * scale, width: r.w * scale, height: r.h * scale };
  const kind = el.image ? (dirty ? "img moved" : "img hit") : dirty || !r ? "drawn" : "hit";
  return (
    <div
      data-id={el.id}
      className={`el ${kind} ${selected ? "sel" : ""}`}
      style={box}
      title={el.srcFont || undefined}
      onPointerDown={(e) => on.down(e, el)}
      onPointerMove={on.move}
      onPointerUp={on.up}
      onDoubleClick={on.focusText}
    >
      {el.image
        ? dirty && <img src={on.pngUrl(el.image.png)} alt="" draggable={false} />
        : dirty || !r ? shownText(el, fonts) || "\u00a0" : null}
      {single && !el.image && (
        <span
          className="resize"
          title="Drag to set the width so text wraps. Double-click for automatic width."
          onPointerDown={on.resizeStart}
          onPointerMove={(e) => on.resizeMove(e, el)}
          onPointerUp={on.resizeEnd}
          onDoubleClick={(e) => (e.stopPropagation(), on.unwrap(el.id))}
        />
      )}
    </div>
  );
});

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);

export default function App() {
  // `handle` (Chrome/Edge) lets the save dialog open in the folder the PDF came from.
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; handle?: FileSystemFileHandle } | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [els, setEls] = useState<El[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [fonts, setFonts] = useState(new Map<string, Uint8Array>());
  const [scale, setScale] = useState(1.5);
  const [adding, setAdding] = useState(false);
  const [report, setReport] = useState<{ ok: boolean; lines: string[]; busy?: boolean } | null>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const [recent, setRecent] = useState(readRecent);
  // ponytail: keyed by file name, so two different files with the same name share one entry
  const saveRecent = (list: Recent[]) => {
    setRecent(list);
    try {
      localStorage.setItem("recent", JSON.stringify(list));
    } catch {}
  };
  const remember = (name: string, handle?: FileSystemFileHandle) => {
    const old = recent.find((r) => r.name === name);
    saveRecent([{ name, openedAt: Date.now(), handle: !!handle || !!old?.handle }, ...recent.filter((r) => r !== old)].slice(0, 8));
    if (handle) handles("readwrite", (s) => s.put(handle, name)).catch(() => {});
  };
  const forget = (name: string) => {
    saveRecent(recent.filter((r) => r.name !== name));
    handles("readwrite", (s) => s.delete(name)).catch(() => {});
  };
  const reopen = async (r: Recent) => {
    try {
      const h = r.handle ? await handles<FileSystemFileHandle | undefined>("readonly", (s) => s.get(r.name)) : undefined;
      if (!h) return pickPdf();
      const perm = h as unknown as { queryPermission(o: object): Promise<string>; requestPermission(o: object): Promise<string> };
      if ((await perm.queryPermission({ mode: "read" })) !== "granted" && (await perm.requestPermission({ mode: "read" })) !== "granted")
        return;
      await openPdf(await h.getFile(), h);
    } catch {
      setReport({ ok: false, lines: [`Couldn't reopen ${r.name}.`, "It may have been moved, renamed or deleted. Open it again to refresh the entry."] });
    }
  };
  const [theme, setTheme] = usePref("theme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  useEffect(() => void (document.documentElement.dataset.theme = theme), [theme]);
  const [side, setSide] = usePref("side", "right");
  const [tab, setTab] = usePref("tab", "edit");
  const [marginOn, setMarginOn] = usePref("marginOn", "0");
  const [marginPt, setMarginPt] = usePref("marginPt", "36");
  const margin = marginOn === "1" ? Math.max(0, +marginPt || 0) : null;
  const inside = (page: number): Area | null =>
    margin === null ? null : { l: margin, t: margin, r: pages[page].w - margin, b: pages[page].h - margin };
  const [swap, setSwap] = useState({ family: "Helvetica", scope: "all" });
  const [installed, setInstalled] = useState<LocalFont[]>([]);
  const [hf, setHf] = useState<HeaderFooter>({
    header: ["", "", ""], footer: ["", "", ""], font: "Helvetica", size: 9, color: "#555555", margin: 36, skipFirst: false,
  });

  const elsRef = useRef<El[]>([]);
  const past = useRef<El[][]>([]);
  const lastTouch = useRef("");
  // Page previews come from a worker; `wanted` holds the latest request per page so stale results are dropped.
  const worker = useRef<Worker | null>(null);
  const canvases = useRef(new Map<number, HTMLCanvasElement>());
  const wanted = useRef(new Map<number, string>());
  useEffect(() => {
    const w = new Worker(new URL("./render.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = ({ data }: MessageEvent<{ page: number; key: string; bitmap?: ImageBitmap }>) => {
      const canvas = canvases.current.get(data.page);
      if (data.bitmap && canvas && wanted.current.get(data.page) === data.key) {
        canvas.width = data.bitmap.width;
        canvas.height = data.bitmap.height;
        canvas.getContext("2d")!.drawImage(data.bitmap, 0, 0);
      }
      data.bitmap?.close();
    };
    worker.current = w;
    return () => w.terminate();
  }, []);
  const pngUrls = useRef(new Map<Uint8Array, string>());
  const resizing = useRef("");
  const pngUrl = (png: Uint8Array) => {
    let url = pngUrls.current.get(png);
    if (!url) pngUrls.current.set(png, (url = URL.createObjectURL(new Blob([png as BlobPart], { type: "image/png" }))));
    return url;
  };
  const drag = useRef<{
    x: number; y: number; touch: string; start: Map<string, { x: number; y: number }>;
    page: number; box: Box; others: Box[]; toggle?: string;
  } | null>(null);
  const [guides, setGuides] = useState<(Guides & { page: number }) | null>(null);
  const marquee = useRef<{ page: number; x: number; y: number; base: string[]; boxes: (readonly [string, Box])[] } | null>(null);
  const [menu, setMenu] = useState<(At & { left: number; top: number }) | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => void (menu && menuRef.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus()), [menu]);
  const [band, setBand] = useState<{ page: number; l: number; r: number; t: number; b: number } | null>(null);
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
  // Copies are new content: no original to remove, drawn fresh on save.
  const addCopies = (src: El[], dx: number, dy: number, page?: number) => {
    const copies = src.map(({ orig: _o, deleted: _d, ...e }) => ({
      ...e, id: "new-" + crypto.randomUUID(), page: page ?? e.page, x: e.x + dx, y: e.y + dy,
    }));
    commit([...elsRef.current, ...copies]);
    setSel(copies.map((c) => c.id));
  };
  // `synced`: the text also made it onto the system clipboard, so a different clipboard text means a newer copy.
  const clip = useRef<{ els: El[]; text: string; pastes: number; synced: boolean } | null>(null);
  const pasteTimer = useRef(0);

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

  // What was last opened or saved; anything else counts as unsaved. Undoing back to it counts as saved again.
  const saved = useRef<{ els: El[]; hf: HeaderFooter | null }>({ els: [], hf: null });
  const unsaved = () => elsRef.current !== saved.current.els || hf !== saved.current.hf;

  const clearPreviews = () => {
    for (const url of pngUrls.current.values()) URL.revokeObjectURL(url);
    pngUrls.current.clear();
    wanted.current.clear();
    for (const c of canvases.current.values()) c.width = 0;
  };

  const closePdf = () => {
    if (unsaved() && !confirm("Close this PDF? Edits you haven't saved will be lost.")) return;
    clearPreviews();
    past.current = [];
    elsRef.current = [];
    setFile(null);
    setPages([]);
    setEls([]);
    setSel([]);
    setAdding(false);
    setReport(null);
  };

  const openPdf = async (f: File, handle?: FileSystemFileHandle) => {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const { pages, els } = extract(bytes);
      let list = els;
      for (const key of fonts.keys()) list = fontForSource(list, key, key);
      clearPreviews();
      worker.current?.postMessage({ bytes });
      past.current = [];
      elsRef.current = list;
      saved.current = { els: list, hf };
      setFile({ name: f.name, bytes, handle });
      remember(f.name, handle);
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

  const openFiles = async (files: FileList | null, handles: (Promise<FileSystemHandle | null> | undefined)[] = []) => {
    for (const [i, f] of [...(files ?? [])].entries()) {
      if (/\.pdf$/i.test(f.name))
        await openPdf(f, ((await handles[i]?.catch(() => null)) as FileSystemFileHandle | null) ?? undefined);
      else if (/\.(ttf|otf)$/i.test(f.name)) await addFont(new Uint8Array(await f.arrayBuffer()), f.name);
      else setReport({ ok: false, lines: [`${f.name}: open a .pdf, or a .ttf/.otf font.`] });
    }
  };

  const sourceFonts = [...new Set(els.map((e) => e.srcFont).filter(Boolean))];
  const available = [...fonts.keys(), ...Object.keys(STANDARD_FONTS)];
  const missing = sourceFonts.filter((s) => !available.some((k) => compact(k) === compact(s)));
  const families = [...new Set(available.map(familyOf))];
  const installedFamilies = [...new Set(installed.map((f) => familyOf(f.postscriptName)))]
    .filter((f) => !families.includes(f))
    .sort();

  const loadInstalledList = async () => {
    const list: LocalFont[] = await (window as any).queryLocalFonts();
    setInstalled(list);
    return list;
  };

  const swapFonts = async () => {
    const targets = elsRef.current.filter((e) => !e.image && !e.deleted && (swap.scope === "all" || e.page === +swap.scope));
    // added text has no source style, so read weight/style off its current font
    const style = (e: El) => [e.orig ? e.bold : isBoldName(e.font), e.orig ? e.italic : isItalicName(e.font)] as const;
    const keys = [...fonts.keys()];
    if (!families.includes(swap.family)) {
      // Installed but not loaded: load only the faces this text needs.
      const faces = installed.filter((f) => familyOf(f.postscriptName) === swap.family);
      const names = faces.map((f) => f.postscriptName);
      for (const name of new Set(targets.map((e) => pickFace(swap.family, names, ...style(e))))) {
        const face = faces.find((f) => f.postscriptName === name)!;
        const key = await addFont(new Uint8Array(await (await face.blob()).arrayBuffer()), name);
        if (key) keys.push(key);
      }
      if (!keys.some((k) => familyOf(k) === swap.family)) return; // addFont has said why
    }
    const ids = new Set(targets.map((e) => e.id));
    commit(elsRef.current.map((e) => (ids.has(e.id) ? { ...e, font: pickFace(swap.family, keys, ...style(e)) } : e)));
  };

  // Chrome/Edge only: pull exact matches from fonts installed on this PC.
  // `auto` runs straight after opening a PDF; the browser may refuse without a click, so stay quiet on failure.
  async function findInstalled(wanted: string[], auto = false) {
    try {
      const local = await loadInstalledList();
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

  const pickPdf = async () => {
    if (!("showOpenFilePicker" in window)) return pdfInput.current?.click();
    try {
      const [handle] = await (window as any).showOpenFilePicker({ types: [PDF_TYPE] });
      await openPdf(await handle.getFile(), handle);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setReport({ ok: false, lines: [`Couldn't open: ${(err as Error).message}`] });
    }
  };

  const save = async () => {
    if (!file) return;
    const suggestedName = file.name.replace(/\.pdf$/i, "") + "-edited.pdf";
    // Ask where first: the picker needs the click's user activation, which an export could outlast.
    let target: FileSystemFileHandle | undefined;
    if ("showSaveFilePicker" in window) {
      const pick = (startIn: unknown) => (window as any).showSaveFilePicker({ suggestedName, startIn, types: [PDF_TYPE] });
      try {
        target = await pick(file.handle ?? "documents").catch((err: Error) =>
          err.name === "AbortError" ? Promise.reject(err) : pick("documents"),
        );
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    const name = target?.name ?? suggestedName;
    setReport({ ok: true, busy: true, lines: [`Saving ${name}…`] });
    await new Promise((r) => setTimeout(r, 30)); // let the toast paint before the export blocks the page
    try {
      const snapshot = { els: elsRef.current, hf };
      const { pdf, problems } = await exportPdf(file.bytes, [...snapshot.els, ...hfEls], fonts);
      if (target) {
        const out = await target.createWritable();
        await out.write(pdf as BufferSource);
        await out.close();
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([pdf as BlobPart], { type: "application/pdf" }));
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      }
      saved.current = snapshot;
      // Without a save picker the browser takes over (and may ask where to save), so don't claim it's saved.
      const done = target ? `Saved ${name}` : `${name} is ready. Your browser will save it or ask where.`;
      setReport(
        problems.length
          ? { ok: false, lines: [`${done} Check these first:`, ...problems] }
          : { ok: true, lines: [done, "Old text is gone and all new text reads back correctly."] },
      );
    } catch (err) {
      setReport({ ok: false, lines: [`Not saved: ${(err as Error).message}`] });
    }
  };

  useEffect(() => {
    if (!report?.ok || report.busy) return;
    const t = setTimeout(() => setReport((r) => (r === report ? null : r)), 4000);
    return () => clearTimeout(t);
  }, [report]);

  // Ask for a new page preview only when the set of removed originals on it (or the zoom) changes.
  useEffect(() => {
    if (!file) return;
    const t = setTimeout(() => {
      pages.forEach((_, p) => {
        const removed = removedOn(els, p);
        const key = `${scale}|${JSON.stringify(removed)}`;
        if (wanted.current.get(p) === key) return;
        wanted.current.set(p, key);
        worker.current?.postMessage({ page: p, key, scale: scale * devicePixelRatio, removed });
      });
    }, 30);
    return () => clearTimeout(t);
  }, [file, pages, els, scale]);

  // Shared by the keyboard shortcuts and the context menu.
  type At = { page: number; x: number; y: number };
  const copySel = (cut = false) => {
    if (!selected.length) return;
    const text = selected.filter((x) => !x.image).map((x) => x.text).join("\n");
    const c = (clip.current = { els: selected, text, pastes: 0, synced: false as boolean });
    navigator.clipboard?.writeText(text).then(() => (c.synced = true), () => {});
    if (cut) remove(sel);
  };
  /** At a point, the group's top-left lands there; otherwise each paste steps 10pt further. */
  const pasteCopied = (at?: At) => {
    const c = clip.current;
    if (!c) return;
    if (at) return addCopies(c.els, at.x - Math.min(...c.els.map((e) => e.x)), at.y - Math.min(...c.els.map((e) => e.y)), at.page);
    c.pastes++;
    addCopies(c.els, 10 * c.pastes, 10 * c.pastes, selected[0]?.page);
  };
  /** Text from another app becomes new text: at a point, under the selected text, or at the top of page 1. */
  const pasteText = (text: string, at?: At) => {
    const like = selected.find((x) => !x.image);
    const top = margin ?? 36;
    addCopies([{
      id: "", page: at?.page ?? like?.page ?? 0, text: text.replace(/\r\n?/g, "\n").trim(),
      x: at?.x ?? like?.x ?? top, y: at?.y ?? (like ? like.y + like.size * LINE_HEIGHT : top), ascent: 0.8,
      size: like?.size ?? 11, color: like?.color ?? "#000000", font: like?.font ?? "Helvetica",
      srcFont: "", bold: false, italic: false,
    }], 0, 0);
  };
  const duplicate = () => addCopies(selected, 10, 10);
  const selectAll = () => setSel(elsRef.current.filter((x) => !x.deleted).map((x) => x.id));
  const resetSel = () =>
    patch(sel, (e) =>
      e.orig ? { ...(({ rect: _r, ...o }) => o)(e.orig), deleted: false, wrap: undefined, lineHeight: undefined } : {},
    );
  /** Join selected lines into one wrapping text box, in reading order, keeping their line spacing. */
  const mergeSel = () => {
    const base = (e: El) => e.y + e.ascent * e.size;
    const page = selected.find((e) => !e.image)?.page;
    const texts = selected
      .filter((e) => !e.image && e.page === page)
      .sort((a, b) => (Math.abs(base(a) - base(b)) > 2 ? base(a) - base(b) : a.x - b.x));
    if (texts.length < 2) return;
    const lines: number[] = [];
    for (const t of texts) if (!lines.length || base(t) - lines.at(-1)! > 2) lines.push(base(t));
    const [first, ...rest] = texts;
    const left = Math.min(...texts.map((e) => e.x)), right = Math.max(...texts.map((e) => boxOf(e).r));
    const drop = new Set(rest.map((e) => e.id));
    commit(elsRef.current.flatMap((e) =>
      e.id === first.id
        ? [{
            ...e, x: left, text: texts.map((t) => t.text.trim()).join(" "), wrap: Math.ceil(right - left) + 2,
            lineHeight: lines.length > 1 ? (lines[1] - lines[0]) / first.size : undefined,
          }]
        : drop.has(e.id) ? (e.orig ? [{ ...e, deleted: true }] : []) : [e],
    ));
    setSel([first.id]);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (!isTyping(e.target)) (e.preventDefault(), undo());
        return;
      }
      if (isTyping(e.target)) return;
      if (e.key === "Escape") (setSel([]), setAdding(false));
      const mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
      if (mod && key === "a") return e.preventDefault(), selectAll();
      // Not every browser sends a paste event outside text boxes; if none arrives, paste our own copies.
      if (mod && key === "v") return void (pasteTimer.current = window.setTimeout(() => pasteCopied(), 0));
      if (!sel.length) return;
      if (mod && (key === "c" || key === "x")) return copySel(key === "x");
      if (mod && key === "d") return e.preventDefault(), duplicate();
      if (e.key === "Delete" || e.key === "Backspace") (e.preventDefault(), remove(sel));
      const step = e.shiftKey ? 10 : 1;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (d) {
        e.preventDefault();
        // Per page, so the margin stops the whole selection on that page together.
        const moves = new Map<number, [number, number]>();
        for (const p of new Set(selected.map((x) => x.page))) {
          const area = inside(p);
          const boxes = selected.filter((x) => x.page === p).map(boxOf);
          const group = { l: Math.min(...boxes.map((b) => b.l)), t: Math.min(...boxes.map((b) => b.t)),
            r: Math.max(...boxes.map((b) => b.r)), b: Math.max(...boxes.map((b) => b.b)), base: NaN };
          moves.set(p, area ? confine(group, d[0], d[1], area) : [d[0], d[1]]);
        }
        patch(sel, (el) => ({ x: el.x + moves.get(el.page)![0], y: el.y + moves.get(el.page)![1] }), "nudge:" + sel.join());
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => file && unsaved() && e.preventDefault();
    // Only needed for text copied in another app; our own copies paste from `clip`.
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target) || !file) return;
      clearTimeout(pasteTimer.current);
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain") ?? "";
      const c = clip.current;
      // Windows turns line breaks into CRLF on the clipboard, so compare ignoring line endings.
      const same = (t: string) => t.replace(/\r\n?/g, "\n").trim() === c?.text.trim();
      if (text.trim() && (!c || (c.synced && !same(text)))) pasteText(text);
      else pasteCopied();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
      window.removeEventListener("paste", onPaste);
    };
  });

  // Measured from what's on screen, since redrawn text's width depends on the browser's font rendering.
  const boxOf = (x: El): Box => {
    const n = document.querySelector<HTMLElement>(`[data-id="${CSS.escape(x.id)}"]`);
    const l = n ? n.offsetLeft / scale : x.x, t = n ? n.offsetTop / scale : x.y;
    // Images have no baseline; NaN never matches, so they snap by edges only.
    const base = x.image ? NaN : x.y + x.ascent * x.size;
    return { l, t, r: l + (n?.offsetWidth ?? 0) / scale, b: t + (n ? n.offsetHeight / scale : x.size), base };
  };

  const onElDown = (e: RPointerEvent, el: El) => {
    if (adding || e.button !== 0) return e.button === 2 && e.stopPropagation();
    e.stopPropagation();
    // Shift/Ctrl+click adds at once (so the group can be dragged); removing waits for a click without a drag.
    const mod = e.shiftKey || e.ctrlKey || e.metaKey;
    const ids = sel.includes(el.id) ? sel : mod ? [...sel, el.id] : [el.id];
    setSel(ids);
    const start = new Map(elsRef.current.filter((x) => ids.includes(x.id)).map((x) => [x.id, { x: x.x, y: x.y }]));
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
    const toggle = mod && sel.includes(el.id) ? el.id : undefined;
    drag.current = { x: e.clientX, y: e.clientY, touch: "drag:" + performance.now(), start, page: el.page, box, others, toggle };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onElMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const rawX = (e.clientX - d.x) / scale, rawY = (e.clientY - d.y) / scale;
    if (Math.abs(rawX) + Math.abs(rawY) < 2 / scale && lastTouch.current !== d.touch) return;
    // Shift: free move. Ctrl: whole-point steps (alignment snapping would land on fractions). Otherwise snap.
    const whole = e.ctrlKey || e.metaKey;
    const s = e.shiftKey
      ? { dx: rawX, dy: rawY, guides: {} as Guides }
      : whole
        ? { dx: Math.round(rawX), dy: Math.round(rawY), guides: {} as Guides }
        : snap(d.box, d.others, rawX, rawY, 5 / scale, pages[d.page].w);
    const area = inside(d.page);
    const [dx, dy] = area ? confine(d.box, s.dx, s.dy, area) : [s.dx, s.dy];
    // A guide only means something if the margin didn't overrule it.
    const guides = { x: dx === s.dx ? s.guides.x : undefined, y: dy === s.dy ? s.guides.y : undefined };
    setGuides({ page: d.page, ...guides });
    // Snapped, whole-step and margin-stopped moves stay exact; free ones round to 0.1pt.
    const r = (n: number, exact: boolean) => (exact ? n : Math.round(n * 10) / 10);
    patch(
      [...d.start.keys()],
      (el) => ({
        x: r(d.start.get(el.id)!.x + dx, whole || guides.x !== undefined || dx !== s.dx),
        y: r(d.start.get(el.id)!.y + dy, whole || guides.y !== undefined || dy !== s.dy),
      }),
      d.touch,
    );
  };
  const endDrag = () => {
    const d = drag.current;
    if (d?.toggle && lastTouch.current !== d.touch) setSel((s) => s.filter((i) => i !== d.toggle));
    drag.current = null;
    setGuides(null);
  };

  // Box selection: drag across empty page space. Shift/Ctrl adds to the current selection.
  const onPageDown = (e: RPointerEvent, page: number) => {
    if (e.button !== 0) return;
    if (!adding) {
      const r = e.currentTarget.getBoundingClientRect();
      const additive = e.shiftKey || e.ctrlKey || e.metaKey;
      const boxes = elsRef.current.filter((o) => o.page === page && !o.deleted).map((o) => [o.id, boxOf(o)] as const);
      marquee.current = { page, x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale, base: additive ? sel : [], boxes };
      if (!additive) setSel([]);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    e.preventDefault(); // otherwise the click's mousedown steals focus from the new text box
    const box = e.currentTarget.getBoundingClientRect();
    addTextAt({ page, x: (e.clientX - box.left) / scale, y: (e.clientY - box.top) / scale });
  };
  const addTextAt = ({ page, x, y }: At) => {
    const last = elsRef.current.find((e) => e.id === sel[0] && !e.image);
    const size = last?.size ?? 11, area = inside(page);
    const fit = (v: number, lo: number, hi: number) => (area ? Math.max(lo, Math.min(v, hi)) : v);
    const el: El = {
      id: "new-" + performance.now(), page, text: "",
      x: fit(Math.round(x), area?.l ?? 0, area?.r ?? 0),
      y: fit(Math.round(y), area?.t ?? 0, (area?.b ?? 0) - size * LINE_HEIGHT),
      ascent: 0.8, size, color: last?.color ?? "#000000", font: last?.font ?? "Helvetica",
      srcFont: "", bold: false, italic: false,
    };
    commit([...elsRef.current, el]);
    setSel([el.id]);
    setAdding(false);
    setTab("edit");
  };

  const onPageMove = (e: RPointerEvent) => {
    const m = marquee.current;
    if (!m) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / scale, y = (e.clientY - r.top) / scale;
    const box = { l: Math.min(m.x, x), r: Math.max(m.x, x), t: Math.min(m.y, y), b: Math.max(m.y, y) };
    setBand({ page: m.page, ...box });
    const hit = m.boxes.filter(([, b]) => b.r >= box.l && b.l <= box.r && b.b >= box.t && b.t <= box.b).map(([id]) => id);
    setSel([...new Set([...m.base, ...hit])]);
  };
  const onPageUp = () => {
    marquee.current = null;
    setBand(null);
  };

  const hfEls = headerFooterEls(hf, pages);

  const selSet = new Set(sel);
  const selected = els.filter((e) => selSet.has(e.id));
  // Selecting text brings its settings into view.
  useEffect(() => void (sel.length && setTab("edit")), [sel.length > 0]);
  const one = selected.length === 1 ? selected[0] : null;
  const selText = selected.filter((e) => !e.image), textIds = selText.map((e) => e.id);
  const shared = <K extends keyof El>(k: K) => (selText.every((e) => e[k] === selText[0][k]) ? selText[0]?.[k] : undefined);
  const [font, size, color] = [shared("font"), shared("size"), shared("color")];
  const rotated = pages.some((p) => p.rotated);

  // Handlers read the latest state through a ref, so ElView's props stay stable between renders.
  const live = useRef<ElHandlers>(null!);
  live.current = {
    down: onElDown,
    move: onElMove,
    up: endDrag,
    focusText: () => (textBox.current?.focus(), textBox.current?.select()),
    resizeStart: (e) => {
      e.stopPropagation();
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      resizing.current = "wrap:" + performance.now();
    },
    resizeMove: (e, el) => {
      if (!resizing.current) return;
      const page = (e.currentTarget as HTMLElement).closest(".page")!.getBoundingClientRect();
      const right = Math.min((e.clientX - page.left) / scale, inside(el.page)?.r ?? Infinity);
      patch([el.id], { wrap: Math.max(el.size * 2, Math.round(right - el.x)) }, resizing.current);
    },
    resizeEnd: () => void (resizing.current = ""),
    unwrap: (id) => patch([id], { wrap: undefined }),
    pngUrl,
  };
  const elHandlers = useMemo<ElHandlers>(() => ({
    down: (e, el) => live.current.down(e, el),
    move: (e) => live.current.move(e),
    up: () => live.current.up(),
    focusText: () => live.current.focusText(),
    resizeStart: (e) => live.current.resizeStart(e),
    resizeMove: (e, el) => live.current.resizeMove(e, el),
    resizeEnd: () => live.current.resizeEnd(),
    unwrap: (id) => live.current.unwrap(id),
    pngUrl: (png) => live.current.pngUrl(png),
  }), []);

  // Reuse each item's React element until the item, its selection state, the zoom or the fonts change.
  // Even memoised components cost something to describe; with hundreds of items that was most of a drag frame.
  const views = useRef(new WeakMap<El, { key: string; fonts: Map<string, Uint8Array>; node: ReactElement }>());
  const viewOf = (el: El) => {
    const selectedNow = selSet.has(el.id), single = one?.id === el.id;
    const key = `${scale}|${selectedNow}|${single}`;
    const hit = views.current.get(el);
    if (hit && hit.key === key && hit.fonts === fonts) return hit.node;
    const node = <ElView key={el.id} el={el} scale={scale} selected={selectedNow} single={single} fonts={fonts} on={elHandlers} />;
    views.current.set(el, { key, fonts, node });
    return node;
  };

  return (
    <div
      className={`app side-${side}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        // Handles must be requested before the drop event ends.
        const handles = [...e.dataTransfer.items].map((i) => (i as any).getAsFileSystemHandle?.());
        openFiles(e.dataTransfer.files, handles);
      }}
    >
      <header className="toolbar">
        <button className="btn primary" onClick={pickPdf}>Open PDF</button>
        <input ref={pdfInput} type="file" accept=".pdf" hidden onChange={(e) => (openFiles(e.target.files), (e.target.value = ""))} />
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
        {file && <button className="btn" onClick={closePdf}>Close</button>}
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
            {recent.length > 0 && (
              <section className="recent" aria-label="Recently opened">
                <h2>Recently opened</h2>
                <ul>
                  {recent.map((r) => (
                    <li key={r.name}>
                      <button className="recent-row" onClick={() => reopen(r)}>
                        <span className="recent-name">{r.name}</span>
                        <span className="muted">
                          {openedAt(r.openedAt)}
                          {!r.handle && " · opens the file picker"}
                        </span>
                      </button>
                      <button className="recent-x" aria-label={`Remove ${r.name} from recent files`} title="Remove from list"
                        onClick={() => forget(r.name)}>
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
        {rotated && <div className="warn">This PDF has rotated pages. Edits on those pages will land in the wrong place.</div>}
        {pages.map((pg, p) => (
          <div
            key={p}
            className={adding ? "page adding" : "page"}
            style={{ width: pg.w * scale, height: pg.h * scale }}
            onPointerDown={(e) => (e.stopPropagation(), onPageDown(e, p))}
            onPointerMove={onPageMove}
            onPointerUp={onPageUp}
            onContextMenu={(e) => {
              e.preventDefault();
              const id = (e.target as HTMLElement).closest<HTMLElement>("[data-id]")?.dataset.id;
              setSel(id ? (sel.includes(id) ? sel : [id]) : []);
              const r = e.currentTarget.getBoundingClientRect();
              setMenu({ page: p, x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale, left: e.clientX, top: e.clientY });
            }}
          >
            <canvas ref={(c) => void (c ? canvases.current.set(p, c) : canvases.current.delete(p))} />
            {margin !== null && <div className="margin-guide" style={{ inset: margin * scale }} />}
            {band?.page === p && (
              <div
                className="marquee"
                style={{ left: band.l * scale, top: band.t * scale, width: (band.r - band.l) * scale, height: (band.b - band.t) * scale }}
              />
            )}
            {guides?.page === p && guides.x !== undefined && <div className="guide v" style={{ left: guides.x * scale }} />}
            {guides?.page === p && guides.y !== undefined && <div className="guide h" style={{ top: guides.y * scale }} />}
            {/* images first, so text drawn over them stays clickable */}
            {els.filter((el) => el.page === p && !el.deleted).sort((a, b) => +!!b.image - +!!a.image).map(viewOf)}
            {hfEls.filter((el) => el.page === p).map((el) => (
              <div key={el.id} className="el drawn hf" style={drawnStyle(el, scale)}>{el.text}</div>
            ))}
          </div>
        ))}
      </main>

      {menu && (() => {
        const has = selected.length > 0;
        const at = { page: menu.page, x: menu.x, y: menu.y };
        const pasteHere = () =>
          clip.current
            ? pasteCopied(at)
            : navigator.clipboard?.readText().then((t) => (t.trim() ? pasteText(t, at) : Promise.reject()))
                .catch(() => setReport({ ok: false, lines: ["Nothing to paste yet. Copy something first."] }));
        const items: ([string, string, () => unknown, boolean] | null)[] = [
          ["Cut", "Ctrl+X", () => copySel(true), has],
          ["Copy", "Ctrl+C", () => copySel(), has],
          ["Paste here", "Ctrl+V", pasteHere, true],
          ["Duplicate", "Ctrl+D", duplicate, has],
          ["Delete", "Del", () => remove(sel), has],
          null,
          ["Merge into one text box", "", mergeSel, selected.filter((e) => !e.image).length > 1],
          ["Reset to original", "", resetSel, selected.some((e) => e.orig && isDirty(e))],
          ["Select all", "Ctrl+A", selectAll, true],
          ["Add text here", "", () => addTextAt(at), true],
        ];
        const close = () => setMenu(null);
        const onKeys = (e: RKeyboardEvent) => {
          e.stopPropagation();
          const btns = [...menuRef.current!.querySelectorAll<HTMLElement>("button:not(:disabled)")];
          const i = btns.indexOf(document.activeElement as HTMLElement);
          if (e.key === "Escape" || e.key === "Tab") (e.preventDefault(), close());
          if (e.key === "ArrowDown") (e.preventDefault(), btns[(i + 1) % btns.length]?.focus());
          if (e.key === "ArrowUp") (e.preventDefault(), btns[(i - 1 + btns.length) % btns.length]?.focus());
        };
        return (
          <div className="menu-backdrop" onPointerDown={close} onWheel={close} onContextMenu={(e) => (e.preventDefault(), close())}>
            <div
              ref={menuRef}
              role="menu"
              className="menu"
              // keep it on screen: ~31px per item
              style={{ left: Math.min(menu.left, innerWidth - 232), top: Math.min(menu.top, innerHeight - items.length * 31 - 12) }}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={onKeys}
            >
              {items.map((it, i) =>
                it ? (
                  <button key={it[0]} role="menuitem" disabled={!it[3]} onClick={() => (close(), it[2]())}>
                    <span>{it[0]}</span>
                    {it[1] && <kbd>{it[1]}</kbd>}
                  </button>
                ) : (
                  <hr key={i} />
                ),
              )}
            </div>
          </div>
        );
      })()}

      {report && (
        <div className={`toast ${report.busy ? "" : report.ok ? "ok" : "bad"}`} role={report.ok ? "status" : "alert"}>
          {report.busy && <span className="spinner" aria-hidden="true" />}
          <div className="toast-body">{report.lines.map((l, i) => <p key={i}>{l}</p>)}</div>
          {!report.busy && <button className="link" onClick={() => setReport(null)}>Dismiss</button>}
        </div>
      )}

      <aside className="side">
        {file && (
          <div className="tabs" role="tablist">
            {TABS.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "tab on" : "tab"} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
        )}

        {tab === "edit" && (
          <>
          {!selected.length && file && (
            <p className="muted">
              Click text or an image to select it, then drag to move. Drag across empty space to select a group,
              Shift or Ctrl+click to add or remove, Ctrl+A to select everything; the selection moves together.
              While dragging, things snap into line; hold Shift to move freely or Ctrl to move in whole points.
              Double-click text to reword. Arrow keys nudge (Shift for 10pt), Delete removes, Ctrl+Z undoes.
              Ctrl+C, X and V copy, cut and paste; Ctrl+D duplicates. Right-click for all of these.
              Drag the handle on a selected text's right edge to make it wrap; merge several lines into one box to
              reflow a paragraph.
            </p>
          )}

          {selected.length > 0 && (
            <section>
              <h2>{one ? (one.image ? "Image" : one.orig ? "Text" : "New text") : `${selected.length} selected`}</h2>
              {one && !one.image && (
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
                {textIds.length > 0 && (
                  <>
                    <label className="wide">
                      Font
                      <select value={font ?? ""} onChange={(e) => patch(textIds, { font: e.target.value })}>
                        {font === undefined && <option value="">(mixed)</option>}
                        {available.map((f) => <option key={f}>{f}</option>)}
                      </select>
                    </label>
                    <label>
                      Size
                      <input type="number" step="0.5" min="1" value={size ?? ""} placeholder="mixed"
                        onChange={(e) => +e.target.value > 0 && patch(textIds, { size: +e.target.value }, "size:" + textIds)} />
                    </label>
                    <label>
                      Colour
                      <input type="color" value={color ?? "#000000"}
                        onChange={(e) => patch(textIds, { color: e.target.value }, "color:" + textIds)} />
                    </label>
                  </>
                )}
                {one && !one.image && (
                  <>
                    <label>
                      Width (pt)
                      <input type="number" step="1" min="1" value={one.wrap ?? ""} placeholder="Auto"
                        onChange={(e) => patch([one.id], { wrap: e.target.value === "" ? undefined : Math.max(1, +e.target.value) }, "wrap:" + one.id)} />
                    </label>
                    <label>
                      Line spacing
                      <input type="number" step="0.05" min="0.5" value={Math.round((one.lineHeight ?? LINE_HEIGHT) * 100) / 100}
                        onChange={(e) => +e.target.value > 0 && patch([one.id], { lineHeight: +e.target.value }, "lh:" + one.id)} />
                    </label>
                  </>
                )}
                {one && (["x", "y"] as const).map((k) => (
                  <label key={k}>
                    {k.toUpperCase()} (pt)
                    <input type="number" step="1" value={Math.round(one[k] * 10) / 10}
                      onChange={(e) => e.target.value !== "" && patch([one.id], { [k]: +e.target.value }, k + one.id)} />
                  </label>
                ))}
              </div>
              {one?.srcFont && <FontNote el={one} loaded={!missing.includes(one.srcFont)}
                onUseForAll={() => commit(fontForSource(elsRef.current, one.srcFont, one.font))} />}
              <div className="row">
                {selText.length > 1 && <button className="btn" onClick={mergeSel}>Merge into one text box</button>}
                {selected.some((e) => e.orig && isDirty(e)) && (
                  <button className="btn" onClick={resetSel}>Reset to original</button>
                )}
                <button className="btn danger" onClick={() => remove(sel)}>Delete</button>
              </div>
            </section>
          )}
          </>
        )}

        {tab === "fonts" && (
          <>
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
                    <optgroup label="Loaded and built-in">
                      {families.map((f) => <option key={f}>{f}</option>)}
                    </optgroup>
                    {installedFamilies.length > 0 && (
                      <optgroup label="Installed on this PC">
                        {installedFamilies.map((f) => <option key={f}>{f}</option>)}
                      </optgroup>
                    )}
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
              {"queryLocalFonts" in window && !installed.length && (
                <button
                  className="link"
                  onClick={() =>
                    loadInstalledList().catch((err) =>
                      setReport({ ok: false, lines: [`Couldn't read installed fonts: ${(err as Error).message}`] }),
                    )
                  }
                >
                  Show fonts installed on this PC
                </button>
              )}
              <p className="muted">
                Bold and italic are kept when the font has those styles. Load each style's file (e.g. Arial and Arial Bold)
                for an exact match. All of that text gets redrawn; Ctrl+Z undoes it.
              </p>
            </section>
          )}
          </>
        )}

        {tab === "page" && (
          <>
          {file && (
            <section>
              <h2>Margins</h2>
              <label className="check">
                <input type="checkbox" checked={marginOn === "1"} onChange={(e) => setMarginOn(e.target.checked ? "1" : "0")} />
                Keep everything inside the margin
              </label>
              <div className="grid">
                <label>
                  Margin (pt)
                  <input type="number" step="1" min="0" value={marginPt} onChange={(e) => setMarginPt(e.target.value)} />
                </label>
                <p className="muted fill">
                  = {((+marginPt || 0) / 72).toFixed(2)} in, {(((+marginPt || 0) / 72) * 25.4).toFixed(1)} mm
                </p>
              </div>
              <p className="muted">
                Dragging, arrow keys and new text stop at the dashed line. Typing an exact X or Y still goes anywhere.
              </p>
            </section>
          )}

          {file && (
            <section>
              <h2>Header &amp; footer</h2>
              {(["header", "footer"] as const).map((row) => (
                <div key={row} className="grid three">
                  {["Left", "Centre", "Right"].map((label, i) => (
                    <label key={label}>
                      {row === "header" ? "Header" : "Footer"} {label.toLowerCase()}
                      <input
                        type="text"
                        value={hf[row][i]}
                        onChange={(e) => setHf({ ...hf, [row]: hf[row].map((t, j) => (j === i ? e.target.value : t)) })}
                      />
                    </label>
                  ))}
                </div>
              ))}
              <div className="grid">
                <label className="wide">
                  Font
                  <select value={hf.font} onChange={(e) => setHf({ ...hf, font: e.target.value })}>
                    {available.map((f) => <option key={f}>{f}</option>)}
                  </select>
                </label>
                <label>
                  Size
                  <input type="number" step="0.5" min="1" value={hf.size}
                    onChange={(e) => +e.target.value > 0 && setHf({ ...hf, size: +e.target.value })} />
                </label>
                <label>
                  Colour
                  <input type="color" value={hf.color} onChange={(e) => setHf({ ...hf, color: e.target.value })} />
                </label>
                <label>
                  From edge (pt)
                  <input type="number" step="1" min="0" value={hf.margin}
                    onChange={(e) => e.target.value !== "" && setHf({ ...hf, margin: +e.target.value })} />
                </label>
                <label className="check">
                  <input type="checkbox" checked={hf.skipFirst} onChange={(e) => setHf({ ...hf, skipFirst: e.target.checked })} />
                  Skip first page
                </label>
              </div>
              <p className="muted">Shown on every page. Use {"{page}"} and {"{pages}"} for page numbers, e.g. Page {"{page}"} of {"{pages}"}.</p>
            </section>
          )}
          </>
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
