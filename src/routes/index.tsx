import { AppHeader } from "../components/AppHeader";
import { AppShell, Workspace } from "../components/AppShell";
import { AtsDialog } from "../components/AtsDialog";
import { ContextMenu } from "../components/ContextMenu";
import { FindBar } from "../components/FindBar";
import { Guide } from "../components/Guide";
import { Inspector } from "../components/Inspector";
import { MergeDialog } from "../components/MergeDialog";
import { PageCanvas } from "../components/PageCanvas";
import { PageRail } from "../components/PageRail";
import { Settings } from "../components/Settings";
import { SignatureDialog } from "../components/SignatureDialog";
import { UnsavedDialog } from "../components/UnsavedDialog";
import { Toast } from "../components/ui";
import { useEditor } from "../lib/editor";

export default function EditorRoute() {
  const editor = useEditor();
  const { file, canvasStyle, report } = editor;
  return (
    <AppShell editor={editor}>
      <AppHeader editor={editor} />
      {editor.showThumbs && file && <PageRail editor={editor} />}
      <Workspace>
        <PageCanvas editor={editor} />
        {file && editor.findOpen && <FindBar editor={editor} />}
        {canvasStyle && file && <Inspector editor={editor} />}
      </Workspace>
      {!canvasStyle && file && <Inspector editor={editor} />}
      <ContextMenu editor={editor} />
      <AtsDialog editor={editor} />
      <MergeDialog editor={editor} />
      <SignatureDialog editor={editor} />
      <UnsavedDialog editor={editor} />
      {report && <Toast {...report} onDismiss={() => editor.setReport(null)} />}
      {editor.guide && <Guide topic={editor.guide} onClose={() => editor.setGuide(null)} />}
      {editor.settingsOpen && (
        <Settings
          prefs={editor.prefs}
          set={editor.setPref}
          onReset={editor.resetPrefs}
          onClear={editor.clearStored}
          onClose={() => editor.setSettingsOpen(false)}
        />
      )}
    </AppShell>
  );
}
