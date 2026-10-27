import { StreamLanguage, type StringStream } from "@codemirror/language";

interface LeanLanguageState {
  commentDepth: number;
}

const KEYWORDS = new Set([
  "abbrev",
  "all_goals",
  "any_goals",
  "apply",
  "assumption",
  "attribute",
  "axiom",
  "by",
  "by_cases",
  "by_contra",
  "calc",
  "case",
  "cases",
  "change",
  "class",
  "classical",
  "constructor",
  "continuity",
  "contradiction",
  "convert",
  "decide",
  "decreasing_by",
  "def",
  "deriving",
  "do",
  "elab",
  "else",
  "end",
  "example",
  "exact",
  "export",
  "extends",
  "field_simp",
  "first",
  "focus",
  "from",
  "fun",
  "funext",
  "gcongr",
  "grind",
  "have",
  "haveI",
  "if",
  "import",
  "in",
  "induction",
  "inductive",
  "infix",
  "infixl",
  "infixr",
  "instance",
  "intro",
  "intros",
  "lemma",
  "let",
  "letI",
  "linarith",
  "local",
  "macro",
  "macro_rules",
  "match",
  "measurability",
  "mutual",
  "namespace",
  "native_decide",
  "next",
  "nlinarith",
  "noncomputable",
  "norm_cast",
  "norm_num",
  "notation",
  "obtain",
  "omega",
  "opaque",
  "open",
  "partial",
  "positivity",
  "postfix",
  "prefix",
  "private",
  "protected",
  "push_neg",
  "rcases",
  "refine",
  "repeat",
  "return",
  "rfl",
  "ring",
  "rw",
  "scoped",
  "section",
  "set_option",
  "show",
  "simp",
  "simpa",
  "split_ifs",
  "structure",
  "subst",
  "suffices",
  "syntax",
  "termination_by",
  "then",
  "theorem",
  "trivial",
  "try",
  "unfold",
  "universe",
  "unsafe",
  "using",
  "variable",
  "where",
  "with",
]);

const INVALID = new Set(["admit", "sorry"]);
const ATOMS = new Set(["native_decide"]);

function consumeBlockComment(stream: StringStream, state: LeanLanguageState) {
  while (!stream.eol()) {
    if (stream.match("-/")) {
      state.commentDepth--;
      if (state.commentDepth === 0) return;
    } else if (stream.match("/-")) {
      state.commentDepth++;
    } else {
      stream.next();
    }
  }
}

const leanParser = StreamLanguage.define<LeanLanguageState>({
  startState: () => ({ commentDepth: 0 }),
  token(stream, state) {
    if (state.commentDepth > 0) {
      consumeBlockComment(stream, state);
      return "comment";
    }

    if (stream.eatSpace()) return null;

    if (stream.match("--")) {
      stream.skipToEnd();
      return "comment";
    }

    if (stream.match("/-")) {
      state.commentDepth = 1;
      consumeBlockComment(stream, state);
      return "comment";
    }

    if (stream.match('"')) {
      while (!stream.eol()) {
        const char = stream.next();
        if (char === "\\") {
          stream.next();
        } else if (char === '"') {
          break;
        }
      }
      return "string";
    }

    if (stream.match(/^'(?:[^'\\]|\\.)*'?/)) return "string";

    if (stream.match(/^#\w+/)) return "meta";

    if (stream.match(/^[0-9]+(?:\.[0-9]+)?/)) return "number";

    if (stream.match(/^[\p{L}_][\p{L}\p{N}_'!?]*/u)) {
      const word = stream.current();
      if (INVALID.has(word)) return "invalid";
      if (ATOMS.has(word)) return "atom";
      if (KEYWORDS.has(word)) return "keyword";
      if (/^[A-Z]/u.test(word)) return "typeName";
      return "variableName";
    }

    if (stream.match(/^[∀∃λΠΣ→←↔↦⊢⊣≤≥≠∧∨¬∈∉⊆⊂∪∩∘≃≡⟶⟹]+/u)) {
      return "keyword";
    }

    if (stream.match(/^[=<>:+\-*\\/^|&!?%~.]+/)) return "operator";

    if (stream.match(/^[()[\]{}⟨⟩]+/)) return "bracket";

    stream.next();
    return null;
  },
});

export const leanLanguage = leanParser;
