/**
 * server/app.ts
 * Express application — middleware, tRPC, health endpoint.
 * REST routes requiring the httpServer are wired in index.ts
 * via registerRoutes(). Error handler is also mounted there (must be last).
 */
import express from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter }   from './procedures';
import { createContext } from './trpc';
import { trpcAuth }    from './middleware/auth';

export const app = express();

// ── Body parsing ───────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── CORS ───────────────────────────────────────────────────────
app.use(cors({
  origin: [
    process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5173',
  ],
  credentials: true,
}));

// ── JWT — must precede all API handlers ────────────────────────
// Populates req.user for tRPC createContext and REST handlers.
app.use(trpcAuth);

// ── Health ─────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

// ── tRPC ───────────────────────────────────────────────────────
app.use(
  '/api/trpc',
  createExpressMiddleware({ router: appRouter, createContext }),
);
