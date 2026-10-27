"use client";

import { useEffect } from "react";
import { useDocumentStore } from "@/stores/document-store";

const DEFAULT_IMAGE_FILE = {
  name: "hand-write.jpg",
  path: "/hand-write.jpg",
};

async function loadImageAsDataUrl(path: string): Promise<string> {
  const res = await fetch(path);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function useProjectInit() {
  const files = useDocumentStore((s) => s.files);
  const addFile = useDocumentStore((s) => s.addFile);
  const initialized = useDocumentStore((s) => s.initialized);
  const setInitialized = useDocumentStore((s) => s.setInitialized);

  useEffect(() => {
    if (initialized) return;

    const isDemoProject = files.some((file) => file.id === "default-tex");
    if (!isDemoProject) {
      setInitialized();
      return;
    }

    const existingImage = files.find(
      (f) => f.type === "image" && f.path === DEFAULT_IMAGE_FILE.name,
    );

    if (existingImage?.dataUrl) {
      setInitialized();
      return;
    }

    const currentActiveId = useDocumentStore.getState().activeFileId;

    loadImageAsDataUrl(DEFAULT_IMAGE_FILE.path)
      .then((dataUrl) => {
        const state = useDocumentStore.getState();
        const isStillDemo = state.files.some(
          (file) => file.id === "default-tex",
        );

        if (!isStillDemo) {
          setInitialized();
          return;
        }

        const currentImage = state.files.find(
          (file) =>
            file.type === "image" && file.path === DEFAULT_IMAGE_FILE.name,
        );

        if (currentImage) {
          useDocumentStore.setState((current) => ({
            files: current.files.map((file) =>
              file.id === currentImage.id ? { ...file, dataUrl } : file,
            ),
          }));
        } else {
          addFile({
            name: DEFAULT_IMAGE_FILE.name,
            path: DEFAULT_IMAGE_FILE.name,
            type: "image",
            dataUrl,
          });
          useDocumentStore.getState().setActiveFile(currentActiveId);
        }
        setInitialized();
      })
      .catch((err) => {
        console.error("Failed to load default image:", err);
        setInitialized();
      });
  }, [files, addFile, initialized, setInitialized]);
}
