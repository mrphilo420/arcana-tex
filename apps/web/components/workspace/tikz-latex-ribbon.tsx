"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import {
  AlignHorizontalJustifyCenterIcon,
  AlignHorizontalJustifyEndIcon,
  AlignHorizontalJustifyStartIcon,
  AlignHorizontalSpaceAroundIcon,
  AlignVerticalJustifyCenterIcon,
  AlignVerticalJustifyEndIcon,
  AlignVerticalJustifyStartIcon,
  AlignVerticalSpaceAroundIcon,
  ArrowUpRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronsDownIcon,
  ChevronsUpIcon,
  CircleIcon,
  CopyIcon,
  CopyPlusIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  GripHorizontalIcon,
  GroupIcon,
  LayersIcon,
  MousePointer2Icon,
  MoveUpRightIcon,
  NetworkIcon,
  PanelTopIcon,
  Redo2Icon,
  RotateCcwIcon,
  Settings2Icon,
  SparklesIcon,
  SquareIcon,
  Trash2Icon,
  TypeIcon,
  Undo2Icon,
  UngroupIcon,
  WorkflowIcon,
  XIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface LatexInsertion {
  before: string;
  after?: string;
}

interface RibbonItem extends Partial<LatexInsertion> {
  label: string;
  title: string;
  description?: string;
  className?: string;
  icon?: LucideIcon;
  action?: "diagram-wizard";
  templateId?: string;
  large?: boolean;
}

interface RibbonGroup {
  name: string;
  items: RibbonItem[];
}

interface RibbonTab {
  id: string;
  label: string;
  groups: RibbonGroup[];
}

interface RibbonCustomization {
  order: string[];
  hiddenTabs: string[];
  hiddenGroups: Record<string, string[]>;
}

const RIBBON_STORAGE_PREFIX = "openprism-latex-ribbon";

const textGroup: RibbonGroup = {
  name: "Text",
  items: [
    {
      label: "B",
      title: "Bold (⌘/Ctrl+B)",
      before: "\\textbf{",
      after: "}",
      className: "font-bold",
    },
    {
      label: "I",
      title: "Italic (⌘/Ctrl+I)",
      before: "\\textit{",
      after: "}",
      className: "font-serif italic",
    },
    {
      label: "U",
      title: "Underline (⌘/Ctrl+U)",
      before: "\\underline{",
      after: "}",
      className: "underline",
    },
    {
      label: "em",
      title: "Emphasis (⌘/Ctrl+E)",
      before: "\\emph{",
      after: "}",
      className: "font-serif italic",
    },
    {
      label: "tt",
      title: "Typewriter",
      before: "\\texttt{",
      after: "}",
      className: "font-mono",
    },
    {
      label: "sf",
      title: "Sans serif",
      before: "\\textsf{",
      after: "}",
    },
    {
      label: "rm",
      title: "Roman",
      before: "\\textrm{",
      after: "}",
      className: "font-serif",
    },
  ],
};

const styleGroup: RibbonGroup = {
  name: "Style",
  items: [
    {
      label: "A",
      title: "Red text",
      before: "\\textcolor{red}{",
      after: "}",
      className: "text-[#c64545] font-bold",
    },
    {
      label: "A",
      title: "Blue text",
      before: "\\textcolor{blue}{",
      after: "}",
      className: "text-[#2563eb] font-bold",
    },
    {
      label: "small",
      title: "Small",
      before: "\\small ",
      className: "text-[10px]",
    },
    {
      label: "large",
      title: "Large",
      before: "\\large ",
      className: "text-[11px]",
    },
    {
      label: "¶",
      title: "Paragraph break",
      before: "\\par ",
    },
    {
      label: "↵",
      title: "New line",
      before: "\\newline ",
    },
  ],
};

const mathGroup: RibbonGroup = {
  name: "Math",
  items: [
    {
      label: "x",
      title: "Inline math $...$",
      before: "$",
      after: "$",
      className: "font-serif italic",
    },
    {
      label: "∑",
      title: "Display math \\[...\\]",
      before: "\\[",
      after: "\\]",
      className: "font-serif",
    },
    {
      label: "a/b",
      title: "Fraction",
      before: "\\frac{",
      after: "}{}",
      className: "font-serif text-[11px]",
    },
    {
      label: "√",
      title: "Square root",
      before: "\\sqrt{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "∑",
      title: "Sum",
      before: "\\sum",
      className: "font-serif",
    },
    {
      label: "∏",
      title: "Product",
      before: "\\prod",
      className: "font-serif",
    },
    {
      label: "∫",
      title: "Integral",
      before: "\\int",
      className: "font-serif",
    },
    {
      label: "lim",
      title: "Limit",
      before: "\\lim_{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "(n k)",
      title: "Binomial coefficient",
      before: "\\binom{",
      after: "}{}",
      className: "font-serif text-[10px]",
    },
    {
      label: "x̄",
      title: "Overline",
      before: "\\overline{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "x̂",
      title: "Hat",
      before: "\\hat{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "x⃗",
      title: "Vector",
      before: "\\vec{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "∂",
      title: "Partial derivative",
      before: "\\partial",
      className: "font-serif",
    },
    {
      label: "∞",
      title: "Infinity",
      before: "\\infty",
      className: "font-serif",
    },
  ],
};

