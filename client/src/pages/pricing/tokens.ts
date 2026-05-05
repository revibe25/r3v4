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
} from '../../../../shared/subscription.types';

export const COLOR = {
  // ── Backgrounds — matches instrument shell exactly ──────────────────────
  bgBase:    "var(--void)",
  bgSurface: "#0a0a0a",
  bgElevate: "#0d0d0d",
  bgHover:   "var(--dj-surface2)",

  // ── Borders ─────────────────────────────────────────────────────────────
  borderSub: "#1c1c1c",
  borderMid: "#2a2a2a",

  // ── Text ────────────────────────────────────────────────────────────────
  textPrimary: "var(--daw-fg)",
  textBody:    "var(--text-secondary)",
  textMuted:   "var(--text-dim)",
  textDim:     "#555555",
  textGhost:   "var(--dj-dimmer)",

  // ── Lime-green accent cascade ────────────────────────────────────────────
  // Primary:  #a3e635  — acid lime  (instrument --ag-acid)
  // Mid:      var(--looper-lime)  — lime-500   (hover state, creator)
  // Deep:     var(--green-400)  — green-400  (pro_artist complement)
  // Muted:    var(--status-ok-dim)  — deep lime  (explorer/free, dim glow)
  cyan:   "#a3e635",   // renamed token — now acid lime primary
  amber:  "var(--looper-lime)",   // pro_artist accent — lime-500
  purple: "var(--green-400)",   // creator accent — green complement
  slate:  "var(--dj-dim)",   // explorer/free — neutral
} as const;

export type ColorToken = keyof typeof COLOR;

import type { SubscriptionTier } from '../../../../shared/subscription.types';

/**
 * Per-tier accent colors.
 * Explorer = neutral slate (free tier, no emphasis)
 * Creator  = lime-500 (var(--looper-lime)) — featured/popular
 * Pro      = acid lime (#a3e635) — premium, matches instrument accent
 */
export const PLAN_ACCENT: Record<SubscriptionTier, string> = {
  explorer:   COLOR.slate,
  creator:    COLOR.amber,
  pro_artist: COLOR.cyan,
};

export const PLAN_GLOW: Record<SubscriptionTier, string> = {
  explorer:   "rgba(68,68,68,0.10)",
  creator:    "rgba(132,204,22,0.10)",
  pro_artist: "rgba(163,230,53,0.12)",
};
