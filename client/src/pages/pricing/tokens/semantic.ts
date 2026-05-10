// tokens/semantic.ts
import { PRIMITIVE } from './primitive';

export const SEMANTIC = {
  background: {
    base: PRIMITIVE.color.black[900],
    surface: PRIMITIVE.color.black[800],
    elevate: PRIMITIVE.color.black[700],
  },
  text: {
    primary: PRIMITIVE.color.white[100],
    body: PRIMITIVE.color.white[200],
    dim: PRIMITIVE.color.white[300],
    muted: PRIMITIVE.color.white[400],
    ghost: PRIMITIVE.color.white[500],
  },
  border: {
    sub: PRIMITIVE.color.black[600],
    mid: PRIMITIVE.color.black[500],
  },
  accent: {
    cyan: PRIMITIVE.color.cyan[400],
    error: PRIMITIVE.color.red[400],
  },
  status: {
    errorSoft: 'var(--status-error-soft)', // CSS custom property bridge
  },
} as const;
