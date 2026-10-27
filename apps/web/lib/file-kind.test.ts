import { describe, expect, it } from "vitest";
import {
  fileKindForName,
  fileKindLabel,
  isLatexPatchableFile,
  isLatexRelatedFile,
} from "@/lib/file-kind";

describe("fileKindForName", () => {
  it("classifies LaTeX documents and support files together", () => {
    for (const name of [
      "paper.tex",
      "paper.ltx",
      "sn-jnl.cls",
      "custom.sty",
      "refs.bib",
      "figure.tikz",
      "figure.pgf",
    ]) {
      expect(fileKindForName(name)).toBe("latex");
      expect(isLatexPatchableFile(name)).toBe(true);
    }
  });

  it("keeps Lean, Python, and R separate from LaTeX", () => {
    expect(fileKindForName("Proof.lean")).toBe("lean");
    expect(fileKindForName("analysis.py")).toBe("python");
    expect(fileKindForName("analysis.R")).toBe("r");
    expect(fileKindForName("report.Rmd")).toBe("r");
    expect(fileKindForName("analysis.rnw")).toBe("r");
    for (const name of ["Proof.lean", "analysis.py", "analysis.R"]) {
      expect(isLatexRelatedFile({ name, path: name })).toBe(false);
    }
  });

  it("classifies Markdown, data, and plain text", () => {
    expect(fileKindForName("notes.md")).toBe("markdown");
    expect(fileKindForName("results.csv")).toBe("data");
    expect(fileKindForName("README.txt")).toBe("text");
    expect(fileKindForName("archive.zip")).toBe("other");
  });

  it("provides display labels", () => {
    expect(fileKindLabel("latex")).toBe("LaTeX");
    expect(fileKindLabel("lean")).toBe("Lean 4");
    expect(fileKindLabel("python")).toBe("Python");
    expect(fileKindLabel("r")).toBe("R");
  });
});
