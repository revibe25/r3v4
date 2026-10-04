/**
 * useAuth Hook
 * Provides auth state and methods throughout your app
 */

import { useState, useCallback, useEffect, useContext, createContext } from 'react';
import { AuthService, AuthToken, AuthError } from './authService';

export interface UseAuthReturn {
  // State
  user: AuthToken['user'] | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthError | null;

  // Methods
  login: (credential: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  testAuth: () => Promise<void>;
}

export const AuthContext = createContext<UseAuthReturn | undefined>(undefined);

/**
 * useAuth Hook — Use this in your components
 */
export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<AuthToken['user'] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = await AuthService.getToken();
        setToken(storedToken);

        if (storedToken) {
          const storedUser = AuthService.getUser();
          setUser(storedUser);
        }
      } catch (err) {
        console.error('[useAuth] Init failed:', err);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(
    async (credential: string, password: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await AuthService.login(credential, password);
        setToken(result.token);
        setUser(result.user);
      } catch (err) {
        const authError = err as AuthError;
        setError(authError);
        throw authError;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const logout = useCallback(() => {
    AuthService.logout();
    setUser(null);
    setToken(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const testAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await AuthService.testEndpoint();
      console.info('[useAuth] Endpoint test:', result);
    } catch (err) {
      console.error('[useAuth] Endpoint test failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    user,
    token,
    isAuthenticated: !!token,
    isLoading,
    error,
    login,
    logout,
    clearError,
    testAuth,
  };
};

/**
 * AuthProvider — Wrap your app with this
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const auth = useAuth();
  return (
    <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
  );
};

/**
 * useAuthContext — Get auth from context (use in components inside AuthProvider)
 */
export const useAuthContext = (): UseAuthReturn => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error(
      'useAuthContext must be used inside <AuthProvider>. Did you wrap your app?'
    );
  }
  return context;
};
