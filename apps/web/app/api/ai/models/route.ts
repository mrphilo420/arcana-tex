import { NextResponse } from "next/server";
import { getChatModelSelections } from "@/lib/ai/llm-providers";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getChatModelSelections();
  return NextResponse.json(result);
}
