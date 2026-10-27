import { NextResponse } from "next/server";
import { chatRatelimit, getIP } from "@/lib/ratelimit";

/**
 * Shared limiter for the AI and code-execution routes. Returns a 429 response
 * when the configured Upstash limiter rejects the request, otherwise null.
 */
export async function limitApiRequest(
  request: Request,
): Promise<NextResponse | null> {
  if (!chatRatelimit) return null;

  const { success, limit, remaining, reset } = await chatRatelimit.limit(
    getIP(request),
  );
  if (success) return null;

  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": reset.toString(),
      },
    },
  );
}
