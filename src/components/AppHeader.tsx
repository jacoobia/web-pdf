import type { Editor } from "../lib/editor";
import {
  FeedbackButton,
  FindButton,
  GuideButton,
  HistoryTools,
  ModeTools,
  PanelToggle,
  SaveButton,
  SettingsButton,
  ThemeToggle,
  ThumbsToggle,
  ZoomTools,
} from "./EditorTools";
import { Badge, Dot, Group, Icon, IconButton, Menu } from "./ui";
import "./AppHeader.css";

const Brand = () => <span className="brand">Web PDF</span>;

export const AppHeader = ({ editor }: { editor: Editor }) =>
  editor.canvasStyle ? <CanvasHeader editor={editor} /> : <ToolbarHeader editor={editor} />;

function ToolbarHeader({ editor }: { editor: Editor }) {
  const { file } = editor;
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
            <FindButton editor={editor} />
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
              <PanelToggle editor={editor} className="mobile-only" />
              <ThumbsToggle editor={editor} />
            </>
          )}
          <ThemeToggle editor={editor} />
          <GuideButton editor={editor} />
          <SettingsButton editor={editor} />
          <FeedbackButton editor={editor} />
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
            <FindButton editor={editor} />
          </Group>
        </div>
      )}
      <div className="end">
        <Group label="View" plain>
          {file && <ThumbsToggle editor={editor} />}
          {file && <PanelToggle editor={editor} />}
          <ThemeToggle editor={editor} />
          <GuideButton editor={editor} />
          <SettingsButton editor={editor} />
          <FeedbackButton editor={editor} />
        </Group>
        <SaveButton editor={editor} />
      </div>
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
    </header>
  );
}
