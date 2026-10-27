"use client";

import { RefObject } from "react";
import type { EditorView } from "@codemirror/view";
import {
  BoldIcon,
  ItalicIcon,
  ListIcon,
  Heading1Icon,
  Heading2Icon,
  CodeIcon,
  FunctionSquareIcon,
  FileTextIcon,
  ImageIcon,
  KeyboardIcon,
  MinusIcon,
  PlusIcon,
} from "lucide-react";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDocumentStore } from "@/stores/document-store";

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
  imageScale?: number;
  onImageScaleChange?: (scale: number) => void;
}

export function EditorToolbar({
  editorView,
  fileType = "tex",
  imageScale = 1,
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
          <span className="font-medium font-mono text-[#faf9f5] text-[11px]">
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

  return (
    <div className="flex h-9 items-center gap-1 border-white/10 border-b bg-[#252320] px-2 text-[#a09d96] [&_button:hover]:bg-white/10 [&_button:hover]:text-[#faf9f5]">
      <FileTextIcon className="size-4 text-muted-foreground" />
      <span className="mr-2 font-medium font-mono text-[#faf9f5] text-[11px]">
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
    </div>
  );
}
