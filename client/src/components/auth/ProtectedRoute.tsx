import { useEffect } from 'react';
import { Redirect } from 'wouter';
import { useAuthStore } from '@/stores/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, token, hydrateFromToken } = useAuthStore();
  useEffect(() => {
    if (token) hydrateFromToken();
  }, [token, hydrateFromToken]);
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <>{children}</>;
}
