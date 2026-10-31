import type { Editor } from "../lib/editor";
import { Button, Dialog, Muted } from "./ui";

export function UnsavedDialog({ editor }: { editor: Editor }) {
  const { leaving } = editor;
  if (!leaving) return null;
  const closing = leaving.action === "close";
  return (
    <Dialog
      title="Unsaved edits"
      onClose={() => leaving.choose("cancel")}
      sensitive
      footer={
        <>
          <Button variant="ghost" onClick={() => leaving.choose("cancel")}>
            Cancel
          </Button>
          <Button variant="ghost" tone="danger" onClick={() => leaving.choose("discard")}>
            {closing ? "Close without saving" : "Don't save"}
          </Button>
          <Button variant="primary" onClick={() => leaving.choose("save")}>
            Save a copy
          </Button>
        </>
      }
    >
      <p>{leaving.name} has edits you haven't saved.</p>
      <Muted>
        {closing
          ? "Save a copy first, or close it and lose the edits."
          : "Save a copy first, or open the other file and lose the edits."}
      </Muted>
    </Dialog>
  );
}
