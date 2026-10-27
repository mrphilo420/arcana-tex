# Compiler Best Practices

Applied and deferred practices for the local LaTeX compiler.

Sources:
- [Tectonic: The Tectonic Typesetting System](https://tectonic-typesetting.github.io/book/latest/)
- [latexmk usage guide](https://mg.readthedocs.io/latexmk.html)
- TeX Live / pdfTeX command-line behavior

## Applied

| Practice | Implementation |
|---|---|
| Tectonic as an optional engine | `tectonic` is selectable in the PDF toolbar and sent through `/api/compile`. It uses the installed Tectonic binary. |
| Automatic reruns | Tectonic handles its own reruns. The traditional engines use bounded reruns driven by `.aux` changes and log rerun requests. |
| Tectonic package handling | Tectonic resolves and caches its own bundle resources, so documents can use packages not preinstalled with MiKTeX/TeX Live. |
| Tectonic trust boundary | Tectonic is invoked with `--untrusted`; shell escape is not enabled by default. |
| Biber vs BibTeX | `biblatex` / `\addbibresource` runs Biber; ordinary `.bib` files run BibTeX. Output is included in the compile log. |
| MakeIndex | An `.idx` file triggers MakeIndex before the final TeX passes. |
| Parseable errors | Traditional engines use `-file-line-error`; the diagnostic parser accepts both `! message` and `file.tex:line: message` formats. |
| Generous TeX log width | TeX runs with `max_print_line=1000`, `error_line=254`, and `half_error_line=238` so long paths and error lines are not split. |
| Explicit shell-escape policy | Traditional engines use `-no-shell-escape`; Tectonic uses `--untrusted`. Features such as minted need an explicit opt-in in a future change. |
| Workspace isolation | Every compile runs in a fresh temporary directory, with path traversal rejection and a 50 MB request cap. |
| Timeouts and concurrency | Compiles have bounded timeouts; the API caps active compilations at three. |
| Clean logs | Temporary auxiliary files are removed after the result is captured. |
| Biber compatibility | Biber resolution prefers a Homebrew-compatible installation over stale copies on `PATH`. |

## Deferred or deliberately not enabled

- **Shell escape**: not enabled by default because it allows document code to run local commands. A future per-project opt-in should be explicit and clearly marked.
- **latexmk**: not required at runtime. The API implements the small set of rerun/tool rules needed here; latexmk remains a useful local alternative but adds a Perl dependency.
- **Recorder-based dependency tracking**: `-recorder` could improve “which file changed?” detection and watch mode. The current editor already triggers on source changes.
- **Package installation**: the API does not silently install arbitrary TeX packages. Tectonic handles its own bundle; MiKTeX users should install missing packages in MiKTeX Console.
- **SyncTeX**: not used by the current PDF viewer. It can be added when source-to-PDF navigation is wired up.
- **Reproducible output timestamps**: `SOURCE_DATE_EPOCH` can be supported once project dates are passed to the API.
- **Persistent Tectonic cache controls**: Tectonic manages its own cache; the app does not expose `--only-cached` yet.

## Operational notes

- If Tectonic is not installed, the compiler option returns a clear failure rather than silently falling back to pdfLaTeX.
- If Biber is unavailable for a biblatex project, the compile log records the missing tool; the PDF may still be produced without a resolved bibliography.
- When a PDF is produced despite errors, the app pauses automatic source repairs and highlights the affected lines instead of overwriting a working PDF.
