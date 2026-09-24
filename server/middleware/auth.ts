import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import type { SubscriptionTier } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';

const JWT_SECRET =
  process.env.JWT_SECRET ?? "dev_secret_do_not_use_in_production_32x";

declare module 'express' {
  interface Request {
    user?: {
      id: string;
      username: string;
      email?: string;
      tier: SubscriptionTier;
      /** Server-hydrated from users.isAdmin; never trusted from JWT. */
      is_admin?: boolean;
    };
  }
}

/**
 * Authenticated request state.
 *
 * The JWT is an identity credential only.
 * Current tier and admin authority are refreshed from PostgreSQL.
 */
export interface AuthPayload {
  id: string;
  username: string;
  email?: string;
  tier: SubscriptionTier;
  /** Server-hydrated from users.isAdmin; never a JWT authority claim. */
  is_admin?: boolean;
}

interface VerifiedJwtClaims {
  id: string;
}

async function hydrateAuthenticatedUser(req: Request): Promise<boolean> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return false;
  }

  let claims: VerifiedJwtClaims;

  try {
    claims = jwt.verify(token, JWT_SECRET) as VerifiedJwtClaims;
  } catch {
    return false;
  }

  if (!claims?.id || typeof claims.id !== "string") {
    return false;
  }

  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      tier: users.tier,
      isAdmin: users.isAdmin,
    })
    .from(users)
    .where(eq(users.id, claims.id))
    .limit(1);

  if (!user) {
    return false;
  }

  req.user = {
    id: user.id,
    username: user.username,
    email: user.email ?? undefined,
    tier: user.tier as SubscriptionTier,
    is_admin: user.isAdmin,
  };

  return true;
}

/**
 * SINGLE GLOBAL AUTH DECODER.
 *
 * Verifies the JWT once, then hydrates current authorization state from DB.
 * Invalid tokens never create authenticated state.
 */
export async function trpcAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await hydrateAuthenticatedUser(req);
  } catch {
    delete req.user;
  }

  next();
}

export const optionalAuth = trpcAuth;

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
