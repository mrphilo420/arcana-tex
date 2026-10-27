import { describe, expect, it } from "vitest";
import {
  classifyOpenCodeModel,
  DEFAULT_GROQ_MODEL_ID,
  groqModelSelections,
  LLM_PROVIDER_PRESETS,
  modelValue,
  openCodeFamilyLabel,
  openCodeModelStatus,
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
      baseUrl: "https://opencode.ai/inference",
      api: "opencode",
    });
    expect(byId.get("opencode-responses")).toBeUndefined();
    expect(byId.get("anthropic")).toMatchObject({
      baseUrl: "https://api.anthropic.com/v1",
      api: "anthropic",
    });
    expect(byId.get("nous")).toMatchObject({
      baseUrl: "https://inference-api.nousresearch.com/v1",
      api: "openai-chat",
    });
    expect(byId.get("google")).toMatchObject({
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      api: "google",
    });
    expect(byId.get("huggingface")).toMatchObject({
      baseUrl: "https://router.huggingface.co/v1",
      api: "openai-chat",
    });
  });

  it("uses a supported API type for every preset", () => {
    for (const preset of LLM_PROVIDER_PRESETS) {
      expect([
        "openai-chat",
        "openai-responses",
        "anthropic",
        "google",
        "opencode",
      ]).toContain(preset.api);
    }
  });
});

describe("classifyOpenCodeModel", () => {
  it("routes models to their documented API families", () => {
    expect(classifyOpenCodeModel("deepseek-v4.1-flash")).toBe("openai-chat");
    expect(classifyOpenCodeModel("glm-5.3")).toBe("openai-chat");
    expect(classifyOpenCodeModel("kimi-k3")).toBe("openai-chat");
    expect(classifyOpenCodeModel("qwen3.8-max")).toBe("openai-chat");
    expect(classifyOpenCodeModel("claude-sonnet-5-5")).toBe("anthropic");
    expect(classifyOpenCodeModel("qwen3.8-flash")).toBe("anthropic");
    expect(classifyOpenCodeModel("gpt-6.1-sol")).toBe("openai-responses");
    expect(classifyOpenCodeModel("grok-4.7")).toBe("openai-responses");
    expect(classifyOpenCodeModel("muse-spark-1.3")).toBe("openai-responses");
    expect(classifyOpenCodeModel("gemini-4-argon")).toBe("google");
  });

  it("skips free-tier and unsupported models", () => {
    for (const model of [
      "deepseek-v4.1-flash-free",
      "big-pickle",
      "jev-1.13",
      "test",
      "sam-3.1",
      "muse-image-1.0",
    ]) {
      expect(classifyOpenCodeModel(model)).toBeNull();
    }
  });

  it("marks free-tier models disabled with a note", () => {
    expect(openCodeModelStatus("deepseek-v4.1-flash-free")).toMatchObject({
      family: null,
      free: true,
      disabled: true,
    });
    expect(openCodeModelStatus("deepseek-v4.1-flash-free").note).toContain(
      "OpenCode client",
    );
    expect(openCodeModelStatus("jev-1.13")).toMatchObject({
      family: null,
      free: false,
      disabled: true,
    });
    expect(openCodeModelStatus("deepseek-v4.1-flash")).toMatchObject({
      family: "openai-chat",
      free: false,
      disabled: false,
    });
  });

  it("labels API families for the picker", () => {
    expect(openCodeFamilyLabel("openai-chat")).toBe("Chat Completions");
    expect(openCodeFamilyLabel("openai-responses")).toBe("Responses");
    expect(openCodeFamilyLabel("anthropic")).toBe("Anthropic messages");
    expect(openCodeFamilyLabel("google")).toBe("Gemini");
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
