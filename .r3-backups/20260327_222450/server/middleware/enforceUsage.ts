/**
 * server/middleware/enforceUsage.ts
 *
 * Fix: local AuthRequest interface conflicted with Express global augmentation
 *
 * ROOT CAUSE: This file defined:
 *   interface AuthRequest extends Request {
 *     user?: { id: string; mixesUsed?: number; tier?: string };
 *   }
 *
 * server/trpc.ts globally augments Express.Request:
 *   interface Request { user?: AuthPayload; }
 *
 * AuthPayload has { id, username, email, tier }. The local type's `user` shape
 * ({ id, mixesUsed?, tier? }) is missing `username` and `email`, making it
 * incompatible with AuthPayload. TypeScript rejects the local interface because
 * extending Request and re-narrowing user to an incompatible type is an error.
 *
 * WHY THIS FIX IS CORRECT:
 * The local AuthRequest is removed entirely. `Request` from Express already has
 * `user?: AuthPayload` via the global augmentation. `req.user?.id` and
 * `req.user?.tier` are both valid on AuthPayload. `mixesUsed` is not on
 * AuthPayload but it was never read from req.user — it was fetched from DB.
 * The cast `(user as Record<string, unknown>).mixesUsed` remains for the DB row
 * where the column may or may not exist depending on schema evolution.
 *
 * NOTE: MIX_LIMITS uses plan strings "free" | "pro" | "studio" which do not
 * match SubscriptionTier values. This middleware is legacy — the canonical
 * feature gate is server/middleware/feature-gate.ts which uses SubscriptionTier.
 * This file is left intact for any existing routes that reference it; when those
 * routes are migrated to tRPC, this file can be deleted.
 */

import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

type Plan = "free" | "pro" | "studio";

const MIX_LIMITS: Record<Plan, number> = {
  free:   5,
  pro:    100,
  studio: 1000,
};

function isPlan(value: unknown): value is Plan {
  return typeof value === "string" && value in MIX_LIMITS;
}

export async function enforceMixLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      res.status(403).json({ error: "User not found" });
      return;
    }

    const plan: Plan = isPlan(user.tier) ? user.tier : "free";
    const limit = MIX_LIMITS[plan];

    const mixesUsed: number = (user as Record<string, unknown>).mixesUsed as number ?? 0;

    if (mixesUsed >= limit) {
      res.status(403).json({ error: "Mix limit reached", plan, limit, current: mixesUsed });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}