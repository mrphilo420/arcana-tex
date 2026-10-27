# Mathematical prover (`/prove`)

arcanaTeX includes a port of the `mathematical-prover` workflow. It constructs
Lean 4 / mathlib4 proofs instead of only restating them, and it treats Lean
elaboration as the only evidence that a proof is complete.

## Invocation

- `/prove` or `/mathematical-prover` - prove a target or close a `sorry`.
- `/prove golf <focus>` - shorten or simplify an existing proof body while
  preserving the declaration, assumptions, imports, and exported names.
- `/prove audit <focus>` - inspect a development for `sorry`, `admit`, axioms,
  `native_decide`, `unsafe`, `partial`, and mathlib gaps. Read-only.
- `/prove mathlib <focus>` - search the pinned mathlib tree. Read-only.

Conservative natural-language requests such as "prove this lemma", "close this
sorry", and "find a proof of" use the same skill. Generic "golf this proof"
requests stay with the main RAG proof-golf workflow because they may refer to
LaTeX prose; use `/prove golf` to run the verified Lean proof-body minimizer.
The skill does not take over paper reviews or proofreading.

## Tool loop

The app adapts the original phases to its local tools:

1. **Understand the goal.** `retrieve_context`, `read_project_file`, and
   `inspect_lean_sources` recover the exact declaration, imports, hypotheses,
   and conclusion. The theorem statement and binder order are preserved.
2. **Verify the mathematics.** Nontrivial algebraic, calculus, inequality, or
   transcribed claims get a fresh-context, no-computation review through
   `spawn_subagents` before tactics are written. This catches a wrong constant,
   sign, quantifier, or missing hypothesis before the compiler ever sees it.
3. **Search mathlib.** `search_mathlib` searches the pinned
   `.lake/packages/mathlib/Mathlib` tree read-only:
   - `identifier` for declaration names;
   - `keyword` for concepts that may live under unexpected names;
   - `file` for the declaration signatures in a promising file.

   Each concept is reported as FOUND, NOT FOUND in the pinned revision, or
   PARTIAL.
4. **Generate 3-5 strategies.** The candidates vary by technique, not by
   cosmetic tactic-name swaps: direct mathlib closure, goal-shape technique,
   literature-grounded proof, decompose-and-verify, and automation-heavy.
5. **Elaborate.** `check_lean_candidate` writes the candidate to an isolated
   temporary file inside the configured Lake project and runs `lake env lean`.
   It defaults to `Mathlib.Tactic` for fast tactic checks; pass `Mathlib` or the
   exact module when the candidate uses a named theorem or definition. Pass the
   fully qualified `declarationName` to run `#print axioms`; `sorryAx`
   invalidates the candidate. It returns:
   - `elaborated: true` - no errors;
   - `proved: true` - elaborated, contains a declaration, no `sorry`/`admit`,
     and no `sorryAx`;
   - `axioms` - the `#print axioms` report when a declaration name was given.

   `proved: true` is the only outcome that may be reported as PROVED.
   `build_lean_project` is project-level evidence and does not replace a
   candidate check.
6. **Rank and evolve.** Proved candidates are ranked by faithfulness,
   groundedness, robustness, and simplicity. Failed candidates are classified
   as a missing lemma, a wrong route, or a genuine mathematical gap. The loop
   continues only when the next attempt is justified by the goal shape, the
   literature, or a specific compiler error.
7. **Clean up.** Warnings and unused `have` statements are removed, then the
   candidate is checked again.
8. **Patch with approval.** The final change goes through `propose_patch`. The
   user sees the side-by-side before/after preview with **Keep** and **Undo**.
   Direct edit tools are disabled during prover turns.

## Mathlib as a dependency

The workflow assumes mathlib is a Lake dependency, not a copied source tree.
The setup follows the official guide:
<https://github.com/leanprover-community/mathlib4/wiki/Using-mathlib4-as-a-dependency>.

A project should have:

- `lakefile.toml` with:

  ```toml
  [[require]]
  name = "mathlib"
  git = "https://github.com/leanprover-community/mathlib4.git"
  ```

  or `lakefile.lean` with:

  ```lean
  require mathlib from git
    "https://github.com/leanprover-community/mathlib4.git"
  ```

- a `lean-toolchain` pin compatible with the mathlib revision;
- `lake-manifest.json` pinning the fetched revision;
- `.lake/packages/mathlib` after the dependency is fetched;
- the mathlib olean cache, fetched once with:

  ```bash
  lake exe cache get
  ```

Then build the project with:

```bash
lake build
```

The prover does not run `lake update`, change the toolchain, or mutate
dependencies. If the pinned source tree or cache is missing, it reports that
and points at the guide rather than guessing lemma names.

The current SteinGate checkout already has the required shape:

- `lakefile.toml` requires mathlib from the official repository;
- `lean-toolchain` pins `leanprover/lean4:v4.34.0-rc2`;
- `lake-manifest.json` pins the mathlib revision;
- `.lake/packages/mathlib/.lake/build/lib/lean/Mathlib` is populated, so the
  cache has been fetched.

## Evidence and honesty

- A tactic script that looks correct is not a proof.
- `elaborated: true, proved: false` is partial progress, usually because a
  `sorry` remains.
- `elaborated: false` is a real failure; quote the compiler errors.
- PARTIAL and OBSTRUCTED are first-class outcomes. A confident false PROVED is
  worse than an honest obstruction because it gets trusted downstream.
- The final report includes the exact declaration, the result, the winning
  code or remaining sub-goal, the `check_lean_candidate` evidence, and the
  technique or source used.
- The checker rejects execution directives (`#eval`, `run_cmd`, `#exec`,
  `IO.Process`, `System.Command`); it accepts declaration-only proof code.
- `run_python` may compute numerical evidence, but a numerical check is not a
  proof and Python never mutates source. Final edits still go through
  `propose_patch`.

## Local workspace note

The candidate checker runs against the Lake project selected in the Lean panel.
The approval patch applies to the project file in the arcanaTeX workspace. If
the workspace copy and the on-disk Lean file have diverged, the candidate check
still verifies the proof text, but a whole-project `lake build` verifies the
on-disk file. Keep the two in sync before treating a project build as the final
gate.
