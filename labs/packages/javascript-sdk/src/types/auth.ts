/**
 * Authentication types for Igris-engine JavaScript SDK
 */

/**
 * Login request data
 */
export interface LoginRequest {
  email: string;
  password: string;
  remember_me?: boolean;
}

/**
 * User registration request data
 */
export interface RegisterRequest {
  email: string;
  password: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  organization?: string;
  agree_to_terms?: boolean;
}

/**
 * User information
 */
export interface UserInfo {
  id: string;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  role: string;
  is_verified: boolean;
  is_active: boolean;
  organization_id?: string;
  created_at?: string;
  last_login?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Authentication token response
 */
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user?: UserInfo;
  scope?: string;
  issued_at?: string;
}

/**
 * Parsed JWT token payload
 */
export interface JWTPayload {
  sub: string;
  exp: number;
  iat: number;
  email?: string;
  role?: string;
  permissions?: string[];
  [key: string]: unknown;
}

/**
 * API key information
 */
export interface APIKeyInfo {
  key_id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used?: string;
  expires_at?: string;
  is_active: boolean;
  permissions: string[];
  metadata?: Record<string, unknown>;
}

/**
 * API key with full key value (returned only on creation)
 */
export interface APIKey extends APIKeyInfo {
  key: string;
}

/**
 * User profile information
 */
export interface UserProfile {
  first_name?: string;
  last_name?: string;
  username?: string;
  email?: string;
  phone?: string;
  company?: string;
  job_title?: string;
  bio?: string;
  location?: string;
  website?: string;
  profile_picture_url?: string;
  timezone?: string;
}

/**
 * User preferences
 */
export interface UserPreferences {
  theme?: 'light' | 'dark' | 'auto';
  language?: string;
  timezone?: string;
  date_format?: string;
  time_format?: '12h' | '24h';
  notifications_enabled?: boolean;
  email_notifications?: boolean;
  push_notifications?: boolean;
  sms_notifications?: boolean;
  [key: string]: unknown;
}

/**
 * Refresh token request
 */
export interface RefreshTokenRequest {
  refresh_token: string;
}

/**
 * Password reset request
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * Password reset confirmation request
 */
export interface PasswordResetConfirmRequest {
  token: string;
  new_password: string;
}

/**
 * Change password request
 */
export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

/**
 * Email verification request
 */
export interface EmailVerificationRequest {
  email: string;
}

/**
 * Email verification confirmation request
 */
export interface EmailVerificationConfirmRequest {
  token: string;
}

/**
 * OAuth provider types
 */
export type OAuthProvider = 'google' | 'github' | 'microsoft' | 'apple';

/**
 * OAuth authentication request
 */
export interface OAuthRequest {
  provider: OAuthProvider;
  redirect_uri?: string;
  state?: string;
  scope?: string[];
}

/**
 * OAuth callback data
 */
export interface OAuthCallback {
  code: string;
  state?: string;
  provider: OAuthProvider;
}

/**
 * Session information
 */
export interface SessionInfo {
  user: UserInfo;
  expires_at: string;
  created_at: string;
  last_activity: string;
  ip_address?: string;
  user_agent?: string;
  is_active: boolean;
}

/**
 * Authentication state
 */
export interface AuthState {
  isAuthenticated: boolean;
  user?: UserInfo;
  token?: string;
  refreshToken?: string;
  expiresAt?: Date;
  authMethod: 'api_key' | 'jwt' | 'oauth' | 'none';
  isLoading: boolean;
  error?: string;
}

/**
 * Permission check result
 */
export interface PermissionCheck {
  hasPermission: boolean;
  permissions: string[];
  missing?: string[];
}

/**
 * Authentication event types
 */
export type AuthEventType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'TOKEN_REFRESH'
  | 'TOKEN_EXPIRED'
  | 'PERMISSION_DENIED'
  | 'SESSION_EXPIRED';

/**
 * Authentication event data
 */
export interface AuthEvent {
  type: AuthEventType;
  user?: UserInfo;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Multi-factor authentication request
 */
export interface MFARequest {
  method: 'sms' | 'email' | 'totp' | 'backup_code';
  value?: string;
}

/**
 * Multi-factor authentication verification
 */
export interface MFAVerification {
  token: string;
  code: string;
  method: 'sms' | 'email' | 'totp' | 'backup_code';
}

/**
 * Organization information
 */
export interface OrganizationInfo {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_at: string;
  settings?: Record<string, unknown>;
  limits?: Record<string, number>;
  members_count: number;
}

/**
 * Team member information
 */
export interface TeamMember {
  user: UserInfo;
  role: string;
  permissions: string[];
  joined_at: string;
  invited_by?: string;
  is_active: boolean;
}

/**
 * Invitation information
 */
export interface Invitation {
  id: string;
  email: string;
  role: string;
  invited_by: UserInfo;
  invited_at: string;
  expires_at: string;
  accepted_at?: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
}

export default {};