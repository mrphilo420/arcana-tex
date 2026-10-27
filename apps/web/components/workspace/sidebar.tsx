"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UIMessage } from "ai";
import {
  CheckIcon,
  ChevronDownIcon,
  FileTextIcon,
  FolderIcon,
  FolderKanbanIcon,
  FolderUpIcon,
  GithubIcon,
  HashIcon,
  ListIcon,
  Loader2Icon,
  MessageCircleIcon,
  MessagesSquareIcon,
  NetworkIcon,
  PlusIcon,
  RefreshCwIcon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";
import packageJson from "@/package.json";
import {
  isPristineProject,
  useDocumentStore,
  type ProjectFile,
} from "@/stores/document-store";
import { loadChatMessages } from "@/lib/projects/chat-history";
import { listProjects } from "@/lib/projects/repository";
import { getSyncUserName } from "@/lib/sync/settings";
import type { ProjectMeta } from "@/lib/storage/schema";
import {
  type ImportedProject,
  importProjectFromDataTransfer,
  importProjectFromFileList,
} from "@/lib/project-import";
import { Button } from "@/components/ui/button";
import { FileTree } from "./file-tree";
import { FileTreeVisualizer } from "./file-tree-visualizer";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const DIRECTORY_INPUT_PROPS: Record<string, string> = {
  webkitdirectory: "",
  directory: "",
};

interface TocItem {
  level: number;
  title: string;
  line: number;
}

function messageText(message: UIMessage): string {
  return message.parts
    .map((part) =>
      "text" in part && typeof part.text === "string" ? part.text : "",
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMarkdownTableOfContents(content: string): TocItem[] {
  const toc: TocItem[] = [];

  content.split("\n").forEach((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (!match) return;
    toc.push({
      level: match[1].length,
      title: match[2].replace(/[*_`~]/g, "").trim(),
      line: index + 1,
    });
  });

  return toc;
}

function parseTableOfContents(content: string): TocItem[] {
  const lines = content.split("\n");
  const toc: TocItem[] = [];

  const sectionRegex =
    /\\(section|subsection|subsubsection|chapter|part)\*?\s*\{([^}]*)\}/;

  const levelMap: Record<string, number> = {
    part: 0,
    chapter: 1,
    section: 2,
    subsection: 3,
    subsubsection: 4,
  };

  lines.forEach((line, index) => {
    const match = line.match(sectionRegex);
    if (match) {
      const [, type, title] = match;
      toc.push({
        level: levelMap[type] ?? 2,
        title: title.trim(),
        line: index + 1,
      });
    }
  });

  return toc;
}

export function Sidebar() {
  const files = useDocumentStore((s) => s.files);
  const activeFileId = useDocumentStore((s) => s.activeFileId);
  const mainFileId = useDocumentStore((s) => s.mainFileId);
  const setActiveFile = useDocumentStore((s) => s.setActiveFile);
  const addFile = useDocumentStore((s) => s.addFile);
  const addFiles = useDocumentStore((s) => s.addFiles);
  const importProject = useDocumentStore((s) => s.importProject);
  const setMainFile = useDocumentStore((s) => s.setMainFile);
  const deleteFile = useDocumentStore((s) => s.deleteFile);
  const renameFile = useDocumentStore((s) => s.renameFile);
  const content = useDocumentStore(
    (s) => s.files.find((file) => file.id === s.activeFileId)?.content ?? "",
  );
  const activeFilePath = useDocumentStore(
    (s) => s.files.find((file) => file.id === s.activeFileId)?.path ?? "",
  );
  const requestJumpToPosition = useDocumentStore(
    (s) => s.requestJumpToPosition,
  );
  const projectId = useDocumentStore((s) => s.projectId);
  const projectName = useDocumentStore((s) => s.projectName);
  const setThreadOpen = useDocumentStore((s) => s.setThreadOpen);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"files" | "chats">("files");
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [chatMessages, setChatMessages] = useState<UIMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [userName, setUserName] = useState("Guest");

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [visualizerOpen, setVisualizerOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameFileId, setRenameFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<ImportedProject | null>(
    null,
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const toc = useMemo(
    () =>
      /\.(?:md|markdown)$/i.test(activeFilePath)
        ? parseMarkdownTableOfContents(content)
        : parseTableOfContents(content),
    [content, activeFilePath],
  );
  const userInitials =
    userName
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "G";
  const projectInitials =
    projectName
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "P";

  const refreshChats = useCallback(async () => {
    if (!projectId) return;
    setChatLoading(true);
    try {
      setChatMessages((await loadChatMessages(projectId)) ?? []);
    } catch (error) {
      console.error("Failed to load project chat", error);
    } finally {
      setChatLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setUserName(getSyncUserName());
  }, []);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch((error) => console.error("Failed to load projects", error));
  }, [projectId]);

  useEffect(() => {
    setProjects((current) =>
      current.map((project) =>
        project.id === projectId ? { ...project, name: projectName } : project,
      ),
    );
  }, [projectId, projectName]);

  useEffect(() => {
    if (activeTab === "chats") void refreshChats();
  }, [activeTab, refreshChats]);

  const handleTocClick = useCallback(
    (line: number) => {
      const lines = content.split("\n");
      let position = 0;
      for (let i = 0; i < line - 1 && i < lines.length; i++) {
        position += lines[i].length + 1;
      }
      requestJumpToPosition(position);
    },
    [content, requestJumpToPosition],
  );

  const applyProjectImport = useCallback(
    (project: ImportedProject) => {
      importProject(project.projectName, project.files);

      const skipped = project.skipped.length
        ? ` · ${project.skipped.length} file${project.skipped.length === 1 ? "" : "s"} skipped`
        : "";

      toast.success(`Opened “${project.projectName}”`, {
        description: `${project.files.length} file${project.files.length === 1 ? "" : "s"}${skipped}`,
      });
    },
    [importProject],
  );

  const requestProjectImport = useCallback(
    (project: ImportedProject) => {
      if (project.files.length === 0) {
        toast.error("No supported files found in that folder");
        return;
      }

      if (isPristineProject(useDocumentStore.getState().files)) {
        applyProjectImport(project);
        return;
      }

      setPendingImport(project);
    },
    [applyProjectImport],
  );

  const handleAddTexFile = () => {
    const name = newFileName.trim() || "untitled.tex";
    const finalName = /\.(?:tex|ltx|lean|md|markdown)$/i.test(name)
      ? name
      : `${name}.tex`;
    addFile({
      name: finalName,
      type: "tex",
      content: finalName.toLowerCase().endsWith(".lean")
        ? "-- Lean 4 proof sketch\nimport Mathlib\n\nnamespace Paper\n\ntheorem main_result : True := by\n  trivial\n\nend Paper\n"
        : finalName.toLowerCase().endsWith(".md") ||
            finalName.toLowerCase().endsWith(".markdown")
          ? "# New document\n\nWrite your notes or review report here.\n"
          : "\\documentclass{article}\n\n\\begin{document}\n\n% Your content here\n\n\\end{document}\n",
    });
    setNewFileName("");
    setAddDialogOpen(false);
  };

  const handleFileUpload = useCallback(
    async (uploadedFiles: File[] | FileList | null) => {
      if (!uploadedFiles || uploadedFiles.length === 0) return;

      setIsImporting(true);
      try {
        const result = await importProjectFromFileList(uploadedFiles);
        if (result.files.length === 0) {
          toast.error("No supported files found");
          return;
        }

        const count = addFiles(result.files);
        toast.success(`Added ${count} file${count === 1 ? "" : "s"}`, {
          description: result.skipped.length
            ? `${result.skipped.length} file${result.skipped.length === 1 ? "" : "s"} skipped`
            : undefined,
        });
      } catch {
        toast.error("Could not read those files");
      } finally {
        setIsImporting(false);
      }
    },
    [addFiles],
  );

  const handleFolderUpload = useCallback(
    async (uploadedFiles: File[] | FileList | null) => {
      if (!uploadedFiles || uploadedFiles.length === 0) return;

      setIsImporting(true);
      try {
        const project = await importProjectFromFileList(uploadedFiles, {
          stripRoot: true,
        });
        requestProjectImport(project);
      } catch {
        toast.error("Could not read that folder");
      } finally {
        setIsImporting(false);
      }
    },
    [requestProjectImport],
  );

  const handleDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);

    if (isImporting) return;
    setIsImporting(true);

    try {
      const result = await importProjectFromDataTransfer(event.dataTransfer);

      if (result.isProject) {
        requestProjectImport(result);
        return;
      }

      if (result.files.length === 0) {
        toast.error("No supported files found");
        return;
      }

      const count = addFiles(result.files);
      toast.success(`Added ${count} file${count === 1 ? "" : "s"}`, {
        description: result.skipped.length
          ? `${result.skipped.length} file${result.skipped.length === 1 ? "" : "s"} skipped`
          : undefined,
      });
    } catch {
      toast.error("Could not read the dropped items");
    } finally {
      setIsImporting(false);
    }
  };

  const openRenameDialog = (file: ProjectFile) => {
    setRenameFileId(file.id);
    setRenameValue(file.name);
    setRenameDialogOpen(true);
  };

  const handleRename = () => {
    if (renameFileId && renameValue.trim()) {
      renameFile(renameFileId, renameValue.trim());
    }
    setRenameDialogOpen(false);
    setRenameFileId(null);
    setRenameValue("");
  };

  return (
    <div
      data-testid="sidebar-dropzone"
      className="relative flex h-full flex-col bg-sidebar text-sidebar-foreground"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex h-12 items-center border-sidebar-border border-b px-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-sidebar-accent/70"
              title="Switch project"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-medium text-[0.75rem] text-primary-foreground">
                {projectInitials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-[0.875rem]">
                  {projectName}
                </span>
                <span className="block font-medium text-[0.625rem] text-muted-foreground uppercase tracking-[0.16em]">
                  Local project
                </span>
              </span>
              <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-[0.75rem] text-muted-foreground uppercase tracking-[0.14em]">
              Switch project
            </DropdownMenuLabel>
            {projects.slice(0, 10).map((project) => (
              <DropdownMenuItem
                key={project.id}
                onClick={() => router.push(`/project/${project.id}`)}
              >
                <FolderIcon className="mr-2 size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{project.name}</span>
                {project.id === projectId && (
                  <CheckIcon className="size-3.5 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/">
                <FolderKanbanIcon className="mr-2 size-4" />
                All projects
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex h-9 shrink-0 items-center gap-0 border-sidebar-border border-b px-2">
        <button
          type="button"
          className={cn(
            "relative flex h-full items-center gap-1.5 px-2 text-[0.8125rem] transition-colors",
            activeTab === "files"
              ? "font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setActiveTab("files")}
        >
          <FolderIcon className="size-3.5" />
          Files
          <span className="text-[0.6875rem] text-muted-foreground">
            {files.length}
          </span>
          {activeTab === "files" && (
            <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-primary" />
          )}
        </button>
        <button
          type="button"
          className={cn(
            "relative flex h-full items-center gap-1.5 px-2 text-[0.8125rem] transition-colors",
            activeTab === "chats"
              ? "font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setActiveTab("chats")}
        >
          <MessagesSquareIcon className="size-3.5" />
          Chats
          {activeTab === "chats" && (
            <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-primary" />
          )}
        </button>

        <div className="ml-auto flex items-center gap-0.5">
          {activeTab === "files" ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0"
              onClick={() => setVisualizerOpen(true)}
              title="Visualize file tree"
              aria-label="Visualize file tree"
            >
              <NetworkIcon className="size-3.5" />
            </Button>
          ) : null}
          {activeTab === "files" ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0"
                  title="Add or import files"
                >
                  {isImporting ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <PlusIcon className="size-3.5" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setAddDialogOpen(true)}>
                  <FileTextIcon className="mr-2 size-4" />
                  New file
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <UploadIcon className="mr-2 size-4" />
                  Upload Files
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => folderInputRef.current?.click()}
                >
                  <FolderUpIcon className="mr-2 size-4" />
                  Import Folder…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => void refreshChats()}
              disabled={chatLoading}
              title="Refresh chats"
            >
              <RefreshCwIcon
                className={cn("size-3.5", chatLoading && "animate-spin")}
              />
            </Button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(event) => {
          const selected = Array.from(event.target.files ?? []);
          event.target.value = "";
          handleFileUpload(selected);
        }}
      />

      <input
        {...DIRECTORY_INPUT_PROPS}
        ref={folderInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(event) => {
          const selected = Array.from(event.target.files ?? []);
          event.target.value = "";
          handleFolderUpload(selected);
        }}
      />

      {activeTab === "files" ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <FileTree
              files={files}
              activeFileId={activeFileId}
              mainFileId={mainFileId}
              onSelect={setActiveFile}
              onRename={openRenameDialog}
              onDelete={deleteFile}
              onSetMain={setMainFile}
            />
          </div>

          <div className="flex h-9 items-center gap-2 border-sidebar-border border-t px-3">
            <ListIcon className="size-4 text-muted-foreground" />
            <span className="font-medium text-xs">Outline</span>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {toc.length > 0 ? (
              toc.map((item, index) => (
                <button
                  key={index}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-sidebar-accent/50"
                  style={{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }}
                  onClick={() => handleTocClick(item.line)}
                >
                  <HashIcon className="size-3 shrink-0 text-muted-foreground" />
                  <span className="truncate">{item.title}</span>
                </button>
              ))
            ) : (
              <div className="px-2 py-1 text-muted-foreground text-xs">
                No sections found
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {chatLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-xs">
              <Loader2Icon className="size-4 animate-spin" />
              Loading conversation…
            </div>
          ) : chatMessages.length === 0 ? (
            <div className="rounded-lg border border-dashed p-5 text-center">
              <MessageCircleIcon className="mx-auto mb-2 size-7 text-muted-foreground/50" />
              <p className="font-medium text-sm">No conversation yet</p>
              <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                Ask the assistant about this project. The thread is saved here.
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => setThreadOpen(true)}
              >
                <MessageCircleIcon className="size-3.5" />
                Open assistant
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-md border border-hairline bg-card/45 px-2.5 py-2">
                <div>
                  <div className="font-medium text-[0.8125rem]">
                    Project conversation
                  </div>
                  <div className="mt-0.5 text-[0.6875rem] text-muted-foreground uppercase tracking-[0.12em]">
                    Saved with this project
                  </div>
                </div>
                <span className="font-mono text-[0.6875rem] text-muted-foreground">
                  {chatMessages.length}
                </span>
              </div>

              {chatMessages
                .filter((message) => messageText(message).length > 0)
                .slice(-5)
                .map((message) => (
                  <div
                    key={message.id}
                    className="rounded-lg border border-hairline bg-card/35 p-2.5"
                  >
                    <div className="mb-1 flex items-center gap-1.5">
                      <span
                        className={cn(
                          "font-medium text-[0.6875rem] uppercase tracking-[0.14em]",
                          message.role === "user"
                            ? "text-primary"
                            : "text-[#2a8f83]",
                        )}
                      >
                        {message.role === "user" ? "You" : "Assistant"}
                      </span>
                    </div>
                    <p className="line-clamp-3 text-[0.8125rem] text-muted-foreground leading-relaxed">
                      {messageText(message)}
                    </p>
                  </div>
                ))}

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setThreadOpen(true)}
              >
                <MessageCircleIcon className="size-3.5" />
                Open assistant
              </Button>
              <p className="px-1 pb-2 text-[0.6875rem] text-muted-foreground leading-relaxed">
                The assistant can read your project files and edit the document.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex h-14 items-center gap-2 border-sidebar-border border-t px-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground font-medium text-[0.75rem] text-background">
          {userInitials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-[0.8125rem]">
            {userName}
          </div>
          <div className="text-[0.625rem] text-muted-foreground uppercase tracking-[0.14em]">
            Personal workspace
          </div>
        </div>
        <Button variant="ghost" size="icon" className="size-6" asChild>
          <a
            href="https://github.com/mrphilo420/arcana-tex"
            target="_blank"
            rel="noopener noreferrer"
            title={`arcanaTeX v${packageJson.version}`}
          >
            <GithubIcon className="size-3.5" />
          </a>
        </Button>
      </div>

      {isDragging && (
        <div className="pointer-events-none absolute inset-2 z-20 flex flex-col items-center justify-center rounded-lg border-2 border-primary border-dashed bg-background/90 p-4 text-center">
          <FolderUpIcon className="mb-3 size-10 text-primary" />
          <p className="font-medium text-sm">Drop folder to open project</p>
          <p className="mt-1 text-muted-foreground text-xs">
            or drop files to add them to this project
          </p>
        </div>
      )}

      {/* Add File Dialog */}
      <FileTreeVisualizer
        files={files}
        projectName={projectName}
        activeFileId={activeFileId}
        mainFileId={mainFileId}
        open={visualizerOpen}
        onOpenChange={setVisualizerOpen}
        onSelect={setActiveFile}
      />

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New file</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="filename.tex, proof.lean, or notes.md"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddTexFile();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTexFile}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleRename}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Project Dialog */}
      <Dialog
        open={pendingImport !== null}
        onOpenChange={(open) => {
          if (!open) setPendingImport(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Open “{pendingImport?.projectName}”?</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-muted-foreground text-sm">
            Importing this folder replaces your current project and its{" "}
            {files.length} file{files.length === 1 ? "" : "s"} with{" "}
            {pendingImport?.files.length ?? 0} file
            {pendingImport?.files.length === 1 ? "" : "s"}.
            <br />
            <br />
            Everything is stored locally in your browser.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingImport(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!pendingImport) return;
                applyProjectImport(pendingImport);
                setPendingImport(null);
              }}
            >
              Import Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
