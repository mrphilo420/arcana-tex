import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

interface SpringerCreator {
  creator?: string;
}

interface SpringerUrl {
  format?: string;
  platform?: string;
  value?: string;
}

interface SpringerRecord {
  contentType?: string;
  publicationType?: string;
  publicationName?: string;
  publicationDate?: string;
  onlineDate?: string;
  title?: string;
  creators?: SpringerCreator[];
  abstract?: string | { h1?: string; p?: string | string[] };
  doi?: string;
  url?: SpringerUrl[];
  openaccess?: string;
  openAccess?: string;
  publisher?: string;
  publisherName?: string;
  journalVolume?: string;
  journalNumber?: string;
  startingPage?: string;
  endingPage?: string;
}

type SpringerSource = "meta" | "openaccess";

function buildQuery(raw: string): string {
  const query = raw.trim();

  if (
    /^(doi|keyword|title|issn|isbn|journal|year|author|affiliation):/i.test(
      query,
    )
  ) {
    return query;
  }

  if (/^10\.\d{4,9}\//.test(query)) {
    return `doi:${query}`;
  }

  return `keyword:("${query.replace(/"/g, "")}")`;
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

function authorLastName(author: string): string {
  if (author.includes(",")) return author.split(",")[0].trim();
  const parts = author.split(/\s+/);
  return parts[parts.length - 1] ?? author;
}

function makeCiteKey(
  authors: string[],
  year: string,
  title: string,
  fallback: string,
): string {
  const lastName = authors[0] ? authorLastName(authors[0]) : "springer";
  const word = title
    .split(/\s+/)
    .map((part) => part.replace(/[^a-zA-Z0-9]/g, ""))
    .find((part) => part.length > 3);

  const key = `${lastName}${year}${word ?? ""}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  return key || `springer${fallback.replace(/\W/g, "")}`;
}

function makeBibtex(
  record: SpringerRecord,
  citeKey: string,
  authors: string[],
  year: string,
  venue: string,
  url: string | undefined,
  pages: string | undefined,
): string {
  const contentType = record.contentType ?? "";
  const entryType = /article/i.test(contentType)
    ? "article"
    : /chapter/i.test(contentType)
      ? "incollection"
      : /conference|proceedings/i.test(contentType)
        ? "inproceedings"
        : "misc";

  const fields: (string | null)[] = [
    `  title = {${escapeBibtex(record.title ?? "")}}`,
    `  author = {${authors.map(escapeBibtex).join(" and ")}}`,
    year ? `  year = {${year}}` : null,
    entryType === "article" && venue
      ? `  journal = {${escapeBibtex(venue)}}`
      : (entryType === "incollection" || entryType === "inproceedings") && venue
        ? `  booktitle = {${escapeBibtex(venue)}}`
        : null,
    record.publisherName || record.publisher
      ? `  publisher = {${escapeBibtex(record.publisherName || record.publisher || "")}}`
      : null,
    record.journalVolume
      ? `  volume = {${escapeBibtex(record.journalVolume)}}`
      : null,
    record.journalNumber
      ? `  number = {${escapeBibtex(record.journalNumber)}}`
      : null,
    pages ? `  pages = {${escapeBibtex(pages)}}` : null,
    record.doi ? `  doi = {${escapeBibtex(record.doi)}}` : null,
    url ? `  url = {${url}}` : null,
  ];

  return `@${entryType}{${citeKey},\n${fields.filter(Boolean).join(",\n")}\n}`;
}

function normalizeAbstract(
  value: SpringerRecord["abstract"],
): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (!value || typeof value !== "object") return undefined;

  const paragraph = value.p;
  if (typeof paragraph === "string") return paragraph.trim() || undefined;
  if (Array.isArray(paragraph)) {
    const text = paragraph
      .filter((part): part is string => typeof part === "string")
      .join(" ")
      .trim();
    return text || undefined;
  }

  return undefined;
}

function mapRecord(record: SpringerRecord, source: SpringerSource) {
  const title = record.title?.trim();
  if (!title) return null;

  const authors = (record.creators ?? [])
    .map((creator) => creator.creator?.trim())
    .filter((name): name is string => Boolean(name));
  const year = (record.publicationDate ?? record.onlineDate ?? "").slice(0, 4);
  const venue =
    record.publicationName ||
    record.publisherName ||
    record.publicationType ||
    record.contentType ||
    "Springer";
  const doi = record.doi?.trim();
  const url = doi
    ? `https://doi.org/${doi}`
    : record.url?.find((entry) => entry.value)?.value;
  const pages =
    record.startingPage && record.endingPage
      ? `${record.startingPage}--${record.endingPage}`
      : record.startingPage || record.endingPage || undefined;
  const citeKey = makeCiteKey(
    authors,
    year,
    title,
    doi ?? record.publicationDate ?? title,
  );
  const openAccess =
    source === "openaccess" ||
    record.openAccess === "true" ||
    record.openaccess === "true";

  return {
    id: doi || url || citeKey,
    source: "springer" as const,
    citeKey,
    title,
    authors,
    year: year || undefined,
    venue,
    doi: doi || undefined,
    url,
    abstract: normalizeAbstract(record.abstract),
    openAccess,
    contentType: record.contentType,
    bibtex: makeBibtex(record, citeKey, authors, year, venue, url, pages),
  };
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const query = searchParams.get("q")?.trim();
  const source: SpringerSource =
    searchParams.get("source") === "openaccess" ? "openaccess" : "meta";

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  if (query.length > 300) {
    return NextResponse.json({ error: "Query is too long" }, { status: 400 });
  }

  const apiKey =
    source === "openaccess"
      ? process.env.SPRINGER_OPENACCESS_API_KEY
      : process.env.SPRINGER_META_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: `Springer ${source === "openaccess" ? "Open Access" : "Meta"} API key is not configured`,
      },
      { status: 500 },
    );
  }

  const endpoint =
    source === "openaccess"
      ? "https://api.springernature.com/openaccess/json"
      : "https://api.springernature.com/meta/v2/json";
  const url = `${endpoint}?${new URLSearchParams({
    q: buildQuery(query),
    p: "20",
    s: "1",
    api_key: apiKey,
  }).toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "arcanaTeX/0.0.1 (local LaTeX workspace)",
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            response.status === 401 || response.status === 403
              ? "Springer rejected the API key"
              : response.status === 429
                ? "Springer rate limit reached. Try again in a moment."
                : `Springer returned ${response.status}`,
        },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      records?: SpringerRecord[];
      result?: { total?: string }[];
    };
    const results = (data.records ?? [])
      .map((record) => mapRecord(record, source))
      .filter(
        (record): record is NonNullable<typeof record> => record !== null,
      );

    return NextResponse.json({
      results,
      total: Number(data.result?.[0]?.total ?? results.length),
      source,
    });
  } catch (error) {
    console.error("Springer search failed", error);
    return NextResponse.json(
      { error: "Could not reach Springer Nature. Check your connection." },
      { status: 502 },
    );
  }
}
