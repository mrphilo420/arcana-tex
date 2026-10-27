"use client";

import { useEffect, useRef } from "react";
import { XIcon, ChevronUpIcon, ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SearchPanelProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onClose: () => void;
  onFindNext: () => void;
  onFindPrevious: () => void;
  matchCount: number;
  currentMatch: number;
}

export function SearchPanel({
  searchQuery,
  onSearchQueryChange,
  onClose,
  onFindNext,
  onFindPrevious,
  matchCount,
  currentMatch,
}: SearchPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        onFindPrevious();
      } else {
        onFindNext();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="flex h-9 items-center gap-2 border-white/10 border-b bg-[#181715] px-2">
      <Input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search..."
        className="h-6 w-48 bg-[#252320] text-[#a09d96] text-sm placeholder:text-[#6c6a64]"
      />
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-[#a09d96] hover:bg-white/10 hover:text-[#a09d96]"
          onClick={onFindPrevious}
          disabled={!searchQuery || matchCount === 0}
        >
          <ChevronUpIcon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-[#a09d96] hover:bg-white/10 hover:text-[#a09d96]"
          onClick={onFindNext}
          disabled={!searchQuery || matchCount === 0}
        >
          <ChevronDownIcon className="size-4" />
        </Button>
      </div>
      {searchQuery && (
        <span className="text-[#6c6a64] text-xs">
          {matchCount === 0 ? "No results" : `${currentMatch} of ${matchCount}`}
        </span>
      )}
      <div className="flex-1" />
      <Button
        variant="ghost"
        size="icon"
        className="size-6 text-[#a09d96] hover:bg-white/10 hover:text-[#a09d96]"
        onClick={onClose}
      >
        <XIcon className="size-4" />
      </Button>
    </div>
  );
}
