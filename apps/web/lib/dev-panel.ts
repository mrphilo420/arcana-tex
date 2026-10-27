export type DevFeatureFlag =
  | "leanLake"
  | "paperReview"
  | "leanAudit"
  | "markdownPreview";

export type DevFeatureFlags = Record<DevFeatureFlag, boolean>;

export interface DevFeatureMeta {
  key: DevFeatureFlag;
  label: string;
  description: string;
}

export const DEV_FEATURE_FLAGS: DevFeatureMeta[] = [
  {
    key: "leanLake",
    label: "Lean Lake bridge",
    description: "Show the Lean workspace control and allow local Lake builds.",
  },
  {
    key: "paperReview",
    label: "Paper review action",
    description: "Show the /paper-review quick action in the chat composer.",
  },
  {
    key: "leanAudit",
    label: "Lean audit action",
    description: "Show the Lean audit quick action in the chat composer.",
  },
  {
    key: "markdownPreview",
    label: "Markdown preview",
    description: "Show the Preview toggle for Markdown files in the editor.",
  },
];

export const DEFAULT_DEV_FEATURE_FLAGS: DevFeatureFlags = {
  leanLake: true,
  paperReview: true,
  leanAudit: true,
  markdownPreview: true,
};

export const DEV_FLAGS_STORAGE_KEY = "open-prism:dev-feature-flags";

export const DEV_PANEL_ENABLED =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_DEV_PANEL === "1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function normalizeDevFeatureFlags(value: unknown): DevFeatureFlags {
  const source = isRecord(value) && isRecord(value.flags) ? value.flags : value;
  const result = { ...DEFAULT_DEV_FEATURE_FLAGS };
  if (!isRecord(source)) return result;

  for (const feature of DEV_FEATURE_FLAGS) {
    const value = source[feature.key];
    if (typeof value === "boolean") {
      result[feature.key] = value;
    }
  }
  return result;
}

export function readStoredDevFeatureFlags(): DevFeatureFlags {
  if (typeof window === "undefined") return DEFAULT_DEV_FEATURE_FLAGS;
  try {
    const raw = window.localStorage.getItem(DEV_FLAGS_STORAGE_KEY);
    return raw
      ? normalizeDevFeatureFlags(JSON.parse(raw))
      : DEFAULT_DEV_FEATURE_FLAGS;
  } catch {
    return DEFAULT_DEV_FEATURE_FLAGS;
  }
}

export function writeStoredDevFeatureFlags(flags: DevFeatureFlags): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEV_FLAGS_STORAGE_KEY, JSON.stringify(flags));
  } catch {
    // Local storage can be unavailable in locked-down browsers.
  }
}
