import { errorText } from "../lib/browser";
import type { Editor } from "../lib/editor";
import { openFeedback } from "../lib/feedback";
import { Button, IconButton, IconLink } from "./ui";

export const REPO_URL = "https://github.com/jacoobia/web-pdf";

export const SourceLink = () => <IconLink icon="github" label="Source code on GitHub" href={REPO_URL} />;

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

export const FeedbackButton = ({ editor }: { editor: Editor }) => (
  <IconButton
    icon="feedback"
    label="Send feedback"
    onClick={() =>
      openFeedback(REPO_URL.replace("https://github.com/", "")).catch((err) =>
        editor.setReport({ ok: false, lines: [`Couldn't open feedback: ${errorText(err)}`] }),
      )
    }
  />
);

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
    <Button variant="primary" onClick={editor.save} title="Save a copy with your edits">
      Save
    </Button>
  );
