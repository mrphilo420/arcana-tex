"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BrainCircuitIcon,
  ChartNoAxesCombinedIcon,
  CheckIcon,
  FlaskConicalIcon,
  LayersIcon,
  NetworkIcon,
  PresentationIcon,
  SearchIcon,
  SigmaIcon,
  SparklesIcon,
  WorkflowIcon,
  XIcon,
} from "lucide-react";
import {
  TIKZ_DIAGRAM_TEMPLATES,
  type DiagramCategory,
  type TikzDiagramTemplate,
} from "@/lib/tikz-diagrams";
import { TIKZ_COLORS, TIKZ_FILLS, type TikzShape } from "@/lib/tikz";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const VIEW_W = 640;
const VIEW_H = 400;
const GRID = 40;

type CategoryFilter = "All" | DiagramCategory;

const CATEGORIES: {
  id: CategoryFilter;
  label: string;
  icon: typeof SparklesIcon;
}[] = [
  { id: "All", label: "All diagrams", icon: SparklesIcon },
  { id: "Research", label: "Research", icon: FlaskConicalIcon },
  { id: "Process", label: "Process", icon: WorkflowIcon },
  { id: "Models", label: "Models", icon: BrainCircuitIcon },
  { id: "Systems", label: "Systems", icon: LayersIcon },
  { id: "Concept", label: "Concept maps", icon: NetworkIcon },
  { id: "Math", label: "Mathematics", icon: SigmaIcon },
  { id: "Statistics", label: "Statistics", icon: ChartNoAxesCombinedIcon },
];

function toPx(value: number): number {
  return value * GRID;
}

function toPy(value: number): number {
  return VIEW_H - value * GRID;
}

function colorValue(name: string): string {
  return TIKZ_COLORS.find((color) => color.name === name)?.value ?? "#141413";
}

function fillValue(name: string): string {
  return TIKZ_FILLS.find((fill) => fill.name === name)?.value ?? "transparent";
}

function previewText(value: string): string {
  return value
    .replace(/\\textbf\{([^}]*)\}/g, "$1")
    .replace(/\\textit\{([^}]*)\}/g, "$1")
    .replace(/\\emph\{([^}]*)\}/g, "$1")
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\\circ/g, "∘")
    .replace(/\\times/g, "×")
    .replace(/\$/g, "")
    .replace(/[{}]/g, "");
}

