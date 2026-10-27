"use client";

import { useEffect } from "react";
import { compileProject } from "@/lib/compile-project";
import { isLatexRelatedFile } from "@/lib/file-kind";
import { useDocumentStore } from "@/stores/document-store";

const AUTO_COMPILE_DELAY_MS = 1200;

export function useAutoCompile() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const unsubscribe = useDocumentStore.subscribe((state, previous) => {
      if (state.compileRequestId !== previous.compileRequestId) {
        if (timer) clearTimeout(timer);
        timer = undefined;
        return;
      }

      const activeFileChanged = state.activeFileId !== previous.activeFileId;
      if (state.files === previous.files && !activeFileChanged) return;

      const activeFile = state.files.find(
        (file) => file.id === state.activeFileId,
      );
      if (!activeFile || !isLatexRelatedFile(activeFile)) return;
      if (!state.autoCompile || !state.isHydrated || !state.initialized) {
        return;
      }

      const attempt = () => {
        const current = useDocumentStore.getState();
        if (
          !current.autoCompile ||
          !current.isHydrated ||
          !current.initialized
        ) {
          timer = undefined;
          return;
        }
        if (current.isCompiling) {
          timer = setTimeout(attempt, 700);
          return;
        }
        timer = undefined;
        void compileProject();
      };

      if (timer) clearTimeout(timer);
      timer = setTimeout(attempt, AUTO_COMPILE_DELAY_MS);
    });

    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);
}
