"use client";

import { create } from "zustand";
import {
  DEFAULT_GROQ_MODEL_ID,
  isGroqModelId,
  type ChatModelId,
} from "@/lib/chat-models";

const STORAGE_KEY = "open-prism:chat-model";

function readStoredModel(): ChatModelId {
  if (typeof window === "undefined") return DEFAULT_GROQ_MODEL_ID;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && isGroqModelId(stored) ? stored : DEFAULT_GROQ_MODEL_ID;
  } catch {
    return DEFAULT_GROQ_MODEL_ID;
  }
}

interface ChatModelState {
  selectedModelId: ChatModelId;
  setSelectedModelId: (id: ChatModelId) => void;
  hydrate: () => void;
}

export const useChatModelStore = create<ChatModelState>()((set) => ({
  selectedModelId: DEFAULT_GROQ_MODEL_ID,
  setSelectedModelId: (selectedModelId) => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, selectedModelId);
      } catch {}
    }
    set({ selectedModelId });
  },
  hydrate: () => set({ selectedModelId: readStoredModel() }),
}));
