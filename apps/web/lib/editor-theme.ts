import { HighlightStyle } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

export const claudeEditorTheme = EditorView.theme(
  {
    "&": {
      color: "#faf9f5",
      backgroundColor: "#181715",
    },
    ".cm-content": {
      caretColor: "#cc785c",
    },
    ".cm-scroller": {
      fontFamily: "var(--font-jetbrains), ui-monospace, monospace",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#cc785c",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "rgba(204, 120, 92, 0.24)",
      },
    ".cm-gutters": {
      backgroundColor: "#181715",
      color: "#6c6a64",
      border: "none",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "#252320",
      color: "#a09d96",
    },
    ".cm-activeLine": {
      backgroundColor: "#1f1e1b",
    },
    ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
      backgroundColor: "rgba(93, 184, 166, 0.18)",
      outline: "1px solid rgba(93, 184, 166, 0.4)",
    },
    ".cm-selectionMatch": {
      backgroundColor: "rgba(232, 165, 90, 0.18)",
    },
    ".cm-searchMatch": {
      backgroundColor: "rgba(232, 165, 90, 0.32)",
      outline: "1px solid rgba(232, 165, 90, 0.55)",
      borderRadius: "2px",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "rgba(204, 120, 92, 0.45)",
      outline: "1px solid #cc785c",
    },
    ".cm-panels": {
      backgroundColor: "#1f1e1b",
      color: "#faf9f5",
    },
    ".cm-tooltip": {
      backgroundColor: "#252320",
      border: "1px solid rgba(250, 249, 245, 0.12)",
      color: "#faf9f5",
    },
  },
  { dark: true },
);

export const claudeHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#cc785c" },
  {
    tag: [
      tags.name,
      tags.deleted,
      tags.character,
      tags.propertyName,
      tags.macroName,
    ],
    color: "#faf9f5",
  },
  {
    tag: [tags.function(tags.variableName), tags.labelName],
    color: "#e8a55a",
  },
  {
    tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)],
    color: "#e8a55a",
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
    color: "#5db8a6",
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
    color: "#5db8a6",
  },
  {
    tag: [tags.meta, tags.comment],
    color: "#8e8b82",
    fontStyle: "italic",
  },
  { tag: tags.strong, fontWeight: "600" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.heading, fontWeight: "600", color: "#cc785c" },
  {
    tag: [tags.atom, tags.bool, tags.special(tags.variableName)],
    color: "#e8a55a",
  },
  {
    tag: [tags.processingInstruction, tags.string, tags.inserted],
    color: "#5db8a6",
  },
  { tag: tags.invalid, color: "#c64545" },
]);
