import type { CompileDiagnostic } from "@/lib/compile-diagnostics";
import type { LatexCompiler } from "@/lib/latex-compiler";
import {
  detectMainFile,
  getParentPath,
  isLatexDocumentFile,
  type ProjectFile,
} from "@/lib/project-files";

export type SubmissionTarget = "arxiv" | "journal" | "conference";
export type CheckStatus = "pass" | "warning" | "blocker";
export type CheckCategory =
  | "structure"
  | "build"
  | "references"
  | "figures"
  | "portability"
  | "hygiene"
  | "anonymity";

export interface SubmissionCheck {
  id: string;
  category: CheckCategory;
  status: CheckStatus;
  title: string;
  detail: string;
  filePath?: string;
  line?: number;
}

export interface BundleEntry {
  path: string;
  kind: "source" | "bibliography" | "figure" | "class" | "other";
  bytes: number;
}

export interface SubmissionReport {
  target: SubmissionTarget;
  mainFilePath: string | null;
  checks: SubmissionCheck[];
  counts: Record<CheckStatus, number>;
  bundle: BundleEntry[];
  bundleBytes: number;
}

const ARTIFACT_EXTENSIONS = new Set([
  "aux",
  "log",
  "out",
  "toc",
  "lof",
  "lot",
  "fls",
  "fdb_latexmk",
  "synctex.gz",
  "bcf",
  "run.xml",
  "nav",
  "snm",
  "vrb",
  "blg",
  "gz",
  "idx",
  "ind",
  "ilg",
  "glo",
  "gls",
  "loa",
  "lol",
  "bak",
  "tmp",
]);

const GRAPHIC_EXTENSIONS = [
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "eps",
  "svg",
  "gif",
  "webp",
];

function extension(path: string): string {
  const name = path.split("/").pop() ?? path;
  const index = name.lastIndexOf(".");
  return index === -1 ? "" : name.slice(index + 1).toLowerCase();
}

