export type ProjectFileType = "tex" | "image" | "binary";

export interface ProjectFile {
  id: string;
  name: string;
  path: string;
  type: ProjectFileType;
  content?: string;
  dataUrl?: string;
  mimeType?: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  kind: "folder" | "file";
  file?: ProjectFile;
  children?: FileTreeNode[];
}

const TEXT_EXTENSIONS = new Set([
  "tex",
  "ltx",
  "lean",
  "bib",
  "bst",
  "cls",
  "sty",
  "clo",
  "def",
  "cfg",
  "fd",
  "dtx",
  "ins",
  "txt",
  "md",
  "markdown",
  "csv",
  "tsv",
  "dat",
  "json",
  "yaml",
  "yml",
  "toml",
  "xml",
  "bbx",
  "cbx",
  "lbx",
  "lua",
  "py",
  "js",
  "ts",
  "tsx",
  "jsx",
  "sh",
  "bash",
  "zsh",
  "html",
  "htm",
  "css",
  "scss",
  "makefile",
  "latexmkrc",
]);

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "tif",
  "tiff",
  "svg",
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  eps: "application/postscript",
};

export function getExtension(name: string): string {
  const index = name.lastIndexOf(".");
  return index === -1 ? "" : name.slice(index + 1).toLowerCase();
}

export function getBaseName(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1] || path;
}

export function getParentPath(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

export function mimeTypeForName(name: string): string | undefined {
  return MIME_BY_EXTENSION[getExtension(name)];
}

export function isTextFileName(name: string, mimeType?: string): boolean {
  if (TEXT_EXTENSIONS.has(getExtension(name))) return true;
  if (!getExtension(name) && TEXT_EXTENSIONS.has(name.toLowerCase())) {
    return true;
  }
  return Boolean(mimeType?.startsWith("text/"));
}

export function fileTypeForName(
  name: string,
  mimeType?: string,
): ProjectFileType {
  if (isTextFileName(name, mimeType)) return "tex";
  if (
    IMAGE_EXTENSIONS.has(getExtension(name)) ||
    mimeType?.startsWith("image/")
  ) {
    return "image";
  }
  return "binary";
}

export function normalizeProjectFiles(files: ProjectFile[]): ProjectFile[] {
  const byPath = new Map<string, ProjectFile>();

  for (const file of files) {
    const path = (file.path || file.name || "").replace(/^\/+/, "");
    if (!path) continue;
    const name = getBaseName(path);
    const type =
      file.type === "tex" || file.type === "image" || file.type === "binary"
        ? file.type
        : fileTypeForName(name);

    byPath.set(path, { ...file, name, path, type });
  }

  return Array.from(byPath.values());
}

function mainFileScore(file: ProjectFile): number {
  const name = getBaseName(file.path).toLowerCase();
  const depth = Math.max(0, file.path.split("/").length - 1);
  let score = -depth * 10;

  if (name === "main.tex") score += 100;
  else if (name === "document.tex") score += 90;
  else if (name === "paper.tex") score += 80;
  else if (name === "thesis.tex") score += 70;
  else if (name === "article.tex") score += 60;
  else if (name === "manuscript.tex") score += 50;

  if (file.content?.includes("\\documentclass")) score += 30;
  if (file.content?.includes("\\begin{document}")) score += 20;

  return score;
}

export function detectMainFile(files: ProjectFile[]): ProjectFile | undefined {
  const candidates = files.filter(isLatexDocumentFile);

  if (candidates.length === 0) return undefined;

  return [...candidates].sort((a, b) => mainFileScore(b) - mainFileScore(a))[0];
}

export function isLatexDocumentFile(
  file: Pick<ProjectFile, "name" | "type">,
): boolean {
  return file.type === "tex" && /\.(tex|ltx)$/i.test(file.name);
}

export function buildFileTree(files: ProjectFile[]): FileTreeNode[] {
  const root: FileTreeNode = {
    name: "",
    path: "",
    kind: "folder",
    children: [],
  };

  for (const file of files) {
    const segments = (file.path || file.name).split("/").filter(Boolean);
    if (segments.length === 0) continue;

    let parent = root;

    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      const segmentPath = segments.slice(0, i + 1).join("/");
      let folder = parent.children?.find(
        (child) => child.kind === "folder" && child.path === segmentPath,
      );

      if (!folder) {
        folder = {
          name: segment,
          path: segmentPath,
          kind: "folder",
          children: [],
        };
        parent.children?.push(folder);
      }

      parent = folder;
    }

    parent.children?.push({
      name: segments[segments.length - 1],
      path: file.path || file.name,
      kind: "file",
      file,
    });
  }

  const sortNodes = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.children) sortNodes(node.children);
    }
  };

  const children = root.children ?? [];
  sortNodes(children);
  return children;
}
