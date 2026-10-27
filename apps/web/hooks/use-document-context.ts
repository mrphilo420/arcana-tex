"use client";

import { useEffect } from "react";
import { useAui } from "@assistant-ui/store";
import {
  formatLeanSummaries,
  isLeanFile,
  summarizeLeanFiles,
} from "@/lib/lean";
import { useDocumentStore } from "@/stores/document-store";

const MAX_CONTEXT_CHARS = 30000;

function truncate(text: string): string {
  if (text.length <= MAX_CONTEXT_CHARS) return text;
  return `${text.slice(0, MAX_CONTEXT_CHARS)}\n… truncated …`;
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

  useEffect(() => {
    const selectionInfo = hasSelection
      ? `The user has selected the following text:\n\`\`\`${activeLanguage}\n${selectedText}\n\`\`\`\nYou can use the replace_selection tool to replace this text.`
      : "The user has NOT selected any text. Do NOT use the replace_selection tool.";

    const fileList = files
      .map((file) => {
        const markers = [
          file.id === mainFileId ? "main document" : null,
          file.id === activeFileId ? "open in editor" : null,
          isLeanFile(file) ? "Lean 4 source" : null,
          /\.(?:md|markdown)$/i.test(file.path) ? "Markdown" : null,
        ].filter(Boolean);
        return `- ${file.path}${markers.length ? ` (${markers.join(", ")})` : ""}`;
      })
      .join("\n");

    const mainFileContext =
      mainFile && mainFile.id !== activeFileId && mainFile.content
        ? `\nThe main document "${mainFile.path}" contains:\n\`\`\`latex\n${truncate(mainFile.content)}\n\`\`\`\n`
        : "";

    const leanContextSection = leanSummaries.length
      ? `\nLean 4 sources in this project:\n${leanContext}\n\nLean code is not LaTeX. Preserve declaration names and syntax. Use inspect_lean_sources for structured details and read_project_file for full source. Treat sorry/admit as incomplete proofs; axioms, native_decide, unsafe, and partial declarations are trust or soundness risks. Never claim a Lean proof is complete or kernel-checked without build evidence.\n`
      : "";

    return aui.modelContext().register({
      getModelContext: () => ({
        system: `The user is working on the LaTeX project "${projectName}".

Project files (relative paths):
${fileList}

The user is currently editing "${activeFile?.path ?? "document.tex"}":
\`\`\`${activeLanguage}
${truncate(content)}
\`\`\`
${mainFileContext}${leanContextSection}
${selectionInfo}

The project may contain multiple files that reference each other with \\input, \\include, \\bibliography, or \\includegraphics. Use the file list to understand the project structure and reference the current document when helping the user.`,
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
  ]);
}
