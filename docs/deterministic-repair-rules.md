# Deterministic LaTeX Repair Rules

Status: proposed specification for `apps/web/lib/latex-autofix.ts`.

This document defines the repair contract, the rule catalog, the current
implementation gaps, and the test-first acceptance matrix. It does not change
runtime behavior by itself.

## 1. Scope

The input is a `CompileDiagnostic` produced by
`apps/web/lib/compile-diagnostics.ts` plus the project's `.tex` files. A repair
rule may only edit source text. It may not invoke an AI model, install TeX
packages, delete project files, or change the compiler.

The output remains an `AutoFixResult`:

```ts
{
  updates: { id: string; content: string }[];
  applied: string[];
  skipped: { diagnosticId: string; reason: string }[];
}
```

## 2. Determinism contract

A rule qualifies as deterministic only when all of the following hold.

| ID | Contract |
|---|---|
| D1 | Edits are selected by exact lexical patterns over **active** TeX only. Comments and verbatim/listing bodies are masked before matching. |
| D2 | The rule has a closed set of mappings. It never invents a package, environment, command, or class name outside a checked-in table or theorem-like whitelist. |
| D3 | One diagnostic maps to one rule. No probabilistic matching, no model calls, no browsing, no package discovery. |
| D4 | Running the same rule twice on its own output produces no further edits. |
| D5 | Edits are local: a body edit is line- or command-local; preamble edits insert immediately before `\begin{document}` (or after `\documentclass` as fallback). |
| D6 | Two edits may not overlap. The second discovery is skipped with a reason instead of being force-applied. |
| D7 | All bytes outside the edited range are preserved, including line endings, comments, and unrelated whitespace. |
| D8 | Diagnostics that are not errors, or that lack the data required by a rule, are skipped with a stable human-readable reason. |
| D9 | Rule order, file order, and edit order are fixed. No timestamps, random IDs, or object-key iteration affect the result. |
| D10 | Every applied edit leaves an `% Auto-fix:` marker unless the edit is an unambiguous preamble insertion. |

## 3. Active-text mask

The implementation should build one lexical mask per `.tex` file before
matching any rule.

- A `%` starts a comment unless it is escaped as `\%`.
- The mask is disabled inside `verbatim`, `verbatim*`, `lstlisting`, `minted`,
  `\verb|...|`, `\lstinline|...|`, and `\mintinline{...}{...}` bodies.
- `\begin`/`\end` tokens inside an inactive span never participate in a rule.
- Mask ranges are calculated from the original file and remain valid while
  edits are collected. Edits are applied afterwards in descending offset order.
- If the mask cannot be established because a verbatim delimiter is
  unterminated, the file is marked **review-only**.

This is the highest-priority infrastructure change: several current rules
match commented commands or definitions because they search raw file text.

## 4. Rule catalog

### R1 — Missing graphic

**Diagnostic:** `missing-graphic` with `data.file` set.

**Preconditions**

1. The missing path has an image extension (`.pdf`, `.png`, `.jpg`, `.jpeg`,
   `.eps`, `.svg`, `.gif`).
2. Exactly one active `\includegraphics[options]{path}` command matches the
   normalized path, and the command is not inside a comment or verbatim span.
3. The command is the only active content on its line, apart from whitespace
   and a trailing comment.
4. The line is not already marked with `% Auto-fix: missing graphic`.

**Edit**

- Prepend `% Auto-fix: missing graphic <path>` to the command's line and
  comment that line.
- If the command spans multiple lines, shares a line with prose, or occurs more
  than once, do not edit. Return `Review` with the reason.

**Why this is safe:** the edit is reversible and removes the compile blocker
without deleting source.

**Current implementation:** partial. `commentLineEdit` comments the entire
line even when other content is present, `findGraphicCommands` does not skip
comments, and repeated runs can add another `% Auto-fix` header.

---

### R2 — Undefined environment

Split into two rules.

#### R2a — Package-provided environment

