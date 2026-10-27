import type { ProjectFile } from "@/lib/project-files";

export interface LeanDeclaration {
  kind: string;
  name: string;
  line: number;
}

export interface LeanFileSummary {
  path: string;
  lineCount: number;
  imports: string[];
  namespaces: string[];
  declarations: LeanDeclaration[];
  declarationCount: number;
  sorryLines: number[];
  admitLines: number[];
  axiomCount: number;
  nativeDecideLines: number[];
  unsafe: boolean;
  partial: boolean;
}

export function isLeanFile(file: Pick<ProjectFile, "name" | "path">): boolean {
  return /\.lean$/i.test(file.path || file.name);
}

function stripLeanComments(source: string): string {
  let result = "";
  let depth = 0;

  for (let index = 0; index < source.length; index++) {
    const char = source[index];

    if (depth > 0) {
      if (source.startsWith("/-", index)) {
        depth++;
        index++;
      } else if (source.startsWith("-/", index)) {
        depth--;
        index++;
      } else if (char === "\n") {
        result += "\n";
      }
      continue;
    }

    if (source.startsWith("--", index)) {
      while (index < source.length && source[index] !== "\n") index++;
      result += "\n";
      continue;
    }

    if (source.startsWith("/-", index)) {
      depth = 1;
      index++;
      continue;
    }

    result += char;
  }

  return result;
}

function matchingLines(source: string, pattern: RegExp): number[] {
  return source
    .split("\n")
    .flatMap((line, index) => (pattern.test(line) ? [index + 1] : []));
}

export function summarizeLeanFile(file: ProjectFile): LeanFileSummary {
  const source = file.content ?? "";
  const clean = stripLeanComments(source);
  const lines = clean.split("\n");
  const declarations: LeanDeclaration[] = [];
  const imports: string[] = [];
  const namespaces: string[] = [];

  lines.forEach((line, index) => {
    const importMatch = line.match(/^\s*import\s+(.+)$/);
    if (importMatch?.[1]) imports.push(importMatch[1].trim());

    const namespaceMatch = line.match(/^\s*namespace\s+(\S+)/);
    if (namespaceMatch?.[1]) namespaces.push(namespaceMatch[1]);

    const declarationMatch = line.match(
      /^\s*(?:@\[[^\]]*\]\s*)*(?:(?:private|protected|noncomputable|partial|unsafe|scoped|local|mutual)\s+)*(theorem|lemma|def|abbrev|opaque|axiom|structure|inductive|class|instance|example)\b\s*([^\s({:=]*)/,
    );
    if (!declarationMatch) return;

    const kind = declarationMatch[1] ?? "declaration";
    const name = declarationMatch[2] || `${kind}@${index + 1}`;
    declarations.push({ kind, name, line: index + 1 });
  });

  const axiomCount = declarations.filter(
    (declaration) => declaration.kind === "axiom",
  ).length;

  return {
    path: file.path,
    lineCount: source.split("\n").length,
    imports,
    namespaces,
    declarations,
    declarationCount: declarations.length,
    sorryLines: matchingLines(clean, /\bsorry\b/),
    admitLines: matchingLines(clean, /\badmit\b/),
    axiomCount,
    nativeDecideLines: matchingLines(clean, /\bnative_decide\b/),
    unsafe: /\bunsafe\b/.test(clean),
    partial: /\bpartial\b/.test(clean),
  };
}

export function summarizeLeanFiles(files: ProjectFile[]): LeanFileSummary[] {
  return files
    .filter(isLeanFile)
    .map(summarizeLeanFile)
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function formatLeanSummaries(summaries: LeanFileSummary[]): string {
  return summaries
    .map((summary) => {
      const declarations = summary.declarations
        .slice(0, 14)
        .map(
          (declaration) =>
            `${declaration.kind} ${declaration.name} (line ${declaration.line})`,
        )
        .join(", ");
      const incomplete = [
        summary.sorryLines.length
          ? `sorry at lines ${summary.sorryLines.join(", ")}`
          : null,
        summary.admitLines.length
          ? `admit at lines ${summary.admitLines.join(", ")}`
          : null,
        summary.axiomCount
          ? `${summary.axiomCount} axiom declaration${summary.axiomCount === 1 ? "" : "s"}`
          : null,
        summary.nativeDecideLines.length
          ? `native_decide at lines ${summary.nativeDecideLines.join(", ")}`
          : null,
        summary.unsafe ? "unsafe declarations" : null,
        summary.partial ? "partial definitions" : null,
      ].filter(Boolean);

      return [
        `- ${summary.path}: ${summary.lineCount} lines, ${summary.declarationCount} declarations`,
        summary.imports.length
          ? `  imports: ${summary.imports.join(", ")}`
          : null,
        declarations ? `  declarations: ${declarations}` : null,
        incomplete.length ? `  check: ${incomplete.join("; ")}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
}

export const LEAN_PROJECT_STORAGE_KEY = "open-prism:lean-project-path";
export const LEAN_TOOLCHAIN_STORAGE_KEY = "open-prism:lean-toolchain";
