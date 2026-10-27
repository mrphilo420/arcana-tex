export type TikzTool =
  | "select"
  | "rectangle"
  | "ellipse"
  | "line"
  | "arrow"
  | "text";

export type TikzShapeKind = "rectangle" | "ellipse" | "line" | "text";
export type TikzLineWidth = "thin" | "thick" | "very thick";
export type TikzDash = "solid" | "dashed" | "dotted";
export type TikzArrow =
  | "none"
  | "->"
  | "<-"
  | "<->"
  | "Latex"
  | "Stealth"
  | "Triangle"
  | "Circle"
  | "Bar";

export interface TikzShape {
  id: string;
  kind: TikzShapeKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label?: string;
  stroke: string;
  fill: string;
  lineWidth: TikzLineWidth;
  dash: TikzDash;
  arrow: TikzArrow;
  rounded: boolean;
  fontScale: "small" | "normalsize" | "large";
  rotation?: number;
  fontSize?: number;
  groupId?: string;
}

export interface TikzFigureOptions {
  width: number;
  height: number;
  scale: number;
  wrapFigure: boolean;
  caption: string;
  label: string;
  libraries: string[];
}

export const TIKZ_LIBRARIES = [
  "arrows.meta",
  "positioning",
  "calc",
  "shapes.geometric",
  "fit",
  "backgrounds",
  "decorations.pathreplacing",
  "patterns",
  "matrix",
  "graphs",
  "mindmap",
  "calendar",
  "plotmarks",
] as const;

export interface TikzFigureDocument {
  version: 1;
  id: string;
  shapes: TikzShape[];
  options: TikzFigureOptions;
}

export interface TikzBlock {
  start: number;
  end: number;
  document: TikzFigureDocument;
}

export const TIKZ_COLORS = [
  { name: "black", value: "#141413" },
  { name: "blue", value: "#2563eb" },
  { name: "red", value: "#c64545" },
  { name: "green", value: "#1f8a5b" },
  { name: "orange", value: "#d97b3f" },
  { name: "gray", value: "#8e8b82" },
  { name: "teal", value: "#2a8f83" },
  { name: "magenta", value: "#a54a86" },
  { name: "brown", value: "#8a5a3c" },
] as const;

export const TIKZ_FILLS = [
  { name: "none", value: "transparent" },
  { name: "lightgray", value: "#e9e5dd" },
  { name: "gray", value: "#c7c2b8" },
  { name: "blue!10", value: "#e7efff" },
  { name: "red!10", value: "#fbeaea" },
  { name: "green!10", value: "#e7f4ed" },
  { name: "orange!10", value: "#fbeee3" },
  { name: "yellow!20", value: "#faf1cf" },
] as const;

export const TIKZ_LINE_WIDTHS: TikzLineWidth[] = [
  "thin",
  "thick",
  "very thick",
];

export const TIKZ_DASHES: TikzDash[] = ["solid", "dashed", "dotted"];

export const TIKZ_ARROWS: { name: TikzArrow; label: string }[] = [
  { name: "none", label: "No arrow" },
  { name: "->", label: "Forward" },
  { name: "<-", label: "Backward" },
  { name: "<->", label: "Both ways" },
  { name: "Latex", label: "LaTeX tip" },
  { name: "Stealth", label: "Stealth" },
  { name: "Triangle", label: "Triangle" },
  { name: "Circle", label: "Circle" },
  { name: "Bar", label: "Bar" },
];

const MARKER_RE = /^% openprism-tikz: ([A-Za-z0-9+/=]+)\s*$/gm;