const environmentGroup: RibbonGroup = {
  name: "Environments",
  items: [
    {
      label: "aligned",
      title: "Aligned equations",
      before: "\\begin{aligned}\n  ",
      after: "\n\\end{aligned}",
      className: "font-mono text-[9px]",
    },
    {
      label: "cases",
      title: "Cases",
      before: "\\begin{cases}\n  ",
      after: "\n\\end{cases}",
      className: "font-mono text-[9px]",
    },
    {
      label: "pmatrix",
      title: "Parenthesized matrix",
      before: "\\begin{pmatrix}\n  ",
      after: "\n\\end{pmatrix}",
      className: "font-mono text-[9px]",
    },
    {
      label: "bmatrix",
      title: "Bracketed matrix",
      before: "\\begin{bmatrix}\n  ",
      after: "\n\\end{bmatrix}",
      className: "font-mono text-[9px]",
    },
  ],
};

const greekLower = [
  ["α", "\\alpha"],
  ["β", "\\beta"],
  ["γ", "\\gamma"],
  ["δ", "\\delta"],
  ["ε", "\\varepsilon"],
  ["ζ", "\\zeta"],
  ["η", "\\eta"],
  ["θ", "\\theta"],
  ["ι", "\\iota"],
  ["κ", "\\kappa"],
  ["λ", "\\lambda"],
  ["μ", "\\mu"],
  ["ν", "\\nu"],
  ["ξ", "\\xi"],
  ["π", "\\pi"],
  ["ρ", "\\rho"],
  ["σ", "\\sigma"],
  ["τ", "\\tau"],
  ["υ", "\\upsilon"],
  ["φ", "\\varphi"],
  ["χ", "\\chi"],
  ["ψ", "\\psi"],
  ["ω", "\\omega"],
] as const;

const greekUpper = [
  ["Γ", "\\Gamma"],
  ["Δ", "\\Delta"],
  ["Θ", "\\Theta"],
  ["Λ", "\\Lambda"],
  ["Ξ", "\\Xi"],
  ["Π", "\\Pi"],
  ["Σ", "\\Sigma"],
  ["Υ", "\\Upsilon"],
  ["Φ", "\\Phi"],
  ["Ψ", "\\Psi"],
  ["Ω", "\\Omega"],
] as const;

const greekLowerGroup: RibbonGroup = {
  name: "Lowercase",
  items: greekLower.map(([label, command]) => ({
    label,
    title: command,
    before: command,
    className: "font-serif text-[14px]",
  })),
};

const greekUpperGroup: RibbonGroup = {
  name: "Uppercase",
  items: greekUpper.map(([label, command]) => ({
    label,
    title: command,
    before: command,
    className: "font-serif text-[14px]",
  })),
};

const operatorGroup: RibbonGroup = {
  name: "Operators",
  items: [
    ["×", "\\times"],
    ["·", "\\cdot"],
    ["±", "\\pm"],
    ["∓", "\\mp"],
    ["≤", "\\le"],
    ["≥", "\\ge"],
    ["≠", "\\ne"],
    ["≈", "\\approx"],
    ["≡", "\\equiv"],
    ["∼", "\\sim"],
    ["∝", "\\propto"],
    ["∞", "\\infty"],
    ["∂", "\\partial"],
    ["∇", "\\nabla"],
    ["∀", "\\forall"],
    ["∃", "\\exists"],
    ["∈", "\\in"],
    ["∉", "\\notin"],
    ["⊂", "\\subset"],
    ["⊃", "\\supset"],
    ["∪", "\\cup"],
    ["∩", "\\cap"],
    ["∅", "\\emptyset"],
    ["∖", "\\setminus"],
  ].map(([label, before]) => ({
    label,
    title: before,
    before,
    className: "font-serif text-[14px]",
  })),
};

const arrowGroup: RibbonGroup = {
  name: "Arrows",
  items: [
    ["→", "\\to"],
    ["←", "\\leftarrow"],
    ["↔", "\\leftrightarrow"],
    ["⇒", "\\Rightarrow"],
    ["⇐", "\\Leftarrow"],
    ["⇔", "\\Leftrightarrow"],
    ["↦", "\\mapsto"],
    ["↪", "\\hookrightarrow"],
    ["↠", "\\twoheadrightarrow"],
    ["⟶", "\\longrightarrow"],
    ["↑", "\\uparrow"],
    ["↓", "\\downarrow"],
  ].map(([label, before]) => ({
    label,
    title: before,
    before,
    className: "font-serif text-[14px]",
  })),
};

