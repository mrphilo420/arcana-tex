"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileCodeIcon,
  FolderGit2Icon,
  HammerIcon,
  Loader2Icon,
  RefreshCwIcon,
  TerminalIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useDocumentStore } from "@/stores/document-store";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface LeanStatus {
  configured: boolean;
  projectName?: string;
  projectPath?: string;
  hasLakefile?: boolean;
  lakeCommand?: string;
  lakeVersion?: string | null;
  buildInProgress?: boolean;
  error?: string;
}

interface LeanFile {
  path: string;
  size: number;
  modifiedAt: number;
}

interface LeanBuildResult {
  success: boolean;
  projectName?: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
  error: string | null;
  command?: string;
}

const IMPORT_LIMIT = 500;

function formatDuration(durationMs: number): string {
  return durationMs >= 1000
    ? `${(durationMs / 1000).toFixed(1)}s`
    : `${durationMs}ms`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function LeanPanel() {
  const open = useDocumentStore((s) => s.isLeanOpen);
  const setOpen = useDocumentStore((s) => s.setLeanOpen);
  const addFiles = useDocumentStore((s) => s.addFiles);

  const [status, setStatus] = useState<LeanStatus | null>(null);
  const [files, setFiles] = useState<LeanFile[]>([]);
  const [build, setBuild] = useState<LeanBuildResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProject = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const statusResponse = await fetch("/api/lean/status", {
        cache: "no-store",
      });
      const nextStatus = (await statusResponse.json()) as LeanStatus;
      setStatus(nextStatus);

      if (!nextStatus.configured) {
        setFiles([]);
        return;
      }

      const filesResponse = await fetch("/api/lean/files", {
        cache: "no-store",
      });
      const data = (await filesResponse.json()) as {
        files?: LeanFile[];
        error?: string;
      };
      if (!filesResponse.ok) {
        throw new Error(data.error || "Could not list Lean sources");
      }
      setFiles(data.files ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not reach the local Lean bridge",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadProject();
  }, [open, loadProject]);

  const runBuild = async () => {
    if (isBuilding) return;
    setIsBuilding(true);
    setError(null);
    try {
      const response = await fetch("/api/lean/build", { method: "POST" });
      const result = (await response.json()) as LeanBuildResult;
      if (!response.ok || typeof result.success !== "boolean") {
        setError(result.error || "Lean build failed");
        toast.error(result.error || "Lean build failed");
        return;
      }
      setBuild(result);
      if (result.success) {
        toast.success("Lean build succeeded");
      } else {
        toast.error(result.error || "Lean build failed");
      }
    } catch (buildError) {
      setError(
        buildError instanceof Error
          ? buildError.message
          : "Could not run the Lean build",
      );
    } finally {
      setIsBuilding(false);
    }
  };

  const importSources = async () => {
    if (isImporting) return;
    const selected = files.slice(0, IMPORT_LIMIT);
    if (selected.length === 0) return;

    setIsImporting(true);
    setError(null);
    try {
      const imported = [];
      for (const file of selected) {
        const response = await fetch(
          `/api/lean/file?path=${encodeURIComponent(file.path)}`,
          { cache: "no-store" },
        );
        const data = (await response.json()) as {
          path?: string;
          content?: string;
          error?: string;
        };
        if (!response.ok || !data.path || data.content === undefined) {
          throw new Error(data.error || `Could not read ${file.path}`);
        }
        imported.push({
          name: data.path.split("/").pop() ?? data.path,
          path: data.path,
          type: "tex" as const,
          content: data.content,
        });
      }

      addFiles(imported);
      toast.success(
        `Imported ${imported.length} Lean file${imported.length === 1 ? "" : "s"}`,
        {
          description:
            files.length > selected.length
              ? `Only the first ${IMPORT_LIMIT} files were imported.`
              : "Matching .lean paths were refreshed in this project.",
        },
      );
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Could not import Lean sources",
      );
    } finally {
      setIsImporting(false);
    }
  };

  const output = build
    ? [build.stdout, build.stderr]
        .filter((part) => part.trim())
        .join("\n")
        .trim()
    : "";
  const configured = Boolean(status?.configured);

  return (
    <Sheet open={open} onOpenChange={setOpen} modal={false}>
      <SheetContent
        overlay={false}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[560px]"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="border-hairline border-b px-4 py-3 pr-12">
          <SheetTitle className="flex items-center gap-2 text-base">
            <FileCodeIcon className="size-4 text-primary" />
            Lean Lake
          </SheetTitle>
          <SheetDescription className="text-xs">
            Inspect and build a local Lake project. The bridge is read-only; it
            never writes to your Lean sources.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          {isLoading && !status && (
            <div className="flex items-center gap-2 rounded-lg border border-hairline bg-card/30 p-3 text-muted-foreground text-xs">
              <Loader2Icon className="size-4 animate-spin" />
              Checking the local Lean bridge...
            </div>
          )}

          {!isLoading && !configured && (
            <div className="space-y-3">
              <div className="rounded-lg border border-hairline bg-card/30 p-4">
                <div className="flex items-center gap-2 font-medium text-sm">
                  <TerminalIcon className="size-4 text-primary" />
                  Connect a local Lake project
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                  {error ||
                    status?.error ||
                    "The local bridge is not configured yet. Start the LaTeX/sync API with a Lean project root."}
                </p>
                <pre className="mt-3 overflow-x-auto rounded-md bg-surface-dark p-3 font-mono text-[10px] text-on-dark-soft leading-relaxed">
                  {`LEAN_PROJECT_DIR="/absolute/path/to/lake-project" \\
  pnpm --filter @open-prism/latex-api dev`}
                </pre>
                <p className="mt-2 text-[10px] text-muted-foreground leading-relaxed">
                  Run the web app locally so the browser can reach the bridge.
                  Optionally set the same <code>LEAN_BRIDGE_TOKEN</code> in the
                  API environment and <code>apps/web/.env.local</code>.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => void loadProject()}
                disabled={isLoading}
              >
                <RefreshCwIcon
                  className={cn("size-3.5", isLoading && "animate-spin")}
                />
                Retry connection
              </Button>
            </div>
          )}

          {configured && status && (
            <>
              <div className="rounded-lg border border-hairline bg-card/30 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FolderGit2Icon className="size-4 shrink-0 text-primary" />
                      <span className="truncate font-medium text-sm">
                        {status.projectName ?? "Lean project"}
                      </span>
                      {status.hasLakefile && (
                        <span className="rounded border border-[#5db8a6]/30 bg-[#5db8a6]/10 px-1.5 py-0.5 font-mono text-[#2a8f83] text-[8px] uppercase tracking-[0.1em]">
                          Lake
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 truncate font-mono text-[9px] text-muted-foreground">
                      {status.projectPath}
                    </div>
                    {status.lakeVersion && (
                      <div className="mt-1 truncate font-mono text-[9px] text-muted-foreground/75">
                        {status.lakeVersion}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    onClick={() => void loadProject()}
                    disabled={isLoading}
                    title="Refresh Lean project"
                  >
                    <RefreshCwIcon
                      className={cn("size-3.5", isLoading && "animate-spin")}
                    />
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => void runBuild()}
                    disabled={isBuilding}
                  >
                    {isBuilding ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      <HammerIcon className="size-3.5" />
                    )}
                    {isBuilding ? "Building..." : "Build project"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void importSources()}
                    disabled={isImporting || files.length === 0}
                  >
                    {isImporting ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      <DownloadIcon className="size-3.5" />
                    )}
                    Import Lean sources
                  </Button>
                </div>
                <p className="mt-2 text-[9px] text-muted-foreground leading-relaxed">
                  Import copies `.lean` files into this browser project for chat
                  context. Matching paths are refreshed; local files are never
                  changed.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-[10px] text-destructive leading-relaxed">
                  <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
                  {error}
                </div>
              )}

              {build && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      {build.success ? (
                        <CheckCircle2Icon className="size-4 text-[#2a8f83]" />
                      ) : (
                        <AlertCircleIcon className="size-4 text-destructive" />
                      )}
                      <span className="font-medium">
                        {build.success ? "Build succeeded" : "Build failed"}
                      </span>
                      <span className="font-mono text-[9px] text-muted-foreground">
                        {formatDuration(build.durationMs)}
                        {build.exitCode !== null
                          ? ` · exit ${build.exitCode}`
                          : ""}
                      </span>
                    </div>
                    {build.command && (
                      <span className="truncate font-mono text-[8px] text-muted-foreground/70">
                        {build.command}
                      </span>
                    )}
                  </div>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-dark p-3 font-mono text-[9px] text-on-dark-soft leading-relaxed">
                    {output ||
                      build.error ||
                      (build.success
                        ? "lake build completed with no output."
                        : "lake build failed without output.")}
                  </pre>
                </div>
              )}

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-[9px] text-muted-foreground uppercase tracking-[0.14em]">
                    Lean sources
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground">
                    {files.length} file{files.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-hairline bg-card/20 p-1.5">
                  {files.length === 0 ? (
                    <p className="px-2 py-3 text-[10px] text-muted-foreground">
                      No `.lean` sources found outside ignored build
                      directories.
                    </p>
                  ) : (
                    files.map((file) => (
                      <div
                        key={file.path}
                        className="flex items-center justify-between gap-2 rounded px-2 py-1.5 font-mono text-[10px] hover:bg-background/70"
                      >
                        <span className="min-w-0 truncate">{file.path}</span>
                        <span className="shrink-0 text-[9px] text-muted-foreground">
                          {formatBytes(file.size)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          <p className="text-[9px] text-muted-foreground leading-relaxed">
            The bridge runs `lake build` in the configured project directory and
            exposes only `.lean` reads. It does not accept arbitrary commands or
            paths, and it never writes to the local project.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
