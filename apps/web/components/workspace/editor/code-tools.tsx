"use client";

import { useAssistantToolUI } from "@assistant-ui/react";
import {
  AlertTriangleIcon,
  CheckIcon,
  CodeIcon,
  GitBranchIcon,
  LoaderIcon,
  TerminalIcon,
} from "lucide-react";

interface CodeArtifact {
  path: string;
  content: string;
  truncated: boolean;
}

interface CodeResult {
  success?: boolean;
  language?: string;
  exitCode?: number | null;
  timedOut?: boolean;
  durationMs?: number;
  stdout?: string;
  stderr?: string;
  artifacts?: CodeArtifact[];
  sandboxed?: boolean;
  warning?: string;
  error?: string;
}

interface SubagentResult {
  role: string;
  task: string;
  text: string;
  error?: string;
}

interface SubagentResponse {
  model?: string;
  results?: SubagentResult[];
  succeeded?: number;
  failed?: number;
  success?: boolean;
  error?: string;
}

function CodeToolCard({
  language,
  result,
}: {
  language: "Python" | "R";
  result: CodeResult | undefined;
}) {
  const isComplete = result != null;
  const success = result?.success === true;
  const failed = isComplete && !success;
  const artifacts = result?.artifacts ?? [];

  return (
    <div className="my-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        {!isComplete ? (
          <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
        ) : success ? (
          <CheckIcon className="size-4 text-green-600" />
        ) : (
          <AlertTriangleIcon className="size-4 text-amber-600" />
        )}
        <TerminalIcon className="size-4 text-muted-foreground" />
        <span className="font-medium">
          {isComplete
            ? failed
              ? `${language} exited with an error`
              : `${language} completed`
            : `Running ${language}...`}
        </span>
        {isComplete && typeof result.durationMs === "number" && (
          <span className="ml-auto font-mono text-[0.7rem] text-muted-foreground">
            {(result.durationMs / 1000).toFixed(2)}s
          </span>
        )}
      </div>

      {isComplete && artifacts.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {artifacts.map((artifact) => (
            <span
              key={artifact.path}
              className="rounded border border-border/70 bg-background/70 px-1.5 py-0.5 font-mono text-[0.68rem] text-muted-foreground"
              title={artifact.truncated ? "Artifact truncated" : undefined}
            >
              {artifact.path}
            </span>
          ))}
        </div>
      )}

      {isComplete && success && result.stdout && (
        <pre className="mt-1.5 max-h-24 overflow-auto whitespace-pre-wrap font-mono text-[0.7rem] text-muted-foreground">
          {result.stdout.slice(0, 1_000)}
        </pre>
      )}

      {isComplete && result.stderr && failed && (
        <pre className="mt-1.5 max-h-28 overflow-auto whitespace-pre-wrap font-mono text-[0.7rem] text-amber-700 dark:text-amber-400">
          {result.stderr.slice(0, 1_200)}
        </pre>
      )}

      {isComplete && result.warning && (
        <p className="mt-1 text-[0.7rem] text-muted-foreground">
          {result.warning}
        </p>
      )}
    </div>
  );
}

function SubagentsCard({ result }: { result: SubagentResponse | undefined }) {
  const isComplete = result != null;
  const failed = result?.failed ?? 0;

  return (
    <div className="my-2 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
      {isComplete ? (
        failed > 0 ? (
          <AlertTriangleIcon className="size-4 text-amber-600" />
        ) : (
          <CheckIcon className="size-4 text-green-600" />
        )
      ) : (
        <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
      )}
      <GitBranchIcon className="size-4 text-muted-foreground" />
      <span className="text-muted-foreground">
        {!isComplete
          ? "Running subagents..."
          : failed > 0
            ? `${result.succeeded ?? 0} subagents succeeded, ${failed} failed`
            : `${result.succeeded ?? result.results?.length ?? 0} subagents completed`}
      </span>
    </div>
  );
}

function useCodeToolUI(language: "python" | "r") {
  const label = language === "python" ? "Python" : "R";

  useAssistantToolUI({
    toolName: language === "python" ? "run_python" : "run_r",
    render: ({ result }) => (
      <CodeToolCard
        language={label}
        result={result as CodeResult | undefined}
      />
    ),
  });
}

export function CodeTools() {
  useCodeToolUI("python");
  useCodeToolUI("r");

  useAssistantToolUI({
    toolName: "spawn_subagents",
    render: ({ result }) => (
      <SubagentsCard result={result as SubagentResponse | undefined} />
    ),
  });

  return null;
}

export function CodeToolsBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[0.7rem] text-muted-foreground">
      <CodeIcon className="size-3" />
      Python · R · subagents
    </span>
  );
}
