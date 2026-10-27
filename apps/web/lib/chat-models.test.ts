import { describe, expect, it } from "vitest";
import {
  DEFAULT_GROQ_MODEL_ID,
  groqModelSelections,
  LLM_PROVIDER_PRESETS,
  modelValue,
  parseModelValue,
} from "@/lib/chat-models";

describe("modelValue", () => {
  it("round-trips a provider-qualified model", () => {
    const value = modelValue("meta", "muse-spark-1.1");
    expect(value).toBe("meta::muse-spark-1.1");
    expect(parseModelValue(value)).toEqual({
      providerId: "meta",
      modelId: "muse-spark-1.1",
    });
  });

  it("leaves plain environment models unqualified", () => {
    expect(parseModelValue(DEFAULT_GROQ_MODEL_ID)).toBeNull();
    expect(parseModelValue("gpt-4o")).toBeNull();
  });

  it("rejects malformed values", () => {
    expect(parseModelValue("::muse")).toBeNull();
    expect(parseModelValue("meta::")).toBeNull();
    expect(parseModelValue("")).toBeNull();
  });
});

describe("LLM_PROVIDER_PRESETS", () => {
  it("includes the Meta AI Muse Spark endpoint", () => {
    const meta = LLM_PROVIDER_PRESETS.find(
      (preset) => preset.providerId === "meta",
    );
    expect(meta).toMatchObject({
      label: "Meta AI",
      baseUrl: "https://api.meta.ai/v1",
      models: [{ id: "muse-spark-1.1", label: "Muse Spark 1.1" }],
    });
  });

  it("uses unique provider ids", () => {
    const ids = LLM_PROVIDER_PRESETS.map((preset) => preset.providerId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes OpenCode Zen/Go, Anthropic, and Nous/Hermes presets", () => {
    const byId = new Map(
      LLM_PROVIDER_PRESETS.map((preset) => [preset.providerId, preset]),
    );
    expect(byId.get("opencode")).toMatchObject({
      baseUrl: "https://opencode.ai/inference/openai/v1",
      api: "openai-chat",
    });
    expect(byId.get("opencode-responses")).toMatchObject({
      baseUrl: "https://opencode.ai/inference/openai/v1",
      api: "openai-responses",
    });
    expect(byId.get("anthropic")).toMatchObject({
      baseUrl: "https://api.anthropic.com/v1",
      api: "anthropic",
    });
    expect(byId.get("nous")).toMatchObject({
      baseUrl: "https://inference-api.nousresearch.com/v1",
      api: "openai-chat",
    });
  });

  it("uses a supported API type for every preset", () => {
    for (const preset of LLM_PROVIDER_PRESETS) {
      expect(["openai-chat", "openai-responses", "anthropic"]).toContain(
        preset.api,
      );
    }
  });
});

describe("groqModelSelections", () => {
  it("keeps the curated Groq models selectable", () => {
    const models = groqModelSelections();
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((model) => model.providerId === "groq")).toBe(true);
    expect(models.some((model) => model.value === DEFAULT_GROQ_MODEL_ID)).toBe(
      true,
    );
  });
});
