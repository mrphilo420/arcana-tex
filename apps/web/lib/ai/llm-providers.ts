import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { randomUUID } from "node:crypto";
import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  classifyOpenCodeModel,
  DEFAULT_GROQ_MODEL_ID,
  groqModelSelections,
  isGroqModelId,
  modelValue,
  openCodeFamilyLabel,
  openCodeModelStatus,
  parseModelValue,
  type ChatModelSelection,
  type LlmProviderApi,
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
const DEFAULT_MODEL_REFRESH_HOURS = 168;
let refreshPromise: Promise<ModelRefreshResult> | null = null;

export interface StoredLlmProvider {
  id: string;
  label: string;
  baseUrl: string;
  api: LlmProviderApi;
  apiKey: string;
  headers: Record<string, string>;
  models: string[];
  freeModels: string[];
  defaultModel: string;
  modelsUpdatedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface PublicLlmProvider {
  id: string;
  label: string;
  baseUrl: string;
  api: LlmProviderApi;
  models: string[];
  freeModels: string[];
  defaultModel: string;
  modelsUpdatedAt?: number;
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
  api: LlmProviderApi;
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

function normalizeProviderApi(
  value: unknown,
  fallback: LlmProviderApi = "openai-chat",
): LlmProviderApi {
  return value === "openai-chat" ||
    value === "openai-responses" ||
    value === "anthropic" ||
    value === "google" ||
    value === "opencode"
    ? value
    : fallback;
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
        const freeModels = normalizeModels(provider.freeModels).filter((id) =>
          models.includes(id),
        );
        return {
          ...provider,
          api: normalizeProviderApi(provider.api),
          apiKey:
            typeof provider.apiKey === "string"
              ? provider.apiKey.slice(0, MAX_API_KEY_CHARS)
              : "",
          headers: normalizeHeaders(provider.headers),
          models,
          freeModels,
          defaultModel:
            typeof provider.defaultModel === "string" &&
            models.includes(provider.defaultModel)
              ? provider.defaultModel
              : (models[0] ?? ""),
          modelsUpdatedAt:
            typeof provider.modelsUpdatedAt === "number"
              ? provider.modelsUpdatedAt
              : undefined,
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
  const temporary = `${CONFIG_PATH}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: "utf-8",
    mode: 0o600,
  });
  await chmod(temporary, 0o600).catch(() => {});
  await rename(temporary, CONFIG_PATH);
}

export async function publicLlmProviders(): Promise<PublicLlmProvider[]> {
  const providers = await readLlmProviders();
  return providers.map((provider) => ({
    id: provider.id,
    label: provider.label,
    baseUrl: provider.baseUrl,
    api: provider.api,
    models: provider.models,
    freeModels: provider.freeModels,
    defaultModel: provider.defaultModel,
    modelsUpdatedAt: provider.modelsUpdatedAt,
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
  api?: string;
  apiKey?: string;
  headers?: unknown;
  models?: unknown;
  freeModels?: unknown;
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
  const api = normalizeProviderApi(input.api, existing?.api ?? "openai-chat");
  const apiKey =
    typeof input.apiKey === "string" && input.apiKey.trim()
      ? input.apiKey.trim().slice(0, MAX_API_KEY_CHARS)
      : (existing?.apiKey ?? "");
  const headers =
    input.headers === undefined
      ? (existing?.headers ?? {})
      : normalizeHeaders(input.headers);
  const freeModels = (
    input.freeModels === undefined
      ? (existing?.freeModels ?? [])
      : normalizeModels(input.freeModels)
  ).filter((modelId) => models.includes(modelId));

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
    api,
    apiKey,
    headers,
    models,
    freeModels,
    defaultModel,
    modelsUpdatedAt: now,
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
      api: provider.api,
      models: provider.models,
      freeModels: provider.freeModels,
      defaultModel: provider.defaultModel,
      modelsUpdatedAt: provider.modelsUpdatedAt,
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

function recordIsFree(record: Record<string, unknown>): boolean {
  if (record.free === true) return true;
  if (typeof record.id === "string" && record.id.endsWith(":free")) {
    return true;
  }
  if (Array.isArray(record.providers)) {
    if (
      record.providers.some(
        (provider) =>
          provider &&
          typeof provider === "object" &&
          (provider as { is_free?: unknown }).is_free === true,
      )
    ) {
      return true;
    }
  }
  if (record.pricing && typeof record.pricing === "object") {
    const values = Object.values(
      record.pricing as Record<string, unknown>,
    ).filter(
      (value) =>
        typeof value === "number" ||
        (typeof value === "string" && value.trim() !== ""),
    );
    if (values.length > 0 && values.every((value) => Number(value) === 0)) {
      return true;
    }
  }
  return false;
}

export async function discoverLlmModels(input: {
  providerId?: string;
  baseUrl?: string;
  api?: string;
  apiKey?: string;
  headers?: unknown;
}): Promise<
  | {
      success: true;
      models: Array<{
        id: string;
        label: string;
        api?: LlmProviderApi;
        free?: boolean;
        disabled?: boolean;
        note?: string;
      }>;
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

  const api = normalizeProviderApi(input.api, stored?.api ?? "openai-chat");
  const apiKey =
    typeof input.apiKey === "string" && input.apiKey.trim()
      ? input.apiKey.trim().slice(0, MAX_API_KEY_CHARS)
      : (stored?.apiKey ?? "");
  const root = baseUrl.replace(/\/+$/, "");
  const modelsUrl =
    api === "opencode"
      ? `${root.endsWith("/v1") ? root : `${root}/v1`}/models`
      : `${root}/models`;
  const headers: Record<string, string> = {
    accept: "application/json",
    ...(input.headers === undefined
      ? (stored?.headers ?? {})
      : normalizeHeaders(input.headers)),
  };
  if (api === "anthropic") {
    if (apiKey) headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = headers["anthropic-version"] ?? "2023-06-01";
  } else if (api === "google") {
    if (apiKey) headers["x-goog-api-key"] = apiKey;
  } else if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  let response: Response;
  try {
    response = await fetch(modelsUrl, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "request failed";
    return {
      success: false,
      error: `Could not reach ${modelsUrl}: ${message}`,
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
  const parsed = source
    .map((item) => {
      if (typeof item === "string") {
        return { id: item, label: item, free: item.endsWith(":free") };
      }
      if (item && typeof item === "object") {
        const record = item as {
          id?: unknown;
          name?: unknown;
          display_name?: unknown;
          displayName?: unknown;
        };
        const rawId =
          typeof record.id === "string"
            ? record.id
            : typeof record.name === "string"
              ? record.name
              : "";
        const id = rawId.replace(/^models\//, "");
        const label =
          typeof record.display_name === "string"
            ? record.display_name
            : typeof record.displayName === "string"
              ? record.displayName
              : typeof record.name === "string"
                ? record.name.replace(/^models\//, "")
                : id;
        return id
          ? {
              id,
              label,
              free: recordIsFree(record as Record<string, unknown>),
            }
          : null;
      }
      return null;
    })
    .filter((item): item is { id: string; label: string; free: boolean } =>
      Boolean(item),
    )
    .slice(0, MAX_MODELS);

  if (api === "opencode") {
    const all = parsed.map((model) => {
      const status = openCodeModelStatus(model.id);
      return {
        ...model,
        api: status.family ?? undefined,
        free: status.free,
        disabled: status.disabled,
        note: status.note,
      };
    });
    const selectable = all.filter((model) => !model.disabled);
    const freeCount = all.filter((model) => model.free).length;
    const counts = selectable.reduce<Record<string, number>>((acc, model) => {
      if (!model.api) return acc;
      acc[model.api] = (acc[model.api] ?? 0) + 1;
      return acc;
    }, {});
    const summary = Object.entries(counts)
      .map(
        ([family, count]) =>
          `${count} ${openCodeFamilyLabel(family as LlmProviderApi)}`,
      )
      .join(", ");
    const disabledCount = all.length - selectable.length;

    return {
      success: true,
      models: all,
      note:
        selectable.length > 0
          ? `Imported ${selectable.length} selectable model${
              selectable.length === 1 ? "" : "s"
            }${summary ? ` (${summary})` : ""}.${
              freeCount > 0
                ? ` ${freeCount} free-tier model${
                    freeCount === 1 ? " is" : "s are"
                  } listed as disabled because they only work inside OpenCode.`
                : ""
            }${
              disabledCount > 0
                ? ` ${disabledCount} total entries are disabled.`
                : ""
            }`
          : "The endpoint returned no selectable chat models. Add model IDs manually.",
    };
  }

  const freeCount = parsed.filter((model) => model.free).length;
  return {
    success: true,
    models: parsed,
    note:
      parsed.length > 0
        ? `Discovered ${parsed.length} model${
            parsed.length === 1 ? "" : "s"
          }${freeCount > 0 ? ` (${freeCount} free)` : ""}.`
        : "The endpoint responded, but it returned no recognizable models. Add model IDs manually.",
  };
}

export interface ModelRefreshResult {
  refreshed: string[];
  errors: Array<{ id: string; error: string }>;
}

function modelRefreshHours(): number {
  const parsed = Number.parseFloat(process.env.LLM_MODEL_REFRESH_HOURS ?? "");
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_MODEL_REFRESH_HOURS;
}

async function refreshProviderBatch(
  targets: StoredLlmProvider[],
  providers: StoredLlmProvider[],
): Promise<ModelRefreshResult> {
  const updates = new Map<
    string,
    {
      models: string[];
      freeModels: string[];
      defaultModel: string;
      modelsUpdatedAt: number;
    }
  >();
  const errors: Array<{ id: string; error: string }> = [];

  for (const provider of targets) {
    const result = await discoverLlmModels({
      providerId: provider.id,
      baseUrl: provider.baseUrl,
      api: provider.api,
      apiKey: provider.apiKey,
      headers: provider.headers,
    });
    if (!result.success) {
      errors.push({ id: provider.id, error: result.error });
      continue;
    }
    const discovered = result.models;
    const discoveredIds = new Set(discovered.map((model) => model.id));
    const models =
      provider.api === "opencode" || provider.models.length === 0
        ? discovered.map((model) => model.id).slice(0, MAX_MODELS)
        : provider.models.filter((modelId) => discoveredIds.has(modelId));
    if (models.length === 0) {
      errors.push({
        id: provider.id,
        error: "No existing models were found in the provider catalog.",
      });
      continue;
    }
    const freeIds = new Set(
      discovered.filter((model) => model.free).map((model) => model.id),
    );
    const freeModels = models.filter((modelId) => freeIds.has(modelId));
    const defaultModel =
      models.includes(provider.defaultModel) &&
      (provider.api !== "opencode" ||
        classifyOpenCodeModel(provider.defaultModel))
        ? provider.defaultModel
        : provider.api === "opencode"
          ? (models.find((id) => classifyOpenCodeModel(id)) ?? models[0])
          : models[0];
    updates.set(provider.id, {
      models,
      freeModels,
      defaultModel,
      modelsUpdatedAt: Date.now(),
    });
  }

  if (updates.size > 0) {
    await writeLlmProviders(
      providers.map((provider) =>
        updates.has(provider.id)
          ? { ...provider, ...updates.get(provider.id) }
          : provider,
      ),
    );
  }

  return { refreshed: [...updates.keys()], errors };
}

function runRefresh(
  task: () => Promise<ModelRefreshResult>,
): Promise<ModelRefreshResult> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = task().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export async function refreshLlmProviderModels(
  providerId?: string,
): Promise<ModelRefreshResult> {
  return runRefresh(async () => {
    const providers = await readLlmProviders();
    const targets = providerId
      ? providers.filter((provider) => provider.id === providerId)
      : providers;
    if (targets.length === 0) {
      return {
        refreshed: [],
        errors: providerId
          ? [{ id: providerId, error: "Provider not found." }]
          : [],
      };
    }
    return refreshProviderBatch(targets, providers);
  });
}

export async function refreshStaleLlmProviders(): Promise<ModelRefreshResult> {
  return runRefresh(async () => {
    const providers = await readLlmProviders();
    const ttl = modelRefreshHours() * 60 * 60 * 1000;
    const now = Date.now();
    const stale = providers.filter(
      (provider) =>
        !provider.modelsUpdatedAt || now - provider.modelsUpdatedAt > ttl,
    );
    if (stale.length === 0) return { refreshed: [], errors: [] };
    return refreshProviderBatch(stale, providers);
  });
}

function openCodeRoot(baseUrl: string): string {
  const root = baseUrl.replace(/\/+$/, "");
  return root.endsWith("/v1") ? root.slice(0, -3) : root;
}

function createOpenCodeModel(
  provider: StoredLlmProvider,
  modelId: string,
  family: LlmProviderApi,
): LanguageModel {
  const root = openCodeRoot(provider.baseUrl);
  const apiKey = provider.apiKey || "local";
  const headers = provider.headers;

  if (family === "anthropic") {
    return createAnthropic({
      apiKey,
      baseURL: `${root}/anthropic/v1`,
      headers,
    }).messages(modelId);
  }

  if (family === "google") {
    return createGoogleGenerativeAI({
      apiKey,
      baseURL: `${root}/google/v1beta`,
      headers: {
        ...headers,
        Authorization: `Bearer ${apiKey}`,
      },
    }).chat(modelId);
  }

  const client = createOpenAI({
    apiKey,
    baseURL: `${root}/openai/v1`,
    headers,
  });
  return family === "openai-responses"
    ? client.responses(modelId)
    : client.chat(modelId);
}

function createProviderModel(
  provider: StoredLlmProvider,
  modelId: string,
): LanguageModel {
  if (provider.api === "opencode") {
    const family = classifyOpenCodeModel(modelId);
    if (!family) {
      throw new Error(
        `OpenCode model ${modelId} is free-tier or uses an unsupported API family.`,
      );
    }
    return createOpenCodeModel(provider, modelId, family);
  }

  if (provider.api === "anthropic") {
    return createAnthropic({
      apiKey: provider.apiKey || "local",
      baseURL: provider.baseUrl,
      headers: provider.headers,
    }).messages(modelId);
  }

  if (provider.api === "google") {
    return createGoogleGenerativeAI({
      apiKey: provider.apiKey || "local",
      baseURL: provider.baseUrl,
      headers: provider.headers,
    }).chat(modelId);
  }

  const client = createOpenAI({
    apiKey: provider.apiKey || "local",
    baseURL: provider.baseUrl,
    headers: provider.headers,
  });
  return provider.api === "openai-responses"
    ? client.responses(modelId)
    : client.chat(modelId);
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
    api: "openai-chat",
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
    api: "openai-chat",
    baseUrl: baseUrl || "https://api.openai.com/v1",
    model: createOpenAI({
      apiKey: apiKey || "local",
      baseURL: baseUrl || undefined,
    }).chat(modelId),
  };
}

function envHuggingFaceModel(requested: unknown): ResolvedChatModel | null {
  const apiKey =
    process.env.HUGGINGFACE_API_KEY?.trim() ||
    process.env.HF_TOKEN?.trim() ||
    "";
  if (!apiKey) return null;
  const requestedId = typeof requested === "string" ? requested.trim() : "";
  if (requestedId.includes("::")) return null;
  const modelId =
    requestedId ||
    process.env.HUGGINGFACE_MODEL?.trim() ||
    "meta-llama/Llama-3.3-70B-Instruct";
  const baseUrl =
    process.env.HUGGINGFACE_BASE_URL?.trim() ||
    "https://router.huggingface.co/v1";
  return {
    value: modelValue("huggingface", modelId),
    providerId: "huggingface",
    providerLabel: "Hugging Face",
    modelId,
    api: "openai-chat",
    baseUrl,
    model: createOpenAI({
      apiKey,
      baseURL: baseUrl,
    }).chat(modelId),
  };
}

function providerSupportsModel(
  provider: StoredLlmProvider,
  modelId: string,
): boolean {
  if (!provider.models.includes(modelId)) return false;
  if (provider.api === "opencode") {
    return classifyOpenCodeModel(modelId) !== null;
  }
  return true;
}

function resolveConfiguredModel(
  providers: StoredLlmProvider[],
  requested: unknown,
): ResolvedChatModel | null {
  if (typeof requested === "string" && requested.trim()) {
    const parsed = parseModelValue(requested.trim());
    if (parsed) {
      const provider = providers.find((item) => item.id === parsed.providerId);
      if (provider && providerSupportsModel(provider, parsed.modelId)) {
        return {
          value: modelValue(provider.id, parsed.modelId),
          providerId: provider.id,
          providerLabel: provider.label,
          modelId: parsed.modelId,
          api: provider.api,
          baseUrl: provider.baseUrl,
          model: createProviderModel(provider, parsed.modelId),
        };
      }
    } else {
      const provider = providers.find((item) =>
        providerSupportsModel(item, requested.trim()),
      );
      if (provider) {
        return {
          value: modelValue(provider.id, requested.trim()),
          providerId: provider.id,
          providerLabel: provider.label,
          modelId: requested.trim(),
          api: provider.api,
          baseUrl: provider.baseUrl,
          model: createProviderModel(provider, requested.trim()),
        };
      }
    }
  }

  if (typeof requested === "string" && requested.trim()) return null;

  const fallback = providers.find((provider) =>
    provider.models.some((modelId) => providerSupportsModel(provider, modelId)),
  );
  if (!fallback) return null;
  const modelId = providerSupportsModel(fallback, fallback.defaultModel)
    ? fallback.defaultModel
    : (fallback.models.find((modelId) =>
        providerSupportsModel(fallback, modelId),
      ) ?? "");
  if (!modelId) return null;
  return {
    value: modelValue(fallback.id, modelId),
    providerId: fallback.id,
    providerLabel: fallback.label,
    modelId,
    api: fallback.api,
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

  const normalized = typeof requested === "string" ? requested.trim() : "";
  if (normalized) {
    const parsed = parseModelValue(normalized);
    if (parsed?.providerId === "huggingface") {
      const huggingFace = envHuggingFaceModel(parsed.modelId);
      if (huggingFace) return huggingFace;
    }
    const groq = envGroqModel(normalized);
    if (groq) return groq;
    const openai = envOpenAiModel(normalized);
    if (openai) return openai;
    const huggingFace = envHuggingFaceModel(normalized);
    if (huggingFace) return huggingFace;
    return null;
  }

  return (
    envGroqModel(null) ?? envOpenAiModel(null) ?? envHuggingFaceModel(null)
  );
}

export async function getChatModelSelections(): Promise<{
  models: ChatModelSelection[];
  defaultModel: string;
}> {
  void refreshStaleLlmProviders().catch((error) => {
    console.error("Model refresh failed", error);
  });
  const providers = await readLlmProviders();
  const models: ChatModelSelection[] = [];

  for (const provider of providers) {
    for (const modelId of provider.models) {
      if (provider.api === "opencode") {
        const status = openCodeModelStatus(modelId);
        models.push({
          id: modelId,
          value: modelValue(provider.id, modelId),
          modelId,
          label: modelId,
          description: status.family
            ? `${provider.label} · ${openCodeFamilyLabel(status.family)}`
            : `${provider.label} · Unavailable`,
          tier: "balanced",
          contextWindow: "provider",
          compute: "provider",
          providerId: provider.id,
          providerLabel: provider.label,
          free: status.free || provider.freeModels.includes(modelId),
          disabled: status.disabled,
          note: status.note,
        });
        continue;
      }

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
        free: provider.freeModels.includes(modelId),
      });
    }
  }

  const configuredProviderIds = new Set(
    providers.map((provider) => provider.id),
  );
  const groq = configuredProviderIds.has("groq") ? null : envGroqModel(null);
  if (groq) {
    models.push(...groqModelSelections());
  }

  if (!groq && !configuredProviderIds.has("openai")) {
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

  if (!configuredProviderIds.has("huggingface")) {
    const huggingFace = envHuggingFaceModel(null);
    if (
      huggingFace &&
      !models.some((model) => model.value === huggingFace.value)
    ) {
      models.push({
        id: huggingFace.modelId,
        value: huggingFace.value,
        modelId: huggingFace.modelId,
        label: huggingFace.modelId,
        description: "Hugging Face environment configuration",
        tier: "balanced",
        contextWindow: "provider",
        compute: "provider",
        providerId: "huggingface",
        providerLabel: "Hugging Face",
      });
    }
  }

  const firstProvider = providers.find((provider) =>
    provider.models.some((modelId) => providerSupportsModel(provider, modelId)),
  );
  const defaultModel = firstProvider
    ? providerSupportsModel(firstProvider, firstProvider.defaultModel)
      ? modelValue(firstProvider.id, firstProvider.defaultModel)
      : (models.find((model) => model.providerId === firstProvider.id)?.value ??
        "")
    : models.some((model) => model.value === DEFAULT_GROQ_MODEL_ID)
      ? DEFAULT_GROQ_MODEL_ID
      : (models.find((model) => !model.disabled)?.value ?? "");

  return { models, defaultModel };
}
