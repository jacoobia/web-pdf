import type { Editor } from "../lib/editor";
import { formatBytes } from "../lib/model";
import { Button, Dialog, FileButton, Icon, IconButton, Muted } from "./ui";
import "./MergeDialog.css";

export function MergeDialog({ editor }: { editor: Editor }) {
  const { mergeList: list, setMergeList: set } = editor;
  if (!list) return null;
  const move = (from: number, to: number) => {
    const next = [...list];
    next.splice(to, 0, ...next.splice(from, 1));
    set(next);
  };
  const add = (files: FileList | null) => set([...list, ...[...(files ?? [])].filter((f) => /\.pdf$/i.test(f.name))]);
  return (
    <Dialog
      title="Merge PDFs"
      onClose={() => set(null)}
      bodyClass="merge"
      footer={
        <>
          <Button variant="ghost" onClick={() => set(null)}>
            Cancel
          </Button>
          <Button variant="primary" disabled={list.length < 2} onClick={() => editor.combine(list)}>
            Merge
          </Button>
        </>
      }
    >
      <Muted>The pages are joined in this order into one new PDF. Your files aren't changed.</Muted>
      {list.length > 0 && (
        <ol className="merge-list">
          {list.map((f, i) => (
            <li key={`${f.name}-${f.size}-${f.lastModified}`}>
              <Icon name="file" />
              <span className="merge-name">{f.name}</span>
              <span className="merge-size">{formatBytes(f.size)}</span>
              <IconButton
                icon="arrowUp"
                label={`Move ${f.name} up`}
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
              />
              <IconButton
                icon="arrowDown"
                label={`Move ${f.name} down`}
                disabled={i === list.length - 1}
                onClick={() => move(i, i + 1)}
              />
              <IconButton icon="close" label={`Remove ${f.name}`} onClick={() => set(list.filter((_, j) => j !== i))} />
            </li>
          ))}
        </ol>
      )}
      <FileButton accept=".pdf" multiple onFiles={add}>
        Add PDFs…
      </FileButton>
    </Dialog>
  );
}
