import type { Editor } from "../../lib/editor";
import { Checkbox, ColorInput, Field, Grid, Muted, NumberInput, Section, Select, TextInput, TextLink } from "../ui";

const SLOTS = ["Left", "Centre", "Right"];

export function PageTab({ editor }: { editor: Editor }) {
  const { hf, setHf, margin } = editor;
  return (
    <>
      <Section title="Header & footer">
        {(["header", "footer"] as const).map((row) => (
          <Grid key={row} cols={3}>
            {SLOTS.map((slot, i) => (
              <Field key={slot} label={`${row === "header" ? "Header" : "Footer"} ${slot.toLowerCase()}`}>
                <TextInput
                  value={hf[row][i]}
                  onChange={(e) => setHf({ ...hf, [row]: hf[row].map((t, j) => (j === i ? e.target.value : t)) })}
                />
              </Field>
            ))}
          </Grid>
        ))}
        <Grid>
          <Field label="Font" wide>
            <Select
              value={hf.font}
              options={editor.available}
              onChange={(e) => setHf({ ...hf, font: e.target.value })}
            />
          </Field>
          <Field label="Size">
            <NumberInput
              step="0.5"
              min="1"
              value={hf.size}
              onChange={(e) => +e.target.value > 0 && setHf({ ...hf, size: +e.target.value })}
            />
          </Field>
          <Field label="Colour">
            <ColorInput value={hf.color} onChange={(e) => setHf({ ...hf, color: e.target.value })} />
          </Field>
          <Field label="From edge (pt)">
            <NumberInput
              step="1"
              min="0"
              value={hf.margin}
              onChange={(e) => e.target.value !== "" && setHf({ ...hf, margin: +e.target.value })}
            />
          </Field>
          <Checkbox
            label="Skip first page"
            checked={hf.skipFirst}
            onChange={(e) => setHf({ ...hf, skipFirst: e.target.checked })}
          />
        </Grid>
        <Muted>
          Shown on every page. Use {"{page}"} and {"{pages}"} for page numbers, e.g. Page {"{page}"} of {"{pages}"}.
        </Muted>
      </Section>
      <Section title="Margins">
        <Muted>
          {margin === null ? "Not enforced." : `Items are kept ${margin} pt from the edge.`}{" "}
          <TextLink onClick={() => editor.setSettingsOpen(true)}>Change in Settings</TextLink>
        </Muted>
      </Section>
    </>
  );
}
