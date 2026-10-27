"use client";

import { useEffect, useRef } from "react";
import {
  getSyncBaseUrl,
  getSyncUserName,
  loadProjectSyncSettings,
} from "@/lib/sync/settings";
import type { SyncSnapshot } from "@/lib/sync/types";
import { useDocumentStore } from "@/stores/document-store";
import { useSyncStore } from "@/stores/sync-store";

export function useProjectSync(projectId: string) {
  const enabled = useSyncStore((state) => state.enabled);
  const token = useSyncStore((state) => state.token);
  const userName = useSyncStore((state) => state.userName);
  const setSession = useSyncStore((state) => state.setSession);
  const setStatus = useSyncStore((state) => state.setStatus);
  const setPeers = useSyncStore((state) => state.setPeers);
  const setError = useSyncStore((state) => state.setError);
  const setUserName = useSyncStore((state) => state.setUserName);

  const socketRef = useRef<WebSocket | null>(null);
  const sendSnapshotRef = useRef<() => void>(() => {});
  const applyingRemoteRef = useRef(false);
  const userNameRef = useRef(userName);

  userNameRef.current = userName;

  useEffect(() => {
    setUserName(getSyncUserName());
  }, [setUserName]);

  useEffect(() => {
    if (!projectId) return;

    const settings = loadProjectSyncSettings(projectId);
    setSession(settings?.token ?? null, settings?.enabled ?? false);
    setStatus(settings?.enabled ? "connecting" : "idle");
    setPeers([]);
    setError(null);
  }, [projectId, setSession, setStatus, setPeers, setError]);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      setPeers([]);
      setError(null);
    }
  }, [enabled, setStatus, setPeers, setError]);

  useEffect(() => {
    if (!projectId || !enabled || !token) return;

    let stopped = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const applyRemote = (snapshot: SyncSnapshot) => {
      if (
        snapshot.projectId !== projectId ||
        !Array.isArray(snapshot.files) ||
        snapshot.files.length === 0
      ) {
        return;
      }

      applyingRemoteRef.current = true;
      useDocumentStore.getState().applyRemoteSnapshot({
        projectName: snapshot.projectName,
        files: snapshot.files,
        mainFileId: snapshot.mainFileId,
        compiler: snapshot.compiler,
        comments: snapshot.comments,
      });

      setTimeout(() => {
        applyingRemoteRef.current = false;
      }, 0);
    };

    const sendSnapshot = () => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;

      const state = useDocumentStore.getState();
      if (!state.isHydrated || state.projectId !== projectId) return;

      const snapshot: SyncSnapshot = {
        projectId,
        projectName: state.projectName,
        files: state.files,
        mainFileId: state.mainFileId,
        compiler: state.compiler,
        comments: state.comments,
        updatedAt: Date.now(),
      };

      socket.send(JSON.stringify({ type: "snapshot", snapshot }));
    };

    sendSnapshotRef.current = sendSnapshot;

    const connect = () => {
      if (stopped) return;

      setStatus("connecting");
      const ws = new WebSocket(
        `${getSyncBaseUrl()}/ws/${projectId}?token=${encodeURIComponent(token)}`,
      );
      socket = ws;
      socketRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        setError(null);
        ws.send(
          JSON.stringify({
            type: "presence",
            name: userNameRef.current,
          }),
        );
      };

      ws.onmessage = (event) => {
        if (typeof event.data !== "string") return;

        let message: {
          type?: string;
          peers?: { id: string; name: string }[];
          snapshot?: SyncSnapshot;
          reason?: string;
        };

        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }

        if (message.type === "joined") {
          setPeers(message.peers ?? []);
          if (message.snapshot) {
            applyRemote(message.snapshot);
          } else {
            sendSnapshot();
          }
          return;
        }

        if (message.type === "snapshot" && message.snapshot) {
          applyRemote(message.snapshot);
          return;
        }

        if (message.type === "presence") {
          setPeers(message.peers ?? []);
        }
      };

      ws.onerror = () => {
        setError("Could not reach the sync server.");
      };

      ws.onclose = (event) => {
        if (socketRef.current === ws) socketRef.current = null;
        if (stopped) return;

        if (event.code === 1008) {
          setStatus("error");
          setError(event.reason || "The sync server rejected this session.");
          return;
        }

        setStatus("connecting");
        setError("Sync disconnected. Reconnecting…");
        retryTimer = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (socket?.readyState === WebSocket.OPEN) {
        sendSnapshot();
      }
      socket?.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [projectId, enabled, token, setStatus, setPeers, setError]);

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | undefined;

    const unsubscribe = useDocumentStore.subscribe((state, previous) => {
      if (applyingRemoteRef.current) return;
      if (!state.isHydrated || state.projectId !== projectId) return;

      const changed =
        state.files !== previous.files ||
        state.projectName !== previous.projectName ||
        state.mainFileId !== previous.mainFileId ||
        state.compiler !== previous.compiler ||
        state.comments !== previous.comments;

      if (changed) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          timer = undefined;
          sendSnapshotRef.current();
        }, 300);
      }
    });

    return () => {
      if (timer) {
        clearTimeout(timer);
        sendSnapshotRef.current();
      }
      unsubscribe();
    };
  }, [enabled, projectId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify({ type: "presence", name: userName }));
  }, [userName]);
}
