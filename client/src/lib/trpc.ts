/**
 * client/src/lib/trpc.ts
 *
 * tRPC React client wired to the R3 server.
 *
 * Auth: reads the JWT from useAuthStore (Zustand, persisted to localStorage)
 * and sends it as "Authorization: Bearer <token>" on every request.
 * useAuthStore.getState() is safe to call outside React — Zustand stores
 * are module-level singletons.
 *
 * The custom fetch wrapper is removed. httpBatchLink's built-in fetch is
 * sufficient once the Authorization header is present; credentials: 'include'
 * was sending cookies that the server never sets or reads.
 */

import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../shared/types/trpc';
import { useAuthStore } from '../store/auth-store';

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      headers: () => {
        const token = useAuthStore.getState().token;
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});
