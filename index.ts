/**
 * R3 Server — Entry Point
 *
 * Fix F1: Corrupted heredoc replaced — error handler and app.listen restored.
 *
 * Fix F2: registerRoutes() (server/routes.ts) was never called.
 *         All 9 files in server/routes/*.ts are empty stubs — every REST API
 *         call returned 404. registerRoutes() registers all real handlers:
 *         sessions, projects, samples (+ upload), presets, settings, audio.
 *
 * Fix F3: tRPC appRouter was never mounted.
 *         Mounted at /api/trpc via createExpressMiddleware.
 *
 * Fix F4: stripeWebhookHandler was never registered.
 *         Stripe events (subscription.created/updated/deleted,
 *         invoice.payment_failed) were silently dropped — no subscription
 *         state ever updated from Stripe.
 *         Mounted BEFORE express.json() with express.raw() as required by
 *         stripe.webhooks.constructEvent (needs raw Buffer, not parsed object).
 *
 * Fix F5: trpcAuth was absent from the middleware stack.
 *         createContext() in trpc.ts reads req.user (set by trpcAuth).
 *         Without trpcAuth, req.user is always undefined — every
 *         protectedProcedure threw UNAUTHORIZED regardless of token validity.
 */

import http from 'http';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { logger } from './server/lib/logger';
import { createExpressMiddleware } from '@trpc/server/adapters/express';

dotenv.config();

// ── Global process error handlers ────────────────────────────────────────────
// Catches async throws that escape all route handlers and event emitters.
// Written directly to stderr as raw JSON so they fire even if the logger
// module itself has not yet been imported or throws during initialisation.
// uncaughtException MUST call process.exit(1) — Node's process state is
// undefined after an uncaught exception and continued execution is unsafe.
process.on('unhandledRejection', (reason: unknown) => {
  const msg = reason instanceof Error
    ? (reason.stack ?? reason.message)
    : String(reason);
  process.stderr.write(JSON.stringify({
    ts: new Date().toISOString(), level: 'error',
    message: 'unhandledRejection', meta: { reason: msg },
  }) + '\n');
});

process.on('uncaughtException', (err: Error) => {
  process.stderr.write(JSON.stringify({
    ts: new Date().toISOString(), level: 'error',
    message: 'uncaughtException',
    meta: { error: err.stack ?? err.message },
  }) + '\n');
  process.exit(1);
});



import { trpcAuth, loopStationAuth } from './server/middleware/auth';
import { loopStationErrorHandler } from './server/middleware/errorHandler';
import { stripeWebhookHandler } from './server/routes/stripe-webhook';
import { appRouter } from './server/routers';
import { createContext } from './server/trpc';
import { registerRoutes }      from './server/routes';
import loopRoutes              from './server/routes/loops';
import loopProjectRoutes       from './server/routes/loopProjects';
import midiRoutes              from './server/routes/midi';
import { loopStationLimiter }  from './server/middleware/rateLimit';
import { ensureDir }           from './server/utils/fileUtils';

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ── Security & transport ──────────────────────────────────────────────────────
app.use(helmet());
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use(compression());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));
app.use(morgan(NODE_ENV === 'development' ? 'dev' : 'combined'));

// ── Stripe webhook — MUST precede express.json() ─────────────────────────────
// express.raw() preserves the raw Buffer required for HMAC signature verification.
// If express.json() runs first, req.body is an object and constructEvent throws.
app.use(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler,
);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ── Auth: non-blocking JWT decode → populates req.user ───────────────────────
// Must come AFTER body parsing, BEFORE tRPC and REST routes.
// trpcAuth never blocks — it only populates req.user if a valid Bearer token
// is present. Blocking enforcement happens inside requireUser (REST) and
// requireAuth (tRPC protectedProcedure).
app.use(trpcAuth);

// ── tRPC ──────────────────────────────────────────────────────────────────────
app.use('/api/trpc', createExpressMiddleware({
  router: appRouter,
  createContext,
  onError: ({ error, path }) => {
    // Only log INTERNAL_SERVER_ERROR — UNAUTHORIZED/FORBIDDEN are expected
    // control flow, not bugs.
    if (error.code === 'INTERNAL_SERVER_ERROR') {
      logger.error('tRPC internal error', { path: path ?? 'unknown', error: error.message, stack: error.stack });
    }
  },
}));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const httpServer = http.createServer(app);

  // ── Loop storage dirs ─────────────────────────────────────────────────────
  // Ensure directories exist before route handlers mount.
  // safeResolve() in fileUtils.ts resolves relative to LOOP_STORAGE_BASE.
  // Warnings are non-fatal — routes fall back to on-demand mkdir per request.
  const _storageBase = process.env.LOOP_STORAGE_BASE ?? './server/storage';
  await Promise.all([
    ensureDir(`${_storageBase}/loops`),
    ensureDir(`${_storageBase}/projects`),
  ]).catch((e) =>
    logger.warn('Loop storage init warning', { error: String(e) }),
  );

  // Register all REST route handlers.
  // registerRoutes() appends to app — must complete before 404/error handlers.
  await registerRoutes(httpServer, app);

  // ── LoopStation REST routes ────────────────────────────────────────────────
  // Rate-limited (loopStationLimiter) + auth-gated (loopStationAuth).
  // Mounted at /api — each router defines its own sub-paths:
  //   loops.ts        → /save-loop  /loops  /loops/:id
  //   loopProjects.ts → /loopproject/save  /loopproject/:id  /loopprojects
  //   midi.ts         → /midi/mappings
  app.use('/api', loopStationLimiter, loopStationAuth, loopRoutes);
  app.use('/api', loopStationLimiter, loopStationAuth, loopProjectRoutes);
  app.use('/api', loopStationLimiter, loopStationAuth, midiRoutes);

  // 404 — registered after all routes so it only fires for unmatched paths
  app.use((_req, res) => {
    res.status(404).json({
      error: 'Not Found',
      path: _req.path,
      method: _req.method,
    });
  });

  // Global error handler — 4-parameter signature required by Express
  app.use(loopStationErrorHandler);

  httpServer.listen(PORT, () => {
    logger.info('R3 Server started', { port: PORT, env: NODE_ENV, ts: new Date().toISOString() });
  });
}

main().catch((err) => {
  logger.error('Server failed to start', { error: err instanceof Error ? err.stack ?? err.message : String(err) });
  process.exit(1);
});

export default app;
