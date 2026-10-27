import { describe, expect, it } from "vitest";
import {
  diagnosticLanguage,
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

describe("diagnosticLanguage", () => {
  it("tags diagnostics by their source language", () => {
    expect(diagnosticLanguage(diagnostic({ filePath: "main.tex" }))).toBe(
      "latex",
    );
    expect(
      diagnosticLanguage(diagnostic({ filePath: "figures/plot.py" })),
    ).toBe("python");
    expect(diagnosticLanguage(diagnostic({ filePath: "analysis.R" }))).toBe(
      "r",
    );
    expect(
      diagnosticLanguage(diagnostic({ filePath: "proofs/Proof.lean" })),
    ).toBe("lean");
    expect(diagnosticLanguage(diagnostic({ filePath: "notes.md" }))).toBe(
      "markdown",
    );
  });

  it("uses an explicit language and defaults to LaTeX", () => {
    expect(
      diagnosticLanguage(
        diagnostic({ language: "python", filePath: "main.tex" }),
      ),
    ).toBe("python");
    expect(diagnosticLanguage(diagnostic({}))).toBe("latex");
  });
});
