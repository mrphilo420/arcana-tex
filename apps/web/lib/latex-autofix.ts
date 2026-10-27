import type { CompileDiagnostic } from "@/lib/compile-diagnostics";
import type { ProjectFile } from "@/lib/project-files";

export interface AutoFixUpdate {
  id: string;
  content: string;
}

export interface AutoFixResult {
  updates: AutoFixUpdate[];
  applied: string[];
  skipped: { diagnosticId: string; reason: string }[];
}

interface TextEdit {
  start: number;
  end: number;
  text: string;
}

interface FixInput {
  files: ProjectFile[];
  mainFileId: string | null;
  diagnostics: CompileDiagnostic[];
  diagnosticId?: string;
}

const BUILT_IN_ENVIRONMENTS = new Set([
  "document",
  "abstract",
  "figure",
  "figure*",
  "table",
  "table*",
  "tabular",
  "tabular*",
  "tabularx",
  "itemize",
  "enumerate",
  "description",
  "center",
  "flushleft",
  "flushright",
  "minipage",
  "quote",
  "quotation",
  "verse",
  "verbatim",
  "verbatim*",
  "math",
  "displaymath",
  "equation",
  "equation*",
  "eqnarray",
  "eqnarray*",
]);

const ENVIRONMENT_PACKAGES: Record<string, string> = {
  align: "amsmath",
  "align*": "amsmath",
  alignat: "amsmath",
  "alignat*": "amsmath",
  gather: "amsmath",
  "gather*": "amsmath",
  multline: "amsmath",
  "multline*": "amsmath",
  split: "amsmath",
  cases: "amsmath",
  matrix: "amsmath",
  pmatrix: "amsmath",
  bmatrix: "amsmath",
  vmatrix: "amsmath",
  Vmatrix: "amsmath",
  smallmatrix: "amsmath",
  subequations: "amsmath",
  tikzpicture: "tikz",
  tikzcd: "tikz-cd",
  multicols: "multicol",
  "multicols*": "multicol",
  lstlisting: "listings",
  algorithm: "algorithm",
  algorithmic: "algorithmic",
};

const COMMAND_PACKAGES: Record<string, string> = {
  text: "amsmath",
  operatorname: "amsmath",
  dfrac: "amsmath",
  tfrac: "amsmath",
  binom: "amsmath",
  substack: "amsmath",
  overbrace: "amsmath",
  underbrace: "amsmath",
  mathbb: "amssymb",
  mathfrak: "amssymb",
  checkmark: "amssymb",
  square: "amssymb",
  Box: "amssymb",
  includegraphics: "graphicx",
  rotatebox: "graphicx",
  resizebox: "graphicx",
  scalebox: "graphicx",
  url: "hyperref",
  href: "hyperref",
  textcolor: "xcolor",
  colorbox: "xcolor",
  fcolorbox: "xcolor",
  tikz: "tikz",
  draw: "tikz",
  node: "tikz",
  toprule: "booktabs",
  midrule: "booktabs",
  bottomrule: "booktabs",
  cmidrule: "booktabs",
  SI: "siunitx",
  si: "siunitx",
  qty: "siunitx",
  num: "siunitx",
  unit: "siunitx",
  bm: "bm",
  nicefrac: "nicefrac",
  multirow: "multirow",
  lipsum: "lipsum",
  lstinputlisting: "listings",
  lstlisting: "listings",
};

