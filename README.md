# arcanaTeX

**A local-first AI LaTeX workspace for the whole research handoff.**

arcanaTeX pairs a multi-file LaTeX editor and live PDF preview with AI
assistance, presentation tools, publication-ready diagrams, and submission
packaging. Projects stay in your browser by default; compilation and optional
model calls go through services you configure.

<p align="center">
  <img src="./assets/screenshots/workspace.png" alt="arcanaTeX workspace with LaTeX source, live PDF preview, and research tools" width="100%" />
</p>

<p align="center">
  <sub>Write LaTeX, compile continuously, review the PDF, and keep diagnostics and research tools beside the source.</sub>
</p>

## Screenshots

| Project library | Beamer wizard |
| :---: | :---: |
| [![arcanaTeX project library](./assets/screenshots/project-library.png)](./assets/screenshots/project-library.png) | [![arcanaTeX Beamer wizard](./assets/screenshots/beamer-wizard.png)](./assets/screenshots/beamer-wizard.png) |
| **TikZ studio** | **Submission readiness** |
| [![arcanaTeX TikZ studio with an SEM diagram](./assets/screenshots/tikz-studio.png)](./assets/screenshots/tikz-studio.png) | [![arcanaTeX submission readiness panel](./assets/screenshots/submission-readiness.png)](./assets/screenshots/submission-readiness.png) |

## What you can do

- **Write** in a complete multi-file LaTeX project with syntax highlighting,
  autosave, a file tree, an outline, and a live PDF beside the editor.
- **Check** every build through structured diagnostics. Jump to the source
  line, inspect a suggested diff, and apply conservative deterministic fixes.
- **Present** with a contextual Beamer companion: frame navigator, themes,
  overlays, speaker notes, handouts, and a guided deck wizard.
- **Draw** publication-ready TikZ figures with a snap-grid studio, live
  compiled preview, multi-selection, grouping, and 28 research/statistics
  templates.
- **Submit** with target-aware preflight checks and a clean source bundle built
  entirely in the browser.
- **Collaborate** through a self-hosted WebSocket sync server, with comments,
  versions, and a share link that reconstructs the project on another device.

## Features

- **Local-first project library** - All Projects, Your Projects, and Shared
  with you; folders, list and grid views, sortable columns, search across
  titles, paths, and document text, plus import, rename, move, and delete.
- **Multi-file LaTeX workspace** - Folder import, nested file tree, images,
  bibliography and class/style files, main-document selection, and
  pdfLaTeX/XeLaTeX/LuaLaTeX compilation.
- **Live PDF preview** - Automatic compilation after edits settle, zoom and
  page navigation, and a toggle to pause auto-compilation.
- **AI-assisted writing** - A project-aware assistant built on assistant-ui.
  The model receives the project file list plus active and main documents, and
  can create/read/search files, set the main document, and edit the active
  document. Keys remain server-side.
- **Real-time diagnostics** - The TeX log is parsed into structured errors and
  warnings with severity, nature, file/line, and a source excerpt. Click an
  issue to jump to it.
- **Deterministic auto-fix** - Local repair rules cover missing figures and
  packages, undefined theorem environments, unbalanced environments,
  package-provided commands, and duplicate definitions. Every fix shows a diff
  and saves a version snapshot before applying.
- **Beamer companion + wizard** - Appears only when a Beamer document is
  detected. Includes a slide navigator, frame snippets, theme and aspect-ratio
  controls, overlays, notes, handout mode, and a three-step deck wizard.
- **TikZ studio** - Draw rectangles, ellipses, lines, arrows, and text on a
  16 × 10 cm snap grid. Edit LaTeX labels with a tabbed ribbon keyboard, and
  insert or update a self-contained TikZ figure in the document.
- **Research diagram wizard** - 28 agnostic templates spanning research
  workflows, systems, mathematics, and statistics: PCA biplots, CFA/SEM path
  models, scatterplots, network graphs, histograms, boxplots, forest plots,
  ROC/survival curves, confusion matrices, correlation heatmaps, and more.
- **Full shape editing** - Eight resize handles plus rotation, line endpoint
  handles, text resizing, Shift aspect/angle locking, multi-select by
  Shift-click or marquee, grouping, alignment/distribution, layer order,
  copy/cut/paste/duplicate, arrow-key nudging, undo/redo, and grid snapping.
