import {
  fileKindForName,
  isLatexPatchableFile,
  type FileKind,
} from "@/lib/file-kind";
import type { ProjectFile } from "@/lib/project-files";

export type DiagnosticSeverity = "error" | "warning";

export type DiagnosticKind =
  | "missing-graphic"
  | "undefined-environment"
  | "environment-mismatch"
  | "missing-package"
  | "missing-class"
  | "missing-file"
  | "undefined-command"
  | "duplicate-command"
  | "math-mode"
  | "runaway-argument"
  | "fatal"
  | "undefined-reference"
  | "undefined-citation"
  | "warning"
  | "error";

export interface CompileDiagnostic {
  id: string;
  /** Source language that produced this diagnostic. */
  language?: FileKind;
  severity: DiagnosticSeverity;
  kind: DiagnosticKind;
  title: string;
  message: string;
  details: string[];
  filePath?: string | null;
  fileId?: string | null;
  line?: number | null;
  lineText?: string | null;
  raw: string;
  data: {
    environment?: string;
    begin?: string;
    end?: string;
    file?: string;
    package?: string;
    command?: string;
  };
}


/** Which language a diagnostic belongs to. Older diagnostics fall back to their file path, then LaTeX. */
export function diagnosticLanguage(diagnostic: CompileDiagnostic): FileKind {
  if (diagnostic.language) return diagnostic.language;
  if (diagnostic.filePath) {
    const kind = fileKindForName(diagnostic.filePath);
    if (kind !== "other" && kind !== "text") return kind;
  }
  return "latex";
}

export interface ParseLatexLogOptions {
  mainFilePath?: string | null;
}

export function diagnosticNature(diagnostic: CompileDiagnostic): string {
  switch (diagnostic.kind) {
    case "missing-graphic":
      return "Missing figure";
    case "undefined-environment":
      return "Undefined environment";
    case "environment-mismatch":
      return "Environment mismatch";
    case "missing-package":
      return "Missing package";
    case "missing-class":
      return "Missing class";
    case "missing-file":
      return "Missing file";
    case "undefined-command":
      return "Undefined command";
    case "duplicate-command":
      return "Duplicate definition";
    case "math-mode":
      return "Math mode";
    case "runaway-argument":
      return "Runaway argument";
    case "fatal":
      return "Fatal error";
    case "undefined-reference":
      return "Undefined reference";
    case "undefined-citation":
      return "Undefined citation";
    case "warning":
      return "Warning";
    default:
      return "LaTeX error";
  }
}

