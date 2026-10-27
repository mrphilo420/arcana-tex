# Python, R, and subagents

arcanaTeX can give the assistant local Python and R execution for computational
figures, especially when a TikZ drawing needs computed coordinates, fitted
curves, or statistical data. The assistant can also delegate independent pieces
of a figure task to parallel subagents.

## Tools exposed to the assistant

| Tool | Purpose |
|---|---|
| `run_python` | Run a Python script and return stdout, stderr, and text artifacts. |
| `run_r` | Run an R script and return stdout, stderr, and text artifacts. |
| `spawn_subagents` | Ask up to four independent role-specific agents to plan, write Python/R/TikZ, or review the result. |
| `insert_latex` | Insert the final TikZ into the active document after the code result has been checked. |

The assistant is instructed to prefer direct TikZ for simple figures and to use
Python/R when computation or data processing adds accuracy. A generated figure
should be inserted as editable `.tex`, `.tikz`, or `.pgf` source, not as a
raster substitute, unless the user asks for a raster image.

## Execution model

- Each run uses a fresh temporary directory.
- Python runs as `python3`; R runs as `Rscript --vanilla`.
- The default timeout is 20 seconds; the maximum is 30 seconds.
- Input files can be supplied as a path/content map; paths must be relative and
  may not contain `..`.
- Text artifacts are returned for `tex`, `tikz`, `pgf`, `svg`, `csv`, `tsv`,
  `dat`, `json`, `txt`, `md`, `log`, `py`, and `r` files. Individual artifacts
  and the combined result are size-capped.
- On macOS, `/usr/bin/sandbox-exec` is used to deny network access, writes
  outside the temporary directory, and reads under the user's home directory.
  Pass project data through the `files` input instead of reading it from the
  home folder. Other platforms run in the isolated directory with a timeout
  but without an OS network sandbox; the result says so explicitly.
- The temporary directory is deleted after the result is read.

The macOS sandbox is not a virtual machine. It limits network access and writes,
but system libraries and their transitive files remain readable. Review
AI-generated code as you would any local script.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `ENABLE_LOCAL_CODE_EXECUTION` | enabled | Set to `false` to reject both Python and R runs. |
| `PYTHON_BIN` | `python3` | Python executable, if a specific interpreter is needed. |
| `R_BIN` | `Rscript` | R executable, if a specific interpreter is needed. |

Python packages such as NumPy and Matplotlib are used from the local
interpreter. R packages are used from the local R library. The tools do not
install packages or access the network.

## Subagent roles

- `planner` — decompose the task.
- `tikz-python` — Python computation plus TikZ output.
- `tikz-r` — R computation plus TikZ output.
- `tikz-reviewer` — audit compileability, labels, scaling, and packages.
- `latex-reviewer` — audit surrounding LaTeX.
- `researcher` — organize technical facts and trade-offs.

Subagents are advisory: they cannot read the project, execute code, or edit
files. The parent assistant supplies context, checks the returned source, runs
code itself, and inserts only the verified result.

## Example request

> Draw a TikZ figure of a normal density with a shaded central 95% region and
> annotate the critical values. Compute the values rather than eyeballing them.

The expected flow is: use `run_python` (or `run_r`) to compute the critical
values and emit a complete `figure.tex`, use `spawn_subagents` for a
`tikz-reviewer` when useful, then call `insert_latex` with the checked TikZ.
