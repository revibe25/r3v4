// server/utils/logger.ts
// Accepts both calling conventions:
//   logger.info("message", meta?)           ← string-first (original)
//   logger.info({ key: val, ... }, "msg")   ← Pino-style object-first
//
// FIX: all route / middleware files use Pino-style. The old signature
// (message: string, meta?: unknown) caused TS2345 on every structured
// log call. resolveArgs() normalises both styles before formatting.
function makeEntry(level, message, meta) {
    const ts = new Date().toISOString();
    const suffix = meta !== undefined ? " " + JSON.stringify(meta) : "";
    return "[" + ts + "] [" + level.toUpperCase() + "] " + message + suffix;
}
function resolveArgs(msgOrMeta, metaOrMsg) {
    if (typeof msgOrMeta === "string") {
        return { message: msgOrMeta, meta: metaOrMsg };
    }
    return { message: metaOrMsg, meta: msgOrMeta };
}
export const logger = {
    info(msgOrMeta, metaOrMsg) {
        const { message, meta } = resolveArgs(msgOrMeta, metaOrMsg);
        process.stdout.write(makeEntry("info", message, meta) + "\n");
    },
    warn(msgOrMeta, metaOrMsg) {
        const { message, meta } = resolveArgs(msgOrMeta, metaOrMsg);
        console.warn(makeEntry("warn", message, meta));
    },
    error(msgOrMeta, metaOrMsg) {
        const { message, meta } = resolveArgs(msgOrMeta, metaOrMsg);
        console.error(makeEntry("error", message, meta));
    },
    debug(msgOrMeta, metaOrMsg) {
        if (process.env.NODE_ENV !== "production") {
            const { message, meta } = resolveArgs(msgOrMeta, metaOrMsg);
            console.debug(makeEntry("debug", message, meta));
        }
    },
    child(context) {
        const prefix = Object.entries(context).map(([k, v]) => k + "=" + String(v)).join(" ");
        return {
            info: (m, x) => { const r = resolveArgs(m, x); logger.info("[" + prefix + "] " + r.message, r.meta); },
            warn: (m, x) => { const r = resolveArgs(m, x); logger.warn("[" + prefix + "] " + r.message, r.meta); },
            error: (m, x) => { const r = resolveArgs(m, x); logger.error("[" + prefix + "] " + r.message, r.meta); },
            debug: (m, x) => { const r = resolveArgs(m, x); logger.debug("[" + prefix + "] " + r.message, r.meta); },
        };
    },
};
export default logger;
