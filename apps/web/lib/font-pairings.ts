export type FontPairingId = "cupertino" | "editorial" | "modern" | "technical";

export interface FontPairing {
  id: FontPairingId;
  label: string;
  description: string;
  serif: string;
  sans: string;
  mono: string;
}

export const FONT_PAIRINGS: FontPairing[] = [
  {
    id: "cupertino",
    label: "Cupertino",
    description: "System serif, system UI, system mono",
    serif: "New York / ui-serif",
    sans: "SF Pro / system-ui",
    mono: "SF Mono / ui-monospace",
  },
  {
    id: "editorial",
    label: "Editorial",
    description: "Newsreader, Inter, JetBrains Mono",
    serif: "Newsreader",
    sans: "Inter",
    mono: "JetBrains Mono",
  },
  {
    id: "modern",
    label: "Modern",
    description: "Source Serif 4, DM Sans, IBM Plex Mono",
    serif: "Source Serif 4",
    sans: "DM Sans",
    mono: "IBM Plex Mono",
  },
  {
    id: "technical",
    label: "Technical",
    description: "IBM Plex Serif, Manrope, Fira Code",
    serif: "IBM Plex Serif",
    sans: "Manrope",
    mono: "Fira Code",
  },
];

export const DEFAULT_FONT_PAIRING_ID: FontPairingId = "cupertino";
