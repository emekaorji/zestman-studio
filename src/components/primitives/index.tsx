import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { methodClass } from "@/lib/methods";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/*
 * Studio primitives.
 *
 * Every interactive one is a thin wrapper over a shadcn component so focus,
 * keyboard and aria wiring come from Radix rather than from us. The
 * non-interactive ones (badges, dots, labels) are typography, and follow the
 * Geist scale in docs/vercel-parity.md.
 */

/* ── MethodBadge — mono caps, coloured text, no fill, fixed width in lists ── */

export function MethodBadge({
  method,
  className,
  fixed = true,
}: {
  method: string;
  className?: string;
  fixed?: boolean;
}) {
  return (
    <span
      className={cn(
        "font-mono text-2xs font-semibold tracking-[0.04em]",
        fixed && "inline-block w-11 shrink-0",
        methodClass(method),
        className,
      )}
    >
      {method.toUpperCase()}
    </span>
  );
}

/* ── StatusChip — Geist status pill: 2xx ok · 3xx/4xx warn · 5xx err ─────── */

function statusTone(code: number): string {
  if (code === 0) return "bg-err-soft text-err";
  if (code < 300) return "bg-ok-soft text-ok";
  if (code < 500) return "bg-warn-soft text-warn";
  return "bg-err-soft text-err";
}

export function StatusChip({ code, label, className }: { code: number; label?: string; className?: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-5 shrink-0 rounded-md border-transparent px-1.5 font-mono text-2xs font-medium tabular-nums",
        statusTone(code),
        className,
      )}
    >
      {label ?? (code === 0 ? "ERR" : code)}
    </Badge>
  );
}

/* ── Pill — generic soft chip ─────────────────────────────────────────────── */

const PILL_TONES = {
  neutral: "bg-ds-gray-alpha-200 text-ink-2",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  err: "bg-err-soft text-err",
  accent: "bg-accent-z-soft text-link-z",
} as const;

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "err" | "accent";
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-5 shrink-0 rounded-full border-transparent px-2 text-2xs font-medium",
        PILL_TONES[tone],
        className,
      )}
    >
      {children}
    </Badge>
  );
}

/* ── Kbd — 20px key cap ───────────────────────────────────────────────────── */

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 items-center rounded-sm border border-ds-gray-400 bg-ds-gray-100 px-1.5 font-mono text-2xs font-normal text-ink-2",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/* ── CapsHeader — the caps section label row ──────────────────────────────── */

export function CapsHeader({
  children,
  right,
  className,
}: {
  children: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex h-8 items-center justify-between", className)}>
      <span className="caps-label">{children}</span>
      {right}
    </div>
  );
}

