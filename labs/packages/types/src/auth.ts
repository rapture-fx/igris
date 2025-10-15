// Enhanced Authentication Types for Secured Backend
// Comprehensive types for the new authentication system

// Core Authentication Types
export interface AuthCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  name: string
  username?: string
  firstName?: string
  lastName?: string
  company?: string
  role?: string
}

export interface User {
  id: string
  email: string
  name: string
  username?: string
  firstName?: string
  lastName?: string
  avatar?: string
  company?: string
  role: 'user' | 'admin' | 'enterprise' | 'viewer'
  isActive: boolean
  emailVerified: boolean
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
  mfaEnabled: boolean
  sessionCount: number
  profile?: UserProfile
  subscription?: UserSubscriptionInfo
  preferences?: UserPreferences
  settings?: UserSettings
}

export interface UserProfile {
  avatar?: string
  bio?: string
  phoneNumber?: string
  timezone: string
  language: string
  theme: 'light' | 'dark' | 'system'
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  notifications: NotificationSettings
  language: string
  timezone: string
  emailDigest: 'daily' | 'weekly' | 'never'
}

export interface UserSettings {
  twoFactorEnabled: boolean
  apiAccessEnabled: boolean
  dataRetentionDays: number
  sessionTimeout: number
  loginNotifications: boolean
}

export interface UserSubscriptionInfo {
  id: string
  plan: string
  status: 'active' | 'cancelled' | 'past_due'
  currentPeriodStart: string
  currentPeriodEnd: string
}

export interface NotificationSettings {
  email: boolean
  push: boolean
  sms: boolean
  jobCompletion: boolean
  dataQualityAlerts: boolean
  systemMaintenance: boolean
  securityAlerts: boolean
}

// Authentication Response Types
export interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: 'Bearer'
  sessionId: string
  requiresMFA?: boolean
}

export interface LoginResponse extends AuthResponse {
  isFirstLogin: boolean
  passwordExpired: boolean
}

export interface RegisterResponse extends AuthResponse {
  verificationRequired: boolean
  verificationMethod: 'email' | 'sms'
}

// OAuth Types
export interface OAuthProvider {
  name: 'google' | 'github' | 'discord'
  displayName: string
  icon: string
  iconComponent?: string
  enabled: boolean
  clientId?: string
  scopes: string[]
}

export interface OAuthAuthorizationUrl {
  url: string
  state: string
  codeVerifier?: string
  nonce?: string
}

export interface OAuthCallbackRequest {
  code: string
  state: string
  codeVerifier?: string
}

export interface OAuthUserInfo {
  id: string
  email: string
  name: string
  avatar?: string
  provider: string
  providerId: string
}

// Multi-Factor Authentication
export interface MFASetupRequest {
  method: 'totp' | 'sms' | 'email'
  phoneNumber?: string
}

export interface MFASetupResponse {
  method: 'totp' | 'sms' | 'email'
  secret?: string
  qrCodeUrl?: string
  qrCodeDataUrl?: string
  backupCodes: string[]
  instructions: string
}

export interface MFAVerifyRequest {
  code: string
  method: 'totp' | 'sms' | 'email' | 'backup'
  rememberDevice?: boolean
}

export interface MFAVerifyResponse {
  success: boolean
  deviceToken?: string
  message?: string
}

export interface MFAStatus {
  enabled: boolean
  methods: ('totp' | 'sms' | 'email')[]
  backupCodesRemaining: number
  trustedDevicesCount: number
}

// Password Management
export interface PasswordResetRequest {
  email: string
  redirectUrl?: string
}

export interface PasswordResetResponse {
  message: string
  emailSent: boolean
  resetTokenExpiry?: number
}

export interface PasswordResetConfirm {
  token: string
  newPassword: string
  confirmPassword: string
}

