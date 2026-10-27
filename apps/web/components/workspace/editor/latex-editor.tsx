"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { EditorState, Prec } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  scrollPastEnd,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  insertNewlineAndIndent,
} from "@codemirror/commands";
import { syntaxHighlighting } from "@codemirror/language";
import {
  search,
  highlightSelectionMatches,
  SearchQuery,
  setSearchQuery as setSearchQueryEffect,
  findNext,
  findPrevious,
} from "@codemirror/search";
import { markdown } from "@codemirror/lang-markdown";
import { latex } from "codemirror-lang-latex";
import { FileIcon } from "lucide-react";
import { isLeanFile } from "@/lib/lean";
import { leanLanguage } from "@/lib/lean-language";
import { cn } from "@/lib/utils";
import { useDocumentStore } from "@/stores/document-store";
import { useDevFeatureFlag } from "@/stores/dev-panel-store";
import { useEditorPreferencesStore } from "@/stores/editor-preferences-store";
import { compileProject } from "@/lib/compile-project";
import { buildEditorTheme } from "@/lib/editor-theme";
import { EditorToolbar } from "./editor-toolbar";
import { type LatexInsertion, TikzLatexRibbon } from "../tikz-latex-ribbon";
import { AIDrawer } from "./ai-drawer";
import { ImagePreview } from "./image-preview";
import { MarkdownPreview } from "./markdown-preview";
import { SearchPanel } from "./search-panel";

interface StickyItem {
  type: "section" | "begin";
  name: string;
  content: string;
  html: string;
  line: number;
}

interface ParsedLine {
  type: "section" | "begin" | "end";
  name: string;
  content: string;
  line: number;
}

function parseLatexStructure(content: string): ParsedLine[] {
  const lines = content.split("\n");
  const result: ParsedLine[] = [];

  const sectionRegex =
    /\\(part|chapter|section|subsection|subsubsection)\*?\s*\{[^}]*\}/;
  const beginRegex = /\\begin\{([^}]+)\}/;
  const endRegex = /\\end\{([^}]+)\}/;

  lines.forEach((lineContent, index) => {
    const sectionMatch = lineContent.match(sectionRegex);
    if (sectionMatch) {
      result.push({
        type: "section",
        name: sectionMatch[1],
        content: lineContent,
        line: index + 1,
      });
      return;
    }

    const beginMatch = lineContent.match(beginRegex);
    if (beginMatch) {
      result.push({
        type: "begin",
        name: beginMatch[1],
        content: lineContent,
        line: index + 1,
      });
      return;
    }

    const endMatch = lineContent.match(endRegex);
    if (endMatch) {
      result.push({
        type: "end",
        name: endMatch[1],
        content: lineContent,
        line: index + 1,
      });
    }
  });

  return result;
}

function getStickyLines(
  parsedLines: ParsedLine[],
  currentLine: number,
): StickyItem[] {
  const stack: StickyItem[] = [];

  const sectionLevelMap: Record<string, number> = {
    part: 0,
    chapter: 1,
    section: 2,
    subsection: 3,
    subsubsection: 4,
  };

  for (const item of parsedLines) {
    if (item.line > currentLine) break;

    if (item.type === "section") {
      const level = sectionLevelMap[item.name] ?? 2;
      while (
        stack.length > 0 &&
        stack[stack.length - 1].type === "section" &&
        sectionLevelMap[stack[stack.length - 1].name] >= level
      ) {
        stack.pop();
      }
      stack.push({
        type: "section",
        name: item.name,
        content: item.content,
        html: "",
        line: item.line,
      });
    } else if (item.type === "begin") {
      stack.push({
        type: "begin",
        name: item.name,
        content: item.content,
        html: "",
        line: item.line,
      });
    } else if (item.type === "end") {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].type === "begin" && stack[i].name === item.name) {
          stack.splice(i, 1);
          break;
        }
      }
    }
  }

  return stack;
}

function getActiveFileContent(): string {
  const state = useDocumentStore.getState();
  const activeFile = state.files.find((f) => f.id === state.activeFileId);
  return activeFile?.content ?? "";
}

