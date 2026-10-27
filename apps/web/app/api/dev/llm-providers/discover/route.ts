import { NextResponse } from "next/server";
import { discoverLlmModels } from "@/lib/ai/llm-providers";
import { isDevPanelRouteEnabled } from "@/lib/dev-panel-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isDevPanelRouteEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = (await request.json()) as {
      providerId?: string;
      baseUrl?: string;
      api?: string;
      apiKey?: string;
      headers?: unknown;
    };
    const result = await discoverLlmModels({
      providerId: body.providerId,
      baseUrl: body.baseUrl,
      api: body.api,
      apiKey: body.apiKey,
      headers: body.headers,
    });
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not discover provider models.",
      },
      { status: 400 },
    );
  }
}