export interface PasswordChangeRequest {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface PasswordStrength {
  score: number
  requirements: {
    minLength: boolean
    hasUppercase: boolean
    hasLowercase: boolean
    hasNumbers: boolean
    hasSpecialChars: boolean
  }
  suggestions: string[]
}

// Session Management
export interface UserSession {
  id: string
  userId: string
  deviceInfo: DeviceInfo
  ipAddress: string
  location?: GeoLocation
  createdAt: string
  lastActiveAt: string
  expiresAt: string
  isActive: boolean
  isCurrent: boolean
}

export interface DeviceInfo {
  userAgent: string
  browser: string
  browserVersion: string
  os: string
  osVersion: string
  device: string
  deviceType: 'desktop' | 'mobile' | 'tablet'
  isMobile: boolean
}

export interface GeoLocation {
  country: string
  region: string
  city: string
  timezone: string
  coordinates?: {
    lat: number
    lng: number
  }
}

// Token Management
export interface TokenRefreshRequest {
  refreshToken: string
}

export interface TokenRefreshResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: 'Bearer'
}

export interface TokenValidationResponse {
  valid: boolean
  expiresAt: string
  user?: User
  scopes?: string[]
}

export interface TokenRevocationRequest {
  token: string
  tokenType: 'access_token' | 'refresh_token'
}

// Email Verification
export interface EmailVerificationRequest {
  email?: string
}

export interface EmailVerificationConfirm {
  token: string
}

export interface EmailVerificationResponse {
  success: boolean
  message: string
}

// Account Management
export interface AccountUpdateRequest {
  name?: string
  username?: string
  firstName?: string
  lastName?: string
  bio?: string
  phoneNumber?: string
  company?: string
}

export interface AccountDeleteRequest {
  password: string
  reason?: string
  feedback?: string
}

export interface AccountDeactivateRequest {
  password: string
  reason: string
}

// Security Events and Audit
export interface SecurityEvent {
  id: string
  type: 'login_attempt' | 'password_change' | 'mfa_setup' | 'session_created' | 'suspicious_activity'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  userId?: string
  ipAddress: string
  userAgent?: string
  location?: string
  timestamp: string
  resolved: boolean
  metadata?: Record<string, any>
}

export interface LoginAttempt {
  id: string
  email: string
  ipAddress: string
  userAgent: string
  location?: string
  success: boolean
  failureReason?: string
  timestamp: string
  blockedUntil?: string
}

// Rate Limiting and Security
export interface RateLimitInfo {
  endpoint: string
  limit: number
  remaining: number
  resetTime: number
  retryAfter?: number
}

export interface SecuritySettings {
  maxLoginAttempts: number
  lockoutDuration: number
  sessionTimeout: number
  requireMFA: boolean
  allowRememberDevice: boolean
  passwordMinLength: number
  passwordRequireUppercase: boolean
  passwordRequireLowercase: boolean
  passwordRequireNumbers: boolean
  passwordRequireSpecialChars: boolean
  passwordExpiryDays?: number
}

// API Error Types
export interface AuthError {
  code: string
  message: string
  details?: any
  timestamp: string
  requestId?: string
  field?: string
  rateLimitInfo?: RateLimitInfo
}

// Form Validation Types
export interface ValidationResult {
  valid: boolean
  errors: Record<string, string[]>
  warnings?: Record<string, string[]>
}

export interface FieldValidation {
  field: string
  rules: ValidationRule[]
}

export interface ValidationRule {
  type: 'required' | 'email' | 'minLength' | 'maxLength' | 'pattern' | 'custom'
  value?: any
  message: string
  validator?: (value: any) => boolean
}

// Authentication State
export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: AuthError | null
  sessionId: string | null
  expiresAt: number | null
  permissions: string[]
  mfaRequired: boolean
}

// Authentication Context
export interface AuthContextValue {
  // State
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: AuthError | null
  mfaRequired: boolean
  
  // Actions
  login: (credentials: AuthCredentials) => Promise<LoginResponse>
  register: (data: RegisterData) => Promise<RegisterResponse>
  logout: () => Promise<void>
  refreshToken: () => Promise<TokenRefreshResponse>
  resetPassword: (data: PasswordResetRequest) => Promise<PasswordResetResponse>
  confirmPasswordReset: (data: PasswordResetConfirm) => Promise<void>
  changePassword: (data: PasswordChangeRequest) => Promise<void>
  verifyEmail: (token: string) => Promise<EmailVerificationResponse>
  resendVerificationEmail: () => Promise<void>
  
  // OAuth
  getOAuthUrl: (provider: string) => Promise<OAuthAuthorizationUrl>
  handleOAuthCallback: (data: OAuthCallbackRequest) => Promise<AuthResponse>
  
