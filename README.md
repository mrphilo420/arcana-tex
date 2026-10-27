# Open-Prism

Open-source AI-powered LaTeX writing workspace with live preview.

![Open-Prism Screenshot](./assets/OpenPrism.png)

## Features

- **AI-Assisted Writing** - Powered by assistant-ui for intelligent LaTeX assistance
- **Project library** - A Prism-style local home page with All Projects, Your Projects, Shared with you, user folders, list/grid views, sortable columns, rename/delete, move-to-folder, folder import, and search across titles, file paths, and document text
- **Multi-file Projects** - Drag a folder onto the directory or sidebar, or use **Import Folder**; subfolders, images, and `.bib`/`.sty`/`.cls` files are preserved
- **Compiler Selection** - Compile with pdfLaTeX, XeLaTeX, or LuaLaTeX and choose the project's main document
- **Comments** - Anchor comments to a line or selection and resolve them; saved per project
- **Live Collaboration** - Share a project link for real-time multi-user editing with presence, backed by the self-hosted sync server; projects opened from a share link appear under **Shared with you**
- **Project inspector** - A right-side workspace panel with Project Info, Versions (local snapshots/restore), Comments, and compile Logs
- **Files and Chats sidebar** - Switch between the file tree/outline and a per-project conversation view; the assistant thread is stored with the project
- **Real-time diagnostics** - Auto-compiles after edits (toggleable), parses the TeX log into structured warnings/errors, shows their nature and location, and jumps to the source line when an issue is clicked
- **Deterministic auto-fix** - A local repair engine handles common failures (missing figures/packages, undefined theorem environments, unbalanced environments, package-provided commands, duplicate definitions) with a suggested diff and a pre-fix version snapshot; no model call is required
- **Workspace LaTeX keyboard** - A toggleable ribbon in the editor with Text, Math, Greek, Symbols, and TikZ groups; inserts at the CodeMirror caret and supports keyboard shortcuts
- **Beamer companion + wizard** - Appears only when a Beamer document is detected; slide navigator, frame snippets, theme/aspect-ratio controls, overlays, notes, handout mode, and a three-step deck wizard with live metadata/frame preview
- **Submission readiness** - Target-aware preflight checks for arXiv, journals, and double-blind conferences, plus a downloadable clean source `.zip` with build artifacts excluded and optional compiled PDF
- **TikZ studio** - Draw rectangles, ellipses, arrows, and text on a snap grid, edit LaTeX labels with a tabbed ribbon keyboard, and insert/update a self-contained TikZ figure in the document
- **Research diagram wizard** - 28 standardized, research-agnostic templates including flowcharts, pipelines, architectures, lattices, support windows, orthant diagrams, PCA biplots, CFA/SEM path models, scatterplots, network graphs, histograms, boxplots, bar charts, forest plots, ROC/survival curves, confusion matrices, and correlation heatmaps
- **Full shape editing** - CorelDRAW/AMOS-style selection handles (8 resize handles plus rotation), line endpoint handles, drag-to-move, Shift aspect-ratio/angle locking, text resizing, multi-select (Shift-click and marquee), grouping, alignment/distribution, layer order, copy/cut/paste/duplicate, arrow-key nudging, undo/redo, and grid snapping
- **Office-style ribbon** - Rich delayed tooltips, tab/group customization with persistent order and visibility, and a tear-off floating ribbon with a compact AMOS-style tool palette (tools, grouping, align, distribute, layer, clipboard, undo/redo)
- **TikZ library support** - Select common `\usetikzlibrary` packages in the studio; preamble insertion is automatic. Arrowheads include basic, LaTeX, Stealth, Triangle, Circle, and Bar variants via `arrows.meta`
- **Live TikZ preview** - The studio compiles the generated `standalone` TikZ document in the background and keeps a rendered PDF preview in sync with the canvas; coordinates, rotation, text size, and layer order flow directly into the generated code
- **Literature Search** - Search arXiv, Springer Nature, or Zotero, add BibTeX entries, and insert `\cite` without leaving the editor
- **Live PDF Preview** - Real-time compilation and preview of your documents
- **CodeMirror Editor** - Syntax highlighting and LaTeX language support
- **Autosave** - Every project is saved to browser IndexedDB as you type
- **Dark/Light Theme** - Automatic theme switching support

## Quick Start

```bash
# Clone the repository
git clone https://github.com/assistant-ui/open-prism.git
cd open-prism

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

# Start development server
pnpm dev:web
```

## Connecting a model

The chat runs through `apps/web/app/api/chat/route.ts` with the Vercel AI
SDK. The API key stays on the server and is never sent to the browser.

**OpenAI (closest to Prism):**

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
OPENAI_API_KEY="local"                    # placeholder
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
  a manuscript). Create them from the sidebar or the **New** menu, drag-free
  move projects with the row menu, and delete a folder without deleting the
  projects inside it.
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
does not appear for ordinary articles. The home page’s **New** menu can also
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

The checks are deliberately heuristic and never claim acceptance.

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

- **Start session** from the people icon in the project sidebar
- Copy the share link and open it on another device
- Project snapshots are persisted on the API host under
  `.open-prism-sync/` (override with `SYNC_DATA_DIR`); they are unencrypted
  JSON, so protect the host/volume accordingly
- Edits sync in real time with presence; conflicts are last-write-wins
- A joining device with no local copy reconstructs the project from the
  snapshot

By default the browser connects to `ws://<current-host>:3001/sync`. Set
`NEXT_PUBLIC_SYNC_URL` for a different sync host. For a public deployment,
put the API behind TLS (`wss://`) and restrict access; anyone with a project
share link (which includes a random token) can join.

## Project Structure

```
open-prism/
├── apps/
│   ├── web/          # Next.js frontend application
│   └── latex-api/    # LaTeX compilation API (Hono + TeX Live)
├── packages/         # Shared packages (if any)
├── biome.json        # Biome linter configuration
└── turbo.json        # Turborepo configuration
```

### apps/web

Next.js 16 application with:
- assistant-ui for AI chat interface
- CodeMirror for LaTeX editing
- react-pdf for PDF preview
- Upstash Redis for rate limiting

### apps/latex-api

Hono-based API for LaTeX compilation:
- Accepts LaTeX source code
- Compiles using TeX Live (pdflatex)
- Returns compiled PDF

## Deployment

### Web App (Vercel)

1. Import the repository to Vercel
2. Set root directory to `apps/web`
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
docker build -t open-prism-latex-api .
docker run -p 3001:3001 -v open-prism-sync:/data open-prism-latex-api
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and contribution guidelines.

## License

[MIT](./LICENSE)
