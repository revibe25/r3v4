/**
 * R3 Native — UI Component Barrel Export
 * Single import point for all design system components
 * Usage: import { Button, Card, Badge } from '@client/components/ui';
 */

export { Button } from './Button';
export { Card } from './Card';
export { Badge } from './Badge';

// Re-export theme types for component consumers
export type {
  ButtonVariant,
  CardVariant,
  BadgeType,
  ColorKey,
  AudioColorKey,
  GradientKey,
  SpectrumType,
  WaveformProps,
  VUMeterProps,
  SpectrumProps,
} from '@shared/theme';
