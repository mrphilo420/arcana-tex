"use client";

import { useEffect } from "react";
import { useAui } from "@assistant-ui/store";
import {
  formatLeanSummaries,
  isLeanFile,
  summarizeLeanFiles,
} from "@/lib/lean";
import { useDocumentStore } from "@/stores/document-store";

// Groq's on-demand tier has a modest tokens-per-minute budget. Keep the
// implicit editor context lean and let the assistant read full files with
// tools when it needs more detail.
const MAX_ACTIVE_CONTEXT_CHARS = 6000;
const MAX_MAIN_CONTEXT_CHARS = 2500;
const MAX_LEAN_CONTEXT_CHARS = 4500;
const MAX_FILE_LIST_CHARS = 2500;

const CODE_EXECUTION_GUIDE = `Python, R, and subagents are available for computational figures and TikZ work:
- Use run_python or run_r when a figure needs numerical computation, data processing, plotting, or generated geometry. Write a complete script; have it print TikZ or write a .tex/.tikz/.pgf artifact. Prefer direct TikZ when computation is unnecessary. Never claim code ran before the tool returns a result.
- Use spawn_subagents for independent parallel work, especially complex TikZ requests. Useful roles: tikz-python, tikz-r, tikz-reviewer, planner, latex-reviewer, researcher. Subagents cannot inspect the project or execute code; give each one focused context, then verify and synthesize their output yourself.
- For a requested figure: decide whether direct TikZ or computation is appropriate; use Python/R where it adds accuracy; review the generated code; then insert only complete, compilable TikZ with any required packages. Do not insert raster images as a substitute for editable TikZ unless the user explicitly asks for one.
- Use one code-tool call per script. If it succeeds, use the result and move on. If it fails, read stderr and fix the script; never put tool names, error messages, or pseudo-instructions into the script body.`;

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const head = Math.ceil(limit * 0.72);
  const tail = limit - head;
  return `${text.slice(0, head)}\n… truncated …\n${text.slice(-tail)}`;
}

function lineForOffset(text: string, offset: number): number {
  return text.slice(0, Math.max(0, offset)).split("\n").length;
}

export function useDocumentContext() {
  const aui = useAui();
  const projectName = useDocumentStore((s) => s.projectName);
  const files = useDocumentStore((s) => s.files);
  const activeFileId = useDocumentStore((s) => s.activeFileId);
  const mainFileId = useDocumentStore((s) => s.mainFileId);
  const selectionRange = useDocumentStore((s) => s.selectionRange);

  const activeFile = files.find((file) => file.id === activeFileId);
  const mainFile = files.find((file) => file.id === mainFileId);
  const content = activeFile?.content ?? "";
  const activeIsLean = activeFile ? isLeanFile(activeFile) : false;
  const activeIsMarkdown = activeFile
    ? /\.(?:md|markdown)$/i.test(activeFile.path)
    : false;
  const activeLanguage = activeIsLean
    ? "lean"
    : activeIsMarkdown
      ? "markdown"
      : "latex";
  const leanSummaries = summarizeLeanFiles(files);
  const leanContext = formatLeanSummaries(leanSummaries);

  const hasSelection = selectionRange !== null;
  const selectedText = hasSelection
    ? content.slice(selectionRange.start, selectionRange.end)
    : null;
  const selectionStartLine = hasSelection
    ? lineForOffset(content, selectionRange.start)
    : null;
  const selectionEndLine = hasSelection
    ? lineForOffset(
        content,
        Math.max(selectionRange.start, selectionRange.end - 1),
      )
    : null;

  useEffect(() => {
    const selectionInfo =
      hasSelection && selectedText
        ? `The user has selected the following text in "${activeFile?.path ?? "document.tex"}" at ${selectionStartLine === selectionEndLine ? `line ${selectionStartLine}` : `lines ${selectionStartLine}–${selectionEndLine}`}:\n\`\`\`${activeLanguage}\n${truncate(selectedText, 4000)}\n\`\`\`\nYou can use the replace_selection tool to replace this text.`
        : "The user has NOT selected any text. Do NOT use the replace_selection tool.";

    const fileList = truncate(
      files
        .map((file) => {
          const markers = [
            file.id === mainFileId ? "main document" : null,
            file.id === activeFileId ? "open in editor" : null,
            isLeanFile(file) ? "Lean 4 source" : null,
            /\.(?:md|markdown)$/i.test(file.path) ? "Markdown" : null,
          ].filter(Boolean);
          return `- ${file.path}${markers.length ? ` (${markers.join(", ")})` : ""}`;
        })
        .join("\n"),
      MAX_FILE_LIST_CHARS,
    );

    const mainFileContext =
      mainFile && mainFile.id !== activeFileId && mainFile.content
        ? `\nThe main document "${mainFile.path}" contains:\n\`\`\`latex\n${truncate(mainFile.content, MAX_MAIN_CONTEXT_CHARS)}\n\`\`\`\n`
        : "";

    const leanContextSection = leanSummaries.length
      ? `\nLean 4 sources in this project:\n${truncate(leanContext, MAX_LEAN_CONTEXT_CHARS)}\n\nLean code is not LaTeX. Preserve declaration names and syntax. Use inspect_lean_sources for structured details and read_project_file for full source. Treat sorry/admit as incomplete proofs; axioms, native_decide, unsafe, and partial declarations are trust or soundness risks. Never claim a Lean proof is complete or kernel-checked without build evidence.\n`
      : "";

    return aui.modelContext().register({
      getModelContext: () => ({
        system: `The user is working on the LaTeX project "${projectName}".

Project files (relative paths):
${fileList}

The user is currently editing "${activeFile?.path ?? "document.tex"}":
\`\`\`${activeLanguage}\n${truncate(content, MAX_ACTIVE_CONTEXT_CHARS)}\n\`\`\`
${mainFileContext}${leanContextSection}
${selectionInfo}

The project may contain multiple files that reference each other with \\input, \\include, \\bibliography, or \\includegraphics. Use the file list to understand the project structure and reference the current document when helping the user. If you need the full text of a large file, use read_project_file instead of assuming the truncated excerpt is complete.${CODE_EXECUTION_GUIDE}`,
      }),
    });
  }, [
    aui,
    projectName,
    files,
    activeFileId,
    mainFileId,
    activeFile?.path,
    content,
    mainFile,
    hasSelection,
    selectedText,
    selectionStartLine,
    selectionEndLine,
    activeLanguage,
    leanContext,
    leanSummaries.length,
  ]);
}
