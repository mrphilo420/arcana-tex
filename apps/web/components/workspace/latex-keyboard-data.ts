import type { LucideIcon } from "lucide-react";
import {
  LayersIcon,
  NetworkIcon,
  SparklesIcon,
  WorkflowIcon,
} from "lucide-react";

export interface RibbonItem {
  before?: string;
  after?: string;
  label: string;
  title: string;
  description?: string;
  className?: string;
  icon?: LucideIcon;
  action?: "diagram-wizard";
  templateId?: string;
  large?: boolean;
}

export interface RibbonGroup {
  name: string;
  items: RibbonItem[];
}

export interface RibbonTab {
  id: string;
  label: string;
  description?: string;
  groups: RibbonGroup[];
}

type SymbolEntry = readonly [label: string, command: string];

function symbolItems(
  entries: readonly SymbolEntry[],
  className = "font-serif text-[1rem]",
): RibbonItem[] {
  return entries.map(([label, command]) => ({
    label,
    title: command,
    before: command,
    className,
  }));
}

function symbolGroup(
  name: string,
  entries: readonly SymbolEntry[],
  className?: string,
): RibbonGroup {
  return { name, items: symbolItems(entries, className) };
}

const textGroup: RibbonGroup = {
  name: "Text styles",
  items: [
    {
      label: "B",
      title: "Bold",
      before: "\\textbf{",
      after: "}",
      className: "font-bold",
    },
    {
      label: "I",
      title: "Italic",
      before: "\\textit{",
      after: "}",
      className: "font-serif italic",
    },
    {
      label: "U",
      title: "Underline",
      before: "\\underline{",
      after: "}",
      className: "underline",
    },
    {
      label: "em",
      title: "Emphasis",
      before: "\\emph{",
      after: "}",
      className: "font-serif italic",
    },
    {
      label: "tt",
      title: "Typewriter",
      before: "\\texttt{",
      after: "}",
      className: "font-mono",
    },
    {
      label: "sf",
      title: "Sans serif",
      before: "\\textsf{",
      after: "}",
    },
    {
      label: "rm",
      title: "Roman",
      before: "\\textrm{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "SC",
      title: "Small caps",
      before: "\\textsc{",
      after: "}",
      className: "font-serif text-[0.75rem]",
    },
    {
      label: "text",
      title: "Text inside math",
      before: "\\text{",
      after: "}",
      className: "font-sans text-[0.75rem]",
    },
  ],
};

const paragraphGroup: RibbonGroup = {
  name: "Paragraph",
  items: [
    {
      label: "¶",
      title: "Paragraph break",
      before: "\\par ",
    },
    {
      label: "↵",
      title: "Line break",
      before: "\\newline ",
    },
    {
      label: "~",
      title: "Non-breaking space",
      before: "~",
      className: "font-mono",
    },
    {
      label: "indent",
      title: "No paragraph indent",
      before: "\\noindent ",
      className: "text-[0.75rem]",
    },
    {
      label: "small",
      title: "Small vertical space",
      before: "\\smallskip ",
      className: "text-[0.75rem]",
    },
    {
      label: "med",
      title: "Medium vertical space",
      before: "\\medskip ",
      className: "text-[0.75rem]",
    },
    {
      label: "big",
      title: "Large vertical space",
      before: "\\bigskip ",
      className: "text-[0.75rem]",
    },
    {
      label: "hfill",
      title: "Horizontal fill",
      before: "\\hfill ",
      className: "text-[0.75rem]",
    },
    {
      label: "foot",
      title: "Footnote",
      before: "\\footnote{",
      after: "}",
      className: "text-[0.75rem]",
    },
  ],
};

const textDecorationGroup: RibbonGroup = {
  name: "Colour",
  items: [
    {
      label: "red",
      title: "Red text",
      before: "\\textcolor{red}{",
      after: "}",
      className: "text-[#c64545] font-bold",
    },
    {
      label: "blue",
      title: "Blue text",
      before: "\\textcolor{blue}{",
      after: "}",
      className: "text-[#2563eb] font-bold",
    },
    {
      label: "green",
      title: "Green text",
      before: "\\textcolor{green!55!black}{",
      after: "}",
      className: "text-[#3d7a4a] font-bold",
    },
    {
      label: "mark",
      title: "Highlighted text",
      before: "\\colorbox{yellow}{",
      after: "}",
      className: "bg-[#fff3a6] px-1 text-[#5f4b00]",
    },
    {
      label: "box",
      title: "Framed coloured box",
      before: "\\fcolorbox{red}{yellow}{",
      after: "}",
      className: "border border-[#c64545] bg-[#fff3a6] px-1 text-[#5f4b00]",
    },
    {
      label: "small",
      title: "Small text",
      before: "{\\small ",
      after: "}",
      className: "text-[0.7rem]",
    },
    {
      label: "large",
      title: "Large text",
      before: "{\\large ",
      after: "}",
      className: "text-[0.9rem]",
    },
  ],
};

