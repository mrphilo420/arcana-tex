import { NextResponse } from "next/server";
import {
  publicLlmProviders,
  refreshLlmProviderModels,
} from "@/lib/ai/llm-providers";
import { isDevPanelRouteEnabled } from "@/lib/dev-panel-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isDevPanelRouteEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { id?: string };
    const id =
      typeof body.id === "string" && body.id.trim()
        ? body.id.trim()
        : undefined;
    const result = await refreshLlmProviderModels(id);
    return NextResponse.json({
      ...result,
      providers: await publicLlmProviders(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not refresh provider models.",
      },
      { status: 400 },
    );
  }
}
