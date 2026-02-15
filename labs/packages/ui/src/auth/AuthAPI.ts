/**
 * Enhanced Authentication API Client for Secured Backend
 * Supports all new authentication endpoints with comprehensive security features
 */

import type {
  AuthCredentials,
  RegisterData,
  AuthResponse,
  LoginResponse,
  RegisterResponse,
  User,
  TokenRefreshRequest,
  TokenRefreshResponse,
  TokenValidationResponse,
  TokenRevocationRequest,
  PasswordResetRequest,
  PasswordResetResponse,
  PasswordResetConfirm,
  PasswordChangeRequest,
  EmailVerificationRequest,
  EmailVerificationConfirm,
  EmailVerificationResponse,
  OAuthProvider,
  OAuthAuthorizationUrl,
  OAuthCallbackRequest,
  MFASetupRequest,
  MFASetupResponse,
  MFAVerifyRequest,
  MFAVerifyResponse,
  MFAStatus,
  UserSession,
  AccountUpdateRequest,
  AccountDeleteRequest,
  AccountDeactivateRequest,
  SecurityEvent,
  LoginAttempt,
  RateLimitInfo
} from '@igris-inertial/types'

interface APIConfig {
  baseURL: string
  apiVersion?: string
  timeout?: number
  retryAttempts?: number
}

interface RequestOptions {
  headers?: Record<string, string>
  timeout?: number
  retry?: boolean
}

export class AuthAPIClient {
  private baseURL: string
  private apiVersion: string
  private timeout: number
  private retryAttempts: number
  private refreshPromise: Promise<TokenRefreshResponse> | null = null

  constructor(config: APIConfig) {
    this.baseURL = config.baseURL.replace(/\/$/, '') // Remove trailing slash
    this.apiVersion = config.apiVersion || 'v1'
    this.timeout = config.timeout || 10000
    this.retryAttempts = config.retryAttempts || 3
  }

