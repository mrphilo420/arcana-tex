import type { ProjectFile } from "@/lib/project-files";

export interface BeamerFrame {
  fileId: string;
  filePath: string;
  start: number;
  line: number;
  index: number;
  title: string;
  subtitle?: string;
  options?: string;
}

export interface BeamerInfo {
  isBeamer: boolean;
  mainFile: ProjectFile | null;
  frames: BeamerFrame[];
  theme: string;
  colorTheme: string;
  fontTheme: string;
  innerTheme: string;
  outerTheme: string;
  aspectRatio: string;
  navigationSymbols: boolean;
  frameNumbers: boolean;
  transparentCovered: boolean;
  showNotes: boolean;
  handout: boolean;
}

const THEME_RE = (command: string) =>
  new RegExp(`\\\\${command}\\s*\\{([^}]*)\\}`);

function capture(content: string, command: string): string {
  return content.match(THEME_RE(command))?.[1]?.trim() ?? "";
}

function insertBeforeBeginDocument(content: string, block: string): string {
  const marker = "\\begin{document}";
  const index = content.indexOf(marker);
  if (index === -1) return `${content.replace(/\s*$/, "")}\n${block}\n`;

  const prefix = content.slice(0, index).endsWith("\n") ? "" : "\n";
  return `${content.slice(0, index)}${prefix}${block}\n${content.slice(index)}`;
}

export function getBeamerInfo(
  files: ProjectFile[],
  mainFileId: string | null,
): BeamerInfo {
  const texFiles = files.filter((file) => file.type === "tex");
  const selectedMain = texFiles.find((file) => file.id === mainFileId);
  const isBeamerFile = (file: ProjectFile) =>
    /\\documentclass(?:\[[^\]]*\])?\{beamer\}/.test(file.content ?? "") ||
    /\\begin\{frame\}/.test(file.content ?? "") ||
    /\\usetheme\s*\{/.test(file.content ?? "");

  const mainFile =
    (selectedMain && isBeamerFile(selectedMain) ? selectedMain : null) ??
    texFiles.find(isBeamerFile) ??
    selectedMain ??
    texFiles[0] ??
    null;

  const isBeamer = texFiles.some(
    (file) =>
      /\\documentclass(?:\[[^\]]*\])?\{beamer\}/.test(file.content ?? "") ||
      /\\begin\{frame\}/.test(file.content ?? "") ||
      /\\usetheme\s*\{/.test(file.content ?? ""),
  );

  const content = mainFile?.content ?? "";
  const documentClass = content.match(
    /\\documentclass\s*\[([^\]]*)\]\s*\{beamer\}/,
  )?.[1];
  const options = documentClass?.split(",").map((item) => item.trim()) ?? [];
  const aspectOption = options.find((item) => item.startsWith("aspectratio="));

  const frames: BeamerFrame[] = [];
  for (const file of texFiles) {
    const source = file.content ?? "";
    const regex = /\\begin\{frame\}(?:\[([^\]]*)\])?([\s\S]*?)\\end\{frame\}/g;
    let match: RegExpExecArray | null = regex.exec(source);
    let index = 1;

    while (match) {
      const body = match[2] ?? "";
      const title =
        body.match(/\\frametitle\s*\{([^{}]*)\}/)?.[1]?.trim() ||
        (/\\titlepage/.test(body)
          ? "Title slide"
          : /\\sectionpage/.test(body)
            ? "Section divider"
            : `Frame ${index}`);
      const subtitle = body
        .match(/\\framesubtitle\s*\{([^{}]*)\}/)?.[1]
        ?.trim();

      frames.push({
        fileId: file.id,
        filePath: file.path,
        start: match.index,
        line: source.slice(0, match.index).split("\n").length,
        index,
        title,
        subtitle,
        options: match[1],
      });

      index++;
      match = regex.exec(source);
    }
  }

  return {
    isBeamer,
    mainFile,
    frames,
    theme: capture(content, "usetheme") || "default",
    colorTheme: capture(content, "usecolortheme") || "default",
    fontTheme: capture(content, "usefonttheme") || "default",
    innerTheme: capture(content, "useinnertheme") || "default",
    outerTheme: capture(content, "useoutertheme") || "default",
    aspectRatio: aspectOption?.split("=")[1]?.trim() || "43",
    navigationSymbols:
      !/\\setbeamertemplate\s*\{navigation symbols\}\s*\{\s*\}/.test(content),
    frameNumbers:
      /\\setbeamertemplate\s*\{footline\}\s*\[\s*frame number\s*\]/.test(
        content,
      ),
    transparentCovered: /\\setbeamercovered\s*\{transparent\}/.test(content),
    showNotes: /\\setbeameroption\s*\{[^}]*show notes[^}]*\}/.test(content),
    handout: options.includes("handout"),
  };
}

