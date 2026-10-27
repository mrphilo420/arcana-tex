"use client";

import { useEffect } from "react";
import { saveProject } from "@/lib/projects/repository";
import { useDocumentStore } from "@/stores/document-store";

const SAVE_DELAY_MS = 600;

export function useProjectAutosave(projectId: string) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let saveChain: Promise<void> = Promise.resolve();
    let dirty = false;

    const persist = () => {
      if (!dirty) return;
      dirty = false;

      saveChain = saveChain
        .then(async () => {
          const state = useDocumentStore.getState();
          if (!state.isHydrated || state.projectId !== projectId) return;

          state.setIsSaving(true);

          try {
            await saveProject({
              id: projectId,
              name: state.projectName,
              createdAt: state.createdAt ?? Date.now(),
              updatedAt: Date.now(),
              files: state.files,
              activeFileId: state.activeFileId,
              mainFileId: state.mainFileId,
              compiler: state.compiler,
              comments: state.comments,
            });
          } catch (error) {
            console.error("Failed to save project", error);
            dirty = true;
          } finally {
            const current = useDocumentStore.getState();
            if (current.projectId === projectId) {
              current.setIsSaving(false);
            }
          }
        })
        .catch(() => {});
    };

    const schedule = () => {
      dirty = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        persist();
      }, SAVE_DELAY_MS);
    };

    const unsubscribe = useDocumentStore.subscribe((state, previous) => {
      if (!state.isHydrated || state.projectId !== projectId) return;

      const changed =
        state.files !== previous.files ||
        state.projectName !== previous.projectName ||
        state.activeFileId !== previous.activeFileId ||
        state.mainFileId !== previous.mainFileId ||
        state.compiler !== previous.compiler ||
        state.comments !== previous.comments;

      if (changed) schedule();
    });

    const flush = () => {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      persist();
    };

    window.addEventListener("pagehide", flush);

    return () => {
      unsubscribe();
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [projectId]);
}
