import type { Editor } from "../lib/editor";
import { openedAt, type Recent } from "../lib/recent";
import { Button, Icon, TextLink, Tooltip } from "./ui";
import "./StartScreen.css";

export const StartScreen = ({ editor }: { editor: Editor }) => (
  <div className="start">
    <div className="start-intro">
      <h1>Open or start a PDF</h1>
      <p>Everything stays on this computer. Nothing is uploaded.</p>
    </div>
    <div className="drop">
      <Icon name="open" size={20} />
      <span>Drop a PDF anywhere in the window, or</span>
      <Button variant="primary" onClick={editor.pickPdf}>
        Open PDF
      </Button>
    </div>
    <div className="start-new">
      <span>Or start from an empty page, or join several PDFs into one.</span>
      <Button onClick={editor.newPdf}>New PDF</Button>
      <Button onClick={() => editor.setMergeList([])}>Merge PDFs</Button>
    </div>
    <p className="start-guide">
      New to Web PDF? <TextLink onClick={() => editor.setGuide("open")}>Read the guide</TextLink>
    </p>
    {editor.recent.length > 0 && <RecentFiles recent={editor.recent} onOpen={editor.reopen} onForget={editor.forget} />}
  </div>
);

function RecentFiles({
  recent,
  onOpen,
  onForget,
}: {
  recent: Recent[];
  onOpen: (r: Recent) => void;
  onForget: (name: string) => void;
}) {
  return (
    <section className="recent" aria-label="Recently opened">
      <h2>Recently opened</h2>
      <ul>
        {recent.map((r) => (
          <li key={r.name}>
            <button type="button" className="recent-row" onClick={() => onOpen(r)}>
              <Icon name="file" />
              <span className="recent-text">
                <span className="recent-name">{r.name}</span>
                <span className="recent-date">
                  {openedAt(r.openedAt)}
                  {!r.handle && (r.copy ? " · opens the saved copy" : " · opens the file picker")}
                </span>
              </span>
            </button>
            <Tooltip text="Remove from list">
              <button
                type="button"
                className="recent-x"
                aria-label={`Remove ${r.name} from recent files`}
                onClick={() => onForget(r.name)}
              >
                <Icon name="close" size={14} />
              </button>
            </Tooltip>
          </li>
        ))}
      </ul>
    </section>
  );
}
