export type TextScaleId = "compact" | "comfortable" | "large";

export interface TextScaleOption {
  id: TextScaleId;
  label: string;
  description: string;
}

export const TEXT_SCALES: TextScaleOption[] = [
  {
    id: "compact",
    label: "Compact",
    description: "Denser controls for small screens.",
  },
  {
    id: "comfortable",
    label: "Comfortable",
    description: "Default reading and editing scale.",
  },
  {
    id: "large",
    label: "Large",
    description: "Larger body copy and controls.",
  },
];

export const DEFAULT_TEXT_SCALE_ID: TextScaleId = "comfortable";
