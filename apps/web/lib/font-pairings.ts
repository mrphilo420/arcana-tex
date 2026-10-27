export type FontPairingId = "editorial" | "modern" | "technical";

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
    id: "editorial",
    label: "Editorial",
    description: "Cormorant Garamond, Inter, JetBrains Mono",
    serif: "Cormorant Garamond",
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

export const DEFAULT_FONT_PAIRING_ID: FontPairingId = "editorial";
