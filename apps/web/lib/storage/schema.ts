import type { DBSchema } from "idb";
import type { LatexCompiler } from "@/lib/latex-compiler";
import type { ProjectFile } from "@/lib/project-files";

export interface StoredProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  files: ProjectFile[];
  activeFileId: string;
  mainFileId: string | null;
  compiler: LatexCompiler;
  comments?: ProjectComment[];
  folderId?: string | null;
}

export interface ProjectFolder {
  id: string;
  name: string;
  createdAt: number;
}

export interface ProjectVersion {
  id: string;
  projectId: string;
  label: string;
  createdAt: number;
  projectCreatedAt: number;
  name: string;
  files: ProjectFile[];
  activeFileId: string;
  mainFileId: string | null;
  compiler: LatexCompiler;
  comments: ProjectComment[];
}

export interface ProjectComment {
  id: string;
  fileId: string;
  filePath: string;
  line: number;
  selectedText?: string;
  body: string;
  author: string;
  createdAt: number;
  resolved: boolean;
}

export interface StoredChatHistory {
  projectId: string;
  updatedAt: number;
  messages?: unknown[];
  repository?: unknown;
}

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  fileCount: number;
  mainFilePath: string | null;
  searchText: string;
  folderId?: string | null;
}

export interface LegacyDocumentState {
  files: ProjectFile[];
  activeFileId: string;
  mainFileId?: string | null;
  projectName?: string;
  compiler?: string;
  version?: number;
}

export interface OpenPrismDB extends DBSchema {
  projects: {
    key: string;
    value: StoredProject;
  };
  projectMeta: {
    key: string;
    value: ProjectMeta;
  };
  projectChats: {
    key: string;
    value: StoredChatHistory;
  };
  projectFolders: {
    key: string;
    value: ProjectFolder;
  };
  projectVersions: {
    key: string;
    value: ProjectVersion;
    indexes: { "by-project": string };
  };
  documentState: {
    key: "state";
    value: LegacyDocumentState;
  };
  blobs: {
    key: string;
    value: {
      id: string;
      data: string | Uint8Array;
      type: "image" | "binary" | "pdf";
    };
  };
}

export const DB_NAME = "open-prism";
export const DB_VERSION = 4;
