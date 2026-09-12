/**
 * Structural metrics — the single source for every layout number.
 *
 * Values are Vercel's, measured off a live dashboard capture
 * (see docs/vercel-parity.md). Never inline these in features.
 */

/* Chrome */
export const NAV_H = 56; // top nav
export const STATUS_H = 24;
export const TOOLBAR_H = 52; // secondary toolbar row (h-9 control + padding)

/* Panels. Defaults; all three are drag-resizable and collapsible. */
export const SIDEBAR_W = 240;
export const SIDEBAR_MIN_W = 200;
export const SIDEBAR_MAX_W = 420;
export const RAIL_W = 320;
export const RAIL_MIN_W = 260;
export const RAIL_MAX_W = 560;
export const DRAWER_H = 320;
export const DRAWER_MIN_H = 120;
/** Drag below this and the panel snaps shut instead of getting unusably small. */
export const COLLAPSE_THRESHOLD = 0.55;

/* Headers */
export const SIDEBAR_HEAD_H = 40;
export const RAIL_HEAD_H = 40;
export const EDITOR_TABS_H = 40;
export const REQUEST_TABS_H = 40;
export const PAGE_TABS_H = 44;
export const URL_ROW_H = 36;

/* Rows — Vercel: nav 40, dense data 30, table head 40 */
export const ROW_SM = 32; // compact/inline rows
export const ROW_NAV = 40; // sidebar + list rows
export const ROW_MD = 36; // kv rows
export const ROW_DATA = 32; // dense mono data rows
export const ROW_LG = 44; // section table rows

export const TABLE_HEAD_H = 40;
export const CAPS_SUB_H = 32;

/* Controls — Geist button heights */
export const CTRL_XS = 24;
export const CTRL_SM = 32;
export const CTRL_MD = 36;
export const CTRL_LG = 40;

export const DIALOG_HEAD_H = 52;
export const DIALOG_FOOT_H = 56;

export const SEARCH_W = 420;
export const SEARCH_H = 36;

/* Motion — mirrors the CSS custom properties in tokens.css */
export const DUR = {
  instant: 75,
  fast: 100,
  base: 150,
  slow: 250,
  panel: 350,
} as const;

export const EASE = {
  out: "cubic-bezier(0, 0, 0.2, 1)",
  inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  panel: "cubic-bezier(0.32, 0.72, 0, 1)",
} as const;
