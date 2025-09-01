/**
 * Authentication manager for Schlep-engine JavaScript SDK
 * Handles API keys, JWT tokens, user authentication, and token refresh
 */

import EventEmitter from 'eventemitter3';

import {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  UserInfo,
  AuthState,
  AuthEventType,
  AuthEvent,
  JWTPayload
} from '../types/auth';

import { APIResponse, AuthMethod } from '../types/common';
import { HTTPClient } from '../utils/http-client';
import { SchlepEngineError, AuthenticationError, ConfigurationError } from '../utils/errors';
import { createTokenStorage } from './token-storage';
import { TokenStorage } from '../types/common';

/**
 * Authentication manager configuration
 */
export interface AuthManagerConfig {
  apiKey?: string;
  baseUrl?: string;
  tokenStorage?: TokenStorage;
  autoRefresh?: boolean;
  refreshBuffer?: number; // Minutes before expiry to refresh token
}

/**
 * Authentication manager class
 */
export class AuthManager extends EventEmitter {
  private apiKey?: string;
  private baseUrl: string;
  private httpClient?: HTTPClient;
  private tokenStorage: TokenStorage;
  private currentTokens?: TokenResponse;
  private autoRefresh: boolean;
  private refreshBuffer: number; // Minutes
  private refreshTimer?: NodeJS.Timeout;

  constructor(config: AuthManagerConfig = {}) {
    super();
    
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.schlep-engine.com';
    this.tokenStorage = config.tokenStorage || createTokenStorage();
    this.autoRefresh = config.autoRefresh ?? true;
    this.refreshBuffer = config.refreshBuffer ?? 5; // 5 minutes default

    // Load existing tokens on initialization
    this.loadStoredTokens();
  }

  /**
   * Set HTTP client for API requests
   */
  setHttpClient(httpClient: HTTPClient): void {
    this.httpClient = httpClient;
  }

  /**
   * Check if user is currently authenticated
   */
  get isAuthenticated(): boolean {
    return Boolean(this.apiKey || this.getValidAccessToken());
  }

  /**
   * Get current authentication method
   */
  get authMethod(): AuthMethod {
    if (this.apiKey) return 'api_key';
    if (this.getValidAccessToken()) return 'jwt';
    return 'none';
  }

  /**
   * Get current authentication state
   */
  get authState(): AuthState {
    const token = this.getValidAccessToken();
    const user = this.getCurrentUser();

    return {
      isAuthenticated: this.isAuthenticated,
      user,
      token,
      refreshToken: this.currentTokens?.refresh_token,
      expiresAt: this.getTokenExpiryDate(),
      authMethod: this.authMethod,
      isLoading: false
    };
  }

