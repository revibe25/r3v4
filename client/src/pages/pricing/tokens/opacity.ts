// tokens/opacity.ts
const ALPHA_MAP = {
  10: '1a', 20: '33', 30: '4d', 40: '66', 
  50: '80', 60: '99', 70: 'b3', 80: 'cc', 90: 'e6'
} as const;

export function alpha(color: string, opacity: keyof typeof ALPHA_MAP): string {
  // Strip existing alpha if present
  const base = color.length === 9 ? color.slice(0, 7) : color;
  return `${base}${ALPHA_MAP[opacity]}`;
}

// Usage:
alpha(COLOR.cyan, 20)  // "#00ffcc33"
alpha(COLOR.cyan, 10)  // "#00ffcc1a"
