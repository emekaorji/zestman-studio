import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  FlaskConical,
  Globe,
  LayoutDashboard,
  Route as RouteIcon,
  Server,
} from "lucide-react";
import type { ReactNode } from "react";
import { useStore } from "@/state/store";
import type { SectionId } from "@/state/types";
import { cn } from "@/lib/utils";
import { ROW_NAV, SIDEBAR_HEAD_H } from "@/lib/metrics";
import { Dot } from "@/components/primitives";

const NAV_ITEMS: Array<{ id: SectionId; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "routes", label: "Routes", icon: RouteIcon },
  { id: "docs", label: "Docs", icon: BookOpen },
  { id: "specs", label: "Specs", icon: FileText },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "tests", label: "Tests", icon: FlaskConical },
  { id: "mocks", label: "Mocks", icon: Server },
  { id: "history", label: "History", icon: Clock },
  { id: "environment", label: "Environment", icon: Globe },
];

/** Sections that stay at level 1 (no section-specific sidebar). */
const LEVEL1_SECTIONS: SectionId[] = ["overview", "specs", "insights"];

/** Vercel's chrome hover/colour transition. */
const COLOUR = "transition-colors duration-150 ease-in-out";

/**
 * THE sidebar level machine. Level 1 = the nine nav items. Level 2 = a back
 * row that pops *the sidebar* to level 1 without leaving the page, plus the
 * section's own nav.
 */
export function Sidebar({ level2 }: { level2?: ReactNode }) {
  const section = useStore((s) => s.section);
  const navigate = useStore((s) => s.navigate);
  const diagnostics = useStore((s) => s.diagnostics);
  const sidebarRoot = useStore((s) => s.sidebarRoot);

  const hasLevel2 = !LEVEL1_SECTIONS.includes(section) && level2 != null;
  // "Back" only pops the sidebar to its top level — it never leaves the page.
  const showLevel2 = !sidebarRoot && hasLevel2;
  const warnCount = diagnostics.filter((d) => d.level !== "info").length;

  return (
    <aside aria-label="Sidebar" className="flex h-full w-full min-h-0 flex-col bg-canvas">
      {showLevel2 ? (
        <div
          className="flex min-h-0 flex-1 animate-in flex-col fade-in-0"
          style={{ animationDuration: "var(--dur-base)" }}
        >
          {level2}
        </div>
      ) : (
        <nav
          aria-label="Sections"
          className="fade-scroll hide-scrollbar flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2"
        >
          {NAV_ITEMS.map(({ id, label, icon: Icon }, i) => {
            const active = section === id;
            return (
              <button
                key={id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => navigate({ go: "section", section: id })}
                style={{
                  height: ROW_NAV,
                  animationDuration: "var(--dur-slow)",
                  animationDelay: `${i * 20}ms`,
                  animationFillMode: "backwards",
                }}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-md px-2.5 text-left text-base font-medium",
                  "animate-in fade-in-0 slide-in-from-left-2 ease-out",
                  COLOUR,
                  active
                    ? "bg-ds-gray-alpha-200 text-ink"
                    : "text-ink-2 hover:bg-ds-gray-alpha-100 hover:text-ink",
                )}
              >
                <Icon size={16} strokeWidth={1.5} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {/* Sitting on level 1 while still on this page: point back in. */}
                {active && hasLevel2 ? (
                  <ChevronRight size={14} strokeWidth={1.5} className="shrink-0 text-ink-3" />
                ) : null}
              </button>
            );
          })}
        </nav>
      )}

      <button
        type="button"
        onClick={() => navigate({ go: "insights", tab: "diagnostics" })}
        className={cn(
          "group/diag flex h-10 shrink-0 items-center gap-2 border-t border-line px-3 text-left text-xs text-ink-3",
          "hover:bg-ds-gray-alpha-100 hover:text-ink-2",
          COLOUR,
        )}
      >
        <Dot tone={warnCount > 0 ? "warn" : "ok"} />
        <span className="min-w-0 flex-1 truncate">
          {warnCount > 0 ? `${warnCount} diagnostics` : "0 diagnostics"}
        </span>
        <ChevronRight
          size={14}
          strokeWidth={1.5}
          className="shrink-0 opacity-0 transition-opacity duration-150 ease-in-out group-hover/diag:opacity-100"
        />
      </button>
    </aside>
  );
}

/** Level-2 frame: a 40px back row that pops the sidebar, then the section nav. */
export function SidebarLevel2({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const setSidebarRoot = useStore((s) => s.setSidebarRoot);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        aria-label={`Back to all sections (from ${title})`}
        onClick={() => setSidebarRoot(true)}
        className={cn(
          "group/back relative mx-2 mt-2 flex shrink-0 items-center rounded-md px-2",
          "hover:bg-ds-gray-alpha-100",
          COLOUR,
        )}
        style={{ height: SIDEBAR_HEAD_H }}
      >
        <ChevronLeft
          size={16}
          strokeWidth={1.5}
          className={cn("shrink-0 text-ink-3 group-hover/back:text-ink", COLOUR)}
        />
        <span
          className={cn(
            "pointer-events-none absolute inset-x-8 truncate text-center text-base font-medium text-ink-2",
            "group-hover/back:text-ink",
            COLOUR,
          )}
        >
          {title}
        </span>
      </button>
      <div className="fade-scroll hide-scrollbar min-h-0 flex-1 overflow-y-auto pt-1 pb-2">
        {children}
      </div>
      {footer}
    </div>
  );
}

/** Level-2 active row — island: square left edge, 2px accent bar, rounded right. */
export function IslandRow({
  active = false,
  onClick,
  children,
  className,
  indent = false,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  indent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative mx-2 flex h-8 w-[calc(100%-16px)] shrink-0 items-center gap-2 px-3 text-left text-base",
        COLOUR,
        indent && "pl-6",
        active
          ? "rounded-l-none rounded-r-md bg-ds-gray-alpha-200 text-ink"
          : "rounded-md text-ink-2 hover:bg-ds-gray-alpha-100 hover:text-ink",
        className,
      )}
    >
      {active ? (
        <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-accent-z" />
      ) : null}
      {children}
    </button>
  );
}
