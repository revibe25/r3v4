import { Request, Response, NextFunction } from 'express';

export interface DevUser {
  id: string;
  email: string;
  username: string;
  tier: 'explorer' | 'creator' | 'pro_artist';
  isAdmin: boolean;
  iat: number;
  exp: number;
}

/**
 * DEV ONLY: Auto-authenticate as admin user on localhost
 * This middleware injects Earnest as the authenticated user
 * Only active when NODE_ENV === 'development'
 */
export function devBypass(req: Request, res: Response, next: NextFunction): void {
  // Only on development and localhost
  if (process.env.NODE_ENV !== 'development') {
    next();
    return;
  }

  const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
  if (!isLocalhost) {
    next();
    return;
  }

  // Inject Earnest as authenticated admin user
  const now = Math.floor(Date.now() / 1000);
  req.user = {
    id: 'earnest-admin-dev',
    email: 'earnestathepco@gmail.com',
    username: 'Earnest',
    tier: 'pro_artist',
    isAdmin: true,
    iat: now,
    exp: now + 86400 * 365, // 1 year
  } as DevUser;

  console.log(`[devBypass] Authenticated as Earnest (admin) on localhost`);
  next();
}
