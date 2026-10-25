import { useState } from "react";
import { version } from "../../package.json";
import { ACCENTS, isHex, type Prefs, type SetPref } from "../lib/prefs";
import { REPO_URL } from "./EditorTools";
import {
  Button,
  ButtonLink,
  Dialog,
  Icon,
  List,
  NumberInput,
  Segmented,
  Setting,
  SettingGroup,
  Swatches,
  Switch,
  TextInput,
  TextLink,
} from "./ui";
import "./Settings.css";

type Section = "preferences" | "about";

export function Settings({
  prefs,
  set,
  onReset,
  onClose,
}: {
  prefs: Prefs;
  set: SetPref;
  onReset: () => void;
  onClose: () => void;
}) {
  const [section, setSection] = useState<Section>("preferences");
  return (
    <Dialog
      title="Settings"
      onClose={onClose}
      bodyClass={section === "about" ? "about" : undefined}
      tabs={
        <Segmented
          role="tab"
          label="Settings section"
          value={section}
          onChange={setSection}
          options={[
            ["preferences", "Preferences"],
            ["about", "About"],
          ]}
        />
      }
      footer={
        <>
          {section === "preferences" && (
            <Button variant="ghost" onClick={onReset}>
              Reset to defaults
            </Button>
          )}
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      {section === "about" ? <About /> : <Preferences prefs={prefs} set={set} />}
    </Dialog>
  );
}

function Preferences({ prefs, set }: { prefs: Prefs; set: SetPref }) {
  const pt = +prefs.marginPt || 0;
  return (
    <>
      <SettingGroup title="Appearance">
        <Setting title="Theme" description="Also switchable from the header.">
          <Segmented
            label="Theme"
            value={prefs.theme}
            onChange={(v) => set("theme", v)}
            options={[
              ["system", "System"],
              ["light", "Light"],
              ["dark", "Dark"],
            ]}
          />
        </Setting>
        <Setting
          title="Interface style"
          description="Toolbar keeps a docked sidebar. Canvas uses a floating panel over the pages."
        >
          <Segmented
            label="Interface style"
            value={prefs.uiStyle}
            onChange={(v) => set("uiStyle", v)}
            options={[
              ["toolbar", "Toolbar"],
              ["canvas", "Canvas"],
            ]}
          />
        </Setting>
        <Setting title="Accent colour" description="Used for the Save button, selection and focus.">
          <Swatches label="Accent colour" value={prefs.accent} options={ACCENTS} onChange={(v) => set("accent", v)} />
        </Setting>
        <div className="accent-preview" aria-hidden="true">
          <span className="btn primary">Save</span>
          <span className="switch on">
            <span />
          </span>
          <span className="preview-sel">Selected text</span>
          <TextInput
            className="hex"
            aria-label="Accent hex value"
            defaultValue={prefs.accent}
            key={prefs.accent}
            onChange={(e) => isHex(e.target.value) && set("accent", e.target.value)}
          />
        </div>
      </SettingGroup>
      <SettingGroup title="Layout">
        <Setting title="Page thumbnails" description="A column of small pages for moving around and reordering.">
          <Switch
            label="Page thumbnails"
            checked={prefs.thumbs === "1"}
            onChange={(v) => set("thumbs", v ? "1" : "0")}
          />
        </Setting>
        <Setting title="Panel side" description="Which side the sidebar or floating panel sits on.">
          <Segmented
            label="Panel side"
            value={prefs.side}
            onChange={(v) => set("side", v)}
            options={[
              ["left", "Left"],
              ["right", "Right"],
            ]}
          />
        </Setting>
      </SettingGroup>
      <SettingGroup title="Editing">
        <Setting title="Snap to other text" description="Hold Shift while dragging to move freely.">
          <Switch
            label="Snap to other text"
            checked={prefs.snap === "1"}
            onChange={(v) => set("snap", v ? "1" : "0")}
          />
        </Setting>
        <Setting
          title="Keep inside the margin"
          description="Dragging, arrow keys and new text stop at the dashed line."
        >
          <Switch
            label="Keep inside the margin"
            checked={prefs.marginOn === "1"}
            onChange={(v) => set("marginOn", v ? "1" : "0")}
          />
        </Setting>
        <Setting title="Margin size" description={`${(pt / 72).toFixed(2)} in, ${((pt / 72) * 25.4).toFixed(1)} mm`}>
          <NumberInput
            unit="pt"
            min="0"
            step="1"
            aria-label="Margin size in points"
            value={prefs.marginPt}
            onChange={(e) => set("marginPt", e.target.value)}
          />
        </Setting>
      </SettingGroup>
    </>
  );
}

const CREDITS = [
  <>
    <TextLink href="https://mupdf.com">MuPDF</TextLink> reads, renders and removes text (AGPL-3.0)
  </>,
  <>
    <TextLink href="https://pdf-lib.js.org">pdf-lib</TextLink> writes the new text and fonts (MIT)
  </>,
  <>
    <TextLink href="https://github.com/IBM/plex">IBM Plex Sans</TextLink> is the interface font (SIL Open Font License)
  </>,
];

const About = () => (
  <>
    <div className="about-title">
      <h3>Web PDF</h3>
      <span>Version {version}</span>
    </div>
    <p>I couldn't find a free, easy-to-use PDF editor online to edit my CV with, so I quickly vibe coded one.</p>
    <p>Everything runs in your browser. Your PDFs are never uploaded anywhere.</p>
    <p>It's open source under the AGPL-3.0 licence, so you can read, change and share the code.</p>
    <ButtonLink className="source-btn" href={REPO_URL}>
      <Icon name="github" /> Source code on GitHub
    </ButtonLink>
    <div className="credits-block">
      <h4>Built with</h4>
      <List variant="muted" items={CREDITS} />
    </div>
  </>
);
