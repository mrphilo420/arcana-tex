"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloudIcon,
  FileTextIcon,
  FolderIcon,
  FolderKanbanIcon,
  FolderPlusIcon,
  FolderUpIcon,
  GithubIcon,
  Grid2X2Icon,
  HardDriveIcon,
  LayoutListIcon,
  ListFilterIcon,
  Loader2Icon,
  MonitorIcon,
  MoonIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  PresentationIcon,
  SearchIcon,
  Share2Icon,
  SunIcon,
  Trash2Icon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import packageJson from "@/package.json";
import { ArcanaMark } from "@/components/brand/arcana-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectCard } from "@/components/home/project-card";
import {
  createBeamerProject,
  createDefaultProject,
} from "@/lib/projects/defaults";
import {
  createFolder,
  createProject,
  deleteFolder,
  deleteProject,
  listFolders,
  listProjects,
  renameFolder,
  renameProject,
  setProjectFolder,
  uniqueProjectName,
} from "@/lib/projects/repository";
import {
  type ImportedProject,
  importProjectFromDataTransfer,
  importProjectFromFileList,
} from "@/lib/project-import";
import {
  clearProjectSyncSettings,
  deleteSyncSnapshot,
  loadProjectSyncSettings,
  getSyncUserName,
} from "@/lib/sync/settings";
import type { ProjectFolder, ProjectMeta } from "@/lib/storage/schema";
import { cn } from "@/lib/utils";

const DIRECTORY_INPUT_PROPS: Record<string, string> = {
  webkitdirectory: "",
  directory: "",
};

type LibraryView = "all" | "yours" | "shared" | `folder:${string}`;
type SortKey = "name" | "created" | "updated";
type SortDirection = "asc" | "desc";
type LayoutMode = "list" | "grid";
type FolderDialogState =
  | { mode: "create" }
  | { mode: "rename"; folder: ProjectFolder }
  | null;

function folderIdFromView(view: LibraryView): string | null {
  return view.startsWith("folder:") ? view.slice("folder:".length) : null;
}

function compactDate(timestamp: number): string {
  const days = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "OP"
  );
}

function NavItem({
  icon: Icon,
  label,
  count,
  active,
  collapsed,
  onClick,
}: {
  icon: typeof FolderIcon;
  label: string;
  count?: number;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={collapsed ? label : undefined}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[12px] transition-colors",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/55 hover:text-foreground",
        collapsed && "justify-center px-0",
      )}
      onClick={onClick}
    >
      <Icon className={cn("size-4 shrink-0", active && "text-primary")} />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {count !== undefined && (
            <span className="font-mono text-[9px] text-muted-foreground">
              {count}
            </span>
          )}
        </>
      )}
    </button>
  );
}

