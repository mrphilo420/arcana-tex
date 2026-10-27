"use client";

import { useEffect, useState } from "react";
import {
  CheckIcon,
  CloudIcon,
  CopyIcon,
  Loader2Icon,
  LogOutIcon,
  UsersIcon,
  WifiOffIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  disableProjectSync,
  enableProjectSync,
  getShareUrl,
  getSyncBaseUrl,
  getSyncUserName,
  setSyncUserName,
} from "@/lib/sync/settings";
import { useDocumentStore } from "@/stores/document-store";
import { useSyncStore } from "@/stores/sync-store";

interface SyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SyncDialog({ open, onOpenChange }: SyncDialogProps) {
  const projectId = useDocumentStore((s) => s.projectId);
  const enabled = useSyncStore((s) => s.enabled);
  const status = useSyncStore((s) => s.status);
  const token = useSyncStore((s) => s.token);
  const peers = useSyncStore((s) => s.peers);
  const error = useSyncStore((s) => s.error);
  const userName = useSyncStore((s) => s.userName);
  const setSession = useSyncStore((s) => s.setSession);
  const setStatus = useSyncStore((s) => s.setStatus);
  const setPeers = useSyncStore((s) => s.setPeers);
  const setError = useSyncStore((s) => s.setError);
  const setUserName = useSyncStore((s) => s.setUserName);

  const [name, setName] = useState(userName);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;

    const storedName = getSyncUserName();
    setName(storedName);
    setUserName(storedName);
  }, [open, setUserName]);

  const handleStart = () => {
    if (!projectId) return;
    const nextName = name.trim() || "Guest";
    setName(nextName);
    setSyncUserName(nextName);
    setUserName(nextName);
    const settings = enableProjectSync(projectId);
    setSession(settings.token, true);
    setStatus("connecting");
    setError(null);
  };

  const handleStop = () => {
    if (!projectId) return;
    disableProjectSync(projectId);
    setSession(token, false);
    setStatus("idle");
    setPeers([]);
    setError(null);
  };

  const handleCopy = async () => {
    if (!projectId || !token) return;

    try {
      await navigator.clipboard.writeText(getShareUrl(projectId, token));
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy the link");
    }
  };

  const statusLabel =
    status === "connected"
      ? "Live"
      : status === "connecting"
        ? "Connecting…"
        : status === "error"
          ? "Sync error"
          : "Not connected";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UsersIcon className="size-4" />
            Live collaboration &amp; sync
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-sm">Your name</div>
                <p className="text-muted-foreground text-xs">
                  Shown to other people in the session.
                </p>
              </div>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => {
                  const next = name.trim() || "Guest";
                  setName(next);
                  setSyncUserName(next);
                  setUserName(next);
                }}
                className="h-8 w-36 text-sm"
                maxLength={40}
              />
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {status === "connected" ? (
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-green-500" />
                  </span>
                ) : status === "error" ? (
                  <WifiOffIcon className="size-3.5 text-destructive" />
                ) : status === "connecting" ? (
                  <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <CloudIcon className="size-3.5 text-muted-foreground" />
                )}
                <span className="font-medium text-sm">{statusLabel}</span>
                {enabled && peers.length > 0 && (
                  <span className="text-muted-foreground text-xs">
                    · {peers.length} online
                  </span>
                )}
              </div>

              {enabled ? (
                <Button variant="outline" size="sm" onClick={handleStop}>
                  <LogOutIcon className="size-3.5" />
                  Leave
                </Button>
              ) : (
                <Button size="sm" onClick={handleStart} disabled={!projectId}>
                  <UsersIcon className="size-3.5" />
                  Start session
                </Button>
              )}
            </div>

            {enabled && token && (
              <div className="mt-3 flex items-center gap-2">
                <Input
                  readOnly
                  value={getShareUrl(projectId ?? "", token)}
                  className="h-8 bg-muted/40 font-mono text-[0.875rem]"
                  onFocus={(event) => event.target.select()}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={handleCopy}
                  title="Copy share link"
                >
                  {copied ? (
                    <CheckIcon className="size-3.5 text-green-600" />
                  ) : (
                    <CopyIcon className="size-3.5" />
                  )}
                </Button>
              </div>
            )}

            {peers.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {peers.map((peer) => (
                  <span
                    key={peer.id}
                    className="rounded-full bg-muted px-2 py-0.5 text-[0.875rem]"
                  >
                    {peer.name}
                  </span>
                ))}
              </div>
            )}

            {error && <p className="mt-3 text-destructive text-xs">{error}</p>}
          </div>

          <p className="text-muted-foreground text-xs">
            This keeps a snapshot of the project on the sync server at{" "}
            <code className="rounded bg-muted px-1">{getSyncBaseUrl()}</code>.
            Anyone with the link can edit the same copy in real time. Edits are
            last-write-wins and are saved back to your local browser.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
