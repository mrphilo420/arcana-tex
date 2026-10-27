"use client";

import { AuiIf, useThreadRuntime } from "@assistant-ui/react";
import { FileCodeIcon, FileSearchIcon, SigmaIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDevFeatureFlag } from "@/stores/dev-panel-store";

const REVIEW_PROMPT = "/paper-review";
const PROVE_PROMPT = "/prove";
const LEAN_REVIEW_PROMPT =
  "Audit the Lean 4 sources in this project. Use inspect_lean_sources, summarize the declarations, map formal results to the paper's claims where possible, and flag sorry, admit, axioms, native_decide, unsafe or partial code. Do not edit any files.";

export function ChatQuickActions({ className }: { className?: string }) {
  const runtime = useThreadRuntime();
  const showReview = useDevFeatureFlag("paperReview");
  const showProve = useDevFeatureFlag("prove");
  const showLeanAudit = useDevFeatureFlag("leanAudit");

  const send = (text: string) => {
    runtime.append({
      role: "user",
      content: [{ type: "text", text }],
    });
  };

  if (!showReview && !showProve && !showLeanAudit) return null;

  return (
    <AuiIf condition={({ thread }) => !thread.isRunning}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 text-[0.75rem]",
          className,
        )}
      >
        {showReview && (
          <button
            type="button"
            onClick={() => send(REVIEW_PROMPT)}
            className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
            title="Run the /paper-review skill"
          >
            <FileSearchIcon className="size-3" />
            Review paper
          </button>
        )}
        {showProve && (
          <button
            type="button"
            onClick={() => send(PROVE_PROMPT)}
            className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
            title="Run the /prove mathematical-prover skill"
          >
            <SigmaIcon className="size-3" />
            Prove
          </button>
        )}
        {showLeanAudit && (
          <button
            type="button"
            onClick={() => send(LEAN_REVIEW_PROMPT)}
            className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
            title="Audit Lean 4 sources"
          >
            <FileCodeIcon className="size-3" />
            Lean audit
          </button>
        )}
        <span className="hidden px-1 font-mono text-[0.75rem] text-muted-foreground/70 sm:inline">
          /prove · /paper-review
        </span>
      </div>
    </AuiIf>
  );
}