const dotsGroup: RibbonGroup = {
  name: "Dots",
  items: [
    {
      label: "…",
      title: "\\ldots",
      before: "\\ldots",
      className: "font-serif",
    },
    {
      label: "⋯",
      title: "\\cdots",
      before: "\\cdots",
      className: "font-serif",
    },
    {
      label: "⋮",
      title: "\\vdots",
      before: "\\vdots",
      className: "font-serif",
    },
    {
      label: "⋱",
      title: "\\ddots",
      before: "\\ddots",
      className: "font-serif",
    },
  ],
};

const tikzGroup: RibbonGroup = {
  name: "Math text",
  items: [
    {
      label: "text",
      title: "Text inside math",
      before: "\\text{",
      after: "}",
      className: "font-sans text-[10px]",
    },
    {
      label: "rm",
      title: "Roman math",
      before: "\\mathrm{",
      after: "}",
      className: "font-serif text-[11px]",
    },
    {
      label: "bf",
      title: "Bold math",
      before: "\\mathbf{",
      after: "}",
      className: "font-serif font-bold text-[11px]",
    },
    {
      label: "cal",
      title: "Calligraphic",
      before: "\\mathcal{",
      after: "}",
      className: "font-serif italic text-[11px]",
    },
    {
      label: "op",
      title: "Operator name",
      before: "\\operatorname{",
      after: "}",
      className: "font-sans text-[10px]",
    },
    {
      label: "disp",
      title: "Display style",
      before: "\\displaystyle ",
      className: "font-serif text-[10px]",
    },
    {
      label: "script",
      title: "Script style",
      before: "\\scriptstyle ",
      className: "font-serif text-[9px]",
    },
  ],
};

const decorationGroup: RibbonGroup = {
  name: "Decorations",
  items: [
    {
      label: "⏟",
      title: "Underbrace",
      before: "\\underbrace{",
      after: "}_{}",
      className: "font-serif text-[14px]",
    },
    {
      label: "⏞",
      title: "Overbrace",
      before: "\\overbrace{",
      after: "}^{}",
      className: "font-serif text-[14px]",
    },
    {
      label: "sub",
      title: "Substack",
      before: "\\substack{",
      after: "}",
      className: "font-serif text-[10px]",
    },
    {
      label: "red",
      title: "Red math",
      before: "\\color{red}{",
      after: "}",
      className: "text-[#c64545] font-serif text-[10px]",
    },
    {
      label: "blue",
      title: "Blue math",
      before: "\\color{blue}{",
      after: "}",
      className: "text-[#2563eb] font-serif text-[10px]",
    },
  ],
};

const diagramWizardGroup: RibbonGroup = {
  name: "Diagram wizard",
  items: [
    {
      label: "Diagram Wizard",
      title: "Research diagram wizard",
      description:
        "Choose a research, process, model, systems, concept, or math diagram and insert it as editable shapes.",
      icon: SparklesIcon,
      action: "diagram-wizard",
      large: true,
    },
  ],
};

const quickDiagramGroup: RibbonGroup = {
  name: "Quick start",
  items: [
    {
      label: "Pipeline",
      title: "Research pipeline",
      description: "Question → data → method → results → conclusion.",
      icon: WorkflowIcon,
      action: "diagram-wizard",
      templateId: "research-pipeline",
      large: true,
    },
    {
      label: "Flowchart",
      title: "Research flowchart",
      description: "A branching process with a decision point.",
      icon: NetworkIcon,
      action: "diagram-wizard",
      templateId: "research-flow",
      large: true,
    },
    {
      label: "Network",
      title: "Neural network",
      description: "Three connected layers with input and output labels.",
      icon: NetworkIcon,
      action: "diagram-wizard",
      templateId: "neural-network",
      large: true,
    },
    {
      label: "Layers",
      title: "Layered architecture",
      description: "Application, interface, services, and storage layers.",
      icon: LayersIcon,
      action: "diagram-wizard",
      templateId: "layered-architecture",
      large: true,
    },
  ],
};

const TABS: RibbonTab[] = [
  {
    id: "home",
    label: "Home",
    groups: [textGroup, styleGroup],
  },
  {
    id: "insert",
    label: "Insert",
    groups: [diagramWizardGroup, quickDiagramGroup],
  },
  {
    id: "math",
    label: "Math",
    groups: [mathGroup, environmentGroup],
  },
  {
    id: "greek",
    label: "Greek",
    groups: [greekLowerGroup, greekUpperGroup],
  },
  {
    id: "symbols",
    label: "Symbols",
    groups: [operatorGroup, arrowGroup, dotsGroup],
  },
  {
    id: "tikz",
    label: "TikZ",
    groups: [tikzGroup, decorationGroup],
  },
];

