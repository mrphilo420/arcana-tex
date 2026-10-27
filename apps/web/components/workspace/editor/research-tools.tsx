"use client";

import { useAssistantTool } from "@assistant-ui/react";
import {
  CheckIcon,
  FileCodeIcon,
  FileSearchIcon,
  HammerIcon,
  LoaderIcon,
} from "lucide-react";
import type { FC } from "react";
import { z } from "zod";

import {
  isLeanFile,
  LEAN_PROJECT_STORAGE_KEY,
  LEAN_TOOLCHAIN_STORAGE_KEY,
  summarizeLeanFiles,
} from "@/lib/lean";
import { DEV_PANEL_ENABLED } from "@/lib/dev-panel";
import { useDevPanelStore } from "@/stores/dev-panel-store";
import { useDocumentStore } from "@/stores/document-store";

const REVIEW_EXTENSIONS = new Set([
  "tex",
  "ltx",
  "bib",
  "lean",
  "md",
  "markdown",
]);
const MAX_REVIEW_CHARS = 90000;
const MAX_FILE_CHARS = 22000;

function extension(path: string): string {
  const name = path.split("/").pop() ?? path;
  const index = name.lastIndexOf(".");
  return index === -1 ? "" : name.slice(index + 1).toLowerCase();
}

function languageForPath(path: string): string {
  if (path.toLowerCase().endsWith(".lean")) return "lean";
  if (path.toLowerCase().endsWith(".bib")) return "bibtex";
  if (/\.(?:md|markdown)$/i.test(path)) return "markdown";
  return "latex";
}

