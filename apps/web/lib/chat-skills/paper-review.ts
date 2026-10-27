export type PaperReviewMode =
  | "full"
  | "quick"
  | "methodology"
  | "re-review"
  | "guided";

export interface PaperReviewInvocation {
  mode: PaperReviewMode;
  focus: string;
  explicit: boolean;
}

const MODE_ALIASES: Record<string, PaperReviewMode> = {
  full: "full",
  quick: "quick",
  triage: "quick",
  methodology: "methodology",
  methods: "methodology",
  "re-review": "re-review",
  rereview: "re-review",
  verification: "re-review",
  guided: "guided",
  socratic: "guided",
};

const NATURAL_REVIEW_PATTERN =
  /\b(?:peer[- ]review|referee report|review (?:this|my|the) (?:paper|manuscript)|critique (?:this|my|the) (?:paper|manuscript)|review the manuscript)\b/i;

export function getPaperReviewInvocation(
  text: string,
): PaperReviewInvocation | null {
  const command = text.match(/\/paper-review\b([^\n]*)/i);
  const explicit = Boolean(command);
  if (!explicit && !NATURAL_REVIEW_PATTERN.test(text)) return null;

  const args = (command?.[1] ?? "").trim();
  const words = args.split(/\s+/).filter(Boolean);
  let mode: PaperReviewMode = "full";
  const focus: string[] = [];

  for (const word of words) {
    const normalized = word.toLowerCase();
    const candidate = MODE_ALIASES[normalized];
    if (candidate && mode === "full") {
      mode = candidate;
    } else {
      focus.push(word);
    }
  }

  return {
    mode,
    focus: focus.join(" "),
    explicit,
  };
}

export const LEAN_SYSTEM_GUIDE = `Lean 4 support:
- Treat files ending in .lean as Lean 4 sources, not LaTeX. Preserve declaration names, universe levels, implicit arguments, and syntax exactly.
- Distinguish definitions, theorem statements, proof bodies, tactics, and comments. Explain the proof state and tactic intent when useful.
- \`sorry\` and \`admit\` mean the proof is incomplete. \`axiom\`, \`opaque\`, \`native_decide\`, \`unsafe\`, and \`partial\` introduce trust, soundness, or kernel-escape risks; call them out explicitly.
- Use inspect_lean_sources to get declarations, imports, and incomplete-proof locations. Use read_project_file for the full source.
- Never claim a Lean file compiles, a proof is complete, or a theorem is kernel-checked without build output or other explicit evidence. If verification was not run, say so.
- When connecting Lean to a paper, map each formal declaration to the informal claim it supports and flag mismatches in assumptions, domains, or definitions.`;

export const PAPER_REVIEW_SKILL = `Built-in skill: /paper-review

You are now conducting an academic paper review. This is a read-only review:
do not modify the manuscript, bibliography, or Lean files. Do not call
insert_latex, replace_selection, find_and_replace, or write_project_file.
Return the review in chat; if the user wants it saved, tell them to copy it
into a Markdown note or ask outside review mode.

Preparation:
1. Use load_review_context to retrieve the manuscript, bibliography, and Lean summaries when available.
2. Read the main document and all sections/files that contribute to the argument. Use list_project_files, read_project_file, or search_project when the bundle is incomplete.
3. Identify the paper's field, contribution type, target venue, methodology, and whether a formal Lean development is part of the submission.

Run the review as an independent panel, then synthesize:
- Editor-in-Chief: venue fit, originality, significance, clarity, and readiness.
- Methodology reviewer: design, assumptions, data, statistical validity, reproducibility, and evidence for causal or generality claims.
- Domain reviewer: literature coverage, theoretical framing, correctness of claims, and incremental contribution.
- Cross-disciplinary/practical reviewer: broader impact, stakeholders, limitations, and alternative applications.
- Devil's advocate: strongest counter-argument, logical gaps, cherry-picking, confirmation bias, overgeneralization, ignored alternatives, and the "so what?" test.

Formalization audit when Lean is present:
- Separate informal claims from formal declarations and list declaration names/files/lines when available.
- Report imports, axioms, opaque definitions, native_decide, unsafe/partial code, and every sorry/admit.
- A theorem with sorry/admit is not a completed proof. Do not describe a formalization as complete or verified unless the project provides build evidence.
- Check whether the formal statements match the paper's assumptions and scope.

Grounding rules:
- Ground substantive claims in the manuscript. Quote short passages or cite section/file/line references.
- Do not fabricate citations, results, theorem names, line numbers, reviewer identities, or verification evidence.
- Clearly separate manuscript problems from missing information. If something cannot be assessed, say so.
- Be specific, calibrated, and constructive. Do not inflate scores or invent acceptance probabilities.

Output format (full mode):
# Editorial assessment
## Paper snapshot
## Reviewer panel (brief)
## Strengths
## Major issues
## Minor issues
## Methodology and reproducibility
## Formalization audit (only if Lean is present)
## Missing literature and references
## Devil's advocate
## Editorial decision
Choose: Accept / Minor revision / Major revision / Reject.
## Prioritized revision roadmap
## Confidence and limitations

Mode guidance:
- full (default): run the panel and synthesize an editorial decision.
- quick: give a concise triage (top strengths, top blockers, decision, next steps); skip the full panel.
- methodology: focus on design, statistics, identification, evidence, and reproducibility, with a shorter domain/novelty section.
- re-review: compare the revision and response against the prior review; use a traceability table (issue, claimed change, verified evidence, residual risk).
- guided: coach the author Socratically, one issue at a time; do not dump the full report.
The invocation may add a focus such as Lean, novelty, statistics, or reproducibility. Honor it while keeping the read-only rule.`;