**Diagnostic:** `undefined-environment` with a mapped environment.

**Mapping:** only the existing checked-in table
(`ENVIRONMENT_PACKAGES`) and `proof -> amsthm`.

**Preconditions**

1. The environment is in the mapping.
2. The package is not already loaded by an **active** `\usepackage` or
   `\RequirePackage` in the project.
3. The main file has a stable insertion point for the package.

**Edit**

- Insert `% Auto-fix: environment <env>` and
  `\usepackage{<package>}` immediately before `\begin{document}`.
- If the package is already active, skip: "package already loaded; this
  environment needs a manual definition."

#### R2b — Theorem-like environment

**Diagnostic:** `undefined-environment` with no package mapping.

**Preconditions**

1. The environment name, after stripping one trailing `*`, is in the
   `THEOREM_LIKE` whitelist.
2. The environment has no existing active `\newtheorem` or `\newtheorem*`
   definition.
3. The main file has a stable insertion point.

**Edit**

- Insert `\newtheorem{name}{Title}` (or `\newtheorem*` for a starred name)
  before `\begin{document}`.
- Starred environments also require an active `amsthm`; add it once if
  missing.

**Hard stop:** unknown non-theorem-like environments are **review-only**.
Creating `\newtheorem{foo}{Foo}` for an arbitrary environment is not
deterministic and can silently change document semantics.

**Current implementation:** partial. The package branch is sound. The fallback
branch currently defines any unknown non-built-in environment as a theorem
environment; it must be restricted to the whitelist.

---

### R3 — Environment mismatch

**Diagnostic:** `environment-mismatch` with `data.begin` / `data.end`.

**Preconditions**

1. The file has no active verbatim-like body and no unterminated verbatim.
2. The file has no `\if`, `\else`, `\fi`, `\unless`, or similar conditional
   around the candidate environment tokens. Conditional branches make the
   stack ambiguous; mark review-only.
3. The number of proposed edits is at most 20. Beyond that, review-only.
4. Each candidate line contains only the `\begin`/`\end` token, whitespace, and
   an optional trailing comment.

**Edit**

Use a stack over active, non-`document` environment tokens:

- Matching `\begin`/`\end` pairs are unchanged.
- For an unmatched `\end{env}`, comment the whole line only under the
  line-local guard above.
- For a nested mismatch, insert the missing `\end{...}` lines immediately
  before the offending `\end`, each with an `% Auto-fix` marker.
- For unclosed environments at the end, insert the closing lines immediately
  before `\end{document}`.

**Why this is safe:** every insertion is additive and reversible; ambiguous
branching is never rewritten.

**Current implementation:** partial. It handles the stack and inserts missing
ends, but only skips `verbatim`, `lstlisting`, and `minted`; it does not guard
`\verb`, `\lstinline`, `\mintinline`, or conditionals.

---

### R4 — Missing package file

**Diagnostic:** `missing-package` with `data.package` or `data.file`.

**Preconditions**

1. The package name is present as an exact token in an active
   `\usepackage`/`\RequirePackage` command.
2. The command is not inside a comment.
3. The invocation is not `\usepackage` inside a macro definition or a
   conditional branch that could be false at compile time.

**Edit**

- Remove the exact package token from the package list.
- Preserve the command options and the other package names.
- If the list becomes empty, comment the entire command line with
  `% Auto-fix: missing package <name>`.
- Do not remove a `.cls` reference. Missing classes remain review-only.

**Current implementation:** partial. It removes tokens and preserves options,
but `findPackageCommands` scans raw text and can rewrite commented invocations.

---

### R5 — Undefined command

**Diagnostic:** `undefined-command` with `data.command`.

**Preconditions**

1. The command is an exact key in the checked-in `COMMAND_PACKAGES` map.
2. No active local definition already defines the command via `\newcommand`,
   `\newcommand*`, `\providecommand`, `\DeclareMathOperator`,
   `\DeclareMathOperator*`, `\def`, or `\let`.
