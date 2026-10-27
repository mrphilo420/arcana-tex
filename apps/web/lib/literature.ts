export interface LiteratureResult {
  id: string;
  source: "arxiv" | "zotero" | "springer";
  citeKey: string;
  title: string;
  authors: string[];
  year?: string;
  venue?: string;
  doi?: string;
  url?: string;
  abstract?: string;
  bibtex?: string;
  zoteroKey?: string;
  openAccess?: boolean;
  contentType?: string;
}

export type SpringerSource = "meta" | "openaccess";

export interface ZoteroSettings {
  mode: "local" | "web";
  library: "users" | "groups";
  libraryId: string;
  apiKey: string;
}

export const DEFAULT_ZOTERO_SETTINGS: ZoteroSettings = {
  mode: "local",
  library: "users",
  libraryId: "0",
  apiKey: "",
};

export async function searchArxiv(query: string): Promise<LiteratureResult[]> {
  const response = await fetch(
    `/api/literature/arxiv?q=${encodeURIComponent(query)}`,
  );
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "arXiv search failed");
  }

  return data.results as LiteratureResult[];
}

export async function searchSpringer(
  query: string,
  source: SpringerSource,
): Promise<LiteratureResult[]> {
  const response = await fetch(
    `/api/literature/springer?q=${encodeURIComponent(query)}&source=${source}`,
  );
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Springer search failed");
  }

  return data.results as LiteratureResult[];
}

export async function searchZotero(
  query: string,
  settings: ZoteroSettings,
): Promise<LiteratureResult[]> {
  const response = await fetch("/api/literature/zotero", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...settings, query }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Zotero search failed");
  }

  return data.results as LiteratureResult[];
}

export async function getZoteroBibtex(
  key: string,
  settings: ZoteroSettings,
): Promise<string> {
  const response = await fetch("/api/literature/zotero", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...settings, key }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Could not fetch Zotero BibTeX");
  }

  return data.bibtex as string;
}

export function parseBibtexKey(bibtex: string): string | null {
  const match = bibtex.match(/@\w+\s*\{\s*([^,\s]+)\s*,/);
  return match?.[1] ?? null;
}
