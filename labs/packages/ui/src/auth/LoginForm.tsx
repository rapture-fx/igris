import React, { useState, useCallback, useEffect } from 'react'
import { Eye, EyeOff, Github, Mail, AlertTriangle, Shield, Loader2 } from 'lucide-react'
import type { 
  AuthCredentials, 
  AuthError, 
  OAuthProvider,
  LoginFormProps,
  PasswordStrength 
} from '@igris-inertial/types/auth'
import { checkPasswordStrength } from './AuthAPI'

interface ValidationErrors {
  email?: string[]
  password?: string[]
  general?: string[]
}

interface FormState {
  email: string
  password: string
  rememberMe: boolean
  showPassword: boolean
  isSubmitting: boolean
  errors: ValidationErrors
  touched: {
    email: boolean
    password: boolean
  }
  attemptCount: number
  isBlocked: boolean
  blockExpiresAt?: number
}

export function LoginForm({
  onSubmit,
  onOAuthLogin,
  onForgotPassword,
  isLoading = false,
  error,
  showRememberMe = true,
  showOAuth = true,
  oauthProviders = [],
  redirectTo
}: LoginFormProps) {
  const [formState, setFormState] = useState<FormState>({
    email: '',
    password: '',
    rememberMe: false,
    showPassword: false,
    isSubmitting: false,
    errors: {},
    touched: {
      email: false,
      password: false
    },
    attemptCount: 0,
    isBlocked: false
  })

  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null)
  const [blockCountdown, setBlockCountdown] = useState<number>(0)

  // Update form field
  const updateField = useCallback((field: keyof FormState, value: any) => {
    setFormState(prev => ({ ...prev, [field]: value }))
  }, [])

  // Update nested field
  const updateNestedField = useCallback((parent: keyof FormState, field: string, value: any) => {
    setFormState(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent] as any,
        [field]: value
      }
    }))
  }, [])

  // Field validation
  const validateField = useCallback((field: 'email' | 'password', value: string): string[] => {
    const errors: string[] = []
    
    switch (field) {
      case 'email':
        if (!value.trim()) {
          errors.push('Email is required')
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors.push('Please enter a valid email address')
        }
        break
      
      case 'password':
        if (!value) {
          errors.push('Password is required')
        } else if (value.length < 6) {
          errors.push('Password must be at least 6 characters')
        }
        break
    }
    
    return errors
  }, [])

  // Handle field change with validation
  const handleFieldChange = useCallback((field: 'email' | 'password', value: string) => {
    updateField(field, value)
    
    // Validate field if it has been touched
    if (formState.touched[field]) {
      const fieldErrors = validateField(field, value)
      updateNestedField('errors', field, fieldErrors.length > 0 ? fieldErrors : undefined)
    }

    // Update password strength
    if (field === 'password' && value) {
      setPasswordStrength(checkPasswordStrength(value))
    } else if (field === 'password') {
      setPasswordStrength(null)
    }
  }, [formState.touched, validateField, updateField, updateNestedField])

  // Handle field blur (mark as touched)
  const handleFieldBlur = useCallback((field: 'email' | 'password') => {
    updateNestedField('touched', field, true)
    
    // Validate the field
    const value = formState[field] as string
    const fieldErrors = validateField(field, value)
    updateNestedField('errors', field, fieldErrors.length > 0 ? fieldErrors : undefined)
  }, [formState, validateField, updateNestedField])

  // Validate entire form
  const validateForm = useCallback((): boolean => {
    const emailErrors = validateField('email', formState.email)
    const passwordErrors = validateField('password', formState.password)
    
    const newErrors: ValidationErrors = {}
    if (emailErrors.length > 0) newErrors.email = emailErrors
    if (passwordErrors.length > 0) newErrors.password = passwordErrors
    
    updateField('errors', newErrors)
    updateField('touched', { email: true, password: true })
    
    return Object.keys(newErrors).length === 0
  }, [formState.email, formState.password, validateField, updateField])

  // Handle rate limiting/blocking
  const handleRateLimiting = useCallback((error: AuthError) => {
    if (error.code === 'RATE_LIMITED' || error.code === 'TOO_MANY_ATTEMPTS') {
      const newAttemptCount = formState.attemptCount + 1
      updateField('attemptCount', newAttemptCount)
      
      // Block after 5 failed attempts
      if (newAttemptCount >= 5) {
        const blockDuration = Math.min(Math.pow(2, newAttemptCount - 5) * 60, 3600) // Exponential backoff, max 1 hour
        const blockExpiresAt = Date.now() + blockDuration * 1000
        
        updateField('isBlocked', true)
        updateField('blockExpiresAt', blockExpiresAt)
        setBlockCountdown(blockDuration)
        
        // Start countdown timer
        const countdownInterval = setInterval(() => {
          const remaining = Math.max(0, Math.floor((blockExpiresAt - Date.now()) / 1000))
          setBlockCountdown(remaining)
          
          if (remaining <= 0) {
            updateField('isBlocked', false)
            updateField('blockExpiresAt', undefined)
            clearInterval(countdownInterval)
          }
        }, 1000)
      }
    }
  }, [formState.attemptCount, updateField])

  // Reset attempt count on successful validation
  useEffect(() => {
    if (Object.keys(formState.errors).length === 0 && formState.attemptCount > 0) {
      updateField('attemptCount', 0)
    }
  }, [formState.errors, formState.attemptCount, updateField])

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Check if form is blocked
    if (formState.isBlocked) {
      return
    }
    
    // Validate form
    if (!validateForm()) {
      return
    }
    
    updateField('isSubmitting', true)
    updateNestedField('errors', 'general', undefined)
    
    try {
      const credentials: AuthCredentials = {
        email: formState.email.trim(),
        password: formState.password
      }
      
      await onSubmit(credentials)
      
      // Reset form on success
      updateField('attemptCount', 0)
      updateField('isBlocked', false)
      
    } catch (err) {
      const authError = err as AuthError
      
      // Handle specific error types
      if (authError.code === 'INVALID_CREDENTIALS') {
        updateNestedField('errors', 'general', ['Invalid email or password'])
      } else if (authError.code === 'ACCOUNT_LOCKED') {
        updateNestedField('errors', 'general', ['Account is temporarily locked. Please try again later.'])
      } else if (authError.code === 'EMAIL_NOT_VERIFIED') {
        updateNestedField('errors', 'general', ['Please verify your email address before signing in.'])
      } else {
        updateNestedField('errors', 'general', [authError.message || 'Login failed. Please try again.'])
      }
      
      // Handle rate limiting
      handleRateLimiting(authError)
      
    } finally {
      updateField('isSubmitting', false)
    }
  }, [formState, validateForm, onSubmit, handleRateLimiting, updateField, updateNestedField])

  // Handle OAuth login
  const handleOAuthLogin = useCallback(async (provider: string) => {
    if (formState.isSubmitting || formState.isBlocked) return
    
    try {
      await onOAuthLogin(provider)
    } catch (error) {
      console.error('OAuth login error:', error)
      updateNestedField('errors', 'general', ['OAuth login failed. Please try again.'])
    }
  }, [formState.isSubmitting, formState.isBlocked, onOAuthLogin, updateNestedField])

  // Format block countdown time
  const formatCountdown = useCallback((seconds: number): string => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }, [])

  const hasErrors = Object.keys(formState.errors).length > 0
  const isFormDisabled = isLoading || formState.isSubmitting || formState.isBlocked
  const canSubmit = formState.email && formState.password && !hasErrors && !isFormDisabled

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Security Notice */}
      {formState.isBlocked && (
        <div className="mb-6 rounded-md bg-yellow-50 border border-yellow-200 p-4">
          <div className="flex items-center">
            <Shield className="h-5 w-5 text-yellow-600 mr-2" />
            <div className="text-sm text-yellow-800">
              <strong>Account temporarily locked</strong>
              <p className="mt-1">
                Too many failed login attempts. Please wait {formatCountdown(blockCountdown)} before trying again.
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Email Input */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            type="email"
            value={formState.email}
            onChange={(e) => handleFieldChange('email', e.target.value)}
            onBlur={() => handleFieldBlur('email')}
            className={`w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 ${
              formState.errors.email 
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                : 'border-gray-300'
            }`}
            placeholder="Enter your email address"
            disabled={isFormDisabled}
            autoComplete="email"
            aria-describedby={formState.errors.email ? 'email-error' : undefined}
            aria-invalid={!!formState.errors.email}
          />
          {formState.errors.email && (
            <div id="email-error" className="mt-1 text-sm text-red-600">
              {formState.errors.email.map((error, index) => (
                <div key={index} className="flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  {error}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Password Input */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password <span className="text-red-500">*</span>
            </label>
            {onForgotPassword && (
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-sm text-blue-600 hover:text-blue-500 focus:outline-none focus:underline"
                disabled={isFormDisabled}
              >
                Forgot password?
              </button>
            )}
          </div>
          <div className="relative">
            <input
              id="password"
              type={formState.showPassword ? 'text' : 'password'}
              value={formState.password}
              onChange={(e) => handleFieldChange('password', e.target.value)}
              onBlur={() => handleFieldBlur('password')}
              className={`w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10 disabled:bg-gray-50 disabled:text-gray-500 ${
                formState.errors.password 
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                  : 'border-gray-300'
              }`}
              placeholder="Enter your password"
              disabled={isFormDisabled}
              autoComplete="current-password"
              aria-describedby={formState.errors.password ? 'password-error' : undefined}
              aria-invalid={!!formState.errors.password}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center focus:outline-none"
              onClick={() => updateField('showPassword', !formState.showPassword)}
              disabled={isFormDisabled}
              aria-label={formState.showPassword ? 'Hide password' : 'Show password'}
            >
              {formState.showPassword ? (
                <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              ) : (
                <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              )}
            </button>
          </div>
          {formState.errors.password && (
            <div id="password-error" className="mt-1 text-sm text-red-600">
              {formState.errors.password.map((error, index) => (
                <div key={index} className="flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  {error}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Remember Me */}
        {showRememberMe && (
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                checked={formState.rememberMe}
                onChange={(e) => updateField('rememberMe', e.target.checked)}
                disabled={isFormDisabled}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                Remember me for 30 days
              </label>
            </div>
          </div>
        )}

        {/* General Error Messages */}
        {(error || formState.errors.general) && (
          <div className="rounded-md bg-red-50 border border-red-200 p-4">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-sm text-red-700">
                {formState.errors.general?.map((error, index) => (
                  <div key={index}>{error}</div>
                )) || error?.message || 'An error occurred. Please try again.'}
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!canSubmit}
          className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:cursor-not-allowed transition-colors ${
            canSubmit
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-gray-400'
          }`}
          aria-describedby="submit-button-help"
        >
          {formState.isSubmitting ? (
            <>
              <Loader2 className="animate-spin h-4 w-4 mr-2" />
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </button>
        
        {!canSubmit && !formState.isBlocked && (
          <div id="submit-button-help" className="text-xs text-gray-500 text-center mt-1">
            Please fill in all required fields to continue
          </div>
        )}
      </form>

      {/* OAuth Providers */}
      {showOAuth && oauthProviders.length > 0 && (
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {oauthProviders.map((provider) => {
              if (!provider.enabled) return null
              
              return (
                <button
                  key={provider.name}
                  onClick={() => handleOAuthLogin(provider.name)}
                  disabled={isFormDisabled}
                  className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label={`Continue with ${provider.displayName}`}
                >
                  {provider.name === 'google' && (
                    <Mail className="h-5 w-5 text-red-500 mr-2" />
                  )}
                  {provider.name === 'github' && (
                    <Github className="h-5 w-5 text-gray-900 mr-2" />
                  )}
                  {provider.name === 'discord' && (
                    <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="#5865F2">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                  )}
                  Continue with {provider.displayName}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default LoginForm