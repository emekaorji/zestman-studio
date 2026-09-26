import { useCallback, useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useStore } from "@/state/store";
import { buildCommands, type PaletteCommand } from "@/studio/commands";
import { Kbd, MethodBadge } from "@/components/primitives";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

const GROUP_LABELS: Record<PaletteCommand["group"], string> = {
  routes: "Routes",
  actions: "Actions",
  operator: "Operator",
};

const GROUP_ORDER: Array<PaletteCommand["group"]> = ["routes", "actions", "operator"];

/**
 * The search row is shadcn's `CommandInput`, repainted to Vercel's 48px palette
 * header: no inner control chrome, one hairline under it, a 16px search glyph
 * at 1.5 stroke. Restyling by descendant selector keeps cmdk's combobox wiring
 * (aria-expanded, aria-activedescendant, the listbox relationship) intact.
 */
const INPUT_SKIN = [
  "[&_[data-slot=command-input-wrapper]]:shrink-0 [&_[data-slot=command-input-wrapper]]:border-b",
  "[&_[data-slot=command-input-wrapper]]:border-line [&_[data-slot=command-input-wrapper]]:p-0",
  "[&_[data-slot=input-group]]:h-12! [&_[data-slot=input-group]]:rounded-none!",
  "[&_[data-slot=input-group]]:border-0 [&_[data-slot=input-group]]:bg-transparent",
  "[&_[data-slot=input-group]]:ring-0! [&_[data-slot=input-group]]:px-1.5",
  "[&_[data-slot=input-group-addon]]:text-ink-3",
  "[&_[data-slot=input-group-addon]_svg]:opacity-100 [&_[data-slot=input-group-addon]_svg]:[stroke-width:1.5]",
].join(" ");

/** ⌘⏎ on a route row: open it in the workbench and fire the request. */
function runSendNow(cmd: PaletteCommand) {
  if (!cmd.routeId) {
    cmd.run();
    return;
  }
  const s = useStore.getState();
  s.setPaletteOpen(false);
  s.navigate({ go: "route", routeId: cmd.routeId });
  const s2 = useStore.getState();
  if (s2.activeTabId) void s2.send(s2.activeTabId);
}

export function CommandPalette() {
  const open = useStore((s) => s.paletteOpen);
  const setPaletteOpen = useStore((s) => s.setPaletteOpen);
  return (
    // PaletteInner must stay mounted: tearing it out in the same tick `open`
    // flips false denies Radix Presence the chance to run the exit animation.
    <Dialog open={open} onOpenChange={setPaletteOpen}>
      <PaletteInner />
    </Dialog>
  );
}

/**
 * Mounted only while open, so the command list is rebuilt from a fresh store
 * snapshot every time and the search box starts empty.
 */
