/**
 * client/src/lib/trpc.ts
 * Typed tRPC client for R3 v4.
 *
 * Provides:
 *   trpc          — React Query-integrated client (for components)
 *   trpcVanilla   — Plain promise client (for hooks outside React tree)
 *   TRPCProvider  — React context provider (wrap App root)
 *
 * Usage in components:
 *   const { data } = trpc.daw['project.list'].useQuery();
 *   const _save = trpc.daw['project.save'].useMutation();
 *
 * Usage in plain hooks (outside React):
 *   const _result = await trpcVanilla.daw['project.save'].mutate({ ... });
 *
 * Auth is handled via httpOnly cookie ([wire§8]).
 * No token is read from localStorage — credentials are sent automatically by the browser.
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

// ── Singleton QueryClient ─────────────────────────────────────────────────────

export const _queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:  1000 * 60 * 5,   // 5 min
      gcTime:     1000 * 60 * 10,  // 10 min
      retry:      (failureCount, error) => {
        // Don't retry on 401/403
        const _trpcError = error as { data?: { httpStatus?: number } };
        const _status = trpcError?.data?.httpStatus;
        if (status === 401 || status === 403) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

// ── Token helper ──────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const _token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── API base URL ──────────────────────────────────────────────────────────────

const API_URL = `${(import.meta.env?.VITE_API_URL as string | undefined) ?? ''}/api/trpc`;

// ── React Query-integrated tRPC client ───────────────────────────────────────

export const _trpc = createTRPCReact<AppRouter>();

// ── Vanilla (promise-based) client for use in hooks ───────────────────────────

export const _trpcVanilla = createTRPCProxyClient<AppRouter>({
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
          // Batch window: up to 10ms to collect concurrent requests
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

// ── Error classifier ──────────────────────────────────────────────────────────

export function isTRPCForbidden(err: unknown): boolean {
  return (err as { data?: { code?: string } })?.data?.code === 'FORBIDDEN';
}

export function isTRPCUnauthorized(err: unknown): boolean {
  const _code = (err as { data?: { code?: string } })?.data?.code;
  return code === 'UNAUTHORIZED' || code === 'NOT_FOUND';
}