const THEOREM_LIKE = new Set([
  "theorem",
  "lemma",
  "corollary",
  "definition",
  "proposition",
  "remark",
  "example",
  "conjecture",
  "claim",
  "assumption",
  "observation",
  "notation",
  "exercise",
  "problem",
  "solution",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeGraphicPath(value: string): string {
  return value
    .trim()
    .replace(/^[`'"]+|[`'"]+$/g, "")
    .replace(/^\.\//, "")
    .replace(/\\/g, "/")
    .replace(/\.(pdf|png|jpe?g|eps|svg|gif)$/i, "")
    .toLowerCase();
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isCommented(content: string, index: number): boolean {
  const lineStart = content.lastIndexOf("\n", index - 1) + 1;
  const before = content.slice(lineStart, index);
  const commentIndex = before.search(/(?<!\\)%/);
  return commentIndex !== -1;
}

function insertBeforeBeginDocument(
  content: string,
  block: string,
): string | null {
  const marker = "\\begin{document}";
  const index = content.indexOf(marker);

  if (index !== -1) {
    const prefix = content.slice(0, index).endsWith("\n") ? "" : "\n";
    return `${content.slice(0, index)}${prefix}${block}\n${content.slice(index)}`;
  }

  const documentClass = content.match(
    /\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/,
  );
  if (documentClass?.index !== undefined) {
    const lineEnd = content.indexOf("\n", documentClass.index);
    if (lineEnd !== -1) {
      return (
        content.slice(0, lineEnd + 1) +
        `${block}\n` +
        content.slice(lineEnd + 1)
      );
    }
  }

  return `${block}\n${content}`;
}

function isPackageLoaded(
  contents: Map<string, string>,
  packageName: string,
): boolean {
  const regex = new RegExp(
    `\\\\usepackage(?:\\[[^\\]]*\\])?\\{[^}]*\\b${escapeRegExp(packageName)}\\b[^}]*\\}`,
  );
  return [...contents.values()].some((content) => regex.test(content));
}

function addPackage(
  content: string,
  packageName: string,
  reason: string,
): string | null {
  if (!packageName) return null;

  const alreadyLoaded = new RegExp(
    `\\\\usepackage(?:\\[[^\\]]*\\])?\\{[^}]*\\b${escapeRegExp(packageName)}\\b[^}]*\\}`,
  ).test(content);
  if (alreadyLoaded) return null;

  return insertBeforeBeginDocument(
    content,
    `% Auto-fix: ${reason}\n\\usepackage{${packageName}}`,
  );
}

function findGraphicCommands(
  content: string,
): { start: number; end: number; path: string }[] {
  const matches: { start: number; end: number; path: string }[] = [];
  const regex = /\\includegraphics\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}/g;

  for (const match of content.matchAll(regex)) {
    if (match.index === undefined) continue;
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      path: match[1] ?? "",
    });
  }

  return matches;
}

function lineRangeForCommand(
  content: string,
  start: number,
  end: number,
): { start: number; end: number } {
  const lineStart = content.lastIndexOf("\n", start - 1) + 1;
  const nextNewline = content.indexOf("\n", end);
  return {
    start: lineStart,
    end: nextNewline === -1 ? content.length : nextNewline,
  };
}

function commentLineEdit(
  content: string,
  start: number,
  end: number,
  reason: string,
): TextEdit {
  const range = lineRangeForCommand(content, start, end);
  const segment = content.slice(range.start, range.end);
  const commented = segment
    .split("\n")
    .map((line) => (line.trimStart().startsWith("%") ? line : `% ${line}`))
    .join("\n");

  return {
    start: range.start,
    end: range.end,
    text: `% Auto-fix: ${reason}\n${commented}`,
  };
}

function applyEdits(content: string, edits: TextEdit[]): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start || b.end - a.end);
  let result = content;
  for (const edit of sorted) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  }
  return result;
}

function findPackageCommands(
  content: string,
): { start: number; end: number; options: string; packages: string[] }[] {
  const commands: {
    start: number;
    end: number;
    options: string;
    packages: string[];
  }[] = [];
  const regex =
    /\\(?:usepackage|RequirePackage)\s*(?:\[([^\]]*)\])?\s*\{([^}]*)\}/g;

  for (const match of content.matchAll(regex)) {
    if (match.index === undefined) continue;
    commands.push({
      start: match.index,
      end: match.index + match[0].length,
      options: match[1] ?? "",
      packages: (match[2] ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    });
  }

  return commands;
}