const mathGroup: RibbonGroup = {
  name: "Quick math",
  items: [
    {
      label: "x",
      title: "Inline math $...$",
      before: "$",
      after: "$",
      className: "font-serif italic",
    },
    {
      label: "∑",
      title: "Display math \\[...\\]",
      before: "\\[",
      after: "\\]",
      className: "font-serif",
    },
    {
      label: "a/b",
      title: "Fraction",
      before: "\\frac{",
      after: "}{}",
      className: "font-serif text-[0.875rem]",
    },
    {
      label: "√",
      title: "Square root",
      before: "\\sqrt{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "x²",
      title: "Superscript",
      before: "^{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "xₙ",
      title: "Subscript",
      before: "_{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "text",
      title: "Text inside math",
      before: "\\text{",
      after: "}",
      className: "font-sans text-[0.75rem]",
    },
    {
      label: "( )",
      title: "Auto-sized parentheses",
      before: "\\left(",
      after: "\\right)",
      className: "font-serif",
    },
    {
      label: "∑",
      title: "Sum",
      before: "\\sum",
      className: "font-serif",
    },
    {
      label: "∫",
      title: "Integral",
      before: "\\int",
      className: "font-serif",
    },
    {
      label: "box",
      title: "Boxed formula",
      before: "\\boxed{",
      after: "}",
      className: "font-serif text-[0.75rem]",
    },
  ],
};

const scriptGroup: RibbonGroup = {
  name: "Scripts",
  items: [
    {
      label: "aᵇ",
      title: "Superscript",
      before: "^{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "aᵢ",
      title: "Subscript",
      before: "_{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "aᵢᵇ",
      title: "Subscript and superscript",
      before: "_{",
      after: "}^{}",
      className: "font-serif text-[0.75rem]",
    },
    {
      label: "{}ᵃᵦ",
      title: "Scripts before a symbol",
      before: "{}^{",
      after: "}_{}",
      className: "font-serif text-[0.75rem]",
    },
    {
      label: "sub",
      title: "Substack",
      before: "\\substack{",
      after: "}",
      className: "font-serif text-[0.75rem]",
    },
    {
      label: "over",
      title: "Overset",
      before: "\\overset{",
      after: "}{}",
      className: "font-serif text-[0.75rem]",
    },
    {
      label: "under",
      title: "Underset",
      before: "\\underset{",
      after: "}{}",
      className: "font-serif text-[0.75rem]",
    },
    {
      label: "stack",
      title: "Stackrel",
      before: "\\stackrel{",
      after: "}{}",
      className: "font-serif text-[0.75rem]",
    },
  ],
};

const fractionGroup: RibbonGroup = {
  name: "Fractions",
  items: [
    {
      label: "a/b",
      title: "Fraction",
      before: "\\frac{",
      after: "}{}",
      className: "font-serif",
    },
    {
      label: "d/a",
      title: "Display fraction",
      before: "\\dfrac{",
      after: "}{}",
      className: "font-serif",
    },
    {
      label: "t/a",
      title: "Text fraction",
      before: "\\tfrac{",
      after: "}{}",
      className: "font-serif",
    },
    {
      label: "c/a",
      title: "Continued fraction",
      before: "\\cfrac{",
      after: "}{}",
      className: "font-serif",
    },
    {
      label: "(n k)",
      title: "Binomial coefficient",
      before: "\\binom{",
      after: "}{}",
      className: "font-serif text-[0.75rem]",
    },
    {
      label: "d(n k)",
      title: "Display binomial coefficient",
      before: "\\dbinom{",
      after: "}{}",
      className: "font-serif text-[0.7rem]",
    },
    {
      label: "gen",
      title: "Generalised fraction",
      before: "\\genfrac{}{}{}{}{}{",
      after: "}",
      className: "font-serif text-[0.75rem]",
    },
  ],
};

const rootGroup: RibbonGroup = {
  name: "Roots",
  items: [
    {
      label: "√",
      title: "Square root",
      before: "\\sqrt{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "ⁿ√",
      title: "Root with index",
      before: "\\sqrt[",
      after: "]{}",
      className: "font-serif",
    },
    {
      label: "³√",
      title: "Cube root",
      before: "\\sqrt[3]{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "n√",
      title: "Nth root",
      before: "\\sqrt[n]{",
      after: "}",
      className: "font-serif",
    },
  ],
};

const bracketGroup: RibbonGroup = {
  name: "Brackets",
  items: [
    {
      label: "( )",
      title: "Parentheses",
      before: "\\left(",
      after: "\\right)",
      className: "font-serif",
    },
    {
      label: "[ ]",
      title: "Square brackets",
      before: "\\left[",
      after: "\\right]",
      className: "font-serif",
    },
    {
      label: "{ }",
      title: "Braces",
      before: "\\left\\{",
      after: "\\right\\}",
      className: "font-serif",
    },
    {
      label: "| |",
      title: "Absolute value",
      before: "\\left|",
      after: "\\right|",
      className: "font-serif",
    },
    {
      label: "‖ ‖",
      title: "Norm",
      before: "\\left\\|",
      after: "\\right\\|",
      className: "font-serif",
    },
    {
      label: "⟨ ⟩",
      title: "Angle brackets",
      before: "\\left\\langle",
      after: "\\right\\rangle",
      className: "font-serif",
    },
    {
      label: "⌊ ⌋",
      title: "Floor",
      before: "\\left\\lfloor",
      after: "\\right\\rfloor",
      className: "font-serif",
    },
    {
      label: "⌈ ⌉",
      title: "Ceiling",
      before: "\\left\\lceil",
      after: "\\right\\rceil",
      className: "font-serif",
    },
    {
      label: "· |",
      title: "Evaluated at",
      before: "\\left.",
      after: "\\right|_{}",
      className: "font-serif",
    },
    {
      label: "| ·",
      title: "One-sided bar",
      before: "\\left|",
      after: "\\right.",
      className: "font-serif",
    },
  ],
};

