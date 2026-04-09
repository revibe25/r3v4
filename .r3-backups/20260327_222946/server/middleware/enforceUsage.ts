/**
 * server/middleware/enforceUsage.ts
 *
 * Per-tier mix-count enforcement middleware.
 *
 * §SES.7 BLOCK fix — Stale tier strings updated:
 *   OLD (Lemon Squeezy era):  'free'  | 'pro'     | 'studio'
 *   NEW (Stripe migration):   'explorer' | 'creator' | 'pro_artist'
 *
 *   MIX_LIMITS keys and the isPlan() type union both use the new names.
 *   Because the old names never matched real Stripe subscription data,
 *   isPlan() always returned false, silently capping ALL users at the
 *   5-mix floor regardless of their paid tier.
 *
 * §SES.7 WARN fix — Tier fetched from DB (not JWT):
 *   Tier is mutable — a downgraded user would retain their elevated limit
 *   until their JWT expired if we read req.user.tier.  We now always
 *   re-fetch from storage so revocations take effect immediately.
 */

import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { logger } from "../utils/logger";

// ── Subscription tier type ────────────────────────────────────────────────────

/** Canonical subscription tier names (post Lemon Squeezy → Stripe migration). */
type SubscriptionTier = "explorer" | "creator" | "pro_artist";

// ── Per-tier limits ───────────────────────────────────────────────────────────

/**
 * Maximum number of mixes each tier may create.
 *
 * §SES.7 BLOCK fix: keys updated to new tier names.
 * Old (broken) keys were 'free' | 'pro' | 'studio'.
 */
const MIX_LIMITS: Record<SubscriptionTier, number> = {
  explorer:   5,
  creator:    25,
  pro_artist: Infinity,
};

/** Safe fallback when the stored tier is unrecognised. */
const DEFAULT_LIMIT = MIX_LIMITS.explorer;

// ── Tier guard ────────────────────────────────────────────────────────────────

/**
 * Type guard — returns true if `tier` is one of the three canonical values.
 *
 * §SES.7 BLOCK fix: union updated to new tier names.
 * Old union was:  'free' | 'pro' | 'studio'
 */
function isPlan(tier: unknown): tier is SubscriptionTier {
  return (
    tier === "explorer" ||
    tier === "creator"  ||
    tier === "pro_artist"
  );
}

// ── Middleware ────────────────────────────────────────────────────────────────

/**
 * Express middleware that enforces the mix limit for the authenticated user.
 *
 * Must be placed AFTER the auth middleware that populates req.user.
 *
 * @example
 *   router.post('/mixes', requireUser, enforceUsage, createMix);
 */
export async function enforceUsage(
  req:  Request,
  res:  Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    // §SES.7 WARN fix: always read tier from DB so revocations take effect
    // immediately rather than waiting for JWT expiry.
    const user = await storage.getUserById(userId);

    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    const rawTier = (user as Record<string, unknown>).tier;
    const tier: SubscriptionTier = isPlan(rawTier) ? rawTier : "explorer";
    const limit = MIX_LIMITS[tier] ?? DEFAULT_LIMIT;

    const mixCount = await storage.getMixCountByUser(userId);

    if (mixCount >= limit) {
      logger.warn(
        { userId, tier, mixCount, limit },
        "enforceUsage: mix limit reached",
      );
      res.status(403).json({
        error:      "Mix limit reached for your subscription tier",
        limit,
        current:    mixCount,
        tier,
        upgradeUrl: "/pricing",
      });
      return;
    }

    logger.debug({ userId, tier, mixCount, limit }, "enforceUsage: OK");
    next();
  } catch (err) {
    logger.error({ err, userId }, "enforceUsage: database error");
    res.status(500).json({ error: "Internal server error" });
  }
}
