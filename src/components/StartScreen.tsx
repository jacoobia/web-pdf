import { type DragEvent, useId, useState } from "react";
import { cx } from "../lib/cx";
import type { Editor } from "../lib/editor";
import { openedAt, type Recent } from "../lib/recent";
import { Button, Icon, type IconName, Tooltip } from "./ui";
import "./StartScreen.css";

export function StartScreen({ editor }: { editor: Editor }) {
  const privacy = useId();
  const [over, setOver] = useState(false);
  const isFile = (e: DragEvent) => e.dataTransfer.types.includes("Files");
  return (
    <div className="start">
      <h1>Open or start a PDF</h1>
      <button
        type="button"
        className={cx("drop", over && "over")}
        onClick={editor.pickPdf}
        onDragEnter={(e) => isFile(e) && setOver(true)}
        onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver(false)}
        onDrop={() => setOver(false)}
        aria-describedby={privacy}
      >
        <span className="drop-badge">
          <Icon name="fileUp" size={26} />
        </span>
        <span className="drop-title">
          {over ? (
            "Drop to open"
          ) : (
            <>
              <span className="pointer-fine">Drop a PDF here</span>
              <span className="pointer-coarse">Choose a PDF</span>
            </>
          )}
        </span>
        {!over && <span className="drop-hint pointer-fine">or click to choose one</span>}
        <span className="drop-privacy" id={privacy}>
          <Icon name="lock" size={13} />
          Opened on this device. Nothing is uploaded.
        </span>
      </button>
      <div className="start-options">
        <StartOption icon="plus" title="New PDF" detail="Start from an empty page" onClick={editor.newPdf} />
        <StartOption
          icon="layers"
          title="Merge PDFs"
          detail="Join several files, in your order"
          onClick={() => editor.setMergeList([])}
        />
      </div>
      {editor.recent.length > 0 && (
        <RecentFiles
          recent={editor.recent}
          onOpen={editor.reopen}
          onForget={editor.forget}
          onForgetAll={editor.forgetAll}
        />
      )}
    </div>
  );
}

const StartOption = ({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: IconName;
  title: string;
  detail: string;
  onClick: () => void;
}) => (
  <button type="button" className="start-option" onClick={onClick}>
    <span className="start-option-icon">
      <Icon name={icon} size={18} />
    </span>
    <span className="start-option-text">
      <span className="start-option-title">{title}</span>
      <span className="start-option-detail">{detail}</span>
    </span>
  </button>
);

function RecentFiles({
  recent,
  onOpen,
  onForget,
  onForgetAll,
}: {
  recent: Recent[];
  onOpen: (r: Recent) => void;
  onForget: (name: string) => void;
  onForgetAll: () => void;
}) {
  const [sure, setSure] = useState(false);
  return (
    <section className="recent" aria-label="Recently opened">
      <div className="recent-head">
        <h2>Recently opened</h2>
        <Button
          size="small"
          variant="ghost"
          tone={sure ? "danger" : undefined}
          onClick={() => (sure ? onForgetAll() : setSure(true))}
          onBlur={() => setSure(false)}
        >
          {sure ? "Clear all" : "Clear list"}
        </Button>
      </div>
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
