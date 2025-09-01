'use client'

import React, { createContext, useContext, useEffect, useReducer, ReactNode } from 'react'
import { User, AuthResponse } from '@schlep-engine/types/backend-integration'
import { authAPI } from '../lib/api'
import Cookies from 'js-cookie'

// Auth State Types
interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  isInitialized: boolean
  sessionExpiry: number | null
}

type AuthAction =
  | { type: 'AUTH_INIT_START' }
  | { type: 'AUTH_INIT_SUCCESS'; payload: { user: User; sessionExpiry?: number } }
  | { type: 'AUTH_INIT_FAILURE'; payload: string }
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; sessionExpiry?: number } }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: Partial<User> }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SESSION_EXPIRED' }

// Auth Context Interface
interface AuthContextType {
  // State
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  isInitialized: boolean
  sessionExpiry: number | null

  // Actions
  login: (email: string, password: string) => Promise<void>
  loginWithOAuth: (provider: 'google' | 'github' | 'discord') => Promise<void>
  register: (userData: { email: string; password: string; name: string }) => Promise<void>
  logout: () => Promise<void>
  refreshAuth: () => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  clearError: () => void

  // Utilities
  hasRole: (role: string) => boolean
  hasPermission: (permission: string) => boolean
  isSessionValid: () => boolean
}

// Initial State
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  isInitialized: false,
  sessionExpiry: null,
}

// Auth Reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_INIT_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      }

    case 'AUTH_INIT_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
        sessionExpiry: action.payload.sessionExpiry || null,
        error: null,
      }

    case 'AUTH_INIT_FAILURE':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
        error: action.payload,
      }

    case 'LOGIN_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      }

    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        isLoading: false,
        sessionExpiry: action.payload.sessionExpiry || null,
        error: null,
      }

    case 'LOGIN_FAILURE':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      }

    case 'LOGOUT':
      return {
        ...initialState,
        isLoading: false,
        isInitialized: true,
      }

    case 'UPDATE_USER':
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null,
      }

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      }

    case 'SESSION_EXPIRED':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        error: 'Your session has expired. Please login again.',
      }

    default:
      return state
  }
}

// Create Auth Context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Auth Provider Props
interface AuthProviderProps {
  children: ReactNode
}

// Token Storage Utilities
const TOKEN_KEY = 'auth_token'
const REFRESH_TOKEN_KEY = 'refresh_token'
const USER_KEY = 'user_data'

const tokenStorage = {
  getToken: () => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(TOKEN_KEY) || Cookies.get(TOKEN_KEY) || null
  },

  setToken: (token: string) => {
    if (typeof window === 'undefined') return
    localStorage.setItem(TOKEN_KEY, token)
    Cookies.set(TOKEN_KEY, token, { expires: 7, secure: true, sameSite: 'strict' })
  },

  getRefreshToken: () => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(REFRESH_TOKEN_KEY) || Cookies.get(REFRESH_TOKEN_KEY) || null
  },

  setRefreshToken: (token: string) => {
    if (typeof window === 'undefined') return
    localStorage.setItem(REFRESH_TOKEN_KEY, token)
    Cookies.set(REFRESH_TOKEN_KEY, token, { expires: 30, secure: true, sameSite: 'strict' })
  },

  getUserData: (): User | null => {
    if (typeof window === 'undefined') return null
    const userData = localStorage.getItem(USER_KEY)
    try {
      return userData ? JSON.parse(userData) : null
    } catch {
      return null
    }
  },

  setUserData: (user: User) => {
    if (typeof window === 'undefined') return
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },

  clearAll: () => {
    if (typeof window === 'undefined') return
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    Cookies.remove(TOKEN_KEY)
    Cookies.remove(REFRESH_TOKEN_KEY)
  },
}

