"use client";

import {
  ArrowUpRightIcon,
  CheckCircle2Icon,
  CodeXmlIcon,
  CpuIcon,
  FileTextIcon,
  FolderUpIcon,
  PlusIcon,
  ShieldCheckIcon,
  SigmaIcon,
  SparklesIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: FileTextIcon,
    title: "Compile & preview",
    copy: "TeX Live, Tectonic, or auto. Live diagnostics and PDF preview.",
    tone: "bg-primary/10 text-primary",
  },
  {
    icon: SigmaIcon,
    title: "Proof golf",
    copy: "Lean 4 candidates checked by real elaboration, not vibes.",
    tone: "bg-[#5db8a6]/[0.12] text-[#2a8f83]",
  },
  {
    icon: CpuIcon,
    title: "Any model",
    copy: "OpenCode, Anthropic, Hugging Face, Groq, or a local endpoint.",
    tone: "bg-[#e8a55a]/[0.14] text-[#9a6420]",
  },
  {
    icon: ShieldCheckIcon,
    title: "Approve changes",
    copy: "Side-by-side patches with Keep and Undo. Nothing lands silently.",
    tone: "bg-foreground/[0.06] text-foreground",
  },
] as const;

const CODE_LINES = [
  { text: "\\section{Introduction}", tone: "text-[#e8a55a]" },
  { text: "Let Q be a quadratic form on V.", tone: "text-[#faf9f5]" },
  { text: "theorem null_limit : Q x = 0 := by", tone: "text-[#5db8a6]" },
  { text: "  simpa [Q] using hQ x", tone: "text-[#a09d96]" },
  { text: "\\begin{theorem}", tone: "text-[#e8a55a]" },
  { text: "  The limit exists and is unique.", tone: "text-[#faf9f5]" },
  { text: "\\end{theorem}", tone: "text-[#e8a55a]" },
];