function graphEnvironmentTokens(
  content: string,
): { kind: "begin" | "end"; env: string; start: number; end: number }[] {
  const tokens: {
    kind: "begin" | "end";
    env: string;
    start: number;
    end: number;
  }[] = [];
  const regex = /\\(begin|end)\{([^}]+)\}/g;

  for (const match of content.matchAll(regex)) {
    if (match.index === undefined || isCommented(content, match.index)) {
      continue;
    }
    tokens.push({
      kind: match[1] as "begin" | "end",
      env: match[2],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return tokens;
}

function balanceEnvironments(
  content: string,
  reason: string,
): { content: string; changes: number } {
  // Code listings often contain literal \begin / \end tokens. Do not rewrite
  // files that use them.
  if (/\\(?:begin)\{(?:verbatim\*?|lstlisting|minted)\}/.test(content)) {
    return { content, changes: 0 };
  }

  const tokens = graphEnvironmentTokens(content).filter(
    (token) => token.env !== "document",
  );
  const stack: { env: string; start: number }[] = [];
  const edits: TextEdit[] = [];
  let changes = 0;

  for (const token of tokens) {
    if (token.kind === "begin") {
      stack.push({ env: token.env, start: token.start });
      continue;
    }

    const top = stack[stack.length - 1];
    if (top?.env === token.env) {
      stack.pop();
      continue;
    }

    const matchingIndex = stack.findLastIndex((item) => item.env === token.env);

    if (matchingIndex === -1) {
      edits.push(
        commentLineEdit(
          content,
          token.start,
          token.end,
          `${reason}: unmatched \\end{${token.env}}`,
        ),
      );
      changes++;
      continue;
    }

    const inner = stack.slice(matchingIndex + 1);
    if (inner.length > 0) {
      const insertion = [...inner]
        .reverse()
        .map((item) => `\\end{${item.env}}`)
        .join("\n");
      edits.push({
        start: token.start,
        end: token.start,
        text: `% Auto-fix: close nested environments\n${insertion}\n`,
      });
      changes += inner.length;
      stack.splice(matchingIndex);
    } else {
      stack.pop();
    }
  }

  if (stack.length > 0) {
    const insertion = [...stack]
      .reverse()
      .map((item) => `\\end{${item.env}}`)
      .join("\n");
    const endDocument = content.lastIndexOf("\\end{document}");
    const start = endDocument === -1 ? content.length : endDocument;
    edits.push({
      start,
      end: start,
      text: `% Auto-fix: close unclosed environments\n${insertion}\n`,
    });
    changes += stack.length;
  }

  if (edits.length === 0) return { content, changes: 0 };

  return {
    content: applyEdits(content, edits),
    changes,
  };
}

function commentMissingGraphic(
  content: string,
  file: string,
): { content: string; count: number } {
  const target = normalizeGraphicPath(file);
  const matches = findGraphicCommands(content).filter((command) => {
    const current = normalizeGraphicPath(command.path);
    return (
      current === target ||
      current.endsWith(`/${target}`) ||
      target.endsWith(`/${current}`)
    );
  });

  if (matches.length === 0) return { content, count: 0 };

  const edits = matches.map((match) =>
    commentLineEdit(
      content,
      match.start,
      match.end,
      `missing graphic ${match.path || file}`,
    ),
  );

  return { content: applyEdits(content, edits), count: edits.length };
}

function addTheoremEnvironment(
  content: string,
  environment: string,
): string | null {
  const starred = environment.endsWith("*");
  const name = starred ? environment.slice(0, -1) : environment;
  if (!name) return null;

  const command = starred
    ? `\\newtheorem*{${name}}{${titleCase(name)}}`
    : `\\newtheorem{${name}}{${titleCase(name)}}`;

  if (content.includes(command)) return null;

  const preamble = content.slice(0, content.indexOf("\\begin{document}"));
  if (
    preamble.includes(`\\newtheorem{${name}}`) ||
    preamble.includes(`\\newtheorem*{${name}}`)
  ) {
    return null;
  }

  let next = content;
  if (
    starred &&
    !/\\usepackage(?:\[[^\]]*\])?\{[^}]*\bamsthm\b[^}]*\}/.test(next)
  ) {
    next = insertBeforeBeginDocument(next, "\\usepackage{amsthm}") ?? next;
  }

  return insertBeforeBeginDocument(
    next,
    `% Auto-fix: define missing environment ${environment}\n${command}`,
  );
}

