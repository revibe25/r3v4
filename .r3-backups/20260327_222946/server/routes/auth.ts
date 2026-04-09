/**
 * server/routes/auth.ts
 *
 * Authentication routes: /register, /login, /logout, /me.
 *
 * §SES.8 BLOCK fix 1 — Lazy DUMMY_HASH:
 *   Was: const DUMMY_HASH = await bcrypt.hash('__dummy__', 10);  ← top-level await
 *   Top-level await in a CommonJS module (or tsx without "type":"module") raises
 *   a SyntaxError at startup.  The hash is now computed on the first login
 *   request and cached in _dummyHash so subsequent calls reuse it with no
 *   extra bcrypt work.  The dummy hash is always compared even when the user
 *   is not found to prevent timing-based user enumeration.
 *
 * §SES.8 BLOCK fix 2 — credential field (email OR username):
 *   Was: loginSchema required an `email` field only.
 *   Users who registered without an email were permanently locked out because
 *   there was no way to supply a non-email credential.  The schema now accepts
 *   a single `credential` field that is resolved to email or username lookup
 *   based on whether it contains an "@" character.
 */

import { Router } from "express";
import bcrypt      from "bcrypt";
import jwt         from "jsonwebtoken";
import { z }       from "zod";
import { storage } from "../storage";
import { logger }  from "../utils/logger";
import { requireUser } from "../middleware/requireUser";

const router = Router();

// ── Environment config ────────────────────────────────────────────────────────
const JWT_SECRET  = process.env.JWT_SECRET  ?? "change-me-in-production";
const JWT_EXPIRES = (process.env.JWT_EXPIRES ?? "7d") as string;
const BCRYPT_ROUNDS = 12;

// ── §SES.8 BLOCK fix 1: lazy DUMMY_HASH singleton ────────────────────────────
// Do NOT replace with top-level await — that causes SyntaxError in CJS contexts.
let _dummyHash: string | null = null;

async function getDummyHash(): Promise<string> {
  if (_dummyHash === null) {
    // Compute once, cache indefinitely for the life of the process.
    _dummyHash = await bcrypt.hash("__r3_dummy_password__", BCRYPT_ROUNDS);
  }
  return _dummyHash;
}

// ── Validation schemas ────────────────────────────────────────────────────────

const registerSchema = z.object({
  /**
   * Email is optional — users may register with a username only.
   * If provided it must be a valid email format.
   */
  email:    z.string().email("Invalid email address").optional(),
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username must be at most 32 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username may only contain letters, digits, _ or -"),
  password: z.string()
    .min(8,  "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
});

/**
 * §SES.8 BLOCK fix 2: `credential` accepts email OR username.
 * Was: { email: z.string().email() } — locked out username-only accounts.
 */
const loginSchema = z.object({
  credential: z.string().min(1, "Email or username is required"),
  password:   z.string().min(1, "Password is required"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(8).max(128),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function signToken(payload: {
  id: string; email?: string; username?: string; tier: string;
}): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES } as jwt.SignOptions);
}

function safeUser(user: Record<string, unknown>) {
  const { passwordHash: _, ...rest } = user;
  return rest;
}

// ── POST /auth/register ───────────────────────────────────────────────────────

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { email, username, password } = parsed.data;

  try {
    const existingByUsername = await storage.getUserByUsername(username);
    if (existingByUsername) {
      return res.status(409).json({ error: "Username is already taken" });
    }

    if (email) {
      const existingByEmail = await storage.getUserByEmail(email);
      if (existingByEmail) {
        return res.status(409).json({ error: "Email address is already registered" });
      }
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await storage.createUser({
      email,
      username,
      passwordHash,
      tier: "explorer",
    });

    const token = signToken({
      id:       user.id,
      email:    user.email as string | undefined,
      username: user.username as string,
      tier:     (user.tier as string | undefined) ?? "explorer",
    });

    logger.info({ userId: user.id, username }, "User registered");

    return res.status(201).json({
      token,
      user: safeUser(user as Record<string, unknown>),
    });
  } catch (err) {
    logger.error({ err }, "register: unexpected error");
    return res.status(500).json({ error: "Registration failed — please try again" });
  }
});

// ── POST /auth/login ──────────────────────────────────────────────────────────

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { credential, password } = parsed.data;

  try {
    // §SES.8 fix 1: getDummyHash() is lazy — safe to call on every request
    const dummyHash = await getDummyHash();

    // §SES.8 fix 2: resolve credential as email or username
    const isEmailAttempt = credential.includes("@");

    const user = isEmailAttempt
      ? await storage.getUserByEmail(credential)
      : await storage.getUserByUsername(credential);

    // Always run bcrypt.compare to prevent timing-based user enumeration.
    // If user not found, compare against dummyHash (result will be false).
    const hashToVerify = (user as Record<string, unknown> | null)?.passwordHash as string | undefined;
    const passwordValid = await bcrypt.compare(
      password,
      hashToVerify ?? dummyHash,
    );

    if (!user || !passwordValid) {
      // Generic error — do not reveal whether the account exists
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const u = user as Record<string, unknown>;
    const token = signToken({
      id:       u.id as string,
      email:    u.email as string | undefined,
      username: u.username as string,
      tier:     (u.tier as string | undefined) ?? "explorer",
    });

    logger.info({ userId: u.id, username: u.username }, "User logged in");

    return res.json({
      token,
      user: safeUser(u),
    });
  } catch (err) {
    logger.error({ err }, "login: unexpected error");
    return res.status(500).json({ error: "Login failed — please try again" });
  }
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────

router.post("/logout", (_req, res) => {
  // Stateless JWT: the client is responsible for clearing its stored token.
  // To support server-side invalidation, maintain a token blocklist in Redis
  // and check it in the auth middleware.
  res.json({ message: "Logged out successfully" });
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────

router.get("/me", requireUser, async (req, res) => {
  try {
    const user = await storage.getUserById(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.json({ user: safeUser(user as Record<string, unknown>) });
  } catch (err) {
    logger.error({ err, userId: req.user!.id }, "me: unexpected error");
    return res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

// ── POST /auth/change-password ────────────────────────────────────────────────

router.post("/change-password", requireUser, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { currentPassword, newPassword } = parsed.data;
  const userId = req.user!.id;

  try {
    const user = await storage.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const u = user as Record<string, unknown>;
    const currentHash = u.passwordHash as string | undefined;

    if (!currentHash) {
      return res.status(400).json({ error: "Cannot change password for this account type" });
    }

    const valid = await bcrypt.compare(currentPassword, currentHash);
    if (!valid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await storage.updateUserPassword(userId, newHash);

    logger.info({ userId }, "Password changed");
    return res.json({ message: "Password updated successfully" });
  } catch (err) {
    logger.error({ err, userId }, "change-password: unexpected error");
    return res.status(500).json({ error: "Failed to update password" });
  }
});

export default router;
