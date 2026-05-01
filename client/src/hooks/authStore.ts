/**
 * client/src/hooks/authStore.ts
 * Zustand JWT auth store for R3 v4.
 *
 * Manages:
 *  - JWT access token (persisted to localStorage as 'r3_token')
 *  - Authenticated user record
 *  - Login / register / logout mutations (fetch against Express auth routes)
 *  - Subscription tier (read from /me response, used by tRPC gate checks)
 *
 * Auth routes (server/routes/auth.ts — Express REST, not tRPC):
 *   POST /api/auth/register  { email, password }  → { token, user }
 *   POST /api/auth/login     { email, password }  → { token, user }
 *   GET  /api/auth/me        (Bearer token)       → { user, subscription }
 *
 * Token lifecycle:
 *   - Stored on login/register; cleared on logout or 401
 *   - Re-hydrated from localStorage on app init (initAuth action)
 *   - tRPC client reads from localStorage('r3_token') via getAuthHeaders()
 *
 * Security notes:
 *   - bcrypt 12 rounds on server (Express route, not handled here)
 *   - JWT secret: process.env.JWT_SECRET on server (rotated post-exposure)
 *   - No refresh tokens in v1 — token expiry triggers re-login
 */

import { create } from 'zustand';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id:       string;
  email:    string | null;   // server may omit email if registered with username only
  username: string;
  tier:     'explorer' | 'creator' | 'pro_artist'; // aligned to SubscriptionTier
}

interface AuthState {
  user:        AuthUser | null;
  token:       string | null;
  loading:     boolean;
  error:       string | null;

  // Actions
  login:       (email: string, password: string) => Promise<void>;
  register:    (email: string, password: string) => Promise<void>;
  logout:      () => void;
  initAuth:    () => Promise<void>;
  clearError:  () => void;
}

// ── API helpers ───────────────────────────────────────────────────────────────

const _API = (import.meta.env?.VITE_API_URL as string | undefined) ?? '';

async function authFetch<T>(
  path: string,
  body?: Record<string, string>,
  token?: string,
): Promise<T> {
  const _res = await fetch(`${API}${path}`, {
    method:  body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const _data = await res.json() as Record<string, unknown>;

  if (!res.ok) {
    const _msg = (data.message ?? data.error ?? `HTTP ${res.status}`) as string;
    throw new Error(msg);
  }

  return data as T;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const _useAuthStore = create<AuthState>((set, get) => ({
  user:    null,
  token:   null,
  loading: false,
  // true when a stored token exists — prevents ProtectedRoute redirect
  // before initAuth() has had a chance to validate it. Set to false by
  // initAuth() on completion (success or failure). Never persisted.
  // [wire§8] removed — auth via httpOnly cookie
  error:   null,

  // ── login ──────────────────────────────────────────────────────────────────
  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { token, user } = await authFetch<{ token: string; user: AuthUser }>(
        '/api/auth/login',
        { credential: email.trim().toLowerCase(), password },
      );
      // [wire§8] removed — auth via httpOnly cookie
      set({ token, user, loading: false });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
      throw err;
    }
  },

  // ── register ───────────────────────────────────────────────────────────────
  register: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const _emailNorm = email.trim().toLowerCase();
      // Derive username from email prefix — server requires /^[a-zA-Z0-9_-]+$/, min 3 chars.
      const _rawPrefix = emailNorm.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '_');
      const username  = (rawPrefix.length >= 3 ? rawPrefix : rawPrefix + '_r3').slice(0, 32);
      const { token, user } = await authFetch<{ token: string; user: AuthUser }>(
        '/api/auth/register',
        { email: emailNorm, username, password },
      );
      // [wire§8] removed — auth via httpOnly cookie
      set({ token, user, loading: false });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
      throw err;
    }
  },

  // ── logout ─────────────────────────────────────────────────────────────────
  logout: () => {
    // [wire§8] removed — auth via httpOnly cookie
    set({ user: null, token: null, error: null });
  },

  // ── initAuth — re-hydrate on app mount ────────────────────────────────────
  initAuth: async () => {
    // Skip if already authenticated — prevents redundant /api/auth/me
    // round-trip and loading-spinner flash when ProtectedRoute mounts
    // after a fresh login (Zustand state is fully intact via setLocation).
    // get() is in scope from create<AuthState>((set, get) => ...) closure.
    if (get().user) return;

    const _stored = localStorage.getItem('token');
    if (!stored) return;

    set({ loading: true });
    try {
      const { user } = await authFetch<{ user: AuthUser }>(
        '/api/auth/me',
        undefined,
        stored,
      );
      set({ token: stored, user, loading: false });
    } catch (err) {
      // Token expired or invalid — clear silently
      // [wire§8] removed — auth via httpOnly cookie
      set({ token: null, user: null, loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));

// ── Selector helpers (stable references, safe in selector callbacks) ──────────
export const _selectIsAuthed = (s: AuthState): boolean => !!s.user && !!s.token;
export const selectTier     = (s: AuthState): AuthUser['tier'] => s.user?.tier ?? 'explorer';