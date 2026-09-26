import type { LucideIcon } from "lucide-react";
import { Check, ChevronDown, ChevronsUpDown, FileOutput, PanelLeft, PanelRight, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useStore } from "@/state/store";
import { FrameworkMark } from "@/components/FrameworkMark";
import { useScope } from "@/studio/scope";
import { projectPath } from "@/lib/slugs";
import { useLayout } from "@/lib/useMediaQuery";
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
  const sidebarOverlayOpen = useStore((s) => s.sidebarOverlayOpen);
  const setSidebarOverlayOpen = useStore((s) => s.setSidebarOverlayOpen);
  const railOverlayOpen = useStore((s) => s.railOverlayOpen);
  const setRailOverlayOpen = useStore((s) => s.setRailOverlayOpen);
  const { sidebarInline, railInline } = useLayout();
  const setPaletteOpen = useStore((s) => s.setPaletteOpen);
  const projects = useStore((s) => s.projects);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const router = useRouter();
  const { org } = useScope();
  const environments = useStore((s) => s.environments);
  const activateEnvironment = useStore((s) => s.activateEnvironment);
  const navigate = useStore((s) => s.navigate);
  const section = useStore((s) => s.section);

  const project = projects.find((p) => p.id === activeProjectId);
  const activeEnv = environments.find((e) => e.isActive);

  /* Below their breakpoints the panels are sheets, so the same buttons drive
     the transient overlay state instead of the persisted collapse state. */
  const sidebarShut = sidebarInline ? sidebarCollapsed : !sidebarOverlayOpen;
  const railShut = railInline ? railCollapsed : !railOverlayOpen;
  const onSidebar = () => (sidebarInline ? toggleSidebar() : setSidebarOverlayOpen(!sidebarOverlayOpen));
  const onRail = () => (railInline ? toggleRail() : setRailOverlayOpen(!railOverlayOpen));

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
          {/* `~` is the org for projects on this machine; a real org name sits
              here once you are signed in to one. */}
          <span className="shrink-0 font-mono text-base text-ink-2" title={org === "~" ? "This machine" : org}>
            {org}
          </span>
          <span aria-hidden className="shrink-0 text-base text-ink-3">
            /
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Project: ${project?.name ?? "none"}`}
                /* Floor so the name truncates to a few characters, never to
                   nothing. From sm up only: on a phone the brand group is ~149px
                   and a floor there pushes the switcher out of its group. */
                className={cn(TRIGGER, "max-w-[240px] sm:min-w-[88px]")}
              >
                <FrameworkMark framework={project?.framework} className="text-ink-2" />
                <span className="truncate font-mono text-base text-ink">{project?.name ?? "—"}</span>
                <ChevronsUpDown size={14} strokeWidth={1.5} className="shrink-0 text-ink-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6} className="w-72">
              {projects.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onSelect={() => router.push(projectPath(org, p.slug))}
                  className="h-8 gap-2 px-2 text-base"
                >
                  <Dot tone={p.online ? "ok" : "muted"} />
                  <FrameworkMark framework={p.framework} className="text-ink-3" />
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

        </div>

        {/* centre — the command-palette trigger. Below sm there is no room for
            a search field, so it becomes the icon it already leads with. */}
        {/* Its 520px basis is taken before the flex-1 side groups get anything,
            so on an iPad it starved the project name to 0px. The search yields
            width on narrower screens instead; at xl it is the drawn 520. */}
        <div
          className={cn(
            "flex min-w-0 justify-center max-sm:flex-none",
            "flex-[0_1_220px] md:flex-[0_1_320px] lg:flex-[0_1_420px] xl:flex-[0_1_520px]",
          )}
        >
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-keyshortcuts="Meta+K"
            aria-label="Search endpoints"
            className={cn(
              "flex items-center gap-2 rounded-md bg-ds-gray-100 text-left hover:bg-ds-gray-200",
              "w-full max-w-[520px] px-3 max-sm:w-9 max-sm:justify-center max-sm:px-0",
              COLOUR,
            )}
            style={{ height: SEARCH_H }}
          >
            <Search size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
            <span className="min-w-0 flex-1 truncate text-base text-ink-3 max-sm:hidden">
              Search endpoints…
            </span>
            <Kbd className="shrink-0 max-lg:hidden">⌘K</Kbd>
          </button>
        </div>

        {/* right — environment · contextual action · panel toggles */}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Environment: ${activeEnv?.name ?? "none"}`}
                className={cn(TRIGGER, "max-w-[180px] max-sm:px-1.5")}
              >
                <Dot tone={activeEnv ? "ok" : "muted"} />
                <span className="truncate text-base text-ink-2 max-sm:hidden">
                  {activeEnv?.name ?? "No env"}
                </span>
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

          {/* Contextual action. Below md the nav has no room for a labelled
              button, so it keeps the affordance and drops the words. */}
          {section === "specs" || section === "docs" ? (
            <Button
              type="button"
              variant="ghost"
              size="default"
              aria-label="Export spec"
              onClick={() => navigate({ go: "dialog", dialog: { kind: "export" } })}
              className={cn(
                "gap-1 text-base font-normal text-ink-2 hover:bg-hoverbg hover:text-ink",
                "max-md:size-9 max-md:px-0",
                COLOUR,
              )}
            >
              <FileOutput size={16} strokeWidth={1.5} className="hidden max-md:block" />
              <span className="max-md:hidden">Export spec</span>
              <ChevronDown size={14} strokeWidth={1.5} className="text-ink-3 max-md:hidden" />
            </Button>
          ) : null}

          <div className="ml-1 flex items-center gap-0.5">
            <PanelToggle icon={PanelLeft} side="sidebar" collapsed={sidebarShut} onToggle={onSidebar} />
            {/* The rail only exists on Routes, so its toggle only shows there. */}
            {section === "routes" ? (
              <PanelToggle icon={PanelRight} side="panel" collapsed={railShut} onToggle={onRail} />
            ) : null}
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
}