- **Office-style ribbon** - Rich delayed tooltips, persistent tab/group
  customization, and a tear-off floating ribbon with an AMOS-style tool palette
  for selection, grouping, align/distribute, layer order, clipboard, and undo.
- **TikZ library support** - Choose common `\usetikzlibrary` packages; preamble
  insertion is automatic. Arrowheads support basic, LaTeX, Stealth, Triangle,
  Circle, and Bar variants via `arrows.meta`.
- **Submission readiness** - arXiv, journal, and conference/double-blind
  targets with checks for structure, build errors, references, missing files,
  portability issues, draft markers, anonymity, and bundle size. Download a
  clean source `.zip` with build artifacts excluded and an optional PDF.
- **Literature search** - arXiv, Springer Nature, and Zotero; add BibTeX
  entries and insert `\cite` without leaving the editor.
- **Comments and versions** - Anchor comments to a line or selection; save up
  to 30 local snapshots per project and restore them from the inspector.
- **Workspace LaTeX keyboard** - Toggleable Text, Math, Greek, Symbols, and
  TikZ groups that insert at the CodeMirror caret with keyboard shortcuts.
- **Autosave and local storage** - Every project is saved to browser
  IndexedDB as you type.

## Quick start

### Requirements

- Node.js 20+
- pnpm 10+
- TeX Live or MiKTeX for local compilation
- An OpenAI-compatible model endpoint (optional for AI features)

### Run locally

```bash
# Clone the repository
git clone https://github.com/mrphilo420/arcana-tex.git
cd arcana-tex

# Install dependencies
pnpm install

# Copy environment variables
cp apps/web/.env.example apps/web/.env.local

# Configure your environment variables in apps/web/.env.local
# - OPENAI_API_KEY: Your OpenAI API key (server-side only)
# - OPENAI_MODEL: Optional model id (defaults to gpt-4o)
# - OPENAI_BASE_URL: Optional OpenAI-compatible endpoint
# - LATEX_API_URL: URL to the LaTeX compilation service
# - KV_REST_API_URL: KV REST API URL (for rate limiting)
# - KV_REST_API_TOKEN: KV REST API token

# Start the web app
pnpm dev:web
```

In a second terminal, start the LaTeX and sync API:

```bash
pnpm --dir apps/latex-api dev
```

The web app runs at `http://localhost:3000`; the LaTeX/sync API runs at
`http://localhost:3001`. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full
development setup.

## Connecting a model

The chat runs through `apps/web/app/api/chat/route.ts` with the Vercel AI SDK.
The API key stays on the server and is never sent to the browser.

**OpenAI:**

```bash
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-5.2"   # or gpt-4o, o-series, etc.
```

**OpenRouter / any OpenAI-compatible gateway:**

```bash
OPENAI_API_KEY="sk-or-..."
OPENAI_BASE_URL="https://openrouter.ai/api/v1"
OPENAI_MODEL="openai/gpt-5.2"
```

**Local models (Ollama, LM Studio, vLLM):**

```bash
OPENAI_API_KEY="local"                       # placeholder
OPENAI_BASE_URL="http://localhost:11434/v1"  # Ollama
OPENAI_MODEL="qwen3:32b"
```

The AI assistant receives the whole project file list plus the active and main
documents. Frontend tools let it list/read/search/create files, set the main
document, and edit the active document in place.

For Anthropic, Google, or another native API, install the matching AI SDK
provider (for example `@ai-sdk/anthropic`) and swap the provider in
`apps/web/app/api/chat/route.ts`, or put a gateway such as OpenRouter or
LiteLLM in front of it.

## Literature and Zotero

- **arXiv** search needs no key.
- **Springer Nature** search uses the server-side keys in `.env.local`:
  - `SPRINGER_META_API_KEY` for all Springer content
  - `SPRINGER_OPENACCESS_API_KEY` for open-access-only search
- **Zotero** works with either the local Zotero API (Zotero running, local API
  enabled) or the Zotero Web API with a user/group ID and API key entered in
  the Literature panel.

Adding a reference appends BibTeX to a `.bib` file (creating
`references.bib` if needed) and inserts `\cite{...}`. When it creates the
bibliography file, it also adds `\bibliographystyle{plain}` and
`\bibliography{references}` to the main document if no bibliography is
configured.

