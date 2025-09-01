/**
 * Enhanced Registration Form with Real-time Validation and Security Features
 * Supports comprehensive user registration with password strength checking and OAuth
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { 
  Eye, 
  EyeOff, 
  Github, 
  Mail, 
  AlertTriangle, 
  CheckCircle, 
  Shield,
  Loader2,
  User,
  Building,
  Check,
  X
} from 'lucide-react'
import type { 
  RegisterData, 
  AuthError, 
  OAuthProvider,
  RegisterFormProps,
  PasswordStrength 
} from '@schlep-engine/types/auth'
import { checkPasswordStrength } from './AuthAPI'

interface ValidationErrors {
  email?: string[]
  password?: string[]
  confirmPassword?: string[]
  name?: string[]
  username?: string[]
  company?: string[]
  general?: string[]
}

interface FormState {
  email: string
  password: string
  confirmPassword: string
  name: string
  username: string
  firstName: string
  lastName: string
  company: string
  acceptTerms: boolean
  acceptNewsletter: boolean
  showPassword: boolean
  showConfirmPassword: boolean
  isSubmitting: boolean
  errors: ValidationErrors
  touched: {
    email: boolean
    password: boolean
    confirmPassword: boolean
    name: boolean
    username: boolean
    company: boolean
  }
}

interface PasswordRequirement {
  key: string
  label: string
  met: boolean
}

export function RegisterForm({
  onSubmit,
  onOAuthLogin,
  onLoginRedirect,
  isLoading = false,
  error,
  showOAuth = true,
  oauthProviders = [],
  requireTermsAcceptance = true,
  redirectTo
}: RegisterFormProps) {
  const [formState, setFormState] = useState<FormState>({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    username: '',
    firstName: '',
    lastName: '',
    company: '',
    acceptTerms: false,
    acceptNewsletter: false,
    showPassword: false,
    showConfirmPassword: false,
    isSubmitting: false,
    errors: {},
    touched: {
      email: false,
      password: false,
      confirmPassword: false,
      name: false,
      username: false,
      company: false
    }
  })

  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)

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
  const validateField = useCallback((field: string, value: string): string[] => {
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
        } else {
          const strength = checkPasswordStrength(value)
          if (strength.score < 3) {
            errors.push('Password is too weak')
          }
        }
        break

      case 'confirmPassword':
        if (!value) {
          errors.push('Please confirm your password')
        } else if (value !== formState.password) {
          errors.push('Passwords do not match')
        }
        break
      
      case 'name':
        if (!value.trim()) {
          errors.push('Full name is required')
        } else if (value.trim().length < 2) {
          errors.push('Name must be at least 2 characters')
        } else if (!/^[a-zA-Z\s'-]+$/.test(value)) {
          errors.push('Name can only contain letters, spaces, hyphens, and apostrophes')
        }
        break

      case 'username':
        if (value && value.length < 3) {
          errors.push('Username must be at least 3 characters')
        } else if (value && !/^[a-zA-Z0-9_-]+$/.test(value)) {
          errors.push('Username can only contain letters, numbers, hyphens, and underscores')
        }
        break

      case 'company':
        if (value && value.length < 2) {
          errors.push('Company name must be at least 2 characters')
        }
        break
    }
    
    return errors
  }, [formState.password])

  // Check username availability (simulated)
  const checkUsernameAvailability = useCallback(async (username: string) => {
    if (!username || username.length < 3) {
      setUsernameAvailable(null)
      return
    }

    setCheckingUsername(true)
    
    // Simulate API call
    try {
      await new Promise(resolve => setTimeout(resolve, 800))
      // Simulate some unavailable usernames
      const unavailableUsernames = ['admin', 'user', 'test', 'demo', 'api']
      const isAvailable = !unavailableUsernames.includes(username.toLowerCase())
      setUsernameAvailable(isAvailable)
    } catch {
      setUsernameAvailable(null)
    } finally {
      setCheckingUsername(false)
    }
  }, [])

  // Debounced username check
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formState.username && formState.touched.username) {
        checkUsernameAvailability(formState.username)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [formState.username, formState.touched.username, checkUsernameAvailability])

  // Handle field change with validation
  const handleFieldChange = useCallback((field: string, value: string) => {
    updateField(field as keyof FormState, value)
    
    // Auto-generate username from name if username is empty
    if (field === 'name' && !formState.username) {
      const generatedUsername = value
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 20)
      if (generatedUsername) {
        updateField('username', generatedUsername)
      }
    }

    // Split name into firstName and lastName
    if (field === 'name') {
      const nameParts = value.trim().split(' ')
      updateField('firstName', nameParts[0] || '')
      updateField('lastName', nameParts.slice(1).join(' ') || '')
    }
    
    // Validate field if it has been touched
    if (formState.touched[field as keyof typeof formState.touched]) {
      const fieldErrors = validateField(field, value)
      updateNestedField('errors', field, fieldErrors.length > 0 ? fieldErrors : undefined)
    }

    // Update password strength
    if (field === 'password') {
      if (value) {
        setPasswordStrength(checkPasswordStrength(value))
      } else {
        setPasswordStrength(null)
      }
      
      // Re-validate confirm password if it exists
      if (formState.confirmPassword && formState.touched.confirmPassword) {
        const confirmErrors = validateField('confirmPassword', formState.confirmPassword)
        updateNestedField('errors', 'confirmPassword', confirmErrors.length > 0 ? confirmErrors : undefined)
      }
    }

    // Validate confirm password
    if (field === 'confirmPassword') {
      const confirmErrors = validateField('confirmPassword', value)
      updateNestedField('errors', 'confirmPassword', confirmErrors.length > 0 ? confirmErrors : undefined)
    }
  }, [formState, validateField, updateField, updateNestedField])

  // Handle field blur (mark as touched)
  const handleFieldBlur = useCallback((field: string) => {
    updateNestedField('touched', field, true)
    
    // Validate the field
    const value = formState[field as keyof FormState] as string
    const fieldErrors = validateField(field, value)
    updateNestedField('errors', field, fieldErrors.length > 0 ? fieldErrors : undefined)
  }, [formState, validateField, updateNestedField])

  // Validate entire form
  const validateForm = useCallback((): boolean => {
    const fields = ['email', 'password', 'confirmPassword', 'name']
    if (formState.username) fields.push('username')
    if (formState.company) fields.push('company')
    
    const newErrors: ValidationErrors = {}
    let hasErrors = false
    
    fields.forEach(field => {
      const value = formState[field as keyof FormState] as string
      const fieldErrors = validateField(field, value)
      if (fieldErrors.length > 0) {
        newErrors[field as keyof ValidationErrors] = fieldErrors
        hasErrors = true
      }
    })

    // Check terms acceptance
    if (requireTermsAcceptance && !formState.acceptTerms) {
      newErrors.general = ['Please accept the Terms of Service and Privacy Policy']
      hasErrors = true
    }

    // Check username availability
    if (formState.username && usernameAvailable === false) {
      if (!newErrors.username) newErrors.username = []
      newErrors.username.push('This username is not available')
      hasErrors = true
    }
    
    updateField('errors', newErrors)
    
    // Mark all fields as touched
    const allTouched = Object.keys(formState.touched).reduce((acc, key) => {
      acc[key as keyof typeof formState.touched] = true
      return acc
    }, {} as typeof formState.touched)
    updateField('touched', allTouched)
    
    return !hasErrors
  }, [formState, validateField, requireTermsAcceptance, usernameAvailable, updateField])

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate form
    if (!validateForm()) {
      return
    }
    
    updateField('isSubmitting', true)
    updateNestedField('errors', 'general', undefined)
    
    try {
      const registerData: RegisterData = {
        email: formState.email.trim(),
        password: formState.password,
        name: formState.name.trim(),
        username: formState.username || undefined,
        firstName: formState.firstName || undefined,
        lastName: formState.lastName || undefined,
        company: formState.company || undefined
      }
      
      await onSubmit(registerData)
      
    } catch (err) {
      const authError = err as AuthError
      
      // Handle specific error types
      if (authError.code === 'EMAIL_ALREADY_EXISTS') {
        updateNestedField('errors', 'email', ['An account with this email already exists'])
      } else if (authError.code === 'USERNAME_TAKEN') {
        updateNestedField('errors', 'username', ['This username is already taken'])
      } else if (authError.code === 'WEAK_PASSWORD') {
        updateNestedField('errors', 'password', ['Password does not meet security requirements'])
      } else {
        updateNestedField('errors', 'general', [authError.message || 'Registration failed. Please try again.'])
      }
      
    } finally {
      updateField('isSubmitting', false)
    }
  }, [formState, validateForm, onSubmit, updateField, updateNestedField])

  // Handle OAuth login
  const handleOAuthLogin = useCallback(async (provider: string) => {
    if (formState.isSubmitting) return
    
    try {
      await onOAuthLogin(provider)
    } catch (error) {
      console.error('OAuth login error:', error)
      updateNestedField('errors', 'general', ['OAuth registration failed. Please try again.'])
    }
  }, [formState.isSubmitting, onOAuthLogin, updateNestedField])

  // Password strength requirements
  const passwordRequirements: PasswordRequirement[] = useMemo(() => {
    if (!passwordStrength) return []
    
    return [
      {
        key: 'length',
        label: 'At least 8 characters',
        met: passwordStrength.requirements.minLength
      },
      {
        key: 'uppercase',
        label: 'One uppercase letter',
        met: passwordStrength.requirements.hasUppercase
      },
      {
        key: 'lowercase',
        label: 'One lowercase letter',
        met: passwordStrength.requirements.hasLowercase
      },
      {
        key: 'numbers',
        label: 'One number',
        met: passwordStrength.requirements.hasNumbers
      },
      {
        key: 'special',
        label: 'One special character',
        met: passwordStrength.requirements.hasSpecialChars
      }
    ]
  }, [passwordStrength])

  const hasErrors = Object.keys(formState.errors).length > 0
  const isFormDisabled = isLoading || formState.isSubmitting
  const canSubmit = formState.email && formState.password && formState.confirmPassword && 
                   formState.name && !hasErrors && !isFormDisabled &&
                   (!requireTermsAcceptance || formState.acceptTerms) &&
                   (passwordStrength?.score || 0) >= 3

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Full Name Input */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Full Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              id="name"
              type="text"
              value={formState.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              onBlur={() => handleFieldBlur('name')}
              className={`w-full pl-10 pr-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 ${
                formState.errors.name 
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                  : 'border-gray-300'
              }`}
              placeholder="Enter your full name"
              disabled={isFormDisabled}
              autoComplete="name"
              aria-describedby={formState.errors.name ? 'name-error' : undefined}
              aria-invalid={!!formState.errors.name}
            />
          </div>
          {formState.errors.name && (
            <div id="name-error" className="mt-1 text-sm text-red-600">
              {formState.errors.name.map((error, index) => (
                <div key={index} className="flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  {error}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Email Input */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email Address <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              id="email"
              type="email"
              value={formState.email}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              onBlur={() => handleFieldBlur('email')}
              className={`w-full pl-10 pr-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 ${
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
          </div>
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

        {/* Username Input */}
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
            Username
            <span className="text-xs text-gray-500 ml-1">(optional)</span>
          </label>
          <div className="relative">
            <input
              id="username"
              type="text"
              value={formState.username}
              onChange={(e) => handleFieldChange('username', e.target.value)}
              onBlur={() => handleFieldBlur('username')}
              className={`w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10 disabled:bg-gray-50 disabled:text-gray-500 ${
                formState.errors.username 
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                  : usernameAvailable === false ? 'border-red-300' :
                    usernameAvailable === true ? 'border-green-300' : 'border-gray-300'
              }`}
              placeholder="Choose a username"
              disabled={isFormDisabled}
              autoComplete="username"
              aria-describedby={formState.errors.username ? 'username-error' : 'username-help'}
              aria-invalid={!!formState.errors.username}
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              {checkingUsername ? (
                <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
              ) : usernameAvailable === true ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : usernameAvailable === false ? (
                <X className="h-4 w-4 text-red-500" />
              ) : null}
            </div>
          </div>
          {formState.errors.username ? (
            <div id="username-error" className="mt-1 text-sm text-red-600">
              {formState.errors.username.map((error, index) => (
                <div key={index} className="flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  {error}
                </div>
              ))}
            </div>
          ) : (
            <div id="username-help" className="mt-1 text-xs text-gray-500">
              {usernameAvailable === true && 'Username is available'}
              {usernameAvailable === false && 'Username is not available'}
              {!formState.username && 'Leave empty to use your email as login'}
            </div>
          )}
        </div>

        {/* Company Input */}
        <div>
          <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
            Company
            <span className="text-xs text-gray-500 ml-1">(optional)</span>
          </label>
          <div className="relative">
            <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              id="company"
              type="text"
              value={formState.company}
              onChange={(e) => handleFieldChange('company', e.target.value)}
              onBlur={() => handleFieldBlur('company')}
              className={`w-full pl-10 pr-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 ${
                formState.errors.company 
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                  : 'border-gray-300'
              }`}
              placeholder="Company name"
              disabled={isFormDisabled}
              autoComplete="organization"
              aria-describedby={formState.errors.company ? 'company-error' : undefined}
              aria-invalid={!!formState.errors.company}
            />
          </div>
          {formState.errors.company && (
            <div id="company-error" className="mt-1 text-sm text-red-600">
              {formState.errors.company.map((error, index) => (
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
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password <span className="text-red-500">*</span>
          </label>
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
              placeholder="Create a strong password"
              disabled={isFormDisabled}
              autoComplete="new-password"
              aria-describedby={formState.errors.password ? 'password-error' : 'password-requirements'}
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
          
          {/* Password Requirements */}
          {passwordRequirements.length > 0 && (
            <div id="password-requirements" className="mt-2 space-y-1">
              <div className="text-xs font-medium text-gray-700">Password Requirements:</div>
              <div className="grid grid-cols-1 gap-1">
                {passwordRequirements.map((req) => (
                  <div key={req.key} className="flex items-center text-xs">
                    {req.met ? (
                      <Check className="h-3 w-3 text-green-500 mr-1" />
                    ) : (
                      <X className="h-3 w-3 text-red-500 mr-1" />
                    )}
                    <span className={req.met ? 'text-green-700' : 'text-red-700'}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
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

        {/* Confirm Password Input */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={formState.showConfirmPassword ? 'text' : 'password'}
              value={formState.confirmPassword}
              onChange={(e) => handleFieldChange('confirmPassword', e.target.value)}
              onBlur={() => handleFieldBlur('confirmPassword')}
              className={`w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10 disabled:bg-gray-50 disabled:text-gray-500 ${
                formState.errors.confirmPassword 
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                  : formState.confirmPassword && formState.password === formState.confirmPassword
                    ? 'border-green-300' : 'border-gray-300'
              }`}
              placeholder="Confirm your password"
              disabled={isFormDisabled}
              autoComplete="new-password"
              aria-describedby={formState.errors.confirmPassword ? 'confirm-password-error' : undefined}
              aria-invalid={!!formState.errors.confirmPassword}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center focus:outline-none"
              onClick={() => updateField('showConfirmPassword', !formState.showConfirmPassword)}
              disabled={isFormDisabled}
              aria-label={formState.showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {formState.showConfirmPassword ? (
                <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              ) : (
                <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              )}
            </button>
          </div>
          {formState.errors.confirmPassword && (
            <div id="confirm-password-error" className="mt-1 text-sm text-red-600">
              {formState.errors.confirmPassword.map((error, index) => (
                <div key={index} className="flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  {error}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Terms and Privacy */}
        <div className="space-y-3">
          {requireTermsAcceptance && (
            <div className="flex items-start">
              <input
                id="acceptTerms"
                type="checkbox"
                checked={formState.acceptTerms}
                onChange={(e) => updateField('acceptTerms', e.target.checked)}
                disabled={isFormDisabled}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
                required
              />
              <label htmlFor="acceptTerms" className="ml-2 block text-sm text-gray-700">
                I agree to the{' '}
                <a href="/terms" className="text-blue-600 hover:text-blue-500 underline" target="_blank">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" className="text-blue-600 hover:text-blue-500 underline" target="_blank">
                  Privacy Policy
                </a>
                <span className="text-red-500 ml-1">*</span>
              </label>
            </div>
          )}

          <div className="flex items-start">
            <input
              id="acceptNewsletter"
              type="checkbox"
              checked={formState.acceptNewsletter}
              onChange={(e) => updateField('acceptNewsletter', e.target.checked)}
              disabled={isFormDisabled}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
            />
            <label htmlFor="acceptNewsletter" className="ml-2 block text-sm text-gray-700">
              I would like to receive product updates and newsletters
            </label>
          </div>
        </div>

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
        >
          {formState.isSubmitting ? (
            <>
              <Loader2 className="animate-spin h-4 w-4 mr-2" />
              Creating Account...
            </>
          ) : (
            'Create Account'
          )}
        </button>
        
        {!canSubmit && (
          <div className="text-xs text-gray-500 text-center mt-1">
            {!formState.acceptTerms && requireTermsAcceptance
              ? 'Please accept the terms to continue'
              : 'Please fill in all required fields and ensure passwords match'
            }
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
              <span className="px-2 bg-white text-gray-500">Or register with</span>
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
                >
                  {provider.name === 'google' && (
                    <Mail className="h-5 w-5 text-red-500 mr-2" />
                  )}
                  {provider.name === 'github' && (
                    <Github className="h-5 w-5 text-gray-900 mr-2" />
                  )}
                  Continue with {provider.displayName}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Login Link */}
      <div className="mt-6 text-center">
        <span className="text-sm text-gray-600">
          Already have an account?{' '}
          <button
            onClick={onLoginRedirect}
            className="font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:underline"
            disabled={isFormDisabled}
          >
            Sign in
          </button>
        </span>
      </div>
    </div>
  )
}

export default RegisterForm