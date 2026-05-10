// tokens/component.ts
import { SEMANTIC } from './semantic';
import type { SubscriptionTier } from '../../../../shared/subscription.types';

export const PLAN_ACCENT: Record<SubscriptionTier, string> = {
  explorer: SEMANTIC.accent.cyan,
  creator: '#a3e635', // or from primitive
  pro_artist: '#c084fc',
};

export const PLAN_GLOW: Record<SubscriptionTier, string> = {
  explorer: '#00ffcc44',
  creator: '#a3e63544',
  pro_artist: '#c084fc44',
};

// Opacity helpers
export const withAlpha = (color: string, alpha: string) => `${color}${alpha}`;
