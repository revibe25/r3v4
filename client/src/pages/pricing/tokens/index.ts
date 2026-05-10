// tokens/index.ts
import { SEMANTIC } from './semantic';

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

// Derive the type automatically
export type ColorToken = keyof typeof COLOR;
