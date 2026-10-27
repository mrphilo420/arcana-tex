import {
  DEFAULT_PROJECT_NAME,
  DEFAULT_TEX_CONTENT,
} from "@/stores/document-store";
import type { StoredProject } from "@/lib/storage/schema";
import { createProject, listProjects, uniqueProjectName } from "./repository";

export const DEFAULT_BEAMER_CONTENT = `\\documentclass[aspectratio=169]{beamer}
\\usetheme{default}
\\usecolortheme{default}
\\title{Untitled presentation}
\\subtitle{}
\\author{Author}
\\institute{Institution}
\\date{\\today}

\\begin{document}

\\begin{frame}
  \\titlepage
\\end{frame}

\\begin{frame}{Outline}
  \\tableofcontents
\\end{frame}

\\section{Introduction}

\\begin{frame}{Introduction}
  \\begin{itemize}
    \\item Key question
    \\item Why it matters
  \\end{itemize}
\\end{frame}

\\end{document}
`;

export async function createBeamerProject(): Promise<StoredProject> {
  const projects = await listProjects();
  const name = uniqueProjectName(
    "Beamer Presentation",
    projects.map((project) => project.name),
  );

  return createProject({
    name,
    files: [
      {
        name: "presentation.tex",
        path: "presentation.tex",
        type: "tex",
        content: DEFAULT_BEAMER_CONTENT,
      },
    ],
  });
}

export async function createDefaultProject(
  folderId?: string | null,
): Promise<StoredProject> {
  const projects = await listProjects();
  const name = uniqueProjectName(
    DEFAULT_PROJECT_NAME,
    projects.map((project) => project.name),
  );

  return createProject({
    name,
    files: [
      {
        id: "default-tex",
        name: "document.tex",
        path: "document.tex",
        type: "tex",
        content: DEFAULT_TEX_CONTENT,
      },
    ],
    folderId: folderId ?? null,
  });
}