## Project library, folders, and versions

The home page keeps project organization local:

- **All Projects** contains everything in this browser. **Your Projects**
  excludes projects opened from a collaborator's sync link; those appear under
  **Shared with you**.
- **Folders** are local collections of projects (they do not move files inside
  a manuscript). Create them from the sidebar or the **New** menu, move projects
  with the row menu, and delete a folder without deleting the projects inside
  it.
- **List view** supports sorting by name or creation date; **grid view** keeps
  the cover-card layout. Search covers project names, paths, and up to 120k
  characters of document text.
- **Versions** live in the workspace Project inspector. Save up to 30 local
  snapshots per project with an optional note, then restore or delete them.
  Snapshots include files, comments, compiler, and main-document selection.

Compile **Logs** are kept for the current session and show engine, timing, file
count, and any captured error output. They are local to the browser and are
cleared when the project is reopened.

## Real-time compile diagnostics and auto-fix

Compilation runs automatically after edits settle (a 1.2 s idle debounce) unless
**Auto** is paused in the PDF toolbar. The compile request asks the LaTeX
service for the full `.log`, and the client parses it into structured
diagnostics.

- Each issue shows its severity, nature (for example *Undefined environment*,
  *Missing figure*, *Environment mismatch*, or *Undefined command*), file/line,
  and a source excerpt.
- Click an issue to jump the editor to that line. The inspector is non-modal,
  so the code and the suggested fix remain visible together.
- The **Suggested fix** panel shows the exact line changes before applying.
  **Auto-fix all** runs the same deterministic rules across the issue list.
- A version snapshot is saved before any auto-fix, so the change can be
  restored from **Versions**.
