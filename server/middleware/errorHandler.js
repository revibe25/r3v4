/**
 * middleware/errorHandler.ts [ENHANCED]
 *
 * Comprehensive error handler with:
 * - Proper Express 4-parameter signature (err, req, res, next)
 * - Type-safe error discrimination
 * - Async error wrapping support
 * - Detailed logging without leaking sensitive data
 * - Response completion verification to prevent double-send
 */
import { ZodError } from 'zod';
import { TRPCError } from '@trpc/server';
import { logger } from '../lib/logger';
// Express requires exactly 4 parameters (err, req, res, next) for error handlers.
// The fourth parameter (next) must be present even if unused, to distinguish
// this as an error-handling middleware.
// ── Error handler ─────────────────────────────────────────────────────────────
export function loopStationErrorHandler(err, req, res, _next) {
    // Guard: response already sent
    if (res.headersSent) {
        logger.warn('Attempted to send error response but headers already sent', {
            path: req.path,
            method: req.method,
        });
        return;
    }
    // ── Error discrimination ──────────────────────────────────────────────────
    // Zod validation errors → 422 Unprocessable Entity
    if (err instanceof ZodError) {
        res.status(422).json({
            error: 'Validation error',
            details: err.errors,
            timestamp: new Date().toISOString(),
        });
        return;
    }
    // tRPC errors → map to appropriate HTTP status
    if (err instanceof TRPCError) {
        const statusMap = {
            'PARSE_ERROR': 400,
            'BAD_REQUEST': 400,
            'NOT_FOUND': 404,
            'INTERNAL_SERVER_ERROR': 500,
            'UNAUTHORIZED': 401,
            'FORBIDDEN': 403,
            'METHOD_NOT_SUPPORTED': 405,
            'TIMEOUT': 408,
            'CONFLICT': 409,
            'PRECONDITION_FAILED': 412,
            'PAYLOAD_TOO_LARGE': 413,
            'UNPROCESSABLE_CONTENT': 422,
            'TOO_MANY_REQUESTS': 429,
            'CLIENT_CLOSED_REQUEST': 499,
        };
        const statusCode = statusMap[err.code] ?? 500;
        // Only log INTERNAL_SERVER_ERROR — UNAUTHORIZED/FORBIDDEN are expected control flow
        if (err.code === 'INTERNAL_SERVER_ERROR') {
            logger.error(`[tRPC ${err.code}] ${req.method} ${req.path}`, {
                message: err.message,
                cause: err.cause instanceof Error ? err.cause.message : String(err.cause),
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
            });
        }
        else {
            logger.debug(`[tRPC ${err.code}] ${req.method} ${req.path}`, {
                message: err.message,
            });
        }
        res.status(statusCode).json({
            error: err.message,
            code: err.code,
            timestamp: new Date().toISOString(),
        });
        return;
    }
    // Standard Error object
    if (err instanceof Error) {
        const statusCode = (err.status ?? err.statusCode) || 500;
        const code = (err.code) || 'INTERNAL_ERROR';
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
    });
}
// ── Async error wrapper ───────────────────────────────────────────────────────
// Wraps async route handlers to catch unhandled rejections.
// Usage: app.get('/path', asyncHandler(async (req, res) => { ... }))
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
