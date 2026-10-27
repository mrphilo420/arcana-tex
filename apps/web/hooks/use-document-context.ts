"use client";

import { useEffect } from "react";
import { useAui } from "@assistant-ui/store";
import {
  fileKindContextLabel,
  fileKindForFile,
  fileKindLabel,
  languageForFileKind,
  type FileKind,
} from "@/lib/file-kind";
import { formatLeanSummaries, summarizeLeanFiles } from "@/lib/lean";
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
- Code runs in a temporary directory, not the project root. Pass any data the script needs through its files input; do not assume it can read project paths.
- Use one code-tool call per script. If it succeeds, use the result and move on. If it fails, read stderr and fix the script; never put tool names, error messages, or pseudo-instructions into the script body.`;

function activeModeGuide(kind: FileKind, path: string): string {
  switch (kind) {
    case "latex":
      return `Active mode: LaTeX (${path}). Treat this as LaTeX source. Compile-log diagnostics, LaTeX errors, and source fixes belong to LaTeX. Do not run Lean tools or treat Python/R code as LaTeX. If a figure needs computation, use run_python or run_r only for the computation and insert editable TikZ back into a .tex file when asked.`;
    case "lean":
      return `Active mode: Lean 4 (${path}). Treat this as a Lean 4 source file, not LaTeX. Use inspect_lean_sources and build_lean_project for evidence. Never claim a proof is complete or kernel-checked without build output. Do not run LaTeX compilation, compile-log repair, or LaTeX formatting tools on this file. Do not use run_python or run_r unless the user explicitly asks for a separate computational task.`;
    case "python":
      return `Active mode: Python (${path}). Treat this as Python source. Use run_python for execution and testing; do not interpret it as LaTeX and do not invoke the LaTeX compiler or LaTeX repair rules. If Python is used to generate TikZ, return an editable TikZ artifact and insert it only into a LaTeX file when asked.`;
    case "r":
      return `Active mode: R (${path}). Treat this as R source. Use run_r for execution and testing; do not interpret it as LaTeX and do not invoke the LaTeX compiler or LaTeX repair rules. If R is used to generate TikZ, return an editable TikZ artifact and insert it only into a LaTeX file when asked.`;
    case "markdown":
      return `Active mode: Markdown (${path}). Treat this as Markdown prose, not LaTeX or Lean. Do not invoke the LaTeX compiler or Lean tools. Use LaTeX only inside explicit math delimiters when the user asks for it.`;
    case "data":
      return `Active mode: data (${path}). Treat this as data, not source code. Use Python or R to inspect or transform it when asked; do not invoke the LaTeX compiler or Lean tools.`;
    case "text":
      return `Active mode: plain text (${path}). Do not assume this is LaTeX, Lean, Python, or R. Use the language-specific tools only when the user names that language or the file format is unambiguous.`;
    default:
      return `Active mode: file (${path}). Determine the format from its extension before choosing a compiler or runtime. Do not apply LaTeX, Lean, Python, or R rules indiscriminately.`;
  }
}

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
  const activeKind = activeFile ? fileKindForFile(activeFile) : "other";
  const activeLanguage = languageForFileKind(activeKind);
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
            fileKindForFile(file) === "latex"
              ? null
              : fileKindContextLabel(fileKindForFile(file)),
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
    const modeGuideSection = activeModeGuide(
      activeKind,
      activeFile?.path ?? "document.tex",
    );

    return aui.modelContext().register({
      getModelContext: () => ({
        system: `The user is working on the project "${projectName}".

${modeGuideSection}

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
    activeKind,
    activeLanguage,
    leanContext,
    leanSummaries.length,
  ]);
}