  // MFA
  setupMFA: (data: MFASetupRequest) => Promise<MFASetupResponse>
  verifyMFA: (data: MFAVerifyRequest) => Promise<MFAVerifyResponse>
  disableMFA: (password: string) => Promise<void>
  getMFAStatus: () => Promise<MFAStatus>
  
  // Session Management
  getSessions: () => Promise<UserSession[]>
  revokeSession: (sessionId: string) => Promise<void>
  revokeAllSessions: () => Promise<void>
  
  // User Management
  updateProfile: (data: AccountUpdateRequest) => Promise<User>
  uploadAvatar: (file: File) => Promise<{ avatarUrl: string }>
  deleteAccount: (data: AccountDeleteRequest) => Promise<void>
  deactivateAccount: (data: AccountDeactivateRequest) => Promise<void>
  
  // Utilities
  checkPasswordStrength: (password: string) => PasswordStrength
  validateField: (field: string, value: any) => string[]
  clearError: () => void
}

// Component Props Types
export interface LoginFormProps {
  onSubmit: (credentials: AuthCredentials) => Promise<void>
  onOAuthLogin: (provider: string) => Promise<void>
  onForgotPassword: () => void
  isLoading?: boolean
  error?: AuthError | null
  showRememberMe?: boolean
  showOAuth?: boolean
  oauthProviders?: OAuthProvider[]
  redirectTo?: string
}

export interface RegisterFormProps {
  onSubmit: (data: RegisterData) => Promise<void>
  onOAuthLogin: (provider: string) => Promise<void>
  onLoginRedirect: () => void
  isLoading?: boolean
  error?: AuthError | null
  showOAuth?: boolean
  oauthProviders?: OAuthProvider[]
  requireTermsAcceptance?: boolean
  redirectTo?: string
}

export interface MFAFormProps {
  method: 'totp' | 'sms' | 'email'
  onVerify: (code: string) => Promise<void>
  onResend?: () => Promise<void>
  onChangeMethod?: (method: string) => void
  isLoading?: boolean
  error?: AuthError | null
  canResend?: boolean
  resendCountdown?: number
}

export interface PasswordResetFormProps {
  onSubmit: (email: string) => Promise<void>
  onBackToLogin: () => void
  isLoading?: boolean
  error?: AuthError | null
  success?: boolean
}

export interface PasswordStrengthIndicatorProps {
  password: string
  showRequirements?: boolean
  minScore?: number
}

export interface OAuthButtonProps {
  provider: OAuthProvider
  onClick: () => Promise<void>
  isLoading?: boolean
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'outline' | 'ghost'
}

export interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: string[]
  requiredPermissions?: string[]
  fallback?: React.ReactNode
  redirectTo?: string
}

export interface AuthGuardProps {
  children: React.ReactNode
  require?: 'authenticated' | 'unauthenticated' | 'verified' | 'mfa'
  roles?: string[]
  permissions?: string[]
  fallback?: React.ReactNode
  onUnauthorized?: () => void
}

// Hook Return Types
export interface UseAuthReturn extends AuthContextValue {}

export interface UseOAuthReturn {
  providers: OAuthProvider[]
  getAuthUrl: (provider: string) => Promise<string>
  handleCallback: (provider: string, params: URLSearchParams) => Promise<AuthResponse>
  isLoading: boolean
  error: AuthError | null
}

export interface UseMFAReturn {
  isEnabled: boolean
  methods: ('totp' | 'sms' | 'email')[]
  setup: (method: 'totp' | 'sms' | 'email') => Promise<MFASetupResponse>
  verify: (code: string, method: string) => Promise<boolean>
  disable: (password: string) => Promise<void>
  getBackupCodes: () => Promise<string[]>
  regenerateBackupCodes: () => Promise<string[]>
  isLoading: boolean
  error: AuthError | null
}

export interface UseSessionsReturn {
  sessions: UserSession[]
  currentSessionId: string | null
  revoke: (sessionId: string) => Promise<void>
  revokeAll: () => Promise<void>
  refresh: () => Promise<void>
  isLoading: boolean
  error: AuthError | null
}

export interface UsePasswordStrengthReturn {
  strength: PasswordStrength
  isStrong: boolean
  suggestions: string[]
}