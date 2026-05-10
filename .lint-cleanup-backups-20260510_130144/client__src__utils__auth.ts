/**
 * Authentication Utility Module (CORRECTED FOR VITE)
 * Uses import.meta.env instead of process.env
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const REQUEST_TIMEOUT = parseInt(import.meta.env.VITE_AUTH_TIMEOUT || '30000', 10);

// Type definitions
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
}

export interface LoginResponse {
  token?: string;
  user?: User;
  message?: string;
}

export interface AuthError {
  message: string;
  code?: string;
  status?: number;
}

let initializationLock = false;

/**
 * MOCK LOGIN - For testing until real backend is found
 */
export async function loginUser(credentials: LoginCredentials): Promise<LoginResponse> {
  if (initializationLock) {
    throw { message: 'Login already in progress', code: 'LOCKED' };
  }

  initializationLock = true;

  try {
    // Validate inputs
    if (!credentials.email || !credentials.password) {
      throw { message: 'Email and password required', code: 'INVALID_CREDS' };
    }

    if (!validateEmail(credentials.email)) {
      throw { message: 'Invalid email format', code: 'INVALID_EMAIL' };
    }

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credential: credentials.email,
        password: credentials.password,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw { message: body.error ?? 'Login failed', code: 'AUTH_ERROR', status: res.status };
    }
    const response: LoginResponse = await res.json();
    if (response.token) {
      sessionStorage.setItem(TOKEN_KEY, response.token);
    }
    if (response.user) {
      sessionStorage.setItem(USER_KEY, JSON.stringify(response.user));
    }
    if (import.meta.env.MODE === 'development') {
      console.debug('Login successful');
    }
    return response;
  } catch (error) {
    const authError: AuthError = error instanceof Object && 'message' in error
      ? (error as AuthError)
      : { message: 'Unknown error occurred', code: 'UNKNOWN' };

    console.error('❌ Login error:', authError.message);
    throw authError;
  } finally {
    initializationLock = false;
  }
}

/**
 * Logout and clear stored data
 */
export function logoutUser(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  if (import.meta.env.MODE === 'development') {
    console.debug('✅ User logged out');
  }
}

/**
 * Get stored token
 */
export function getAuthToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || null;
}

/**
 * Get stored user
 */
export function getStoredUser(): User | null {
  const userStr = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
  if (!userStr) return null;

  try {
    const user = JSON.parse(userStr) as User;
    if (user.id && user.email) {
      return user;
    }
    return null;
  } catch (e) {
    console.error('Failed to parse stored user');
    sessionStorage.removeItem(USER_KEY);
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

/**
 * Check if authenticated
 */
export function isAuthenticated(): boolean {
  const token = getAuthToken();
  const user = getStoredUser();
  return !!token && !!user;
}

/**
 * Validate email
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
    return { valid: false, errors };
  }

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain number');
  }
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('Password must contain special character (!@#$%^&*)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create authorization headers
 */
let cachedHeaders: Record<string, string> | null = null;

export function createAuthHeaders(ignoreCache = false): Record<string, string> {
  if (!ignoreCache && cachedHeaders) {
    return { ...cachedHeaders };
  }

  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  cachedHeaders = headers;
  return { ...headers };
}

/**
 * Invalidate cached headers
 */
export function invalidateHeaderCache(): void {
  cachedHeaders = null;
}
