import { NextResponse } from "next/server";
import { runSubagents, subagentRequestSchema } from "@/lib/ai/subagents";
import { resolveChatModel } from "@/lib/ai/llm-providers";
import { limitApiRequest } from "@/lib/api-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
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

  const resolvedModel = await resolveChatModel(parsed.model);
  if (!resolvedModel) {
    return NextResponse.json(
      {
        error:
          "No AI model is configured. Add an LLM provider in the developer panel or set GROQ_API_KEY / OPENAI_API_KEY / OPENAI_BASE_URL in apps/web/.env.local.",
      },
      { status: 503 },
    );
  }

  const results = await runSubagents({
    model: resolvedModel.model,
    context: parsed.context,
    tasks: parsed.tasks,
  });

  return NextResponse.json({
    model: resolvedModel.value,
    results,
    succeeded: results.filter((result) => !result.error).length,
    failed: results.filter((result) => result.error).length,
  });
}
