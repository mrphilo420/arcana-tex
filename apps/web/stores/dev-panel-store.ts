import { create } from "zustand";
import {
  DEFAULT_DEV_FEATURE_FLAGS,
  DEV_PANEL_ENABLED,
  readStoredDevFeatureFlags,
  writeStoredDevFeatureFlags,
  type DevFeatureFlag,
  type DevFeatureFlags,
} from "@/lib/dev-panel";

export type DevPanelTab =
  | "features"
  | "models"
  | "workspace"
  | "bridge"
  | "data";

interface DevPanelState {
  isOpen: boolean;
  activeTab: DevPanelTab;
  flags: DevFeatureFlags;
  hydrated: boolean;
  setOpen: (open: boolean) => void;
  setActiveTab: (tab: DevPanelTab) => void;
  setFlag: (flag: DevFeatureFlag, enabled: boolean) => void;
  setFlags: (flags: DevFeatureFlags) => void;
  resetFlags: () => void;
  hydrate: () => void;
}

export const useDevPanelStore = create<DevPanelState>()((set, get) => ({
  isOpen: false,
  activeTab: "features",
  flags: DEFAULT_DEV_FEATURE_FLAGS,
  hydrated: false,

  setOpen: (isOpen) => set({ isOpen }),
  setActiveTab: (activeTab) => set({ activeTab }),

  setFlag: (flag, enabled) => {
    const flags = { ...get().flags, [flag]: enabled };
    writeStoredDevFeatureFlags(flags);
    set({ flags });
  },

  setFlags: (flags) => {
    writeStoredDevFeatureFlags(flags);
    set({ flags, hydrated: true });
  },

  resetFlags: () => {
    writeStoredDevFeatureFlags(DEFAULT_DEV_FEATURE_FLAGS);
    set({ flags: DEFAULT_DEV_FEATURE_FLAGS, hydrated: true });
  },

  hydrate: () => {
    if (get().hydrated) return;
    set({ flags: readStoredDevFeatureFlags(), hydrated: true });
  },
}));

export function useDevFeatureFlag(flag: DevFeatureFlag): boolean {
  const flags = useDevPanelStore((state) => state.flags);
  if (!DEV_PANEL_ENABLED) return true;
  return flags[flag] !== false;
}
