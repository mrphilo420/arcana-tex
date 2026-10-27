# arcanaTeX — Submission

A local-first AI LaTeX workspace built with Next.js, assistant-ui, and a
self-hosted LaTeX/sync service.

## Links to fill in

- Live app: `https://…`
- LaTeX + sync API: `https://…`
- Demo video: `https://…`
- Repository: https://github.com/mrphilo420/arcana-tex
- Team members: `…`

## What we built

- **Local project library** — All Projects / Your Projects / Shared with you,
  user folders, list and grid views, sortable columns, move-to-folder,
  folder import, rename/delete, local search across names, file paths, and
  document text.
- **Multi-file LaTeX workspace** — drag-and-drop folders, nested file tree,
  images/bibliography/packages, main-document selection, pdfLaTeX/XeLaTeX/
  LuaLaTeX compilation, live PDF preview, and autosave.
- **Workspace inspector** — right-side Project Info, Versions (local snapshots
  with restore/delete), Comments, and raw compile Logs.
- **Files / Chats sidebar** — per-project file tree and outline, plus a
  conversation view that opens the assistant and reflects persisted chat
  history.
- **Real-time diagnostics** — auto-compiles after edits, parses the TeX log,
  shows severity/nature/file/line, jumps to the source line on click, and keeps
  the issue inspector non-modal beside the code.
- **Deterministic auto-fix** — a local repair engine for missing graphics,
  theorem environments, packages, environment balance, package-provided
  commands, and duplicate definitions; shows a suggested diff and saves a
  snapshot before applying. No model call is required.
- **Workspace LaTeX keyboard** — toggleable editor ribbon for text, math,
  Greek, symbols, and TikZ commands with caret insertion and shortcuts.
- **Beamer companion + wizard** — contextual detection for Beamer documents;
  slide navigator, frame snippets, theme/aspect-ratio controls, overlays,
  notes, handout mode, and a three-step deck wizard that updates metadata and
  appends generated sections/frames.
- **Submission readiness** — target-aware arXiv/journal/conference checks and
  a browser-built source ZIP with build artifacts excluded and an optional
  compiled PDF.
- **Statistical diagram templates** — PCA biplot, CFA and SEM path models,
  scatterplot with fit, network graph, histogram, boxplot, grouped bars,
  forest plot, ROC, survival curves, confusion matrix, and correlation matrix,
  alongside research/process/system templates.
- **TikZ studio** — snap-grid drawing for rectangles, ellipses, lines, arrows,
  and text; eight resize handles plus rotation; line endpoint handles; text
  resizing; Shift aspect/angle locking; layer order, copy/paste/duplicate,
  arrow-key nudging, undo/redo; style controls; a separate tabbed LaTeX label
  ribbon with keyboard shortcuts; a live compiled PDF preview; and compact
  round-trippable metadata. Coordinates, rotations, text sizes, and layer order
  flow into the generated TikZ block.
- **Project-aware AI assistant** — full project context, project tools
  (`list_project_files`, `read_project_file`, `search_project`,
  `write_project_file`, `set_main_document`), active-document editing tools,
  per-project persisted chat history, and an OpenAI-compatible model backend.
- **Comments** — anchored to a file, line, and selection; resolve/delete;
  synced to collaborators.
- **Live collaboration + cloud snapshots** — token-protected WebSocket rooms,
  presence, a share link that reconstructs the project on another device, and
  disk persistence on the sync server.
- **Literature search** — arXiv and Springer Nature (Meta + Open Access), plus
  Zotero local/web search; adds BibTeX entries and inserts `\cite`, setting up
  the bibliography file automatically.

## Feature coverage

| Capability | Our implementation |
| --- | --- |
| Project directory | Local All / Yours / Shared views, folders, list/grid, search, sort |
| Multi-file LaTeX projects | Folder import + file tree + Files/Chats tabs |
| Compiler choice | pdfLaTeX / XeLaTeX / LuaLaTeX |
| Project inspector | Project Info, Versions, Comments, Logs |
| Version history | 30 local snapshots per project with restore/delete |
| AI with project context | Context + project tools + per-project chat history |
| In-place editing | Insert/replace/find + write file |
| Real-time errors | Auto compile + parsed log + line navigation |
| Auto-fix | Deterministic repair engine + diff preview + version safety |
| Beamer | Contextual panel + slide navigator + deck wizard + themes/overlays |
| Submission | Target checks + clean source ZIP + optional PDF |
| TikZ drawing | Resize/rotate/multi-select/group editor + ribbon + live preview |
| Diagram library | 28 agnostic research/process/system/math/statistics templates |
| Literature search | arXiv, Springer, Zotero |
| Citations | BibTeX append + `\cite` |
| Collaboration/comments | Live sync rooms + project comments |
| Project export/cloud | Sync-server snapshots + share links |

