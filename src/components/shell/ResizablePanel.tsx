import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { COLLAPSE_THRESHOLD } from "@/lib/metrics";

export type PanelSide = "left" | "right" | "bottom";

/**
 * Vercel's panel-resize mechanism, copied down to the choreography.
 *
 * The live size lives in a CSS custom property on <html>, so a drag never
 * re-renders React — the panel tracks the pointer exactly. The final size is
 * committed to the store on release. Geometry only transitions when the panel
 * is *not* being dragged, so opening/collapsing eases while dragging stays 1:1.
 */

/** Set the size var without going through React. */
function writeVar(cssVar: string, px: number) {
  document.documentElement.style.setProperty(cssVar, `${px}px`);
}

export function useResizeHandle({
  cssVar,
  side,
  size,
  min,
  max,
  collapsed,
  onCommit,
  onCollapsedChange,
}: {
  cssVar: string;
  side: PanelSide;
  size: number;
  min: number;
  max: number;
  collapsed: boolean;
  onCommit: (px: number) => void;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const dragging = useRef(false);
  // Latest values, so a handler fired twice before a re-render still sees truth.
  const live = useRef({ size, collapsed });
  live.current = { size, collapsed };

  // Keep the CSS var in sync whenever the committed size or collapse changes.
  useEffect(() => {
    if (!dragging.current) writeVar(cssVar, collapsed ? 0 : size);
  }, [cssVar, size, collapsed]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Left button only; let the browser handle everything else.
      if (e.button !== 0) return;
      e.preventDefault();
      const startPos = side === "bottom" ? e.clientY : e.clientX;
      const startSize = collapsed ? 0 : size;
      dragging.current = true;

      const root = document.documentElement;
      root.classList.add("panel-dragging");
      // A drag that starts on a collapsed panel re-opens it.
      let live = startSize;
      let isCollapsed = collapsed;

      const move = (ev: PointerEvent) => {
        const pos = side === "bottom" ? ev.clientY : ev.clientX;
        const delta = side === "right" || side === "bottom" ? startPos - pos : pos - startPos;
        const next = startSize + delta;

        if (next < min * COLLAPSE_THRESHOLD) {
          isCollapsed = true;
          live = 0;
          writeVar(cssVar, 0);
          return;
        }
        isCollapsed = false;
        live = Math.min(max, Math.max(min, next));
        writeVar(cssVar, live);
      };

      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        root.classList.remove("panel-dragging");
        dragging.current = false;
        onCollapsedChange(isCollapsed);
        if (!isCollapsed) onCommit(live);
        else writeVar(cssVar, 0);
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    [cssVar, side, size, min, max, collapsed, onCommit, onCollapsedChange],
  );

  /** Keyboard resizing — the handle is a real, focusable separator. */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const horizontal = side !== "bottom";
      const dec = horizontal ? "ArrowLeft" : "ArrowDown";
      const inc = horizontal ? "ArrowRight" : "ArrowUp";
      const step = e.shiftKey ? 48 : 16;
      if (e.key !== dec && e.key !== inc && e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();

      const cur = live.current;
      if (e.key === "Enter" || e.key === " ") {
        onCollapsedChange(!cur.collapsed);
        live.current = { ...cur, collapsed: !cur.collapsed };
        return;
      }
      const dir = e.key === inc ? 1 : -1;
      const signed = side === "left" || side === "bottom" ? dir : -dir;
      const next = (cur.collapsed ? 0 : cur.size) + signed * step;
      if (next < min * COLLAPSE_THRESHOLD) {
        onCollapsedChange(true);
        return;
      }
      onCollapsedChange(false);
      const committed = Math.min(max, Math.max(min, next));
      live.current = { size: committed, collapsed: false };
      onCommit(committed);
    },
    [side, min, max, onCommit, onCollapsedChange],
  );

  return { onPointerDown, onKeyDown };
}

/**
 * The draggable edge: invisible hit strip, a hairline that fades in on hover,
 * and a round toggle centred on the edge — Vercel's exact three parts.
 */
