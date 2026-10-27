export interface ChatModelOption {
  id: string;
  label: string;
  description: string;
  tier: "fast" | "balanced" | "deep";
  contextWindow: string;
  compute: string;
}

/**
 * Curated Groq models. Keep this list server-validated so a browser cannot
 * route requests to arbitrary model ids or providers.
 */
export const GROQ_CHAT_MODELS = [
  {
    id: "openai/gpt-oss-120b",
    label: "GPT-OSS 120B",
    description: "Deepest reasoning for reviews, proofs, and long manuscripts.",
    tier: "deep",
    contextWindow: "131k",
    compute: "Highest compute",
  },
  {
    id: "qwen/qwen3.8-27b",
    label: "Qwen 3.8 27B",
    description: "Balanced model for everyday editing and analytical work.",
    tier: "balanced",
    contextWindow: "131k",
    compute: "Moderate compute",
  },
  {
    id: "openai/gpt-oss-20b",
    label: "GPT-OSS 20B",
    description: "Fast, economical model for drafting and quick questions.",
    tier: "fast",
    contextWindow: "131k",
    compute: "Lowest compute",
  },
] as const satisfies readonly ChatModelOption[];

export type ChatModelId = (typeof GROQ_CHAT_MODELS)[number]["id"];
export const DEFAULT_GROQ_MODEL_ID: ChatModelId = "qwen/qwen3.8-27b";

export function isGroqModelId(value: unknown): value is ChatModelId {
  return (
    typeof value === "string" &&
    GROQ_CHAT_MODELS.some((model) => model.id === value)
  );
}

export function getGroqModel(id: string): ChatModelOption {
  return (
    GROQ_CHAT_MODELS.find((model) => model.id === id) ??
    GROQ_CHAT_MODELS.find((model) => model.id === DEFAULT_GROQ_MODEL_ID) ??
    GROQ_CHAT_MODELS[0]
  );
}

/**
 * A provider-qualified model option used by the picker. The `value` is what
 * the browser sends to the server: either a plain Groq/env model id or
 * `providerId::modelId` for a model configured in the local provider registry.
 */
export interface ChatModelSelection extends ChatModelOption {
  value: string;
  modelId: string;
  providerId: string;
  providerLabel: string;
}

export interface LlmProviderPreset {
  providerId: string;
  label: string;
  baseUrl: string;
  description: string;
  models: Array<{ id: string; label: string }>;
}

export const LLM_PROVIDER_PRESETS: LlmProviderPreset[] = [
  {
    providerId: "meta",
    label: "Meta AI",
    baseUrl: "https://api.meta.ai/v1",
    description: "Meta AI Muse Spark through its OpenAI-compatible endpoint.",
    models: [{ id: "muse-spark-1.1", label: "Muse Spark 1.1" }],
  },
  {
    providerId: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    description: "OpenAI GPT models.",
    models: [{ id: "gpt-4o", label: "GPT-4o" }],
  },
  {
    providerId: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    description: "Groq-hosted open models.",
    models: GROQ_CHAT_MODELS.map((model) => ({
      id: model.id,
      label: model.label,
    })),
  },
  {
    providerId: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    description: "OpenRouter's multi-provider gateway.",
    models: [],
  },
  {
    providerId: "ollama",
    label: "Ollama",
    baseUrl: "http://localhost:11434/v1",
    description: "A local Ollama server; no API key is required.",
    models: [],
  },
];

const MODEL_SEPARATOR = "::";

export function modelValue(providerId: string, modelId: string): string {
  return `${providerId}${MODEL_SEPARATOR}${modelId}`;
}

export function parseModelValue(
  value: string,
): { providerId: string; modelId: string } | null {
  const index = value.indexOf(MODEL_SEPARATOR);
  if (index <= 0 || index >= value.length - MODEL_SEPARATOR.length) return null;
  return {
    providerId: value.slice(0, index),
    modelId: value.slice(index + MODEL_SEPARATOR.length),
  };
}

export function groqModelSelections(): ChatModelSelection[] {
  return GROQ_CHAT_MODELS.map((model) => ({
    ...model,
    value: model.id,
    modelId: model.id,
    providerId: "groq",
    providerLabel: "Groq",
  }));
}
