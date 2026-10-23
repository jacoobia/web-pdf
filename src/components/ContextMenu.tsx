import type { Editor } from "../lib/editor";
import { Menu } from "./ui";

export function ContextMenu({ editor }: { editor: Editor }) {
  const { menu, selected, sel } = editor;
  if (!menu) return null;
  const has = selected.length > 0;
  const at = { page: menu.page, x: menu.x, y: menu.y };
  return (
    <Menu
      at={menu}
      onClose={() => editor.setMenu(null)}
      items={[
        { label: "Cut", shortcut: "Ctrl+X", onSelect: () => editor.copySel(true), disabled: !has },
        { label: "Copy", shortcut: "Ctrl+C", onSelect: () => editor.copySel(), disabled: !has },
        { label: "Paste here", shortcut: "Ctrl+V", onSelect: () => editor.pasteAt(at) },
        { label: "Duplicate", shortcut: "Ctrl+D", onSelect: editor.duplicate, disabled: !has },
        "separator",
        { label: "Merge into one text box", onSelect: editor.mergeSel, disabled: editor.selText.length < 2 },
        { label: "Reset to original", onSelect: editor.resetSel, disabled: !editor.canReset },
        "separator",
        { label: "Select all", shortcut: "Ctrl+A", onSelect: editor.selectAll },
        { label: "Add text here", onSelect: () => editor.addTextAt(at) },
        "separator",
        { label: "Delete", shortcut: "Del", onSelect: () => editor.remove(sel), disabled: !has, danger: true },
      ]}
    />
  );
}
