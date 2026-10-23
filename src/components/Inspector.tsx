import type { Editor, Tab } from "../lib/editor";
import { EditTab } from "./inspector/EditTab";
import { FontsTab } from "./inspector/FontsTab";
import { PageTab } from "./inspector/PageTab";
import { IconButton, Panel, Segmented } from "./ui";
import "./Inspector.css";

const TABS = [
  ["edit", "Edit"],
  ["fonts", "Fonts"],
  ["page", "Page"],
] as const satisfies readonly (readonly [Tab, string])[];

export function Inspector({ editor }: { editor: Editor }) {
  const { tab, setTab, panelOpen } = editor;
  return (
    <Panel
      label="Inspector"
      floating={editor.canvasStyle}
      className={panelOpen ? undefined : "closed"}
      data-bugdrop-mask
    >
      <div className="inspector-tabs">
        <Segmented role="tab" label="Panel" value={tab} options={TABS} onChange={setTab} />
        <IconButton
          className="mobile-only"
          icon="close"
          label="Hide the panel"
          onClick={() => editor.setPanelOpen(false)}
        />
      </div>
      {tab === "edit" && <EditTab editor={editor} />}
      {tab === "fonts" && <FontsTab editor={editor} />}
      {tab === "page" && <PageTab editor={editor} />}
    </Panel>
  );
}
