import { create } from "zustand";
import {
  DEFAULT_TERMINAL_THEME_ID,
  TERMINAL_THEMES,
  type TerminalThemeId,
} from "@/lib/editor-theme";
import {
  DEFAULT_FONT_PAIRING_ID,
  FONT_PAIRINGS,
  type FontPairingId,
} from "@/lib/font-pairings";

const STORAGE_KEY = "open-prism:terminal-theme";
const FONT_STORAGE_KEY = "open-prism:font-pairing";

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

function isFontPairingId(value: string): value is FontPairingId {
  return FONT_PAIRINGS.some((pairing) => pairing.id === value);
}

function readStoredFontPairing(): FontPairingId {
  if (typeof window === "undefined") return DEFAULT_FONT_PAIRING_ID;
  try {
    const stored = window.localStorage.getItem(FONT_STORAGE_KEY);
    return stored && isFontPairingId(stored) ? stored : DEFAULT_FONT_PAIRING_ID;
  } catch {
    return DEFAULT_FONT_PAIRING_ID;
  }
}

interface EditorPreferencesState {
  terminalThemeId: TerminalThemeId;
  fontPairingId: FontPairingId;
  setTerminalThemeId: (id: TerminalThemeId) => void;
  setFontPairingId: (id: FontPairingId) => void;
  hydrate: () => void;
}

export const useEditorPreferencesStore = create<EditorPreferencesState>()(
  (set) => ({
    terminalThemeId: DEFAULT_TERMINAL_THEME_ID,
    fontPairingId: DEFAULT_FONT_PAIRING_ID,
    setTerminalThemeId: (terminalThemeId) => {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(STORAGE_KEY, terminalThemeId);
        } catch {}
      }
      set({ terminalThemeId });
    },
    setFontPairingId: (fontPairingId) => {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(FONT_STORAGE_KEY, fontPairingId);
        } catch {}
      }
      set({ fontPairingId });
    },
    hydrate: () =>
      set({
        terminalThemeId: readStoredTheme(),
        fontPairingId: readStoredFontPairing(),
      }),
  }),
);
