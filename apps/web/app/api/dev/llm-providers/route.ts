import { NextResponse } from "next/server";
import {
  deleteLlmProvider,
  publicLlmProviders,
  upsertLlmProvider,
} from "@/lib/ai/llm-providers";
import { isDevPanelRouteEnabled } from "@/lib/dev-panel-server";

export const dynamic = "force-dynamic";

function unavailable() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET() {
  if (!isDevPanelRouteEnabled()) return unavailable();
  return NextResponse.json({ providers: await publicLlmProviders() });
}

export async function POST(request: Request) {
  if (!isDevPanelRouteEnabled()) return unavailable();

  try {
    const body = (await request.json()) as {
      provider?: Record<string, unknown>;
      apiKey?: string;
    };
    const provider = body.provider ?? {};
    const result = await upsertLlmProvider({
      id: typeof provider.id === "string" ? provider.id : undefined,
      label: typeof provider.label === "string" ? provider.label : undefined,
      baseUrl:
        typeof provider.baseUrl === "string" ? provider.baseUrl : undefined,
      api: typeof provider.api === "string" ? provider.api : undefined,
      apiKey:
        typeof body.apiKey === "string"
          ? body.apiKey
          : typeof provider.apiKey === "string"
            ? provider.apiKey
            : undefined,
      headers: provider.headers,
      models: provider.models,
      defaultModel:
        typeof provider.defaultModel === "string"
          ? provider.defaultModel
          : undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      provider: result.provider,
      providers: await publicLlmProviders(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not save the LLM provider.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!isDevPanelRouteEnabled()) return unavailable();

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const result = await deleteLlmProvider(id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ providers: await publicLlmProviders() });
}
