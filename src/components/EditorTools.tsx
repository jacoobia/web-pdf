import { useState } from "react";
import { errorText } from "../lib/browser";
import type { Editor } from "../lib/editor";
import { openFeedback } from "../lib/feedback";
import { Button, Group, IconButton, Menu, Tooltip } from "./ui";

export const REPO_URL = "https://github.com/jacoobia/web-pdf";

export const HistoryTools = ({ editor }: { editor: Editor }) => (
  <>
    <IconButton icon="undo" label="Undo" shortcut="Ctrl+Z" onClick={editor.undo} disabled={!editor.canUndo} />
    <IconButton icon="redo" label="Redo" shortcut="Ctrl+Y" onClick={editor.redo} disabled={!editor.canRedo} />
  </>
);

export const ModeTools = ({ editor }: { editor: Editor }) => (
  <>
    <IconButton
      icon="pointer"
      label="Select"
      shortcut="Esc"
      active={!editor.adding}
      onClick={() => editor.setAdding(false)}
    />
    <IconButton
      icon="text"
      label="Add text"
      active={editor.adding}
      onClick={() => editor.setAdding(true)}
      disabled={!editor.file}
    />
    <IconButton
      icon="image"
      label="Add image"
      onClick={() => editor.imageInput.current?.click()}
      disabled={!editor.file}
    />
    <IconButton icon="sign" label="Add a signature" onClick={() => editor.sign()} disabled={!editor.file} />
  </>
);

export const ZoomTools = ({ editor }: { editor: Editor }) => (
  <>
    <IconButton icon="minus" label="Zoom out" onClick={() => editor.zoomBy(-0.25)} disabled={!editor.file} />
    <output className="zoom-level" aria-label="Zoom level">
      {Math.round(editor.scale * 100)}%
    </output>
    <IconButton icon="plus" label="Zoom in" onClick={() => editor.zoomBy(0.25)} disabled={!editor.file} />
    <IconButton icon="fit" label="Fit page width" onClick={editor.fitWidth} disabled={!editor.file} />
  </>
);

export function ThemeToggle({ editor }: { editor: Editor }) {
  const dark = editor.theme === "dark";
  return (
    <IconButton
      icon={dark ? "sun" : "moon"}
      label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => editor.setPref("theme", dark ? "light" : "dark")}
    />
  );
}

export const GuideButton = ({ editor }: { editor: Editor }) => (
  <IconButton icon="help" label="Guide" shortcut="?" onClick={() => editor.setGuide("open")} />
);

const sendFeedback = (editor: Editor) =>
  openFeedback(REPO_URL.replace("https://github.com/", "")).catch((err) =>
    editor.setReport({ ok: false, lines: [`Couldn't open feedback: ${errorText(err)}`] }),
  );

export const FeedbackButton = ({ editor }: { editor: Editor }) => (
  <IconButton icon="feedback" label="Send feedback" onClick={() => sendFeedback(editor)} />
);

// On phones the view controls and find share one menu, so the header fits on a single row.
export function MoreMenu({ editor }: { editor: Editor }) {
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const dark = editor.theme === "dark";
  return (
    <>
      <Group label="More">
        <IconButton
          icon="more"
          label="More"
          aria-haspopup="menu"
          aria-expanded={!!at}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setAt({ left: r.right - 232, top: r.bottom + 6 });
          }}
        />
      </Group>
      {at && (
        <Menu
          at={at}
          onClose={() => setAt(null)}
          items={[
            { label: "Find and replace", onSelect: () => editor.setFindOpen(true) },
            {
              label: editor.panelOpen ? "Hide the panel" : "Show the panel",
              onSelect: () => editor.setPanelOpen(!editor.panelOpen),
            },
            "separator",
            {
              label: dark ? "Switch to light theme" : "Switch to dark theme",
              onSelect: () => editor.setPref("theme", dark ? "light" : "dark"),
            },
            { label: "Guide", shortcut: "?", onSelect: () => editor.setGuide("open") },
            { label: "Settings", onSelect: () => editor.setSettingsOpen(true) },
            { label: "Send feedback", onSelect: () => sendFeedback(editor) },
          ]}
        />
      )}
    </>
  );
}

export function ThumbsToggle({ editor }: { editor: Editor }) {
  const on = editor.showThumbs;
  return (
    <IconButton
      className="desktop-only"
      icon="thumbnails"
      label={on ? "Hide page thumbnails" : "Show page thumbnails"}
      active={on}
      onClick={() => editor.setPref("thumbs", on ? "0" : "1")}
    />
  );
}

export const DeleteButton = ({ editor }: { editor: Editor }) => (
  <IconButton
    icon="trash"
    label="Delete the selection"
    shortcut="Del"
    disabled={!editor.sel.length}
    onClick={() => editor.remove(editor.sel)}
  />
);

export const FindButton = ({ editor }: { editor: Editor }) => (
  <IconButton icon="search" label="Find and replace" shortcut="Ctrl+F" onClick={() => editor.setFindOpen(true)} />
);

export const SettingsButton = ({ editor }: { editor: Editor }) => (
  <IconButton icon="settings" label="Settings" onClick={() => editor.setSettingsOpen(true)} />
);

export const PanelToggle = ({ editor, className }: { editor: Editor; className?: string }) => (
  <IconButton
    className={className}
    icon={editor.prefs.side === "left" ? "panelLeft" : "panelRight"}
    label={editor.panelOpen ? "Hide the panel" : "Show the panel"}
    active={editor.panelOpen}
    onClick={() => editor.setPanelOpen(!editor.panelOpen)}
  />
);

export const SaveButton = ({ editor }: { editor: Editor }) =>
  editor.file && (
    <Tooltip text="Save a copy with your edits">
      <Button variant="primary" onClick={editor.save}>
        Save
      </Button>
    </Tooltip>
  );