export const ResearchTools: FC = () => {
  useAssistantTool({
    toolName: "load_review_context",
    description:
      "Load the complete manuscript source, bibliography, Lean 4 summaries, and compile status for a project-wide paper review. Use this before /paper-review or when asked to review the paper, referee it, or audit its formalization. Read-only.",
    parameters: z.object({}),
    execute: async () => {
      const state = useDocumentStore.getState();
      const main = state.files.find((file) => file.id === state.mainFileId);
      const candidates = state.files
        .filter(
          (file) =>
            file.type === "tex" &&
            file.content &&
            REVIEW_EXTENSIONS.has(extension(file.path)),
        )
        .sort((a, b) => {
          const mainA = a.id === state.mainFileId ? 0 : 1;
          const mainB = b.id === state.mainFileId ? 0 : 1;
          if (mainA !== mainB) return mainA - mainB;
          const leanA = isLeanFile(a) ? 1 : 0;
          const leanB = isLeanFile(b) ? 1 : 0;
          if (leanA !== leanB) return leanA - leanB;
          return a.path.localeCompare(b.path);
        });

      let remaining = MAX_REVIEW_CHARS;
      let truncated = false;
      const sources = [];
      for (const file of candidates) {
        if (remaining <= 0) {
          truncated = true;
          break;
        }
        const content = file.content ?? "";
        const limit = Math.min(MAX_FILE_CHARS, remaining);
        const included = content.slice(0, limit);
        if (included.length < content.length) truncated = true;
        remaining -= included.length;
        sources.push({
          path: file.path,
          language: languageForPath(file.path),
          content: included,
          truncated: included.length < content.length,
        });
      }

      return {
        success: true,
        projectName: state.projectName,
        mainFilePath: main?.path ?? null,
        compiler: state.compiler,
        files: sources,
        lean: summarizeLeanFiles(state.files),
        compile: {
          error: state.compileError,
          diagnostics: state.compileDiagnostics.slice(0, 30),
        },
        truncated,
        note: truncated
          ? "Some source was truncated. Use read_project_file for the omitted portions."
          : "All relevant sources were included.",
      };
    },
    render: function LoadReviewContextRender({ result }) {
      const isComplete = result != null;
      return (
        <div className="my-2 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
          {isComplete ? (
            <CheckIcon className="size-4 text-green-600" />
          ) : (
            <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
          )}
          <FileSearchIcon className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {isComplete
              ? "Loaded manuscript and formalization context"
              : "Loading manuscript context..."}
          </span>
        </div>
      );
    },
  });

  useAssistantTool({
    toolName: "build_lean_project",
    description:
      "Run lake build in the local Lean Lake project configured for arcanaTeX. Returns the exit code, duration, stdout, and stderr. Use when the user asks to build, check, or verify a local Lean project. This never edits source files.",
    parameters: z.object({}),
    execute: async () => {
      try {
        if (DEV_PANEL_ENABLED && !useDevPanelStore.getState().flags.leanLake) {
          return {
            success: false,
            error: "Lean Lake is disabled in the developer control panel.",
          };
        }
        const projectPath = window.localStorage.getItem(
          LEAN_PROJECT_STORAGE_KEY,
        );
        const toolchain = window.localStorage.getItem(
          LEAN_TOOLCHAIN_STORAGE_KEY,
        );
        const response = await fetch("/api/lean/build", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            path: projectPath || undefined,
            toolchain: toolchain || undefined,
          }),
        });
        const result = (await response.json()) as Record<string, unknown>;
        if (!response.ok) {
          return {
            success: false,
            error:
              typeof result.error === "string"
                ? result.error
                : "Lean build request failed",
          };
        }
        return result;
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Lean bridge unavailable",
        };
      }
    },
    render: function BuildLeanProjectRender({ result }) {
      const isComplete = result != null;
      const success = result?.success === true;
      return (
        <div className="my-2 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
          {isComplete ? (
            success ? (
              <CheckIcon className="size-4 text-green-600" />
            ) : (
              <FileCodeIcon className="size-4 text-destructive" />
            )
          ) : (
            <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
          )}
          <HammerIcon className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {isComplete
              ? success
                ? "Lean build succeeded"
                : "Lean build failed"
              : "Building local Lean project..."}
          </span>
        </div>
      );
    },
  });

  useAssistantTool({
    toolName: "inspect_lean_sources",
    description:
      "Inspect Lean 4 files in the project. Returns imports, namespaces, declaration names and lines, plus sorry, admit, axiom, native_decide, unsafe, and partial usage. Use before explaining or auditing Lean code.",
    parameters: z.object({
      includeSource: z
        .boolean()
        .optional()
        .describe("Include Lean file contents in the result"),
    }),
    execute: async ({ includeSource }: { includeSource?: boolean }) => {
      const state = useDocumentStore.getState();
      const leanFiles = state.files.filter(isLeanFile);
      const summaries = summarizeLeanFiles(leanFiles);

      if (leanFiles.length === 0) {
        return {
          success: true,
          files: [],
          message:
            "This project has no .lean files. Add or import Lean 4 sources to inspect them.",
        };
      }

      return {
        success: true,
        files: summaries,
        sources: includeSource
          ? leanFiles.map((file) => ({
              path: file.path,
              content: (file.content ?? "").slice(0, MAX_FILE_CHARS),
              truncated: (file.content ?? "").length > MAX_FILE_CHARS,
            }))
          : undefined,
        incompleteProofCount: summaries.reduce(
          (total, summary) =>
            total + summary.sorryLines.length + summary.admitLines.length,
          0,
        ),
        axiomCount: summaries.reduce(
          (total, summary) => total + summary.axiomCount,
          0,
        ),
        note: "A declaration with sorry/admit is not complete. Do not claim kernel verification without build evidence.",
      };
    },
    render: function InspectLeanSourcesRender({ result }) {
      const isComplete = result != null;
      return (
        <div className="my-2 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
          {isComplete ? (
            <CheckIcon className="size-4 text-green-600" />
          ) : (
            <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
          )}
          <FileCodeIcon className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {isComplete
              ? "Inspected Lean 4 sources"
              : "Inspecting Lean 4 sources..."}
          </span>
        </div>
      );
    },
  });

  return null;
};
