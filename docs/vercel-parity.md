# Vercel parity — the design contract

Everything below was measured off a live Vercel dashboard capture
(`workbench/vercel.mhtml`, the Logs page) with `getComputedStyle`, not eyeballed.
When a number here disagrees with a component, the component is wrong.

## Foundations

| Thing | Value |
| --- | --- |
| Font (UI) | Geist Sans — `--font-sans` |
| Font (data) | Geist Mono — `--font-mono` |
| Body | 14px / 20px, weight 400 |
| Page background | `--ds-background-200` (dark: pure black) |
| Panel / card / popover | `--ds-background-100` (dark: `#0a0a0a`) |
| Hairline | `--ds-gray-200` |
| Body text | `--ds-gray-1000` |
| Secondary text | `--ds-gray-900` |
| Muted text | `--ds-gray-700` |
| Control radius | 6px (`rounded-lg` → `--radius`) |

Colour comes only from `tokens.css`. No hex literals in feature code, ever.
The Geist scales are addressable as utilities too: `bg-ds-gray-100`,
`text-ds-blue-900`, `border-ds-gray-400`.

## Type scale

| Token | Size / line-height | Used for |
| --- | --- | --- |
| `text-2xs` | 11 / 16 | caps labels, badges |
| `text-xs` | 12 / 16 | dense metadata |
| `text-sm` | 13 / 20 | mono data rows |
| `text-base` | 14 / 20 | **default UI text** |
| `text-md` | 16 / 24 | page titles |
| `text-lg` | 20 / 26 | section headings |
| `text-xl` | 24 / 32 | page titles |

Vercel's own observed usages: nav item 14/20 w500 · section header 14/20 w600 ·
column header 14/24 gray-600 · data cell 13/24 mono · detail label 14/20 gray-900.

## Control metrics

| Control | Height | Notes |
| --- | --- | --- |
| Top nav | 56 | |
| Sidebar nav row | 40 | radius 6, full-bleed inside 8px gutter |
| Section header row | 44 | 14px w600 |
| Button `sm` | 32 | padding 0 6px |
| Button `md` (default) | 36 | padding 0 10px |
| Input / search | 36 | bg `--ds-gray-100`, padding 0 12px |
| Table header row | 40 | |
| Dense data row | 30–32 | mono 13px, cell padding 0 6px, first cell pl-4 |
| Round icon button | 24 | the panel toggles |

Use `Button`/`Input`/`Select`… from `@/components/ui`. Do not hand-roll a
control that shadcn already ships — that is where the accessibility comes from.

## Tables

Vercel's log table is the model for every dense table in the studio:

- **No per-row hairlines.** Rows are separated by nothing at all; structure comes
  from the hover/selected background, not from lines. A hairline under every row
  is the single biggest thing that makes a table look hand-rolled.
- One hairline under the header row, and that is it.
- Row height 30–32, mono `text-sm`, cell padding `0 6px`, first cell `pl-4`.
- Hover `--ds-gray-alpha-100`; selected `--ds-gray-200`, both `rounded-md` so the
  highlight is an inset pill, not a full-bleed band.
- Header row 40 tall, `text-base`, `--ds-gray-600`, sticky.
- The scroll body gets `fade-scroll`.

## Motion

Durations `--dur-instant 75` · `--dur-fast 100` · `--dur-base 150` ·
`--dur-slow 250` · `--dur-panel 350`.

Easings — all three are Vercel's own:

- `--ease-out` `cubic-bezier(0, 0, .2, 1)` — things entering
- `--ease-in-out` `cubic-bezier(.4, 0, .2, 1)` — the default, hover/colour
- `--ease-panel` `cubic-bezier(.32, .72, 0, 1)` — panels opening, collapsing, resizing

Rules:

1. Nothing changes size, position or visibility instantly. If it moves, it eases.
2. Enter/exit uses `tw-animate-css` (`animate-in fade-in-0 zoom-in-95`, …) — the
   same system Vercel uses, and what shadcn components already ship with.
3. Hover/active colour transitions are `--dur-base` `--ease-in-out`.
4. Panel geometry animates on `--dur-panel` `--ease-panel`, and **only** when not
   actively dragging (during a drag it must track the pointer 1:1, no lag).
5. Respect `prefers-reduced-motion` — handled globally in `globals.css`.

## Scroll fog

Every scrollable region that runs under a header, footer or panel edge gets
`.fade-scroll` (vertical) or `.fade-scroll-x` (horizontal). It is Vercel's exact
implementation: a mask whose stops are driven by a scroll-timeline animation, so
the fade tracks scroll position with no JS. 40px (`--fog-size`).

Pair it with `.hide-scrollbar` where Vercel hides the bar (sidebar nav).

## Panels

Sidebar, right rail and bottom drawer are **all** drag-resizable and can be
collapsed to nothing and brought back. Vercel's mechanism, which we copy:

- Size lives in a CSS custom property on `<html>` (`--sidebar-w`, `--rail-w`,
  `--drawer-h`) so dragging never re-renders React.
- The handle is a zero-width absolutely-positioned strip on the panel edge with
  `cursor: col-resize` (or `row-resize`) and a widened invisible hit area
  (16px) so it is easy to grab.
