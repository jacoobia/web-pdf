import type { Editor, Tab } from "../lib/editor";
import { beginMorph, morphClose, settle } from "./dockMorph";
import { EditTab } from "./inspector/EditTab";
import { FontsTab } from "./inspector/FontsTab";
import { InfoTab } from "./inspector/InfoTab";
import { PageTab } from "./inspector/PageTab";
import { Panel, Segmented, SheetHandle } from "./ui";
import "./Inspector.css";

const TABS = [
  ["edit", "Edit"],
  ["fonts", "Fonts"],
  ["page", "Pages"],
  ["info", "Document"],
] as const satisfies readonly (readonly [Tab, string])[];

export function Inspector({ editor }: { editor: Editor }) {
  const { tab, setTab, panelOpen } = editor;
  return (
    <Panel label="Inspector" floating={editor.canvasStyle} className={panelOpen ? undefined : "closed"}>
      <SheetHandle
        onClose={() => editor.setPanelOpen(false)}
        drag={{
          begin: beginMorph,
          move: morphClose,
          end: (close) => settle(!close, close ? () => editor.setPanelOpen(false) : undefined),
        }}
      />
      <div className="inspector-tabs">
        <Segmented role="tab" label="Panel" value={tab} options={TABS} onChange={setTab} />
      </div>
      {tab === "edit" && <EditTab editor={editor} />}
      {tab === "fonts" && <FontsTab editor={editor} />}
      {tab === "page" && <PageTab editor={editor} />}
      {tab === "info" && <InfoTab editor={editor} />}
    </Panel>
  );
}
