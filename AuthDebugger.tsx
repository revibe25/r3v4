/**
 * AuthDebugger Component
 * Test and debug auth integration
 * 
 * Usage: Add to your app during development:
 * import { AuthDebugger } from './components/AuthDebugger';
 * <AuthDebugger />
 */

import React, { useState } from 'react';
import { useAuthContext } from './hooks/useAuth';
import { AuthService } from './services/authService';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'PENDING';
  message: string;
  details?: Record<string, any>;
  timestamp: number;
}

export const AuthDebugger: React.FC = () => {
  const { user, token, isAuthenticated, testAuth } = useAuthContext();
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [testCred, setTestCred] = useState('ernesto');
  const [testPass, setTestPass] = useState('test123456');
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (
    test: string,
    status: 'PASS' | 'FAIL',
    message: string,
    details?: Record<string, any>
  ) => {
    setResults((prev) => [
      {
        test,
        status,
        message,
        details,
        timestamp: Date.now(),
      },
      ...prev,
    ]);
  };

  /**
   * Test 1: Check auth endpoint connectivity
   */
  const testEndpointConnectivity = async () => {
    try {
      const result = await AuthService.testEndpoint();
      addResult(
        'Endpoint Connectivity',
        result.status === 'OK' ? 'PASS' : 'FAIL',
        result.message,
        result
      );
    } catch (error) {
      addResult(
        'Endpoint Connectivity',
        'FAIL',
        error instanceof Error ? error.message : 'Unknown error',
        { error }
      );
    }
  };

  /**
   * Test 2: Verify localStorage
   */
  const testLocalStorage = () => {
    try {
      localStorage.setItem('r3_test', 'ok');
      const value = localStorage.getItem('r3_test');
      localStorage.removeItem('r3_test');

      if (value === 'ok') {
        addResult(
          'localStorage',
          'PASS',
          'localStorage is working',
          {
            r3_token: localStorage.getItem('r3_token') ? 'SET' : 'NOT SET',
            r3_refresh_token: localStorage.getItem('r3_refresh_token')
              ? 'SET'
              : 'NOT SET',
            r3_token_expiry: localStorage.getItem('r3_token_expiry')
              ? 'SET'
              : 'NOT SET',
          }
        );
      } else {
        throw new Error('localStorage write/read failed');
      }
    } catch (error) {
      addResult(
        'localStorage',
        'FAIL',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  };

  /**
   * Test 3: Test login flow
   */
  const testLoginFlow = async () => {
    try {
      const result = await AuthService.login(testCred, testPass);
      addResult(
        'Login Flow',
        'PASS',
        `Logged in as ${result.user.username}`,
        {
          userId: result.user.id,
          username: result.user.username,
          tokenLength: result.token.length,
          hasRefreshToken: !!result.refreshToken,
        }
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      addResult('Login Flow', 'FAIL', errMsg, { error });
    }
  };

  /**
   * Test 4: Check token validity
   */
  const testTokenValidity = async () => {
    try {
      const currentToken = await AuthService.getToken();

      if (!currentToken) {
        throw new Error('No token found in storage');
      }

      // Decode JWT to check expiry
      const parts = currentToken.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const payload = JSON.parse(
        atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
      );

      const expiresAt = new Date(payload.exp * 1000);
      const isExpired = Date.now() > expiresAt.getTime();

      addResult(
        'Token Validity',
        isExpired ? 'FAIL' : 'PASS',
        isExpired ? 'Token is expired' : 'Token is valid',
        {
          expiresAt: expiresAt.toISOString(),
          timeRemaining: Math.ceil(
            (expiresAt.getTime() - Date.now()) / 1000
          ),
          issuer: payload.iss || 'unknown',
          subject: payload.sub || 'unknown',
        }
      );
    } catch (error) {
      addResult(
        'Token Validity',
        'FAIL',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  };

  /**
   * Test 5: Test token refresh
   */
  const testRefresh = async () => {
    try {
      const refreshToken = localStorage.getItem('r3_refresh_token');

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const result = await AuthService.refreshToken();
      addResult(
        'Token Refresh',
        'PASS',
        'Token refreshed successfully',
        {
          newTokenLength: result.token.length,
          userId: result.user.id,
        }
      );
    } catch (error) {
      addResult(
        'Token Refresh',
        'FAIL',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  };

  /**
   * Run all tests
   */
  const runAllTests = async () => {
    setIsRunning(true);
    setResults([]);

    await testEndpointConnectivity();
    await testLocalStorage();
    await testTokenValidity();

    if (!isAuthenticated) {
      await testLoginFlow();
    } else {
      await testRefresh();
    }

    setIsRunning(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-mono hover:bg-purple-700 z-50"
      >
        🐛 Auth Debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-96 bg-gray-900 text-white border border-purple-500 rounded-lg shadow-xl overflow-hidden flex flex-col z-50">
      {/* Header */}
      <div className="bg-purple-600 px-4 py-2 flex justify-between items-center">
        <span className="font-mono font-bold">Auth Debugger</span>
        <button
          onClick={() => setIsOpen(false)}
          className="text-lg hover:opacity-75"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
        {/* Auth Status */}
        <div className="mb-4 p-2 bg-gray-800 rounded">
          <div className="font-bold text-blue-400">Auth Status</div>
          <div>Authenticated: {isAuthenticated ? '✓ YES' : '✗ NO'}</div>
          {user && (
            <>
              <div>User: {user.username}</div>
              <div>ID: {user.id}</div>
            </>
          )}
          <div className="mt-2 text-gray-400">
            Token: {token ? token.substring(0, 20) + '...' : 'NONE'}
          </div>
        </div>

        {/* Test Input */}
        <div className="mb-4 p-2 bg-gray-800 rounded">
          <div className="font-bold text-yellow-400 mb-2">Test Login</div>
          <input
            type="text"
            value={testCred}
            onChange={(e) => setTestCred(e.target.value)}
            placeholder="Username"
            className="w-full p-1 bg-gray-700 text-white rounded mb-1 text-xs"
          />
          <input
            type="password"
            value={testPass}
            onChange={(e) => setTestPass(e.target.value)}
            placeholder="Password"
            className="w-full p-1 bg-gray-700 text-white rounded text-xs"
          />
        </div>

        {/* Test Results */}
        {results.length > 0 && (
          <div className="mb-4">
            <div className="font-bold text-green-400 mb-2">Results</div>
            <div className="space-y-2">
              {results.map((result, i) => (
                <div
                  key={i}
                  className={`p-2 rounded text-xs ${
                    result.status === 'PASS'
                      ? 'bg-green-900 text-green-200'
                      : 'bg-red-900 text-red-200'
                  }`}
                >
                  <div className="font-bold">
                    {result.status === 'PASS' ? '✓' : '✗'} {result.test}
                  </div>
                  <div className="opacity-75">{result.message}</div>
                  {result.details && (
                    <details className="mt-1 opacity-50">
                      <summary className="cursor-pointer underline">
                        Details
                      </summary>
                      <pre className="text-xs mt-1 overflow-x-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="bg-gray-800 p-3 border-t border-gray-700 space-y-2">
        <button
          onClick={runAllTests}
          disabled={isRunning}
          className="w-full px-3 py-1 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700 disabled:opacity-50"
        >
          {isRunning ? '⏳ Running...' : '▶ Run All Tests'}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={testEndpointConnectivity}
            className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
          >
            Endpoint
          </button>
          <button
            onClick={testTokenValidity}
            className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
          >
            Token
          </button>
          <button
            onClick={() => {
              setResults([]);
            }}
            className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
          >
            Clear
          </button>
          <button
            onClick={() => {
              AuthService.logout();
              window.location.reload();
            }}
            className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};