function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function cleanPath(value: string | undefined | null): string | null {
  if (!value) return null;
  return value
    .trim()
    .replace(/^[`'"]+|[`'"]+$/g, "")
    .replace(/^\.\//, "")
    .replace(/\\/g, "/");
}

function baseName(value: string): string {
  const parts = value.split("/");
  return parts[parts.length - 1] ?? value;
}

function isDiagnosticStart(line: string): boolean {
  return (
    line.startsWith("! ") ||
    /^[^\s:]+\.(?:tex|ltx):\d+:/i.test(line) ||
    /^(?:LaTeX|Package|Class|LaTeX Font)\s+(?:Warning|Error):/i.test(line) ||
    /^LaTeX Warning:/i.test(line)
  );
}

function isWarningStart(line: string): boolean {
  return (
    /^LaTeX Warning:/i.test(line) ||
    /^(?:Package|Class|LaTeX Font)\s+.*Warning:/i.test(line)
  );
}

function updateCurrentFile(
  line: string,
  current: string | null,
): string | null {
  const matches = [
    ...line.matchAll(/(?:^|[\s(])((?:\.\/)?[^\s()]+\.(?:tex|ltx))/g),
  ];
  if (matches.length === 0) return current;

  const last = matches[matches.length - 1]?.[1];
  return cleanPath(last) ?? current;
}

function parseLineNumber(
  block: string,
  head: string,
): { line: number | null; lineText: string | null } {
  const lineMatch = block.match(/^l\.(\d+)\s*(.*)$/m);
  if (lineMatch) {
    const line = Number(lineMatch[1]);
    return {
      line: Number.isFinite(line) ? line : null,
      lineText: lineMatch[2]?.trim() || null,
    };
  }

  const inputLine = head.match(/on input line (\d+)/i);
  if (inputLine) {
    return { line: Number(inputLine[1]), lineText: null };
  }

  return { line: null, lineText: null };
}

function extractMissingPath(head: string): string | null {
  const patterns = [
    /File\s+[`']([^`']+)[`']\s+not found/i,
    /File\s+([^\s]+)\s+not found/i,
    /`([^`']+\.(?:pdf|png|jpe?g|eps|svg|sty|cls))'/i,
  ];

  for (const pattern of patterns) {
    const match = head.match(pattern);
    if (match?.[1]) return cleanPath(match[1]);
  }

  return null;
}

function classifyError(
  head: string,
  lineText: string | null,
): {
  kind: DiagnosticKind;
  data: CompileDiagnostic["data"];
} {
  const lower = head.toLowerCase();
  const data: CompileDiagnostic["data"] = {};

  const environment = head.match(
    /Environment\s+[`']?([^`'\s]+)'?\s+undefined/i,
  )?.[1];
  if (environment) {
    data.environment = environment;
    return { kind: "undefined-environment", data };
  }

  const mismatch = head.match(
    /\\begin\{([^}]+)\}\s+ended by\s+\\end\{([^}]+)\}/i,
  );
  if (mismatch) {
    data.begin = mismatch[1];
    data.end = mismatch[2];
    return { kind: "environment-mismatch", data };
  }

  const missingPath = extractMissingPath(head);
  if (missingPath) {
    data.file = missingPath;
    if (/\.(sty|cls)$/i.test(missingPath)) {
      if (/\.cls$/i.test(missingPath)) return { kind: "missing-class", data };
      data.package = baseName(missingPath).replace(/\.sty$/i, "");
      return { kind: "missing-package", data };
    }
    if (
      /\.(pdf|png|jpe?g|eps|svg|gif)$/i.test(missingPath) ||
      lower.includes("pdftex.def")
    ) {
      return { kind: "missing-graphic", data };
    }
    return { kind: "missing-file", data };
  }

  const command =
    lineText?.match(/\\([a-zA-Z@]+)/)?.[1] ?? head.match(/\\([a-zA-Z@]+)/)?.[1];
  if (lower.includes("undefined control sequence")) {
    if (command) data.command = command;
    return { kind: "undefined-command", data };
  }

  if (lower.includes("already defined")) {
    if (command) data.command = command;
    return { kind: "duplicate-command", data };
  }

  if (lower.includes("missing $ inserted")) {
    return { kind: "math-mode", data };
  }
  if (lower.includes("runaway argument")) {
    return { kind: "runaway-argument", data };
  }
  if (
    lower.includes("emergency stop") ||
    lower.includes("fatal error occurred") ||
    lower.includes("file ended while scanning")
  ) {
    return { kind: "fatal", data };
  }

  return { kind: "error", data };
}

function classifyWarning(head: string): DiagnosticKind {
  const lower = head.toLowerCase();
  if (lower.includes("reference") && lower.includes("undefined")) {
    return "undefined-reference";
  }
  if (lower.includes("citation") && lower.includes("undefined")) {
    return "undefined-citation";
  }
  return "warning";
}

function shouldSkipWarning(head: string): boolean {
  const lower = head.toLowerCase();
  return (
    lower.includes("there were undefined references") ||
    lower.includes("label(s) may have changed") ||
    lower.includes("rerun to get cross-references right") ||
    lower.startsWith("overfull") ||
    lower.startsWith("underfull")
  );
}

function readDiagnosticBlock(
  lines: string[],
  start: number,
): { block: string[]; next: number } {
  const block = [lines[start]];
  let index = start + 1;
  const limit = Math.min(lines.length, start + 16);

  while (index < limit) {
    const line = lines[index];
    if (isDiagnosticStart(line)) break;
    block.push(line);
    index++;

    if (/^l\.\d+/.test(line)) break;
  }

  return { block, next: index };
}

export function parseLatexLog(
  log: string,
  options: ParseLatexLogOptions = {},
): CompileDiagnostic[] {
  const lines = log.replace(/\r\n/g, "\n").split("\n");
  const diagnostics: CompileDiagnostic[] = [];
  const seen = new Set<string>();
  let currentFile = cleanPath(options.mainFilePath);

  const pushDiagnostic = (
    severity: DiagnosticSeverity,
    kind: DiagnosticKind,
    head: string,
    block: string[],
    data: CompileDiagnostic["data"] = {},
  ) => {
    const title = head.replace(/^!\s*/, "").trim();
    if (!title) return;

    const { line, lineText } = parseLineNumber(block.join("\n"), title);
    const filePath = currentFile ?? cleanPath(options.mainFilePath);
    const details = block
      .slice(1)
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => !/^l\.\d+/.test(item))
      .slice(0, 8);
    const key = `${severity}:${kind}:${title}:${line ?? ""}:${lineText ?? ""}:${data.environment ?? ""}:${data.file ?? ""}:${data.command ?? ""}`;

    if (seen.has(key)) return;
    seen.add(key);

    diagnostics.push({
      id: `diag-${hashString(key)}`,
      language: "latex",
      severity,
      kind,
      title,
      message: title,
      details,
      filePath,
      fileId: null,
      line,
      lineText,
      raw: block.join("\n"),
      data,
    });
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    currentFile = updateCurrentFile(line, currentFile);

    if (line.startsWith("! ")) {
      const { block, next } = readDiagnosticBlock(lines, index);
      const head = line.slice(2).trim();
      const { kind, data } = classifyError(head, block.join("\n"));
      pushDiagnostic("error", kind, head, block, data);
      index = Math.max(index, next - 1);
      continue;
    }

    const fileLineError = line.match(/^([^\s:]+\.(?:tex|ltx)):(\d+):\s*(.*)$/i);
    if (fileLineError) {
      const { block, next } = readDiagnosticBlock(lines, index);
      const head = fileLineError[3]?.trim() || line.trim();
      const { kind, data } = classifyError(head, block.join("\n"));
      pushDiagnostic("error", kind, head, block, data);
      index = Math.max(index, next - 1);
      continue;
    }

    if (isWarningStart(line) && !shouldSkipWarning(line)) {
      const { block, next } = readDiagnosticBlock(lines, index);
      const head = line.trim();
      pushDiagnostic("warning", classifyWarning(head), head, block);
      index = Math.max(index, next - 1);
    }
  }

  const missingFiles = new Set(
    diagnostics
      .filter(
        (diagnostic) => diagnostic.severity === "error" && diagnostic.data.file,
      )
      .map((diagnostic) => diagnostic.data.file!.toLowerCase()),
  );

  return diagnostics
    .filter((diagnostic) => {
      if (diagnostic.severity !== "warning" || missingFiles.size === 0) {
        return true;
      }
      const title = diagnostic.title.toLowerCase();
      return ![...missingFiles].some(
        (file) =>
          title.includes(file) || title.includes(baseName(file).toLowerCase()),
      );
    })
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "error" ? -1 : 1;
      return (a.line ?? 0) - (b.line ?? 0);
    })
    .slice(0, 60);
}

