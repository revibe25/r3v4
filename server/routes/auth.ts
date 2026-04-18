/**
 * server/routes/auth.ts
 *
 * Authentication routes: /register, /login, /logout, /me, /change-password.
 *
 * Security considerations:
 * - Timing attack prevention: Always run bcrypt.compare even when user not found
 * - Lazy DUMMY_HASH: Computed on first request, cached for process lifetime
 * - Credential field: Accepts email OR username (determined by "@" presence)
 * - Password field: Stored as 'password' column in DB (schema confirmed)
 * - Token lifecycle: JWT with configurable expiry, stateless validation
 */

import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { storage } from "../storage";
import { logger } from "../utils/logger";
import { requireUser } from "../middleware/requireUser";

const router = Router();

// ── Environment config ────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET ?? "dev_secret_do_not_use_in_production_32x";
const JWT_EXPIRES = (process.env.JWT_EXPIRES ?? "7d") as string;
const BCRYPT_ROUNDS = 12;

// ── §SES.8 BLOCK fix 1: lazy DUMMY_HASH singleton ────────────────────────────
// Do NOT use top-level await — causes SyntaxError in CommonJS.
// Computed on first request and cached for the process lifetime.
let _dummyHash: string | null = null;

async function getDummyHash(): Promise<string> {
  if (_dummyHash === null) {
    _dummyHash = await bcrypt.hash("__r3_dummy_password__", BCRYPT_ROUNDS);
  }
  return _dummyHash;
}

// ── Validation schemas ────────────────────────────────────────────────────────

const registerSchema = z.object({
  /**
   * Email is optional — users may register with username only.
   * If provided, must be valid email format.
   */
  email: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")), // Allow empty string as falsy
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username must be at most 32 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username may only contain letters, digits, _ or -"
    ),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
});

/**
 * §SES.8 BLOCK fix 2: `credential` accepts email OR username.
 * Single field resolved at login time based on "@" presence.
 */
const loginSchema = z.object({
  credential: z
    .string()
    .min(1, "Email or username is required")
    .max(255, "Credential is too long"),
  password: z.string().min(1, "Password is required"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Sign JWT token with user payload.
 * Expiry is controlled via JWT_EXPIRES env var (default: 7d).
 */
function signToken(payload: {
  id: string;
  email?: string;
  username?: string;
  tier: string;
}): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES,
  } as jwt.SignOptions);
}

/**
 * Remove sensitive fields from user object before sending to client.
 * CRITICAL: Removes 'password' field (the actual column name), not 'passwordHash'.
 */
function safeUser(user: Record<string, unknown>) {
  const { password: _, ...rest } = user;
  return rest;
}

/**
 * Normalize credential to email format for logging/debugging.
 * If credential looks like email, use it; otherwise return masked username.
 */
function normalizeCredentialForLog(credential: string): string {
  return credential.includes("@") ? credential : `user:${credential}`;
}

// ── POST /auth/register ───────────────────────────────────────────────────────

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn(
      { errors: parsed.error.flatten() },
      "register: validation failed"
    );
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { email, username, password } = parsed.data;

  try {
    // ── Check username uniqueness ─────────────────────────────────────────────
    const existingByUsername = await storage.getUserByUsername(username);
    if (existingByUsername) {
      logger.warn({ username }, "register: username already taken");
      return res.status(409).json({ error: "Username is already taken" });
    }

    // ── Check email uniqueness (if provided) ──────────────────────────────────
    if (email) {
      const existingByEmail = await storage.getUserByEmail(email);
      if (existingByEmail) {
        logger.warn({ email }, "register: email already registered");
        return res.status(409).json({
          error: "Email address is already registered",
        });
      }
    }

    // ── Hash password with bcrypt ─────────────────────────────────────────────
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // ── Create user in database ───────────────────────────────────────────────
    const user = await storage.createUser({
      email: email || null, // Store null if email is empty string
      username,
      password: passwordHash,
      tier: "explorer",
    });

    // ── Sign JWT ──────────────────────────────────────────────────────────────
    const token = signToken({
      id: user.id,
      email: (user.email as string | null) ?? undefined,
      username: user.username as string,
      tier: (user.tier as string | undefined) ?? "explorer",
    });

    logger.info({ userId: user.id, username }, "User registered successfully");

    return res.status(201).json({
      token,
      user: safeUser(user as Record<string, unknown>),
    });
  } catch (err) {
    logger.error({ err }, "register: unexpected error");
    return res
      .status(500)
      .json({ error: "Registration failed — please try again later" });
  }
});

