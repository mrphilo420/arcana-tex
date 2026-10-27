"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpenIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Columns2Icon,
  ExternalLinkIcon,
  FileTextIcon,
  ImageIcon,
  LayoutTemplateIcon,
  ListIcon,
  MonitorPlayIcon,
  PaletteIcon,
  PlayIcon,
  PlusIcon,
  PresentationIcon,
  SparklesIcon,
  TableIcon,
  WandSparklesIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  escapeBeamerText,
  getBeamerInfo,
  insertBeforeEndDocument,
  setBeamerCommand,
  setBeamerDocumentOption,
  setBeamerFlag,
  setBeamerPreambleCommand,
  setBeamerToggle,
  type BeamerFrame,
} from "@/lib/beamer";
import { useDocumentStore } from "@/stores/document-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const THEMES = [
  "default",
  "Madrid",
  "Berlin",
  "Boadilla",
  "CambridgeUS",
  "Copenhagen",
  "Darmstadt",
  "Dresden",
  "Frankfurt",
  "Goettingen",
  "Hannover",
  "Ilmenau",
  "JuanLesPins",
  "Luebeck",
  "Malmoe",
  "Marburg",
  "Montpellier",
  "PaloAlto",
  "Pittsburgh",
  "Rochester",
  "Singapore",
  "Szeged",
  "Warsaw",
  "AnnArbor",
  "Antibes",
  "Berkeley",
  "EastLansing",
];

const COLOR_THEMES = [
  "default",
  "beaver",
  "beetle",
  "crane",
  "dolphin",
  "dove",
  "fly",
  "lily",
  "orchid",
  "rose",
  "seahorse",
  "spruce",
  "whale",
  "wolverine",
];

const FONT_THEMES = [
  "default",
  "professionalfonts",
  "serif",
  "structurebold",
  "structureitalicserif",
  "structuresmallcapsserif",
];

const INNER_THEMES = [
  "default",
  "circles",
  "rectangles",
  "rounded",
  "inmargin",
];
const OUTER_THEMES = [
  "default",
  "infolines",
  "miniframes",
  "shadow",
  "sidebar",
  "smoothbars",
  "smoothtree",
  "split",
  "tree",
];

const ASPECT_RATIOS = [
  { value: "43", label: "4:3" },
  { value: "169", label: "16:9" },
  { value: "1610", label: "16:10" },
  { value: "149", label: "14:9" },
  { value: "54", label: "5:4" },
  { value: "32", label: "3:2" },
];

type BeamerTab = "slides" | "wizard" | "insert" | "theme" | "overlays";

const TABS: {
  id: BeamerTab;
  label: string;
  icon: typeof PresentationIcon;
}[] = [
  { id: "slides", label: "Slides", icon: MonitorPlayIcon },
  { id: "wizard", label: "Wizard", icon: WandSparklesIcon },
  { id: "insert", label: "Insert", icon: PlusIcon },
  { id: "theme", label: "Theme", icon: PaletteIcon },
  { id: "overlays", label: "Overlays", icon: PlayIcon },
];

