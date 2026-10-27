"use client";

import { RefObject } from "react";
import type { EditorView } from "@codemirror/view";
import {
  BoldIcon,
  ItalicIcon,
  ListIcon,
  Heading1Icon,
  Heading2Icon,
  CheckIcon,
  CodeIcon,
  EyeIcon,
  FileCodeIcon,
  FunctionSquareIcon,
  FileTextIcon,
  ImageIcon,
  KeyboardIcon,
  MinusIcon,
  PaletteIcon,
  PencilIcon,
  PlusIcon,
  TypeIcon,
} from "lucide-react";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TERMINAL_THEMES } from "@/lib/editor-theme";
import { TEXT_SCALES } from "@/lib/text-scale";
import { cn } from "@/lib/utils";
import { useDocumentStore } from "@/stores/document-store";
import { useEditorPreferencesStore } from "@/stores/editor-preferences-store";

function TextScaleButton({ className }: { className?: string }) {
  const textScaleId = useEditorPreferencesStore((s) => s.textScaleId);
  const setTextScaleId = useEditorPreferencesStore((s) => s.setTextScaleId);
  const index = TEXT_SCALES.findIndex((scale) => scale.id === textScaleId);
  const current = TEXT_SCALES[index] ?? TEXT_SCALES[1];
  const next = TEXT_SCALES[(index + 1) % TEXT_SCALES.length] ?? TEXT_SCALES[1];

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "size-7 text-[#a09d96] hover:bg-white/10 hover:text-[#faf9f5]",
        className,
      )}
      title={`Text size: ${current.label}. Click for ${next.label}.`}
      aria-label={`Text size: ${current.label}`}
      onClick={() => setTextScaleId(next.id)}
    >
      <TypeIcon className="size-3.5" />
    </Button>
  );
}

