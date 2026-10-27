import { useDocumentStore } from "@/stores/document-store";
import {
  LatexCompileError,
  compileLatexWithLog,
  gatherResources,
} from "./latex-compiler";
import { parseLatexLog, resolveDiagnosticFiles } from "./compile-diagnostics";

let latestRun = 0;
let activeRuns = 0;

export async function compileProject(): Promise<void> {
  const state = useDocumentStore.getState();
  const runId = ++latestRun;
  const startedAt = performance.now();
  const fileCount = state.files.length;
  const mainFile =
    state.files.find((file) => file.id === state.mainFileId) ?? null;
  const mainFilePath = mainFile?.path ?? "main.tex";
  activeRuns += 1;

  state.setIsCompiling(true);

  try {
    const resources = gatherResources(state.files, state.mainFileId);
    const result = await compileLatexWithLog(resources, state.compiler);
    const diagnostics = resolveDiagnosticFiles(
      parseLatexLog(result.log, { mainFilePath }),
      state.files,
      state.mainFileId,
    );

    if (runId === latestRun) {
      const current = useDocumentStore.getState();
      current.setPdfData(result.pdf);
      current.setCompileDiagnostics(diagnostics);
      current.setLastCompileLog(result.log || null);
      current.appendCompileLog({
        status: "success",
        compiler: state.compiler,
        durationMs: Math.round(performance.now() - startedAt),
        fileCount,
        message:
          diagnostics.length > 0
            ? `Compiled ${mainFilePath} · ${diagnostics.length} issue${diagnostics.length === 1 ? "" : "s"}`
            : `Compiled ${mainFilePath}`,
      });
    }
  } catch (error) {
    if (runId === latestRun) {
      const message =
        error instanceof Error ? error.message : "Compilation failed";
      const log = error instanceof LatexCompileError ? error.log : "";
      const diagnostics = resolveDiagnosticFiles(
        parseLatexLog(log, { mainFilePath }),
        state.files,
        state.mainFileId,
      );
      const current = useDocumentStore.getState();
      current.setCompileError(message);
      current.setCompileDiagnostics(diagnostics);
      current.setLastCompileLog(log || null);
      current.appendCompileLog({
        status: "error",
        compiler: state.compiler,
        durationMs: Math.round(performance.now() - startedAt),
        fileCount,
        message: `Failed while compiling ${mainFilePath}`,
        details: message,
      });
    }
  } finally {
    activeRuns -= 1;
    if (activeRuns === 0) {
      useDocumentStore.getState().setIsCompiling(false);
    }
  }
}
