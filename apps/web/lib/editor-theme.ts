import { HighlightStyle } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { CCTHEMES, type CcTheme, type CcThemeId } from "./ccthemes";

export type TerminalThemeId = "arcana" | CcThemeId;

export interface AppThemeUi {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  border: string;
  input: string;
  ring: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  surfaceDark: string;
  surfaceDarkElevated: string;
  onDark: string;
  onDarkSoft: string;
  hairline: string;
  accentTeal: string;
  accentAmber: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
}

interface TerminalPalette {
  background: string;
  foreground: string;
  gutter: string;
  gutterActive: string;
  activeLine: string;
  selection: string;
  cursor: string;
  keyword: string;
  function: string;
  type: string;
  comment: string;
  string: string;
  number: string;
  operator: string;
  invalid: string;
  accent: string;
  panel: string;
  tooltip: string;
  border: string;
}

export interface TerminalTheme {
  id: TerminalThemeId;
  label: string;
  dark: boolean;
  ui: AppThemeUi;
  colors: TerminalPalette;
}

const CANVAS_OVERRIDES: Record<string, string> = {
  "amber-crt": "#1a1200",
  aubade: "#f7f1ff",
  "catppuccin-latte": "#eff1f5",
  "catppuccin-mocha": "#1e1e2e",
  dracula: "#282a36",
  everforest: "#2b3339",
  "github-dark": "#0d1117",
  "github-light": "#ffffff",
  gruvbox: "#282828",
  letterpress: "#f6f1e6",
  "matcha-zen": "#f3f7ef",
  nord: "#2e3440",
  opaline: "#f7f8fb",
  porcelain: "#f7f8fa",
  "rose-pine-dawn": "#faf4ed",
  "solarized-dark": "#002b36",
  "solarized-light": "#fdf6e3",
  synthwave: "#241b2f",
  "tokyo-night": "#1a1b26",
};

const ARCANA_UI: AppThemeUi = {
  background: "#faf9f5",
  foreground: "#141413",
  card: "#f5f0e8",
  cardForeground: "#141413",
  popover: "#fffdf9",
  popoverForeground: "#141413",
  primary: "#cc785c",
  primaryForeground: "#ffffff",
  secondary: "#efe9de",
  secondaryForeground: "#252523",
  muted: "#f0ebe2",
  mutedForeground: "#6c6a64",
  accent: "#efe9de",
  accentForeground: "#141413",
  destructive: "#c64545",
  border: "#e6dfd8",
  input: "#e6dfd8",
  ring: "#cc785c",
  sidebar: "#f5f0e8",
  sidebarForeground: "#252523",
  sidebarAccent: "#efe9de",
  sidebarAccentForeground: "#141413",
  sidebarBorder: "#e6dfd8",
  surfaceDark: "#181715",
  surfaceDarkElevated: "#252320",
  onDark: "#faf9f5",
  onDarkSoft: "#a09d96",
  hairline: "#e6dfd8",
  accentTeal: "#5db8a6",
  accentAmber: "#e8a55a",
  chart1: "#cc785c",
  chart2: "#5db8a6",
  chart3: "#e8a55a",
  chart4: "#8e8b82",
  chart5: "#c64545",
};

const ARCANA_THEME: TerminalTheme = {
  id: "arcana",
  label: "Arcana",
  dark: true,
  ui: ARCANA_UI,
  colors: {
    background: "#181715",
    foreground: "#faf9f5",
    gutter: "#6c6a64",
    gutterActive: "#a09d96",
    activeLine: "#1f1e1b",
    selection: "rgba(204, 120, 92, 0.24)",
    cursor: "#cc785c",
    keyword: "#cc785c",
    function: "#e8a55a",
    type: "#5db8a6",
    comment: "#8e8b82",
    string: "#5db8a6",
    number: "#5db8a6",
    operator: "#5db8a6",
    invalid: "#c64545",
    accent: "#e8a55a",
    panel: "#1f1e1b",
    tooltip: "#252320",
    border: "rgba(250, 249, 245, 0.12)",
  },
};

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return `rgba(204, 120, 92, ${alpha})`;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function contrastColor(background: string): string {
  const normalized = background.replace("#", "");
  if (normalized.length !== 6) return "#ffffff";
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.6 ? "#111111" : "#ffffff";
}

