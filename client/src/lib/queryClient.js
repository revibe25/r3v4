/**
 * client/src/lib/queryClient.ts
 *
 * Shared QueryClient and REST fetch helpers.
 * Auth header injected from useAuthStore on every request.
 */
import { QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../hooks/authStore';
function authHeaders(extra) {
    const token = useAuthStore.getState().token;
    const headers = { ...extra };
    if (token)
        headers['Authorization'] = `Bearer ${token}`;
    return headers;
}
async function throwIfResNotOk(res) {
    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
    }
}
export async function apiRequest(method, url, data) {
    const res = await fetch(url, {
        method,
        headers: data
            ? authHeaders({ 'Content-Type': 'application/json' })
            : authHeaders(),
        body: data ? JSON.stringify(data) : undefined,
    });
    await throwIfResNotOk(res);
    return res;
}
export function getQueryFn({ on401: unauthorizedBehavior, }) {
    return async ({ queryKey }) => {
        const res = await fetch(queryKey.join('/'), {
            headers: authHeaders(),
        });
        if (unauthorizedBehavior === 'returnNull' && res.status === 401) {
            return null;
        }
        await throwIfResNotOk(res);
        return res.json();
    };
}
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});