function findCommandDefinitionRanges(
  content: string,
  command: string,
): { start: number; end: number }[] {
  const patterns = [
    `\\newcommand{\\${command}}`,
    `\\renewcommand{\\${command}}`,
    `\\providecommand{\\${command}}`,
    `\\DeclareMathOperator{\\${command}}`,
  ];
  const ranges: { start: number; end: number }[] = [];

  for (const pattern of patterns) {
    let index = content.indexOf(pattern);
    while (index !== -1) {
      const lineStart = content.lastIndexOf("\n", index - 1) + 1;
      const lineEnd = content.indexOf("\n", index);
      const end = lineEnd === -1 ? content.length : lineEnd;
      const line = content.slice(lineStart, end);
      let depth = 0;
      for (const character of line) {
        if (character === "{") depth++;
        if (character === "}") depth--;
      }
      if (depth === 0) ranges.push({ start: lineStart, end });
      index = content.indexOf(pattern, index + pattern.length);
    }
  }

  return ranges.sort((a, b) => a.start - b.start);
}

export interface AutoFixDiff {
  fileId: string;
  filePath: string;
  startLine: number;
  removed: string[];
  added: string[];
}

export interface AutoFixPreview {
  diagnosticId: string;
  description: string | null;
  updates: AutoFixDiff[];
  applied: string[];
}

function lineDiff(
  before: string,
  after: string,
): Omit<AutoFixDiff, "fileId" | "filePath"> {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  let start = 0;

  while (
    start < beforeLines.length &&
    start < afterLines.length &&
    beforeLines[start] === afterLines[start]
  ) {
    start++;
  }

  let beforeEnd = beforeLines.length - 1;
  let afterEnd = afterLines.length - 1;

  while (
    beforeEnd >= start &&
    afterEnd >= start &&
    beforeLines[beforeEnd] === afterLines[afterEnd]
  ) {
    beforeEnd--;
    afterEnd--;
  }

  return {
    startLine: start + 1,
    removed: beforeLines.slice(start, beforeEnd + 1),
    added: afterLines.slice(start, afterEnd + 1),
  };
}

export function previewAutoFix(input: {
  files: ProjectFile[];
  mainFileId: string | null;
  diagnostics: CompileDiagnostic[];
  diagnosticId: string;
}): AutoFixPreview {
  const diagnostic = input.diagnostics.find(
    (item) => item.id === input.diagnosticId,
  );
  const result = runAutoFixes(input);

  return {
    diagnosticId: input.diagnosticId,
    description: diagnostic ? describeAutoFix(diagnostic) : null,
    updates: result.updates.flatMap((update) => {
      const file = input.files.find((candidate) => candidate.id === update.id);
      if (!file) return [];
      return [
        {
          fileId: update.id,
          filePath: file.path,
          ...lineDiff(file.content ?? "", update.content),
        },
      ];
    }),
    applied: result.applied,
  };
}

export function describeAutoFix(diagnostic: CompileDiagnostic): string | null {
  if (diagnostic.severity !== "error") return null;

  switch (diagnostic.kind) {
    case "missing-graphic":
      return "Comment out the missing graphic";
    case "undefined-environment":
      if (diagnostic.data.environment === "proof") {
        return "Load amsthm for the proof environment";
      }
      if (
        diagnostic.data.environment &&
        ENVIRONMENT_PACKAGES[diagnostic.data.environment]
      ) {
        return `Load ${ENVIRONMENT_PACKAGES[diagnostic.data.environment]} for this environment`;
      }
      return "Define the theorem environment";
    case "environment-mismatch":
      return "Balance the environment blocks";
    case "missing-package":
      return "Remove the missing package call";
    case "undefined-command":
      if (
        diagnostic.data.command &&
        COMMAND_PACKAGES[diagnostic.data.command]
      ) {
        return `Load ${COMMAND_PACKAGES[diagnostic.data.command]} for this command`;
      }
      return null;
    case "duplicate-command":
      return "Comment out the duplicate definition";
    default:
      return null;
  }
}

