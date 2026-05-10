export const motion = {
  spring: {
    snappy: { type: 'spring', stiffness: 600, damping: 35 },
    fluid:  { type: 'spring', stiffness: 280, damping: 28 }
  },
  ease: {
    out: [0.0, 0.0, 0.2, 1.0],
    inOut: [0.4, 0.0, 0.2, 1.0]
  },
  duration: {
    fast: 0.12,
    normal: 0.22,
    slow: 0.4
  }
} as const
