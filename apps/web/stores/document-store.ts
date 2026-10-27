import { create } from "zustand";
import {
  type ProjectFile,
  detectMainFile,
  getBaseName,
  getParentPath,
  isLatexDocumentFile,
  normalizeProjectFiles,
} from "@/lib/project-files";
import type { LatexCompiler } from "@/lib/latex-compiler";
import type { CompileDiagnostic } from "@/lib/compile-diagnostics";
import type { ProjectComment, StoredProject } from "@/lib/storage/schema";

export const DEFAULT_TEX_CONTENT = `\\documentclass[11pt]{article}
\\usepackage[margin=1in]{geometry}
\\usepackage{amsmath}
\\usepackage{graphicx}
\\usepackage{tikz-cd}
\\usepackage{multicol}

\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{1\\baselineskip}

\\begin{document}

\\section*{What is arcanaTeX?}

\\textbf{arcanaTeX} is an AI-powered \\LaTeX{} editor for writing scientific documents. It features built-in AI assistance to help you draft and edit text, reason through ideas, and handle formatting.

\\section*{Features}

\\begin{multicols}{2}
arcanaTeX integrates AI directly in the editor with access to your project, so you can ask it to:

\`\`Add the Laplace transform of $t\\cos(at)$ in the introduction.''
\\[
  \\mathcal{L}\\left\\{ t \\cos(a t) \\right\\} = \\frac{ s^2 - a^2 }{ (s^2 + a^2)^2 }
\\]

\`\`Add a 4\\,$\\times$\\,4 table in the results section.''
\\begin{center}
\\resizebox{0.5\\linewidth}{!}{%
\\begin{tabular}{|c|c|c|c|}
  \\hline
  1 & 2 & 3 & 4 \\\\
  \\hline
  5 & 6 & 7 & 8 \\\\
  \\hline
  9 & 10 & 11 & 12 \\\\
  \\hline
  13 & 14 & 15 & 16 \\\\
  \\hline
\\end{tabular}%
}
\\end{center}

\`\`Please proofread this section, flag any errors or logical gaps, and suggest improvements for clarity.''

\`\`Am I missing corollaries or implications of Theorem 3.1? Are all bounds tight, or can some be relaxed?''

\\columnbreak

\`\`Write an abstract based on the rest of the paper.''

\`\`Add references to my paper and suggest related work I may have missed.''

\`\`Convert this hand-drawn diagram to \\LaTeX{}.''
\\par\\noindent
\\begin{minipage}[t]{0.49\\linewidth}
  \\vspace{0pt}
  \\centering
  \\includegraphics[width=\\linewidth]{hand-write.jpg}
\\end{minipage}\\hfill
\\begin{minipage}[t]{0.49\\linewidth}
  \\vspace{0pt}
  \\centering
  \\resizebox{\\linewidth}{!}{$
    \\begin{tikzcd}[row sep=2em, column sep=1.5em, ampersand replacement=\\&]
      E
        \\arrow[dr, "e"']
        \\arrow[drr, "p_2"]
        \\arrow[ddr, "p_1"']
      \\& \\& \\\\
      \\& A \\times B \\arrow[r, "\\pi_2"'] \\arrow[d, "\\pi_1"] \\& B \\arrow[d, "g"] \\\\
      \\& A \\arrow[r, "f"'] \\& C
    \\end{tikzcd}
  $}
\\end{minipage}
\\par

\`\`Fill in all missing dependencies in my project.''

\`\`Generate a 200-word summary for a general audience.''

\`\`Create a Beamer presentation with each slide in a separate file.''
\\end{multicols}

\\section*{Getting Started}

Press \\textbf{Enter} to compile your document. Use \\textbf{Shift+Enter} for a new line. The AI assistant panel at the bottom of the editor is ready to help with any \\LaTeX{} questions or tasks.

\\end{document}
`;

export type { ProjectFile } from "@/lib/project-files";

type NewProjectFile = Omit<ProjectFile, "id" | "path"> & { path?: string };

export const DEFAULT_PROJECT_NAME = "Untitled Project";

export type InspectorTab = "project" | "versions" | "comments" | "logs";

export interface CompileLogEntry {
  id: string;
  at: number;
  status: "success" | "error";
  compiler: LatexCompiler;
  durationMs: number;
  fileCount: number;
  message: string;
  details?: string;
}

