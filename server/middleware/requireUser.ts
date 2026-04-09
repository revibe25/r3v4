// ============================================================
// server/middleware/requireUser.ts
// Express middleware: 401 if req.user is not set.
// Used by protected routes after auth middleware runs.
// ============================================================
import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export function requireUser(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    logger.warn("requireUser: unauthenticated request", {
      path:   req.path,
      method: req.method,
      ip:     req.ip,
    });
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

export default requireUser;
