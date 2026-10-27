"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  CrosshairIcon,
  FileCodeIcon,
  FolderGit2Icon,
  InfoIcon,
  ListTreeIcon,
  Loader2Icon,
  PanelLeftIcon,
  PanelRightIcon,
  RotateCcwIcon,
  TerminalIcon,
  XIcon,
} from "lucide-react";

import {
  isLeanFile,
  LEAN_PROJECT_STORAGE_KEY,
  LEAN_TOOLCHAIN_LABEL_STORAGE_KEY,
  summarizeLeanFile,
} from "@/lib/lean";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDocumentStore } from "@/stores/document-store";

type InfoviewTab = "goals" | "outline" | "messages" | "project";

interface ProofIssue {
  line: number;
  label: string;
  detail: string;
  severity: "warning" | "error";
}

const TABS: { id: InfoviewTab; label: string; icon: typeof CrosshairIcon }[] = [
  { id: "goals", label: "Goals", icon: CrosshairIcon },
  { id: "outline", label: "Outline", icon: ListTreeIcon },
  { id: "messages", label: "Messages", icon: AlertCircleIcon },
  { id: "project", label: "Project", icon: FolderGit2Icon },
];

function lineStart(content: string, line: number): number {
  const lines = content.split("\n");
  let position = 0;
  for (let index = 0; index < line - 1; index++) {
    position += (lines[index]?.length ?? 0) + 1;
  }
  return position;
}

