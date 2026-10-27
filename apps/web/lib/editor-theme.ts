import { HighlightStyle } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

export type TerminalThemeId =
  | "arcana"
  | "solarized-dark"
  | "dracula"
  | "nord"
  | "tokyo-night"
  | "gruvbox"
  | "solarized-light";

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
  colors: TerminalPalette;
}

export const TERMINAL_THEMES: TerminalTheme[] = [
  {
    id: "arcana",
    label: "Arcana",
    dark: true,
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
  },
  {
    id: "solarized-dark",
    label: "Solarized Dark",
    dark: true,
    colors: {
      background: "#002b36",
      foreground: "#93a1a1",
      gutter: "#586e75",
      gutterActive: "#839496",
      activeLine: "#073642",
      selection: "rgba(38, 139, 210, 0.25)",
      cursor: "#b58900",
      keyword: "#859900",
      function: "#b58900",
      type: "#6c71c4",
      comment: "#586e75",
      string: "#2aa198",
      number: "#d33682",
      operator: "#2aa198",
      invalid: "#dc322f",
      accent: "#b58900",
      panel: "#073642",
      tooltip: "#073642",
      border: "rgba(147, 161, 161, 0.2)",
    },
  },
  {
    id: "dracula",
    label: "Dracula",
    dark: true,
    colors: {
      background: "#282a36",
      foreground: "#f8f8f2",
      gutter: "#6272a4",
      gutterActive: "#bd93f9",
      activeLine: "#44475a",
      selection: "rgba(68, 71, 90, 0.85)",
      cursor: "#f8f8f2",
      keyword: "#ff79c6",
      function: "#50fa7b",
      type: "#8be9fd",
      comment: "#6272a4",
      string: "#f1fa8c",
      number: "#bd93f9",
      operator: "#ff79c6",
      invalid: "#ff5555",
      accent: "#ffb86c",
      panel: "#21222c",
      tooltip: "#44475a",
      border: "rgba(248, 248, 242, 0.14)",
    },
  },
  {
    id: "nord",
    label: "Nord",
    dark: true,
    colors: {
      background: "#2e3440",
      foreground: "#d8dee9",
      gutter: "#4c566a",
      gutterActive: "#81a1c1",
      activeLine: "#3b4252",
      selection: "rgba(129, 161, 193, 0.28)",
      cursor: "#88c0d0",
      keyword: "#81a1c1",
      function: "#88c0d0",
      type: "#8fbcbb",
      comment: "#616e88",
      string: "#a3be8c",
      number: "#b48ead",
      operator: "#81a1c1",
      invalid: "#bf616a",
      accent: "#ebcb8b",
      panel: "#3b4252",
      tooltip: "#434c5e",
      border: "rgba(216, 222, 233, 0.14)",
    },
  },
  {
    id: "tokyo-night",
    label: "Tokyo Night",
    dark: true,
    colors: {
      background: "#1a1b26",
      foreground: "#c0caf5",
      gutter: "#3b4261",
      gutterActive: "#7aa2f7",
      activeLine: "#24283b",
      selection: "rgba(122, 162, 247, 0.25)",
      cursor: "#c0caf5",
      keyword: "#bb9af7",
      function: "#7aa2f7",
      type: "#7dcfff",
      comment: "#565f89",
      string: "#9ece6a",
      number: "#ff9e64",
      operator: "#89ddff",
      invalid: "#f7768e",
      accent: "#e0af68",
      panel: "#16161e",
      tooltip: "#24283b",
      border: "rgba(192, 202, 245, 0.14)",
    },
  },
  {
    id: "gruvbox",
    label: "Gruvbox",
    dark: true,
    colors: {
      background: "#282828",
      foreground: "#ebdbb2",
      gutter: "#665c54",
      gutterActive: "#a89984",
      activeLine: "#3c3836",
      selection: "rgba(215, 153, 33, 0.22)",
      cursor: "#ebdbb2",
      keyword: "#fb4934",
      function: "#fabd2f",
      type: "#83a598",
      comment: "#928374",
      string: "#b8bb26",
      number: "#d3869b",
      operator: "#8ec07c",
      invalid: "#fb4934",
      accent: "#fe8019",
      panel: "#1d2021",
      tooltip: "#3c3836",
      border: "rgba(235, 219, 178, 0.14)",
    },
  },
  {
    id: "solarized-light",
    label: "Solarized Light",
    dark: false,
    colors: {
      background: "#fdf6e3",
      foreground: "#657b83",
      gutter: "#93a1a1",
      gutterActive: "#586e75",
      activeLine: "#eee8d5",
      selection: "rgba(38, 139, 210, 0.18)",
      cursor: "#b58900",
      keyword: "#859900",
      function: "#b58900",
      type: "#6c71c4",
      comment: "#93a1a1",
      string: "#2aa198",
      number: "#d33682",
      operator: "#2aa198",
      invalid: "#dc322f",
      accent: "#cb4b16",
      panel: "#eee8d5",
      tooltip: "#eee8d5",
      border: "rgba(101, 123, 131, 0.18)",
    },
  },
];

export const DEFAULT_TERMINAL_THEME_ID: TerminalThemeId = "arcana";

function getTheme(id: TerminalThemeId): TerminalTheme {
  return (
    TERMINAL_THEMES.find((theme) => theme.id === id) ?? TERMINAL_THEMES[0]!
  );
}

export function buildEditorTheme(id: TerminalThemeId): {
  theme: Extension;
  highlight: HighlightStyle;
} {
  const { colors, dark } = getTheme(id);

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
