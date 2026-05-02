import { tokens } from "./tokens";

export const theme = {
  bg: {
    base: tokens.color.bg.base,
    elevated: tokens.color.bg.elevated,
  },
  text: {
    primary: tokens.color.text.primary,
    muted: tokens.color.text.muted,
  },
  accent: {
    primary: tokens.color.accent.primary,
    danger: tokens.color.accent.danger,
  },
} as const;
