export const PDF_TYPE = { description: "PDF", accept: { "application/pdf": [".pdf"] } };

export type LocalFont = { postscriptName: string; blob(): Promise<Blob> };
type PickerOptions = { suggestedName?: string; startIn?: unknown; types: (typeof PDF_TYPE)[] };

export const chromium = window as unknown as {
  queryLocalFonts(): Promise<LocalFont[]>;
  showOpenFilePicker(o: PickerOptions): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker(o: PickerOptions): Promise<FileSystemFileHandle>;
};

export const canReadLocalFonts = () => "queryLocalFonts" in window;

export const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);

export function download(bytes: Uint8Array, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

export const droppedHandles = (items: DataTransferItemList) =>
  [...items].map((i) =>
    (i as DataTransferItem & { getAsFileSystemHandle?(): Promise<FileSystemHandle | null> }).getAsFileSystemHandle?.(),
  );

export const errorText = (err: unknown) => (err as Error).message;