function PaletteInner() {
  const setPaletteOpen = useStore((s) => s.setPaletteOpen);
  const commands = useMemo(() => buildCommands(useStore.getState()), []);

  /* cmdk owns filtering, highlight and ↑/↓; `value` is the highlighted row. */
  const [value, setValue] = useState(() => commands[0]?.id ?? "");

  const byValue = useMemo(() => {
    const map = new Map<string, PaletteCommand>();
    for (const c of commands) map.set(c.id.toLowerCase(), c);
    return map;
  }, [commands]);

  /* cmdk's default scorer is a fuzzy subsequence match, which makes "user"
     light up /api/v1/products. Every token typed must appear literally in the
     row's own text instead — predictable, and it never returns junk. */
  const haystack = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of commands) {
      map.set(c.id.toLowerCase(), `${c.method ?? ""} ${c.label} ${c.sublabel ?? ""}`.toLowerCase());
    }
    return map;
  }, [commands]);

  const filter = useCallback(
    (itemValue: string, search: string) => {
      const text = haystack.get(itemValue.toLowerCase()) ?? itemValue;
      const tokens = search.toLowerCase().split(/\s+/).filter(Boolean);
      return tokens.every((t) => text.includes(t)) ? 1 : 0;
    },
    [haystack],
  );

  const groups = useMemo(
    () => GROUP_ORDER.map((g) => ({ group: g, cmds: commands.filter((c) => c.group === g) })).filter((s) => s.cmds.length > 0),
    [commands],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey)) return;
      const cmd = byValue.get(value.toLowerCase());
      if (!cmd) return;
      e.preventDefault();
      e.stopPropagation();
      runSendNow(cmd);
    },
    [byValue, value],
  );

  return (
    <DialogContent
      showCloseButton={false}
      aria-describedby={undefined}
      onEscapeKeyDown={(e) => {
        /* The app owns Escape globally; take it here so this closes exactly
           once and the exit animation still plays. */
        e.preventDefault();
        e.stopPropagation();
        setPaletteOpen(false);
      }}
      /* Vercel's palette scales in from 0.98 — barely there, but it stops the
         panel from snapping into existence. Set as a property so it wins over
         the shadcn Dialog's own zoom-in-95. */
      style={{ "--tw-enter-scale": 0.98, "--tw-exit-scale": 0.98 } as CSSProperties}
      className={cn(
        "top-[8dvh] flex w-[760px] max-w-[calc(100vw-2rem)] translate-y-0 flex-col gap-0 overflow-hidden sm:top-[13dvh]",
        "rounded-2xl bg-ds-background-100 p-0 text-base text-ink ring-0 sm:max-w-[calc(100vw-2rem)]",
        "shadow-[var(--ds-shadow-modal)] duration-[var(--dur-base)] ease-[var(--ease-out)]",
      )}
    >
      <DialogTitle className="sr-only">Command palette</DialogTitle>
      <Command
        loop
        filter={filter}
        value={value}
        onValueChange={setValue}
        onKeyDown={onKeyDown}
        className={cn("gap-0 rounded-none! bg-transparent p-0", INPUT_SKIN)}
      >
        <CommandInput
          placeholder="Search routes and actions…"
          className="h-12 text-base text-ink placeholder:text-ink-3"
        />
        {/* cmdk publishes the measured content height as --cmdk-list-height, so
            the panel can EASE to its new size as results filter down instead of
            snapping between heights. */}
        <CommandList
          className={cn(
            /* shadcn's CommandList ships `no-scrollbar`, a class this project
               does not define — so the palette scrolls with a visible bar
               Vercel's does not have. `hide-scrollbar` is the real one. */
            "fade-scroll hide-scrollbar h-[var(--cmdk-list-height)] max-h-[min(52vh,420px)] scroll-py-2 p-0",
            "transition-[height] duration-[var(--dur-panel)] ease-[var(--ease-panel)]",
          )}
        >
          <CommandEmpty className="flex h-20 items-center justify-center py-0 text-base text-ink-3">
            No matches
          </CommandEmpty>
          {groups.map((section) => (
            <CommandGroup
              key={section.group}
              heading={GROUP_LABELS[section.group]}
              className={cn(
                "p-0 pt-1.5",
                "**:[[cmdk-group-heading]]:flex **:[[cmdk-group-heading]]:h-8 **:[[cmdk-group-heading]]:items-end",
                "**:[[cmdk-group-heading]]:px-4 **:[[cmdk-group-heading]]:pb-1.5",
                "**:[[cmdk-group-heading]]:text-caps **:[[cmdk-group-heading]]:font-medium",
                "**:[[cmdk-group-heading]]:tracking-[0.08em] **:[[cmdk-group-heading]]:text-ink-3",
                "**:[[cmdk-group-heading]]:uppercase",
              )}
            >
              {section.cmds.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.id}
                  onSelect={() => c.run()}
                  className={cn(
                    "h-10 gap-2.5 rounded-none px-4 in-data-[slot=dialog-content]:rounded-none!",
                    "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
                    "data-selected:bg-ds-gray-alpha-200 data-selected:text-ink",
                  )}
                >
                  {c.method ? (
                    <>
                      <MethodBadge method={c.method} />
                      <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{c.label}</span>
                      {c.sublabel ? (
                        <span className="shrink-0 font-mono text-xs text-ink-3">{c.sublabel}</span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate text-base text-ink">{c.label}</span>
                      {c.kbd ? <Kbd className="shrink-0">{c.kbd}</Kbd> : null}
                    </>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          {/* Inside the measured sizer, so the eased height includes it. */}
          <div aria-hidden className="h-1.5" />
        </CommandList>
      </Command>
      <div className="flex h-10 shrink-0 items-center gap-4 border-t border-line px-4 text-xs text-ink-3">
        <span className="flex items-center gap-1.5">
          <Kbd>↑↓</Kbd> navigate
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>⏎</Kbd> open
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>⌘⏎</Kbd> send now
        </span>
      </div>
    </DialogContent>
  );
}
