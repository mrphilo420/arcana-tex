"use client";

import { useMemo, useState } from "react";
import {
  BookOpenIcon,
  ChevronRightIcon,
  FileCodeIcon,
  FileIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  ImageIcon,
  MoreHorizontalIcon,
  PencilIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import {
  type FileTreeNode,
  type ProjectFile,
  buildFileTree,
  isLatexDocumentFile,
} from "@/lib/project-files";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FileTreeProps {
  files: ProjectFile[];
  activeFileId: string;
  mainFileId: string | null;
  onSelect: (id: string) => void;
  onRename: (file: ProjectFile) => void;
  onDelete: (id: string) => void;
  onSetMain: (id: string) => void;
}

function FileTypeIcon({ file }: { file: ProjectFile }) {
  if (file.type === "image") {
    return <ImageIcon className="size-4 shrink-0" />;
  }
  if (file.type === "binary") {
    return <FileIcon className="size-4 shrink-0" />;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "bib") {
    return <BookOpenIcon className="size-4 shrink-0" />;
  }
  if (
    extension === "cls" ||
    extension === "sty" ||
    extension === "def" ||
    extension === "bst"
  ) {
    return <FileCodeIcon className="size-4 shrink-0" />;
  }

  return <FileTextIcon className="size-4 shrink-0" />;
}

function TreeRow({
  node,
  depth,
  collapsed,
  onToggle,
  activeFileId,
  mainFileId,
  onSelect,
  onRename,
  onDelete,
  onSetMain,
  fileCount,
}: {
  node: FileTreeNode;
  depth: number;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
  activeFileId: string;
  mainFileId: string | null;
  onSelect: (id: string) => void;
  onRename: (file: ProjectFile) => void;
  onDelete: (id: string) => void;
  onSetMain: (id: string) => void;
  fileCount: number;
}) {
  const paddingLeft = 8 + depth * 12;

  if (node.kind === "folder") {
    const isCollapsed = collapsed.has(node.path);

    return (
      <div>
        <button
          type="button"
          className="flex w-full items-center gap-1.5 rounded-md py-1.5 text-left text-sm transition-colors hover:bg-sidebar-accent/50"
          style={{ paddingLeft }}
          onClick={() => onToggle(node.path)}
        >
          <ChevronRightIcon
            className={cn(
              "size-3 shrink-0 text-muted-foreground transition-transform",
              !isCollapsed && "rotate-90",
            )}
          />
          {isCollapsed ? (
            <FolderIcon className="size-4 shrink-0" />
          ) : (
            <FolderOpenIcon className="size-4 shrink-0" />
          )}
          <span className="truncate font-medium text-[13px]">{node.name}</span>
        </button>

        {!isCollapsed && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeRow
                key={child.path}
                node={child}
                depth={depth + 1}
                collapsed={collapsed}
                onToggle={onToggle}
                activeFileId={activeFileId}
                mainFileId={mainFileId}
                onSelect={onSelect}
                onRename={onRename}
                onDelete={onDelete}
                onSetMain={onSetMain}
                fileCount={fileCount}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const file = node.file;
  if (!file) return null;

  const isActive = file.id === activeFileId;
  const isMain = file.id === mainFileId;

  return (
    <div
      className={cn(
        "group flex w-full items-center gap-1 rounded-md pr-1 text-left text-sm transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "hover:bg-sidebar-accent/50",
      )}
      style={{ paddingLeft }}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden py-1.5"
        onClick={() => onSelect(file.id)}
        title={file.path}
      >
        <FileTypeIcon file={file} />
        <span className="truncate">{file.name}</span>
        {isMain && (
          <StarIcon
            className="size-3 shrink-0 fill-amber-400 text-amber-400"
            aria-label="Main document"
          />
        )}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
            title="File actions"
          >
            <MoreHorizontalIcon className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isLatexDocumentFile(file) && (
            <DropdownMenuItem
              onClick={() => onSetMain(file.id)}
              disabled={isMain}
            >
              <StarIcon className="mr-2 size-4" />
              Set as main document
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onRename(file)}>
            <PencilIcon className="mr-2 size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onDelete(file.id)}
            disabled={fileCount <= 1}
          >
            <Trash2Icon className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function FileTree({
  files,
  activeFileId,
  mainFileId,
  onSelect,
  onRename,
  onDelete,
  onSetMain,
}: FileTreeProps) {
  const tree = useMemo(() => buildFileTree(files), [files]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleFolder = (path: string) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  if (tree.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 text-center text-muted-foreground text-xs">
        Drop a folder here to open a project
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {tree.map((node) => (
        <TreeRow
          key={node.path}
          node={node}
          depth={0}
          collapsed={collapsed}
          onToggle={toggleFolder}
          activeFileId={activeFileId}
          mainFileId={mainFileId}
          onSelect={onSelect}
          onRename={onRename}
          onDelete={onDelete}
          onSetMain={onSetMain}
          fileCount={files.length}
        />
      ))}
    </div>
  );
}
