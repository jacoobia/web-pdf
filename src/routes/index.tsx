import { AppHeader } from "../components/AppHeader";
import { AppShell, Workspace } from "../components/AppShell";
import { AtsDialog } from "../components/AtsDialog";
import { ContextMenu } from "../components/ContextMenu";
import { FindBar } from "../components/FindBar";
import { Inspector } from "../components/Inspector";
import { MergeDialog } from "../components/MergeDialog";
import { PageCanvas } from "../components/PageCanvas";
import { PageRail } from "../components/PageRail";
import { Settings } from "../components/Settings";
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
      {report && <Toast {...report} onDismiss={() => editor.setReport(null)} />}
      {editor.settingsOpen && (
        <Settings
          prefs={editor.prefs}
          set={editor.setPref}
          onReset={editor.resetPrefs}
          onClose={() => editor.setSettingsOpen(false)}
        />
      )}
    </AppShell>
  );
}
