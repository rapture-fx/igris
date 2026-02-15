/**
 * Authentication Guard Component
 * Flexible component for conditional rendering based on authentication state
 */

'use client'

import React from 'react'
import type { AuthGuardProps, User } from '@igris-inertial/types/auth'
import { useAuth } from './AuthContext'

// Helper function to check user permissions
function hasPermission(user: User | null, permission: string): boolean {
  if (!user) return false
  
  const userPermissions = getUserPermissions(user)
  return userPermissions.includes(permission)
}

// Helper function to check user role
function hasRole(user: User | null, role: string): boolean {
  if (!user) return false
  return user.role === role
}

// Helper function to get user permissions based on role
function getUserPermissions(user: User): string[] {
  const permissions: string[] = []
  
  switch (user.role) {
    case 'admin':
      permissions.push('admin', 'read', 'write', 'delete', 'manage_users', 'manage_system')
      break
    case 'enterprise':
      permissions.push('read', 'write', 'delete', 'advanced_features', 'api_access')
      break
    case 'user':
      permissions.push('read', 'write', 'basic_features')
      break
    case 'viewer':
      permissions.push('read')
      break
  }
  
  return permissions
}

export function AuthGuard({
  children,
  require = 'authenticated',
  roles = [],
  permissions = [],
  fallback = null,
  onUnauthorized
}: AuthGuardProps) {
  const { user, isAuthenticated, isLoading, mfaRequired } = useAuth()

  // Don't render anything while loading
  if (isLoading) {
    return fallback
  }

  // Handle different requirement types
  switch (require) {
    case 'authenticated':
      if (!isAuthenticated || !user) {
        if (onUnauthorized) onUnauthorized()
        return fallback
      }
      break
    
    case 'unauthenticated':
      if (isAuthenticated && user) {
        if (onUnauthorized) onUnauthorized()
        return fallback
      }
      break
    
    case 'verified':
      if (!isAuthenticated || !user || !user.emailVerified) {
        if (onUnauthorized) onUnauthorized()
        return fallback
      }
      break
    
    case 'mfa':
      if (!isAuthenticated || !user || mfaRequired || !user.mfaEnabled) {
        if (onUnauthorized) onUnauthorized()
        return fallback
      }
      break
  }

  // Check role requirements
  if (roles.length > 0 && user) {
    const hasRequiredRole = roles.some(role => hasRole(user, role))
    if (!hasRequiredRole) {
      if (onUnauthorized) onUnauthorized()
      return fallback
    }
  }

  // Check permission requirements
  if (permissions.length > 0 && user) {
    const hasAllPermissions = permissions.every(permission => hasPermission(user, permission))
    if (!hasAllPermissions) {
      if (onUnauthorized) onUnauthorized()
      return fallback
    }
  }

  // All checks passed, render children
  return <>{children}</>
}

// Convenience components for common use cases

export function RequireAuth({ 
  children, 
  fallback = null,
  onUnauthorized
}: { 
  children: React.ReactNode
  fallback?: React.ReactNode
  onUnauthorized?: () => void 
}) {
  return (
    <AuthGuard 
      require="authenticated" 
      fallback={fallback}
      onUnauthorized={onUnauthorized}
    >
      {children}
    </AuthGuard>
  )
}

export function RequireGuest({ 
  children, 
  fallback = null,
  onUnauthorized
}: { 
  children: React.ReactNode
  fallback?: React.ReactNode
  onUnauthorized?: () => void 
}) {
  return (
    <AuthGuard 
      require="unauthenticated" 
      fallback={fallback}
      onUnauthorized={onUnauthorized}
    >
      {children}
    </AuthGuard>
  )
}

export function RequireVerified({ 
  children, 
  fallback = null,
  onUnauthorized
}: { 
  children: React.ReactNode
  fallback?: React.ReactNode
  onUnauthorized?: () => void 
}) {
  return (
    <AuthGuard 
      require="verified" 
      fallback={fallback}
      onUnauthorized={onUnauthorized}
    >
      {children}
    </AuthGuard>
  )
}

export function RequireRole({ 
  children, 
  role,
  fallback = null,
  onUnauthorized
}: { 
  children: React.ReactNode
  role: string | string[]
  fallback?: React.ReactNode
  onUnauthorized?: () => void 
}) {
  return (
    <AuthGuard 
      require="authenticated"
      roles={Array.isArray(role) ? role : [role]}
      fallback={fallback}
      onUnauthorized={onUnauthorized}
    >
      {children}
    </AuthGuard>
  )
}

export function RequirePermission({ 
  children, 
  permission,
  fallback = null,
  onUnauthorized
}: { 
  children: React.ReactNode
  permission: string | string[]
  fallback?: React.ReactNode
  onUnauthorized?: () => void 
}) {
  return (
    <AuthGuard 
      require="authenticated"
      permissions={Array.isArray(permission) ? permission : [permission]}
      fallback={fallback}
      onUnauthorized={onUnauthorized}
    >
      {children}
    </AuthGuard>
  )
}

export function RequireMFA({ 
  children, 
  fallback = null,
  onUnauthorized
}: { 
  children: React.ReactNode
  fallback?: React.ReactNode
  onUnauthorized?: () => void 
}) {
  return (
    <AuthGuard 
      require="mfa" 
      fallback={fallback}
      onUnauthorized={onUnauthorized}
    >
      {children}
    </AuthGuard>
  )
}

// Higher-order component version
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<AuthGuardProps, 'children'> = {}
) {
  return function AuthenticatedComponent(props: P) {
    return (
      <AuthGuard {...options}>
        <Component {...props} />
      </AuthGuard>
    )
  }
}

// Hook for checking auth status
export function useAuthGuard() {
  const { user, isAuthenticated, isLoading, mfaRequired } = useAuth()
  
  return {
    isAuthenticated,
    isLoading,
    user,
    mfaRequired,
    
    // Permission helpers
    hasRole: (role: string) => hasRole(user, role),
    hasPermission: (permission: string) => hasPermission(user, permission),
    hasAnyRole: (roles: string[]) => roles.some(role => hasRole(user, role)),
    hasAllPermissions: (permissions: string[]) => permissions.every(permission => hasPermission(user, permission)),
    hasAnyPermission: (permissions: string[]) => permissions.some(permission => hasPermission(user, permission)),
    
    // Status checks
    isVerified: user?.emailVerified || false,
    isAdmin: hasRole(user, 'admin'),
    isEnterprise: hasRole(user, 'enterprise'),
    isUser: hasRole(user, 'user'),
    isViewer: hasRole(user, 'viewer'),
    
    // MFA status
    hasMFA: user?.mfaEnabled || false,
    needsMFA: mfaRequired,
    
    // Utility functions
    can: (permission: string) => hasPermission(user, permission),
    cannot: (permission: string) => !hasPermission(user, permission),
    is: (role: string) => hasRole(user, role),
    isNot: (role: string) => !hasRole(user, role)
  }
}

export default AuthGuard