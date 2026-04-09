/**
 * shared/types/trpc.ts
 *
 * Canonical client-side tRPC type surface.
 *
 * PURPOSE: The client imports AppRouter from HERE, not from server/routers/index.ts.
 * This prevents Vite from crawling server-side Node.js modules (drizzle, express,
 * pg, bcrypt, etc.) which causes the dev server to hang on page load.
 *
 * VITE RESOLVER NOTE:
 * `import type` is a TypeScript erasure — no runtime import is emitted. However,
 * Vite's module graph crawler resolves `import type` paths during dev to build its
 * dependency graph. This means even a type-only import of server/routers/index.ts
 * causes Vite to traverse drizzle, pg, and bcrypt.
 *
 * Recommended fix in vite.config.ts:
 *
 *   optimizeDeps: {
 *     exclude: ['../../server/routers/index'],
 *   }
 *
 * Or configure a path alias that maps the server router import to an empty stub
 * for the client build. Either approach prevents Vite from crawling server modules
 * while preserving full TypeScript type safety in the editor and tsc.
 *
 * RouterInputs and RouterOutputs are exported here for use by client hooks and
 * components — import them from this file, not from @trpc/server directly.
 */

import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { appRouter } from '../../server/routers/index';

export type AppRouter = typeof appRouter;

/**
 * Inferred input types for every tRPC procedure.
 *
 * Usage:
 *   import type { RouterInputs } from '@/shared/types/trpc';
 *   type CreateSessionInput = RouterInputs['sessions']['create'];
 */
export type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inferred output types for every tRPC procedure.
 *
 * Usage:
 *   import type { RouterOutputs } from '@/shared/types/trpc';
 *   type Session = RouterOutputs['sessions']['byId'];
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;