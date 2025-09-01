/**
 * Authentication Components and Utilities
 * Comprehensive authentication system with OAuth support
 */

// Core API and Context
export { authAPI, AuthError, checkPasswordStrength } from './AuthAPI'
export { AuthProvider, useAuth } from './AuthContext'

// Form Components
export { LoginForm } from './LoginForm'
export { RegisterForm } from './RegisterForm'

// OAuth Components and Hooks
export { OAuthButton } from './OAuthButton'
export { OAuthHandler } from './OAuthHandler'
export { useOAuth, withOAuthCallback } from './useOAuth'

// Protection and Guards
export { 
  ProtectedRoute
} from './ProtectedRoute'

export { 
  AuthGuard,
  RequireAuth,
  RequireGuest,
  RequireVerified,
  RequireRole,
  RequirePermission,
  RequireMFA,
  withAuth,
  useAuthGuard
} from './AuthGuard'

// Re-export types for convenience
export type {
  AuthCredentials,
  RegisterData,
  User,
  AuthResponse,
  LoginResponse,
  RegisterResponse,
  AuthError,
  OAuthProvider,
  LoginFormProps,
  RegisterFormProps,
  OAuthButtonProps,
  ProtectedRouteProps,
  AuthGuardProps,
  AuthContextValue,
  PasswordStrength,
  UserSession,
  MFASetupRequest,
  MFASetupResponse,
  MFAVerifyRequest,
  MFAVerifyResponse,
  MFAStatus,
  UseOAuthReturn
} from '@schlep-engine/types/auth'