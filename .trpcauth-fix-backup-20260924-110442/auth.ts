import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import type { SubscriptionTier } from '@shared/schema';

declare module 'express' {
  interface Request {
    user?: {
      id: string;
      username: string;
      email?: string;
      tier: SubscriptionTier;
      is_admin?: boolean;
    };
  }
}

export interface AuthPayload {
  id: string;
  username: string;
  email?: string;
  tier: SubscriptionTier;
  is_admin?: boolean;
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as AuthPayload;
    req.user = payload; // Pass through is_admin from JWT if present
  } catch {
    // ignore invalid token
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

export function trpcAuth(req: Request) {
  return req.user;
}
