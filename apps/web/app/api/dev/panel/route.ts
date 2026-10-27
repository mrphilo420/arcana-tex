import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import {
  DEFAULT_DEV_FEATURE_FLAGS,
  normalizeDevFeatureFlags,
} from "@/lib/dev-panel";

export const dynamic = "force-dynamic";

const CONFIG_PATH = join(process.cwd(), ".dev-panel.local.json");

function enabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.DEV_PANEL_ENABLED === "1"
  );
}

function unavailable() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET() {
  if (!enabled()) return unavailable();

  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    return NextResponse.json({
      flags: normalizeDevFeatureFlags(JSON.parse(raw)),
    });
  } catch {
    return NextResponse.json({ flags: DEFAULT_DEV_FEATURE_FLAGS });
  }
}

export async function POST(request: Request) {
  if (!enabled()) return unavailable();

  try {
    const body = await request.json();
    const flags = normalizeDevFeatureFlags(body);
    await writeFile(
      CONFIG_PATH,
      `${JSON.stringify({ flags, updatedAt: new Date().toISOString() }, null, 2)}\n`,
      "utf-8",
    );
    return NextResponse.json({ flags });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not persist developer settings",
      },
      { status: 400 },
    );
  }
}
