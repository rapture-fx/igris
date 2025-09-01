'use client'

/**
 * Enhanced Authentication Context for FastAPI Backend Integration
 * Now using the comprehensive authentication system from @schlep-engine/ui
 */

import React from 'react'
import { AuthProvider, useAuth as useEnhancedAuth } from '@schlep-engine/ui/auth'
import type { User } from '@schlep-engine/types/auth'

// Configuration for the enhanced auth system
const authConfig = {
  autoRefresh: true,
  refreshThreshold: 5, // Minutes before expiry to refresh
  sessionTimeout: 30, // Minutes of inactivity before logout
  persistSession: true
}

// Enhanced AuthProvider wrapper that configures the API client
export function EnhancedAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider config={authConfig}>
      {children}
    </AuthProvider>
  )
}

// Compatibility wrapper for existing components
export function LegacyAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <EnhancedAuthProvider>
      {children}
    </EnhancedAuthProvider>
  )
}

// Enhanced useAuth hook with backward compatibility
export function useAuth() {
  const enhancedAuth = useEnhancedAuth()
  
  return {
    // Core state
    user: enhancedAuth.user,
    loading: enhancedAuth.isLoading,
    isAuthenticated: enhancedAuth.isAuthenticated,
    error: enhancedAuth.error,
    
    // Legacy compatibility methods
    signIn: async (email: string, password: string) => {
      try {
        await enhancedAuth.login({ email, password })
        return { error: null }
      } catch (error: any) {
        return { error: error.message || 'Login failed' }
      }
    },
    
    signUp: async (email: string, password: string, username: string, firstName?: string, lastName?: string) => {
      try {
        await enhancedAuth.register({
          email,
          password,
          name: firstName && lastName ? `${firstName} ${lastName}` : username,
          username,
          firstName,
          lastName
        })
        return { error: null }
      } catch (error: any) {
        return { error: error.message || 'Registration failed' }
      }
    },
    
    signOut: async () => {
      try {
        await enhancedAuth.logout()
        return { error: null }
      } catch (error: any) {
        return { error: error.message || 'Logout failed' }
      }
    },
    
    refreshUser: async () => {
      // This is handled automatically by the enhanced auth system
      return
    },
    
    // Enhanced methods
    ...enhancedAuth
  }
}

// Export the enhanced AuthProvider as the default
export { EnhancedAuthProvider as AuthProvider }

// Re-export enhanced components for easy access
export { ProtectedRoute, AuthGuard, RequireAuth, RequireRole } from '@schlep-engine/ui/auth'