import {
  type El,
  type HeaderFooter,
  type ImageFile,
  isDirty,
  linkChanged,
  type Meta,
  type PageInfo,
  type Slot,
} from "./model";
import { stored } from "./storage";

export type Draft = {
  size: number;
  savedAt: number;
  els: El[];
  pages: PageInfo[];
  order: Slot[];
  hf: HeaderFooter;
  fonts: [string, Uint8Array][];
  meta?: Meta | null;
  images?: [string, ImageFile][];
  base?: Uint8Array;
};

export const changed = (e: El) => !e.orig || isDirty(e) || linkChanged(e);

export const saveDraft = (name: string, d: Draft) =>
  stored("drafts", "readwrite", (s) => s.put(d, name)).catch(() => {});
export const dropDraft = (name: string) => stored("drafts", "readwrite", (s) => s.delete(name)).catch(() => {});
export const clearDrafts = () => stored("drafts", "readwrite", (s) => s.clear()).catch(() => {});
export const loadDraft = (name: string, size: number) =>
  stored<Draft | undefined>("drafts", "readonly", (s) => s.get(name))
    .then((d) => (d?.size === size ? d : undefined))
    .catch(() => undefined);

export function applyDraft(els: El[], draft: Draft) {
  const byId = new Map(draft.els.map((e) => [e.id, e]));
  return [...els.map((e) => byId.get(e.id) ?? e), ...draft.els.filter((e) => !e.orig)];
}
