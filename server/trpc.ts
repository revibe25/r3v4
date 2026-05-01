/**
 * server/trpc.ts
 *
 * Fix A  — ctx.sessionId never populated (AI rate limiter was dead code)
 * Fix B  — Duplicate user type definition
 * Fix C  — protectedProcedure did not block unauthenticated callers
 * NEW    — Add subscription to TRPCContext so feature-gate.ts middlewares
 *          (requireTier, requireFeature, checkAiTransitionLimit) can read
 *          ctx.subscription without TypeScript errors.
 * NEW    — Export AuthenticatedContext so requireAuth can narrow ctx.user
 *          from AuthPayload | undefined → AuthPayload, propagating through
 *          the full middleware chain to every protectedProcedure handler.
 * Fix D  — Removed duplicate protectedProcedure export from this file.
 *
 * Security patches applied (Mythos audit 2026-04-22):
 *   C-06 — Removed dead `JWT_SECRET` constant. It was never used (auth.ts
 *           has its own SECRET) but the inconsistent fallback string
 *           ('dev-secret-change-in-production' vs auth.ts's longer fallback)
 *           was a maintenance hazard — a future refactor could accidentally
 *           use this weaker constant for JWT verification.
 */

/// <reference path="./types/express.d.ts" />
import { initTRPC, TRPCError }  from '@trpc/server';
import type { Request, Response } from 'express';
import type { AuthPayload }       from './middleware/auth';
import type { UserSubscription }  from '../shared/subscription.types';
import type {
  MixerEngine,
  DJEngine} from './lib/engine-stubs';
import {
  mixerEngine,
  djEngine,
} from './lib/engine-stubs';

// Express.Request.user is declared in server/types/express.d.ts — single source.
// Duplicate augmentation removed to prevent TS2717 (conflicting declarations).

// ── Base context (unauthenticated) ────────────────────────────────────────────
export interface TRPCContext {
  req: Request;
  res: Response;
  /** Populated by trpcAuth middleware. Undefined for unauthenticated requests. */
  user?: AuthPayload;
  /**
   * Populated by attachSubscription in feature-gate.ts.
   * undefined = not yet fetched (pre-attachSubscription).
   * null       = user has no subscription row (treated as explorer).
   */
  subscription?: UserSubscription | null;
  /**
   * Audio session ID from the X-Session-Id request header.
   * Required by checkAiTransitionLimit to scope per-session counts.
   * Client contract: set once per recording/mix session, reuse for all
   * AI transition calls. Example: X-Session-Id: <uuid>
   *
   * NOTE (SECURITY.md C-03): this value is fully client-controlled.
   * An authenticated user can rotate this header on every request to
   * bypass per-session AI transition limits. See SECURITY.md for the
   * fix plan (server-side session binding or userId-only scoping).
   */
  sessionId: string | undefined;
  /** Audio mixer engine — stub implementation */
  mixerEngine: MixerEngine;
  /** DJ engine — stub implementation */
  djEngine: DJEngine;
}

/**
 * Narrowed context: user is AuthPayload (non-optional).
 * Used as the output context type of requireAuth so that every procedure
 * chained after it has ctx.user typed as AuthPayload, not AuthPayload | undefined.
 */
export type AuthenticatedContext = Omit<TRPCContext, 'user'> & { user: AuthPayload };

export function createContext({ req, res }: { req: Request; res: Response }): TRPCContext {
  return {
    req,
    res,
    user: req.user,
    sessionId: (req.headers['x-session-id'] as string | undefined) || undefined,
    mixerEngine,
    djEngine,
    // subscription is populated later by attachSubscription middleware
  };
}

const t = initTRPC.context<TRPCContext>().create();

export const router     = t.router;
export const publicProc = t.procedure;
export const middleware  = t.middleware;

/**
 * requireAuth — throws UNAUTHORIZED if ctx.user is absent.
 * Returns AuthenticatedContext so that downstream middlewares and handlers
 * see ctx.user as AuthPayload (non-optional). Must be chained first in
 * protectedProcedure before attachSubscription.
 *
 * Exported for use by procedures.ts only.
 * Do NOT use this to build a procedure directly — import protectedProcedure
 * from procedures.ts, which composes requireAuth + attachSubscription.
 */
export const requireAuth = middleware(({ ctx, next }) => {
  if (!ctx.user?.id) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource.',
    });
  }
  // Cast to AuthenticatedContext — user is guaranteed non-null after the throw above.
  return next({ ctx: ctx as unknown as AuthenticatedContext });
});

// ── protectedProcedure is NOT exported from this file ─────────────────────────
// The single canonical definition is in base-procedures.ts:
//   publicProc.use(requireAuth).use(attachSubscription)
export const publicProcedure = t.procedure;