const accentGroup: RibbonGroup = {
  name: "Accents",
  items: [
    {
      label: "x̂",
      title: "Hat",
      before: "\\hat{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "x̂",
      title: "Wide hat",
      before: "\\widehat{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "x̄",
      title: "Bar",
      before: "\\bar{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "x̄",
      title: "Overline",
      before: "\\overline{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "x̲",
      title: "Underline",
      before: "\\underline{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "x⃗",
      title: "Vector",
      before: "\\vec{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "ẋ",
      title: "Dot",
      before: "\\dot{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "ẍ",
      title: "Double dot",
      before: "\\ddot{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "x̃",
      title: "Tilde",
      before: "\\tilde{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "x̃",
      title: "Wide tilde",
      before: "\\widetilde{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "x̌",
      title: "Check",
      before: "\\check{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "x̆",
      title: "Breve",
      before: "\\breve{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "x́",
      title: "Acute",
      before: "\\acute{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "x̀",
      title: "Grave",
      before: "\\grave{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "x̊",
      title: "Ring",
      before: "\\mathring{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "⏞",
      title: "Overbrace",
      before: "\\overbrace{",
      after: "}^{}",
      className: "font-serif",
    },
    {
      label: "⏟",
      title: "Underbrace",
      before: "\\underbrace{",
      after: "}_{}",
      className: "font-serif",
    },
    {
      label: "←",
      title: "Over left arrow",
      before: "\\overleftarrow{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "→",
      title: "Over right arrow",
      before: "\\overrightarrow{",
      after: "}",
      className: "font-serif",
    },
    {
      label: "↔",
      title: "Over left-right arrow",
      before: "\\overleftrightarrow{",
      after: "}",
      className: "font-serif",
    },
  ],
};

const matrixGroup: RibbonGroup = {
  name: "Matrices",
  items: [
    {
      label: "matrix",
      title: "Matrix without brackets",
      before: "\\begin{matrix}\n  ",
      after: "\n\\end{matrix}",
      className: "font-mono text-[0.7rem]",
    },
    {
      label: "pmatrix",
      title: "Parenthesised matrix",
      before: "\\begin{pmatrix}\n  ",
      after: "\n\\end{pmatrix}",
      className: "font-mono text-[0.7rem]",
    },
    {
      label: "bmatrix",
      title: "Bracketed matrix",
      before: "\\begin{bmatrix}\n  ",
      after: "\n\\end{bmatrix}",
      className: "font-mono text-[0.7rem]",
    },
    {
      label: "Bmatrix",
      title: "Braced matrix",
      before: "\\begin{Bmatrix}\n  ",
      after: "\n\\end{Bmatrix}",
      className: "font-mono text-[0.7rem]",
    },
    {
      label: "vmatrix",
      title: "Determinant matrix",
      before: "\\begin{vmatrix}\n  ",
      after: "\n\\end{vmatrix}",
      className: "font-mono text-[0.7rem]",
    },
    {
      label: "Vmatrix",
      title: "Norm matrix",
      before: "\\begin{Vmatrix}\n  ",
      after: "\n\\end{Vmatrix}",
      className: "font-mono text-[0.7rem]",
    },
    {
      label: "array",
      title: "Array",
      before: "\\begin{array}{cc}\n  ",
      after: "\n\\end{array}",
      className: "font-mono text-[0.7rem]",
    },
    {
      label: "cases",
      title: "Cases",
      before: "\\begin{cases}\n  ",
      after: "\n\\end{cases}",
      className: "font-mono text-[0.7rem]",
    },
    {
      label: "aligned",
      title: "Aligned equations",
      before: "\\begin{aligned}\n  ",
      after: "\n\\end{aligned}",
      className: "font-mono text-[0.7rem]",
    },
    {
      label: "gathered",
      title: "Gathered equations",
      before: "\\begin{gathered}\n  ",
      after: "\n\\end{gathered}",
      className: "font-mono text-[0.7rem]",
    },
    {
      label: "split",
      title: "Split equation",
      before: "\\begin{split}\n  ",
      after: "\n\\end{split}",
      className: "font-mono text-[0.7rem]",
    },
  ],
};