/* ── SegmentedControl ─────────────────────────────────────────────────────
   Radix ToggleGroup (roving tabindex, arrow keys, aria) painted as Vercel's
   segmented control: a sunken gray-100 track with a raised pill that SLIDES
   between options rather than jumping.
   ───────────────────────────────────────────────────────────────────────── */

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  const count = options.length;

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const el = root.querySelector<HTMLElement>(`[data-seg="${value}"]`);
      if (!el) return;
      const left = el.offsetLeft;
      const width = el.offsetWidth;
      setPill((p) => (p && p.left === left && p.width === width ? p : { left, width }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [value, count]);

  return (
    <div ref={rootRef} className={cn("min-w-0", className)}>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => {
          if (v) onChange(v as T);
        }}
        className={cn(
          "relative w-full gap-0 rounded-md bg-ds-gray-100 p-[3px]",
          size === "sm" ? "h-7" : "h-8",
        )}
      >
        {pill ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-[3px] left-0 rounded-md bg-ds-background-100 shadow-[var(--ds-shadow-small)] transition-[transform,width] duration-[var(--dur-base)] ease-[var(--ease-out)]"
            style={{ transform: `translateX(${pill.left}px)`, width: pill.width }}
          />
        ) : null}
        {options.map((o) => (
          <ToggleGroupItem
            key={o.value}
            value={o.value}
            data-seg={o.value}
            aria-label={o.label}
            className={cn(
              "relative z-10 h-full min-w-0 flex-1 rounded-md bg-transparent px-3 text-base font-medium whitespace-nowrap transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
              "hover:bg-transparent aria-pressed:bg-transparent data-[state=on]:bg-transparent",
              o.value === value ? "text-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

/* ── ConfidenceDot ────────────────────────────────────────────────────────── */

export function ConfidenceDot({ level }: { level: "certain" | "inferred" | "none" }) {
  if (level === "none") return <span className="size-1.5 shrink-0 rounded-full border border-line-strong" />;
  return <span className={cn("size-1.25 shrink-0 rounded-full", level === "certain" ? "bg-ok" : "bg-warn")} />;
}

/* ── Dot — tiny status dot ────────────────────────────────────────────────── */

export function Dot({
  tone = "ok",
  className,
  label,
}: {
  tone?: "ok" | "warn" | "err" | "muted" | "link";
  className?: string;
  /** Screen-reader text. A dot that encodes state MUST carry one. */
  label?: string;
}) {
  return (
    <>
      <span
        aria-hidden
        className={cn(
          "inline-block size-1.5 shrink-0 rounded-full",
          tone === "ok" && "bg-ok",
          tone === "warn" && "bg-warn",
          tone === "err" && "bg-err",
          tone === "link" && "bg-link-z",
          tone === "muted" && "bg-ink-3",
          className,
        )}
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </>
  );
}

/* ── EmptyState ───────────────────────────────────────────────────────────── */

export function EmptyState({
  icon,
  title,
  sub,
  className,
}: {
  icon?: ReactNode;
  title: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-2 text-center",
        "animate-in fade-in-0 duration-[var(--dur-slow)] ease-[var(--ease-out)]",
        className,
      )}
    >
      {icon ? <div className="text-ds-gray-500">{icon}</div> : null}
      <div className="text-base text-ink-3">{title}</div>
      {sub ? <div className="text-xs text-ds-gray-600">{sub}</div> : null}
    </div>
  );
}

/* ── GhostButton — Vercel's secondary button (shadcn Button, outline) ─────── */

/**
 * Rest props are spread onto the underlying shadcn Button on purpose: without
 * that, `<DropdownMenuTrigger asChild>` cannot hand it a ref, aria-expanded or
 * its pointer handlers, and the menu silently never opens.
 */
export function GhostButton({
  children,
  size = "md",
  tone = "default",
  className,
  ...rest
}: Omit<React.ComponentProps<typeof Button>, "size" | "variant"> & {
  size?: "sm" | "md" | "lg";
  tone?: "default" | "danger";
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size={size === "sm" ? "default" : "lg"}
      {...rest}
      className={cn(
        "gap-1.5 rounded-lg border-ds-gray-400 bg-transparent text-base font-medium text-ink-2",
        "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
        "hover:bg-hoverbg hover:text-ink dark:bg-transparent dark:hover:bg-hoverbg",
        size === "sm" ? "h-8 px-2.5" : "h-9 px-3",
        tone === "danger" && "text-err hover:bg-err-soft hover:text-err",
        className,
      )}
    >
      {children}
    </Button>
  );
}

/* ── AccentButton — THE one filled action per screen ──────────────────────── */

export function AccentButton({
  children,
  className,
  size = "md",
  ...rest
}: Omit<React.ComponentProps<typeof Button>, "size" | "variant"> & {
  size?: "md" | "lg";
}) {
  return (
    <Button
      type="button"
      variant="default"
      size="lg"
      {...rest}
      className={cn(
        "h-9 gap-1.5 rounded-lg px-3 text-base font-medium",
        "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
        size === "lg" && "px-3.5",
        className,
      )}
    >
      {children}
    </Button>
  );
}

/* ── MiniSwitch — shadcn Switch (keyboard + aria for free) ────────────────── */

export function MiniSwitch({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange?: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <Switch
      checked={on}
      onCheckedChange={(v) => onChange?.(v)}
      disabled={disabled}
      aria-label={label ?? "Toggle"}
      className="shrink-0 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]"
    />
  );
}

/* ── VarChip — {{variable}} rendering in URLs ─────────────────────────────── */

export function VarChip({ name, unresolved = false }: { name: string; unresolved?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-1 font-mono text-sm",
        unresolved ? "bg-err-soft text-err" : "bg-ds-gray-alpha-200 text-link-z",
      )}
    >
      {"{{" + name + "}}"}
    </span>
  );
}
