import type { Editor } from "../lib/editor";
import {
  DeleteButton,
  FeedbackButton,
  FindButton,
  GuideButton,
  HistoryTools,
  ModeTools,
  MoreMenu,
  PanelToggle,
  SaveButton,
  SettingsButton,
  ThemeToggle,
  ThumbsToggle,
  ZoomTools,
} from "./EditorTools";
import { Badge, Group, Icon, Menu } from "./ui";
import "./AppHeader.css";

export function AppHeader({ editor }: { editor: Editor }) {
  const { file, canvasStyle, fileMenu, setFileMenu } = editor;
  return (
    <header className="header">
      <div className="doc">
        <span className="brand">Web PDF</span>
        {file && (
          <>
            <span className="vsep" />
            <button
              type="button"
              className="file-menu"
              aria-haspopup="menu"
              aria-expanded={fileMenu}
              onClick={() => setFileMenu(!fileMenu)}
            >
              <span>{file.name}</span>
              <Icon name="chevron" size={14} />
            </button>
            {editor.edited && <Badge title="Edits not saved yet">Edited</Badge>}
          </>
        )}
        {fileMenu && (
          <Menu
            className="file-menu-list"
            onClose={() => setFileMenu(false)}
            items={[
              { label: "New PDF", onSelect: editor.newPdf },
              { label: "Open PDF…", onSelect: editor.pickPdf },
              { label: "Save", onSelect: editor.save },
              "separator",
              { label: "Close", onSelect: editor.closePdf },
            ]}
          />
        )}
      </div>
      {file && (
        <div className="tools">
          <Group label="Tools">
            <ModeTools editor={editor} />
          </Group>
          {!canvasStyle && (
            <Group label="Zoom">
              <ZoomTools editor={editor} />
            </Group>
          )}
          <Group label="History">
            <HistoryTools editor={editor} />
            <FindButton editor={editor} />
            <DeleteButton editor={editor} />
          </Group>
        </div>
      )}
      <div className="end">
        <Group label="View">
          {file && <ThumbsToggle editor={editor} />}
          {file && <PanelToggle editor={editor} className={canvasStyle ? undefined : "mobile-only"} />}
          <ThemeToggle editor={editor} />
          <GuideButton editor={editor} />
          <SettingsButton editor={editor} />
          <FeedbackButton editor={editor} />
        </Group>
        {file && <MoreMenu editor={editor} />}
        <SaveButton editor={editor} />
      </div>
    </header>
  );
}