const environmentGroup: RibbonGroup = {
  name: "Environments",
  items: [
    {
      label: "equation",
      title: "Equation",
      before: "\\begin{equation}\n  ",
      after: "\n\\end{equation}",
      className: "font-mono text-[0.7rem]",
    },
    {
      label: "equation*",
      title: "Unnumbered equation",
      before: "\\begin{equation*}\n  ",
      after: "\n\\end{equation*}",
      className: "font-mono text-[0.7rem]",
    },
    {
      label: "align",
      title: "Aligned equations",
      before: "\\begin{align}\n  ",
      after: "\n\\end{align}",
      className: "font-mono text-[0.7rem]",
    },
    {
      label: "align*",
      title: "Unnumbered aligned equations",
      before: "\\begin{align*}\n  ",
      after: "\n\\end{align*}",
      className: "font-mono text-[0.7rem]",
    },
    {
      label: "gather",
      title: "Gathered equations",
      before: "\\begin{gather}\n  ",
      after: "\n\\end{gather}",
      className: "font-mono text-[0.7rem]",
    },
    {
      label: "gather*",
      title: "Unnumbered gathered equations",
      before: "\\begin{gather*}\n  ",
      after: "\n\\end{gather*}",
      className: "font-mono text-[0.7rem]",
    },
    {
      label: "multline",
      title: "Multi-line equation",
      before: "\\begin{multline}\n  ",
      after: "\n\\end{multline}",
      className: "font-mono text-[0.7rem]",
    },
    {
      label: "multline*",
      title: "Unnumbered multi-line equation",
      before: "\\begin{multline*}\n  ",
      after: "\n\\end{multline*}",
      className: "font-mono text-[0.7rem]",
    },
    {
      label: "eqnarray",
      title: "Legacy equation array",
      before: "\\begin{eqnarray}\n  ",
      after: "\n\\end{eqnarray}",
      className: "font-mono text-[0.7rem]",
    },
  ],
};

const binaryGroup = symbolGroup("Binary operators", [
  ["×", "\\times"],
  ["·", "\\cdot"],
  ["÷", "\\div"],
  ["±", "\\pm"],
  ["∓", "\\mp"],
  ["∗", "\\ast"],
  ["⋆", "\\star"],
  ["∘", "\\circ"],
  ["∙", "\\bullet"],
  ["⊕", "\\oplus"],
  ["⊖", "\\ominus"],
  ["⊗", "\\otimes"],
  ["⊙", "\\odot"],
  ["∧", "\\wedge"],
  ["∨", "\\vee"],
  ["∩", "\\cap"],
  ["∪", "\\cup"],
  ["∖", "\\setminus"],
  ["⊎", "\\uplus"],
  ["⊓", "\\sqcap"],
  ["⊔", "\\sqcup"],
  ["≀", "\\wr"],
  ["⋈", "\\bowtie"],
  ["⨿", "\\amalg"],
]);

const relationGroup = symbolGroup("Relations", [
  ["≤", "\\le"],
  ["≥", "\\ge"],
  ["≠", "\\ne"],
  ["≈", "\\approx"],
  ["≡", "\\equiv"],
  ["∼", "\\sim"],
  ["≃", "\\simeq"],
  ["≅", "\\cong"],
  ["∝", "\\propto"],
  ["≪", "\\ll"],
  ["≫", "\\gg"],
  ["≺", "\\prec"],
  ["≻", "\\succ"],
  ["⪯", "\\preceq"],
  ["⪰", "\\succeq"],
  ["∥", "\\parallel"],
  ["⊥", "\\perp"],
  ["≍", "\\asymp"],
  ["≐", "\\doteq"],
  ["≦", "\\leqq"],
  ["≧", "\\geqq"],
  ["≮", "\\nless"],
  ["≯", "\\ngtr"],
  ["⊨", "\\models"],
  ["⊢", "\\vdash"],
  ["⊣", "\\dashv"],
]);

const bigOperatorGroup = symbolGroup("Big operators", [
  ["∑", "\\sum"],
  ["∏", "\\prod"],
  ["∐", "\\coprod"],
  ["∫", "\\int"],
  ["∬", "\\iint"],
  ["∭", "\\iiint"],
  ["∮", "\\oint"],
  ["⋃", "\\bigcup"],
  ["⋂", "\\bigcap"],
  ["⨁", "\\bigoplus"],
  ["⨂", "\\bigotimes"],
  ["⋁", "\\bigvee"],
  ["⋀", "\\bigwedge"],
  ["lim", "\\lim"],
  ["limsup", "\\limsup"],
  ["liminf", "\\liminf"],
  ["max", "\\max"],
  ["min", "\\min"],
  ["sup", "\\sup"],
  ["inf", "\\inf"],
  ["det", "\\det"],
  ["gcd", "\\gcd"],
]);

const functionGroup: RibbonGroup = {
  name: "Functions",
  items: [
    ...symbolItems(
      [
        ["sin", "\\sin"],
        ["cos", "\\cos"],
        ["tan", "\\tan"],
        ["cot", "\\cot"],
        ["sec", "\\sec"],
        ["csc", "\\csc"],
        ["arcsin", "\\arcsin"],
        ["arccos", "\\arccos"],
        ["arctan", "\\arctan"],
        ["sinh", "\\sinh"],
        ["cosh", "\\cosh"],
        ["tanh", "\\tanh"],
        ["log", "\\log"],
        ["ln", "\\ln"],
        ["exp", "\\exp"],
        ["arg", "\\arg"],
        ["deg", "\\deg"],
        ["dim", "\\dim"],
        ["hom", "\\hom"],
        ["ker", "\\ker"],
        ["Pr", "\\Pr"],
        ["mod", "\\mod"],
        ["bmod", "\\bmod"],
      ],
      "font-serif text-[0.75rem]",
    ),
    {
      label: "pmod",
      title: "Modulo with parentheses",
      before: "\\pmod{",
      after: "}",
      className: "font-serif text-[0.75rem]",
    },
  ],
};