function normalizeCustomization(
  raw: Partial<RibbonCustomization> | null,
  tabs: RibbonTab[],
): RibbonCustomization {
  const validIds = new Set(tabs.map((tab) => tab.id));
  const order = Array.isArray(raw?.order)
    ? raw.order.filter((id) => validIds.has(id))
    : [];

  for (const tab of tabs) {
    if (!order.includes(tab.id)) order.push(tab.id);
  }

  const hiddenTabs = Array.isArray(raw?.hiddenTabs)
    ? raw.hiddenTabs.filter((id) => validIds.has(id))
    : [];
  const hiddenGroups =
    raw?.hiddenGroups && typeof raw.hiddenGroups === "object"
      ? raw.hiddenGroups
      : {};

  return { order, hiddenTabs, hiddenGroups };
}

function RibbonTooltip({
  title,
  description,
  detail,
  side = "bottom",
  children,
}: {
  title: string;
  description?: string;
  detail?: string;
  side?: "top" | "right" | "bottom" | "left";
  children: React.ReactElement;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipContent
        side={side}
        sideOffset={6}
        className="z-[100] max-w-64 px-2.5 py-2"
      >
        <div className="font-medium text-[11px] leading-tight">{title}</div>
        {description && (
          <div className="mt-1 text-[10px] leading-relaxed opacity-75">
            {description}
          </div>
        )}
        {detail && (
          <div className="mt-1 font-mono text-[9px] opacity-60">{detail}</div>
        )}
      </TooltipContent>
    </TooltipPrimitive.Root>
  );
}

function FloatingToolButton({
  title,
  shortcut,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  title: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactElement;
}) {
  return (
    <RibbonTooltip title={title} detail={shortcut}>
      <button
        type="button"
        aria-disabled={disabled}
        aria-label={title}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (!disabled) onClick();
        }}
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-[4px] border border-transparent text-muted-foreground transition-colors hover:border-hairline hover:bg-background hover:text-foreground aria-disabled:opacity-30",
          active && "border-hairline bg-background text-primary shadow-sm",
        )}
      >
        {children}
      </button>
    </RibbonTooltip>
  );
}

interface TikzLatexRibbonProps {
  disabled?: boolean;
  scope?: "tikz" | "workspace";
  disabledHint?: string;
  currentTool?: string;
  selectedCount?: number;
  canGroup?: boolean;
  canUngroup?: boolean;
  onInsert: (insertion: LatexInsertion) => void;
  onAction?: (action: string, templateId?: string) => void;
  onCommand?: (command: string) => void;
}