  // Token Management
  private getStoredTokens(): { accessToken: string | null; refreshToken: string | null } {
    if (typeof window === 'undefined') {
      return { accessToken: null, refreshToken: null }
    }
    
    // Try cookies first (more secure)
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) return parts.pop()?.split(';').shift()
      return null
    }
    
    let accessToken = getCookie('auth_token')
    let refreshToken = getCookie('refresh_token')
    
    // Fallback to localStorage
    if (!accessToken) {
      accessToken = localStorage.getItem('auth_token')
      refreshToken = localStorage.getItem('refresh_token')
    }
    
    return { accessToken, refreshToken }
  }

  private storeTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
    if (typeof window === 'undefined') return
    
    // Calculate expiry date
    const expiryDate = new Date(Date.now() + expiresIn * 1000)
    const expiryString = expiryDate.toUTCString()
    
    // Store in httpOnly cookies if possible, fallback to localStorage
    try {
      // Note: In a real implementation, these should be set by the server as httpOnly cookies
      document.cookie = `auth_token=${accessToken}; expires=${expiryString}; path=/; secure; samesite=strict`
      document.cookie = `refresh_token=${refreshToken}; expires=${expiryString}; path=/; secure; samesite=strict`
    } catch {
      // Fallback to localStorage
      localStorage.setItem('auth_token', accessToken)
      localStorage.setItem('refresh_token', refreshToken)
      localStorage.setItem('token_expires_at', expiryDate.toISOString())
    }
  }

  private clearTokens(): void {
    if (typeof window === 'undefined') return
    
    // Clear cookies
    document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    document.cookie = 'refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    
    // Clear localStorage
    localStorage.removeItem('auth_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('token_expires_at')
    localStorage.removeItem('user_data')
  }

  private getAuthHeaders(): Record<string, string> {
    const { accessToken } = this.getStoredTokens()
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
  }

  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    const url = `${this.baseURL}/api/${this.apiVersion}${endpoint}`
    const headers = {
      'Content-Type': 'application/json',
      ...this.getAuthHeaders(),
      ...options.headers
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.timeout)

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
        credentials: 'include' // Include cookies
      })

      clearTimeout(timeoutId)

      // Handle rate limiting
      if (response.status === 429) {
        const rateLimitInfo = this.parseRateLimitHeaders(response.headers)
        throw new AuthError('RATE_LIMITED', 'Too many requests', { rateLimitInfo })
      }

      // Handle authentication errors
      if (response.status === 401) {
        // Try to refresh token
        const { refreshToken } = this.getStoredTokens()
        if (refreshToken && endpoint !== '/auth/refresh') {
          try {
            await this.refreshTokens()
            // Retry the original request with new token
            return this.makeRequest(method, endpoint, data, options)
          } catch {
            this.clearTokens()
            throw new AuthError('UNAUTHORIZED', 'Session expired')
          }
        } else {
          this.clearTokens()
          throw new AuthError('UNAUTHORIZED', 'Authentication required')
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new AuthError(
          errorData.code || 'REQUEST_FAILED',
          errorData.message || `Request failed with status ${response.status}`,
          errorData.details
        )
      }

      return response.json()
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof AuthError) {
        throw error
      }
      
      if (error.name === 'AbortError') {
        throw new AuthError('TIMEOUT', 'Request timeout')
      }
      
      throw new AuthError('NETWORK_ERROR', 'Network error occurred', { originalError: error })
    }
  }

  private parseRateLimitHeaders(headers: Headers): RateLimitInfo {
    return {
      endpoint: '',
      limit: parseInt(headers.get('X-RateLimit-Limit') || '0'),
      remaining: parseInt(headers.get('X-RateLimit-Remaining') || '0'),
      resetTime: parseInt(headers.get('X-RateLimit-Reset') || '0'),
      retryAfter: parseInt(headers.get('Retry-After') || '0')
    }
  }

  // Authentication Methods
  async login(credentials: AuthCredentials): Promise<LoginResponse> {
    const response = await this.makeRequest<LoginResponse>('POST', '/auth/login', credentials)
    this.storeTokens(response.accessToken, response.refreshToken, response.expiresIn)
    return response
  }

  async register(data: RegisterData): Promise<RegisterResponse> {
    const response = await this.makeRequest<RegisterResponse>('POST', '/auth/register', data)
    if (response.accessToken) {
      this.storeTokens(response.accessToken, response.refreshToken, response.expiresIn)
    }
    return response
  }

  async logout(): Promise<void> {
    try {
      await this.makeRequest('POST', '/auth/logout')
    } finally {
      this.clearTokens()
    }
  }

  async refreshTokens(): Promise<TokenRefreshResponse> {
    // Prevent multiple concurrent refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise
    }

    const { refreshToken } = this.getStoredTokens()
    if (!refreshToken) {
      throw new AuthError('NO_REFRESH_TOKEN', 'No refresh token available')
    }

    this.refreshPromise = this.makeRequest<TokenRefreshResponse>('POST', '/auth/refresh', {
      refresh_token: refreshToken
    })

    try {
      const response = await this.refreshPromise
      this.storeTokens(response.accessToken, response.refreshToken, response.expiresIn)
      return response
    } finally {
      this.refreshPromise = null
    }
  }

  async validateToken(): Promise<TokenValidationResponse> {
    return this.makeRequest<TokenValidationResponse>('GET', '/auth/validate')
  }

  async revokeToken(data: TokenRevocationRequest): Promise<void> {
    await this.makeRequest('POST', '/auth/revoke', data)
  }

  // User Management
  async getCurrentUser(): Promise<User> {
    return this.makeRequest<User>('GET', '/auth/me')
  }

  async updateProfile(data: AccountUpdateRequest): Promise<User> {
    return this.makeRequest<User>('PUT', '/auth/profile', data)
  }

  async uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
    const formData = new FormData()
    formData.append('avatar', file)
    
    const url = `${this.baseURL}/api/${this.apiVersion}/auth/avatar`
    const headers = this.getAuthHeaders()
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include'
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new AuthError(
        errorData.code || 'UPLOAD_FAILED',
        errorData.message || 'Avatar upload failed'
      )
    }
    
    return response.json()
  }

  async deleteAccount(data: AccountDeleteRequest): Promise<void> {
    await this.makeRequest('DELETE', '/auth/account', data)
    this.clearTokens()
  }

  async deactivateAccount(data: AccountDeactivateRequest): Promise<void> {
    await this.makeRequest('POST', '/auth/account/deactivate', data)
    this.clearTokens()
  }

  // Password Management
  async resetPassword(data: PasswordResetRequest): Promise<PasswordResetResponse> {
    return this.makeRequest<PasswordResetResponse>('POST', '/auth/password/reset', data)
  }

  async confirmPasswordReset(data: PasswordResetConfirm): Promise<void> {
    await this.makeRequest('POST', '/auth/password/reset/confirm', data)
  }

  async changePassword(data: PasswordChangeRequest): Promise<void> {
    await this.makeRequest('POST', '/auth/password/change', data)
  }

  // Email Verification
  async requestEmailVerification(data?: EmailVerificationRequest): Promise<void> {
    await this.makeRequest('POST', '/auth/email/verify/request', data)
  }

  async confirmEmailVerification(data: EmailVerificationConfirm): Promise<EmailVerificationResponse> {
    return this.makeRequest<EmailVerificationResponse>('POST', '/auth/email/verify/confirm', data)
  }

  // OAuth Methods
  async getOAuthProviders(): Promise<OAuthProvider[]> {
    return this.makeRequest<OAuthProvider[]>('GET', '/auth/oauth/providers')
  }

  async getOAuthAuthorizationUrl(provider: string): Promise<OAuthAuthorizationUrl> {
    return this.makeRequest<OAuthAuthorizationUrl>('GET', `/auth/oauth/${provider}/authorize`)
  }

  async handleOAuthCallback(provider: string, data: OAuthCallbackRequest): Promise<AuthResponse> {
    const response = await this.makeRequest<AuthResponse>('POST', `/auth/oauth/${provider}/callback`, data)
    this.storeTokens(response.accessToken, response.refreshToken, response.expiresIn)
    return response
  }

  // Multi-Factor Authentication
  async setupMFA(data: MFASetupRequest): Promise<MFASetupResponse> {
    return this.makeRequest<MFASetupResponse>('POST', '/auth/mfa/setup', data)
  }

  async verifyMFA(data: MFAVerifyRequest): Promise<MFAVerifyResponse> {
    return this.makeRequest<MFAVerifyResponse>('POST', '/auth/mfa/verify', data)
  }

  async disableMFA(password: string): Promise<void> {
    await this.makeRequest('POST', '/auth/mfa/disable', { password })
  }

  async getMFAStatus(): Promise<MFAStatus> {
    return this.makeRequest<MFAStatus>('GET', '/auth/mfa/status')
  }

  async generateBackupCodes(): Promise<{ codes: string[] }> {
    return this.makeRequest<{ codes: string[] }>('POST', '/auth/mfa/backup-codes/generate')
  }

  // Session Management
  async getSessions(): Promise<UserSession[]> {
    return this.makeRequest<UserSession[]>('GET', '/auth/sessions')
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.makeRequest('DELETE', `/auth/sessions/${sessionId}`)
  }

  async revokeAllSessions(): Promise<void> {
    await this.makeRequest('DELETE', '/auth/sessions')
  }

  // Security and Monitoring
  async getSecurityEvents(limit: number = 50): Promise<SecurityEvent[]> {
    return this.makeRequest<SecurityEvent[]>('GET', `/auth/security/events?limit=${limit}`)
  }

  async getLoginAttempts(limit: number = 20): Promise<LoginAttempt[]> {
    return this.makeRequest<LoginAttempt[]>('GET', `/auth/security/login-attempts?limit=${limit}`)
  }

  // Utility Methods
  isAuthenticated(): boolean {
    const { accessToken } = this.getStoredTokens()
    return !!accessToken
  }

  getTokenExpiryTime(): Date | null {
    if (typeof window === 'undefined') return null
    
    const expiryString = localStorage.getItem('token_expires_at')
    return expiryString ? new Date(expiryString) : null
  }

  willTokenExpireSoon(minutes: number = 5): boolean {
    const expiryTime = this.getTokenExpiryTime()
    if (!expiryTime) return false
    
    const warningTime = new Date(expiryTime.getTime() - minutes * 60 * 1000)
    return new Date() >= warningTime
  }
}

