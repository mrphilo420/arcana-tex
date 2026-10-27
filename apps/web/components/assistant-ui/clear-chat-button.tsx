"use client";

import { useState } from "react";
import { useThreadRuntime } from "@assistant-ui/react";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteChatHistory } from "@/lib/projects/chat-history";
import { useDocumentStore } from "@/stores/document-store";
import { cn } from "@/lib/utils";

export function ClearChatButton({ className }: { className?: string }) {
  const runtime = useThreadRuntime();
  const projectId = useDocumentStore((state) => state.projectId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const clearChat = async () => {
    setClearing(true);
    try {
      if (projectId) {
        await deleteChatHistory(projectId);
      }
      runtime.cancelRun();
      runtime.reset();
      setConfirmOpen(false);
      toast.success("Chat cleared");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not clear the chat.",
      );
    } finally {
      setClearing(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "size-7 text-muted-foreground hover:text-destructive",
          className,
        )}
        onClick={() => setConfirmOpen(true)}
        title="Clear chat"
        aria-label="Clear chat"
      >
        <Trash2Icon className="size-3.5" />
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clear chat?</DialogTitle>
            <DialogDescription>
              This removes the conversation for this project from this browser.
              Your files, versions, and patches are not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={clearing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void clearChat()}
              disabled={clearing}
            >
              {clearing ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <Trash2Icon className="size-3.5" />
              )}
              Clear chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
