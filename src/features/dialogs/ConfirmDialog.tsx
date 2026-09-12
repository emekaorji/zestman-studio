import { useCallback, useState } from "react";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";
import { useStore } from "@/state/store";
import type { DialogInstance } from "@/state/types";
import { DIALOG_FOOT_H, DIALOG_HEAD_H, DUR } from "@/lib/metrics";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type ConfirmInstance = Extract<DialogInstance, { kind: "confirm" }>;

/**
 * Destructive/irreversible confirmations, on shadcn's `AlertDialog` — the
 * alertdialog role, the forced choice (no click-outside dismiss) and the focus
 * trap come from Radix. Chrome matches DialogFrame: h52 header, h56 footer.
 *
 * Portal/Overlay/Content are composed by hand rather than using the packaged
 * `AlertDialogContent`, whose built-in overlay is a 10% scrim — four times
 * lighter than every other modal in the studio. A confirmation must dim the
 * page exactly as hard as the dialogs it sits beside, so the overlay here is
 * the Dialog one: 60% plus Vercel's 2px backdrop blur.
 */
export function ConfirmDialog({ dialog }: { dialog: ConfirmInstance }) {
  const popDialog = useStore((s) => s.popDialog);
  const [open, setOpen] = useState(true);

  const requestClose = useCallback(() => {
    setOpen(false);
    window.setTimeout(popDialog, DUR.base);
  }, [popDialog]);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) requestClose();
      }}
    >
      <AlertDialogPortal>
        <AlertDialogOverlay
          className={cn(
            "bg-overlay supports-backdrop-filter:backdrop-blur-[2px]",
            "duration-[var(--dur-base)] ease-[var(--ease-out)]",
          )}
        />
        <AlertDialogPrimitive.Content
          data-slot="alert-dialog-content"
          /* Header/footer/title carry `group-data-[size]/alert-dialog-content`
             variants; without the group name and size the title falls back to
             its centred small-screen layout. */
          data-size="default"
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            requestClose();
          }}
          style={{ width: 420, maxWidth: "calc(100vw - 2rem)" }}
          className={cn(
            "group/alert-dialog-content fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "flex flex-col gap-0 overflow-hidden rounded-2xl bg-ds-background-100 p-0 outline-none",
            "text-base text-ink shadow-[var(--ds-shadow-modal)]",
            "duration-[var(--dur-base)] ease-[var(--ease-out)]",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          )}
        >
          <AlertDialogHeader
            className="shrink-0 flex-row items-center gap-2 border-b border-line px-4 text-left"
            style={{ height: DIALOG_HEAD_H }}
          >
            <AlertDialogTitle className="truncate text-md font-semibold text-ink">
              {dialog.title}
            </AlertDialogTitle>
          </AlertDialogHeader>

          <AlertDialogDescription className="min-h-0 flex-1 px-4 py-4 text-base leading-5 text-pretty text-ink-2">
            {dialog.body}
          </AlertDialogDescription>

          <AlertDialogFooter
            className="mx-0 mb-0 shrink-0 flex-row items-center justify-end gap-2 rounded-none border-t border-line bg-transparent px-4 py-0"
            style={{ height: DIALOG_FOOT_H }}
          >
            <AlertDialogCancel
              size="lg"
              className="border-ds-gray-400 bg-transparent text-base font-medium text-ink-2 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:bg-hoverbg hover:text-ink dark:bg-transparent dark:hover:bg-hoverbg"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              size="lg"
              className="text-base font-medium transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]"
              onClick={() => {
                dialog.onConfirm();
                requestClose();
              }}
            >
              {dialog.confirmLabel ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogPrimitive.Content>
      </AlertDialogPortal>
    </AlertDialog>
  );
}
