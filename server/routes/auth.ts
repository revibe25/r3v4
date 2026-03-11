/**
 * server/routes/auth.ts
 *
 * Auth routes: register, login, me.
 *
 * ROOT CAUSE for prior empty stub: The file was scaffolded but never
 * implemented. No user could obtain a token, making every protected
 * route unreachable in practice despite auth enforcement being correct.
 *
 * DESIGN DECISIONS:
 *
 * 1. bcrypt cost factor 12
 *    Cost 10 is the common default. At cost 12, hash time on modern
 *    hardware is ~250-400ms — acceptable for auth, meaningfully harder
 *    to brute-force offline. Cost 14+ causes noticeable UX latency.
 *
 * 2. Username uniqueness enforced at DB layer (UNIQUE constraint on users.username)
 *    We check explicitly first to return a clean 409 rather than letting
 *    Drizzle throw a raw Postgres unique violation error to the client.
 *
 * 3. /me returns only the token payload fields (id, username, email, tier)
 *    It does not re-query the DB. The token is the source of truth for
 *    identity within a session. If tier changes (e.g. after upgrade),
 *    the client must re-login to get a new token — acceptable tradeoff
 *    vs. a DB round-trip on every /me call.
 *
 * 4. Timing-safe comparison for login:
 *    bcrypt.compare is already timing-safe. We do NOT short-circuit on
 *    "user not found" before calling compare — instead we compare against
 *    a dummy hash to keep response time constant and prevent user
 *    enumeration via timing differences.
 *
 * 5. Password requirements: min 8 chars, max 72 chars.
 *    72 is bcrypt's internal input limit — bytes beyond 72 are silently
 *    truncated. Enforcing the max here prevents false equivalence where
 *    "password123...73chars" === "password123...74chars" from bcrypt's view.
 */

import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { signToken } from '../middleware/auth';
import { requireUser } from '../middleware/auth';
import { storage } from '../storage';
import { logger } from '../lib/logger';

const router: Router = Router();

const BCRYPT_ROUNDS = 12;

// Dummy hash used to prevent user enumeration via timing.
// Pre-computed at module load so it doesn't add latency to the first request.
const DUMMY_HASH = await bcrypt.hash('dummy_timing_protection', BCRYPT_ROUNDS);

const registerSchema = z.object({
  username: z
    .string()
    .min(3,  'Username must be at least 3 characters')
    .max(32, 'Username must be at most 32 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, _ and -'),
  password: z
    .string()
    .min(8,  'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters'),
  email: z
    .string()
    .email('Invalid email address')
    .max(255)
    .optional(),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// ── POST /api/auth/register ───────────────────────────────────────────────────

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid registration data',
      details: parsed.error.issues,
    });
  }

  const { username, password, email } = parsed.data;

  try {
    // Explicit uniqueness check for a clean 409 — avoids leaking raw DB errors.
    const existing = await storage.getUserByUsername(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await storage.createUser({
      username,
      password: passwordHash,
      email: email ?? null,
    });

    const token = signToken({
      id:       user.id,
      username: user.username,
      email:    user.email ?? null,
      tier:     user.tier,
    });

    logger.info('[auth] registered', { userId: user.id, username: user.username });

    return res.status(201).json({ token, user: {
      id:       user.id,
      username: user.username,
      email:    user.email ?? null,
      tier:     user.tier,
    }});
  } catch (err) {
    logger.error('[auth] register error', { error: (err as Error).message });
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const { username, password } = parsed.data;

  try {
    const user = await storage.getUserByUsername(username);

    // Always run bcrypt.compare to prevent timing-based user enumeration.
    // If user doesn't exist, compare against dummy hash — result will be
    // false, and we return the same 401 as a wrong password.
    const hashToCompare = user?.password ?? DUMMY_HASH;
    const valid = await bcrypt.compare(password, hashToCompare);

    if (!user || !valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = signToken({
      id:       user.id,
      username: user.username,
      email:    user.email ?? null,
      tier:     user.tier,
    });

    logger.info('[auth] login', { userId: user.id, username: user.username });

    return res.json({ token, user: {
      id:       user.id,
      username: user.username,
      email:    user.email ?? null,
      tier:     user.tier,
    }});
  } catch (err) {
    logger.error('[auth] login error', { error: (err as Error).message });
    return res.status(500).json({ error: 'Login failed' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────

router.get('/me', requireUser, (req, res) => {
  // requireUser guarantees req.user is populated — no DB call needed.
  return res.json({
    id:       req.user!.id,
    username: req.user!.username,
    email:    req.user!.email ?? null,
    tier:     req.user!.tier,
  });
});


// ── POST /api/auth/refresh ────────────────────────────────────────────────────
// Issues a new token from a still-valid existing token.
// trpcAuth (global middleware) has already decoded the Bearer token into
// req.user before this handler runs — no credentials needed.
//
// TRADEOFF: The old token is not invalidated (no blacklist). If a token is
// stolen, both old and new are valid until the old one expires naturally.
// Acceptable for stateless JWT; add Redis blacklist if stricter revocation
// is required.
router.post('/refresh', requireUser, (req, res) => {
  const token = signToken({
    id:       req.user!.id,
    username: req.user!.username,
    email:    req.user!.email ?? null,
    tier:     req.user!.tier,
  });

  return res.json({
    token,
    user: {
      id:       req.user!.id,
      username: req.user!.username,
      email:    req.user!.email ?? null,
      tier:     req.user!.tier,
    },
  });
});

export default router;
