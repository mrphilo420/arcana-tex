"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FileQuestionIcon, Loader2Icon } from "lucide-react";
import { WorkspaceLayout } from "@/components/workspace/workspace-layout";
import { Button } from "@/components/ui/button";
import { useProjectAutosave } from "@/hooks/use-project-autosave";
import { createProject, getProject } from "@/lib/projects/repository";
import {
  fetchSyncSnapshot,
  saveProjectSyncSettings,
} from "@/lib/sync/settings";
import type { SyncSnapshot } from "@/lib/sync/types";
import { useDocumentStore } from "@/stores/document-store";

function ProjectWorkspace({ projectId }: { projectId: string }) {
  useProjectAutosave(projectId);

  const projectName = useDocumentStore((state) => state.projectName);

  useEffect(() => {
    document.title = `${projectName} · OpenPrism`;
  }, [projectName]);

  return <WorkspaceLayout />;
}

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = Array.isArray(params.id) ? params.id[0] : params.id;
  const hydrateProject = useDocumentStore((state) => state.hydrateProject);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!projectId) return;

    let alive = true;
    setLoadedProjectId(null);
    setMissing(false);

    const syncToken =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("sync")
        : null;

    if (syncToken && /^[a-zA-Z0-9-]{8,120}$/.test(syncToken)) {
      saveProjectSyncSettings(projectId, {
        token: syncToken,
        enabled: true,
        sharedWithMe: true,
      });
    }

    const loadProject = async () => {
      let project = await getProject(projectId);

      if (!project && syncToken) {
        const snapshot = (await fetchSyncSnapshot(
          projectId,
          syncToken,
        )) as SyncSnapshot | null;

        if (
          snapshot &&
          snapshot.projectId === projectId &&
          Array.isArray(snapshot.files)
        ) {
          project = await createProject({
            id: projectId,
            name: snapshot.projectName || "Shared Project",
            files: snapshot.files,
            mainFileId: snapshot.mainFileId,
            compiler:
              snapshot.compiler === "xelatex" ||
              snapshot.compiler === "lualatex"
                ? snapshot.compiler
                : "pdflatex",
            comments: snapshot.comments,
          });

          saveProjectSyncSettings(projectId, {
            token: syncToken,
            enabled: true,
            sharedWithMe: true,
          });
        }
      }

      return project;
    };

    loadProject()
      .then((project) => {
        if (!alive) return;
        if (!project) {
          setMissing(true);
          return;
        }
        hydrateProject(project);
        setLoadedProjectId(project.id);
      })
      .catch((error) => {
        console.error("Failed to load project", error);
        if (alive) setMissing(true);
      });

    return () => {
      alive = false;
    };
  }, [projectId, hydrateProject]);

  if (missing) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <FileQuestionIcon className="size-12 text-muted-foreground/60" />
        <div>
          <h1 className="font-semibold text-lg">Project not found</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            It may have been deleted from this browser.
          </p>
        </div>
        <Button asChild>
          <Link href="/">Back to projects</Link>
        </Button>
      </div>
    );
  }

  if (!projectId || loadedProjectId !== projectId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground text-sm">Opening project…</span>
      </div>
    );
  }

  return <ProjectWorkspace key={projectId} projectId={projectId} />;
}