// Default instance
const defaultConfig: APIConfig = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  apiVersion: 'v1',
  timeout: 10000,
  retryAttempts: 3
}

export const authAPI = new AuthAPIClient(defaultConfig)

// Error class
export class AuthError extends Error {
  public code: string
  public details?: any
  public timestamp: string
  public rateLimitInfo?: RateLimitInfo

  constructor(code: string, message: string, details?: any) {
    super(message)
    this.name = 'AuthError'
    this.code = code
    this.details = details
    this.timestamp = new Date().toISOString()
    
    if (details?.rateLimitInfo) {
      this.rateLimitInfo = details.rateLimitInfo
    }
  }
}

// Utility functions for password strength checking
export function checkPasswordStrength(password: string) {
  const requirements = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumbers: /\d/.test(password),
    hasSpecialChars: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  }
  
  const metRequirements = Object.values(requirements).filter(Boolean).length
  const score = Math.min(metRequirements, 5)
  
  const suggestions: string[] = []
  if (!requirements.minLength) suggestions.push('Use at least 8 characters')
  if (!requirements.hasUppercase) suggestions.push('Include uppercase letters')
  if (!requirements.hasLowercase) suggestions.push('Include lowercase letters')
  if (!requirements.hasNumbers) suggestions.push('Include numbers')
  if (!requirements.hasSpecialChars) suggestions.push('Include special characters')
  
  return {
    score,
    requirements,
    suggestions
  }
}

export default authAPI