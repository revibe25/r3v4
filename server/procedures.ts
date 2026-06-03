/**
 * server/procedures.ts
 * Root tRPC router for R3 v4 — merges all sub-routers.
 *
 * Sub-routers:
 *   dawRouter   — project CRUD, AI analysis/suggestions/chat, mastering, collab stats
 *
 * The AppRouter type is exported and re-used by:
 *   client/src/lib/trpc.ts  (typed client)
 *   server/index.ts         (passed to createExpressMiddleware)
 *
 * Adding a new router:
 *   1. Create server/routers/your-router.ts
 *   2. Import and add under a namespace key here
 *   3. The typed client picks it up automatically
 */

import { router, publicProcedure } from './trpc';
import { trialRouter }        from './routers/trial';
import { dawRouter }          from './routers/daw';
import { subscriptionRouter } from './routers/subscription';
import { sessionsRouter }        from "./routers/sessions";
import { sessionMetricsRouter }  from "./routers/sessionMetrics.router";
import { adminRouter }         from "./routers/adminRouter";
import { mixerRouter }         from "./routers/mixer.router";
import { djRouter }            from "./routers/dj.router";
import { aiMixRouter }         from "./routers/aiMix.router";
import { projectsRouter }      from "./routers/index";
import { presetsRouter }       from "./routers/index";
import { settingsRouter }      from "./routers/index";
import { agentRouter }         from "./routers/agent";
import { diagnosticsRouter }  from './routers/diagnostics';

export const appRouter = router({
  sessions:       sessionsRouter,
  sessionMetrics: sessionMetricsRouter,
  admin: adminRouter,
  // ── System ──────────────────────────────────────────────────────────────────
  ping: publicProcedure.query(() => ({ pong: true, ts: Date.now() })),

  // ── DAW (project, AI, mastering, collab) ──────────────────────────────────
  trial:        trialRouter,
  daw: dawRouter,

  // ── Subscription (Stripe checkout, portal, plan status) ──────────────────
  subscription: subscriptionRouter,
  mixer:        mixerRouter,
  dj:           djRouter,
  aiMix:        aiMixRouter,
  projects:     projectsRouter,
  presets:      presetsRouter,
  settings:     settingsRouter,
  agent:        agentRouter,
  diagnostics:   diagnosticsRouter,
})

export type AppRouter = typeof appRouter;
