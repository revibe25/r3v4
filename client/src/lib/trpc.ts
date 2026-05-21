/**
 * client/src/lib/trpc.ts
 * Typed tRPC client for R3 v4.
 *
 * Provides:
 *   trpc          — React Query-integrated client (for components)
 *   trpcVanilla   — Plain promise client (for hooks outside React tree)
 *   TRPCProvider  — React context provider (wrap App root)
 *
 * Auth flow:
 *   - JWT token lives in useAuthStore (Zustand in-memory state)
 *   - Token is restored from localStorage('r3_token') on app init via initAuth()
 *   - getAuthHeaders() reads useAuthStore.getState().token on every request
 *     so the Authorization header is always in sync with the live Zustand state
 *   - This prevents the race condition where hasToken=true but localStorage
 *     hasn't been written yet (e.g. immediately after login)
 */

import {
  createTRPCReact,
  createTRPCProxyClient,
  httpBatchLink,
  loggerLink,
} from '@trpc/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useState } from 'react';
import type { AppRouter } from '../../../shared/types/trpc';
import { useAuthStore } from '../hooks/authStore';

// ── Singleton QueryClient ─────────────────────────────────────────────────────

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:  1000 * 60 * 5,   // 5 min
      gcTime:     1000 * 60 * 10,  // 10 min
      retry: (failureCount, error) => {
        // Never retry on 401/403 — retrying just spams the server
        const trpcError = error as { data?: { httpStatus?: number } };
        const status = trpcError?.data?.httpStatus;
        if (status === 401 || status === 403) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

// ── Auth header helper ────────────────────────────────────────────────────────
//
// Reads from useAuthStore.getState() — Zustand's synchronous out-of-React
// accessor — so it always reflects the live token, even immediately after
// login before the next render cycle. This is the same source as:
//   useAuthStore(s => Boolean(s.token))   ← used by useSubscription enabled guard
// Keeping both reads from the same store eliminates the localStorage key
// mismatch that caused 401s right after login.

function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── API base URL ──────────────────────────────────────────────────────────────

const API_URL = `${(import.meta.env?.VITE_API_URL as string | undefined) ?? ''}/api/trpc`;

// ── React Query-integrated tRPC client ───────────────────────────────────────

export const trpc = createTRPCReact<AppRouter>();

// ── Vanilla (promise-based) client for use outside React tree ─────────────────

export const trpcVanilla = createTRPCProxyClient<AppRouter>({
  links: [
    loggerLink({
      enabled: opts =>
        (import.meta.env?.DEV as boolean | undefined) === true &&
        (opts.direction === 'down' && opts.result instanceof Error),
    }),
    httpBatchLink({
      url: API_URL,
      headers: getAuthHeaders,
      fetch: (url: RequestInfo | URL, options?: RequestInit) =>
        fetch(url, { ...options, credentials: 'include' }),
    }),
  ],
});

// ── Provider component ────────────────────────────────────────────────────────

interface TRPCProviderProps {
  children: React.ReactNode;
}

export function TRPCProvider({ children }: TRPCProviderProps) {
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        loggerLink({
          enabled: opts =>
            (import.meta.env?.DEV as boolean | undefined) === true &&
            (opts.direction === 'down' && opts.result instanceof Error),
        }),
        httpBatchLink({
          url: API_URL,
          headers: getAuthHeaders,
          fetch: (url: RequestInfo | URL, options?: RequestInit) =>
            fetch(url, { ...options, credentials: 'include' }),
          maxURLLength: 2083,
        }),
      ],
    }),
  );

  return React.createElement(
    trpc.Provider,
    {
      client: trpcClient,
      queryClient,
      children: React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children,
      ),
    },
  );
}

// ── Typed helper: invalidate DAW queries after mutations ──────────────────────

export function invalidateDAWQueries(): void {
  queryClient.invalidateQueries({ queryKey: [['daw', 'project.list']] });
}

// ── Error classifiers ─────────────────────────────────────────────────────────

export function isTRPCForbidden(err: unknown): boolean {
  return (err as { data?: { code?: string } })?.data?.code === 'FORBIDDEN';
}

export function isTRPCUnauthorized(err: unknown): boolean {
  const code = (err as { data?: { code?: string } })?.data?.code;
  return code === 'UNAUTHORIZED' || code === 'NOT_FOUND';
}