import type { LucideIcon } from "lucide-react";
import { Check, ChevronDown, ChevronsUpDown, PanelLeft, PanelRight, Search } from "lucide-react";
import { useStore } from "@/state/store";
import { Dot, Kbd } from "@/components/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { NAV_H, SEARCH_H } from "@/lib/metrics";

/** Vercel's chrome hover/colour transition — the only motion a nav control needs. */
const COLOUR = "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]";

/** Quiet chrome trigger: 32px, radius 6, hover fill, chevron-up-down glyph. */
const TRIGGER = cn(
  "flex h-8 min-w-0 items-center gap-1.5 rounded-md px-2 text-left outline-none",
  "hover:bg-hoverbg aria-expanded:bg-hoverbg",
  // `outline-none` above kills the global :focus-visible outline (utilities beat
  // @layer base), so the ring has to be put back explicitly.
  "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:bg-hoverbg",
  COLOUR,
);

/** One of the two panel toggles. Real button, tooltip, aria-pressed = collapsed. */
function PanelToggle({
  icon: Icon,
  side,
  collapsed,
  onToggle,
}: {
  icon: LucideIcon;
  side: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const label = `${collapsed ? "Show" : "Hide"} ${side}`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={collapsed}
          onClick={onToggle}
          className={cn("text-ink-2 hover:bg-hoverbg hover:text-ink", COLOUR)}
        >
          <Icon size={16} strokeWidth={1.5} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * THE top bar — h56 on the page background with a hairline under it.
 * Left: wordmark / project switcher. Centre: the command-palette trigger.
 * Right: environment, the contextual action, and the two panel toggles.
 */
export function TopNav() {
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const railCollapsed = useStore((s) => s.railCollapsed);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const toggleRail = useStore((s) => s.toggleRail);
  const setPaletteOpen = useStore((s) => s.setPaletteOpen);
  const projects = useStore((s) => s.projects);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const switchProject = useStore((s) => s.switchProject);
  const environments = useStore((s) => s.environments);
  const activateEnvironment = useStore((s) => s.activateEnvironment);
  const navigate = useStore((s) => s.navigate);
  const section = useStore((s) => s.section);

  const project = projects.find((p) => p.id === activeProjectId);
  const activeEnv = environments.find((e) => e.isActive);

  return (
    <TooltipProvider delayDuration={250}>
      <header
        className="flex shrink-0 items-center gap-3 border-b border-line bg-canvas px-4"
        style={{ height: NAV_H }}
      >
        {/* left — brand · project */}
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <span className="shrink-0 pl-1 text-base font-semibold text-ink">Zestman</span>
          <span aria-hidden className="shrink-0 text-base text-ink-3">
            /
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={cn(TRIGGER, "max-w-[240px]")}>
                <span className="truncate font-mono text-base text-ink">{project?.name ?? "—"}</span>
                <ChevronsUpDown size={14} strokeWidth={1.5} className="shrink-0 text-ink-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6} className="w-72">
              {projects.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onSelect={() => void switchProject(p.id)}
                  className="h-8 gap-2 px-2 text-base"
                >
                  <Dot tone={p.online ? "ok" : "muted"} />
                  <span className="min-w-0 flex-1 truncate font-mono text-base text-ink">
                    {p.name}
                  </span>
                  <span className="shrink-0 text-xs text-ink-3">{p.routeCount} routes</span>
                  {p.id === activeProjectId ? (
                    <Check size={16} strokeWidth={1.5} className="shrink-0 text-ink-2" />
                  ) : (
                    <span aria-hidden className="size-4 shrink-0" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Badge variant="secondary" className="shrink-0 font-normal text-ink-2">
            {project?.framework ?? "express"}
          </Badge>
        </div>

        {/* centre — the command-palette trigger */}
        <div className="flex min-w-0 flex-[0_1_520px] justify-center">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-keyshortcuts="Meta+K"
            className={cn(
              "flex w-full max-w-[520px] items-center gap-2 rounded-md bg-ds-gray-100 px-3 text-left",
              "hover:bg-ds-gray-200",
              COLOUR,
            )}
            style={{ height: SEARCH_H }}
          >
            <Search size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
            <span className="min-w-0 flex-1 truncate text-base text-ink-3">Search endpoints…</span>
            <Kbd className="shrink-0">⌘K</Kbd>
          </button>
        </div>

        {/* right — environment · contextual action · panel toggles */}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={cn(TRIGGER, "max-w-[180px]")}>
                <Dot tone={activeEnv ? "ok" : "muted"} />
                <span className="truncate text-base text-ink-2">{activeEnv?.name ?? "No env"}</span>
                <ChevronsUpDown size={14} strokeWidth={1.5} className="shrink-0 text-ink-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} className="w-56">
              <DropdownMenuLabel className="caps-label px-2 pt-1.5 pb-1">
                Environment
              </DropdownMenuLabel>
              {environments.map((e) => (
                <DropdownMenuItem
                  key={e.id}
                  onSelect={() => void activateEnvironment(e.id)}
                  className="h-8 gap-2 px-2 text-base"
                >
                  <Dot tone={e.isActive ? "ok" : "muted"} />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-base",
                      e.isActive ? "font-medium text-ink" : "text-ink-2",
                    )}
                  >
                    {e.name}
                  </span>
                  {e.isActive ? (
                    <Check size={16} strokeWidth={1.5} className="shrink-0 text-ink-2" />
                  ) : null}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => navigate({ go: "environment", view: "environment" })}
                className="h-8 px-2 text-base text-ink-2"
              >
                Manage environments
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {section === "specs" || section === "docs" ? (
            <Button
              type="button"
              variant="ghost"
              size="default"
              onClick={() => navigate({ go: "dialog", dialog: { kind: "export" } })}
              className={cn("gap-1 text-base font-normal text-ink-2 hover:bg-hoverbg hover:text-ink", COLOUR)}
            >
              Export spec
              <ChevronDown size={14} strokeWidth={1.5} className="text-ink-3" />
            </Button>
          ) : null}

          <div className="ml-1 flex items-center gap-0.5">
            <PanelToggle
              icon={PanelLeft}
              side="sidebar"
              collapsed={sidebarCollapsed}
              onToggle={toggleSidebar}
            />
            <PanelToggle
              icon={PanelRight}
              side="panel"
              collapsed={railCollapsed}
              onToggle={toggleRail}
            />
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
}
