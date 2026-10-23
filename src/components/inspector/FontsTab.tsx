import { canReadLocalFonts } from "../../lib/browser";
import type { Editor } from "../../lib/editor";
import { fontHelp } from "../../lib/pdf";
import { Button, Field, FileButton, Grid, Muted, Row, Section, Select, Tag, TextLink } from "../ui";
import "./FontsTab.css";

export function FontsTab({ editor }: { editor: Editor }) {
  const { sourceFonts, missing, swap, setSwap } = editor;
  return (
    <>
      <Section title="Fonts in this PDF">
        {!sourceFonts.length && <Muted>No text found. This might be a scanned image.</Muted>}
        <ul className="fonts">
          {sourceFonts.map((s) => {
            const ok = !missing.includes(s);
            const used = editor.els.find((e) => e.srcFont === s)!.font;
            const help = fontHelp(s);
            return (
              <li key={s}>
                <strong>{s}</strong>
                <Tag ok={ok}>{ok ? "loaded" : `edits use ${used}`}</Tag>
                {!ok && (
                  <Muted inline>
                    <TextLink href={help.googleUrl}>Find “{help.family}” on Google Fonts</TextLink>
                    {help.alternative && (
                      <>
                        {" "}
                        · or the free lookalike{" "}
                        <TextLink href={help.alternative.url}>{help.alternative.family}</TextLink>
                      </>
                    )}
                  </Muted>
                )}
              </li>
            );
          })}
        </ul>
        <Row>
          <FileButton accept=".ttf,.otf" multiple onFiles={(files) => editor.openFiles(files)}>
            Load font file…
          </FileButton>
          {canReadLocalFonts() && missing.length > 0 && (
            <Button onClick={() => editor.findInstalled(missing)}>Find on this PC</Button>
          )}
        </Row>
        <Muted>
          Only text you change is redrawn. Untouched text keeps its original font. On Windows, installed fonts are in
          C:\Windows\Fonts.
        </Muted>
      </Section>

      <Section title="Change font">
        <Grid>
          <Field label="Font">
            <Select
              value={swap.family}
              onChange={(e) => setSwap({ ...swap, family: e.target.value })}
              groups={[
                { label: "Loaded and built-in", options: editor.families },
                { label: "Installed on this PC", options: editor.installedFamilies },
              ]}
            />
          </Field>
          <Field label="Apply to">
            <Select
              value={swap.scope}
              onChange={(e) => setSwap({ ...swap, scope: e.target.value })}
              options={[["all", "All pages"], ...editor.pages.map((_, i) => [`${i}`, `Page ${i + 1}`] as const)]}
            />
          </Field>
        </Grid>
        <Row>
          <Button onClick={editor.swapFonts}>Change all text to {swap.family}</Button>
        </Row>
        {canReadLocalFonts() && !editor.installed.length && (
          <TextLink onClick={editor.showInstalled}>Show fonts installed on this PC</TextLink>
        )}
        <Muted>
          Bold and italic are kept when the font has those styles. Load each style's file (e.g. Arial and Arial Bold)
          for an exact match. All of that text gets redrawn; Ctrl+Z undoes it.
        </Muted>
      </Section>
    </>
  );
}
