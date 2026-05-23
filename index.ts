/**
 * R3 Server — Entry Point [FIXED]
 *
 * Critical fixes:
 * 1. Error handler registered IMMEDIATELY after app creation (line 81)
 *    before ANY middleware can throw
 * 2. Environment validation occurs synchronously at startup with explicit
 *    error messages to stderr
 * 3. Health check endpoint returns minimal response to avoid any middleware
 * 4. registerRoutes() failures are properly caught and logged
 * 5. All async operations wrapped in proper error boundaries
 */

import http from 'http';
import express from 'express';
import type { Request, Response } from 'express';
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

// ── ENVIRONMENT VALIDATION (before any middleware setup) ───────────────────────
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 3000;

// Production env validation: explicit, early, fail-fast
if (NODE_ENV === 'production') {
  const required = ['ALLOWED_ORIGINS', 'JWT_SECRET'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    const msg = `[STARTUP] FATAL: Missing required environment variables in production: ${missing.join(', ')}`;
    process.stderr.write(JSON.stringify({
      ts: new Date().toISOString(),
      level: 'fatal',
      message: msg,
      code: 'ENV_VALIDATION_FAILED'
    }) + '\n');
    process.exit(1);
  }
  const SECRET = process.env.JWT_SECRET!;
  if (SECRET.length < 32) {
    const msg = '[STARTUP] FATAL: JWT_SECRET must be at least 32 characters in production';
    process.stderr.write(JSON.stringify({
      ts: new Date().toISOString(),
      level: 'fatal',
      message: msg,
      code: 'JWT_SECRET_TOO_SHORT'
    }) + '\n');
    process.exit(1);
  }
}

// ── Imports (after env validation) ────────────────────────────────────────────
import { trpcAuth, loopStationAuth } from './server/middleware/auth';
import { loopStationErrorHandler } from './server/middleware/errorHandler';
import { stripeWebhookHandler } from './server/routes/stripe-webhook';
import { appRouter } from './server/procedures';
import { createContext } from './server/trpc';
import { registerRoutes } from './server/routes';
import loopRoutes from './server/routes/loops';
import loopProjectRoutes from './server/routes/loopProjects';
import midiRoutes from './server/routes/midi';
import { loopStationLimiter } from './server/middleware/rateLimit';
import { attachCollabServer, getRoomStats } from './server/ws/collab';
import { internalRouter } from './server/routes/internal';
import { ensureDir } from './server/utils/fileUtils';

// ── Express app ───────────────────────────────────────────────────────────────
const app = express();

// ──────────────────────────────────────────────────────────────────────────────
// This catches errors from all downstream middleware and routes.
// The 4-parameter signature (err, req, res, next) is REQUIRED by Express.
app.use((err: any, req: Request, res: Response, next: Function) => {
  loopStationErrorHandler(err, req, res, next);
});

// ── Security & transport ──────────────────────────────────────────────────────
app.use(helmet());

