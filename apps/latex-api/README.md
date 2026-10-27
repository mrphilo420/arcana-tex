# arcanaTeX LaTeX + Lean + sync API

LaTeX compilation and real-time project sync for arcanaTeX, built with Hono and
Node.js.

## API

### `POST /builds/sync`

Compiles LaTeX documents and returns PDF.

**Request:**
```json
{
  "compiler": "pdflatex",
  "resources": [
    {
      "path": "main.tex",
      "content": "\\documentclass{article}\\begin{document}Hello\\end{document}",
      "main": true
    },
    {
      "path": "image.png",
      "file": "<base64-encoded-content>"
    }
  ]
}
```

**Response:**
- Success: `application/pdf` binary
- Failure: `application/json` with `{ error, log_files }`

## Local Development

```bash
# Install dependencies (from workspace root)
pnpm install

# Run development server
pnpm dev

# Test
curl -X POST http://localhost:3001/builds/sync \
  -H "Content-Type: application/json" \
  -d '{"compiler":"pdflatex","resources":[{"main":true,"content":"\\documentclass{article}\\begin{document}Hello\\end{document}"}]}'
```

Requires a TeX distribution installed locally (TeX Live, or MiKTeX on macOS). On macOS the API will automatically use the MiKTeX binaries bundled with `/Applications/MiKTeX Console.app` when `pdflatex` is not on `PATH`.

When a `.bib` file is present, the API runs **Biber** for documents using
`biblatex`/`\addbibresource`, and **BibTeX** otherwise. Biber output is included
in the returned log. The API prefers Homebrew's compatible `biber` over older
copies on `PATH`.

The `compiler` field accepts `pdflatex`, `xelatex`, `lualatex`, or `tectonic`.
The traditional engines use `-file-line-error`, bounded reruns driven by
`.aux`/log changes, and automatic MakeIndex when an `.idx` file appears.
Tectonic is invoked with `--untrusted --keep-logs`; it handles reruns and
bibliography processing internally and writes its log to the compile log.

## Lean Lake bridge

The same server exposes a local, read-only Lean project bridge. It discovers
Lake projects from Elan's known-project registry and common document folders;
set an optional default with `LEAN_PROJECT_DIR`:

```bash
LEAN_PROJECT_DIR="/absolute/path/to/lake-project" pnpm dev
```

- `GET /lean/projects` — discovered Lake projects and their `lean-toolchain` pins
- `GET /lean/toolchains` — installed Elan toolchains
- `GET /lean/status?path=...` — project name, path, pin, Lake version, and configuration status
- `GET /lean/files?path=...` — `.lean` files outside ignored build directories
- `GET /lean/file?project=...&path=...` — read one `.lean` file
- `POST /lean/build` — run `lake build`; body: `{ "path": "...", "toolchain": "..." }`

The bridge accepts no arbitrary commands or paths and never writes to the Lean
project. Only configure trusted projects: `lake build` executes the project's
Lakefile and build scripts. `LEAN_PROJECT_DIR` supports `~`. Set `LAKE_BIN` if Lake is not on
`PATH`, `LEAN_BUILD_TIMEOUT_MS` to change the 180-second build timeout, and
`LEAN_BRIDGE_TOKEN` to require a bearer token. The web app must use the same
token in `apps/web/.env.local`.

## Live sync

The same server hosts a token-protected WebSocket sync service:

- `GET /sync/ws/:projectId?token=...` — WebSocket room
- `GET /sync/projects/:projectId?token=...` — latest project snapshot
- `PUT /sync/projects/:projectId` — store a snapshot
- `DELETE /sync/projects/:projectId?token=...` — remove a room

Snapshots are stored as JSON in `SYNC_DATA_DIR` (default `.arcanatex-sync/`).
If a legacy `.open-prism-sync/` directory exists and the new directory does not,
the legacy directory is used automatically. The service is intentionally simple:
it broadcasts full project snapshots (last-write-wins) and presence. Put it
behind TLS and network access control for a public deployment.