const spacingGroup: RibbonGroup = {
  name: "Spacing",
  items: [
    ...symbolItems(
      [
        ["thin", "\\,"],
        ["med", "\\:"],
        ["thick", "\\;"],
        ["neg", "\\!"],
        ["quad", "\\quad"],
        ["qquad", "\\qquad"],
        ["space", "\\ "],
        ["nbsp", "~"],
        ["small", "\\smallskip"],
        ["medskip", "\\medskip"],
        ["bigskip", "\\bigskip"],
        ["hfill", "\\hfill"],
        ["break", "\\allowbreak"],
        ["nobreak", "\\nobreak"],
      ],
      "font-mono text-[0.7rem]",
    ),
    {
      label: "hspace",
      title: "Horizontal space",
      before: "\\hspace{",
      after: "}",
      className: "font-mono text-[0.7rem]",
    },
    {
      label: "vspace",
      title: "Vertical space",
      before: "\\vspace{",
      after: "}",
      className: "font-mono text-[0.7rem]",
    },
  ],
};

const greekLower: readonly SymbolEntry[] = [
  ["α", "\\alpha"],
  ["β", "\\beta"],
  ["γ", "\\gamma"],
  ["δ", "\\delta"],
  ["ϵ", "\\epsilon"],
  ["ε", "\\varepsilon"],
  ["ζ", "\\zeta"],
  ["η", "\\eta"],
  ["θ", "\\theta"],
  ["ϑ", "\\vartheta"],
  ["ι", "\\iota"],
  ["κ", "\\kappa"],
  ["λ", "\\lambda"],
  ["μ", "\\mu"],
  ["ν", "\\nu"],
  ["ξ", "\\xi"],
  ["π", "\\pi"],
  ["ϖ", "\\varpi"],
  ["ρ", "\\rho"],
  ["ϱ", "\\varrho"],
  ["σ", "\\sigma"],
  ["ς", "\\varsigma"],
  ["τ", "\\tau"],
  ["υ", "\\upsilon"],
  ["ϕ", "\\phi"],
  ["φ", "\\varphi"],
  ["χ", "\\chi"],
  ["ψ", "\\psi"],
  ["ω", "\\omega"],
  ["ϝ", "\\digamma"],
];

const greekUpper: readonly SymbolEntry[] = [
  ["Γ", "\\Gamma"],
  ["Δ", "\\Delta"],
  ["Θ", "\\Theta"],
  ["Λ", "\\Lambda"],
  ["Ξ", "\\Xi"],
  ["Π", "\\Pi"],
  ["Σ", "\\Sigma"],
  ["Υ", "\\Upsilon"],
  ["Φ", "\\Phi"],
  ["Ψ", "\\Psi"],
  ["Ω", "\\Omega"],
];

const arrowGroup = symbolGroup("Arrows", [
  ["→", "\\to"],
  ["←", "\\leftarrow"],
  ["↔", "\\leftrightarrow"],
  ["⇒", "\\Rightarrow"],
  ["⇐", "\\Leftarrow"],
  ["⇔", "\\Leftrightarrow"],
  ["↦", "\\mapsto"],
  ["↪", "\\hookrightarrow"],
  ["↠", "\\twoheadrightarrow"],
  ["⟶", "\\longrightarrow"],
  ["⟵", "\\longleftarrow"],
  ["⟷", "\\longleftrightarrow"],
  ["↑", "\\uparrow"],
  ["↓", "\\downarrow"],
  ["↕", "\\updownarrow"],
  ["↗", "\\nearrow"],
  ["↘", "\\searrow"],
  ["↙", "\\swarrow"],
  ["↖", "\\nwarrow"],
  ["⇑", "\\Uparrow"],
  ["⇓", "\\Downarrow"],
  ["⇕", "\\Updownarrow"],
]);

const harpoonGroup = symbolGroup(
  "Harpoons",
  [
    ["⇀", "\\rightharpoonup"],
    ["⇁", "\\rightharpoondown"],
    ["↼", "\\leftharpoonup"],
    ["↽", "\\leftharpoondown"],
    ["⇌", "\\rightleftharpoons"],
    ["⇋", "\\leftrightharpoons"],
    ["↝", "\\leadsto"],
    ["⇒", "\\implies"],
    ["⇐", "\\impliedby"],
    ["⇔", "\\iff"],
  ],
  "font-serif text-[1rem]",
);

const setGroup = symbolGroup("Sets & logic", [
  ["∀", "\\forall"],
  ["∃", "\\exists"],
  ["∄", "\\nexists"],
  ["¬", "\\neg"],
  ["∧", "\\wedge"],
  ["∨", "\\vee"],
  ["∈", "\\in"],
  ["∉", "\\notin"],
  ["∋", "\\ni"],
  ["⊂", "\\subset"],
  ["⊃", "\\supset"],
  ["⊆", "\\subseteq"],
  ["⊇", "\\supseteq"],
  ["∪", "\\cup"],
  ["∩", "\\cap"],
  ["∖", "\\setminus"],
  ["∅", "\\emptyset"],
  ["∅", "\\varnothing"],
  ["⊤", "\\top"],
  ["⊥", "\\bot"],
  ["⊨", "\\models"],
]);