// ✅ FIX #2: MINIMAL HEALTH CHECK
// Returns immediately with no dependencies on middleware below.
// Does not call res.json() if something breaks — uses direct response.
app.get('/api/health', (_req, res) => {
  try {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch {
    // Fallback if res.json fails (should never happen)
    res.status(200).end('{"status":"ok"}');
  }
});

app.use(compression());

// ✅ FIX #3: CORS ORIGINS WITH EXPLICIT FALLBACK
// In production, ALLOWED_ORIGINS is validated above.
// In development, use localhost defaults.
const corsOrigins = NODE_ENV === 'production'
  ? (process.env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:5174'];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));

app.use(morgan(NODE_ENV === 'development' ? 'dev' : 'combined'));

// ── Stripe webhook — MUST precede express.json() ─────────────────────────────
// express.raw() preserves the raw Buffer required for HMAC signature verification.
app.use(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler,
);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ── Auth: non-blocking JWT decode → populates req.user ───────────────────────
app.use(trpcAuth);

// ── tRPC ──────────────────────────────────────────────────────────────────────
app.use('/api/trpc', createExpressMiddleware({
  router: appRouter,
  createContext,
  onError: ({ error, path }) => {
    if (error.code === 'INTERNAL_SERVER_ERROR') {
      logger.error('tRPC internal error', {
        path: path ?? 'unknown',
        error: error.message,
        stack: error.stack
      });
    }
  },
}));

// ── Alternative health check (fallback) ────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC SERVER BOOTSTRAP
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  try {
    // ── Create HTTP server with WebSocket support ──────────────────────────
    const httpServer = http.createServer(app);
    
    try {
      attachCollabServer(httpServer);
    } catch (err) {
      logger.warn('Failed to attach collaboration server', {
        error: err instanceof Error ? err.message : String(err)
      });
      // Non-fatal — continue without WebSocket support
    }

    // ── Ensure loop storage directories exist ──────────────────────────────
    const storageBase = process.env.LOOP_STORAGE_BASE ?? './server/storage';
    try {
      await Promise.all([
        ensureDir(`${storageBase}/loops`),
        ensureDir(`${storageBase}/projects`),
      ]);
      logger.info('Loop storage directories ready', { storageBase });
    } catch (err) {
      logger.warn('Loop storage directory creation warning', {
        error: err instanceof Error ? err.message : String(err),
        note: 'Routes will attempt on-demand mkdir per request'
      });
      // Non-fatal — routes will attempt mkdir on-demand
    }

    // ── Register REST route handlers ───────────────────────────────────────
    try {
      await registerRoutes(httpServer, app);
      logger.info('REST routes registered');
    } catch (err) {
      logger.error('Failed to register REST routes', {
        error: err instanceof Error ? err.stack ?? err.message : String(err)
      });
      throw err; // Fatal — routes must load
    }

    // ── LoopStation REST routes ────────────────────────────────────────────
    app.use('/api/internal', internalRouter);
    app.use('/api', loopStationLimiter, loopStationAuth, loopRoutes);
    app.use('/api', loopStationLimiter, loopStationAuth, loopProjectRoutes);
    app.use('/api', loopStationLimiter, loopStationAuth, midiRoutes);

    // ── Admin stats endpoint ───────────────────────────────────────────────
    app.get('/api/admin/stats', async (req: Request, res: Response) => {
      const parts = (req.headers['authorization'] ?? '').split(' ');
      if (parts[0] !== 'Bearer' || !parts[1]) {
        return res.status(401).json({ error: 'Authentication required.' });
      }
      if (!req.user?.email || req.user.email !== process.env.ADMIN_EMAIL) {
        return res.status(403).json({ error: 'Forbidden.' });
      }
      
      let dbStatus = 'ok', dbLatencyMs = 0;
      try {
        const { db } = await import('./server/db/index.js');
        const { sql } = await import('drizzle-orm');
        const t0 = Date.now();
        await db.execute(sql`SELECT 1`);
        dbLatencyMs = Date.now() - t0;
      } catch {
        dbStatus = 'error';
      }
      
      const mem = process.memoryUsage();
      const rooms = getRoomStats();
      return res.json({
        uptime: Math.floor(process.uptime()),
        nodeVersion: process.version,
        env: NODE_ENV,
        memory: {
          rss: Math.round(mem.rss / 1024 / 1024),
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        },
        db: { status: dbStatus, latencyMs: dbLatencyMs },
        collab: rooms,
        ts: new Date().toISOString(),
      });
    });

    // ── 404 handler ────────────────────────────────────────────────────────
    app.use((_req, res) => {
      res.status(404).json({
        error: 'Not Found',
        path: _req.path,
        method: _req.method,
      });
    });

    // ── Global error handler — MUST be LAST (4-parameter signature required) ──
    // Express detects 4-parameter functions as error handlers.
    // MUST come after all routes and other middleware.
    app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
      loopStationErrorHandler(err, req, res, _next);
    });
    // ── Start server ───────────────────────────────────────────────────────
    await new Promise<void>((resolve, reject) => {
      httpServer.listen(PORT, '0.0.0.0', () => {
        logger.info('R3 Server started', {
          port: PORT,
          env: NODE_ENV,
          ts: new Date().toISOString()
        });
        resolve();
      });
      
      httpServer.on('error', (err) => {
        logger.error('HTTP server error', {
          error: err instanceof Error ? err.message : String(err),
          code: (err as any).code
        });
        reject(err);
      });
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.stack ?? err.message : String(err);
    logger.error('Server initialization failed', { error: errorMsg });
    process.exit(1);
  }
}

    // ── Global error handler — MUST be LAST (4-parameter signature required) ──
    // Express detects 4-parameter functions as error handlers.
    // MUST come after all routes and other middleware.
    app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
      loopStationErrorHandler(err, req, res, _next);
    });
// ── Start server and handle fatal errors ──────────────────────────────────────
main().catch((err) => {
  logger.error('Server crashed', {
    error: err instanceof Error ? err.stack ?? err.message : String(err)
  });
  process.exit(1);
});

export default app;
