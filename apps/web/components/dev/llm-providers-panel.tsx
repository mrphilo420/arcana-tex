"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2Icon,
  DownloadIcon,
  KeyRoundIcon,
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
  ServerIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  LLM_PROVIDER_PRESETS,
  type LlmProviderApi,
  type LlmProviderPreset,
} from "@/lib/chat-models";
import { cn } from "@/lib/utils";
import { useChatModelStore } from "@/stores/chat-model-store";

interface PublicProvider {
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
}

interface ProviderForm {
  id: string | null;
  label: string;
  baseUrl: string;
  api: LlmProviderApi;
  apiKey: string;
  headers: string;
  models: string;
  defaultModel: string;
}

const EMPTY_FORM: ProviderForm = {
  id: null,
  label: "",
  baseUrl: "",
  api: "openai-chat",
  apiKey: "",
  headers: "",
  models: "",
  defaultModel: "",
};

const API_LABELS: Record<LlmProviderApi, string> = {
  "openai-chat": "OpenAI chat",
  "openai-responses": "OpenAI responses",
  anthropic: "Anthropic messages",
  google: "Google Gemini",
  opencode: "OpenCode auto-route",
};

function formFromPreset(preset: LlmProviderPreset): ProviderForm {
  return {
    id: preset.providerId,
    label: preset.label,
    baseUrl: preset.baseUrl,
    api: preset.api,
    apiKey: "",
    headers: "",
    models: preset.models.map((model) => model.id).join("\n"),
    defaultModel: preset.models[0]?.id ?? "",
  };
}

function formFromProvider(provider: PublicProvider): ProviderForm {
  return {
    id: provider.id,
    label: provider.label,
    baseUrl: provider.baseUrl,
    api: provider.api,
    apiKey: "",
    headers: "",
    models: provider.models.join("\n"),
    defaultModel: provider.defaultModel,
  };
}

function parseModels(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\n,]/)
        .map((model) => model.trim())
        .filter(Boolean),
    ),
  ];
}

function parseHeaders(value: string): Record<string, string> | undefined {
  if (!value.trim()) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Headers must be a JSON object.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Headers must be a JSON object.");
  }
  return Object.fromEntries(
    Object.entries(parsed)
      .filter(([, item]) => typeof item === "string")
      .map(([key, item]) => [key, item as string]),
  );
}

