import type { LatexCompiler } from "@/lib/latex-compiler";
import type { ProjectFile } from "@/lib/project-files";
import type { ProjectComment } from "@/lib/storage/schema";

export interface SyncPeer {
  id: string;
  name: string;
}

export interface SyncSnapshot {
  projectId: string;
  projectName: string;
  files: ProjectFile[];
  mainFileId: string | null;
  compiler: LatexCompiler;
  comments?: ProjectComment[];
  updatedAt: number;
}

export type SyncStatus = "idle" | "connecting" | "connected" | "error";
