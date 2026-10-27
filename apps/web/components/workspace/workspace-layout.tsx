"use client";

import { useEffect } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Sidebar } from "./sidebar";
import { LatexEditor } from "./editor/latex-editor";
import { LatexTools } from "./editor/latex-tools";
import { ResearchTools } from "./editor/research-tools";
import { PdfPreview } from "./preview/pdf-preview";
import { BeamerPanel } from "./beamer-panel";
import { LeanInfoview } from "./lean-infoview";
import { LeanPanel } from "./lean-panel";
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
import { isLeanFile } from "@/lib/lean";
import { useDevFeatureFlag } from "@/stores/dev-panel-store";

export function WorkspaceLayout() {
  useProjectInit();
  useAutoCompile();

  const leanLakeEnabled = useDevFeatureFlag("leanLake");
  const projectId = useDocumentStore((s) => s.projectId);
  const files = useDocumentStore((s) => s.files);
  const activeFileId = useDocumentStore((s) => s.activeFileId);
  const isLeanInfoviewOpen = useDocumentStore((s) => s.isLeanInfoviewOpen);
  const leanInfoviewDock = useDocumentStore((s) => s.leanInfoviewDock);
  const setLeanInfoviewOpen = useDocumentStore((s) => s.setLeanInfoviewOpen);
  const isSyncOpen = useDocumentStore((s) => s.isSyncOpen);
  const setSyncOpen = useDocumentStore((s) => s.setSyncOpen);

  useProjectSync(projectId ?? "");

  const activeFile = files.find((file) => file.id === activeFileId);
  const isLeanActive = activeFile ? isLeanFile(activeFile) : false;
  const showLeanInfoview = isLeanActive && isLeanInfoviewOpen;

  useEffect(() => {
    if (isLeanActive) setLeanInfoviewOpen(true);
  }, [activeFileId, isLeanActive, setLeanInfoviewOpen]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <WorkspaceTopBar />
      <LatexTools />
      <ResearchTools />
      <BeamerPanel />
      {leanLakeEnabled && <LeanPanel />}
      <CommentsPanel />
      <LiteraturePanel />
      <ProjectInspector />
      <SubmissionPanel />
      <SyncDialog open={isSyncOpen} onOpenChange={setSyncOpen} />
      <TikzStudio />

      <PanelGroup
        key={showLeanInfoview ? `lean-${leanInfoviewDock}` : "standard"}
        direction="horizontal"
        className="min-h-0 flex-1"
      >
        <Panel defaultSize={16} minSize={11} maxSize={26}>
          <Sidebar />
        </Panel>

        <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-primary/50" />

        <Panel defaultSize={showLeanInfoview ? 84 : 42} minSize={25}>
          {showLeanInfoview ? (
            <div className="flex h-full min-h-0 min-w-0">
              {leanInfoviewDock === "left" && (
                <div className="w-[clamp(260px,30vw,360px)] shrink-0 border-hairline border-r">
                  <LeanInfoview />
                </div>
              )}
              <div className="min-h-0 min-w-0 flex-1">
                <LatexEditor />
              </div>
              {leanInfoviewDock === "right" && (
                <div className="w-[clamp(260px,30vw,360px)] shrink-0 border-hairline border-l">
                  <LeanInfoview />
                </div>
              )}
            </div>
          ) : (
            <LatexEditor />
          )}
        </Panel>

        {!showLeanInfoview && (
          <>
            <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-primary/50" />

            <Panel defaultSize={42} minSize={25}>
              <PdfPreview />
            </Panel>
          </>
        )}
      </PanelGroup>
    </div>
  );
}