const miscGroup = symbolGroup("Miscellaneous", [
  ["∞", "\\infty"],
  ["∂", "\\partial"],
  ["∇", "\\nabla"],
  ["ℵ", "\\aleph"],
  ["ℏ", "\\hbar"],
  ["ℓ", "\\ell"],
  ["ℜ", "\\Re"],
  ["ℑ", "\\Im"],
  ["℘", "\\wp"],
  ["♭", "\\flat"],
  ["♮", "\\natural"],
  ["♯", "\\sharp"],
  ["†", "\\dagger"],
  ["‡", "\\ddagger"],
  ["§", "\\S"],
  ["¶", "\\P"],
  ["©", "\\copyright"],
  ["£", "\\pounds"],
  ["✓", "\\checkmark"],
  ["′", "\\prime"],
  ["″", "\\prime\\prime"],
  ["‴", "\\prime\\prime\\prime"],
]);

const geometryGroup = symbolGroup("Geometry", [
  ["∠", "\\angle"],
  ["∡", "\\measuredangle"],
  ["△", "\\triangle"],
  ["▽", "\\bigtriangledown"],
  ["◁", "\\triangleleft"],
  ["▷", "\\triangleright"],
  ["□", "\\square"],
  ["■", "\\blacksquare"],
  ["◇", "\\lozenge"],
  ["◆", "\\blacklozenge"],
  ["∥", "\\parallel"],
  ["⊥", "\\perp"],
  ["≅", "\\cong"],
  ["∼", "\\sim"],
  ["◯", "\\bigcirc"],
]);

const dotsGroup = symbolGroup(
  "Dots",
  [
    ["…", "\\ldots"],
    ["⋯", "\\cdots"],
    ["⋮", "\\vdots"],
    ["⋱", "\\ddots"],
    ["…", "\\dots"],
    ["…", "\\dotsb"],
    ["…", "\\dotsc"],
    ["⋯", "\\dotsi"],
    ["…", "\\dotsm"],
    ["…", "\\dotso"],
  ],
  "font-serif text-[1rem]",
);

const alphabetGroup: RibbonGroup = {
  name: "Math alphabets",
  items: [
    {
      label: "rm",
      title: "Roman math",
      before: "\\mathrm{",
      after: "}",
      className: "font-serif text-[0.875rem]",
    },
    {
      label: "bf",
      title: "Bold math",
      before: "\\mathbf{",
      after: "}",
      className: "font-serif font-bold text-[0.875rem]",
    },
    {
      label: "it",
      title: "Italic math",
      before: "\\mathit{",
      after: "}",
      className: "font-serif italic text-[0.875rem]",
    },
    {
      label: "sf",
      title: "Sans-serif math",
      before: "\\mathsf{",
      after: "}",
      className: "font-sans text-[0.875rem]",
    },
    {
      label: "tt",
      title: "Typewriter math",
      before: "\\mathtt{",
      after: "}",
      className: "font-mono text-[0.875rem]",
    },
    {
      label: "bb",
      title: "Blackboard bold",
      before: "\\mathbb{",
      after: "}",
      className: "font-serif text-[0.875rem]",
    },
    {
      label: "cal",
      title: "Calligraphic",
      before: "\\mathcal{",
      after: "}",
      className: "font-serif italic text-[0.875rem]",
    },
    {
      label: "frak",
      title: "Fraktur",
      before: "\\mathfrak{",
      after: "}",
      className: "font-serif text-[0.875rem]",
    },
    {
      label: "bold",
      title: "Bold symbol",
      before: "\\boldsymbol{",
      after: "}",
      className: "font-serif font-bold text-[0.875rem]",
    },
    {
      label: "text",
      title: "Text inside math",
      before: "\\text{",
      after: "}",
      className: "font-sans text-[0.75rem]",
    },
    {
      label: "op",
      title: "Operator name",
      before: "\\operatorname{",
      after: "}",
      className: "font-sans text-[0.75rem]",
    },
  ],
};

const sizeGroup: RibbonGroup = {
  name: "Style & size",
  items: [
    {
      label: "disp",
      title: "Display style",
      before: "\\displaystyle ",
      className: "font-serif text-[0.7rem]",
    },
    {
      label: "text",
      title: "Text style",
      before: "\\textstyle ",
      className: "font-serif text-[0.7rem]",
    },
    {
      label: "script",
      title: "Script style",
      before: "\\scriptstyle ",
      className: "font-serif text-[0.7rem]",
    },
    {
      label: "sscript",
      title: "Scriptscript style",
      before: "\\scriptscriptstyle ",
      className: "font-serif text-[0.65rem]",
    },
    {
      label: "limits",
      title: "Limits above and below",
      before: "\\limits ",
      className: "font-serif text-[0.7rem]",
    },
    {
      label: "nolimits",
      title: "Limits beside",
      before: "\\nolimits ",
      className: "font-serif text-[0.7rem]",
    },
    {
      label: "tiny",
      title: "Tiny",
      before: "{\\tiny ",
      after: "}",
      className: "text-[0.6rem]",
    },
    {
      label: "small",
      title: "Small",
      before: "{\\small ",
      after: "}",
      className: "text-[0.7rem]",
    },
    {
      label: "large",
      title: "Large",
      before: "{\\large ",
      after: "}",
      className: "text-[0.9rem]",
    },
    {
      label: "huge",
      title: "Huge",
      before: "{\\huge ",
      after: "}",
      className: "text-[1rem]",
    },
  ],
};

