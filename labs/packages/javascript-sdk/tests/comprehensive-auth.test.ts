/**
 * Comprehensive authentication tests for Igris-engine JavaScript SDK
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { IgrisClient } from '../src/client/igris-inertial';
import { AuthManager, BrowserTokenStorage, MemoryTokenStorage } from '../src/auth';
import { AuthenticationError, APIError, NetworkError } from '../src/utils/errors';
import { TokenResponse, UserInfo, AuthConfig } from '../src/types/auth';
import { mockResponse, mockApiError } from './setup';

// Mock fetch globally
global.fetch = jest.fn();

describe('AuthManager', () => {
  let authManager: AuthManager;
  let mockStorage: MemoryTokenStorage;

  beforeEach(() => {
    mockStorage = new MemoryTokenStorage();
    authManager = new AuthManager({
      baseUrl: 'https://api.test.com',
      storage: mockStorage
    });
    
    jest.clearAllMocks();
  });

  describe('login', () => {
    test('should login successfully with credentials', async () => {
      const mockTokenResponse: TokenResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          user_id: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
          role: 'user',
          is_active: true
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(mockTokenResponse))
      });

      const result = await authManager.login('test@example.com', 'password123');

      expect(result.access_token).toBe('test-access-token');
      expect(result.user.email).toBe('test@example.com');
      expect(authManager.isAuthenticated()).toBe(true);
    });

    test('should handle login failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValueOnce(mockApiError('Invalid credentials'))
      });

      await expect(authManager.login('invalid@example.com', 'wrongpassword'))
        .rejects.toThrow(AuthenticationError);
    });

    test('should handle network errors during login', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(authManager.login('test@example.com', 'password123'))
        .rejects.toThrow(NetworkError);
    });
  });

  describe('token management', () => {
    let mockToken: TokenResponse;

    beforeEach(() => {
      mockToken = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          user_id: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
          role: 'user',
          is_active: true
        }
      };
    });

    test('should refresh token successfully', async () => {
      // Set initial token
      authManager.setToken(mockToken);

      const newTokenResponse: TokenResponse = {
        ...mockToken,
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(newTokenResponse))
      });

      const result = await authManager.refreshToken();

      expect(result.access_token).toBe('new-access-token');
      expect(authManager.getToken()?.access_token).toBe('new-access-token');
    });

    test('should handle expired refresh token', async () => {
      authManager.setToken(mockToken);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValueOnce(mockApiError('Refresh token expired'))
      });

      await expect(authManager.refreshToken()).rejects.toThrow(AuthenticationError);
      expect(authManager.isAuthenticated()).toBe(false);
    });

    test('should detect token expiration', () => {
      const expiredToken: TokenResponse = {
        ...mockToken,
        expires_in: -1 // Already expired
      };

      authManager.setToken(expiredToken);
      expect(authManager.isTokenExpired()).toBe(true);
      expect(authManager.isAuthenticated()).toBe(false);
    });

    test('should provide valid authentication headers', () => {
      authManager.setToken(mockToken);

      const headers = authManager.getAuthHeaders();

      expect(headers.Authorization).toBe('Bearer test-access-token');
    });

    test('should return empty headers when not authenticated', () => {
      const headers = authManager.getAuthHeaders();

      expect(headers).toEqual({});
    });
  });

  describe('logout', () => {
    test('should logout successfully', async () => {
      const mockToken: TokenResponse = {
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          user_id: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
          role: 'user',
          is_active: true
        }
      };

      authManager.setToken(mockToken);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse({ message: 'Logged out successfully' }))
      });

      await authManager.logout();

      expect(authManager.isAuthenticated()).toBe(false);
      expect(authManager.getToken()).toBeNull();
    });

    test('should handle logout errors gracefully', async () => {
      const mockToken: TokenResponse = {
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          user_id: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
          role: 'user',
          is_active: true
        }
      };

      authManager.setToken(mockToken);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValueOnce(mockApiError('Server error'))
      });

      // Should still clear local token even if server logout fails
      await expect(authManager.logout()).rejects.toThrow(APIError);
      expect(authManager.getToken()).toBeNull();
    });
  });

  describe('automatic token refresh', () => {
    test('should automatically refresh token on 401 response', async () => {
      const expiredToken: TokenResponse = {
        access_token: 'expired-token',
        refresh_token: 'valid-refresh',
        token_type: 'bearer',
        expires_in: -1,
        user: {
          user_id: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
          role: 'user',
          is_active: true
        }
      };

      const newToken: TokenResponse = {
        ...expiredToken,
        access_token: 'new-access-token',
        expires_in: 3600
      };

      authManager.setToken(expiredToken);

      // First call returns 401, trigger refresh
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: jest.fn().mockResolvedValueOnce(mockApiError('Token expired'))
        })
        // Token refresh call
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockResponse(newToken))
        })
        // Retry original request
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockResponse({ data: 'success' }))
        });

      const result = await authManager.makeAuthenticatedRequest('GET', '/api/test');

      expect(result.data).toBe('success');
      expect(authManager.getToken()?.access_token).toBe('new-access-token');
    });

    test('should fail after refresh token expires', async () => {
      const expiredToken: TokenResponse = {
        access_token: 'expired-token',
        refresh_token: 'expired-refresh',
        token_type: 'bearer',
        expires_in: -1,
        user: {
          user_id: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
          role: 'user',
          is_active: true
        }
      };

      authManager.setToken(expiredToken);

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: jest.fn().mockResolvedValueOnce(mockApiError('Token expired'))
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: jest.fn().mockResolvedValueOnce(mockApiError('Refresh token expired'))
        });

      await expect(authManager.makeAuthenticatedRequest('GET', '/api/test'))
        .rejects.toThrow(AuthenticationError);

      expect(authManager.isAuthenticated()).toBe(false);
    });
  });

  describe('concurrent authentication requests', () => {
    test('should handle concurrent login attempts', async () => {
      const mockTokenResponse: TokenResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          user_id: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
          role: 'user',
          is_active: true
        }
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse(mockTokenResponse))
      });

      const concurrentLogins = Array(5).fill(null).map(() => 
        authManager.login('test@example.com', 'password123')
      );

      const results = await Promise.all(concurrentLogins);

      // All should succeed with the same token
      results.forEach(result => {
        expect(result.access_token).toBe('test-access-token');
      });
    });

    test('should handle concurrent refresh attempts', async () => {
      const initialToken: TokenResponse = {
        access_token: 'initial-token',
        refresh_token: 'refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          user_id: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
          role: 'user',
          is_active: true
        }
      };

      const newToken: TokenResponse = {
        ...initialToken,
        access_token: 'new-token'
      };

      authManager.setToken(initialToken);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse(newToken))
      });

      const concurrentRefreshes = Array(3).fill(null).map(() => 
        authManager.refreshToken()
      );

      const results = await Promise.all(concurrentRefreshes);

      // All should succeed with the same new token
      results.forEach(result => {
        expect(result.access_token).toBe('new-token');
      });

      // Should only make one actual refresh request due to deduplication
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});

describe('TokenStorage', () => {
  describe('MemoryTokenStorage', () => {
    let storage: MemoryTokenStorage;

    beforeEach(() => {
      storage = new MemoryTokenStorage();
    });

    test('should store and retrieve token', () => {
      const token: TokenResponse = {
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          user_id: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
          role: 'user',
          is_active: true
        }
      };

      storage.setToken(token);
      const retrieved = storage.getToken();

      expect(retrieved).toEqual(token);
    });

    test('should clear token', () => {
      const token: TokenResponse = {
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          user_id: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
          role: 'user',
          is_active: true
        }
      };

      storage.setToken(token);
      storage.clearToken();

      expect(storage.getToken()).toBeNull();
    });
  });

  describe('BrowserTokenStorage', () => {
    let storage: BrowserTokenStorage;

    beforeEach(() => {
      // Mock localStorage
      const mockLocalStorage = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn()
      };

      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage
      });

      storage = new BrowserTokenStorage('test-key');
    });

    test('should store token in localStorage', () => {
      const token: TokenResponse = {
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          user_id: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
          role: 'user',
          is_active: true
        }
      };

      storage.setToken(token);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(token)
      );
    });

    test('should retrieve token from localStorage', () => {
      const token: TokenResponse = {
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          user_id: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
          role: 'user',
          is_active: true
        }
      };

      (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(token));

      const retrieved = storage.getToken();

      expect(retrieved).toEqual(token);
      expect(localStorage.getItem).toHaveBeenCalledWith('test-key');
    });

    test('should handle corrupted localStorage data', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue('invalid json');

      const retrieved = storage.getToken();

      expect(retrieved).toBeNull();
    });

    test('should clear token from localStorage', () => {
      storage.clearToken();

      expect(localStorage.removeItem).toHaveBeenCalledWith('test-key');
    });
  });
});

describe('IgrisClient Authentication Integration', () => {
  let client: IgrisClient;

  beforeEach(() => {
    client = new IgrisClient({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.test.com'
    });

    jest.clearAllMocks();
  });

  test('should automatically add authentication headers', async () => {
    const token: TokenResponse = {
      access_token: 'test-token',
      refresh_token: 'test-refresh',
      token_type: 'bearer',
      expires_in: 3600,
      user: {
        user_id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
        is_active: true
      }
    };

    // Mock login
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse(token))
      })
      // Mock authenticated request
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse({ data: 'authenticated' }))
      });

    await client.auth.login('test@example.com', 'password123');
    await client.data.getJobStatus('job-123');

    // Check that the second request included authentication header
    const secondCall = (global.fetch as jest.Mock).mock.calls[1];
    const headers = secondCall[1].headers;
    expect(headers.Authorization).toBe('Bearer test-token');
  });

  test('should handle authentication errors in API calls', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValueOnce(mockApiError('Unauthorized'))
    });

    await expect(client.data.getJobStatus('job-123')).rejects.toThrow(AuthenticationError);
  });
});

describe('Security Features', () => {
  let authManager: AuthManager;

  beforeEach(() => {
    authManager = new AuthManager({
      baseUrl: 'https://api.test.com',
      storage: new MemoryTokenStorage()
    });
  });

  test('should not expose tokens in error messages', async () => {
    const token: TokenResponse = {
      access_token: 'sensitive-token-12345',
      refresh_token: 'sensitive-refresh-67890',
      token_type: 'bearer',
      expires_in: 3600,
      user: {
        user_id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
        is_active: true
      }
    };

    authManager.setToken(token);

    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    try {
      await authManager.makeAuthenticatedRequest('GET', '/api/test');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      expect(errorMessage).not.toContain('sensitive-token-12345');
      expect(errorMessage).not.toContain('sensitive-refresh-67890');
    }
  });

  test('should handle token validation', () => {
    const invalidToken = {
      access_token: '',  // Empty token
      token_type: 'bearer',
      expires_in: 3600
    };

    expect(() => {
      // This should validate token format
      authManager.setToken(invalidToken as TokenResponse);
    }).toThrow();
  });

  test('should implement secure token comparison', () => {
    const token1: TokenResponse = {
      access_token: 'token-123',
      refresh_token: 'refresh-123',
      token_type: 'bearer',
      expires_in: 3600,
      user: {
        user_id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
        is_active: true
      }
    };

    const token2: TokenResponse = {
      ...token1,
      access_token: 'token-456'
    };

    authManager.setToken(token1);
    
    // Secure comparison should be constant-time
    expect(authManager.isTokenValid(token1)).toBe(true);
    expect(authManager.isTokenValid(token2)).toBe(false);
  });
});

describe('Error Handling', () => {
  let authManager: AuthManager;

  beforeEach(() => {
    authManager = new AuthManager({
      baseUrl: 'https://api.test.com',
      storage: new MemoryTokenStorage()
    });
  });

  test('should handle rate limiting during authentication', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Map([['Retry-After', '60']]),
      json: jest.fn().mockResolvedValueOnce(mockApiError('Rate limit exceeded'))
    });

    await expect(authManager.login('test@example.com', 'password123'))
      .rejects.toThrow('Rate limit exceeded');
  });

  test('should handle malformed token responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({
        success: true,
        data: {
          access_token: 'token',
          // Missing required fields
        }
      })
    });

    await expect(authManager.login('test@example.com', 'password123'))
      .rejects.toThrow();
  });

  test('should handle storage errors gracefully', () => {
    const faultyStorage = {
      getToken: jest.fn().mockImplementation(() => {
        throw new Error('Storage unavailable');
      }),
      setToken: jest.fn().mockImplementation(() => {
        throw new Error('Storage unavailable');
      }),
      clearToken: jest.fn()
    };

    const authManagerWithFaultyStorage = new AuthManager({
      baseUrl: 'https://api.test.com',
      storage: faultyStorage as any
    });

    // Should handle storage errors gracefully
    expect(() => authManagerWithFaultyStorage.getToken()).not.toThrow();
    expect(authManagerWithFaultyStorage.getToken()).toBeNull();
  });
});