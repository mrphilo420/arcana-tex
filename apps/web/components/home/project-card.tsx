"use client";

import { formatDistanceToNow } from "date-fns";
import {
  FileTextIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import type { ProjectMeta } from "@/lib/storage/schema";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProjectCardProps {
  project: ProjectMeta;
  onOpen: (id: string) => void;
  onRename: (project: ProjectMeta) => void;
  onDelete: (project: ProjectMeta) => void;
}

const codeLines = [
  { width: "72%", tone: "text-[#cc785c]" },
  { width: "88%", tone: "text-[#faf9f5]" },
  { width: "54%", tone: "text-[#5db8a6]" },
  { width: "66%", tone: "text-[#a09d96]" },
];

export function ProjectCard({
  project,
  onOpen,
  onRename,
  onDelete,
}: ProjectCardProps) {
  const edited = formatDistanceToNow(new Date(project.updatedAt), {
    addSuffix: true,
  });

  return (
    <div className="group relative overflow-hidden rounded-xl border border-hairline bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-[0_10px_30px_rgba(20,20,19,0.07)] dark:hover:shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
      <button
        type="button"
        className="block w-full text-left"
        onClick={() => onOpen(project.id)}
      >
        <div className="relative h-[116px] overflow-hidden border-white/10 border-b bg-surface-dark px-4 pt-3">
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[#5a564f]" />
            <span className="size-1.5 rounded-full bg-[#5a564f]" />
            <span className="size-1.5 rounded-full bg-[#5a564f]" />
            <span className="ml-2 truncate font-mono text-[0.75rem] text-on-dark-soft">
              {project.mainFilePath ?? "main.tex"}
            </span>
            <span className="ml-auto shrink-0 rounded-full border border-white/10 px-2 py-0.5 font-medium text-[0.75rem] text-on-dark-soft">
              {project.fileCount} file{project.fileCount === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-[1.15fr_0.85fr] items-start gap-4">
            <div className="space-y-1.5 pt-1">
              {codeLines.map((line, index) => (
                <div
                  key={index}
                  className={`h-1.5 rounded-full bg-current opacity-70 ${line.tone}`}
                  style={{ width: line.width }}
                />
              ))}
              <div className="pt-1 font-mono text-[#8e8b82] text-[0.75rem]">
                \section&#123;Introduction&#125;
              </div>
            </div>

            <div className="h-[74px] rounded-sm bg-[#faf9f5] p-2 shadow-[0_6px_20px_rgba(0,0,0,0.18)]">
              <div className="mb-1.5 h-1 w-6 rounded-full bg-[#cc785c]" />
              <div className="space-y-1">
                <div className="h-0.5 w-full rounded-full bg-[#d8d2c7]" />
                <div className="h-0.5 w-5/6 rounded-full bg-[#d8d2c7]" />
                <div className="h-0.5 w-full rounded-full bg-[#d8d2c7]" />
                <div className="h-0.5 w-3/4 rounded-full bg-[#d8d2c7]" />
                <div className="mt-1.5 h-3 rounded-[1px] bg-[#ece6dc]" />
              </div>
            </div>
          </div>
        </div>

        <div className="p-5">
          <h3 className="pr-7 font-serif text-[1.5rem] leading-[1.1] tracking-[-0.015em]">
            {project.name}
          </h3>
          <p
            className="mt-2 text-muted-foreground text-xs"
            title={new Date(project.updatedAt).toLocaleString()}
          >
            Edited {edited}
          </p>
          {project.mainFilePath && (
            <p className="mt-1.5 truncate font-mono text-[0.75rem] text-muted-foreground/75">
              {project.mainFilePath}
            </p>
          )}
        </div>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2.5 right-2.5 size-7 border border-white/10 bg-white/5 text-on-dark-soft opacity-0 backdrop-blur-sm transition-opacity hover:bg-white/10 hover:text-on-dark focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
            title="Project actions"
          >
            <MoreHorizontalIcon className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onOpen(project.id)}>
            <FileTextIcon className="mr-2 size-4" />
            Open
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRename(project)}>
            <PencilIcon className="mr-2 size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onDelete(project)}
          >
            <Trash2Icon className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
