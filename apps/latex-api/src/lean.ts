import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import {
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
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
const MAX_MATHLIB_QUERY_CHARS = 200;
const MAX_MATHLIB_RESULTS = 80;
const MAX_CANDIDATE_CHARS = 200_000;
const MAX_CANDIDATE_TIMEOUT_MS = 300_000;
const MAX_ACTIVE_CANDIDATE_CHECKS = 2;
const CANDIDATE_EXECUTION_PATTERN =
  /(?:#eval\b|\brun_cmd\b|#exec\b|\bIO\.Process\b|\bSystem\.Command\b)/;
const MATHLIB_GUIDE_URL =
  "https://github.com/leanprover-community/mathlib4/wiki/Using-mathlib4-as-a-dependency";

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
let activeCandidateChecks = 0;
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

type MathlibSearchMode = "identifier" | "keyword" | "file";

interface MathlibMatch {
  file: string;
  line: number;
  kind: string;
  name: string | null;
  statement: string;
}

const DECLARATION_LINE =
  /^\s*(?:@\[[^\]]*\]\s*)?(?:(?:private|protected|noncomputable|partial|unsafe|scoped)\s+)*(theorem|lemma|def|abbrev|instance|class|structure|inductive|opaque|axiom)\b\s*([A-Za-z0-9_'.]*)/;

function parseDeclaration(line: string): { kind: string; name: string } | null {
  if (/^\s*--/.test(line)) return null;
  const match = DECLARATION_LINE.exec(line);
  if (!match) return null;
  return {
    kind: match[1],
    name: match[2] || "(anonymous)",
  };
}

function declarationPatternFor(query: string): string {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return `^[[:space:]]*(@\\[[^]]*\\][[:space:]]*)?((private|protected|noncomputable|partial|unsafe|scoped)[[:space:]]+)*(theorem|lemma|def|abbrev|instance|class|structure|inductive|opaque|axiom)[[:space:]]+[A-Za-z0-9_'.]*${escaped}`;
}

function mathlibRootFor(project: LeanProjectInfo): string {
  return join(project.path, ".lake", "packages", "mathlib", "Mathlib");
}

function mathlibUnavailable(project: LeanProjectInfo) {
  return {
    success: false,
    error: `The pinned mathlib source tree was not found at ${mathlibRootFor(project)}.`,
    hint: "Fetch the dependency and its cache first: lake exe cache get, then lake build. Do not run lake update unless you intend to change the pin.",
    guide: MATHLIB_GUIDE_URL,
  };
}

function parseGrepMatches(output: string, root: string): MathlibMatch[] {
  const matches: MathlibMatch[] = [];
  for (const raw of output.split("\n")) {
    const match = /^(.*?):(\d+):(.*)$/.exec(raw);
    if (!match) continue;
    const lineNumber = Number.parseInt(match[2], 10);
    if (!Number.isFinite(lineNumber)) continue;
    const content = match[3];
    const declaration = parseDeclaration(content);
    const rawPath = match[1];
    const filePath = rawPath.startsWith(root)
      ? rawPath
      : resolve(root, rawPath);
    matches.push({
      file: relative(root, filePath).split(sep).join("/"),
      line: lineNumber,
      kind: declaration?.kind ?? "reference",
      name: declaration?.name ?? null,
      statement: content.trim(),
    });
  }
  return matches;
}

async function searchMathlib(
  project: LeanProjectInfo,
  mode: MathlibSearchMode,
  query: string,
  limit: number,
): Promise<Record<string, unknown>> {
  const root = mathlibRootFor(project);
  if (!existsSync(root)) return mathlibUnavailable(project);

  if (mode === "file") {
    const requested = query
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .replace(/^Mathlib\//, "");
    if (
      !requested ||
      requested.includes("..") ||
      !requested.endsWith(".lean")
    ) {
      return {
        success: false,
        error: "File mode expects a path like Probability/Kernel.lean.",
      };
    }

    const rootReal = await realpath(root).catch(() => null);
    const filePath = rootReal
      ? await realpath(resolve(rootReal, requested)).catch(() => null)
      : null;
    if (!rootReal || !filePath || !filePath.startsWith(`${rootReal}${sep}`)) {
      return { success: false, error: `Mathlib file not found: ${requested}` };
    }

    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");
    const declarations: MathlibMatch[] = [];
    for (let index = 0; index < lines.length; index++) {
      const declaration = parseDeclaration(lines[index]);
      if (!declaration) continue;
      const signature: string[] = [lines[index].trim()];
      for (let cursor = index + 1; cursor < lines.length; cursor++) {
        const line = lines[cursor].trim();
        if (signature.length >= 8 || line === "") break;
        const boundary = line.search(/:=|\bwhere\b/);
        if (boundary >= 0) {
          const head = line.slice(0, boundary).trimEnd();
          if (head) signature.push(head);
          break;
        }
        signature.push(line);
      }
      declarations.push({
        file: relative(root, filePath).split(sep).join("/"),
        line: index + 1,
        kind: declaration.kind,
        name: declaration.name,
        statement: signature.join("\n"),
      });
      if (declarations.length >= limit) break;
    }

    return {
      success: true,
      mode,
      query: requested,
      mathlibPath: root,
      matches: declarations,
      total: declarations.length,
      truncated: declarations.length >= limit,
      note:
        declarations.length === 0
          ? "No declarations were extracted from that file."
          : "Signatures are truncated at the declaration/proof boundary.",
    };
  }

  const result = await runCommand(
    "grep",
    mode === "identifier"
      ? [
          "-RInE",
          "--include=*.lean",
          "-m",
          "8",
          declarationPatternFor(query),
          root,
        ]
      : ["-RIn", "--include=*.lean", "--fixed-strings", "-m", "4", query, root],
    {
      cwd: root,
      timeoutMs: 30_000,
      maxOutputChars: 400_000,
    },
  );

  if (result.timedOut) {
    return {
      success: false,
      error: "Mathlib search timed out. Use a shorter, more specific query.",
      timedOut: true,
    };
  }
  if (result.error) {
    return { success: false, error: `Mathlib search failed: ${result.error}` };
  }

  const parsed = parseGrepMatches(result.stdout, root);
  const declarations = parsed.filter((match) => match.kind !== "reference");
  const references = parsed.filter((match) => match.kind === "reference");
  const normalizedQuery = query.toLowerCase();
  const namedDeclarations =
    mode === "identifier"
      ? declarations
          .filter((match) =>
            (match.name ?? "").toLowerCase().includes(normalizedQuery),
          )
          .sort((a, b) => {
            const aName = (a.name ?? "").toLowerCase();
            const bName = (b.name ?? "").toLowerCase();
            const aExact = aName === normalizedQuery ? 0 : 1;
            const bExact = bName === normalizedQuery ? 0 : 1;
            if (aExact !== bExact) return aExact - bExact;
            return aName.length - bName.length;
          })
      : [];
  const primary =
    mode === "identifier"
      ? namedDeclarations.length > 0
        ? namedDeclarations
        : declarations
      : parsed;
  const matches = primary.slice(0, limit);

  return {
    success: true,
    mode,
    query,
    mathlibPath: root,
    matches,
    references: mode === "identifier" ? references.slice(0, 10) : undefined,
    total: matches.length,
    truncated: primary.length > limit,
    note:
      mode === "identifier"
        ? namedDeclarations.length > 0
          ? "Declaration-name matches, ranked by exact and short names. Use file mode on a result to read the full API surface."
          : "No declaration names matched. Try keyword mode, a shorter identifier, or a different namespace."
        : "Keyword matches include declarations, references, and comments.",
  };
}

async function checkLeanCandidate(
  project: LeanProjectInfo,
  code: string,
  imports: string[],
  timeoutMs: number,
  toolchain: string | null | undefined,
  declarationName: string | null | undefined,
): Promise<Record<string, unknown>> {
  const candidate = code.trim();
  if (!candidate) {
    return { success: false, error: "Candidate code is empty." };
  }
  if (candidate.length > MAX_CANDIDATE_CHARS) {
    return {
      success: false,
      error: `Candidate is too large (${candidate.length} characters; limit ${MAX_CANDIDATE_CHARS}).`,
    };
  }
  if (CANDIDATE_EXECUTION_PATTERN.test(candidate)) {
    return {
      success: false,
      error:
        "Candidate contains an execution directive (#eval, run_cmd, #exec, IO.Process, or System.Command). The checker accepts declaration-only proof code.",
    };
  }

  const cleanDeclaration = declarationName?.trim() ?? "";
  if (cleanDeclaration && !/^[A-Za-z0-9_.']+$/.test(cleanDeclaration)) {
    return {
      success: false,
      error:
        "declarationName must be a Lean identifier, for example SteinGate.foo.",
    };
  }

  const cleanImports = imports
    .map((entry) => entry.trim().replace(/^import\s+/, ""))
    .filter((entry) => /^[A-Za-z0-9_.'-]+$/.test(entry));
  const hasImports = /^\s*import\s+/m.test(candidate);
  const header =
    cleanImports.length > 0 && !hasImports
      ? `${cleanImports.map((entry) => `import ${entry}`).join("\n")}\n\n`
      : "";
  const axiomCheck = cleanDeclaration
    ? `\n\n#print axioms ${cleanDeclaration}\n`
    : "";
  const source = `${header}${candidate}${axiomCheck}`;

  const selected = await lakeCommandForToolchain(project, toolchain);
  if (selected.error) {
    return { success: false, error: selected.error };
  }

  const directory = await mkdtemp(join(tmpdir(), "arcana-lean-check-"));
  const filePath = join(directory, "Candidate.lean");
  await writeFile(filePath, source, "utf-8");

  try {
    const result = await runCommand(
      selected.command,
      ["env", "lean", filePath],
      {
        cwd: project.path,
        timeoutMs: Math.min(
          MAX_CANDIDATE_TIMEOUT_MS,
          Math.max(10_000, timeoutMs),
        ),
        maxOutputChars: 600_000,
        env: selected.toolchain
          ? {
              ...process.env,
              PATH: `${dirname(selected.toolchain.lakePath)}:${process.env.PATH ?? ""}`,
            }
          : process.env,
      },
    );

    const output = [result.stdout, result.stderr]
      .filter((part) => part.trim())
      .join("\n")
      .trim();
    const lines = output ? output.split("\n") : [];
    const errors = lines.filter((line) => /\berror:/.test(line)).slice(0, 40);
    const warnings = lines
      .filter((line) => /\bwarning:/.test(line))
      .slice(0, 40);
    const codeHasSorry = /\b(?:sorry|admit)\b/.test(candidate);
    const hasDeclaration =
      /^\s*(?:@\[[^\]]*\]\s*)?(?:(?:private|protected|noncomputable|partial|unsafe|scoped)\s+)*(?:theorem|lemma|example|def|instance|abbrev|structure|class|inductive|opaque|axiom)\b/m.test(
        candidate,
      );
    const hasProofDeclaration =
      /^\s*(?:@\[[^\]]*\]\s*)?(?:(?:private|protected|noncomputable|scoped)\s+)*(?:theorem|lemma|example)\b/m.test(
        candidate,
      );
    const hasUnsafe = /^\s*(?:@\[[^\]]*\]\s*)?(?:unsafe|partial)\b/m.test(
      candidate,
    );
    const sorries = lines
      .filter((line) =>
        /(?:declaration uses 'sorry'|uses "sorry"|\bsorry\b|\badmit\b)/i.test(
          line,
        ),
      )
      .slice(0, 20);
    const elaborated =
      !result.timedOut && !result.error && result.exitCode === 0;
    const hasSorryAx = /sorryAx/.test(output);
    const axioms = lines
      .filter((line) =>
        /(?:depends on axioms|does not depend on any axioms)/.test(line),
      )
      .slice(0, 5);
    const proved =
      elaborated &&
      hasProofDeclaration &&
      !hasUnsafe &&
      !codeHasSorry &&
      sorries.length === 0 &&
      !hasSorryAx;

    return {
      success: true,
      projectName: project.name,
      projectPath: project.path,
      toolchainId: selected.toolchain?.id ?? "default",
      declarationName: cleanDeclaration || null,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      durationMs: result.durationMs,
      elaborated,
      proved,
      hasDeclaration,
      hasProofDeclaration,
      hasUnsafe,
      hasSorry: codeHasSorry || sorries.length > 0,
      hasSorryAx,
      axioms,
      errors,
      warnings,
      sorries,
      stdout: result.stdout,
      stderr: result.stderr,
      command: `${result.command} ${result.args.join(" ")}`.trim(),
      note: proved
        ? "Candidate elaborated and is sorry-free."
        : elaborated
          ? hasSorryAx
            ? "Candidate elaborated, but #print axioms reports sorryAx. It is not a proof."
            : hasUnsafe
              ? "Candidate uses unsafe or partial code. It is not kernel-checked proof evidence."
              : hasProofDeclaration
                ? "Candidate elaborates but still contains sorry/admit."
                : hasDeclaration
                  ? "Candidate elaborates, but it declares an axiom, def, instance, or other non-proof declaration. Only a theorem, lemma, or example is proof evidence."
                  : "Candidate elaborates, but it contains no theorem, lemma, example, def, or instance to count as a proof. Use #check for queries and a declaration for proof evidence."
          : "Candidate did not elaborate. Read the errors before revising.",
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
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

  app.get("/lean/mathlib/search", async (c) => {
    const project = await resolveProject(c.req.query("path"));
    if (!project) return projectError(c);

    const requestedMode = (c.req.query("mode") ?? "identifier").trim();
    if (!["identifier", "keyword", "file"].includes(requestedMode)) {
      return c.json(
        {
          success: false,
          error: "mode must be identifier, keyword, or file.",
        },
        400,
      );
    }

    const query = (c.req.query("query") ?? "").trim();
    if (!query) {
      return c.json({ success: false, error: "query is required." }, 400);
    }
    if (query.length > MAX_MATHLIB_QUERY_CHARS) {
      return c.json(
        {
          success: false,
          error: `query is too long (limit ${MAX_MATHLIB_QUERY_CHARS} characters).`,
        },
        400,
      );
    }

    const parsedLimit = Number.parseInt(c.req.query("limit") ?? "40", 10);
    const limit = Math.min(
      MAX_MATHLIB_RESULTS,
      Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 40),
    );
    const result = await searchMathlib(
      project,
      requestedMode as MathlibSearchMode,
      query,
      limit,
    );
    return c.json(result, result.success ? 200 : 400);
  });

  app.post("/lean/check", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      path?: string;
      code?: string;
      imports?: string[];
      timeoutMs?: number;
      toolchain?: string;
      declarationName?: string;
    };
    const project = await resolveProject(body.path);
    if (!project) return projectError(c);

    if (!body.code?.trim()) {
      return c.json({ success: false, error: "code is required." }, 400);
    }
    if (!Array.isArray(body.imports ?? [])) {
      return c.json(
        { success: false, error: "imports must be an array." },
        400,
      );
    }
    if (activeCandidateChecks >= MAX_ACTIVE_CANDIDATE_CHECKS) {
      return c.json(
        {
          success: false,
          error:
            "Two Lean candidate checks are already running. Retry shortly.",
        },
        409,
      );
    }

    activeCandidateChecks++;
    try {
      const result = await checkLeanCandidate(
        project,
        body.code,
        body.imports ?? [],
        body.timeoutMs ?? 180_000,
        body.toolchain,
        body.declarationName,
      );
      return c.json(result, result.success ? 200 : 400);
    } finally {
      activeCandidateChecks--;
    }
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
