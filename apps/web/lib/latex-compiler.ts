import type { ProjectFile } from "@/lib/project-files";

export type LatexCompiler = "pdflatex" | "xelatex" | "lualatex";

export const LATEX_COMPILERS: { value: LatexCompiler; label: string }[] = [
  { value: "pdflatex", label: "pdfLaTeX" },
  { value: "xelatex", label: "XeLaTeX" },
  { value: "lualatex", label: "LuaLaTeX" },
];

export interface CompileResource {
  path: string;
  content?: string;
  file?: string;
  main?: boolean;
}

function dataUrlToBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return (comma === -1 ? dataUrl : dataUrl.slice(comma + 1)).replace(/\s/g, "");
}

export function gatherResources(
  files: ProjectFile[],
  mainFileId: string | null,
): CompileResource[] {
  const resources: CompileResource[] = [];

  for (const file of files) {
    const path = file.path || file.name;

    if (file.type === "tex") {
      resources.push({
        path,
        content: file.content ?? "",
        main: file.id === mainFileId,
      });
    } else if (file.dataUrl) {
      resources.push({
        path,
        file: dataUrlToBase64(file.dataUrl),
      });
    }
  }

  return resources;
}

export class LatexCompileError extends Error {
  log: string;

  constructor(message: string, log = "") {
    super(message);
    this.name = "LatexCompileError";
    this.log = log;
  }
}

function decodeBase64Pdf(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function compileLatex(
  resources: CompileResource[],
  compiler: LatexCompiler = "pdflatex",
): Promise<Uint8Array> {
  const response = await fetch("/api/compile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ compiler, resources }),
  });

  if (!response.ok) {
    const data = await response.json();
    const message = data.details
      ? `${data.error}\n\n${data.details}`
      : data.error || "Compilation failed";
    throw new LatexCompileError(message, data.log ?? data.details ?? "");
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

export async function compileLatexWithLog(
  resources: CompileResource[],
  compiler: LatexCompiler = "pdflatex",
): Promise<{ pdf: Uint8Array; log: string }> {
  const response = await fetch("/api/compile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ compiler, resources, includeLog: true }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    details?: string;
    log?: string;
    pdf?: string;
  };

  if (!response.ok || !data.pdf) {
    const message = data.details
      ? `${data.error || "Compilation failed"}\n\n${data.details}`
      : data.error || "Compilation failed";
    throw new LatexCompileError(message, data.log ?? data.details ?? "");
  }

  return {
    pdf: decodeBase64Pdf(data.pdf),
    log: data.log ?? "",
  };
}
