"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangleIcon,
  BotIcon,
  CheckCircle2Icon,
  ClipboardCopyIcon,
  DownloadIcon,
  FlaskConicalIcon,
  FolderGit2Icon,
  HardDriveIcon,
  Loader2Icon,
  PaletteIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  ServerIcon,
  Settings2Icon,
  ShieldAlertIcon,
  TerminalIcon,
  TypeIcon,
  WrenchIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_DEV_FEATURE_FLAGS,
  DEV_FEATURE_FLAGS,
  DEV_FLAGS_STORAGE_KEY,
  DEV_PANEL_ENABLED,
  type DevFeatureFlag,
  type DevFeatureFlags,
  normalizeDevFeatureFlags,
} from "@/lib/dev-panel";
import { GROQ_CHAT_MODELS, getGroqModel } from "@/lib/chat-models";
import { TERMINAL_THEMES } from "@/lib/editor-theme";
import { FONT_PAIRINGS } from "@/lib/font-pairings";
import { TEXT_SCALES } from "@/lib/text-scale";
import { LEAN_PROJECT_STORAGE_KEY } from "@/lib/lean";
import { cn } from "@/lib/utils";
import { useChatModelStore } from "@/stores/chat-model-store";
import { type DevPanelTab, useDevPanelStore } from "@/stores/dev-panel-store";
import { useDocumentStore } from "@/stores/document-store";
import { useEditorPreferencesStore } from "@/stores/editor-preferences-store";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const TABS: { id: DevPanelTab; label: string; icon: typeof WrenchIcon }[] = [
  { id: "features", label: "Features", icon: FlaskConicalIcon },
  { id: "workspace", label: "Workspace", icon: Settings2Icon },
  { id: "bridge", label: "Bridge", icon: ServerIcon },
  { id: "data", label: "Local data", icon: HardDriveIcon },
];

function persistFlags(flags: DevFeatureFlags) {
  void fetch("/api/dev/panel", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(flags),
  }).catch(() => {
    toast.error("Could not write .dev-panel.local.json");
  });
}

