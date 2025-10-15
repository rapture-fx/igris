/**
 * Protected Route Component
 * Handles authentication and authorization for protected pages
 */

'use client'

import React, { useEffect, useState } from 'react'
import { Shield, Lock, AlertTriangle, Loader2, Eye } from 'lucide-react'
import type { ProtectedRouteProps, User, AuthError } from '@schlep-engine/types/auth'
import { useAuth } from './AuthContext'

interface LoadingState {
  message: string
  submessage?: string
}

const LOADING_STATES: Record<string, LoadingState> = {
  checking: {
    message: 'Checking authentication...',
    submessage: 'Please wait while we verify your session'
  },
  loading: {
    message: 'Loading...',
    submessage: 'Preparing your dashboard'
  },
  redirecting: {
    message: 'Redirecting...',
    submessage: 'Taking you to the login page'
  }
}

function LoadingScreen({ state = 'loading' }: { state?: keyof typeof LOADING_STATES }) {
  const loadingState = LOADING_STATES[state]
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mb-4">
          <Loader2 className="animate-spin h-12 w-12 text-blue-600 mx-auto" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          {loadingState.message}
        </h2>
        {loadingState.submessage && (
          <p className="text-sm text-gray-600">
            {loadingState.submessage}
          </p>
        )}
      </div>
    </div>
  )
}

function UnauthorizedScreen({ 
  type, 
  requiredRole, 
  requiredPermissions, 
  onRetry 
}: { 
  type: 'unauthenticated' | 'insufficient_permissions' | 'unverified'
  requiredRole?: string[]
  requiredPermissions?: string[]
  onRetry?: () => void
}) {
  const getContent = () => {
    switch (type) {
      case 'unauthenticated':
        return {
          icon: <Lock className="h-12 w-12 text-red-500" />,
          title: 'Authentication Required',
          message: 'You need to sign in to access this page.',
          action: (
            <button
              onClick={() => window.location.href = '/login'}
              className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              Sign In
            </button>
          )
        }
      
      case 'insufficient_permissions':
        return {
          icon: <Shield className="h-12 w-12 text-orange-500" />,
          title: 'Insufficient Permissions',
          message: 'You don\'t have permission to access this page.',
          details: (
            <div className="mt-4 text-sm text-gray-600">
              {requiredRole && (
                <p>Required role: <span className="font-semibold">{requiredRole.join(' or ')}</span></p>
              )}
              {requiredPermissions && (
                <p>Required permissions: <span className="font-semibold">{requiredPermissions.join(', ')}</span></p>
              )}
            </div>
          ),
          action: (
            <div className="space-x-3">
              <button
                onClick={() => window.history.back()}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Go Back
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Go Home
              </button>
            </div>
          )
        }
      
      case 'unverified':
        return {
          icon: <Eye className="h-12 w-12 text-yellow-500" />,
          title: 'Email Verification Required',
          message: 'Please verify your email address to access this page.',
          action: (
            <div className="space-x-3">
              <button
                onClick={onRetry}
                className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              >
                Resend Verification
              </button>
              <button
                onClick={() => window.location.href = '/profile'}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Go to Profile
              </button>
            </div>
          )
        }
    }
  }

  const content = getContent()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-4">
            {content.icon}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {content.title}
          </h1>
          <p className="text-gray-600 mb-6">
            {content.message}
          </p>
          {content.details}
          <div className="mt-6">
            {content.action}
          </div>
        </div>
      </div>
    </div>
  )
}

function ErrorScreen({ error, onRetry }: { error: AuthError; onRetry: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-4">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Authentication Error
          </h1>
          <p className="text-gray-600 mb-4">
            {error.message}
          </p>
          {error.code && (
            <p className="text-xs text-gray-500 mb-6">
              Error Code: {error.code}
            </p>
          )}
          <div className="space-x-3">
            <button
              onClick={onRetry}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Retry
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ProtectedRoute({
  children,
  requiredRole,
  requiredPermissions,
  fallback,
  redirectTo = '/login'
}: ProtectedRouteProps) {
  const { 
    user, 
    isAuthenticated, 
    isLoading, 
    error,
    resendVerificationEmail
  } = useAuth()
  
  const [localLoading, setLocalLoading] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  // Check user permissions
  const hasRequiredRole = (user: User, roles?: string[]): boolean => {
    if (!roles || roles.length === 0) return true
    return roles.includes(user.role)
  }

  const hasRequiredPermissions = (user: User, permissions?: string[]): boolean => {
    if (!permissions || permissions.length === 0) return true
    
    // Get user permissions based on role
    const userPermissions = getUserPermissions(user)
    return permissions.every(permission => userPermissions.includes(permission))
  }

  // Handle verification email resend
  const handleResendVerification = async () => {
    setLocalLoading(true)
    try {
      await resendVerificationEmail()
      // Show success message or redirect
    } catch (err) {
      console.error('Failed to resend verification email:', err)
    } finally {
      setLocalLoading(false)
    }
  }

  // Handle retry
  const handleRetry = () => {
    setRetryCount(prev => prev + 1)
    window.location.reload()
  }

  // Auto-redirect for unauthenticated users
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !error) {
      const timer = setTimeout(() => {
        if (redirectTo.startsWith('http')) {
          window.location.href = redirectTo
        } else {
          window.location.href = `${redirectTo}?redirect=${encodeURIComponent(window.location.pathname)}`
        }
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [isLoading, isAuthenticated, error, redirectTo])

  // Show loading screen
  if (isLoading || localLoading) {
    if (fallback) return <>{fallback}</>
    return <LoadingScreen state={isAuthenticated ? 'loading' : 'checking'} />
  }

  // Show error screen
  if (error) {
    if (fallback) return <>{fallback}</>
    return <ErrorScreen error={error} onRetry={handleRetry} />
  }

  // Check authentication
  if (!isAuthenticated) {
    if (fallback) return <>{fallback}</>
    return <UnauthorizedScreen type="unauthenticated" />
  }

  // Check email verification
  if (user && !user.emailVerified) {
    if (fallback) return <>{fallback}</>
    return (
      <UnauthorizedScreen 
        type="unverified" 
        onRetry={handleResendVerification}
      />
    )
  }

  // Check role permissions
  if (user && !hasRequiredRole(user, requiredRole)) {
    if (fallback) return <>{fallback}</>
    return (
      <UnauthorizedScreen 
        type="insufficient_permissions"
        requiredRole={requiredRole}
      />
    )
  }

  // Check specific permissions
  if (user && !hasRequiredPermissions(user, requiredPermissions)) {
    if (fallback) return <>{fallback}</>
    return (
      <UnauthorizedScreen 
        type="insufficient_permissions"
        requiredPermissions={requiredPermissions}
      />
    )
  }

  // All checks passed, render children
  return <>{children}</>
}

// Helper function to get user permissions
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

export default ProtectedRoute