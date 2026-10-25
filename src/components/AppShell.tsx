import type { ReactNode } from "react";
import { droppedHandles } from "../lib/browser";
import { cx } from "../lib/cx";
import type { Editor } from "../lib/editor";
import "./AppShell.css";

export function AppShell({ editor, children }: { editor: Editor; children: ReactNode }) {
  const { file, canvasStyle, panelOpen, prefs } = editor;
  return (
    <div
      className={cx(
        "app",
        canvasStyle ? "style-canvas" : "style-toolbar",
        `side-${prefs.side}`,
        file ? "has-file" : "no-file",
        file && panelOpen && "panel-open",
      )}
      lang={prefs.spelling === "off" ? undefined : prefs.spelling}
      spellCheck={prefs.spelling !== "off"}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        editor.openFiles(e.dataTransfer.files, droppedHandles(e.dataTransfer.items));
      }}
    >
      <input
        ref={editor.pdfInput}
        type="file"
        accept=".pdf"
        hidden
        onChange={(e) => (editor.openFiles(e.target.files), (e.target.value = ""))}
      />
      {children}
    </div>
  );
}

export const Workspace = ({ children }: { children: ReactNode }) => <div className="canvas-area">{children}</div>;
