import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  subscriptionTier?: 'explorer' | 'creator' | 'pro_artist';
  createdAt?: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  hydrateFromToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      setAuth: (user, token) =>
        set({ user, token, isAuthenticated: true, isLoading: false }),
      clearAuth: () =>
        set({ user: null, token: null, isAuthenticated: false, isLoading: false }),
      setLoading: (loading) => set({ isLoading: loading }),
      hydrateFromToken: async () => {
        const { token, clearAuth, setAuth } = get();
        if (!token) return;
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) { clearAuth(); return; }
          const data = await res.json();
          setAuth(data.user, token);
        } catch {
          clearAuth();
        }
      },
    }),
    {
      name: 'r3-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
