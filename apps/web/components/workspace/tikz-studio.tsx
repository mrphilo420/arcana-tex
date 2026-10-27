"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertCircleIcon,
  CheckIcon,
  ChevronsDownIcon,
  ChevronsUpIcon,
  CircleIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  MousePointer2Icon,
  MoveUpRightIcon,
  Redo2Icon,
  RefreshCwIcon,
  ShapesIcon,
  SquareIcon,
  Trash2Icon,
  TypeIcon,
  Undo2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { PrismMark } from "@/components/brand/prism-mark";
import { type LatexInsertion, TikzLatexRibbon } from "./tikz-latex-ribbon";
import { TikzDiagramWizard } from "./tikz-diagram-wizard";
import type { TikzDiagramTemplate } from "@/lib/tikz-diagrams";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TIKZ_ARROWS,
  TIKZ_COLORS,
  TIKZ_DASHES,
  TIKZ_FILLS,
  TIKZ_LIBRARIES,
  TIKZ_LINE_WIDTHS,
  type TikzFigureDocument,
  type TikzShape,
  type TikzShapeKind,
  type TikzTool,
  createTikzFigure,
  createTikzShape,
  ensureTikzLibraries,
  ensureTikzPackage,
  findTikzBlock,
  findTikzBlockById,
  generateTikzCode,
  generateTikzPreviewDocument,
} from "@/lib/tikz";
import { compileLatex } from "@/lib/latex-compiler";
import { cn } from "@/lib/utils";
import { useDocumentStore } from "@/stores/document-store";