3. The mapped package is not already loaded by an active package command.
4. The main file has a stable insertion point.

**Edit**

- Insert `% Auto-fix: command \foo` and `\usepackage{package}` before
  `\begin{document}`.

**Hard stop:** an unknown command, a locally defined command, or a command
whose package is already loaded is review-only. Never guess a package from the
command name.

**Current implementation:** partial. It checks the package map and loaded
packages, but does not check local definitions and does not mask comments.

---

### R6 — Duplicate definition

**Diagnostic:** `duplicate-command` with `data.command`.

**Preconditions**

1. The command is defined more than once by active definitions.
2. The duplicate definitions are **byte-identical after trimming outer
   whitespace**. Different bodies are a semantic override, not a duplicate.
3. The definitions use `\newcommand` or `\newcommand*`. A later
   `\renewcommand`, `\providecommand`, `\def`, or `\let` is an intentional
   redefinition and must not be commented away.
4. The duplicate definition is line-local: one definition per line, with no
   trailing prose.

**Edit**

- Comment every duplicate after the first, with
  `% Auto-fix: duplicate command \foo`.
- If bodies differ, skip: "different definitions require a manual
  renewcommand/rename decision."

**Current implementation:** partial and unsafe for the target contract. It
includes `\renewcommand` and `\providecommand` in the candidate set, treats
any later definition as duplicate, and can match commented definitions.

---

### R7 — Missing input file (proposed, disabled)

Do not enable this without fixtures and a product decision.

A possible rule would comment an active `\input{path}` or `\include{path}` only
when the command is the sole active content on its line and the target is
missing. Unlike a graphic, a missing input often contains document structure;
commenting it silently drops content. Keep it **review-only** for now.

## 5. Negative rules: never auto-fix

These diagnostics are intentionally left untouched:

| Diagnostic | Reason |
|---|---|
| `math-mode` | Missing `$` may be a line-spanning math construct or a macro expansion; a local guess can corrupt semantics. |
| `runaway-argument` | Missing brace may be far from the reported line; closing at the error point is not safe. |
| `fatal` | The log usually reports a symptom, not a reliable source range. |
| `missing-class` | A class may come from a TeX distribution or a project-specific file; removing the reference changes the document model. |
| `missing-file` (non-image) | Same content-loss risk as R7. |
| `undefined-reference` | Source is usually correct; rerun or fix the label/citation manually. |
| `undefined-citation` | Same as references; a missing BibTeX entry is not a source edit. |
| warnings | Warnings are review information; no deterministic source edit is defined. |

For all of these, `describeAutoFix` returns `null`, the inspector shows
**Manual**, and no version snapshot is created unless another rule applies.

## 6. Rule ordering and conflict resolution

Use this fixed order:

1. Build the active-text mask for every `.tex` file.
2. Resolve diagnostics to files by `fileId`, then exact `filePath`, then file
   basename. If still ambiguous, skip.
3. Evaluate R4, R5, R2, R6, R3, R1 in that order.
4. Collect edits with `(ruleId, fileId, start, end, text)`.
5. Reject any edit that overlaps an already-accepted edit; record a skip
   reason.
6. Apply accepted edits per file in descending offset order.
7. Re-check idempotence by running the same diagnostic set on the result.

Stable ordering matters because preamble rules all insert near the same marker.
The implementation should aggregate package additions into one deterministic
preamble block or insert them in rule-id/package-name order.

## 7. Current implementation audit

