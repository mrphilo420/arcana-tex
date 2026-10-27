import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverLlmModels } from "@/lib/ai/llm-providers";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("discoverLlmModels", () => {
  it("uses Anthropic headers and parses display names", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        data: [{ id: "claude-sonnet-4-6", display_name: "Claude Sonnet 4.6" }],
      }),
    );

    const result = await discoverLlmModels({
      baseUrl: "https://api.anthropic.com/v1",
      api: "anthropic",
      apiKey: "sk-ant-test",
    });

    expect(result).toMatchObject({
      success: true,
      models: [{ id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" }],
    });
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers((init as RequestInit | undefined)?.headers);
    expect(headers.get("x-api-key")).toBe("sk-ant-test");
    expect(headers.get("anthropic-version")).toBe("2023-06-01");
    expect(headers.get("authorization")).toBeNull();
  });

  it("uses Bearer auth for OpenAI-compatible endpoints", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse({ data: [{ id: "deepseek-v4.1-flash" }] }),
      );

    const result = await discoverLlmModels({
      baseUrl: "https://opencode.ai/inference/openai/v1",
      api: "openai-chat",
      apiKey: "opencode-test",
    });

    expect(result).toMatchObject({
      success: true,
      models: [{ id: "deepseek-v4.1-flash", label: "deepseek-v4.1-flash" }],
    });
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers((init as RequestInit | undefined)?.headers);
    expect(headers.get("authorization")).toBe("Bearer opencode-test");
    expect(headers.get("x-api-key")).toBeNull();
  });

  it("imports paid OpenCode models and routes them by API family", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        data: [
          { id: "deepseek-v4.1-flash" },
          { id: "claude-sonnet-5-5" },
          { id: "gpt-6.1-sol" },
          { id: "gemini-4-argon" },
          { id: "deepseek-v4.1-flash-free" },
          { id: "big-pickle" },
          { id: "jev-1.13" },
        ],
      }),
    );

    const result = await discoverLlmModels({
      baseUrl: "https://opencode.ai/inference",
      api: "opencode",
      apiKey: "oc-test",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.models).toHaveLength(7);
      expect(result.models.slice(0, 4)).toMatchObject([
        {
          id: "deepseek-v4.1-flash",
          label: "deepseek-v4.1-flash",
          api: "openai-chat",
          free: false,
          disabled: false,
        },
        {
          id: "claude-sonnet-5-5",
          label: "claude-sonnet-5-5",
          api: "anthropic",
          free: false,
          disabled: false,
        },
        {
          id: "gpt-6.1-sol",
          label: "gpt-6.1-sol",
          api: "openai-responses",
          free: false,
          disabled: false,
        },
        {
          id: "gemini-4-argon",
          label: "gemini-4-argon",
          api: "google",
          free: false,
          disabled: false,
        },
      ]);
      expect(result.models[4]).toMatchObject({
        id: "deepseek-v4.1-flash-free",
        free: true,
        disabled: true,
      });
      expect(result.models[4]?.note).toContain("OpenCode client");
      expect(result.models[5]).toMatchObject({
        id: "big-pickle",
        free: true,
        disabled: true,
      });
      expect(result.models[6]).toMatchObject({
        id: "jev-1.13",
        free: false,
        disabled: true,
      });
      expect(result.note).toContain("2 free-tier models");
      expect(result.note).toContain("3 total entries are disabled");
    }

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://opencode.ai/inference/v1/models");
    const headers = new Headers((init as RequestInit | undefined)?.headers);
    expect(headers.get("authorization")).toBe("Bearer oc-test");
  });

  it("marks free models from provider pricing metadata", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        data: [
          { id: "free-hf", providers: [{ is_free: true }] },
          {
            id: "paid-hf",
            providers: [{ is_free: false, pricing: { input: 1, output: 2 } }],
          },
          { id: "free-or", pricing: { prompt: "0", completion: "0" } },
          { id: "paid-or", pricing: { prompt: "0.1", completion: "0" } },
        ],
      }),
    );

    const result = await discoverLlmModels({
      baseUrl: "https://example.test/v1",
      api: "openai-chat",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(
        result.models.map((model) => ({ id: model.id, free: model.free })),
      ).toEqual([
        { id: "free-hf", free: true },
        { id: "paid-hf", free: false },
        { id: "free-or", free: true },
        { id: "paid-or", free: false },
      ]);
      expect(result.note).toContain("2 free");
    }
  });

  it("uses Google headers and parses model names", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        models: [
          { name: "models/gemini-3.5-flash", displayName: "Gemini 3.5 Flash" },
        ],
      }),
    );

    const result = await discoverLlmModels({
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      api: "google",
      apiKey: "google-test",
    });

    expect(result).toMatchObject({
      success: true,
      models: [{ id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" }],
    });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models",
    );
    const headers = new Headers((init as RequestInit | undefined)?.headers);
    expect(headers.get("x-goog-api-key")).toBe("google-test");
    expect(headers.get("authorization")).toBeNull();
  });

  it("reports a provider HTTP error without echoing the key", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("unauthorized", { status: 401 }),
    );

    const result = await discoverLlmModels({
      baseUrl: "https://example.test/v1",
      api: "openai-chat",
      apiKey: "sk-secret-value",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("HTTP 401");
      expect(result.error).not.toContain("sk-secret-value");
    }
  });
});