export function LatexEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const files = useDocumentStore((s) => s.files);
  const activeFileId = useDocumentStore((s) => s.activeFileId);
  const setContent = useDocumentStore((s) => s.setContent);
  const setCursorPosition = useDocumentStore((s) => s.setCursorPosition);
  const setSelectionRange = useDocumentStore((s) => s.setSelectionRange);
  const jumpToPosition = useDocumentStore((s) => s.jumpToPosition);
  const clearJumpRequest = useDocumentStore((s) => s.clearJumpRequest);
  const isLatexKeyboardOpen = useDocumentStore((s) => s.isLatexKeyboardOpen);
  const setLatexKeyboardOpen = useDocumentStore((s) => s.setLatexKeyboardOpen);
  const markdownPreviewEnabled = useDevFeatureFlag("markdownPreview");
  const terminalThemeId = useEditorPreferencesStore(
    (state) => state.terminalThemeId,
  );
  const terminalTheme = useMemo(
    () => buildEditorTheme(terminalThemeId),
    [terminalThemeId],
  );

  const activeFile = files.find((f) => f.id === activeFileId);
  const isTexFile = activeFile?.type === "tex";
  const isLean = activeFile ? isLeanFile(activeFile) : false;
  const isMarkdown =
    activeFile?.type === "tex" && /\.(?:md|markdown)$/i.test(activeFile.path);
  const activeFileContent = activeFile?.content;

  const [imageScale, setImageScale] = useState(0.5);
  const [currentLine, setCurrentLine] = useState(1);
  const [gutterWidth, setGutterWidth] = useState(0);
  const [lineHtmlCache, setLineHtmlCache] = useState<Record<number, string>>(
    {},
  );
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [markdownPreview, setMarkdownPreview] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);

  const parsedLines = useMemo(
    () =>
      isLean || isMarkdown ? [] : parseLatexStructure(activeFileContent ?? ""),
    [activeFileContent, isLean, isMarkdown],
  );

  const stickyLines = useMemo(() => {
    const items = getStickyLines(parsedLines, currentLine);
    return items.map((item) => ({
      ...item,
      html: lineHtmlCache[item.line] || "",
    }));
  }, [parsedLines, currentLine, lineHtmlCache]);

  useEffect(() => {
    useEditorPreferencesStore.getState().hydrate();
  }, []);

  useEffect(() => {
    setMarkdownPreview(false);
  }, [activeFileId]);

  useEffect(() => {
    if (!markdownPreviewEnabled) setMarkdownPreview(false);
  }, [markdownPreviewEnabled]);

  const compileRef = useRef<() => void>(() => {});
  const isSearchOpenRef = useRef(false);

  const insertFromKeyboard = useCallback((insertion: LatexInsertion) => {
    const view = viewRef.current;
    if (!view) return;

    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    const text = `${insertion.before}${selected}${insertion.after ?? ""}`;
    const caret = insertion.after
      ? selected.length > 0
        ? from +
          insertion.before.length +
          selected.length +
          insertion.after.length
        : from + insertion.before.length
      : from + insertion.before.length + selected.length;

    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: caret, head: caret },
      scrollIntoView: true,
    });
    view.focus();
  }, []);

  useEffect(() => {
    isSearchOpenRef.current = isSearchOpen;
  }, [isSearchOpen]);

  useEffect(() => {
    if (!searchQuery || !activeFileContent) {
      setMatchCount(0);
      setCurrentMatch(0);
      return;
    }

    const regex = new RegExp(
      searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "gi",
    );
    const matches = activeFileContent.match(regex);
    setMatchCount(matches?.length ?? 0);
    if (matches && matches.length > 0) {
      setCurrentMatch(1);
    } else {
      setCurrentMatch(0);
    }
  }, [searchQuery, activeFileContent]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setIsSearchOpen(true);
        return;
      }

      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "k"
      ) {
        e.preventDefault();
        setLatexKeyboardOpen(!isLatexKeyboardOpen);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLatexKeyboardOpen, setLatexKeyboardOpen]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const query = new SearchQuery({
      search: searchQuery,
      caseSensitive: false,
      literal: true,
    });

    view.dispatch({
      effects: setSearchQueryEffect.of(query),
    });

    if (searchQuery) {
      findNext(view);
    }
  }, [searchQuery]);

  const handleFindNext = () => {
    const view = viewRef.current;
    if (!view) return;
    findNext(view);
    view.focus();
  };

  const handleFindPrevious = () => {
    const view = viewRef.current;
    if (!view) return;
    findPrevious(view);
    view.focus();
  };

  compileRef.current = async () => {
    await compileProject();
  };

  useEffect(() => {
    if (!containerRef.current || !isTexFile) return;

    const currentContent = getActiveFileContent();

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        setContent(update.state.doc.toString());
      }
      if (update.selectionSet) {
        const { from, to, head } = update.state.selection.main;
        setCursorPosition(head);
        if (from !== to) {
          setSelectionRange({ start: from, end: to });
        } else {
          setSelectionRange(null);
        }
      }
    });

    const scrollListener = EditorView.domEventHandlers({
      scroll: (_, view) => {
        const scrollTop = view.scrollDOM.scrollTop;
        const lineBlock = view.lineBlockAtHeight(scrollTop);
        const lineNumber = view.state.doc.lineAt(lineBlock.from).number;
        setCurrentLine(lineNumber);

        const gutter = view.dom.querySelector(".cm-gutters");
        if (gutter) {
          setGutterWidth(gutter.getBoundingClientRect().width);
        }

        const cmLines = view.dom.querySelectorAll(".cm-line");
        const newCache: Record<number, string> = {};
        cmLines.forEach((el) => {
          const lineInfo = view.lineBlockAt(
            view.posAtDOM(el as HTMLElement, 0),
          );
          const ln = view.state.doc.lineAt(lineInfo.from).number;
          newCache[ln] = el.innerHTML;
        });
        setLineHtmlCache((prev) => ({ ...prev, ...newCache }));
      },
    });

    const compileKeymap = Prec.highest(
      keymap.of([
        {
          key: "Enter",
          run: (view) => {
            if (isSearchOpenRef.current) {
              findNext(view);
              return true;
            }
            if (isLean || isMarkdown) return false;
            compileRef.current();
            return true;
          },
        },
        {
          key: "Shift-Enter",
          run: (view) => {
            if (isSearchOpenRef.current) {
              findPrevious(view);
              return true;
            }
            return insertNewlineAndIndent(view);
          },
        },
        {
          key: "Mod-s",
          run: () => {
            const { setIsSaving } = useDocumentStore.getState();
            setIsSaving(true);
            setTimeout(() => setIsSaving(false), 1000);
            return true;
          },
        },
        {
          key: "Mod-f",
          run: () => {
            if (isMarkdown) setMarkdownPreview(false);
            setIsSearchOpen(true);
            return true;
          },
        },
        {
          key: "Escape",
          run: () => {
            if (isSearchOpenRef.current) {
              setIsSearchOpen(false);
              return true;
            }
            return false;
          },
        },
      ]),
    );

    const state = EditorState.create({
      doc: currentContent,
      extensions: [
        compileKeymap,
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        isLean ? leanLanguage : isMarkdown ? markdown() : latex(),
        terminalTheme.theme,
        syntaxHighlighting(terminalTheme.highlight),
        search(),
        highlightSelectionMatches(),
        updateListener,
        scrollListener,
        EditorView.lineWrapping,
        scrollPastEnd(),
        EditorView.theme({
          "&": {
            height: "100%",
            fontSize: "14px",
          },
          ".cm-scroller": {
            overflow: "auto",
          },
          ".cm-gutters": {
            paddingRight: "4px",
          },
          ".cm-lineNumbers .cm-gutterElement": {
            paddingLeft: "8px",
            paddingRight: "4px",
          },
          ".cm-content": {
            paddingLeft: "8px",
            paddingRight: "12px",
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [
    activeFileId,
    isTexFile,
    isLean,
    isMarkdown,
    terminalTheme,
    setContent,
    setCursorPosition,
    setSelectionRange,
  ]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !isTexFile) return;

    const content = activeFileContent ?? "";
    const currentContent = view.state.doc.toString();
    if (currentContent !== content) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: content,
        },
      });
    }
  }, [activeFileContent, isTexFile]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || jumpToPosition === null) return;
    if (isMarkdown) setMarkdownPreview(false);

    view.dispatch({
      selection: { anchor: jumpToPosition },
      effects: EditorView.scrollIntoView(jumpToPosition, { y: "center" }),
    });
    view.focus();
    clearJumpRequest();
  }, [jumpToPosition, clearJumpRequest, isMarkdown]);

  if (!isTexFile && activeFile) {
    const isImage = activeFile.type === "image";

    return (
      <div className="flex h-full flex-col bg-background">
        <EditorToolbar
          editorView={viewRef}
          fileType={isImage ? "image" : "binary"}
          imageScale={imageScale}
          onImageScaleChange={setImageScale}
        />
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {isImage ? (
            <ImagePreview file={activeFile} scale={imageScale} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center bg-muted/30 p-8 text-center">
              <FileIcon className="mb-3 size-10 text-muted-foreground/60" />
              <p className="font-medium text-sm">{activeFile.path}</p>
              <p className="mt-1 max-w-sm text-muted-foreground text-xs">
                This binary file is included when the project compiles, but it
                cannot be edited as text.
              </p>
            </div>
          )}
          <AIDrawer />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <EditorToolbar
        editorView={viewRef}
        fileKind={isLean ? "lean" : isMarkdown ? "markdown" : "latex"}
        markdownPreview={markdownPreview}
        markdownPreviewAvailable={markdownPreviewEnabled}
        onToggleMarkdownPreview={() => setMarkdownPreview((value) => !value)}
      />
      {isLatexKeyboardOpen && !isLean && !isMarkdown && (
        <TikzLatexRibbon scope="workspace" onInsert={insertFromKeyboard} />
      )}
      {isSearchOpen && (
        <SearchPanel
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onClose={() => {
            setIsSearchOpen(false);
            setSearchQuery("");
            viewRef.current?.focus();
          }}
          onFindNext={handleFindNext}
          onFindPrevious={handleFindPrevious}
          matchCount={matchCount}
          currentMatch={currentMatch}
        />
      )}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className={cn(
            "absolute inset-0",
            isMarkdown && markdownPreview && markdownPreviewEnabled && "hidden",
          )}
        >
          {stickyLines.length > 0 && (
            <div className="absolute inset-x-0 top-0 z-10 border-white/10 border-b bg-[#181715] font-mono text-[14px] leading-[1.4] shadow-md">
              {stickyLines.map((section) => (
                <div
                  key={section.line}
                  className="flex cursor-pointer items-center hover:bg-white/5"
                  onClick={() => {
                    const view = viewRef.current;
                    if (!view) return;
                    const line = view.state.doc.line(section.line);
                    view.dispatch({
                      selection: { anchor: line.from },
                      effects: EditorView.scrollIntoView(line.from, {
                        y: "start",
                      }),
                    });
                    view.focus();
                  }}
                >
                  <span
                    className="shrink-0 bg-[#181715] py-px text-right text-[#6c6a64]"
                    style={{ width: gutterWidth ? gutterWidth - 8 : 32 }}
                  >
                    {section.line}
                  </span>
                  {section.html ? (
                    <span
                      className="py-px pl-5.5"
                      dangerouslySetInnerHTML={{ __html: section.html }}
                    />
                  ) : (
                    <span className="py-px pl-5.5 text-[#a09d96]">
                      {section.content}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          <div ref={containerRef} className="absolute inset-0" />
        </div>
        {isMarkdown && markdownPreview && markdownPreviewEnabled && (
          <MarkdownPreview content={activeFileContent ?? ""} />
        )}
        <AIDrawer />
      </div>
    </div>
  );
}
