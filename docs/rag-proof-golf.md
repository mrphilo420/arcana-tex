# RAG-style proof golf and the patch preview

This document describes the local RAG agent and the approval-based patcher used
by arcanaTeX, plus a practical route to emulate or extend the same feature.

## What is implemented

### Local retrieval

`retrieve_context` builds a small BM25 index over project text files. It splits
source into overlapping chunks and returns the highest-scoring chunks with:

- path
- start and end line
- content
- score

The active file receives a small score boost. The tool is deliberately lexical:
theorem names, lemma names, identifiers, commands, and proof terms are exact
tokens, and the index stays inside the browser.

### Proof golf loop

The assistant is instructed to use the following loop when asked to golf,
shorten, minimize, or simplify a proof:

1. Call `retrieve_context` for the theorem or lemma name.
2. Read the exact declaration/proof with `read_project_file` or
   `inspect_lean_sources`.
3. Preserve the statement, assumptions, imports, and declaration names unless
   the user explicitly asks to change them.
4. Produce a minimal line-range replacement.
5. Call `propose_patch`; never write directly during proof golf.
6. After the user chooses **Keep**, validate with the language-specific
   verifier: Lake for Lean, TeX for LaTeX, Python/R for those runtimes.

The chat response should include a short work log: what was retrieved, what was
changed, why it is shorter or clearer, and what still needs validation. This is
a concise explanation, not hidden chain-of-thought.

### Patcher

`propose_patch` opens a side-by-side before/after preview with:

- file path and line range
- added/removed line counts
- the assistant's explanation
- **Keep** and **Undo**

Before applying, the patcher verifies that the current source still matches the
proposed `before` block. It saves a project version first, applies the exact
line replacement, and requests a LaTeX compile only when the target is a LaTeX
file. Lean, Python, and R files are left for their own validators.

## Recommendations for emulating this feature

### 1. Build the retrieval index around semantic units, not files

Chunk at declaration boundaries for Lean (theorem, lemma, definition, imports)
and proof-environment boundaries for LaTeX. Add a small amount of surrounding
context and retain exact line ranges. Metadata should include:

- language
- declaration/theorem name
- imports or referenced declarations
- file and line range
- document section

A hybrid retriever is the next step: BM25 for exact identifiers plus embeddings
for natural-language intent. Run it locally with a lightweight vector store. Keep
the lexical retriever as a fallback and for exact theorem names.

### 2. Make the agent loop explicit

Use a bounded state machine:

```
classify task
  -> retrieve evidence
  -> inspect exact source
  -> plan the minimal proof edit
  -> propose patch
  -> validate after approval
  -> if validation fails, propose a revision
```

Cap retrieval calls, patch proposals, and validation attempts. Retrieve evidence
before generating a proof; do not ask the model to golf from a truncated excerpt.

### 3. Keep patching data-only

Represent a patch as JSON, not executable code:

```json
{
  "filePath": "SteinGate/Proof.lean",
  "startLine": 120,
  "endLine": 134,
  "replacement": "...",
  "explanation": "Replace the two-case proof with a single calc block."
}
```

Reject patches when the `before` block no longer matches. A Python script can be
used to compute the replacement, run a diff tool, or validate it, but the script
should not be the thing that mutates source directly. Keep application in the
trusted application layer so line bounds, path checks, snapshots, and approval
remain enforceable.

### 4. Validate after Keep, not before

For Lean, run `lake build` and inspect the exit code plus `#print axioms` where
appropriate. For LaTeX, compile and check the log. For Python/R, execute the
matching runtime. A side-by-side diff is not proof that the proof compiles.

### 5. Preserve the review surface

Use the existing yellow diagnostic highlights to show the affected location,
then show the patch as red removed lines and green added lines. Keep the
assistant's explanation and the exact line range above the diff. Save a version
before applying and offer **Undo** before any mutation.

### 6. Separate languages

LaTeX diagnostics, Lean build messages, Python tracebacks, and R errors should
carry their own language tag. Only render diagnostics compatible with the active
file, and only invoke that language's validator. The patcher is shared; the
validators are not.
