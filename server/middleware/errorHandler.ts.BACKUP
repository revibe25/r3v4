/**
 * middleware/errorHandler.ts
 * Handles ZodError (422) and AppError shapes.
 * Response shape is backward-compatible with existing R3 error format.
 */
import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger';

export interface AppError extends Error { status?: number; statusCode?: number; }

export function loopStationErrorHandler(err: AppError, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(422).json({ error: 'Validation error', details: err.errors, timestamp: new Date().toISOString() });
    return;
  }
  const statusCode = err.status ?? err.statusCode ?? 500;
  const message    = err.message || 'Internal server error';
  logger.error(`[${statusCode}] ${req.method} ${req.path} – ${message}`);
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    timestamp: new Date().toISOString(),
  });
}
