import type { Editor } from "../lib/editor";
import { Button, Dialog, List, Muted, Note, Pre, Spinner } from "./ui";
import "./AtsDialog.css";

export function AtsDialog({ editor }: { editor: Editor }) {
  const { ats } = editor;
  if (!ats) return null;
  const report = ats.report;
  return (
    <Dialog
      title="ATS check"
      onClose={editor.closeAts}
      bodyClass="ats"
      footer={
        <Button variant="primary" onClick={editor.closeAts}>
          Done
        </Button>
      }
    >
      {!report ? (
        <p className="ats-busy">
          <Spinner /> Saving a copy in memory and reading it back…
        </p>
      ) : (
        <>
          {report.issues.length ? (
            <Note>
              <List items={report.issues} />
            </Note>
          ) : (
            <Note ok>
              <p>No problems found. All text can be selected and reads back cleanly.</p>
            </Note>
          )}
          <Muted>This is the text a parser gets from the saved file, in the order it reads it.</Muted>
          {report.pages.map((text, i) => (
            <section key={`${i}-${text.length}`} className="ats-page">
              <h3>Page {i + 1}</h3>
              <Pre>{text || "No text on this page."}</Pre>
            </section>
          ))}
        </>
      )}
    </Dialog>
  );
}
