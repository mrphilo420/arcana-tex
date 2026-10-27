"use client";

import { useMemo, useState } from "react";
import {
  BookOpenIcon,
  FileCode2Icon,
  FileIcon,
  FileTextIcon,
  FolderIcon,
  ImageIcon,
  StarIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import {
  type FileTreeNode,
  type ProjectFile,
  buildFileTree,
} from "@/lib/project-files";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const NODE_WIDTH = 178;
const NODE_HEIGHT = 48;
const GAP_X = 88;
const GAP_Y = 26;
const PADDING = 34;

interface LayoutNode {
  id: string;
  name: string;
  path: string;
  kind: "folder" | "file" | "root";
  depth: number;
  x: number;
  y: number;
  file?: ProjectFile;
  parentId: string | null;
  childCount: number;
}

function fileKind(
  file: ProjectFile,
): "pdf" | "image" | "lean" | "tex" | "bib" | "text" {
  if (
    file.type === "image" ||
    /\.(png|jpe?g|gif|webp|svg|bmp|tiff?)$/i.test(file.name)
  ) {
    return "image";
  }
  if (file.name.toLowerCase().endsWith(".pdf") || file.type === "binary")
    return "pdf";
  if (file.name.toLowerCase().endsWith(".lean")) return "lean";
  if (/\.(tex|ltx)$/i.test(file.name)) return "tex";
  if (file.name.toLowerCase().endsWith(".bib")) return "bib";
  return "text";
}

function FileGlyph({ file }: { file: ProjectFile }) {
  const kind = fileKind(file);
  if (kind === "image") return <ImageIcon className="size-3.5 shrink-0" />;
  if (kind === "pdf") return <FileIcon className="size-3.5 shrink-0" />;
  if (kind === "bib") return <BookOpenIcon className="size-3.5 shrink-0" />;
  if (kind === "lean")
    return <FileCode2Icon className="size-3.5 shrink-0 text-teal-500" />;
  if (kind === "tex")
    return <FileTextIcon className="size-3.5 shrink-0 text-primary" />;
  return <FileTextIcon className="size-3.5 shrink-0" />;
}

function layoutTree(
  nodes: FileTreeNode[],
  projectName: string,
): { nodes: LayoutNode[]; width: number; height: number } {
  const flat: LayoutNode[] = [];
  let leafCursor = 0;
  let maxDepth = 0;

  const visit = (
    node: FileTreeNode,
    depth: number,
    parentId: string | null,
  ): LayoutNode => {
    maxDepth = Math.max(maxDepth, depth);
    const children = node.children ?? [];
    const layoutChildren = children.map((child) =>
      visit(child, depth + 1, node.path || "__root__"),
    );

    let y: number;
    if (layoutChildren.length === 0) {
      y = PADDING + leafCursor * (NODE_HEIGHT + GAP_Y) + NODE_HEIGHT / 2;
      leafCursor += 1;
    } else {
      y =
        (layoutChildren[0].y + layoutChildren[layoutChildren.length - 1].y) / 2;
    }

    const layoutNode: LayoutNode = {
      id: node.path || "__root__",
      name: node.name,
      path: node.path,
      kind: node.kind,
      depth,
      x: PADDING + depth * (NODE_WIDTH + GAP_X) + NODE_WIDTH / 2,
      y,
      file: node.file,
      parentId,
      childCount: children.length,
    };
    flat.push(layoutNode);
    return layoutNode;
  };

  const rootChildren = nodes.map((node) => visit(node, 1, "__root__"));
  const rootY =
    rootChildren.length > 0
      ? (rootChildren[0].y + rootChildren[rootChildren.length - 1].y) / 2
      : PADDING + NODE_HEIGHT / 2;

  const root: LayoutNode = {
    id: "__root__",
    name: projectName,
    path: "",
    kind: "root",
    depth: 0,
    x: PADDING + NODE_WIDTH / 2,
    y: rootY,
    parentId: null,
    childCount: rootChildren.length,
  };

  const width = (maxDepth + 1) * (NODE_WIDTH + GAP_X) + PADDING * 2 - GAP_X;
  const height = Math.max(
    PADDING * 2 + NODE_HEIGHT,
    PADDING * 2 + leafCursor * (NODE_HEIGHT + GAP_Y) - GAP_Y,
  );

  return { nodes: [root, ...flat], width, height };
}

function countFolders(nodes: FileTreeNode[]): number {
  return nodes.reduce(
    (count, node) =>
      count +
      (node.kind === "folder" ? 1 : 0) +
      (node.children ? countFolders(node.children) : 0),
    0,
  );
}

function nodeTone(node: LayoutNode): string {
  if (node.kind === "root") return "border-primary/40 bg-primary/10";
  if (node.kind === "folder") return "border-border bg-card";
  if (!node.file) return "border-border bg-background";
  const kind = fileKind(node.file);
  if (kind === "tex") return "border-primary/30 bg-primary/5";
  if (kind === "lean") return "border-teal-500/30 bg-teal-500/5";
  if (kind === "image") return "border-amber-500/30 bg-amber-500/5";
  return "border-border bg-background";
}

export function FileTreeVisualizer({
  files,
  projectName,
  activeFileId,
  mainFileId,
  open,
  onOpenChange,
  onSelect,
}: {
  files: ProjectFile[];
  projectName: string;
  activeFileId: string;
  mainFileId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const tree = useMemo(() => buildFileTree(files), [files]);
  const layout = useMemo(
    () => layoutTree(tree, projectName || "Project"),
    [projectName, tree],
  );
  const nodeById = useMemo(
    () => new Map(layout.nodes.map((node) => [node.id, node])),
    [layout.nodes],
  );
  const folderCount = useMemo(() => countFolders(tree), [tree]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[86vh] max-w-[min(1280px,calc(100vw-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(1280px,calc(100vw-2rem))]">
        <DialogHeader className="border-border border-b px-5 py-4">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div>
              <DialogTitle className="font-serif text-xl">
                Project map
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                A geometric view of every file and folder in this project. Click
                a file to open it.
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-muted/40 p-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() =>
                  setZoom((value) => Math.max(0.6, +(value - 0.1).toFixed(1)))
                }
                title="Zoom out"
              >
                <ZoomOutIcon className="size-3.5" />
              </Button>
              <span className="w-9 text-center font-mono text-[0.75rem] text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() =>
                  setZoom((value) => Math.min(1.5, +(value + 0.1).toFixed(1)))
                }
                title="Zoom in"
              >
                <ZoomInIcon className="size-3.5" />
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[0.75rem] text-muted-foreground">
            <span>{files.length} files</span>
            <span>
              {folderCount === 0
                ? "flat project"
                : `${folderCount} folder${folderCount === 1 ? "" : "s"}`}
            </span>
            <span>Click a node to inspect or open</span>
            <span className="ml-auto flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-sm bg-primary" /> LaTeX
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-sm bg-teal-500" /> Lean
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-sm bg-amber-500" /> Image
              </span>
            </span>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto bg-background/60">
          {files.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">
              No files to visualize yet.
            </div>
          ) : (
            <div
              className="relative origin-top-left"
              style={{
                width: layout.width,
                height: layout.height,
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
                marginBottom: (zoom - 1) * layout.height,
                marginRight: (zoom - 1) * layout.width,
              }}
            >
              <svg
                className="pointer-events-none absolute inset-0"
                width={layout.width}
                height={layout.height}
                aria-hidden="true"
              >
                {layout.nodes
                  .filter((node) => node.parentId)
                  .map((node) => {
                    const parent = nodeById.get(node.parentId ?? "");
                    if (!parent) return null;
                    const startX = parent.x + NODE_WIDTH / 2;
                    const startY = parent.y;
                    const endX = node.x - NODE_WIDTH / 2;
                    const endY = node.y;
                    const midX = (startX + endX) / 2;
                    return (
                      <path
                        key={`${parent.id}-${node.id}`}
                        d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                        fill="none"
                        stroke="var(--border)"
                        strokeWidth={1.25}
                        opacity={0.8}
                      />
                    );
                  })}
              </svg>

              {layout.nodes.map((node) => {
                const isFile = node.kind === "file" && node.file;
                const isActive = isFile && node.file?.id === activeFileId;
                const isMain = isFile && node.file?.id === mainFileId;
                const content = (
                  <div className="flex min-w-0 items-center gap-2">
                    {node.kind === "folder" || node.kind === "root" ? (
                      <FolderIcon
                        className={cn(
                          "size-3.5 shrink-0",
                          node.kind === "root"
                            ? "text-primary"
                            : "text-muted-foreground",
                        )}
                      />
                    ) : node.file ? (
                      <FileGlyph file={node.file} />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-[0.875rem]">
                        {node.name || "Project"}
                      </div>
                      <div className="truncate font-mono text-[0.75rem] text-muted-foreground">
                        {node.kind === "root"
                          ? `${files.length} files`
                          : node.kind === "folder"
                            ? `${node.childCount} item${node.childCount === 1 ? "" : "s"}`
                            : node.path}
                      </div>
                    </div>
                    {isMain && (
                      <StarIcon className="size-3 shrink-0 fill-amber-400 text-amber-400" />
                    )}
                  </div>
                );

                return (
                  <div
                    key={node.id}
                    className={cn(
                      "absolute flex items-center rounded-lg border px-2.5 shadow-sm transition-shadow",
                      nodeTone(node),
                      isActive && "ring-2 ring-primary/35",
                      isFile &&
                        "cursor-pointer hover:shadow-md hover:brightness-105",
                    )}
                    style={{
                      left: node.x - NODE_WIDTH / 2,
                      top: node.y - NODE_HEIGHT / 2,
                      width: NODE_WIDTH,
                      height: NODE_HEIGHT,
                    }}
                    title={node.kind === "file" ? node.path : node.name}
                    onClick={() => {
                      if (!node.file) return;
                      onSelect(node.file.id);
                      onOpenChange(false);
                    }}
                    onKeyDown={(event) => {
                      if (!node.file) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(node.file.id);
                        onOpenChange(false);
                      }
                    }}
                    role={isFile ? "button" : undefined}
                    tabIndex={isFile ? 0 : undefined}
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
