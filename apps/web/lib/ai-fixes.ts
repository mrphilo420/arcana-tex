import type { CompileDiagnostic } from "@/lib/compile-diagnostics";
import type { ProjectFile } from "@/lib/project-files";

export interface AiFixDiagnosticInput {
  id: string;
  severity?: "error" | "warning";
  kind: CompileDiagnostic["kind"];
  message: string;
  details: string[];
  filePath?: string | null;
  fileId?: string | null;
  line?: number | null;
  lineText?: string | null;
  raw?: string;
  data?: Record<string, unknown>;
}

export interface AiFixFileInput {
  id: string;
  path: string;
  content: string;
}

export interface AiFixInput {
  model?: string;
  mode: "single" | "all";
  includeWarnings?: boolean;
  mainFileId: string | null;
  files: AiFixFileInput[];
  diagnostics: AiFixDiagnosticInput[];
}

export interface AiFixPatch {
  diagnosticId: string;
  fileId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  replacement: string;
  explanation: string;
  confidence: "high" | "medium" | "low";
}

export interface AiFixResponse {
  patches: AiFixPatch[];
  rejected: { diagnosticId: string; reason: string }[];
  notes?: string;
}

export interface AiFixApplyResult {
  files: ProjectFile[];
  applied: AiFixPatch[];
  skipped: { diagnosticId: string; reason: string }[];
}

export async function requestAiFixes(
  input: AiFixInput,
): Promise<AiFixResponse> {
  const response = await fetch("/api/ai/fix", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = (await response.json()) as AiFixResponse | { error?: string };

  if (!response.ok) {
    throw new Error(
      "error" in data && data.error
        ? data.error
        : "The AI repair service did not return a valid response.",
    );
  }

  return data as AiFixResponse;
}

export function applyAiFixPatches(
  files: ProjectFile[],
  patches: AiFixPatch[],
): AiFixApplyResult {
  const fileMap = new Map(files.map((file) => [file.id, file]));
  const byFile = new Map<string, AiFixPatch[]>();
  const skipped: { diagnosticId: string; reason: string }[] = [];

  for (const patch of patches) {
    const file = fileMap.get(patch.fileId);
    if (!file || file.type !== "tex") {
      skipped.push({
        diagnosticId: patch.diagnosticId,
        reason: "AI proposed a patch for an unknown or non-TeX file.",
      });
      continue;
    }

    const lines = (file.content ?? "").split("\n");
    const start = Math.max(1, Math.floor(patch.startLine));
    const end = Math.min(lines.length, Math.floor(patch.endLine));
    const replacement = patch.replacement.replace(/\r\n/g, "\n");
    if (start > end || end - start > 60 || replacement.length > 8000) {
      skipped.push({
        diagnosticId: patch.diagnosticId,
        reason: "AI proposed an invalid or oversized line range.",
      });
      continue;
    }

    const current = byFile.get(file.id) ?? [];
    if (
      current.some((item) => start <= item.endLine && end >= item.startLine)
    ) {
      skipped.push({
        diagnosticId: patch.diagnosticId,
        reason: "AI patches overlap for the same file.",
      });
      continue;
    }

    current.push({ ...patch, startLine: start, endLine: end });
    byFile.set(file.id, current);
  }

  const updated = files.map((file) => {
    const filePatches = byFile.get(file.id);
    if (!filePatches) return file;

    const lines = (file.content ?? "").split("\n");
    const ordered = [...filePatches].sort((a, b) => b.startLine - a.startLine);

    for (const patch of ordered) {
      const replacementLines = patch.replacement
        .replace(/\r\n/g, "\n")
        .replace(/\n$/, "")
        .split("\n");
      lines.splice(
        patch.startLine - 1,
        patch.endLine - patch.startLine + 1,
        ...replacementLines,
      );
    }

    return { ...file, content: lines.join("\n") };
  });

  return {
    files: updated,
    applied: [...byFile.values()].flat(),
    skipped,
  };
}
