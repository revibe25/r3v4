/**
 * Generate a CSS color with alpha transparency.
 * Supports hex (#RRGGBB / #RGB), rgb(), rgba(), CSS variables, and named colors.
 */
export function alpha(color: string, opacity: number): string {
  const a = Math.max(0, Math.min(1, opacity));

  // Hex: #RRGGBB or #RGB
  if (color.startsWith("#")) {
    const hex = color.replace("#", "");
    let r: number, g: number, b: number;
    if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else {
      return color; // malformed hex — pass through
    }
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  // rgb(r, g, b) → rgba(r, g, b, a)
  if (color.startsWith("rgb(") && !color.startsWith("rgba(")) {
    return color.replace("rgb(", "rgba(").replace(")", `, ${a})`);
  }

  // rgba(r, g, b, oldAlpha) → replace old alpha
  if (color.startsWith("rgba(")) {
    return color.replace(/,\s*[\d.]+\s*\)$/, `, ${a})`);
  }

  // CSS variables or named colors → color-mix fallback
  return `color-mix(in srgb, ${color} ${Math.round(a * 100)}%, transparent)`;
}

/* ────────────────────────────────────────────────────────────────────────── */

/**
 * tokens.ts — Canonical R3 v4 pricing UI token source
 *
 * Acid-lime palette aligned with instrument panel (--ag-acid: #a3e635).
 * PlanId is a type alias for SubscriptionTier — the canonical definition
 * lives in shared/subscription.types.ts. Any new tier added there will
 * surface here as a compile error, forcing this map to stay current.
 */
export type {
  SubscriptionTier as PlanId,
  BillingCycle,
} from "../../../../shared/subscription.types";

export const COLOR = {
  // ── Backgrounds — matches instrument shell exactly ──────────────────────
  bgBase:    "#060606",           // Hardcoded (was var(--void))
  bgSurface: "#0a0a0a",
  bgElevate: "#0d0d0d",
  bgHover:   "#1a1a1a",           // Hardcoded fallback (was var(--dj-surface2))

  // ── Borders ─────────────────────────────────────────────────────────────
  borderSub: "#1c1c1c",
  borderMid: "#2a2a2a",

  // ── Text ────────────────────────────────────────────────────────────────
  textPrimary: "#e0e0e0",         // Hardcoded (was var(--daw-fg))
  textBody:    "#e0e0e0",         // Hardcoded (was var(--text-secondary))
  textMuted:   "#888888",         // Hardcoded (was var(--text-dim))
  textDim:     "#555555",
  textGhost:   "#333333",         // Hardcoded (was var(--dj-dimmer))

  // ── Lime-green accent cascade ────────────────────────────────────────────
  cyan:   "#a3e635",              // acid lime primary
  amber:  "#84cc16",              // creator accent — hardcoded (was var(--looper-lime))
  purple: "#22d3ee",              // secondary cyan (was var(--green-400))
  slate:  "#555555",              // explorer/free — neutral (was var(--dj-dim))
  error:  "#ff4455",              // error / destructive accent (red-400)
} as const;

export type ColorToken = keyof typeof COLOR;

import type { SubscriptionTier } from "../../../../shared/subscription.types";

/**
 * Per-tier accent colors.
 * Explorer = neutral slate (free tier, no emphasis)
 * Creator  = lime-500 (var(--looper-lime)) — featured/popular
 * Pro      = acid lime (#a3e635) — premium, matches instrument accent
 */
export const PLAN_ACCENT: Record<SubscriptionTier, string> = {
  explorer:   COLOR.slate,
  creator:    "#84cc16",          // Hardcoded for consistency
  pro_artist: COLOR.cyan,
};

export const PLAN_GLOW: Record<SubscriptionTier, string> = {
  explorer:   "rgba(85,85,85,0.10)",      // matches #555555
  creator:    "rgba(132,204,22,0.10)",    // matches #84cc16
  pro_artist: "rgba(163,230,53,0.12)",    // matches #a3e635
};