/**
 * server/routes/internal.ts
 *
 * Internal server-to-server monitoring endpoints.
 * Protected by INTERNAL_SECRET header — never expose to browser clients.
 *
 * Consumers: Agi-Suite api-server (server-to-server only)
 */
import { Router, type Request, type Response } from "express";
import { count, sum, avg } from "drizzle-orm";
import { db }              from "../db";
import { sessionMetrics }  from "../../shared/schema-session-metrics";

const router = Router();

const INTERNAL_SECRET = process.env["INTERNAL_SECRET"];

function requireInternalSecret(req: Request, res: Response, next: () => void) {
  if (!INTERNAL_SECRET) {
    res.status(503).json({ error: "INTERNAL_SECRET not configured" });
    return;
  }
  const header = req.headers["x-internal-secret"];
  if (header !== INTERNAL_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// GET /api/internal/metrics/time-savings
// Returns aggregate time savings across all completed sessions.
router.get(
  "/metrics/time-savings",
  requireInternalSecret,
  async (_req: Request, res: Response) => {
    try {
      const [row] = await db
        .select({
          totalSessions:    count(),
          totalSavedSeconds: sum(sessionMetrics.timeSavedSeconds),
          avgSavedSeconds:   avg(sessionMetrics.timeSavedSeconds),
        })
        .from(sessionMetrics);

      res.json({
        totalSessions:     row?.totalSessions    ?? 0,
        totalSavedSeconds: Number(row?.totalSavedSeconds ?? 0),
        avgSavedSeconds:   Number(Number(row?.avgSavedSeconds ?? 0).toFixed(1)),
      });
    } catch (err) {
      res.status(500).json({ error: "Internal error" });
    }
  }
);

export { router as internalRouter };