function TemplatePreview({
  template,
  shapes,
}: {
  template: TikzDiagramTemplate;
  shapes: TikzShape[];
}) {
  const markerId = `diagram-arrow-${template.id}`;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id={`diagram-grid-${template.id}`}
          width={GRID}
          height={GRID}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${GRID} 0 L 0 0 0 ${GRID}`}
            fill="none"
            stroke="#e7dfd3"
            strokeWidth="1"
          />
        </pattern>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#141413" />
        </marker>
      </defs>
      <rect width={VIEW_W} height={VIEW_H} fill="#fbf8f2" />
      <rect
        width={VIEW_W}
        height={VIEW_H}
        fill={`url(#diagram-grid-${template.id})`}
      />

      {shapes.map((shape) => {
        const stroke = colorValue(shape.stroke);
        const fill = fillValue(shape.fill);

        if (shape.kind === "rectangle") {
          const x = Math.min(shape.x1, shape.x2);
          const y = Math.min(shape.y1, shape.y2);
          return (
            <g key={shape.id}>
              <rect
                x={toPx(x)}
                y={toPy(y + Math.abs(shape.y2 - shape.y1))}
                width={toPx(Math.abs(shape.x2 - shape.x1))}
                height={toPx(Math.abs(shape.y2 - shape.y1))}
                rx={shape.rounded ? 5 : 0}
                fill={fill}
                stroke={stroke}
                strokeWidth={shape.lineWidth === "thick" ? 2 : 1.2}
              />
              {shape.label && (
                <text
                  x={toPx((shape.x1 + shape.x2) / 2)}
                  y={toPy((shape.y1 + shape.y2) / 2)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#141413"
                  fontSize="12"
                  fontFamily="var(--ui-sans), sans-serif"
                >
                  {previewText(shape.label)}
                </text>
              )}
            </g>
          );
        }

        if (shape.kind === "ellipse") {
          const cx = (shape.x1 + shape.x2) / 2;
          const cy = (shape.y1 + shape.y2) / 2;
          return (
            <g key={shape.id}>
              <ellipse
                cx={toPx(cx)}
                cy={toPy(cy)}
                rx={toPx(Math.abs(shape.x2 - shape.x1) / 2)}
                ry={toPx(Math.abs(shape.y2 - shape.y1) / 2)}
                fill={fill}
                stroke={stroke}
                strokeWidth={shape.lineWidth === "thick" ? 2 : 1.2}
              />
              {shape.label && (
                <text
                  x={toPx(cx)}
                  y={toPy(cy)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#141413"
                  fontSize="12"
                  fontFamily="var(--ui-sans), sans-serif"
                >
                  {previewText(shape.label)}
                </text>
              )}
            </g>
          );
        }

        if (shape.kind === "line") {
          const hasStart = shape.arrow === "<-" || shape.arrow === "<->";
          const hasEnd = shape.arrow === "->" || shape.arrow === "<->";
          return (
            <g key={shape.id}>
              <line
                x1={toPx(shape.x1)}
                y1={toPy(shape.y1)}
                x2={toPx(shape.x2)}
                y2={toPy(shape.y2)}
                stroke={stroke}
                strokeWidth={shape.lineWidth === "thick" ? 2 : 1.2}
                markerStart={hasStart ? `url(#${markerId})` : undefined}
                markerEnd={hasEnd ? `url(#${markerId})` : undefined}
              />
              {shape.label && (
                <text
                  x={toPx((shape.x1 + shape.x2) / 2)}
                  y={toPy((shape.y1 + shape.y2) / 2) - 5}
                  textAnchor="middle"
                  fill={stroke}
                  fontSize="10"
                  fontFamily="var(--ui-sans), sans-serif"
                >
                  {previewText(shape.label)}
                </text>
              )}
            </g>
          );
        }

        return shape.label ? (
          <text
            key={shape.id}
            x={toPx(shape.x1)}
            y={toPy(shape.y1)}
            textAnchor="middle"
            fill={stroke}
            fontSize={shape.fontSize ?? 12}
            fontFamily="var(--ui-sans), sans-serif"
          >
            {previewText(shape.label)}
          </text>
        ) : null;
      })}
    </svg>
  );
}

export interface TikzDiagramWizardProps {
  open: boolean;
  hasShapes: boolean;
  presetTemplateId?: string;
  onOpenChange: (open: boolean) => void;
  onInsert: (template: TikzDiagramTemplate, mode: "replace" | "append") => void;
}

export function TikzDiagramWizard({
  open,
  hasShapes,
  presetTemplateId,
  onOpenChange,
  onInsert,
}: TikzDiagramWizardProps) {
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>(
    presetTemplateId ?? TIKZ_DIAGRAM_TEMPLATES[0]!.id,
  );
  const [mode, setMode] = useState<"replace" | "append">("replace");

  const previews = useMemo(
    () =>
      new Map(
        TIKZ_DIAGRAM_TEMPLATES.map((template) => [
          template.id,
          template.build(),
        ]),
      ),
    [],
  );

  useEffect(() => {
    if (!open) return;
    setCategory("All");
    setQuery("");
    setMode("replace");
    if (presetTemplateId) setSelectedId(presetTemplateId);
  }, [open, presetTemplateId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return TIKZ_DIAGRAM_TEMPLATES.filter((template) => {
      if (category !== "All" && template.category !== category) return false;
      if (!needle) return true;
      return `${template.name} ${template.description} ${template.category}`
        .toLowerCase()
        .includes(needle);
    });
  }, [category, query]);

  const selected =
    TIKZ_DIAGRAM_TEMPLATES.find((template) => template.id === selectedId) ??
    filtered[0] ??
    TIKZ_DIAGRAM_TEMPLATES[0]!;

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[110] flex items-center justify-center bg-[#141413]/35 p-4 backdrop-blur-sm">
      <div className="flex h-[min(720px,88vh)] w-full max-w-[1080px] flex-col overflow-hidden rounded-xl border border-hairline bg-background shadow-[0_28px_100px_rgba(20,20,19,0.28)]">
        <div className="flex h-14 shrink-0 items-center gap-3 border-hairline border-b px-4 pr-12">
          <span className="flex size-8 items-center justify-center rounded-full border border-hairline bg-card text-primary">
            <SparklesIcon className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="font-medium font-serif text-[1.375rem] leading-none">
              Research diagram wizard
            </h2>
            <p className="mt-1 text-[0.75rem] text-muted-foreground uppercase tracking-[0.15em]">
              Choose a starting point · edit every shape afterwards
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto size-7"
            onClick={() => onOpenChange(false)}
            title="Close diagram wizard"
          >
            <XIcon className="size-4" />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-[190px] shrink-0 border-hairline border-r bg-card/35 p-2 md:block">
            <div className="space-y-0.5">
              {CATEGORIES.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[0.8125rem] transition-colors",
                      category === item.id
                        ? "bg-background font-medium text-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                    )}
                    onClick={() => setCategory(item.id)}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 border-hairline border-t pt-4">
              <div className="px-2 font-medium text-[0.6875rem] text-muted-foreground uppercase tracking-[0.16em]">
                Good for
              </div>
              <ul className="mt-2 space-y-1.5 px-2 text-[0.75rem] text-muted-foreground leading-relaxed">
                <li>Research design</li>
                <li>Model architecture</li>
                <li>Conceptual frameworks</li>
                <li>Process figures</li>
              </ul>
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto p-4">
            <div className="relative mb-4">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search diagram types…"
                className="h-9 bg-card/50 pl-9"
              />
            </div>

            {filtered.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed text-center">
                <PresentationIcon className="mb-2 size-7 text-muted-foreground/50" />
                <p className="font-medium text-sm">No matching diagrams</p>
                <p className="mt-1 text-muted-foreground text-xs">
                  Try another keyword or category.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((template) => {
                  const active = selected.id === template.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      className={cn(
                        "group overflow-hidden rounded-lg border text-left transition-all",
                        active
                          ? "border-primary bg-primary/[0.035] shadow-[0_6px_22px_rgba(204,120,92,0.12)]"
                          : "border-hairline bg-card/25 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card/50",
                      )}
                      onClick={() => setSelectedId(template.id)}
                    >
                      <div className="relative aspect-[16/10] overflow-hidden border-hairline border-b bg-[#fbf8f2]">
                        <TemplatePreview
                          template={template}
                          shapes={previews.get(template.id) ?? []}
                        />
                        {active && (
                          <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                            <CheckIcon className="size-3" />
                          </span>
                        )}
                      </div>
                      <div className="p-2.5">
                        <div className="font-medium text-[0.875rem] leading-snug">
                          {template.name}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="rounded-full border border-hairline px-1.5 py-0.5 font-medium text-[0.625rem] text-muted-foreground uppercase tracking-[0.12em]">
                            {template.category}
                          </span>
                          <span className="text-[0.6875rem] text-muted-foreground">
                            Editable shapes
                          </span>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-[0.75rem] text-muted-foreground leading-relaxed">
                          {template.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </main>

          <aside className="hidden w-[280px] shrink-0 border-hairline border-l bg-card/25 p-4 lg:block">
            <div className="flex items-center gap-2 text-[0.75rem] text-muted-foreground uppercase tracking-[0.15em]">
              <PresentationIcon className="size-3.5 text-primary" />
              Selected diagram
            </div>
            <h3 className="mt-2 font-serif text-[1.625rem] leading-tight tracking-[-0.02em]">
              {selected.name}
            </h3>
            <p className="mt-2 text-[0.8125rem] text-muted-foreground leading-relaxed">
              {selected.description}
            </p>

            <div className="mt-5 border-hairline border-t pt-4">
              <div className="font-medium text-[0.6875rem] text-muted-foreground uppercase tracking-[0.16em]">
                Insert as
              </div>
              <div className="mt-2 space-y-1.5">
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md border p-2 text-left transition-colors",
                    mode === "replace"
                      ? "border-primary/45 bg-background"
                      : "border-hairline hover:bg-background/60",
                  )}
                  onClick={() => setMode("replace")}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border",
                      mode === "replace"
                        ? "border-primary bg-primary text-white"
                        : "border-muted-foreground/40",
                    )}
                  >
                    {mode === "replace" && <CheckIcon className="size-2.5" />}
                  </span>
                  <span>
                    <span className="block font-medium text-[0.8125rem]">
                      Replace canvas
                    </span>
                    <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">
                      {hasShapes
                        ? "Clears the current shapes (undoable)."
                        : "Start this figure from the template."}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md border p-2 text-left transition-colors",
                    mode === "append"
                      ? "border-primary/45 bg-background"
                      : "border-hairline hover:bg-background/60",
                  )}
                  onClick={() => setMode("append")}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border",
                      mode === "append"
                        ? "border-primary bg-primary text-white"
                        : "border-muted-foreground/40",
                    )}
                  >
                    {mode === "append" && <CheckIcon className="size-2.5" />}
                  </span>
                  <span>
                    <span className="block font-medium text-[0.8125rem]">
                      Add to canvas
                    </span>
                    <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">
                      Keeps existing shapes; drag to rearrange.
                    </span>
                  </span>
                </button>
              </div>
            </div>

            <div className="mt-5 rounded-md border border-hairline bg-background/60 p-3 text-[0.75rem] text-muted-foreground leading-relaxed">
              Every box, label, arrow, and color is a normal studio shape.
              Adjust it with the Design panel, the LaTeX ribbon, or the resize
              handles.
            </div>
          </aside>
        </div>

        <div className="flex h-14 shrink-0 items-center justify-between border-hairline border-t bg-card/25 px-4">
          <span className="hidden text-[0.75rem] text-muted-foreground sm:block">
            {filtered.length} templates · {selected.category}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onInsert(selected, mode);
                onOpenChange(false);
              }}
            >
              <SparklesIcon className="size-3.5" />
              Insert {selected.name}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
