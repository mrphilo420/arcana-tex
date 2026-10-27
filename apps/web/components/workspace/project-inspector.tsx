"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloudIcon,
  CopyIcon,
  FileTextIcon,
  FolderKanbanIcon,
  HardDriveIcon,
  HistoryIcon,
  Loader2Icon,
  MessageSquareIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  ScrollTextIcon,
  SparklesIcon,
  Trash2Icon,
  UsersIcon,
  WrenchIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { ProjectComment, ProjectVersion } from "@/lib/storage/schema";
import type { CompileDiagnostic } from "@/lib/compile-diagnostics";
import {
  diagnosticLanguage,
  diagnosticNature,
} from "@/lib/compile-diagnostics";
import {
  fileKindForFile,
  fileKindLabel,
  isLatexRelatedFile,
} from "@/lib/file-kind";
import {
  applyAiFixPatches,
  requestAiFixes,
  type AiFixDiagnosticInput,
} from "@/lib/ai-fixes";
import type { ProjectFile } from "@/lib/project-files";
import {
  describeAutoFix,
  previewAutoFix,
  runAutoFixes,
} from "@/lib/latex-autofix";
import { loadChatMessages } from "@/lib/projects/chat-history";
import {
  createProjectVersion,
  deleteProjectVersion,
  listProjectVersions,
  renameProject,
  restoreProjectVersion,
} from "@/lib/projects/repository";
import { getSyncUserName, loadProjectSyncSettings } from "@/lib/sync/settings";
import { useChatModelStore } from "@/stores/chat-model-store";
import { useDocumentStore, type InspectorTab } from "@/stores/document-store";
import { useSyncStore } from "@/stores/sync-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const TABS: {
  id: InspectorTab;
  label: string;
  icon: typeof FolderKanbanIcon;
}[] = [
  { id: "project", label: "Project Info", icon: FolderKanbanIcon },
  { id: "versions", label: "Versions", icon: HistoryIcon },
  { id: "comments", label: "Comments", icon: MessageSquareIcon },
  { id: "logs", label: "Logs", icon: ScrollTextIcon },
];

function commentPosition(
  comment: ProjectComment,
  content: string,
): number | null {
  if (comment.selectedText) {
    const index = content.indexOf(comment.selectedText);
    if (index !== -1) return index;
  }

  const lines = content.split("\n");
  const line = Math.min(Math.max(comment.line, 1), Math.max(lines.length, 1));
  let position = 0;

  for (let i = 0; i < line - 1; i++) {
    position += (lines[i]?.length ?? 0) + 1;
  }

  return position;
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-card/55 px-3 py-2.5">
      <div className="font-medium text-[0.75rem] text-muted-foreground uppercase tracking-[0.16em]">
        {label}
      </div>
      <div className="mt-1 font-serif text-[1.5rem] leading-none tracking-[-0.02em]">
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-[0.75rem] text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileTextIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-hairline border-b py-2.5 last:border-b-0">
      <span className="flex items-center gap-2 text-muted-foreground text-xs">
        <Icon className="size-3.5" />
        {label}
      </span>
      <span className="max-w-[62%] truncate text-right font-medium text-xs">
        {value}
      </span>
    </div>
  );
}

