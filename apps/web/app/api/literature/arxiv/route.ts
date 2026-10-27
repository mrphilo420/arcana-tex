import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

interface ArxivEntry {
  id: string;
  title: string;
  authors: string[];
  published: string;
  summary: string;
  doi: string;
  primaryClass: string;
  journalRef: string;
  pdfUrl: string;
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    amp: "&",
  };

  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&([a-z]+);/gi, (match, name) => named[name] ?? match);
}

function cleanText(value: string): string {
  return decodeEntities(
    value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function field(xml: string, tag: string): string {
  const match = xml.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"),
  );
  return match ? cleanText(match[1]) : "";
}

function attribute(xml: string, tag: string, name: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*\\b${name}="([^"]*)"`, "i"));
  return match ? decodeEntities(match[1]) : "";
}

function escapeBibtex(value: string): string {
  return value
    .replace(/[{}]/g, "")
    .replace(/\\/g, "")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\s+/g, " ")
    .trim();
}

function makeCiteKey(
  authors: string[],
  year: string,
  title: string,
  fallback: string,
): string {
  const lastName = authors[0]?.split(/\s+/).pop() ?? "ref";
  const word = title
    .split(/\s+/)
    .map((part) => part.replace(/[^a-zA-Z0-9]/g, ""))
    .find((part) => part.length > 3);

  const key = `${lastName}${year}${word ?? ""}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  return key || `arxiv${fallback.replace(/\D/g, "")}`;
}

function toBibtex(entry: ArxivEntry, citeKey: string): string {
  const fields = [
    `  title = {${escapeBibtex(entry.title)}}`,
    `  author = {${entry.authors.map(escapeBibtex).join(" and ")}}`,
    entry.published ? `  year = {${entry.published.slice(0, 4)}}` : null,
    `  eprint = {${entry.id}}`,
    `  archivePrefix = {arXiv}`,
    entry.primaryClass
      ? `  primaryClass = {${escapeBibtex(entry.primaryClass)}}`
      : null,
    entry.doi ? `  doi = {${escapeBibtex(entry.doi)}}` : null,
    entry.journalRef ? `  journal = {${escapeBibtex(entry.journalRef)}}` : null,
    `  url = {https://arxiv.org/abs/${entry.id}}`,
  ].filter(Boolean);

  return `@article{${citeKey},\n${fields.join(",\n")}\n}`;
}

function parseArxiv(xml: string) {
  const entries: ArxivEntry[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match: RegExpExecArray | null = entryRegex.exec(xml);

  while (match) {
    const block = match[1];
    const absUrl = field(block, "id");
    const arxivId = absUrl.split("/abs/").pop()?.replace(/v\d+$/, "") ?? "";
    const authors: string[] = [];
    const authorRegex =
      /<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g;
    let authorMatch: RegExpExecArray | null = authorRegex.exec(block);

    while (authorMatch) {
      const name = cleanText(authorMatch[1]);
      if (name) authors.push(name);
      authorMatch = authorRegex.exec(block);
    }

    entries.push({
      id: arxivId,
      title: field(block, "title"),
      authors,
      published: field(block, "published"),
      summary: field(block, "summary"),
      doi: field(block, "arxiv:doi"),
      primaryClass:
        attribute(block, "arxiv:primary_category", "term") ||
        field(block, "arxiv:primary_category"),
      journalRef: field(block, "arxiv:journal_ref"),
      pdfUrl: attribute(block, "link", "href"),
    });

    match = entryRegex.exec(xml);
  }

  return entries.map((entry) => {
    const year = entry.published.slice(0, 4);
    const citeKey = makeCiteKey(entry.authors, year, entry.title, entry.id);

    return {
      id: entry.id,
      source: "arxiv" as const,
      citeKey,
      title: entry.title,
      authors: entry.authors,
      year,
      venue: "arXiv",
      doi: entry.doi || undefined,
      url: entry.id ? `https://arxiv.org/abs/${entry.id}` : undefined,
      abstract: entry.summary || undefined,
      bibtex: toBibtex(entry, citeKey),
    };
  });
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  if (query.length > 300) {
    return NextResponse.json({ error: "Query is too long" }, { status: 400 });
  }

  const url =
    "https://export.arxiv.org/api/query?" +
    new URLSearchParams({
      search_query: `all:${query}`,
      start: "0",
      max_results: "12",
      sortBy: "relevance",
      sortOrder: "descending",
    }).toString();

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "OpenPrism/0.0.1 (local LaTeX workspace)",
      },
      next: { revalidate: 600 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `arXiv returned ${response.status}` },
        { status: 502 },
      );
    }

    const xml = await response.text();
    return NextResponse.json({ results: parseArxiv(xml) });
  } catch (error) {
    console.error("arXiv search failed", error);
    return NextResponse.json(
      { error: "Could not reach arXiv. Check your network connection." },
      { status: 502 },
    );
  }
}
