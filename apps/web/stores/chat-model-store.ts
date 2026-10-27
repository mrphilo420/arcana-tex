"use client";

import { create } from "zustand";
import {
  DEFAULT_GROQ_MODEL_ID,
  groqModelSelections,
  type ChatModelSelection,
} from "@/lib/chat-models";

const STORAGE_KEY = "open-prism:chat-model";

function fallbackOptions(): ChatModelSelection[] {
  return groqModelSelections();
}

function readStoredModel(): string {
  if (typeof window === "undefined") return DEFAULT_GROQ_MODEL_ID;
  try {
    return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_GROQ_MODEL_ID;
  } catch {
    return DEFAULT_GROQ_MODEL_ID;
  }
}

function persistSelectedModel(id: string) {
  if (typeof window === "undefined" || !id) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {}
}

interface ChatModelState {
  selectedModelId: string;
  options: ChatModelSelection[];
  hydrated: boolean;
  isLoading: boolean;
  setSelectedModelId: (id: string) => void;
  hydrate: () => void;
  refreshOptions: () => Promise<void>;
}

export const useChatModelStore = create<ChatModelState>()((set, get) => ({
  selectedModelId: DEFAULT_GROQ_MODEL_ID,
  options: fallbackOptions(),
  hydrated: false,
  isLoading: false,

  setSelectedModelId: (selectedModelId) => {
    persistSelectedModel(selectedModelId);
    set({ selectedModelId });
  },

  hydrate: () => {
    if (get().hydrated) return;
    set({ selectedModelId: readStoredModel(), hydrated: true });
    void get().refreshOptions();
  },

  refreshOptions: async () => {
    set({ isLoading: true });
    try {
      const response = await fetch("/api/ai/models", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load models");
      const data = (await response.json()) as {
        models?: ChatModelSelection[];
        defaultModel?: string;
      };
      const options = Array.isArray(data.models) ? data.models : [];
      const current = get().selectedModelId;
      const selected = options.some((option) => option.value === current)
        ? current
        : data.defaultModel &&
            options.some((option) => option.value === data.defaultModel)
          ? data.defaultModel
          : (options[0]?.value ?? "");
      persistSelectedModel(selected);
      set({ options, selectedModelId: selected, isLoading: false });
    } catch {
      set({ options: fallbackOptions(), isLoading: false });
    }
  },
}));