export function ProjectInspector() {
  const isOpen = useDocumentStore((s) => s.isInspectorOpen);
  const setOpen = useDocumentStore((s) => s.setInspectorOpen);
  const tab = useDocumentStore((s) => s.inspectorTab);
  const setTab = useDocumentStore((s) => s.setInspectorTab);

  const projectId = useDocumentStore((s) => s.projectId);
  const projectName = useDocumentStore((s) => s.projectName);
  const setProjectName = useDocumentStore((s) => s.setProjectName);
  const createdAt = useDocumentStore((s) => s.createdAt);
  const files = useDocumentStore((s) => s.files);
  const activeFileId = useDocumentStore((s) => s.activeFileId);
  const mainFileId = useDocumentStore((s) => s.mainFileId);
  const compiler = useDocumentStore((s) => s.compiler);
  const comments = useDocumentStore((s) => s.comments);
  const compileLogs = useDocumentStore((s) => s.compileLogs);
  const allCompileDiagnostics = useDocumentStore((s) => s.compileDiagnostics);
  const lastCompileLog = useDocumentStore((s) => s.lastCompileLog);
  const pdfData = useDocumentStore((s) => s.pdfData);
  const compileError = useDocumentStore((s) => s.compileError);
  const clearCompileLogs = useDocumentStore((s) => s.clearCompileLogs);
  const setActiveFile = useDocumentStore((s) => s.setActiveFile);
  const requestJumpToPosition = useDocumentStore(
    (s) => s.requestJumpToPosition,
  );
  const setCommentsOpen = useDocumentStore((s) => s.setCommentsOpen);
  const toggleCommentResolved = useDocumentStore(
    (s) => s.toggleCommentResolved,
  );
  const deleteComment = useDocumentStore((s) => s.deleteComment);
  const hydrateProject = useDocumentStore((s) => s.hydrateProject);

  const syncStatus = useSyncStore((s) => s.status);
  const peers = useSyncStore((s) => s.peers);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(projectName);
  const [chatCount, setChatCount] = useState(0);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [savingVersion, setSavingVersion] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [fixingId, setFixingId] = useState<string | "all" | null>(null);
  const [aiFixingId, setAiFixingId] = useState<string | "all" | null>(null);
  const selectedModelId = useChatModelStore((s) => s.selectedModelId);
  const [expandedDiagnostics, setExpandedDiagnostics] = useState<Set<string>>(
    new Set(),
  );
  const [selectedDiagnosticId, setSelectedDiagnosticId] = useState<
    string | null
  >(null);
  const [showRawLog, setShowRawLog] = useState(false);

  const syncSettings =
    projectId && typeof window !== "undefined"
      ? loadProjectSyncSettings(projectId)
      : null;

  const mainFile = files.find((file) => file.id === mainFileId);
  const activeFile = files.find((file) => file.id === activeFileId);
  const activeKind = activeFile ? fileKindForFile(activeFile) : "other";
  const isLatexActive = activeFile ? isLatexRelatedFile(activeFile) : false;
  const compileDiagnostics = useMemo(
    () =>
      allCompileDiagnostics.filter(
        (diagnostic) => diagnosticLanguage(diagnostic) === activeKind,
      ),
    [activeKind, allCompileDiagnostics],
  );
  const openComments = comments.filter((comment) => !comment.resolved).length;
  const wordCount = useMemo(
    () =>
      files
        .filter((file) => file.type === "tex")
        .map((file) => file.content ?? "")
        .join(" ")
        .split(/\s+/)
        .filter(Boolean).length,
    [files],
  );
  const characterCount = useMemo(
    () =>
      files
        .filter((file) => file.type === "tex")
        .reduce((total, file) => total + (file.content?.length ?? 0), 0),
    [files],
  );
  const sortedComments = useMemo(
    () =>
      [...comments].sort((a, b) => {
        if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
        return b.createdAt - a.createdAt;
      }),
    [comments],
  );
  const errorCount = compileDiagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;
  const warningCount = compileDiagnostics.filter(
    (diagnostic) => diagnostic.severity === "warning",
  ).length;
  const fixBusy = fixingId !== null || aiFixingId !== null;
  const compiledWithErrors =
    Boolean(pdfData) && !compileError && errorCount > 0;
  const selectedDiagnostic =
    compileDiagnostics.find(
      (diagnostic) => diagnostic.id === selectedDiagnosticId,
    ) ?? null;
  const selectedFix = useMemo(
    () =>
      selectedDiagnostic
        ? previewAutoFix({
            files,
            mainFileId,
            diagnostics: compileDiagnostics,
            diagnosticId: selectedDiagnostic.id,
          })
        : null,
    [compileDiagnostics, files, mainFileId, selectedDiagnostic],
  );

  useEffect(() => {
    if (
      selectedDiagnosticId &&
      !compileDiagnostics.some(
        (diagnostic) => diagnostic.id === selectedDiagnosticId,
      )
    ) {
      setSelectedDiagnosticId(null);
    }
  }, [compileDiagnostics, selectedDiagnosticId]);

  const toAiDiagnostic = (
    diagnostic: CompileDiagnostic,
  ): AiFixDiagnosticInput => ({
    id: diagnostic.id,
    severity: diagnostic.severity,
    kind: diagnostic.kind,
    message: diagnostic.message,
    details: diagnostic.details,
    filePath: diagnostic.filePath ?? null,
    fileId: diagnostic.fileId ?? null,
    line: diagnostic.line ?? null,
    lineText: diagnostic.lineText ?? null,
    raw: diagnostic.raw,
    data: diagnostic.data as Record<string, unknown>,
  });

  const withFileUpdates = (
    source: ProjectFile[],
    updates: { id: string; content: string }[],
  ): ProjectFile[] => {
    const updateMap = new Map(updates.map((update) => [update.id, update]));
    return source.map((file) => {
      const update = updateMap.get(file.id);
      return update ? { ...file, content: update.content } : file;
    });
  };

  const commitFixPlan = async ({
    baseFiles,
    finalFiles,
    label,
    messages,
    warning,
  }: {
    baseFiles: ProjectFile[];
    finalFiles: ProjectFile[];
    label: string;
    messages: string[];
    warning?: string;
  }): Promise<boolean> => {
    if (!projectId) return false;

    const changed = finalFiles.filter((file) => {
      const before = baseFiles.find((candidate) => candidate.id === file.id);
      return before && file.content !== before.content;
    });

    if (changed.length === 0) return false;

    try {
      const version = await createProjectVersion({
        projectId,
        label,
        name: projectName,
        projectCreatedAt: createdAt ?? Date.now(),
        files: baseFiles,
        activeFileId: useDocumentStore.getState().activeFileId,
        mainFileId,
        compiler,
        comments,
      });

      setVersions((current) => [version, ...current].slice(0, 30));

      const store = useDocumentStore.getState();
      for (const file of changed) {
        store.updateFileContent(file.id, file.content ?? "");
      }
      store.requestCompile();

      toast.success(
        `Applied ${messages.length} fix${messages.length === 1 ? "" : "es"}`,
        {
          description: messages.slice(0, 4).join(" · "),
        },
      );
      if (warning) {
        toast.warning("Some fixes need attention", { description: warning });
      }
      return true;
    } catch (error) {
      console.error("Failed to apply fix plan", error);
      toast.error("Could not apply the fixes");
      return false;
    }
  };

  const handleAiFix = async (
    diagnosticId?: string,
    options: { warningsOnly?: boolean } = {},
  ) => {
    if (!projectId || fixBusy) return;
    if (compiledWithErrors) {
      toast.info("PDF compiled; source left unchanged", {
        description:
          "Affected lines are highlighted in the editor. Fixes are review-only while the PDF builds.",
      });
      return;
    }

    const targets = compileDiagnostics.filter((diagnostic) => {
      if (diagnosticId) return diagnostic.id === diagnosticId;
      return options.warningsOnly
        ? diagnostic.severity === "warning"
        : diagnostic.severity === "error";
    });
    if (targets.length === 0) return;

    const includesWarnings = targets.some(
      (diagnostic) => diagnostic.severity === "warning",
    );
    const scopeId = diagnosticId
      ? diagnosticId
      : options.warningsOnly
        ? "all-warnings"
        : "all";
    const versionLabel = diagnosticId
      ? targets[0]?.severity === "warning"
        ? "Before AI warning fix"
        : "Before AI fix"
      : options.warningsOnly
        ? "Before AI warnings fix"
        : "Before AI fix all";

    setAiFixingId(scopeId);
    try {
      const response = await requestAiFixes({
        model: selectedModelId,
        mode: diagnosticId ? "single" : "all",
        includeWarnings: includesWarnings,
        mainFileId,
        files: files
          .filter((file) => file.type === "tex")
          .map((file) => ({
            id: file.id,
            path: file.path,
            content: file.content ?? "",
          })),
        diagnostics: targets.slice(0, 12).map(toAiDiagnostic),
      });

      if (response.patches.length === 0) {
        toast.info("AI did not propose a safe fix", {
          description:
            response.rejected[0]?.reason ??
            response.notes ??
            "Try a different model or fix the highlighted line manually.",
        });
        return;
      }

      const applied = applyAiFixPatches(files, response.patches);
      if (applied.applied.length === 0) {
        toast.info("AI patches did not pass validation", {
          description: applied.skipped[0]?.reason,
        });
        return;
      }

      await commitFixPlan({
        baseFiles: files,
        finalFiles: applied.files,
        label: versionLabel,
        messages: applied.applied.map((patch) => `AI: ${patch.explanation}`),
        warning: response.rejected.length
          ? `${response.rejected.length} patch${response.rejected.length === 1 ? "" : "es"} rejected: ${response.rejected[0]?.reason}`
          : undefined,
      });
    } catch (error) {
      console.error("AI fix failed", error);
      toast.error("AI fix failed", {
        description:
          error instanceof Error
            ? error.message.slice(0, 240)
            : "Check the model configuration and try again.",
      });
    } finally {
      setAiFixingId(null);
    }
  };

  const handleFixAll = async () => {
    if (!projectId || fixBusy) return;
    if (compiledWithErrors) {
      toast.info("PDF compiled; source left unchanged", {
        description:
          "The affected lines are highlighted. Fixes are review-only while the PDF builds.",
      });
      return;
    }

    setFixingId("all");
    try {
      const deterministic = runAutoFixes({
        files,
        mainFileId,
        diagnostics: compileDiagnostics,
      });
      let finalFiles = withFileUpdates(files, deterministic.updates);
      const unresolved = compileDiagnostics.filter(
        (diagnostic) =>
          diagnostic.severity === "error" &&
          deterministic.skipped.some(
            (item) => item.diagnosticId === diagnostic.id,
          ),
      );

      let aiApplied = 0;
      let aiWarning: string | undefined;
      let aiError: string | undefined;

      if (unresolved.length > 0) {
        try {
          const response = await requestAiFixes({
            model: selectedModelId,
            mode: "all",
            mainFileId,
            files: finalFiles
              .filter((file) => file.type === "tex")
              .map((file) => ({
                id: file.id,
                path: file.path,
                content: file.content ?? "",
              })),
            diagnostics: unresolved.slice(0, 12).map(toAiDiagnostic),
          });

          if (response.patches.length > 0) {
            const applied = applyAiFixPatches(finalFiles, response.patches);
            finalFiles = applied.files;
            aiApplied = applied.applied.length;
          }
          if (response.rejected.length > 0) {
            aiWarning = `${response.rejected.length} AI patch${response.rejected.length === 1 ? "" : "es"} rejected: ${response.rejected[0]?.reason}`;
          }
        } catch (error) {
          aiError =
            error instanceof Error
              ? error.message.slice(0, 200)
              : "AI repair failed";
        }
      }

      const messages = [
        ...deterministic.applied,
        ...(aiApplied > 0
          ? [
              `AI applied ${aiApplied} source patch${aiApplied === 1 ? "" : "es"}`,
            ]
          : []),
      ];

      if (messages.length === 0) {
        toast.info("No safe fix was found", {
          description:
            aiError ??
            "The remaining errors need a manual repair; the affected lines are highlighted.",
        });
        return;
      }

      await commitFixPlan({
        baseFiles: files,
        finalFiles,
        label: "Before fix all",
        messages,
        warning: aiError
          ? `Deterministic fixes applied; AI repair failed: ${aiError}`
          : aiWarning,
      });
    } finally {
      setFixingId(null);
    }
  };

  const loadVersions = useCallback(async () => {
    if (!projectId) return;
    setVersionsLoading(true);
    try {
      setVersions(await listProjectVersions(projectId));
    } catch (error) {
      console.error("Failed to load versions", error);
      toast.error("Could not load versions");
    } finally {
      setVersionsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen) {
      setNameDraft(projectName);
      setIsEditingName(false);
    }
  }, [isOpen, projectName]);

  useEffect(() => {
    if (!isOpen || !projectId) return;

    loadChatMessages(projectId)
      .then((messages) => setChatCount(messages?.length ?? 0))
      .catch(() => setChatCount(0));
    void loadVersions();
  }, [isOpen, loadVersions, projectId]);

  const handleRename = async () => {
    if (!projectId) return;
    const nextName = nameDraft.trim();
    if (!nextName || nextName === projectName) {
      setIsEditingName(false);
      setNameDraft(projectName);
      return;
    }

    try {
      await renameProject(projectId, nextName);
      setProjectName(nextName);
      setIsEditingName(false);
      toast.success("Project renamed");
    } catch (error) {
      console.error("Failed to rename project", error);
      toast.error("Could not rename this project");
    }
  };

  const handleSaveVersion = async () => {
    if (!projectId || savingVersion) return;
    setSavingVersion(true);

    try {
      const version = await createProjectVersion({
        projectId,
        label: versionLabel || "Manual save",
        name: projectName,
        projectCreatedAt: createdAt ?? Date.now(),
        files,
        activeFileId: useDocumentStore.getState().activeFileId,
        mainFileId,
        compiler,
        comments,
      });

      setVersions((current) => [version, ...current].slice(0, 30));
      setVersionLabel("");
      toast.success("Version saved");
    } catch (error) {
      console.error("Failed to save version", error);
      toast.error("Could not save this version");
    } finally {
      setSavingVersion(false);
    }
  };

  const handleRestore = async (version: ProjectVersion) => {
    if (restoringId) return;
    setRestoringId(version.id);

    try {
      const restored = await restoreProjectVersion(version.id);
      if (!restored) {
        toast.error("This version is no longer available");
        return;
      }
      hydrateProject(restored);
      useDocumentStore.getState().requestCompile();
      toast.success("Version restored");
    } catch (error) {
      console.error("Failed to restore version", error);
      toast.error("Could not restore this version");
    } finally {
      setRestoringId(null);
    }
  };

  const handleDeleteVersion = async (version: ProjectVersion) => {
    try {
      await deleteProjectVersion(version.id);
      setVersions((current) =>
        current.filter((item) => item.id !== version.id),
      );
      toast.success("Version deleted");
    } catch (error) {
      console.error("Failed to delete version", error);
      toast.error("Could not delete this version");
    }
  };

  const toggleDiagnostic = (id: string) => {
    setExpandedDiagnostics((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectDiagnostic = (diagnosticId: string) => {
    setSelectedDiagnosticId(diagnosticId);
    const diagnostic = compileDiagnostics.find(
      (item) => item.id === diagnosticId,
    );
    if (!diagnostic || diagnostic.line == null) return;

    const file =
      files.find((candidate) => candidate.id === diagnostic.fileId) ??
      files.find(
        (candidate) =>
          diagnostic.filePath != null &&
          (candidate.path === diagnostic.filePath ||
            candidate.name === diagnostic.filePath.split("/").pop()),
      ) ??
      files.find((candidate) => candidate.id === mainFileId);

    if (!file || file.type !== "tex") return;

    const sourceLines = (file.content ?? "").split("\n");
    const targetLine = Math.min(
      Math.max(diagnostic.line, 1),
      Math.max(sourceLines.length, 1),
    );
    let position = 0;
    for (let index = 0; index < targetLine - 1; index++) {
      position += (sourceLines[index]?.length ?? 0) + 1;
    }

    setActiveFile(file.id);
    requestJumpToPosition(position);
    requestAnimationFrame(() => {
      document
        .getElementById(`diagnostic-${diagnostic.id}`)
        ?.scrollIntoView({ block: "nearest" });
    });
  };

  const handleAutoFix = async (diagnosticId?: string) => {
    if (!projectId || fixBusy) return;
    if (compiledWithErrors) {
      toast.info("PDF compiled; source left unchanged", {
        description:
          "Affected lines are highlighted in the editor. Fixes are review-only while the PDF builds.",
      });
      return;
    }

    const result = runAutoFixes({
      files,
      mainFileId,
      diagnostics: compileDiagnostics,
      diagnosticId,
    });

    if (result.updates.length === 0) {
      toast.info("No deterministic auto-fix matched", {
        description:
          result.skipped[0]?.reason ??
          "This warning still needs a manual decision.",
      });
      return;
    }

    const id = diagnosticId ?? "all";
    setFixingId(id);

    try {
      const version = await createProjectVersion({
        projectId,
        label: diagnosticId ? "Before auto-fix" : "Before auto-fix all",
        name: projectName,
        projectCreatedAt: createdAt ?? Date.now(),
        files,
        activeFileId: useDocumentStore.getState().activeFileId,
        mainFileId,
        compiler,
        comments,
      });

      setVersions((current) => [version, ...current].slice(0, 30));

      const store = useDocumentStore.getState();
      for (const update of result.updates) {
        store.updateFileContent(update.id, update.content);
      }
      store.requestCompile();

      toast.success(
        `Applied ${result.applied.length} auto-fix${result.applied.length === 1 ? "" : "es"}`,
        {
          description: result.applied.slice(0, 4).join(" · "),
        },
      );
    } catch (error) {
      console.error("Failed to apply auto-fix", error);
      toast.error("Could not apply the auto-fix");
    } finally {
      setFixingId(null);
    }
  };

  const handleJumpToComment = (comment: ProjectComment) => {
    const file = files.find((candidate) => candidate.id === comment.fileId);
    if (!file || file.type !== "tex") return;

    setActiveFile(file.id);
    const position = commentPosition(comment, file.content ?? "");
    if (position !== null) requestJumpToPosition(position);
    setOpen(false);
  };

  const rawLogs = compileLogs
    .map((log) => {
      const timestamp = format(new Date(log.at), "yyyy-MM-dd HH:mm:ss");
      const details = log.details ? `\n${log.details}` : "";
      return `[${timestamp}] ${log.status.toUpperCase()} ${log.compiler} ${log.durationMs}ms · ${log.message}${details}`;
    })
    .join("\n\n");

  const handleCopyLogs = async () => {
    try {
      await navigator.clipboard.writeText(lastCompileLog ?? rawLogs);
      toast.success("Logs copied");
    } catch {
      toast.error("Could not copy logs");
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setOpen} modal={false}>
      <SheetContent
        overlay={false}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[470px]"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="border-hairline border-b px-4 py-3 pr-12">
          <SheetTitle className="flex items-center gap-2 text-base">
            <FolderKanbanIcon className="size-4 text-primary" />
            Project
          </SheetTitle>
          <SheetDescription className="text-xs">
            Everything in this project stays on this device unless you share it.
          </SheetDescription>
        </SheetHeader>

        <div className="flex shrink-0 items-center gap-0 overflow-x-auto border-hairline border-b px-2">
          {TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "relative flex h-10 shrink-0 items-center gap-1.5 px-2.5 text-[0.875rem] transition-colors",
                  tab === item.id
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setTab(item.id)}
              >
                <Icon className="size-3.5" />
                {item.label}
                {item.id === "comments" && openComments > 0 && (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-[0.75rem] text-primary">
                    {openComments}
                  </span>
                )}
                {tab === item.id && (
                  <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "project" && (
            <div className="space-y-5 p-4">
              <div>
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={nameDraft}
                      onChange={(event) => setNameDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void handleRename();
                        if (event.key === "Escape") {
                          setIsEditingName(false);
                          setNameDraft(projectName);
                        }
                      }}
                      autoFocus
                      className="h-9 font-serif text-lg"
                    />
                    <Button size="sm" onClick={() => void handleRename()}>
                      Save
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-serif text-[1.875rem] leading-none tracking-[-0.025em]">
                        {projectName}
                      </h2>
                      <p className="mt-2 text-[0.875rem] text-muted-foreground">
                        Created{" "}
                        {createdAt
                          ? formatDistanceToNow(new Date(createdAt), {
                              addSuffix: true,
                            })
                          : "just now"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      onClick={() => setIsEditingName(true)}
                      title="Rename project"
                    >
                      <PencilIcon className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Stat label="Files" value={String(files.length)} />
                <Stat label="Words" value={wordCount.toLocaleString()} />
                <Stat
                  label="Comments"
                  value={String(openComments)}
                  hint={
                    comments.length > 0 ? `of ${comments.length}` : undefined
                  }
                />
                <Stat
                  label="Chats"
                  value={String(chatCount)}
                  hint="messages saved"
                />
              </div>

              <div className="rounded-lg border border-hairline bg-card/35 px-3 py-1">
                <DetailRow
                  icon={FileTextIcon}
                  label="Main document"
                  value={mainFile?.path ?? "Not set"}
                />
                <DetailRow
                  icon={HardDriveIcon}
                  label="Compiler"
                  value={compiler}
                />
                <DetailRow
                  icon={FileTextIcon}
                  label="Characters"
                  value={characterCount.toLocaleString()}
                />
                <DetailRow
                  icon={CloudIcon}
                  label="Live sync"
                  value={
                    syncSettings?.enabled
                      ? syncStatus === "connected"
                        ? `${Math.max(peers.length, 1)} live`
                        : "Enabled"
                      : "Off · local only"
                  }
                />
                <DetailRow
                  icon={UsersIcon}
                  label="Shared"
                  value={
                    syncSettings?.sharedWithMe
                      ? "Shared with you"
                      : syncSettings?.token
                        ? "You own this copy"
                        : "Private"
                  }
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setTab("versions");
                    void handleSaveVersion();
                  }}
                  disabled={savingVersion}
                >
                  <PlusIcon className="size-3.5" />
                  Save version
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOpen(false);
                    setCommentsOpen(true);
                  }}
                >
                  <MessageSquareIcon className="size-3.5" />
                  Comments
                </Button>
              </div>
            </div>
          )}

          {tab === "versions" && (
            <div className="space-y-4 p-4">
              <div className="rounded-lg border border-hairline bg-card/35 p-3">
                <div className="mb-2 flex items-center gap-2 font-medium text-xs">
                  <PlusIcon className="size-3.5 text-primary" />
                  Save a version
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={versionLabel}
                    onChange={(event) => setVersionLabel(event.target.value)}
                    placeholder="Note, e.g. before rewriting §3"
                    className="h-8 text-xs"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void handleSaveVersion();
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => void handleSaveVersion()}
                    disabled={savingVersion}
                  >
                    {savingVersion ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
                <p className="mt-2 text-[0.75rem] text-muted-foreground">
                  Up to 30 local snapshots per project. Nothing is uploaded.
                </p>
              </div>

              {versionsLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-xs">
                  <Loader2Icon className="size-4 animate-spin" />
                  Loading versions…
                </div>
              ) : versions.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <HistoryIcon className="mx-auto mb-2 size-7 text-muted-foreground/50" />
                  <p className="font-medium text-sm">No versions yet</p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    Save a snapshot before a major edit. You can restore it at
                    any time.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className="rounded-lg border border-hairline bg-card/35 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-sm">
                            {version.label}
                          </div>
                          <div className="mt-1 text-[0.75rem] text-muted-foreground">
                            {formatDistanceToNow(new Date(version.createdAt), {
                              addSuffix: true,
                            })}{" "}
                            · {version.files.length} file
                            {version.files.length === 1 ? "" : "s"}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => void handleRestore(version)}
                            disabled={restoringId !== null}
                            title="Restore this version"
                          >
                            {restoringId === version.id ? (
                              <Loader2Icon className="size-3.5 animate-spin" />
                            ) : (
                              <RotateCcwIcon className="size-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-destructive"
                            onClick={() => void handleDeleteVersion(version)}
                            title="Delete this version"
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "comments" && (
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">Project comments</div>
                  <div className="mt-0.5 text-[0.75rem] text-muted-foreground">
                    {openComments} open · {comments.length} total
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOpen(false);
                    setCommentsOpen(true);
                  }}
                >
                  <PlusIcon className="size-3.5" />
                  Add
                </Button>
              </div>

              {sortedComments.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <MessageSquareIcon className="mx-auto mb-2 size-7 text-muted-foreground/50" />
                  <p className="font-medium text-sm">No comments yet</p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    Select text in the editor and leave a note for your
                    collaborators.
                  </p>
                </div>
              ) : (
                sortedComments.map((comment) => {
                  const file = files.find(
                    (candidate) => candidate.id === comment.fileId,
                  );

                  return (
                    <div
                      key={comment.id}
                      className={cn(
                        "rounded-lg border p-3",
                        comment.resolved ? "opacity-55" : "bg-card",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          className="min-w-0 text-left"
                          onClick={() => handleJumpToComment(comment)}
                        >
                          <div className="flex items-center gap-1.5 text-[0.75rem] text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {comment.author}
                            </span>
                            <span>·</span>
                            <span>
                              {formatDistanceToNow(
                                new Date(comment.createdAt),
                                { addSuffix: true },
                              )}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate font-mono text-[0.75rem] text-muted-foreground">
                            {file?.path ?? comment.filePath}:{comment.line}
                          </div>
                        </button>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            onClick={() => toggleCommentResolved(comment.id)}
                            title={
                              comment.resolved
                                ? "Reopen comment"
                                : "Resolve comment"
                            }
                          >
                            {comment.resolved ? (
                              <CheckCircle2Icon className="size-3.5 text-[#5db8a6]" />
                            ) : (
                              <CheckCircle2Icon className="size-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteComment(comment.id)}
                            title="Delete comment"
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        </div>
                      </div>

                      {comment.selectedText && (
                        <blockquote className="mt-1.5 line-clamp-2 border-l-2 bg-muted/40 px-2 py-1 text-[0.875rem] text-muted-foreground italic">
                          “{comment.selectedText}”
                        </blockquote>
                      )}
                      <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed">
                        {comment.body}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === "logs" &&
            (!isLatexActive ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <ScrollTextIcon className="mb-3 size-8 text-muted-foreground/50" />
                <p className="font-medium text-sm">
                  LaTeX compiler inactive
                </p>
                <p className="mt-1 max-w-sm text-muted-foreground text-xs leading-relaxed">
                  Compile warnings and errors belong to the LaTeX main document.
                  Open a LaTeX file to review or repair them. Python, R, and Lean
                  files use their own runtimes and diagnostics.
                </p>
              </div>
            ) : (
              <div className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 font-medium text-sm">
                    Warnings and Errors
                    {errorCount > 0 && (
                      <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 font-medium text-[0.75rem] text-destructive">
                        {errorCount} error{errorCount === 1 ? "" : "s"}
                      </span>
                    )}
                    {warningCount > 0 && (
                      <span className="rounded-full bg-[#b9822f]/10 px-1.5 py-0.5 font-medium text-[#9a6d24] text-[0.75rem]">
                        {warningCount} warning
                        {warningCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[0.75rem] text-muted-foreground leading-relaxed">
                    Detected from the latest compile. Click an issue to jump to
                    its line and inspect the suggested fix. Fix all runs local
                    deterministic rules, then AI for remaining errors; warnings
                    can be repaired with AI individually or together. A version
                    snapshot is saved first. If the PDF builds with errors,
                    source changes are paused.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => void handleCopyLogs()}
                    disabled={!lastCompileLog && compileLogs.length === 0}
                    title="Copy compile log"
                  >
                    <CopyIcon className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[0.75rem] text-muted-foreground"
                    onClick={clearCompileLogs}
                    disabled={
                      compileLogs.length === 0 &&
                      compileDiagnostics.length === 0
                    }
                  >
                    Clear
                  </Button>
                </div>
              </div>

              {compiledWithErrors && (
                <div className="rounded-lg border border-[#b9822f]/25 bg-[#b9822f]/5 p-3 text-[#8a6421] text-[0.75rem] leading-relaxed">
                  <div className="font-medium">PDF builds with errors</div>
                  <p className="mt-1">
                    The source is left unchanged. The affected lines are
                    highlighted in the editor; fix them manually, or use a
                    single issue action when you intend to change the source.
                  </p>
                </div>
              )}

              {errorCount > 0 && (
                <div className="space-y-1">
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => void handleFixAll()}
                    disabled={fixBusy || compiledWithErrors}
                    title={
                      compiledWithErrors
                        ? "PDF builds; automatic fixes are paused while errors remain."
                        : "Run deterministic fixes, then ask AI about remaining errors."
                    }
                  >
                    {fixingId === "all" || aiFixingId === "all" ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      <SparklesIcon className="size-3.5" />
                    )}
                    {compiledWithErrors
                      ? "Fix all paused"
                      : `Fix all (${errorCount})`}
                  </Button>
                  <p className="text-[0.6875rem] text-muted-foreground leading-relaxed">
                    {compiledWithErrors
                      ? "Highlighted errors are review-only while the PDF builds."
                      : "Runs deterministic rules first, then AI for remaining errors. Saves a version first."}
                  </p>
                </div>
              )}

              {warningCount > 0 && (
                <div className="space-y-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      void handleAiFix(undefined, { warningsOnly: true })
                    }
                    disabled={fixBusy || compiledWithErrors}
                    title={
                      compiledWithErrors
                        ? "PDF builds with errors; automatic fixes are paused."
                        : "Ask the selected AI model to fix compile warnings"
                    }
                  >
                    {aiFixingId === "all-warnings" ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      <SparklesIcon className="size-3.5" />
                    )}
                    Fix warnings with AI ({warningCount})
                  </Button>
                  <p className="text-[0.6875rem] text-muted-foreground leading-relaxed">
                    {compiledWithErrors
                      ? "Warning fixes are paused while the PDF builds with errors."
                      : "AI may decline warnings that are intentional or need a manual decision. Saves a version first."}
                  </p>
                </div>
              )}

              {compileDiagnostics.length === 0 ? (
                compileLogs.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <ScrollTextIcon className="mx-auto mb-2 size-7 text-muted-foreground/50" />
                    <p className="font-medium text-sm">No compile logs yet</p>
                    <p className="mt-1 text-muted-foreground text-xs">
                      Compile the document to see warnings, errors, engine
                      timing, and raw output here.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-[#5db8a6]/35 bg-[#5db8a6]/5 p-4 text-center">
                    <CheckCircle2Icon className="mx-auto mb-2 size-7 text-[#5db8a6]" />
                    <p className="font-medium text-sm">
                      No warnings or errors in the last compile
                    </p>
                    <p className="mt-1 text-muted-foreground text-xs">
                      The document compiled cleanly.
                    </p>
                  </div>
                )
              ) : (
                <div className="space-y-2">
                  {compileDiagnostics.map((diagnostic) => {
                    const fix = describeAutoFix(diagnostic);
                    const isError = diagnostic.severity === "error";
                    const isWarning = diagnostic.severity === "warning";
                    const expanded = expandedDiagnostics.has(diagnostic.id);
                    const isFixing = fixingId === diagnostic.id;

                    const isSelected = selectedDiagnosticId === diagnostic.id;

                    return (
                      <div
                        key={diagnostic.id}
                        id={`diagnostic-${diagnostic.id}`}
                        className={cn(
                          "cursor-pointer rounded-lg border bg-card/35 p-3 transition-colors hover:bg-card/60",
                          isError
                            ? "border-destructive/25"
                            : "border-[#b9822f]/25",
                          isSelected && "bg-card/70 ring-1 ring-primary/35",
                        )}
                        onClick={() => handleSelectDiagnostic(diagnostic.id)}
                      >
                        <div className="flex items-start gap-2">
                          {isError ? (
                            <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                          ) : (
                            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-[#b9822f]" />
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-1.5 font-medium text-[0.75rem] uppercase tracking-[0.14em]">
                              <span
                                className={
                                  isError
                                    ? "text-destructive"
                                    : "text-[#9a6d24]"
                                }
                              >
                                {isError ? "Error" : "Warning"}
                              </span>
                              <span className="text-muted-foreground/40">
                                /
                              </span>
                              <span className="text-muted-foreground">
                                {diagnosticNature(diagnostic)}
                              </span>
                              <span className="rounded border border-hairline px-1 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
                                {fileKindLabel(diagnosticLanguage(diagnostic))}
                              </span>
                            </div>
                            <p className="font-medium text-[0.875rem] leading-snug">
                              {diagnostic.message}
                            </p>
                            {(diagnostic.filePath || diagnostic.line) && (
                              <button
                                type="button"
                                className="mt-1 flex max-w-full items-center gap-1 text-left font-mono text-[0.75rem] text-muted-foreground transition-colors hover:text-foreground"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleSelectDiagnostic(diagnostic.id);
                                }}
                              >
                                <span className="truncate">
                                  {diagnostic.filePath ?? "project"}
                                  {diagnostic.line ? `:${diagnostic.line}` : ""}
                                </span>
                                {diagnostic.line && (
                                  <span className="shrink-0 text-primary/80">
                                    · click to jump
                                  </span>
                                )}
                              </button>
                            )}
                          </div>

                          {isError ? (
                            <div className="flex shrink-0 items-center gap-1">
                              {fix ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 gap-1 px-2 text-[0.75rem]"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleAutoFix(diagnostic.id);
                                  }}
                                  disabled={fixBusy || compiledWithErrors}
                                  title={
                                    compiledWithErrors
                                      ? "PDF builds; automatic fixes are paused."
                                      : fix
                                  }
                                >
                                  {isFixing ? (
                                    <Loader2Icon className="size-3 animate-spin" />
                                  ) : (
                                    <WrenchIcon className="size-3" />
                                  )}
                                  Auto-fix
                                </Button>
                              ) : (
                                <span className="rounded-full border border-hairline px-1.5 py-0.5 text-[0.75rem] text-muted-foreground uppercase tracking-[0.12em]">
                                  Manual
                                </span>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 px-2 text-[0.75rem]"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleAiFix(diagnostic.id);
                                }}
                                disabled={fixBusy || compiledWithErrors}
                                title={
                                  compiledWithErrors
                                    ? "PDF builds; AI fixes are paused."
                                    : "Ask the selected AI model to propose a repair"
                                }
                              >
                                {aiFixingId === diagnostic.id ? (
                                  <Loader2Icon className="size-3 animate-spin" />
                                ) : (
                                  <SparklesIcon className="size-3" />
                                )}
                                Fix with AI
                              </Button>
                            </div>
                          ) : isWarning ? (
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 px-2 text-[0.75rem]"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleAiFix(diagnostic.id);
                                }}
                                disabled={fixBusy || compiledWithErrors}
                                title={
                                  compiledWithErrors
                                    ? "PDF builds; AI fixes are paused."
                                    : "Ask the selected AI model to fix this warning"
                                }
                              >
                                {aiFixingId === diagnostic.id ? (
                                  <Loader2Icon className="size-3 animate-spin" />
                                ) : (
                                  <SparklesIcon className="size-3" />
                                )}
                                Fix with AI
                              </Button>
                            </div>
                          ) : (
                            <span className="shrink-0 rounded-full border border-hairline px-1.5 py-0.5 text-[0.75rem] text-muted-foreground uppercase tracking-[0.12em]">
                              Review
                            </span>
                          )}
                        </div>

                        {diagnostic.lineText && (
                          <pre className="mt-2 overflow-x-auto rounded bg-surface-dark px-2 py-1.5 font-mono text-[0.75rem] text-on-dark-soft">
                            {diagnostic.lineText}
                          </pre>
                        )}

                        {fix && !isSelected && (
                          <p className="mt-1.5 text-[0.75rem] text-muted-foreground">
                            {fix}
                          </p>
                        )}

                        {diagnostic.details.length > 0 && (
                          <button
                            type="button"
                            className="mt-1.5 flex items-center gap-1 text-[0.75rem] text-muted-foreground transition-colors hover:text-foreground"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleDiagnostic(diagnostic.id);
                            }}
                          >
                            {expanded ? (
                              <ChevronUpIcon className="size-3" />
                            ) : (
                              <ChevronDownIcon className="size-3" />
                            )}
                            {expanded ? "Show less" : "Show more"}
                          </button>
                        )}

                        {expanded && (
                          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-surface-dark p-2 font-mono text-[0.75rem] text-on-dark-soft leading-relaxed">
                            {diagnostic.details.join("\n") || diagnostic.raw}
                          </pre>
                        )}

                        {isSelected && selectedFix && (
                          <div
                            className="mt-3 border-hairline border-t pt-3"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="flex items-center gap-1.5 font-medium text-[0.75rem] text-muted-foreground uppercase tracking-[0.14em]">
                              <WrenchIcon className="size-3 text-primary" />
                              Suggested fix
                            </div>

                            {selectedFix.updates.length === 0 ? (
                              <div className="mt-2 space-y-2">
                                <p className="text-[0.875rem] text-muted-foreground leading-relaxed">
                                  No deterministic repair rule matches this
                                  issue. The affected line is highlighted in the
                                  editor.
                                </p>
                                {(isError || isWarning) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1 px-2 text-[0.75rem]"
                                    onClick={() =>
                                      void handleAiFix(diagnostic.id)
                                    }
                                    disabled={fixBusy || compiledWithErrors}
                                  >
                                    {aiFixingId === diagnostic.id ? (
                                      <Loader2Icon className="size-3 animate-spin" />
                                    ) : (
                                      <SparklesIcon className="size-3" />
                                    )}
                                    Fix with AI
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <div className="mt-2 space-y-2">
                                {selectedFix.updates.map((update) => (
                                  <div
                                    key={`${diagnostic.id}-${update.fileId}`}
                                    className="overflow-hidden rounded-md border border-hairline"
                                  >
                                    <div className="border-hairline border-b bg-muted/35 px-2 py-1 font-mono text-[0.75rem] text-muted-foreground">
                                      {update.filePath}:{update.startLine}
                                    </div>
                                    {update.removed.length > 0 && (
                                      <pre className="overflow-x-auto bg-destructive/10 px-2 py-1 font-mono text-[0.75rem] text-destructive leading-relaxed">
                                        {update.removed
                                          .map((line) => `- ${line}`)
                                          .join("\n")}
                                      </pre>
                                    )}
                                    {update.added.length > 0 && (
                                      <pre className="overflow-x-auto bg-[#5db8a6]/10 px-2 py-1 font-mono text-[#1f7a68] text-[0.75rem] leading-relaxed dark:text-[#7fd1c1]">
                                        {update.added
                                          .map((line) => `+ ${line}`)
                                          .join("\n")}
                                      </pre>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="mt-2 flex items-center gap-2">
                              <Button
                                size="sm"
                                className="h-7 gap-1 px-2 text-[0.75rem]"
                                onClick={() =>
                                  void handleAutoFix(diagnostic.id)
                                }
                                disabled={
                                  fixBusy ||
                                  compiledWithErrors ||
                                  selectedFix.updates.length === 0
                                }
                              >
                                {isFixing ? (
                                  <Loader2Icon className="size-3 animate-spin" />
                                ) : (
                                  <WrenchIcon className="size-3" />
                                )}
                                Apply suggested fix
                              </Button>
                              <span className="text-[0.75rem] text-muted-foreground">
                                Saves a version first
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {(lastCompileLog || compileLogs.length > 0) && (
                <div className="rounded-lg border border-hairline">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-[0.75rem] text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setShowRawLog((current) => !current)}
                  >
                    <span className="flex items-center gap-1.5 font-medium uppercase tracking-[0.14em]">
                      <ScrollTextIcon className="size-3" />
                      Raw compile log
                    </span>
                    {showRawLog ? (
                      <ChevronUpIcon className="size-3.5" />
                    ) : (
                      <ChevronDownIcon className="size-3.5" />
                    )}
                  </button>
                  {showRawLog && (
                    <pre className="max-h-64 overflow-auto border-hairline border-t bg-surface-dark p-2 font-mono text-[0.75rem] text-on-dark-soft leading-relaxed">
                      {lastCompileLog ??
                        "No raw log captured for this compile."}
                    </pre>
                  )}
                </div>
              )}

              {compileLogs.length > 0 && (
                <div className="border-hairline border-t pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium text-[0.75rem] text-muted-foreground uppercase tracking-[0.14em]">
                      Compile history
                    </span>
                    <span className="font-mono text-[0.75rem] text-muted-foreground">
                      {compileLogs.length}
                    </span>
                  </div>
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {compileLogs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-lg border border-hairline bg-card/35 p-2.5"
                      >
                        <div className="flex items-center gap-2">
                          {log.status === "success" ? (
                            <CheckCircle2Icon className="size-3.5 shrink-0 text-[#5db8a6]" />
                          ) : (
                            <AlertCircleIcon className="size-3.5 shrink-0 text-destructive" />
                          )}
                          <span className="min-w-0 flex-1 truncate text-[0.875rem]">
                            {log.message}
                          </span>
                          <span className="shrink-0 font-mono text-[0.75rem] text-muted-foreground">
                            {log.durationMs}ms
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 font-mono text-[0.75rem] text-muted-foreground">
                          <span>{format(new Date(log.at), "HH:mm:ss")}</span>
                          <span>·</span>
                          <span>{log.compiler}</span>
                          <span>·</span>
                          <span>{log.fileCount} files</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </div>
            ))}
        </div>

        <div className="flex shrink-0 items-center justify-between border-hairline border-t px-4 py-2.5 text-[0.75rem] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <HardDriveIcon className="size-3" />
            Stored in IndexedDB
          </span>
          <span className="font-mono">{getSyncUserName()}</span>
        </div>
      </SheetContent>
    </Sheet>
  );
}
