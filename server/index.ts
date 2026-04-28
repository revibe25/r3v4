/**
 * server/index.ts
 * R3 v4 Express server — complete entry point.
 *
 * Wires together:
 *   - helmet, cors, compression, morgan, express-rate-limit
 *   - JSON body parser
 *   - Auth REST routes:  POST /api/auth/register|login  GET /api/auth/me
 *   - tRPC adapter:      /trpc/*  (all DAW procedures)
 *   - Stripe webhook:    POST /api/webhooks/stripe  (raw body, sig verified)
 *   - Static file serve: server/static.ts in production
 *   - WebSocket collab:  ws@8.19.0 at /ws  (attachCollabServer)
 *   - Health check:      GET /health  →  { ok, uptime }
 *
 * All environment variables are read from process.env.
 * In Railway: set via the Railway dashboard.
 * Locally:    copy .env.example → .env and fill in values.
 *
 * Required env vars:
 *   DATABASE_URL       — PostgreSQL connection string
 *   JWT_SECRET         — Secret for JWT signing (rotate if ever leaked)
 *   STRIPE_SECRET_KEY  — Stripe live/test secret key
 *   STRIPE_WEBHOOK_SECRET — Stripe webhook endpoint secret
 *
 * Optional:
 *   PORT               — default 3001
 *   CLIENT_URL         — CORS allow-list (default: http://localhost:5173)
 *   JWT_EXPIRES        — default 7d
 *   DATABASE_SSL       — set to 'false' to disable SSL (local dev only)
 *
 * Security patches applied (Mythos audit 2026-04-22):
 *   F-01 — Removed 'unsafe-inline' from CSP scriptSrc (was nullifying XSS protection)
 *   F-06 — /health no longer leaks version, memory RSS, or collab room stats
 *   F-07 — Removed duplicate app.use('/api/trpc', trpcAuth) (global trpcAuth is sufficient)
 */

import 'dotenv/config';
import { createServer }       from 'http';
import express                from 'express';
import helmet                 from 'helmet';
import cors                   from 'cors';
import compression            from 'compression';
import morgan                 from 'morgan';
import { rateLimit }          from 'express-rate-limit';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import Stripe                 from 'stripe';

import { createContext }      from './trpc';
import { appRouter }          from './procedures';
import { authRouter }         from './routes/auth';
import { internalRouter }     from './routes/internal';
import { logger }             from './utils/logger';
import { trpcAuth }            from './middleware/auth';
import { attachCollabServer } from './ws/collab';
import { db }                 from './db';
import { subscriptions }      from '../shared/schema';
import { eq }                 from 'drizzle-orm';
import type { SubscriptionTier, SubscriptionStatus } from '../shared/subscription.types';

// ── Constants ─────────────────────────────────────────────────────────────────

const PORT       = parseInt(process.env.PORT ?? '3000', 10);
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173';

// ── Express app ───────────────────────────────────────────────────────────────

const app = express();

// Trust Railway's reverse proxy (needed for correct IP in rate limiter)
app.set('trust proxy', 1);

// ── Security headers ──────────────────────────────────────────────────────────

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        // F-01 FIX: 'unsafe-inline' removed — it nullified XSS protection entirely.
        // If any inline scripts are required, replace with a per-request nonce:
        //   scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`]
        scriptSrc:   ["'self'"],
        connectSrc:  ["'self'", 'wss:', 'ws:'],      // WebSocket collab
        workerSrc:   ["'self'", 'blob:'],            // AudioWorklet
        mediaSrc:    ["'self'", 'blob:'],            // MediaRecorder
        imgSrc:      ["'self'", 'data:'],
      },
    },
    crossOriginEmbedderPolicy: false, // SharedArrayBuffer needs COEP
  }),
);

// ── CORS ──────────────────────────────────────────────────────────────────────

app.use(
  cors({
    origin:      CLIENT_URL,
    credentials: true,
    methods:     ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ── Compression + logging ─────────────────────────────────────────────────────

app.use(compression());
app.use(morgan('combined', {
  skip: (req: express.Request) => req.url === '/health',  // suppress health check noise
  stream: { write: (msg: string) => process.stdout.write(msg) },
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────

// General API limiter
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max:      300,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { error: 'Too many requests. Please try again later.' },
  }),
);

// Strict limiter for auth endpoints (brute-force protection)
app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max:      20,
    skipSuccessfulRequests: false,
    message: { error: 'Too many auth attempts. Try again in 15 minutes.' },
  }),
);

// ── Stripe webhook — MUST be before JSON body parser ─────────────────────────

const STRIPE_SECRET          = process.env.STRIPE_SECRET_KEY ?? '';
const STRIPE_WEBHOOK_SECRET  = process.env.STRIPE_WEBHOOK_SECRET ?? '';

const stripe = STRIPE_SECRET
  ? new Stripe(STRIPE_SECRET, { apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion })
  : null;

