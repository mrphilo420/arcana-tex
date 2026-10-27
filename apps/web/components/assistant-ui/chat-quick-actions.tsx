"use client";

import { AuiIf, useThreadRuntime } from "@assistant-ui/react";
import { FileCodeIcon, FileSearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const REVIEW_PROMPT = "/paper-review";
const LEAN_REVIEW_PROMPT =
  "Audit the Lean 4 sources in this project. Use inspect_lean_sources, summarize the declarations, map formal results to the paper's claims where possible, and flag sorry, admit, axioms, native_decide, unsafe or partial code. Do not edit any files.";

export function ChatQuickActions({ className }: { className?: string }) {
  const runtime = useThreadRuntime();

  const send = (text: string) => {
    runtime.append({
      role: "user",
      content: [{ type: "text", text }],
    });
  };

  return (
    <AuiIf condition={({ thread }) => !thread.isRunning}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 text-[10px]",
          className,
        )}
      >
        <button
          type="button"
          onClick={() => send(REVIEW_PROMPT)}
          className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
          title="Run the /paper-review skill"
        >
          <FileSearchIcon className="size-3" />
          Review paper
        </button>
        <button
          type="button"
          onClick={() => send(LEAN_REVIEW_PROMPT)}
          className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
          title="Audit Lean 4 sources"
        >
          <FileCodeIcon className="size-3" />
          Lean audit
        </button>
        <span className="hidden px-1 font-mono text-[9px] text-muted-foreground/70 sm:inline">
          /paper-review
        </span>
      </div>
    </AuiIf>
  );
}
