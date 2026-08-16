import { Request, Response, NextFunction } from 'express';
import { TRPCError } from '@trpc/server';
import { ZodError } from 'zod';
import logger from '../utils/logger';

interface AppError extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
}

/**
 * Express error-handling middleware
 * MUST be registered LAST, after all other middleware and routes
 * Signature: (err, req, res, next) => void
 */
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // ── Error discrimination ──────────────────────────────────────────────────

  // tRPC errors
  if (err instanceof TRPCError) {
    const statusMap: Record<string, number> = {
      'PARSE_ERROR': 400,
      'BAD_REQUEST': 400,
      'UNAUTHORIZED': 401,
      'FORBIDDEN': 403,
      'NOT_FOUND': 404,
      'CONFLICT': 409,
      'PRECONDITION_FAILED': 412,
      'PAYLOAD_TOO_LARGE': 413,
      'INTERNAL_SERVER_ERROR': 500,
    };

    const status = statusMap[err.code] || 500;
    logger.warn(`[tRPC ${err.code}] ${req.method} ${req.path}`, {
      message: err.message,
    });

    res.status(status).json({
      error: err.message,
      code: err.code,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Zod validation errors → 422 Unprocessable Entity
  if (err instanceof ZodError) {
    res.status(422).json({
      error: 'Validation error',
      details: err.errors,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Standard Error object
  if (err instanceof Error) {
    const statusCode = ((err as AppError).status ?? (err as AppError).statusCode) || 500;
    const code = ((err as AppError).code) || 'INTERNAL_ERROR';

    logger.error(`[${statusCode}] ${req.method} ${req.path}`, {
      error: err.message,
      code,
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
        cause: 'cause' in err && err.cause instanceof Error ? err.cause.message : undefined,
      }),
    });

    res.status(statusCode).json({
      error: err.message,
      code,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Unknown error (string, number, null, undefined, etc.)
  const unknownErr = String(err);
  logger.error(`[500] ${req.method} ${req.path} – unknown error type`, {
    error: unknownErr,
    type: typeof err,
    ...(process.env.NODE_ENV === 'development' && { raw: err }),
  });

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { debug: unknownErr }),
  });
};
