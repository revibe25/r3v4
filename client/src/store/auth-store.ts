/**
 * client/src/store/auth-store.ts
 *
 * Shim — re-exports auth symbols from their canonical location in hooks/.
 *
 * WHY THIS FILE EXISTS:
 *   store/index.ts (the store barrel) re-exports from './auth-store' for
 *   architectural consistency — all store hooks through one barrel.
 *   The canonical Zustand store is in hooks/authStore.ts.
 *   AuthStore type is derived here rather than duplicated.
 *
 * CONSUMERS should always import through the barrel:
 *   import { useAuthStore } from '@/store';     ← via store/index.ts
 *   import type { AuthUser } from '@/store';
 */

import { useAuthStore } from '../hooks/authStore';

export { useAuthStore };
export type { AuthUser } from '../hooks/authStore';

/**
 * AuthStore — the full Zustand state slice including all actions.
 * Equivalent to the return type of useAuthStore().
 * Use for typed store references, middleware, and testing mocks.
 */
export type AuthStore = ReturnType<typeof useAuthStore>;
