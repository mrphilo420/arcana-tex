import { NextResponse } from "next/server";
import { z } from "zod";
import { runLocalCode } from "@/lib/code-runner";
import { limitApiRequest } from "@/lib/api-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const fileSchema = z.object({
  path: z.string().min(1).max(240),
  content: z.string().max(20_000),
});

const requestSchema = z.object({
  language: z.enum(["python", "r"]),
  code: z.string().min(1).max(60_000),
  timeoutMs: z.number().int().positive().max(30_000).optional(),
  files: z.array(fileSchema).max(8).optional(),
});

export async function POST(request: Request) {
  const limited = await limitApiRequest(request);
  if (limited) return limited;

  if (process.env.ENABLE_LOCAL_CODE_EXECUTION === "false") {
    return NextResponse.json(
      {
        error:
          "Local code execution is disabled. Set ENABLE_LOCAL_CODE_EXECUTION=true to enable Python and R tools.",
      },
      { status: 403 },
    );
  }

  let parsed: z.infer<typeof requestSchema>;
  try {
    parsed = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid code execution request." },
      { status: 400 },
    );
  }

  try {
    const result = await runLocalCode(parsed);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Code execution failed.",
      },
      { status: 500 },
    );
  }
}