const TikzPdfViewer = dynamic(
  () =>
    import("@/components/workspace/preview/pdf-viewer").then(
      (mod) => mod.PdfViewer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

const VIEW_W = 640;
const VIEW_H = 400;
const CM_W = 16;
const CM_H = 10;
const GRID = 40;
const SNAP = 0.25;
const HANDLE_SIZE = 8;

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
type TransformHandle = ResizeHandle | "p1" | "p2" | "rotate";

const HANDLE_CURSORS: Record<TransformHandle, string> = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
  p1: "crosshair",
  p2: "crosshair",
  rotate: "grab",
};

const TOOL_ICONS = {
  select: MousePointer2Icon,
  rectangle: SquareIcon,
  ellipse: CircleIcon,
  line: MoveUpRightIcon,
  arrow: MoveUpRightIcon,
  text: TypeIcon,
} satisfies Record<TikzTool, typeof MousePointer2Icon>;

const TOOLS: { id: TikzTool; label: string }[] = [
  { id: "select", label: "Select" },
  { id: "rectangle", label: "Rectangle" },
  { id: "ellipse", label: "Ellipse" },
  { id: "line", label: "Line" },
  { id: "arrow", label: "Arrow" },
  { id: "text", label: "Text" },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function snap(value: number): number {
  return Math.round(value / SNAP) * SNAP;
}

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

function strokeValue(name: TikzShape["lineWidth"]): number {
  return name === "thin" ? 1.2 : name === "thick" ? 2.2 : 3.2;
}

function dashValue(name: TikzShape["dash"]): string | undefined {
  return name === "dashed" ? "7 4" : name === "dotted" ? "1.5 3" : undefined;
}

function shapeCenter(shape: TikzShape) {
  if (shape.kind === "text") return { x: shape.x1, y: shape.y1 };
  return {
    x: (shape.x1 + shape.x2) / 2,
    y: (shape.y1 + shape.y2) / 2,
  };
}

function rotationTransform(shape: TikzShape): string | undefined {
  if (!shape.rotation) return undefined;
  const center = shapeCenter(shape);
  return `rotate(${-shape.rotation} ${toPx(center.x)} ${toPy(center.y)})`;
}

function shapeBounds(shape: TikzShape) {
  const x = Math.min(shape.x1, shape.x2);
  const y = Math.min(shape.y1, shape.y2);
  const width = Math.abs(shape.x2 - shape.x1);
  const height = Math.abs(shape.y2 - shape.y1);
  return { x, y, width, height };
}

function selectionBounds(shapes: TikzShape[]) {
  if (shapes.length === 0) return null;

  let left = Infinity;
  let right = -Infinity;
  let bottom = Infinity;
  let top = -Infinity;

  for (const shape of shapes) {
    const bounds =
      shape.kind === "text" ? textBounds(shape) : shapeBounds(shape);
    left = Math.min(left, bounds.x);
    right = Math.max(right, bounds.x + bounds.width);
    bottom = Math.min(bottom, bounds.y);
    top = Math.max(top, bounds.y + bounds.height);
  }

  if (!Number.isFinite(left)) return null;
  return { x: left, y: bottom, width: right - left, height: top - bottom };
}

function expandGroupIds(ids: string[], shapes: TikzShape[]): string[] {
  const selected = new Set(ids);
  const groups = new Set(
    shapes
      .filter((shape) => selected.has(shape.id) && shape.groupId)
      .map((shape) => shape.groupId!),
  );

  for (const shape of shapes) {
    if (shape.groupId && groups.has(shape.groupId)) selected.add(shape.id);
  }

  return [...selected];
}

function labelFontSize(scale: TikzShape["fontScale"]): number {
  return scale === "small" ? 11 : scale === "large" ? 16 : 13;
}

function shapeFontSize(shape: TikzShape): number {
  return shape.fontSize ?? labelFontSize(shape.fontScale);
}

function textBounds(shape: TikzShape) {
  const length = Math.max(shape.label?.length ?? 4, 4);
  const fontSize = shapeFontSize(shape);
  const width = Math.max(1.2, length * fontSize * 0.012);
  const height = Math.max(0.5, fontSize * 0.045);
  return {
    x: shape.x1 - width / 2,
    y: shape.y1 - height / 2,
    width,
    height,
  };
}

function NumberField({
  label,
  value,
  onChange,
  step = SNAP,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-1">
      <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
        {label}
      </span>
      <Input
        type="number"
        aria-label={label}
        value={Number.isFinite(value) ? Number(value.toFixed(2)) : 0}
        step={step}
        min={min}
        max={max}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        className="h-8 font-mono text-xs"
      />
    </div>
  );
}

export function TikzStudio() {
  const isOpen = useDocumentStore((s) => s.isTikzOpen);
  const setOpen = useDocumentStore((s) => s.setTikzOpen);
  const files = useDocumentStore((s) => s.files);
  const activeFileId = useDocumentStore((s) => s.activeFileId);
  const activeFile = files.find((file) => file.id === activeFileId);
  const isEditable =
    activeFile?.type === "tex" && /\.(tex|ltx)$/i.test(activeFile.name);

  const [figure, setFigure] = useState<TikzFigureDocument>(createTikzFigure);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tool, setTool] = useState<TikzTool>("select");
  const [draft, setDraft] = useState<TikzShape | null>(null);
  const [marquee, setMarquee] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    additive: boolean;
  } | null>(null);
  const [editing, setEditing] = useState<{ fileId: string } | null>(null);
  const [history, setHistory] = useState<TikzFigureDocument[]>([]);
  const [future, setFuture] = useState<TikzFigureDocument[]>([]);
  const [copied, setCopied] = useState(false);
  const [diagramWizardOpen, setDiagramWizardOpen] = useState(false);
  const [diagramPresetId, setDiagramPresetId] = useState<string | undefined>(
    undefined,
  );
  const [previewVisible, setPreviewVisible] = useState(true);
  const [previewPdf, setPreviewPdf] = useState<Uint8Array | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewUpdatedAt, setPreviewUpdatedAt] = useState<number | null>(null);

  const figureRef = useRef(figure);
  const svgRef = useRef<SVGSVGElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const previewRunRef = useRef(0);
  const previewSignatureRef = useRef<string | null>(null);
  const dragRef = useRef<{
    ids: string[];
    startX: number;
    startY: number;
    originals: TikzShape[];
    before: TikzFigureDocument;
  } | null>(null);
  const transformRef = useRef<{
    mode: "resize" | "rotate";
    handle: TransformHandle;
    id: string;
    before: TikzFigureDocument;
    original: TikzShape;
    center: { x: number; y: number };
    bounds: { x: number; y: number; width: number; height: number };
    startAngle: number;
    startRotation: number;
  } | null>(null);
  const dragMovedRef = useRef(false);
  const transformMovedRef = useRef(false);
  const clipboardRef = useRef<TikzShape[]>([]);

  figureRef.current = figure;

  const selected =
    figure.shapes.find((shape) => shape.id === selectedId) ?? null;
  const selectedShapes = useMemo(
    () => figure.shapes.filter((shape) => selectedIds.includes(shape.id)),
    [figure.shapes, selectedIds],
  );
  const selectedHasGroup = selectedShapes.some((shape) => shape.groupId);
  const code = useMemo(() => generateTikzCode(figure), [figure]);
  const codePreview = useMemo(
    () =>
      code
        .split("\n")
        .filter((line) => !line.startsWith("% openprism-tikz:"))
        .join("\n"),
    [code],
  );
  const previewDocument = useMemo(
    () => generateTikzPreviewDocument(figure),
    [figure],
  );
  const previewStatus = previewLoading
    ? "Compiling…"
    : previewError
      ? "Compile error"
      : previewPdf
        ? "Live"
        : "Waiting";

  const commit = useCallback(
    (updater: (document: TikzFigureDocument) => TikzFigureDocument) => {
      const previous = figureRef.current;
      const next = updater(previous);
      figureRef.current = next;
      setHistory((current) => [...current.slice(-49), previous]);
      setFuture([]);
      setFigure(next);
    },
    [],
  );

  const updateLive = useCallback(
    (updater: (document: TikzFigureDocument) => TikzFigureDocument) => {
      const next = updater(figureRef.current);
      figureRef.current = next;
      setFigure(next);
    },
    [],
  );

  const selectShapes = useCallback((ids: string[], primary?: string | null) => {
    const unique = [...new Set(ids)];
    setSelectedIds(unique);
    setSelectedId(
      primary && unique.includes(primary) ? primary : (unique[0] ?? null),
    );
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const state = useDocumentStore.getState();
    const file = state.files.find(
      (candidate) => candidate.id === state.activeFileId,
    );
    const anchor = state.selectionRange?.start ?? state.cursorPosition;
    const block =
      file && file.type === "tex"
        ? findTikzBlock(file.content ?? "", anchor)
        : null;
    const nextFigure = block?.document ?? createTikzFigure();

    figureRef.current = nextFigure;
    setFigure(nextFigure);
    setEditing(block ? { fileId: file!.id } : null);
    selectShapes([]);
    setTool("select");
    setDraft(null);
    setMarquee(null);
    setHistory([]);
    setFuture([]);
    dragRef.current = null;
    transformRef.current = null;
    transformMovedRef.current = false;
    setDiagramWizardOpen(false);
    setDiagramPresetId(undefined);

    previewRunRef.current += 1;
    previewSignatureRef.current = null;
    setPreviewPdf(null);
    setPreviewError(null);
    setPreviewLoading(false);
    setPreviewUpdatedAt(null);
    setPreviewVisible(true);
  }, [isOpen]);

  const runPreview = useCallback(
    async (force = false) => {
      if (!isOpen || figure.shapes.length === 0) {
        previewRunRef.current += 1;
        setPreviewPdf(null);
        setPreviewError(null);
        setPreviewLoading(false);
        setPreviewUpdatedAt(null);
        previewSignatureRef.current = null;
        return;
      }

      if (!force && previewSignatureRef.current === previewDocument) return;

      const runId = ++previewRunRef.current;
      setPreviewLoading(true);
      setPreviewError(null);

      try {
        const pdf = await compileLatex(
          [
            {
              path: "openprism-preview.tex",
              content: previewDocument,
              main: true,
            },
          ],
          "pdflatex",
        );

        if (runId !== previewRunRef.current) return;

        previewSignatureRef.current = previewDocument;
        setPreviewPdf(pdf);
        setPreviewUpdatedAt(Date.now());
      } catch (error) {
        if (runId !== previewRunRef.current) return;

        previewSignatureRef.current = previewDocument;
        setPreviewPdf(null);
        setPreviewError(
          error instanceof Error ? error.message : "Preview compilation failed",
        );
      } finally {
        if (runId === previewRunRef.current) {
          setPreviewLoading(false);
        }
      }
    },
    [figure.shapes.length, isOpen, previewDocument],
  );

  useEffect(() => {
    if (!isOpen || !previewVisible || figure.shapes.length === 0) return;

    const timer = setTimeout(() => {
      void runPreview();
    }, 850);

    return () => clearTimeout(timer);
  }, [
    figure.shapes.length,
    isOpen,
    previewDocument,
    previewVisible,
    runPreview,
  ]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const current = figureRef.current;

    setHistory(history.slice(0, -1));
    setFuture([current, ...future].slice(0, 50));
    figureRef.current = previous;
    setFigure(previous);
    selectShapes([]);
  }, [history, future]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const current = figureRef.current;

    setFuture(future.slice(1));
    setHistory([...history.slice(-49), current]);
    figureRef.current = next;
    setFigure(next);
    selectShapes([]);
  }, [history, future]);

  const deleteShape = useCallback(
    (id: string) => {
      commit((document) => ({
        ...document,
        shapes: document.shapes.filter((shape) => shape.id !== id),
      }));
      selectShapes([]);
    },
    [commit, selectShapes],
  );

  const deleteSelected = useCallback(() => {
    const ids =
      selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
    if (ids.length === 0) return;

    const idSet = new Set(ids);
    commit((document) => ({
      ...document,
      shapes: document.shapes.filter((shape) => !idSet.has(shape.id)),
    }));
    selectShapes([]);
  }, [commit, selectShapes, selectedId, selectedIds]);

  const cloneShapes = useCallback(
    (source: TikzShape[], offsetX = 0.5, offsetY = -0.5) => {
      const groupMap = new Map<string, string>();
      const copies = source.map((shape) => {
        let groupId = shape.groupId;
        if (groupId) {
          if (!groupMap.has(groupId))
            groupMap.set(groupId, crypto.randomUUID());
          groupId = groupMap.get(groupId);
        }

        return {
          ...shape,
          id: crypto.randomUUID(),
          groupId,
          x1: shape.x1 + offsetX,
          y1: shape.y1 + offsetY,
          x2: shape.x2 + offsetX,
          y2: shape.y2 + offsetY,
        };
      });

      return copies;
    },
    [],
  );

  const duplicateShape = useCallback(() => {
    const source =
      selectedShapes.length > 0 ? selectedShapes : selected ? [selected] : [];
    if (source.length === 0) return;

    const copies = cloneShapes(source);
    commit((document) => ({
      ...document,
      shapes: [...document.shapes, ...copies],
    }));
    selectShapes(
      copies.map((shape) => shape.id),
      copies[0]?.id,
    );
  }, [cloneShapes, commit, selectShapes, selected, selectedShapes]);

  const copySelected = useCallback(() => {
    const source =
      selectedShapes.length > 0 ? selectedShapes : selected ? [selected] : [];
    if (source.length === 0) return;
    clipboardRef.current = source.map((shape) => ({ ...shape }));
    toast.success(
      source.length === 1 ? "Shape copied" : `${source.length} shapes copied`,
    );
  }, [selected, selectedShapes]);

  const cutSelected = useCallback(() => {
    const source =
      selectedShapes.length > 0 ? selectedShapes : selected ? [selected] : [];
    if (source.length === 0) return;

    clipboardRef.current = source.map((shape) => ({ ...shape }));
    deleteSelected();
    toast.success(
      source.length === 1 ? "Shape cut" : `${source.length} shapes cut`,
    );
  }, [deleteSelected, selected, selectedShapes]);

  const pasteShape = useCallback(() => {
    const source = clipboardRef.current;
    if (source.length === 0) return;

    const copies = cloneShapes(source);
    commit((document) => ({
      ...document,
      shapes: [...document.shapes, ...copies],
    }));
    selectShapes(
      copies.map((shape) => shape.id),
      copies[0]?.id,
    );
  }, [cloneShapes, commit, selectShapes]);

  const nudgeSelected = useCallback(
    (dx: number, dy: number) => {
      const ids =
        selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
      const shapes = figureRef.current.shapes.filter((shape) =>
        ids.includes(shape.id),
      );
      const bounds = selectionBounds(shapes);
      if (!bounds) return;

      const clampedDx = clamp(dx, -bounds.x, CM_W - (bounds.x + bounds.width));
      const clampedDy = clamp(dy, -bounds.y, CM_H - (bounds.y + bounds.height));
      if (clampedDx === 0 && clampedDy === 0) return;

      commit((document) => ({
        ...document,
        shapes: document.shapes.map((shape) =>
          ids.includes(shape.id)
            ? {
                ...shape,
                x1: shape.x1 + clampedDx,
                y1: shape.y1 + clampedDy,
                x2: shape.x2 + clampedDx,
                y2: shape.y2 + clampedDy,
              }
            : shape,
        ),
      }));
    },
    [commit, selectedId, selectedIds],
  );

  const selectAll = useCallback(() => {
    selectShapes(figureRef.current.shapes.map((shape) => shape.id));
  }, [selectShapes]);

  const groupSelected = useCallback(() => {
    if (selectedShapes.length < 2) return;
    const groupId = crypto.randomUUID();
    const ids = new Set(selectedShapes.map((shape) => shape.id));
    commit((document) => ({
      ...document,
      shapes: document.shapes.map((shape) =>
        ids.has(shape.id) ? { ...shape, groupId } : shape,
      ),
    }));
    toast.success(`${selectedShapes.length} shapes grouped`);
  }, [commit, selectedShapes]);

  const ungroupSelected = useCallback(() => {
    const groupIds = new Set(
      selectedShapes
        .map((shape) => shape.groupId)
        .filter((groupId): groupId is string => Boolean(groupId)),
    );
    if (groupIds.size === 0) return;

    commit((document) => ({
      ...document,
      shapes: document.shapes.map((shape) =>
        shape.groupId && groupIds.has(shape.groupId)
          ? { ...shape, groupId: undefined }
          : shape,
      ),
    }));
    toast.success("Group removed");
  }, [commit, selectedShapes]);

  const alignSelected = useCallback(
    (mode: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") => {
      if (selectedShapes.length < 2) return;
      const total = selectionBounds(selectedShapes);
      if (!total) return;
      const moves = new Map<string, { dx: number; dy: number }>();

      for (const shape of selectedShapes) {
        const bounds =
          shape.kind === "text" ? textBounds(shape) : shapeBounds(shape);
        let dx = 0;
        let dy = 0;

        if (mode === "left") dx = total.x - bounds.x;
        if (mode === "hcenter") {
          dx = total.x + total.width / 2 - (bounds.x + bounds.width / 2);
        }
        if (mode === "right") {
          dx = total.x + total.width - (bounds.x + bounds.width);
        }
        if (mode === "bottom") dy = total.y - bounds.y;
        if (mode === "vcenter") {
          dy = total.y + total.height / 2 - (bounds.y + bounds.height / 2);
        }
        if (mode === "top") {
          dy = total.y + total.height - (bounds.y + bounds.height);
        }

        moves.set(shape.id, { dx, dy });
      }

      commit((document) => ({
        ...document,
        shapes: document.shapes.map((shape) => {
          const move = moves.get(shape.id);
          return move
            ? {
                ...shape,
                x1: shape.x1 + move.dx,
                y1: shape.y1 + move.dy,
                x2: shape.x2 + move.dx,
                y2: shape.y2 + move.dy,
              }
            : shape;
        }),
      }));
    },
    [commit, selectedShapes],
  );

  const distributeSelected = useCallback(
    (axis: "horizontal" | "vertical") => {
      if (selectedShapes.length < 3) return;
      const total = selectionBounds(selectedShapes);
      if (!total) return;

      const entries = selectedShapes
        .map((shape) => {
          const bounds =
            shape.kind === "text" ? textBounds(shape) : shapeBounds(shape);
          return { shape, bounds };
        })
        .sort((a, b) =>
          axis === "horizontal"
            ? a.bounds.x - b.bounds.x
            : a.bounds.y - b.bounds.y,
        );

      const totalSize = entries.reduce(
        (sum, entry) =>
          sum +
          (axis === "horizontal" ? entry.bounds.width : entry.bounds.height),
        0,
      );
      const gap =
        (axis === "horizontal" ? total.width : total.height) - totalSize > 0
          ? ((axis === "horizontal" ? total.width : total.height) - totalSize) /
            (entries.length - 1)
          : 0;

      const moves = new Map<string, number>();
      let cursor = axis === "horizontal" ? total.x : total.y;

      for (const entry of entries) {
        const target = axis === "horizontal" ? entry.bounds.x : entry.bounds.y;
        moves.set(entry.shape.id, cursor - target);
        cursor +=
          (axis === "horizontal" ? entry.bounds.width : entry.bounds.height) +
          gap;
      }

      commit((document) => ({
        ...document,
        shapes: document.shapes.map((shape) => {
          const delta = moves.get(shape.id);
          if (delta === undefined) return shape;
          return axis === "horizontal"
            ? {
                ...shape,
                x1: shape.x1 + delta,
                x2: shape.x2 + delta,
              }
            : {
                ...shape,
                y1: shape.y1 + delta,
                y2: shape.y2 + delta,
              };
        }),
      }));
    },
    [commit, selectedShapes],
  );

  const moveLayer = useCallback(
    (direction: "up" | "down" | "front" | "back") => {
      if (!selectedId) return;

      commit((document) => {
        const index = document.shapes.findIndex(
          (shape) => shape.id === selectedId,
        );
        if (index === -1) return document;

        const shapes = [...document.shapes];
        const [item] = shapes.splice(index, 1);
        if (!item) return document;

        let nextIndex = index;
        if (direction === "up") {
          nextIndex = Math.min(shapes.length, index + 1);
        } else if (direction === "down") {
          nextIndex = Math.max(0, index - 1);
        } else if (direction === "front") {
          nextIndex = shapes.length;
        } else {
          nextIndex = 0;
        }

        shapes.splice(nextIndex, 0, item);
        return { ...document, shapes };
      });
    },
    [commit, selectedId],
  );

  const patchSelected = useCallback(
    (patch: Partial<TikzShape>) => {
      if (!selectedId) return;
      commit((document) => ({
        ...document,
        shapes: document.shapes.map((shape) =>
          shape.id === selectedId ? { ...shape, ...patch } : shape,
        ),
      }));
    },
    [commit, selectedId],
  );

  const patchOptions = useCallback(
    (patch: Partial<TikzFigureDocument["options"]>) => {
      commit((document) => ({
        ...document,
        options: { ...document.options, ...patch },
      }));
    },
    [commit],
  );

  const openDiagramWizard = useCallback((templateId?: string) => {
    setDiagramPresetId(templateId);
    setDiagramWizardOpen(true);
  }, []);

  const insertDiagram = useCallback(
    (template: TikzDiagramTemplate, mode: "replace" | "append") => {
      const shapes = template.build();
      if (shapes.length === 0) return;

      commit((document) => ({
        ...document,
        shapes: mode === "replace" ? shapes : [...document.shapes, ...shapes],
      }));

      const primaryShape =
        shapes.find((shape) => shape.kind !== "text") ?? shapes[0];
      if (primaryShape) selectShapes([primaryShape.id]);
      setTool("select");
      setDiagramWizardOpen(false);
      toast.success(`${template.name} inserted`, {
        description: `${shapes.length} editable shape${shapes.length === 1 ? "" : "s"} · adjust with the Design panel`,
      });
    },
    [commit],
  );

  const insertIntoLabel = useCallback(
    ({ before, after }: LatexInsertion) => {
      if (!selected) return;

      const input = labelInputRef.current;
      if (!input) {
        patchSelected({
          label: `${selected.label ?? ""}${before}${after ?? ""}`,
        });
        return;
      }

      const value = selected.label ?? "";
      const start = input.selectionStart ?? value.length;
      const end = input.selectionEnd ?? start;
      const selectedText = value.slice(start, end);
      const nextValue =
        value.slice(0, start) +
        before +
        selectedText +
        (after ?? "") +
        value.slice(end);

      patchSelected({ label: nextValue });

      const caret = after
        ? selectedText.length > 0
          ? start + before.length + selectedText.length + after.length
          : start + before.length
        : start + before.length + selectedText.length;

      requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(caret, caret);
      });
    },
    [patchSelected, selected],
  );

  useEffect(() => {
    if (!isOpen) return;

    const shortcuts: Record<string, LatexInsertion> = {
      b: { before: "\\textbf{", after: "}" },
      i: { before: "\\textit{", after: "}" },
      u: { before: "\\underline{", after: "}" },
      e: { before: "\\emph{", after: "}" },
    };

    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;

      const input = labelInputRef.current;
      if (!input || document.activeElement !== input) return;

      const insertion = shortcuts[event.key.toLowerCase()];
      if (!insertion) return;

      event.preventDefault();
      insertIntoLabel(insertion);
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [insertIntoLabel, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as Element | null;
      const isSvgTarget =
        target instanceof SVGElement && svgRef.current?.contains(target);
      const isEditingField =
        !isSvgTarget &&
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.tagName === "BUTTON" ||
          target.tagName === "A" ||
          target.isContentEditable ||
          target.getAttribute("role") === "combobox" ||
          target.getAttribute("role") === "slider");

      if (isEditingField) return;

      const modifier = event.metaKey || event.ctrlKey;

      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }

      if (modifier && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelected();
        return;
      }

      if (modifier && event.key.toLowerCase() === "x") {
        event.preventDefault();
        cutSelected();
        return;
      }

      if (modifier && event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteShape();
        return;
      }

      if (modifier && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateShape();
        return;
      }

      if (modifier && event.key.toLowerCase() === "a") {
        event.preventDefault();
        selectAll();
        return;
      }

      if (modifier && event.key.toLowerCase() === "g") {
        event.preventDefault();
        if (event.shiftKey) ungroupSelected();
        else groupSelected();
        return;
      }

      if (!modifier && !event.altKey) {
        const toolShortcuts: Record<string, TikzTool> = {
          v: "select",
          r: "rectangle",
          o: "ellipse",
          l: "line",
          a: "arrow",
          t: "text",
        };
        const nextTool = toolShortcuts[event.key.toLowerCase()];
        if (nextTool) {
          setTool(nextTool);
          return;
        }
      }

      if (
        (event.key === "Backspace" || event.key === "Delete") &&
        selectedIds.length > 0
      ) {
        event.preventDefault();
        deleteSelected();
        return;
      }

      if (event.key === "Escape") {
        selectShapes([]);
        return;
      }

      if (selectedIds.length > 0 && event.key.startsWith("Arrow")) {
        event.preventDefault();
        const step = event.shiftKey ? 1 : SNAP;
        if (event.key === "ArrowLeft") nudgeSelected(-step, 0);
        else if (event.key === "ArrowRight") nudgeSelected(step, 0);
        else if (event.key === "ArrowUp") nudgeSelected(0, step);
        else if (event.key === "ArrowDown") nudgeSelected(0, -step);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    copySelected,
    cutSelected,
    deleteSelected,
    duplicateShape,
    groupSelected,
    isOpen,
    nudgeSelected,
    pasteShape,
    redo,
    selectAll,
    selectShapes,
    selectedIds,
    undo,
    ungroupSelected,
  ]);

  const pointFromEvent = useCallback(
    (event: { clientX: number; clientY: number }, shouldSnap = true) => {
      const svg = svgRef.current;
      if (!svg) return null;
      const matrix = svg.getScreenCTM();
      if (!matrix) return null;

      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
        matrix.inverse(),
      );
      const rawX = (point.x / VIEW_W) * CM_W;
      const rawY = CM_H - (point.y / VIEW_H) * CM_H;
      const x = shouldSnap ? snap(rawX) : rawX;
      const y = shouldSnap ? snap(rawY) : rawY;

      return {
        x: clamp(x, 0, CM_W),
        y: clamp(y, 0, CM_H),
      };
    },
    [],
  );

  const handleTransformPointerDown = (
    event: React.PointerEvent<SVGElement>,
    handle: TransformHandle,
  ) => {
    if (tool !== "select" || !selected) return;
    event.stopPropagation();
    event.preventDefault();
    svgRef.current?.focus();

    const point = pointFromEvent(event, handle !== "rotate");
    if (!point) return;

    const bounds =
      selected.kind === "text" ? textBounds(selected) : shapeBounds(selected);
    const center = shapeCenter(selected);
    const startAngle =
      (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;

    transformRef.current = {
      mode: handle === "rotate" ? "rotate" : "resize",
      handle,
      id: selected.id,
      before: figureRef.current,
      original: { ...selected },
      center,
      bounds,
      startAngle,
      startRotation: selected.rotation ?? 0,
    };
    transformMovedRef.current = false;
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const handleTransformPointerMove = (
    event: React.PointerEvent<SVGSVGElement>,
  ) => {
    const transform = transformRef.current;
    if (!transform) return;

    const original = transform.original;
    const point = pointFromEvent(event, transform.mode === "resize");
    if (!point) return;

    transformMovedRef.current = true;

    if (transform.mode === "rotate") {
      const angle =
        (Math.atan2(
          point.y - transform.center.y,
          point.x - transform.center.x,
        ) *
          180) /
        Math.PI;
      let rotation = transform.startRotation + (angle - transform.startAngle);
      rotation = ((((rotation + 180) % 360) + 360) % 360) - 180;
      rotation = event.shiftKey
        ? Math.round(rotation / 15) * 15
        : Math.round(rotation);

      updateLive((document) => ({
        ...document,
        shapes: document.shapes.map((shape) =>
          shape.id === transform.id ? { ...shape, rotation } : shape,
        ),
      }));
      return;
    }

    if (
      original.kind === "line" &&
      (transform.handle === "p1" || transform.handle === "p2")
    ) {
      let x = point.x;
      let y = point.y;

      if (event.shiftKey) {
        const fixed =
          transform.handle === "p1"
            ? { x: original.x2, y: original.y2 }
            : { x: original.x1, y: original.y1 };
        const dx = x - fixed.x;
        const dy = y - fixed.y;
        const length = Math.hypot(dx, dy);
        const angle =
          Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12);
        x = clamp(fixed.x + Math.cos(angle) * length, 0, CM_W);
        y = clamp(fixed.y + Math.sin(angle) * length, 0, CM_H);
      }

      updateLive((document) => ({
        ...document,
        shapes: document.shapes.map((shape) =>
          shape.id === transform.id
            ? transform.handle === "p1"
              ? { ...shape, x1: x, y1: y }
              : { ...shape, x2: x, y2: y }
            : shape,
        ),
      }));
      return;
    }

    if (original.kind === "text") {
      const useX =
        transform.handle.includes("e") || transform.handle.includes("w");
      const useY =
        transform.handle.includes("n") || transform.handle.includes("s");
      const scaleX =
        Math.abs(point.x - transform.center.x) /
        Math.max(transform.bounds.width / 2, 0.001);
      const scaleY =
        Math.abs(point.y - transform.center.y) /
        Math.max(transform.bounds.height / 2, 0.001);
      const scale = Math.max(
        0.2,
        useX && useY
          ? Math.max(scaleX, scaleY)
          : useX
            ? scaleX
            : useY
              ? scaleY
              : 1,
      );
      const baseSize = original.fontSize ?? labelFontSize(original.fontScale);
      const fontSize = Math.round(clamp(baseSize * scale, 6, 144));

      updateLive((document) => ({
        ...document,
        shapes: document.shapes.map((shape) =>
          shape.id === transform.id ? { ...shape, fontSize } : shape,
        ),
      }));
      return;
    }

    const handle = transform.handle as ResizeHandle;
    let left = transform.bounds.x;
    let right = left + transform.bounds.width;
    let bottom = transform.bounds.y;
    let top = bottom + transform.bounds.height;
    const rotation = original.rotation ?? 0;
    let localX = point.x;
    let localY = point.y;

    if (rotation) {
      const theta = (rotation * Math.PI) / 180;
      const dx = point.x - transform.center.x;
      const dy = point.y - transform.center.y;
      localX = transform.center.x + dx * Math.cos(theta) + dy * Math.sin(theta);
      localY = transform.center.y - dx * Math.sin(theta) + dy * Math.cos(theta);

      let width = transform.bounds.width;
      let height = transform.bounds.height;

      if (handle.includes("e") || handle.includes("w")) {
        width = Math.max(SNAP, Math.abs(localX - transform.center.x) * 2);
      }
      if (handle.includes("n") || handle.includes("s")) {
        height = Math.max(SNAP, Math.abs(localY - transform.center.y) * 2);
      }

      left = transform.center.x - width / 2;
      right = transform.center.x + width / 2;
      bottom = transform.center.y - height / 2;
      top = transform.center.y + height / 2;
    } else {
      if (handle.includes("w")) left = localX;
      if (handle.includes("e")) right = localX;
      if (handle.includes("s")) bottom = localY;
      if (handle.includes("n")) top = localY;

      if (right - left < SNAP) {
        if (handle.includes("w")) left = right - SNAP;
        else right = left + SNAP;
      }
      if (top - bottom < SNAP) {
        if (handle.includes("s")) bottom = top - SNAP;
        else top = bottom + SNAP;
      }

      if (
        event.shiftKey &&
        (handle === "nw" ||
          handle === "ne" ||
          handle === "se" ||
          handle === "sw") &&
        transform.bounds.height > 0
      ) {
        const aspect = transform.bounds.width / transform.bounds.height;
        let width = right - left;
        let height = top - bottom;

        if (width / height > aspect) height = width / aspect;
        else width = height * aspect;

        if (handle.includes("w")) left = right - width;
        else right = left + width;

        if (handle.includes("s")) bottom = top - height;
        else top = bottom + height;
      }

      left = clamp(left, 0, CM_W - SNAP);
      right = clamp(right, left + SNAP, CM_W);
      bottom = clamp(bottom, 0, CM_H - SNAP);
      top = clamp(top, bottom + SNAP, CM_H);
    }

    updateLive((document) => ({
      ...document,
      shapes: document.shapes.map((shape) =>
        shape.id === transform.id
          ? {
              ...shape,
              x1: left,
              y1: bottom,
              x2: right,
              y2: top,
              rotation,
            }
          : shape,
      ),
    }));
  };

  const handleCanvasPointerDown = (
    event: React.PointerEvent<SVGSVGElement>,
  ) => {
    if (event.button !== 0) return;
    svgRef.current?.focus();
    const point = pointFromEvent(event);
    if (!point) return;

    if (tool === "select") {
      if (!event.shiftKey) selectShapes([]);
      setMarquee({
        startX: point.x,
        startY: point.y,
        currentX: point.x,
        currentY: point.y,
        additive: event.shiftKey,
      });
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (tool === "text") {
      const shape = createTikzShape("text", point.x, point.y);
      commit((document) => ({
        ...document,
        shapes: [...document.shapes, shape],
      }));
      selectShapes([shape.id]);
      setTool("select");
      setTimeout(() => labelInputRef.current?.focus(), 50);
      return;
    }

    const kind: TikzShapeKind =
      tool === "rectangle"
        ? "rectangle"
        : tool === "ellipse"
          ? "ellipse"
          : "line";

    setDraft(
      createTikzShape(kind, point.x, point.y, point.x, point.y, {
        arrow: tool === "arrow" ? "->" : "none",
      }),
    );
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCanvasPointerMove = (
    event: React.PointerEvent<SVGSVGElement>,
  ) => {
    if (transformRef.current) {
      handleTransformPointerMove(event);
      return;
    }

    const point = pointFromEvent(event);
    if (!point) return;

    if (draft) {
      setDraft({ ...draft, x2: point.x, y2: point.y });
      return;
    }

    if (marquee) {
      setMarquee({
        ...marquee,
        currentX: point.x,
        currentY: point.y,
      });
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;

    dragMovedRef.current = true;
    const bounds = selectionBounds(drag.originals);
    if (!bounds) return;

    const dx = clamp(
      point.x - drag.startX,
      -bounds.x,
      CM_W - (bounds.x + bounds.width),
    );
    const dy = clamp(
      point.y - drag.startY,
      -bounds.y,
      CM_H - (bounds.y + bounds.height),
    );
    const originals = new Map(drag.originals.map((shape) => [shape.id, shape]));

    updateLive((document) => ({
      ...document,
      shapes: document.shapes.map((shape) => {
        const original = originals.get(shape.id);
        return original
          ? {
              ...shape,
              x1: original.x1 + dx,
              y1: original.y1 + dy,
              x2: original.x2 + dx,
              y2: original.y2 + dy,
            }
          : shape;
      }),
    }));
  };

  const finishPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    if (marquee) {
      const left = Math.min(marquee.startX, marquee.currentX);
      const right = Math.max(marquee.startX, marquee.currentX);
      const bottom = Math.min(marquee.startY, marquee.currentY);
      const top = Math.max(marquee.startY, marquee.currentY);

      if (right - left >= 0.08 && top - bottom >= 0.08) {
        const shapes = figureRef.current.shapes;
        const hits = shapes.filter((shape) => {
          const bounds =
            shape.kind === "text" ? textBounds(shape) : shapeBounds(shape);
          return (
            bounds.x < right &&
            bounds.x + bounds.width > left &&
            bounds.y < top &&
            bounds.y + bounds.height > bottom
          );
        });
        const grouped = expandGroupIds(
          hits.map((shape) => shape.id),
          shapes,
        );
        const nextIds = marquee.additive
          ? [...new Set([...selectedIds, ...grouped])]
          : grouped;
        selectShapes(nextIds, nextIds[0]);
      } else if (!marquee.additive) {
        selectShapes([]);
      }

      setMarquee(null);
    }

    if (draft) {
      const valid =
        draft.kind === "line"
          ? Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) >= 0.4
          : Math.abs(draft.x2 - draft.x1) >= 0.25 &&
            Math.abs(draft.y2 - draft.y1) >= 0.25;

      if (valid) {
        commit((document) => ({
          ...document,
          shapes: [...document.shapes, draft],
        }));
        selectShapes([draft.id]);
      }

      setDraft(null);
      setTool("select");
    }

    if (transformRef.current) {
      const before = transformRef.current.before;
      if (transformMovedRef.current) {
        setHistory((current) => [...current.slice(-49), before]);
        setFuture([]);
      }
      transformRef.current = null;
      transformMovedRef.current = false;
    }

    if (dragRef.current) {
      const before = dragRef.current.before;
      if (dragMovedRef.current) {
        setHistory((current) => [...current.slice(-49), before]);
        setFuture([]);
      }
      dragRef.current = null;
      dragMovedRef.current = false;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleShapePointerDown = (
    event: React.PointerEvent<SVGElement>,
    shape: TikzShape,
  ) => {
    if (tool !== "select") return;
    const point = pointFromEvent(event);
    if (!point) return;

    event.stopPropagation();
    svgRef.current?.focus();

    const shapes = figureRef.current.shapes;
    const groupIds = shape.groupId
      ? shapes
          .filter((candidate) => candidate.groupId === shape.groupId)
          .map((candidate) => candidate.id)
      : [shape.id];
    const current = new Set(selectedIds);
    let nextIds: string[];

    if (event.shiftKey) {
      const allSelected = groupIds.every((id) => current.has(id));
      if (allSelected) {
        for (const id of groupIds) current.delete(id);
        selectShapes([...current], [...current][0]);
        return;
      }
      for (const id of groupIds) current.add(id);
      nextIds = [...current];
    } else if (current.has(shape.id)) {
      nextIds = [...current];
    } else {
      nextIds = groupIds;
    }

    selectShapes(nextIds, shape.id);
    dragRef.current = {
      ids: nextIds,
      startX: point.x,
      startY: point.y,
      originals: shapes
        .filter((candidate) => nextIds.includes(candidate.id))
        .map((candidate) => ({ ...candidate })),
      before: figureRef.current,
    };
    dragMovedRef.current = false;
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const handleRibbonCommand = useCallback(
    (command: string) => {
      if (command.startsWith("tool:")) {
        setTool(command.slice(5) as TikzTool);
        return;
      }

      switch (command) {
        case "select-all":
          selectAll();
          break;
        case "group":
          groupSelected();
          break;
        case "ungroup":
          ungroupSelected();
          break;
        case "align-left":
          alignSelected("left");
          break;
        case "align-hcenter":
          alignSelected("hcenter");
          break;
        case "align-right":
          alignSelected("right");
          break;
        case "align-top":
          alignSelected("top");
          break;
        case "align-vcenter":
          alignSelected("vcenter");
          break;
        case "align-bottom":
          alignSelected("bottom");
          break;
        case "distribute-horizontal":
          distributeSelected("horizontal");
          break;
        case "distribute-vertical":
          distributeSelected("vertical");
          break;
        case "bring-forward":
          moveLayer("up");
          break;
        case "send-backward":
          moveLayer("down");
          break;
        case "duplicate":
          duplicateShape();
          break;
        case "delete":
          deleteSelected();
          break;
        case "copy":
          copySelected();
          break;
        case "paste":
          pasteShape();
          break;
        case "undo":
          undo();
          break;
        case "redo":
          redo();
          break;
        default:
          break;
      }
    },
    [
      alignSelected,
      copySelected,
      deleteSelected,
      distributeSelected,
      duplicateShape,
      groupSelected,
      moveLayer,
      pasteShape,
      redo,
      selectAll,
      undo,
      ungroupSelected,
    ],
  );

  const handleApply = () => {
    const state = useDocumentStore.getState();
    let file = state.files.find(
      (candidate) => candidate.id === state.activeFileId,
    );

    if (!file || file.type !== "tex" || !/\.(tex|ltx)$/i.test(file.name)) {
      toast.error("Open a .tex file to insert a TikZ figure");
      return;
    }

    if (figure.shapes.length === 0) {
      toast.error("Draw at least one shape first");
      return;
    }

    const main =
      state.files.find(
        (candidate) =>
          candidate.id === state.mainFileId && candidate.type === "tex",
      ) ?? file;
    const requiredLibraries = new Set(figure.options.libraries);
    if (
      figure.shapes.some((shape) =>
        ["Latex", "Stealth", "Triangle", "Circle", "Bar"].includes(shape.arrow),
      )
    ) {
      requiredLibraries.add("arrows.meta");
    }

    const ensured = ensureTikzPackage(main.content ?? "");
    const withLibraries = ensureTikzLibraries(ensured.content, [
      ...requiredLibraries,
    ]);

    if (ensured.changed || withLibraries.changed) {
      state.updateFileContent(main.id, withLibraries.content);
    }

    const latest = useDocumentStore.getState();
    file = latest.files.find(
      (candidate) => candidate.id === latest.activeFileId,
    );
    if (!file) return;

    const tikzCode = generateTikzCode(figure).trimEnd();

    if (editing) {
      const block = findTikzBlockById(file.content ?? "", figure.id);

      if (!block) {
        toast.error(
          "Could not find the original figure block. It may have been deleted.",
        );
        return;
      }

      latest.replaceSelection(block.start, block.end, tikzCode);
      latest.requestJumpToPosition(block.start);
    } else {
      const content = file.content ?? "";
      let position = latest.selectionRange?.start ?? latest.cursorPosition;
      const beginDocument = content.indexOf("\\begin{document}");
      const endDocument = content.lastIndexOf("\\end{document}");

      if (beginDocument !== -1 && position <= beginDocument) {
        position = endDocument !== -1 ? endDocument : beginDocument;
      }
      if (endDocument !== -1 && position > endDocument) {
        position = endDocument;
      }

      const before = content.slice(0, position);
      const after = content.slice(position);
      const leading = before.length > 0 && !before.endsWith("\n") ? "\n\n" : "";
      const trailing =
        after.length > 0 && !after.startsWith("\n") ? "\n\n" : "\n";

      latest.replaceSelection(
        position,
        position,
        `${leading}${tikzCode}${trailing}`,
      );
      latest.requestJumpToPosition(position + leading.length);
    }

    latest.requestCompile();
    setOpen(false);
    toast.success(editing ? "TikZ figure updated" : "TikZ figure inserted");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generateTikzCode(figure));
      setCopied(true);
      toast.success("TikZ code copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy the code");
    }
  };

  type Geometry =
    | { kind: "line"; x1: number; y1: number; x2: number; y2: number }
    | { kind: "text"; x: number; y: number }
    | { kind: "box"; x: number; y: number; width: number; height: number };

  const geometry: Geometry | null = selected
    ? selected.kind === "line"
      ? {
          kind: "line",
          x1: selected.x1,
          y1: selected.y1,
          x2: selected.x2,
          y2: selected.y2,
        }
      : selected.kind === "text"
        ? { kind: "text", x: selected.x1, y: selected.y1 }
        : (() => {
            const bounds = shapeBounds(selected);
            return {
              kind: "box" as const,
              x: bounds.x,
              y: bounds.y,
              width: bounds.width,
              height: bounds.height,
            };
          })()
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent
        className="flex h-[90vh] w-[96vw] max-w-[1280px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1280px]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => svgRef.current?.focus());
        }}
      >
        <DialogHeader className="flex h-14 shrink-0 flex-row items-center gap-3 border-hairline border-b px-4 pr-12">
          <span className="flex size-8 items-center justify-center rounded-full border border-hairline bg-card text-primary">
            <PrismMark className="size-4" />
          </span>
          <div>
            <DialogTitle className="font-medium font-serif text-[22px] leading-none">
              TikZ Studio
            </DialogTitle>
            <DialogDescription className="mt-1 text-[10px] uppercase tracking-[0.16em]">
              Draw · code &amp; preview update live
            </DialogDescription>
          </div>
          <span className="ml-auto hidden items-center gap-1.5 rounded-full border border-hairline bg-card px-2.5 py-1 font-mono text-[10px] text-muted-foreground sm:flex">
            <ShapesIcon className="size-3" />
            {figure.shapes.length} shape{figure.shapes.length === 1 ? "" : "s"}
          </span>
        </DialogHeader>

        <TikzLatexRibbon
          disabled={!selected}
          currentTool={tool}
          selectedCount={selectedIds.length}
          canGroup={selectedIds.length > 1}
          canUngroup={selectedHasGroup}
          onInsert={insertIntoLabel}
          onCommand={handleRibbonCommand}
          onAction={(action, templateId) => {
            if (action === "diagram-wizard") {
              openDiagramWizard(templateId);
            }
          }}
        />

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_380px] lg:overflow-hidden">
          <div className="relative flex min-h-[380px] items-center justify-center overflow-auto bg-[#f0ebe2] p-4 dark:bg-[#1f1e1b]">
            <div className="absolute top-3 left-3 z-10 flex items-center gap-0.5 rounded-lg border border-hairline bg-popover/95 p-1 shadow-sm backdrop-blur">
              {TOOLS.map((item) => {
                const Icon = TOOL_ICONS[item.id];
                const active = tool === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    aria-label={item.label}
                    onClick={() => setTool(item.id)}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-md transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </button>
                );
              })}
            </div>

            <div className="absolute top-3 right-3 z-10 flex items-center gap-0.5 rounded-lg border border-hairline bg-popover/95 p-1 shadow-sm backdrop-blur">
              <button
                type="button"
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                onClick={undo}
                disabled={history.length === 0}
                title="Undo"
                aria-label="Undo"
              >
                <Undo2Icon className="size-3.5" />
              </button>
              <button
                type="button"
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                onClick={redo}
                disabled={future.length === 0}
                title="Redo"
                aria-label="Redo"
              >
                <Redo2Icon className="size-3.5" />
              </button>
            </div>

            <div className="aspect-[16/10] w-full max-w-[900px] overflow-hidden rounded-lg border border-[#e0d8cb] bg-[#fbf8f2] shadow-[0_12px_36px_rgba(20,20,19,0.08)]">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                role="application"
                aria-label="TikZ drawing canvas"
                tabIndex={-1}
                className="h-full w-full touch-none outline-none"
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={finishPointer}
                onPointerCancel={finishPointer}
              >
                <defs>
                  <pattern
                    id="tikz-grid"
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
                </defs>

                <rect width={VIEW_W} height={VIEW_H} fill="#fbf8f2" />
                <rect width={VIEW_W} height={VIEW_H} fill="url(#tikz-grid)" />

                <text
                  x={8}
                  y={VIEW_H - 8}
                  fill="#b6afa2"
                  fontSize={9}
                  fontFamily="var(--font-jetbrains), monospace"
                >
                  0,0
                </text>
                <text
                  x={VIEW_W - 8}
                  y={VIEW_H - 8}
                  fill="#b6afa2"
                  fontSize={9}
                  textAnchor="end"
                  fontFamily="var(--font-jetbrains), monospace"
                >
                  {CM_W} cm
                </text>
                <text
                  x={8}
                  y={12}
                  fill="#b6afa2"
                  fontSize={9}
                  fontFamily="var(--font-jetbrains), monospace"
                >
                  {CM_H} cm
                </text>

                {figure.shapes.map((shape) => (
                  <TikzSvgShape
                    key={shape.id}
                    shape={shape}
                    onPointerDown={handleShapePointerDown}
                  />
                ))}

                {draft && (
                  <TikzSvgShape shape={draft} ghost onPointerDown={() => {}} />
                )}

                {tool === "select" &&
                  (selectedIds.length > 1 ? (
                    <MultiSelectionFrame shapes={selectedShapes} />
                  ) : selected ? (
                    <SelectionFrame
                      shape={selected}
                      onHandlePointerDown={handleTransformPointerDown}
                    />
                  ) : null)}

                {marquee && (
                  <rect
                    x={toPx(Math.min(marquee.startX, marquee.currentX))}
                    y={toPy(Math.max(marquee.startY, marquee.currentY))}
                    width={toPx(Math.abs(marquee.currentX - marquee.startX))}
                    height={toPx(Math.abs(marquee.currentY - marquee.startY))}
                    fill="rgba(204,120,92,0.08)"
                    stroke="#cc785c"
                    strokeWidth="1"
                    strokeDasharray="4 3"
                    pointerEvents="none"
                  />
                )}
              </svg>
            </div>

            <div className="pointer-events-none absolute right-4 bottom-3 left-4 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                {tool === "select"
                  ? "Drag to move · handles resize · round handle rotates · Shift locks ratio"
                  : `Draw a ${tool}. Snap ${SNAP} cm.`}
              </span>
              <span className="font-mono">
                {CM_W} × {CM_H} cm
              </span>
            </div>
          </div>

          <aside className="flex min-h-0 flex-col border-hairline border-t bg-background lg:border-t-0 lg:border-l">
            <div className="shrink-0 border-hairline border-b">
              <div className="flex h-9 items-center justify-between gap-2 px-3">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setPreviewVisible((visible) => !visible)}
                  title={
                    previewVisible ? "Hide live preview" : "Show live preview"
                  }
                  aria-label={
                    previewVisible ? "Hide live preview" : "Show live preview"
                  }
                >
                  {previewVisible ? (
                    <EyeOffIcon className="size-3.5" />
                  ) : (
                    <EyeIcon className="size-3.5" />
                  )}
                  <span className="font-medium text-[10px] uppercase tracking-[0.16em]">
                    Live preview
                  </span>
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      previewLoading
                        ? "animate-pulse bg-[#e8a55a]"
                        : previewError
                          ? "bg-destructive"
                          : previewPdf
                            ? "bg-[#5db8a6]"
                            : "bg-muted-foreground/35",
                    )}
                  />
                </button>

                <div className="flex min-w-0 items-center gap-1">
                  <span className="truncate font-mono text-[9px] text-muted-foreground">
                    {previewStatus}
                    {previewUpdatedAt && !previewLoading
                      ? ` · ${new Date(previewUpdatedAt).toLocaleTimeString(
                          [],
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}`
                      : ""}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0"
                    onClick={() => void runPreview(true)}
                    disabled={previewLoading || figure.shapes.length === 0}
                    title="Recompile preview"
                    aria-label="Recompile preview"
                  >
                    <RefreshCwIcon
                      className={cn("size-3", previewLoading && "animate-spin")}
                    />
                  </Button>
                </div>
              </div>

              {previewVisible && (
                <div className="relative flex h-[210px] flex-col overflow-hidden border-hairline border-t bg-[#f0ebe2] dark:bg-[#1f1e1b]">
                  {figure.shapes.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                      <EyeIcon className="size-5 text-muted-foreground/45" />
                      <p className="text-[11px] text-muted-foreground">
                        Draw a shape to see the compiled TikZ update here.
                      </p>
                    </div>
                  ) : previewError ? (
                    <div className="flex h-full flex-col gap-1.5 p-3">
                      <div className="flex items-center gap-1.5 text-destructive text-xs">
                        <AlertCircleIcon className="size-3.5" />
                        Preview failed
                      </div>
                      <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words font-mono text-[9px] text-muted-foreground leading-[1.5]">
                        {previewError}
                      </pre>
                    </div>
                  ) : previewPdf ? (
                    <TikzPdfViewer
                      data={previewPdf}
                      scale={previewScale}
                      fit="contain"
                      onScaleChange={setPreviewScale}
                      onError={(message) => setPreviewError(message)}
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Loader2Icon className="size-5 animate-spin" />
                      <span className="text-[10px] uppercase tracking-[0.14em]">
                        Rendering
                      </span>
                    </div>
                  )}

                  {previewLoading && previewPdf && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#f0ebe2]/45 backdrop-blur-[1px] dark:bg-[#1f1e1b]/45">
                      <span className="flex items-center gap-1.5 rounded-full border border-hairline bg-popover px-2.5 py-1 font-mono text-[9px] text-muted-foreground shadow-sm">
                        <Loader2Icon className="size-3 animate-spin" />
                        Updating
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
              <section>
                <h3 className="mb-2 font-medium text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
                  Figure
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label="Scale"
                    value={figure.options.scale}
                    step={0.1}
                    min={0.5}
                    max={2}
                    onChange={(scale) =>
                      patchOptions({ scale: clamp(scale, 0.5, 2) })
                    }
                  />
                  <label className="flex items-end pb-1">
                    <span className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={figure.options.wrapFigure}
                        onChange={(event) =>
                          patchOptions({ wrapFigure: event.target.checked })
                        }
                        className="accent-primary"
                      />
                      Figure env.
                    </span>
                  </label>
                </div>
                {figure.options.wrapFigure && (
                  <div className="mt-2 space-y-2">
                    <Input
                      value={figure.options.caption}
                      onChange={(event) =>
                        patchOptions({ caption: event.target.value })
                      }
                      placeholder="Caption"
                      className="h-8 text-xs"
                    />
                    <Input
                      value={figure.options.label}
                      onChange={(event) =>
                        patchOptions({ label: event.target.value })
                      }
                      placeholder="fig:label"
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-2 font-medium text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
                  TikZ libraries
                </h3>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  {TIKZ_LIBRARIES.map((library) => {
                    const checked = figure.options.libraries.includes(library);
                    return (
                      <label
                        key={library}
                        className="flex cursor-pointer items-center gap-1.5 font-mono text-[9px] text-muted-foreground"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            patchOptions({
                              libraries: event.target.checked
                                ? [...figure.options.libraries, library]
                                : figure.options.libraries.filter(
                                    (item) => item !== library,
                                  ),
                            })
                          }
                          className="accent-primary"
                        />
                        {library}
                      </label>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[9px] text-muted-foreground leading-relaxed">
                  Added with \usetikzlibrary to the preamble on insert/update.
                </p>
              </section>

              {selectedIds.length > 1 ? (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
                      Selection · {selectedIds.length} shapes
                    </h3>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={duplicateShape}
                        title="Duplicate selection"
                      >
                        <CopyIcon className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={deleteSelected}
                        title="Delete selection"
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" onClick={groupSelected}>
                      Group
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={ungroupSelected}
                      disabled={!selectedHasGroup}
                    >
                      Ungroup
                    </Button>
                  </div>

                  <div>
                    <div className="mb-1.5 font-medium text-[9px] text-muted-foreground uppercase tracking-[0.14em]">
                      Align
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        ["left", "Left"],
                        ["hcenter", "Center"],
                        ["right", "Right"],
                        ["top", "Top"],
                        ["vcenter", "Middle"],
                        ["bottom", "Bottom"],
                      ].map(([mode, label]) => (
                        <Button
                          key={mode}
                          variant="outline"
                          size="sm"
                          className="h-7 text-[9px]"
                          onClick={() =>
                            alignSelected(
                              mode as
                                | "left"
                                | "hcenter"
                                | "right"
                                | "top"
                                | "vcenter"
                                | "bottom",
                            )
                          }
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 font-medium text-[9px] text-muted-foreground uppercase tracking-[0.14em]">
                      Distribute
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[9px]"
                        onClick={() => distributeSelected("horizontal")}
                      >
                        Horizontal
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[9px]"
                        onClick={() => distributeSelected("vertical")}
                      >
                        Vertical
                      </Button>
                    </div>
                  </div>

                  <p className="rounded-md border border-dashed p-2 text-[9px] text-muted-foreground leading-relaxed">
                    Shift-click to add shapes, drag empty canvas to marquee
                    select, ⌘/Ctrl+G to group, ⌘/Ctrl+Shift+G to ungroup.
                  </p>
                </section>
              ) : selected ? (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
                      Selection · {selected.kind}
                    </h3>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => moveLayer("up")}
                        title="Bring forward"
                      >
                        <ChevronsUpIcon className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => moveLayer("down")}
                        title="Send backward"
                      >
                        <ChevronsDownIcon className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={duplicateShape}
                        title="Duplicate (⌘/Ctrl+D)"
                      >
                        <CopyIcon className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteShape(selected.id)}
                        title="Delete"
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {selected.kind === "line" && geometry?.kind === "line" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField
                        label="x1"
                        value={geometry.x1}
                        onChange={(value) => patchSelected({ x1: value })}
                      />
                      <NumberField
                        label="y1"
                        value={geometry.y1}
                        onChange={(value) => patchSelected({ y1: value })}
                      />
                      <NumberField
                        label="x2"
                        value={geometry.x2}
                        onChange={(value) => patchSelected({ x2: value })}
                      />
                      <NumberField
                        label="y2"
                        value={geometry.y2}
                        onChange={(value) => patchSelected({ y2: value })}
                      />
                    </div>
                  ) : selected.kind === "text" && geometry?.kind === "text" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField
                        label="x"
                        value={geometry.x}
                        onChange={(value) => patchSelected({ x1: value })}
                      />
                      <NumberField
                        label="y"
                        value={geometry.y}
                        onChange={(value) => patchSelected({ y1: value })}
                      />
                    </div>
                  ) : geometry?.kind === "box" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField
                        label="x"
                        value={geometry.x}
                        onChange={(value) =>
                          patchSelected({
                            x1: value,
                            x2: value + geometry.width,
                          })
                        }
                      />
                      <NumberField
                        label="y"
                        value={geometry.y}
                        onChange={(value) =>
                          patchSelected({
                            y1: value,
                            y2: value + geometry.height,
                          })
                        }
                      />
                      <NumberField
                        label="width"
                        value={geometry.width}
                        min={0.25}
                        onChange={(value) =>
                          patchSelected({
                            x2: geometry.x + Math.max(0.25, value),
                          })
                        }
                      />
                      <NumberField
                        label="height"
                        value={geometry.height}
                        min={0.25}
                        onChange={(value) =>
                          patchSelected({
                            y2: geometry.y + Math.max(0.25, value),
                          })
                        }
                      />
                    </div>
                  ) : null}

                  {selected.kind !== "line" && (
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField
                        label="rotation"
                        value={selected.rotation ?? 0}
                        step={1}
                        min={-180}
                        max={180}
                        onChange={(value) =>
                          patchSelected({
                            rotation: clamp(value, -180, 180),
                          })
                        }
                      />
                      {selected.kind === "text" ? (
                        <NumberField
                          label="font size"
                          value={
                            selected.fontSize ??
                            labelFontSize(selected.fontScale)
                          }
                          step={1}
                          min={6}
                          max={144}
                          onChange={(value) =>
                            patchSelected({
                              fontSize: clamp(value, 6, 144),
                            })
                          }
                        />
                      ) : (
                        <div />
                      )}
                    </div>
                  )}

                  {selected.kind === "text" ? (
                    <Input
                      ref={labelInputRef}
                      value={selected.label ?? ""}
                      onChange={(event) =>
                        patchSelected({ label: event.target.value })
                      }
                      placeholder="Text or $math$"
                      className="h-8 text-xs"
                    />
                  ) : (
                    <Input
                      ref={labelInputRef}
                      value={selected.label ?? ""}
                      onChange={(event) =>
                        patchSelected({ label: event.target.value })
                      }
                      placeholder="Label (LaTeX allowed)"
                      className="h-8 text-xs"
                    />
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
                        Stroke
                      </span>
                      <Select
                        value={selected.stroke}
                        onValueChange={(stroke) => patchSelected({ stroke })}
                      >
                        <SelectTrigger
                          size="sm"
                          className="h-8 w-full text-xs"
                          aria-label="Stroke color"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIKZ_COLORS.map((color) => (
                            <SelectItem key={color.name} value={color.name}>
                              {color.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
                        Fill
                      </span>
                      <Select
                        value={selected.fill}
                        onValueChange={(fill) => patchSelected({ fill })}
                      >
                        <SelectTrigger
                          size="sm"
                          className="h-8 w-full text-xs"
                          aria-label="Fill color"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIKZ_FILLS.map((fill) => (
                            <SelectItem key={fill.name} value={fill.name}>
                              {fill.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
                        Line
                      </span>
                      <Select
                        value={selected.lineWidth}
                        onValueChange={(lineWidth) =>
                          patchSelected({
                            lineWidth: lineWidth as TikzShape["lineWidth"],
                          })
                        }
                      >
                        <SelectTrigger
                          size="sm"
                          className="h-8 w-full text-xs"
                          aria-label="Line width"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIKZ_LINE_WIDTHS.map((width) => (
                            <SelectItem key={width} value={width}>
                              {width}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
                        Dash
                      </span>
                      <Select
                        value={selected.dash}
                        onValueChange={(dash) =>
                          patchSelected({ dash: dash as TikzShape["dash"] })
                        }
                      >
                        <SelectTrigger
                          size="sm"
                          className="h-8 w-full text-xs"
                          aria-label="Line dash"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIKZ_DASHES.map((dash) => (
                            <SelectItem key={dash} value={dash}>
                              {dash}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {selected.kind === "line" && (
                    <div className="space-y-1">
                      <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
                        Arrow
                      </span>
                      <Select
                        value={selected.arrow}
                        onValueChange={(arrow) =>
                          patchSelected({
                            arrow: arrow as TikzShape["arrow"],
                          })
                        }
                      >
                        <SelectTrigger
                          size="sm"
                          className="h-8 w-full text-xs"
                          aria-label="Arrow style"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIKZ_ARROWS.map((arrow) => (
                            <SelectItem key={arrow.name} value={arrow.name}>
                              {arrow.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {selected.kind === "rectangle" && (
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={selected.rounded}
                        onChange={(event) =>
                          patchSelected({ rounded: event.target.checked })
                        }
                        className="accent-primary"
                      />
                      Rounded corners
                    </label>
                  )}
                </section>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-center">
                  <MousePointer2Icon className="mx-auto mb-2 size-6 text-muted-foreground/50" />
                  <p className="font-medium text-sm">Draw a figure</p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    Pick a tool above, then drag on the canvas. Select any shape
                    to tune its style.
                  </p>
                </div>
              )}
            </div>

            <div className="border-hairline border-t bg-surface-dark text-on-dark">
              <div className="flex items-center justify-between px-3 py-2">
                <div>
                  <span className="font-medium text-[10px] text-on-dark-soft uppercase tracking-[0.16em]">
                    TikZ code
                  </span>
                  <span className="ml-2 text-[9px] text-on-dark-soft/60">
                    live
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-on-dark-soft hover:bg-white/10 hover:text-on-dark"
                  onClick={handleCopy}
                  title="Copy code"
                >
                  {copied ? (
                    <CheckIcon className="size-3.5 text-[#5db8a6]" />
                  ) : (
                    <CopyIcon className="size-3.5" />
                  )}
                </Button>
              </div>
              <pre className="max-h-28 overflow-auto whitespace-pre px-3 pb-3 font-mono text-[#d8d2c7] text-[10.5px] leading-[1.6]">
                {codePreview}
              </pre>
            </div>
          </aside>
        </div>

        <DialogFooter className="flex h-16 shrink-0 items-center justify-between border-hairline border-t px-4">
          <div className="min-w-0 text-[11px] text-muted-foreground">
            {editing ? (
              <span className="flex items-center gap-1.5">
                <CheckIcon className="size-3.5 text-[#5db8a6]" />
                Updating the selected figure block
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <ShapesIcon className="size-3.5" />
                Inserting into{" "}
                <span className="truncate font-mono">
                  {activeFile?.path ?? "the active file"}
                </span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              disabled={!isEditable || figure.shapes.length === 0}
            >
              {editing ? "Update figure" : "Insert figure"}
            </Button>
          </div>
        </DialogFooter>

        <TikzDiagramWizard
          open={diagramWizardOpen}
          hasShapes={figure.shapes.length > 0}
          presetTemplateId={diagramPresetId}
          onOpenChange={setDiagramWizardOpen}
          onInsert={insertDiagram}
        />
      </DialogContent>
    </Dialog>
  );
}

function SelectionFrame({
  shape,
  onHandlePointerDown,
}: {
  shape: TikzShape;
  onHandlePointerDown: (
    event: React.PointerEvent<SVGElement>,
    handle: TransformHandle,
  ) => void;
}) {
  const rotation = shape.rotation ?? 0;
  const center = shapeCenter(shape);
  const transform = rotation
    ? `rotate(${-rotation} ${toPx(center.x)} ${toPy(center.y)})`
    : undefined;

  const handlePointerDown = (
    event: React.PointerEvent<SVGElement>,
    handle: TransformHandle,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    onHandlePointerDown(event, handle);
  };

  if (shape.kind === "line") {
    const p1 = { x: toPx(shape.x1), y: toPy(shape.y1) };
    const p2 = { x: toPx(shape.x2), y: toPy(shape.y2) };

    return (
      <g transform={transform}>
        <line
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke="#cc785c"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          pointerEvents="none"
        />
        {(
          [
            { handle: "p1" as const, ...p1 },
            { handle: "p2" as const, ...p2 },
          ] as const
        ).map((point) => (
          <circle
            key={point.handle}
            data-handle={point.handle}
            cx={point.x}
            cy={point.y}
            r={5.5}
            fill="#fbf8f2"
            stroke="#cc785c"
            strokeWidth="1.5"
            pointerEvents="all"
            style={{ cursor: HANDLE_CURSORS[point.handle] }}
            onPointerDown={(event) => handlePointerDown(event, point.handle)}
          />
        ))}
      </g>
    );
  }

  const bounds = shape.kind === "text" ? textBounds(shape) : shapeBounds(shape);
  const padding = 0.12;
  const left = toPx(bounds.x - padding);
  const right = toPx(bounds.x + bounds.width + padding);
  const top = toPy(bounds.y + bounds.height + padding);
  const bottom = toPy(bounds.y - padding);
  const midX = (left + right) / 2;
  const midY = (top + bottom) / 2;
  const rotateY = top - 28;

  const handles: { handle: ResizeHandle; x: number; y: number }[] = [
    { handle: "nw", x: left, y: top },
    { handle: "n", x: midX, y: top },
    { handle: "ne", x: right, y: top },
    { handle: "e", x: right, y: midY },
    { handle: "se", x: right, y: bottom },
    { handle: "s", x: midX, y: bottom },
    { handle: "sw", x: left, y: bottom },
    { handle: "w", x: left, y: midY },
  ];

  return (
    <g transform={transform}>
      <rect
        x={left}
        y={top}
        width={right - left}
        height={bottom - top}
        fill="none"
        stroke="#cc785c"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        pointerEvents="none"
      />

      {handles.map((handle) => (
        <rect
          key={handle.handle}
          data-handle={handle.handle}
          x={handle.x - HANDLE_SIZE / 2}
          y={handle.y - HANDLE_SIZE / 2}
          width={HANDLE_SIZE}
          height={HANDLE_SIZE}
          rx={1.5}
          fill="#fbf8f2"
          stroke="#cc785c"
          strokeWidth="1.5"
          pointerEvents="all"
          style={{ cursor: HANDLE_CURSORS[handle.handle] }}
          onPointerDown={(event) => handlePointerDown(event, handle.handle)}
        />
      ))}

      <line
        x1={midX}
        y1={top}
        x2={midX}
        y2={rotateY}
        stroke="#cc785c"
        strokeWidth="1.25"
        pointerEvents="none"
      />
      <circle
        data-handle="rotate"
        cx={midX}
        cy={rotateY}
        r={5.5}
        fill="#fbf8f2"
        stroke="#cc785c"
        strokeWidth="1.5"
        pointerEvents="all"
        style={{ cursor: HANDLE_CURSORS.rotate }}
        onPointerDown={(event) => handlePointerDown(event, "rotate")}
      />
    </g>
  );
}

function MultiSelectionFrame({ shapes }: { shapes: TikzShape[] }) {
  const bounds = selectionBounds(shapes);
  if (!bounds) return null;

  const padding = 0.12;
  return (
    <g>
      <rect
        x={toPx(bounds.x - padding)}
        y={toPy(bounds.y + bounds.height + padding)}
        width={toPx(bounds.width + padding * 2)}
        height={toPx(bounds.height + padding * 2)}
        fill="rgba(204,120,92,0.04)"
        stroke="#cc785c"
        strokeWidth="1.5"
        strokeDasharray="6 3"
        pointerEvents="none"
      />
      <rect
        x={toPx(bounds.x + bounds.width / 2) - 16}
        y={toPy(bounds.y + bounds.height + padding) - 18}
        width={32}
        height={16}
        rx={8}
        fill="#cc785c"
        pointerEvents="none"
      />
      <text
        x={toPx(bounds.x + bounds.width / 2)}
        y={toPy(bounds.y + bounds.height + padding) - 7}
        textAnchor="middle"
        fill="#fff"
        fontSize="9"
        fontFamily="var(--font-inter), sans-serif"
        pointerEvents="none"
      >
        {shapes.length}
      </text>
    </g>
  );
}

function TikzSvgShape({
  shape,
  ghost = false,
  onPointerDown,
}: {
  shape: TikzShape;
  ghost?: boolean;
  onPointerDown: (
    event: React.PointerEvent<SVGElement>,
    shape: TikzShape,
  ) => void;
}) {
  const stroke = colorValue(shape.stroke);
  const fill = fillValue(shape.fill);
  const strokeWidth = strokeValue(shape.lineWidth);
  const dash = dashValue(shape.dash);
  const opacity = ghost ? 0.55 : 1;
  const label = shape.label?.trim();

  const handlePointerDown = (event: React.PointerEvent<SVGElement>) => {
    onPointerDown(event, shape);
  };

  if (shape.kind === "rectangle") {
    const bounds = shapeBounds(shape);
    return (
      <g opacity={opacity} transform={rotationTransform(shape)}>
        <rect
          x={toPx(bounds.x)}
          y={toPy(bounds.y + bounds.height)}
          width={toPx(bounds.width)}
          height={toPx(bounds.height)}
          rx={shape.rounded ? 6 : 0}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={dash}
          pointerEvents="all"
          onPointerDown={handlePointerDown}
          style={{ cursor: "move" }}
        />
        {label && (
          <text
            x={toPx(bounds.x + bounds.width / 2)}
            y={toPy(bounds.y + bounds.height / 2)}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#141413"
            fontSize={12}
            fontFamily="var(--font-inter), sans-serif"
            pointerEvents="none"
          >
            {label}
          </text>
        )}
      </g>
    );
  }

  if (shape.kind === "ellipse") {
    const bounds = shapeBounds(shape);
    return (
      <g opacity={opacity} transform={rotationTransform(shape)}>
        <ellipse
          cx={toPx(bounds.x + bounds.width / 2)}
          cy={toPy(bounds.y + bounds.height / 2)}
          rx={toPx(bounds.width / 2)}
          ry={toPx(bounds.height / 2)}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={dash}
          pointerEvents="all"
          onPointerDown={handlePointerDown}
          style={{ cursor: "move" }}
        />
        {label && (
          <text
            x={toPx(bounds.x + bounds.width / 2)}
            y={toPy(bounds.y + bounds.height / 2)}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#141413"
            fontSize={12}
            fontFamily="var(--font-inter), sans-serif"
            pointerEvents="none"
          >
            {label}
          </text>
        )}
      </g>
    );
  }

  if (shape.kind === "line") {
    const markerId = `tikz-arrow-${shape.id}`;
    const hasStart = shape.arrow === "<-" || shape.arrow === "<->";
    const hasEnd = shape.arrow === "->" || shape.arrow === "<->";

    return (
      <g opacity={opacity} transform={rotationTransform(shape)}>
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={stroke} />
          </marker>
        </defs>
        <line
          x1={toPx(shape.x1)}
          y1={toPy(shape.y1)}
          x2={toPx(shape.x2)}
          y2={toPy(shape.y2)}
          stroke="transparent"
          strokeWidth={14}
          pointerEvents="stroke"
          onPointerDown={handlePointerDown}
          style={{ cursor: "move" }}
        />
        <line
          x1={toPx(shape.x1)}
          y1={toPy(shape.y1)}
          x2={toPx(shape.x2)}
          y2={toPy(shape.y2)}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={dash}
          markerStart={hasStart ? `url(#${markerId})` : undefined}
          markerEnd={hasEnd ? `url(#${markerId})` : undefined}
          pointerEvents="none"
        />
        {label && (
          <text
            x={toPx((shape.x1 + shape.x2) / 2)}
            y={toPy((shape.y1 + shape.y2) / 2) - 6}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={stroke}
            fontSize={11}
            fontFamily="var(--font-inter), sans-serif"
            pointerEvents="none"
          >
            {label}
          </text>
        )}
      </g>
    );
  }

  return (
    <g opacity={opacity} transform={rotationTransform(shape)}>
      <text
        x={toPx(shape.x1)}
        y={toPy(shape.y1)}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={stroke}
        fontSize={shapeFontSize(shape)}
        fontFamily="var(--font-inter), sans-serif"
        pointerEvents="all"
        onPointerDown={handlePointerDown}
        style={{ cursor: "move" }}
      >
        {label || "Text"}
      </text>
    </g>
  );
}
