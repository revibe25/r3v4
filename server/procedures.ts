/**
 * server/procedures.ts
 *
 * Fix C — protectedProcedure now actually blocks unauthenticated callers
 *
 * ROOT CAUSE: The previous definition was:
 *   publicProc.use(attachSubscription)
 * attachSubscription passes unauthenticated requests through with subscription: null
 * and never throws. Any tRPC router using protectedProcedure was only "protected"
 * if every handler individually checked ctx.user — a guarantee that was never
 * enforced and never documented.
 *
 * WHY THIS FIX IS CORRECT:
 * 1. requireAuth throws UNAUTHORIZED immediately if ctx.user is absent
 *    This is the failure boundary — the permission check cannot be bypassed.
 * 2. attachSubscription runs second with guaranteed ctx.user.id
 *    It can safely access ctx.user without guards.
 * 3. The chain is unbroken and continuous
 *    TypeScript infers the full middleware type through the chain.
 *
 * TS2742 FIX: Use explicit 'as' casting with ReturnType
 * The tRPC middleware chain returns a type that tRPC knows
 * We cast to make it portable for declaration files
 *
 * Circular dependency is avoided: trpc.ts exports requireAuth, procedures.ts
 * imports from trpc.ts and feature-gate.ts, neither of which imports procedures.ts.
 */

import { publicProc, requireAuth } from './trpc';
import { attachSubscription } from './middleware/feature-gate';

export const protectedProcedure = publicProc
  .use(requireAuth)
  .use(attachSubscription) as ReturnType<typeof publicProc['use']>;
