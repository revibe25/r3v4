/**
 * R3 Native Auth Service
 * Handles token management, refresh logic, and API communication
 */

export interface AuthToken {
  token: string;
  user: {
    id: string;
    username: string;
    email?: string;
  };
  expiresIn?: number;
  refreshToken?: string;
}

export interface AuthError {
  message: string;
  code: string;
  details?: Record<string, any>;
}

const TOKEN_KEY = 'r3_token';
const REFRESH_TOKEN_KEY = 'r3_refresh_token';
const TOKEN_EXPIRY_KEY = 'r3_token_expiry';
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5173';

export class AuthService {
  /**
   * Authenticate with credentials
   */
  static async login(
    credential: string,
    password: string
  ): Promise<AuthToken> {
    try {
      const response = await fetch(`${API_BASE}/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credential, password }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Auth failed: ${response.status}`);
      }

      const data: AuthToken = await response.json();

      // Store token and metadata
      this.setToken(data);

      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      console.error('[AuthService] Login error:', { message, error });
      throw {
        message,
        code: 'LOGIN_FAILED',
        details: { error },
      } as AuthError;
    }
  }

  /**
   * Refresh the auth token
   */
  static async refreshToken(): Promise<AuthToken> {
    try {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        // Token refresh failed — user needs to re-login
        this.logout();
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const data: AuthToken = await response.json();
      this.setToken(data);

      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token refresh failed';
      console.error('[AuthService] Refresh error:', { message, error });
      this.logout(); // Clear stored auth on refresh failure
      throw {
        message,
        code: 'REFRESH_FAILED',
        details: { error },
      } as AuthError;
    }
  }

  /**
   * Get current token (refresh if expired)
   */
  static async getToken(): Promise<string | null> {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);

    if (!token) return null;

    // Check if token is expired
    if (expiry && Date.now() > parseInt(expiry)) {
      console.warn('[AuthService] Token expired, attempting refresh...');
      try {
        const newData = await this.refreshToken();
        return newData.token;
      } catch (error) {
        console.error('[AuthService] Token refresh failed:', error);
        return null;
      }
    }

    return token;
  }

  /**
   * Store token in localStorage with expiry time
   */
  static setToken(data: AuthToken): void {
    localStorage.setItem(TOKEN_KEY, data.token);

    if (data.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    }

    if (data.expiresIn) {
      const expiryTime = Date.now() + data.expiresIn * 1000;
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
    }

    console.info('[AuthService] Token stored', {
      hasRefreshToken: !!data.refreshToken,
      expiresIn: data.expiresIn,
    });
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(): boolean {
    const token = localStorage.getItem(TOKEN_KEY);
    return !!token;
  }

  /**
   * Get stored user info
   */
  static getUser(): AuthToken['user'] | null {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    try {
      // Decode JWT payload (simple Base64 decode, not cryptographic verification)
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(
        atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
      );

      return payload.user || payload;
    } catch (error) {
      console.error('[AuthService] Failed to decode token:', error);
      return null;
    }
  }

  /**
   * Logout and clear all auth data
   */
  static logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    console.info('[AuthService] Logged out, tokens cleared');
  }

  /**
   * Test the auth endpoint
   */
  static async testEndpoint(): Promise<{ status: string; message: string }> {
    try {
      const response = await fetch(`${API_BASE}/auth`, {
        method: 'OPTIONS',
      }).catch(() => null);

      if (!response) {
        return {
          status: 'ERROR',
          message: `Cannot reach ${API_BASE}/auth`,
        };
      }

      return {
        status: response.ok ? 'OK' : 'WARNING',
        message: `Auth endpoint responded: ${response.status} ${response.statusText}`,
      };
    } catch (error) {
      return {
        status: 'ERROR',
        message: `Endpoint test failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
