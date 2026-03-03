import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

// NOTE: This middleware uses the `tier` field on the `users` table.
// If you add a dedicated `subscriptions` + `usage` table later, update accordingly.

type Plan = "free" | "pro" | "studio";

const MIX_LIMITS: Record<Plan, number> = {
  free:   5,
  pro:    100,
  studio: 1000,
};

function isPlan(value: unknown): value is Plan {
  return typeof value === "string" && value in MIX_LIMITS;
}

// Extend Express Request to include the authenticated user
interface AuthRequest extends Request {
  user?: { id: string; mixesUsed?: number; tier?: string };
}

export async function enforceMixLimit(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Fetch user to get their current tier and usage
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

    // If you track mixesUsed on the user row or a separate table, update this check.
    // For now we gate on plan tier only — replace `mixesUsed` with your actual field.
    const mixesUsed: number = (user as Record<string, unknown>).mixesUsed as number ?? 0;

    if (mixesUsed >= limit) {
      res.status(403).json({
        error: "Mix limit reached",
        plan,
        limit,
        current: mixesUsed,
      });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}