function TerminalThemeMenu({ className }: { className?: string }) {
  const themeId = useEditorPreferencesStore((s) => s.terminalThemeId);
  const setThemeId = useEditorPreferencesStore((s) => s.setTerminalThemeId);
  const active =
    TERMINAL_THEMES.find((theme) => theme.id === themeId) ?? TERMINAL_THEMES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "size-7 text-[#a09d96] hover:bg-white/10 hover:text-[#faf9f5]",
            className,
          )}
          title={`Theme (editor + interface): ${active.label}`}
          aria-label="Theme (editor + interface)"
        >
          <PaletteIcon className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-80 w-64 overflow-y-auto"
      >
        <DropdownMenuLabel className="text-[0.6875rem] text-muted-foreground uppercase tracking-[0.14em]">
          Theme · editor + interface
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {TERMINAL_THEMES.map((theme) => (
          <DropdownMenuItem
            key={theme.id}
            onClick={() => setThemeId(theme.id)}
            className="gap-2"
          >
            <span
              className="size-3 shrink-0 rounded-full border"
              style={{
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.accent,
              }}
            />
            <span className="flex-1 text-xs">{theme.label}</span>
            {theme.id === themeId && (
              <CheckIcon className="size-3.5 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const ZOOM_OPTIONS = [
  { value: "0.5", label: "50%" },
  { value: "0.75", label: "75%" },
  { value: "1", label: "100%" },
  { value: "1.25", label: "125%" },
  { value: "1.5", label: "150%" },
  { value: "2", label: "200%" },
  { value: "3", label: "300%" },
  { value: "4", label: "400%" },
];

interface EditorToolbarProps {
  editorView: RefObject<EditorView | null>;
  fileType?: "tex" | "image" | "binary";
  fileKind?: "latex" | "lean" | "markdown";
  imageScale?: number;
  markdownPreview?: boolean;
  markdownPreviewAvailable?: boolean;
  onToggleMarkdownPreview?: () => void;
  onImageScaleChange?: (scale: number) => void;
}

export function EditorToolbar({
  editorView,
  fileType = "tex",
  fileKind = "latex",
  imageScale = 1,
  markdownPreview = false,
  markdownPreviewAvailable = true,
  onToggleMarkdownPreview,
  onImageScaleChange,
}: EditorToolbarProps) {
  const fileName = useDocumentStore((s) => {
    const activeFile = s.files.find((f) => f.id === s.activeFileId);
    return activeFile?.path ?? "document.tex";
  });
  const isLatexKeyboardOpen = useDocumentStore((s) => s.isLatexKeyboardOpen);
  const setLatexKeyboardOpen = useDocumentStore((s) => s.setLatexKeyboardOpen);

  const insertText = (before: string, after: string = "") => {
    const view = editorView.current;
    if (!view) return;

    const { from, to } = view.state.selection.main;
    const selectedText = view.state.sliceDoc(from, to);

    view.dispatch({
      changes: {
        from,
        to,
        insert: before + selectedText + after,
      },
      selection: {
        anchor: from + before.length,
        head: from + before.length + selectedText.length,
      },
    });
    view.focus();
  };

  const wrapSelection = (wrapper: string) => {
    insertText(wrapper, wrapper);
  };

  const zoomIn = () => onImageScaleChange?.(Math.min(4, imageScale + 0.25));
  const zoomOut = () => onImageScaleChange?.(Math.max(0.25, imageScale - 0.25));

  if (fileType === "image" || fileType === "binary") {
    return (
      <div className="flex h-9 items-center justify-between border-white/10 border-b bg-[#252320] px-2 text-[#a09d96] [&_button:hover]:bg-white/10 [&_button:hover]:text-[#faf9f5]">
        <div className="flex items-center gap-1">
          {fileType === "image" ? (
            <ImageIcon className="size-4 text-muted-foreground" />
          ) : (
            <FileTextIcon className="size-4 text-muted-foreground" />
          )}
          <span className="font-medium font-mono text-[#faf9f5] text-[0.8125rem]">
            {fileName}
          </span>
        </div>
        {fileType === "image" && (
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={zoomOut}
              disabled={imageScale <= 0.25}
            >
              <MinusIcon className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={zoomIn}
              disabled={imageScale >= 4}
            >
              <PlusIcon className="size-3.5" />
            </Button>
            <Select
              value={imageScale.toString()}
              onValueChange={(v) => onImageScaleChange?.(Number(v))}
            >
              <SelectTrigger size="sm" className="h-6! w-auto text-xs">
                <SelectValue>{Math.round(imageScale * 100)}%</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ZOOM_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {fileType === "binary" && (
          <span className="text-muted-foreground text-xs">binary</span>
        )}
      </div>
    );
  }

  if (fileKind === "markdown") {
    return (
      <div className="flex h-9 items-center gap-2 border-white/10 border-b bg-[#252320] px-2 text-[#a09d96]">
        <FileTextIcon className="size-4 text-[#e8a55a]" />
        <span className="font-medium font-mono text-[#faf9f5] text-[0.8125rem]">
          {fileName}
        </span>
        <span className="rounded border border-[#e8a55a]/30 bg-[#e8a55a]/10 px-1.5 py-0.5 font-mono text-[#e8a55a] text-[0.6875rem] uppercase tracking-[0.12em]">
          Markdown
        </span>
        <div className="ml-auto flex items-center gap-1">
          {markdownPreviewAvailable && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-[#a09d96] text-[0.75rem] hover:bg-white/10 hover:text-[#faf9f5]"
              onClick={onToggleMarkdownPreview}
            >
              {markdownPreview ? (
                <PencilIcon className="size-3.5" />
              ) : (
                <EyeIcon className="size-3.5" />
              )}
              {markdownPreview ? "Edit" : "Preview"}
            </Button>
          )}
          <TextScaleButton />
          <TerminalThemeMenu />
        </div>
      </div>
    );
  }

  if (fileKind === "lean") {
    return (
      <div className="flex h-9 items-center gap-2 border-white/10 border-b bg-[#252320] px-2 text-[#a09d96]">
        <FileCodeIcon className="size-4 text-[#5db8a6]" />
        <span className="font-medium font-mono text-[#faf9f5] text-[0.8125rem]">
          {fileName}
        </span>
        <span className="rounded border border-[#5db8a6]/30 bg-[#5db8a6]/10 px-1.5 py-0.5 font-mono text-[#5db8a6] text-[0.6875rem] uppercase tracking-[0.12em]">
          Lean 4
        </span>
        <div className="ml-auto flex items-center gap-1">
          <TextScaleButton />
          <TerminalThemeMenu />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-9 items-center gap-1 border-white/10 border-b bg-[#252320] px-2 text-[#a09d96] [&_button:hover]:bg-white/10 [&_button:hover]:text-[#faf9f5]">
      <FileTextIcon className="size-4 text-muted-foreground" />
      <span className="mr-2 font-medium font-mono text-[#faf9f5] text-[0.8125rem]">
        {fileName}
      </span>
      <div className="mx-2 h-4 w-px bg-white/10" />
      <TooltipIconButton
        tooltip="Bold (\\textbf)"
        onClick={() => insertText("\\textbf{", "}")}
      >
        <BoldIcon className="size-4" />
      </TooltipIconButton>
      <TooltipIconButton
        tooltip="Italic (\\textit)"
        onClick={() => insertText("\\textit{", "}")}
      >
        <ItalicIcon className="size-4" />
      </TooltipIconButton>
      <TooltipIconButton
        tooltip="Code (\\texttt)"
        onClick={() => insertText("\\texttt{", "}")}
      >
        <CodeIcon className="size-4" />
      </TooltipIconButton>
      <div className="mx-2 h-4 w-px bg-white/10" />
      <TooltipIconButton
        tooltip="Section"
        onClick={() => insertText("\\section{", "}")}
      >
        <Heading1Icon className="size-4" />
      </TooltipIconButton>
      <TooltipIconButton
        tooltip="Subsection"
        onClick={() => insertText("\\subsection{", "}")}
      >
        <Heading2Icon className="size-4" />
      </TooltipIconButton>
      <TooltipIconButton
        tooltip="List item"
        onClick={() => insertText("\\item ")}
      >
        <ListIcon className="size-4" />
      </TooltipIconButton>
      <div className="mx-2 h-4 w-px bg-white/10" />
      <TooltipIconButton
        tooltip="Inline math ($...$)"
        onClick={() => wrapSelection("$")}
      >
        <FunctionSquareIcon className="size-4" />
      </TooltipIconButton>
      <TooltipIconButton
        tooltip="Display math (\\[...\\])"
        onClick={() => insertText("\\[\n  ", "\n\\]")}
      >
        <span className="font-mono text-xs">∫</span>
      </TooltipIconButton>
      <div className="mx-2 h-4 w-px bg-white/10" />
      <TooltipIconButton
        tooltip="LaTeX keyboard (⌘/Ctrl+Shift+K)"
        onClick={() => setLatexKeyboardOpen(!isLatexKeyboardOpen)}
        className={
          isLatexKeyboardOpen ? "bg-white/10 text-[#faf9f5]" : undefined
        }
        aria-pressed={isLatexKeyboardOpen}
      >
        <KeyboardIcon className="size-4" />
      </TooltipIconButton>
      <div className="ml-auto flex items-center gap-1">
        <TextScaleButton />
        <TerminalThemeMenu />
      </div>
    </div>
  );
}