export function ResizeHandle({
  side,
  label,
  collapsed,
  onToggle,
  onPointerDown,
  onKeyDown,
  size,
  min,
  max,
}: {
  side: PanelSide;
  label: string;
  collapsed: boolean;
  onToggle: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  size: number;
  min: number;
  max: number;
}) {
  const horizontal = side !== "bottom";
  const CollapseIcon =
    side === "left" ? ChevronLeft : side === "right" ? ChevronRight : ChevronDown;
  const ExpandIcon = side === "left" ? ChevronRight : side === "right" ? ChevronLeft : ChevronUp;
  const Icon = collapsed ? ExpandIcon : CollapseIcon;

  return (
    <div
      className={cn(
        "group/handle absolute z-30",
        horizontal ? "top-0 h-full w-0" : "left-0 h-0 w-full",
        side === "left" && "-right-px",
        side === "right" && "-left-px",
        side === "bottom" && "-top-px",
      )}
    >
      {/* Wide invisible grab area — 16px, so the edge is easy to hit. */}
      <div
        role="separator"
        aria-label={`Resize ${label}`}
        aria-orientation={horizontal ? "vertical" : "horizontal"}
        aria-valuenow={collapsed ? 0 : size}
        aria-valuemin={0}
        aria-valuemax={max}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        onDoubleClick={onToggle}
        className={cn(
          // A full-height blue outline would be overwhelming, so focus reveals the
          // same hairline + toggle that hover does (see peer-focus-visible below).
          "peer absolute outline-none",
          horizontal ? "inset-y-0 -inset-x-2 cursor-col-resize" : "inset-x-0 -inset-y-2 cursor-row-resize",
        )}
      />
      {/* The hairline, revealed on hover. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute bg-ds-gray-400 opacity-0 group-hover/handle:opacity-100",
          "peer-focus-visible:bg-ds-focus-color peer-focus-visible:opacity-100",
          horizontal ? "top-0 h-full w-px" : "left-0 h-px w-full",
          side === "left" && "right-0",
          side === "right" && "left-0",
          side === "bottom" && "top-0",
        )}
        style={{ transition: "opacity 100ms ease 75ms" }}
      />
      {/* The round toggle, revealed on hover. */}
      <button
        type="button"
        aria-label={`${collapsed ? "Show" : "Hide"} ${label}`}
        onClick={onToggle}
        className={cn(
          "absolute grid size-6 place-content-center rounded-full border border-ds-gray-400 bg-ds-background-100 text-ink-2",
          "opacity-0 group-hover/handle:opacity-100 focus-visible:opacity-100 peer-focus-visible:opacity-100",
          "hover:border-ds-gray-500 hover:bg-ds-gray-100 hover:text-ink",
          horizontal ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
          // Generous invisible hit target around the small circle.
          "before:absolute before:content-['']",
          horizontal ? "before:-inset-x-2 before:-inset-y-6" : "before:-inset-x-6 before:-inset-y-2",
        )}
        style={{ transition: "opacity 150ms ease 150ms, background-color 150ms var(--ease-in-out), border-color 150ms var(--ease-in-out)" }}
      >
        <Icon size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
}

/**
 * A panel whose size is driven by a CSS variable and which collapses to zero.
 * `min`/`max` bound the drag; collapsing is all-the-way, never a sliver.
 */
export function ResizablePanel({
  side,
  label,
  cssVar,
  size,
  min,
  max,
  collapsed,
  onCommit,
  onCollapsedChange,
  className,
  children,
}: {
  side: PanelSide;
  label: string;
  cssVar: string;
  size: number;
  min: number;
  max: number;
  collapsed: boolean;
  onCommit: (px: number) => void;
  onCollapsedChange: (collapsed: boolean) => void;
  className?: string;
  children: ReactNode;
}) {
  const { onPointerDown, onKeyDown } = useResizeHandle({
    cssVar,
    side,
    size,
    min,
    max,
    collapsed,
    onCommit,
    onCollapsedChange,
  });

  const horizontal = side !== "bottom";
  const style: CSSProperties = horizontal
    ? { width: `var(${cssVar})` }
    : { height: `var(${cssVar})` };

  // A collapsed panel must not be reachable by keyboard. `inert` isn't in
  // React 18's prop types, so set it on the node directly.
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (collapsed) el.setAttribute("inert", "");
    else el.removeAttribute("inert");
  }, [collapsed]);

  return (
    <div
      data-collapsed={collapsed || undefined}
      className={cn(
        "relative shrink-0",
        // Geometry eases, except while dragging (the drag must be 1:1).
        // border-color is listed too: callers flip the edge hairline to
        // transparent when collapsed, and a bare width/height transition
        // would reset transition-property and snap that colour.
        "[transition:width_var(--dur-panel)_var(--ease-panel),height_var(--dur-panel)_var(--ease-panel),border-color_var(--dur-panel)_var(--ease-panel)]",
        "[.panel-dragging_&]:transition-none",
        className,
      )}
      style={style}
    >
      {/* Contents keep their layout size while the panel animates shut. */}
      <div
        ref={contentRef}
        className={cn(
          "h-full overflow-hidden",
          collapsed && "pointer-events-none opacity-0",
          "[transition:opacity_var(--dur-base)_var(--ease-out)]",
        )}
        style={horizontal ? { width: collapsed ? size : "100%" } : { height: collapsed ? size : "100%" }}
        aria-hidden={collapsed || undefined}
      >
        {children}
      </div>
      <ResizeHandle
        side={side}
        label={label}
        collapsed={collapsed}
        onToggle={() => onCollapsedChange(!collapsed)}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        size={size}
        min={min}
        max={max}
      />
    </div>
  );
}
