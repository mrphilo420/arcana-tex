export type MonoFontId =
  | "jetbrains"
  | "ibm-plex"
  | "fira"
  | "source-code-pro"
  | "cupertino";

export interface MonoFontOption {
  id: MonoFontId;
  label: string;
  description: string;
  family: string;
}

export const MONO_FONTS: MonoFontOption[] = [
  {
    id: "jetbrains",
    label: "JetBrains Mono",
    description: "Tall x-height and clear LaTeX syntax.",
    family: "JetBrains Mono",
  },
  {
    id: "ibm-plex",
    label: "IBM Plex Mono",
    description: "Quiet, technical, and highly readable.",
    family: "IBM Plex Mono",
  },
  {
    id: "fira",
    label: "Fira Code",
    description: "Friendly coding font with ligatures.",
    family: "Fira Code",
  },
  {
    id: "source-code-pro",
    label: "Source Code Pro",
    description: "Neutral, compact code face from Adobe.",
    family: "Source Code Pro",
  },
  {
    id: "cupertino",
    label: "SF Mono / System",
    description: "Native monospace font on this system.",
    family: "SF Mono / ui-monospace",
  },
];

export const DEFAULT_MONO_FONT_ID: MonoFontId = "jetbrains";
