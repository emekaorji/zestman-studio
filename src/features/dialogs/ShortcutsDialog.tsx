import { GhostButton, Kbd } from "@/components/primitives";
import { DialogFrame } from "@/components/dialogs/DialogFrame";
import { useStore } from "@/state/store";
import { ROW_NAV } from "@/lib/metrics";

const COL_1: Array<[string, string]> = [
  ["⌘K", "Command palette"],
  ["⌘⏎", "Send request"],
  ["⌘L", "Focus URL"],
  ["⌘W", "Close tab"],
  ["⌃Tab", "Next tab"],
  ["⌘B", "Toggle sidebar"],
];

const COL_2: Array<[string, string]> = [
  ["⌃⇧Tab", "Previous tab"],
  ["⌘/", "Shortcuts"],
  ["⌘E", "Environments"],
  ["⌘.", "Cancel request"],
  ["⌘⇧R", "Run all"],
  ["⌘J", "Toggle drawer"],
];

export function ShortcutsDialog() {
  const popDialog = useStore((s) => s.popDialog);
  return (
    <DialogFrame
      title="Keyboard shortcuts"
      width={560}
      footer={<GhostButton onClick={popDialog}>Done</GhostButton>}
    >
      <dl className="flex gap-10">
        {[COL_1, COL_2].map((col, i) => (
          <div key={i} className="flex flex-1 flex-col">
            {col.map(([keys, label], j) => (
              <div
                key={keys}
                style={{ height: ROW_NAV, animationDelay: `${(i * col.length + j) * 20}ms` }}
                className="flex items-center gap-3.5 animate-in fade-in-0 fill-mode-both duration-[var(--dur-base)] ease-[var(--ease-out)]"
              >
                {/* Fixed-width key column: `⌃⇧Tab` is wider than `⌘K`, and
                    without it every label in that column sits at a different
                    x than its neighbours. */}
                <dt className="w-13 shrink-0">
                  <Kbd className="min-w-10 justify-center">{keys}</Kbd>
                </dt>
                <dd className="m-0 text-base text-ink-2">{label}</dd>
              </div>
            ))}
          </div>
        ))}
      </dl>
    </DialogFrame>
  );
}
