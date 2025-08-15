'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { registerUser, tokenStorage, type ApiError } from '@/lib/auth'
import { AuthWrapper } from '@/src/components/AuthWrapper'

function RegisterPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
    company: '',
    agreeToTerms: false
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(emailParam)
    } else {
      // If no email is provided, redirect to auth page
      router.push('/auth')
    }
  }, [searchParams, router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    // Clear error when user starts typing
    if (error) setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    if (!formData.agreeToTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy')
      return
    }
    
    setIsLoading(true)
    setError('')
    
    try {
      const response = await registerUser({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: email,
        password: formData.password,
        company: formData.company || undefined
      })
      
      // Store tokens
      tokenStorage.setTokens(response.access_token, response.refresh_token)
      
      // Handle successful sign-up (redirect to dashboard or onboarding)
      console.log('Sign up successful:', response.user)
      window.location.href = '/dashboard' // Or use Next.js router
      
    } catch (error) {
      const apiError = error as ApiError
      setError(apiError.message || 'An error occurred during registration')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackClick = () => {
    router.push('/auth')
  }

  return (
    <div className="min-h-screen bg-black">
        <div className="flex min-h-screen">
        {/* Left Column - Form */}
        <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-20 xl:px-24 bg-black">
          <div className="mx-auto w-full max-w-sm lg:w-96">
            {/* Logo */}
            <div className="flex items-center mb-8">
              <img 
                src="/assets/Schlep Engine logo.svg" 
                alt="Schlep Engine - AI-Powered Data Preparation" 
                className="h-10 w-auto"
              />
              <span className="ml-3 text-xl font-bold text-white" style={{fontFamily: '"DM Sans", sans-serif'}}>
                Schlep-engine
              </span>
            </div>

            {/* Back Button */}
            <button
              onClick={handleBackClick}
              className="flex items-center text-gray-400 hover:text-white mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </button>

            {/* Header */}
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">
                Create your account
              </h2>
              <p className="text-gray-300">
                Complete your registration to get started
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  disabled
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg shadow-sm bg-gray-700 text-gray-400 cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-white mb-2">
                    First name
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    autoComplete="given-name"
                    required
                    value={formData.firstName}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className="w-full px-3 py-2 border border-gray-600 rounded-lg shadow-sm placeholder-gray-500 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-[#468BE6] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    placeholder="First name"
                  />
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-white mb-2">
                    Last name
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    autoComplete="family-name"
                    required
                    value={formData.lastName}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className="w-full px-3 py-2 border border-gray-600 rounded-lg shadow-sm placeholder-gray-500 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-[#468BE6] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="company" className="block text-sm font-medium text-white mb-2">
                  Company (optional)
                </label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  autoComplete="organization"
                  value={formData.company}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg shadow-sm placeholder-gray-500 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-[#468BE6] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  placeholder="Your company name"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className="w-full px-3 py-2 pr-10 border border-gray-600 rounded-lg shadow-sm placeholder-gray-500 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-[#468BE6] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    placeholder="Create a password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-white mb-2">
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className="w-full px-3 py-2 pr-10 border border-gray-600 rounded-lg shadow-sm placeholder-gray-500 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-[#468BE6] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="agreeToTerms"
                    name="agreeToTerms"
                    type="checkbox"
                    required
                    checked={formData.agreeToTerms}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className="h-4 w-4 text-[#468BE6] focus:ring-[#468BE6] border-gray-600 bg-gray-800 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="agreeToTerms" className="text-gray-300">
                    I agree to the{' '}
                    <Link href="/terms" className="text-[#468BE6] hover:text-[#3a7bd5] transition-colors">
                      Terms of Service
                    </Link>
                    {' '}and{' '}
                    <Link href="/privacy" className="text-[#468BE6] hover:text-[#3a7bd5] transition-colors">
                      Privacy Policy
                    </Link>
                  </label>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading || !formData.agreeToTerms}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-[#468BE6] hover:bg-[#3a7bd5] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#468BE6] focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Creating account...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column - Image */}
        <div className="hidden lg:block relative flex-1">
          <div className="absolute inset-0 bg-gradient-to-br from-[#468BE6] to-[#1A5799]">
            <div className="h-full flex items-center justify-center p-12">
              <div className="text-center text-white">
                {/* Placeholder content - replace with actual image */}
                <div className="w-96 h-96 bg-white/10 rounded-2xl flex items-center justify-center mb-8">
                  <div className="text-center">
                    <div className="w-24 h-24 bg-white/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                      </svg>
                    </div>
                    <p className="text-lg font-medium">Join Our Community</p>
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-4">
                  Start your data transformation journey
                </h3>
                <p className="text-lg text-white/80 max-w-md">
                  Get access to powerful AI-driven data processing tools trusted by leading data teams worldwide.
                </p>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
  )
}

export default function RegisterPage() {
  return (
    <AuthWrapper>
      <RegisterPageContent />
    </AuthWrapper>
  )
}