export function LeanInfoview() {
  const files = useDocumentStore((s) => s.files);
  const activeFileId = useDocumentStore((s) => s.activeFileId);
  const requestJumpToPosition = useDocumentStore(
    (s) => s.requestJumpToPosition,
  );
  const setLeanOpen = useDocumentStore((s) => s.setLeanOpen);
  const setLeanInfoviewOpen = useDocumentStore((s) => s.setLeanInfoviewOpen);
  const leanInfoviewDock = useDocumentStore((s) => s.leanInfoviewDock);
  const setLeanInfoviewDock = useDocumentStore((s) => s.setLeanInfoviewDock);

  const [tab, setTab] = useState<InfoviewTab>("goals");
  const [projectPath, setProjectPath] = useState("");
  const [toolchainLabel, setToolchainLabel] = useState("");
  const [isRestarting, setIsRestarting] = useState(false);
  const [lastRestarted, setLastRestarted] = useState<Date | null>(null);
  const [restartCount, setRestartCount] = useState(0);
  const [analysisVersion, setAnalysisVersion] = useState(0);

  const activeFile = files.find((file) => file.id === activeFileId);
  const content = activeFile?.content ?? "";
  const summary = useMemo(
    () => (activeFile ? summarizeLeanFile(activeFile) : null),
    // analysisVersion intentionally re-runs source analysis on Restart File.
    [activeFile, analysisVersion],
  );

  useEffect(() => {
    if (!activeFile || !isLeanFile(activeFile)) return;
    setProjectPath(window.localStorage.getItem(LEAN_PROJECT_STORAGE_KEY) ?? "");
    setToolchainLabel(
      window.localStorage.getItem(LEAN_TOOLCHAIN_LABEL_STORAGE_KEY) ?? "",
    );
  }, [activeFile]);

  if (!activeFile || !isLeanFile(activeFile) || !summary) return null;

  const issues: ProofIssue[] = [
    ...summary.sorryLines.map((line) => ({
      line,
      label: "sorry",
      detail: "Incomplete proof marker",
      severity: "error" as const,
    })),
    ...summary.admitLines.map((line) => ({
      line,
      label: "admit",
      detail: "Incomplete proof marker",
      severity: "error" as const,
    })),
    ...summary.declarations
      .filter((declaration) => declaration.kind === "axiom")
      .map((declaration) => ({
        line: declaration.line,
        label: `axiom ${declaration.name}`,
        detail: "Axiom introduces an unproved assumption",
        severity: "warning" as const,
      })),
    ...summary.nativeDecideLines.map((line) => ({
      line,
      label: "native_decide",
      detail: "Trusts native evaluation in the kernel",
      severity: "warning" as const,
    })),
    ...(summary.unsafe
      ? [
          {
            line: 1,
            label: "unsafe",
            detail: "Unsafe declarations bypass some kernel checks",
            severity: "warning" as const,
          },
        ]
      : []),
    ...(summary.partial
      ? [
          {
            line: 1,
            label: "partial",
            detail: "Partial definition may not be structurally recursive",
            severity: "warning" as const,
          },
        ]
      : []),
  ].sort((a, b) => a.line - b.line);

  const jumpToLine = (line: number) => {
    requestJumpToPosition(lineStart(content, line));
  };

  const restartFile = async () => {
    if (isRestarting) return;
    setIsRestarting(true);
    setTab("goals");
    setAnalysisVersion((version) => version + 1);

    const connectedProject = window.localStorage.getItem(
      LEAN_PROJECT_STORAGE_KEY,
    );
    if (connectedProject) {
      try {
        const response = await fetch(
          `/api/lean/status?path=${encodeURIComponent(connectedProject)}`,
          { cache: "no-store" },
        );
        if (response.ok) {
          const status = (await response.json()) as {
            projectPath?: string;
          };
          if (status.projectPath) setProjectPath(status.projectPath);
        }
      } catch {
        // Local source analysis still works without the bridge.
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 420));
    setLastRestarted(new Date());
    setRestartCount((count) => count + 1);
    setIsRestarting(false);
    toast.success("Lean Infoview restarted", {
      description: `Reloaded analysis for ${activeFile.path}.`,
    });
  };

  const dock = leanInfoviewDock === "left" ? "right" : "left";
  const dockLabel = dock === "left" ? "Dock left" : "Dock right";

  return (
    <aside
      className="flex h-full min-h-0 w-full flex-col bg-card/55 text-foreground"
      aria-label="Lean Infoview"
    >
      <div className="flex shrink-0 items-center gap-2 border-hairline border-b bg-background/50 px-3 py-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-hairline bg-card text-[#5db8a6]">
          <FileCodeIcon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-[11px]">Lean Infoview</span>
            <span className="rounded border border-[#5db8a6]/30 bg-[#5db8a6]/10 px-1 py-0.5 font-mono text-[#2a8f83] text-[7px] uppercase tracking-[0.1em]">
              local
            </span>
          </div>
          <div className="truncate font-mono text-[9px] text-muted-foreground">
            {activeFile.path}
          </div>
        </div>
        <button
          type="button"
          className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
          onClick={() => setLeanInfoviewDock(dock)}
          title={dockLabel}
          aria-label={dockLabel}
        >
          {dock === "left" ? (
            <PanelLeftIcon className="size-3.5" />
          ) : (
            <PanelRightIcon className="size-3.5" />
          )}
        </button>
        <button
          type="button"
          className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
          onClick={() => setLeanInfoviewOpen(false)}
          title="Hide Lean Infoview"
          aria-label="Hide Lean Infoview"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>

      <div className="grid shrink-0 grid-cols-4 gap-px border-hairline border-b bg-border/50">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "flex items-center justify-center gap-1 bg-card/70 py-2 text-[9px] transition-colors",
                tab === item.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
              )}
            >
              <Icon className="size-3" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "goals" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-1.5">
              {[
                ["Declarations", summary.declarationCount],
                [
                  "Incomplete",
                  summary.sorryLines.length + summary.admitLines.length,
                ],
                ["Imports", summary.imports.length],
                ["Lines", summary.lineCount],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-md border border-hairline bg-background/45 px-2.5 py-2"
                >
                  <div className="font-serif text-lg leading-none">{value}</div>
                  <div className="mt-1 text-[8px] text-muted-foreground uppercase tracking-[0.1em]">
                    {label}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-hairline bg-background/40 p-3">
              <div className="flex items-center gap-1.5 font-medium text-[10px]">
                <CrosshairIcon className="size-3.5 text-[#5db8a6]" />
                Proof state
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground leading-relaxed">
                Interactive Lean goals require a Lean language server. This
                local view summarizes the active source and flags incomplete
                proof markers.
              </p>
              {issues.length === 0 ? (
                <div className="mt-2 flex items-center gap-1.5 text-[#2a8f83] text-[10px]">
                  <CheckCircle2Icon className="size-3.5" />
                  No local proof-health issues found.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setTab("messages")}
                  className="mt-2 flex items-center gap-1 text-[10px] text-primary hover:underline"
                >
                  Review {issues.length} message
                  {issues.length === 1 ? "" : "s"}
                  <ChevronRightIcon className="size-3" />
                </button>
              )}
            </div>

            {summary.imports.length > 0 && (
              <div>
                <div className="mb-1.5 text-[8px] text-muted-foreground uppercase tracking-[0.12em]">
                  Imports
                </div>
                <div className="space-y-1">
                  {summary.imports.map((item) => (
                    <div
                      key={item}
                      className="rounded border border-hairline bg-background/30 px-2 py-1 font-mono text-[9px] text-muted-foreground"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "outline" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-muted-foreground uppercase tracking-[0.12em]">
                Declarations
              </span>
              <span className="font-mono text-[8px] text-muted-foreground">
                {summary.declarations.length}
              </span>
            </div>
            {summary.namespaces.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {summary.namespaces.map((namespace) => (
                  <span
                    key={namespace}
                    className="rounded border border-hairline bg-card/60 px-1.5 py-0.5 font-mono text-[8px] text-muted-foreground"
                  >
                    {namespace}
                  </span>
                ))}
              </div>
            )}
            {summary.declarations.length === 0 ? (
              <p className="rounded-lg border border-hairline border-dashed p-3 text-[10px] text-muted-foreground">
                No declarations detected in this file.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-hairline">
                {summary.declarations.map((declaration) => (
                  <button
                    key={`${declaration.kind}-${declaration.name}-${declaration.line}`}
                    type="button"
                    onClick={() => jumpToLine(declaration.line)}
                    className="flex w-full items-center gap-2 border-hairline border-b bg-background/35 px-2.5 py-2 text-left last:border-b-0 hover:bg-background/80"
                  >
                    <span className="w-12 shrink-0 font-mono text-[8px] text-muted-foreground uppercase">
                      {declaration.kind}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[10px]">
                      {declaration.name}
                    </span>
                    <span className="shrink-0 font-mono text-[8px] text-muted-foreground">
                      {declaration.line}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "messages" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-muted-foreground uppercase tracking-[0.12em]">
                Proof health
              </span>
              <span className="font-mono text-[8px] text-muted-foreground">
                {issues.length}
              </span>
            </div>
            {issues.length === 0 ? (
              <div className="flex items-start gap-2 rounded-lg border border-[#5db8a6]/25 bg-[#5db8a6]/5 p-3 text-[#2a8f83] text-[10px] leading-relaxed">
                <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0" />
                No `sorry`, `admit`, axiom, `native_decide`, unsafe, or partial
                declarations found in this file.
              </div>
            ) : (
              issues.map((issue, index) => {
                const Icon =
                  issue.severity === "error"
                    ? AlertCircleIcon
                    : AlertTriangleIcon;
                return (
                  <button
                    key={`${issue.label}-${issue.line}-${index}`}
                    type="button"
                    onClick={() => jumpToLine(issue.line)}
                    className="flex w-full items-start gap-2 rounded-lg border border-hairline bg-background/35 p-2.5 text-left hover:border-primary/35"
                  >
                    <Icon
                      className={cn(
                        "mt-0.5 size-3.5 shrink-0",
                        issue.severity === "error"
                          ? "text-destructive"
                          : "text-[#b9822f]",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[10px]">
                        {issue.label}
                      </span>
                      <span className="mt-0.5 block text-[9px] text-muted-foreground">
                        {issue.detail} · line {issue.line}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
            <div className="flex items-start gap-2 rounded-lg border border-hairline bg-card/30 p-2.5 text-[9px] text-muted-foreground leading-relaxed">
              <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
              Local source analysis only. A clean panel is not a proof of
              compilation or kernel verification.
            </div>
          </div>
        )}

        {tab === "project" && (
          <div className="space-y-3">
            <div className="rounded-lg border border-hairline bg-background/40 p-3">
              <div className="flex items-center gap-1.5 font-medium text-[10px]">
                <FolderGit2Icon className="size-3.5 text-primary" />
                Local Lean Lake
              </div>
              {projectPath ? (
                <>
                  <div className="mt-2 break-all font-mono text-[9px] text-muted-foreground">
                    {projectPath}
                  </div>
                  {toolchainLabel && (
                    <div className="mt-1 font-mono text-[9px] text-muted-foreground/75">
                      {toolchainLabel}
                    </div>
                  )}
                </>
              ) : (
                <p className="mt-1.5 text-[10px] text-muted-foreground leading-relaxed">
                  No Lake project is selected. Open the Lean panel to discover a
                  project or enter a path.
                </p>
              )}
              <button
                type="button"
                onClick={() => setLeanOpen(true)}
                className="mt-2 flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <TerminalIcon className="size-3.5" />
                Open Lean Lake
                <ChevronRightIcon className="size-3" />
              </button>
            </div>
            <div className="rounded-lg border border-hairline bg-card/30 p-3 text-[9px] text-muted-foreground leading-relaxed">
              The Infoview is docked {leanInfoviewDock}. Use the dock button in
              the header to move it, or hide it and reopen from the workspace
              toolbar.
            </div>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-hairline border-t bg-background/35 px-3 py-1.5 text-[8px] text-muted-foreground">
        <span className="min-w-0 truncate">
          {summary.sorryLines.length + summary.admitLines.length === 0
            ? "Analysis ready"
            : `${summary.sorryLines.length + summary.admitLines.length} incomplete`}
          <span className="mx-1 text-muted-foreground/50">·</span>
          {summary.lineCount} lines
          {lastRestarted && (
            <>
              <span className="mx-1 text-muted-foreground/50">·</span>
              restarted{" "}
              {lastRestarted.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {restartCount > 1 ? ` ×${restartCount}` : ""}
            </>
          )}
        </span>
        <button
          type="button"
          onClick={() => void restartFile()}
          disabled={isRestarting}
          title="Re-analyze this file and reset the Infoview"
          className="flex h-6 shrink-0 items-center gap-1 rounded-md border border-hairline bg-card/70 px-2 text-[9px] text-foreground transition-colors hover:border-primary/35 hover:bg-background disabled:opacity-60"
          aria-label="Restart File"
        >
          {isRestarting ? (
            <Loader2Icon className="size-3 animate-spin" />
          ) : (
            <RotateCcwIcon className="size-3" />
          )}
          {isRestarting ? "Restarting..." : "Restart File"}
        </button>
      </div>
    </aside>
  );
}
