"use client";

import { useEffect } from "react";
import { useAui } from "@assistant-ui/store";
import { useDocumentStore } from "@/stores/document-store";

const MAX_CONTEXT_CHARS = 30000;

function truncate(text: string): string {
  if (text.length <= MAX_CONTEXT_CHARS) return text;
  return `${text.slice(0, MAX_CONTEXT_CHARS)}\n% … truncated …`;
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

  const hasSelection = selectionRange !== null;
  const selectedText = hasSelection
    ? content.slice(selectionRange.start, selectionRange.end)
    : null;

  useEffect(() => {
    const selectionInfo = hasSelection
      ? `The user has selected the following text:\n\`\`\`\n${selectedText}\n\`\`\`\nYou can use the replace_selection tool to replace this text.`
      : "The user has NOT selected any text. Do NOT use the replace_selection tool.";

    const fileList = files
      .map((file) => {
        const markers = [
          file.id === mainFileId ? "main document" : null,
          file.id === activeFileId ? "open in editor" : null,
        ].filter(Boolean);
        return `- ${file.path}${markers.length ? ` (${markers.join(", ")})` : ""}`;
      })
      .join("\n");

    const mainFileContext =
      mainFile && mainFile.id !== activeFileId && mainFile.content
        ? `\nThe main document "${mainFile.path}" contains:\n\`\`\`latex\n${truncate(mainFile.content)}\n\`\`\`\n`
        : "";

    return aui.modelContext().register({
      getModelContext: () => ({
        system: `The user is working on the LaTeX project "${projectName}".

Project files (relative paths):
${fileList}

The user is currently editing "${activeFile?.path ?? "document.tex"}":
\`\`\`latex
${truncate(content)}
\`\`\`
${mainFileContext}
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
