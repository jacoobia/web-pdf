import type { Editor } from "../../lib/editor";
import {
  Button,
  Checkbox,
  ColorInput,
  Field,
  Grid,
  Group,
  IconButton,
  Muted,
  NumberInput,
  Row,
  Section,
  Select,
  TextInput,
  TextLink,
} from "../ui";

const SLOTS = ["Left", "Centre", "Right"];

export function PageTab({ editor }: { editor: Editor }) {
  const { hf, setHf, margin, order } = editor;
  const at = Math.max(0, editor.positionOf(editor.currentPage));
  const move = (to: number) => {
    const { src } = order[at];
    editor.movePage(at, to);
    requestAnimationFrame(() => editor.goToPage(src));
  };
  return (
    <>
      <Section title="Pages">
        <Muted>
          Page {at + 1} of {order.length}. Changes apply to the page at the top of the view.
        </Muted>
        <Row>
          <Group label="Rotate">
            <IconButton icon="rotateLeft" label="Rotate left" onClick={() => editor.rotatePage(at, -90)} />
            <IconButton icon="rotateRight" label="Rotate right" onClick={() => editor.rotatePage(at, 90)} />
          </Group>
          <Group label="Move">
            <IconButton icon="arrowUp" label="Move page up" disabled={at === 0} onClick={() => move(at - 1)} />
            <IconButton
              icon="arrowDown"
              label="Move page down"
              disabled={at === order.length - 1}
              onClick={() => move(at + 1)}
            />
          </Group>
        </Row>
        <Row>
          <Button onClick={() => editor.insertBlank(at)}>Add blank page after</Button>
          <Button variant="ghost" tone="danger" disabled={order.length < 2} onClick={() => editor.deletePage(at)}>
            Delete page
          </Button>
        </Row>
      </Section>
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
