"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { getTerminalTheme } from "@/lib/editor-theme";
import { useEditorPreferencesStore } from "@/stores/editor-preferences-store";

const UI_VARIABLES = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--primary-active",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--border",
  "--input",
  "--ring",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
  "--surface-dark",
  "--surface-dark-elevated",
  "--on-dark",
  "--on-dark-soft",
  "--hairline",
  "--accent-teal",
  "--accent-amber",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--selection",
] as const;

export function ThemeRuntime() {
  const themeId = useEditorPreferencesStore((s) => s.terminalThemeId);
  const fontPairingId = useEditorPreferencesStore((s) => s.fontPairingId);
  const textScaleId = useEditorPreferencesStore((s) => s.textScaleId);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    useEditorPreferencesStore.getState().hydrate();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.fontPairing = fontPairingId;
    root.dataset.textScale = textScaleId;

    if (themeId === "arcana") {
      for (const property of UI_VARIABLES) {
        root.style.removeProperty(property);
      }
      const dark = resolvedTheme === "dark";
      root.dataset.appTheme = "arcana";
      root.style.colorScheme = dark ? "dark" : "light";
      root.classList.toggle("dark", dark);
      return;
    }

    const theme = getTerminalTheme(themeId);
    const ui = theme.ui;
    const values: Record<(typeof UI_VARIABLES)[number], string> = {
      "--background": ui.background,
      "--foreground": ui.foreground,
      "--card": ui.card,
      "--card-foreground": ui.cardForeground,
      "--popover": ui.popover,
      "--popover-foreground": ui.popoverForeground,
      "--primary": ui.primary,
      "--primary-foreground": ui.primaryForeground,
      "--primary-active": ui.primary,
      "--secondary": ui.secondary,
      "--secondary-foreground": ui.secondaryForeground,
      "--muted": ui.muted,
      "--muted-foreground": ui.mutedForeground,
      "--accent": ui.accent,
      "--accent-foreground": ui.accentForeground,
      "--destructive": ui.destructive,
      "--border": ui.border,
      "--input": ui.input,
      "--ring": ui.ring,
      "--sidebar": ui.sidebar,
      "--sidebar-foreground": ui.sidebarForeground,
      "--sidebar-primary": ui.primary,
      "--sidebar-primary-foreground": ui.primaryForeground,
      "--sidebar-accent": ui.sidebarAccent,
      "--sidebar-accent-foreground": ui.sidebarAccentForeground,
      "--sidebar-border": ui.sidebarBorder,
      "--sidebar-ring": ui.ring,
      "--surface-dark": ui.surfaceDark,
      "--surface-dark-elevated": ui.surfaceDarkElevated,
      "--on-dark": ui.onDark,
      "--on-dark-soft": ui.onDarkSoft,
      "--hairline": ui.hairline,
      "--accent-teal": ui.accentTeal,
      "--accent-amber": ui.accentAmber,
      "--chart-1": ui.chart1,
      "--chart-2": ui.chart2,
      "--chart-3": ui.chart3,
      "--chart-4": ui.chart4,
      "--chart-5": ui.chart5,
      "--selection": theme.colors.selection,
    };

    for (const property of UI_VARIABLES) {
      root.style.setProperty(property, values[property]);
    }
    root.dataset.appTheme = theme.id;
    root.style.colorScheme = theme.dark ? "dark" : "light";
    root.classList.toggle("dark", theme.dark);
  }, [fontPairingId, resolvedTheme, textScaleId, themeId]);

  return null;
}
