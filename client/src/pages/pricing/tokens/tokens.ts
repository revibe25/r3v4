// tokens.ts — Single entry point
import { PRIMITIVE } from './primitive';
import { SEMANTIC } from './semantic';
import { PLAN_ACCENT, PLAN_GLOW } from './component';
import { alpha } from './opacity';

// Runtime color object (what components import)
export const COLOR = {
  bgBase: SEMANTIC.background.base,
  bgSurface: SEMANTIC.background.surface,
  bgElevate: SEMANTIC.background.elevate,
  textPrimary: SEMANTIC.text.primary,
  textBody: SEMANTIC.text.body,
  textDim: SEMANTIC.text.dim,
  textMuted: SEMANTIC.text.muted,
  textGhost: SEMANTIC.text.ghost,
  cyan: SEMANTIC.accent.cyan,
  borderSub: SEMANTIC.border.sub,
  borderMid: SEMANTIC.border.mid,
  error: SEMANTIC.accent.error,
} as const;

export { PLAN_ACCENT, PLAN_GLOW, alpha };
export type PlanId = SubscriptionTier;