function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): string {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

const SHAPE_KIND_CODE: Record<TikzShapeKind, string> = {
  rectangle: "r",
  ellipse: "e",
  line: "l",
  text: "t",
};

const SHAPE_KIND_FROM_CODE: Record<string, TikzShapeKind> = {
  r: "rectangle",
  e: "ellipse",
  l: "line",
  t: "text",
};

const WIDTH_CODES: Record<TikzLineWidth, number> = {
  thin: 0,
  thick: 1,
  "very thick": 2,
};

const WIDTH_FROM_CODE: TikzLineWidth[] = ["thin", "thick", "very thick"];
const DASH_CODES: Record<TikzDash, number> = {
  solid: 0,
  dashed: 1,
  dotted: 2,
};
const DASH_FROM_CODE: TikzDash[] = ["solid", "dashed", "dotted"];
const ARROW_CODES: Record<TikzArrow, number> = {
  none: 0,
  "->": 1,
  "<-": 2,
  "<->": 3,
  Latex: 4,
  Stealth: 5,
  Triangle: 6,
  Circle: 7,
  Bar: 8,
};
const ARROW_FROM_CODE: TikzArrow[] = [
  "none",
  "->",
  "<-",
  "<->",
  "Latex",
  "Stealth",
  "Triangle",
  "Circle",
  "Bar",
];
const FONT_CODES: Record<TikzShape["fontScale"], number> = {
  small: 0,
  normalsize: 1,
  large: 2,
};
const FONT_FROM_CODE: TikzShape["fontScale"][] = [
  "small",
  "normalsize",
  "large",
];

function encodeCompactMetadata(document: TikzFigureDocument): string {
  const shapes = document.shapes.map((shape) => [
    SHAPE_KIND_CODE[shape.kind],
    shape.x1,
    shape.y1,
    shape.x2,
    shape.y2,
    shape.label ?? "",
    shape.stroke,
    shape.fill,
    WIDTH_CODES[shape.lineWidth],
    DASH_CODES[shape.dash],
    ARROW_CODES[shape.arrow],
    shape.rounded ? 1 : 0,
    FONT_CODES[shape.fontScale],
    shape.rotation ?? 0,
    shape.fontSize ?? 0,
    shape.groupId ?? "",
  ]);

  return JSON.stringify({
    v: 1,
    id: document.id,
    s: shapes,
    o: [
      document.options.scale,
      document.options.wrapFigure ? 1 : 0,
      document.options.caption,
      document.options.label,
      document.options.libraries.join(","),
    ],
  });
}

function decodeCompactMetadata(
  parsed: Record<string, unknown>,
): TikzFigureDocument | null {
  if (
    parsed.v !== 1 ||
    typeof parsed.id !== "string" ||
    !Array.isArray(parsed.s)
  ) {
    return null;
  }

  const options = Array.isArray(parsed.o) ? parsed.o : [];
  const shapes: TikzShape[] = [];

  for (const raw of parsed.s) {
    if (!Array.isArray(raw) || raw.length < 13) continue;
    const kind = SHAPE_KIND_FROM_CODE[String(raw[0])];
    if (!kind) continue;

    shapes.push({
      id: crypto.randomUUID(),
      kind,
      x1: Number(raw[1]) || 0,
      y1: Number(raw[2]) || 0,
      x2: Number(raw[3]) || 0,
      y2: Number(raw[4]) || 0,
      label: typeof raw[5] === "string" ? raw[5] : "",
      stroke: typeof raw[6] === "string" ? raw[6] : "black",
      fill: typeof raw[7] === "string" ? raw[7] : "none",
      lineWidth: WIDTH_FROM_CODE[Number(raw[8])] ?? "thin",
      dash: DASH_FROM_CODE[Number(raw[9])] ?? "solid",
      arrow: ARROW_FROM_CODE[Number(raw[10])] ?? "none",
      rounded: Boolean(raw[11]),
      fontScale: FONT_FROM_CODE[Number(raw[12])] ?? "normalsize",
      rotation: Number(raw[13]) || 0,
      fontSize: Number(raw[14]) > 0 ? Number(raw[14]) : undefined,
      groupId:
        typeof raw[15] === "string" && raw[15] ? String(raw[15]) : undefined,
    });
  }

  return {
    version: 1,
    id: parsed.id,
    shapes,
    options: {
      width: 16,
      height: 10,
      scale: Number(options[0]) || 1,
      wrapFigure: Boolean(options[1]),
      caption: typeof options[2] === "string" ? options[2] : "",
      label: typeof options[3] === "string" ? options[3] : "",
      libraries:
        typeof options[4] === "string" && options[4]
          ? options[4]
              .split(",")
              .map((library) => library.trim())
              .filter(Boolean)
          : ["arrows.meta"],
    },
  };
}

export function encodeTikzMetadata(document: TikzFigureDocument): string {
  return `% openprism-tikz: ${toBase64(encodeCompactMetadata(document))}`;
}

export function decodeTikzMetadata(line: string): TikzFigureDocument | null {
  const match = line.match(/^% openprism-tikz: ([A-Za-z0-9+/=]+)\s*$/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(fromBase64(match[1])) as Record<string, unknown>;

    if (parsed.v === 1) {
      return decodeCompactMetadata(parsed);
    }

    // Backwards compatibility with the first embedded JSON format.
    const legacy = parsed as unknown as TikzFigureDocument;
    if (legacy.version !== 1 || !Array.isArray(legacy.shapes)) return null;
    if (!legacy.options) return null;
    return legacy;
  } catch {
    return null;
  }
}

export function createTikzFigure(): TikzFigureDocument {
  return {
    version: 1,
    id: crypto.randomUUID(),
    shapes: [],
    options: {
      width: 16,
      height: 10,
      scale: 1,
      wrapFigure: true,
      caption: "",
      label: "",
      libraries: ["arrows.meta"],
    },
  };
}

export function createTikzShape(
  kind: TikzShapeKind,
  x1: number,
  y1: number,
  x2 = x1,
  y2 = y1,
  defaults: Partial<TikzShape> = {},
): TikzShape {
  return {
    id: crypto.randomUUID(),
    kind,
    x1,
    y1,
    x2,
    y2,
    label: kind === "text" ? "Text" : "",
    stroke: "black",
    fill: "none",
    lineWidth: "thin",
    dash: "solid",
    arrow: kind === "line" ? "none" : "none",
    rounded: false,
    fontScale: "normalsize",
    rotation: 0,
    fontSize: kind === "text" ? 12 : undefined,
    ...defaults,
  };
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

function escapeLabel(value: string): string {
  return value.replace(/%/g, "\\%").replace(/&/g, "\\&").replace(/#/g, "\\#");
}

function shapeCenter(shape: TikzShape): { x: number; y: number } {
  if (shape.kind === "text") return { x: shape.x1, y: shape.y1 };
  return {
    x: (shape.x1 + shape.x2) / 2,
    y: (shape.y1 + shape.y2) / 2,
  };
}

function arrowOption(arrow: TikzArrow): string | null {
  if (arrow === "none") return null;
  if (arrow === "->" || arrow === "<-" || arrow === "<->") return arrow;

  return `-{${arrow}[length=2mm]}`;
}

function shapeStyle(shape: TikzShape): string {
  const options: string[] = [`draw=${shape.stroke}`];

  if (shape.fill !== "none") options.push(`fill=${shape.fill}`);
  if (shape.lineWidth !== "thin") options.push(shape.lineWidth);
  if (shape.dash !== "solid") options.push(shape.dash);
  const arrow = arrowOption(shape.arrow);
  if (arrow) options.push(arrow);
  if (shape.rounded && shape.kind === "rectangle") {
    options.push("rounded corners=4pt");
  }
  if (shape.rotation) {
    const center = shapeCenter(shape);
    options.push(
      `rotate around={${formatNumber(shape.rotation)}:(${formatNumber(center.x)},${formatNumber(center.y)})}`,
    );
  }

  return options.join(", ");
}

function shapeLines(shape: TikzShape): string[] {
  const lines: string[] = [];
  const label = shape.label?.trim();

  if (shape.kind === "rectangle") {
    const x1 = Math.min(shape.x1, shape.x2);
    const y1 = Math.min(shape.y1, shape.y2);
    const x2 = Math.max(shape.x1, shape.x2);
    const y2 = Math.max(shape.y1, shape.y2);

    lines.push(
      `  \\draw[${shapeStyle(shape)}] (${formatNumber(x1)},${formatNumber(y1)}) rectangle (${formatNumber(x2)},${formatNumber(y2)});`,
    );

    if (label) {
      const rotation = shape.rotation
        ? `[rotate=${formatNumber(shape.rotation)}]`
        : "";
      lines.push(
        `  \\node${rotation} at (${formatNumber((x1 + x2) / 2)},${formatNumber((y1 + y2) / 2)}) {${escapeLabel(label)}};`,
      );
    }
  } else if (shape.kind === "ellipse") {
    const cx = (shape.x1 + shape.x2) / 2;
    const cy = (shape.y1 + shape.y2) / 2;
    const rx = Math.abs(shape.x2 - shape.x1) / 2;
    const ry = Math.abs(shape.y2 - shape.y1) / 2;

    lines.push(
      `  \\draw[${shapeStyle(shape)}] (${formatNumber(cx)},${formatNumber(cy)}) ellipse [x radius=${formatNumber(rx)}, y radius=${formatNumber(ry)}];`,
    );

    if (label) {
      const rotation = shape.rotation
        ? `[rotate=${formatNumber(shape.rotation)}]`
        : "";
      lines.push(
        `  \\node${rotation} at (${formatNumber(cx)},${formatNumber(cy)}) {${escapeLabel(label)}};`,
      );
    }
  } else if (shape.kind === "line") {
    const rotation = shape.rotation
      ? `, rotate=${formatNumber(shape.rotation)}`
      : "";
    const node = label
      ? ` node[midway, above, text=${shape.stroke}${rotation}] {${escapeLabel(label)}}`
      : "";

    lines.push(
      `  \\draw[${shapeStyle(shape)}] (${formatNumber(shape.x1)},${formatNumber(shape.y1)}) --${node} (${formatNumber(shape.x2)},${formatNumber(shape.y2)});`,
    );
  } else if (label) {
    const font = shape.fontSize
      ? `\\fontsize{${formatNumber(shape.fontSize)}}{${formatNumber(shape.fontSize * 1.2)}}\\selectfont`
      : shape.fontScale === "small"
        ? "\\small"
        : shape.fontScale === "large"
          ? "\\large"
          : "\\normalsize";
    const rotation = shape.rotation
      ? `, rotate=${formatNumber(shape.rotation)}`
      : "";

    lines.push(
      `  \\node[text=${shape.stroke}, font=${font}${rotation}] at (${formatNumber(shape.x1)},${formatNumber(shape.y1)}) {${escapeLabel(label)}};`,
    );
  }

  return lines;
}

export function generateTikzPictureCode(document: TikzFigureDocument): string {
  const { options, shapes } = document;
  const pictureOptions =
    options.scale === 1
      ? "x=1cm, y=1cm"
      : `scale=${formatNumber(options.scale)}`;

  return [
    `\\begin{tikzpicture}[${pictureOptions}]`,
    ...shapes.flatMap(shapeLines),
    "\\end{tikzpicture}",
  ].join("\n");
}

export function generateTikzPreviewDocument(
  document: TikzFigureDocument,
): string {
  const librarySet = new Set(document.options.libraries);
  if (
    document.shapes.some((shape) =>
      ["Latex", "Stealth", "Triangle", "Circle", "Bar"].includes(shape.arrow),
    )
  ) {
    librarySet.add("arrows.meta");
  }
  const libraries = [...librarySet].join(",");

  return [
    "\\documentclass[border=12pt]{standalone}",
    "\\usepackage{tikz}",
    "\\usepackage{amsmath}",
    ...(libraries ? [`\\usetikzlibrary{${libraries}}`] : []),
    "\\begin{document}",
    generateTikzPictureCode(document),
    "\\end{document}",
    "",
  ].join("\n");
}

export function generateTikzCode(document: TikzFigureDocument): string {
  const { options, shapes } = document;
  const scale =
    options.scale === 1 ? "" : `, scale=${formatNumber(options.scale)}`;
  const picture = [
    `\\begin{tikzpicture}[${scale ? scale.slice(2) : "x=1cm, y=1cm"}]`,
    ...shapes.flatMap(shapeLines),
    "\\end{tikzpicture}",
  ];

  const body = options.wrapFigure
    ? [
        "\\begin{figure}[htbp]",
        "  \\centering",
        ...picture.map((line) => `  ${line}`),
        ...(options.caption.trim()
          ? [`  \\caption{${escapeLabel(options.caption.trim())}}`]
          : []),
        ...(options.label.trim()
          ? [
              `  \\label{${options.label.trim().replace(/[^a-zA-Z0-9:._-]/g, "")}}`,
            ]
          : []),
        "\\end{figure}",
      ]
    : picture;

  return `${body.join("\n")}\n${encodeTikzMetadata(document)}\n`;
}

function blockForMarker(
  content: string,
  markerStart: number,
  markerEnd: number,
): { start: number; end: number } | null {
  const after = content.slice(markerEnd);
  const nextFigure = after.indexOf("\\begin{figure}");
  const nextPicture = after.indexOf("\\begin{tikzpicture}");

  let nextStart = -1;
  let endToken = "";
  if (nextFigure !== -1 && (nextPicture === -1 || nextFigure < nextPicture)) {
    nextStart = nextFigure;
    endToken = "\\end{figure}";
  } else if (nextPicture !== -1) {
    nextStart = nextPicture;
    endToken = "\\end{tikzpicture}";
  }

  // Legacy format: the marker was placed immediately before the block.
  if (nextStart !== -1 && nextStart < 200) {
    const start = markerEnd + nextStart;
    const endIndex = content.indexOf(endToken, start);
    if (endIndex !== -1) {
      return { start: markerStart, end: endIndex + endToken.length };
    }
  }

  const before = content.slice(0, markerStart);
  const figureStart = before.lastIndexOf("\\begin{figure}");
  const pictureStart = before.lastIndexOf("\\begin{tikzpicture}");

  const candidates: { start: number; end: number }[] = [];

  if (figureStart !== -1) {
    const end = content.indexOf("\\end{figure}", figureStart);
    if (end !== -1 && end <= markerStart) {
      candidates.push({
        start: figureStart,
        end: end + "\\end{figure}".length,
      });
    }
  }

  if (pictureStart !== -1) {
    const end = content.indexOf("\\end{tikzpicture}", pictureStart);
    if (end !== -1 && end <= markerStart) {
      candidates.push({
        start: pictureStart,
        end: end + "\\end{tikzpicture}".length,
      });
    }
  }

  if (candidates.length === 0) return null;

  // The block nearest to the marker is the one that ends last before it.
  // This keeps a figure wrapper when present, and falls back to a bare
  // tikzpicture when the figure option was disabled.
  const nearest = candidates.sort((a, b) => b.end - a.end)[0];
  if (!nearest || nearest.end > markerStart) return null;

  return { start: nearest.start, end: markerEnd };
}

function collectTikzBlocks(content: string): TikzBlock[] {
  const regex = new RegExp(MARKER_RE.source, "gm");
  const blocks: TikzBlock[] = [];
  let match: RegExpExecArray | null = regex.exec(content);

  while (match) {
    const document = decodeTikzMetadata(match[0]);
    if (document) {
      const markerEnd = match.index + match[0].length;
      const range = blockForMarker(content, match.index, markerEnd);
      if (range) {
        blocks.push({ ...range, document });
      }
    }

    match = regex.exec(content);
  }

  return blocks;
}

export function findTikzBlock(
  content: string,
  position: number,
): TikzBlock | null {
  return (
    collectTikzBlocks(content).find(
      (block) => position >= block.start && position <= block.end,
    ) ?? null
  );
}

export function findTikzBlockById(
  content: string,
  id: string,
): TikzBlock | null {
  return (
    collectTikzBlocks(content).find((block) => block.document.id === id) ?? null
  );
}

export function ensureTikzLibraries(
  content: string,
  libraries: string[],
): { content: string; changed: boolean } {
  const loaded = new Set<string>();
  for (const match of content.matchAll(/\\usetikzlibrary\{([^}]*)\}/g)) {
    for (const library of (match[1] ?? "").split(",")) {
      if (library.trim()) loaded.add(library.trim());
    }
  }

  const missing = [...new Set(libraries)].filter(
    (library) => library && !loaded.has(library),
  );
  if (missing.length === 0) return { content, changed: false };

  const line = `\\usetikzlibrary{${missing.join(",")}}\n`;
  const beginDocument = content.indexOf("\\begin{document}");
  if (beginDocument === -1) {
    return { content: `${line}${content}`, changed: true };
  }

  return {
    content:
      content.slice(0, beginDocument) + line + content.slice(beginDocument),
    changed: true,
  };
}

export function ensureTikzPackage(content: string): {
  content: string;
  changed: boolean;
} {
  if (/\\usepackage(?:\[[^\]]*\])?\{tikz\}/.test(content)) {
    return { content, changed: false };
  }

  const beginDocument = content.indexOf("\\begin{document}");
  const line = "\\usepackage{tikz}\n";

  if (beginDocument === -1) {
    return { content: `${line}${content}`, changed: true };
  }

  return {
    content:
      content.slice(0, beginDocument) + line + content.slice(beginDocument),
    changed: true,
  };
}
