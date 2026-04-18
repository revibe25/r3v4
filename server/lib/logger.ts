/**
 * Structured logger — drop-in replacement for console.log
 * Usage: import { logger } from '../lib/logger';
 *        logger.info('Server started', { port: 3000 });
 */

type Level = 'debug' | 'info' | 'warn' | 'error';
type Meta = Record<string, unknown>;

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const minLevel: Level =
  (process.env.LOG_LEVEL as Level) ??
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function log(level: Level, message: string, meta?: Meta): void {
  if (LEVELS[level] < LEVELS[minLevel]) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
  };

  const output = process.env.NODE_ENV === 'production'
    ? JSON.stringify(entry)
    : `[${entry.ts}] ${level.toUpperCase().padEnd(5)} ${message}${meta ? ' ' + JSON.stringify(meta) : ''}`;

  if (level === 'error' || level === 'warn') {
    process.stderr.write(output + '\n');
  } else {
    process.stdout.write(output + '\n');
  }
}

export const logger = {
  debug: (msg: string, meta?: Meta) => log('debug', msg, meta),
  info:  (msg: string, meta?: Meta) => log('info',  msg, meta),
  warn:  (msg: string, meta?: Meta) => log('warn',  msg, meta),
  error: (msg: string, meta?: Meta) => log('error', msg, meta),
};
