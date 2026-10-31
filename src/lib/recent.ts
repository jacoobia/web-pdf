import { useState } from "react";
import { stored, unstore } from "./storage";

export type Recent = { name: string; openedAt: number; handle: boolean; copy?: boolean };

const LIMIT = 8;
const COPY_LIMIT = 50 * 1024 * 1024;

const read = (): Recent[] => {
  try {
    const list: Recent[] = JSON.parse(localStorage.getItem("recent") ?? "[]");
    return list.filter((r) => typeof r?.name === "string" && r.name.trim());
  } catch {
    return [];
  }
};

export const openedAt = (t: number) =>
  new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

type Permissions = { queryPermission(o: object): Promise<string>; requestPermission(o: object): Promise<string> };

async function liveFile(r: Recent) {
  if (!r.handle) return;
  const h = await stored<FileSystemFileHandle | undefined>("handles", "readonly", (s) => s.get(r.name));
  const perm = h as unknown as Permissions | undefined;
  if (!h || !perm) return;
  const mode = { mode: "read" };
  if ((await perm.queryPermission(mode)) !== "granted" && (await perm.requestPermission(mode)) !== "granted") return;
  const file = await h.getFile();
  await file.slice(0, 1).arrayBuffer();
  return { file, handle: h };
}

async function savedCopy(r: Recent) {
  if (!r.copy) return;
  const blob = await stored<Blob | undefined>("files", "readonly", (s) => s.get(r.name));
  return blob && new File([blob], r.name, { type: "application/pdf" });
}

export function useRecent() {
  const [recent, setRecent] = useState(read);
  const save = (list: Recent[]) => {
    setRecent(list);
    try {
      localStorage.setItem("recent", JSON.stringify(list));
    } catch {}
  };

  const remember = (name: string, handle?: FileSystemFileHandle, file?: File) => {
    if (!name?.trim()) return;
    const old = recent.find((r) => r.name === name);
    const copy = !!file && file.size <= COPY_LIMIT;
    const next = [
      { name, openedAt: Date.now(), handle: !!handle || !!old?.handle, copy: copy || !!old?.copy },
      ...recent.filter((r) => r !== old),
    ];
    for (const gone of next.slice(LIMIT)) unstore(gone.name);
    save(next.slice(0, LIMIT));
    if (handle) stored("handles", "readwrite", (s) => s.put(handle, name)).catch(() => {});
    if (copy)
      file
        .arrayBuffer()
        .then((buf) => stored("files", "readwrite", (s) => s.put(new Blob([buf], { type: "application/pdf" }), name)))
        .catch(() => {});
  };

  const forget = (name: string) => {
    save(recent.filter((r) => r.name !== name));
    unstore(name);
  };

  const load = async (r: Recent) => {
    const live = await liveFile(r).catch(() => undefined);
    if (live) return live;
    const copy = await savedCopy(r).catch(() => undefined);
    return copy && { file: copy, copy: true as const };
  };

  const forgetAll = () => {
    for (const r of recent) unstore(r.name);
    save([]);
  };

  return { recent, remember, forget, forgetAll, load };
}
