import { createTikzShape, type TikzShape } from "@/lib/tikz";

export type DiagramCategory =
  | "Research"
  | "Process"
  | "Models"
  | "Systems"
  | "Concept"
  | "Math"
  | "Statistics";

export interface TikzDiagramTemplate {
  id: string;
  name: string;
  description: string;
  category: DiagramCategory;
  build: () => TikzShape[];
}

const box = (
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  fill = "blue!10",
  stroke = "black",
) =>
  createTikzShape("rectangle", x, y, x + width, y + height, {
    label,
    fill,
    stroke,
    rounded: true,
    lineWidth: "thick",
  });

const ellipse = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  label: string,
  fill = "orange!10",
  stroke = "black",
) =>
  createTikzShape("ellipse", cx - rx, cy - ry, cx + rx, cy + ry, {
    label,
    fill,
    stroke,
    lineWidth: "thick",
  });

const arrow = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  label?: string,
  stroke = "black",
) =>
  createTikzShape("line", x1, y1, x2, y2, {
    arrow: "->",
    label,
    stroke,
    lineWidth: "thick",
  });

const connector = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke = "gray",
) =>
  createTikzShape("line", x1, y1, x2, y2, {
    arrow: "none",
    stroke,
    lineWidth: "thin",
  });

const label = (
  x: number,
  y: number,
  text: string,
  fontSize = 12,
  stroke = "black",
) =>
  createTikzShape("text", x, y, x, y, {
    label: text,
    fontSize,
    stroke,
  });

const title = (text: string, y = 9.2) => label(8, y, `\\textbf{${text}}`, 18);

const dot = (
  cx: number,
  cy: number,
  radius = 0.07,
  fill = "blue!10",
  stroke = "blue",
) =>
  createTikzShape(
    "ellipse",
    cx - radius,
    cy - radius,
    cx + radius,
    cy + radius,
    {
      label: "",
      fill,
      stroke,
      lineWidth: "thin",
    },
  );

const rect = (
  x: number,
  y: number,
  width: number,
  height: number,
  fill = "none",
  stroke = "black",
  dash: "solid" | "dashed" | "dotted" = "solid",
) =>
  createTikzShape("rectangle", x, y, x + width, y + height, {
    label: "",
    fill,
    stroke,
    dash,
    lineWidth: "thin",
  });

const guide = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke = "gray",
) =>
  createTikzShape("line", x1, y1, x2, y2, {
    arrow: "none",
    stroke,
    dash: "dashed",
    lineWidth: "thin",
  });

const polyline = (
  points: [number, number][],
  stroke = "blue",
  lineWidth: "thin" | "thick" = "thick",
): TikzShape[] =>
  points.slice(0, -1).map(([x, y], index) => {
    const next = points[index + 1]!;
    return createTikzShape("line", x, y, next[0], next[1], {
      arrow: "none",
      stroke,
      lineWidth,
    });
  });

const deterministicDots = (
  count: number,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number,
  fill = "blue!10",
  stroke = "blue",
): TikzShape[] => {
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 2 ** 32;
  };

  return Array.from({ length: count }, () =>
    dot(
      x + 0.15 + random() * (width - 0.3),
      y + 0.15 + random() * (height - 0.3),
      0.055,
      fill,
      stroke,
    ),
  );
};

