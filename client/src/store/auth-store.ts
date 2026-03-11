/**
 * client/src/store/auth-store.ts
 *
 * Single source of truth for the authenticated user's JWT.
 * Persisted to localStorage under 'r3-auth' so the session survives
 * a page refresh without requiring re-login.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  tier: string;
}

interface AuthStoreState {
  token: string | null;
  user: AuthUser | null;
}

interface AuthStoreActions {
  setAuth: (token: string, user: AuthUser) => void;
  clearAuth: () => void;
  getToken: () => string | null;
}

export type AuthStore = AuthStoreState & AuthStoreActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      user:  null,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
      getToken: () => get().token,
    }),
    {
      name: 'r3-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);
