import type { UIMessage } from "ai";
import { getDB } from "@/lib/storage/db";

export async function loadChatMessages(
  projectId: string,
): Promise<UIMessage[] | null> {
  const db = await getDB();
  const stored = await db.get("projectChats", projectId);
  if (!stored) return null;
  if (!Array.isArray(stored.messages)) return null;
  return stored.messages as UIMessage[];
}

export async function saveChatMessages(
  projectId: string,
  messages: UIMessage[],
): Promise<void> {
  const db = await getDB();

  if (messages.length === 0) {
    await db.delete("projectChats", projectId);
    return;
  }

  await db.put("projectChats", {
    projectId,
    updatedAt: Date.now(),
    messages,
  });
}

export async function deleteChatHistory(projectId: string): Promise<void> {
  const db = await getDB();
  await db.delete("projectChats", projectId);
}
