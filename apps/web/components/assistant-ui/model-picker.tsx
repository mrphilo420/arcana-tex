"use client";

import { BotIcon } from "lucide-react";
import { GROQ_CHAT_MODELS, getGroqModel } from "@/lib/chat-models";
import { useChatModelStore } from "@/stores/chat-model-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function ModelPicker({ className }: { className?: string }) {
  const selectedModelId = useChatModelStore((s) => s.selectedModelId);
  const setSelectedModelId = useChatModelStore((s) => s.setSelectedModelId);
  const selectedModel = getGroqModel(selectedModelId);

  return (
    <Select
      value={selectedModelId}
      onValueChange={(value) =>
        setSelectedModelId(value as (typeof GROQ_CHAT_MODELS)[number]["id"])
      }
    >
      <SelectTrigger
        className={cn(
          "h-7 w-[190px] gap-1.5 border-border/70 bg-background/70 px-2 text-[0.75rem] text-muted-foreground",
          className,
        )}
        aria-label="AI model"
        title={selectedModel.description}
      >
        <BotIcon className="size-3.5 shrink-0 text-primary" />
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
  );
}
