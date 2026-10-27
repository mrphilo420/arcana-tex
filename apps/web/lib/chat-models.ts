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
