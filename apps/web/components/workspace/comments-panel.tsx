"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2Icon,
  CircleIcon,
  MapPinIcon,
  MessageSquareIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import type { ProjectComment } from "@/lib/storage/schema";
import { getSyncUserName } from "@/lib/sync/settings";
import { useDocumentStore } from "@/stores/document-store";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

function commentPosition(
  comment: ProjectComment,
  content: string,
): number | null {
  if (comment.selectedText) {
    const index = content.indexOf(comment.selectedText);
    if (index !== -1) return index;
  }

  const lines = content.split("\n");
  const line = Math.min(Math.max(comment.line, 1), Math.max(lines.length, 1));
  let position = 0;

  for (let i = 0; i < line - 1; i++) {
    position += (lines[i]?.length ?? 0) + 1;
  }

  return position;
}

export function CommentsPanel() {
  const isOpen = useDocumentStore((s) => s.isCommentsOpen);
  const setOpen = useDocumentStore((s) => s.setCommentsOpen);
  const files = useDocumentStore((s) => s.files);
  const activeFileId = useDocumentStore((s) => s.activeFileId);
  const comments = useDocumentStore((s) => s.comments);
  const cursorPosition = useDocumentStore((s) => s.cursorPosition);
  const selectionRange = useDocumentStore((s) => s.selectionRange);
  const setActiveFile = useDocumentStore((s) => s.setActiveFile);
  const requestJumpToPosition = useDocumentStore(
    (s) => s.requestJumpToPosition,
  );
  const addComment = useDocumentStore((s) => s.addComment);
  const deleteComment = useDocumentStore((s) => s.deleteComment);
  const toggleCommentResolved = useDocumentStore(
    (s) => s.toggleCommentResolved,
  );

  const [draft, setDraft] = useState("");

  const activeFile = files.find((file) => file.id === activeFileId);
  const content = activeFile?.content ?? "";
  const anchorStart = selectionRange?.start ?? cursorPosition;
  const line = content.slice(0, anchorStart).split("\n").length;
  const selectedText = selectionRange
    ? content.slice(selectionRange.start, selectionRange.end).trim()
    : "";

  const unresolvedCount = comments.filter(
    (comment) => !comment.resolved,
  ).length;

  const sortedComments = useMemo(
    () =>
      [...comments].sort((a, b) => {
        if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
        return b.createdAt - a.createdAt;
      }),
    [comments],
  );

  const handleAdd = () => {
    if (!activeFile) return;

    const comment = addComment({
      fileId: activeFile.id,
      line,
      selectedText: selectedText || undefined,
      body: draft,
      author: getSyncUserName(),
    });

    if (!comment) {
      toast.error("Write a comment first");
      return;
    }

    setDraft("");
    toast.success("Comment added");
  };

  const handleJump = (comment: ProjectComment) => {
    const file = files.find((candidate) => candidate.id === comment.fileId);
    if (!file || file.type !== "tex") return;

    setActiveFile(file.id);
    const position = commentPosition(comment, file.content ?? "");
    if (position !== null) requestJumpToPosition(position);
    setOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-4 py-3 pr-12">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquareIcon className="size-4" />
            Comments
            {unresolvedCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-[0.875rem] text-primary">
                {unresolvedCount} open
              </span>
            )}
          </SheetTitle>
          <SheetDescription>
            Comments are saved with this project.
          </SheetDescription>
        </SheetHeader>

        <div className="border-b p-4">
          {activeFile?.type === "tex" ? (
            <>
              <div className="mb-2 flex items-center gap-1.5 text-muted-foreground text-xs">
                <MapPinIcon className="size-3.5" />
                <span>
                  {activeFile.path} · line {line}
                </span>
              </div>
              {selectedText && (
                <blockquote className="mb-2 max-h-20 overflow-hidden rounded border-l-2 bg-muted/40 px-2 py-1 text-muted-foreground text-xs italic">
                  “{selectedText.slice(0, 220)}
                  {selectedText.length > 220 ? "…" : ""}”
                </blockquote>
              )}
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Leave a comment on this passage…"
                className="min-h-20 resize-none bg-background text-sm"
                onKeyDown={(event) => {
                  if (
                    (event.metaKey || event.ctrlKey) &&
                    event.key === "Enter"
                  ) {
                    handleAdd();
                  }
                }}
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[0.875rem] text-muted-foreground">
                  ⌘↵ to add
                </span>
                <Button size="sm" onClick={handleAdd} disabled={!draft.trim()}>
                  Add comment
                </Button>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              Open a LaTeX file to add a comment anchored to its text.
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {sortedComments.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <MessageSquareIcon className="mx-auto mb-2 size-7 text-muted-foreground/50" />
              <p className="font-medium text-sm">No comments yet</p>
              <p className="mt-1 text-muted-foreground text-xs">
                Select text in the editor and leave a note for your
                collaborators.
              </p>
            </div>
          ) : (
            sortedComments.map((comment) => {
              const file = files.find(
                (candidate) => candidate.id === comment.fileId,
              );

              return (
                <div
                  key={comment.id}
                  className={`rounded-lg border p-3 ${
                    comment.resolved ? "opacity-60" : "bg-card"
                  }`}
                >
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => handleJump(comment)}
                      title="Jump to comment"
                    >
                      <div className="flex items-center gap-1.5 text-[0.875rem] text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {comment.author}
                        </span>
                        <span>·</span>
                        <span>
                          {formatDistanceToNow(new Date(comment.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate font-mono text-[0.875rem] text-muted-foreground">
                        {file?.path ?? comment.filePath}:{comment.line}
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        title={
                          comment.resolved
                            ? "Reopen comment"
                            : "Resolve comment"
                        }
                        onClick={() => toggleCommentResolved(comment.id)}
                      >
                        {comment.resolved ? (
                          <CheckCircle2Icon className="size-3.5 text-green-600" />
                        ) : (
                          <CircleIcon className="size-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground hover:text-destructive"
                        title="Delete comment"
                        onClick={() => deleteComment(comment.id)}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {comment.selectedText && (
                    <blockquote className="mb-1.5 line-clamp-2 border-l-2 bg-muted/40 px-2 py-1 text-muted-foreground text-xs italic">
                      “{comment.selectedText}”
                    </blockquote>
                  )}

                  <p
                    className={`whitespace-pre-wrap text-sm ${
                      comment.resolved ? "line-through" : ""
                    }`}
                  >
                    {comment.body}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