- A 1px line (`--ds-gray-400`) fades in on hover:
  `transition: opacity 100ms ease 75ms`.
- A 24px round toggle button sits centred on the edge, appears on hover
  (`transition: opacity 150ms ease 150ms`), background `--ds-background-100`,
  border `--ds-gray-400`, and collapses/restores the panel.
- Dragging a panel below ~55% of its minimum collapses it instead of leaving a
  sliver.

- A fully collapsed panel must still be reachable. Vercel keeps a persistent
  collapsed bar (see the "Logs" bar with a chevron at the bottom of the
  reference screenshot) rather than hiding the panel without a trace. The
  sidebar and rail have their top-nav toggles; the **response drawer needs a
  collapsed bar** — a 32px strip showing the response status and a chevron that
  restores it.
- Keyboard: ⌘B sidebar · ⌘⌥B rail · ⌘J drawer. The drag handles are focusable
  separators; arrows resize, shift+arrow resizes faster, Enter collapses.

Use `@/components/shell/ResizablePanel` — do not re-implement it per panel.

## Responsive

The design is drawn at desktop width. Below it, the studio adapts rather than
shrinks — nothing is redesigned, panels change *mode* and content reflows.

| Width | Sidebar | Rail | Notes |
| --- | --- | --- | --- |
| < 768, or < 500 tall | sheet | sheet | phones, incl. landscape |
| 768 – 1279 | inline | sheet | iPad, resized laptop window |
| ≥ 1280 | inline | inline | the drawn layout |

Rules, all enforced somewhere central — follow them, do not re-solve per page:

- **Panels** switch between inline and overlay in `Shell` via `useLayout()`
  (`lib/useMediaQuery.ts`). Overlay open state (`sidebarOverlayOpen`,
  `railOverlayOpen`) is transient and **never persisted**, so a phone visit
  cannot overwrite desktop collapse preferences. Reaching a destination closes a
  sheet; Escape and the scrim close it too.
- **Tables** scroll sideways inside `DataTable` with a width floor, never crush.
  Mark secondary columns `hideBelow: "sm" | "md" | …`. Below `sm`, fixed columns
  wider than 140px are capped (their cells already truncate) so the key column
  stays in view.
- **Title / toolbar rows**: `flex-wrap` + `min-h-*` (or `minHeight`), never a
  fixed height with `shrink-0` actions — that clips on a phone.
- **Heights** use `dvh`, not `vh` or `%`, so mobile browser chrome never hides
  the status bar or a dialog's footer.
- **Touch** (`pointer: coarse`): drag separators are hidden; hover-revealed panel
  toggles are always visible; `touch-action: manipulation` removes tap delay.
- **Never put `.fade-scroll` on an element that also paints an opaque
  background.** The mask makes that background transparent at the fogged edge
  and whatever is behind shows through. Fog an inner scroller instead.

## React 19

The studio runs React 19. This is a hard requirement of the shadcn components in
`src/components/ui`: they are written ref-as-prop with no `forwardRef`, which is
React 19 semantics. On React 18 every `asChild` composition silently failed to
forward its ref, which broke Radix positioning and focus management while
looking fine on screen. Do not downgrade.

## Accessibility

Non-negotiable, and mostly free if shadcn is used as intended:

- Every interactive element is a real `button`/`a`/`input`, or has the right
  `role` + keyboard handling. A clickable `div` is a bug.
- Pointer cursor on anything clickable (global rule in `globals.css`).
- Visible focus ring via `:focus-visible` (Geist blue) — never `outline: none`
  without a replacement.
- Icon-only buttons carry `aria-label`.
- Dialogs/menus/tooltips come from shadcn so focus trap, escape, and
  `aria-*` wiring are already correct.

## Interaction states

Vercel writes hover and keyboard focus as **one rule**, so a keyboard user sees
exactly what a mouse user sees:

```css
.thing:hover, .thing:focus-visible { background: var(--ds-gray-100); }
```

In Tailwind that is `hover:bg-ds-gray-100 focus-visible:bg-ds-gray-100`. Do this
for every row, menu item and nav item — never style hover alone.

| Surface | Hover | Selected / active |
| --- | --- | --- |
| Row over the page background | `--ds-gray-alpha-100` | `--ds-gray-alpha-200` |
| Row on a raised panel | `--ds-gray-100` | `--ds-gray-200` |
| Ghost button | `--ds-gray-100` | `--ds-gray-200` |

All of them transition over `--dur-base` with `--ease-in-out`.

## Reference capture

`workbench/vercel.mhtml` is the source. Re-measure any time:

```
agent-browser --session vc --allow-file-access open "file:///…/workbench/vercel.mhtml"
agent-browser --session vc eval "getComputedStyle(document.querySelector('…')).fontSize"
```

The decoded stylesheets are also extractable from that file if a rule needs
reading in full.

**One caveat about the capture**: it contains no webfont files, so the page
renders there in fallback fonts. Every *CSS* value in this document (sizes,
colours, spacing, easings) is authoritative. Anything derived from glyph widths
is not — measure that against our own Geist, which is the real typeface and is
confirmed loading (`document.fonts.check('14px "Geist Variable"')`).
