import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { runSubagents, subagentRequestSchema } from "@/lib/ai/subagents";
import { DEFAULT_GROQ_MODEL_ID, isGroqModelId } from "@/lib/chat-models";
import { limitApiRequest } from "@/lib/api-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

const groqApiKey = process.env.GROQ_API_KEY?.trim();
const useGroq = Boolean(groqApiKey);
const provider = createOpenAI({
  apiKey: useGroq ? groqApiKey : process.env.OPENAI_API_KEY || "local",
  baseURL: useGroq
    ? process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1"
    : process.env.OPENAI_BASE_URL || undefined,
});
const configuredModel = process.env.GROQ_MODEL?.trim();
const defaultModel = useGroq
  ? isGroqModelId(configuredModel)
    ? configuredModel
    : DEFAULT_GROQ_MODEL_ID
  : process.env.OPENAI_MODEL || "gpt-4o";

export async function POST(request: Request) {
  if (!useGroq && !process.env.OPENAI_API_KEY && !process.env.OPENAI_BASE_URL) {
    return NextResponse.json(
      {
        error:
          "No AI model is configured. Set GROQ_API_KEY (or OPENAI_API_KEY / OPENAI_BASE_URL) in apps/web/.env.local.",
      },
      { status: 503 },
    );
  }

  const limited = await limitApiRequest(request);
  if (limited) return limited;

  let parsed: ReturnType<typeof subagentRequestSchema.parse>;
  try {
    parsed = subagentRequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid subagent request." },
      { status: 400 },
    );
  }

  const selectedModel =
    useGroq && isGroqModelId(parsed.model) ? parsed.model : defaultModel;

  const results = await runSubagents({
    model: provider.chat(selectedModel),
    context: parsed.context,
    tasks: parsed.tasks,
  });

  return NextResponse.json({
    model: selectedModel,
    results,
    succeeded: results.filter((result) => !result.error).length,
    failed: results.filter((result) => result.error).length,
  });
}