## Stack

- Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn-style UI
- Zustand, IndexedDB (`idb`), assistant-ui, Vercel AI SDK
- CodeMirror 6, react-pdf
- Hono + Node WebSocket sync server, TeX Live/MiKTeX/Tectonic
- arXiv API, Springer Nature APIs, Zotero local/web APIs

## Run locally

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
# Configure the model and optional integrations in apps/web/.env.local
pnpm dev:web
# In another terminal:
pnpm --dir apps/latex-api dev
```

The web app runs at `http://localhost:3000`; the LaTeX/sync API at
`http://localhost:3001`.

### Environment

Server-side only (never commit real keys):

```bash
OPENAI_API_KEY=""
OPENAI_MODEL=""
OPENAI_BASE_URL=""
LATEX_API_URL=""
SPRINGER_META_API_KEY=""
SPRINGER_OPENACCESS_API_KEY=""
NEXT_PUBLIC_SYNC_URL=""
```

See `README.md` for OpenAI, OpenRouter, Ollama, and sync deployment details.

## Demo script (about 3 minutes)

1. Open the home page; create a folder, move a project into it, switch between
   list and grid, and search the library.
2. Create a project, show the editor and compiled PDF.
3. Open the Project inspector and show Project Info, save a Version, and review
   the Logs tab.
4. Switch the sidebar to Chats and open the assistant; ask it to inspect files
   and create a section.
5. Open TikZ, draw a labeled figure, resize/rotate it with the handles, use
   the LaTeX ribbon, show the live compiled preview, and insert/update the
   figure in the document.
6. Open the Insert tab, launch the diagram wizard, filter to Statistics, insert
   an SEM or PCA template, resize/rotate it, and show the live preview.
7. Introduce a small LaTeX error, click the detected issue to jump to its line,
   show the suggested diff, and apply the auto-fix (or Auto-fix all).
8. Switch to a Beamer project, open the contextual Beamer companion, run the
   wizard, and change a theme.
9. Open Submit, review checks, and download the source ZIP.
10. Add a comment to a selected passage.
11. Search arXiv/Springer, add the reference, and insert a citation.
12. Start a live session, open the share link in a second browser, and show
   presence plus a bidirectional edit.

## Security notes

- API keys are read only on the server from `.env.local` / deployment secrets.
- `.env.local` is gitignored; verify with `git grep` before publishing.
- Sync rooms use random bearer tokens in share links. Snapshots are
  unencrypted JSON on the API host, so protect the host/volume.
- Collaboration snapshots are last-write-wins, not a CRDT.

## Known limitations

- Collaboration uses full snapshots with last-write-wins semantics.
- Cloud sync is the self-hosted snapshot service, not GitHub/Drive/Dropbox.
- Zotero local search requires Zotero to be running with its local API enabled;
  the web API requires a user/group ID and API key.
- Chat history is local to each browser and is not synced to collaborators.
- Project versions and compile logs are local to this browser/session; they are
  not part of sync snapshots.
- The TikZ live preview always uses pdfLaTeX and is intentionally a preview of
  the generated figure, not a full build of the manuscript.
- Auto-fix is deliberately conservative and deterministic; unrecognized
  diagnostics are marked manual. It does not call an AI model.
- Real-time compilation is debounced and can be paused with **Auto** in the PDF
  toolbar.
- The Beamer companion covers common frame/theme/overlay workflows, not every
  command in the Beamer manual.
- Submission checks are local heuristics. The app does not upload to arXiv or a
  publisher and does not validate fonts, margins, or portal-specific policy.
- TikZ library support is a curated set; arbitrary TikZ code is not parsed.
- Sync share links require the API host to be reachable from the other device.

## Submission checklist

- [ ] Push the repository; confirm `.env.local` and secrets are not tracked.
- [ ] Deploy the web app and the LaTeX/sync API.
- [ ] Set `OPENAI_*`, `LATEX_API_URL`, Springer keys, and
      `NEXT_PUBLIC_SYNC_URL` in the deployment environment.
- [ ] Confirm compilation and the PDF preview work on the deployed host.
- [ ] Confirm a sync share link works across two browsers/devices.
- [ ] Record the demo and add the link/video.
- [ ] Add screenshots and the live URL to the submission form.
- [ ] State the model/provider used for judging, and any usage limits.
- [ ] Include setup instructions and the known limitations above.
