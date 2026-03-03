import { Request, Response, NextFunction } from "express";

type Plan = "free" | "pro" | "studio";

const PLAN_HIERARCHY: Record<Plan, number> = {
  free:   0,
  pro:    1,
  studio: 2,
};

function isPlan(value: unknown): value is Plan {
  return typeof value === "string" && value in PLAN_HIERARCHY;
}

interface AuthRequest extends Request {
  user?: { subscription?: { plan?: string }; tier?: string };
}

export function requirePlan(requiredPlan: Plan) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const rawPlan = req.user?.subscription?.plan ?? req.user?.tier ?? "free";
    const userPlan: Plan = isPlan(rawPlan) ? rawPlan : "free";

    if (PLAN_HIERARCHY[userPlan] < PLAN_HIERARCHY[requiredPlan]) {
      res.status(403).json({
        error: "Upgrade required",
        required: requiredPlan,
        current: userPlan,
      });
      return;
    }

    next();
  };
}