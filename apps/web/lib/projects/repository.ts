import type { LatexCompiler } from "@/lib/latex-compiler";
import {
  type ProjectFile,
  detectMainFile,
  normalizeProjectFiles,
} from "@/lib/project-files";
import type {
  ProjectFolder,
  ProjectMeta,
  ProjectVersion,
  StoredProject,
} from "@/lib/storage/schema";
import { getDB } from "@/lib/storage/db";

const SEARCH_CHARS_PER_FILE = 4000;
const SEARCH_CHARS_TOTAL = 120000;

export interface NewProjectInput {
  id?: string;
  name: string;
  files: Array<Omit<ProjectFile, "id"> & { id?: string }>;
  compiler?: LatexCompiler;
  activeFileId?: string;
  mainFileId?: string | null;
  comments?: StoredProject["comments"];
  createdAt?: number;
  updatedAt?: number;
  folderId?: string | null;
}

function isCompiler(value: string | undefined): value is LatexCompiler {
  return (
    value === "pdflatex" ||
    value === "xelatex" ||
    value === "lualatex" ||
    value === "tectonic"
  );
}

function buildSearchText(project: StoredProject): string {
  const parts = [project.name, ...project.files.map((file) => file.path)];
  let budget = SEARCH_CHARS_TOTAL;

  for (const file of project.files) {
    if (budget <= 0) break;
    if (file.type !== "tex" || !file.content) continue;

    const slice = file.content.slice(
      0,
      Math.min(SEARCH_CHARS_PER_FILE, budget),
    );
    parts.push(slice);
    budget -= slice.length;
  }

  return parts.join("\n").toLowerCase();
}

function toMeta(project: StoredProject): ProjectMeta {
  const mainFile = project.files.find((file) => file.id === project.mainFileId);

  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    fileCount: project.files.length,
    mainFilePath: mainFile?.path ?? null,
    searchText: buildSearchText(project),
    folderId: project.folderId ?? null,
  };
}

function materializeFiles(files: NewProjectInput["files"]): ProjectFile[] {
  return normalizeProjectFiles(
    files.map((file) => ({
      ...file,
      id: file.id ?? crypto.randomUUID(),
    })),
  );
}

let migrationPromise: Promise<void> | null = null;

async function migrateLegacyProject(): Promise<void> {
  const db = await getDB();
  const projectCount = await db.count("projects");
  if (projectCount > 0) return;

  if (!db.objectStoreNames.contains("documentState")) return;

  const legacy = await db.get("documentState", "state");
  if (!legacy || legacy.files.length === 0) return;

  const files = await Promise.all(
    legacy.files.map(async (file) => {
      if (file.type === "tex") return file;

      const blob = await db.get("blobs", file.id);
      if (blob && typeof blob.data === "string") {
        return { ...file, dataUrl: blob.data };
      }

      return file;
    }),
  );

  const normalized = normalizeProjectFiles(files);
  if (normalized.length === 0) return;

  const now = Date.now();
  const mainFile =
    normalized.find((file) => file.id === legacy.mainFileId) ??
    detectMainFile(normalized);
  const activeFile = normalized.find((file) => file.id === legacy.activeFileId);

  const project: StoredProject = {
    id: crypto.randomUUID(),
    name: legacy.projectName?.trim() || "Untitled Project",
    createdAt: now,
    updatedAt: now,
    files: normalized,
    activeFileId: activeFile?.id ?? mainFile?.id ?? normalized[0]?.id ?? "",
    mainFileId: mainFile?.id ?? null,
    compiler: isCompiler(legacy.compiler) ? legacy.compiler : "pdflatex",
    comments: [],
  };

  await saveProject(project);

  const cleanup = db.transaction(["documentState", "blobs"], "readwrite");
  await cleanup.objectStore("documentState").delete("state");
  await cleanup.objectStore("blobs").clear();
  await cleanup.done;
}

export function ensureProjectsMigrated(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = migrateLegacyProject().catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }

  return migrationPromise;
}

export async function listProjects(): Promise<ProjectMeta[]> {
  await ensureProjectsMigrated();
  const db = await getDB();
  const projects = await db.getAll("projectMeta");
  return projects.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<StoredProject | null> {
  await ensureProjectsMigrated();
  const db = await getDB();
  return (await db.get("projects", id)) ?? null;
}

export async function saveProject(project: StoredProject): Promise<void> {
  const db = await getDB();

  // Autosave callers do not keep folder metadata in document state. Preserve
  // the folder already stored for the project unless the caller sets it.
  let folderId = project.folderId;
  if (folderId === undefined) {
    const existing = await db.get("projects", project.id);
    folderId = existing?.folderId ?? null;
  }

  const next: StoredProject = { ...project, folderId };
  const meta = toMeta(next);
  const tx = db.transaction(["projects", "projectMeta"], "readwrite");

  await tx.objectStore("projects").put(next);
  await tx.objectStore("projectMeta").put(meta);
  await tx.done;
}

export async function createProject(
  input: NewProjectInput,
): Promise<StoredProject> {
  const now = Date.now();
  const files = materializeFiles(input.files);
  const mainFile =
    files.find((file) => file.id === input.mainFileId) ?? detectMainFile(files);
  const activeFile =
    files.find((file) => file.id === input.activeFileId) ??
    mainFile ??
    files.find((file) => file.type === "tex") ??
    files[0];

  const project: StoredProject = {
    id: input.id ?? crypto.randomUUID(),
    name: input.name.trim() || "Untitled Project",
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    files,
    activeFileId: activeFile?.id ?? "",
    mainFileId: mainFile?.id ?? null,
    compiler: input.compiler ?? "pdflatex",
    comments: input.comments ?? [],
    folderId: input.folderId ?? null,
  };

  await saveProject(project);
  return project;
}

export async function renameProject(id: string, name: string): Promise<void> {
  const project = await getProject(id);
  if (!project) return;

  const nextName = name.trim();
  if (!nextName) return;

  project.name = nextName;
  project.updatedAt = Date.now();
  await saveProject(project);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ["projects", "projectMeta", "projectChats", "projectVersions"],
    "readwrite",
  );
  const versionStore = tx.objectStore("projectVersions");
  const versionKeys = await versionStore.index("by-project").getAllKeys(id);

  await tx.objectStore("projects").delete(id);
  await tx.objectStore("projectMeta").delete(id);
  await tx.objectStore("projectChats").delete(id);
  await Promise.all(versionKeys.map((key) => versionStore.delete(key)));
  await tx.done;
}