export function TikzLatexRibbon({
  disabled = false,
  scope = "tikz",
  disabledHint = "Select a shape to add LaTeX to its label.",
  currentTool = "select",
  selectedCount = 0,
  canGroup = false,
  canUngroup = false,
  onInsert,
  onAction,
  onCommand,
}: TikzLatexRibbonProps) {
  const availableTabs = useMemo(
    () => (scope === "tikz" ? TABS : TABS.filter((tab) => tab.id !== "insert")),
    [scope],
  );
  const defaultOrder = useMemo(
    () => availableTabs.map((tab) => tab.id),
    [availableTabs],
  );
  const storageKey = `${RIBBON_STORAGE_PREFIX}-${scope}`;

  const [customization, setCustomization] = useState<RibbonCustomization>(
    () => ({
      order: defaultOrder,
      hiddenTabs: [],
      hiddenGroups: {},
    }),
  );
  const [customizationLoaded, setCustomizationLoaded] = useState(false);
  const [tabId, setTabId] = useState(availableTabs[0]?.id ?? "home");
  const [collapsed, setCollapsed] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [customizeTabId, setCustomizeTabId] = useState(
    availableTabs[1]?.id ?? availableTabs[0]?.id ?? "home",
  );
  const [floating, setFloating] = useState(false);
  const [floatPos, setFloatPos] = useState({ x: 48, y: 112 });
  const floatDragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    setCustomizationLoaded(false);

    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw
        ? (JSON.parse(raw) as Partial<RibbonCustomization>)
        : null;
      setCustomization(normalizeCustomization(parsed, availableTabs));
    } catch {
      setCustomization({
        order: defaultOrder,
        hiddenTabs: [],
        hiddenGroups: {},
      });
    }

    setCustomizationLoaded(true);
  }, [availableTabs, defaultOrder, storageKey]);

  useEffect(() => {
    if (!customizationLoaded) return;
    window.localStorage.setItem(storageKey, JSON.stringify(customization));
  }, [customization, customizationLoaded, storageKey]);

  const tabMap = useMemo(
    () => new Map(availableTabs.map((tab) => [tab.id, tab])),
    [availableTabs],
  );
  const orderedTabs = customization.order
    .map((id) => tabMap.get(id))
    .filter((tab): tab is RibbonTab => Boolean(tab));
  const visibleTabs = orderedTabs.filter(
    (tab) => !customization.hiddenTabs.includes(tab.id),
  );
  const activeTab =
    visibleTabs.find((tab) => tab.id === tabId) ?? visibleTabs[0] ?? null;
  const activeGroups = activeTab
    ? activeTab.groups.filter(
        (group) =>
          !customization.hiddenGroups[activeTab.id]?.includes(group.name),
      )
    : [];
  const customizeTab =
    availableTabs.find((tab) => tab.id === customizeTabId) ??
    activeTab ??
    availableTabs[0] ??
    null;

  useEffect(() => {
    if (activeTab && activeTab.id !== tabId) {
      setTabId(activeTab.id);
    }
  }, [activeTab, tabId]);

  const moveTab = (id: string, direction: -1 | 1) => {
    setCustomization((current) => {
      const order = [...current.order];
      const index = order.indexOf(id);
      const next = index + direction;
      if (index === -1 || next < 0 || next >= order.length) return current;

      [order[index], order[next]] = [order[next]!, order[index]!];
      return { ...current, order };
    });
  };

  const toggleTab = (id: string) => {
    setCustomization((current) => {
      const hidden = new Set(current.hiddenTabs);
      if (hidden.has(id)) hidden.delete(id);
      else hidden.add(id);
      return { ...current, hiddenTabs: [...hidden] };
    });
  };

  const toggleGroup = (tabIdToEdit: string, groupName: string) => {
    setCustomization((current) => {
      const hidden = new Set(current.hiddenGroups[tabIdToEdit] ?? []);
      if (hidden.has(groupName)) hidden.delete(groupName);
      else hidden.add(groupName);
      return {
        ...current,
        hiddenGroups: {
          ...current.hiddenGroups,
          [tabIdToEdit]: [...hidden],
        },
      };
    });
  };

  const resetCustomization = () => {
    setCustomization({
      order: defaultOrder,
      hiddenTabs: [],
      hiddenGroups: {},
    });
  };

  const handleFloatPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
    floatDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: floatPos.x,
      originY: floatPos.y,
    };

    const handleMove = (moveEvent: PointerEvent) => {
      const drag = floatDragRef.current;
      if (!drag) return;
      setFloatPos({
        x: Math.max(8, drag.originX + moveEvent.clientX - drag.startX),
        y: Math.max(8, drag.originY + moveEvent.clientY - drag.startY),
      });
    };

    const handleUp = () => {
      floatDragRef.current = null;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const renderItemButton = (item: RibbonItem) => {
    const Icon = item.icon;
    const actionDisabled = Boolean(item.action && !onAction);
    const itemDisabled = (disabled && !item.action) || actionDisabled;

    return (
      <RibbonTooltip
        key={`${item.label}-${item.title}`}
        title={item.title}
        description={item.description}
        detail={item.before ? `${item.before}${item.after ?? ""}` : undefined}
      >
        <button
          type="button"
          aria-disabled={itemDisabled}
          aria-label={item.title}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (itemDisabled) return;
            if (item.action && onAction) {
              onAction(item.action, item.templateId);
              return;
            }
            if (item.before !== undefined) {
              onInsert({ before: item.before, after: item.after });
            }
          }}
          className={cn(
            "flex items-center justify-center rounded-[4px] border border-transparent text-foreground transition-colors hover:border-hairline hover:bg-background active:bg-primary/10 aria-disabled:opacity-40",
            item.large
              ? "h-11 min-w-[68px] flex-col gap-0.5 px-1.5 text-[11px]"
              : "h-7 min-w-[28px] px-1.5 text-[12px]",
            item.className,
          )}
        >
          {Icon ? (
            <Icon className={item.large ? "size-4" : "size-3.5"} />
          ) : (
            <span>{item.label}</span>
          )}
          {item.large && (
            <span className="max-w-[86px] truncate text-[9px] leading-none">
              {item.label}
            </span>
          )}
        </button>
      </RibbonTooltip>
    );
  };

  const renderSurface = (isFloating: boolean) => (
    <div
      className={cn(
        "relative bg-[#f3eee4] dark:bg-[#1f1e1b]",
        isFloating
          ? "overflow-visible rounded-lg border border-hairline shadow-[0_24px_80px_rgba(20,20,19,0.25)]"
          : "shrink-0 border-hairline border-b",
      )}
    >
      {isFloating && (
        <div className="flex h-8 items-center gap-1.5 rounded-t-lg border-hairline border-b bg-card/55 px-2">
          <button
            type="button"
            className="flex cursor-grab items-center text-muted-foreground active:cursor-grabbing"
            onPointerDown={handleFloatPointerDown}
            title="Drag ribbon"
            aria-label="Drag ribbon"
          >
            <GripHorizontalIcon className="size-3.5" />
          </button>
          <span className="font-medium text-[9px] text-muted-foreground uppercase tracking-[0.16em]">
            LaTeX ribbon
          </span>
          <div className="ml-auto flex items-center gap-1">
            <RibbonTooltip title="Dock ribbon">
              <button
                type="button"
                className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
                onClick={() => setFloating(false)}
                aria-label="Dock ribbon"
              >
                <PanelTopIcon className="size-3.5" />
              </button>
            </RibbonTooltip>
            <RibbonTooltip title="Close ribbon">
              <button
                type="button"
                className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
                onClick={() => {
                  setFloating(false);
                  setCollapsed(true);
                }}
                aria-label="Close ribbon"
              >
                <XIcon className="size-3.5" />
              </button>
            </RibbonTooltip>
          </div>
        </div>
      )}

      {isFloating && scope === "tikz" && onCommand && (
        <div className="flex h-10 items-center gap-0.5 overflow-x-auto border-hairline border-b bg-background/45 px-2">
          {[
            {
              tool: "select",
              label: "Select / marquee",
              key: "V",
              icon: MousePointer2Icon,
            },
            {
              tool: "rectangle",
              label: "Rectangle",
              key: "R",
              icon: SquareIcon,
            },
            { tool: "ellipse", label: "Ellipse", key: "O", icon: CircleIcon },
            { tool: "line", label: "Line", key: "L", icon: MoveUpRightIcon },
            { tool: "arrow", label: "Arrow", key: "A", icon: ArrowUpRightIcon },
            { tool: "text", label: "Text", key: "T", icon: TypeIcon },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <FloatingToolButton
                key={item.tool}
                title={item.label}
                shortcut={item.key}
                active={currentTool === item.tool}
                onClick={() => onCommand(`tool:${item.tool}`)}
              >
                <Icon className="size-3.5" />
              </FloatingToolButton>
            );
          })}

          <span className="mx-1 h-5 w-px bg-border" />

          <FloatingToolButton
            title="Select all"
            shortcut="⌘/Ctrl+A"
            onClick={() => onCommand("select-all")}
          >
            <MousePointer2Icon className="size-3.5" />
          </FloatingToolButton>
          <FloatingToolButton
            title="Group"
            shortcut="⌘/Ctrl+G"
            disabled={!canGroup}
            onClick={() => onCommand("group")}
          >
            <GroupIcon className="size-3.5" />
          </FloatingToolButton>
          <FloatingToolButton
            title="Ungroup"
            shortcut="⌘/Ctrl+Shift+G"
            disabled={!canUngroup}
            onClick={() => onCommand("ungroup")}
          >
            <UngroupIcon className="size-3.5" />
          </FloatingToolButton>

          <span className="mx-1 h-5 w-px bg-border" />

          <FloatingToolButton
            title="Align left"
            disabled={selectedCount < 2}
            onClick={() => onCommand("align-left")}
          >
            <AlignHorizontalJustifyStartIcon className="size-3.5" />
          </FloatingToolButton>
          <FloatingToolButton
            title="Align center"
            disabled={selectedCount < 2}
            onClick={() => onCommand("align-hcenter")}
          >
            <AlignHorizontalJustifyCenterIcon className="size-3.5" />
          </FloatingToolButton>
          <FloatingToolButton
            title="Align right"
            disabled={selectedCount < 2}
            onClick={() => onCommand("align-right")}
          >
            <AlignHorizontalJustifyEndIcon className="size-3.5" />
          </FloatingToolButton>
          <FloatingToolButton
            title="Align top"
            disabled={selectedCount < 2}
            onClick={() => onCommand("align-top")}
          >
            <AlignVerticalJustifyStartIcon className="size-3.5" />
          </FloatingToolButton>
          <FloatingToolButton
            title="Align middle"
            disabled={selectedCount < 2}
            onClick={() => onCommand("align-vcenter")}
          >
            <AlignVerticalJustifyCenterIcon className="size-3.5" />
          </FloatingToolButton>
          <FloatingToolButton
            title="Align bottom"
            disabled={selectedCount < 2}
            onClick={() => onCommand("align-bottom")}
          >
            <AlignVerticalJustifyEndIcon className="size-3.5" />
          </FloatingToolButton>
          <FloatingToolButton
            title="Distribute horizontally"
            disabled={selectedCount < 3}
            onClick={() => onCommand("distribute-horizontal")}
          >
            <AlignHorizontalSpaceAroundIcon className="size-3.5" />
          </FloatingToolButton>
          <FloatingToolButton
            title="Distribute vertically"
            disabled={selectedCount < 3}
            onClick={() => onCommand("distribute-vertical")}
          >
            <AlignVerticalSpaceAroundIcon className="size-3.5" />
          </FloatingToolButton>

          <span className="mx-1 h-5 w-px bg-border" />

          <FloatingToolButton
            title="Bring forward"
            onClick={() => onCommand("bring-forward")}
            disabled={selectedCount !== 1}
          >
            <ChevronsUpIcon className="size-3.5" />
          </FloatingToolButton>
          <FloatingToolButton
            title="Send backward"
            onClick={() => onCommand("send-backward")}
            disabled={selectedCount !== 1}
          >
            <ChevronsDownIcon className="size-3.5" />
          </FloatingToolButton>
          <FloatingToolButton
            title="Copy"
            shortcut="⌘/Ctrl+C"
            disabled={selectedCount === 0}
            onClick={() => onCommand("copy")}
          >
            <CopyIcon className="size-3.5" />
          </FloatingToolButton>
          <FloatingToolButton
            title="Duplicate"
            shortcut="⌘/Ctrl+D"
            disabled={selectedCount === 0}
            onClick={() => onCommand("duplicate")}
          >
            <CopyPlusIcon className="size-3.5" />
          </FloatingToolButton>
          <FloatingToolButton
            title="Delete"
            shortcut="Delete"
            disabled={selectedCount === 0}
            onClick={() => onCommand("delete")}
          >
            <Trash2Icon className="size-3.5" />
          </FloatingToolButton>
          <FloatingToolButton
            title="Undo"
            shortcut="⌘/Ctrl+Z"
            onClick={() => onCommand("undo")}
          >
            <Undo2Icon className="size-3.5" />
          </FloatingToolButton>
          <FloatingToolButton
            title="Redo"
            shortcut="⌘/Ctrl+Shift+Z"
            onClick={() => onCommand("redo")}
          >
            <Redo2Icon className="size-3.5" />
          </FloatingToolButton>

          <span className="ml-auto rounded-full border border-hairline px-2 py-0.5 font-mono text-[9px] text-muted-foreground">
            {selectedCount} selected
          </span>
        </div>
      )}

      <div
        className={cn(
          "flex h-8 items-center gap-0.5 overflow-x-auto border-hairline/70 border-b px-2",
          isFloating && "rounded-none",
        )}
      >
        {visibleTabs.map((tab) => (
          <RibbonTooltip
            key={tab.id}
            title={`${tab.label} tab`}
            description={
              tab.id === "insert"
                ? "Research diagram wizard and quick templates."
                : undefined
            }
          >
            <button
              type="button"
              className={cn(
                "h-full shrink-0 border-b-2 px-3 font-medium text-[11px] tracking-wide transition-colors",
                tab.id === activeTab?.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setTabId(tab.id)}
            >
              {tab.label}
            </button>
          </RibbonTooltip>
        ))}

        {visibleTabs.length === 0 && (
          <span className="px-2 font-medium text-[10px] text-muted-foreground">
            Ribbon hidden
          </span>
        )}

        <span className="ml-auto hidden pr-1 text-[9px] text-muted-foreground uppercase tracking-[0.14em] md:block">
          {scope === "workspace"
            ? "Workspace LaTeX keyboard · ⌘/Ctrl+Shift+K"
            : "LaTeX label keyboard"}
        </span>

        <RibbonTooltip title="Customize ribbon">
          <button
            type="button"
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground",
              customizeOpen && "bg-background text-foreground",
            )}
            onClick={() => {
              setCustomizeOpen((current) => !current);
              if (activeTab) setCustomizeTabId(activeTab.id);
            }}
            aria-label="Customize ribbon"
            aria-expanded={customizeOpen}
          >
            <Settings2Icon className="size-3.5" />
          </button>
        </RibbonTooltip>

        {scope === "tikz" && !isFloating && (
          <RibbonTooltip title="Pop out ribbon">
            <button
              type="button"
              className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
              onClick={() => setFloating(true)}
              aria-label="Pop out ribbon"
            >
              <ExternalLinkIcon className="size-3.5" />
            </button>
          </RibbonTooltip>
        )}

        <RibbonTooltip title={collapsed ? "Expand ribbon" : "Collapse ribbon"}>
          <button
            type="button"
            className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand ribbon" : "Collapse ribbon"}
          >
            {collapsed ? (
              <ChevronDownIcon className="size-3.5" />
            ) : (
              <ChevronUpIcon className="size-3.5" />
            )}
          </button>
        </RibbonTooltip>
      </div>

      {!collapsed && (
        <div className="flex h-[64px] items-stretch gap-0 overflow-x-auto px-1.5 py-1">
          {activeTab && activeGroups.length > 0 ? (
            activeGroups.map((group, index) => (
              <div
                key={group.name}
                className={cn(
                  "flex shrink-0 flex-col justify-between px-2",
                  index > 0 && "border-hairline/70 border-l",
                )}
              >
                <div className="flex items-center gap-0.5">
                  {group.items.map(renderItemButton)}
                </div>
                <div className="mt-0.5 text-center font-medium text-[8px] text-muted-foreground uppercase tracking-[0.14em]">
                  {group.name}
                </div>
              </div>
            ))
          ) : (
            <div className="flex min-w-[240px] items-center gap-2 px-3 text-[10px] text-muted-foreground">
              {visibleTabs.length === 0
                ? "All tabs are hidden."
                : "All groups on this tab are hidden."}
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={() => {
                  setCustomizeOpen(true);
                  if (activeTab) setCustomizeTabId(activeTab.id);
                }}
              >
                Customize
              </button>
            </div>
          )}

          {disabled && (
            <div className="flex min-w-[180px] items-center px-4 text-[10px] text-muted-foreground">
              {disabledHint}
            </div>
          )}
        </div>
      )}

      {customizeOpen && (
        <div
          className={cn(
            "absolute right-2 z-[60] w-[330px] rounded-lg border border-hairline bg-popover p-3 shadow-[0_18px_50px_rgba(20,20,19,0.16)]",
            isFloating ? "top-[72px]" : "top-9",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-medium text-xs">Customize ribbon</div>
              <div className="mt-0.5 text-[9px] text-muted-foreground">
                Changes apply immediately and are saved in this browser.
              </div>
            </div>
            <button
              type="button"
              className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setCustomizeOpen(false)}
              title="Close customization"
              aria-label="Close customization"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>

          <div className="mt-2 max-h-52 space-y-0.5 overflow-y-auto">
            {customization.order
              .map((id) => tabMap.get(id))
              .filter((tab): tab is RibbonTab => Boolean(tab))
              .map((tab, index, tabs) => {
                const hidden = customization.hiddenTabs.includes(tab.id);
                return (
                  <div
                    key={tab.id}
                    className={cn(
                      "flex items-center gap-1 rounded px-1 py-1",
                      customizeTab?.id === tab.id && "bg-muted/70",
                      hidden && "opacity-55",
                    )}
                  >
                    <button
                      type="button"
                      className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
                      onClick={() => toggleTab(tab.id)}
                      title={hidden ? "Show tab" : "Hide tab"}
                      aria-label={hidden ? "Show tab" : "Hide tab"}
                    >
                      {hidden ? (
                        <EyeOffIcon className="size-3.5" />
                      ) : (
                        <EyeIcon className="size-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-[11px]"
                      onClick={() => setCustomizeTabId(tab.id)}
                    >
                      {tab.label}
                    </button>
                    <button
                      type="button"
                      className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-background disabled:opacity-25"
                      onClick={() => moveTab(tab.id, -1)}
                      disabled={index === 0}
                      title="Move tab up"
                      aria-label="Move tab up"
                    >
                      <ChevronUpIcon className="size-3" />
                    </button>
                    <button
                      type="button"
                      className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-background disabled:opacity-25"
                      onClick={() => moveTab(tab.id, 1)}
                      disabled={index === tabs.length - 1}
                      title="Move tab down"
                      aria-label="Move tab down"
                    >
                      <ChevronDownIcon className="size-3" />
                    </button>
                  </div>
                );
              })}
          </div>

          {customizeTab && (
            <div className="mt-3 border-hairline border-t pt-2">
              <div className="font-medium text-[9px] text-muted-foreground uppercase tracking-[0.15em]">
                Groups · {customizeTab.label}
              </div>
              <div className="mt-1.5 space-y-1">
                {customizeTab.groups.map((group) => {
                  const hidden =
                    customization.hiddenGroups[customizeTab.id]?.includes(
                      group.name,
                    ) ?? false;
                  return (
                    <label
                      key={group.name}
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-[10px] hover:bg-muted/60"
                    >
                      <input
                        type="checkbox"
                        checked={!hidden}
                        onChange={() =>
                          toggleGroup(customizeTab.id, group.name)
                        }
                        className="accent-primary"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {group.name}
                      </span>
                      <span className="font-mono text-[8px] text-muted-foreground">
                        {group.items.length}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between border-hairline border-t pt-2">
            <button
              type="button"
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={resetCustomization}
            >
              <RotateCcwIcon className="size-3" />
              Reset
            </button>
            <button
              type="button"
              className="rounded bg-primary px-2.5 py-1 font-medium text-[10px] text-primary-foreground hover:bg-[#b96a50]"
              onClick={() => setCustomizeOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <TooltipPrimitive.Provider delayDuration={650} skipDelayDuration={250}>
      {floating ? (
        <>
          <div className="flex h-8 shrink-0 items-center justify-between border-hairline border-b bg-[#f3eee4] px-2 dark:bg-[#1f1e1b]">
            <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
              LaTeX ribbon is floating
            </span>
            <button
              type="button"
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-background hover:text-foreground"
              onClick={() => setFloating(false)}
            >
              <PanelTopIcon className="size-3" />
              Dock
            </button>
          </div>
          <div
            className="absolute z-[70] w-[840px] max-w-[calc(100vw-2rem)]"
            style={{ left: floatPos.x, top: floatPos.y }}
          >
            {renderSurface(true)}
          </div>
        </>
      ) : (
        renderSurface(false)
      )}
    </TooltipPrimitive.Provider>
  );
}
