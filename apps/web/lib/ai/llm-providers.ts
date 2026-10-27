import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  DEFAULT_GROQ_MODEL_ID,
  groqModelSelections,
  isGroqModelId,
  modelValue,
  parseModelValue,
  type ChatModelSelection,
} from "@/lib/chat-models";

const CONFIG_PATH = join(process.cwd(), ".llm-providers.local.json");
const MAX_PROVIDERS = 20;
const MAX_MODELS = 200;
const MAX_MODEL_ID_CHARS = 200;
const MAX_LABEL_CHARS = 80;
const MAX_BASE_URL_CHARS = 500;
const MAX_API_KEY_CHARS = 500;
const MAX_HEADERS = 20;
const DISCOVERY_TIMEOUT_MS = 20_000;

export interface StoredLlmProvider {
  id: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  headers: Record<string, string>;
  models: string[];
  defaultModel: string;
  createdAt: number;
  updatedAt: number;
}

export interface PublicLlmProvider {
  id: string;
  label: string;
  baseUrl: string;
  models: string[];
  defaultModel: string;
  hasApiKey: boolean;
  apiKeyPreview: string | null;
  headerKeys: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ResolvedChatModel {
  value: string;
  providerId: string;
  providerLabel: string;
  modelId: string;
  model: LanguageModel;
  baseUrl: string;
}

interface ProviderFile {
  version: 1;
  providers: StoredLlmProvider[];
}

function normalizeBaseUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_BASE_URL_CHARS) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function normalizeHeaders(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, item]) =>
          /^[A-Za-z0-9-]+$/.test(key) &&
          typeof item === "string" &&
          item.length <= 1_000,
      )
      .slice(0, MAX_HEADERS),
  );
}

function slugify(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || fallback;
}

function normalizeModels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const models = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!id || id.length > MAX_MODEL_ID_CHARS || id.includes("::")) continue;
    models.add(id);
    if (models.size >= MAX_MODELS) break;
  }
  return [...models];
}

function maskApiKey(apiKey: string): string | null {
  if (!apiKey) return null;
  if (apiKey.length <= 4) return "••••";
  return `••••${apiKey.slice(-4)}`;
}

export async function readLlmProviders(): Promise<StoredLlmProvider[]> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as ProviderFile | StoredLlmProvider[];
    const list = Array.isArray(parsed) ? parsed : parsed.providers;
    if (!Array.isArray(list)) return [];

    return list
      .filter((provider): provider is StoredLlmProvider =>
        Boolean(
          provider &&
            typeof provider === "object" &&
            typeof provider.id === "string" &&
            typeof provider.label === "string" &&
            typeof provider.baseUrl === "string" &&
            Array.isArray(provider.models),
        ),
      )
      .slice(0, MAX_PROVIDERS)
      .map((provider) => {
        const models = normalizeModels(provider.models);
        return {
          ...provider,
          apiKey:
            typeof provider.apiKey === "string"
              ? provider.apiKey.slice(0, MAX_API_KEY_CHARS)
              : "",
          headers: normalizeHeaders(provider.headers),
          models,
          defaultModel:
            typeof provider.defaultModel === "string" &&
            models.includes(provider.defaultModel)
              ? provider.defaultModel
              : (models[0] ?? ""),
        };
      });
  } catch {
    return [];
  }
}

async function writeLlmProviders(
  providers: StoredLlmProvider[],
): Promise<void> {
  const payload: ProviderFile = { version: 1, providers };
  await writeFile(CONFIG_PATH, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: "utf-8",
    mode: 0o600,
  });
  await chmod(CONFIG_PATH, 0o600).catch(() => {});
}

export async function publicLlmProviders(): Promise<PublicLlmProvider[]> {
  const providers = await readLlmProviders();
  return providers.map((provider) => ({
    id: provider.id,
    label: provider.label,
    baseUrl: provider.baseUrl,
    models: provider.models,
    defaultModel: provider.defaultModel,
    hasApiKey: Boolean(provider.apiKey),
    apiKeyPreview: maskApiKey(provider.apiKey),
    headerKeys: Object.keys(provider.headers),
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  }));
}

export interface ProviderInput {
  id?: string;
  label?: string;
  baseUrl?: string;
  apiKey?: string;
  headers?: unknown;
  models?: unknown;
  defaultModel?: string;
}

export async function upsertLlmProvider(
  input: ProviderInput,
): Promise<
  | { success: true; provider: PublicLlmProvider }
  | { success: false; error: string }
