import type { Editor } from "../lib/editor";
import type { MenuEntry } from "./ui";

export const pageActions = (editor: Editor, at: number): MenuEntry[] => [
  { label: "Rotate left", onSelect: () => editor.rotatePage(at, -90) },
  { label: "Rotate right", onSelect: () => editor.rotatePage(at, 90) },
  "separator",
  { label: "Move up", onSelect: () => editor.movePage(at, at - 1), disabled: at === 0 },
  { label: "Move down", onSelect: () => editor.movePage(at, at + 1), disabled: at === editor.order.length - 1 },
  { label: "Add blank page after", onSelect: () => editor.insertBlank(at) },
  "separator",
  { label: "Delete page", onSelect: () => editor.deletePage(at), disabled: editor.order.length < 2, danger: true },
];
