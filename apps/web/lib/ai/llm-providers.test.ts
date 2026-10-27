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