interface DocumentState {
  projectId: string | null;
  projectName: string;
  createdAt: number | null;
  files: ProjectFile[];
  activeFileId: string;
  mainFileId: string | null;
  compiler: LatexCompiler;
  compileRequestId: number;
  comments: ProjectComment[];
  isCommentsOpen: boolean;
  isLiteratureOpen: boolean;
  isSyncOpen: boolean;
  isTikzOpen: boolean;
  isBeamerOpen: boolean;
  isSubmissionOpen: boolean;
  isLeanOpen: boolean;
  isLeanInfoviewOpen: boolean;
  leanInfoviewDock: "left" | "right";
  isLatexKeyboardOpen: boolean;
  isInspectorOpen: boolean;
  inspectorTab: InspectorTab;
  compileLogs: CompileLogEntry[];
  compileDiagnostics: CompileDiagnostic[];
  lastCompileLog: string | null;
  autoCompile: boolean;
  cursorPosition: number;
  selectionRange: { start: number; end: number } | null;
  jumpToPosition: number | null;
  isThreadOpen: boolean;
  pdfData: Uint8Array | null;
  compileError: string | null;
  isCompiling: boolean;
  isSaving: boolean;
  initialized: boolean;
  isHydrated: boolean;

  hydrateProject: (project: StoredProject) => void;
  applyRemoteSnapshot: (snapshot: {
    projectName: string;
    files: ProjectFile[];
    mainFileId: string | null;
    compiler: LatexCompiler;
    comments?: ProjectComment[];
  }) => void;
  setProjectName: (name: string) => void;
  setActiveFile: (id: string) => void;
  addFile: (file: NewProjectFile) => string;
  addFiles: (files: Omit<ProjectFile, "id">[]) => number;
  importProject: (name: string, files: Omit<ProjectFile, "id">[]) => void;
  setMainFile: (id: string) => void;
  setCompiler: (compiler: LatexCompiler) => void;
  requestCompile: () => void;
  setCommentsOpen: (open: boolean) => void;
  setLiteratureOpen: (open: boolean) => void;
  setSyncOpen: (open: boolean) => void;
  setTikzOpen: (open: boolean) => void;
  setBeamerOpen: (open: boolean) => void;
  setSubmissionOpen: (open: boolean) => void;
  setLeanOpen: (open: boolean) => void;
  setLeanInfoviewOpen: (open: boolean) => void;
  setLeanInfoviewDock: (dock: "left" | "right") => void;
  setLatexKeyboardOpen: (open: boolean) => void;
  setInspectorOpen: (open: boolean) => void;
  setInspectorTab: (tab: InspectorTab) => void;
  appendCompileLog: (entry: Omit<CompileLogEntry, "id" | "at">) => void;
  clearCompileLogs: () => void;
  setCompileDiagnostics: (diagnostics: CompileDiagnostic[]) => void;
  setLastCompileLog: (log: string | null) => void;
  setAutoCompile: (enabled: boolean) => void;
  addComment: (input: {
    fileId?: string;
    line?: number;
    selectedText?: string;
    body: string;
    author?: string;
  }) => ProjectComment | null;
  deleteComment: (id: string) => void;
  toggleCommentResolved: (id: string) => void;
  deleteFile: (id: string) => void;
  renameFile: (id: string, name: string) => void;
  updateFileContent: (id: string, content: string) => void;
  setCursorPosition: (position: number) => void;
  setSelectionRange: (range: { start: number; end: number } | null) => void;
  requestJumpToPosition: (position: number) => void;
  clearJumpRequest: () => void;
  setThreadOpen: (open: boolean) => void;
  setPdfData: (data: Uint8Array | null) => void;
  setCompileError: (error: string | null) => void;
  setIsCompiling: (isCompiling: boolean) => void;
  setIsSaving: (isSaving: boolean) => void;
  insertAtCursor: (text: string) => void;
  replaceSelection: (start: number, end: number, text: string) => void;
  findAndReplace: (find: string, replace: string) => boolean;
  setInitialized: () => void;

