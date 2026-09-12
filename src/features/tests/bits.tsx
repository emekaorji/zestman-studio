import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { clockTime } from "@/lib/format";
import { Button } from "@/components/ui/button";

/*
 * Shared page furniture for the Tests section.
 *
 * Everything interactive here is a shadcn component, and hover is always
 * written together with focus-visible so a keyboard user sees exactly what a
 * mouse user sees (docs/vercel-parity.md § Interaction states).
 */

/** "‹ Checks" back link — shadcn ghost Button, h32, 14/20. */
export function BackLink({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={cn(
        "-ml-2 gap-1 px-2 text-base font-normal text-ink-2",
        "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
        "hover:bg-ds-gray-alpha-100 hover:text-ink focus-visible:bg-ds-gray-alpha-100 focus-visible:text-ink",
        className,
      )}
    >
      <ChevronLeft size={16} strokeWidth={1.5} />
      {label}
    </Button>
  );
}

/** The one page scroller: Vercel's 28px gutter, scroll fog at both edges. */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("fade-scroll h-full min-h-0 overflow-y-auto px-7 pt-6 pb-10", className)}>
      {children}
    </div>
  );
}

/** Page header row — 16/24 semibold title, muted sub, actions pinned right. */
export function PageHead({
  title,
  sub,
  leading,
  children,
  actions,
  className,
}: {
  title: string;
  sub?: ReactNode;
  /** Status icon or badge that reads before the title. */
  leading?: ReactNode;
  /** Inline chips that sit next to the title. */
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-9 shrink-0 items-center gap-3", className)}>
      {leading}
      <h1 className="shrink-0 text-md font-semibold text-ink">{title}</h1>
      {sub ? <span className="min-w-0 truncate text-xs text-ink-3">{sub}</span> : null}
      {children}
      {actions ? (
        <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/** Caps section label with the standard 32px band above a block. */
export function SectionLabel({
  children,
  right,
  className,
}: {
  children: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex h-8 items-center justify-between", className)}>
      <span className="caps-label">{children}</span>
      {right}
    </div>
  );
}

/** HH:MM clock label for schedule tables. */
export function timeHM(ts: number): string {
  return clockTime(ts).slice(0, 5);
}