export function HomePage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [sharedProjectIds, setSharedProjectIds] = useState<Set<string>>(
    new Set(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<LibraryView>("yours");
  const [layout, setLayout] = useState<LayoutMode>("list");
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userName, setUserName] = useState("You");

  const [renameTarget, setRenameTarget] = useState<ProjectMeta | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ProjectMeta | null>(null);
  const [folderDialog, setFolderDialog] = useState<FolderDialogState>(null);
  const [folderName, setFolderName] = useState("");
  const [deleteFolderTarget, setDeleteFolderTarget] =
    useState<ProjectFolder | null>(null);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);

    try {
      const [nextProjects, nextFolders] = await Promise.all([
        listProjects(),
        listFolders(),
      ]);
      setProjects(nextProjects);
      setFolders(nextFolders);
      setSharedProjectIds(
        new Set(
          nextProjects
            .filter(
              (project) =>
                loadProjectSyncSettings(project.id)?.sharedWithMe === true,
            )
            .map((project) => project.id),
        ),
      );
    } catch (error) {
      console.error("Failed to load projects", error);
      toast.error("Could not load your projects");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  useEffect(() => {
    setMounted(true);
    setUserName(getSyncUserName());
  }, []);

  useEffect(() => {
    document.title = "Projects · arcanaTeX";
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [refresh]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") ||
        (event.key === "/" && !isTyping)
      ) {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const yoursCount = projects.filter(
    (project) => !sharedProjectIds.has(project.id),
  ).length;
  const sharedCount = projects.filter((project) =>
    sharedProjectIds.has(project.id),
  ).length;
  const activeFolderId = folderIdFromView(view);
  const activeFolder = folders.find((folder) => folder.id === activeFolderId);

  const folderProjectCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const project of projects) {
      if (!project.folderId) continue;
      counts.set(project.folderId, (counts.get(project.folderId) ?? 0) + 1);
    }
    return counts;
  }, [projects]);

  const visibleProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let list = projects;

    if (view === "shared") {
      list = list.filter((project) => sharedProjectIds.has(project.id));
    } else if (view === "yours") {
      list = list.filter((project) => !sharedProjectIds.has(project.id));
    } else if (activeFolderId) {
      list = list.filter((project) => project.folderId === activeFolderId);
    }

    if (needle) {
      list = list.filter((project) => project.searchText.includes(needle));
    }

    return [...list].sort((a, b) => {
      let result = 0;
      if (sortKey === "name") result = a.name.localeCompare(b.name);
      else if (sortKey === "created") result = a.createdAt - b.createdAt;
      else result = a.updatedAt - b.updatedAt;
      return sortDirection === "asc" ? result : -result;
    });
  }, [
    activeFolderId,
    projects,
    query,
    sharedProjectIds,
    sortDirection,
    sortKey,
    view,
  ]);

  const groupedProjects = useMemo(() => {
    if (view === "shared" || activeFolderId || query.trim()) return null;

    const knownFolderIds = new Set(folders.map((folder) => folder.id));
    const groups = folders.map((folder) => ({
      folder,
      projects: visibleProjects.filter(
        (project) => project.folderId === folder.id,
      ),
    }));
    const unfiled = visibleProjects.filter(
      (project) => !project.folderId || !knownFolderIds.has(project.folderId),
    );

    return [
      ...groups,
      ...(unfiled.length > 0
        ? [{ folder: null as ProjectFolder | null, projects: unfiled }]
        : []),
    ];
  }, [activeFolderId, folders, query, view, visibleProjects]);

  const setSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(nextKey);
      setSortDirection(nextKey === "name" ? "asc" : "desc");
    }
  };

  const handleNewProject = async (folderId?: string | null) => {
    if (isCreating) return;
    setIsCreating(true);

    try {
      const project = await createDefaultProject(folderId ?? activeFolderId);
      router.push(`/project/${project.id}`);
    } catch (error) {
      console.error("Failed to create project", error);
      toast.error("Could not create a project");
      setIsCreating(false);
    }
  };

  const handleNewBeamerProject = async () => {
    if (isCreating) return;
    setIsCreating(true);

    try {
      const project = await createBeamerProject();
      router.push(`/project/${project.id}`);
    } catch (error) {
      console.error("Failed to create Beamer project", error);
      toast.error("Could not create a Beamer presentation");
      setIsCreating(false);
    }
  };

  const openImportedProject = useCallback(
    async (imported: ImportedProject) => {
      if (imported.files.length === 0) {
        toast.error("No supported files found in that folder");
        return;
      }

      const existing = await listProjects();
      const name = uniqueProjectName(
        imported.projectName,
        existing.map((project) => project.name),
      );

      const project = await createProject({
        name,
        files: imported.files,
        folderId: activeFolderId,
      });

      toast.success(`Imported “${name}”`, {
        description: `${imported.files.length} file${
          imported.files.length === 1 ? "" : "s"
        }${imported.skipped.length ? ` · ${imported.skipped.length} skipped` : ""}`,
      });

      router.push(`/project/${project.id}`);
    },
    [activeFolderId, router],
  );

  const handleFolderUpload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      setIsImporting(true);
      try {
        const imported = await importProjectFromFileList(files, {
          stripRoot: true,
        });
        await openImportedProject(imported);
      } catch (error) {
        console.error("Failed to import folder", error);
        toast.error("Could not read that folder");
      } finally {
        setIsImporting(false);
      }
    },
    [openImportedProject],
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
      const imported = await importProjectFromDataTransfer(event.dataTransfer);
      await openImportedProject(imported);
    } catch (error) {
      console.error("Failed to import dropped items", error);
      toast.error("Could not read the dropped folder");
    } finally {
      setIsImporting(false);
    }
  };

  const openRenameDialog = (project: ProjectMeta) => {
    setRenameTarget(project);
    setRenameValue(project.name);
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) return;

    try {
      await renameProject(renameTarget.id, name);
      setRenameTarget(null);
      setRenameValue("");
      await refresh();
      toast.success("Project renamed");
    } catch (error) {
      console.error("Failed to rename project", error);
      toast.error("Could not rename the project");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    const syncSettings = loadProjectSyncSettings(deleteTarget.id);

    try {
      await deleteProject(deleteTarget.id);
      clearProjectSyncSettings(deleteTarget.id);

      if (syncSettings?.token) {
        deleteSyncSnapshot(deleteTarget.id, syncSettings.token).catch((error) =>
          console.error("Failed to delete sync snapshot", error),
        );
      }

      setDeleteTarget(null);
      await refresh();
      toast.success("Project deleted");
    } catch (error) {
      console.error("Failed to delete project", error);
      toast.error("Could not delete the project");
    }
  };

  const openCreateFolder = () => {
    setFolderName("");
    setFolderDialog({ mode: "create" });
  };

  const openRenameFolder = (folder: ProjectFolder) => {
    setFolderName(folder.name);
    setFolderDialog({ mode: "rename", folder });
  };

  const handleFolderSubmit = async () => {
    if (!folderDialog) return;
    const name = folderName.trim();
    if (!name) return;

    const duplicate = folders.some(
      (folder) =>
        folder.name.toLowerCase() === name.toLowerCase() &&
        (folderDialog.mode === "create" ||
          folder.id !== folderDialog.folder.id),
    );
    if (duplicate) {
      toast.error("A folder with that name already exists");
      return;
    }

    try {
      if (folderDialog.mode === "create") {
        const folder = await createFolder(name);
        await refresh();
        setView(`folder:${folder.id}`);
        toast.success("Folder created");
      } else {
        await renameFolder(folderDialog.folder.id, name);
        await refresh();
        toast.success("Folder renamed");
      }
      setFolderDialog(null);
      setFolderName("");
    } catch (error) {
      console.error("Failed to save folder", error);
      toast.error("Could not save the folder");
    }
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolderTarget) return;

    try {
      await deleteFolder(deleteFolderTarget.id);
      if (view === `folder:${deleteFolderTarget.id}`) setView("yours");
      setDeleteFolderTarget(null);
      await refresh();
      toast.success("Folder deleted", {
        description: "Projects inside it were kept.",
      });
    } catch (error) {
      console.error("Failed to delete folder", error);
      toast.error("Could not delete the folder");
    }
  };

  const handleMoveProject = async (
    projectId: string,
    folderId: string | null,
  ) => {
    try {
      await setProjectFolder(projectId, folderId);
      await refresh();
      toast.success(
        folderId
          ? `Moved to ${folders.find((folder) => folder.id === folderId)?.name ?? "folder"}`
          : "Moved out of folder",
      );
    } catch (error) {
      console.error("Failed to move project", error);
      toast.error("Could not move the project");
    }
  };

  const pageTitle = activeFolder
    ? activeFolder.name
    : view === "all"
      ? "All Projects"
      : view === "shared"
        ? "Shared with you"
        : "Your Projects";

  const pageDescription = activeFolder
    ? `${visibleProjects.length} project${visibleProjects.length === 1 ? "" : "s"} in this folder`
    : view === "shared"
      ? "Projects opened from a collaborator’s sync link"
      : view === "all"
        ? "Every project stored in this browser"
        : "Your local manuscripts and folders";

  const renderProjectMenu = (project: ProjectMeta) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
          title="Project actions"
        >
          <MoreHorizontalIcon className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => router.push(`/project/${project.id}`)}>
          <FileTextIcon className="mr-2 size-4" />
          Open project
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <FolderIcon className="mr-2 size-4" />
            Move to folder
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem
              onClick={() => void handleMoveProject(project.id, null)}
              disabled={!project.folderId}
            >
              <FolderKanbanIcon className="mr-2 size-4" />
              No folder
              {!project.folderId && <CheckIcon className="ml-auto size-3.5" />}
            </DropdownMenuItem>
            {folders.map((folder) => (
              <DropdownMenuItem
                key={folder.id}
                onClick={() => void handleMoveProject(project.id, folder.id)}
                disabled={project.folderId === folder.id}
              >
                <FolderIcon className="mr-2 size-4" />
                <span className="truncate">{folder.name}</span>
                {project.folderId === folder.id && (
                  <CheckIcon className="ml-auto size-3.5" />
                )}
              </DropdownMenuItem>
            ))}
            {folders.length === 0 && (
              <DropdownMenuItem disabled>
                Create a folder first
              </DropdownMenuItem>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openRenameDialog(project)}>
          <PencilIcon className="mr-2 size-4" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={() => setDeleteTarget(project)}
        >
          <Trash2Icon className="mr-2 size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderFolderMenu = (folder: ProjectFolder, alwaysVisible = false) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "size-7 data-[state=open]:opacity-100",
            !alwaysVisible && "opacity-0 group-hover:opacity-100",
          )}
          title="Folder actions"
        >
          <MoreHorizontalIcon className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => setView(`folder:${folder.id}`)}>
          <FolderIcon className="mr-2 size-4" />
          Open folder
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void handleNewProject(folder.id)}>
          <PlusIcon className="mr-2 size-4" />
          New project here
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openRenameFolder(folder)}>
          <PencilIcon className="mr-2 size-4" />
          Rename folder
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={() => setDeleteFolderTarget(folder)}
        >
          <Trash2Icon className="mr-2 size-4" />
          Delete folder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderProjectRow = (project: ProjectMeta, indented = true) => (
    <div
      key={project.id}
      className="group grid grid-cols-[minmax(0,1fr)_120px_46px] items-center border-hairline border-b last:border-b-0 hover:bg-card/50"
    >
      <button
        type="button"
        className={cn(
          "flex min-w-0 items-center gap-2.5 py-2.5 pr-3 text-left",
          indented ? "pl-11" : "pl-4",
        )}
        onClick={() => router.push(`/project/${project.id}`)}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-hairline bg-popover text-muted-foreground">
          <FileTextIcon className="size-3.5" />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium text-[13px]">
              {project.name}
            </span>
            {sharedProjectIds.has(project.id) && (
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-hairline px-1.5 py-0.5 text-[8px] text-muted-foreground uppercase tracking-[0.12em]">
                <CloudIcon className="size-2.5" />
                Shared
              </span>
            )}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] text-muted-foreground">
            <span className="font-mono">
              {project.mainFilePath ?? "untitled.tex"}
            </span>
            <span>·</span>
            <span>
              {project.fileCount} file{project.fileCount === 1 ? "" : "s"}
            </span>
          </span>
        </span>
      </button>
      <span
        className="text-[11px] text-muted-foreground"
        title={new Date(project.createdAt).toLocaleString()}
      >
        {compactDate(project.createdAt)}
      </span>
      <div className="flex justify-end pr-2">{renderProjectMenu(project)}</div>
    </div>
  );

  const renderTableBody = () => {
    if (isLoading) {
      return (
        <div className="space-y-0">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="grid grid-cols-[minmax(0,1fr)_120px_46px] items-center border-hairline border-b px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="size-7 animate-pulse rounded-md bg-muted" />
                <div className="h-4 w-48 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-3 w-10 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      );
    }

    if (groupsAreVisible && groupedProjects) {
      return groupedProjects.map((group) => (
        <div key={group.folder?.id ?? "unfiled"}>
          {group.folder ? (
            <div className="group grid grid-cols-[minmax(0,1fr)_120px_46px] items-center border-hairline border-b bg-muted/25 hover:bg-muted/40">
              <button
                type="button"
                className="flex min-w-0 items-center gap-2.5 py-2.5 pr-3 pl-4 text-left"
                onClick={() => setView(`folder:${group.folder!.id}`)}
              >
                <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                <FolderIcon className="size-4 shrink-0 text-primary/80" />
                <span className="truncate font-medium text-[12px]">
                  {group.folder.name}
                </span>
              </button>
              <span className="text-[10px] text-muted-foreground">
                {group.projects.length} project
                {group.projects.length === 1 ? "" : "s"}
              </span>
              <div className="flex justify-end pr-2">
                {renderFolderMenu(group.folder)}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)_120px_46px] items-center border-hairline border-b bg-muted/20">
              <div className="flex items-center gap-2.5 py-2 pr-3 pl-4 text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
                <FolderKanbanIcon className="size-3.5" />
                Unfiled
              </div>
              <span className="text-[10px] text-muted-foreground">
                {group.projects.length} project
                {group.projects.length === 1 ? "" : "s"}
              </span>
              <span />
            </div>
          )}
          {group.projects.map((project) => renderProjectRow(project, true))}
        </div>
      ));
    }

    return visibleProjects.map((project) => renderProjectRow(project, false));
  };

  const groupsAreVisible =
    !activeFolderId && view !== "shared" && !query.trim() && folders.length > 0;

  const renderEmpty = () => {
    if (projects.length === 0) {
      return (
        <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-hairline bg-card/30 px-6 py-14 text-center">
          <div className="mb-5 flex size-14 items-center justify-center rounded-full border border-hairline bg-background text-primary">
            <ArcanaMark className="size-7" />
          </div>
          <h2 className="font-serif text-3xl tracking-[-0.02em]">
            No projects yet
          </h2>
          <p className="mt-2 max-w-md text-muted-foreground text-sm leading-relaxed">
            Start with a blank paper, or drag a folder anywhere on this page to
            bring in an existing manuscript with all of its sections, figures,
            and references.
          </p>
          <div className="mt-5 flex items-center gap-2">
            <Button onClick={() => void handleNewProject()}>
              <PlusIcon className="size-4" />
              New project
            </Button>
            <Button
              variant="outline"
              onClick={() => folderInputRef.current?.click()}
            >
              <FolderUpIcon className="size-4" />
              Import folder
            </Button>
          </div>
        </div>
      );
    }

    if (view === "shared" && visibleProjects.length === 0 && !query.trim()) {
      return (
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-hairline bg-card/30 px-6 py-14 text-center">
          <Share2Icon className="mb-4 size-8 text-muted-foreground/55" />
          <h2 className="font-serif text-2xl tracking-[-0.02em]">
            Nothing shared with you yet
          </h2>
          <p className="mt-2 max-w-md text-muted-foreground text-sm leading-relaxed">
            When a collaborator sends a sync link, opening it adds the project
            here. Shared projects stay editable in this browser.
          </p>
        </div>
      );
    }

    if (
      view === "yours" &&
      projects.length > 0 &&
      visibleProjects.length === 0 &&
      !query.trim()
    ) {
      return (
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-hairline bg-card/30 px-6 py-14 text-center">
          <UsersIcon className="mb-4 size-8 text-muted-foreground/55" />
          <h2 className="font-serif text-2xl tracking-[-0.02em]">
            No local projects yet
          </h2>
          <p className="mt-2 max-w-md text-muted-foreground text-sm leading-relaxed">
            Every project in this browser was opened from a share link. You can
            find those under Shared with you.
          </p>
          <Button
            variant="outline"
            className="mt-5"
            onClick={() => setView("shared")}
          >
            Open shared projects
          </Button>
        </div>
      );
    }

    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-hairline bg-card/30 px-6 py-14 text-center">
        <SearchIcon className="mb-4 size-8 text-muted-foreground/55" />
        <h2 className="font-serif text-2xl tracking-[-0.02em]">
          {query.trim() ? "No matching projects" : "This folder is empty"}
        </h2>
        <p className="mt-2 max-w-sm text-muted-foreground text-sm">
          {query.trim()
            ? `Nothing matches “${query.trim()}”. Try a different project name, file path, or phrase from the document.`
            : "Create a project here, or move an existing project into this folder."}
        </p>
        <div className="mt-5 flex items-center gap-2">
          {query.trim() ? (
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
            >
              Clear search
            </Button>
          ) : (
            <Button onClick={() => void handleNewProject()}>
              <PlusIcon className="size-4" />
              New project here
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      data-testid="home-dropzone"
      className="flex h-full min-h-0 overflow-hidden bg-background"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <aside
        className={cn(
          "hidden h-full min-h-0 shrink-0 flex-col border-hairline border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
          sidebarCollapsed ? "w-16" : "w-[228px]",
        )}
      >
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-sidebar-border border-b",
            sidebarCollapsed ? "justify-center px-2" : "gap-2 px-3",
          )}
        >
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2.5"
            title="arcanaTeX"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-card text-primary">
              <ArcanaMark className="size-4" />
            </span>
            {!sidebarCollapsed && (
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="font-semibold text-[14px] tracking-[-0.015em]">
                    arcanaTeX
                  </span>
                  <span className="rounded border border-hairline px-1 py-0.5 font-mono text-[7px] text-muted-foreground">
                    BETA
                  </span>
                </span>
                <span className="mt-0.5 block font-medium text-[8px] text-muted-foreground uppercase tracking-[0.16em]">
                  Local workspace
                </span>
              </span>
            )}
          </Link>
          {!sidebarCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto size-6 shrink-0"
              onClick={() => setSidebarCollapsed(true)}
              title="Collapse sidebar"
            >
              <ChevronRightIcon className="size-3.5 rotate-180" />
            </Button>
          )}
        </div>

        {sidebarCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="mx-auto mt-2 size-7"
            onClick={() => setSidebarCollapsed(false)}
            title="Expand sidebar"
          >
            <ChevronRightIcon className="size-3.5" />
          </Button>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          <div className={cn("space-y-0.5", sidebarCollapsed && "space-y-1")}>
            <NavItem
              icon={FolderKanbanIcon}
              label="All Projects"
              count={projects.length}
              active={view === "all"}
              collapsed={sidebarCollapsed}
              onClick={() => setView("all")}
            />
            <NavItem
              icon={FileTextIcon}
              label="Your Projects"
              count={yoursCount}
              active={view === "yours"}
              collapsed={sidebarCollapsed}
              onClick={() => setView("yours")}
            />
            <NavItem
              icon={UsersIcon}
              label="Shared with you"
              count={sharedCount}
              active={view === "shared"}
              collapsed={sidebarCollapsed}
              onClick={() => setView("shared")}
            />
          </div>

          <div
            className={cn(
              "mt-5 flex items-center justify-between",
              sidebarCollapsed ? "justify-center" : "px-2",
            )}
          >
            {!sidebarCollapsed && (
              <span className="font-medium text-[9px] text-muted-foreground uppercase tracking-[0.18em]">
                Folders
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={openCreateFolder}
              title="New folder"
            >
              <PlusIcon className="size-3.5" />
            </Button>
          </div>

          <div className={cn("mt-1 space-y-0.5", sidebarCollapsed && "mt-2")}>
            {folders.map((folder) => {
              const active = view === `folder:${folder.id}`;
              return (
                <div key={folder.id} className="group flex items-center">
                  <button
                    type="button"
                    title={sidebarCollapsed ? folder.name : undefined}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[11px] transition-colors",
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/55 hover:text-foreground",
                      sidebarCollapsed && "justify-center px-0",
                    )}
                    onClick={() => setView(`folder:${folder.id}`)}
                  >
                    <FolderIcon
                      className={cn(
                        "size-3.5 shrink-0",
                        active && "text-primary",
                      )}
                    />
                    {!sidebarCollapsed && (
                      <>
                        <span className="min-w-0 flex-1 truncate">
                          {folder.name}
                        </span>
                        <span className="font-mono text-[9px] text-muted-foreground">
                          {folderProjectCounts.get(folder.id) ?? 0}
                        </span>
                      </>
                    )}
                  </button>
                  {!sidebarCollapsed && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 shrink-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                          title="Folder actions"
                        >
                          <MoreHorizontalIcon className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => setView(`folder:${folder.id}`)}
                        >
                          <FolderIcon className="mr-2 size-4" />
                          Open folder
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => void handleNewProject(folder.id)}
                        >
                          <PlusIcon className="mr-2 size-4" />
                          New project
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openRenameFolder(folder)}
                        >
                          <PencilIcon className="mr-2 size-4" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteFolderTarget(folder)}
                        >
                          <Trash2Icon className="mr-2 size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}
            {folders.length === 0 && !sidebarCollapsed && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[10px] text-muted-foreground hover:bg-sidebar-accent/50"
                onClick={openCreateFolder}
              >
                <FolderPlusIcon className="size-3.5" />
                Create your first folder
              </button>
            )}
          </div>
        </div>

        <div
          className={cn(
            "flex shrink-0 items-center gap-2 border-sidebar-border border-t p-3",
            sidebarCollapsed && "flex-col gap-2 px-1",
          )}
        >
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground font-medium text-[10px] text-background"
            title={userName}
          >
            {initials(userName)}
          </span>
          {!sidebarCollapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-[11px]">
                  {userName}
                </div>
                <div className="flex items-center gap-1 text-[8px] text-muted-foreground uppercase tracking-[0.12em]">
                  <HardDriveIcon className="size-2.5" />
                  In this browser
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0"
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
                  <MonitorIcon className="size-3.5" />
                ) : theme === "system" ? (
                  <MonitorIcon className="size-3.5" />
                ) : theme === "light" ? (
                  <SunIcon className="size-3.5" />
                ) : (
                  <MoonIcon className="size-3.5" />
                )}
              </Button>
            </>
          )}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[68px] shrink-0 items-center gap-3 border-hairline border-b bg-background px-4 lg:px-6">
          <div className="min-w-0">
            <h1 className="truncate font-serif text-[26px] leading-none tracking-[-0.025em]">
              {pageTitle}
            </h1>
            <p className="mt-1 hidden truncate text-[10px] text-muted-foreground sm:block">
              {pageDescription}
            </p>
          </div>

          {activeFolder && (
            <div className="hidden shrink-0 items-center sm:flex">
              {renderFolderMenu(activeFolder, true)}
            </div>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            <div className="relative hidden w-[240px] lg:block">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                aria-label="Search projects"
                className="h-9 border-hairline bg-card/60 pr-8 pl-9 shadow-none"
              />
              {query ? (
                <button
                  type="button"
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                  title="Clear search"
                >
                  <XIcon className="size-3.5" />
                </button>
              ) : (
                <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded border border-hairline bg-background px-1 py-0.5 font-sans text-[9px] text-muted-foreground">
                  /
                </kbd>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    "size-9 border-hairline bg-card/60",
                    view !== "yours" && "text-primary",
                  )}
                  title="Filter projects"
                >
                  <ListFilterIcon className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
                  Show
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setView("all")}>
                  <FolderKanbanIcon className="mr-2 size-4" />
                  All projects
                  {view === "all" && <CheckIcon className="ml-auto size-3.5" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setView("yours")}>
                  <FileTextIcon className="mr-2 size-4" />
                  Your projects
                  {view === "yours" && (
                    <CheckIcon className="ml-auto size-3.5" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setView("shared")}>
                  <UsersIcon className="mr-2 size-4" />
                  Shared with you
                  {view === "shared" && (
                    <CheckIcon className="ml-auto size-3.5" />
                  )}
                </DropdownMenuItem>
                {folders.length > 0 && <DropdownMenuSeparator />}
                {folders.map((folder) => (
                  <DropdownMenuItem
                    key={folder.id}
                    onClick={() => setView(`folder:${folder.id}`)}
                  >
                    <FolderIcon className="mr-2 size-4" />
                    <span className="truncate">{folder.name}</span>
                    {view === `folder:${folder.id}` && (
                      <CheckIcon className="ml-auto size-3.5" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="hidden items-center rounded-md border border-hairline bg-card/60 p-0.5 sm:flex">
              <button
                type="button"
                className={cn(
                  "flex size-7 items-center justify-center rounded transition-colors",
                  layout === "list"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setLayout("list")}
                title="List view"
                aria-label="List view"
              >
                <LayoutListIcon className="size-3.5" />
              </button>
              <button
                type="button"
                className={cn(
                  "flex size-7 items-center justify-center rounded transition-colors",
                  layout === "grid"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setLayout("grid")}
                title="Grid view"
                aria-label="Grid view"
              >
                <Grid2X2Icon className="size-3.5" />
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="hidden h-9 gap-1.5 border-hairline bg-card/60 md:inline-flex"
              onClick={() => folderInputRef.current?.click()}
              disabled={isImporting}
            >
              {isImporting ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <FolderUpIcon className="size-3.5" />
              )}
              Import
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="h-9 gap-1.5" disabled={isCreating}>
                  {isCreating ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <PlusIcon className="size-3.5" />
                  )}
                  New
                  <ChevronDownIcon className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => void handleNewProject()}>
                  <FileTextIcon className="mr-2 size-4" />
                  {activeFolder ? "New project here" : "New project"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleNewBeamerProject()}>
                  <PresentationIcon className="mr-2 size-4" />
                  Beamer presentation
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openCreateFolder}>
                  <FolderPlusIcon className="mr-2 size-4" />
                  New folder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => folderInputRef.current?.click()}
                >
                  <FolderUpIcon className="mr-2 size-4" />
                  Import folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-5">
          <div className="mb-3 flex items-center gap-2 lg:hidden">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search projects"
                aria-label="Search projects"
                className="h-9 border-hairline bg-card/60 pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="size-9 border-hairline"
              onClick={() => folderInputRef.current?.click()}
              title="Import folder"
            >
              <FolderUpIcon className="size-3.5" />
            </Button>
          </div>

          {isLoading ? (
            <div className="overflow-hidden rounded-xl border border-hairline bg-card/20">
              {renderTableBody()}
            </div>
          ) : visibleProjects.length === 0 ? (
            renderEmpty()
          ) : layout === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpen={(id) => router.push(`/project/${id}`)}
                  onRename={openRenameDialog}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-hairline bg-card/20">
              <div className="grid grid-cols-[minmax(0,1fr)_120px_46px] items-center border-hairline border-b bg-muted/25 px-4">
                <button
                  type="button"
                  className="flex h-9 items-center gap-1.5 text-left font-medium text-[9px] text-muted-foreground uppercase tracking-[0.16em] hover:text-foreground"
                  onClick={() => setSort("name")}
                >
                  Name
                  {sortKey === "name" ? (
                    sortDirection === "asc" ? (
                      <ArrowUpIcon className="size-3 text-primary" />
                    ) : (
                      <ArrowDownIcon className="size-3 text-primary" />
                    )
                  ) : (
                    <ArrowUpDownIcon className="size-3" />
                  )}
                </button>
                <button
                  type="button"
                  className="flex h-9 items-center gap-1.5 text-left font-medium text-[9px] text-muted-foreground uppercase tracking-[0.16em] hover:text-foreground"
                  onClick={() => setSort("created")}
                >
                  Created
                  {sortKey === "created" ? (
                    sortDirection === "asc" ? (
                      <ArrowUpIcon className="size-3 text-primary" />
                    ) : (
                      <ArrowDownIcon className="size-3 text-primary" />
                    )
                  ) : (
                    <ArrowUpDownIcon className="size-3" />
                  )}
                </button>
                <span />
              </div>
              {renderTableBody()}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[#5db8a6]" />
              Local-first · projects stay in this browser
            </span>
            <span className="flex items-center gap-3">
              {layout === "list" && (
                <span>
                  {visibleProjects.length} shown · {projects.length} total
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <GithubIcon className="size-3" />v{packageJson.version}
              </span>
            </span>
          </div>
        </div>
      </main>

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

      {isDragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-6 backdrop-blur-sm">
          <div className="flex flex-col items-center rounded-2xl border border-primary/40 bg-card px-16 py-12 text-center shadow-[0_24px_80px_rgba(20,20,19,0.14)]">
            <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FolderUpIcon className="size-6" />
            </span>
            <p className="font-medium font-serif text-2xl">
              Drop a folder to import
            </p>
            <p className="mt-2 text-muted-foreground text-sm">
              Subfolders, figures, and bibliography files are preserved.
            </p>
          </div>
        </div>
      )}

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null);
            setRenameValue("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleRename();
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleRename()}
              disabled={!renameValue.trim()}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{deleteTarget?.name}”?</DialogTitle>
            <DialogDescription>
              This removes the project and its local chat history from this
              browser. A sync snapshot on the server is also deleted when
              available.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()}>
              Delete project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={folderDialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFolderDialog(null);
            setFolderName("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {folderDialog?.mode === "rename" ? "Rename folder" : "New folder"}
            </DialogTitle>
            <DialogDescription>
              Folders organize projects on this device. They do not move files
              inside a manuscript.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={folderName}
            onChange={(event) => setFolderName(event.target.value)}
            placeholder="Folder name"
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleFolderSubmit();
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleFolderSubmit()}
              disabled={!folderName.trim()}
            >
              {folderDialog?.mode === "rename" ? "Rename" : "Create folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteFolderTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteFolderTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{deleteFolderTarget?.name}”?</DialogTitle>
            <DialogDescription>
              The folder is removed, but the projects inside it are kept and
              moved to Unfiled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteFolderTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeleteFolder()}
            >
              Delete folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
