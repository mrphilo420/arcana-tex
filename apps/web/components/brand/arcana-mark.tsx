import { cn } from "@/lib/utils";

export function ArcanaMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("size-5", className)}
    >
      <path
        d="M12 3.25v17.5M4.4 7.6l15.2 8.8M4.4 16.4l15.2-8.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" />
    </svg>
  );
}
