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
  SearchIcon,
  TerminalIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  LEAN_PROJECT_STORAGE_KEY,
  LEAN_TOOLCHAIN_LABEL_STORAGE_KEY,
  LEAN_TOOLCHAIN_STORAGE_KEY,
} from "@/lib/lean";
import { useDocumentStore } from "@/stores/document-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const IMPORT_LIMIT = 500;

interface LeanStatus {
  configured: boolean;
  projectName?: string;
  projectPath?: string;
  hasLakefile?: boolean;
  toolchainPin?: string | null;
  pinnedToolchainId?: string | null;
  lakeCommand?: string;
  lakeVersion?: string | null;
  buildInProgress?: boolean;
  error?: string;
}

interface LeanProject {
  path: string;
  name: string;
  toolchainPin: string | null;
}

interface LeanToolchain {
  id: string;
  label: string;
  version: string;
}

interface LeanFile {
  path: string;
  size: number;
  modifiedAt: number;
}

interface LeanBuildResult {
  success: boolean;
  projectName?: string;
  projectPath?: string;
  toolchainId?: string;
  toolchainVersion?: string | null;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
  error: string | null;
  command?: string;
}

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
  const [projects, setProjects] = useState<LeanProject[]>([]);
  const [toolchains, setToolchains] = useState<LeanToolchain[]>([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [selectedToolchain, setSelectedToolchain] = useState("");
  const [customPath, setCustomPath] = useState("");
  const [files, setFiles] = useState<LeanFile[]>([]);
  const [build, setBuild] = useState<LeanBuildResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProject = useCallback(
    async (
      projectPath: string,
      availableToolchains: LeanToolchain[],
    ): Promise<void> => {
      const path = projectPath.trim();
      if (!path) {
        setError("Enter the absolute path to a Lake project.");
        return;
      }

      setIsLoading(true);
      setError(null);
      setBuild(null);

      try {
        const query = new URLSearchParams({ path });
        const statusResponse = await fetch(`/api/lean/status?${query}`, {
          cache: "no-store",
        });
        const nextStatus = (await statusResponse.json()) as LeanStatus;
        setStatus(nextStatus);

        if (!statusResponse.ok || !nextStatus.configured) {
          setFiles([]);
          setError(
            nextStatus.error ||
              "That path is not a Lake project with a lakefile.",
          );
          return;
        }

        const resolvedPath = nextStatus.projectPath ?? path;
        setSelectedPath(resolvedPath);
        setCustomPath(resolvedPath);
        window.localStorage.setItem(LEAN_PROJECT_STORAGE_KEY, resolvedPath);
        setProjects((previous) => {
          const next = {
            path: resolvedPath,
            name:
              nextStatus.projectName ??
              resolvedPath.split("/").pop() ??
              resolvedPath,
            toolchainPin: nextStatus.toolchainPin ?? null,
          };
          return previous.some((project) => project.path === resolvedPath)
            ? previous
            : [next, ...previous];
        });

        const savedToolchain =
          window.localStorage.getItem(LEAN_TOOLCHAIN_STORAGE_KEY) ?? "";
        const availableIds = new Set(
          availableToolchains.map((toolchain) => toolchain.id),
        );
        const defaultToolchain =
          (nextStatus.pinnedToolchainId &&
          availableIds.has(nextStatus.pinnedToolchainId)
            ? nextStatus.pinnedToolchainId
            : null) ??
          (availableIds.has(savedToolchain) ? savedToolchain : null) ??
          availableToolchains[0]?.id ??
          "";
        setSelectedToolchain(defaultToolchain);
        if (defaultToolchain) {
          window.localStorage.setItem(
            LEAN_TOOLCHAIN_STORAGE_KEY,
            defaultToolchain,
          );
          const selected = availableToolchains.find(
            (toolchain) => toolchain.id === defaultToolchain,
          );
          if (selected) {
            window.localStorage.setItem(
              LEAN_TOOLCHAIN_LABEL_STORAGE_KEY,
              selected.label,
            );
          }
        }

        const filesResponse = await fetch(`/api/lean/files?${query}`, {
          cache: "no-store",
        });
        const filesData = (await filesResponse.json()) as {
          files?: LeanFile[];
          error?: string;
        };
        if (!filesResponse.ok) {
          throw new Error(filesData.error || "Could not list Lean sources");
        }
        setFiles(filesData.files ?? []);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not reach the local Lean bridge",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const loadDiscovery = useCallback(async (): Promise<void> => {
    setIsScanning(true);
    setError(null);

    try {
      const [projectsResponse, toolchainsResponse] = await Promise.all([
        fetch("/api/lean/projects", { cache: "no-store" }),
        fetch("/api/lean/toolchains", { cache: "no-store" }),
      ]);
      const projectsData = (await projectsResponse.json()) as {
        projects?: LeanProject[];
        error?: string;
      };
      const toolchainsData = (await toolchainsResponse.json()) as {
        toolchains?: LeanToolchain[];
        error?: string;
      };
      if (!projectsResponse.ok) {
        throw new Error(
          projectsData.error || "Could not scan for Lake projects",
        );
      }
      if (!toolchainsResponse.ok) {
        throw new Error(
          toolchainsData.error || "Could not list Lean toolchains",
        );
      }

      const nextProjects = projectsData.projects ?? [];
      const nextToolchains = toolchainsData.toolchains ?? [];
      setProjects(nextProjects);
      setToolchains(nextToolchains);

      const savedPath =
        window.localStorage.getItem(LEAN_PROJECT_STORAGE_KEY)?.trim() ||
        nextProjects[0]?.path ||
        "";
      setCustomPath(savedPath);
      if (savedPath) {
        await loadProject(savedPath, nextToolchains);
      } else {
        setSelectedPath("");
        setStatus(null);
        setFiles([]);
        setError(
          "No Lake project was found. Enter the absolute path to your project below.",
        );
      }
    } catch (scanError) {
      setError(
        scanError instanceof Error
          ? scanError.message
          : "Could not reach the local Lean bridge",
      );
    } finally {
      setIsScanning(false);
    }
  }, [loadProject]);

  useEffect(() => {
    if (!open) return;
    void loadDiscovery();
  }, [open, loadDiscovery]);

  const chooseProject = (projectPath: string) => {
    setSelectedPath(projectPath);
    window.localStorage.setItem(LEAN_PROJECT_STORAGE_KEY, projectPath);
    void loadProject(projectPath, toolchains);
  };

  const useCustomProject = () => {
    if (!customPath.trim()) {
      setError("Enter the absolute path to a Lake project.");
      return;
    }
    chooseProject(customPath.trim());
  };

  const chooseToolchain = (id: string) => {
    setSelectedToolchain(id);
    window.localStorage.setItem(LEAN_TOOLCHAIN_STORAGE_KEY, id);
    const toolchain = toolchains.find((entry) => entry.id === id);
    if (toolchain) {
      window.localStorage.setItem(
        LEAN_TOOLCHAIN_LABEL_STORAGE_KEY,
        toolchain.label,
      );
    }
  };

  const runBuild = async () => {
    if (isBuilding) return;
    if (!selectedPath) {
      setError("Choose a Lake project first.");
      return;
    }
    if (toolchains.length > 1 && !selectedToolchain) {
      setError("Choose a Lean version before building.");
      return;
    }

    setIsBuilding(true);
    setError(null);
    try {
      const response = await fetch("/api/lean/build", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: selectedPath,
          toolchain: selectedToolchain || undefined,
        }),
      });
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
    if (!selectedPath) {
      setError("Choose a Lake project first.");
      return;
    }
    const selected = files.slice(0, IMPORT_LIMIT);
    if (selected.length === 0) return;

    setIsImporting(true);
    setError(null);
    try {
      const imported = [];
      for (const file of selected) {
        const query = new URLSearchParams({
          project: selectedPath,
          path: file.path,
        });
        const response = await fetch(`/api/lean/file?${query}`, {
          cache: "no-store",
        });
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

  const configured = Boolean(status?.configured);
  const output = build
    ? [build.stdout, build.stderr]
        .filter((part) => part.trim())
        .join("\n")
        .trim()
    : "";
  const needsProject = !selectedPath;
  const needsToolchain = toolchains.length > 1 && !selectedToolchain;
  const selectedToolchainInfo = toolchains.find(
    (toolchain) => toolchain.id === selectedToolchain,
  );
  const projectOptions =
    selectedPath && !projects.some((project) => project.path === selectedPath)
      ? [
          {
            path: selectedPath,
            name: status?.projectName ?? selectedPath.split("/").pop() ?? "",
            toolchainPin: status?.toolchainPin ?? null,
          },
          ...projects,
        ]
      : projects;

  return (
    <Sheet open={open} onOpenChange={setOpen} modal={false}>
      <SheetContent
        overlay={false}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[580px]"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="border-hairline border-b px-4 py-3 pr-12">
          <SheetTitle className="flex items-center gap-2 text-base">
            <FileCodeIcon className="size-4 text-primary" />
            Lean Lake
          </SheetTitle>
          <SheetDescription className="text-xs">
            Choose a local Lake project and Lean version, then build or import
            sources. The bridge is read-only.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-[0.75rem] text-muted-foreground uppercase tracking-[0.14em]">
                Lake project
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => void loadDiscovery()}
                disabled={isScanning || isLoading}
                title="Rescan local Lake projects"
              >
                <RefreshCwIcon
                  className={cn("size-3.5", isScanning && "animate-spin")}
                />
              </Button>
            </div>

            {projectOptions.length > 0 ? (
              <Select
                value={selectedPath}
                onValueChange={chooseProject}
                disabled={isScanning || isLoading || isBuilding}
              >
                <SelectTrigger className="w-full" aria-label="Lake project">
                  <SelectValue placeholder="Choose a Lake project" />
                </SelectTrigger>
                <SelectContent>
                  {projectOptions.map((project) => (
                    <SelectItem key={project.path} value={project.path}>
                      <span className="font-medium">{project.name}</span>
                      <span className="ml-2 font-mono text-[0.75rem] text-muted-foreground">
                        {project.path}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="rounded-lg border border-hairline border-dashed bg-card/20 p-3">
                <div className="flex items-center gap-2 font-medium text-[0.875rem]">
                  <SearchIcon className="size-3.5 text-primary" />
                  No Lake project detected
                </div>
                <p className="mt-1 text-[0.75rem] text-muted-foreground leading-relaxed">
                  Enter the absolute path to a directory containing a
                  `lakefile.lean` or `lakefile.toml`.
                </p>
              </div>
            )}

            <div className="flex gap-1.5">
              <Input
                value={customPath}
                onChange={(event) => setCustomPath(event.target.value)}
                placeholder="/absolute/path/to/lake-project"
                className="h-8 flex-1 font-mono text-[0.75rem]"
                aria-label="Custom Lake project path"
                onKeyDown={(event) => {
                  if (event.key === "Enter") useCustomProject();
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 shrink-0 text-[0.75rem]"
                onClick={useCustomProject}
                disabled={isScanning || isLoading || isBuilding}
              >
                Use path
              </Button>
            </div>
            <p className="text-[0.75rem] text-muted-foreground leading-relaxed">
              Discovery checks Elan&apos;s known projects and common document
              folders. You can always enter a path manually.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-[0.75rem] text-destructive leading-relaxed">
              <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 rounded-lg border border-hairline bg-card/30 p-3 text-muted-foreground text-xs">
              <Loader2Icon className="size-4 animate-spin" />
              Loading Lake project...
            </div>
          )}

          {!isLoading && !configured && !needsProject && (
            <div className="rounded-lg border border-hairline bg-card/30 p-4">
              <div className="flex items-center gap-2 font-medium text-sm">
                <TerminalIcon className="size-4 text-primary" />
                Connect a local Lake project
              </div>
              <p className="mt-2 text-[0.875rem] text-muted-foreground leading-relaxed">
                {status?.error ||
                  "The local bridge is not configured yet. Start the LaTeX/sync API with a Lean project root."}
              </p>
              <pre className="mt-3 overflow-x-auto rounded-md bg-surface-dark p-3 font-mono text-[0.75rem] text-on-dark-soft leading-relaxed">
                {`LEAN_PROJECT_DIR="/absolute/path/to/lake-project" \\
  pnpm --filter @open-prism/latex-api dev`}
              </pre>
              <p className="mt-2 text-[0.75rem] text-muted-foreground leading-relaxed">
                Run the web app locally so the browser can reach the bridge.
                Optionally set the same <code>LEAN_BRIDGE_TOKEN</code> in the
                API environment and <code>apps/web/.env.local</code>.
              </p>
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
                        <span className="rounded border border-[#5db8a6]/30 bg-[#5db8a6]/10 px-1.5 py-0.5 font-mono text-[#2a8f83] text-[0.75rem] uppercase tracking-[0.1em]">
                          Lake
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 truncate font-mono text-[0.75rem] text-muted-foreground">
                      {status.projectPath}
                    </div>
                    {status.toolchainPin && (
                      <div className="mt-1 truncate font-mono text-[0.75rem] text-muted-foreground/75">
                        pinned: {status.toolchainPin}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3">
                  <span className="font-medium text-[0.75rem] text-muted-foreground uppercase tracking-[0.14em]">
                    Lean version
                  </span>
                  {toolchains.length === 0 ? (
                    <p className="mt-1 text-[0.75rem] text-muted-foreground">
                      No Elan toolchains found. Install Lean 4 with Elan or set
                      LAKE_BIN.
                    </p>
                  ) : toolchains.length === 1 ? (
                    <div className="mt-1 rounded-md border border-hairline bg-background/50 px-2.5 py-2 font-mono text-[0.75rem]">
                      {toolchains[0].label}
                    </div>
                  ) : (
                    <Select
                      value={selectedToolchain}
                      onValueChange={chooseToolchain}
                      disabled={isBuilding}
                    >
                      <SelectTrigger
                        className="mt-1 w-full"
                        aria-label="Lean version"
                      >
                        <SelectValue placeholder="Choose a Lean version" />
                      </SelectTrigger>
                      <SelectContent>
                        {toolchains.map((toolchain) => (
                          <SelectItem key={toolchain.id} value={toolchain.id}>
                            {toolchain.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {status.toolchainPin && !status.pinnedToolchainId && (
                    <p className="mt-1 text-[#b9822f] text-[0.75rem] leading-relaxed">
                      The pinned toolchain is not installed. Choose an installed
                      Lean version explicitly.
                    </p>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => void runBuild()}
                    disabled={isBuilding || needsToolchain}
                    title={
                      needsToolchain
                        ? "Choose a Lean version before building"
                        : undefined
                    }
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
                {selectedToolchainInfo && (
                  <p className="mt-2 text-[0.75rem] text-muted-foreground">
                    Selected: {selectedToolchainInfo.label}
                  </p>
                )}
                <p className="mt-2 text-[0.75rem] text-muted-foreground leading-relaxed">
                  Import copies `.lean` files into this browser project for chat
                  context. Matching paths are refreshed; local files are never
                  changed.
                </p>
              </div>

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
                      <span className="font-mono text-[0.75rem] text-muted-foreground">
                        {formatDuration(build.durationMs)}
                        {build.exitCode !== null
                          ? ` · exit ${build.exitCode}`
                          : ""}
                        {build.toolchainVersion
                          ? ` · Lean ${build.toolchainVersion}`
                          : ""}
                      </span>
                    </div>
                    {build.command && (
                      <span className="truncate font-mono text-[0.75rem] text-muted-foreground/70">
                        {build.command}
                      </span>
                    )}
                  </div>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-dark p-3 font-mono text-[0.75rem] text-on-dark-soft leading-relaxed">
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
                  <span className="font-medium text-[0.75rem] text-muted-foreground uppercase tracking-[0.14em]">
                    Lean sources
                  </span>
                  <span className="font-mono text-[0.75rem] text-muted-foreground">
                    {files.length} file{files.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-hairline bg-card/20 p-1.5">
                  {files.length === 0 ? (
                    <p className="px-2 py-3 text-[0.75rem] text-muted-foreground">
                      No `.lean` sources found outside ignored build
                      directories.
                    </p>
                  ) : (
                    files.map((file) => (
                      <div
                        key={file.path}
                        className="flex items-center justify-between gap-2 rounded px-2 py-1.5 font-mono text-[0.75rem] hover:bg-background/70"
                      >
                        <span className="min-w-0 truncate">{file.path}</span>
                        <span className="shrink-0 text-[0.75rem] text-muted-foreground">
                          {formatBytes(file.size)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          <p className="text-[0.75rem] text-muted-foreground leading-relaxed">
            The bridge runs `lake build` in the selected project directory and
            exposes only `.lean` reads. It does not accept arbitrary commands,
            and it never writes to the local project. Only connect trusted
            projects: `lake build` executes the project&apos;s Lakefile.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
