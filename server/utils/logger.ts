// server/utils/logger.ts
// Accepts both calling conventions:
//   logger.info("message", meta?)           ← string-first (original)
//   logger.info({ key: val, ... }, "msg")   ← Pino-style object-first
//
// FIX: all route / middleware files use Pino-style. The old signature
// (message: string, meta?: unknown) caused TS2345 on every structured
// log call. resolveArgs() normalises both styles before formatting.

type LogLevel = "info" | "warn" | "error" | "debug";

function makeEntry(level: LogLevel, message: string, meta?: unknown): string {
  const ts     = new Date().toISOString();
  const suffix = meta !== undefined ? " " + JSON.stringify(meta) : "";
  return "[" + ts + "] [" + level.toUpperCase() + "] " + message + suffix;
}

function resolveArgs(
  msgOrMeta: string | Record<string, unknown>,
  metaOrMsg?: unknown,
): { message: string; meta?: unknown } {
  if (typeof msgOrMeta === "string") {
    return { message: msgOrMeta, meta: metaOrMsg };
  }
  return { message: metaOrMsg as string, meta: msgOrMeta };
}

export const logger = {
  info(msgOrMeta: string | Record<string, unknown>, metaOrMsg?: unknown): void {
    const { message, meta } = resolveArgs(msgOrMeta, metaOrMsg);
    process.stdout.write(makeEntry("info", message, meta) + "\n");
  },
  warn(msgOrMeta: string | Record<string, unknown>, metaOrMsg?: unknown): void {
    const { message, meta } = resolveArgs(msgOrMeta, metaOrMsg);
    console.warn(makeEntry("warn", message, meta));
  },
  error(msgOrMeta: string | Record<string, unknown>, metaOrMsg?: unknown): void {
    const { message, meta } = resolveArgs(msgOrMeta, metaOrMsg);
    console.error(makeEntry("error", message, meta));
  },
  debug(msgOrMeta: string | Record<string, unknown>, metaOrMsg?: unknown): void {
    if (process.env.NODE_ENV !== "production") {
      const { message, meta } = resolveArgs(msgOrMeta, metaOrMsg);
      console.debug(makeEntry("debug", message, meta));
    }
  },
  child(context: Record<string, unknown>) {
    const prefix = Object.entries(context).map(([k, v]) => k + "=" + String(v)).join(" ");
    return {
      info:  (m: string | Record<string, unknown>, x?: unknown) => { const r = resolveArgs(m, x); logger.info("[" + prefix + "] " + r.message, r.meta); },
      warn:  (m: string | Record<string, unknown>, x?: unknown) => { const r = resolveArgs(m, x); logger.warn("[" + prefix + "] " + r.message, r.meta); },
      error: (m: string | Record<string, unknown>, x?: unknown) => { const r = resolveArgs(m, x); logger.error("[" + prefix + "] " + r.message, r.meta); },
      debug: (m: string | Record<string, unknown>, x?: unknown) => { const r = resolveArgs(m, x); logger.debug("[" + prefix + "] " + r.message, r.meta); },
    };
  },
};

export default logger;
