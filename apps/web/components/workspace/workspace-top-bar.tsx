"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  BookOpenIcon,
  ChevronLeftIcon,
  CrosshairIcon,
  FileCheck2Icon,
  FileCodeIcon,
  KeyboardIcon,
  MessageSquareIcon,
  MonitorIcon,
  MoonIcon,
  PanelRightIcon,
  PresentationIcon,
  ShapesIcon,
  SunIcon,
  UsersIcon,
} from "lucide-react";
import { ArcanaMark } from "@/components/brand/arcana-mark";
import { DevPanelButton } from "@/components/dev/dev-panel";
import { getBeamerInfo } from "@/lib/beamer";
import { isLeanFile } from "@/lib/lean";
import { Button } from "@/components/ui/button";
import { useDocumentStore } from "@/stores/document-store";
import { useSyncStore } from "@/stores/sync-store";
import { useDevFeatureFlag } from "@/stores/dev-panel-store";
import { useEditorPreferencesStore } from "@/stores/editor-preferences-store";

export function WorkspaceTopBar() {
  const projectName = useDocumentStore((s) => s.projectName);
  const files = useDocumentStore((s) => s.files);
  const mainFileId = useDocumentStore((s) => s.mainFileId);
  const openCommentCount = useDocumentStore(
    (s) => s.comments.filter((comment) => !comment.resolved).length,
  );
  const setCommentsOpen = useDocumentStore((s) => s.setCommentsOpen);
  const setLiteratureOpen = useDocumentStore((s) => s.setLiteratureOpen);
  const setSyncOpen = useDocumentStore((s) => s.setSyncOpen);
  const setTikzOpen = useDocumentStore((s) => s.setTikzOpen);
  const isBeamerOpen = useDocumentStore((s) => s.isBeamerOpen);
  const setBeamerOpen = useDocumentStore((s) => s.setBeamerOpen);
  const isSubmissionOpen = useDocumentStore((s) => s.isSubmissionOpen);
  const setSubmissionOpen = useDocumentStore((s) => s.setSubmissionOpen);
  const isLeanOpen = useDocumentStore((s) => s.isLeanOpen);
  const setLeanOpen = useDocumentStore((s) => s.setLeanOpen);
  const leanLakeEnabled = useDevFeatureFlag("leanLake");
  const isLeanInfoviewOpen = useDocumentStore((s) => s.isLeanInfoviewOpen);
  const setLeanInfoviewOpen = useDocumentStore((s) => s.setLeanInfoviewOpen);
  const isLatexKeyboardOpen = useDocumentStore((s) => s.isLatexKeyboardOpen);
  const setLatexKeyboardOpen = useDocumentStore((s) => s.setLatexKeyboardOpen);
  const setInspectorOpen = useDocumentStore((s) => s.setInspectorOpen);
  const setInspectorTab = useDocumentStore((s) => s.setInspectorTab);
  const errorCount = useDocumentStore(
    (s) =>
      s.compileDiagnostics.filter(
        (diagnostic) => diagnostic.severity === "error",
      ).length,
  );
  const warningCount = useDocumentStore(
    (s) =>
      s.compileDiagnostics.filter(
        (diagnostic) => diagnostic.severity === "warning",
      ).length,
  );

  const syncEnabled = useSyncStore((s) => s.enabled);
  const syncStatus = useSyncStore((s) => s.status);
  const peers = useSyncStore((s) => s.peers);

  const { theme, setTheme } = useTheme();
  const terminalThemeId = useEditorPreferencesStore((s) => s.terminalThemeId);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const mainFile = files.find((file) => file.id === mainFileId);
  const activeFileId = useDocumentStore((s) => s.activeFileId);
  const activeFile = files.find((file) => file.id === activeFileId);
  const isLeanActive = activeFile ? isLeanFile(activeFile) : false;
  const beamerInfo = useMemo(
    () => getBeamerInfo(files, mainFileId),
    [files, mainFileId],
  );
  const syncLabel =
    syncStatus === "connected"
      ? peers.length > 1
        ? `${peers.length} live`
        : "Live"
      : syncEnabled
        ? "Connecting"
        : "Share";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-hairline border-b bg-background px-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          asChild
          title="All projects"
          aria-label="All projects"
        >
          <Link href="/">
            <ChevronLeftIcon className="size-4" />
          </Link>
        </Button>

        <Link
          href="/"
          className="hidden size-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-card text-primary sm:flex"
          title="arcanaTeX — all projects"
        >
          <ArcanaMark className="size-4" />
        </Link>

        <div className="min-w-0">
          <div className="truncate font-serif text-[1.25rem] leading-tight tracking-[-0.02em]">
            {projectName}
          </div>
          <div className="hidden items-center gap-1.5 text-[0.75rem] text-muted-foreground sm:flex">
            <span className="font-mono">{mainFile?.path ?? "main.tex"}</span>
            <span>·</span>
            <span>local project</span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-full border-hairline bg-card"
          onClick={() => setSyncOpen(true)}
          title="Live collaboration & sync"
          aria-label="Live collaboration & sync"
        >
          <span
            className={`size-1.5 rounded-full ${
              syncStatus === "connected"
                ? "bg-[#5db8a6]"
                : syncStatus === "connecting"
                  ? "bg-[#e8a55a]"
                  : "bg-muted-foreground/40"
            }`}
          />
          <UsersIcon className="size-3.5" />
          <span className="hidden md:inline">{syncLabel}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 px-2"
          onClick={() => {
            if (errorCount > 0) setInspectorTab("logs");
            else setInspectorOpen(true);
          }}
          title={
            errorCount > 0
              ? `Open ${errorCount} compile error${errorCount === 1 ? "" : "s"}`
              : warningCount > 0
                ? `Open ${warningCount} compile warning${warningCount === 1 ? "" : "s"}`
                : "Project info, versions, comments, and logs"
          }
          aria-label="Project inspector"
        >
          <span className="relative">
            <PanelRightIcon className="size-4" />
            {errorCount > 0 && (
              <span className="absolute -top-1.5 -right-2 flex min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 text-[0.75rem] text-white leading-3.5">
                {errorCount > 9 ? "9+" : errorCount}
              </span>
            )}
            {errorCount === 0 && warningCount > 0 && (
              <span className="absolute -top-1 -right-1.5 size-1.5 rounded-full bg-[#b9822f]" />
            )}
          </span>
          <span className="hidden lg:inline">Project</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="size-9"
          onClick={() => setCommentsOpen(true)}
          title="Comments"
          aria-label="Comments"
        >
          <span className="relative">
            <MessageSquareIcon className="size-4" />
            {openCommentCount > 0 && (
              <span className="absolute -top-1.5 -right-2 flex min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[0.75rem] text-primary-foreground leading-3.5">
                {openCommentCount > 9 ? "9+" : openCommentCount}
              </span>
            )}
          </span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="size-9"
          onClick={() => setLiteratureOpen(true)}
          title="Literature search"
          aria-label="Literature search"
        >
          <BookOpenIcon className="size-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="size-9"
          onClick={() => setTikzOpen(true)}
          title="TikZ figure studio"
          aria-label="TikZ figure studio"
        >
          <ShapesIcon className="size-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className={
            isLatexKeyboardOpen ? "size-9 bg-accent text-foreground" : "size-9"
          }
          onClick={() => setLatexKeyboardOpen(!isLatexKeyboardOpen)}
          title="LaTeX keyboard (⌘/Ctrl+Shift+K)"
          aria-label="LaTeX keyboard"
          aria-pressed={isLatexKeyboardOpen}
        >
          <KeyboardIcon className="size-4" />
        </Button>

        {beamerInfo.isBeamer && (
          <Button
            variant={isBeamerOpen ? "secondary" : "ghost"}
            size="sm"
            className="h-9 gap-1.5 px-2"
            onClick={() => setBeamerOpen(true)}
            title="Beamer presentation companion"
            aria-label="Beamer companion"
          >
            <PresentationIcon className="size-4" />
            <span className="hidden lg:inline">Beamer</span>
            <span className="font-mono text-[0.75rem] text-muted-foreground">
              {beamerInfo.frames.length}
            </span>
          </Button>
        )}

        {isLeanActive && (
          <Button
            variant={isLeanInfoviewOpen ? "secondary" : "ghost"}
            size="sm"
            className="h-9 gap-1.5 px-2"
            onClick={() => setLeanInfoviewOpen(!isLeanInfoviewOpen)}
            title="Lean Infoview"
            aria-label="Lean Infoview"
          >
            <CrosshairIcon className="size-4" />
            <span className="hidden lg:inline">Infoview</span>
          </Button>
        )}

        {leanLakeEnabled && (
          <Button
            variant={isLeanOpen ? "secondary" : "ghost"}
            size="sm"
            className="h-9 gap-1.5 px-2"
            onClick={() => setLeanOpen(true)}
            title="Connect a local Lean Lake project"
            aria-label="Lean Lake"
          >
            <FileCodeIcon className="size-4" />
            <span className="hidden lg:inline">Lean</span>
          </Button>
        )}

        <Button
          variant={isSubmissionOpen ? "secondary" : "ghost"}
          size="sm"
          className="h-9 gap-1.5 px-2"
          onClick={() => setSubmissionOpen(true)}
          title="Submission readiness and source bundle"
          aria-label="Submission readiness"
        >
          <FileCheck2Icon className="size-4" />
          <span className="hidden lg:inline">Submit</span>
        </Button>

        <div className="mx-1 hidden h-5 w-px bg-border sm:block" />

        <DevPanelButton />

        {terminalThemeId === "arcana" && (
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            onClick={() => {
              if (theme === "system") setTheme("light");
              else if (theme === "light") setTheme("dark");
              else setTheme("system");
            }}
            title={
              !mounted
                ? "Theme"
                : theme === "system"
                  ? "System theme"
                  : theme === "light"
                    ? "Light mode"
                    : "Dark mode"
            }
          >
            {!mounted ? (
              <MonitorIcon className="size-4" />
            ) : theme === "system" ? (
              <MonitorIcon className="size-4" />
            ) : theme === "light" ? (
              <SunIcon className="size-4" />
            ) : (
              <MoonIcon className="size-4" />
            )}
          </Button>
        )}
      </div>
    </header>
  );
}
