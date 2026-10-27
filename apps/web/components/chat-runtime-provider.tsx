"use client";

import { useEffect, useMemo, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  AssistantChatTransport,
  useAISDKRuntime,
} from "@assistant-ui/react-ai-sdk";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import {
  loadChatMessages,
  saveChatMessages,
} from "@/lib/projects/chat-history";
import { useDocumentStore } from "@/stores/document-store";

export function ChatRuntimeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const projectId = useDocumentStore((state) => state.projectId);
  const transport = useMemo(() => new AssistantChatTransport(), []);
  const chat = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });
  const runtime = useAISDKRuntime(chat);
  const loadedProjectRef = useRef<string | null>(null);
  const loadRequestRef = useRef(0);
  const latestMessagesRef = useRef(chat.messages);

  latestMessagesRef.current = chat.messages;

  useEffect(() => {
    transport.setRuntime(runtime);
  }, [transport, runtime]);

  useEffect(() => {
    const previousProjectId = loadedProjectRef.current;

    if (previousProjectId === projectId) return;

    chat.stop();

    if (previousProjectId) {
      void saveChatMessages(previousProjectId, latestMessagesRef.current);
    }

    const requestId = ++loadRequestRef.current;
    loadedProjectRef.current = null;

    if (!projectId) {
      chat.setMessages([]);
      loadedProjectRef.current = null;
      return;
    }

    void loadChatMessages(projectId)
      .then((messages) => {
        if (loadRequestRef.current !== requestId) return;
        loadedProjectRef.current = projectId;
        chat.setMessages(messages ?? []);
      })
      .catch((error) => {
        if (loadRequestRef.current !== requestId) return;
        console.error("Failed to load chat history", error);
        loadedProjectRef.current = projectId;
        chat.setMessages([]);
      });
  }, [projectId, chat]);

  useEffect(() => {
    const currentProjectId = loadedProjectRef.current;
    if (!currentProjectId) return;

    const timer = setTimeout(() => {
      void saveChatMessages(currentProjectId, latestMessagesRef.current);
    }, 600);

    return () => clearTimeout(timer);
  }, [projectId, chat.messages]);

  useEffect(() => {
    const flush = () => {
      const currentProjectId = loadedProjectRef.current;
      if (!currentProjectId) return;
      void saveChatMessages(currentProjectId, latestMessagesRef.current);
    };

    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
