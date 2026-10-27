import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

export type CodeLanguage = "python" | "r";

export interface CodeInputFile {
  path: string;
  content: string;
}

export interface CodeArtifact {
  path: string;
  content: string;
  truncated: boolean;
}

export interface CodeRunResult {
  success: boolean;
  language: CodeLanguage;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
  artifacts: CodeArtifact[];
  sandboxed: boolean;
  warning?: string;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_TIMEOUT_MS = 30_000;
const MAX_CODE_CHARS = 60_000;
const MAX_INPUT_FILES = 8;
const MAX_INPUT_FILE_CHARS = 20_000;
const MAX_OUTPUT_CHARS = 14_000;
const MAX_ERROR_CHARS = 7_000;
const MAX_ARTIFACTS = 20;
const MAX_ARTIFACT_CHARS = 16_000;
const MAX_ARTIFACT_TOTAL_CHARS = 80_000;

const ARTIFACT_EXTENSIONS = new Set([
  ".tex",
  ".tikz",
  ".pgf",
  ".svg",
  ".csv",
  ".tsv",
  ".dat",
  ".json",
  ".txt",
  ".md",
  ".log",
  ".py",
  ".r",
]);

const SKIP_DIRECTORIES = new Set([
  ".cache",
  ".mpl",
  "__pycache__",
  "node_modules",
]);

function clampTimeout(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.min(MAX_TIMEOUT_MS, Math.max(1_000, Math.round(value)));
}

function safeRelativePath(value: string): string {
  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "").trim();
  if (
    !normalized ||
    normalized.includes("..") ||
    normalized.includes("\0") ||
    normalized.startsWith("~")
  ) {
    throw new Error(`Invalid file path: ${value}`);
  }
  return normalized;
}

function macSandboxProfile(root: string): string {
  const escapedRoot = root.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const home = process.env.HOME;
  const escapedHome =
    home && !root.startsWith(`${home}/`)
      ? home.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
      : null;
  return [
    "(version 1)",
    "(allow default)",
    "(deny network*)",
    "(deny file-write*)",
    escapedHome ? `(deny file-read* (subpath "${escapedHome}"))` : "",
    `(allow file-write* (subpath "${escapedRoot}") (literal "/dev/null") (literal "/dev/stdout") (literal "/dev/stderr"))`,
  ]
    .filter(Boolean)
    .join("\n");
}

const SAFE_ENV_KEYS = [
  "NODE_ENV",
  "PATH",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "TZ",
  "SYSTEMROOT",
];

function shellEnvironment(root: string): NodeJS.ProcessEnv {
  const safeEnvironment: NodeJS.ProcessEnv = {
    NODE_ENV: process.env.NODE_ENV ?? "production",
  };
  for (const key of SAFE_ENV_KEYS) {
    const value = process.env[key];
    if (value) safeEnvironment[key] = value;
  }

  return {
    ...safeEnvironment,
    HOME: root,
    TMPDIR: root,
    TMP: root,
    TEMP: root,
    XDG_CACHE_HOME: join(root, ".cache"),
    MPLCONFIGDIR: join(root, ".mpl"),
    MPLBACKEND: "Agg",
    PYTHONNOUSERSITE: "1",
    PYTHONDONTWRITEBYTECODE: "1",
    R_HISTFILE: "/dev/null",
    R_ENVIRON_USER: "/dev/null",
    R_PROFILE_USER: "/dev/null",
  };
}

async function collectArtifacts(root: string): Promise<CodeArtifact[]> {
  const artifacts: CodeArtifact[] = [];
  let total = 0;

  const visit = async (directory: string): Promise<void> => {
    if (
      artifacts.length >= MAX_ARTIFACTS ||
      total >= MAX_ARTIFACT_TOTAL_CHARS
    ) {
      return;
    }

    let entries: Array<{
      name: string;
      isDirectory: () => boolean;
      isFile: () => boolean;
    }>;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (
        artifacts.length >= MAX_ARTIFACTS ||
        total >= MAX_ARTIFACT_TOTAL_CHARS
      ) {
        break;
      }
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name)) {
          await visit(join(directory, entry.name));
        }
        continue;
      }
      if (!entry.isFile()) continue;

      const path = join(directory, entry.name);
      const relativePath = relative(root, path).replace(/\\/g, "/");
      if (relativePath === "main.py" || relativePath === "main.R") continue;
      const extension = relativePath.includes(".")
        ? relativePath.slice(relativePath.lastIndexOf(".")).toLowerCase()
        : "";
      if (!ARTIFACT_EXTENSIONS.has(extension)) continue;

      let info;
      try {
        info = await lstat(path);
      } catch {
        continue;
      }
      if (!info.isFile() || info.size > 200_000) continue;

      let content: string;
      try {
        content = await readFile(path, "utf-8");
      } catch {
        continue;
      }
      const remaining = MAX_ARTIFACT_TOTAL_CHARS - total;
      if (remaining <= 0) break;
      const limit = Math.min(MAX_ARTIFACT_CHARS, remaining);
      const included = content.slice(0, limit);
      total += included.length;
      artifacts.push({
        path: relativePath,
        content: included,
        truncated: included.length < content.length,
      });
    }
  };

  await visit(root);
  return artifacts;
}

