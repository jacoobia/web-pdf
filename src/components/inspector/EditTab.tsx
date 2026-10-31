import type { Editor } from "../../lib/editor";
import { LINE_HEIGHT, normaliseLink } from "../../lib/model";
import {
  Button,
  ColorInput,
  Field,
  Grid,
  Group,
  IconButton,
  Kbd,
  List,
  NumberInput,
  Row,
  Section,
  Select,
  TextArea,
  TextInput,
  TextLink,
} from "../ui";
import { FontNote } from "./FontNote";

const HINTS = [
  "Click text or an image to select it, then drag to move.",
  "Drag across empty space to select several.",
  <>
    <Kbd>Shift</Kbd> while dragging moves freely; <Kbd>Ctrl</Kbd> moves in whole points.
  </>,
  "Double-click text to edit it. Drag its right-edge handle to make it wrap.",
  "Right-click for copy, paste, duplicate, merge and more.",
];

export function EditTab({ editor }: { editor: Editor }) {
  const { selected, one, selText, textIds, font, size, color, patch } = editor;
  if (!selected.length)
    return (
      <Section title="Nothing selected">
        <List variant="muted" items={HINTS} />
        <TextLink onClick={() => editor.setGuide("edit-text")}>More in the guide</TextLink>
      </Section>
    );

  const title = one ? (one.image ? "Image" : one.orig ? "Text" : "New text") : `${selected.length} selected`;
  return (
    <Section title={title}>
      {one && !one.image && (
        <TextArea
          ref={editor.textBox}
          key={one.id}
          autoFocus={!one.orig && !one.text && editor.prefs.editText !== "page"}
          value={one.text}
          rows={Math.max(2, one.text.split("\n").length)}
          placeholder="Type your text"
          aria-label="Text"
          onChange={(e) => patch([one.id], { text: e.target.value }, `text:${one.id}`)}
        />
      )}
      {textIds.length > 0 && (
        <Row>
          <Group label="Style">
            <IconButton
              icon="bold"
              label="Bold"
              shortcut="Ctrl+B"
              active={editor.bold}
              onClick={() => editor.toggleStyle("bold")}
            />
            <IconButton
              icon="italic"
              label="Italic"
              shortcut="Ctrl+I"
              active={editor.italic}
              onClick={() => editor.toggleStyle("italic")}
            />
          </Group>
          <Group label="Alignment">
            {(
              [
                ["left", "alignLeft", "Align left"],
                ["center", "alignCenter", "Centre"],
                ["right", "alignRight", "Align right"],
              ] as const
            ).map(([a, icon, label]) => (
              <IconButton
                key={a}
                icon={icon}
                label={label}
                active={editor.align === a}
                onClick={() => editor.setAlign(a)}
              />
            ))}
          </Group>
        </Row>
      )}
      <Grid>
        {textIds.length > 0 && (
          <>
            <Field label="Font" wide>
              <Select
                value={font ?? ""}
                placeholder={font === undefined ? "(mixed)" : undefined}
                options={editor.available}
                onChange={(e) => patch(textIds, { font: e.target.value })}
              />
            </Field>
            <Field label="Size">
              <NumberInput
                step="0.5"
                min="1"
                value={size ?? ""}
                placeholder="mixed"
                onChange={(e) => +e.target.value > 0 && patch(textIds, { size: +e.target.value }, `size:${textIds}`)}
              />
            </Field>
            <Field label="Colour">
              <ColorInput
                value={color ?? "#000000"}
                onChange={(e) => patch(textIds, { color: e.target.value }, `color:${textIds}`)}
              />
            </Field>
          </>
        )}
        {one && !one.image && (
          <>
            <Field label="Width (pt)">
              <NumberInput
                step="1"
                min="1"
                value={one.wrap ?? ""}
                placeholder="Auto"
                onChange={(e) =>
                  patch(
                    [one.id],
                    { wrap: e.target.value === "" ? undefined : Math.max(1, +e.target.value) },
                    `wrap:${one.id}`,
                  )
                }
              />
            </Field>
            <Field label="Line spacing">
              <NumberInput
                step="0.05"
                min="0.5"
                value={Math.round((one.lineHeight ?? LINE_HEIGHT) * 100) / 100}
                onChange={(e) =>
                  +e.target.value > 0 && patch([one.id], { lineHeight: +e.target.value }, `lh:${one.id}`)
                }
              />
            </Field>
          </>
        )}
        {one && !one.image && (
          <Field label="Link" wide>
            <TextInput
              value={one.link ?? ""}
              placeholder="Web address or email"
              inputMode="url"
              onChange={(e) => patch([one.id], { link: e.target.value || undefined }, `link:${one.id}`)}
              onBlur={(e) => patch([one.id], { link: normaliseLink(e.target.value) }, `link:${one.id}`)}
            />
          </Field>
        )}
        {one &&
          (["x", "y"] as const).map((k) => (
            <Field key={k} label={`${k.toUpperCase()} (pt)`}>
              <NumberInput
                step="1"
                value={Math.round(one[k] * 10) / 10}
                onChange={(e) => e.target.value !== "" && patch([one.id], { [k]: +e.target.value }, k + one.id)}
              />
            </Field>
          ))}
      </Grid>
      {one?.srcFont && (
        <FontNote
          el={one}
          loaded={!editor.missing.includes(one.srcFont)}
          onUseForAll={() => editor.applyFontToAll(one)}
        />
      )}
      <Row>
        {selText.length > 1 && <Button onClick={editor.mergeSel}>Merge into one text box</Button>}
        {editor.canReset && <Button onClick={editor.resetSel}>Reset to original</Button>}
        <Button variant="ghost" tone="danger" onClick={() => editor.remove(editor.sel)}>
          Delete
        </Button>
      </Row>
    </Section>
  );
}
