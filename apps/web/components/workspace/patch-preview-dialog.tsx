"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckIcon, Loader2Icon, Undo2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isLatexRelatedFile } from "@/lib/file-kind";
import { createProjectVersion } from "@/lib/projects/repository";
import { useDocumentStore } from "@/stores/document-store";
import { usePatchStore } from "@/stores/patch-store";
import { cn } from "@/lib/utils";

function DiffColumn({
  title,
  side,
  lines,
  startLine,
}: {
  title: string;
  side: "before" | "after";
  lines: string[];
  startLine: number;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-md border border-hairline">
      <div
        className={cn(
          "border-hairline border-b px-2 py-1 font-medium text-[0.7rem] uppercase tracking-[0.12em]",
          side === "before"
            ? "bg-destructive/8 text-destructive"
            : "bg-[#5db8a6]/10 text-[#2a8f83]",
        )}
      >
        {title}
      </div>
      <div className="max-h-[48vh] overflow-auto bg-surface-dark py-1 font-mono text-[0.75rem] leading-relaxed">
        {lines.length === 0 ? (
          <div className="px-3 py-2 text-muted-foreground italic">
            (no lines)
          </div>
        ) : (
          lines.map((line, index) => (
            <div
              key={`${side}-${startLine + index}-${line}`}
              className={cn(
                "flex min-w-max",
                side === "before" ? "bg-destructive/10" : "bg-[#5db8a6]/10",
              )}
            >
              <span className="w-10 shrink-0 select-none border-hairline/50 border-r px-1 text-right text-muted-foreground/60">
                {startLine + index}
              </span>
              <span className="whitespace-pre px-2 text-on-dark-soft">
                {line || " "}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function PatchPreviewDialog() {
  const patch = usePatchStore((state) => state.patch);
  const clear = usePatchStore((state) => state.clear);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!patch) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") clear();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [patch, clear]);

  const beforeLines = useMemo(
    () => (patch ? patch.before.split("\n") : []),
    [patch],
  );
  const afterLines = useMemo(
    () => (patch ? patch.after.split("\n") : []),
    [patch],
  );
  const added = Math.max(0, afterLines.length - beforeLines.length);
  const removed = Math.max(0, beforeLines.length - afterLines.length);

  if (!patch) return null;

  const keep = async () => {
    const state = useDocumentStore.getState();
    const file = state.files.find((candidate) => candidate.id === patch.fileId);
    if (!file) {
      toast.error("The target file no longer exists.");
      clear();
      return;
    }

    const normalized = (file.content ?? "").replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    const current = lines.slice(patch.startLine - 1, patch.endLine).join("\n");
    if (current !== patch.before) {
      toast.error("The file changed after this patch was proposed.", {
        description: "Discard the patch and ask the assistant to retry.",
      });
      return;
    }

    setApplying(true);
    try {
      if (state.projectId) {
        await createProjectVersion({
          projectId: state.projectId,
          label: "Before applying AI patch",
          name: state.projectName,
          projectCreatedAt: state.createdAt ?? Date.now(),
          files: state.files,
          activeFileId: state.activeFileId ?? file.id,
          mainFileId: state.mainFileId,
          compiler: state.compiler,
          comments: state.comments,
        });
      }

      const replacementLines = patch.after.length
        ? patch.after.replace(/\n$/, "").split("\n")
        : [];
      lines.splice(
        patch.startLine - 1,
        patch.endLine - patch.startLine + 1,
        ...replacementLines,
      );
      state.updateFileContent(file.id, lines.join("\n"));
      state.setActiveFile(file.id);

      if (isLatexRelatedFile(file)) {
        state.requestCompile();
      } else if (file.path.toLowerCase().endsWith(".lean")) {
        toast.info("Patch kept", {
          description: "Run the Lean build to verify the new proof.",
        });
      } else {
        toast.info("Patch kept", {
          description: "Run the matching Python or R runtime to verify it.",
        });
      }
      if (isLatexRelatedFile(file)) {
        toast.success("Patch kept", { description: "Recompiling LaTeX." });
      }
      clear();
    } catch (error) {
      toast.error("Could not apply the patch", {
        description:
          error instanceof Error ? error.message.slice(0, 240) : undefined,
      });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-3 sm:p-6"
      role="presentation"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-hairline bg-background shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="patch-preview-title"
      >
        <div className="flex items-center gap-2 border-hairline border-b px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 id="patch-preview-title" className="font-medium text-sm">
              Review AI patch
            </h2>
            <p className="truncate font-mono text-[0.75rem] text-muted-foreground">
              {patch.filePath}:{patch.startLine}
              {patch.endLine !== patch.startLine ? `–${patch.endLine}` : ""}
            </p>
          </div>
          <span className="rounded border border-[#5db8a6]/30 bg-[#5db8a6]/10 px-1.5 py-0.5 font-mono text-[#2a8f83] text-[0.7rem]">
            +{added} −{removed}
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={clear}
            aria-label="Close patch preview"
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {patch.explanation && (
            <p className="mb-3 text-[0.875rem] text-muted-foreground leading-relaxed">
              {patch.explanation}
            </p>
          )}
          <div className="grid gap-2 md:grid-cols-2">
            <DiffColumn
              title="Before"
              side="before"
              lines={beforeLines}
              startLine={patch.startLine}
            />
            <DiffColumn
              title="After"
              side="after"
              lines={afterLines}
              startLine={patch.startLine}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-hairline border-t bg-muted/20 px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={clear}
            disabled={applying}
          >
            <Undo2Icon className="size-3.5" />
            Undo
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => void keep()}
            disabled={applying}
          >
            {applying ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <CheckIcon className="size-3.5" />
            )}
            Keep
          </Button>
        </div>
      </div>
    </div>
  );
}
