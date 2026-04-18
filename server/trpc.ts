
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
 * ROOT CAUSE (duplicate protectedProcedure):
 * This file exported `protectedProcedure = publicProc.use(requireAuth)` while
 * procedures.ts exported the full chain `publicProc.use(requireAuth).use(attachSubscription)`.
 * Any router importing from trpc.ts instead of procedures.ts would silently
 * skip attachSubscription — ctx.subscription would be undefined in handlers
 * that depend on it (requireTier, requireFeature, checkAiTransitionLimit).
 * Fix: protectedProcedure is exported ONLY from procedures.ts.
 * requireAuth remains exported here so procedures.ts can import it without
 * creating a circular dependency.
 *
 * ROOT CAUSE (ctx.subscription missing):
 * feature-gate.ts calls `ctx.subscription?.tier` in three middlewares. TRPCContext
 * never declared a subscription field. TypeScript rejected every access. Adding
 * it here as `UserSubscription | null | undefined` resolves all feature-gate errors.
 *
 * ROOT CAUSE (ctx.user narrowing):
 * requireAuth throws UNAUTHORIZED when user is absent but the return type of
 * `next({ ctx: { ...ctx, user: ctx.user } })` was still TRPCContext with
 * `user?: AuthPayload`. TypeScript saw every downstream ctx.user as possibly
 * undefined. The fix: cast to AuthenticatedContext in the next() call.
 *
 * WHY AuthenticatedContext IS CORRECT:
 * Omit<TRPCContext, 'user'> & { user: AuthPayload } replaces the optional
 * user field with a required one. Any procedure chained after requireAuth
 * receives this type, and ctx.user.id compiles without '!' assertions.
 */

/// <reference path="./types/express.d.ts" />
import { initTRPC, TRPCError }  from '@trpc/server';
import type { Request, Response } from 'express';
import type { AuthPayload }       from './middleware/auth';
import type { UserSubscription }  from '../shared/subscription.types';
import {
  MixerEngine,
  DJEngine,
  mixerEngine,
  djEngine,
} from './lib/engine-stubs';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

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
  // This propagates the narrowed type through the entire subsequent middleware chain.
  return next({ ctx: ctx as unknown as AuthenticatedContext });
});

// ── protectedProcedure is NOT exported from this file ─────────────────────────
// The single canonical definition is in procedures.ts:
//   publicProc.use(requireAuth).use(attachSubscription)
// Exporting it here (requireAuth only) created two divergent definitions —
// any router that imported from trpc.ts instead of procedures.ts silently
// skipped attachSubscription. All routers must import from procedures.ts.
export const publicProcedure = t.procedure;
