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
  MousePointer2Icon,
  MoveUpRightIcon,
  PanelTopIcon,
  Redo2Icon,
  RotateCcwIcon,
  Settings2Icon,
  SquareIcon,
  Trash2Icon,
  TypeIcon,
  Undo2Icon,
  UngroupIcon,
  XIcon,
} from "lucide-react";
import { TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { TABS, type RibbonItem, type RibbonTab } from "./latex-keyboard-data";

export interface LatexInsertion {
  before: string;
  after?: string;
}

interface RibbonCustomization {
  order: string[];
  hiddenTabs: string[];
  hiddenGroups: Record<string, string[]>;
}

const RIBBON_STORAGE_PREFIX = "openprism-latex-ribbon";

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
        <div className="font-medium text-[0.875rem] leading-tight">{title}</div>
        {description && (
          <div className="mt-1 text-[0.75rem] leading-relaxed opacity-75">
            {description}
          </div>
        )}
        {detail && (
          <div className="mt-1 font-mono text-[0.75rem] opacity-60">
            {detail}
          </div>
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
  const [activeGroupName, setActiveGroupName] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [customizeTabId, setCustomizeTabId] = useState(
    availableTabs[1]?.id ?? availableTabs[0]?.id ?? "home",
  );
  const [floating, setFloating] = useState(false);
  const [floatPos, setFloatPos] = useState({ x: 16, y: 112 });
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
  const activeGroup =
    activeGroups.find((group) => group.name === activeGroupName) ??
    activeGroups[0] ??
    null;
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

  useEffect(() => {
    setActiveGroupName(null);
  }, [activeTab?.id]);

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

  const renderItemButton = (item: RibbonItem, index: number) => {
    const Icon = item.icon;
    const actionDisabled = Boolean(item.action && !onAction);
    const itemDisabled = (disabled && !item.action) || actionDisabled;

    return (
      <RibbonTooltip
        key={`${item.label}-${item.title}-${index}`}
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
              ? "h-11 min-w-[68px] flex-col gap-0.5 px-1.5 text-[0.875rem]"
              : "h-7 min-w-[28px] px-1.5 text-[0.875rem]",
            item.className,
          )}
        >
          {Icon ? (
            <Icon className={item.large ? "size-4" : "size-3.5"} />
          ) : (
            <span>{item.label}</span>
          )}
          {item.large && (
            <span className="max-w-[86px] truncate text-[0.75rem] leading-none">
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
          <span className="font-medium text-[0.75rem] text-muted-foreground uppercase tracking-[0.16em]">
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

          <span className="ml-auto rounded-full border border-hairline px-2 py-0.5 font-mono text-[0.75rem] text-muted-foreground">
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
            description={tab.description}
          >
            <button
              type="button"
              className={cn(
                "h-full shrink-0 border-b-2 px-3 font-medium text-[0.875rem] tracking-wide transition-colors",
                tab.id === activeTab?.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              onClick={() => {
                setTabId(tab.id);
                setActiveGroupName(null);
              }}
            >
              {tab.label}
            </button>
          </RibbonTooltip>
        ))}

        {visibleTabs.length === 0 && (
          <span className="px-2 font-medium text-[0.75rem] text-muted-foreground">
            Ribbon hidden
          </span>
        )}

        {scope === "tikz" && (
          <span className="ml-auto hidden shrink-0 pr-1 text-[0.75rem] text-muted-foreground uppercase tracking-[0.14em] md:block">
            LaTeX label keyboard
          </span>
        )}

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
        <div className="border-hairline/70 border-b px-2">
          {activeGroups.length > 0 ? (
            <div className="flex min-h-7 items-center gap-1 overflow-x-auto py-1">
              {activeGroups.map((group) => (
                <button
                  key={group.name}
                  type="button"
                  aria-pressed={activeGroup?.name === group.name}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setActiveGroupName(group.name)}
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 font-medium text-[0.7rem] transition-colors",
                    activeGroup?.name === group.name
                      ? "border-hairline bg-background text-foreground shadow-sm"
                      : "border-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground",
                  )}
                >
                  {group.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex min-h-7 items-center gap-2 text-[0.75rem] text-muted-foreground">
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
        </div>
      )}

      {!collapsed && activeGroup && (
        <div className="flex min-h-[58px] items-start gap-0 overflow-x-auto px-2 py-1.5">
          <div
            className={cn(
              "gap-0.5 px-0.5",
              activeGroup.items.length > 5 &&
                activeGroup.items.every((item) => !item.large)
                ? "grid grid-flow-col grid-rows-2"
                : "flex items-center",
            )}
          >
            {activeGroup.items.map((item, itemIndex) =>
              renderItemButton(item, itemIndex),
            )}
          </div>

          {disabled && (
            <div className="flex min-w-[180px] items-center px-4 text-[0.75rem] text-muted-foreground">
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
              <div className="mt-0.5 text-[0.75rem] text-muted-foreground">
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
                      className="min-w-0 flex-1 truncate text-left text-[0.875rem]"
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
              <div className="font-medium text-[0.75rem] text-muted-foreground uppercase tracking-[0.15em]">
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
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-[0.75rem] hover:bg-muted/60"
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
                      <span className="font-mono text-[0.75rem] text-muted-foreground">
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
              className="flex items-center gap-1 text-[0.75rem] text-muted-foreground hover:text-foreground"
              onClick={resetCustomization}
            >
              <RotateCcwIcon className="size-3" />
              Reset
            </button>
            <button
              type="button"
              className="rounded bg-primary px-2.5 py-1 font-medium text-[0.75rem] text-primary-foreground hover:bg-[#b96a50]"
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
        <div
          className="absolute z-[70] max-h-[calc(100vh-8rem)] w-[min(1180px,calc(100%-2rem))] overflow-y-auto"
          style={{ left: floatPos.x, top: floatPos.y }}
        >
          {renderSurface(true)}
        </div>
      ) : (
        renderSurface(false)
      )}
    </TooltipPrimitive.Provider>
  );
}
