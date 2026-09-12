import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Dot } from "@/components/primitives";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PAGE_TABS_H, REQUEST_TABS_H } from "@/lib/metrics";

export interface TabDef<T extends string = string> {
  id: T;
  label: string;
  count?: number | string;
  /** Tone for the count: drawer "Tests 2/2" is ok when passing, err when failing. */
  countTone?: "ok" | "err";
  dot?: boolean;
  mono?: boolean;
}

/**
 * THE tab strip — a real Radix tablist (roving tabindex, ←/→/Home/End) painted
 * as Vercel's underline tabs.
 *
 * Variants:
 *  - "request": h40 (workbench request tabs, drawer tabs)
 *  - "page":    h44 (section in-page tabs)
 *  - "drawer":  h40
 *
 * The 2px indicator is a single absolutely-positioned bar that SLIDES to the
 * active tab over --dur-base; it is never repainted per button. Overflowing
 * tabs scroll with Vercel's scroll fog rather than clipping.
 */
export function TabStrip<T extends string>({
  tabs,
  active,
  onSelect,
  variant = "request",
  right,
  className,
  label,
  panelId,
}: {
  tabs: Array<TabDef<T>>;
  active: T;
  onSelect: (id: T) => void;
  variant?: "request" | "page" | "drawer";
  right?: ReactNode;
  className?: string;
  /** Names the tablist. Several strips can be on screen at once, so say which. */
  label: string;
  /** id of the `role="tabpanel"` this strip drives, when the caller has one. */
  panelId?: string;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);
  const count = tabs.length;

  useLayoutEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const measure = () => {
      const el = strip.querySelector<HTMLElement>(`[data-tab="${active}"]`);
      if (!el) return;
      const left = el.offsetLeft;
      const width = el.offsetWidth;
      setBar((b) => (b && b.left === left && b.width === width ? b : { left, width }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(strip);
    return () => ro.disconnect();
  }, [active, count]);

  return (
    <div
      ref={stripRef}
      className={cn("flex shrink-0 items-center border-b border-line", className)}
      style={{ height: variant === "page" ? PAGE_TABS_H : REQUEST_TABS_H }}
    >
      <Tabs
        value={active}
        onValueChange={(v) => onSelect(v as T)}
        className="relative h-full min-w-0 flex-1 gap-0"
      >
        <TabsList
          aria-label={label}
          variant="line"
          className="fade-scroll-x hide-scrollbar relative h-full! w-full justify-start gap-5 overflow-x-auto rounded-none bg-transparent p-0"
        >
          {tabs.map((t) => {
            const isActive = t.id === active;
            return (
              <TabsTrigger
                key={t.id}
                value={t.id}
                data-tab={t.id}
                // Radix points aria-controls at a TabsContent we do not render
                // here; callers that have a panel pass its id explicitly.
                aria-controls={panelId}
                className={cn(
                  "relative h-full flex-none gap-1.5 rounded-none border-0 px-0 py-0 text-base font-medium after:hidden",
                  "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
                  t.mono && "font-mono text-sm",
                  isActive ? "text-ink" : "text-ink-2 hover:text-ink",
                )}
              >
                {t.label}
                {t.count != null ? (
                  <span
                    className={cn(
                      "text-xs font-normal tabular-nums",
                      t.countTone === "ok" ? "text-ok" : t.countTone === "err" ? "text-err" : "text-ds-gray-600",
                    )}
                  >
                    {t.count}
                  </span>
                ) : null}
                {t.dot ? <Dot tone="ok" className="size-1.25" /> : null}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {bar ? (
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-0 h-0.5 bg-accent-z transition-[transform,width] duration-[var(--dur-base)] ease-[var(--ease-out)]"
            style={{ transform: `translateX(${bar.left}px)`, width: bar.width }}
          />
        ) : null}
      </Tabs>
      {right ? <div className="ml-auto flex shrink-0 items-center gap-3 pl-3">{right}</div> : null}
    </div>
  );
}
