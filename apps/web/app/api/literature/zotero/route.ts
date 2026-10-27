import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

interface ZoteroRequest {
  query?: string;
  key?: string;
  mode?: "local" | "web";
  library?: "users" | "groups";
  libraryId?: string;
  apiKey?: string;
}

interface ZoteroCreator {
  firstName?: string;
  lastName?: string;
  name?: string;
}

interface ZoteroItem {
  key: string;
  data: {
    key?: string;
    title?: string;
    itemType?: string;
    date?: string;
    creators?: ZoteroCreator[];
    publicationTitle?: string;
    bookTitle?: string;
    proceedingsTitle?: string;
    publisher?: string;
    repository?: string;
    DOI?: string;
    url?: string;
    abstractNote?: string;
  };
}

function makeCiteKey(
  authors: string[],
  year: string | undefined,
  title: string,
  fallback: string,
): string {
  const lastName = authors[0]?.split(/\s+/).pop() ?? "ref";
  const word = title
    .split(/\s+/)
    .map((part) => part.replace(/[^a-zA-Z0-9]/g, ""))
    .find((part) => part.length > 3);

  const key = `${lastName}${year ?? ""}${word ?? ""}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  return key || `zotero${fallback.replace(/\W/g, "")}`;
}

function authorName(creator: ZoteroCreator): string {
  if (creator.name) return creator.name;
  return [creator.firstName, creator.lastName].filter(Boolean).join(" ");
}

function mapItem(item: ZoteroItem) {
  const data = item.data;
  const title = data.title?.trim();
  if (!title) return null;

  const authors = (data.creators ?? [])
    .map(authorName)
    .filter((name) => name.length > 0);
  const year = data.date?.match(/\d{4}/)?.[0];
  const venue =
    data.publicationTitle ||
    data.bookTitle ||
    data.proceedingsTitle ||
    data.publisher ||
    data.repository ||
    data.itemType;

  return {
    id: data.key || item.key,
    source: "zotero" as const,
    citeKey: makeCiteKey(authors, year, title, data.key || item.key),
    title,
    authors,
    year,
    venue,
    doi: data.DOI || undefined,
    url: data.url || undefined,
    abstract: data.abstractNote || undefined,
    zoteroKey: data.key || item.key,
  };
}

async function resolveUserLibraryId(
  base: string,
  headers: Record<string, string>,
): Promise<string | null> {
  try {
    const response = await fetch(`${base}/keys/current`, { headers });
    if (!response.ok) return null;
    const data = (await response.json()) as { userID?: number };
    return data.userID ? String(data.userID) : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const serverKey = process.env.ZOTERO_API_KEY?.trim();
  return NextResponse.json({
    configured: Boolean(serverKey),
    mode: serverKey ? "web" : "local",
    library: process.env.ZOTERO_LIBRARY_TYPE === "groups" ? "groups" : "users",
    libraryId: process.env.ZOTERO_LIBRARY_ID?.trim() || "0",
  });
}

export async function POST(request: Request) {
  let body: ZoteroRequest;

  try {
    body = (await request.json()) as ZoteroRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mode = body.mode === "web" ? "web" : "local";
  const library = body.library === "groups" ? "groups" : "users";
  const serverKey = process.env.ZOTERO_API_KEY?.trim();
  const apiKey = serverKey || body.apiKey?.trim();
  let libraryId = (body.libraryId || (library === "users" ? "0" : "")).replace(
    /[^\d]/g,
    "",
  );

  if (mode === "web" && !apiKey) {
    return NextResponse.json(
      { error: "A Zotero API key is required for the web API" },
      { status: 400 },
    );
  }

  const base =
    mode === "web" ? "https://api.zotero.org" : "http://localhost:23119/api";
  const headers: Record<string, string> = {
    "Zotero-API-Version": "3",
  };

  if (mode === "web" && apiKey) {
    headers["Zotero-API-Key"] = apiKey;
  }

  // Zotero's web API does not accept 0 as a user id. Resolve the authenticated
  // user's id from the key so the default "My library" setting just works.
  if (
    mode === "web" &&
    library === "users" &&
    (!libraryId || libraryId === "0")
  ) {
    const resolved = await resolveUserLibraryId(base, headers);
    if (!resolved) {
      return NextResponse.json(
        { error: "Could not resolve the Zotero user for this API key." },
        { status: 502 },
      );
    }
    libraryId = resolved;
  }

  if (!libraryId) {
    return NextResponse.json(
      { error: "A Zotero library ID is required" },
      { status: 400 },
    );
  }

  const itemPath = `${base}/${library}/${libraryId}/items`;

  try {
    if (body.key) {
      const response = await fetch(
        `${itemPath}/${encodeURIComponent(body.key)}?format=bibtex`,
        { headers },
      );

      if (!response.ok) {
        return NextResponse.json(
          {
            error:
              mode === "local"
                ? "Could not read Zotero's local API. In Zotero, enable Settings → Advanced → Allow other applications on this computer to communicate with Zotero."
                : `Zotero returned ${response.status}`,
          },
          { status: 502 },
        );
      }

      return NextResponse.json({ bibtex: await response.text() });
    }

    const query = body.query?.trim();
    if (!query) {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    const url = `${itemPath}?format=json&limit=25&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            mode === "local"
              ? "Could not reach Zotero's local API. Make sure Zotero is running and its local API is enabled."
              : `Zotero returned ${response.status}`,
        },
        { status: 502 },
      );
    }

    const items = (await response.json()) as ZoteroItem[];
    const results = items
      .map(mapItem)
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Zotero request failed", error);
    return NextResponse.json(
      {
        error:
          mode === "local"
            ? "Could not reach Zotero. Start Zotero and enable its local API, or switch to the Zotero web API."
            : "Could not reach Zotero. Check your network connection and API key.",
      },
      { status: 502 },
    );
  }
}
