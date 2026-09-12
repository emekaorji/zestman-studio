import { useEffect } from "react";
import { X } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Dot } from "@/components/primitives";
import { useStore } from "@/state/store";
import { STATUS_H } from "@/lib/metrics";
import type { Toast } from "@/state/slices/misc";

const TONE: Record<Toast["kind"], "ok" | "link" | "muted"> = {
  watcher: "ok",
  operator: "link",
  info: "muted",
};

/** Vercel's toasts live ~6s; long enough to read a filename, short enough to ignore. */
const DURATION = 6000;

/**
 * One toast card. Rendered through `sonner.custom`, so sonner owns the stack,
 * the slide-in from the bottom-right, the swipe-to-dismiss and the timers,
 * while the surface itself is pure Geist: gray-400 hairline, background-100,
 * `--ds-shadow-menu`.
 */
function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  return (
    <div
      role="status"
      className="pointer-events-auto flex w-95 max-w-[calc(100vw-2rem)] items-start gap-2.5 rounded-lg border border-ds-gray-400 bg-ds-background-100 py-2.5 pr-2 pl-3 shadow-[var(--ds-shadow-menu)]"
    >
      <Dot tone={TONE[toast.kind]} className="mt-1.75" />
      <span className="min-w-0 flex-1 text-base leading-5 text-ink">{toast.text}</span>
      <span className="mt-0.5 shrink-0 text-xs text-ink-3">{toast.sub ?? "just now"}</span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Dismiss notification"
        onClick={onDismiss}
        className="shrink-0 text-ink-3 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink"
      >
        <X size={14} strokeWidth={1.5} />
      </Button>
    </div>
  );
}

/**
 * THE toast surface — shadcn's `<Toaster>` (sonner), mounted once.
 *
 * The store keeps `pushToast` as the only API features call; this bridges its
 * queue into sonner and clears it, so there is exactly one renderer and toasts
 * animate in and out instead of appearing and vanishing.
 */
export function ToastHost() {
  const queued = useStore((s) => s.toasts);
  const dismissToast = useStore((s) => s.dismissToast);
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    for (const t of queued) {
      /* Keyed by the store id: a re-run (StrictMode, a re-render mid-flush)
         updates the same toast rather than stacking a duplicate. */
      sonnerToast.custom(
        (sonnerId) => <ToastCard toast={t} onDismiss={() => sonnerToast.dismiss(sonnerId)} />,
        { id: t.id, duration: DURATION },
      );
      dismissToast(t.id);
    }
  }, [queued, dismissToast]);

  return (
    <Toaster
      theme={theme === "paper" ? "light" : "dark"}
      position="bottom-right"
      /* Clear the status bar by a full gutter — at offset 16 the bottom card
         sits flush against it and the two read as one strip. */
      offset={STATUS_H + 16}
      gap={8}
      duration={DURATION}
      visibleToasts={4}
      expand
      toastOptions={{ unstyled: true }}
    />
  );
}