export function runAutoFixes(input: FixInput): AutoFixResult {
  const texFiles = input.files.filter((file) => file.type === "tex");
  const mainFile =
    texFiles.find((file) => file.id === input.mainFileId) ??
    texFiles.find((file) =>
      (file.content ?? "").includes("\\begin{document}"),
    ) ??
    texFiles[0] ??
    null;

  if (!mainFile) {
    return {
      updates: [],
      applied: [],
      skipped: input.diagnostics.map((diagnostic) => ({
        diagnosticId: diagnostic.id,
        reason: "No LaTeX source file found",
      })),
    };
  }

  const contents = new Map(
    texFiles.map((file) => [file.id, file.content ?? ""]),
  );
  const applied: string[] = [];
  const skipped: { diagnosticId: string; reason: string }[] = [];
  const seen = new Set<string>();
  const targetDiagnostics = input.diagnosticId
    ? input.diagnostics.filter(
        (diagnostic) => diagnostic.id === input.diagnosticId,
      )
    : input.diagnostics;

  const updateMain = (next: string | null, message: string) => {
    if (!next || next === contents.get(mainFile.id)) return false;
    contents.set(mainFile.id, next);
    applied.push(message);
    return true;
  };

  for (const diagnostic of targetDiagnostics) {
    if (diagnostic.severity !== "error") {
      skipped.push({
        diagnosticId: diagnostic.id,
        reason: "Warnings are reported but are not auto-fixed",
      });
      continue;
    }

    const key = `${diagnostic.kind}:${diagnostic.data.environment ?? ""}:${diagnostic.data.begin ?? ""}:${diagnostic.data.end ?? ""}:${diagnostic.data.file ?? ""}:${diagnostic.data.command ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let changed = false;

    if (diagnostic.kind === "missing-graphic") {
      if (!diagnostic.data.file) {
        skipped.push({
          diagnosticId: diagnostic.id,
          reason: "The log did not include a graphic path",
        });
        continue;
      }

      let count = 0;
      for (const file of texFiles) {
        const next = contents.get(file.id) ?? "";
        const result = commentMissingGraphic(next, diagnostic.data.file);
        if (result.count > 0) {
          contents.set(file.id, result.content);
          count += result.count;
        }
      }

      if (count > 0) {
        applied.push(
          `Commented out ${count} missing graphic${count === 1 ? "" : "s"}`,
        );
        changed = true;
      }
    } else if (diagnostic.kind === "undefined-environment") {
      const environment = diagnostic.data.environment;
      if (!environment) {
        skipped.push({
          diagnosticId: diagnostic.id,
          reason: "The log did not name the environment",
        });
        continue;
      }

      const packageName =
        environment === "proof" ? "amsthm" : ENVIRONMENT_PACKAGES[environment];

      if (packageName) {
        if (isPackageLoaded(contents, packageName)) {
          skipped.push({
            diagnosticId: diagnostic.id,
            reason: `${packageName} is already loaded; this environment needs a manual definition`,
          });
          continue;
        }

        const next = addPackage(
          contents.get(mainFile.id) ?? "",
          packageName,
          `environment ${environment}`,
        );
        if (updateMain(next, `Loaded ${packageName} for ${environment}`)) {
          changed = true;
        }
      } else if (
        THEOREM_LIKE.has(environment.replace(/\*$/, "")) ||
        environment.endsWith("*")
      ) {
        const next = addTheoremEnvironment(
          contents.get(mainFile.id) ?? "",
          environment,
        );
        if (updateMain(next, `Defined environment ${environment}`)) {
          changed = true;
        }
      } else if (!BUILT_IN_ENVIRONMENTS.has(environment)) {
        const next = addTheoremEnvironment(
          contents.get(mainFile.id) ?? "",
          environment,
        );
        if (updateMain(next, `Defined environment ${environment}`)) {
          changed = true;
        }
      }
    } else if (diagnostic.kind === "environment-mismatch") {
      let count = 0;
      for (const file of texFiles) {
        const next = contents.get(file.id) ?? "";
        const balanced = balanceEnvironments(next, "environment mismatch");
        if (balanced.changes > 0) {
          contents.set(file.id, balanced.content);
          count += balanced.changes;
        }
      }
      if (count > 0) {
        applied.push(
          `Balanced ${count} environment block${count === 1 ? "" : "s"}`,
        );
        changed = true;
      }
    } else if (diagnostic.kind === "missing-package") {
      const packageName =
        diagnostic.data.package ??
        diagnostic.data.file
          ?.split("/")
          .pop()
          ?.replace(/\.sty$/i, "");
      if (!packageName) {
        skipped.push({
          diagnosticId: diagnostic.id,
          reason: "The log did not name the package",
        });
        continue;
      }

      let count = 0;
      for (const file of texFiles) {
        const next = contents.get(file.id) ?? "";
        const result = removeMissingPackageCalls(next, packageName);
        if (result.count > 0) {
          contents.set(file.id, result.content);
          count += result.count;
        }
      }
      if (count > 0) {
        applied.push(`Removed missing package ${packageName}`);
        changed = true;
      }
    } else if (diagnostic.kind === "undefined-command") {
      const command = diagnostic.data.command;
      const packageName = command ? COMMAND_PACKAGES[command] : undefined;

      if (!command || !packageName) {
        skipped.push({
          diagnosticId: diagnostic.id,
          reason: "No deterministic package mapping for this command",
        });
        continue;
      }

      if (isPackageLoaded(contents, packageName)) {
        skipped.push({
          diagnosticId: diagnostic.id,
          reason: `${packageName} is already loaded; this command needs a manual fix`,
        });
        continue;
      }

      const next = addPackage(
        contents.get(mainFile.id) ?? "",
        packageName,
        `command \\${command}`,
      );
      if (updateMain(next, `Loaded ${packageName} for \\${command}`)) {
        changed = true;
      }
    } else if (diagnostic.kind === "duplicate-command") {
      const command = diagnostic.data.command;
      if (!command) {
        skipped.push({
          diagnosticId: diagnostic.id,
          reason: "The log did not name the duplicate command",
        });
        continue;
      }

      for (const file of texFiles) {
        const next = contents.get(file.id) ?? "";
        const ranges = findCommandDefinitionRanges(next, command);
        if (ranges.length > 1) {
          const edits = ranges
            .slice(1)
            .map((range) =>
              commentLineEdit(
                next,
                range.start,
                range.end,
                `duplicate command \\${command}`,
              ),
            );
          contents.set(file.id, applyEdits(next, edits));
          applied.push(
            `Commented ${edits.length} duplicate definition${edits.length === 1 ? "" : "s"} of \\${command}`,
          );
          changed = true;
          break;
        }
      }
    }

    if (!changed) {
      skipped.push({
        diagnosticId: diagnostic.id,
        reason: "No deterministic safe fix matched this diagnostic",
      });
    }
  }

  return {
    updates: texFiles
      .filter((file) => contents.get(file.id) !== (file.content ?? ""))
      .map((file) => ({
        id: file.id,
        content: contents.get(file.id) ?? "",
      })),
    applied,
    skipped,
  };
}

function removeMissingPackageCalls(
  content: string,
  packageName: string,
): { content: string; count: number } {
  const commands = findPackageCommands(content).filter((command) =>
    command.packages.includes(packageName),
  );

  if (commands.length === 0) return { content, count: 0 };

  const edits: TextEdit[] = [];

  for (const command of commands) {
    const remaining = command.packages.filter((item) => item !== packageName);

    if (remaining.length === 0) {
      edits.push(
        commentLineEdit(
          content,
          command.start,
          command.end,
          `missing package ${packageName}`,
        ),
      );
    } else {
      const options = command.options ? `[${command.options}]` : "";
      edits.push({
        start: command.start,
        end: command.end,
        text: `\\usepackage${options}{${remaining.join(",")}}`,
      });
    }
  }

  return {
    content: applyEdits(content, edits),
    count: edits.length,
  };
}
