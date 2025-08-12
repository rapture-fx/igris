'use client'

/**
 * Authentication Context for FastAPI Backend Integration
 * Provides user authentication state and functions
 */

import React, { createContext, useContext, useEffect, useState } from 'react'
import Cookies from 'js-cookie'
import { authApi, type User, type LoginRequest, type RegisterRequest } from '@/lib/api'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, username: string, firstName?: string, lastName?: string) => Promise<{ error: string | null }>
  signOut: () => Promise<{ error: string | null }>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    const token = Cookies.get('auth_token')
    if (token) {
      try {
        const userData = await authApi.getCurrentUser()
        setUser(userData)
      } catch (error) {
        console.error('Error fetching user:', error)
        // Clear invalid token
        Cookies.remove('auth_token')
        Cookies.remove('refresh_token')
        setUser(null)
      }
    }
  }

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = Cookies.get('auth_token')
        if (token) {
          await refreshUser()
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      const response = await authApi.login({ email, password })
      
      // Store tokens
      Cookies.set('auth_token', response.access_token, { expires: 7 })
      Cookies.set('refresh_token', response.refresh_token, { expires: 30 })
      
      // Set user
      setUser(response.user)
      
      return { error: null }
    } catch (error: any) {
      console.error('Sign in error:', error)
      return { error: error.response?.data?.detail || 'Login failed' }
    }
  }

  const signUp = async (email: string, password: string, username: string, firstName?: string, lastName?: string) => {
    try {
      const response = await authApi.register({
        email,
        password,
        username,
        first_name: firstName,
        last_name: lastName,
      })
      
      // Store tokens
      Cookies.set('auth_token', response.access_token, { expires: 7 })
      Cookies.set('refresh_token', response.refresh_token, { expires: 30 })
      
      // Set user
      setUser(response.user)
      
      return { error: null }
    } catch (error: any) {
      console.error('Sign up error:', error)
      return { error: error.response?.data?.detail || 'Registration failed' }
    }
  }

  const signOut = async () => {
    try {
      await authApi.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Always clear local state
      Cookies.remove('auth_token')
      Cookies.remove('refresh_token')
      setUser(null)
    }
    
    return { error: null }
  }

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    refreshUser
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Protected route wrapper
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please sign in</h1>
          <p className="text-gray-600">You need to be authenticated to access this page.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}