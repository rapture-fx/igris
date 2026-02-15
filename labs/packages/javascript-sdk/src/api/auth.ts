/**
 * Authentication API for Igris-engine JavaScript SDK
 */

import { BaseAPI } from './base';
import { 
  LoginRequest, 
  RegisterRequest, 
  TokenResponse, 
  UserInfo, 
  PasswordResetRequest,
  PasswordResetConfirmRequest,
  ChangePasswordRequest,
  EmailVerificationRequest
} from '../types/auth';
import { APIResponse } from '../types/common';

/**
 * Authentication API client
 * Provides methods for user authentication, registration, and token management
 */
export class AuthAPI extends BaseAPI {
  constructor(client: any) {
    super(client);
    this.basePath = '/auth';
  }

  /**
   * Login with email and password
   */
  async login(
    email: string,
    password: string,
    rememberMe = false
  ): Promise<TokenResponse> {
    return this.client.authManager.login(email, password, rememberMe);
  }

  /**
   * Register a new user account
   */
  async register(request: RegisterRequest): Promise<TokenResponse> {
    return this.client.authManager.register(request);
  }

  /**
   * Refresh the current access token
   */
  async refreshToken(): Promise<TokenResponse | null> {
    return this.client.authManager.refreshToken();
  }

  /**
   * Logout the current user and clear tokens
   */
  async logout(): Promise<void> {
    await this.client.authManager.logout();
  }

  /**
   * Get information about the currently authenticated user
   */
  async getCurrentUser(): Promise<UserInfo | null> {
    // First check if we have user info from tokens
    const user = this.client.authManager.getCurrentUser();
    if (user) {
      return user;
    }

    // If not, fetch from API
    try {
      const response = await this.get<UserInfo>('/me');
      if (this.isSuccess(response)) {
        return response.data;
      }
    } catch (error) {
      // Return null if request fails (user not authenticated)
    }

    return null;
  }

  /**
   * Update current user profile
   */
  async updateProfile(updates: Partial<UserInfo>): Promise<APIResponse<UserInfo>> {
    this.validateRequired({ updates }, ['updates']);
    
    return this.patch<UserInfo>('/me', {
      params: this.flattenObject(updates)
    });
  }

