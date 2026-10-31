import { useState } from "react";
import type { Editor } from "../../lib/editor";
import {
  Button,
  Checkbox,
  ColorInput,
  Disclosure,
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
} from "../ui";
import "./PageTab.css";

const SLOTS = ["Left", "Centre", "Right"];
const PLACES = ["At the start", "Before this page", "After this page", "At the end"];

export function PageTab({ editor }: { editor: Editor }) {
  const { hf, setHf, order } = editor;
  const hasHf = [...hf.header, ...hf.footer].some((t) => t.trim());
  const at = Math.max(0, editor.positionOf(editor.currentPage));
  const [split, setSplit] = useState("");
  const [place, setPlace] = useState(PLACES[3]);
  const mergeAt = [0, at, at + 1, order.length][PLACES.indexOf(place)];
  const move = (to: number) => {
    const { src } = order[at];
    editor.movePage(at, to);
    requestAnimationFrame(() => editor.goToPage(src));
  };
  return (
    <>
      <Section title={`This page · ${at + 1} of ${order.length}`}>
        <Muted>The page at the top of the view.</Muted>
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
          <Button variant="ghost" tone="danger" disabled={order.length < 2} onClick={() => editor.deletePage(at)}>
            Delete page
          </Button>
        </Row>
      </Section>
      <Section title="Add pages">
        <Row>
          <Button onClick={() => editor.insertBlank(at)}>Blank page after this one</Button>
        </Row>
        <Field label="Merge a PDF">
          <div className="split-row">
            <Select
              aria-label="Where to add the pages"
              value={place}
              options={PLACES}
              onChange={(e) => setPlace(e.target.value)}
            />
            <Button onClick={() => editor.pickMerge(mergeAt)}>Merge…</Button>
          </div>
        </Field>
      </Section>
      <Disclosure title="Header & footer" open={hasHf}>
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
      </Disclosure>
      <Section title="Save some pages">
        <Field label="Pages to save as a new PDF">
          <div className="split-row">
            <TextInput
              value={split}
              placeholder={`For example 1-2, ${order.length}`}
              onChange={(e) => setSplit(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && split.trim() && editor.savePages(split)}
            />
            <Button disabled={!split.trim()} onClick={() => editor.savePages(split)}>
              Save pages
            </Button>
          </div>
        </Field>
      </Section>
    </>
  );
}