function runProcess(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<{
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd,
      env: shellEnvironment(cwd),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let settled = false;
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const append = (
      current: string,
      chunk: Buffer,
      limit: number,
      truncated: boolean,
    ): { value: string; truncated: boolean } => {
      if (current.length >= limit) return { value: current, truncated: true };
      const text = chunk.toString();
      return {
        value: current + text.slice(0, limit - current.length),
        truncated: truncated || text.length > limit - current.length,
      };
    };

    proc.stdout.on("data", (chunk: Buffer) => {
      const next = append(stdout, chunk, MAX_OUTPUT_CHARS, stdoutTruncated);
      stdout = next.value;
      stdoutTruncated = next.truncated;
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      const next = append(stderr, chunk, MAX_ERROR_CHARS, stderrTruncated);
      stderr = next.value;
      stderrTruncated = next.truncated;
    });

    const finish = (exitCode: number | null, error?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        exitCode,
        timedOut,
        stdout: stdoutTruncated ? `${stdout}\n… output truncated …` : stdout,
        stderr: stderrTruncated ? `${stderr}\n… output truncated …` : stderr,
        error,
      });
    };

    timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, timeoutMs);

    proc.on("close", (code) => finish(code));
    proc.on("error", (error) => finish(null, error.message));
  });
}

export async function runLocalCode(input: {
  language: CodeLanguage;
  code: string;
  files?: CodeInputFile[];
  timeoutMs?: number;
}): Promise<CodeRunResult> {
  if (process.env.ENABLE_LOCAL_CODE_EXECUTION === "false") {
    throw new Error(
      "Local code execution is disabled. Set ENABLE_LOCAL_CODE_EXECUTION=true to enable Python and R tools.",
    );
  }

  const code = input.code.trim();
  if (!code) {
    throw new Error("No code was provided.");
  }
  if (code.length > MAX_CODE_CHARS) {
    throw new Error(`Code is too large (limit ${MAX_CODE_CHARS} characters).`);
  }

  const files = (input.files ?? []).slice(0, MAX_INPUT_FILES);
  for (const file of files) {
    if (file.content.length > MAX_INPUT_FILE_CHARS) {
      throw new Error(
        `Input file ${file.path} is too large (limit ${MAX_INPUT_FILE_CHARS} characters).`,
      );
    }
  }

  const root = await realpath(await mkdtemp(join(tmpdir(), "arcanatex-code-")));
  const timeoutMs = clampTimeout(input.timeoutMs);
  const startedAt = Date.now();
  const scriptName = input.language === "python" ? "main.py" : "main.R";
  const binary =
    input.language === "python"
      ? process.env.PYTHON_BIN || "python3"
      : process.env.R_BIN || "Rscript";
  const args =
    input.language === "python" ? [scriptName] : ["--vanilla", scriptName];

  try {
    await mkdir(join(root, ".cache"), { recursive: true });
    await mkdir(join(root, ".mpl"), { recursive: true });

    for (const file of files) {
      const relativePath = safeRelativePath(file.path);
      const fullPath = join(root, relativePath);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, file.content, "utf-8");
    }
    await writeFile(join(root, scriptName), code, "utf-8");

    const useMacSandbox =
      process.platform === "darwin" && existsSync("/usr/bin/sandbox-exec");
    const allowUnsandboxed =
      process.env.ALLOW_UNSANDBOXED_CODE_EXECUTION === "true";

    if (!useMacSandbox && !allowUnsandboxed) {
      throw new Error(
        "No supported local code sandbox is available on this platform. Install a sandboxed runtime or set ALLOW_UNSANDBOXED_CODE_EXECUTION=true to run trusted code without network isolation.",
      );
    }

    const command = useMacSandbox ? "/usr/bin/sandbox-exec" : binary;
    const commandArgs = useMacSandbox
      ? ["-p", macSandboxProfile(root), binary, ...args]
      : args;

    const result = await runProcess(command, commandArgs, root, timeoutMs);
    const artifacts = await collectArtifacts(root);
    const durationMs = Date.now() - startedAt;
    const success = !result.timedOut && !result.error && result.exitCode === 0;

    return {
      success,
      language: input.language,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      durationMs,
      stdout: result.stdout,
      stderr: result.stderr || result.error || "",
      artifacts,
      sandboxed: useMacSandbox,
      warning: useMacSandbox
        ? undefined
        : "No OS sandbox is available on this platform. Code ran in an isolated temporary directory with a timeout, but without network isolation. Set ALLOW_UNSANDBOXED_CODE_EXECUTION=true only when you trust the code.",
    };
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
}
