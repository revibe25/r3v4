import { logger } from "../utils/logger";
export function requireUser(req, res, next) {
    if (!req.user) {
        logger.warn("requireUser: unauthenticated request", {
            path: req.path,
            method: req.method,
            ip: req.ip,
        });
        res.status(401).json({ error: "Authentication required" });
        return;
    }
    next();
}
export default requireUser;
