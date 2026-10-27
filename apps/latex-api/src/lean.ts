import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
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
const MAX_DISCOVERED_PROJECTS = 50;

const ELAN_HOME = join(homedir(), ".elan");
const KNOWN_PROJECTS_FILE = join(ELAN_HOME, "known-projects");
const TOOLCHAINS_DIR = join(ELAN_HOME, "toolchains");

function expandHome(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path;
}

const DEFAULT_PROJECT_ROOT = LEAN_PROJECT_DIR
  ? resolve(expandHome(LEAN_PROJECT_DIR))
  : "";

function resolveDefaultLakeCommand(): string {
  const configured = process.env.LAKE_BIN?.trim();
  if (configured) return configured;

  const elanLake = join(homedir(), ".elan", "bin", "lake");
  if (existsSync(elanLake)) return elanLake;

  return "lake";
}

const DEFAULT_LAKE_COMMAND = resolveDefaultLakeCommand();

let activeBuilds = 0;
let toolchainCache: LeanToolchainInfo[] | null = null;

interface LeanProjectInfo {
  path: string;
  name: string;
  toolchainPin: string | null;
}

interface LeanToolchainInfo {
  id: string;
  label: string;
  version: string;
  lakePath: string;
  leanPath: string;
}

interface RunOptions {
  cwd: string;
  timeoutMs: number;
  maxOutputChars?: number;
  env?: NodeJS.ProcessEnv;
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
  return new Promise((resolveResult) => {
    const startedAt = Date.now();
    const maxOutput = options.maxOutputChars ?? MAX_OUTPUT_CHARS;
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const finish = (exitCode: number | null, error?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveResult({
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

function displayToolchainName(id: string): string {
  return id.replaceAll("---", ":").replaceAll("--", "/");
}

function isIgnoredProjectPath(path: string): boolean {
  const segments = path.split("/");
  return segments.some(
    (segment) =>
      segment === ".lake" ||
      segment === ".git" ||
      segment === ".claude" ||
      segment === ".cache" ||
      segment === "node_modules",
  );
}

async function isLakeProject(path: string): Promise<boolean> {
  if (!existsSync(path)) return false;
  return (
    existsSync(join(path, "lakefile.lean")) ||
    existsSync(join(path, "lakefile.toml"))
  );
}

async function projectInfo(path: string): Promise<LeanProjectInfo | null> {
  const resolved = resolve(path);
  if (!(await isLakeProject(resolved))) return null;

  let toolchainPin: string | null = null;
  try {
    const pin = await readFile(join(resolved, "lean-toolchain"), "utf-8");
    const firstLine = pin.split("\n")[0]?.trim();
    if (
      firstLine &&
      !firstLine.startsWith("<<<<<<<") &&
      !firstLine.startsWith("=======")
    ) {
      toolchainPin = firstLine;
    }
  } catch {}

  return {
    path: resolved,
    name: basename(resolved),
    toolchainPin,
  };
}

async function scanForLakeProjects(
  root: string,
  depth: number,
  found: Set<string>,
  budget: { directories: number },
): Promise<void> {
  if (depth > 4 || found.size >= MAX_DISCOVERED_PROJECTS) return;
  if (budget.directories >= 2500) return;

  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }

  budget.directories++;
  if (await isLakeProject(root)) found.add(root);

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (found.size >= MAX_DISCOVERED_PROJECTS) break;
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    if (entry.name.startsWith(".") || isIgnoredProjectPath(entry.name)) {
      continue;
    }
    await scanForLakeProjects(join(root, entry.name), depth + 1, found, budget);
  }
}

export async function discoverLeanProjects(): Promise<LeanProjectInfo[]> {
  const paths = new Set<string>();

  if (DEFAULT_PROJECT_ROOT) paths.add(DEFAULT_PROJECT_ROOT);

  try {
    const known = await readFile(KNOWN_PROJECTS_FILE, "utf-8");
    for (const line of known.split("\n")) {
      const path = line.trim();
      if (path && !isIgnoredProjectPath(path)) paths.add(path);
    }
  } catch {}

  if (paths.size === 0) {
    const budget = { directories: 0 };
    const roots = [
      "Documents",
      "Desktop",
      "Projects",
      "Developer",
      "src",
      "code",
    ].map((name) => join(homedir(), name));

    for (const root of roots) {
      if (!existsSync(root)) continue;
      await scanForLakeProjects(root, 0, paths, budget);
      if (paths.size >= MAX_DISCOVERED_PROJECTS) break;
    }
  }

  const projects: LeanProjectInfo[] = [];
  const seen = new Set<string>();

  for (const path of paths) {
    if (projects.length >= MAX_DISCOVERED_PROJECTS) break;
    const info = await projectInfo(path);
    if (!info) continue;
    const real = await realpath(info.path).catch(() => info.path);
    if (seen.has(real)) continue;
    seen.add(real);
    projects.push(info);
  }

  projects.sort((a, b) => a.name.localeCompare(b.name));
  return projects;
}

export async function discoverLeanToolchains(): Promise<LeanToolchainInfo[]> {
  if (toolchainCache) return toolchainCache;

  let entries;
  try {
    entries = await readdir(TOOLCHAINS_DIR, { withFileTypes: true });
  } catch {
    toolchainCache = [];
    return toolchainCache;
  }

  const toolchains: LeanToolchainInfo[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

    const toolchainDir = join(TOOLCHAINS_DIR, entry.name);
    const lakePath = join(toolchainDir, "bin", "lake");
    const leanPath = join(toolchainDir, "bin", "lean");
    if (!existsSync(lakePath) || !existsSync(leanPath)) continue;

    const result = await runCommand(leanPath, ["--version"], {
      cwd: toolchainDir,
      timeoutMs: 8000,
      maxOutputChars: 12000,
    });
    const versionMatch = `${result.stdout}${result.stderr}`.match(
      /version\s+([^\s,]+)/,
    );
    const version = versionMatch?.[1] ?? displayToolchainName(entry.name);

    toolchains.push({
      id: entry.name,
      label: `${displayToolchainName(entry.name)} · Lean ${version}`,
      version,
      lakePath,
      leanPath,
    });
  }

  toolchainCache = toolchains.sort((a, b) =>
    b.version.localeCompare(a.version, undefined, { numeric: true }),
  );
  return toolchainCache;
}

function toolchainForPin(
  pin: string | null,
  toolchains: LeanToolchainInfo[],
): LeanToolchainInfo | null {
  if (!pin) return null;
  const pinVersion = pin.split(":").pop()?.trim().replace(/^v/, "");
  if (!pinVersion) return null;
  return (
    toolchains.find(
      (toolchain) =>
        toolchain.version === pinVersion ||
        toolchain.version.replace(/^v/, "") === pinVersion,
    ) ?? null
  );
}

async function resolveProject(
  requestedPath?: string | null,
): Promise<LeanProjectInfo | null> {
  const explicit = requestedPath?.trim();
  if (explicit) {
    return projectInfo(resolve(expandHome(explicit)));
  }

  if (DEFAULT_PROJECT_ROOT) {
    const configured = await projectInfo(DEFAULT_PROJECT_ROOT);
    if (configured) return configured;
  }

  const projects = await discoverLeanProjects();
  return projects.length === 1 ? projects[0] : null;
}

async function guard(c: Context, next: () => Promise<void>) {
  if (
    LEAN_BRIDGE_TOKEN &&
    c.req.header("authorization") !== `Bearer ${LEAN_BRIDGE_TOKEN}`
  ) {
    return c.json({ error: "Unauthorized Lean bridge request" }, 401);
  }
  await next();
}

function projectError(c: Context) {
  return c.json(
    {
      configured: false,
      error:
        "No Lean Lake project selected. Provide a project path or set LEAN_PROJECT_DIR.",
    },
    400,
  );
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

async function lakeCommandForToolchain(
  project: LeanProjectInfo,
  requestedToolchain: string | null | undefined,
): Promise<{
  command: string;
  toolchain: LeanToolchainInfo | null;
  error?: string;
}> {
  const toolchains = await discoverLeanToolchains();
  if (requestedToolchain && requestedToolchain !== "default") {
    const selected = toolchains.find(
      (toolchain) => toolchain.id === requestedToolchain,
    );
    if (!selected) {
      return {
        command: DEFAULT_LAKE_COMMAND,
        toolchain: null,
        error: "Selected Lean toolchain is not installed.",
      };
    }
    return { command: selected.lakePath, toolchain: selected };
  }

  const pinned = toolchainForPin(project.toolchainPin, toolchains);
  if (pinned) return { command: pinned.lakePath, toolchain: pinned };
  return { command: DEFAULT_LAKE_COMMAND, toolchain: null };
}

export function registerLeanRoutes(app: Hono) {
  app.use("/lean/*", guard);

  app.get("/lean/projects", async (c) => {
    const projects = await discoverLeanProjects();
    return c.json({
      projects,
      truncated: projects.length >= MAX_DISCOVERED_PROJECTS,
      configuredProject: DEFAULT_PROJECT_ROOT || null,
    });
  });

  app.get("/lean/toolchains", async (c) => {
    const toolchains = await discoverLeanToolchains();
    return c.json({
      toolchains: toolchains.map((toolchain) => ({
        id: toolchain.id,
        label: toolchain.label,
        version: toolchain.version,
      })),
    });
  });

  app.get("/lean/status", async (c) => {
    const requested = c.req.query("path");
    const project = await resolveProject(requested);
    if (!project) {
      if (requested) {
        return c.json(
          { configured: false, error: "Path is not a Lake project." },
          400,
        );
      }
      const projects = await discoverLeanProjects();
      return c.json({
        configured: false,
        error:
          projects.length > 1
            ? "Multiple Lake projects found. Choose one."
            : "No Lean Lake project found. Provide a project path.",
        projects,
      });
    }

    const toolchains = await discoverLeanToolchains();
    const pinned = toolchainForPin(project.toolchainPin, toolchains);
    const selectedCommand = pinned?.lakePath ?? DEFAULT_LAKE_COMMAND;
    const version = await runCommand(selectedCommand, ["--version"], {
      cwd: project.path,
      timeoutMs: 8000,
      maxOutputChars: 12000,
    });

    return c.json({
      configured: true,
      projectName: project.name,
      projectPath: project.path,
      hasLakefile: true,
      toolchainPin: project.toolchainPin,
      pinnedToolchainId: pinned?.id ?? null,
      lakeCommand: selectedCommand,
      lakeVersion: `${version.stdout}${version.stderr}`.trim() || null,
      buildInProgress: activeBuilds > 0,
    });
  });

  app.get("/lean/files", async (c) => {
    const project = await resolveProject(c.req.query("path"));
    if (!project) return projectError(c);
    const files = await collectLeanFiles(project.path);
    return c.json({
      configured: true,
      projectName: project.name,
      files,
      truncated: files.length >= MAX_FILES,
    });
  });

  app.get("/lean/file", async (c) => {
    const project = await resolveProject(c.req.query("project"));
    if (!project) return projectError(c);
    const requested = c.req.query("path") ?? "";
    const filePath = await safeLeanPath(project.path, requested);
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
      path: relative(project.path, filePath).split(sep).join("/"),
      content,
      size: info.size,
    });
  });

  app.post("/lean/build", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      path?: string;
      toolchain?: string;
    };
    const project = await resolveProject(body.path);
    if (!project) return projectError(c);
    if (activeBuilds >= 1) {
      return c.json(
        {
          success: false,
          error: "A Lean build is already running for this project.",
        },
        409,
      );
    }

    const selected = await lakeCommandForToolchain(project, body.toolchain);
    if (selected.error) {
      return c.json({ success: false, error: selected.error }, 400);
    }

    activeBuilds++;
    try {
      const env = selected.toolchain
        ? {
            ...process.env,
            PATH: `${dirname(selected.toolchain.lakePath)}:${process.env.PATH ?? ""}`,
          }
        : process.env;
      const result = await runCommand(selected.command, ["build"], {
        cwd: project.path,
        timeoutMs: LEAN_BUILD_TIMEOUT_MS,
        env,
      });

      return c.json({
        success: !result.timedOut && !result.error && result.exitCode === 0,
        projectName: project.name,
        projectPath: project.path,
        toolchainId: selected.toolchain?.id ?? "default",
        toolchainVersion: selected.toolchain?.version ?? null,
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
