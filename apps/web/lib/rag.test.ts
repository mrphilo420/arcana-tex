import { describe, expect, it } from "vitest";
import { retrieveProjectContext } from "@/lib/rag";
import type { ProjectFile } from "@/lib/project-files";

const file = (path: string, content: string): ProjectFile => ({
  id: path,
  name: path.split("/").pop() ?? path,
  path,
  type: "tex",
  content,
});

describe("retrieveProjectContext", () => {
  const files = [
    file(
      "SteinGate/Caratheodory/LinearSystems.lean",
      [
        "namespace SteinGate",
        "theorem linear_system_exists (A : Matrix m n) : True := by",
        "  trivial",
        "",
        "theorem quadratic_null_limit (Q : QuadraticForm) : True := by",
        "  exact True.intro",
        "end SteinGate",
      ].join("\n"),
    ),
    file(
      "book/07_foundations_integrability_body.tex",
      "\\chapter{Foundations}\nThe quadratic null limit is discussed here.",
    ),
    {
      ...file("cover.png", "not text"),
      type: "image" as const,
      content: undefined,
    },
  ];

  it("retrieves the most relevant theorem and proof chunk", () => {
    const results = retrieveProjectContext(files, "quadratic_null_limit proof");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].path).toContain("LinearSystems.lean");
    expect(results[0].startLine).toBeGreaterThan(0);
    expect(results[0].content).toContain("quadratic_null_limit");
  });

  it("returns no chunks for an unrelated query", () => {
    expect(retrieveProjectContext(files, "baker campbell hausdorff")).toEqual(
      [],
    );
  });

  it("respects path filters and result limits", () => {
    const results = retrieveProjectContext(files, "foundations quadratic", {
      limit: 1,
      paths: ["book/07_foundations_integrability_body.tex"],
    });

    expect(results).toHaveLength(1);
    expect(results[0].path).toContain("07_foundations");
  });
});
