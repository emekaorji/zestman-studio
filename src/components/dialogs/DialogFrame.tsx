import { useCallback, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";
import { DIALOG_FOOT_H, DIALOG_HEAD_H, DUR } from "@/lib/metrics";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * THE dialog chrome, on shadcn's Dialog — so the focus trap, Escape, the
 * `aria-labelledby` wiring and the overlay/scale animation are Radix's, not
 * ours. Vercel's modal metrics: radius 12, `--ds-shadow-modal`, h52 header with
 * a 16px title, h56 footer behind a hairline, 16px body gutter.
 *
 * The frame owns its own open state so closing plays the exit animation before
 * the store pops it off the dialog stack.
 */
export function DialogFrame({
  title,
  titleRight,
  width = 560,
  top,
  children,
  footer,
  onClose,
}: {
  title: string;
  titleRight?: ReactNode;
  width?: number;
  /** Pin the modal this far from the top instead of centring it. */
  top?: number;
  children: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
}) {
  const popDialog = useStore((s) => s.popDialog);
  const close = onClose ?? popDialog;
  const [open, setOpen] = useState(true);

  const requestClose = useCallback(() => {
    setOpen(false);
    window.setTimeout(close, DUR.base);
  }, [close]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) requestClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        /* The app owns Escape globally; take it here so the exit animation
           plays and the stack is popped exactly once. */
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          requestClose();
        }}
        style={{ width, ...(top != null ? { top, transform: "translateX(-50%)" } : null) }}
        className={cn(
          "flex max-h-[85dvh] flex-col gap-0 overflow-hidden rounded-2xl bg-ds-background-100 p-0",
          "max-w-[calc(100vw-2rem)] text-base text-ink shadow-[var(--ds-shadow-modal)] sm:max-w-[calc(100vw-2rem)]",
          "duration-[var(--dur-base)] ease-[var(--ease-out)]",
        )}
      >
        <DialogHeader
          className="flex-row shrink-0 items-center justify-between gap-2 border-b border-line px-4"
          style={{ height: DIALOG_HEAD_H }}
        >
          <div className="flex min-w-0 items-baseline gap-2.5">
            <DialogTitle className="truncate text-md font-semibold text-ink">{title}</DialogTitle>
            {titleRight}
          </div>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close"
              className="-mr-1 shrink-0 text-ink-2 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink"
            >
              <X size={16} strokeWidth={1.5} />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="fade-scroll min-h-0 flex-1 overflow-y-auto p-4">{children}</div>

        {footer ? (
          <DialogFooter
            className="mx-0 mb-0 shrink-0 flex-row items-center justify-end gap-2 rounded-none border-t border-line bg-transparent px-4 py-0"
            style={{ height: DIALOG_FOOT_H }}
          >
            {footer}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Left-aligned footer slot helper (e.g. destructive "Clear all" on the left). */
export function DialogFooterSplit({ left, right }: { left?: ReactNode; right: ReactNode }) {
  return (
    <div className={cn("flex w-full items-center", left ? "justify-between" : "justify-end")}>
      {left}
      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
}