  setContent: (content: string) => void;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function getActiveFile(state: { files: ProjectFile[]; activeFileId: string }) {
  return state.files.find((f) => f.id === state.activeFileId);
}

function withId(file: Omit<ProjectFile, "id">): ProjectFile {
  return {
    ...file,
    id: generateId(),
    name: getBaseName(file.path),
    path: file.path.replace(/^\/+/, ""),
  };
}

function isTextFile(file: ProjectFile): boolean {
  return file.type === "tex";
}

export const useDocumentStore = create<DocumentState>()((set, get) => ({
  projectId: null,
  projectName: DEFAULT_PROJECT_NAME,
  createdAt: null,
  files: [
    {
      id: "default-tex",
      name: "document.tex",
      path: "document.tex",
      type: "tex",
      content: DEFAULT_TEX_CONTENT,
    },
  ],
  activeFileId: "default-tex",
  mainFileId: "default-tex",
  compiler: "pdflatex",
  compileRequestId: 0,
  comments: [],
  isCommentsOpen: false,
  isLiteratureOpen: false,
  isSyncOpen: false,
  isTikzOpen: false,
  isBeamerOpen: false,
  isSubmissionOpen: false,
  isLeanOpen: false,
  isLeanInfoviewOpen: true,
  leanInfoviewDock: "right",
  isLatexKeyboardOpen: false,
  isInspectorOpen: false,
  inspectorTab: "project",
  compileLogs: [],
  compileDiagnostics: [],
  lastCompileLog: null,
  autoCompile: true,
  cursorPosition: 0,
  selectionRange: null,
  jumpToPosition: null,
  isThreadOpen: false,
  pdfData: null,
  compileError: null,
  isCompiling: false,
  isSaving: false,
  initialized: false,
  isHydrated: false,

  hydrateProject: (project) => {
    set({
      projectId: project.id,
      projectName: project.name,
      createdAt: project.createdAt,
      files: project.files,
      activeFileId: project.activeFileId,
      mainFileId: project.mainFileId,
      compiler: project.compiler,
      compileRequestId: 0,
      comments: project.comments ?? [],
      isCommentsOpen: false,
      isLiteratureOpen: false,
      isSyncOpen: false,
      isTikzOpen: false,
      isBeamerOpen: false,
      isSubmissionOpen: false,
      isLeanOpen: false,
      isLeanInfoviewOpen: true,
      leanInfoviewDock: "right",
      isInspectorOpen: false,
      inspectorTab: "project",
      compileLogs: [],
      compileDiagnostics: [],
      lastCompileLog: null,
      cursorPosition: 0,
      selectionRange: null,
      jumpToPosition: null,
      isThreadOpen: false,
      pdfData: null,
      compileError: null,
      isCompiling: false,
      isSaving: false,
      initialized: false,
      isHydrated: true,
    });
  },

  setProjectName: (name) => {
    const nextName = name.trim();
    if (!nextName) return;
    set({ projectName: nextName });
  },

  applyRemoteSnapshot: (snapshot) => {
    const state = get();
    const files = normalizeProjectFiles(snapshot.files);
    if (files.length === 0) return;

    const mainFile =
      files.find((file) => file.id === snapshot.mainFileId) ??
      detectMainFile(files);
    const currentActive = files.find((file) => file.id === state.activeFileId);
    const activeFile = currentActive ?? mainFile ?? files[0];

    set({
      projectName: snapshot.projectName.trim() || state.projectName,
      files,
      mainFileId: mainFile?.id ?? null,
      activeFileId: activeFile?.id ?? "",
      compiler: snapshot.compiler,
      comments: snapshot.comments ?? [],
      compileError: null,
      compileRequestId: state.compileRequestId + 1,
    });
  },

  setActiveFile: (id) =>
    set({ activeFileId: id, cursorPosition: 0, selectionRange: null }),

  setSelectionRange: (range) => set({ selectionRange: range }),

  requestJumpToPosition: (position) => set({ jumpToPosition: position }),

  clearJumpRequest: () => set({ jumpToPosition: null }),

  addFile: (file) => {
    const path = (file.path || file.name).replace(/^\/+/, "");
    const existing = get().files.find((f) => f.path === path);

    if (existing) {
      set((state) => ({
        files: state.files.map((f) =>
          f.id === existing.id
            ? {
                ...f,
                content: file.content,
                dataUrl: file.dataUrl,
                mimeType: file.mimeType,
                type: file.type,
              }
            : f,
        ),
        activeFileId: existing.id,
      }));
      return existing.id;
    }

    const id = generateId();
    set((state) => ({
      files: [...state.files, { ...file, name: getBaseName(path), path, id }],
      activeFileId: id,
    }));
    return id;
  },

  addFiles: (incoming) => {
    if (incoming.length === 0) return 0;

    const state = get();
    let addedCount = 0;
    let firstAddedId: string | null = null;
    const nextFiles = [...state.files];

    for (const file of incoming) {
      const path = file.path.replace(/^\/+/, "");
      if (!path) continue;

      const existingIndex = nextFiles.findIndex((f) => f.path === path);
      if (existingIndex !== -1) {
        nextFiles[existingIndex] = {
          ...nextFiles[existingIndex],
          ...file,
          path,
          name: getBaseName(path),
        };
      } else {
        const nextFile = withId({ ...file, path });
        nextFiles.push(nextFile);
        addedCount++;
        firstAddedId ??= nextFile.id;
      }
    }

    const mainFile =
      nextFiles.find((f) => f.id === state.mainFileId) ??
      detectMainFile(nextFiles);

    set({
      files: nextFiles,
      mainFileId: mainFile?.id ?? null,
      activeFileId: firstAddedId ?? state.activeFileId,
      compileRequestId: state.compileRequestId + 1,
    });

    return addedCount;
  },

  importProject: (name, incoming) => {
    const seenPaths = new Set<string>();
    const files: ProjectFile[] = [];

    for (const file of incoming) {
      const path = file.path.replace(/^\/+/, "");
      if (!path || seenPaths.has(path)) continue;
      seenPaths.add(path);
      files.push(withId({ ...file, path }));
    }

    const mainFile = detectMainFile(files);
    const firstText = files.find(isTextFile);

    set({
      projectName: name.trim() || "Imported Project",
      files,
      mainFileId: mainFile?.id ?? null,
      activeFileId: mainFile?.id ?? firstText?.id ?? files[0]?.id ?? "",
      comments: [],
      isCommentsOpen: false,
      isLiteratureOpen: false,
      isSyncOpen: false,
      isTikzOpen: false,
      isBeamerOpen: false,
      isSubmissionOpen: false,
      isLeanOpen: false,
      isLeanInfoviewOpen: true,
      leanInfoviewDock: "right",
      isInspectorOpen: false,
      inspectorTab: "project",
      compileLogs: [],
      compileDiagnostics: [],
      lastCompileLog: null,
      cursorPosition: 0,
      selectionRange: null,
      jumpToPosition: null,
      pdfData: null,
      compileError: null,
      compileRequestId: get().compileRequestId + 1,
    });
  },

  setMainFile: (id) => {
    const file = get().files.find((f) => f.id === id);
    if (!file || !isLatexDocumentFile(file) || get().mainFileId === id) return;
    set((state) => ({
      mainFileId: id,
      compileRequestId: state.compileRequestId + 1,
    }));
  },

  setCompiler: (compiler) => {
    if (get().compiler === compiler) return;
    set((state) => ({
      compiler,
      compileRequestId: state.compileRequestId + 1,
    }));
  },

  requestCompile: () =>
    set((state) => ({ compileRequestId: state.compileRequestId + 1 })),

  setCommentsOpen: (open) => set({ isCommentsOpen: open }),

  setLiteratureOpen: (open) => set({ isLiteratureOpen: open }),

  setSyncOpen: (open) => set({ isSyncOpen: open }),

  setTikzOpen: (open) => set({ isTikzOpen: open }),

  setBeamerOpen: (open) => set({ isBeamerOpen: open }),

  setSubmissionOpen: (open) => set({ isSubmissionOpen: open }),

  setLeanOpen: (open) => set({ isLeanOpen: open }),

  setLeanInfoviewOpen: (open) => set({ isLeanInfoviewOpen: open }),

  setLeanInfoviewDock: (dock) => set({ leanInfoviewDock: dock }),

  setLatexKeyboardOpen: (open) => set({ isLatexKeyboardOpen: open }),

  setInspectorOpen: (open) => set({ isInspectorOpen: open }),

  setInspectorTab: (tab) => set({ inspectorTab: tab, isInspectorOpen: true }),

  appendCompileLog: (entry) => {
    const log: CompileLogEntry = {
      ...entry,
      id: generateId(),
      at: Date.now(),
    };

    set((state) => ({
      compileLogs: [log, ...state.compileLogs].slice(0, 80),
    }));
  },

  clearCompileLogs: () =>
    set({
      compileLogs: [],
      compileDiagnostics: [],
      lastCompileLog: null,
    }),

  setCompileDiagnostics: (compileDiagnostics) => set({ compileDiagnostics }),

  setLastCompileLog: (lastCompileLog) => set({ lastCompileLog }),

  setAutoCompile: (autoCompile) => set({ autoCompile }),

  addComment: (input) => {
    const state = get();
    const fileId = input.fileId ?? state.activeFileId;
    const file = state.files.find((candidate) => candidate.id === fileId);
    const body = input.body.trim();

    if (!file || file.type !== "tex" || !body) return null;

    const lines = (file.content ?? "").split("\n").length;
    const line = Math.min(Math.max(input.line ?? 1, 1), Math.max(lines, 1));
    const comment: ProjectComment = {
      id: generateId(),
      fileId: file.id,
      filePath: file.path,
      line,
      selectedText: input.selectedText?.trim() || undefined,
      body,
      author: input.author?.trim() || "You",
      createdAt: Date.now(),
      resolved: false,
    };

    set((current) => ({ comments: [...current.comments, comment] }));
    return comment;
  },

  deleteComment: (id) => {
    set((state) => ({
      comments: state.comments.filter((comment) => comment.id !== id),
    }));
  },

  toggleCommentResolved: (id) => {
    set((state) => ({
      comments: state.comments.map((comment) =>
        comment.id === id
          ? { ...comment, resolved: !comment.resolved }
          : comment,
      ),
    }));
  },

  deleteFile: (id) => {
    const state = get();
    if (state.files.length <= 1) return;

    const newFiles = state.files.filter((f) => f.id !== id);
    const mainFile =
      newFiles.find((f) => f.id === state.mainFileId) ??
      detectMainFile(newFiles);
    const newActiveId =
      state.activeFileId === id
        ? (mainFile?.id ?? newFiles[0].id)
        : state.activeFileId;

    set({
      files: newFiles,
      mainFileId: mainFile?.id ?? null,
      activeFileId: newActiveId,
      comments: state.comments.filter((comment) => comment.fileId !== id),
      pdfData: null,
      compileError: null,
      compileRequestId: state.compileRequestId + 1,
    });
  },

  renameFile: (id, name) => {
    const cleanName = getBaseName(name.trim());
    if (!cleanName) return;

    set((state) => ({
      files: state.files.map((f) => {
        if (f.id !== id) return f;
        const parent = getParentPath(f.path);
        const path = parent ? `${parent}/${cleanName}` : cleanName;
        return { ...f, name: cleanName, path };
      }),
      comments: state.comments.map((comment) => {
        if (comment.fileId !== id) return comment;
        const renamed = state.files.find((f) => f.id === id);
        if (!renamed) return comment;
        const parent = getParentPath(renamed.path);
        return {
          ...comment,
          filePath: parent ? `${parent}/${cleanName}` : cleanName,
        };
      }),
    }));
  },

  updateFileContent: (id, content) => {
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, content } : f)),
    }));
  },

  setThreadOpen: (open) => set({ isThreadOpen: open }),

  setPdfData: (data) => set({ pdfData: data, compileError: null }),

  setCompileError: (error) => set({ compileError: error, pdfData: null }),

  setIsCompiling: (isCompiling) => set({ isCompiling }),

  setIsSaving: (isSaving) => set({ isSaving }),

  setCursorPosition: (position) => set({ cursorPosition: position }),

  insertAtCursor: (text) => {
    const state = get();
    const activeFile = getActiveFile(state);
    if (!activeFile || activeFile.type !== "tex") return;

    const content = activeFile.content ?? "";
    const { cursorPosition } = state;
    const newContent =
      content.slice(0, cursorPosition) + text + content.slice(cursorPosition);

    set({
      files: state.files.map((f) =>
        f.id === activeFile.id ? { ...f, content: newContent } : f,
      ),
      cursorPosition: cursorPosition + text.length,
    });
  },

  replaceSelection: (start, end, text) => {
    const state = get();
    const activeFile = getActiveFile(state);
    if (!activeFile || activeFile.type !== "tex") return;

    const content = activeFile.content ?? "";
    const newContent = content.slice(0, start) + text + content.slice(end);

    set({
      files: state.files.map((f) =>
        f.id === activeFile.id ? { ...f, content: newContent } : f,
      ),
      cursorPosition: start + text.length,
    });
  },

  findAndReplace: (find, replace) => {
    const state = get();
    const activeFile = getActiveFile(state);
    if (!activeFile || activeFile.type !== "tex") return false;

    const content = activeFile.content ?? "";
    if (!content.includes(find)) return false;

    const newContent = content.replace(find, replace);
    set({
      files: state.files.map((f) =>
        f.id === activeFile.id ? { ...f, content: newContent } : f,
      ),
    });
    return true;
  },

  setInitialized: () => set({ initialized: true }),

  setContent: (content) => {
    const state = get();
    set({
      files: state.files.map((f) =>
        f.id === state.activeFileId ? { ...f, content } : f,
      ),
    });
  },
}));

export function isPristineProject(files: ProjectFile[]): boolean {
  const doc = files.find((file) => file.id === "default-tex");
  if (!doc || doc.path !== "document.tex") return false;
  if (doc.content !== DEFAULT_TEX_CONTENT) return false;

  return files.every(
    (file) => file.id === "default-tex" || file.path === "hand-write.jpg",
  );
}
