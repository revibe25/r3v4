import { useEffect } from 'react';
import { Redirect } from 'wouter';
import { useAuthStore } from '@/stores/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Wouter-native auth guard.
 * Re-validates the persisted JWT against /api/auth/me on every protected mount.
 * Revoked or expired tokens are ejected and the user is redirected to /login.
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, token, hydrateFromToken } = useAuthStore();

  useEffect(() => {
    if (token) hydrateFromToken();
  }, [token, hydrateFromToken]);

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}
