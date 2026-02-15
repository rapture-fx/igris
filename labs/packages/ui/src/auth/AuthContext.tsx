/**
 * Enhanced Authentication Context for Secured Backend Integration
 * Provides comprehensive authentication state management and security features
 */

'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import type {
  User,
  AuthCredentials,
  RegisterData,
  AuthResponse,
  LoginResponse,
  RegisterResponse,
  TokenRefreshResponse,
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
  AuthError,
  AuthContextValue,
  PasswordStrength
} from '@igris-inertial/types/auth'

import { authAPI, AuthError as APIError, checkPasswordStrength } from './AuthAPI'

interface AuthProviderProps {
  children: React.ReactNode
  config?: {
    autoRefresh?: boolean
    refreshThreshold?: number // Minutes before expiry to refresh
    sessionTimeout?: number // Minutes of inactivity before logout
    persistSession?: boolean
  }
}

const defaultConfig = {
  autoRefresh: true,
  refreshThreshold: 5,
  sessionTimeout: 30,
  persistSession: true
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children, config = defaultConfig }: AuthProviderProps) {
  // Core state
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<AuthError | null>(null)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])

  // Refs for cleanup and intervals
  const refreshTimeoutRef = useRef<NodeJS.Timeout>()
  const sessionTimeoutRef = useRef<NodeJS.Timeout>()
  const activityTimeoutRef = useRef<NodeJS.Timeout>()

  // Clear error helper
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Update user session data
  const updateSessionData = useCallback((authResponse: AuthResponse) => {
    setUser(authResponse.user)
    setIsAuthenticated(true)
    setSessionId(authResponse.sessionId)
    setExpiresAt(Date.now() + authResponse.expiresIn * 1000)
    setMfaRequired(false)
    
    // Extract permissions from user role
    const userPermissions = getUserPermissions(authResponse.user)
    setPermissions(userPermissions)
  }, [])

  // Clear session data
  const clearSessionData = useCallback(() => {
    setUser(null)
    setIsAuthenticated(false)
    setSessionId(null)
    setExpiresAt(null)
    setPermissions([])
    setMfaRequired(false)
  }, [])

  // Setup automatic token refresh
  const setupAutoRefresh = useCallback(() => {
    if (!config.autoRefresh || !expiresAt) return

    const refreshTime = expiresAt - (config.refreshThreshold * 60 * 1000)
    const timeUntilRefresh = refreshTime - Date.now()

    if (timeUntilRefresh > 0) {
      refreshTimeoutRef.current = setTimeout(async () => {
        try {
          await refreshToken()
        } catch (error) {
          console.error('Auto refresh failed:', error)
          await logout()
        }
      }, timeUntilRefresh)
    }
  }, [config.autoRefresh, config.refreshThreshold, expiresAt])

  // Setup session timeout
  const setupSessionTimeout = useCallback(() => {
    if (!config.sessionTimeout) return

    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current)
    }

    sessionTimeoutRef.current = setTimeout(async () => {
      console.log('Session timeout reached')
      await logout()
    }, config.sessionTimeout * 60 * 1000)
  }, [config.sessionTimeout])

  // Handle user activity to reset session timeout
  const handleUserActivity = useCallback(() => {
    if (!isAuthenticated) return

    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current)
    }

    activityTimeoutRef.current = setTimeout(() => {
      setupSessionTimeout()
    }, 1000) // Debounce activity events
  }, [isAuthenticated, setupSessionTimeout])

  // Login method
  const login = useCallback(async (credentials: AuthCredentials): Promise<LoginResponse> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await authAPI.login(credentials)
      
      if (response.requiresMFA) {
        setMfaRequired(true)
        setUser(response.user)
        return response
      }

      updateSessionData(response)
      return response
    } catch (err) {
      const authError = err instanceof APIError ? 
        { code: err.code, message: err.message, details: err.details, timestamp: err.timestamp } as AuthError :
        { code: 'LOGIN_FAILED', message: 'Login failed', timestamp: new Date().toISOString() } as AuthError
      setError(authError)
      throw authError
    } finally {
      setIsLoading(false)
    }
  }, [updateSessionData])

  // Register method
  const register = useCallback(async (data: RegisterData): Promise<RegisterResponse> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await authAPI.register(data)
      
      if (!response.verificationRequired && response.accessToken) {
        updateSessionData(response)
      }

      return response
    } catch (err) {
      const authError = err instanceof APIError ? 
        { code: err.code, message: err.message, details: err.details, timestamp: err.timestamp } as AuthError :
        { code: 'REGISTER_FAILED', message: 'Registration failed', timestamp: new Date().toISOString() } as AuthError
      setError(authError)
      throw authError
    } finally {
      setIsLoading(false)
    }
  }, [updateSessionData])

  // Logout method
  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true)

    try {
      await authAPI.logout()
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      clearSessionData()
      setIsLoading(false)
      
      // Clear timeouts
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
      if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current)
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current)
    }
  }, [clearSessionData])

  // Refresh token method
  const refreshToken = useCallback(async (): Promise<TokenRefreshResponse> => {
    try {
      const response = await authAPI.refreshTokens()
      
      // Update expiry time
      setExpiresAt(Date.now() + response.expiresIn * 1000)
      
      return response
    } catch (err) {
      const authError = err instanceof APIError ? 
        { code: err.code, message: err.message, details: err.details, timestamp: err.timestamp } as AuthError :
        { code: 'REFRESH_FAILED', message: 'Token refresh failed', timestamp: new Date().toISOString() } as AuthError
      setError(authError)
      await logout()
      throw authError
    }
  }, [logout])

  // Password reset methods
  const resetPassword = useCallback(async (data: PasswordResetRequest): Promise<PasswordResetResponse> => {
    setError(null)
    try {
      return await authAPI.resetPassword(data)
    } catch (err) {
      const authError = err instanceof APIError ? 
        { code: err.code, message: err.message, details: err.details, timestamp: err.timestamp } as AuthError :
        { code: 'RESET_FAILED', message: 'Password reset failed', timestamp: new Date().toISOString() } as AuthError
      setError(authError)
      throw authError
    }
  }, [])

  const confirmPasswordReset = useCallback(async (data: PasswordResetConfirm): Promise<void> => {
    setError(null)
    try {
      await authAPI.confirmPasswordReset(data)
    } catch (err) {
      const authError = err instanceof APIError ? 
        { code: err.code, message: err.message, details: err.details, timestamp: err.timestamp } as AuthError :
        { code: 'RESET_CONFIRM_FAILED', message: 'Password reset confirmation failed', timestamp: new Date().toISOString() } as AuthError
      setError(authError)
      throw authError
    }
  }, [])

  const changePassword = useCallback(async (data: PasswordChangeRequest): Promise<void> => {
    setError(null)
    try {
      await authAPI.changePassword(data)
    } catch (err) {
      const authError = err instanceof APIError ? 
        { code: err.code, message: err.message, details: err.details, timestamp: err.timestamp } as AuthError :
        { code: 'CHANGE_PASSWORD_FAILED', message: 'Password change failed', timestamp: new Date().toISOString() } as AuthError
      setError(authError)
      throw authError
    }
  }, [])

  // Email verification methods
  const verifyEmail = useCallback(async (token: string): Promise<EmailVerificationResponse> => {
    setError(null)
    try {
      return await authAPI.confirmEmailVerification({ token })
    } catch (err) {
      const authError = err instanceof APIError ? 
        { code: err.code, message: err.message, details: err.details, timestamp: err.timestamp } as AuthError :
        { code: 'EMAIL_VERIFY_FAILED', message: 'Email verification failed', timestamp: new Date().toISOString() } as AuthError
      setError(authError)
      throw authError
    }
  }, [])

  const resendVerificationEmail = useCallback(async (): Promise<void> => {
    setError(null)
    try {
      await authAPI.requestEmailVerification()
    } catch (err) {
      const authError = err instanceof APIError ? 
        { code: err.code, message: err.message, details: err.details, timestamp: err.timestamp } as AuthError :
        { code: 'EMAIL_RESEND_FAILED', message: 'Failed to resend verification email', timestamp: new Date().toISOString() } as AuthError
      setError(authError)
      throw authError
    }
  }, [])

  // OAuth methods
  const getOAuthUrl = useCallback(async (provider: string): Promise<OAuthAuthorizationUrl> => {
    setError(null)
    try {
      return await authAPI.getOAuthAuthorizationUrl(provider)
    } catch (err) {
      const authError = err instanceof APIError ? 
        { code: err.code, message: err.message, details: err.details, timestamp: err.timestamp } as AuthError :
        { code: 'OAUTH_URL_FAILED', message: 'Failed to get OAuth URL', timestamp: new Date().toISOString() } as AuthError
      setError(authError)
      throw authError
    }
  }, [])

  const handleOAuthCallback = useCallback(async (data: OAuthCallbackRequest): Promise<AuthResponse> => {
    setIsLoading(true)
    setError(null)

    try {
      // Extract provider from current URL or state
      const provider = 'google' // This should be determined from the callback context
      const response = await authAPI.handleOAuthCallback(provider, data)
      updateSessionData(response)
      return response
    } catch (err) {
      const authError = err instanceof APIError ? 
        { code: err.code, message: err.message, details: err.details, timestamp: err.timestamp } as AuthError :
        { code: 'OAUTH_CALLBACK_FAILED', message: 'OAuth callback failed', timestamp: new Date().toISOString() } as AuthError
      setError(authError)
      throw authError
    } finally {
      setIsLoading(false)
    }
  }, [updateSessionData])

  // MFA methods
  const setupMFA = useCallback(async (data: MFASetupRequest): Promise<MFASetupResponse> => {
    setError(null)
    try {
      return await authAPI.setupMFA(data)
    } catch (err) {
      const authError = err instanceof APIError ? 
        { code: err.code, message: err.message, details: err.details, timestamp: err.timestamp } as AuthError :
        { code: 'MFA_SETUP_FAILED', message: 'MFA setup failed', timestamp: new Date().toISOString() } as AuthError
      setError(authError)
      throw authError
    }
  }, [])

  const verifyMFA = useCallback(async (data: MFAVerifyRequest): Promise<MFAVerifyResponse> => {
    setError(null)
    try {
      const response = await authAPI.verifyMFA(data)
      
      if (response.success && mfaRequired) {
        // Complete the login process
        const currentUser = await authAPI.getCurrentUser()
        setUser(currentUser)
        setIsAuthenticated(true)
        setMfaRequired(false)
      }
      
      return response
    } catch (err) {
      const authError = err instanceof APIError ? 
        { code: err.code, message: err.message, details: err.details, timestamp: err.timestamp } as AuthError :
        { code: 'MFA_VERIFY_FAILED', message: 'MFA verification failed', timestamp: new Date().toISOString() } as AuthError
      setError(authError)
      throw authError
    }
  }, [mfaRequired])

  const disableMFA = useCallback(async (password: string): Promise<void> => {
    setError(null)
    try {
      await authAPI.disableMFA(password)
    } catch (err) {
      const authError = err instanceof APIError ? 
        { code: err.code, message: err.message, details: err.details, timestamp: err.timestamp } as AuthError :
        { code: 'MFA_DISABLE_FAILED', message: 'MFA disable failed', timestamp: new Date().toISOString() } as AuthError
      setError(authError)
      throw authError
    }
  }, [])

  const getMFAStatus = useCallback(async (): Promise<MFAStatus> => {
    setError(null)
    try {
      return await authAPI.getMFAStatus()
    } catch (err) {
      const authError = err instanceof APIError ? 
        { code: err.code, message: err.message, details: err.details, timestamp: err.timestamp } as AuthError :
        { code: 'MFA_STATUS_FAILED', message: 'Failed to get MFA status', timestamp: new Date().toISOString() } as AuthError
      setError(authError)
      throw authError
    }
  }, [])

  // Session management methods
  const getSessions = useCallback(async (): Promise<UserSession[]> => {
    setError(null)
    try {
      return await authAPI.getSessions()
    } catch (err) {
      const authError = err instanceof APIError ? 
        { code: err.code, message: err.message, details: err.details, timestamp: err.timestamp } as AuthError :
        { code: 'GET_SESSIONS_FAILED', message: 'Failed to get sessions', timestamp: new Date().toISOString() } as AuthError
      setError(authError)
      throw authError
    }
  }, [])

  const revokeSession = useCallback(async (sessionId: string): Promise<void> => {
    setError(null)
    try {
      await authAPI.revokeSession(sessionId)
    } catch (err) {
      const authError = err instanceof APIError ? 
        { code: err.code, message: err.message, details: err.details, timestamp: err.timestamp } as AuthError :
        { code: 'REVOKE_SESSION_FAILED', message: 'Failed to revoke session', timestamp: new Date().toISOString() } as AuthError
      setError(authError)
      throw authError
    }
  }, [])

  const revokeAllSessions = useCallback(async (): Promise<void> => {
    setError(null)
    try {
      await authAPI.revokeAllSessions()
      await logout() // Logout current session too
    } catch (err) {
      const authError = err instanceof APIError ? 
        { code: err.code, message: err.message, details: err.details, timestamp: err.timestamp } as AuthError :
        { code: 'REVOKE_ALL_SESSIONS_FAILED', message: 'Failed to revoke all sessions', timestamp: new Date().toISOString() } as AuthError
      setError(authError)
      throw authError
    }
  }, [logout])

  // User management methods
  const updateProfile = useCallback(async (data: AccountUpdateRequest): Promise<User> => {
    setError(null)
    try {
      const updatedUser = await authAPI.updateProfile(data)
      setUser(updatedUser)
      return updatedUser
    } catch (err) {
      const authError = err instanceof APIError ? 
        { code: err.code, message: err.message, details: err.details, timestamp: err.timestamp } as AuthError :
        { code: 'UPDATE_PROFILE_FAILED', message: 'Profile update failed', timestamp: new Date().toISOString() } as AuthError
      setError(authError)
      throw authError
    }
  }, [])

  const uploadAvatar = useCallback(async (file: File): Promise<{ avatarUrl: string }> => {
    setError(null)
    try {
      const result = await authAPI.uploadAvatar(file)
      
      // Update user with new avatar
      if (user) {
        setUser({ ...user, avatar: result.avatarUrl })
      }
      
      return result
    } catch (err) {
      const authError = err instanceof APIError ? 
        { code: err.code, message: err.message, details: err.details, timestamp: err.timestamp } as AuthError :
        { code: 'AVATAR_UPLOAD_FAILED', message: 'Avatar upload failed', timestamp: new Date().toISOString() } as AuthError
      setError(authError)
      throw authError
    }
  }, [user])

  const deleteAccount = useCallback(async (data: AccountDeleteRequest): Promise<void> => {
    setError(null)
    try {
      await authAPI.deleteAccount(data)
      clearSessionData()
    } catch (err) {
      const authError = err instanceof APIError ? 
        { code: err.code, message: err.message, details: err.details, timestamp: err.timestamp } as AuthError :
        { code: 'DELETE_ACCOUNT_FAILED', message: 'Account deletion failed', timestamp: new Date().toISOString() } as AuthError
      setError(authError)
      throw authError
    }
  }, [clearSessionData])

  const deactivateAccount = useCallback(async (data: AccountDeactivateRequest): Promise<void> => {
    setError(null)
    try {
      await authAPI.deactivateAccount(data)
      clearSessionData()
    } catch (err) {
      const authError = err instanceof APIError ? 
        { code: err.code, message: err.message, details: err.details, timestamp: err.timestamp } as AuthError :
        { code: 'DEACTIVATE_ACCOUNT_FAILED', message: 'Account deactivation failed', timestamp: new Date().toISOString() } as AuthError
      setError(authError)
      throw authError
    }
  }, [clearSessionData])

  // Utility methods
  const checkPasswordStrengthWrapper = useCallback((password: string): PasswordStrength => {
    return checkPasswordStrength(password)
  }, [])

  const validateField = useCallback((field: string, value: any): string[] => {
    const errors: string[] = []
    
    switch (field) {
      case 'email':
        if (!value) errors.push('Email is required')
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors.push('Invalid email format')
        }
        break
      case 'password':
        if (!value) errors.push('Password is required')
        else if (value.length < 8) {
          errors.push('Password must be at least 8 characters')
        }
        break
      case 'name':
        if (!value) errors.push('Name is required')
        else if (value.trim().length < 2) {
          errors.push('Name must be at least 2 characters')
        }
        break
    }
    
    return errors
  }, [])

  // Initialize authentication state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (authAPI.isAuthenticated()) {
          const userData = await authAPI.getCurrentUser()
          setUser(userData)
          setIsAuthenticated(true)
          
          // Check token expiry
          const expiryTime = authAPI.getTokenExpiryTime()
          if (expiryTime) {
            setExpiresAt(expiryTime.getTime())
          }
        }
      } catch (error) {
        console.error('Auth initialization failed:', error)
        // Don't set error state during initialization
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()
  }, [])

  // Setup auto refresh when authenticated
  useEffect(() => {
    if (isAuthenticated && expiresAt) {
      setupAutoRefresh()
      setupSessionTimeout()
    }

    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
      if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current)
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current)
    }
  }, [isAuthenticated, expiresAt, setupAutoRefresh, setupSessionTimeout])

  // Setup activity listeners
  useEffect(() => {
    if (!isAuthenticated) return

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
    
    const listener = () => handleUserActivity()
    events.forEach(event => document.addEventListener(event, listener, true))

    return () => {
      events.forEach(event => document.removeEventListener(event, listener, true))
    }
  }, [isAuthenticated, handleUserActivity])

  const contextValue: AuthContextValue = {
    // State
    user,
    isAuthenticated,
    isLoading,
    error,
    mfaRequired,
    
    // Auth actions
    login,
    register,
    logout,
    refreshToken,
    resetPassword,
    confirmPasswordReset,
    changePassword,
    verifyEmail,
    resendVerificationEmail,
    
    // OAuth
    getOAuthUrl,
    handleOAuthCallback,
    
    // MFA
    setupMFA,
    verifyMFA,
    disableMFA,
    getMFAStatus,
    
    // Session management
    getSessions,
    revokeSession,
    revokeAllSessions,
    
    // User management
    updateProfile,
    uploadAvatar,
    deleteAccount,
    deactivateAccount,
    
    // Utilities
    checkPasswordStrength: checkPasswordStrengthWrapper,
    validateField,
    clearError
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook to use auth context
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Helper function to extract permissions from user
function getUserPermissions(user: User): string[] {
  const permissions: string[] = []
  
  switch (user.role) {
    case 'admin':
      permissions.push('admin', 'read', 'write', 'delete', 'manage_users')
      break
    case 'enterprise':
      permissions.push('read', 'write', 'delete', 'advanced_features')
      break
    case 'user':
      permissions.push('read', 'write')
      break
    case 'viewer':
      permissions.push('read')
      break
  }
  
  return permissions
}

export default AuthContext