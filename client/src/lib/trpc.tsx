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

const API_URL = 'http://localhost:3000/api/trpc';

// ── Get auth headers ───────────────────────────────────────────────────────
const getAuthHeaders = () => {
  const token = localStorage.getItem('r3_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ── Singleton QueryClient ─────────────────────────────────────────────────────
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5 },
  },
});

// ── tRPC React client ─────────────────────────────────────────────────────────
export const trpc = createTRPCReact<AppRouter>();

// ── tRPC client (non-React) ───────────────────────────────────────────────────
export const trpcClient = createTRPCProxyClient<AppRouter>({
  links: [
    loggerLink({
      enabled: (opts) =>
        process.env.NODE_ENV === 'development' ||
        (typeof window !== 'undefined' &&
          window.localStorage.getItem('debug') === 'true'),
      colorMode: 'ansi',
      condition: (opts) =>
        (opts.direction === 'up' && opts.elapsedMs > 100) ||
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

// ── Provider component ────────────────────────────────────────────────────
export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() =>
    trpc.createClient({
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === 'development' ||
            (typeof window !== 'undefined' &&
              window.localStorage.getItem('debug') === 'true'),
          colorMode: 'ansi',
          condition: (opts) =>
            (opts.direction === 'up' && opts.elapsedMs > 100) ||
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
    })
  );

  return (
    <trpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}

// ── Alias for non-React client ────────────────────────────────────────────
export const trpcVanilla = trpcClient;
