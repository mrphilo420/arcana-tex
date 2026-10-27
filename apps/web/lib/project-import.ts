import {
  type ProjectFile,
  fileTypeForName,
  getBaseName,
  mimeTypeForName,
} from "./project-files";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".svn",
  ".hg",
  ".idea",
  ".vscode",
  "__MACOSX",
  "node_modules",
]);

const IGNORED_FILES = new Set([
  ".ds_store",
  "thumbs.db",
  "desktop.ini",
  "icon\r",
]);

const IGNORED_SUFFIXES = [
  ".aux",
  ".log",
  ".out",
  ".toc",
  ".lof",
  ".lot",
  ".fls",
  ".fdb_latexmk",
  ".synctex",
  ".synctex.gz",
  ".bcf",
  ".run.xml",
  ".blg",
  ".ilg",
  ".nav",
  ".snm",
  ".vrb",
  ".xdv",
  ".dvi",
  ".spl",
  ".zip",
  ".tar",
  ".gz",
];

export interface ImportedProject {
  projectName: string;
  files: Omit<ProjectFile, "id">[];
  skipped: string[];
  isProject: boolean;
}

interface ImportOptions {
  stripRoot?: boolean;
}

function cleanProjectName(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, " ").slice(0, 80);
  return cleaned || "Imported Project";
}

function shouldIgnoreDirectory(name: string): boolean {
  return name.startsWith(".") || IGNORED_DIRECTORIES.has(name);
}

function shouldIgnoreFile(name: string): boolean {
  const lower = name.toLowerCase();
  if (name.startsWith(".")) return true;
  if (IGNORED_FILES.has(lower)) return true;
  if (name.endsWith("~")) return true;
  return IGNORED_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(reader.error ?? new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function readProjectFile(
  file: File,
  path: string,
): Promise<Omit<ProjectFile, "id"> | null> {
  const name = getBaseName(path);
  if (shouldIgnoreFile(name)) return null;
  if (file.size > MAX_FILE_BYTES) return null;

  const mimeType = file.type || mimeTypeForName(name);
  const type = fileTypeForName(name, mimeType);

  if (type === "tex") {
    return {
      name,
      path,
      type,
      mimeType,
      content: await file.text(),
    };
  }

  return {
    name,
    path,
    type,
    mimeType,
    dataUrl: await readAsDataUrl(file),
  };
}

function readDirectoryEntries(
  reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const entries: FileSystemEntry[] = [];

    const readBatch = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(entries);
          return;
        }
        entries.push(...batch);
        readBatch();
      }, reject);
    };

    readBatch();
  });
}

function getEntryFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

async function collectEntry(
  entry: FileSystemEntry,
  path: string,
  files: Omit<ProjectFile, "id">[],
  skipped: string[],
): Promise<void> {
  if (entry.isFile) {
    try {
      const file = await getEntryFile(entry as FileSystemFileEntry);
      const projectFile = await readProjectFile(file, path);
      if (projectFile) files.push(projectFile);
      else skipped.push(path);
    } catch {
      skipped.push(path);
    }
    return;
  }

  if (!entry.isDirectory) return;
  if (shouldIgnoreDirectory(entry.name)) return;

  const directory = entry as FileSystemDirectoryEntry;
  const children = await readDirectoryEntries(directory.createReader());

  for (const child of children) {
    await collectEntry(child, `${path}/${child.name}`, files, skipped);
  }
}

export async function importProjectFromFileList(
  fileList: FileList | File[],
  options: ImportOptions = {},
): Promise<ImportedProject> {
  const allFiles = Array.from(fileList);
  const firstRelativePath =
    allFiles.find((file) => file.webkitRelativePath)?.webkitRelativePath ?? "";
  const rootName = firstRelativePath.includes("/")
    ? firstRelativePath.split("/")[0]
    : "";
  const stripRoot = Boolean(options.stripRoot && rootName);
  const projectName = stripRoot ? rootName : "Imported Project";

  const files: Omit<ProjectFile, "id">[] = [];
  const skipped: string[] = [];

  for (const file of allFiles) {
    let path = file.webkitRelativePath || file.name;
    if (stripRoot && path.startsWith(`${rootName}/`)) {
      path = path.slice(rootName.length + 1);
    }
    if (!path) continue;

    try {
      const projectFile = await readProjectFile(file, path);
      if (projectFile) files.push(projectFile);
      else skipped.push(path);
    } catch {
      skipped.push(path);
    }
  }

  return {
    projectName: cleanProjectName(projectName),
    files,
    skipped,
    isProject: stripRoot,
  };
}

export async function importProjectFromDataTransfer(
  dataTransfer: DataTransfer,
): Promise<ImportedProject> {
  const entries: FileSystemEntry[] = [];

  for (const item of Array.from(dataTransfer.items)) {
    if (item.kind !== "file") continue;
    try {
      const entry = item.webkitGetAsEntry?.();
      if (entry) entries.push(entry);
    } catch {
      // getAsEntry can throw for synthetic drags; fall back to files below.
    }
  }

  if (entries.length === 0) {
    return importProjectFromFileList(dataTransfer.files);
  }

  const topLevelDirectories = entries.filter((entry) => entry.isDirectory);
  const onlyOneDirectory =
    entries.length === 1 && topLevelDirectories.length === 1;
  const projectName = onlyOneDirectory
    ? topLevelDirectories[0].name
    : "Imported Project";

  const files: Omit<ProjectFile, "id">[] = [];
  const skipped: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) {
      if (shouldIgnoreDirectory(entry.name)) continue;
      const directory = entry as FileSystemDirectoryEntry;
      const children = await readDirectoryEntries(directory.createReader());

      for (const child of children) {
        if (onlyOneDirectory) {
          await collectEntry(child, child.name, files, skipped);
        } else {
          await collectEntry(
            child,
            `${entry.name}/${child.name}`,
            files,
            skipped,
          );
        }
      }
    } else {
      await collectEntry(entry, entry.name, files, skipped);
    }
  }

  return {
    projectName: cleanProjectName(projectName),
    files,
    skipped,
    isProject: onlyOneDirectory,
  };
}
