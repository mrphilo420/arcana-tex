"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { ChatRuntimeProvider } from "@/components/chat-runtime-provider";
import { DevPanel } from "@/components/dev/dev-panel";
import { Toaster } from "@/components/ui/sonner";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

export function RootProvider({ children }: { children: ReactNode }) {
  useKeyboardShortcuts();

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <ChatRuntimeProvider>{children}</ChatRuntimeProvider>
      <DevPanel />
      <Toaster />
    </ThemeProvider>
  );
}
