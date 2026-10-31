const STORES = ["handles", "files", "drafts"] as const;
export type Store = (typeof STORES)[number];

export const stored = <T>(name: Store, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    const open = indexedDB.open("pdf-editor", 3);
    open.onupgradeneeded = () => {
      for (const s of STORES) if (!open.result.objectStoreNames.contains(s)) open.result.createObjectStore(s);
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const req = run(open.result.transaction(name, mode).objectStore(name));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    };
  });

export const unstore = (name: string) => {
  for (const s of STORES) stored(s, "readwrite", (o) => o.delete(name)).catch(() => {});
};

export const clearStores = () => Promise.all(STORES.map((s) => stored(s, "readwrite", (o) => o.clear())));
