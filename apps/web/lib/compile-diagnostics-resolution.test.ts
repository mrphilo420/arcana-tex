import { describe, expect, it } from "vitest";
import {
  resolveDiagnosticFiles,
  type CompileDiagnostic,
} from "@/lib/compile-diagnostics";
import type { ProjectFile } from "@/lib/project-files";

const main: ProjectFile = {
  id: "main",
  name: "main.tex",
  path: "main.tex",
  type: "tex",
  content:
    "\\documentclass{article}\n\\begin{document}\nText\n\\end{document}\n",
};

const python: ProjectFile = {
  id: "python",
  name: "make_figure_data.py",
  path: "figures/make_figure_data.py",
  type: "tex",
  content: "from pathlib import Path\nprint(Path(__file__))\n",
};

const diagnostic = (
  overrides: Partial<CompileDiagnostic>,
): CompileDiagnostic => ({
  id: "diag",
  severity: "error",
  kind: "error",
  title: "LaTeX error",
  message: "LaTeX error",
  details: [],
  raw: "",
  data: {},
  ...overrides,
});

describe("resolveDiagnosticFiles", () => {
  it("never attributes LaTeX diagnostics to Python or other source files", () => {
    const [result] = resolveDiagnosticFiles(
      [
        diagnostic({
          filePath: "figures/make_figure_data.py",
          line: 1,
          lineText: "from pathlib import Path",
        }),
      ],
      [main, python],
      "main",
    );

    expect(result.fileId).toBe("main");
    expect(result.filePath).toBe("main.tex");
  });

  it("matches line text only against LaTeX-compatible files", () => {
    const [result] = resolveDiagnosticFiles(
      [
        diagnostic({
          line: 1,
          lineText: "from pathlib import Path",
        }),
      ],
      [main, python],
      "main",
    );

    expect(result.fileId).toBe("main");
  });
});
