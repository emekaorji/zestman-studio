import { useStore } from "@/state/store";
import type { RailTab } from "@/state/types";
import { TabStrip, type TabDef } from "@/components/tabstrip/TabStrip";
import { AiTab } from "@/features/rail/AiTab";
import { DocTab } from "@/features/rail/DocTab";
import { CodeTab } from "@/features/rail/CodeTab";
import { XrayTab } from "@/features/rail/XrayTab";

const TABS: Array<TabDef<RailTab>> = [
  { id: "ai", label: "AI" },
  { id: "doc", label: "Doc" },
  { id: "code", label: "Code" },
  { id: "xray", label: "X-ray" },
];

/** THE right rail — h40 tab header (AI · Doc · Code · X-ray) over one content state. */
export function RightRail() {
  const railTab = useStore((s) => s.railTab);
  const setRailTab = useStore((s) => s.setRailTab);

  return (
    <aside aria-label="Panel" className="flex h-full w-full min-h-0 flex-col bg-canvas">
      <TabStrip<RailTab>
        label="Panel"
        tabs={TABS}
        active={railTab}
        onSelect={setRailTab}
        variant="request"
        className="px-3"
      />
      {/* Keyed so a tab change fades in rather than snapping. */}
      <div
        key={railTab}
        className="fade-scroll min-h-0 flex-1 animate-in overflow-y-auto fade-in-0"
        style={{ animationDuration: "var(--dur-base)" }}
      >
        {railTab === "ai" ? (
          <AiTab />
        ) : railTab === "doc" ? (
          <DocTab />
        ) : railTab === "code" ? (
          <CodeTab />
        ) : (
          <XrayTab />
        )}
      </div>
    </aside>
  );
}