function normalizeForMatch(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\.\.\.$/, "")
    .trim();
}

export function resolveDiagnosticFiles(
  diagnostics: CompileDiagnostic[],
  files: ProjectFile[],
  mainFileId: string | null,
): CompileDiagnostic[] {
  const texFiles = files.filter(
    (file) => file.type === "tex" && isLatexPatchableFile(file.path),
  );
  const mainFile =
    texFiles.find((file) => file.id === mainFileId) ?? texFiles[0] ?? null;

  return diagnostics.map((diagnostic) => {
    if (diagnostic.fileId) return diagnostic;

    const lineText = diagnostic.lineText
      ? normalizeForMatch(diagnostic.lineText)
      : "";

    if (diagnostic.line && lineText) {
      const match = texFiles.find((file) => {
        const lines = (file.content ?? "").split("\n");
        const sourceLine = normalizeForMatch(lines[diagnostic.line! - 1] ?? "");
        return (
          sourceLine === lineText ||
          sourceLine.includes(lineText) ||
          lineText.includes(sourceLine)
        );
      });

      if (match) {
        return { ...diagnostic, fileId: match.id, filePath: match.path };
      }
    }

    if (lineText) {
      const matches = texFiles.filter((file) =>
        (file.content ?? "").includes(lineText),
      );
      if (matches.length === 1) {
        return {
          ...diagnostic,
          fileId: matches[0].id,
          filePath: matches[0].path,
        };
      }
    }

    if (diagnostic.filePath) {
      const match = texFiles.find(
        (file) =>
          file.path === diagnostic.filePath ||
          baseName(file.path) === baseName(diagnostic.filePath!),
      );
      if (match) {
        return { ...diagnostic, fileId: match.id, filePath: match.path };
      }
    }

    if (mainFile) {
      return {
        ...diagnostic,
        fileId: mainFile.id,
        filePath: mainFile.path,
      };
    }

    return diagnostic;
  });
}
