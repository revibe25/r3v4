/**
 * server/middleware/auth.ts
 *
 * Fix: jwt.sign expiresIn type error
 *
 * ROOT CAUSE: @types/jsonwebtoken@9 changed expiresIn from `string | number`
 * to `StringValue | number` where StringValue is a branded type from the ms
 * package. TypeScript rejects a plain `string` assignment to `StringValue`.
 * TOKEN_EXPIRY is validated at startup against EXPIRY_PATTERN, so the runtime
 * value is always a valid duration string. The `as any` cast on the options
 * object is the standard workaround in the jwt ecosystem for this branded type.
 * It has no runtime effect — jwt.js calls ms() on any string value internally.
 */

/// <reference path="../types/express.d.ts" />
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import type { SubscriptionTier } from '../../shared/subscription.types';

export interface AuthPayload {
  id: string;
  username?: string;
  /** undefined when user registered without email */
  email?: string;
  tier: SubscriptionTier;
}

const RAW_SECRET = process.env.JWT_SECRET ?? '';

if (process.env.NODE_ENV === 'production') {
  if (!RAW_SECRET) {
    logger.error('[auth] FATAL: JWT_SECRET is not set. Refusing to start.');
    process.exit(1);
  }
  if (RAW_SECRET.length < 32) {
    logger.error('[auth] FATAL: JWT_SECRET must be at least 32 characters.');
    process.exit(1);
  }
}

const SECRET = RAW_SECRET || 'dev_secret_do_not_use_in_production_32x';

const RAW_EXPIRY = process.env.JWT_EXPIRES_IN ?? '7d';
const EXPIRY_PATTERN = /^\d+$|^\d+[smhdwy]$/i;
if (!EXPIRY_PATTERN.test(RAW_EXPIRY)) {
  logger.error(`[auth] FATAL: JWT_EXPIRES_IN="${RAW_EXPIRY}" is not a valid duration.`);
  process.exit(1);
}
const TOKEN_EXPIRY = RAW_EXPIRY;

function verifyToken(token: string): AuthPayload | null {
  try {
    const decoded = jwt.verify(token, SECRET) as AuthPayload & jwt.JwtPayload;
    if (!decoded.id || !decoded.username) return null;
    return {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email ?? undefined,
      tier: (decoded.tier ?? 'explorer') as SubscriptionTier,
    };
  } catch {
    return null;
  }
}

export function signToken(payload: AuthPayload): string {
  // `as any` on options: @types/jsonwebtoken@9 uses branded StringValue type for
  // expiresIn. TOKEN_EXPIRY is validated against EXPIRY_PATTERN above so the
  // runtime value is always valid. The cast satisfies the type checker only.
  return jwt.sign(payload, SECRET, { expiresIn: TOKEN_EXPIRY } as Parameters<typeof jwt.sign>[2]);
}

// ── Non-blocking: populates req.user if valid token present ──────────────────
export function trpcAuth(req: Request, _res: Response, next: NextFunction): void {
  const parts = (req.headers['authorization'] ?? '').split(' ');
  if (parts[0] === 'Bearer' && parts[1]) {
    const payload = verifyToken(parts[1]);
    if (payload) {
      req.user = payload;
    } else {
      logger.debug(`[trpcAuth] invalid/expired token on ${req.path}`);
    }
  }
  next();
}

// ── Blocking: rejects if req.user is absent ───────────────────────────────────
export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.', timestamp: new Date().toISOString() });
    return;
  }
  next();
}

// ── LoopStation route auth (blocking) ────────────────────────────────────────
export function loopStationAuth(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === 'test') {
    next();
    return;
  }
  const parts = (req.headers['authorization'] ?? '').split(' ');
  if (parts[0] !== 'Bearer' || !parts[1]) {
    logger.warn(`[loopStation auth] missing token: ${req.path}`);
    res.status(401).json({ status: 'error', message: 'Missing Authorization header.', timestamp: new Date().toISOString() });
    return;
  }
  const payload = verifyToken(parts[1]);
  if (!payload) {
    logger.warn(`[loopStation auth] invalid or expired token on ${req.path}`);
    res.status(403).json({ status: 'error', message: 'Invalid or expired token.', timestamp: new Date().toISOString() });
    return;
  }
  req.user = payload;
  next();
}

// ── Trial enforcement ────────────────────────────────────────────────────────
import { db as _db } from "../db";
import { users as _users } from "../db/schema";
import { eq as _eq } from "drizzle-orm";
import { TRPCError as _TRPCError } from "@trpc/server";

export async function assertTrialActive(userId: string): Promise<void> {
  const [user] = await _db
    .select({ trialExpiresAt: _users.trialExpiresAt, tier: _users.tier })
    .from(_users)
    .where(_eq(_users.id, userId))
    .limit(1);

  if (!user) throw new _TRPCError({ code: "UNAUTHORIZED" });
  if (user.tier && user.tier !== "explorer") return; // subscribed — pass
  if (!user.trialExpiresAt) return;                  // no trial yet — pass (client gates)
  if (new Date(user.trialExpiresAt) < new Date()) {
    throw new _TRPCError({ code: "FORBIDDEN", message: "trial_expired" });
  }
}