function lineFor(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function fileKind(path: string): BundleEntry["kind"] {
  const ext = extension(path);
  if (ext === "tex" || ext === "ltx") return "source";
  if (ext === "bib" || ext === "bst") return "bibliography";
  if (GRAPHIC_EXTENSIONS.includes(ext)) return "figure";
  if (ext === "cls" || ext === "sty" || ext === "def") return "class";
  return "other";
}

function fileBytes(file: ProjectFile): number {
  if (file.content) return new TextEncoder().encode(file.content).length;
  if (file.dataUrl) {
    const base64 = file.dataUrl.split(",")[1] ?? "";
    return Math.floor((base64.length * 3) / 4);
  }
  return 0;
}

function resolveProjectPath(
  from: string,
  target: string,
  files: ProjectFile[],
): ProjectFile | null {
  const normalized = target.replace(/^\.\//, "").replace(/\\/g, "/");
  if (/^(https?:|\/|[A-Za-z]:)/.test(normalized)) return null;

  const base = getParentPath(from);
  const joined = base ? `${base}/${normalized}` : normalized;
  const parts: string[] = [];
  for (const part of joined.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  const path = parts.join("/");
  const candidates = [path, `${path}.tex`, `${path}.ltx`];

  return (
    files.find((file) => candidates.includes(file.path)) ??
    files.find((file) =>
      candidates.some(
        (candidate) => file.path.toLowerCase() === candidate.toLowerCase(),
      ),
    ) ??
    files.find(
      (file) =>
        GRAPHIC_EXTENSIONS.includes(extension(file.path)) &&
        file.path.replace(/\.[^.]+$/, "") === path,
    ) ??
    null
  );
}

export function analyzeSubmission(input: {
  files: ProjectFile[];
  mainFileId: string | null;
  compiler: LatexCompiler;
  diagnostics: CompileDiagnostic[];
  compileError: string | null;
  target: SubmissionTarget;
  anonymous: boolean;
}): SubmissionReport {
  const checks: SubmissionCheck[] = [];
  const texFiles = input.files.filter(
    (file) => file.type === "tex" && isLatexDocumentFile(file),
  );
  const main =
    input.files.find((file) => file.id === input.mainFileId) ??
    detectMainFile(input.files) ??
    null;
  const content = main?.content ?? "";

  const add = (check: SubmissionCheck) => checks.push(check);

  if (!main) {
    add({
      id: "no-main",
      category: "structure",
      status: "blocker",
      title: "No LaTeX main file",
      detail: "Select a .tex file as the main document before submitting.",
    });
  } else {
    add({
      id: "main-file",
      category: "structure",
      status: "pass",
      title: "Main document found",
      detail: main.path,
    });

    if (!content.includes("\\documentclass")) {
      add({
        id: "documentclass",
        category: "structure",
        status: "warning",
        title: "No \\documentclass in the main file",
        detail:
          "The main file may \\input a preamble; verify the portal build.",
        filePath: main.path,
      });
    }
    if (main.path.includes("/") && input.target === "arxiv") {
      add({
        id: "main-root",
        category: "portability",
        status: "warning",
        title: "Main file is not at the project root",
        detail:
          "arXiv builds are simplest when the main .tex file is at the root.",
        filePath: main.path,
      });
    }
  }

  if (input.compileError) {
    add({
      id: "compile-error",
      category: "build",
      status: "blocker",
      title: "The current project has a compile error",
      detail: input.compileError.slice(0, 240),
    });
  } else {
    add({
      id: "compile-ok",
      category: "build",
      status: "pass",
      title: "Latest build produced no fatal compile error",
      detail: "Local pdfLaTeX/XeLaTeX/LuaLaTeX build only.",
    });
  }

  const errorDiagnostics = input.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  );
  if (errorDiagnostics.length > 0) {
    add({
      id: "diagnostics-errors",
      category: "build",
      status: "blocker",
      title: `${errorDiagnostics.length} compile error${
        errorDiagnostics.length === 1 ? "" : "s"
      } remain`,
      detail: errorDiagnostics[0]!.message,
      filePath: errorDiagnostics[0]!.filePath ?? undefined,
      line: errorDiagnostics[0]!.line ?? undefined,
    });
  }

  const missingRefs = input.diagnostics.filter(
    (diagnostic) =>
      diagnostic.kind === "undefined-reference" ||
      diagnostic.kind === "undefined-citation",
  );
  if (missingRefs.length > 0) {
    add({
      id: "references",
      category: "references",
      status: "blocker",
      title: "Undefined references or citations",
      detail: `${missingRefs.length} unresolved reference/citation warning${
        missingRefs.length === 1 ? "" : "s"
      }.`,
      filePath: missingRefs[0]!.filePath ?? undefined,
      line: missingRefs[0]!.line ?? undefined,
    });
  }

  const inputRegex = /\\(?:input|include)\s*\{([^}]+)\}/g;
  for (const file of texFiles) {
    for (const match of (file.content ?? "").matchAll(inputRegex)) {
      const target = match[1]!.trim();
      if (target.includes("\\")) continue;
      if (!resolveProjectPath(file.path, target, input.files)) {
        add({
          id: `missing-input-${file.path}-${target}`,
          category: "structure",
          status: "blocker",
          title: "Included file is missing",
          detail: `${file.path} includes ${target}, but it is not in the project.`,
          filePath: file.path,
          line: lineFor(file.content ?? "", match.index ?? 0),
        });
      }
    }
  }

  const graphicRegex = /\\includegraphics(?:\s*\[[^\]]*\])?\s*\{([^}]+)\}/g;
  for (const file of texFiles) {
    for (const match of (file.content ?? "").matchAll(graphicRegex)) {
      const target = match[1]!.trim();
      if (target.includes("\\")) continue;

      const found = resolveProjectPath(file.path, target, input.files);
      if (!found) {
        add({
          id: `missing-graphic-${file.path}-${target}`,
          category: "figures",
          status: "blocker",
          title: "Figure file is missing",
          detail: target,
          filePath: file.path,
          line: lineFor(file.content ?? "", match.index ?? 0),
        });
        continue;
      }

      if (found.path !== target.replace(/^\.\//, "")) {
        add({
          id: `case-path-${file.path}-${target}`,
          category: "portability",
          status: "warning",
          title: "Figure reference is not an exact-case path",
          detail: `${target} resolves only case-insensitively to ${found.path}.`,
          filePath: file.path,
          line: lineFor(file.content ?? "", match.index ?? 0),
        });
      }
    }
  }

  const bibRegex = /\\bibliography\s*\{([^}]+)\}/g;
  for (const file of texFiles) {
    for (const match of (file.content ?? "").matchAll(bibRegex)) {
      for (const name of match[1]!.split(",")) {
        const target = name.trim().endsWith(".bib")
          ? name.trim()
          : `${name.trim()}.bib`;
        if (!resolveProjectPath(file.path, target, input.files)) {
          add({
            id: `missing-bib-${file.path}-${target}`,
            category: "references",
            status: "blocker",
            title: "Bibliography file is missing",
            detail: target,
            filePath: file.path,
            line: lineFor(file.content ?? "", match.index ?? 0),
          });
        }
      }
    }
  }

  if (
    /\\(?:usepackage|RequirePackage)(?:\[[^\]]*\])?\{fontspec\}/.test(
      content,
    ) &&
    input.compiler === "pdflatex"
  ) {
    add({
      id: "fontspec-compiler",
      category: "portability",
      status: "warning",
      title: "fontspec is used with pdfLaTeX",
      detail: "Switch to XeLaTeX or LuaLaTeX for fontspec.",
      filePath: main?.path,
    });
  }

  if (
    /\\(?:usepackage|RequirePackage)(?:\[[^\]]*\])?\{minted\}|\\write18|\\ShellEscape|\\tikzexternalize/.test(
      content,
    )
  ) {
    add({
      id: "shell-escape",
      category: "portability",
      status: "warning",
      title: "Shell-escape or externalization feature detected",
      detail:
        "Portals may disable minted, shell escape, or TikZ externalization.",
      filePath: main?.path,
    });
  }

  if (
    /\\documentclass(?:\[[^\]]*\])?\{[^}]*\}/.test(content) &&
    /draft/.test(content.match(/\\documentclass\s*\[([^\]]*)\]/)?.[1] ?? "")
  ) {
    add({
      id: "draft-option",
      category: "hygiene",
      status: "warning",
      title: "draft option is still enabled",
      detail: "Remove draft mode before submission.",
      filePath: main?.path,
    });
  }

  if (/\bTODO\b|\bFIXME\b|\bXXX\b/.test(content)) {
    add({
      id: "todos",
      category: "hygiene",
      status: "warning",
      title: "TODO/FIXME markers remain",
      detail: "Search the source for unfinished notes.",
      filePath: main?.path,
    });
  }

  if (input.anonymous) {
    const anonymityRegex =
      /\\author\s*\{|\\affiliation\s*\{|\\institute\s*\{|\\email\s*\{|\\thanks\s*\{|acknowledg|funding|orcid|pdfauthor|https?:\/\//gi;
    const matches = content.match(anonymityRegex) ?? [];
    if (matches.length > 0) {
      add({
        id: "anonymity",
        category: "anonymity",
        status: "warning",
        title: "Identity markers may be present",
        detail: `${matches.length} author/affiliation/acknowledgment/URL marker${
          matches.length === 1 ? "" : "s"
        } found in the main file. Review before double-blind submission.`,
        filePath: main?.path,
      });
    }
  }

  const bundle = input.files
    .filter((file) => !ARTIFACT_EXTENSIONS.has(extension(file.path)))
    .map((file) => ({
      path: file.path,
      kind: fileKind(file.path),
      bytes: fileBytes(file),
    }));
  const bundleBytes = bundle.reduce((sum, entry) => sum + entry.bytes, 0);

  if (bundleBytes > 50 * 1024 * 1024) {
    add({
      id: "bundle-size",
      category: "portability",
      status: "blocker",
      title: "Source bundle exceeds 50 MB",
      detail: "Remove unnecessary large figures or split the project.",
    });
  } else if (bundleBytes > 40 * 1024 * 1024) {
    add({
      id: "bundle-size-warning",
      category: "portability",
      status: "warning",
      title: "Source bundle is close to 50 MB",
      detail: "Review the manifest before uploading.",
    });
  }

  if (checks.every((check) => check.status === "pass")) {
    add({
      id: "submission-clean",
      category: "build",
      status: "pass",
      title: "No blocking issues found locally",
      detail: "This is a local heuristic check, not a guarantee of acceptance.",
    });
  }

  const counts: Record<CheckStatus, number> = {
    pass: 0,
    warning: 0,
    blocker: 0,
  };
  for (const check of checks) counts[check.status]++;

  return {
    target: input.target,
    mainFilePath: main?.path ?? null,
    checks: [
      ...checks.filter((check) => check.status === "blocker"),
      ...checks.filter((check) => check.status === "warning"),
      ...checks.filter((check) => check.status === "pass"),
    ],
    counts,
    bundle,
    bundleBytes,
  };
}

// Minimal store-only ZIP writer. No external dependency and no compression.
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()): { date: number; time: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
  };
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function u16(value: number): Uint8Array {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

export function createSourceZip(
  files: ProjectFile[],
  pdf?: { path: string; data: Uint8Array } | null,
): Uint8Array {
  const entries = files
    .filter((file) => !ARTIFACT_EXTENSIONS.has(extension(file.path)))
    .map((file) => {
      let data: Uint8Array | null = null;
      if (file.content) {
        data = new TextEncoder().encode(file.content);
      } else if (file.dataUrl) {
        const base64 = file.dataUrl.split(",")[1] ?? "";
        const binary = atob(base64);
        data = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      }
      return data ? { path: file.path, data } : null;
    })
    .filter((entry): entry is { path: string; data: Uint8Array } =>
      Boolean(entry),
    );

  if (pdf) {
    entries.push({ path: pdf.path, data: pdf.data });
  }

  const { date, time } = dosDateTime();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.path);
    const crc = crc32(entry.data);
    const local = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(time),
      u16(date),
      u32(crc),
      u32(entry.data.length),
      u32(entry.data.length),
      u16(name.length),
      u16(0),
      name,
      entry.data,
    ]);
    locals.push(local);

    centrals.push(
      concatBytes([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(time),
        u16(date),
        u32(crc),
        u32(entry.data.length),
        u32(entry.data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]),
    );

    offset += local.length;
  }

  const central = concatBytes(centrals);
  const end = concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(central.length),
    u32(offset),
    u16(0),
  ]);

  return concatBytes([...locals, central, end]);
}
