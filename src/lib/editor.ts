import {
  type PointerEvent,
  type MouseEvent as RMouseEvent,
  type UIEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { canReadLocalFonts, chromium, download, errorText, isTyping, type LocalFont, PDF_TYPE } from "./browser";
import { applyDraft, changed, type Draft, dropDraft, loadDraft, saveDraft } from "./drafts";
import {
  type Align,
  type AtsReport,
  alignShift,
  blankPdf,
  type Compression,
  compact,
  type El,
  familyOf,
  findMatches,
  fontKey,
  type HeaderFooter,
  headerFooterEls,
  type ImageFile,
  identityOrder,
  isBoldName,
  isDirty,
  isItalicName,
  LINE_HEIGHT,
  type Match,
  META_FIELDS,
  type Meta,
  type PageInfo,
  parsePageList,
  pickFace,
  replaceMatches,
  type Slot,
  STANDARD_FONTS,
  turned,
  unrotate,
  unrotateDelta,
} from "./model";
import { usePref, usePrefs } from "./prefs";
import { usePreviews } from "./previews";
import { openedAt, type Recent, useRecent } from "./recent";
import { type Area, type Box, confine, type Guides, snap } from "./snap";

export type At = { page: number; x: number; y: number };
export type Report = { ok: boolean; lines: string[]; busy?: boolean; action?: { label: string; onClick: () => void } };
export type Tab = "edit" | "fonts" | "page" | "info";
export type Band = { page: number; l: number; r: number; t: number; b: number };
export type MenuAt = At & { left: number; top: number };

export type ElHandlers = {
  down(e: PointerEvent, el: El): void;
  move(e: PointerEvent): void;
  up(): void;
  focusText(): void;
  focus(el: El): void;
  resizeStart(e: PointerEvent): void;
  resizeMove(e: PointerEvent, el: El): void;
  resizeEnd(): void;
  unwrap(id: string): void;
};

export type PageHandlers = {
  down(e: PointerEvent<HTMLDivElement>, page: number): void;
  move(e: PointerEvent<HTMLDivElement>): void;
  up(): void;
  menu(e: RMouseEvent<HTMLDivElement>, page: number): void;
  add(after: number): void;
};

const NARROW = "(max-width: 760px)";
const clampScale = (s: number) => Math.max(0.5, Math.min(4, s));

const groupByPage = (list: El[]) => {
  const m = new Map<number, El[]>();
  for (const e of list) (m.get(e.page) ?? m.set(e.page, []).get(e.page)!).push(e);
  return m;
};

const fontForSource = (list: El[], src: string, key: string) =>
  list.map((e) =>
    e.srcFont && compact(e.srcFont) === compact(src)
      ? { ...e, font: key, orig: e.orig && !isDirty(e) ? { ...e.orig, font: key } : e.orig }
      : e,
  );

const newText = (fields: Pick<El, "page" | "text" | "x" | "y" | "size" | "color" | "font">): El => ({
  id: `new-${crypto.randomUUID()}`,
  ascent: 0.8,
  srcFont: "",
  bold: false,
  italic: false,
  ...fields,
});

export function useEditor() {
  const { prefs, setPref, resetPrefs, theme, margin } = usePrefs();
  const { recent, remember, forget, load } = useRecent();
  const [file, setFile] = useState<{
    name: string;
    size: number;
    handle?: FileSystemFileHandle;
    fresh?: boolean;
  } | null>(null);
  const [compression, setCompression] = useState<Compression>("off");
  const [estimate, setEstimate] = useState<{ bytes: number; compression: Compression; busy?: boolean } | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [order, setOrder] = useState<Slot[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const fileMeta = useRef<Meta | null>(null);
  const [els, setEls] = useState<El[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [fonts, setFonts] = useState(new Map<string, Uint8Array>());
  const [scale, setScale] = useState(1.5);
  const [adding, setAdding] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(() => !matchMedia(NARROW).matches);
  const [fileMenu, setFileMenu] = useState(false);
  const [tab, setTab] = usePref("tab", "edit") as unknown as [Tab, (t: Tab) => void];
  const [swap, setSwap] = useState({ family: "Helvetica", scope: "all" });
  const [installed, setInstalled] = useState<LocalFont[]>([]);
  const [hf, setHf] = useState<HeaderFooter>({
    header: ["", "", ""],
    footer: ["", "", ""],
    font: "Helvetica",
    size: 9,
    color: "#555555",
    margin: 36,
    skipFirst: false,
  });
  const [guides, setGuides] = useState<(Guides & { page: number }) | null>(null);
  const [menu, setMenu] = useState<MenuAt | null>(null);
  const [band, setBand] = useState<Band | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const pdfInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const mergeInput = useRef<HTMLInputElement>(null);
  const mergeAfter = useRef(0);
  const docPages = useRef(0);
  const merged = useRef(false);
  const [added, setAdded] = useState(new Map<string, ImageFile>());
  const addedUrls = useRef(new Map<string, string>());
  const pagesRef = useRef<HTMLElement>(null);
  const textBox = useRef<HTMLTextAreaElement>(null);
  const elsRef = useRef<El[]>([]);
  const pageArrays = useRef(new Map<number, El[]>());
  type Snap = { els: El[]; order: Slot[] };
  const pendingDraft = useRef<Draft | null>(null);
  const orderRef = useRef<Slot[]>([]);
  const past = useRef<Snap[]>([]);
  const future = useRef<Snap[]>([]);
  const lastTouch = useRef("");
  const resizing = useRef("");
  const clip = useRef<{ els: El[]; text: string; pastes: number; synced: boolean } | null>(null);
  const pasteTimer = useRef(0);
  const saved = useRef<{ els: El[]; hf: HeaderFooter | null; order: Slot[]; meta?: Meta | null }>({
    els: [],
    hf: null,
    order: [],
  });
  const drag = useRef<{
    x: number;
    y: number;
    touch: string;
    start: Map<string, { x: number; y: number }>;
    page: number;
    box: Box;
    others: Box[];
    toggle?: string;
  } | null>(null);
  const marquee = useRef<{
    page: number;
    x: number;
    y: number;
    base: string[];
    boxes: (readonly [string, Box])[];
  } | null>(null);

  const byPage = useMemo(() => {
    const m = groupByPage(els);
    for (const [p, list] of m) {
      const old = pageArrays.current.get(p);
      if (old && old.length === list.length && old.every((e, i) => e === list[i])) m.set(p, old);
    }
    pageArrays.current = m;
    return m;
  }, [els]);
  const elById = useMemo(() => new Map(els.map((e) => [e.id, e])), [els]);
  const hfEls = useMemo(() => headerFooterEls(hf, pages, order), [hf, pages, order]);
  const hfByPage = useMemo(() => groupByPage(hfEls), [hfEls]);
  const editedPages = useMemo(() => new Set(els.filter(isDirty).map((e) => e.page)), [els]);
  const sourceFonts = useMemo(() => [...new Set(els.map((e) => e.srcFont).filter(Boolean))], [els]);

  const canvasStyle = prefs.uiStyle === "canvas";
  const showThumbs = prefs.thumbs === "1";
  const previews = usePreviews({ open: !!file, pages, order, byPage, scale, thumbs: showThumbs });

  const selected = sel.map((id) => elById.get(id)).filter((e): e is El => !!e);
  const one = selected.length === 1 ? selected[0] : null;
  const selText = selected.filter((e) => !e.image);
  const textIds = selText.map((e) => e.id);
  const shared = <K extends keyof El>(k: K) =>
    selText.every((e) => e[k] === selText[0][k]) ? selText[0]?.[k] : undefined;
  const available = [...fonts.keys(), ...Object.keys(STANDARD_FONTS)];
  const missing = sourceFonts.filter((s) => !available.some((k) => compact(k) === compact(s)));
  const families = [...new Set(available.map(familyOf))];
  const installedFamilies = [...new Set(installed.map((f) => familyOf(f.postscriptName)))]
    .filter((f) => !families.includes(f))
    .sort();
  const inside = (page: number): Area | null =>
    margin === null ? null : { l: margin, t: margin, r: pages[page].w - margin, b: pages[page].h - margin };

  const current = (): Snap => ({ els: elsRef.current, order: orderRef.current });
  const record = (touch: string) => {
    future.current = [];
    if (!touch || touch !== lastTouch.current) {
      past.current.push(current());
      if (past.current.length > 300) past.current.shift();
    }
    lastTouch.current = touch;
  };
  const commit = (next: El[], touch = "") => {
    record(touch);
    elsRef.current = next;
    setEls(next);
  };
  const commitOrder = (next: Slot[]) => {
    record("");
    orderRef.current = next;
    setOrder(next);
  };
  const patch = (ids: string[], p: Partial<El> | ((e: El) => Partial<El>), touch = "") =>
    commit(
      elsRef.current.map((e) => (ids.includes(e.id) ? { ...e, ...(typeof p === "function" ? p(e) : p) } : e)),
      touch,
    );
  const step = (from: typeof past, to: typeof past) => {
    const next = from.current.pop();
    if (!next) return;
    to.current.push(current());
    lastTouch.current = "";
    elsRef.current = next.els;
    orderRef.current = next.order;
    setEls(next.els);
    setOrder(next.order);
  };
  const undo = () => step(past, future);
  const redo = () => step(future, past);

  const addCopies = (src: El[], dx: number, dy: number, page?: number) => {
    const copies = src.map(({ orig: _o, deleted: _d, ...e }) => ({
      ...e,
      id: `new-${crypto.randomUUID()}`,
      page: page ?? e.page,
      x: e.x + dx,
      y: e.y + dy,
    }));
    commit([...elsRef.current, ...copies]);
    setSel(copies.map((c) => c.id));
  };
  const remove = (ids: string[]) => {
    commit(
      elsRef.current
        .filter((e) => !(ids.includes(e.id) && !e.orig))
        .map((e) => (ids.includes(e.id) ? { ...e, deleted: true } : e)),
    );
    setSel([]);
  };

  const unsaved = () =>
    elsRef.current !== saved.current.els ||
    hf !== saved.current.hf ||
    orderRef.current !== saved.current.order ||
    meta !== saved.current.meta;
  const clearPreviews = () => {
    previews.clear();
    clip.current = null;
  };

  const closePdf = () => {
    if (unsaved() && !confirm("Close this PDF? Edits you haven't saved will be lost.")) return;
    if (file) dropDraft(file.name);
    clearPreviews();
    past.current = [];
    future.current = [];
    elsRef.current = [];
    orderRef.current = [];
    setFile(null);
    setPages([]);
    setOrder([]);
    setEls([]);
    setSel([]);
    setAdding(false);
    setReport(null);
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
      setReport({ ok: false, lines: [`Couldn't load font ${label}: ${errorText(err)}`] });
    }
  };
  const addLocalFont = async (f: LocalFont) =>
    addFont(new Uint8Array(await (await f.blob()).arrayBuffer()), f.postscriptName);

  const loadInstalledList = async () => {
    const list = await chromium.queryLocalFonts();
    setInstalled(list);
    return list;
  };
  const showInstalled = () =>
    loadInstalledList().catch((err) =>
      setReport({ ok: false, lines: [`Couldn't read installed fonts: ${errorText(err)}`] }),
    );

  async function findInstalled(wanted: string[], auto = false) {
    try {
      const local = await loadInstalledList();
      if (auto && !local.length) return;
      const found: string[] = [];
      for (const s of wanted) {
        const hit = local.find((f) => compact(f.postscriptName) === compact(s));
        if (hit && (await addLocalFont(hit))) found.push(hit.postscriptName);
      }
      const left = wanted.filter((s) => !found.some((f) => compact(f) === compact(s)));
      if (auto && !found.length) return;
      setReport({
        ok: !left.length,
        lines: [
          found.length
            ? `Loaded from this PC: ${found.join(", ")}`
            : "None of the missing fonts are installed on this PC.",
          ...(left.length ? [`Still missing: ${left.join(", ")}`] : []),
        ],
      });
    } catch (err) {
      if (!auto) setReport({ ok: false, lines: [`Couldn't read installed fonts: ${errorText(err)}`] });
    }
  }

  const openPdf = async (f: File, handle?: FileSystemFileHandle, fresh = false) => {
    try {
      setReport({ ok: true, busy: true, lines: [`Opening ${f.name}…`] });
      const bytes = new Uint8Array(await f.arrayBuffer());
      clearPreviews();
      const { pages, els, meta: found } = await previews.request<"open">({ type: "open", bytes }, [bytes.buffer]);
      const draft = await loadDraft(f.name, f.size);
      pendingDraft.current = draft ?? null;
      let list = els;
      for (const key of fonts.keys()) list = fontForSource(list, key, key);
      past.current = [];
      future.current = [];
      elsRef.current = list;
      const first = identityOrder(pages);
      orderRef.current = first;
      fileMeta.current = found;
      docPages.current = pages.length;
      merged.current = false;
      setMeta(found);
      saved.current = { els: list, hf, order: first, meta: found };
      setFile({ name: f.name, size: f.size, handle, fresh });
      setEstimate(null);
      if (!fresh) remember(f.name, handle, f);
      setPages(pages);
      setOrder(first);
      setEls(list);
      setSel([]);
      setReport(null);
      const have = [...fonts.keys(), ...Object.keys(STANDARD_FONTS)].map(compact);
      const need = [...new Set(list.map((e) => e.srcFont).filter((s) => s && !have.includes(compact(s))))];
      if (need.length && canReadLocalFonts()) await findInstalled(need, true);
      if (draft)
        setReport({
          ok: true,
          lines: [
            `You have unsaved edits to ${f.name} from ${openedAt(draft.savedAt)}.`,
            "Restore them, or dismiss to start from the file as it is.",
          ],
          action: { label: RESTORE, onClick: () => restoreDraft(draft) },
        });
      return true;
    } catch (err) {
      setReport({ ok: false, lines: [`Couldn't open ${f.name}: ${errorText(err)}`] });
      return false;
    }
  };

  const restoreDraft = async (draft: Draft) => {
    for (const [key, bytes] of draft.fonts) if (!fonts.has(key)) await addFont(bytes, key);
    record("");
    const next = applyDraft(elsRef.current, draft);
    elsRef.current = next;
    orderRef.current = draft.order;
    setEls(next);
    setPages(draft.pages);
    setOrder(draft.order);
    setHf(draft.hf);
    if (draft.meta) setMeta(draft.meta);
    for (const [key, f] of draft.images ?? [])
      addedUrls.current.set(
        key,
        URL.createObjectURL(new Blob([f.bytes as BlobPart], { type: f.type === "jpg" ? "image/jpeg" : "image/png" })),
      );
    if (draft.images?.length) setAdded((m) => new Map([...m, ...draft.images!]));
    setReport({ ok: true, lines: ["Restored your unsaved edits."] });
  };

  const toImageFile = async (blob: Blob): Promise<ImageFile & { w: number; h: number }> => {
    const bitmap = await createImageBitmap(blob);
    const [w, h] = [bitmap.width, bitmap.height];
    if (blob.type === "image/png" || blob.type === "image/jpeg") {
      bitmap.close();
      return { bytes: new Uint8Array(await blob.arrayBuffer()), type: blob.type === "image/png" ? "png" : "jpg", w, h };
    }
    const canvas = new OffscreenCanvas(w, h);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
    bitmap.close();
    const png = await canvas.convertToBlob({ type: "image/png" });
    return { bytes: new Uint8Array(await png.arrayBuffer()), type: "png", w, h };
  };
  const insertImage = async (blob: Blob, at?: At) => {
    try {
      const { w, h, ...file } = await toImageFile(blob);
      const key = crypto.randomUUID();
      addedUrls.current.set(
        key,
        URL.createObjectURL(
          new Blob([file.bytes as BlobPart], { type: `image/${file.type === "jpg" ? "jpeg" : "png"}` }),
        ),
      );
      setAdded((m) => new Map(m).set(key, file));
      const page = at?.page ?? (positionOf(currentPage) >= 0 ? currentPage : orderRef.current[0].src);
      const pg = pages[page];
      const fit = Math.min(1, (pg.w * 0.4) / (w * 0.75), (pg.h * 0.4) / (h * 0.75));
      const [iw, ih] = [Math.round(w * 0.75 * fit), Math.round(h * 0.75 * fit)];
      const el: El = {
        id: `new-${crypto.randomUUID()}`,
        page,
        text: "",
        x: Math.round(at?.x ?? (pg.w - iw) / 2),
        y: Math.round(at?.y ?? (pg.h - ih) / 2),
        ascent: 0,
        size: 0,
        color: "",
        font: "",
        srcFont: "",
        bold: false,
        italic: false,
        image: { w: iw, h: ih, page: -1, index: -1, key },
      };
      commit([...elsRef.current, el]);
      setSel([el.id]);
      setTab("edit");
    } catch (err) {
      setReport({ ok: false, lines: [`Couldn't add that image: ${errorText(err)}`] });
    }
  };
  const imageSrcOf = (img: NonNullable<El["image"]>) =>
    img.key ? addedUrls.current.get(img.key) : previews.imageUrl(img);

  const openFiles = async (files: FileList | null, handles: (Promise<FileSystemHandle | null> | undefined)[] = []) => {
    for (const [i, f] of [...(files ?? [])].entries()) {
      if (/\.pdf$/i.test(f.name))
        await openPdf(f, ((await handles[i]?.catch(() => null)) as FileSystemFileHandle | null) ?? undefined);
      else if (/\.(ttf|otf)$/i.test(f.name)) await addFont(new Uint8Array(await f.arrayBuffer()), f.name);
      else if (f.type.startsWith("image/") && file) await insertImage(f);
      else setReport({ ok: false, lines: [`${f.name}: open a .pdf, or a .ttf/.otf font.`] });
    }
  };

  const pickPdf = async () => {
    if (!("showOpenFilePicker" in window)) return pdfInput.current?.click();
    try {
      const [handle] = await chromium.showOpenFilePicker({ types: [PDF_TYPE] });
      await openPdf(await handle.getFile(), handle);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setReport({ ok: false, lines: [`Couldn't open: ${errorText(err)}`] });
    }
  };

  const newPdf = () => openPdf(new File([blankPdf()], "Untitled.pdf", { type: "application/pdf" }), undefined, true);

  const reopen = async (r: Recent) => {
    const found = await load(r);
    if (!found) return pickPdf();
    if ("handle" in found) return openPdf(found.file, found.handle);
    if (await openPdf(found.file))
      setReport({
        ok: true,
        lines: [
          `Opened the copy of ${r.name} saved ${openedAt(r.openedAt)}.`,
          "If you've changed the file since, open it again with Open PDF.",
        ],
      });
  };

  const metaChanged = () => !!meta && (meta.strip || META_FIELDS.some((f) => meta[f] !== fileMeta.current?.[f]));
  const build = (list: El[], o: Slot[]) =>
    previews.request<"export">({
      type: "export",
      els: [...list, ...hfEls],
      fonts,
      layout: { pages, order: o },
      compression,
      meta: metaChanged() && meta ? meta : undefined,
      images: usedImages(list),
    });
  const usedImages = (list: El[]) => {
    const keys = new Set(list.flatMap((e) => (e.image?.key && !e.deleted ? [e.image.key] : [])));
    return new Map([...added].filter(([k]) => keys.has(k)));
  };
  const [ats, setAts] = useState<{ report?: AtsReport; busy?: boolean } | null>(null);
  const checkAts = async () => {
    setAts({ busy: true });
    try {
      const report = await previews.request<"ats">({
        type: "ats",
        els: [...elsRef.current, ...hfEls],
        fonts,
        layout: { pages, order: orderRef.current },
        images: usedImages(elsRef.current),
      });
      setAts({ report });
    } catch (err) {
      setAts(null);
      setReport({ ok: false, lines: [`Couldn't check the text: ${errorText(err)}`] });
    }
  };
  const savePages = (list: string) => {
    const at = parsePageList(list, orderRef.current.length);
    if (!at) return setReport({ ok: false, lines: [`"${list}" isn't a page list. Try something like 1-2, 4.`] });
    save(at.map((i) => orderRef.current[i]));
  };
  const pickMerge = (after: number) => {
    mergeAfter.current = after;
    mergeInput.current?.click();
  };
  const mergeFile = async (f: File) => {
    setReport({ ok: true, busy: true, lines: [`Adding the pages of ${f.name}…`] });
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const r = await previews.request<"merge">({ type: "merge", bytes, blanks: pages.slice(docPages.current) }, [
        bytes.buffer,
      ]);
      const first = pages.length;
      docPages.current = first + r.pages.length;
      merged.current = true;
      if (file) dropDraft(file.name);
      setPages([...pages, ...r.pages]);
      record("");
      const next = [...orderRef.current];
      next.splice(mergeAfter.current + 1, 0, ...r.pages.map((_, i) => ({ src: first + i, rotate: 0 })));
      elsRef.current = [...elsRef.current, ...r.els];
      orderRef.current = next;
      setEls(elsRef.current);
      setOrder(next);
      setReport({
        ok: true,
        lines: [`Added ${r.pages.length} ${r.pages.length === 1 ? "page" : "pages"} from ${f.name}.`],
      });
    } catch (err) {
      setReport({ ok: false, lines: [`Couldn't add ${f.name}: ${errorText(err)}`] });
    }
  };
  const checkSize = async () => {
    setEstimate({ bytes: 0, compression, busy: true });
    try {
      const { pdf } = await build(elsRef.current, orderRef.current);
      setEstimate({ bytes: pdf.length, compression });
    } catch (err) {
      setEstimate(null);
      setReport({ ok: false, lines: [`Couldn't check the size: ${errorText(err)}`] });
    }
  };

  const save = async (only?: Slot[]) => {
    if (!file) return;
    const suggestedName =
      file.fresh && !only ? file.name : `${file.name.replace(/\.pdf$/i, "")}-${only ? "pages" : "edited"}.pdf`;
    let target: FileSystemFileHandle | undefined;
    if ("showSaveFilePicker" in window) {
      const pick = (startIn: unknown) => chromium.showSaveFilePicker({ suggestedName, startIn, types: [PDF_TYPE] });
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
    try {
      const snapshot = { els: elsRef.current, hf, order: orderRef.current, meta };
      const { pdf, problems } = await build(snapshot.els, only ?? snapshot.order);
      if (target) {
        const out = await target.createWritable();
        await out.write(pdf as BufferSource);
        await out.close();
      } else download(pdf, name);
      if (!only) {
        saved.current = snapshot;
        dropDraft(file.name);
      }
      const done = target ? `Saved ${name}` : `${name} is ready. Your browser will save it or ask where.`;
      setReport(
        problems.length
          ? { ok: false, lines: [`${done} Check these first:`, ...problems] }
          : { ok: true, lines: [done, "Old text is gone and all new text reads back correctly."] },
      );
    } catch (err) {
      setReport({ ok: false, lines: [`Not saved: ${errorText(err)}`] });
    }
  };

  const swapFonts = async () => {
    const targets = elsRef.current.filter(
      (e) => !e.image && !e.deleted && (swap.scope === "all" || e.page === +swap.scope),
    );
    const style = (e: El) => [e.orig ? e.bold : isBoldName(e.font), e.orig ? e.italic : isItalicName(e.font)] as const;
    const keys = [...fonts.keys()];
    if (!families.includes(swap.family)) {
      const faces = installed.filter((f) => familyOf(f.postscriptName) === swap.family);
      const names = faces.map((f) => f.postscriptName);
      for (const name of new Set(targets.map((e) => pickFace(swap.family, names, ...style(e))))) {
        const key = await addLocalFont(faces.find((f) => f.postscriptName === name)!);
        if (key) keys.push(key);
      }
      if (!keys.some((k) => familyOf(k) === swap.family)) return;
    }
    const ids = new Set(targets.map((e) => e.id));
    commit(elsRef.current.map((e) => (ids.has(e.id) ? { ...e, font: pickFace(swap.family, keys, ...style(e)) } : e)));
  };
  const applyFontToAll = (el: El) => commit(fontForSource(elsRef.current, el.srcFont, el.font));

  const boxOf = (x: El): Box => {
    const n = document.querySelector<HTMLElement>(`[data-id="${CSS.escape(x.id)}"]`);
    // offsetLeft ignores the translate that centres and right-aligns text.
    const l = n ? (n.offsetLeft - n.offsetWidth * alignShift(x.align)) / scale : x.x,
      t = n ? n.offsetTop / scale : x.y;
    const base = x.image ? NaN : x.y + x.ascent * x.size;
    return { l, t, r: l + (n?.offsetWidth ?? 0) / scale, b: t + (n ? n.offsetHeight / scale : x.size), base };
  };
  const bounds = (boxes: Box[], base = NaN): Box => ({
    l: Math.min(...boxes.map((b) => b.l)),
    t: Math.min(...boxes.map((b) => b.t)),
    r: Math.max(...boxes.map((b) => b.r)),
    b: Math.max(...boxes.map((b) => b.b)),
    base,
  });

  const copySel = (cut = false) => {
    if (!selected.length) return;
    const text = selText.map((x) => x.text).join("\n");
    const c = (clip.current = { els: selected, text, pastes: 0, synced: false as boolean });
    navigator.clipboard?.writeText(text).then(
      () => (c.synced = true),
      () => {},
    );
    if (cut) remove(sel);
  };
  const pasteCopied = (at?: At) => {
    const c = clip.current;
    if (!c) return;
    if (at)
      return addCopies(
        c.els,
        at.x - Math.min(...c.els.map((e) => e.x)),
        at.y - Math.min(...c.els.map((e) => e.y)),
        at.page,
      );
    c.pastes++;
    addCopies(c.els, 10 * c.pastes, 10 * c.pastes, selected[0]?.page);
  };
  const pasteText = (text: string, at?: At) => {
    const like = selText[0];
    const top = margin ?? 36;
    const el = newText({
      page: at?.page ?? like?.page ?? orderRef.current[0].src,
      text: text.replace(/\r\n?/g, "\n").trim(),
      x: at?.x ?? like?.x ?? top,
      y: at?.y ?? (like ? like.y + like.size * LINE_HEIGHT : top),
      size: like?.size ?? 11,
      color: like?.color ?? "#000000",
      font: like?.font ?? "Helvetica",
    });
    addCopies([el], 0, 0);
  };
  const pasteAt = (at: At) =>
    clip.current
      ? pasteCopied(at)
      : navigator.clipboard
          ?.readText()
          .then((t) => (t.trim() ? pasteText(t, at) : Promise.reject()))
          .catch(() => setReport({ ok: false, lines: ["Nothing to paste yet. Copy something first."] }));
  const duplicate = () => addCopies(selected, 10, 10);
  const selectAll = () => {
    const shown = new Set(orderRef.current.map((s) => s.src));
    setSel(elsRef.current.filter((x) => !x.deleted && shown.has(x.page)).map((x) => x.id));
  };
  const canReset = selected.some((e) => e.orig && isDirty(e));
  const bold = selText.length > 0 && selText.every((e) => isBoldName(e.font));
  const italic = selText.length > 0 && selText.every((e) => isItalicName(e.font));
  const align = selText.every((e) => (e.align ?? "left") === (selText[0]?.align ?? "left"))
    ? (selText[0]?.align ?? "left")
    : undefined;
  const setAlign = (a: Align) =>
    patch(textIds, (e) => {
      const b = boxOf(e);
      return { align: a === "left" ? undefined : a, x: b.l + (b.r - b.l) * alignShift(a) };
    });
  const toggleStyle = async (kind: "bold" | "italic") => {
    const on = !(kind === "bold" ? bold : italic);
    const chosen: Record<string, string> = {};
    const unavailable = new Set<string>();
    for (const e of selText) {
      const want = [kind === "bold" ? on : isBoldName(e.font), kind === "italic" ? on : isItalicName(e.font)] as const;
      const matches = (k: string) => isBoldName(k) === want[0] && isItalicName(k) === want[1];
      const fam = familyOf(e.font);
      let key = pickFace(fam, available, ...want);
      const local = installed.filter((f) => familyOf(f.postscriptName) === fam);
      if (!matches(key) && local.length) {
        const face = local.find(
          (f) =>
            f.postscriptName ===
            pickFace(
              fam,
              local.map((f) => f.postscriptName),
              ...want,
            ),
        );
        key = (face && matches(face.postscriptName) && (await addLocalFont(face))) || key;
      }
      if (matches(key)) chosen[e.id] = key;
      else unavailable.add(fam);
    }
    if (Object.keys(chosen).length) patch(Object.keys(chosen), (e) => ({ font: chosen[e.id] }));
    if (unavailable.size)
      setReport({
        ok: false,
        lines: [
          `No ${kind} style of ${[...unavailable].join(", ")} is loaded.`,
          "Load that font file in the Fonts tab, then try again.",
        ],
      });
  };
  const resetSel = () =>
    patch(sel, (e) =>
      e.orig ? { ...(({ rect: _r, ...o }) => o)(e.orig), deleted: false, wrap: undefined, lineHeight: undefined } : {},
    );
  const mergeSel = () => {
    const base = (e: El) => e.y + e.ascent * e.size;
    const page = selText[0]?.page;
    const texts = selText
      .filter((e) => e.page === page)
      .sort((a, b) => (Math.abs(base(a) - base(b)) > 2 ? base(a) - base(b) : a.x - b.x));
    if (texts.length < 2) return;
    const lines: number[] = [];
    for (const t of texts) if (!lines.length || base(t) - lines.at(-1)! > 2) lines.push(base(t));
    const [first, ...rest] = texts;
    const left = Math.min(...texts.map((e) => e.x)),
      right = Math.max(...texts.map((e) => boxOf(e).r));
    const drop = new Set(rest.map((e) => e.id));
    commit(
      elsRef.current.flatMap((e) =>
        e.id === first.id
          ? [
              {
                ...e,
                x: left,
                align: undefined,
                text: texts.map((t) => t.text.trim()).join(" "),
                wrap: Math.ceil(right - left) + 2,
                lineHeight: lines.length > 1 ? (lines[1] - lines[0]) / first.size : undefined,
              },
            ]
          : drop.has(e.id)
            ? e.orig
              ? [{ ...e, deleted: true }]
              : []
            : [e],
      ),
    );
    setSel([first.id]);
  };

  const rotationOf = (src: number) => orderRef.current.find((s) => s.src === src)?.rotate ?? 0;
  const nudge = (du: number, dv: number) => {
    const moves = new Map<number, [number, number]>();
    for (const p of new Set(selected.map((x) => x.page))) {
      const [dx, dy] = unrotateDelta(rotationOf(p), du, dv);
      const area = inside(p);
      const group = bounds(selected.filter((x) => x.page === p).map(boxOf));
      moves.set(p, area ? confine(group, dx, dy, area) : [dx, dy]);
    }
    patch(sel, (el) => ({ x: el.x + moves.get(el.page)![0], y: el.y + moves.get(el.page)![1] }), `nudge:${sel.join()}`);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey,
        key = e.key.toLowerCase();
      if (mod && (key === "z" || key === "y")) {
        if (!isTyping(e.target)) e.preventDefault(), key === "y" || e.shiftKey ? redo() : undo();
        return;
      }
      if (mod && (key === "f" || key === "h") && file) return e.preventDefault(), setFindOpen(true);
      if (mod && (key === "b" || key === "i") && selText.length)
        return e.preventDefault(), void toggleStyle(key === "b" ? "bold" : "italic");
      if (isTyping(e.target)) return;
      if (e.key === "Escape") setSel([]), setAdding(false);
      if (mod && key === "a") return e.preventDefault(), selectAll();
      if (mod && key === "v") return void (pasteTimer.current = window.setTimeout(() => pasteCopied(), 0));
      if (!sel.length) return;
      if (mod && (key === "c" || key === "x")) return copySel(key === "x");
      if (mod && key === "d") return e.preventDefault(), duplicate();
      if (e.key === "Delete" || e.key === "Backspace") e.preventDefault(), remove(sel);
      const n = e.shiftKey ? 10 : 1;
      const d = { ArrowLeft: [-n, 0], ArrowRight: [n, 0], ArrowUp: [0, -n], ArrowDown: [0, n] }[e.key];
      if (d) e.preventDefault(), nudge(d[0], d[1]);
    };
    const onLeave = (e: BeforeUnloadEvent) => file && unsaved() && e.preventDefault();
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target) || !file) return;
      clearTimeout(pasteTimer.current);
      e.preventDefault();
      const picture = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (picture) return void insertImage(picture);
      const text = e.clipboardData?.getData("text/plain") ?? "";
      const c = clip.current;
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: everything it reads is in the list or a ref
  useEffect(() => {
    if (!file) return;
    const t = setTimeout(() => {
      if (pendingDraft.current || merged.current) return;
      if (!unsaved()) return void dropDraft(file.name);
      const list = elsRef.current.filter(changed);
      const used = new Set([...list.map((e) => e.font), hf.font]);
      saveDraft(file.name, {
        size: file.size,
        savedAt: Date.now(),
        els: list,
        pages,
        order: orderRef.current,
        hf,
        meta,
        fonts: [...fonts].filter(([k]) => used.has(k)),
        images: [...usedImages(list)],
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [file, els, order, hf, pages, fonts, meta, added]);

  const RESTORE = "Restore edits";
  const prompted = useRef(false);
  useEffect(() => {
    if (report?.action?.label === RESTORE) prompted.current = true;
    else if (prompted.current) {
      prompted.current = false;
      pendingDraft.current = null;
      if (!report && file) dropDraft(file.name);
    }
  }, [report, file]);

  useEffect(() => {
    if (!report?.ok || report.busy || report.action) return;
    const t = setTimeout(() => setReport((r) => (r === report ? null : r)), 4000);
    return () => clearTimeout(t);
  }, [report]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: open the panel when a selection starts, not on every change to it
  useEffect(() => void (sel.length && (setTab("edit"), setPanelOpen(true))), [sel.length > 0]);

  const movePage = (from: number, to: number) => {
    const o = orderRef.current;
    if (to < 0 || to >= o.length || from === to) return;
    const next = [...o];
    next.splice(to, 0, ...next.splice(from, 1));
    commitOrder(next);
  };
  const rotatePage = (at: number, by: number) =>
    commitOrder(orderRef.current.map((s, i) => (i === at ? { ...s, rotate: (s.rotate + by + 360) % 360 } : s)));
  const deletePage = (at: number) => {
    const o = orderRef.current;
    if (o.length < 2) return;
    const gone = o[at].src;
    setSel((s) => s.filter((id) => elById.get(id)?.page !== gone));
    commitOrder(o.filter((_, i) => i !== at));
  };
  const insertBlank = (after: number) => {
    const near = orderRef.current[after];
    const pg = pages[near.src];
    const [w, h] = turned(near.rotate) ? [pg.h, pg.w] : [pg.w, pg.h];
    setPages((ps) => [...ps, { w, h, rotated: false, blank: true }]);
    const next = [...orderRef.current];
    next.splice(after + 1, 0, { src: pages.length, rotate: 0 });
    commitOrder(next);
  };
  const positionOf = (src: number) => orderRef.current.findIndex((s) => s.src === src);

  const fitWidth = () => {
    const m = pagesRef.current;
    if (!m || !pages.length) return;
    const widest = Math.max(...orderRef.current.map((s) => (turned(s.rotate) ? pages[s.src].h : pages[s.src].w)));
    setScale(clampScale(Math.floor(((m.clientWidth - 64) / widest) * 20) / 20));
  };
  const zoomBy = (d: number) => setScale((s) => clampScale(Math.round((s + d) * 100) / 100));
  const zoomTo = (s: number) => setScale(clampScale(Math.round(s * 100) / 100));
  const cancelGesture = () => {
    drag.current = null;
    marquee.current = null;
    setBand(null);
    setGuides(null);
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: fit once per opened document, on small screens
  useEffect(() => {
    if (pages.length && matchMedia(NARROW).matches) fitWidth();
  }, [pages]);
  const goToPage = (p: number) =>
    pagesRef.current?.querySelector(`.page[data-page="${p}"]`)?.scrollIntoView({ block: "start" });

  const [findOpen, setFindOpen] = useState(false);
  const searchable = () => {
    const at = new Map(orderRef.current.map((s, i) => [s.src, i]));
    return elsRef.current
      .filter((e) => !e.image && !e.deleted && at.has(e.page))
      .sort((a, b) => at.get(a.page)! - at.get(b.page)! || a.y - b.y || a.x - b.x);
  };
  const find = (query: string, matchCase: boolean) => findMatches(searchable(), query, matchCase);
  const showMatch = (m: Match) => {
    const el = elById.get(m.id);
    if (!el) return;
    setSel([m.id]);
    const show = () =>
      document.querySelector(`[data-id="${CSS.escape(m.id)}"]`)?.scrollIntoView({ block: "center", inline: "nearest" });
    if (document.querySelector(`[data-id="${CSS.escape(m.id)}"]`)) show();
    else goToPage(el.page), setTimeout(show, 150);
  };
  const replaceIn = (matches: Match[], length: number, replacement: string) => {
    const byId = new Map<string, number[]>();
    for (const m of matches) byId.set(m.id, [...(byId.get(m.id) ?? []), m.at]);
    patch([...byId.keys()], (e) => ({ text: replaceMatches(e.text, byId.get(e.id)!, length, replacement) }));
    return byId.size;
  };
  const onPagesScroll = (e: UIEvent<HTMLElement>) => {
    const m = e.currentTarget,
      line = m.scrollTop + m.clientHeight / 3;
    let cur = 0;
    for (const d of m.querySelectorAll<HTMLElement>(".page")) if (d.offsetTop <= line) cur = +d.dataset.page!;
    if (cur !== currentPage) setCurrentPage(cur);
  };

  const onElDown = (e: PointerEvent, el: El) => {
    if (!e.isPrimary) return e.stopPropagation();
    if (adding || e.button !== 0) return e.button === 2 && e.stopPropagation();
    e.stopPropagation();
    const mod = e.shiftKey || e.ctrlKey || e.metaKey;
    const ids = sel.includes(el.id) ? sel : mod ? [...sel, el.id] : [el.id];
    setSel(ids);
    const start = new Map(elsRef.current.filter((x) => ids.includes(x.id)).map((x) => [x.id, { x: x.x, y: x.y }]));
    const onPage = elsRef.current.filter((o) => o.page === el.page && !o.deleted);
    const group = onPage.filter((o) => ids.includes(o.id)).map(boxOf);
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      touch: `drag:${performance.now()}`,
      start,
      page: el.page,
      box: group.length ? bounds(group, boxOf(el).base) : boxOf(el),
      others: onPage.filter((o) => !ids.includes(o.id)).map(boxOf),
      toggle: mod && sel.includes(el.id) ? el.id : undefined,
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onElMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const [rawX, rawY] = unrotateDelta(rotationOf(d.page), (e.clientX - d.x) / scale, (e.clientY - d.y) / scale);
    if (Math.abs(rawX) + Math.abs(rawY) < 2 / scale && lastTouch.current !== d.touch) return;
    const whole = e.ctrlKey || e.metaKey;
    const s = e.shiftKey
      ? { dx: rawX, dy: rawY, guides: {} as Guides }
      : whole
        ? { dx: Math.round(rawX), dy: Math.round(rawY), guides: {} as Guides }
        : prefs.snap === "1"
          ? snap(d.box, d.others, rawX, rawY, 5 / scale, pages[d.page].w)
          : { dx: rawX, dy: rawY, guides: {} as Guides };
    const area = inside(d.page);
    const [dx, dy] = area ? confine(d.box, s.dx, s.dy, area) : [s.dx, s.dy];
    const g = { x: dx === s.dx ? s.guides.x : undefined, y: dy === s.dy ? s.guides.y : undefined };
    setGuides({ page: d.page, ...g });
    const r = (n: number, exact: boolean) => (exact ? n : Math.round(n * 10) / 10);
    patch(
      [...d.start.keys()],
      (el) => ({
        x: r(d.start.get(el.id)!.x + dx, whole || g.x !== undefined || dx !== s.dx),
        y: r(d.start.get(el.id)!.y + dy, whole || g.y !== undefined || dy !== s.dy),
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

  const addTextAt = ({ page, x, y }: At) => {
    const last = elsRef.current.find((e) => e.id === sel[0] && !e.image);
    const size = last?.size ?? 11,
      area = inside(page);
    const fit = (v: number, lo: number, hi: number) => (area ? Math.max(lo, Math.min(v, hi)) : v);
    const el = newText({
      page,
      text: "",
      x: fit(Math.round(x), area?.l ?? 0, area?.r ?? 0),
      y: fit(Math.round(y), area?.t ?? 0, (area?.b ?? 0) - size * LINE_HEIGHT),
      size,
      color: last?.color ?? "#000000",
      font: last?.font ?? "Helvetica",
    });
    commit([...elsRef.current, el]);
    setSel([el.id]);
    setAdding(false);
    setTab("edit");
  };

  const pointOn = (e: { clientX: number; clientY: number; currentTarget: Element }, page: number): At => {
    const r = e.currentTarget.getBoundingClientRect();
    const [x, y] = unrotate(
      rotationOf(page),
      e.clientX - r.left,
      e.clientY - r.top,
      pages[page].w * scale,
      pages[page].h * scale,
    );
    return { page, x: x / scale, y: y / scale };
  };
  const onPageDown = (e: PointerEvent<HTMLDivElement>, page: number) => {
    if (e.button !== 0 || !e.isPrimary) return;
    const at = pointOn(e, page);
    if (adding) return e.preventDefault(), addTextAt(at);
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const boxes = elsRef.current.filter((o) => o.page === page && !o.deleted).map((o) => [o.id, boxOf(o)] as const);
    marquee.current = { ...at, base: additive ? sel : [], boxes };
    if (!additive) setSel([]);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPageMove = (e: PointerEvent<HTMLDivElement>) => {
    const m = marquee.current;
    if (!m) return;
    const { x, y } = pointOn(e, m.page);
    const box = { l: Math.min(m.x, x), r: Math.max(m.x, x), t: Math.min(m.y, y), b: Math.max(m.y, y) };
    setBand({ page: m.page, ...box });
    const hit = m.boxes
      .filter(([, b]) => b.r >= box.l && b.l <= box.r && b.b >= box.t && b.t <= box.b)
      .map(([id]) => id);
    setSel([...new Set([...m.base, ...hit])]);
  };
  const onPageUp = () => {
    marquee.current = null;
    setBand(null);
  };
  const onPageMenu = (e: RMouseEvent<HTMLDivElement>, page: number) => {
    e.preventDefault();
    const id = (e.target as HTMLElement).closest<HTMLElement>("[data-id]")?.dataset.id;
    setSel(id ? (sel.includes(id) ? sel : [id]) : []);
    setMenu({ ...pointOn(e, page), left: e.clientX, top: e.clientY });
  };

  const live = useRef<{ el: ElHandlers; page: PageHandlers }>(null!);
  live.current = {
    el: {
      down: onElDown,
      move: onElMove,
      up: endDrag,
      focusText: () => (textBox.current?.focus(), textBox.current?.select()),
      focus: (el) => sel.includes(el.id) || setSel([el.id]),
      resizeStart: (e) => {
        e.stopPropagation();
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        resizing.current = `wrap:${performance.now()}`;
      },
      resizeMove: (e, el) => {
        if (!resizing.current) return;
        const page = (e.currentTarget as HTMLElement).closest(".page")!;
        const at = pointOn({ clientX: e.clientX, clientY: e.clientY, currentTarget: page }, el.page);
        if (el.image) {
          const w = Math.max(8, Math.round(Math.min(at.x, inside(el.page)?.r ?? Infinity) - el.x));
          return patch(
            [el.id],
            { image: { ...el.image, w, h: Math.round((w * el.image.h) / el.image.w) } },
            resizing.current,
          );
        }
        const right = Math.min(at.x, inside(el.page)?.r ?? Infinity);
        const left = boxOf(el).l;
        const wrap = Math.max(el.size * 2, Math.round(right - left));
        patch([el.id], { wrap, x: left + wrap * alignShift(el.align) }, resizing.current);
      },
      resizeEnd: () => void (resizing.current = ""),
      unwrap: (id) => patch([id], { wrap: undefined }),
    },
    page: { down: onPageDown, move: onPageMove, up: onPageUp, menu: onPageMenu, add: (at) => insertBlank(at) },
  };
  const elHandlers = useMemo<ElHandlers>(
    () => ({
      down: (e, el) => live.current.el.down(e, el),
      move: (e) => live.current.el.move(e),
      up: () => live.current.el.up(),
      focusText: () => live.current.el.focusText(),
      focus: (el) => live.current.el.focus(el),
      resizeStart: (e) => live.current.el.resizeStart(e),
      resizeMove: (e, el) => live.current.el.resizeMove(e, el),
      resizeEnd: () => live.current.el.resizeEnd(),
      unwrap: (id) => live.current.el.unwrap(id),
    }),
    [],
  );
  const pageHandlers = useMemo<PageHandlers>(
    () => ({
      down: (e, p) => live.current.page.down(e, p),
      move: (e) => live.current.page.move(e),
      up: () => live.current.page.up(),
      menu: (e, p) => live.current.page.menu(e, p),
      add: (at) => live.current.page.add(at),
    }),
    [],
  );

  return {
    prefs,
    setPref,
    resetPrefs,
    theme,
    margin,
    recent,
    forget,
    reopen,
    file,
    meta,
    setMeta,
    compression,
    setCompression,
    estimate,
    checkSize,
    ats,
    checkAts,
    closeAts: () => setAts(null),
    pages,
    order,
    els,
    sel,
    setSel,
    fonts,
    scale,
    adding,
    setAdding,
    report,
    setReport,
    settingsOpen,
    setSettingsOpen,
    panelOpen,
    setPanelOpen,
    fileMenu,
    setFileMenu,
    tab,
    setTab,
    swap,
    setSwap,
    installed,
    hf,
    setHf,
    guides,
    menu,
    setMenu,
    band,
    currentPage,
    pdfInput,
    mergeInput,
    pickMerge,
    mergeFile,
    savePages,
    imageInput,
    insertImage,
    imageSrcOf,
    pagesRef,
    textBox,
    byPage,
    elById,
    hfByPage,
    editedPages,
    sourceFonts,
    previews,
    selected,
    one,
    selText,
    textIds,
    font: shared("font"),
    size: shared("size"),
    color: shared("color"),
    available,
    missing,
    families,
    installedFamilies,
    rotated: pages.some((p) => p.rotated),
    canvasStyle,
    showThumbs,
    edited: !!file && unsaved(),
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    canReset,
    bold,
    italic,
    align,
    setAlign,
    toggleStyle,
    patch,
    undo,
    redo,
    remove,
    closePdf,
    openFiles,
    pickPdf,
    newPdf,
    save: () => save(),
    swapFonts,
    applyFontToAll,
    findInstalled,
    showInstalled,
    copySel,
    pasteAt,
    duplicate,
    selectAll,
    resetSel,
    mergeSel,
    addTextAt,
    fitWidth,
    zoomBy,
    zoomTo,
    cancelGesture,
    goToPage,
    findOpen,
    setFindOpen,
    find,
    showMatch,
    replaceIn,
    movePage,
    rotatePage,
    deletePage,
    insertBlank,
    positionOf,
    rotationOf,
    onPagesScroll,
    elHandlers,
    pageHandlers,
  };
}

export type Editor = ReturnType<typeof useEditor>;