export async function listFolders(): Promise<ProjectFolder[]> {
  await ensureProjectsMigrated();
  const db = await getDB();
  const folders = await db.getAll("projectFolders");
  return folders.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createFolder(name: string): Promise<ProjectFolder> {
  const folder: ProjectFolder = {
    id: crypto.randomUUID(),
    name: name.trim() || "New folder",
    createdAt: Date.now(),
  };

  const db = await getDB();
  await db.put("projectFolders", folder);
  return folder;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const nextName = name.trim();
  if (!nextName) return;

  const db = await getDB();
  const folder = await db.get("projectFolders", id);
  if (!folder) return;

  await db.put("projectFolders", { ...folder, name: nextName });
}

export async function deleteFolder(id: string): Promise<void> {
  const db = await getDB();
  const projects = await db.getAll("projects");
  const affected = projects.filter((project) => project.folderId === id);
  const tx = db.transaction(
    ["projectFolders", "projects", "projectMeta"],
    "readwrite",
  );

  await tx.objectStore("projectFolders").delete(id);

  for (const project of affected) {
    const next = { ...project, folderId: null, updatedAt: Date.now() };
    await tx.objectStore("projects").put(next);
    await tx.objectStore("projectMeta").put(toMeta(next));
  }

  await tx.done;
}

export async function setProjectFolder(
  projectId: string,
  folderId: string | null,
): Promise<void> {
  const project = await getProject(projectId);
  if (!project) return;

  project.folderId = folderId;
  project.updatedAt = Date.now();
  await saveProject(project);
}

export async function listProjectVersions(
  projectId: string,
): Promise<ProjectVersion[]> {
  const db = await getDB();
  const versions = await db.getAllFromIndex(
    "projectVersions",
    "by-project",
    projectId,
  );
  return versions.sort((a, b) => b.createdAt - a.createdAt);
}

export async function createProjectVersion(input: {
  projectId: string;
  label: string;
  name: string;
  projectCreatedAt: number;
  files: ProjectFile[];
  activeFileId: string;
  mainFileId: string | null;
  compiler: LatexCompiler;
  comments: StoredProject["comments"];
}): Promise<ProjectVersion> {
  const db = await getDB();
  const existing = await db.getAllFromIndex(
    "projectVersions",
    "by-project",
    input.projectId,
  );

  if (existing.length >= 30) {
    const stale = existing
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, existing.length - 29);
    await Promise.all(
      stale.map((version) => db.delete("projectVersions", version.id)),
    );
  }

  const version: ProjectVersion = {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    label: input.label.trim() || "Saved version",
    createdAt: Date.now(),
    projectCreatedAt: input.projectCreatedAt,
    name: input.name,
    files: input.files,
    activeFileId: input.activeFileId,
    mainFileId: input.mainFileId,
    compiler: input.compiler,
    comments: input.comments ?? [],
  };

  await db.put("projectVersions", version);
  return version;
}

export async function deleteProjectVersion(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("projectVersions", id);
}

export async function restoreProjectVersion(
  versionId: string,
): Promise<StoredProject | null> {
  const db = await getDB();
  const version = await db.get("projectVersions", versionId);
  if (!version) return null;

  const existing = await getProject(version.projectId);
  if (!existing) return null;

  const files = normalizeProjectFiles(version.files);
  if (files.length === 0) return null;

  const mainFile =
    files.find((file) => file.id === version.mainFileId) ??
    detectMainFile(files);
  const activeFile =
    files.find((file) => file.id === version.activeFileId) ??
    mainFile ??
    files[0];

  const restored: StoredProject = {
    ...existing,
    name: version.name,
    files,
    activeFileId: activeFile?.id ?? "",
    mainFileId: mainFile?.id ?? null,
    compiler: version.compiler,
    comments: version.comments,
    updatedAt: Date.now(),
  };

  await saveProject(restored);
  return restored;
}

export function uniqueProjectName(
  desiredName: string,
  existingNames: string[],
): string {
  const base = desiredName.trim() || "Untitled Project";
  const names = new Set(existingNames.map((name) => name.toLowerCase()));

  if (!names.has(base.toLowerCase())) return base;

  let index = 2;
  while (names.has(`${base} ${index}`.toLowerCase())) {
    index += 1;
  }

  return `${base} ${index}`;
}