/**
 * Resolves a Stripe price ID to its SubscriptionTier via strict equality.
 */
function resolveTierFromPriceId(priceId: string): SubscriptionTier {
  if (!priceId) return 'explorer';
  const creatorMonthly   = process.env.STRIPE_CREATOR_MONTHLY_PRICE_ID;
  const creatorYearly    = process.env.STRIPE_CREATOR_YEARLY_PRICE_ID;
  const proArtistMonthly = process.env.STRIPE_PRO_ARTIST_MONTHLY_PRICE_ID;
  const proArtistYearly  = process.env.STRIPE_PRO_ARTIST_YEARLY_PRICE_ID;
  if (priceId === creatorMonthly   || priceId === creatorYearly)   return 'creator';
  if (priceId === proArtistMonthly || priceId === proArtistYearly) return 'pro_artist';
  return 'explorer';
}

app.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      res.sendStatus(400);
      return;
    }

    const sig = req.headers['stripe-signature'];
    if (!sig) { res.sendStatus(400); return; }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig,
        STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      console.error('[stripe/webhook] Signature verification failed:', (err as Error).message);
      res.status(400).send(`Webhook Error: ${(err as Error).message}`);
      return;
    }

    // Handle subscription lifecycle events
    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const sub = event.data.object as Stripe.Subscription;
          const customerId = sub.customer as string;
          const [existing] = await db
            .select({ userId: subscriptions.userId })
            .from(subscriptions)
            .where(eq(subscriptions.stripeCustomerId, customerId))
            .limit(1);
          if (existing) {
            const priceId = sub.items.data[0]?.price.id ?? '';
            const tier    = resolveTierFromPriceId(priceId);
            const rawPeriodEnd = (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end;
            await db.update(subscriptions)
              .set({
                tier,
                status:           sub.status,
                stripeSubscriptionId: sub.id,
                currentPeriodEnd: typeof rawPeriodEnd === 'number' ? new Date(rawPeriodEnd * 1000) : null,
                updatedAt:        new Date(),
              })
              .where(eq(subscriptions.userId, existing.userId));
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          const customerId = sub.customer as string;
          const [existing] = await db
            .select({ userId: subscriptions.userId })
            .from(subscriptions)
            .where(eq(subscriptions.stripeCustomerId, customerId))
            .limit(1);
          if (existing) {
            await db.update(subscriptions)
              .set({ tier: 'explorer', status: 'canceled', updatedAt: new Date() })
              .where(eq(subscriptions.userId, existing.userId));
          }
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('[stripe/webhook] Handler error:', (err as Error).message);
    }

    res.json({ received: true });
  },
);

// ── JSON body parser (after raw webhook route) ────────────────────────────────

app.use(express.json({ limit: '2mb' }));

// Global JWT middleware — populates req.user from Bearer token.
// F-07 FIX: this single global use is sufficient; the duplicate
// app.use('/api/trpc', trpcAuth) that previously appeared before
// createExpressMiddleware has been removed.
app.use(trpcAuth);

// ── Auth REST routes ──────────────────────────────────────────────────────────

app.use('/api/auth', authRouter);
app.use('/api/internal', internalRouter);

// ── tRPC adapter ──────────────────────────────────────────────────────────────

app.use(
  '/api/trpc',
  createExpressMiddleware({
    router:        appRouter,
    createContext,
    onError({ path, error }: { path: string | undefined; error: { code: string; message: string } }) {
      if (error.code !== 'BAD_REQUEST' && error.code !== 'UNAUTHORIZED' && error.code !== 'FORBIDDEN') {
        console.error(`[tRPC] /${path} → ${error.message}`);
      }
    },
  }),
);

// ── Health check ──────────────────────────────────────────────────────────────

// F-06 FIX: stripped version, memory RSS, and collab room stats.
// Version fingerprinting enables N-day targeting; room stats are metadata
// leakage about user activity. This endpoint is unauthenticated by design
// (used by Railway health checks) so it must not reveal operational data.
app.get('/health', (_req, res) => {
  res.json({
    ok:     true,
    uptime: Math.floor(process.uptime()),
  });
});

// ── 404 fallback ──────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// ── Error handler ─────────────────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[unhandled]', err.message);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── HTTP + WebSocket server ───────────────────────────────────────────────────

const httpServer = createServer(app);

attachCollabServer(httpServer);

httpServer.listen(PORT, () => {
  logger.info('[R3 v4] Server listening', { port: PORT });
  logger.info('[R3 v4] tRPC at /api/trpc');
  logger.info('[R3 v4] WebSocket collab at /ws');
  logger.info('[R3 v4] Auth at /api/auth');
  logger.info('[R3 v4] Internal at /api/internal');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('[R3 v4] SIGTERM received — shutting down gracefully');
  httpServer.close(() => process.exit(0));
});

export { app, httpServer };