const SLIDE_SNIPPETS: {
  name: string;
  description: string;
  snippet: string;
  icon: typeof PresentationIcon;
}[] = [
  {
    name: "Title slide",
    description: "\\titlepage with the current metadata",
    snippet: "\\begin{frame}\n  \\titlepage\n\\end{frame}\n",
    icon: PresentationIcon,
  },
  {
    name: "Section divider",
    description: "A section page after \\section",
    snippet:
      "\\section{Section title}\n\\begin{frame}\n  \\sectionpage\n\\end{frame}\n",
    icon: ListIcon,
  },
  {
    name: "Standard frame",
    description: "A titled frame ready for content",
    snippet: "\\begin{frame}{Frame title}\n  Content\n\\end{frame}\n",
    icon: LayoutTemplateIcon,
  },
  {
    name: "Theorem frame",
    description: "Theorem and proof environment",
    snippet:
      "\\begin{frame}{Theorem}\n  \\begin{theorem}\n    Statement.\n  \\end{theorem}\n  \\begin{proof}\n    Proof.\n  \\end{proof}\n\\end{frame}\n",
    icon: BookOpenIcon,
  },
  {
    name: "Two columns",
    description: "Balanced columns with a gutter",
    snippet:
      "\\begin{frame}{Two columns}\n  \\begin{columns}[T]\n    \\begin{column}{0.48\\textwidth}\n      Left content\n    \\end{column}\n    \\hfill\n    \\begin{column}{0.48\\textwidth}\n      Right content\n    \\end{column}\n  \\end{columns}\n\\end{frame}\n",
    icon: Columns2Icon,
  },
  {
    name: "Blocks",
    description: "block, alertblock, exampleblock",
    snippet:
      "\\begin{frame}{Blocks}\n  \\begin{block}{Block}\n    Content\n  \\end{block}\n  \\begin{alertblock}{Alert}\n    Important point\n  \\end{alertblock}\n  \\begin{exampleblock}{Example}\n    Example\n  \\end{exampleblock}\n\\end{frame}\n",
    icon: SparklesIcon,
  },
  {
    name: "Fragile code",
    description: "Frame with verbatim content",
    snippet:
      "\\begin{frame}[fragile]{Code}\n  \\begin{verbatim}\n    code here\n  \\end{verbatim}\n\\end{frame}\n",
    icon: FileTextIcon,
  },
  {
    name: "Figure frame",
    description: "Centered graphic with a caption",
    snippet:
      "\\begin{frame}{Figure}\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{figure.pdf}\n  \\caption{Caption}\n\\end{frame}\n",
    icon: ImageIcon,
  },
  {
    name: "Table frame",
    description: "A tabular block with a caption",
    snippet:
      "\\begin{frame}{Table}\n  \\centering\n  \\begin{tabular}{lcc}\n    \\hline\n    Item & A & B \\\\\n    \\hline\n    One & 1 & 2 \\\\\n    Two & 3 & 4 \\\\\n    \\hline\n  \\end{tabular}\n\\end{frame}\n",
    icon: TableIcon,
  },
  {
    name: "Notes",
    description: "Speaker note attached to a frame",
    snippet:
      "\\begin{frame}{Frame title}\n  Content\n  \\note{Speaker note.}\n\\end{frame}\n",
    icon: WandSparklesIcon,
  },
];

const OVERLAY_SNIPPETS: {
  label: string;
  title: string;
  before: string;
  after?: string;
}[] = [
  { label: "\\pause", title: "Pause", before: "\\pause\n" },
  {
    label: "<+->",
    title: "Incremental overlay",
    before:
      "\\begin{itemize}\n  \\item<+-> First\n  \\item<+-> Second\n\\end{itemize}\n",
  },
  {
    label: "\\only",
    title: "Only on slide 1",
    before: "\\only<1>{",
    after: "}",
  },
  {
    label: "\\uncover",
    title: "Uncover on slide 1",
    before: "\\uncover<1->{",
    after: "}",
  },
  {
    label: "\\visible",
    title: "Visible on slide 1",
    before: "\\visible<1->{",
    after: "}",
  },
  {
    label: "\\alert",
    title: "Alert overlay",
    before: "\\alert<1>{",
    after: "}",
  },
  {
    label: "\\onslide",
    title: "Onslide block",
    before: "\\onslide<1->{",
    after: "}",
  },
  {
    label: "\\item",
    title: "Overlay item",
    before: "\\item<1-> ",
  },
  {
    label: "\\transfade",
    title: "Fade transition",
    before: "\\transfade\n",
  },
  {
    label: "\\transdissolve",
    title: "Dissolve transition",
    before: "\\transdissolve\n",
  },
  {
    label: "\\transwipe",
    title: "Wipe transition",
    before: "\\transwipe\n",
  },
  {
    label: "\\againframe",
    title: "Repeat a frame",
    before: "\\againframe{frame-label}\n",
  },
];

function moveToFrame(
  frame: BeamerFrame,
  files: ReturnType<typeof useDocumentStore.getState>["files"],
  setActiveFile: (id: string) => void,
  requestJump: (position: number) => void,
) {
  const file = files.find((candidate) => candidate.id === frame.fileId);
  if (!file || file.type !== "tex") return;

  const lines = (file.content ?? "").split("\n");
  let position = 0;
  for (let index = 0; index < frame.line - 1; index++) {
    position += (lines[index]?.length ?? 0) + 1;
  }

  setActiveFile(file.id);
  requestJump(position);
}

