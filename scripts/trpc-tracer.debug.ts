/**
 * tRPC Tracer Middleware Integration
 * 
 * Attaches to tRPC httpLink middleware as a read-only observer.
 * Records mutations from tRPC payloads without modifying requests/responses.
 * 
 * Integration point: client/src/lib/trpc.ts httpLink
 * 
 * @module client/src/debug/trpc-tracer.debug.ts
 */

import type { AnyRouter } from '@trpc/server';
import { recordMutationFromMiddleware } from './mutation-tracer.debug';

// ─────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────

export interface TracedHttpLinkOptions {
  enabled?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// MUTATION DETECTION FROM TRPC PAYLOADS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Recursively extract mutations from a tRPC request body
 * Only processes mutation operations (POST with data), not queries
 */
function extractMutationsFromPayload(body: unknown, parentKey: string = ''): void {
  if (!body || typeof body !== 'object') {
    return;
  }

  const obj = body as Record<string, unknown>;

  // For each field in the payload
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = parentKey ? `${parentKey}.${key}` : key;

    // Skip internal tRPC fields
    if (key.startsWith('_') || key === '0') {
      continue;
    }

    // Skip null/undefined (these are field resets, not mutations of interest)
    if (value === null || value === undefined) {
      continue;
    }

    // If this is a known mutation field, record it
    if (isMutationField(fullKey)) {
      try {
        // For simplicity: treat any recorded value as a mutation
        // Baseline comparison happens in mutation-tracer.debug.ts
        recordMutationFromMiddleware(fullKey, undefined, value);
      } catch (error) {
        console.warn('[TRPC-TRACER] Failed to record mutation:', { fullKey, error });
      }
    }

    // Recurse into objects (but not arrays; arrays are data, not schema)
    if (typeof value === 'object' && !Array.isArray(value)) {
      extractMutationsFromPayload(value, fullKey);
    }
  }
}

/**
 * Heuristic: determine if a field is likely a mutation (not metadata/timestamps)
 */
function isMutationField(fieldName: string): boolean {
  // Skip timestamps, IDs, internal fields
  const skipFields = new Set([
    'id',
    'createdAt',
    'updatedAt',
    'timestamp',
    'requestId',
    'traceId',
    'version',
    '_internal',
    '_metadata',
  ]);

  if (skipFields.has(fieldName)) {
    return false;
  }

  // Skip deeply nested fields (more than 3 levels)
  const depth = fieldName.split('.').length;
  if (depth > 3) {
    return false;
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// HTTPLINK MIDDLEWARE ATTACHMENT
// ─────────────────────────────────────────────────────────────────────────

/**
 * Creates a read-only observer middleware for tRPC httpLink
 * 
 * Usage in client/src/lib/trpc.ts:
 * 
 *   import { createTracingHttpLinkMiddleware } from '@/debug/trpc-tracer.debug';
 *   
 *   const httpLink = http({
 *     url: `${getBaseUrl()}/trpc`,
 *     middleware: [
 *       createTracingHttpLinkMiddleware(),
 *       // ... other middleware
 *     ],
 *   });
 * 
 * NOTE: This is a read-only observer. It NEVER modifies requests or responses.
 */
export function createTracingHttpLinkMiddleware() {
  return (opts: any) => async (req: any) => {
    try {
      // BEFORE: Observe request payload
      if (req.body) {
        try {
          const bodyJson = typeof req.body === 'string' 
            ? JSON.parse(req.body)
            : req.body;

          // Only record if this is a mutation operation (has input data)
          if (bodyJson.input) {
            extractMutationsFromPayload(bodyJson.input);
          }
        } catch (parseError) {
          // Ignore parse errors; body might not be JSON
        }
      }

      // PASSTHROUGH: Call next middleware/handler (unchanged)
      const result = await opts.next(req);

      // AFTER: Observe response (optional; mutation results could be recorded)
      // For MVP, we only care about request mutations
      // Future: could record mutation outcomes from result.data

      // RETURN: Unmodified response
      return result;
    } catch (error) {
      // Never crash the middleware on tracer errors
      console.warn('[TRPC-TRACER] Middleware error:', error);
      // Continue with next middleware
      return opts.next(req);
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────
// ALTERNATIVE: DIRECT HTTPLINK INTERCEPTION (if middleware API differs)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Alternative approach: Wrap the httpLink directly (if middleware API doesn't work)
 * 
 * Usage in client/src/lib/trpc.ts:
 * 
 *   import { wrapHttpLinkWithTracing } from '@/debug/trpc-tracer.debug';
 *   
 *   const baseHttpLink = http({
 *     url: `${getBaseUrl()}/trpc`,
 *   });
 *   
 *   const tracedHttpLink = wrapHttpLinkWithTracing(baseHttpLink);
 */
export function wrapHttpLinkWithTracing(httpLink: any) {
  return (opts: any) => {
    const operation = opts;

    // Observe operation input
    if (operation.input) {
      try {
        extractMutationsFromPayload(operation.input);
      } catch (error) {
        console.warn('[TRPC-TRACER] Failed to extract mutations:', error);
      }
    }

    // Call original httpLink (unmodified)
    return httpLink(opts);
  };
}

// ─────────────────────────────────────────────────────────────────────────
// DEFERRED: RESPONSE MUTATION RECORDING
// ─────────────────────────────────────────────────────────────────────────

/**
 * TODO (P3, post-launch): Record mutation outcomes from response
 * 
 * Currently only records request mutations (what user intended to change).
 * Future: could also record response mutations (what actually changed on server).
 * 
 * Example:
 *   if (result.ok && result.data?.track) {
 *     recordMutationFromMiddleware('track.name', undefined, result.data.track.name);
 *   }
 */
