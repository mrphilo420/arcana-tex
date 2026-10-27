"use client";

import { BotIcon } from "lucide-react";
import { useChatModelStore } from "@/stores/chat-model-store";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function ModelPicker({ className }: { className?: string }) {
  const selectedModelId = useChatModelStore((s) => s.selectedModelId);
  const options = useChatModelStore((s) => s.options);
  const setSelectedModelId = useChatModelStore((s) => s.setSelectedModelId);
  const selectedModel = options.find(
    (option) => option.value === selectedModelId,
  );

  const groups = new Map<
    string,
    { providerLabel: string; models: typeof options }
  >();
  for (const option of options) {
    const group = groups.get(option.providerId);
    if (group) {
      group.models.push(option);
    } else {
      groups.set(option.providerId, {
        providerLabel: option.providerLabel,
        models: [option],
      });
    }
  }
  const rank = (model: (typeof options)[number]) =>
    model.disabled ? (model.free ? 2 : 3) : model.free ? 0 : 1;
  for (const group of groups.values()) {
    group.models.sort(
      (a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label),
    );
  }

  return (
    <Select
      value={selectedModelId || undefined}
      onValueChange={setSelectedModelId}
      disabled={options.length === 0}
    >
      <SelectTrigger
        className={cn(
          "h-7 w-[190px] gap-1.5 border-border/70 bg-background/70 px-2 text-[0.75rem] text-muted-foreground",
          className,
        )}
        aria-label="AI model"
        title={selectedModel?.description ?? "No model configured"}
      >
        <BotIcon className="size-3.5 shrink-0 text-primary" />
        <SelectValue placeholder="No model configured" />
      </SelectTrigger>
      <SelectContent>
        {options.length === 0 ? (
          <SelectItem value="__none" disabled>
            No models configured
          </SelectItem>
        ) : (
          [...groups.entries()].map(([providerId, group]) => (
            <SelectGroup key={providerId}>
              <SelectLabel>{group.providerLabel}</SelectLabel>
              {group.models.map((model) => (
                <SelectItem
                  key={model.value}
                  value={model.value}
                  disabled={model.disabled}
                  title={model.note}
                >
                  {model.label}
                  {model.free ? " · Free" : ""}
                  {model.disabled ? " · Unavailable" : ""}
                </SelectItem>
              ))}
            </SelectGroup>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
