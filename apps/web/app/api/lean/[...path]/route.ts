import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const LEAN_API_URL = (
  process.env.LEAN_API_URL ||
  process.env.LATEX_API_URL ||
  "http://localhost:3001"
).replace(/\/+$/, "");
const LEAN_BRIDGE_TOKEN = process.env.LEAN_BRIDGE_TOKEN?.trim() || "";

async function proxy(request: Request, path: string[]) {
  const url = new URL(request.url);
  const target = `${LEAN_API_URL}/lean/${path
    .map((segment) => encodeURIComponent(segment))
    .join("/")}${url.search}`;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  if (LEAN_BRIDGE_TOKEN) {
    headers.set("authorization", `Bearer ${LEAN_BRIDGE_TOKEN}`);
  }

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await request.arrayBuffer(),
      cache: "no-store",
      signal: AbortSignal.timeout(320_000),
    });

    return new Response(await response.arrayBuffer(), {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Lean bridge unavailable: ${error.message}`
            : "Lean bridge unavailable",
      },
      { status: 502 },
    );
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxy(request, path);
}
