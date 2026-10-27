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

export type LlmProviderApi = "openai-chat" | "openai-responses" | "anthropic";

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
    baseUrl: "https://opencode.ai/inference/openai/v1",
    api: "openai-chat",
    description:
      "OpenCode Zen and Go chat-completion models, including DeepSeek, Qwen, GLM, Kimi, and MiniMax.",
    models: [
      { id: "deepseek-v4.1-flash", label: "DeepSeek V4.1 Flash" },
      { id: "qwen3.8-max", label: "Qwen3.8 Max" },
      { id: "glm-5.3", label: "GLM 5.3" },
      { id: "kimi-k2.6", label: "Kimi K2.6" },
      { id: "minimax-m3", label: "MiniMax M3" },
    ],
  },
  {
    providerId: "opencode-responses",
    label: "OpenCode Responses",
    baseUrl: "https://opencode.ai/inference/openai/v1",
    api: "openai-responses",
    description:
      "OpenCode Zen models that use the OpenAI Responses API, such as GPT, Grok, and Muse Spark.",
    models: [
      { id: "gpt-6.1-sol", label: "GPT 6.1 Sol" },
      { id: "muse-spark-1.2", label: "Muse Spark 1.2" },
      { id: "grok-4.7", label: "Grok 4.7" },
      { id: "gpt-5.6-luna", label: "GPT 5.6 Luna" },
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
    providerId: "google",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    api: "openai-chat",
    description: "Gemini through Google's OpenAI-compatible endpoint.",
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