// ── POST /auth/login ──────────────────────────────────────────────────────────

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn(
      { errors: parsed.error.flatten(), credential: req.body.credential },
      "login: validation failed"
    );
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { credential, password } = parsed.data;

  try {
    // ── Determine lookup strategy ─────────────────────────────────────────────
    const isEmailAttempt = credential.includes("@");
    const credentialLog = normalizeCredentialForLog(credential);

    // ── Fetch user by credential ──────────────────────────────────────────────
    const user = isEmailAttempt
      ? await storage.getUserByEmail(credential)
      : await storage.getUserByUsername(credential);

    if (!user) {
      logger.warn({ credential: credentialLog }, "login: user not found");
    }

    // ── Timing-attack prevention: Always compare password ────────────────────
    // If user not found or password field missing, compare against dummy hash
    // to ensure consistent timing across success and failure paths.
    const dummyHash = await getDummyHash();
    const storedHash = (user as Record<string, unknown>)?.password as
      | string
      | undefined;

    const passwordValid = await bcrypt.compare(
      password,
      storedHash ?? dummyHash
    );

    // ── Reject if user not found or password invalid ──────────────────────────
    if (!user || !passwordValid) {
      logger.warn(
        {
          credential: credentialLog,
          userFound: !!user,
          passwordValid,
        },
        "login: authentication failed"
      );
      // Generic error — never reveal whether account exists
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // ── Sign JWT ──────────────────────────────────────────────────────────────
    const u = user as Record<string, unknown>;
    const token = signToken({
      id: u.id as string,
      email: (u.email as string | null) ?? undefined,
      username: u.username as string,
      tier: (u.tier as string | undefined) ?? "explorer",
    });

    logger.info(
      { userId: u.id, username: u.username, credential: credentialLog },
      "User logged in successfully"
    );

    return res.json({
      token,
      user: safeUser(u),
    });
  } catch (err) {
    logger.error({ err, credential: req.body.credential }, "login: error");
    return res
      .status(500)
      .json({ error: "Login failed — please try again later" });
  }
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────

router.post("/logout", (_req, res) => {
  /**
   * Stateless JWT: client is responsible for clearing stored token.
   *
   * For server-side token invalidation, implement a token blocklist:
   * 1. Store revoked token JTI (claim id) in Redis with TTL = token expiry
   * 2. Check blocklist in auth middleware before accepting token
   * 3. Add 'jti' claim to signToken() payload
   *
   * For now, logout is a no-op on server side.
   */
  res.json({ message: "Logged out successfully" });
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────

router.get("/me", requireUser, async (req, res) => {
  try {
    const userId = req.user!.id;

    // ── Fetch fresh user data from DB ────────────────────────────────────────
    const user = await storage.getUserById(userId);
    if (!user) {
      logger.warn({ userId }, "me: user not found in DB");
      return res.status(404).json({ error: "User not found" });
    }

    logger.debug({ userId }, "me: user fetched");

    return res.json({ user: safeUser(user as Record<string, unknown>) });
  } catch (err) {
    logger.error({ err, userId: req.user!.id }, "me: unexpected error");
    return res
      .status(500)
      .json({ error: "Failed to fetch user profile" });
  }
});

// ── POST /auth/change-password ────────────────────────────────────────────────

router.post("/change-password", requireUser, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn(
      { errors: parsed.error.flatten() },
      "change-password: validation failed"
    );
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { currentPassword, newPassword } = parsed.data;
  const userId = req.user!.id;

  try {
    // ── Fetch user from DB ────────────────────────────────────────────────────
    const user = await storage.getUserById(userId);
    if (!user) {
      logger.warn({ userId }, "change-password: user not found");
      return res.status(404).json({ error: "User not found" });
    }

    const u = user as Record<string, unknown>;

    // ── CRITICAL FIX: Read 'password' column, NOT 'passwordHash' ──────────────
    const currentHash = u.password as string | undefined;

    if (!currentHash) {
      logger.warn({ userId }, "change-password: no password hash stored");
      return res.status(400).json({
        error: "Cannot change password for this account type",
      });
    }

    // ── Verify current password ───────────────────────────────────────────────
    const valid = await bcrypt.compare(currentPassword, currentHash);
    if (!valid) {
      logger.warn({ userId }, "change-password: incorrect current password");
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // ── Hash new password ─────────────────────────────────────────────────────
    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // ── Update password in DB ─────────────────────────────────────────────────
    await storage.updateUserPassword(userId, newHash);

    logger.info({ userId }, "Password changed successfully");
    return res.json({ message: "Password updated successfully" });
  } catch (err) {
    logger.error({ err, userId }, "change-password: unexpected error");
    return res
      .status(500)
      .json({ error: "Failed to update password" });
  }
});

export default router;
export const authRouter = router;
