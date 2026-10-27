import { describe, expect, it } from "vitest";
import { chatErrorMessage, providerErrorDetail } from "@/lib/ai/chat-errors";

describe("providerErrorDetail", () => {
  it("reads an OpenAI-style JSON error body", () => {
    expect(
      providerErrorDetail({
        responseBody:
          '{"error":{"type":"server_error","message":"Insufficient account funds"}}',
      }),
    ).toBe("Insufficient account funds");
  });

  it("reads an object response body and collapses whitespace", () => {
    expect(
      providerErrorDetail({
        responseBody: { error: { message: "  Upstream   failed " } },
      }),
    ).toBe("Upstream failed");
  });

  it("falls back to the error message", () => {
    expect(providerErrorDetail(new Error("network down"))).toBe("network down");
  });
});

describe("chatErrorMessage", () => {
  it("explains insufficient funds with the provider detail", () => {
    const message = chatErrorMessage({
      statusCode: 402,
      responseBody:
        '{"error":{"type":"server_error","message":"Insufficient account funds"}}',
    });
    expect(message).toContain("insufficient account funds");
    expect(message).toContain("Insufficient account funds");
    expect(message).toContain("choose another model");
  });

  it("explains auth, access, and rate-limit failures", () => {
    expect(chatErrorMessage({ statusCode: 401 })).toContain("API key");
    expect(chatErrorMessage({ statusCode: 403 })).toContain(
      "Free OpenCode models",
    );
    expect(chatErrorMessage({ statusCode: 429 })).toContain("rate-limiting");
  });

  it("includes the provider detail for other HTTP errors", () => {
    expect(
      chatErrorMessage({
        statusCode: 500,
        responseBody: "upstream unavailable",
      }),
    ).toBe("Provider error (500): upstream unavailable");
  });

  it("falls back to the generic message without a status", () => {
    expect(chatErrorMessage(new Error("boom"))).toContain(
      "Chat failed while contacting the model",
    );
  });
});