const colorGroup: RibbonGroup = {
  name: "Math colour",
  items: [
    {
      label: "red",
      title: "Red math",
      before: "\\color{red}{",
      after: "}",
      className: "text-[#c64545] font-serif text-[0.75rem]",
    },
    {
      label: "blue",
      title: "Blue math",
      before: "\\color{blue}{",
      after: "}",
      className: "text-[#2563eb] font-serif text-[0.75rem]",
    },
    {
      label: "green",
      title: "Green math",
      before: "\\color{green!55!black}{",
      after: "}",
      className: "text-[#3d7a4a] font-serif text-[0.75rem]",
    },
    {
      label: "text red",
      title: "Red text in math",
      before: "\\textcolor{red}{",
      after: "}",
      className: "text-[#c64545] font-serif text-[0.7rem]",
    },
    {
      label: "text blue",
      title: "Blue text in math",
      before: "\\textcolor{blue}{",
      after: "}",
      className: "text-[#2563eb] font-serif text-[0.7rem]",
    },
    {
      label: "mark",
      title: "Highlighted math",
      before: "\\colorbox{yellow}{",
      after: "}",
      className: "bg-[#fff3a6] px-1 font-serif text-[0.7rem] text-[#5f4b00]",
    },
    {
      label: "fbox",
      title: "Framed coloured box",
      before: "\\fcolorbox{red}{yellow}{",
      after: "}",
      className:
        "border border-[#c64545] bg-[#fff3a6] px-1 font-serif text-[0.7rem] text-[#5f4b00]",
    },
  ],
};

const phantomGroup: RibbonGroup = {
  name: "Invisible",
  items: [
    {
      label: "box",
      title: "Boxed formula",
      before: "\\boxed{",
      after: "}",
      className: "font-serif text-[0.75rem]",
    },
    {
      label: "fbox",
      title: "Framed formula",
      before: "\\fbox{",
      after: "}",
      className: "font-serif text-[0.75rem]",
    },
    {
      label: "phantom",
      title: "Phantom",
      before: "\\phantom{",
      after: "}",
      className: "font-serif text-[0.7rem]",
    },
    {
      label: "hphantom",
      title: "Horizontal phantom",
      before: "\\hphantom{",
      after: "}",
      className: "font-serif text-[0.65rem]",
    },
    {
      label: "vphantom",
      title: "Vertical phantom",
      before: "\\vphantom{",
      after: "}",
      className: "font-serif text-[0.65rem]",
    },
    {
      label: "smash",
      title: "Smash",
      before: "\\smash{",
      after: "}",
      className: "font-serif text-[0.7rem]",
    },
    {
      label: "mathstrut",
      title: "Math strut",
      before: "\\mathstrut",
      className: "font-serif text-[0.65rem]",
    },
    {
      label: "not",
      title: "Negate",
      before: "\\not",
      className: "font-serif text-[0.75rem]",
    },
  ],
};

const tikzGroup: RibbonGroup = {
  name: "Math text",
  items: [
    {
      label: "text",
      title: "Text inside math",
      before: "\\text{",
      after: "}",
      className: "font-sans text-[0.75rem]",
    },
    {
      label: "rm",
      title: "Roman math",
      before: "\\mathrm{",
      after: "}",
      className: "font-serif text-[0.875rem]",
    },
    {
      label: "bf",
      title: "Bold math",
      before: "\\mathbf{",
      after: "}",
      className: "font-serif font-bold text-[0.875rem]",
    },
    {
      label: "cal",
      title: "Calligraphic",
      before: "\\mathcal{",
      after: "}",
      className: "font-serif italic text-[0.875rem]",
    },
    {
      label: "op",
      title: "Operator name",
      before: "\\operatorname{",
      after: "}",
      className: "font-sans text-[0.75rem]",
    },
    {
      label: "disp",
      title: "Display style",
      before: "\\displaystyle ",
      className: "font-serif text-[0.75rem]",
    },
    {
      label: "script",
      title: "Script style",
      before: "\\scriptstyle ",
      className: "font-serif text-[0.75rem]",
    },
  ],
};

