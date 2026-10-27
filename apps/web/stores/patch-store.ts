import { create } from "zustand";

export interface ProposedPatch {
  id: string;
  fileId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  before: string;
  after: string;
  explanation: string;
  summary?: string;
  createdAt: number;
}

interface PatchStore {
  patch: ProposedPatch | null;
  propose: (patch: Omit<ProposedPatch, "id" | "createdAt">) => ProposedPatch;
  clear: () => void;
}

export const usePatchStore = create<PatchStore>((set) => ({
  patch: null,
  propose: (patch) => {
    const proposed: ProposedPatch = {
      ...patch,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    set({ patch: proposed });
    return proposed;
  },
  clear: () => set({ patch: null }),
}));
