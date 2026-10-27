import type { ProjectFile } from "@/lib/project-files";

export type FileKind =
  | "latex"
  | "lean"
  | "python"
  | "r"
  | "markdown"
  | "data"
  | "text"
  | "other";

const LATEX_EXTENSIONS = new Set([
  "tex",
  "ltx",
  "sty",
  "cls",
  "bib",
  "bst",
  "tikz",
  "pgf",
  "clo",
  "def",
  "cfg",
  "fd",
  "dtx",
  "ins",
  "bbx",
  "cbx",
  "lbx",
]);

const PYTHON_EXTENSIONS = new Set(["py", "pyw"]);
const R_EXTENSIONS = new Set(["r", "rmd", "rnw"]);
const DATA_EXTENSIONS = new Set([
  "csv",
  "tsv",
  "dat",
  "json",
  "yaml",
  "yml",
  "toml",
  "xml",
]);
const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "sh",
  "bash",
  "zsh",
  "html",
  "htm",
  "css",
  "scss",
  "js",
  "ts",
  "tsx",
  "jsx",
  "lua",
]);

function extensionOf(pathOrName: string): string {
  const name = pathOrName.split("/").pop() ?? pathOrName;
  const index = name.lastIndexOf(".");
  return index === -1 ? "" : name.slice(index + 1).toLowerCase();
}

export function fileKindForName(pathOrName: string): FileKind {
  const extension = extensionOf(pathOrName);
  if (LATEX_EXTENSIONS.has(extension)) return "latex";
  if (extension === "lean") return "lean";
  if (PYTHON_EXTENSIONS.has(extension)) return "python";
  if (R_EXTENSIONS.has(extension)) return "r";
  if (extension === "md" || extension === "markdown") return "markdown";
  if (DATA_EXTENSIONS.has(extension)) return "data";
  if (TEXT_EXTENSIONS.has(extension)) return "text";
  return "other";
}

export function fileKindForFile(
  file: Pick<ProjectFile, "name" | "path">,
): FileKind {
  return fileKindForName(file.path || file.name);
}

export function isLatexRelatedFile(
  file: Pick<ProjectFile, "name" | "path">,
): boolean {
  return fileKindForFile(file) === "latex";
}

export function isLatexPatchableFile(path: string): boolean {
  return fileKindForName(path) === "latex";
}

export function fileKindLabel(kind: FileKind): string {
  switch (kind) {
    case "latex":
      return "LaTeX";
    case "lean":
      return "Lean 4";
    case "python":
      return "Python";
    case "r":
      return "R";
    case "markdown":
      return "Markdown";
    case "data":
      return "Data";
    case "text":
      return "Text";
    default:
      return "File";
  }
}

export function fileKindContextLabel(kind: FileKind): string {
  switch (kind) {
    case "latex":
      return "LaTeX source";
    case "lean":
      return "Lean 4 source";
    case "python":
      return "Python source";
    case "r":
      return "R source";
    case "markdown":
      return "Markdown";
    case "data":
      return "data file";
    case "text":
      return "text file";
    default:
      return "file";
  }
}

export function languageForFileKind(kind: FileKind): string {
  switch (kind) {
    case "latex":
      return "latex";
    case "lean":
      return "lean";
    case "python":
      return "python";
    case "r":
      return "r";
    case "markdown":
      return "markdown";
    default:
      return "text";
  }
}