const tikzCommandGroup: RibbonGroup = {
  name: "TikZ commands",
  items: [
    {
      label: "node",
      title: "Node",
      before: "\\node at (0,0) {",
      after: "};",
      className: "font-mono text-[0.7rem]",
    },
    {
      label: "draw",
      title: "Draw path",
      before: "\\draw ",
      className: "font-mono text-[0.7rem]",
    },
    {
      label: "fill",
      title: "Filled path",
      before: "\\fill ",
      className: "font-mono text-[0.7rem]",
    },
    {
      label: "path",
      title: "Path",
      before: "\\path ",
      className: "font-mono text-[0.7rem]",
    },
    {
      label: "coord",
      title: "Coordinate",
      before: "\\coordinate (A) at ",
      className: "font-mono text-[0.7rem]",
    },
    {
      label: "foreach",
      title: "Loop",
      before: "\\foreach \\x in {1,...,5} {",
      after: "}",
      className: "font-mono text-[0.65rem]",
    },
    {
      label: "thick",
      title: "Thick line",
      before: "[thick]",
      className: "font-mono text-[0.65rem]",
    },
    {
      label: "dashed",
      title: "Dashed line",
      before: "[dashed]",
      className: "font-mono text-[0.65rem]",
    },
    {
      label: "rounded",
      title: "Rounded corners",
      before: "[rounded corners]",
      className: "font-mono text-[0.65rem]",
    },
    {
      label: "fill",
      title: "Fill colour",
      before: "[fill=blue!20]",
      className: "font-mono text-[0.65rem]",
    },
  ],
};

const decorationGroup: RibbonGroup = {
  name: "Decorations",
  items: [
    {
      label: "⏟",
      title: "Underbrace",
      before: "\\underbrace{",
      after: "}_{}",
      className: "font-serif text-[1rem]",
    },
    {
      label: "⏞",
      title: "Overbrace",
      before: "\\overbrace{",
      after: "}^{}",
      className: "font-serif text-[1rem]",
    },
    {
      label: "sub",
      title: "Substack",
      before: "\\substack{",
      after: "}",
      className: "font-serif text-[0.75rem]",
    },
    {
      label: "red",
      title: "Red math",
      before: "\\color{red}{",
      after: "}",
      className: "text-[#c64545] font-serif text-[0.75rem]",
    },
    {
      label: "blue",
      title: "Blue math",
      before: "\\color{blue}{",
      after: "}",
      className: "text-[#2563eb] font-serif text-[0.75rem]",
    },
  ],
};

const diagramWizardGroup: RibbonGroup = {
  name: "Diagram wizard",
  items: [
    {
      label: "Diagram Wizard",
      title: "Research diagram wizard",
      description:
        "Choose a research, process, model, systems, concept, or math diagram and insert it as editable shapes.",
      icon: SparklesIcon,
      action: "diagram-wizard",
      large: true,
    },
  ],
};

const quickDiagramGroup: RibbonGroup = {
  name: "Quick start",
  items: [
    {
      label: "Pipeline",
      title: "Research pipeline",
      description: "Question → data → method → results → conclusion.",
      icon: WorkflowIcon,
      action: "diagram-wizard",
      templateId: "research-pipeline",
      large: true,
    },
    {
      label: "Flowchart",
      title: "Research flowchart",
      description: "A branching process with a decision point.",
      icon: NetworkIcon,
      action: "diagram-wizard",
      templateId: "research-flow",
      large: true,
    },
    {
      label: "Network",
      title: "Neural network",
      description: "Three connected layers with input and output labels.",
      icon: NetworkIcon,
      action: "diagram-wizard",
      templateId: "neural-network",
      large: true,
    },
    {
      label: "Layers",
      title: "Layered architecture",
      description: "Application, interface, services, and storage layers.",
      icon: LayersIcon,
      action: "diagram-wizard",
      templateId: "layered-architecture",
      large: true,
    },
  ],
};

const greekLowerGroup = symbolGroup("Lowercase", greekLower);
const greekUpperGroup = symbolGroup("Uppercase", greekUpper);

export const TABS: RibbonTab[] = [
  {
    id: "home",
    label: "Text",
    description: "Text styles, paragraphs, and colours.",
    groups: [textGroup, paragraphGroup, textDecorationGroup],
  },
  {
    id: "insert",
    label: "Insert",
    description: "Research diagram wizard and quick templates.",
    groups: [diagramWizardGroup, quickDiagramGroup],
  },
  {
    id: "math",
    label: "Structures",
    description:
      "Quick math, scripts, fractions, roots, brackets, accents, matrices, and environments.",
    groups: [
      mathGroup,
      scriptGroup,
      fractionGroup,
      rootGroup,
      bracketGroup,
      accentGroup,
      matrixGroup,
      environmentGroup,
    ],
  },
  {
    id: "operators",
    label: "Operators",
    description:
      "Binary operators, relations, big operators, named functions, and spacing.",
    groups: [
      binaryGroup,
      relationGroup,
      bigOperatorGroup,
      functionGroup,
      spacingGroup,
    ],
  },
  {
    id: "greek",
    label: "Greek",
    description: "Lowercase and uppercase Greek letters.",
    groups: [greekLowerGroup, greekUpperGroup],
  },
  {
    id: "symbols",
    label: "Symbols",
    description: "Sets, logic, geometry, arrows, harpoons, and dots.",
    groups: [
      setGroup,
      miscGroup,
      geometryGroup,
      arrowGroup,
      harpoonGroup,
      dotsGroup,
    ],
  },
  {
    id: "format",
    label: "Format",
    description: "Math alphabets, style, size, colour, and invisible spacing.",
    groups: [alphabetGroup, sizeGroup, colorGroup, phantomGroup],
  },
  {
    id: "tikz",
    label: "TikZ",
    description: "TikZ commands and math-label decorations.",
    groups: [tikzGroup, tikzCommandGroup, decorationGroup],
  },
];
