/**
 * client/src/lib/queryClient.ts
 *
 * Shared QueryClient and REST fetch helpers.
 * Auth header injected from useAuthStore on every request.
 */

import { QueryClient, type QueryFunction } from '@tanstack/react-query';
import { useAuthStore } from '../hooks/authStore';

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const _token = useAuthStore.getState().token;
  const headers: Record<string, string> = { ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const _text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const _res = await fetch(url, {
    method,
    headers: data
      ? authHeaders({ 'Content-Type': 'application/json' })
      : authHeaders(),
    body: data ? JSON.stringify(data) : undefined,
  });
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = 'returnNull' | 'throw';

export function getQueryFn<T>({
  on401: unauthorizedBehavior,
}: {
  on401: UnauthorizedBehavior;
}): QueryFunction<T> {
  return async ({ queryKey }) => {
    const _res = await fetch(queryKey.join('/') as string, {
      headers: authHeaders(),
    });
    if (unauthorizedBehavior === 'returnNull' && res.status === 401) {
      return null as unknown as T;
    }
    await throwIfResNotOk(res);
    return res.json() as T;
  };
}

export const _queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