function themeFromCcTheme(theme: CcTheme): TerminalTheme {
  const background =
    CANVAS_OVERRIDES[theme.id] ||
    theme.userMessageBackground ||
    theme.subtle ||
    (theme.base === "dark" ? "#181715" : "#faf9f5");
  const card = theme.bashMessageBackgroundColor || theme.subtle || background;
  const border = theme.promptBorder || theme.inactive || background;
  const accent = theme.claude;
  const dark = theme.base === "dark";

  return {
    id: theme.id as TerminalThemeId,
    label: theme.label,
    dark,
    ui: {
      background,
      foreground: theme.text,
      card,
      cardForeground: theme.text,
      popover: theme.bashMessageBackgroundColor || card,
      popoverForeground: theme.text,
      primary: accent,
      primaryForeground: contrastColor(accent),
      secondary: theme.subtle,
      secondaryForeground: theme.text,
      muted: theme.bashMessageBackgroundColor || theme.subtle,
      mutedForeground: theme.inactive,
      accent: theme.subtle,
      accentForeground: theme.text,
      destructive: theme.error,
      border,
      input: border,
      ring: accent,
      sidebar: background,
      sidebarForeground: theme.text,
      sidebarAccent: card,
      sidebarAccentForeground: theme.text,
      sidebarBorder: border,
      surfaceDark: background,
      surfaceDarkElevated: card,
      onDark: theme.text,
      onDarkSoft: theme.inactive,
      hairline: border,
      accentTeal: theme.planMode,
      accentAmber: theme.warning,
      chart1: accent,
      chart2: theme.planMode,
      chart3: theme.warning,
      chart4: theme.inactive,
      chart5: theme.error,
    },
    colors: {
      background,
      foreground: theme.text,
      gutter: theme.inactive,
      gutterActive: theme.text,
      activeLine: theme.bashMessageBackgroundColor || theme.subtle,
      selection: withAlpha(accent, 0.24),
      cursor: accent,
      keyword: accent,
      function: theme.warning,
      type: theme.planMode,
      comment: theme.inactive,
      string: theme.success,
      number: theme.bashBorder,
      operator: theme.planMode,
      invalid: theme.error,
      accent: theme.warning,
      panel: theme.bashMessageBackgroundColor || theme.subtle,
      tooltip: theme.subtle,
      border,
    },
  };
}

export const TERMINAL_THEMES: TerminalTheme[] = [
  ARCANA_THEME,
  ...CCTHEMES.map(themeFromCcTheme),
];

export const DEFAULT_TERMINAL_THEME_ID: TerminalThemeId = "arcana";

export function getTerminalTheme(id: TerminalThemeId): TerminalTheme {
  return TERMINAL_THEMES.find((theme) => theme.id === id) ?? ARCANA_THEME;
}

export function buildEditorTheme(id: TerminalThemeId): {
  theme: Extension;
  highlight: HighlightStyle;
} {
  const { colors, dark } = getTerminalTheme(id);

  const theme = EditorView.theme(
    {
      "&": {
        color: colors.foreground,
        backgroundColor: colors.background,
      },
      ".cm-content": {
        caretColor: colors.cursor,
      },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: colors.cursor,
      },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
        {
          backgroundColor: colors.selection,
        },
      ".cm-gutters": {
        backgroundColor: colors.background,
        color: colors.gutter,
        border: "none",
      },
      ".cm-activeLineGutter": {
        backgroundColor: colors.activeLine,
        color: colors.gutterActive,
      },
      ".cm-activeLine": {
        backgroundColor: colors.activeLine,
      },
      ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
        backgroundColor: colors.selection,
        outline: `1px solid ${colors.type}`,
      },
      ".cm-selectionMatch": {
        backgroundColor: colors.selection,
      },
      ".cm-searchMatch": {
        backgroundColor: colors.accent,
        opacity: 0.3,
        outline: `1px solid ${colors.accent}`,
        borderRadius: "2px",
      },
      ".cm-searchMatch.cm-searchMatch-selected": {
        backgroundColor: colors.accent,
        opacity: 0.5,
        outline: `1px solid ${colors.accent}`,
      },
      ".cm-panels": {
        backgroundColor: colors.panel,
        color: colors.foreground,
      },
      ".cm-tooltip": {
        backgroundColor: colors.tooltip,
        border: `1px solid ${colors.border}`,
        color: colors.foreground,
      },
    },
    { dark },
  );

  const highlight = HighlightStyle.define([
    { tag: tags.keyword, color: colors.keyword },
    {
      tag: [
        tags.name,
        tags.deleted,
        tags.character,
        tags.propertyName,
        tags.macroName,
      ],
      color: colors.foreground,
    },
    {
      tag: [tags.function(tags.variableName), tags.labelName],
      color: colors.function,
    },
    {
      tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)],
      color: colors.accent,
    },
    {
      tag: [
        tags.typeName,
        tags.className,
        tags.number,
        tags.changed,
        tags.annotation,
        tags.modifier,
        tags.self,
        tags.namespace,
      ],
      color: colors.type,
    },
    {
      tag: [
        tags.operator,
        tags.operatorKeyword,
        tags.url,
        tags.escape,
        tags.regexp,
        tags.link,
      ],
      color: colors.operator,
    },
    {
      tag: [tags.meta, tags.comment],
      color: colors.comment,
      fontStyle: "italic",
    },
    { tag: tags.strong, fontWeight: "600" },
    { tag: tags.emphasis, fontStyle: "italic" },
    { tag: tags.strikethrough, textDecoration: "line-through" },
    { tag: tags.heading, fontWeight: "600", color: colors.keyword },
    {
      tag: [tags.atom, tags.bool, tags.special(tags.variableName)],
      color: colors.accent,
    },
    {
      tag: [tags.processingInstruction, tags.string, tags.inserted],
      color: colors.string,
    },
    { tag: tags.invalid, color: colors.invalid },
  ]);

  return { theme, highlight };
}

export const claudeEditorTheme = buildEditorTheme("arcana").theme;
export const claudeHighlightStyle = buildEditorTheme("arcana").highlight;