function updatedLabel(timestamp?: number): string {
  if (!timestamp) return "never";
  const days = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function LlmProvidersPanel() {
  const [providers, setProviders] = useState<PublicProvider[]>([]);
  const [form, setForm] = useState<ProviderForm>(EMPTY_FORM);
  const [freeModels, setFreeModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const loadProviders = useCallback(async () => {
    try {
      const response = await fetch("/api/dev/llm-providers", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Could not load providers.");
      const data = (await response.json()) as { providers?: PublicProvider[] };
      setProviders(Array.isArray(data.providers) ? data.providers : []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load providers.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  const update = (patch: Partial<ProviderForm>) =>
    setForm((current) => ({ ...current, ...patch }));

  const refreshModelPicker = async () => {
    await useChatModelStore.getState().refreshOptions();
  };

  const save = async () => {
    const models = parseModels(form.models);
    if (!form.label.trim() || !form.baseUrl.trim() || models.length === 0) {
      toast.error("Add a label, base URL, and at least one model ID.");
      return;
    }

    let headers: Record<string, string> | undefined;
    try {
      headers = parseHeaders(form.headers);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid headers.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/dev/llm-providers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: {
            id: form.id ?? undefined,
            label: form.label.trim(),
            baseUrl: form.baseUrl.trim(),
            api: form.api,
            headers,
            models,
            freeModels: freeModels.filter((modelId) =>
              models.includes(modelId),
            ),
            defaultModel: form.defaultModel.trim() || models[0],
          },
          apiKey: form.apiKey.trim() || undefined,
        }),
      });
      const data = (await response.json()) as {
        providers?: PublicProvider[];
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error || "Could not save provider.");
      setProviders(Array.isArray(data.providers) ? data.providers : []);
      setForm(EMPTY_FORM);
      setFreeModels([]);
      await refreshModelPicker();
      toast.success("LLM provider saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save provider.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (provider: PublicProvider) => {
    if (
      !window.confirm(
        `Delete ${provider.label}? Its API key will be removed from this machine.`,
      )
    ) {
      return;
    }
    try {
      const response = await fetch(
        `/api/dev/llm-providers?id=${encodeURIComponent(provider.id)}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as {
        providers?: PublicProvider[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Could not delete provider.");
      }
      setProviders(Array.isArray(data.providers) ? data.providers : []);
      if (form.id === provider.id) {
        setForm(EMPTY_FORM);
        setFreeModels([]);
      }
      await refreshModelPicker();
      toast.success("Provider deleted");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete provider.",
      );
    }
  };

  const discover = async () => {
    if (!form.baseUrl.trim()) {
      toast.error("Enter the provider base URL first.");
      return;
    }
    let headers: Record<string, string> | undefined;
    try {
      headers = parseHeaders(form.headers);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid headers.");
      return;
    }

    setIsDiscovering(true);
    try {
      const response = await fetch("/api/dev/llm-providers/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerId: form.id ?? undefined,
          baseUrl: form.baseUrl.trim(),
          api: form.api,
          apiKey: form.apiKey.trim() || undefined,
          headers,
        }),
      });
      const data = (await response.json()) as {
        models?: Array<{
          id: string;
          label: string;
          free?: boolean;
          disabled?: boolean;
          note?: string;
        }>;
        note?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Could not discover models.");
      }
      const models = data.models ?? [];
      if (models.length > 0) {
        const ids = models.map((model) => model.id);
        const selectable = models.filter((model) => !model.disabled);
        const defaultModel =
          selectable.find((model) => model.id === form.defaultModel)?.id ??
          selectable[0]?.id ??
          ids[0];
        update({
          models: ids.join("\n"),
          defaultModel,
        });
        setFreeModels(
          models.filter((model) => model.free).map((model) => model.id),
        );
      }
      toast.success(data.note || `Discovered ${models.length} models`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not discover models.",
      );
    } finally {
      setIsDiscovering(false);
    }
  };

  const refresh = async (id?: string) => {
    setRefreshing(id ?? "all");
    try {
      const response = await fetch("/api/dev/llm-providers/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(id ? { id } : {}),
      });
      const data = (await response.json()) as {
        providers?: PublicProvider[];
        refreshed?: string[];
        errors?: Array<{ id: string; error: string }>;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Could not refresh models.");
      }
      setProviders(Array.isArray(data.providers) ? data.providers : []);
      await refreshModelPicker();
      const count = data.refreshed?.length ?? 0;
      if (data.errors && data.errors.length > 0) {
        toast.warning(
          `Refreshed ${count} provider${count === 1 ? "" : "s"} with ${data.errors.length} error${data.errors.length === 1 ? "" : "s"}`,
          {
            description: data.errors
              .map((error) => `${error.id}: ${error.error}`)
              .join(" ")
              .slice(0, 240),
          },
        );
      } else {
        toast.success(`Refreshed ${count} provider${count === 1 ? "" : "s"}`);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not refresh models.",
      );
    } finally {
      setRefreshing(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-sm">LLM providers</h3>
          <p className="mt-1 text-[0.75rem] text-muted-foreground leading-relaxed">
            Add any OpenAI-compatible API. Keys are written to{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[0.7rem]">
              .llm-providers.local.json
            </code>{" "}
            on this machine and are never returned to the browser. Models
            refresh automatically when stale.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 gap-1 text-[0.7rem]"
          onClick={() => void refresh()}
          disabled={refreshing !== null}
        >
          <RefreshCwIcon
            className={cn("size-3", refreshing === "all" && "animate-spin")}
          />
          Refresh all
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {LLM_PROVIDER_PRESETS.map((preset) => (
          <Button
            key={preset.providerId}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-[0.75rem]"
            onClick={() => {
              setForm(formFromPreset(preset));
              setFreeModels([]);
            }}
            title={preset.description}
          >
            <PlusIcon className="size-3" />
            {preset.label}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="flex items-center gap-2 rounded-lg border border-hairline p-3 text-[0.75rem] text-muted-foreground">
            <Loader2Icon className="size-3.5 animate-spin" />
            Loading providers...
          </div>
        ) : providers.length === 0 ? (
          <div className="rounded-lg border border-hairline border-dashed p-3 text-[0.75rem] text-muted-foreground">
            No providers configured. Choose a preset or add a custom provider.
          </div>
        ) : (
          providers.map((provider) => (
            <div
              key={provider.id}
              className="rounded-lg border border-hairline bg-card/25 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-medium text-[0.875rem]">
                    <ServerIcon className="size-3.5 text-primary" />
                    {provider.label}
                    <span className="rounded border border-hairline px-1 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
                      {provider.id}
                    </span>
                  </div>
                  <div className="mt-1 truncate font-mono text-[0.7rem] text-muted-foreground">
                    {provider.baseUrl}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[0.7rem] text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5">
                      {API_LABELS[provider.api] ?? provider.api}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5">
                      {provider.models.length} model
                      {provider.models.length === 1 ? "" : "s"}
                    </span>
                    {provider.freeModels.length > 0 && (
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700">
                        {provider.freeModels.length} free
                      </span>
                    )}
                    <span className="rounded bg-muted px-1.5 py-0.5">
                      default: {provider.defaultModel || "—"}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5">
                      updated: {updatedLabel(provider.modelsUpdatedAt)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5">
                      <KeyRoundIcon className="size-3" />
                      {provider.hasApiKey
                        ? (provider.apiKeyPreview ?? "stored")
                        : "no key"}
                    </span>
                    {provider.headerKeys.length > 0 && (
                      <span className="rounded bg-muted px-1.5 py-0.5">
                        headers: {provider.headerKeys.join(", ")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-[0.75rem]"
                    onClick={() => void refresh(provider.id)}
                    disabled={refreshing !== null}
                  >
                    <RefreshCwIcon
                      className={cn(
                        "size-3",
                        refreshing === provider.id && "animate-spin",
                      )}
                    />
                    Refresh
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[0.75rem]"
                    onClick={() => {
                      setForm(formFromProvider(provider));
                      setFreeModels(provider.freeModels ?? []);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => void remove(provider)}
                    aria-label={`Delete ${provider.label}`}
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="rounded-lg border border-hairline bg-card/25 p-3">
        <div className="flex items-center gap-1.5 font-medium text-[0.875rem]">
          <PlusIcon className="size-3.5 text-primary" />
          {form.id ? `Edit ${form.label || form.id}` : "Add provider"}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="llm-provider-label" className="text-[0.75rem]">
              Label
            </Label>
            <Input
              id="llm-provider-label"
              value={form.label}
              onChange={(event) => update({ label: event.target.value })}
              placeholder="Meta AI"
              className="h-8 text-[0.8rem]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="llm-provider-url" className="text-[0.75rem]">
              Base URL
            </Label>
            <Input
              id="llm-provider-url"
              value={form.baseUrl}
              onChange={(event) => update({ baseUrl: event.target.value })}
              placeholder="https://api.example.com/v1"
              className="h-8 font-mono text-[0.8rem]"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="llm-provider-api" className="text-[0.75rem]">
              API type
            </Label>
            <Select
              value={form.api}
              onValueChange={(value) =>
                update({ api: value as LlmProviderApi })
              }
            >
              <SelectTrigger
                id="llm-provider-api"
                className="h-8 w-full text-[0.8rem]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai-chat">
                  OpenAI chat completions
                </SelectItem>
                <SelectItem value="openai-responses">
                  OpenAI responses
                </SelectItem>
                <SelectItem value="anthropic">Anthropic messages</SelectItem>
                <SelectItem value="google">Google Gemini</SelectItem>
                <SelectItem value="opencode">OpenCode auto-route</SelectItem>
              </SelectContent>
            </Select>
            {form.api === "opencode" && (
              <p className="text-[0.7rem] text-muted-foreground">
                Use the inference root, for example{" "}
                <code className="rounded bg-muted px-1 py-0.5">
                  https://opencode.ai/inference
                </code>
                . Models are routed to /openai/v1, /anthropic/v1, or
                /google/v1beta.
              </p>
            )}
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="llm-provider-key" className="text-[0.75rem]">
              API key{" "}
              {form.id && (
                <span className="font-normal text-muted-foreground">
                  (leave blank to keep the stored key)
                </span>
              )}
            </Label>
            <Input
              id="llm-provider-key"
              type="password"
              autoComplete="off"
              value={form.apiKey}
              onChange={(event) => update({ apiKey: event.target.value })}
              placeholder="sk-... or LLM_..."
              className="h-8 font-mono text-[0.8rem]"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="llm-provider-models" className="text-[0.75rem]">
              Models (one per line or comma-separated)
            </Label>
            <Textarea
              id="llm-provider-models"
              value={form.models}
              onChange={(event) => update({ models: event.target.value })}
              placeholder={"muse-spark-1.1"}
              className="min-h-20 font-mono text-[0.8rem]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="llm-provider-default" className="text-[0.75rem]">
              Default model
            </Label>
            <Input
              id="llm-provider-default"
              value={form.defaultModel}
              onChange={(event) => update({ defaultModel: event.target.value })}
              placeholder="First model"
              className="h-8 font-mono text-[0.8rem]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="llm-provider-headers" className="text-[0.75rem]">
              Extra headers (JSON, optional)
            </Label>
            <Input
              id="llm-provider-headers"
              value={form.headers}
              onChange={(event) => update({ headers: event.target.value })}
              placeholder='{"HTTP-Referer":"https://..."}'
              className="h-8 font-mono text-[0.8rem]"
            />
          </div>
        </div>
        <p className="mt-2 text-[0.7rem] text-muted-foreground">
          Leave headers blank to keep the stored headers; enter {"{}"} to clear
          them. Discovery calls GET /models with the same base URL and key. It
          uses Bearer auth for OpenAI-compatible endpoints and x-api-key plus
          anthropic-version for Anthropic. OpenCode discovery calls /v1/models
          and marks free-tier or unsupported entries as disabled. Free models
          are sorted first in the picker.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => void discover()}
            disabled={isDiscovering}
          >
            {isDiscovering ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <DownloadIcon className="size-3.5" />
            )}
            Discover models
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => void save()}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <CheckCircle2Icon className="size-3.5" />
            )}
            Save provider
          </Button>
          {form.id && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => {
                setForm(EMPTY_FORM);
                setFreeModels([]);
              }}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div
        className={cn(
          "rounded-lg border border-[#b9822f]/20 bg-[#b9822f]/5 p-3 text-[#8a6421] text-[0.75rem] leading-relaxed",
        )}
      >
        <div className="flex items-center gap-1.5 font-medium">
          <KeyRoundIcon className="size-3.5" />
          Secret handling
        </div>
        Provider keys stay on this machine in the git-ignored local file. The
        browser sees only a masked key. Rotate any key that was pasted into chat
        or a shared log.
      </div>
    </div>
  );
}