- The repair rules cover missing graphics (comment the command), missing
  theorem-like environments (add `\newtheorem`), missing package-provided
  environments/commands (add the package), unbalanced environments (comment
  stray ends or close unclosed blocks), missing `.sty` calls, and simple
  duplicate definitions. Anything without a safe deterministic match is marked
  **Manual**/**Review** and left untouched.

## Beamer presentations

The workspace detects `\documentclass{beamer}`, `\begin{frame}`, or
`\usetheme` and reveals a contextual **Beamer** control. The companion panel
does not appear for ordinary articles. The home page's **New** menu can also
start a **Beamer presentation** project with a complete starter deck.

- **Slides** lists frames parsed from the source; clicking one jumps to it.
- **Wizard** collects title/subtitle/author/institute/date, sections, starter
  frame style, theme, and aspect ratio, previews the exact source, and appends
  the new frames while updating the preamble metadata.
- **Insert** contains title, section, standard, theorem, two-column, block,
  fragile code, figure, table, and notes snippets.
- **Theme** edits built-in theme families, color/font/inner/outer themes, aspect
  ratio, navigation symbols, frame numbers, transparent covered content,
  speaker notes, and handout mode. Changes are written to the main file and
  recompiled.
- **Overlays** inserts `\pause`, `<+->`, `\only`, `\uncover`, `\visible`,
  `\alert`, `\onslide`, transitions, and notes; selection-wrapping is
  supported.
- The panel links to the [Beamer manual](https://www.beamer.plus/home.html).

## Submission readiness

The **Submit** control opens a local preflight panel:

- Choose arXiv, journal, or conference/double-blind mode.
- Checks cover main-file structure, compile errors, undefined references and
  citations, missing includes/figures/bibliographies, exact-case paths,
  compiler/package mismatches, shell-escape features, draft/TODO markers,
  identity markers (optional), and bundle size.
- Each issue links back to the source line.
- **Download source bundle** builds a valid store-only `.zip` in the browser,
  excludes build artifacts, and can include the compiled PDF. Nothing is
  uploaded.

The checks are deliberately heuristic and never claim acceptance. See
[SUBMISSION.md](./SUBMISSION.md) for a submission-oriented feature summary.

## TikZ figure studio

Open **TikZ** from the workspace top bar, or place the cursor inside an
existing studio figure and reopen it.

- Draw rectangles, ellipses, lines, arrows, and text on a 16 × 10 cm snap grid.
- Select a shape to get eight resize handles and a rotation handle; drag the
  round handle to rotate, hold **Shift** to snap rotation to 15° (and to keep
  the aspect ratio when resizing a box). Text handles resize the font, and line
  endpoints have their own drag handles.
- Use **Shift** while dragging a line endpoint to constrain its angle. Move
  shapes by dragging; use arrow keys to nudge (Shift for a larger step), and
  **⌘/Ctrl+C/V/D** to copy, paste, or duplicate.
- **Shift-click** adds/removes shapes; drag empty canvas for a marquee. Group
  with **⌘/Ctrl+G**, ungroup with **⌘/Ctrl+Shift+G**, and use the multi-selection
  panel for align/distribute. The pop-out ribbon adds an AMOS-style tool palette
  with select-all, grouping, align/distribute, layer, clipboard, duplicate,
  delete, and undo/redo.
- The selection toolbar controls layer order (bring forward/send backward).
  The **Design** controls set stroke, fill, line width, dash pattern,
  arrowheads, rounded corners, numeric rotation, text size, figure
  scale/wrapper, and the `\usetikzlibrary` set. Arrowheads support
  `arrows.meta` variants.
- The **Insert** tab opens the research diagram wizard, with 28 agnostic
  templates across research, process, models, systems, concepts, mathematics,
  and statistics.
- The separate **LaTeX ribbon** provides Text, Math, Greek, Symbols, and TikZ
  groups. It inserts commands at the label caret and supports
  `⌘/Ctrl+B/I/U/E` wrapping while a label is focused.
- **Live preview** compiles a generated `standalone` document with pdfLaTeX and
  renders the result beside the design controls. It refreshes after edits
  settle; the eye button hides it when you need more room.
- Every resize, rotation, text-size change, endpoint move, and layer-order
  change updates the generated coordinates and TikZ options immediately.
- **Insert figure** places the TikZ block inside `document`, adds
  `\usepackage{tikz}` to the preamble if necessary, and stores a compact
  metadata marker after the block so the figure can be reopened and updated
  later. Reopening replaces the existing block instead of nesting a duplicate.

## Live collaboration and sync

The LaTeX API also hosts a small WebSocket sync server:

- **Start session** from the people icon in the project sidebar.
- Copy the share link and open it on another device.
- Project snapshots are persisted on the API host in `SYNC_DATA_DIR` (default
  `.arcanatex-sync/`); they are unencrypted JSON, so protect the host/volume
  accordingly.
- Edits sync in real time with presence; conflicts are last-write-wins.
- A joining device with no local copy reconstructs the project from the
  snapshot.

By default the browser connects to `ws://<current-host>:3001/sync`. Set
`NEXT_PUBLIC_SYNC_URL` for a different sync host. For a public deployment,
put the API behind TLS (`wss://`) and restrict access; anyone with a project
share link (which includes a random token) can join.

## Project structure

```text
arcana-tex/
├── apps/
│   ├── web/          # Next.js application
│   └── latex-api/    # LaTeX compilation API + WebSocket sync
├── assets/
│   └── screenshots/  # README images
├── packages/         # Shared packages (if any)
├── biome.json        # Biome linter configuration
└── turbo.json        # Turborepo configuration
```

### apps/web

Next.js 16 application with:

- assistant-ui for the AI chat interface
- CodeMirror for LaTeX editing
- react-pdf for PDF preview
- Upstash Redis for rate limiting

### apps/latex-api

Hono-based service for LaTeX compilation and sync:

- Accepts LaTeX source and resources
- Compiles with TeX Live (pdfLaTeX by default)
- Returns the compiled PDF
- Hosts token-protected WebSocket project snapshots

## Deployment

### Web app (Vercel)

1. Import the repository into Vercel.
2. Set the root directory to `apps/web`.
3. Configure environment variables:
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL` (optional)
   - `OPENAI_BASE_URL` (optional)
   - `LATEX_API_URL`
   - `SPRINGER_META_API_KEY` (optional)
   - `SPRINGER_OPENACCESS_API_KEY` (optional)
   - `NEXT_PUBLIC_SYNC_URL` (optional; WebSocket base for live sync)
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`

### LaTeX API (Docker)

```bash
cd apps/latex-api
docker build -t arcanatex-latex-api .
docker run -p 3001:3001 -v arcanatex-sync:/data arcanatex-latex-api
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, code style, and
the pull-request process.

## License

[MIT](./LICENSE)
