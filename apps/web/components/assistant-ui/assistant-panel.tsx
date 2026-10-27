"use client";

import { CodeToolsBadge } from "@/components/workspace/editor/code-tools";
import { ClearChatButton } from "./clear-chat-button";
import { ModelPicker } from "./model-picker";
import { Thread } from "./thread";
import { useDocumentContext } from "@/hooks/use-document-context";

export function AssistantPanel() {
  useDocumentContext();

  return (
    <div className="flex h-full flex-col border-border border-l bg-background">
      <div className="flex items-center gap-2 border-border border-b px-4 py-2">
        <h2 className="font-medium text-sm">AI Assistant</h2>
        <span className="hidden sm:block">
          <CodeToolsBadge />
        </span>
        <div className="ml-auto flex items-center gap-1">
          <ModelPicker />
          <ClearChatButton />
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <Thread />
      </div>
    </div>
  );
}