| Rule | Existing behavior | Gap against this contract |
|---|---|---|
| R1 | Comments the line containing a matching `\includegraphics`. | Matches commented commands; comments any shared line; not idempotent. |
| R2a | Loads mapped package before `\begin{document}`. | Package-loaded scan is raw, so commented packages count. |
| R2b | Defines theorem-like and arbitrary unknown environments. | Arbitrary unknown environments must not become `\newtheorem`. |
| R3 | Stack-balances active environment tokens; skips some verbatim bodies. | Missing `\verb`/`\lstinline`/conditional guards; line-wide comment can remove neighboring content. |
| R4 | Removes a missing package token, preserves other packages/options. | Raw matching can rewrite commented `\usepackage` lines. |
| R5 | Adds a mapped package for an undefined command. | No local-definition check; raw package-loaded scan. |
| R6 | Comments every later `\newcommand`/`\renewcommand`/`\providecommand` definition. | Must only handle identical `\newcommand` definitions; intentional redefinitions are not duplicates. |
| R7 | Not implemented. | Keep review-only unless product decision changes. |
| Negative set | Warnings are skipped; unsupported errors fall through. | Correct policy; needs explicit reasons in the UI. |

There are currently no automated tests for `latex-autofix.ts`. The
repository's root scripts are lint and dev only; there is no test runner in
`package.json`.

## 8. Test-first acceptance matrix

Write each fixture as a failing test before changing production code. The
expected result includes both the edited text and the `skipped` reason.

| Rule | Fixture | Expected |
|---|---|---|
| R1 | One image command on its own line | Line commented; `applied` includes one graphic. |
| R1 | Command shares a line with prose | No update; skipped as review. |
| R1 | Command already commented | No update; skipped. |
| R1 | Multi-line `\includegraphics` | No update; skipped. |
| R2a | `align` with no `amsmath` | `\usepackage{amsmath}` inserted once. |
| R2a | `align` with `amsmath` already loaded | No update; skipped. |
| R2b | `lemma` with no definition | `\newtheorem{lemma}{Lemma}` inserted. |
| R2b | `foo` with no mapping | No update; review-only. |
| R3 | Unclosed `figure` before `\end{document}` | Closing `\end{figure}` inserted. |
| R3 | Stray `\end{itemize}` on its own line | Line commented. |
| R3 | Mismatch inside `\iffalse` | No update; review-only. |
| R4 | `\usepackage{foo,bar}` with missing `foo` | Becomes `\usepackage{bar}`. |
| R4 | Sole `\usepackage{foo}` missing | Line commented with marker. |
| R4 | `missing-class` `.cls` | No update; skipped. |
| R5 | `\mathbb` with no `amssymb` | `amssymb` inserted. |
| R5 | `\mathbb` already locally defined | No package edit; skipped. |
| R5 | Unknown command | No update; skipped. |
| R6 | Two identical `\newcommand` definitions | Second commented. |
| R6 | Two different definitions | No update; skipped. |
| R6 | `\newcommand` then `\renewcommand` | No update; intentional redefinition. |
| All | Apply the full rule set twice | Second run returns zero updates and only skips. |
| All | Run with warnings/math/runaway/fatal | Zero updates; explicit negative reasons. |

Recommended harness: add a small `vitest` or `node:test` target that imports
`runAutoFixes` and `previewAutoFix` directly. Run the fixture tests, then the
whole suite, then `pnpm lint` and `pnpm --filter @open-prism/web build`.

## 9. Implementation order

1. Add the test harness and the fixtures above (red).
2. Extract the active-text mask and use it in every matcher.
3. Harden R1, restrict R2b, and fix R6 semantics (green for those fixtures).
4. Add conditional/verbatim guards to R3 and R4.
5. Add local-definition checks to R5.
6. Add the idempotence and conflict tests.
7. Only then consider R7 or any new rule.

## 10. Open questions

- Should a missing `\input` be review-only permanently, or become R7 after
  fixtures prove that commenting it is acceptable?
- Should package insertion preserve user ordering, or sort packages for
  reproducibility? Recommendation: preserve rule order and sort within a
  single inserted block.
- Should duplicate detection compare normalized whitespace or exact bytes?
  Recommendation: exact bytes after outer trim; whitespace differences are
  semantically relevant in TeX.
- Should `\DeclareMathOperator*` and `\def` be included in R6? Recommendation:
  detect them for local-definition checks in R5, but do not auto-comment them
  in R6 without dedicated tests.
