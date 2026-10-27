import type { ProjectFile } from "@/lib/project-files";

export interface RagChunk {
  path: string;
  startLine: number;
  endLine: number;
  content: string;
  score: number;
}

export interface RagOptions {
  limit?: number;
  maxChars?: number;
  activeFileId?: string | null;
  paths?: string[];
}

const CHUNK_LINES = 90;
const CHUNK_OVERLAP = 14;

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/\\[a-z]+|[a-z_][\w'.-]*|\d+/g) ?? []).map(
    (token) => token.replace(/^\\/, ""),
  );
}

function splitIntoChunks(file: ProjectFile): RagChunk[] {
  if (file.type !== "tex" || !file.content) return [];
  const lines = file.content.split("\n");
  if (lines.length === 0) return [];

  const chunks: RagChunk[] = [];
  const step = Math.max(1, CHUNK_LINES - CHUNK_OVERLAP);

  for (let start = 0; start < lines.length; start += step) {
    const end = Math.min(lines.length, start + CHUNK_LINES);
    const content = lines.slice(start, end).join("\n");
    if (!content.trim()) continue;
    chunks.push({
      path: file.path,
      startLine: start + 1,
      endLine: end,
      content,
      score: 0,
    });
    if (end >= lines.length) break;
  }

  return chunks;
}

/**
 * Small local BM25 index. This is deliberately lexical rather than an
 * embedding service: proof names, theorem names, commands, and identifiers
 * are exact tokens, and everything stays local to the browser.
 */
export function retrieveProjectContext(
  files: ProjectFile[],
  query: string,
  options: RagOptions = {},
): RagChunk[] {
  const limit = Math.min(20, Math.max(1, options.limit ?? 8));
  const maxChars = Math.max(1_000, options.maxChars ?? 16_000);
  const activeFileId = options.activeFileId ?? null;
  const allowedPaths = options.paths
    ? new Set(options.paths.map((path) => path.replace(/\\/g, "/")))
    : null;

  const eligible = files.filter((file) => {
    const path = file.path.replace(/\\/g, "/");
    return (
      file.type === "tex" &&
      Boolean(file.content) &&
      (!allowedPaths || allowedPaths.has(path))
    );
  });
  const chunks = eligible.flatMap(splitIntoChunks);
  if (chunks.length === 0) return [];

  const queryTerms = [...new Set(tokenize(query))];
  if (queryTerms.length === 0) return [];

  const chunkTerms = chunks.map((chunk) => tokenize(chunk.content));
  const documentFrequency = new Map<string, number>();
  for (const terms of chunkTerms) {
    for (const term of new Set(terms)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const averageLength =
    chunkTerms.reduce((total, terms) => total + terms.length, 0) /
    Math.max(1, chunkTerms.length);
  const k1 = 1.35;
  const b = 0.72;

  chunks.forEach((chunk, index) => {
    const terms = chunkTerms[index];
    const frequencies = new Map<string, number>();
    for (const term of terms) {
      frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
    }

    let score = 0;
    for (const term of queryTerms) {
      const frequency = frequencies.get(term) ?? 0;
      if (frequency === 0) continue;
      const df = documentFrequency.get(term) ?? 0;
      const idf = Math.log(1 + (chunks.length - df + 0.5) / (df + 0.5));
      score +=
        idf *
        ((frequency * (k1 + 1)) /
          (frequency + k1 * (1 - b + b * (terms.length / averageLength))));
    }

    if (score > 0) {
      const file = eligible.find((candidate) => candidate.id === activeFileId);
      if (file && file.path === chunk.path) score *= 1.15;
    }
    chunk.score = score;
  });

  const ranked = chunks
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score);

  const results: RagChunk[] = [];
  let used = 0;
  for (const chunk of ranked) {
    if (results.length >= limit) break;
    const remaining = maxChars - used;
    if (remaining <= 0) break;
    const content =
      chunk.content.length > remaining
        ? chunk.content.slice(0, remaining)
        : chunk.content;
    results.push({ ...chunk, content });
    used += content.length;
  }

  return results;
}