export function setBeamerDocumentOption(
  content: string,
  key: string,
  value: string | null,
): string {
  const match = content.match(/\\documentclass\s*(\[([^\]]*)\])?\s*\{beamer\}/);
  if (!match) return content;

  const options = (match[2] ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const prefix = `${key}=`;
  const next = options.filter(
    (item) => item !== key && !item.startsWith(prefix),
  );

  if (value !== null) next.push(`${key}=${value}`);

  const replacement = `\\documentclass${next.length ? `[${next.join(",")}]` : ""}{beamer}`;
  return (
    content.slice(0, match.index) +
    replacement +
    content.slice(match.index! + match[0].length)
  );
}

export function setBeamerFlag(
  content: string,
  flag: string,
  enabled: boolean,
): string {
  const match = content.match(/\\documentclass\s*(\[([^\]]*)\])?\s*\{beamer\}/);
  if (!match) return content;

  const options = (match[2] ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item !== flag);

  if (enabled) options.push(flag);

  const replacement = `\\documentclass${options.length ? `[${options.join(",")}]` : ""}{beamer}`;
  return (
    content.slice(0, match.index) +
    replacement +
    content.slice(match.index! + match[0].length)
  );
}

export function setBeamerCommand(
  content: string,
  command: string,
  value: string,
): string {
  const regex = THEME_RE(command);
  const line = `\\${command}{${value}}`;

  if (regex.test(content)) {
    return content.replace(regex, line);
  }

  return insertBeforeBeginDocument(content, line);
}

export function setBeamerPreambleCommand(
  content: string,
  command: string,
  value: string,
): string {
  const regex = new RegExp(`\\\\${command}\\s*\\{[^}]*\\}`);
  const line = `\\${command}{${value}}`;

  if (regex.test(content)) {
    return content.replace(regex, line);
  }

  return insertBeforeBeginDocument(content, line);
}

export function insertBeforeEndDocument(
  content: string,
  block: string,
): string {
  const marker = "\\end{document}";
  const index = content.lastIndexOf(marker);
  if (index === -1) return `${content.replace(/\s*$/, "")}\n${block}\n`;

  const prefix = content.slice(0, index).endsWith("\n") ? "" : "\n";
  const suffix = block.endsWith("\n") ? "" : "\n";
  return `${content.slice(0, index)}${prefix}${block}${suffix}${content.slice(index)}`;
}

export function escapeBeamerText(value: string): string {
  return value.replace(/(^|[^\\])([%&#_])/g, "$1\\$2");
}

export function setBeamerToggle(
  content: string,
  kind:
    | "navigationSymbols"
    | "frameNumbers"
    | "transparentCovered"
    | "showNotes",
  enabled: boolean,
): string {
  const blocks: Record<typeof kind, { pattern: RegExp; line: string }> = {
    navigationSymbols: {
      pattern: /\\setbeamertemplate\s*\{navigation symbols\}\s*\{\s*\}\s*\n?/,
      line: "\\setbeamertemplate{navigation symbols}{}",
    },
    frameNumbers: {
      pattern:
        /\\setbeamertemplate\s*\{footline\}\s*\[\s*frame number\s*\]\s*\n?/,
      line: "\\setbeamertemplate{footline}[frame number]",
    },
    transparentCovered: {
      pattern: /\\setbeamercovered\s*\{transparent\}\s*\n?/,
      line: "\\setbeamercovered{transparent}",
    },
    showNotes: {
      pattern: /\\setbeameroption\s*\{[^}]*show notes[^}]*\}\s*\n?/,
      line: "\\setbeameroption{show notes}",
    },
  };

  const block = blocks[kind];

  if (enabled) {
    if (block.pattern.test(content)) return content;
    return insertBeforeBeginDocument(content, block.line);
  }

  return content.replace(block.pattern, "");
}
