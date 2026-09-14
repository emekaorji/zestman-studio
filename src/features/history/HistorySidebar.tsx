import { Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/state/store";
import type { HistoryMode } from "@/state/types";
import { IslandRow, SidebarLevel2 } from "@/components/shell/Sidebar";
import { SegmentedControl } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

export function HistorySidebar() {
  const navigate = useStore((s) => s.navigate);
  const pushDialog = useStore((s) => s.pushDialog);
  const pushToast = useStore((s) => s.pushToast);
  const clearHistoryAction = useStore((s) => s.clearHistory);
  const mode = useStore((s) => s.sections.history.mode);
  const day = useStore((s) => s.sections.history.day);
  const historyDays = useStore((s) => s.historyDays);
  const [query, setQuery] = useState("");

  const activeDay = day ?? historyDays[0]?.date;
  const days = query
    ? historyDays.filter((d) => d.date.toLowerCase().includes(query.toLowerCase()))
    : historyDays;

  const clearHistory = () => {
    pushDialog({
      kind: "confirm",
      title: "Clear history",
      body: "Deletes every recorded request in .zestman/history/. This cannot be undone.",
      confirmLabel: "Clear history",
      onConfirm: () => {
        void clearHistoryAction()
          .then(() => pushToast({ kind: "info", text: "History cleared", sub: ".zestman/history/ emptied" }))
          .catch(() => undefined);
      },
    });
  };

  return (
    <SidebarLevel2
      title="History"
      footer={
        <Button
          variant="ghost"
          onClick={clearHistory}
          className="h-10 shrink-0 justify-start gap-2 rounded-none border-t border-line px-3 text-base font-normal text-ink-3 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:bg-ds-gray-alpha-100 hover:text-ink focus-visible:bg-ds-gray-alpha-100"
        >
          <Trash2 size={16} strokeWidth={1.5} />
          Clear history
        </Button>
      }
    >
      <div className="flex flex-col gap-2 px-2 pt-1 pb-2">
        <SegmentedControl<HistoryMode>
          options={[
            { value: "live", label: "Live" },
            { value: "recorded", label: "Recorded" },
          ]}
          value={mode}
          onChange={(m) => navigate({ go: "history", mode: m })}
        />
        <InputGroup className="h-9 border-line bg-ds-gray-100 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]">
          <InputGroupAddon>
            <Search size={16} strokeWidth={1.5} className="text-ink-3" />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all history…"
            aria-label="Search all history"
            className="text-base"
          />
        </InputGroup>
      </div>

      <div className="flex flex-col gap-0.5">
        {days.map((d, i) => (
          <div
            key={d.date}
            className="animate-in fade-in-0 fill-mode-backwards ease-[var(--ease-out)]"
            style={{ animationDelay: `${i * 20}ms`, animationDuration: "var(--dur-slow)" }}
          >
            <IslandRow
              className="h-10"
              active={mode === "recorded" && d.date === activeDay}
              onClick={() => navigate({ go: "history", mode: "recorded", day: d.date })}
            >
              <span className="min-w-0 flex-1 truncate">{d.date}</span>
              <span className="shrink-0 font-mono text-sm tabular-nums text-ink-3">{d.count}</span>
            </IslandRow>
          </div>
        ))}
      </div>
    </SidebarLevel2>
  );
}
