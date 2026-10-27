# LaTeX API

A simple LaTeX compilation API service built with Hono + Node.js.

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

## Live sync

The same server hosts a token-protected WebSocket sync service:

- `GET /sync/ws/:projectId?token=...` — WebSocket room
- `GET /sync/projects/:projectId?token=...` — latest project snapshot
- `PUT /sync/projects/:projectId` — store a snapshot
- `DELETE /sync/projects/:projectId?token=...` — remove a room

Snapshots are stored as JSON under `.open-prism-sync/` by default. Set
`SYNC_DATA_DIR` to change the location. The service is intentionally simple:
it broadcasts full project snapshots (last-write-wins) and presence. Put it
behind TLS and network access control for a public deployment.