export function HomeHero({
  projectCount,
  folderCount,
  sharedCount,
  onNewProject,
  onImport,
}: {
  projectCount: number;
  folderCount: number;
  sharedCount: number;
  onNewProject: () => void;
  onImport: () => void;
}) {
  return (
    <section className="relative mb-5 overflow-hidden rounded-[1.75rem] border border-hairline bg-card/35 p-5 sm:p-7 xl:p-9">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 -left-20 size-80 rounded-full bg-primary/[0.18] blur-3xl" />
        <div className="absolute top-8 -right-24 size-80 rounded-full bg-[#5db8a6]/[0.16] blur-3xl" />
        <div className="absolute bottom-0 left-1/3 size-72 rounded-full bg-[#e8a55a]/[0.12] blur-3xl" />
        <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_1px_1px,rgba(20,20,19,0.08)_1px,transparent_0)] [background-size:22px_22px] dark:[background-image:radial-gradient(circle_at_1px_1px,rgba(250,249,245,0.06)_1px,transparent_0)]" />
      </div>

      <div className="relative grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-background/60 px-3 py-1 text-[0.7rem] text-muted-foreground uppercase tracking-[0.14em] backdrop-blur">
            <span className="size-1.5 rounded-full bg-[#5db8a6]" />
            Local-first research workspace
          </div>

          <h2 className="mt-5 max-w-2xl text-balance font-serif text-[2.6rem] leading-[0.98] tracking-[-0.035em] sm:text-5xl xl:text-[3.7rem]">
            Write the paper.
            <br />
            <span className="bg-gradient-to-r from-primary via-[#e8a55a] to-[#5db8a6] bg-clip-text text-transparent">
              Prove the theorem.
            </span>
          </h2>

          <p className="mt-5 max-w-xl text-[0.95rem] text-muted-foreground leading-7">
            LaTeX, Lean 4, and a bench of AI models in one local-first
            workspace. Draft, compile, golf proofs, and approve every change
            before it lands.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button
              size="lg"
              className="h-11 gap-2 rounded-full px-5 shadow-[0_12px_32px_rgba(204,120,92,0.24)]"
              onClick={onNewProject}
            >
              <PlusIcon className="size-4" />
              New project
              <ArrowUpRightIcon className="size-3.5 opacity-70" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-11 gap-2 rounded-full border-hairline bg-background/60 px-5 backdrop-blur hover:bg-background"
              onClick={onImport}
            >
              <FolderUpIcon className="size-4" />
              Import folder
            </Button>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 text-[0.72rem] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-background/50 px-2.5 py-1">
              <CheckCircle2Icon className="size-3 text-[#5db8a6]" />
              Compile on your machine
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-background/50 px-2.5 py-1">
              <CodeXmlIcon className="size-3 text-primary" />
              LaTeX + Lean in one project
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-background/50 px-2.5 py-1">
              <SparklesIcon className="size-3 text-[#e8a55a]" />
              Review every AI edit
            </span>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.75rem] text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">
                {projectCount}
              </span>{" "}
              project{projectCount === 1 ? "" : "s"}
            </span>
            <span>
              <span className="font-medium text-foreground">{folderCount}</span>{" "}
              folder{folderCount === 1 ? "" : "s"}
            </span>
            <span>
              <span className="font-medium text-foreground">{sharedCount}</span>{" "}
              shared
            </span>
            <span className="hidden items-center gap-1.5 sm:flex">
              <span className="size-1.5 rounded-full bg-[#5db8a6]" />
              Stored in this browser
            </span>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-primary/20 via-transparent to-[#5db8a6]/20 blur-2xl" />
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-surface-dark text-on-dark shadow-[0_30px_80px_rgba(20,20,19,0.28)]">
            <div className="flex items-center gap-2 border-white/10 border-b px-4 py-3">
              <span className="size-2 rounded-full bg-[#c64545]/80" />
              <span className="size-2 rounded-full bg-[#e8a55a]/80" />
              <span className="size-2 rounded-full bg-[#5db8a6]/80" />
              <span className="ml-2 font-mono text-[0.68rem] text-on-dark-soft">
                main.tex
              </span>
              <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-[#5db8a6]/25 bg-[#5db8a6]/10 px-2 py-0.5 font-mono text-[#8dd7c7] text-[0.6rem]">
                <span className="size-1.5 rounded-full bg-[#5db8a6]" />
                local
              </span>
            </div>

            <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto]">
              <div className="min-w-0 rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="overflow-hidden font-mono text-[0.66rem] leading-5">
                  {CODE_LINES.map((line) => (
                    <div key={line.text} className={line.tone}>
                      {line.text}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2 sm:w-36">
                <div className="rounded-lg border border-[#5db8a6]/25 bg-[#5db8a6]/10 p-2.5">
                  <div className="flex items-center gap-1.5 font-medium text-[#8dd7c7] text-[0.65rem]">
                    <CheckCircle2Icon className="size-3" />
                    Lean build
                  </div>
                  <div className="mt-1 font-mono text-[#a09d96] text-[0.6rem]">
                    0 errors · 0 sorries
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                  <div className="flex items-center gap-1.5 font-medium text-[#e8a55a] text-[0.65rem]">
                    <SparklesIcon className="size-3" />
                    Patch ready
                  </div>
                  <div className="mt-1 text-[#a09d96] text-[0.6rem]">
                    Review before applying
                  </div>
                  <div className="mt-2 flex gap-1">
                    <span className="rounded bg-[#5db8a6]/20 px-1.5 py-0.5 font-mono text-[#8dd7c7] text-[0.55rem]">
                      Keep
                    </span>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[#a09d96] text-[0.55rem]">
                      Undo
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-white/10 border-t px-4 py-2 font-mono text-[#a09d96] text-[0.6rem]">
              <span>Compiled in 2.1s</span>
              <span>PDF ready</span>
              <span className="ml-auto">Lean 4 · mathlib</span>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-8 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              className={cn(
                "group rounded-xl border border-hairline bg-background/45 p-3.5 backdrop-blur transition-colors hover:border-primary/25 hover:bg-background/70",
              )}
            >
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-lg",
                  feature.tone,
                )}
              >
                <Icon className="size-3.5" />
              </span>
              <div className="mt-2.5 font-medium text-[0.8rem]">
                {feature.title}
              </div>
              <p className="mt-1 text-[0.7rem] text-muted-foreground leading-relaxed">
                {feature.copy}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
