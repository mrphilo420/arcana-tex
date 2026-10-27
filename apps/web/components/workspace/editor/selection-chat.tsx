"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useThreadRuntime } from "@assistant-ui/react";
import { ArrowUpIcon, MapPinIcon, SparklesIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { useDocumentStore } from "@/stores/document-store";

export interface SelectionChatTarget {
  text: string;
  startLine: number;
  endLine: number;
  top: number;
  left: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function truncateSelection(text: string): string {
  if (text.length <= 3200) return text;
  return `${text.slice(0, 2400)}\n… selection truncated …\n${text.slice(-700)}`;
}

export function SelectionChat({
  target,
  filePath,
  language,
  onClose,
}: {
  target: SelectionChatTarget | null;
  filePath: string;
  language: string;
  onClose: () => void;
}) {
  const runtime = useThreadRuntime();
  const setThreadOpen = useDocumentStore((s) => s.setThreadOpen);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setOpen(false);
    setQuestion("");
    setSending(false);
  }, [target?.startLine, target?.endLine, target?.text]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const timer = window.setTimeout(
      () => document.addEventListener("pointerdown", onPointerDown),
      0,
    );
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!target || typeof document === "undefined") return null;

  const panelWidth = 420;
  const left = clamp(
    target.left,
    8,
    Math.max(8, window.innerWidth - panelWidth - 8),
  );
  const buttonTop = clamp(target.top, 8, Math.max(8, window.innerHeight - 52));
  const panelHeightEstimate = 360;
  const panelTop =
    buttonTop + panelHeightEstimate > window.innerHeight
      ? Math.max(8, buttonTop - panelHeightEstimate - 42)
      : buttonTop;

  const send = async () => {
    const prompt =
      question.trim() || "Explain this selection and suggest improvements.";
    if (sending) return;

    setSending(true);
    try {
      await runtime.append({
        role: "user",
        content: [
          {
            type: "text",
            text: `I need help with this selection in \`${filePath}\` at ${
              target.startLine === target.endLine
                ? `line ${target.startLine}`
                : `lines ${target.startLine}–${target.endLine}`
            }:\n\n\`\`\`${language}\n${truncateSelection(target.text)}\n\`\`\`\n\n${prompt}`,
          },
        ],
      });
      setThreadOpen(true);
      onClose();
    } catch (error) {
      console.error("Could not send selection to chat", error);
      toast.error("Could not send this selection to the assistant");
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    open ? (
      <div
        ref={panelRef}
        className="fixed z-[80] max-h-[calc(100vh-1rem)] w-[min(420px,calc(100vw-1rem))] overflow-y-auto rounded-[18px] border border-border bg-popover text-popover-foreground shadow-[0_18px_60px_rgba(0,0,0,0.18)]"
        style={{ left, top: panelTop }}
        role="dialog"
        aria-label="Ask AI about selection"
      >
        <div className="flex items-start justify-between gap-3 border-border border-b px-4 pt-3.5 pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <SparklesIcon className="size-3.5" />
            </span>
            <div className="min-w-0">
              <div className="font-medium text-[1rem] leading-tight">
                Ask AI about selection
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-1 text-[0.75rem] text-muted-foreground">
                <MapPinIcon className="size-3 shrink-0" />
                <span className="truncate" title={filePath}>
                  {filePath} ·{" "}
                  {target.startLine === target.endLine
                    ? `line ${target.startLine}`
                    : `lines ${target.startLine}–${target.endLine}`}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => setOpen(false)}
            aria-label="Close selection chat"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>

        <div className="space-y-2.5 p-4">
          <div className="max-h-28 overflow-y-auto overflow-x-hidden whitespace-pre-wrap rounded-[10px] border border-border bg-muted/45 px-2.5 py-2 font-mono text-[0.8125rem] text-foreground leading-[1.55] [overflow-wrap:anywhere]">
            {truncateSelection(target.text)}
          </div>
          <textarea
            ref={inputRef}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            placeholder="Ask about this selection..."
            className="min-h-[84px] w-full resize-none rounded-[12px] border border-input bg-background px-3 py-2.5 text-[1rem] outline-none transition-shadow placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
            aria-label="Question about selection"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 flex-1 text-[0.75rem] text-muted-foreground leading-snug">
              Sends location + selection to the main chat
            </span>
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-4 font-medium text-[0.875rem] text-primary-foreground transition-transform active:scale-95 disabled:opacity-60"
            >
              <ArrowUpIcon className="size-3.5" />
              {sending ? "Sending" : "Ask AI"}
            </button>
          </div>
        </div>
      </div>
    ) : (
      <button
        type="button"
        className="fixed z-[80] inline-flex h-8 -translate-y-1/2 items-center gap-1.5 rounded-full border border-primary/25 bg-popover px-3 font-medium text-[0.875rem] text-primary shadow-[0_6px_20px_rgba(0,0,0,0.10)] transition-transform active:scale-95"
        style={{ left, top: buttonTop }}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          setOpen(true);
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }}
        aria-label="Ask AI about selection"
      >
        <SparklesIcon className="size-3.5" />
        Ask AI
      </button>
    ),
    document.body,
  );
}
