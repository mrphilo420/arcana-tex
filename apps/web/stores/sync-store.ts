import { create } from "zustand";
import type { SyncPeer, SyncStatus } from "@/lib/sync/types";

interface SyncState {
  enabled: boolean;
  status: SyncStatus;
  token: string | null;
  peers: SyncPeer[];
  error: string | null;
  userName: string;
  setSession: (token: string | null, enabled: boolean) => void;
  setStatus: (status: SyncStatus) => void;
  setPeers: (peers: SyncPeer[]) => void;
  setError: (error: string | null) => void;
  setUserName: (name: string) => void;
  reset: () => void;
}

export const useSyncStore = create<SyncState>()((set) => ({
  enabled: false,
  status: "idle",
  token: null,
  peers: [],
  error: null,
  userName: "Guest",

  setSession: (token, enabled) => set({ token, enabled }),
  setStatus: (status) => set({ status }),
  setPeers: (peers) => set({ peers }),
  setError: (error) => set({ error }),
  setUserName: (userName) => set({ userName }),
  reset: () =>
    set({
      enabled: false,
      status: "idle",
      token: null,
      peers: [],
      error: null,
    }),
}));
