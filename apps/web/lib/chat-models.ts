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

export type LlmProviderApi =
  | "openai-chat"
  | "openai-responses"
  | "anthropic"
  | "google"
  | "opencode";

export interface LlmProviderPreset {
  providerId: string;
  label: string;
  baseUrl: string;
  api: LlmProviderApi;
  description: string;
  models: Array<{ id: string; label: string }>;
}

export const LLM_PROVIDER_PRESETS: LlmProviderPreset[] = [
  {
    providerId: "meta",
    label: "Meta AI",
    baseUrl: "https://api.meta.ai/v1",
    api: "openai-chat",
    description: "Meta AI Muse Spark through its OpenAI-compatible endpoint.",
    models: [{ id: "muse-spark-1.1", label: "Muse Spark 1.1" }],
  },
  {
    providerId: "opencode",
    label: "OpenCode Zen / Go",
    baseUrl: "https://opencode.ai/inference",
    api: "opencode",
    description:
      "OpenCode Zen/Go multi-API gateway. Discovery imports paid/Go models and routes each model to Chat Completions, Responses, Anthropic, or Gemini automatically.",
    models: [
      { id: "deepseek-v4.1-flash", label: "DeepSeek V4.1 Flash" },
      { id: "kimi-k3", label: "Kimi K3" },
      { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
      { id: "gpt-6.1-sol", label: "GPT 6.1 Sol" },
      { id: "gemini-4-argon", label: "Gemini 4 Argon" },
    ],
  },
  {
    providerId: "anthropic",
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    api: "anthropic",
    description: "Anthropic Claude through the native Messages API.",
    models: [
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    ],
  },
  {
    providerId: "nous",
    label: "Nous Portal / Hermes",
    baseUrl: "https://inference-api.nousresearch.com/v1",
    api: "openai-chat",
    description:
      "Nous Portal and Hermes models, including Claude, GPT, DeepSeek, and Hermes 4.",
    models: [
      { id: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
      { id: "openai/gpt-5.5-pro", label: "GPT-5.5 Pro" },
      { id: "deepseek/deepseek-v4-pro", label: "DeepSeek V4 Pro" },
      { id: "nousresearch/hermes-4-70b", label: "Hermes 4 70B" },
      { id: "nousresearch/hermes-4-405b", label: "Hermes 4 405B" },
    ],
  },
  {
    providerId: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    api: "openai-chat",
    description: "OpenAI GPT models.",
    models: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-5.2", label: "GPT-5.2" },
      { id: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
    ],
  },
  {
    providerId: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    api: "openai-chat",
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
    api: "openai-chat",
    description: "OpenRouter's multi-provider gateway.",
    models: [],
  },
  {
    providerId: "huggingface",
    label: "Hugging Face",
    baseUrl: "https://router.huggingface.co/v1",
    api: "openai-chat",
    description:
      "Hugging Face Inference Providers through the OpenAI-compatible router.",
    models: [
      {
        id: "meta-llama/Llama-3.3-70B-Instruct",
        label: "Llama 3.3 70B Instruct",
      },
      { id: "Qwen/Qwen2.5-72B-Instruct", label: "Qwen2.5 72B Instruct" },
      { id: "deepseek-ai/DeepSeek-V3-0324", label: "DeepSeek V3" },
    ],
  },
  {
    providerId: "google",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    api: "google",
    description: "Gemini through the native Google Generative AI API.",
    models: [
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
      { id: "gemini-3.1-pro", label: "Gemini 3.1 Pro" },
    ],
  },
  {
    providerId: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    api: "openai-chat",
    description: "DeepSeek's OpenAI-compatible API.",
    models: [
      { id: "deepseek-chat", label: "DeepSeek Chat" },
      { id: "deepseek-reasoner", label: "DeepSeek Reasoner" },
    ],
  },
  {
    providerId: "xai",
    label: "xAI",
    baseUrl: "https://api.x.ai/v1",
    api: "openai-chat",
    description: "xAI Grok models.",
    models: [
      { id: "grok-4.5", label: "Grok 4.5" },
      { id: "grok-4.6", label: "Grok 4.6" },
    ],
  },
  {
    providerId: "ollama",
    label: "Ollama",
    baseUrl: "http://localhost:11434/v1",
    api: "openai-chat",
    description: "A local Ollama server; no API key is required.",
    models: [],
  },
];

const OPENCODE_FAMILY_LABELS: Record<string, string> = {
  "openai-chat": "Chat Completions",
  "openai-responses": "Responses",
  anthropic: "Anthropic messages",
  google: "Gemini",
};

/**
 * OpenCode serves each model from one API family. These rules mirror the
 * official endpoint table; free-tier, Jev, and non-chat models return null
 * because they are not usable from an external client.
 */
export function classifyOpenCodeModel(modelId: string): LlmProviderApi | null {
  const id = modelId.trim().toLowerCase();
  if (
    !id ||
    id === "test" ||
    id === "big-pickle" ||
    id.startsWith("jev-") ||
    id.startsWith("sam-") ||
    id.endsWith("-free") ||
    /(?:image|voice|transcribe|embed|tts|audio|vision)/.test(id)
  ) {
    return null;
  }
  if (id.startsWith("claude-")) return "anthropic";
  if (
    id === "qwen3.8-flash" ||
    id === "qwen3.6-plus" ||
    id === "qwen3.5-plus"
  ) {
    return "anthropic";
  }
  if (id.startsWith("gemini-")) return "google";
  if (
    id.startsWith("gpt-") ||
    id.startsWith("grok-") ||
    id.startsWith("muse-")
  ) {
    return "openai-responses";
  }
  return "openai-chat";
}

export function openCodeFamilyLabel(api: LlmProviderApi): string {
  return OPENCODE_FAMILY_LABELS[api] ?? api;
}

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