  /**
   * Get authentication headers for API requests
   */
  getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    } else {
      const accessToken = this.getValidAccessToken();
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
    }

    return headers;
  }

  /**
   * Set API key for authentication
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.emitAuthEvent('login', { authMethod: 'api_key' });
  }

  /**
   * Store API key securely
   */
  async storeApiKey(apiKey: string, identifier = 'default'): Promise<void> {
    await this.tokenStorage.storeApiKey(apiKey, identifier);
  }

  /**
   * Load API key from secure storage
   */
  async loadApiKey(identifier = 'default'): Promise<string | null> {
    return this.tokenStorage.getApiKey(identifier);
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string, rememberMe = false): Promise<TokenResponse> {
    if (!this.httpClient) {
      throw new ConfigurationError('HTTP client not initialized');
    }

    const loginRequest: LoginRequest = {
      email,
      password,
      remember_me: rememberMe
    };

    try {
      const response = await this.httpClient.post<TokenResponse>('/auth/login', {
        params: loginRequest
      });

      if (!response.success || !response.data) {
        throw new AuthenticationError('Invalid login response');
      }

      const tokens = response.data;
      await this.handleSuccessfulAuth(tokens);

      this.emitAuthEvent('login', { user: tokens.user });
      return tokens;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      throw new AuthenticationError(`Login failed: ${message}`);
    }
  }

  /**
   * Register a new user account
   */
  async register(request: RegisterRequest): Promise<TokenResponse> {
    if (!this.httpClient) {
      throw new ConfigurationError('HTTP client not initialized');
    }

    try {
      const response = await this.httpClient.post<TokenResponse>('/auth/register', {
        params: request
      });

      if (!response.success || !response.data) {
        throw new AuthenticationError('Invalid registration response');
      }

      const tokens = response.data;
      await this.handleSuccessfulAuth(tokens);

      this.emitAuthEvent('login', { user: tokens.user });
      return tokens;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      throw new AuthenticationError(`Registration failed: ${message}`);
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<TokenResponse | null> {
    if (!this.httpClient) {
      throw new ConfigurationError('HTTP client not initialized');
    }

    const currentTokens = this.currentTokens || await this.tokenStorage.getTokenResponse();
    if (!currentTokens?.refresh_token) {
      return null;
    }

    try {
      const response = await this.httpClient.post<TokenResponse>('/auth/refresh', {
        params: { refresh_token: currentTokens.refresh_token }
      });

      if (!response.success || !response.data) {
        throw new AuthenticationError('Invalid refresh response');
      }

      const newTokens: TokenResponse = {
        ...response.data,
        // Keep refresh token if not provided in response
        refresh_token: response.data.refresh_token || currentTokens.refresh_token,
        // Keep user info from current tokens if not in response
        user: response.data.user || currentTokens.user
      };

      await this.handleSuccessfulAuth(newTokens);

      this.emitAuthEvent('token_refresh');
      return newTokens;

    } catch (error) {
      await this.clearAuthentication();
      this.emitAuthEvent('token_expired');
      return null;
    }
  }

  /**
   * Logout user and clear stored tokens
   */
  async logout(): Promise<void> {
    try {
      // Try to revoke tokens on server
      if (this.httpClient && this.isAuthenticated) {
        try {
          await this.httpClient.post('/auth/logout');
        } catch (error) {
          // Ignore server errors during logout
          console.warn('Server logout failed:', error);
        }
      }
    } finally {
      await this.clearAuthentication();
      this.emitAuthEvent('logout');
    }
  }

  /**
   * Clear all authentication data
   */
  async clearAuthentication(): Promise<void> {
    this.currentTokens = undefined;
    this.clearRefreshTimer();
    await this.tokenStorage.clearAll();
  }

  /**
   * Get current user information
   */
  getCurrentUser(): UserInfo | undefined {
    const tokens = this.currentTokens;
    if (tokens?.user) return tokens.user;

    // Try to extract user info from JWT
    const accessToken = this.getValidAccessToken();
    if (accessToken) {
      try {
        const payload = this.parseJWT(accessToken);
        if (payload) {
          return {
            id: payload.sub,
            email: payload.email || '',
            role: payload.role || 'user',
            is_verified: true,
            is_active: true
          };
        }
      } catch (error) {
        // JWT parsing failed, ignore
      }
    }

    return undefined;
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  getValidAccessToken(): string | null {
    const tokens = this.currentTokens;
    if (!tokens) return null;

    // Check if token is expired
    if (this.isTokenExpired(tokens)) {
      if (tokens.refresh_token && this.autoRefresh) {
        // Trigger background refresh
        this.refreshToken().catch(error => {
          console.warn('Background token refresh failed:', error);
        });
      }
      return null;
    }

    return tokens.access_token;
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(permission: string): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;

    // For now, just check if user is active
    // In the future, this could check specific permissions from JWT or user object
    return user.is_active && user.is_verified;
  }

  /**
   * Parse JWT token to extract payload
   */
  private parseJWT(token: string): JWTPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(
        typeof window !== 'undefined' 
          ? atob(parts[1])
          : Buffer.from(parts[1], 'base64').toString()
      );

      return payload as JWTPayload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if token is expired or will expire soon
   */
  private isTokenExpired(tokens: TokenResponse, bufferMinutes = 0): boolean {
    if (!tokens.issued_at || !tokens.expires_in) {
      // Try to check JWT expiration
      const payload = this.parseJWT(tokens.access_token);
      if (payload?.exp) {
        const expiryTime = payload.exp * 1000; // Convert to milliseconds
        const bufferTime = bufferMinutes * 60 * 1000;
        return Date.now() > (expiryTime - bufferTime);
      }
      return false;
    }

    const issuedAt = new Date(tokens.issued_at);
    const expiresAt = new Date(issuedAt.getTime() + tokens.expires_in * 1000);
    const bufferTime = bufferMinutes * 60 * 1000;
    
    return Date.now() > (expiresAt.getTime() - bufferTime);
  }

  /**
   * Get token expiry date
   */
  private getTokenExpiryDate(): Date | undefined {
    const tokens = this.currentTokens;
    if (!tokens) return undefined;

    if (tokens.issued_at && tokens.expires_in) {
      const issuedAt = new Date(tokens.issued_at);
      return new Date(issuedAt.getTime() + tokens.expires_in * 1000);
    }

    // Try to get expiry from JWT
    const payload = this.parseJWT(tokens.access_token);
    if (payload?.exp) {
      return new Date(payload.exp * 1000);
    }

    return undefined;
  }

  /**
   * Load stored tokens from storage
   */
  private async loadStoredTokens(): Promise<void> {
    try {
      const tokens = await this.tokenStorage.getTokenResponse();
      if (tokens) {
        this.currentTokens = tokens;
        this.setupAutoRefresh();
      }
    } catch (error) {
      console.warn('Failed to load stored tokens:', error);
    }
  }

  /**
   * Handle successful authentication
   */
  private async handleSuccessfulAuth(tokens: TokenResponse): Promise<void> {
    // Ensure issued_at is set
    if (!tokens.issued_at) {
      tokens.issued_at = new Date().toISOString();
    }

    this.currentTokens = tokens;
    await this.tokenStorage.storeTokenResponse(tokens);
    this.setupAutoRefresh();
  }

  /**
   * Setup automatic token refresh
   */
  private setupAutoRefresh(): void {
    if (!this.autoRefresh || !this.currentTokens) return;

    this.clearRefreshTimer();

    // Calculate when to refresh (before expiry)
    const expiryDate = this.getTokenExpiryDate();
    if (!expiryDate) return;

    const refreshTime = expiryDate.getTime() - (this.refreshBuffer * 60 * 1000);
    const timeUntilRefresh = refreshTime - Date.now();

    if (timeUntilRefresh > 0) {
      this.refreshTimer = setTimeout(() => {
        this.refreshToken().catch(error => {
          console.warn('Auto refresh failed:', error);
          this.emitAuthEvent('token_expired');
        });
      }, timeUntilRefresh);
    } else {
      // Token already needs refresh
      this.refreshToken().catch(error => {
        console.warn('Immediate refresh failed:', error);
      });
    }
  }

  /**
   * Clear refresh timer
   */
  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  /**
   * Emit authentication event
   */
  private emitAuthEvent(type: AuthEventType, metadata?: Record<string, unknown>): void {
    const event: AuthEvent = {
      type,
      user: this.getCurrentUser(),
      timestamp: new Date().toISOString(),
      metadata
    };

    this.emit(type, event);
    this.emit('auth', event);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.clearRefreshTimer();
    this.removeAllListeners();
  }
}

export default AuthManager;