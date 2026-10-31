import { useState } from "react";
import type { Editor } from "../../lib/editor";
import { type Compression, formatBytes } from "../../lib/model";
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
import "./PageTab.css";

const SLOTS = ["Left", "Centre", "Right"];
const PLACES = ["At the start", "Before this page", "After this page", "At the end"];

export function PageTab({ editor }: { editor: Editor }) {
  const { hf, setHf, margin, order } = editor;
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
        <Field label="Merge PDFs into this one">
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
        <Field label="Save some pages as a new PDF">
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
