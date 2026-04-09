// R3 Engine Context — injected by implement-r3.ts Phase 14
// import { MixerEngine } from "@r3/llpte-core/mixer";
// import { DJEngine }    from "@r3/llpte-core/dj";
// import type { MixerState, DJSession } from "@r3/llpte-core/types";

// Stub types for missing @r3/llpte-core package
export interface MixerState {
  channels: Map<string, any>;
  buses: Map<string, any>;
  masterFader: number;
  soloExclusive: boolean;
}

export interface DJSession {
  [key: string]: any;
}

export class MixerEngine {
  getState(): MixerState {
    return { channels: new Map(), buses: new Map(), masterFader: 0, soloExclusive: true };
  }
  dispatch(action: any) {
    return { ok: true };
  }
  constructor(config?: any) {}
}

export class DJEngine {
  getSession(): DJSession {
    return {};
  }
  dispatch(action: any) {
    return { ok: true };
  }
  constructor(config?: any) {}
}


const EMPTY_MIXER_STATE: MixerState = {
  channels: new Map(), buses: new Map(),
  masterFader: 0 as any, soloExclusive: true,
};
const DEFAULT_DJ_SESSION: DJSession = {
  decks: {
    A: { id: "A", trackId: null, position: 0 as any, bpm: 120, pitch: 0, playbackRate: 1,
         isPlaying: false, isLooping: false, loopStart: null, loopEnd: null,
         cuePoints: [], beatGrid: null, waveformData: null },
    B: { id: "B", trackId: null, position: 0 as any, bpm: 120, pitch: 0, playbackRate: 1,
         isPlaying: false, isLooping: false, loopStart: null, loopEnd: null,
         cuePoints: [], beatGrid: null, waveformData: null },
    C: { id: "C", trackId: null, position: 0 as any, bpm: 120, pitch: 0, playbackRate: 1,
         isPlaying: false, isLooping: false, loopStart: null, loopEnd: null,
         cuePoints: [], beatGrid: null, waveformData: null },
    D: { id: "D", trackId: null, position: 0 as any, bpm: 120, pitch: 0, playbackRate: 1,
         isPlaying: false, isLooping: false, loopStart: null, loopEnd: null,
         cuePoints: [], beatGrid: null, waveformData: null },
  },
  crossfader: 0, masterBpm: 120, syncEnabled: false, tempoRange: 0.10,
};
export const mixerEngine = new MixerEngine(EMPTY_MIXER_STATE);
export const djEngine    = new DJEngine(DEFAULT_DJ_SESSION);
// END R3 Engine Context

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
 *
 * ROOT CAUSE (ctx.subscription missing):
 * feature-gate.ts calls `ctx.subscription?.tier` in three middlewares. TRPCContext
 * never declared a subscription field. TypeScript rejected every access. Adding
 * it here as `UserSubscription | null | undefined` (undefined = not yet fetched,
 * null = user has no subscription row) resolves all seven feature-gate errors.
 *
 * ROOT CAUSE (ctx.user narrowing):
 * requireAuth threw UNAUTHORIZED when user was absent but the return type of
 * `next({ ctx: { ...ctx, user: ctx.user } })` was still TRPCContext with
 * `user?: AuthPayload`. TypeScript saw every downstream ctx.user as possibly
 * undefined even though requireAuth guaranteed it was not. The fix is to cast
 * to AuthenticatedContext in the next() call — the type now narrows through the
 * full middleware chain.
 *
 * WHY AuthenticatedContext IS CORRECT:
 * Omit<TRPCContext, 'user'> & { user: AuthPayload } replaces the optional
 * user field with a required one. Any procedure chained after requireAuth
 * receives this type, and ctx.user.id compiles without '!' assertions.
 */

import { initTRPC, TRPCError } from '@trpc/server';
import type { Request, Response } from 'express';
import type { AuthPayload } from './middleware/auth';
import type { UserSubscription } from '../shared/subscription.types';

// ── Express global augmentation ───────────────────────────────────────────────
// Single source: AuthPayload from auth.ts. No inline re-definition anywhere else.
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

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

/**
 * protectedProcedure — base procedure for authenticated routes.
 *
 * Composes publicProc with requireAuth middleware so that:
 *   1. Unauthenticated callers receive UNAUTHORIZED before any handler runs.
 *   2. Handlers receive ctx typed as AuthenticatedContext (ctx.user: AuthPayload,
 *      not AuthPayload | undefined) — no `!` assertions required downstream.
 *
 * Usage:
 *   export const myRouter = router({
 *     myRoute: protectedProcedure.input(z.object({...})).query(({ ctx, input }) => {
 *       // ctx.user.id is string, not string | undefined
 *     }),
 *   });
 */
export const protectedProcedure = publicProc.use(requireAuth);
// R3: add engines to context — update your createContext() return value:
// export function createContext() { return { ...yourExistingCtx, mixerEngine, djEngine }; }
