/**
 * middleware/rateLimit.ts
 * Rate limiters applied only to LoopStation routes.
 */
import rateLimit from 'express-rate-limit';

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
const max      = Number(process.env.RATE_LIMIT_MAX)       || 100;

export const loopStationLimiter = rateLimit({
  windowMs, max, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests.', timestamp: new Date().toISOString() },
});

export const uploadLimiter = rateLimit({
  windowMs, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Upload rate limit exceeded.', timestamp: new Date().toISOString() },
});
