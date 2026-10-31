import type { Editor } from "../../lib/editor";
import { type Compression, formatBytes, META_FIELDS } from "../../lib/model";
import { Button, Checkbox, Field, Grid, List, Muted, Row, Section, Select, TextInput } from "../ui";

export function InfoTab({ editor }: { editor: Editor }) {
  if (!editor.meta) return null;
  return (
    <>
      <Section title="Details">
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
      </Section>
      <Section title="Hidden details">
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
      <Section title="File size">
        <Muted>{editor.file && `The original file is ${formatBytes(editor.file.size)}.`}</Muted>
        <Field label="Images when saving">
          <Select
            value={editor.compression}
            onChange={(e) => editor.setCompression(e.target.value as Compression)}
            options={[
              ["off", "Keep as they are"],
              ["balanced", "Balanced, up to 2000 px"],
              ["small", "Smallest, up to 1200 px"],
            ]}
          />
        </Field>
        <Row>
          <Button onClick={editor.checkSize} disabled={editor.estimate?.busy}>
            Check saved size
          </Button>
          {editor.estimate && (
            <Muted inline>
              {editor.estimate.busy
                ? "Checking…"
                : editor.estimate.compression === editor.compression
                  ? `About ${formatBytes(editor.estimate.bytes)}`
                  : "Check again for this setting"}
            </Muted>
          )}
        </Row>
        <Muted>Large images are scaled down and saved as JPEG. Text and vector graphics aren't changed.</Muted>
      </Section>
      <Section title="ATS check">
        <Muted>See your text the way applicant tracking software reads it, with anything that may trip it up.</Muted>
        <Row>
          <Button onClick={editor.checkAts}>Check how ATS reads it</Button>
        </Row>
      </Section>
    </>
  );
}
