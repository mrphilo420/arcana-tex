import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import type { Context, Hono } from "hono";

const LEAN_PROJECT_DIR = process.env.LEAN_PROJECT_DIR?.trim() || "";
const LEAN_BRIDGE_TOKEN = process.env.LEAN_BRIDGE_TOKEN?.trim() || "";
const parsedBuildTimeout = Number.parseInt(
  process.env.LEAN_BUILD_TIMEOUT_MS || "180000",
  10,
);
const LEAN_BUILD_TIMEOUT_MS =
  Number.isFinite(parsedBuildTimeout) && parsedBuildTimeout > 0
    ? parsedBuildTimeout
    : 180000;
const MAX_OUTPUT_CHARS = 1_500_000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 1000;
const MAX_DEPTH = 8;

function expandHome(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path;
}

const PROJECT_ROOT = LEAN_PROJECT_DIR
  ? resolve(expandHome(LEAN_PROJECT_DIR))
  : "";

function resolveLakeCommand(): string {
  const configured = process.env.LAKE_BIN?.trim();
  if (configured) return configured;

  const elanLake = join(homedir(), ".elan", "bin", "lake");
  if (existsSync(elanLake)) return elanLake;

  return "lake";
}

const LAKE_COMMAND = resolveLakeCommand();

let activeBuilds = 0;

interface RunOptions {
  cwd: string;
  timeoutMs: number;
  maxOutputChars?: number;
}

interface RunResult {
  command: string;
  args: string[];
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  error?: string;
}

function runCommand(
  command: string,
  args: string[],
  options: RunOptions,
): Promise<RunResult> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const maxOutput = options.maxOutputChars ?? MAX_OUTPUT_CHARS;
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const finish = (exitCode: number | null, error?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        command,
        args,
        stdout,
        stderr,
        exitCode,
        timedOut,
        durationMs: Date.now() - startedAt,
        error,
      });
    };

    const append = (target: "stdout" | "stderr", chunk: Buffer) => {
      const current = target === "stdout" ? stdout : stderr;
      if (current.length >= maxOutput) return;
      const remaining = maxOutput - current.length;
      const text = chunk.toString("utf-8").slice(0, remaining);
      if (target === "stdout") stdout += text;
      else stderr += text;
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
      setTimeout(() => finish(null, "Timed out"), 1500);
    }, options.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => append("stdout", chunk));
    child.stderr.on("data", (chunk: Buffer) => append("stderr", chunk));

    child.on("error", (error) => {
      finish(null, error.message);
    });

    child.on("close", (code) => {
      finish(code);
    });
  });
}

function unauthorized(c: Context) {
  return c.json({ error: "Unauthorized Lean bridge request" }, 401);
}

async function guard(c: Context, next: () => Promise<void>) {
  if (
    LEAN_BRIDGE_TOKEN &&
    c.req.header("authorization") !== `Bearer ${LEAN_BRIDGE_TOKEN}`
  ) {
    return unauthorized(c);
  }
  await next();
}

function leanUnavailable(c: Context) {
  return c.json(
    {
      configured: false,
      error:
        "LEAN_PROJECT_DIR is not configured. Start the LaTeX/sync API with LEAN_PROJECT_DIR=/absolute/path/to/your/lake-project.",
    },
    400,
  );
}

async function ensureProject(c: Context): Promise<boolean> {
  if (!PROJECT_ROOT) {
    leanUnavailable(c);
    return false;
  }
  if (!existsSync(PROJECT_ROOT)) {
    c.json(
      {
        configured: false,
        error: `Lean project directory does not exist: ${PROJECT_ROOT}`,
      },
      400,
    );
    return false;
  }
  return true;
}

interface LeanFileEntry {
  path: string;
  size: number;
  modifiedAt: number;
}

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".github",
  ".lake",
  ".idea",
  ".vscode",
  "build",
  "node_modules",
  "target",
]);