  /**
   * Change user password
   */
  async changePassword(request: ChangePasswordRequest): Promise<APIResponse<{ message: string }>> {
    this.validateRequired(request, ['current_password', 'new_password']);
    
    return this.post<{ message: string }>('/change-password', {
      params: this.flattenObject(request)
    });
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(request: PasswordResetRequest): Promise<APIResponse<{ message: string }>> {
    this.validateRequired(request, ['email']);
    
    return this.post<{ message: string }>('/password-reset', {
      params: this.flattenObject(request)
    });
  }

  /**
   * Confirm password reset with token
   */
  async confirmPasswordReset(request: PasswordResetConfirmRequest): Promise<APIResponse<{ message: string }>> {
    this.validateRequired(request, ['token', 'new_password']);
    
    return this.post<{ message: string }>('/password-reset/confirm', {
      params: request
    });
  }

  /**
   * Request email verification
   */
  async requestEmailVerification(request?: EmailVerificationRequest): Promise<APIResponse<{ message: string }>> {
    return this.post<{ message: string }>('/verify-email', {
      params: request
    });
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<APIResponse<{ message: string }>> {
    this.validateRequired({ token }, ['token']);
    
    return this.post<{ message: string }>('/verify-email/confirm', {
      params: { token }
    });
  }

  /**
   * Get user sessions
   */
  async getSessions(): Promise<APIResponse<Array<{
    id: string;
    ip_address: string;
    user_agent: string;
    created_at: string;
    last_activity: string;
    is_current: boolean;
  }>>> {
    return this.get('/sessions');
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string): Promise<APIResponse<{ message: string }>> {
    this.validateRequired({ sessionId }, ['sessionId']);
    
    return this.delete<{ message: string }>(`/sessions/${sessionId}`);
  }

  /**
   * Revoke all other sessions (keep current session)
   */
  async revokeAllOtherSessions(): Promise<APIResponse<{ message: string }>> {
    return this.delete<{ message: string }>('/sessions/others');
  }

  /**
   * Get user's API keys
   */
  async getApiKeys(): Promise<APIResponse<Array<{
    key_id: string;
    name: string;
    prefix: string;
    created_at: string;
    last_used?: string;
    expires_at?: string;
    is_active: boolean;
    permissions: string[];
  }>>> {
    return this.get('/api-keys');
  }

  /**
   * Create new API key
   */
  async createApiKey(name: string, permissions?: string[], expiresAt?: string): Promise<APIResponse<{
    key_id: string;
    key: string;
    name: string;
    prefix: string;
    created_at: string;
    expires_at?: string;
    permissions: string[];
  }>> {
    this.validateRequired({ name }, ['name']);
    
    return this.post('/api-keys', {
      params: {
        name,
        permissions,
        expires_at: expiresAt
      }
    });
  }

  /**
   * Update API key
   */
  async updateApiKey(
    keyId: string, 
    updates: { name?: string; permissions?: string[]; is_active?: boolean }
  ): Promise<APIResponse<{
    key_id: string;
    name: string;
    prefix: string;
    is_active: boolean;
    permissions: string[];
  }>> {
    this.validateRequired({ keyId }, ['keyId']);
    
    return this.patch(`/api-keys/${keyId}`, {
      params: updates
    });
  }

  /**
   * Delete API key
   */
  async deleteApiKey(keyId: string): Promise<APIResponse<{ message: string }>> {
    this.validateRequired({ keyId }, ['keyId']);
    
    return this.delete<{ message: string }>(`/api-keys/${keyId}`);
  }

  /**
   * Enable two-factor authentication
   */
  async enableTwoFactor(): Promise<APIResponse<{
    secret: string;
    qr_code_url: string;
    backup_codes: string[];
  }>> {
    return this.post('/2fa/enable');
  }

  /**
   * Confirm two-factor authentication setup
   */
  async confirmTwoFactor(token: string): Promise<APIResponse<{ message: string; backup_codes: string[] }>> {
    this.validateRequired({ token }, ['token']);
    
    return this.post('/2fa/confirm', {
      params: { token }
    });
  }

  /**
   * Disable two-factor authentication
   */
  async disableTwoFactor(token: string): Promise<APIResponse<{ message: string }>> {
    this.validateRequired({ token }, ['token']);
    
    return this.post('/2fa/disable', {
      params: { token }
    });
  }

  /**
   * Generate new backup codes
   */
  async generateBackupCodes(): Promise<APIResponse<{ backup_codes: string[] }>> {
    return this.post('/2fa/backup-codes');
  }

  /**
   * Check authentication status
   */
  async checkAuth(): Promise<APIResponse<{
    authenticated: boolean;
    user?: UserInfo;
    expires_at?: string;
  }>> {
    return this.get('/status');
  }

  /**
   * Get OAuth providers
   */
  async getOAuthProviders(): Promise<APIResponse<Array<{
    provider: string;
    name: string;
    enabled: boolean;
    authorize_url?: string;
  }>>> {
    return this.get('/oauth/providers');
  }

  /**
   * Get OAuth authorization URL
   */
  async getOAuthAuthUrl(provider: string, redirectUri?: string, state?: string): Promise<APIResponse<{
    authorization_url: string;
    state: string;
  }>> {
    this.validateRequired({ provider }, ['provider']);
    
    return this.get('/oauth/auth-url', {
      params: this.buildQueryParams({
        provider,
        redirect_uri: redirectUri,
        state
      })
    });
  }

  /**
   * Complete OAuth authentication
   */
  async completeOAuth(
    provider: string, 
    code: string, 
    state?: string
  ): Promise<APIResponse<TokenResponse>> {
    this.validateRequired({ provider, code }, ['provider', 'code']);
    
    return this.post('/oauth/callback', {
      params: {
        provider,
        code,
        state
      }
    });
  }

  /**
   * Link OAuth account to existing account
   */
  async linkOAuthAccount(
    provider: string, 
    code: string, 
    state?: string
  ): Promise<APIResponse<{ message: string }>> {
    this.validateRequired({ provider, code }, ['provider', 'code']);
    
    return this.post('/oauth/link', {
      params: {
        provider,
        code,
        state
      }
    });
  }

  /**
   * Unlink OAuth account
   */
  async unlinkOAuthAccount(provider: string): Promise<APIResponse<{ message: string }>> {
    this.validateRequired({ provider }, ['provider']);
    
    return this.delete<{ message: string }>(`/oauth/unlink/${provider}`);
  }
}

export default AuthAPI;