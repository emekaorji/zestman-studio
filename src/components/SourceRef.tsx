import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { splitFileRef } from "@/state/slices/data";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";

/**
 * A `file.ts:12` reference that opens the file in the user's editor through
 * the daemon. Inline, mono, link-blue — it reads like the plain span it
 * replaces, but it is a real button.
 */
export function SourceRef({
  fileRef,
  className,
  muted = false,
}: {
  fileRef: string;
  className?: string;
  /** Render in the muted text colour instead of link-blue. */
  muted?: boolean;
}) {
  const openSource = useStore((s) => s.openSource);
  const open = (e: MouseEvent) => {
    e.stopPropagation();
    const { file, line } = splitFileRef(fileRef);
    void openSource(file, line);
  };
  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      aria-label={`Open ${fileRef} in your editor`}
      onClick={open}
      className={cn(
        "h-auto min-w-0 max-w-full justify-start truncate p-0 font-mono text-sm font-normal",
        "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:underline",
        muted ? "text-ink-3 hover:text-ink-2" : "text-link-z",
        className,
      )}
    >
      <span className="truncate">{fileRef}</span>
    </Button>
  );
}
