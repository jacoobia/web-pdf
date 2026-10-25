import type { Editor } from "../../lib/editor";
import { META_FIELDS } from "../../lib/model";
import { Checkbox, Field, Grid, List, Muted, Section, TextInput } from "../ui";

export function InfoTab({ editor }: { editor: Editor }) {
  if (!editor.meta) return null;
  return (
    <Section title="Document info">
      <Grid>
        {META_FIELDS.map((f) => (
          <Field key={f} label={f[0].toUpperCase() + f.slice(1)} wide={f === "title" || f === "keywords"}>
            <TextInput
              value={editor.meta![f]}
              onChange={(e) => editor.setMeta({ ...editor.meta!, [f]: e.target.value })}
            />
          </Field>
        ))}
      </Grid>
      {editor.meta.hidden.length ? (
        <>
          <Muted>The file also holds details you can't see:</Muted>
          <List variant="muted" items={editor.meta.hidden} />
          <Checkbox
            label="Remove these when saving"
            checked={editor.meta.strip}
            onChange={(e) => editor.setMeta({ ...editor.meta!, strip: e.target.checked })}
          />
        </>
      ) : (
        <Muted>No other hidden details were found in this file.</Muted>
      )}
      <Muted>
        {editor.meta.strip
          ? "This copy will be saved with no hidden details."
          : "Saved copies are marked as made with Web PDF. Removing the hidden details removes this too."}
      </Muted>
    </Section>
  );
}
