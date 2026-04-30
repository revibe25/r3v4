/**
 * client/src/utils/trpc.ts
 *
 * Compatibility shim — re-exports the tRPC React client from its canonical
 * location in lib/trpc.ts for consumers that import from utils/trpc.
 *
 * WHY: useSessionLifecycle (in both hook/ and hooks/) imports from
 * '../utils/trpc'. The canonical client lives in lib/trpc.ts. Rather than
 * moving the canonical file (which would break other imports), this shim
 * bridges the path difference.
 *
 * CONSUMERS should prefer importing directly from '../lib/trpc' for new code.
 */

export { trpc } from '../lib/trpc';
