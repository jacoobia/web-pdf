import type { Editor } from "../lib/editor";
import {
  HistoryTools,
  ModeTools,
  PanelToggle,
  SaveButton,
  SettingsButton,
  SourceLink,
  ThemeToggle,
  ZoomTools,
} from "./EditorTools";
import { Badge, Dot, Group, Icon, IconButton, Menu } from "./ui";
import "./AppHeader.css";

const Brand = () => <span className="brand">Web PDF</span>;

export const AppHeader = ({ editor }: { editor: Editor }) =>
  editor.canvasStyle ? <CanvasHeader editor={editor} /> : <ToolbarHeader editor={editor} />;

function ToolbarHeader({ editor }: { editor: Editor }) {
  const { file, prefs, setPref } = editor;
  const right = prefs.side === "right";
  return (
    <header className="header">
      <div className="doc">
        <Brand />
        {file && (
          <>
            <span className="vsep" />
            <span className="doc-name">{file.name}</span>
            {editor.edited && <Badge title="Edits not saved yet">Edited</Badge>}
          </>
        )}
      </div>
      {file && (
        <div className="tools">
          <Group label="File">
            <IconButton icon="open" label="Open PDF" onClick={editor.pickPdf} />
            <IconButton icon="close" label="Close PDF" onClick={editor.closePdf} />
          </Group>
          <Group label="History">
            <HistoryTools editor={editor} />
          </Group>
          <Group label="Tools">
            <ModeTools editor={editor} />
          </Group>
          <Group label="Zoom">
            <ZoomTools editor={editor} />
          </Group>
        </div>
      )}
      <div className="end">
        <Group label="View">
          {file && (
            <>
              <IconButton
                className="desktop-only"
                icon={right ? "panelRight" : "panelLeft"}
                label={right ? "Move the sidebar to the left" : "Move the sidebar to the right"}
                onClick={() => setPref("side", right ? "left" : "right")}
              />
              <PanelToggle editor={editor} className="mobile-only" />
            </>
          )}
          <ThemeToggle editor={editor} />
          <SettingsButton editor={editor} />
          <SourceLink />
        </Group>
        <SaveButton editor={editor} />
      </div>
    </header>
  );
}

function CanvasHeader({ editor }: { editor: Editor }) {
  const { file, fileMenu, setFileMenu } = editor;
  return (
    <header className="header slim">
      <div className="doc">
        <Brand />
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
            {editor.edited && <Dot title="Edits not saved yet" />}
          </>
        )}
      </div>
      {file && (
        <div className="tools">
          <Group label="Tools">
            <ModeTools editor={editor} />
          </Group>
          <Group label="History" plain>
            <HistoryTools editor={editor} />
          </Group>
        </div>
      )}
      <div className="end">
        <Group label="View" plain>
          {file && <PanelToggle editor={editor} />}
          <ThemeToggle editor={editor} />
          <SettingsButton editor={editor} />
          <SourceLink />
        </Group>
        <SaveButton editor={editor} />
      </div>
      {fileMenu && (
        <Menu
          className="file-menu-list"
          onClose={() => setFileMenu(false)}
          items={[
            { label: "Open PDF…", onSelect: editor.pickPdf },
            { label: "Save", onSelect: editor.save },
            "separator",
            { label: "Close", onSelect: editor.closePdf },
          ]}
        />
      )}
    </header>
  );
}
