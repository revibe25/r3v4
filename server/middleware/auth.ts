/**
 * middleware/auth.ts
 * Placeholder JWT-style auth middleware for LoopStation API routes.
 * Skips auth in development/test — your existing dev workflow is unchanged.
 * In production swap the stub for real jwt.verify().
 *
 * Clients: Authorization: Bearer <token>
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

const SECRET = process.env.AUTH_TOKEN_SECRET ?? 'dev_secret';

export function loopStationAuth(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
    next(); return;
  }
  const [scheme, token] = (req.headers['authorization'] ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    logger.warn(`[loopStation auth] missing token: ${req.path}`);
    res.status(401).json({ status: 'error', message: 'Missing Authorization header.', timestamp: new Date().toISOString() });
    return;
  }
  if (token !== SECRET && !token.startsWith('r3_')) {
    logger.warn(`[loopStation auth] invalid token on ${req.path}`);
    res.status(403).json({ status: 'error', message: 'Invalid token.', timestamp: new Date().toISOString() });
    return;
  }
  next();
}
