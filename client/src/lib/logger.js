/**
 * Minimal logger shim — drop-in compatible with pino's object-first API.
 * Replace with pino when structured logging is wired up.
 * PRD §8.1: no console.* in production code — this shim silences in prod.
 */
function fmt(obj, msg) {
    const extras = Object.keys(obj).length ? ` ${JSON.stringify(obj)}` : '';
    return `[R3]${extras} ${msg}`;
}
export const logger = {
    error: (obj, msg) => {
        if (process.env.NODE_ENV !== 'production')
            console.error(fmt(obj, msg));
    },
    warn: (obj, msg) => {
        if (process.env.NODE_ENV !== 'production')
            console.warn(fmt(obj, msg));
    },
    info: (obj, msg) => {
        if (process.env.NODE_ENV !== 'production')
            console.info(fmt(obj, msg));
    },
};