async function collectLeanFiles(
  root: string,
  dir = "",
  depth = 0,
  files: LeanFileEntry[] = [],
): Promise<LeanFileEntry[]> {
  if (depth > MAX_DEPTH || files.length >= MAX_FILES) return files;

  const directory = join(root, dir);
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (files.length >= MAX_FILES) break;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name) || entry.name.startsWith(".")) {
        continue;
      }
      await collectLeanFiles(
        root,
        dir ? `${dir}/${entry.name}` : entry.name,
        depth + 1,
        files,
      );
      continue;
    }
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".lean")) {
      continue;
    }

    const filePath = dir ? `${dir}/${entry.name}` : entry.name;
    try {
      const info = await stat(join(root, filePath));
      files.push({
        path: filePath,
        size: info.size,
        modifiedAt: info.mtimeMs,
      });
    } catch {
      // The file disappeared while walking the project.
    }
  }

  return files;
}

async function safeLeanPath(
  root: string,
  requestedPath: string,
): Promise<string | null> {
  const path = requestedPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!path || path.includes("..") || !path.endsWith(".lean")) return null;

  const rootReal = await realpath(root).catch(() => null);
  if (!rootReal) return null;

  const candidate = resolve(rootReal, path);
  if (!candidate.startsWith(`${rootReal}${sep}`)) return null;

  const candidateReal = await realpath(candidate).catch(() => null);
  if (!candidateReal) return null;
  if (!candidateReal.startsWith(`${rootReal}${sep}`)) return null;

  return candidateReal;
}

export function registerLeanRoutes(app: Hono) {
  app.use("/lean/*", guard);

  app.get("/lean/status", async (c) => {
    if (!PROJECT_ROOT) {
      return c.json({
        configured: false,
        error:
          "Set LEAN_PROJECT_DIR to the absolute path of a Lake project, then restart the API.",
      });
    }

    if (!existsSync(PROJECT_ROOT)) {
      return c.json({
        configured: false,
        error: `Lean project directory does not exist: ${PROJECT_ROOT}`,
      });
    }

    const hasLakefile =
      existsSync(join(PROJECT_ROOT, "lakefile.lean")) ||
      existsSync(join(PROJECT_ROOT, "lakefile.toml"));
    const version = await runCommand(LAKE_COMMAND, ["--version"], {
      cwd: PROJECT_ROOT,
      timeoutMs: 8000,
      maxOutputChars: 12000,
    });

    return c.json({
      configured: true,
      projectName: basename(PROJECT_ROOT),
      projectPath: PROJECT_ROOT,
      hasLakefile,
      lakeCommand: LAKE_COMMAND,
      lakeVersion: `${version.stdout}${version.stderr}`.trim() || null,
      buildInProgress: activeBuilds > 0,
    });
  });

  app.get("/lean/files", async (c) => {
    if (!(await ensureProject(c))) return;
    const files = await collectLeanFiles(PROJECT_ROOT);
    return c.json({
      configured: true,
      projectName: basename(PROJECT_ROOT),
      files,
      truncated: files.length >= MAX_FILES,
    });
  });

  app.get("/lean/file", async (c) => {
    if (!(await ensureProject(c))) return;
    const requested = c.req.query("path") ?? "";
    const filePath = await safeLeanPath(PROJECT_ROOT, requested);
    if (!filePath) {
      return c.json({ error: "Invalid Lean file path" }, 400);
    }

    const info = await stat(filePath).catch(() => null);
    if (!info?.isFile()) {
      return c.json({ error: "Lean file not found" }, 404);
    }
    if (info.size > MAX_FILE_BYTES) {
      return c.json({ error: "Lean file is too large to display" }, 413);
    }

    const content = await readFile(filePath, "utf-8");
    return c.json({
      path: relative(PROJECT_ROOT, filePath).split(sep).join("/"),
      content,
      size: info.size,
    });
  });

  app.post("/lean/build", async (c) => {
    if (!(await ensureProject(c))) return;
    if (activeBuilds >= 1) {
      return c.json(
        {
          success: false,
          error: "A Lean build is already running for this project.",
        },
        409,
      );
    }

    activeBuilds++;
    try {
      const result = await runCommand(LAKE_COMMAND, ["build"], {
        cwd: PROJECT_ROOT,
        timeoutMs: LEAN_BUILD_TIMEOUT_MS,
      });

      return c.json({
        success: !result.timedOut && !result.error && result.exitCode === 0,
        projectName: basename(PROJECT_ROOT),
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        durationMs: result.durationMs,
        stdout: result.stdout,
        stderr: result.stderr,
        error: result.error ?? null,
        command: `${result.command} ${result.args.join(" ")}`.trim(),
      });
    } finally {
      activeBuilds--;
    }
  });
}
