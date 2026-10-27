"use client";

import { useAssistantTool } from "@assistant-ui/react";
import {
  CheckIcon,
  LoaderIcon,
  PlusIcon,
  ReplaceIcon,
  SearchIcon,
} from "lucide-react";
import type { FC } from "react";
import { z } from "zod";

import { isLatexDocumentFile } from "@/lib/project-files";
import { useDocumentStore } from "@/stores/document-store";

export const LatexTools: FC = () => {
  const insertAtCursor = useDocumentStore((s) => s.insertAtCursor);
  const replaceSelection = useDocumentStore((s) => s.replaceSelection);
  const findAndReplace = useDocumentStore((s) => s.findAndReplace);
  const selectionRange = useDocumentStore((s) => s.selectionRange);

  useAssistantTool({
    toolName: "insert_latex",
    description:
      "Insert LaTeX code at the current cursor position in the document",
    parameters: z.object({
      code: z
        .string()
        .describe("The LaTeX code to insert at the cursor position"),
    }),
    execute: async ({ code }: { code: string }) => {
      insertAtCursor(code);
      return { success: true, message: "Code inserted at cursor position" };
    },
    render: function InsertLatexRender({ result }) {
      const isComplete = result != null;
      return (
        <div className="my-2 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
          {isComplete ? (
            <CheckIcon className="size-4 text-green-600" />
          ) : (
            <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
          )}
          <PlusIcon className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {isComplete ? "Inserted LaTeX code" : "Inserting LaTeX code..."}
          </span>
        </div>
      );
    },
  });

  useAssistantTool({
    toolName: "replace_selection",
    description:
      "Replace the currently selected text in the document with LaTeX code",
    parameters: z.object({
      code: z.string().describe("The LaTeX code to replace the selection with"),
    }),
    execute: async ({ code }: { code: string }) => {
      if (!selectionRange) {
        return {
          success: false,
          error: "No text is currently selected in the editor",
        };
      }
      replaceSelection(selectionRange.start, selectionRange.end, code);
      return { success: true, message: "Selection replaced with code" };
    },
    render: function ReplaceSelectionRender({ result }) {
      const isComplete = result != null;
      const hasError = result?.success === false;
      return (
        <div className="my-2 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
          {isComplete ? (
            hasError ? (
              <span className="size-4 text-amber-600">!</span>
            ) : (
              <CheckIcon className="size-4 text-green-600" />
            )
          ) : (
            <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
          )}
          <ReplaceIcon className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {hasError
              ? result.error
              : isComplete
                ? "Replaced selection"
                : "Replacing selection..."}
          </span>
        </div>
      );
    },
  });

  useAssistantTool({
    toolName: "find_and_replace",
    description:
      "Find and replace text in the document. Use this to modify existing content.",
    parameters: z.object({
      find: z.string().describe("The exact text to find in the document"),
      replace: z.string().describe("The text to replace it with"),
    }),
    execute: async ({ find, replace }: { find: string; replace: string }) => {
      const success = findAndReplace(find, replace);
      if (!success) {
        return {
          success: false,
          error: `Could not find "${find}" in the document`,
        };
      }
      return { success: true, message: `Replaced "${find}" with "${replace}"` };
    },
    render: function FindAndReplaceRender({ result }) {
      const isComplete = result != null;
      const hasError = result?.success === false;
      return (
        <div className="my-2 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
          {isComplete ? (
            hasError ? (
              <span className="size-4 text-amber-600">!</span>
            ) : (
              <CheckIcon className="size-4 text-green-600" />
            )
          ) : (
            <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
          )}
          <SearchIcon className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {hasError
              ? result.error
              : isComplete
                ? "Text replaced"
                : "Finding and replacing..."}
          </span>
        </div>
      );
    },
  });

  useAssistantTool({
    toolName: "list_project_files",
    description:
      "List every file in the current LaTeX project with its relative path, file type, and whether it is the main document or the active file.",
    parameters: z.object({}),
    execute: async () => {
      const state = useDocumentStore.getState();
      return {
        success: true,
        mainDocument:
          state.files.find((file) => file.id === state.mainFileId)?.path ??
          null,
        files: state.files.map((file) => ({
          path: file.path,
          type: file.type,
          main: file.id === state.mainFileId,
          active: file.id === state.activeFileId,
        })),
      };
    },
  });

  useAssistantTool({
    toolName: "read_project_file",
    description:
      "Read a text file from the project by its relative path. Use list_project_files first if you do not know the path.",
    parameters: z.object({
      path: z
        .string()
        .describe("Relative file path, for example chapters/intro.tex"),
    }),
    execute: async ({ path }: { path: string }) => {
      const state = useDocumentStore.getState();
      const normalized = path.replace(/^\/+/, "");
      const file = state.files.find(
        (candidate) =>
          candidate.path === normalized || candidate.name === normalized,
      );

      if (!file) {
        return {
          success: false,
          error: `File not found: ${normalized}`,
          files: state.files.map((candidate) => candidate.path),
        };
      }

      if (file.type !== "tex") {
        return {
          success: true,
          path: file.path,
          type: file.type,
          note: "This is a binary file. Its content is not available as text.",
        };
      }

      return {
        success: true,
        path: file.path,
        type: file.type,
        content: file.content ?? "",
      };
    },
  });

  useAssistantTool({
    toolName: "search_project",
    description:
      "Search for text across all editable files in the project. Returns matching file paths and context snippets.",
    parameters: z.object({
      query: z.string().describe("Text to search for, case-insensitive"),
    }),
    execute: async ({ query }: { query: string }) => {
      const state = useDocumentStore.getState();
      const needle = query.trim().toLowerCase();

      if (!needle) {
        return { success: false, error: "Search query is empty" };
      }

      const matches: { path: string; snippet: string }[] = [];

      for (const file of state.files) {
        if (file.type !== "tex" || !file.content) continue;

        const index = file.content.toLowerCase().indexOf(needle);
        if (index === -1) continue;

        const start = Math.max(0, index - 120);
        const end = Math.min(file.content.length, index + query.length + 180);

        matches.push({
          path: file.path,
          snippet: file.content.slice(start, end),
        });
      }

      return {
        success: true,
        query,
        matchCount: matches.length,
        matches: matches.slice(0, 20),
        truncated: matches.length > 20,
      };
    },
  });

  useAssistantTool({
    toolName: "write_project_file",
    description:
      "Create a new text file or overwrite an existing text file in the project. Use relative paths such as sections/methods.tex. Provide the complete file content.",
    parameters: z.object({
      path: z
        .string()
        .describe("Relative path for the file, for example sections/new.tex"),
      content: z.string().describe("The complete text content for the file"),
    }),
    execute: async ({ path, content }: { path: string; content: string }) => {
      const state = useDocumentStore.getState();
      const normalized = path.replace(/^\/+/, "").trim();

      if (!normalized || normalized.includes("..")) {
        return { success: false, error: "Invalid file path" };
      }

      const existing = state.files.find((file) => file.path === normalized);

      if (existing) {
        if (existing.type !== "tex") {
          return {
            success: false,
            error: `Cannot overwrite binary file: ${normalized}`,
          };
        }

        state.updateFileContent(existing.id, content);
        return {
          success: true,
          action: "updated",
          path: existing.path,
        };
      }

      const name = normalized.split("/").pop() ?? normalized;
      state.addFile({
        name,
        path: normalized,
        type: "tex",
        content,
      });

      return { success: true, action: "created", path: normalized };
    },
  });

  useAssistantTool({
    toolName: "set_main_document",
    description:
      "Set which .tex file is compiled as the project's main document.",
    parameters: z.object({
      path: z
        .string()
        .describe("Relative path of the .tex file to use as the main document"),
    }),
    execute: async ({ path }: { path: string }) => {
      const state = useDocumentStore.getState();
      const normalized = path.replace(/^\/+/, "");
      const file = state.files.find(
        (candidate) =>
          candidate.path === normalized || candidate.name === normalized,
      );

      if (!file) {
        return { success: false, error: `File not found: ${normalized}` };
      }

      if (!isLatexDocumentFile(file)) {
        return {
          success: false,
          error: `${file.path} is not a .tex document`,
        };
      }

      state.setMainFile(file.id);
      return { success: true, mainDocument: file.path };
    },
  });

  return null;
};
