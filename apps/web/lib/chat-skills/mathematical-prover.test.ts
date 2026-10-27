import { describe, expect, it } from "vitest";
import {
  getMathematicalProverInvocation,
  MATHEMATICAL_PROVER_SKILL,
} from "@/lib/chat-skills/mathematical-prover";

describe("getMathematicalProverInvocation", () => {
  it("ignores unrelated messages and sibling skills", () => {
    expect(getMathematicalProverInvocation("fix my table")).toBeNull();
    expect(getMathematicalProverInvocation("/proofread")).toBeNull();
    expect(getMathematicalProverInvocation("/paper-review")).toBeNull();
  });

  it("matches /prove and /mathematical-prover with defaults", () => {
    expect(getMathematicalProverInvocation("/prove")).toEqual({
      mode: "prove",
      focus: "",
      explicit: true,
    });
    expect(getMathematicalProverInvocation("/mathematical-prover")).toEqual({
      mode: "prove",
      focus: "",
      explicit: true,
    });
  });

  it("reads a mode keyword and keeps the rest as focus", () => {
    expect(
      getMathematicalProverInvocation("/prove golf SteinGate.LinearSystems"),
    ).toEqual({
      mode: "golf",
      focus: "SteinGate.LinearSystems",
      explicit: true,
    });
    expect(
      getMathematicalProverInvocation("/mathematical-prover audit axioms"),
    ).toMatchObject({
      mode: "audit",
      focus: "axioms",
    });
    expect(
      getMathematicalProverInvocation("/prove mathlib Karhunen Loeve"),
    ).toMatchObject({
      mode: "mathlib",
      focus: "Karhunen Loeve",
    });
  });

  it("only treats the first word as a mode", () => {
    expect(
      getMathematicalProverInvocation("/prove this search and golf this proof"),
    ).toEqual({
      mode: "prove",
      focus: "this search and golf this proof",
      explicit: true,
    });
  });

  it("matches conservative natural-language requests", () => {
    for (const text of [
      "Please prove this lemma",
      "can you close this sorry?",
      "fill the sorry in this theorem",
      "find a proof of the quadratic null limit",
      "discharge this goal",
      "construct a Lean proof of the lemma",
    ]) {
      expect(getMathematicalProverInvocation(text)).toMatchObject({
        explicit: false,
      });
    }
  });

  it("leaves generic proof golf to the main RAG workflow", () => {
    expect(getMathematicalProverInvocation("golf this proof")).toBeNull();
    expect(getMathematicalProverInvocation("minimize that proof")).toBeNull();
    expect(
      getMathematicalProverInvocation("/prove golf this proof"),
    ).toMatchObject({
      mode: "golf",
      focus: "this proof",
    });
  });
});

describe("MATHEMATICAL_PROVER_SKILL", () => {
  it("wires the prover to the verified app tools", () => {
    for (const marker of [
      "retrieve_context",
      "inspect_lean_sources",
      "search_mathlib",
      "check_lean_candidate",
      "build_lean_project",
      "propose_patch",
      "spawn_subagents",
      "run_python",
    ]) {
      expect(MATHEMATICAL_PROVER_SKILL).toContain(marker);
    }
  });

  it("requires proof evidence and approval before applying a patch", () => {
    expect(MATHEMATICAL_PROVER_SKILL).toContain("proved: true");
    expect(MATHEMATICAL_PROVER_SKILL).toContain("elaborated: true");
    expect(MATHEMATICAL_PROVER_SKILL).toContain("PARTIAL");
    expect(MATHEMATICAL_PROVER_SKILL).toContain("OBSTRUCTED");
    expect(MATHEMATICAL_PROVER_SKILL).toContain("propose_patch");
    expect(MATHEMATICAL_PROVER_SKILL).toContain(
      "do not use write_project_file",
    );
  });

  it("documents the mathlib4 dependency setup", () => {
    expect(MATHEMATICAL_PROVER_SKILL).toContain(
      "Using-mathlib4-as-a-dependency",
    );
    expect(MATHEMATICAL_PROVER_SKILL).toContain("lake exe cache get");
    expect(MATHEMATICAL_PROVER_SKILL).toContain("lake-manifest.json");
    expect(MATHEMATICAL_PROVER_SKILL).toContain(
      ".lake/packages/mathlib/Mathlib",
    );
  });
});
