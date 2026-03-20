/**
 * tokens.ts — Canonical R3 v4 pricing UI token source
 *
 * PlanId is a type alias for SubscriptionTier — the canonical definition
 * lives in shared/subscription.types.ts. Any new tier added there will
 * surface here as a compile error, forcing this map to stay current.
 *
 * Color values match the instrument panel palette, not TierDefinition.color
 * (which is used for server-side badge rendering, not the DAW UI shell).
 */

export type {
  SubscriptionTier as PlanId,
  BillingCycle,
} from '../../../../shared/subscription.types';

export const COLOR = {
  bgBase:    "#0a0a0c",
  bgSurface: "#111115",
  bgElevate: "#17171d",
  bgHover:   "#1e1e26",
  borderSub:  "#2a2a35",
  borderMid:  "#3a3a48",
  textPrimary: "#e8e8f0",
  textBody:    "#c8c8d4",
  textMuted:   "#8f8fa0",
  textDim:     "#6b6b7a",
  textGhost:   "#3a3a48",
  cyan:   "#00e5ff",
  amber:  "#ffb300",
  purple: "#b57bff",
  slate:  "#6b6b7a",
} as const;

export type ColorToken = keyof typeof COLOR;

import type { SubscriptionTier } from '../../../../shared/subscription.types';

/** Instrument-panel accent per tier. Explorer = slate (free), Creator = cyan
 *  (featured), pro_artist = amber (premium). */
export const PLAN_ACCENT: Record<SubscriptionTier, string> = {
  explorer:   COLOR.slate,
  creator:    COLOR.cyan,
  pro_artist: COLOR.amber,
};

export const PLAN_GLOW: Record<SubscriptionTier, string> = {
  explorer:   "rgba(107,107,122,0.12)",
  creator:    "rgba(0,229,255,0.10)",
  pro_artist: "rgba(255,179,0,0.08)",
};
