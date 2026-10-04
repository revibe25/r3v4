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
 *   POST /api/auth/login     { credential, password }  → { token, user }
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

class AuthHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AuthHttpError';
    this.status = status;
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id:       string;
  email:    string | null;   // server may omit email if registered with username only
  username: string;
  tier:     'explorer' | 'creator' | 'pro_artist'; // aligned to SubscriptionTier
  isAdmin:  boolean; // server-authoritative DB admin flag
}

interface AuthState {
  user:        AuthUser | null;
  token:       string | null;
  loading:     boolean;
  error:       string | null;

  // Actions
  login:       (credential: string, password: string) => Promise<void>;
  register:    (email: string, password: string) => Promise<void>;
  logout:      () => void;
  initAuth:    () => Promise<void>;
  clearError:  () => void;
}

// ── API helpers ───────────────────────────────────────────────────────────────

const API = (import.meta.env?.VITE_API_URL as string | undefined) ?? '';

async function authFetch<T>(
  path: string,
  body?: Record<string, string>,
  token?: string,
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const raw = await res.text();

  let data: Record<string, unknown> = {};

  try {
    data = raw ? JSON.parse(raw) as Record<string, unknown> : {};
  } catch {
    // Preserve the HTTP status even if the server response is not JSON.
  }

  if (!res.ok) {
    const msg = (data.message ?? data.error ?? raw ?? `HTTP ${res.status}`) as string;
    throw new AuthHttpError(res.status, msg);
  }

  return data as T;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set, get) => ({
  user:    null,
  token:   null,
  // Auth bootstrap starts unresolved so protected routes cannot race
  // the initial token validation.
  loading: true,
  error:   null,

  // ── login ──────────────────────────────────────────────────────────────────
  login: async (credential, password) => {
    set({ loading: true, error: null });
    try {
      const { token, user } = await authFetch<{ token: string; user: AuthUser }>(
        '/api/auth/login',
        { credential: credential.trim().toLowerCase(), password },
      );
      // [wire§8] removed — auth via httpOnly cookie
      localStorage.setItem('r3_token', token);
      localStorage.setItem('r3_user', JSON.stringify(user));
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
      const emailNorm = email.trim().toLowerCase();
      // Derive username from email prefix — server requires /^[a-zA-Z0-9_-]+$/, min 3 chars.
      const rawPrefix = emailNorm.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '_');
      const username  = (rawPrefix.length >= 3 ? rawPrefix : rawPrefix + '_r3').slice(0, 32);
      const { token, user } = await authFetch<{ token: string; user: AuthUser }>(
        '/api/auth/register',
        { email: emailNorm, username, password },
      );
      // [wire§8] removed — auth via httpOnly cookie
      localStorage.setItem('r3_token', token);
      localStorage.setItem('r3_user', JSON.stringify(user));
      set({ token, user, loading: false });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
      throw err;
    }
  },

  // ── logout ─────────────────────────────────────────────────────────────────
  logout: () => {
    localStorage.removeItem('r3_token');
    localStorage.removeItem('r3_user');
    set({
      user: null,
      token: null,
      loading: false,
      error: null,
    });
  },

  // ── initAuth — re-hydrate on app mount ────────────────────────────────────
  initAuth: async () => {
    const state = get();

    if (state.user && state.token) {
      set({ loading: false, error: null });
      return;
    }

    const stored = localStorage.getItem('r3_token');

    if (!stored) {
      set({
        user: null,
        token: null,
        loading: false,
        error: null,
      });
      return;
    }

    let cachedUser: AuthUser | null = null;
    const cachedRaw = localStorage.getItem('r3_user');

    if (cachedRaw) {
      try {
        cachedUser = JSON.parse(cachedRaw) as AuthUser;
      } catch {
        localStorage.removeItem('r3_user');
      }
    }

    set({
      token: stored,
      user: cachedUser,
      loading: true,
      error: null,
    });

    try {
      const { user } = await authFetch<{ user: AuthUser }>(
        '/api/auth/me',
        undefined,
        stored,
      );

      localStorage.setItem('r3_user', JSON.stringify(user));

      set({
        token: stored,
        user,
        loading: false,
        error: null,
      });
    } catch (err) {
      // Only an explicit authorization failure invalidates the local token.
      if (
        err instanceof AuthHttpError &&
        (err.status === 401 || err.status === 403)
      ) {
        localStorage.removeItem('r3_token');
        localStorage.removeItem('r3_user');

        set({
          token: null,
          user: null,
          loading: false,
          error: null,
        });

        return;
      }

      const fallbackUser = get().user ?? cachedUser;

      console.warn(
        '[auth] /api/auth/me unavailable; preserving stored session.',
        err,
      );

      // A temporary network/server failure is NOT a logout.
      // If cached identity exists, the application remains usable.
      // Without cached identity, stay unresolved rather than redirecting
      // to login based only on a transport failure.
      set({
        token: stored,
        user: fallbackUser,
        loading: !fallbackUser,
        error: 'SESSION VERIFICATION TEMPORARILY UNAVAILABLE',
      });
    }
  },

  clearError: () => set({ error: null }),
}));

// ── Selector helpers (stable references, safe in selector callbacks) ──────────
export const selectIsAuthed = (s: AuthState): boolean => !!s.user && !!s.token;
export const selectTier     = (s: AuthState): AuthUser['tier'] => s.user?.tier ?? 'explorer';