> {
  const providers = await readLlmProviders();
  const label = (input.label ?? "").trim();
  if (!label || label.length > MAX_LABEL_CHARS) {
    return {
      success: false,
      error: `A provider label is required (max ${MAX_LABEL_CHARS} characters).`,
    };
  }

  const baseUrl = normalizeBaseUrl(input.baseUrl ?? "");
  if (!baseUrl) {
    return {
      success: false,
      error: "A valid http:// or https:// base URL is required.",
    };
  }

  const models = normalizeModels(input.models);
  if (models.length === 0) {
    return { success: false, error: "Add at least one model ID." };
  }

  const requestedId = (input.id ?? "").trim();
  const id = requestedId
    ? slugify(requestedId, requestedId)
    : slugify(label, "provider");
  if (!id) return { success: false, error: "Could not derive a provider ID." };

  const existingIndex = providers.findIndex((provider) => provider.id === id);
  const existing = existingIndex >= 0 ? providers[existingIndex] : null;
  const apiKey =
    typeof input.apiKey === "string" && input.apiKey.trim()
      ? input.apiKey.trim().slice(0, MAX_API_KEY_CHARS)
      : (existing?.apiKey ?? "");
  const headers =
    input.headers === undefined
      ? (existing?.headers ?? {})
      : normalizeHeaders(input.headers);

  const defaultModel =
    typeof input.defaultModel === "string" &&
    models.includes(input.defaultModel)
      ? input.defaultModel
      : models[0];

  const now = Date.now();
  const provider: StoredLlmProvider = {
    id,
    label,
    baseUrl,
    apiKey,
    headers,
    models,
    defaultModel,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const next =
    existingIndex >= 0
      ? providers.map((item, index) =>
          index === existingIndex ? provider : item,
        )
      : [...providers, provider].slice(0, MAX_PROVIDERS);

  await writeLlmProviders(next);
  return {
    success: true,
    provider: {
      id: provider.id,
      label: provider.label,
      baseUrl: provider.baseUrl,
      models: provider.models,
      defaultModel: provider.defaultModel,
      hasApiKey: Boolean(provider.apiKey),
      apiKeyPreview: maskApiKey(provider.apiKey),
      headerKeys: Object.keys(provider.headers),
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    },
  };
}

export async function deleteLlmProvider(
  id: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const providers = await readLlmProviders();
  if (!providers.some((provider) => provider.id === id)) {
    return { success: false, error: "Provider not found." };
  }
  await writeLlmProviders(providers.filter((provider) => provider.id !== id));
  return { success: true };
}

export async function discoverLlmModels(input: {
  providerId?: string;
  baseUrl?: string;
  apiKey?: string;
  headers?: unknown;
}): Promise<
  | {
      success: true;
      models: Array<{ id: string; label: string }>;
      note: string;
    }
  | { success: false; error: string }
> {
  const stored = input.providerId
    ? (await readLlmProviders()).find(
        (provider) => provider.id === input.providerId,
      )
    : null;
  const baseUrl = normalizeBaseUrl(input.baseUrl ?? stored?.baseUrl ?? "");
  if (!baseUrl) {
    return {
      success: false,
      error: "A valid http:// or https:// base URL is required.",
    };
  }

  const apiKey =
    typeof input.apiKey === "string" && input.apiKey.trim()
      ? input.apiKey.trim().slice(0, MAX_API_KEY_CHARS)
      : (stored?.apiKey ?? "");
  const headers: Record<string, string> = {
    accept: "application/json",
    ...(input.headers === undefined
      ? (stored?.headers ?? {})
      : normalizeHeaders(input.headers)),
  };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/models`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "request failed";
    return {
      success: false,
      error: `Could not reach ${baseUrl}/models: ${message}`,
    };
  }

  if (!response.ok) {
    return {
      success: false,
      error: `Provider returned HTTP ${response.status}. Check the base URL, API key, and that the provider exposes GET /models.`,
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      success: false,
      error: "Provider did not return JSON from /models.",
    };
  }

  const source = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { data?: unknown }).data)
      ? (payload as { data: unknown[] }).data
      : payload &&
          typeof payload === "object" &&
          Array.isArray((payload as { models?: unknown }).models)
        ? (payload as { models: unknown[] }).models
        : [];
  const models = source
    .map((item) => {
      if (typeof item === "string") return { id: item, label: item };
      if (item && typeof item === "object") {
        const record = item as { id?: unknown; name?: unknown };
        const id = typeof record.id === "string" ? record.id : "";
        const label = typeof record.name === "string" ? record.name : id;
        return id ? { id, label } : null;
      }
      return null;
    })
    .filter((item): item is { id: string; label: string } => Boolean(item))
    .slice(0, MAX_MODELS);

  return {
    success: true,
    models,
    note:
      models.length > 0
        ? `Discovered ${models.length} model${models.length === 1 ? "" : "s"}.`
        : "The endpoint responded, but it returned no recognizable models. Add model IDs manually.",
  };
}

function createProviderModel(
  provider: StoredLlmProvider,
  modelId: string,
): LanguageModel {
  const client = createOpenAI({
    apiKey: provider.apiKey || "local",
    baseURL: provider.baseUrl,
    headers: provider.headers,
  });
  return client.chat(modelId);
}

function envGroqModel(requested: unknown): ResolvedChatModel | null {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;
  const requestedId = typeof requested === "string" ? requested.trim() : "";
  if (requestedId && !isGroqModelId(requestedId)) return null;
  const modelId = requestedId
    ? requestedId
    : isGroqModelId(process.env.GROQ_MODEL?.trim())
      ? (process.env.GROQ_MODEL?.trim() as string)
      : DEFAULT_GROQ_MODEL_ID;
  return {
    value: modelId,
    providerId: "groq",
    providerLabel: "Groq",
    modelId,
    baseUrl: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
    model: createOpenAI({
      apiKey,
      baseURL: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
    }).chat(modelId),
  };
}

function envOpenAiModel(requested: unknown): ResolvedChatModel | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const baseUrl = process.env.OPENAI_BASE_URL?.trim();
  if (!apiKey && !baseUrl) return null;
  const requestedId = typeof requested === "string" ? requested.trim() : "";
  if (requestedId.includes("::")) return null;
  const modelId = requestedId || process.env.OPENAI_MODEL?.trim() || "gpt-4o";
  return {
    value: modelId,
    providerId: "openai",
    providerLabel: "OpenAI",
    modelId,
    baseUrl: baseUrl || "https://api.openai.com/v1",
    model: createOpenAI({
      apiKey: apiKey || "local",
      baseURL: baseUrl || undefined,
    }).chat(modelId),
  };
}

function resolveConfiguredModel(
  providers: StoredLlmProvider[],
  requested: unknown,
): ResolvedChatModel | null {
  if (typeof requested === "string" && requested.trim()) {
    const parsed = parseModelValue(requested.trim());
    if (parsed) {
      const provider = providers.find((item) => item.id === parsed.providerId);
      if (provider?.models.includes(parsed.modelId)) {
        return {
          value: modelValue(provider.id, parsed.modelId),
          providerId: provider.id,
          providerLabel: provider.label,
          modelId: parsed.modelId,
          baseUrl: provider.baseUrl,
          model: createProviderModel(provider, parsed.modelId),
        };
      }
    } else {
      const provider = providers.find((item) =>
        item.models.includes(requested.trim()),
      );
      if (provider) {
        return {
          value: modelValue(provider.id, requested.trim()),
          providerId: provider.id,
          providerLabel: provider.label,
          modelId: requested.trim(),
          baseUrl: provider.baseUrl,
          model: createProviderModel(provider, requested.trim()),
        };
      }
    }
  }

  if (typeof requested === "string" && requested.trim()) return null;

  const fallback = providers.find((provider) => provider.models.length > 0);
  if (!fallback) return null;
  const modelId = fallback.defaultModel || fallback.models[0];
  if (!modelId) return null;
  return {
    value: modelValue(fallback.id, modelId),
    providerId: fallback.id,
    providerLabel: fallback.label,
    modelId,
    baseUrl: fallback.baseUrl,
    model: createProviderModel(fallback, modelId),
  };
}

export async function resolveChatModel(
  requested: unknown,
): Promise<ResolvedChatModel | null> {
  const providers = await readLlmProviders();
  const configured = resolveConfiguredModel(providers, requested);
  if (configured) return configured;

  if (typeof requested === "string" && requested.trim()) {
    const groq = envGroqModel(requested);
    if (groq) return groq;
    const openai = envOpenAiModel(requested);
    if (openai) return openai;
  }

  return envGroqModel(null) ?? envOpenAiModel(null);
}

export async function getChatModelSelections(): Promise<{
  models: ChatModelSelection[];
  defaultModel: string;
}> {
  const providers = await readLlmProviders();
  const models: ChatModelSelection[] = [];

  for (const provider of providers) {
    for (const modelId of provider.models) {
      models.push({
        id: modelId,
        value: modelValue(provider.id, modelId),
        modelId,
        label: modelId,
        description: `${provider.label} · ${provider.baseUrl}`,
        tier: "balanced",
        contextWindow: "provider",
        compute: "provider",
        providerId: provider.id,
        providerLabel: provider.label,
      });
    }
  }

  const groq = envGroqModel(null);
  if (groq) {
    models.push(...groqModelSelections());
  }

  if (!groq) {
    const openai = envOpenAiModel(null);
    if (openai && !models.some((model) => model.value === openai.value)) {
      models.push({
        id: openai.modelId,
        value: openai.value,
        modelId: openai.modelId,
        label: openai.modelId,
        description: "OpenAI environment configuration",
        tier: "balanced",
        contextWindow: "provider",
        compute: "provider",
        providerId: "openai",
        providerLabel: "OpenAI",
      });
    }
  }

  const firstProvider = providers.find(
    (provider) => provider.models.length > 0,
  );
  const defaultModel = firstProvider?.defaultModel
    ? modelValue(firstProvider.id, firstProvider.defaultModel)
    : models.some((model) => model.value === DEFAULT_GROQ_MODEL_ID)
      ? DEFAULT_GROQ_MODEL_ID
      : (models[0]?.value ?? "");

  return { models, defaultModel };
}