export const TIKZ_DIAGRAM_TEMPLATES: TikzDiagramTemplate[] = [
  {
    id: "research-pipeline",
    name: "Research pipeline",
    description:
      "A five-stage question → data → method → results → conclusion flow.",
    category: "Research",
    build: () => {
      const stages = [
        ["Question", 1.25, "blue!10"],
        ["Data", 4.1, "green!10"],
        ["Method", 6.95, "orange!10"],
        ["Results", 9.8, "red!10"],
        ["Conclusion", 12.65, "yellow!20"],
      ] as const;

      return [
        title("Research pipeline"),
        ...stages.map(([name, x, fill]) => box(x, 4.4, 2.05, 1.5, name, fill)),
        ...stages
          .slice(0, -1)
          .map(([, x], index) =>
            arrow(x + 2.05, 5.15, stages[index + 1]![1], 5.15),
          ),
        label(8, 3.75, "From uncertainty to evidence", 10, "gray"),
      ];
    },
  },
  {
    id: "research-flow",
    name: "Research flowchart",
    description:
      "Start, literature, experiment, decision, and reporting blocks.",
    category: "Research",
    build: () => {
      const nodes = [
        ellipse(8, 8.6, 1.25, 0.48, "Start"),
        box(6.7, 6.5, 2.6, 1.15, "Literature review", "blue!10"),
        box(6.7, 4.45, 2.6, 1.15, "Experiment", "green!10"),
        ellipse(8, 2.7, 1.55, 0.55, "Evidence strong?", "yellow!20"),
        box(10.7, 2.15, 2.5, 1.1, "Report", "orange!10"),
        box(2.7, 2.15, 2.5, 1.1, "Revise", "red!10"),
      ];

      return [
        title("Research flowchart"),
        ...nodes,
        arrow(8, 8.12, 8, 7.65),
        arrow(8, 6.5, 8, 5.6),
        arrow(8, 4.45, 8, 3.25),
        arrow(9.4, 2.7, 10.7, 2.7, "yes"),
        arrow(6.6, 2.7, 5.2, 2.7, "no"),
        arrow(4.85, 3.25, 6.7, 4.7, "refine"),
      ];
    },
  },
  {
    id: "neural-network",
    name: "Neural network",
    description:
      "Three fully connected layers with labeled input, hidden, and output nodes.",
    category: "Models",
    build: () => {
      const layers = [
        { x: 3.1, count: 3, fill: "blue!10" },
        { x: 8, count: 4, fill: "green!10" },
        { x: 12.9, count: 3, fill: "orange!10" },
      ];
      const nodes = layers.flatMap((layer) =>
        Array.from({ length: layer.count }, (_, index) => {
          const spacing = 1.55;
          const y = 5 + (index - (layer.count - 1) / 2) * spacing;
          return {
            layer,
            x: layer.x,
            y,
            shape: ellipse(layer.x, y, 0.34, 0.34, "", layer.fill),
          };
        }),
      );

      const connections: TikzShape[] = [];
      for (let layerIndex = 0; layerIndex < layers.length - 1; layerIndex++) {
        const from = nodes.filter(
          (node) => node.layer.x === layers[layerIndex]!.x,
        );
        const to = nodes.filter(
          (node) => node.layer.x === layers[layerIndex + 1]!.x,
        );

        for (const source of from) {
          for (const target of to) {
            connections.push(
              connector(source.x + 0.3, source.y, target.x - 0.3, target.y),
            );
          }
        }
      }

      return [
        title("Neural network"),
        ...connections,
        ...nodes.map((node) => node.shape),
        label(3.1, 8.05, "Input", 11, "gray"),
        label(8, 8.05, "Hidden", 11, "gray"),
        label(12.9, 8.05, "Output", 11, "gray"),
        label(1.6, 5, "x", 14),
        label(15.1, 5, "y", 14),
      ];
    },
  },
  {
    id: "layered-architecture",
    name: "Layered architecture",
    description:
      "Application, API, services, and data layers with upward flow arrows.",
    category: "Systems",
    build: () => {
      const layers = [
        ["Application", 7.45, "blue!10"],
        ["API / interface", 5.7, "green!10"],
        ["Services", 3.95, "orange!10"],
        ["Storage", 2.2, "red!10"],
      ] as const;

      return [
        title("Layered architecture"),
        ...layers.map(([name, y, fill]) => box(3.3, y, 9.4, 1.25, name, fill)),
        ...layers.slice(0, -1).map(([, y], index) => {
          const next = layers[index + 1]!;
          return arrow(1.9, y + 0.62, 1.9, next[1] + 0.62);
        }),
        label(1.9, 9.0, "request", 9, "gray"),
      ];
    },
  },
  {
    id: "concept-map",
    name: "Concept map",
    description:
      "A central construct connected to theory, data, method, evidence, and limits.",
    category: "Concept",
    build: () => {
      const center = ellipse(8, 5.2, 1.75, 0.78, "Core concept", "yellow!20");
      const satellites = [
        ["Theory", 2.0, 7.7, "blue!10"],
        ["Data", 13.85, 7.7, "green!10"],
        ["Method", 1.6, 2.25, "orange!10"],
        ["Evidence", 13.9, 2.25, "red!10"],
        ["Limits", 8, 1.2, "gray"],
      ] as const;

      return [
        title("Concept map"),
        center,
        ...satellites.map(([name, x, y, fill]) =>
          box(x, y, 2.15, 1.15, name, fill),
        ),
        connector(7.1, 5.2, 4.15, 7.7),
        connector(8.9, 5.2, 13.85, 7.7),
        connector(7.15, 4.7, 3.75, 2.85),
        connector(8.85, 4.7, 13.9, 2.85),
        connector(8, 4.42, 8, 2.35),
      ];
    },
  },
  {
    id: "timeline",
    name: "Research timeline",
    description:
      "A horizontal milestone track with four labeled phases and dates.",
    category: "Process",
    build: () => {
      const milestones = [
        ["Proposal", 3.1, "2025"],
        ["Pilot", 6.6, "2026"],
        ["Study", 10.1, "2026"],
        ["Write-up", 13.4, "2027"],
      ] as const;

      return [
        title("Research timeline"),
        connector(1.2, 5.1, 14.8, 5.1, "black"),
        ...milestones
          .map(([name, x, year], index) => {
            const above = index % 2 === 0;
            return [
              ellipse(x, 5.1, 0.18, 0.18, "", "blue!10", "black"),
              label(x, above ? 6.25 : 3.9, name, 11),
              label(x, above ? 5.65 : 4.45, year, 9, "gray"),
              connector(x, 5.1, x, above ? 5.95 : 4.3, "gray"),
            ];
          })
          .flat(),
      ];
    },
  },
  {
    id: "comparison-matrix",
    name: "2 × 2 comparison",
    description:
      "A four-quadrant matrix for comparing constructs along two axes.",
    category: "Concept",
    build: () => [
      title("Comparison matrix"),
      box(2.7, 4.95, 5.3, 2.35, "High A + High B", "blue!10"),
      box(8.2, 4.95, 5.3, 2.35, "High A + Low B", "green!10"),
      box(2.7, 2.4, 5.3, 2.35, "Low A + High B", "orange!10"),
      box(8.2, 2.4, 5.3, 2.35, "Low A + Low B", "red!10"),
      arrow(1.8, 2.2, 1.8, 7.6),
      arrow(1.8, 2.2, 14.3, 2.2),
      label(1.5, 5.1, "B", 13, "gray"),
      label(8, 1.75, "A", 13, "gray"),
    ],
  },
  {
    id: "commutative-diagram",
    name: "Commutative diagram",
    description: "Four objects and labeled morphisms for a commuting square.",
    category: "Math",
    build: () => [
      title("Commutative diagram"),
      ellipse(3.2, 7.2, 0.65, 0.55, "$A$", "blue!10"),
      ellipse(8, 7.2, 0.65, 0.55, "$B$", "green!10"),
      ellipse(3.2, 3.2, 0.65, 0.55, "$C$", "orange!10"),
      ellipse(8, 3.2, 0.65, 0.55, "$D$", "red!10"),
      arrow(3.85, 7.2, 7.35, 7.2, "$f$"),
      arrow(3.2, 6.65, 3.2, 3.75, "$g$"),
      arrow(8, 6.65, 8, 3.75, "$h$"),
      arrow(3.85, 3.2, 7.35, 3.2, "$k$"),
      label(5.6, 5.2, "$h \\circ f = k \\circ g$", 12, "gray"),
    ],
  },
  {
    id: "lattice-face",
    name: "Lattice & marked face",
    description:
      "A coordinate lattice with a highlighted face, a block, and a compact legend. Generic for block or spatial arguments.",
    category: "Math",
    build: () => {
      const points: TikzShape[] = [];
      for (let column = 0; column < 6; column++) {
        for (let row = 0; row < 4; row++) {
          points.push(
            dot(2.5 + column * 1.25, 2.6 + row * 1.18, 0.055, "gray", "gray"),
          );
        }
      }

      return [
        title("Lattice and marked face"),
        connector(1.7, 2.2, 13.4, 2.2),
        connector(1.7, 2.2, 1.7, 7.4),
        ...points,
        rect(4.0, 3.75, 3.75, 2.4, "blue!10", "blue"),
        rect(3.25, 3.0, 5.25, 3.9, "none", "orange", "dashed"),
        label(5.85, 6.55, "face $F$", 11, "blue"),
        label(5.85, 2.85, "block", 10, "orange"),
        label(7.55, 1.85, "$k_1$", 10, "gray"),
        label(1.35, 4.65, "$k_2$", 10, "gray"),
        label(11.15, 6.7, "lattice points", 10, "gray"),
        dot(10.75, 6.85, 0.06, "gray", "gray"),
        label(11.3, 5.95, "highlighted face", 10, "blue"),
        rect(10.45, 5.95, 0.45, 0.3, "blue!10", "blue"),
        label(11.3, 5.1, "block boundary", 10, "orange"),
        rect(10.45, 5.1, 0.45, 0.3, "none", "orange", "dashed"),
      ];
    },
  },
  {
    id: "domain-window",
    name: "Domain / support window",
    description:
      "An irregular domain inside a bounding box, a marked point, one orthant, and a legend. Good for windowed or censored data.",
    category: "Research",
    build: () => {
      const outline = polyline(
        [
          [2.2, 2.2],
          [2.2, 7.8],
          [6.1, 7.8],
          [6.1, 5.25],
          [9.2, 5.25],
          [9.2, 2.2],
          [2.2, 2.2],
        ],
        "green",
        "thick",
      );

      return [
        title("Domain and support window"),
        rect(2.2, 2.2, 3.9, 5.6, "green!10", "green"),
        rect(2.2, 2.2, 7.0, 3.05, "green!10", "green"),
        ...outline,
        rect(2.2, 2.2, 3.9, 3.05, "none", "orange", "dashed"),
        dot(6.1, 5.25, 0.09, "orange!10", "orange"),
        label(6.35, 5.55, "$x$", 12, "orange"),
        label(2.55, 7.15, "$W$", 13, "green"),
        label(2.55, 2.55, "$c_0$", 10, "gray"),
        label(10.0, 7.2, "support window", 11, "gray"),
        rect(9.75, 6.9, 0.5, 0.35, "green!10", "green"),
        label(10.0, 6.1, "orthant at $x$", 11, "gray"),
        rect(9.75, 5.95, 0.5, 0.35, "none", "orange", "dashed"),
        label(10.0, 5.0, "marked point", 11, "gray"),
        dot(10.0, 5.25, 0.08, "orange!10", "orange"),
        label(
          8,
          1.6,
          "combine windows to model missing or bounded observations",
          10,
          "gray",
        ),
      ];
    },
  },
  {
    id: "orthant-decomposition",
    name: "Orthant decomposition",
    description:
      "Four small panels shade the four orthants around a point; standard for quadrant, copula, and dependence arguments.",
    category: "Math",
    build: () => {
      const panels = [
        { x: 1.2, y: 5.0, label: "(a) lower-left", fill: "blue!10" },
        { x: 5.0, y: 5.0, label: "(b) upper-left", fill: "green!10" },
        { x: 1.2, y: 1.7, label: "(c) upper-right", fill: "red!10" },
        { x: 5.0, y: 1.7, label: "(d) lower-right", fill: "orange!10" },
      ] as const;

      return [
        title("Orthant decomposition"),
        ...panels.flatMap((panel) => {
          const size = 3.1;
          const pointX = panel.x + 2.15;
          const pointY = panel.y + 1.25;
          const shades = {
            "blue!10": rect(
              panel.x,
              panel.y,
              pointX - panel.x,
              pointY - panel.y,
              "blue!10",
              "blue",
              "solid",
            ),
            "green!10": rect(
              panel.x,
              pointY,
              pointX - panel.x,
              panel.y + size - pointY,
              "green!10",
              "green",
              "solid",
            ),
            "red!10": rect(
              pointX,
              pointY,
              panel.x + size - pointX,
              panel.y + size - pointY,
              "red!10",
              "red",
              "solid",
            ),
            "orange!10": rect(
              pointX,
              panel.y,
              panel.x + size - pointX,
              pointY - panel.y,
              "orange!10",
              "orange",
              "solid",
            ),
          } as const;

          return [
            rect(panel.x, panel.y, size, size, "none", "black"),
            shades[panel.fill],
            dot(pointX, pointY, 0.075, "orange!10", "orange"),
            label(panel.x + size / 2, panel.y - 0.35, panel.label, 9, "gray"),
            label(pointX + 0.25, pointY + 0.2, "$x$", 10, "orange"),
          ];
        }),
        label(8.6, 6.7, "each panel isolates", 10, "gray"),
        label(8.6, 6.15, "one orthant of $x$", 10, "gray"),
        label(8.6, 5.35, "generic labels", 10, "gray"),
        label(8.6, 4.8, "$p_{00}(x),\\ldots,p_{11}(x)$", 10, "gray"),
        label(8.6, 3.6, "shade one region", 10, "gray"),
        label(8.6, 3.05, "per panel", 10, "gray"),
      ];
    },
  },
  {
    id: "block-decomposition",
    name: "Block decomposition",
    description:
      "An operator or model splits into invariant and scalar components, then recombines into one result.",
    category: "Systems",
    build: () => [
      title("Block decomposition"),
      box(3.2, 7.1, 9.6, 1.15, "Operator / model $T$", "blue!10"),
      box(1.7, 4.25, 5.5, 1.8, "Invariant block", "green!10"),
      box(8.8, 4.25, 5.5, 1.8, "Scalar / residual part", "orange!10"),
      box(3.2, 1.9, 9.6, 1.0, "Factorized result", "red!10"),
      arrow(5.0, 7.1, 4.45, 6.05, "+"),
      arrow(11.0, 7.1, 11.55, 6.05, "$-$"),
      arrow(4.45, 4.25, 4.45, 2.9),
      arrow(11.55, 4.25, 11.55, 2.9),
      label(8, 5.2, "restriction", 10, "gray"),
      label(8, 3.45, "recombine", 10, "gray"),
    ],
  },
  {
    id: "dual-validation",
    name: "Dual validation pipeline",
    description:
      "Two candidate paths run through matching checks and converge on one accept/reject outcome.",
    category: "Research",
    build: () => {
      const steps = ["Commit", "Build", "Compare", "Check"];
      const row = (y: number, rowLabel: string, fill: string) => [
        label(0.7, y + 0.5, rowLabel, 13, "gray"),
        ...steps.map((step, index) =>
          box(1.5 + index * 2.7, y, 2.15, 1.0, step, fill),
        ),
        ...steps
          .slice(0, -1)
          .map((_, index) =>
            arrow(3.65 + index * 2.7, y + 0.5, 4.2 + index * 2.7, y + 0.5),
          ),
      ];

      return [
        title("Dual validation pipeline"),
        ...row(6.4, "A", "blue!10"),
        ...row(3.9, "B", "green!10"),
        box(12.4, 4.55, 2.4, 2.2, "Accept / compare", "yellow!20"),
        arrow(11.95, 6.9, 12.4, 6.2),
        arrow(11.95, 4.4, 12.4, 5.0),
        label(8, 2.9, "same checks for both candidate paths", 10, "gray"),
      ];
    },
  },
  {
    id: "scatter-panels",
    name: "Point-pattern panels",
    description:
      "Three small multiples with increasing point density — useful for sample-size, CSR, or clustering illustrations.",
    category: "Research",
    build: () => {
      const panels = [
        { x: 1.2, count: 8, seed: 101, label: "n = 8" },
        { x: 4.55, count: 16, seed: 202, label: "n = 16" },
        { x: 7.9, count: 28, seed: 303, label: "n = 28" },
      ] as const;

      return [
        title("Point-pattern panels"),
        ...panels.flatMap((panel) => [
          rect(panel.x, 3.0, 3.0, 3.0, "none", "black"),
          ...deterministicDots(
            panel.count,
            panel.x,
            3.0,
            3.0,
            3.0,
            panel.seed,
            "blue!10",
            "blue",
          ),
          label(panel.x + 1.5, 2.55, panel.label, 10, "gray"),
        ]),
        label(12.4, 5.3, "increase density", 10, "gray"),
        label(12.4, 4.75, "or sample size", 10, "gray"),
        label(12.4, 4.2, "keep panels paired", 10, "gray"),
      ];
    },
  },
  {
    id: "trend-plot",
    name: "Trend plot",
    description:
      "A generic two-series trend chart built from axes, points, and line segments. Good for convergence or performance sketches.",
    category: "Models",
    build: () => {
      const seriesA: [number, number][] = [
        [2.7, 3.0],
        [4.7, 3.6],
        [6.7, 4.7],
        [8.7, 5.3],
        [10.7, 6.3],
      ];
      const seriesB: [number, number][] = [
        [2.7, 2.6],
        [4.7, 2.9],
        [6.7, 3.4],
        [8.7, 4.0],
        [10.7, 4.35],
      ];

      return [
        title("Trend plot"),
        connector(1.8, 2.2, 13.6, 2.2),
        connector(1.8, 2.2, 1.8, 7.7),
        ...polyline(seriesA, "blue"),
        ...polyline(seriesB, "red"),
        ...seriesA.map(([x, y]) => dot(x, y, 0.09, "blue!10", "blue")),
        ...seriesB.map(([x, y]) => dot(x, y, 0.09, "red!10", "red")),
        label(13.1, 2.0, "$x$", 11, "gray"),
        label(1.55, 7.45, "$y$", 11, "gray"),
        label(12.8, 6.1, "series A", 10, "blue"),
        label(12.8, 5.5, "series B", 10, "red"),
        label(
          7.6,
          1.55,
          "values are placeholders; edit the points directly",
          9,
          "gray",
        ),
      ];
    },
  },
  {
    id: "pca-biplot",
    name: "PCA biplot",
    description:
      "A score plot with two loading vectors and a centered origin — a generic PCA/PcoA schematic.",
    category: "Statistics",
    build: () => {
      const points = [
        [3.0, 3.4],
        [3.8, 4.8],
        [4.6, 3.9],
        [5.4, 6.0],
        [8.1, 6.8],
        [9.0, 3.5],
        [10.0, 4.7],
        [5.7, 2.9],
        [6.8, 4.3],
        [9.6, 6.2],
        [7.2, 7.1],
        [4.2, 6.6],
      ] as const;

      return [
        title("PCA biplot"),
        rect(2.0, 2.0, 10.2, 6.0, "none", "gray"),
        guide(7.1, 2.2, 7.1, 7.8, "gray"),
        guide(2.2, 5.0, 12.0, 5.0, "gray"),
        ...points.map(([x, y]) => dot(x, y, 0.09, "blue!10", "blue")),
        arrow(7.1, 5.0, 10.1, 7.2, "PC1", "blue"),
        arrow(7.1, 5.0, 4.1, 6.8, "PC2", "red"),
        label(12.15, 4.85, "PC1", 10, "gray"),
        label(7.1, 1.7, "PC2", 10, "gray"),
        label(6.4, 4.55, "0", 9, "gray"),
        label(7.1, 8.15, "score space", 10, "gray"),
        label(9.8, 2.55, "each dot = observation", 10, "gray"),
      ];
    },
  },
  {
    id: "cfa-model",
    name: "CFA measurement model",
    description:
      "Two latent factors with three observed indicators and error terms each.",
    category: "Statistics",
    build: () => {
      const factors = [
        {
          x: 4.2,
          label: "$F_1$",
          fill: "blue!10",
          indicators: [2.1, 4.2, 6.3],
        },
        {
          x: 11.8,
          label: "$F_2$",
          fill: "green!10",
          indicators: [9.7, 11.8, 13.9],
        },
      ] as const;

      return [
        title("CFA measurement model"),
        ...factors.flatMap((factor) => [
          ellipse(factor.x, 7.3, 1.05, 0.55, factor.label, factor.fill),
          ...factor.indicators.flatMap((x, index) => [
            box(x - 0.8, 3.9, 1.6, 0.95, `$y_${index + 1}$`, "yellow!20"),
            arrow(factor.x, 6.75, x, 4.85),
            ellipse(x, 2.55, 0.34, 0.25, "", "gray"),
            label(x, 2.1, `$e_${index + 1}$`, 9, "gray"),
            arrow(x, 2.8, x, 3.9),
          ]),
        ]),
        label(8, 8.45, "latent variables", 10, "gray"),
        label(8, 1.35, "observed indicators + measurement error", 10, "gray"),
      ];
    },
  },
  {
    id: "sem-model",
    name: "SEM structural model",
    description:
      "A three-construct structural model with direct paths and observed indicators.",
    category: "Statistics",
    build: () => {
      const constructs = [
        { x: 3.0, label: "$X$", fill: "blue!10", indicators: [1.7, 3.0] },
        { x: 8.0, label: "$M$", fill: "green!10", indicators: [6.8, 8.0] },
        { x: 13.0, label: "$Y$", fill: "orange!10", indicators: [11.8, 13.0] },
      ] as const;

      return [
        title("SEM structural model"),
        ...constructs.flatMap((construct) => [
          ellipse(
            construct.x,
            6.5,
            1.15,
            0.58,
            construct.label,
            construct.fill,
          ),
          ...construct.indicators
            .map((x, index) => [
              box(x - 0.65, 3.4, 1.3, 0.85, `$z_${index + 1}$`, "gray"),
              arrow(construct.x, 5.9, x, 4.25),
            ])
            .flat(),
        ]),
        arrow(4.15, 6.5, 6.85, 6.5, "$a$"),
        arrow(9.15, 6.5, 11.85, 6.5, "$b$"),
        arrow(3.0, 5.9, 3.0, 4.4, "$c'$", "gray"),
        connector(3.0, 4.4, 13.0, 4.4, "gray"),
        arrow(13.0, 4.4, 13.0, 5.9, "", "gray"),
        label(8, 8.15, "structural paths", 10, "gray"),
      ];
    },
  },
  {
    id: "scatter-fit",
    name: "Scatterplot with fit",
    description:
      "A generic scatterplot, fitted line, and axes — ideal for correlations or regression sketches.",
    category: "Statistics",
    build: () => {
      const points = [
        [2.8, 3.1],
        [3.6, 3.5],
        [4.5, 2.9],
        [5.1, 4.4],
        [5.8, 4.0],
        [6.5, 5.1],
        [7.3, 4.7],
        [8.0, 5.8],
        [8.9, 5.2],
        [9.6, 6.5],
        [10.4, 6.0],
        [11.2, 7.0],
        [4.0, 5.8],
        [7.0, 3.4],
      ] as const;

      return [
        title("Scatterplot with fitted line"),
        connector(2.0, 2.0, 12.6, 2.0),
        connector(2.0, 2.0, 2.0, 7.9),
        ...points.map(([x, y]) => dot(x, y, 0.09, "blue!10", "blue")),
        ...polyline(
          [
            [2.4, 2.7],
            [11.8, 7.2],
          ],
          "red",
          "thick",
        ),
        label(12.4, 1.75, "$x$", 11, "gray"),
        label(1.6, 7.65, "$y$", 11, "gray"),
        label(10.6, 6.45, "fit", 10, "red"),
        label(
          7.1,
          1.4,
          "points are placeholders; drag them directly",
          9,
          "gray",
        ),
      ];
    },
  },
  {
    id: "network-graph",
    name: "Network graph",
    description:
      "A central node with connected neighbors and cross-links for graphs, dependencies, or networks.",
    category: "Statistics",
    build: () => {
      const center = ellipse(8, 5.2, 1.15, 0.65, "Node A", "yellow!20");
      const nodes = [
        { x: 3.1, y: 7.2, label: "B", fill: "blue!10" },
        { x: 12.9, y: 7.2, label: "C", fill: "green!10" },
        { x: 2.6, y: 3.0, label: "D", fill: "orange!10" },
        { x: 13.4, y: 3.0, label: "E", fill: "red!10" },
        { x: 5.7, y: 1.5, label: "F", fill: "blue!10" },
        { x: 10.3, y: 1.5, label: "G", fill: "green!10" },
      ] as const;

      return [
        title("Network graph"),
        ...nodes.flatMap((node) => [
          connector(8, 5.2, node.x, node.y),
          ellipse(node.x, node.y, 0.68, 0.45, node.label, node.fill),
        ]),
        center,
        connector(3.1, 7.2, 12.9, 7.2, "gray"),
        connector(2.6, 3.0, 13.4, 3.0, "gray"),
        connector(5.7, 1.5, 10.3, 1.5, "gray"),
        label(
          8,
          8.7,
          "nodes + edges (replace labels with your variables)",
          9,
          "gray",
        ),
      ];
    },
  },
  {
    id: "histogram",
    name: "Histogram",
    description:
      "A distribution sketch with axes and adjustable bars — good for showing spread or skew.",
    category: "Statistics",
    build: () => {
      const heights = [1.0, 1.8, 3.2, 5.5, 6.8, 5.9, 4.2, 2.4, 1.2];
      return [
        title("Histogram"),
        connector(2.0, 2.0, 13.0, 2.0),
        connector(2.0, 2.0, 2.0, 8.0),
        ...heights.map((height, index) =>
          rect(2.5 + index * 1.1, 2.0, 1.0, height, "blue!10", "blue"),
        ),
        label(12.8, 1.7, "$x$", 11, "gray"),
        label(1.55, 7.8, "count", 11, "gray"),
        label(7.5, 1.35, "bin width is adjustable", 9, "gray"),
      ];
    },
  },
  {
    id: "boxplot",
    name: "Boxplot comparison",
    description:
      "Three groups with boxes, medians, whiskers, and outliers for side-by-side distributions.",
    category: "Statistics",
    build: () => {
      const groups = [
        { x: 3.8, low: 2.7, q1: 3.8, median: 4.6, q3: 5.7, high: 6.7 },
        { x: 7.2, low: 3.2, q1: 4.2, median: 5.2, q3: 6.3, high: 7.2 },
        { x: 10.6, low: 2.3, q1: 3.4, median: 4.0, q3: 5.0, high: 6.2 },
      ] as const;

      return [
        title("Boxplot comparison"),
        connector(2.0, 2.0, 12.5, 2.0),
        connector(2.0, 2.0, 2.0, 8.0),
        ...groups.flatMap((group, index) => [
          connector(group.x, group.low, group.x, group.q1, "gray"),
          connector(group.x, group.q3, group.x, group.high, "gray"),
          connector(
            group.x - 0.55,
            group.low,
            group.x + 0.55,
            group.low,
            "gray",
          ),
          connector(
            group.x - 0.55,
            group.high,
            group.x + 0.55,
            group.high,
            "gray",
          ),
          rect(
            group.x - 0.55,
            group.q1,
            1.1,
            group.q3 - group.q1,
            "blue!10",
            "blue",
          ),
          connector(
            group.x - 0.55,
            group.median,
            group.x + 0.55,
            group.median,
            "red",
          ),
          label(group.x, 1.65, `Group ${index + 1}`, 9, "gray"),
        ]),
        dot(11.05, 7.0, 0.07, "red!10", "red"),
        label(12.4, 1.35, "outlier", 9, "gray"),
      ];
    },
  },
  {
    id: "bar-chart",
    name: "Grouped bar chart",
    description:
      "Two series across four categories with axes — a clean results figure.",
    category: "Statistics",
    build: () => {
      const values = [
        [3.0, 4.1],
        [4.6, 5.2],
        [5.4, 4.8],
        [6.2, 6.8],
      ] as const;

      return [
        title("Grouped bar chart"),
        connector(2.0, 2.0, 13.0, 2.0),
        connector(2.0, 2.0, 2.0, 8.0),
        ...values.flatMap((pair, index) => [
          rect(2.8 + index * 2.5, 2.0, 0.8, pair[0], "blue!10", "blue"),
          rect(3.7 + index * 2.5, 2.0, 0.8, pair[1], "green!10", "green"),
          label(3.45 + index * 2.5, 1.65, `C${index + 1}`, 9, "gray"),
        ]),
        label(12.8, 1.7, "$x$", 11, "gray"),
        label(1.55, 7.8, "value", 11, "gray"),
        label(12.4, 7.5, "Series A", 9, "blue"),
        label(12.4, 7.0, "Series B", 9, "green"),
      ];
    },
  },
  {
    id: "forest-plot",
    name: "Forest plot",
    description:
      "Five study estimates with confidence intervals and a null-effect reference line.",
    category: "Statistics",
    build: () => {
      const rows = [
        { y: 7.1, low: 4.4, estimate: 6.8, high: 9.2 },
        { y: 6.2, low: 3.8, estimate: 6.0, high: 8.4 },
        { y: 5.3, low: 5.1, estimate: 7.2, high: 9.8 },
        { y: 4.4, low: 6.0, estimate: 8.1, high: 10.4 },
        { y: 3.5, low: 5.4, estimate: 7.8, high: 9.0 },
      ] as const;

      return [
        title("Forest plot"),
        connector(2.0, 2.3, 12.4, 2.3),
        guide(8.0, 2.3, 8.0, 7.9, "gray"),
        ...rows.flatMap((row, index) => [
          connector(row.low, row.y, row.high, row.y, "gray"),
          rect(
            row.estimate - 0.08,
            row.y - 0.08,
            0.16,
            0.16,
            "blue!10",
            "blue",
          ),
          dot(row.estimate, row.y, 0.09, "blue!10", "blue"),
          label(2.2, row.y + 0.18, `Study ${index + 1}`, 9, "gray"),
        ]),
        label(8, 2.0, "effect size", 10, "gray"),
        label(10.5, 7.9, "null", 9, "gray"),
      ];
    },
  },
  {
    id: "roc-curve",
    name: "ROC curve",
    description:
      "A square ROC plot with a diagonal reference and a stepped empirical curve.",
    category: "Statistics",
    build: () => [
      title("ROC curve"),
      rect(2.3, 1.9, 6.2, 6.2, "none", "gray"),
      guide(2.3, 1.9, 8.5, 8.1, "gray"),
      ...polyline(
        [
          [2.3, 1.9],
          [2.8, 3.4],
          [3.6, 3.8],
          [4.4, 4.6],
          [5.2, 5.1],
          [6.2, 6.4],
          [7.1, 6.8],
          [8.5, 8.1],
        ],
        "blue",
        "thick",
      ),
      ...[
        [2.8, 3.4],
        [4.4, 4.6],
        [6.2, 6.4],
        [7.1, 6.8],
      ].map(([x, y]) => dot(x, y, 0.08, "blue!10", "blue")),
      label(7.9, 1.5, "FPR", 10, "gray"),
      label(1.55, 7.4, "TPR", 10, "gray"),
      label(9.1, 5.5, "AUC = area", 10, "gray"),
      label(9.1, 4.9, "under the curve", 10, "gray"),
    ],
  },
  {
    id: "survival-curve",
    name: "Survival curves",
    description:
      "Two stepped survival curves with axes — generic time-to-event illustration.",
    category: "Statistics",
    build: () => {
      const curveA: [number, number][] = [
        [2.2, 7.2],
        [3.2, 7.2],
        [3.2, 6.3],
        [5.0, 6.3],
        [5.0, 5.4],
        [7.2, 5.4],
        [7.2, 4.5],
        [9.2, 4.5],
        [9.2, 3.7],
        [11.5, 3.7],
      ];
      const curveB: [number, number][] = [
        [2.2, 6.5],
        [4.0, 6.5],
        [4.0, 5.5],
        [6.0, 5.5],
        [6.0, 4.2],
        [8.0, 4.2],
        [8.0, 3.2],
        [10.0, 3.2],
        [10.0, 2.6],
        [11.5, 2.6],
      ];

      return [
        title("Survival curves"),
        connector(2.0, 2.0, 12.5, 2.0),
        connector(2.0, 2.0, 2.0, 8.0),
        ...polyline(curveA, "blue", "thick"),
        ...polyline(curveB, "red", "thick"),
        label(12.3, 1.65, "time", 10, "gray"),
        label(1.55, 7.7, "S(t)", 10, "gray"),
        label(10.2, 6.8, "Group A", 9, "blue"),
        label(10.2, 4.9, "Group B", 9, "red"),
      ];
    },
  },
  {
    id: "confusion-matrix",
    name: "Confusion matrix",
    description: "A labeled 2 × 2 confusion matrix for classification results.",
    category: "Statistics",
    build: () => [
      title("Confusion matrix"),
      box(3.4, 4.9, 4.0, 2.0, "True positive", "green!10"),
      box(7.4, 4.9, 4.0, 2.0, "False positive", "red!10"),
      box(3.4, 2.9, 4.0, 2.0, "False negative", "orange!10"),
      box(7.4, 2.9, 4.0, 2.0, "True negative", "blue!10"),
      label(8.0, 7.35, "Predicted", 11, "gray"),
      label(2.4, 5.9, "Actual +", 10, "gray"),
      label(2.4, 3.9, "Actual $-$", 10, "gray"),
      label(5.4, 2.4, "Predicted +", 9, "gray"),
      label(9.4, 2.4, "Predicted $-$", 9, "gray"),
    ],
  },
  {
    id: "correlation-matrix",
    name: "Correlation matrix",
    description:
      "A four-variable correlation heatmap with signed cells and labels.",
    category: "Statistics",
    build: () => {
      const values = [
        ["1.0", ".6", ".2", "-.1"],
        [".6", "1.0", ".4", ".1"],
        [".2", ".4", "1.0", ".7"],
        ["-.1", ".1", ".7", "1.0"],
      ] as const;
      const fills = [
        ["blue!10", "blue!10", "gray", "red!10"],
        ["blue!10", "blue!10", "gray", "gray"],
        ["gray", "gray", "blue!10", "blue!10"],
        ["red!10", "gray", "blue!10", "blue!10"],
      ] as const;
      const size = 1.5;
      const step = 1.62;
      const originX = 4.2;
      const originY = 2.1;
      const labels = ["V1", "V2", "V3", "V4"];

      return [
        title("Correlation matrix"),
        ...values.flatMap((row, rowIndex) =>
          row.flatMap((value, columnIndex) => {
            const x = originX + columnIndex * step;
            const y = originY + (3 - rowIndex) * step;
            return [
              rect(x, y, size, size, fills[rowIndex]![columnIndex]!, "gray"),
              label(x + size / 2, y + size / 2, value, 11, "black"),
            ];
          }),
        ),
        ...labels.flatMap((value, index) => [
          label(
            originX + index * step + size / 2,
            originY + 4 * step + 0.2,
            value,
            9,
            "gray",
          ),
          label(
            originX - 0.35,
            originY + (3 - index) * step + size / 2,
            value,
            9,
            "gray",
          ),
        ]),
        label(8.1, 1.45, "blue = positive, red = negative", 9, "gray"),
      ];
    },
  },
];
