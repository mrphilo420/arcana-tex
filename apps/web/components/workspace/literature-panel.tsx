"use client";

import { useEffect, useState } from "react";
import {
  BookOpenIcon,
  BookPlusIcon,
  CheckIcon,
  ChevronDownIcon,
  Loader2Icon,
  QuoteIcon,
  SearchIcon,
  Settings2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DEFAULT_ZOTERO_SETTINGS,
  type LiteratureResult,
  type ZoteroSettings,
  getZoteroBibtex,
  parseBibtexKey,
  searchArxiv,
  searchSpringer,
  searchZotero,
  type SpringerSource,
} from "@/lib/literature";
import { useDocumentStore } from "@/stores/document-store";
import type { ProjectFile } from "@/lib/project-files";

const ZOTERO_STORAGE_KEY = "open-prism-zotero";

function findBibFile(files: ProjectFile[]): ProjectFile | undefined {
  const preferred = [
    "references.bib",
    "refs.bib",
    "bibliography.bib",
    "sources.bib",
  ];
  const bibFiles = files.filter((file) =>
    file.name.toLowerCase().endsWith(".bib"),
  );

  return (
    bibFiles.find((file) => preferred.includes(file.path.toLowerCase())) ??
    bibFiles[0]
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function LiteraturePanel() {
  const isOpen = useDocumentStore((s) => s.isLiteratureOpen);
  const setOpen = useDocumentStore((s) => s.setLiteratureOpen);

  const [tab, setTab] = useState<"arxiv" | "springer" | "zotero">("arxiv");
  const [springerSource, setSpringerSource] = useState<SpringerSource>("meta");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LiteratureResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showZoteroSettings, setShowZoteroSettings] = useState(false);
  const [serverZoteroKey, setServerZoteroKey] = useState(false);
  const [zoteroLoaded, setZoteroLoaded] = useState(false);
  const [zotero, setZotero] = useState<ZoteroSettings>(DEFAULT_ZOTERO_SETTINGS);
  const [added, setAdded] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const raw = localStorage.getItem(ZOTERO_STORAGE_KEY);
    let stored: Partial<ZoteroSettings> | null = null;
    if (raw) {
      try {
        stored = JSON.parse(raw) as Partial<ZoteroSettings>;
      } catch {}
    }

    void fetch("/api/literature/zotero")
      .then((response) => response.json())
      .then((config: { configured?: boolean; libraryId?: string }) => {
        if (cancelled) return;
        setServerZoteroKey(Boolean(config.configured));
        setZotero((current) =>
          stored
            ? { ...DEFAULT_ZOTERO_SETTINGS, ...stored }
            : config.configured
              ? {
                  ...current,
                  mode: "web",
                  library: "users",
                  libraryId: config.libraryId || current.libraryId,
                }
              : current,
        );
        setZoteroLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          if (stored) {
            setZotero({ ...DEFAULT_ZOTERO_SETTINGS, ...stored });
          }
          setZoteroLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!zoteroLoaded) return;
    localStorage.setItem(ZOTERO_STORAGE_KEY, JSON.stringify(zotero));
  }, [zotero, zoteroLoaded]);

  const runSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || isSearching) return;

    setIsSearching(true);
    setError(null);
    setResults([]);

    try {
      const nextResults =
        tab === "arxiv"
          ? await searchArxiv(trimmed)
          : tab === "springer"
            ? await searchSpringer(trimmed, springerSource)
            : await searchZotero(trimmed, zotero);
      setResults(nextResults);
      if (nextResults.length === 0) {
        setError("No results found.");
      }
    } catch (searchError) {
      setError(
        searchError instanceof Error ? searchError.message : "Search failed",
      );
    } finally {
      setIsSearching(false);
    }
  };

  const ensureBibEntry = async (
    result: LiteratureResult,
  ): Promise<{ key: string; path: string }> => {
    let bibtex = result.bibtex;
    let key = result.citeKey;

    if (result.source === "zotero" && result.zoteroKey) {
      bibtex = await getZoteroBibtex(result.zoteroKey, zotero);
      key = parseBibtexKey(bibtex) ?? key;
    }

    if (!bibtex) {
      throw new Error("No BibTeX available for this result");
    }

    const state = useDocumentStore.getState();
    const previousActiveId = state.activeFileId;
    let bibFile = findBibFile(state.files);
    let createdBibFile = false;

    if (!bibFile) {
      state.addFile({
        name: "references.bib",
        path: "references.bib",
        type: "tex",
        content: "",
      });
      bibFile = findBibFile(useDocumentStore.getState().files);
      createdBibFile = true;
    }

    if (!bibFile) {
      throw new Error("Could not create a bibliography file");
    }

    const current = bibFile.content ?? "";
    const hasEntry = new RegExp(
      `@\\w+\\s*\\{\\s*${escapeRegExp(key)}\\s*,`,
    ).test(current);

    if (!hasEntry) {
      const next = current.trim()
        ? `${current.trimEnd()}\n\n${bibtex.trim()}\n`
        : `${bibtex.trim()}\n`;
      useDocumentStore.getState().updateFileContent(bibFile.id, next);
    }

    if (createdBibFile) {
      const currentState = useDocumentStore.getState();
      const mainFile =
        currentState.files.find(
          (file) =>
            file.id === currentState.mainFileId &&
            file.type === "tex" &&
            /\.(tex|ltx)$/i.test(file.name),
        ) ??
        currentState.files.find(
          (file) =>
            file.id === previousActiveId &&
            file.type === "tex" &&
            /\.(tex|ltx)$/i.test(file.name),
        );

      if (mainFile) {
        const mainContent = mainFile.content ?? "";
        const hasBibliography =
          /\\bibliography\s*\{|\\addbibresource\s*\{/.test(mainContent);
        const usesBiblatex = /\\usepackage(?:\[[^\]]*\])?\{biblatex\}/.test(
          mainContent,
        );
        const hasManualBibliography = /\\begin\{thebibliography\}/.test(
          mainContent,
        );

        if (!hasBibliography && !usesBiblatex && !hasManualBibliography) {
          const bibliographyCommand =
            "\\bibliographystyle{plain}\n\\bibliography{references}\n";
          const endDocument = mainContent.indexOf("\\end{document}");
          const nextContent =
            endDocument === -1
              ? `${mainContent.trimEnd()}\n\n${bibliographyCommand}`
              : `${mainContent.slice(0, endDocument)}${bibliographyCommand}${mainContent.slice(endDocument)}`;

          useDocumentStore
            .getState()
            .updateFileContent(mainFile.id, nextContent);
        }
      }
    }

    const currentState = useDocumentStore.getState();
    if (currentState.files.some((file) => file.id === previousActiveId)) {
      currentState.setActiveFile(previousActiveId);
    }

    return { key, path: bibFile.path };
  };

  const handleAdd = async (result: LiteratureResult) => {
    try {
      const entry = await ensureBibEntry(result);
      setAdded((previous) => ({ ...previous, [result.id]: entry.key }));
      useDocumentStore.getState().requestCompile();
      toast.success(`Added ${entry.key}`, {
        description: entry.path,
      });
    } catch (addError) {
      toast.error(
        addError instanceof Error
          ? addError.message
          : "Could not add the reference",
      );
    }
  };

  const handleCite = async (result: LiteratureResult) => {
    const state = useDocumentStore.getState();
    const activeFile = state.files.find(
      (file) => file.id === state.activeFileId,
    );

    if (
      !activeFile ||
      activeFile.type !== "tex" ||
      !/\.(tex|ltx)$/i.test(activeFile.name)
    ) {
      toast.error("Open a .tex file to insert a citation");
      return;
    }

    const originalCursor = state.cursorPosition;

    try {
      const entry = await ensureBibEntry(result);
      setAdded((previous) => ({ ...previous, [result.id]: entry.key }));
      const currentState = useDocumentStore.getState();
      currentState.setActiveFile(activeFile.id);

      const content = activeFile.content ?? "";
      const endDocument = content.indexOf("\\end{document}");
      const insertAt =
        originalCursor === 0 && endDocument !== -1
          ? endDocument
          : Math.min(originalCursor, content.length);

      currentState.replaceSelection(insertAt, insertAt, `\\cite{${entry.key}}`);
      useDocumentStore.getState().requestCompile();
      toast.success(`Inserted \\cite{${entry.key}}`);
    } catch (citeError) {
      toast.error(
        citeError instanceof Error
          ? citeError.message
          : "Could not insert the citation",
      );
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-4 py-3 pr-12">
          <SheetTitle className="flex items-center gap-2">
            <BookOpenIcon className="size-4" />
            Literature
          </SheetTitle>
          <SheetDescription>
            Search arXiv, Springer, or Zotero, then add a BibTeX entry and
            insert a citation.
          </SheetDescription>
        </SheetHeader>

        <div className="border-b px-4 pt-3">
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              className={`flex-1 rounded-md px-3 py-1.5 font-medium text-sm transition-colors ${
                tab === "arxiv"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => {
                setTab("arxiv");
                setResults([]);
                setError(null);
              }}
            >
              arXiv
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md px-3 py-1.5 font-medium text-sm transition-colors ${
                tab === "springer"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => {
                setTab("springer");
                setResults([]);
                setError(null);
              }}
            >
              Springer
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md px-3 py-1.5 font-medium text-sm transition-colors ${
                tab === "zotero"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => {
                setTab("zotero");
                setResults([]);
                setError(null);
              }}
            >
              Zotero
            </button>
          </div>

          {tab === "springer" && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Springer scope</span>
              <Select
                value={springerSource}
                onValueChange={(value) => {
                  setSpringerSource(value as SpringerSource);
                  setResults([]);
                  setError(null);
                }}
              >
                <SelectTrigger size="sm" className="h-7 w-auto text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meta">All Springer content</SelectItem>
                  <SelectItem value="openaccess">Open access only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {tab === "zotero" && (
            <div className="mt-2">
              <button
                type="button"
                className="flex items-center gap-1.5 text-muted-foreground text-xs hover:text-foreground"
                onClick={() => setShowZoteroSettings((open) => !open)}
              >
                <Settings2Icon className="size-3.5" />
                Zotero connection
                <ChevronDownIcon
                  className={`size-3 transition-transform ${
                    showZoteroSettings ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showZoteroSettings && (
                <div className="mt-2 space-y-2 rounded-lg border bg-muted/20 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={zotero.mode}
                      onValueChange={(mode) =>
                        setZotero((current) => ({
                          ...current,
                          mode: mode as ZoteroSettings["mode"],
                          libraryId:
                            mode === "local" && current.library === "users"
                              ? "0"
                              : current.libraryId,
                        }))
                      }
                    >
                      <SelectTrigger size="sm" className="w-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="local">Local Zotero app</SelectItem>
                        <SelectItem value="web">Zotero web API</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={zotero.library}
                      onValueChange={(library) =>
                        setZotero((current) => ({
                          ...current,
                          library: library as ZoteroSettings["library"],
                          libraryId:
                            library === "users" && current.mode === "local"
                              ? "0"
                              : current.libraryId,
                        }))
                      }
                    >
                      <SelectTrigger size="sm" className="w-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="users">My library</SelectItem>
                        <SelectItem value="groups">Group library</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Input
                    value={zotero.libraryId}
                    onChange={(event) =>
                      setZotero((current) => ({
                        ...current,
                        libraryId: event.target.value,
                      }))
                    }
                    placeholder={
                      zotero.library === "users"
                        ? "Zotero user ID (0 for local)"
                        : "Zotero group ID"
                    }
                    className="h-8 text-xs"
                  />

                  {zotero.mode === "web" && !serverZoteroKey && (
                    <Input
                      type="password"
                      value={zotero.apiKey}
                      onChange={(event) =>
                        setZotero((current) => ({
                          ...current,
                          apiKey: event.target.value,
                        }))
                      }
                      placeholder="Zotero API key"
                      className="h-8 text-xs"
                    />
                  )}

                  <p className="text-[0.8125rem] text-muted-foreground">
                    {zotero.mode === "local"
                      ? "Zotero must be running with its local API enabled. Credentials are stored in this browser."
                      : serverZoteroKey
                        ? "Using the server-side Zotero key. Search requests are sent through the local server."
                        : "Use a Zotero API key with read access. It is stored in this browser and forwarded through the local server."}
                  </p>
                </div>
              )}
            </div>
          )}

          <form className="flex gap-2 py-3" onSubmit={runSearch}>
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  tab === "arxiv"
                    ? "Search arXiv, e.g. diffusion models"
                    : tab === "springer"
                      ? "Search Springer journals and chapters"
                      : "Search your Zotero library"
                }
                className="h-8 bg-background pl-8 text-sm"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              className="h-8"
              disabled={isSearching || !query.trim()}
            >
              {isSearching ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                "Search"
              )}
            </Button>
          </form>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive text-sm">
              {error}
            </div>
          )}

          {!isSearching && results.length === 0 && !error && (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <BookOpenIcon className="mx-auto mb-2 size-8 text-muted-foreground/50" />
              <p className="font-medium text-sm">Search the literature</p>
              <p className="mt-1 text-muted-foreground text-xs">
                Add a reference to your .bib file and insert{" "}
                <code className="rounded bg-muted px-1">\cite</code> without
                leaving the editor.
              </p>
            </div>
          )}

          {results.map((result) => (
            <div
              key={`${result.source}-${result.id}`}
              className="rounded-lg border p-3"
            >
              <h3 className="font-medium text-sm leading-snug">
                {result.title}
              </h3>
              <p className="mt-1 text-muted-foreground text-xs">
                {result.authors.slice(0, 6).join(", ")}
                {result.authors.length > 6 ? ", et al." : ""}
              </p>
              <p className="mt-0.5 text-muted-foreground text-xs">
                {[result.year, result.venue].filter(Boolean).join(" · ")}
                {result.doi ? ` · DOI ${result.doi}` : ""}
                {result.openAccess && (
                  <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-[0.75rem] text-green-800 dark:bg-green-950 dark:text-green-300">
                    Open access
                  </span>
                )}
              </p>
              {result.abstract && (
                <p className="mt-2 line-clamp-3 text-muted-foreground text-xs">
                  {result.abstract}
                </p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => handleAdd(result)}
                  disabled={Boolean(added[result.id])}
                >
                  {added[result.id] ? (
                    <CheckIcon className="size-3.5" />
                  ) : (
                    <BookPlusIcon className="size-3.5" />
                  )}
                  {added[result.id]
                    ? `Added ${added[result.id]}`
                    : "Add to .bib"}
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleCite(result)}
                >
                  <QuoteIcon className="size-3.5" />
                  Cite
                </Button>
                {result.url && (
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground text-xs underline hover:text-foreground"
                  >
                    Open
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