function SettingSelect({
  label,
  value,
  options,
  optionLabels,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  optionLabels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          size="sm"
          className="h-7 w-[170px] text-[10px]"
          aria-label={label}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option} className="text-xs">
              {optionLabels?.[option] ?? option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function BeamerPanel() {
  const open = useDocumentStore((s) => s.isBeamerOpen);
  const setOpen = useDocumentStore((s) => s.setBeamerOpen);
  const files = useDocumentStore((s) => s.files);
  const mainFileId = useDocumentStore((s) => s.mainFileId);
  const setActiveFile = useDocumentStore((s) => s.setActiveFile);
  const requestJump = useDocumentStore((s) => s.requestJumpToPosition);
  const updateFileContent = useDocumentStore((s) => s.updateFileContent);
  const requestCompile = useDocumentStore((s) => s.requestCompile);

  const [tab, setTab] = useState<BeamerTab>("slides");
  const info = useMemo(
    () => getBeamerInfo(files, mainFileId),
    [files, mainFileId],
  );

  const [theme, setTheme] = useState(info.theme);
  const [colorTheme, setColorTheme] = useState(info.colorTheme);
  const [fontTheme, setFontTheme] = useState(info.fontTheme);
  const [innerTheme, setInnerTheme] = useState(info.innerTheme);
  const [outerTheme, setOuterTheme] = useState(info.outerTheme);
  const [aspectRatio, setAspectRatio] = useState(info.aspectRatio);
  const [navigationSymbols, setNavigationSymbols] = useState(
    info.navigationSymbols,
  );
  const [frameNumbers, setFrameNumbers] = useState(info.frameNumbers);
  const [transparentCovered, setTransparentCovered] = useState(
    info.transparentCovered,
  );
  const [showNotes, setShowNotes] = useState(info.showNotes);
  const [handout, setHandout] = useState(info.handout);

  const [wizardStep, setWizardStep] = useState(0);
  const [deckTitle, setDeckTitle] = useState("");
  const [deckSubtitle, setDeckSubtitle] = useState("");
  const [deckAuthor, setDeckAuthor] = useState("");
  const [deckInstitute, setDeckInstitute] = useState("");
  const [deckDate, setDeckDate] = useState("\\today");
  const [deckSections, setDeckSections] = useState(
    "Introduction\nMethods\nResults\nConclusion",
  );
  const [includeTitleSlide, setIncludeTitleSlide] = useState(true);
  const [includeOutline, setIncludeOutline] = useState(true);
  const [includeThanks, setIncludeThanks] = useState(true);
  const [starterStyle, setStarterStyle] = useState<
    "bullets" | "theorem" | "blank"
  >("bullets");
  const [wizardTheme, setWizardTheme] = useState(info.theme);
  const [wizardAspect, setWizardAspect] = useState(info.aspectRatio);

  useEffect(() => {
    if (!open) return;
    setWizardStep(0);
    const content = info.mainFile?.content ?? "";
    setDeckTitle(
      content.match(/\\title\s*\{([^}]*)\}/)?.[1] ?? "Research presentation",
    );
    setDeckSubtitle(content.match(/\\subtitle\s*\{([^}]*)\}/)?.[1] ?? "");
    setDeckAuthor(content.match(/\\author\s*\{([^}]*)\}/)?.[1] ?? "");
    setDeckInstitute(content.match(/\\institute\s*\{([^}]*)\}/)?.[1] ?? "");
    setDeckDate(content.match(/\\date\s*\{([^}]*)\}/)?.[1] ?? "\\today");
    const sections = [...content.matchAll(/\\section\s*\{([^}]*)\}/g)].map(
      (match) => match[1]?.trim() ?? "",
    );
    setDeckSections(
      sections.filter(Boolean).join("\n") ||
        "Introduction\nMethods\nResults\nConclusion",
    );
    setWizardTheme(info.theme);
    setWizardAspect(info.aspectRatio);
  }, [open, info]);

  useEffect(() => {
    if (open && !info.isBeamer) setOpen(false);
  }, [info.isBeamer, open, setOpen]);

  useEffect(() => {
    if (!open) return;
    setTheme(info.theme);
    setColorTheme(info.colorTheme);
    setFontTheme(info.fontTheme);
    setInnerTheme(info.innerTheme);
    setOuterTheme(info.outerTheme);
    setAspectRatio(info.aspectRatio);
    setNavigationSymbols(info.navigationSymbols);
    setFrameNumbers(info.frameNumbers);
    setTransparentCovered(info.transparentCovered);
    setShowNotes(info.showNotes);
    setHandout(info.handout);
  }, [open, info]);

  const wizardBody = useMemo(() => {
    const sections = deckSections
      .split("\n")
      .map((section) => section.trim())
      .filter(Boolean);
    const frames: string[] = [];

    if (includeTitleSlide) {
      frames.push("\\begin{frame}\n  \\titlepage\n\\end{frame}");
    }
    if (includeOutline) {
      frames.push("\\begin{frame}{Outline}\n  \\tableofcontents\n\\end{frame}");
    }

    for (const section of sections) {
      const title = escapeBeamerText(section);
      frames.push(`\\section{${title}}`);
      frames.push(
        [
          `\\begin{frame}{${title}}`,
          starterStyle === "theorem"
            ? "  \\begin{theorem}\n    Statement.\n  \\end{theorem}"
            : starterStyle === "blank"
              ? "  "
              : "  \\begin{itemize}\n    \\item Key point\n    \\item Evidence\n  \\end{itemize}",
          "\\end{frame}",
        ].join("\n"),
      );
    }

    if (includeThanks) {
      frames.push(
        "\\begin{frame}{Thank you}\n  \\centering\n  Questions and discussion\n\\end{frame}",
      );
    }

    return frames.join("\n\n");
  }, [
    deckSections,
    includeOutline,
    includeThanks,
    includeTitleSlide,
    starterStyle,
  ]);

  const wizardPreamble = [
    `\\title{${escapeBeamerText(deckTitle)}}`,
    deckSubtitle ? `\\subtitle{${escapeBeamerText(deckSubtitle)}}` : "",
    deckAuthor ? `\\author{${escapeBeamerText(deckAuthor)}}` : "",
    deckInstitute ? `\\institute{${escapeBeamerText(deckInstitute)}}` : "",
    deckDate ? `\\date{${deckDate}}` : "",
    `\\usetheme{${wizardTheme}}`,
    `% aspect ratio: ${wizardAspect}`,
  ]
    .filter(Boolean)
    .join("\n");

  const applyWizard = () => {
    if (!info.mainFile || info.mainFile.type !== "tex") {
      toast.error("No Beamer main file to update");
      return;
    }

    let content = info.mainFile.content ?? "";
    content = setBeamerPreambleCommand(content, "title", deckTitle);
    if (deckSubtitle) {
      content = setBeamerPreambleCommand(content, "subtitle", deckSubtitle);
    }
    if (deckAuthor) {
      content = setBeamerPreambleCommand(content, "author", deckAuthor);
    }
    if (deckInstitute) {
      content = setBeamerPreambleCommand(content, "institute", deckInstitute);
    }
    content = setBeamerPreambleCommand(content, "date", deckDate);
    content = setBeamerCommand(content, "usetheme", wizardTheme);
    content = setBeamerDocumentOption(content, "aspectratio", wizardAspect);
    content = insertBeforeEndDocument(content, wizardBody);

    updateFileContent(info.mainFile.id, content);
    requestCompile();
    setTheme(wizardTheme);
    setAspectRatio(wizardAspect);
    setTab("slides");
    setWizardStep(0);
    toast.success("Beamer wizard applied", {
      description: "Metadata and starter frames were added to the deck.",
    });
  };

  const updateMain = (updater: (content: string) => string) => {
    if (!info.mainFile || info.mainFile.type !== "tex") return;
    const next = updater(info.mainFile.content ?? "");
    if (next === info.mainFile.content) return;
    updateFileContent(info.mainFile.id, next);
    requestCompile();
  };

  const insertSnippet = (text: string) => {
    const state = useDocumentStore.getState();
    const file = state.files.find(
      (candidate) => candidate.id === state.activeFileId,
    );
    if (!file || file.type !== "tex") {
      toast.error("Open a .tex file first");
      return;
    }

    const content = file.content ?? "";
    let position = state.cursorPosition;
    const beginDocument = content.indexOf("\\begin{document}");
    if (beginDocument !== -1 && position <= beginDocument) {
      position = beginDocument + "\\begin{document}".length;
    }

    // Whole-frame snippets should not be inserted inside another frame.
    if (text.includes("\\begin{frame}")) {
      const frameStart = content.lastIndexOf("\\begin{frame}", position);
      const frameEnd = content.indexOf("\\end{frame}", position);
      if (frameStart !== -1 && frameEnd !== -1 && frameStart < position) {
        position = frameEnd + "\\end{frame}".length;
      }
    }

    state.replaceSelection(position, position, `\n${text}`);
    state.requestJumpToPosition(position + 1);
  };

  const wrapSnippet = (before: string, after: string) => {
    const state = useDocumentStore.getState();
    const file = state.files.find(
      (candidate) => candidate.id === state.activeFileId,
    );
    if (!file || file.type !== "tex") {
      toast.error("Open a .tex file first");
      return;
    }

    const selection = state.selectionRange;
    const content = file.content ?? "";
    if (selection) {
      const selected = content.slice(selection.start, selection.end);
      state.replaceSelection(
        selection.start,
        selection.end,
        `${before}${selected}${after}`,
      );
      return;
    }

    insertSnippet(`${before}${after}`);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen} modal={false}>
      <SheetContent
        overlay={false}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[500px]"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="border-hairline border-b px-4 py-3 pr-12">
          <SheetTitle className="flex items-center gap-2 text-base">
            <PresentationIcon className="size-4 text-primary" />
            Beamer companion
          </SheetTitle>
          <SheetDescription className="text-xs">
            Detected a Beamer project. Themes, frames, overlays, and notes stay
            in the document.
          </SheetDescription>
        </SheetHeader>

        <div className="flex shrink-0 items-center gap-0 overflow-x-auto border-hairline border-b px-2">
          {TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "relative flex h-10 shrink-0 items-center gap-1.5 px-2.5 text-[11px] transition-colors",
                  tab === item.id
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setTab(item.id)}
              >
                <Icon className="size-3.5" />
                {item.label}
                {item.id === "slides" && (
                  <span className="font-mono text-[9px] text-muted-foreground">
                    {info.frames.length}
                  </span>
                )}
                {tab === item.id && (
                  <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "slides" && (
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-sm">Slide navigator</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {info.frames.length} frame
                    {info.frames.length === 1 ? "" : "s"} detected
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTab("wizard")}
                  >
                    <WandSparklesIcon className="size-3.5" />
                    Wizard
                  </Button>
                  <Button size="sm" onClick={() => setTab("insert")}>
                    <PlusIcon className="size-3.5" />
                    Add frame
                  </Button>
                </div>
              </div>

              {info.frames.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <MonitorPlayIcon className="mx-auto mb-2 size-7 text-muted-foreground/50" />
                  <p className="font-medium text-sm">No frames yet</p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    Add a title slide or a standard frame from the Insert tab.
                  </p>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() => setTab("insert")}
                  >
                    <PlusIcon className="size-3.5" />
                    Insert first frame
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {info.frames.map((frame) => (
                    <button
                      key={`${frame.fileId}-${frame.start}`}
                      type="button"
                      className="w-full rounded-lg border border-hairline bg-card/35 p-3 text-left transition-colors hover:border-primary/35 hover:bg-card/60"
                      onClick={() =>
                        moveToFrame(frame, files, setActiveFile, requestJump)
                      }
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-hairline bg-background font-mono text-[9px] text-muted-foreground">
                          {frame.index}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-[12px]">
                            {frame.title}
                          </div>
                          {frame.subtitle && (
                            <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                              {frame.subtitle}
                            </div>
                          )}
                          <div className="mt-1 truncate font-mono text-[9px] text-muted-foreground">
                            {frame.filePath}:{frame.line}
                            {frame.options ? ` · [${frame.options}]` : ""}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="rounded-lg border border-hairline bg-background/60 p-3 text-[10px] text-muted-foreground leading-relaxed">
                Frame titles, section pages, and Beamer navigation are read
                directly from the source. Click a slide to jump to it.
              </div>
            </div>
          )}

          {tab === "wizard" && (
            <div className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-sm">
                    <WandSparklesIcon className="size-4 text-primary" />
                    Beamer wizard
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">
                    Build a presentation outline from metadata, sections, and a
                    starter slide style.
                  </p>
                </div>
                <span className="font-mono text-[9px] text-muted-foreground">
                  {wizardStep + 1}/3
                </span>
              </div>

              <div className="flex items-center gap-1">
                {["Deck", "Frames", "Review"].map((label, index) => (
                  <div key={label} className="flex flex-1 items-center gap-1">
                    <span
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full border text-[9px]",
                        index < wizardStep
                          ? "border-primary bg-primary text-primary-foreground"
                          : index === wizardStep
                            ? "border-primary text-primary"
                            : "border-hairline text-muted-foreground",
                      )}
                    >
                      {index < wizardStep ? (
                        <CheckIcon className="size-3" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-[9px] uppercase tracking-[0.12em]",
                        index === wizardStep
                          ? "text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {label}
                    </span>
                    {index < 2 && <span className="h-px flex-1 bg-border" />}
                  </div>
                ))}
              </div>

              {wizardStep === 0 && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <span className="font-medium text-[9px] text-muted-foreground uppercase tracking-[0.14em]">
                      Title
                    </span>
                    <Input
                      value={deckTitle}
                      onChange={(event) => setDeckTitle(event.target.value)}
                      placeholder="Research presentation"
                      aria-label="Presentation title"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="font-medium text-[9px] text-muted-foreground uppercase tracking-[0.14em]">
                      Subtitle
                    </span>
                    <Input
                      value={deckSubtitle}
                      onChange={(event) => setDeckSubtitle(event.target.value)}
                      placeholder="Optional subtitle"
                      aria-label="Presentation subtitle"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="font-medium text-[9px] text-muted-foreground uppercase tracking-[0.14em]">
                        Author
                      </span>
                      <Input
                        value={deckAuthor}
                        onChange={(event) => setDeckAuthor(event.target.value)}
                        placeholder="Author"
                        aria-label="Presentation author"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="font-medium text-[9px] text-muted-foreground uppercase tracking-[0.14em]">
                        Institute
                      </span>
                      <Input
                        value={deckInstitute}
                        onChange={(event) =>
                          setDeckInstitute(event.target.value)
                        }
                        placeholder="Institute"
                        aria-label="Presentation institute"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="font-medium text-[9px] text-muted-foreground uppercase tracking-[0.14em]">
                      Date
                    </span>
                    <Input
                      value={deckDate}
                      onChange={(event) => setDeckDate(event.target.value)}
                      placeholder="\\today"
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                  <div className="divide-y divide-hairline rounded-lg border border-hairline bg-card/30 px-3">
                    <SettingSelect
                      label="Starter theme"
                      value={wizardTheme}
                      options={THEMES}
                      onChange={setWizardTheme}
                    />
                    <SettingSelect
                      label="Aspect ratio"
                      value={wizardAspect}
                      options={ASPECT_RATIOS.map((option) => option.value)}
                      optionLabels={Object.fromEntries(
                        ASPECT_RATIOS.map((option) => [
                          option.value,
                          option.label,
                        ]),
                      )}
                      onChange={setWizardAspect}
                    />
                  </div>
                </div>
              )}

              {wizardStep === 1 && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <span className="font-medium text-[9px] text-muted-foreground uppercase tracking-[0.14em]">
                      Sections · one per line
                    </span>
                    <Textarea
                      value={deckSections}
                      onChange={(event) => setDeckSections(event.target.value)}
                      rows={6}
                      aria-label="Presentation sections"
                      className="min-h-28 resize-y text-xs"
                    />
                  </div>
                  <div className="space-y-1.5 rounded-lg border border-hairline bg-card/30 p-3">
                    {[
                      {
                        label: "Title slide",
                        checked: includeTitleSlide,
                        onChange: setIncludeTitleSlide,
                      },
                      {
                        label: "Outline slide",
                        checked: includeOutline,
                        onChange: setIncludeOutline,
                      },
                      {
                        label: "Thank-you slide",
                        checked: includeThanks,
                        onChange: setIncludeThanks,
                      },
                    ].map((item) => (
                      <label
                        key={item.label}
                        className="flex cursor-pointer items-center gap-2 text-[11px]"
                      >
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={(event) =>
                            item.onChange(event.target.checked)
                          }
                          className="accent-primary"
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                  <div>
                    <span className="font-medium text-[9px] text-muted-foreground uppercase tracking-[0.14em]">
                      Starter frame style
                    </span>
                    <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                      {[
                        ["bullets", "Bullets"],
                        ["theorem", "Theorem"],
                        ["blank", "Blank"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          className={cn(
                            "rounded border px-2 py-1.5 text-[10px] transition-colors",
                            starterStyle === value
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-hairline text-muted-foreground hover:bg-background",
                          )}
                          onClick={() =>
                            setStarterStyle(
                              value as "bullets" | "theorem" | "blank",
                            )
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-hairline bg-card/30 p-3">
                    <div className="font-medium text-xs">
                      {deckTitle || "Untitled presentation"}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {
                        deckSections
                          .split("\n")
                          .filter((section) => section.trim()).length
                      }{" "}
                      sections · {wizardTheme} theme ·{" "}
                      {ASPECT_RATIOS.find(
                        (option) => option.value === wizardAspect,
                      )?.label ?? wizardAspect}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 font-medium text-[9px] text-muted-foreground uppercase tracking-[0.14em]">
                      Preview · appended before \end{"{document}"}
                    </div>
                    <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-dark p-3 font-mono text-[9px] text-on-dark-soft leading-relaxed">
                      {wizardPreamble}
                      {"\n\n... existing slides ...\n\n"}
                      {wizardBody}
                    </pre>
                  </div>
                  <p className="text-[9px] text-muted-foreground leading-relaxed">
                    This updates the title metadata, theme, and aspect ratio,
                    then appends the new frames. Existing slides are preserved.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between border-hairline border-t pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={wizardStep === 0}
                  onClick={() => setWizardStep((step) => Math.max(0, step - 1))}
                >
                  <ChevronLeftIcon className="size-3.5" />
                  Back
                </Button>
                {wizardStep < 2 ? (
                  <Button
                    size="sm"
                    onClick={() =>
                      setWizardStep((step) => Math.min(2, step + 1))
                    }
                  >
                    Next
                    <ChevronRightIcon className="size-3.5" />
                  </Button>
                ) : (
                  <Button size="sm" onClick={applyWizard}>
                    <CheckIcon className="size-3.5" />
                    Apply wizard
                  </Button>
                )}
              </div>
            </div>
          )}

          {tab === "insert" && (
            <div className="space-y-4 p-4">
              <div>
                <h3 className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
                  Slide templates
                </h3>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {SLIDE_SNIPPETS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        className="rounded-lg border border-hairline bg-card/35 p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-card/60"
                        onClick={() => insertSnippet(item.snippet)}
                      >
                        <Icon className="mb-1.5 size-3.5 text-primary" />
                        <div className="font-medium text-[11px]">
                          {item.name}
                        </div>
                        <div className="mt-0.5 line-clamp-2 text-[9px] text-muted-foreground leading-relaxed">
                          {item.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
                  Structure
                </h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    ["\\section", "\\section{Section title}\n"],
                    ["\\subsection", "\\subsection{Subsection title}\n"],
                    ["\\appendix", "\\appendix\n"],
                    [
                      "plain frame",
                      "\\begin{frame}[plain]\n  \n\\end{frame}\n",
                    ],
                    ["fragile", "\\begin{frame}[fragile]\n  \n\\end{frame}\n"],
                    ["againframe", "\\againframe{frame-label}\n"],
                  ].map(([label, snippet]) => (
                    <button
                      key={label}
                      type="button"
                      className="rounded border border-hairline bg-background px-2 py-1 font-mono text-[9px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                      onClick={() => insertSnippet(snippet)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-hairline bg-card/30 p-3 text-[10px] text-muted-foreground leading-relaxed">
                Snippets are inserted at the cursor. If the cursor is in the
                preamble, they are placed after{" "}
                <code className="font-mono">\begin{"{document}"}</code>.
              </div>
            </div>
          )}

          {tab === "theme" && (
            <div className="space-y-5 p-4">
              <div>
                <h3 className="mb-2 font-medium text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
                  Theme family
                </h3>
                <div className="divide-y divide-hairline rounded-lg border border-hairline bg-card/30 px-3">
                  <SettingSelect
                    label="Beamer theme"
                    value={theme}
                    options={THEMES}
                    onChange={(value) => {
                      setTheme(value);
                      updateMain((content) =>
                        setBeamerCommand(content, "usetheme", value),
                      );
                    }}
                  />
                  <SettingSelect
                    label="Color theme"
                    value={colorTheme}
                    options={COLOR_THEMES}
                    onChange={(value) => {
                      setColorTheme(value);
                      updateMain((content) =>
                        setBeamerCommand(content, "usecolortheme", value),
                      );
                    }}
                  />
                  <SettingSelect
                    label="Font theme"
                    value={fontTheme}
                    options={FONT_THEMES}
                    onChange={(value) => {
                      setFontTheme(value);
                      updateMain((content) =>
                        setBeamerCommand(content, "usefonttheme", value),
                      );
                    }}
                  />
                  <SettingSelect
                    label="Inner theme"
                    value={innerTheme}
                    options={INNER_THEMES}
                    onChange={(value) => {
                      setInnerTheme(value);
                      updateMain((content) =>
                        setBeamerCommand(content, "useinnertheme", value),
                      );
                    }}
                  />
                  <SettingSelect
                    label="Outer theme"
                    value={outerTheme}
                    options={OUTER_THEMES}
                    onChange={(value) => {
                      setOuterTheme(value);
                      updateMain((content) =>
                        setBeamerCommand(content, "useoutertheme", value),
                      );
                    }}
                  />
                  <SettingSelect
                    label="Aspect ratio"
                    value={aspectRatio}
                    options={ASPECT_RATIOS.map((option) => option.value)}
                    optionLabels={Object.fromEntries(
                      ASPECT_RATIOS.map((option) => [
                        option.value,
                        option.label,
                      ]),
                    )}
                    onChange={(value) => {
                      setAspectRatio(value);
                      updateMain((content) =>
                        setBeamerDocumentOption(content, "aspectratio", value),
                      );
                    }}
                  />
                </div>
                <p className="mt-1.5 text-[9px] text-muted-foreground">
                  Changes are written to the main Beamer file and recompiled.
                </p>
              </div>

              <div>
                <h3 className="mb-2 font-medium text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
                  Presentation defaults
                </h3>
                <div className="space-y-1.5 rounded-lg border border-hairline bg-card/30 p-3">
                  {[
                    {
                      label: "Navigation symbols",
                      checked: navigationSymbols,
                      onChange: (value: boolean) => {
                        setNavigationSymbols(value);
                        updateMain((content) =>
                          setBeamerToggle(content, "navigationSymbols", !value),
                        );
                      },
                    },
                    {
                      label: "Frame numbers in footline",
                      checked: frameNumbers,
                      onChange: (value: boolean) => {
                        setFrameNumbers(value);
                        updateMain((content) =>
                          setBeamerToggle(content, "frameNumbers", value),
                        );
                      },
                    },
                    {
                      label: "Transparent covered content",
                      checked: transparentCovered,
                      onChange: (value: boolean) => {
                        setTransparentCovered(value);
                        updateMain((content) =>
                          setBeamerToggle(content, "transparentCovered", value),
                        );
                      },
                    },
                    {
                      label: "Show speaker notes",
                      checked: showNotes,
                      onChange: (value: boolean) => {
                        setShowNotes(value);
                        updateMain((content) =>
                          setBeamerToggle(content, "showNotes", value),
                        );
                      },
                    },
                    {
                      label: "Handout mode",
                      checked: handout,
                      onChange: (value: boolean) => {
                        setHandout(value);
                        updateMain((content) =>
                          setBeamerFlag(content, "handout", value),
                        );
                      },
                    },
                  ].map((item) => (
                    <label
                      key={item.label}
                      className="flex cursor-pointer items-center gap-2 py-0.5 text-[11px]"
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(event) =>
                          item.onChange(event.target.checked)
                        }
                        className="accent-primary"
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-hairline bg-background/60 p-3">
                <div className="text-[10px] text-muted-foreground">
                  Beamer documentation and examples
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href="https://www.beamer.plus/home.html"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLinkIcon className="size-3.5" />
                    beamer.plus
                  </a>
                </Button>
              </div>
            </div>
          )}

          {tab === "overlays" && (
            <div className="space-y-5 p-4">
              <div>
                <h3 className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
                  Overlay commands
                </h3>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {OVERLAY_SNIPPETS.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className="rounded-lg border border-hairline bg-card/35 p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-card/60"
                      onClick={() => {
                        if (item.after) {
                          wrapSnippet(item.before, item.after);
                        } else {
                          insertSnippet(item.before);
                        }
                      }}
                    >
                      <div className="font-mono text-[10px]">{item.label}</div>
                      <div className="mt-0.5 text-[9px] text-muted-foreground">
                        {item.title}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
                  Reveal helpers
                </h3>
                <div className="mt-2 space-y-1.5 rounded-lg border border-hairline bg-card/30 p-3 text-[10px] text-muted-foreground leading-relaxed">
                  <p>
                    Select text first, then click <code>\only</code>,{" "}
                    <code>\uncover</code>, or <code>\alert</code> to wrap it.
                  </p>
                  <p>
                    Use <code>{"\\item<+->"}</code> for one-at-a-time lists and{" "}
                    <code>{"\\pause"}</code> for simple reveals.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
                  Notes and transitions
                </h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    ["\\note{}", "\\note{Speaker note.}\n"],
                    ["\\transfade", "\\transfade\n"],
                    ["\\transdissolve", "\\transdissolve\n"],
                    ["\\transwipe", "\\transwipe\n"],
                    ["show notes", "\\setbeameroption{show notes}\n"],
                  ].map(([label, snippet]) => (
                    <button
                      key={label}
                      type="button"
                      className="rounded border border-hairline bg-background px-2 py-1 font-mono text-[9px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      onClick={() => insertSnippet(snippet)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between border-hairline border-t px-4 py-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <PresentationIcon className="size-3" />
            {info.mainFile?.path ?? "No Beamer file"}
          </span>
          <a
            href="https://www.beamer.plus/home.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground"
          >
            Beamer manual
            <ExternalLinkIcon className="size-3" />
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
