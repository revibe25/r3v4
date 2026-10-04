/**
 * ProtectedRoute Component
 * Wraps routes that require authentication
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthContext } from './useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

/**
 * ProtectedRoute — Only authenticated users can access
 * 
 * Usage:
 * <Route
 *   path="/instrument"
 *   element={
 *     <ProtectedRoute>
 *       <InstrumentPage />
 *     </ProtectedRoute>
 *   }
 * />
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { isAuthenticated, user, isLoading } = useAuthContext();

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  if (!isAuthenticated) {
    console.warn('[ProtectedRoute] User not authenticated, redirecting to /auth');
    return <Navigate to="/auth" replace />;
  }

  if (requiredRole && user) {
    // Implement role checking if your token includes roles
    // const userRoles = user.roles || [];
    // if (!userRoles.includes(requiredRole)) {
    //   return <Navigate to="/unauthorized" replace />;
    // }
  }

  return <>{children}</>;
};

/**
 * RequireAuth — Simpler version without children wrapping
 * 
 * Usage:
 * <Route
 *   path="/dashboard"
 *   element={<RequireAuth><Dashboard /></RequireAuth>}
 * />
 */
export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <ProtectedRoute>{children}</ProtectedRoute>;
};
