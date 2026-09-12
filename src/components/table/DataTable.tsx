import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface ColumnDef<Row> {
  id: string;
  header: string;
  /** px width; omit for the flex column (exactly one column should omit). */
  width?: number;
  align?: "left" | "right" | "center";
  /** Render this column's cells in Geist Mono 13/20 (ids, paths, timings). */
  mono?: boolean;
  cell: (row: Row) => ReactNode;
}

export interface RowGroup<Row> {
  label: string;
  rows: Row[];
}

/* Rows fade in with a short stagger instead of popping in as a block. */
const STAGGER_MS = 15;
const STAGGER_MAX = 12;

/** Roving tabindex: ↑/↓ walk the grid's rows, keeping one tab stop. */
function moveRowFocus(from: HTMLTableRowElement, dir: 1 | -1) {
  const scope = from.closest("tbody");
  if (!scope) return;
  const all = Array.from(scope.querySelectorAll<HTMLTableRowElement>("tr[data-row]"));
  const next = all[all.indexOf(from) + dir];
  if (!next) return;
  from.tabIndex = -1;
  next.tabIndex = 0;
  next.focus();
}

/**
 * THE data table, on Vercel's log-table metrics: h40 header in gray-600 sentence
 * case, dense h32 rows, hover and selection as an inset rounded fill that eases
 * in over --dur-base, and a sticky header.
 *
 * Rows are real `tr`s inside a shadcn `Table`; when `onRowClick` is given the
 * table becomes a grid whose rows are focusable and activate on Enter/Space.
 */
export function DataTable<Row>({
  columns,
  rows,
  groups,
  rowKey,
  rowHeight = 32,
  onRowClick,
  isSelected,
  isHover,
  trailing,
  className,
  label,
  mono = false,
  maxHeight,
}: {
  columns: Array<ColumnDef<Row>>;
  rows?: Row[];
  groups?: Array<RowGroup<Row>>;
  rowKey: (row: Row) => string;
  rowHeight?: number;
  onRowClick?: (row: Row) => void;
  isSelected?: (row: Row) => boolean;
  isHover?: (row: Row) => boolean;
  /** Extra row rendered after all rows (e.g. "… 16 more", an add-row form). */
  trailing?: ReactNode;
  className?: string;
  /** Accessible name for the grid — used when rows are interactive. */
  label?: string;
  /** Render every cell in Geist Mono (log-style tables). */
  mono?: boolean;
  /** Give the table its own scroll region of this height, with scroll fog. */
  maxHeight?: number;
}) {
  const interactive = onRowClick != null;
  const last = columns.length - 1;

  const alignClass = (c: ColumnDef<Row>) =>
    c.align === "right" ? "justify-end text-right" : c.align === "center" ? "justify-center text-center" : "";

  const cellClass = (c: ColumnDef<Row>, i: number) =>
    cn(
      // No per-row hairline: Vercel's tables get their structure from the
      // hover/selected background, and a line under every row is the single
      // biggest tell of a hand-rolled table. See docs/vercel-parity.md.
      "px-1.5 py-0 align-middle whitespace-normal",
      "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
      mono || c.mono ? "font-mono text-sm" : "text-base",
      i === 0 && "rounded-l-md pl-2",
      i === last && "rounded-r-md pr-2",
    );

  /* Flat position across groups — drives the enter stagger and the roving
     tabindex (one tab stop into the grid, then ↑/↓ between rows). */
  let flat = 0;

  const renderRow = (row: Row) => {
    const index = flat++;
    const selected = isSelected?.(row) === true;
    const hovered = isHover?.(row) === true;
    const activate = onRowClick ? () => onRowClick(row) : undefined;
    const onKeyDown = onRowClick
      ? (e: KeyboardEvent<HTMLTableRowElement>) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onRowClick(row);
            return;
          }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            moveRowFocus(e.currentTarget, e.key === "ArrowDown" ? 1 : -1);
          }
        }
      : undefined;

    return (
      <TableRow
        key={rowKey(row)}
        data-row=""
        onClick={activate}
        onKeyDown={onKeyDown}
        tabIndex={interactive ? (index === 0 ? 0 : -1) : undefined}
        aria-selected={interactive ? selected : undefined}
        data-selected={selected ? "" : undefined}
        style={{ animationDelay: `${Math.min(index, STAGGER_MAX) * STAGGER_MS}ms` }}
        className={cn(
          "group/row animate-in fade-in-0 fill-mode-both border-0 duration-[var(--dur-base)] ease-[var(--ease-out)]",
          "hover:bg-transparent has-aria-expanded:bg-transparent",
          interactive && "cursor-pointer",
          /* Reveal-on-row-hover affordances inside cells (delete/copy icons). */
          "[&_.opacity-0]:transition-opacity hover:[&_.opacity-0]:opacity-100 focus-visible:[&_.opacity-0]:opacity-100",
        )}
      >
        {columns.map((c, i) => (
          <TableCell
            key={c.id}
            className={cn(
              cellClass(c, i),
              selected
                ? "bg-ds-gray-200"
                : hovered
                  ? "bg-ds-gray-alpha-100"
                  : interactive
                    ? "group-hover/row:bg-ds-gray-alpha-100 group-focus-visible/row:bg-ds-gray-alpha-100"
                    : "",
            )}
          >
            <div
              style={{ height: rowHeight }}
              className={cn("flex min-w-0 items-center gap-2 overflow-hidden", alignClass(c))}
            >
              {c.cell(row)}
            </div>
          </TableCell>
        ))}
      </TableRow>
    );
  };

  const colStyle = (c: ColumnDef<Row>): CSSProperties | undefined =>
    c.width != null ? { width: c.width } : undefined;

  const body = (
    <Table
      role={interactive ? "grid" : undefined}
      aria-label={label}
      className="w-full table-fixed border-separate border-spacing-0 text-base"
    >
      <colgroup>
        {columns.map((c) => (
          <col key={c.id} style={colStyle(c)} />
        ))}
      </colgroup>
      <TableHeader>
        <TableRow className="border-0 hover:bg-transparent">
          {columns.map((c, i) => (
            <TableHead
              key={c.id}
              scope="col"
              className={cn(
                "sticky top-0 z-10 h-10 border-b border-line bg-canvas px-1.5 text-base font-normal text-ds-gray-600",
                i === 0 && "pl-2",
                i === last && "pr-2",
                c.align === "right" && "text-right",
                c.align === "center" && "text-center",
              )}
            >
              {c.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups
          ? groups.map((g) => (
              <Fragment key={g.label}>
                <TableRow className="border-0 hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="h-9 border-0 px-2 pt-3 align-bottom">
                    <span className="caps-label">{g.label}</span>
                  </TableCell>
                </TableRow>
                {g.rows.map(renderRow)}
              </Fragment>
            ))
          : rows?.map(renderRow)}
        {trailing ? (
          <TableRow className="border-0 hover:bg-transparent">
            <TableCell colSpan={columns.length} className="border-0 p-0 px-2">
              {trailing}
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );

  return (
    <div
      /* The shadcn table container is a scroll container, which would swallow
         the sticky header; neutralise it so the header pins to the real
         scroller (this wrapper when maxHeight is set, the page otherwise). */
      className={cn(
        "relative -mx-2 min-w-0 [&_[data-slot=table-container]]:overflow-x-visible",
        maxHeight != null && "fade-scroll overflow-y-auto",
        className,
      )}
      style={maxHeight != null ? { maxHeight } : undefined}
    >
      {body}
    </div>
  );
}