// Auth Provider Component
export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Initialize auth on app start
  useEffect(() => {
    initializeAuth()
  }, [])

  // Session expiry checker
  useEffect(() => {
    if (state.sessionExpiry) {
      const checkExpiry = () => {
        if (Date.now() >= state.sessionExpiry!) {
          dispatch({ type: 'SESSION_EXPIRED' })
          tokenStorage.clearAll()
        }
      }

      const interval = setInterval(checkExpiry, 60000) // Check every minute
      return () => clearInterval(interval)
    }
  }, [state.sessionExpiry])

  // Global auth error handler
  useEffect(() => {
    const handleAuthError = () => {
      dispatch({ type: 'SESSION_EXPIRED' })
      tokenStorage.clearAll()
    }

    window.addEventListener('auth:unauthorized', handleAuthError)
    return () => window.removeEventListener('auth:unauthorized', handleAuthError)
  }, [])

  const initializeAuth = async () => {
    dispatch({ type: 'AUTH_INIT_START' })

    try {
      const token = tokenStorage.getToken()
      const userData = tokenStorage.getUserData()

      if (token && userData) {
        // Validate token with backend
        const user = await authAPI.getProfile()
        dispatch({ 
          type: 'AUTH_INIT_SUCCESS', 
          payload: { user } 
        })
      } else {
        dispatch({ 
          type: 'AUTH_INIT_FAILURE', 
          payload: 'No valid session found' 
        })
      }
    } catch (error: any) {
      tokenStorage.clearAll()
      dispatch({ 
        type: 'AUTH_INIT_FAILURE', 
        payload: error.response?.data?.message || 'Authentication initialization failed' 
      })
    }
  }

  const login = async (email: string, password: string) => {
    dispatch({ type: 'LOGIN_START' })

    try {
      const response = await authAPI.login({ email, password })
      
      // Store tokens and user data
      tokenStorage.setToken(response.accessToken)
      if (response.refreshToken) {
        tokenStorage.setRefreshToken(response.refreshToken)
      }
      tokenStorage.setUserData(response.user)

      const sessionExpiry = response.expiresIn 
        ? Date.now() + (response.expiresIn * 1000) 
        : null

      dispatch({ 
        type: 'LOGIN_SUCCESS', 
        payload: { user: response.user, sessionExpiry } 
      })
    } catch (error: any) {
      dispatch({ 
        type: 'LOGIN_FAILURE', 
        payload: error.response?.data?.message || 'Login failed' 
      })
      throw error
    }
  }

  const loginWithOAuth = async (provider: 'google' | 'github' | 'discord') => {
    try {
      const { data } = await authAPI.getOAuthUrl(provider)
      window.location.href = data.url
    } catch (error: any) {
      dispatch({ 
        type: 'LOGIN_FAILURE', 
        payload: error.response?.data?.message || `OAuth login with ${provider} failed` 
      })
      throw error
    }
  }

  const register = async (userData: { email: string; password: string; name: string }) => {
    dispatch({ type: 'LOGIN_START' })

    try {
      const response = await authAPI.register(userData)
      
      tokenStorage.setToken(response.accessToken)
      if (response.refreshToken) {
        tokenStorage.setRefreshToken(response.refreshToken)
      }
      tokenStorage.setUserData(response.user)

      const sessionExpiry = response.expiresIn 
        ? Date.now() + (response.expiresIn * 1000) 
        : null

      dispatch({ 
        type: 'LOGIN_SUCCESS', 
        payload: { user: response.user, sessionExpiry } 
      })
    } catch (error: any) {
      dispatch({ 
        type: 'LOGIN_FAILURE', 
        payload: error.response?.data?.message || 'Registration failed' 
      })
      throw error
    }
  }

  const logout = async () => {
    try {
      await authAPI.logout()
    } catch (error) {
      console.error('Logout API call failed:', error)
    } finally {
      tokenStorage.clearAll()
      dispatch({ type: 'LOGOUT' })
    }
  }

  const refreshAuth = async () => {
    try {
      const refreshToken = tokenStorage.getRefreshToken()
      if (!refreshToken) throw new Error('No refresh token available')

      const response = await authAPI.refreshToken()
      
      tokenStorage.setToken(response.accessToken)
      if (response.refreshToken) {
        tokenStorage.setRefreshToken(response.refreshToken)
      }
      tokenStorage.setUserData(response.user)

      const sessionExpiry = response.expiresIn 
        ? Date.now() + (response.expiresIn * 1000) 
        : null

      dispatch({ 
        type: 'LOGIN_SUCCESS', 
        payload: { user: response.user, sessionExpiry } 
      })
    } catch (error) {
      tokenStorage.clearAll()
      dispatch({ type: 'LOGOUT' })
      throw error
    }
  }

  const updateProfile = async (data: Partial<User>) => {
    try {
      const updatedUser = await authAPI.updateProfile(data)
      tokenStorage.setUserData(updatedUser)
      dispatch({ type: 'UPDATE_USER', payload: updatedUser })
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Profile update failed')
    }
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      await authAPI.changePassword(currentPassword, newPassword)
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Password change failed')
    }
  }

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' })
  }

  const hasRole = (role: string): boolean => {
    return state.user?.role === role
  }

  const hasPermission = (permission: string): boolean => {
    // Implement permission logic based on user role and permissions
    if (!state.user) return false
    
    // Admin has all permissions
    if (state.user.role === 'admin') return true
    
    // Add specific permission checks here
    // This would typically check against a permissions array on the user object
    return false
  }

  const isSessionValid = (): boolean => {
    if (!state.isAuthenticated) return false
    if (!state.sessionExpiry) return true
    return Date.now() < state.sessionExpiry
  }

  const contextValue: AuthContextType = {
    // State
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    isInitialized: state.isInitialized,
    sessionExpiry: state.sessionExpiry,

    // Actions
    login,
    loginWithOAuth,
    register,
    logout,
    refreshAuth,
    updateProfile,
    changePassword,
    clearError,

    // Utilities
    hasRole,
    hasPermission,
    isSessionValid,
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Higher-order component for protected routes
export function withAuth<T extends {}>(Component: React.ComponentType<T>) {
  return function AuthenticatedComponent(props: T) {
    const { isAuthenticated, isLoading, isInitialized } = useAuth()

    if (!isInitialized || isLoading) {
      return <div>Loading...</div> // Replace with proper loading component
    }

    if (!isAuthenticated) {
      // Redirect to login page
      window.location.href = '/auth/signin'
      return null
    }

    return <Component {...props} />
  }
}

// Hook for role-based rendering
export function useRoleCheck() {
  const { hasRole, hasPermission, user } = useAuth()

  return {
    hasRole,
    hasPermission,
    isAdmin: hasRole('admin'),
    isUser: hasRole('user'),
    isEnterprise: hasRole('enterprise'),
    user,
  }
}

export default AuthContext