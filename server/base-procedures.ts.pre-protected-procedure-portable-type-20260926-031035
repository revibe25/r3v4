/**
 * server/base-procedures.ts
 *
 * Single canonical source for protectedProcedure.
 *
 * WHY THIS FILE EXISTS
 * ─────────────────────
 * protectedProcedure = publicProc.use(requireAuth).use(attachSubscription)
 *
 * It cannot live in trpc.ts because trpc.ts must not import from
 * feature-gate.ts (which imports from trpc.ts — circular).
 *
 * It cannot live in procedures.ts because procedures.ts imports dawRouter
 * and subscriptionRouter, which would need to import protectedProcedure
 * from procedures.ts — circular.
 *
 * base-procedures.ts has NO router imports — zero circularity risk.
 * Import graph:
 *   base-procedures  →  trpc          (middleware, publicProc)
 *   base-procedures  →  feature-gate  (attachSubscription)
 *   daw              →  base-procedures
 *   subscription     →  base-procedures
 *   procedures       →  daw, subscription  (no cycle)
 */

import { publicProc, requireAuth } from './trpc';
import { attachSubscription }      from './middleware/feature-gate';

/**
 * Full auth + subscription chain.
 * Every protected route handler gets:
 *   ctx.user         — AuthPayload (narrowed by requireAuth, never undefined)
 *   ctx.subscription — UserSubscription | null (populated by attachSubscription)
 *
 * requireTier / requireFeature / checkAiTransitionLimit all read
 * ctx.subscription — they must be chained AFTER this procedure.
 */
export const protectedProcedure = publicProc
  .use(requireAuth)
  .use(attachSubscription);
