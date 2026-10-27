"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileCheck2Icon,
  Loader2Icon,
  RefreshCwIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  analyzeSubmission,
  createSourceZip,
  type CheckStatus,
  type SubmissionTarget,
} from "@/lib/submission";
import { detectMainFile } from "@/lib/project-files";
import { useDocumentStore } from "@/stores/document-store";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const TARGET_LABELS: Record<SubmissionTarget, string> = {
  arxiv: "arXiv / preprint",
  journal: "Journal / publisher",
  conference: "Conference / double-blind",
};

const STATUS_ICONS = {
  pass: CheckCircle2Icon,
  warning: AlertTriangleIcon,
  blocker: AlertCircleIcon,
} satisfies Record<CheckStatus, typeof CheckCircle2Icon>;

export function SubmissionPanel() {
  const open = useDocumentStore((s) => s.isSubmissionOpen);
  const setOpen = useDocumentStore((s) => s.setSubmissionOpen);
  const files = useDocumentStore((s) => s.files);
  const mainFileId = useDocumentStore((s) => s.mainFileId);
  const compiler = useDocumentStore((s) => s.compiler);
  const diagnostics = useDocumentStore((s) => s.compileDiagnostics);
  const compileError = useDocumentStore((s) => s.compileError);
  const pdfData = useDocumentStore((s) => s.pdfData);
  const projectName = useDocumentStore((s) => s.projectName);
  const setActiveFile = useDocumentStore((s) => s.setActiveFile);
  const requestJump = useDocumentStore((s) => s.requestJumpToPosition);
  const requestCompile = useDocumentStore((s) => s.requestCompile);

  const [target, setTarget] = useState<SubmissionTarget>(() => {
    if (typeof window === "undefined") return "arxiv";
    const saved = window.localStorage.getItem("open-prism:submission-target");
    return saved === "journal" || saved === "conference" || saved === "arxiv"
      ? saved
      : "arxiv";
  });
  const [anonymous, setAnonymous] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.localStorage.getItem("open-prism:submission-anonymous") === "1"
    );
  });
  const [includePdf, setIncludePdf] = useState(true);
  const [isZipping, setIsZipping] = useState(false);

  useEffect(() => {
    window.localStorage.setItem("open-prism:submission-target", target);
  }, [target]);

  useEffect(() => {
    window.localStorage.setItem(
      "open-prism:submission-anonymous",
      anonymous ? "1" : "0",
    );
  }, [anonymous]);

  const report = useMemo(
    () =>
      analyzeSubmission({
        files,
        mainFileId,
        compiler,
        diagnostics,
        compileError,
        target,
        anonymous,
      }),
    [anonymous, compiler, compileError, diagnostics, files, mainFileId, target],
  );

  const mainFile =
    files.find((file) => file.id === mainFileId) ??
    detectMainFile(files) ??
    null;

  const jumpToCheck = (filePath?: string, line?: number) => {
    if (!filePath || !line) return;
    const file = files.find((candidate) => candidate.path === filePath);
    if (!file || file.type !== "tex") return;

    const lines = (file.content ?? "").split("\n");
    let position = 0;
    for (let index = 0; index < line - 1; index++) {
      position += (lines[index]?.length ?? 0) + 1;
    }

    setActiveFile(file.id);
    requestJump(position);
  };

  const handleDownload = async () => {
    if (isZipping) return;
    setIsZipping(true);

    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const baseName = (mainFile?.name ?? projectName)
        .replace(/\.(tex|ltx)$/i, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "-");
      const zip = createSourceZip(
        files,
        includePdf && pdfData
          ? {
              path: `${baseName || "document"}.pdf`,
              data: pdfData,
            }
          : null,
      );
      const blob = new Blob([new Uint8Array(zip)], {
        type: "application/zip",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${baseName || "project"}-${target}-${new Date()
        .toISOString()
        .slice(0, 10)}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Source bundle downloaded");
    } catch (error) {
      console.error("Failed to build source bundle", error);
      toast.error("Could not build the source bundle");
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen} modal={false}>
      <SheetContent
        overlay={false}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[500px]"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="border-hairline border-b px-4 py-3 pr-12">
          <SheetTitle className="flex items-center gap-2 text-base">
            <FileCheck2Icon className="size-4 text-primary" />
            Submission readiness
          </SheetTitle>
          <SheetDescription className="text-xs">
            Local heuristic checks and a clean source bundle. Nothing is
            uploaded.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[0.75rem] text-muted-foreground uppercase tracking-[0.14em]">
                Target
              </span>
              <Select
                value={target}
                onValueChange={(value) => setTarget(value as SubmissionTarget)}
              >
                <SelectTrigger
                  size="sm"
                  className="h-8 w-[190px] text-[0.75rem]"
                  aria-label="Submission target"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TARGET_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-[0.875rem]">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(event) => setAnonymous(event.target.checked)}
                className="accent-primary"
              />
              Check for identity markers (double-blind review)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-[0.875rem]">
              <input
                type="checkbox"
                checked={includePdf}
                onChange={(event) => setIncludePdf(event.target.checked)}
                className="accent-primary"
              />
              Include the compiled PDF in the bundle
            </label>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {(["blocker", "warning", "pass"] as CheckStatus[]).map((status) => {
              const Icon = STATUS_ICONS[status];
              return (
                <div
                  key={status}
                  className={cn(
                    "rounded-lg border p-2.5 text-center",
                    status === "blocker"
                      ? "border-destructive/25 bg-destructive/5"
                      : status === "warning"
                        ? "border-[#b9822f]/25 bg-[#b9822f]/5"
                        : "border-[#5db8a6]/25 bg-[#5db8a6]/5",
                  )}
                >
                  <Icon
                    className={cn(
                      "mx-auto mb-1 size-3.5",
                      status === "blocker"
                        ? "text-destructive"
                        : status === "warning"
                          ? "text-[#b9822f]"
                          : "text-[#2a8f83]",
                    )}
                  />
                  <div className="font-serif text-[1.25rem] leading-none">
                    {report.counts[status]}
                  </div>
                  <div className="mt-1 text-[0.75rem] text-muted-foreground uppercase tracking-[0.1em]">
                    {status}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            {report.checks.map((check) => {
              const Icon = STATUS_ICONS[check.status];
              return (
                <button
                  key={check.id}
                  type="button"
                  className={cn(
                    "flex w-full items-start gap-2 rounded-lg border p-3 text-left transition-colors",
                    check.filePath
                      ? "hover:border-primary/35 hover:bg-card/60"
                      : "cursor-default",
                    check.status === "blocker"
                      ? "border-destructive/20"
                      : check.status === "warning"
                        ? "border-[#b9822f]/20"
                        : "border-[#5db8a6]/20",
                  )}
                  onClick={() => jumpToCheck(check.filePath, check.line)}
                >
                  <Icon
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      check.status === "blocker"
                        ? "text-destructive"
                        : check.status === "warning"
                          ? "text-[#b9822f]"
                          : "text-[#2a8f83]",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-[0.875rem] leading-snug">
                        {check.title}
                      </span>
                      <span className="shrink-0 font-mono text-[0.75rem] text-muted-foreground uppercase">
                        {check.category}
                      </span>
                    </div>
                    <p className="mt-1 text-[0.75rem] text-muted-foreground leading-relaxed">
                      {check.detail}
                    </p>
                    {check.filePath && (
                      <p className="mt-1 font-mono text-[0.75rem] text-primary/80">
                        {check.filePath}
                        {check.line ? `:${check.line}` : ""} · click to jump
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-hairline bg-card/30 p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-[0.75rem] text-muted-foreground uppercase tracking-[0.14em]">
                Source bundle
              </span>
              <span className="font-mono text-[0.75rem] text-muted-foreground">
                {report.bundle.length} files ·{" "}
                {report.bundleBytes > 1024 * 1024
                  ? `${(report.bundleBytes / 1024 / 1024).toFixed(1)} MB`
                  : `${Math.max(1, Math.round(report.bundleBytes / 1024))} KB`}
              </span>
            </div>
            <p className="mt-1 text-[0.75rem] text-muted-foreground leading-relaxed">
              Build artifacts are excluded. Sources, bibliography, figures, and
              class/style files are included.
            </p>
            <Button
              className="mt-3 w-full"
              onClick={() => void handleDownload()}
              disabled={isZipping || !mainFile}
            >
              {isZipping ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <DownloadIcon className="size-3.5" />
              )}
              Download source bundle (.zip)
            </Button>
          </div>

          {compileError && (
            <div className="flex items-center justify-between rounded-lg border border-destructive/25 bg-destructive/5 p-3">
              <div className="text-[0.75rem] text-destructive">
                The project has a compile error.
              </div>
              <Button variant="outline" size="sm" onClick={requestCompile}>
                <RefreshCwIcon className="size-3.5" />
                Compile
              </Button>
            </div>
          )}

          <p className="text-[0.75rem] text-muted-foreground leading-relaxed">
            These checks are local heuristics, not a guarantee of acceptance.
            Always verify the current portal requirements and build the bundle
            in a clean TeX environment.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
