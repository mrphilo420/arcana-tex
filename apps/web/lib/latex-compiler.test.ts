import { describe, expect, it } from "vitest";
import { gatherResources } from "@/lib/latex-compiler";
import type { ProjectFile } from "@/lib/project-files";

function file(
  path: string,
  content: string,
  type: ProjectFile["type"] = "tex",
): ProjectFile {
  return {
    id: path,
    name: path.split("/").pop() ?? path,
    path,
    type,
    content,
  };
}

describe("gatherResources", () => {
  it("keeps LaTeX sources and data but excludes other language sources", () => {
    const resources = gatherResources(
      [
        file("main.tex", "\\documentclass{article}"),
        file("refs.bib", "@article{x}"),
        file("figure.tikz", "\\draw (0,0);"),
        file("data.csv", "x,y\n1,2"),
        file("Proof.lean", "theorem x : True := by trivial"),
        file("analysis.py", "print(1)"),
        file("analysis.R", "print(1)"),
        file("notes.md", "# notes"),
      ],
      "main.tex",
    );

    expect(resources.map((resource) => resource.path)).toEqual([
      "main.tex",
      "refs.bib",
      "figure.tikz",
      "data.csv",
    ]);
    expect(resources[0]?.main).toBe(true);
  });
});
