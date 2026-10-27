import { create } from "zustand";
import {
  DEFAULT_TERMINAL_THEME_ID,
  TERMINAL_THEMES,
  type TerminalThemeId,
} from "@/lib/editor-theme";

const STORAGE_KEY = "open-prism:terminal-theme";

function isTerminalThemeId(value: string): value is TerminalThemeId {
  return TERMINAL_THEMES.some((theme) => theme.id === value);
}

function readStoredTheme(): TerminalThemeId {
  if (typeof window === "undefined") return DEFAULT_TERMINAL_THEME_ID;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && isTerminalThemeId(stored)
      ? stored
      : DEFAULT_TERMINAL_THEME_ID;
  } catch {
    return DEFAULT_TERMINAL_THEME_ID;
  }
}

interface EditorPreferencesState {
  terminalThemeId: TerminalThemeId;
  setTerminalThemeId: (id: TerminalThemeId) => void;
  hydrate: () => void;
}

export const useEditorPreferencesStore = create<EditorPreferencesState>()(
  (set) => ({
    terminalThemeId: DEFAULT_TERMINAL_THEME_ID,
    setTerminalThemeId: (terminalThemeId) => {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(STORAGE_KEY, terminalThemeId);
        } catch {}
      }
      set({ terminalThemeId });
    },
    hydrate: () => set({ terminalThemeId: readStoredTheme() }),
  }),
);