function FeatureToggle({
  feature,
  checked,
  onChange,
}: {
  feature: (typeof DEV_FEATURE_FLAGS)[number];
  checked: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-hairline bg-card/25 p-3">
      <div className="min-w-0">
        <div className="font-medium text-[0.8125rem]">{feature.label}</div>
        <p className="mt-0.5 text-[0.75rem] text-muted-foreground leading-relaxed">
          {feature.description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`Toggle ${feature.label}`}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors",
          checked ? "border-primary bg-primary" : "border-hairline bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-3.5 rounded-full bg-background shadow-sm transition-transform",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

export function DevPanel() {
  const isOpen = useDevPanelStore((s) => s.isOpen);
  const setOpen = useDevPanelStore((s) => s.setOpen);
  const activeTab = useDevPanelStore((s) => s.activeTab);
  const setActiveTab = useDevPanelStore((s) => s.setActiveTab);
  const flags = useDevPanelStore((s) => s.flags);
  const setFlag = useDevPanelStore((s) => s.setFlag);
  const resetFlags = useDevPanelStore((s) => s.resetFlags);
  const terminalThemeId = useEditorPreferencesStore((s) => s.terminalThemeId);
  const setTerminalThemeId = useEditorPreferencesStore(
    (s) => s.setTerminalThemeId,
  );
  const fontPairingId = useEditorPreferencesStore((s) => s.fontPairingId);
  const setFontPairingId = useEditorPreferencesStore((s) => s.setFontPairingId);
  const textScaleId = useEditorPreferencesStore((s) => s.textScaleId);
  const setTextScaleId = useEditorPreferencesStore((s) => s.setTextScaleId);
  const selectedModelId = useChatModelStore((s) => s.selectedModelId);
  const setSelectedModelId = useChatModelStore((s) => s.setSelectedModelId);
  const selectedModel = getGroqModel(selectedModelId);

  const projectId = useDocumentStore((s) => s.projectId);
  const projectName = useDocumentStore((s) => s.projectName);
  const files = useDocumentStore((s) => s.files);
  const mainFileId = useDocumentStore((s) => s.mainFileId);
  const activeFileId = useDocumentStore((s) => s.activeFileId);
  const compiler = useDocumentStore((s) => s.compiler);
  const autoCompile = useDocumentStore((s) => s.autoCompile);
  const isCompiling = useDocumentStore((s) => s.isCompiling);
  const compileError = useDocumentStore((s) => s.compileError);
  const compileDiagnostics = useDocumentStore((s) => s.compileDiagnostics);
  const comments = useDocumentStore((s) => s.comments);
  const isHydrated = useDocumentStore((s) => s.isHydrated);
  const initialized = useDocumentStore((s) => s.initialized);

  const [bridgeResult, setBridgeResult] = useState<string | null>(null);
  const [isCheckingBridge, setIsCheckingBridge] = useState(false);
  const [storageEntries, setStorageEntries] = useState<
    { key: string; size: number }[]
  >([]);

  const mainFile = files.find((file) => file.id === mainFileId);
  const activeFile = files.find((file) => file.id === activeFileId);
  const errorCount = compileDiagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;
  const warningCount = compileDiagnostics.filter(
    (diagnostic) => diagnostic.severity === "warning",
  ).length;

  const refreshStorage = useCallback(() => {
    if (typeof window === "undefined") return;
    const entries = Object.keys(window.localStorage)
      .filter((key) => key.startsWith("open-prism"))
      .sort()
      .map((key) => ({
        key,
        size: (window.localStorage.getItem(key) ?? "").length,
      }));
    setStorageEntries(entries);
  }, []);

  useEffect(() => {
    if (!DEV_PANEL_ENABLED) return;
    useDevPanelStore.getState().hydrate();
    void fetch("/api/dev/panel", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.flags) {
          useDevPanelStore
            .getState()
            .setFlags(normalizeDevFeatureFlags(data.flags));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!DEV_PANEL_ENABLED) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "d"
      ) {
        event.preventDefault();
        const store = useDevPanelStore.getState();
        store.setOpen(!store.isOpen);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (activeTab === "data") refreshStorage();
  }, [activeTab, refreshStorage]);

  const updateFlag = (flag: DevFeatureFlag, enabled: boolean) => {
    const next = { ...useDevPanelStore.getState().flags, [flag]: enabled };
    setFlag(flag, enabled);
    persistFlags(next);
  };

  const saveDefaults = () => {
    resetFlags();
    persistFlags(DEFAULT_DEV_FEATURE_FLAGS);
    toast.success("Developer flags reset");
  };

  const snapshot = {
    exportedAt: new Date().toISOString(),
    project: {
      id: projectId,
      name: projectName,
      initialized,
      hydrated: isHydrated,
      compiler,
      mainFile: mainFile?.path ?? null,
      activeFile: activeFile?.path ?? null,
      autoCompile,
      isCompiling,
      compileError,
      diagnostics: compileDiagnostics.length,
      comments: comments.length,
    },
    files,
    flags,
  };

  const copySnapshot = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      toast.success("Workspace snapshot copied");
    } catch {
      toast.error("Could not copy the workspace snapshot");
    }
  };

  const downloadSnapshot = () => {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `arcanatex-dev-${projectName.replace(/[^a-z0-9]+/gi, "-") || "workspace"}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success("Workspace snapshot downloaded");
  };

  const checkBridge = async () => {
    setIsCheckingBridge(true);
    setBridgeResult(null);
    try {
      const projectPath =
        typeof window !== "undefined"
          ? window.localStorage.getItem(LEAN_PROJECT_STORAGE_KEY)
          : null;
      const statusUrl = projectPath
        ? `/api/lean/status?path=${encodeURIComponent(projectPath)}`
        : "/api/lean/status";
      const [statusResponse, projectsResponse, toolchainsResponse] =
        await Promise.all([
          fetch(statusUrl, { cache: "no-store" }),
          fetch("/api/lean/projects", { cache: "no-store" }),
          fetch("/api/lean/toolchains", { cache: "no-store" }),
        ]);
      const result = {
        status: {
          ok: statusResponse.ok,
          body: await statusResponse.json().catch(() => null),
        },
        projects: {
          ok: projectsResponse.ok,
          body: await projectsResponse.json().catch(() => null),
        },
        toolchains: {
          ok: toolchainsResponse.ok,
          body: await toolchainsResponse.json().catch(() => null),
        },
      };
      setBridgeResult(JSON.stringify(result, null, 2));
    } catch (error) {
      setBridgeResult(
        error instanceof Error ? error.message : "Could not reach the bridge",
      );
    } finally {
      setIsCheckingBridge(false);
    }
  };

  if (!DEV_PANEL_ENABLED) return null;

  return (
    <Sheet open={isOpen} onOpenChange={setOpen} modal={false}>
      <SheetContent
        overlay={false}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[600px]"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader className="border-hairline border-b px-4 py-3 pr-12">
          <SheetTitle className="flex items-center gap-2 text-base">
            <FlaskConicalIcon className="size-4 text-primary" />
            Developer control panel
            <span className="rounded border border-[#5db8a6]/30 bg-[#5db8a6]/10 px-1.5 py-0.5 font-mono text-[#2a8f83] text-[0.625rem] uppercase tracking-[0.12em]">
              local only
            </span>
          </SheetTitle>
          <SheetDescription className="text-xs">
            Experiment with feature flags and inspect local state. Changes are
            stored in <code>.dev-panel.local.json</code> and this browser.
          </SheetDescription>
        </SheetHeader>

        <div className="flex shrink-0 gap-1 border-hairline border-b px-3 py-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.75rem] transition-colors",
                  activeTab === tab.id
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {activeTab === "features" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-sm">Feature flags</h3>
                  <p className="mt-1 text-[0.75rem] text-muted-foreground">
                    Toggle features in this development session. Production
                    builds always use the shipped defaults.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={saveDefaults}
                  className="shrink-0 text-[0.75rem]"
                >
                  <RotateCcwIcon className="size-3.5" />
                  Reset
                </Button>
              </div>

              {DEV_FEATURE_FLAGS.map((feature) => (
                <FeatureToggle
                  key={feature.key}
                  feature={feature}
                  checked={flags[feature.key]}
                  onChange={(enabled) => updateFlag(feature.key, enabled)}
                />
              ))}

              <div className="rounded-lg border border-hairline bg-card/25 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 font-medium text-[0.8125rem]">
                      <PaletteIcon className="size-3.5 text-primary" />
                      Interface + editor theme
                    </div>
                    <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
                      Apply a ccthemes palette to the workspace and code editor.
                      Arcana restores the cream interface.
                    </p>
                  </div>
                  <Select
                    value={terminalThemeId}
                    onValueChange={(value) =>
                      setTerminalThemeId(
                        value as (typeof TERMINAL_THEMES)[number]["id"],
                      )
                    }
                  >
                    <SelectTrigger
                      className="h-7 w-[150px] text-[0.75rem]"
                      aria-label="Interface and editor theme"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {TERMINAL_THEMES.map((theme) => (
                        <SelectItem key={theme.id} value={theme.id}>
                          {theme.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-2 flex gap-1">
                  {TERMINAL_THEMES.slice(0, 16).map((theme) => (
                    <span
                      key={theme.id}
                      className="h-1.5 flex-1 rounded-full"
                      style={{ backgroundColor: theme.colors.accent }}
                      title={theme.label}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-hairline bg-card/25 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-[0.8125rem]">
                      Font pairing
                    </div>
                    <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
                      Three pairings across serif, sans, and monospace.
                    </p>
                  </div>
                  <Select
                    value={fontPairingId}
                    onValueChange={(value) =>
                      setFontPairingId(
                        value as (typeof FONT_PAIRINGS)[number]["id"],
                      )
                    }
                  >
                    <SelectTrigger
                      className="h-7 w-[150px] text-[0.75rem]"
                      aria-label="Font pairing"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_PAIRINGS.map((pairing) => (
                        <SelectItem key={pairing.id} value={pairing.id}>
                          {pairing.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {FONT_PAIRINGS.map((pairing) => (
                    <div
                      key={pairing.id}
                      className={cn(
                        "rounded border px-2 py-1.5",
                        pairing.id === fontPairingId
                          ? "border-primary/30 bg-primary/5"
                          : "border-hairline",
                      )}
                    >
                      <div className="font-medium text-[0.6875rem]">
                        {pairing.label}
                      </div>
                      <div className="mt-0.5 truncate text-[0.625rem] text-muted-foreground">
                        {pairing.serif} / {pairing.sans} / {pairing.mono}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-hairline bg-card/25 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 font-medium text-[0.8125rem]">
                      <TypeIcon className="size-3.5 text-primary" />
                      Text size
                    </div>
                    <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
                      Scale the interface and editor type without changing the
                      layout scale.
                    </p>
                  </div>
                  <Select
                    value={textScaleId}
                    onValueChange={(value) =>
                      setTextScaleId(
                        value as (typeof TEXT_SCALES)[number]["id"],
                      )
                    }
                  >
                    <SelectTrigger
                      className="h-7 w-[150px] text-[0.75rem]"
                      aria-label="Text size"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEXT_SCALES.map((scale) => (
                        <SelectItem key={scale.id} value={scale.id}>
                          {scale.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {TEXT_SCALES.map((scale) => (
                    <button
                      key={scale.id}
                      type="button"
                      onClick={() => setTextScaleId(scale.id)}
                      className={cn(
                        "rounded border px-2 py-1.5 text-left transition-colors",
                        scale.id === textScaleId
                          ? "border-primary/30 bg-primary/5"
                          : "border-hairline hover:bg-accent",
                      )}
                    >
                      <div className="font-medium text-[0.6875rem]">
                        {scale.label}
                      </div>
                      <div className="mt-0.5 text-[0.625rem] text-muted-foreground">
                        {scale.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-hairline bg-card/25 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 font-medium text-[0.8125rem]">
                      <BotIcon className="size-3.5 text-primary" />
                      AI model
                    </div>
                    <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
                      Only the active Groq model is called. Pick a smaller model
                      to conserve compute.
                    </p>
                  </div>
                  <Select
                    value={selectedModelId}
                    onValueChange={(value) =>
                      setSelectedModelId(
                        value as (typeof GROQ_CHAT_MODELS)[number]["id"],
                      )
                    }
                  >
                    <SelectTrigger
                      className="h-7 w-[190px] text-[0.75rem]"
                      aria-label="AI model"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GROQ_CHAT_MODELS.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {GROQ_CHAT_MODELS.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => setSelectedModelId(model.id)}
                      className={cn(
                        "rounded border px-2 py-1.5 text-left transition-colors",
                        model.id === selectedModelId
                          ? "border-primary/30 bg-primary/5"
                          : "border-hairline hover:bg-accent",
                      )}
                    >
                      <div className="font-medium text-[0.6875rem]">
                        {model.label}
                      </div>
                      <div className="mt-0.5 text-[0.625rem] text-muted-foreground">
                        {model.compute} · {model.contextWindow} ctx
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-2 rounded border border-hairline/70 bg-background/40 px-2 py-1.5 text-[0.6875rem] text-muted-foreground">
                  {selectedModel.description}
                </div>
              </div>

              <div className="rounded-lg border border-[#b9822f]/20 bg-[#b9822f]/5 p-3 text-[#8a6421] text-[0.75rem] leading-relaxed">
                <div className="flex items-center gap-1.5 font-medium">
                  <AlertTriangleIcon className="size-3.5" />
                  Before shipping
                </div>
                Flags only affect the running app. Keep experimental code behind
                a flag until it is intentional, tested, and documented.
              </div>
            </div>
          )}

          {activeTab === "workspace" && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-sm">Workspace state</h3>
                <p className="mt-1 text-[0.75rem] text-muted-foreground">
                  Live view of the current project. Actions apply immediately.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {[
                  ["Project", projectName || "—"],
                  ["Project ID", projectId || "—"],
                  ["Files", String(files.length)],
                  ["Main file", mainFile?.path ?? "—"],
                  ["Active file", activeFile?.path ?? "—"],
                  ["Compiler", compiler],
                  ["Auto compile", autoCompile ? "on" : "off"],
                  ["Hydrated", isHydrated ? "yes" : "no"],
                  ["Compiling", isCompiling ? "yes" : "no"],
                  ["Compiler errors", String(errorCount)],
                  ["Warnings", String(warningCount)],
                  ["Comments", String(comments.length)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="min-w-0 rounded-md border border-hairline bg-card/25 px-2.5 py-2"
                  >
                    <div className="text-[0.625rem] text-muted-foreground uppercase tracking-[0.1em]">
                      {label}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[0.75rem]">
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => useDocumentStore.getState().requestCompile()}
                >
                  <RefreshCwIcon className="size-3.5" />
                  Compile now
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    useDocumentStore.getState().setAutoCompile(!autoCompile)
                  }
                >
                  <Settings2Icon className="size-3.5" />
                  Auto: {autoCompile ? "on" : "off"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    useDocumentStore.getState().setInspectorOpen(true);
                    useDocumentStore.getState().setInspectorTab("project");
                    setOpen(false);
                  }}
                >
                  <FolderGit2Icon className="size-3.5" />
                  Open inspector
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    useDocumentStore.getState().setCompileDiagnostics([]);
                    useDocumentStore.getState().setCompileError(null);
                    toast.success("Compile diagnostics cleared");
                  }}
                >
                  <CheckCircle2Icon className="size-3.5" />
                  Clear diagnostics
                </Button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" onClick={() => void copySnapshot()}>
                  <ClipboardCopyIcon className="size-3.5" />
                  Copy snapshot
                </Button>
                <Button size="sm" variant="outline" onClick={downloadSnapshot}>
                  <DownloadIcon className="size-3.5" />
                  Download snapshot
                </Button>
              </div>

              <div className="rounded-lg border border-hairline bg-card/25 p-3">
                <div className="flex items-center gap-1.5 font-medium text-[0.75rem]">
                  <ShieldAlertIcon className="size-3.5 text-[#b9822f]" />
                  Local experiment files
                </div>
                <p className="mt-1 text-[0.75rem] text-muted-foreground leading-relaxed">
                  The panel state is written to{" "}
                  <code>.dev-panel.local.json</code> and excluded by{" "}
                  <code>.gitignore</code>. Snapshots download to your browser;
                  keep them in the ignored <code>.dev-panel/</code> folder if
                  you want them local.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => {
                    resetFlags();
                    persistFlags(DEFAULT_DEV_FEATURE_FLAGS);
                    window.localStorage.removeItem(DEV_FLAGS_STORAGE_KEY);
                    toast.success("Local developer flags cleared");
                  }}
                >
                  <RotateCcwIcon className="size-3.5" />
                  Clear local flags
                </Button>
              </div>
            </div>
          )}

          {activeTab === "bridge" && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-sm">Local bridge</h3>
                <p className="mt-1 text-[0.75rem] text-muted-foreground">
                  Inspect the Lean Lake and LaTeX service endpoints.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  onClick={() => void checkBridge()}
                  disabled={isCheckingBridge}
                >
                  {isCheckingBridge ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <TerminalIcon className="size-3.5" />
                  )}
                  Check bridge
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!flags.leanLake}
                  onClick={() => {
                    setOpen(false);
                    useDocumentStore.getState().setLeanOpen(true);
                  }}
                >
                  <FolderGit2Icon className="size-3.5" />
                  Open Lean panel
                </Button>
              </div>
              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-dark p-3 font-mono text-[0.6875rem] text-on-dark-soft leading-relaxed">
                {bridgeResult ??
                  "Run Check bridge to query /api/lean/status, /api/lean/projects, and /api/lean/toolchains."}
              </pre>
              <p className="text-[0.6875rem] text-muted-foreground leading-relaxed">
                The Lean bridge is optional. Configure it with{" "}
                <code>LEAN_PROJECT_DIR</code> or select a project in the Lean
                panel. The panel discovers Lake projects and installed Elan
                toolchains.
              </p>
            </div>
          )}

          {activeTab === "data" && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-sm">Local data</h3>
                <p className="mt-1 text-[0.75rem] text-muted-foreground">
                  Browser keys used by arcanaTeX. The developer settings file is
                  gitignored; other project data is local to this browser.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={refreshStorage}>
                  <RefreshCwIcon className="size-3.5" />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const data = Object.fromEntries(
                      storageEntries.map(({ key }) => [
                        key,
                        window.localStorage.getItem(key),
                      ]),
                    );
                    void navigator.clipboard
                      .writeText(JSON.stringify(data, null, 2))
                      .then(() => toast.success("Local data copied"))
                      .catch(() => toast.error("Could not copy local data"));
                  }}
                >
                  <ClipboardCopyIcon className="size-3.5" />
                  Copy local data
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    resetFlags();
                    persistFlags(DEFAULT_DEV_FEATURE_FLAGS);
                    window.localStorage.removeItem(DEV_FLAGS_STORAGE_KEY);
                    toast.success("Developer flags cleared");
                  }}
                >
                  <RotateCcwIcon className="size-3.5" />
                  Clear dev flags
                </Button>
              </div>
              <div className="overflow-hidden rounded-lg border border-hairline">
                {storageEntries.length === 0 ? (
                  <p className="p-3 text-[0.75rem] text-muted-foreground">
                    No `open-prism` keys found.
                  </p>
                ) : (
                  storageEntries.map((entry) => (
                    <div
                      key={entry.key}
                      className="flex items-center justify-between gap-3 border-hairline border-b px-3 py-2 last:border-b-0"
                    >
                      <span className="min-w-0 truncate font-mono text-[0.6875rem]">
                        {entry.key}
                      </span>
                      <span className="shrink-0 font-mono text-[0.625rem] text-muted-foreground">
                        {entry.size} chars
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="rounded-lg border border-[#b9822f]/20 bg-[#b9822f]/5 p-3 text-[#8a6421] text-[0.75rem] leading-relaxed">
                Developer flags persist in <code>.dev-panel.local.json</code>{" "}
                (gitignored) and in this browser. Use the flag reset before
                taking a production build.
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between border-hairline border-t px-4 py-2 text-[0.6875rem] text-muted-foreground">
          <span>Development-only control surface</span>
          <span className="font-mono">⌘/Ctrl + Shift + D</span>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function DevPanelButton({ className }: { className?: string }) {
  const isOpen = useDevPanelStore((s) => s.isOpen);
  const setOpen = useDevPanelStore((s) => s.setOpen);

  if (!DEV_PANEL_ENABLED) return null;

  return (
    <Button
      variant={isOpen ? "secondary" : "ghost"}
      size="icon"
      className={cn("size-9", className)}
      onClick={() => setOpen(!isOpen)}
      title="Developer control panel (⌘/Ctrl+Shift+D)"
      aria-label="Developer control panel"
    >
      <FlaskConicalIcon className="size-4" />
    </Button>
  );
}
