"use client";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Sidebar } from "./sidebar";
import { LatexEditor } from "./editor/latex-editor";
import { LatexTools } from "./editor/latex-tools";
import { PdfPreview } from "./preview/pdf-preview";
import { BeamerPanel } from "./beamer-panel";
import { CommentsPanel } from "./comments-panel";
import { LiteraturePanel } from "./literature-panel";
import { ProjectInspector } from "./project-inspector";
import { SubmissionPanel } from "./submission-panel";
import { SyncDialog } from "./sync-dialog";
import { TikzStudio } from "./tikz-studio";
import { WorkspaceTopBar } from "./workspace-top-bar";
import { useAutoCompile } from "@/hooks/use-auto-compile";
import { useProjectInit } from "@/hooks/use-project-init";
import { useProjectSync } from "@/hooks/use-project-sync";
import { useDocumentStore } from "@/stores/document-store";

export function WorkspaceLayout() {
  useProjectInit();
  useAutoCompile();

  const projectId = useDocumentStore((s) => s.projectId);
  const isSyncOpen = useDocumentStore((s) => s.isSyncOpen);
  const setSyncOpen = useDocumentStore((s) => s.setSyncOpen);

  useProjectSync(projectId ?? "");

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <WorkspaceTopBar />
      <LatexTools />
      <BeamerPanel />
      <CommentsPanel />
      <LiteraturePanel />
      <ProjectInspector />
      <SubmissionPanel />
      <SyncDialog open={isSyncOpen} onOpenChange={setSyncOpen} />
      <TikzStudio />

      <PanelGroup direction="horizontal" className="min-h-0 flex-1">
        <Panel defaultSize={16} minSize={11} maxSize={26}>
          <Sidebar />
        </Panel>

        <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-primary/50" />

        <Panel defaultSize={42} minSize={25}>
          <LatexEditor />
        </Panel>

        <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-primary/50" />

        <Panel defaultSize={42} minSize={25}>
          <PdfPreview />
        </Panel>
      </PanelGroup>
    </div>
  );
}
