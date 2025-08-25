'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { loginWithCredentials, tokenStorage, type ApiError } from '@/lib/auth'
import { AuthWrapper } from '@/src/components/AuthWrapper'

function PasswordPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    try {
      const response = await loginWithCredentials({ email, password })
      
      // Store tokens
      tokenStorage.setTokens(response.access_token, response.refresh_token)
      
      // Handle successful sign-in (redirect to dashboard or home)
      console.log('Sign in successful:', response.user)
      window.location.href = '/dashboard' // Or use Next.js router
      
    } catch (error) {
      const apiError = error as ApiError
      setError(apiError.message || 'An error occurred during sign in')
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
                src="/new light logo Schlep-engine.svg" 
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
                Welcome back
              </h2>
              <p className="text-gray-300">
                Enter your password to sign in to your account
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

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (error) setError('')
                    }}
                    disabled={isLoading}
                    className="w-full px-3 py-2 pr-10 border border-gray-600 rounded-lg shadow-sm placeholder-gray-500 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-[#468BE6] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    placeholder="Enter your password"
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

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-[#468BE6] focus:ring-[#468BE6] border-gray-600 bg-gray-800 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-300">
                    Remember me
                  </label>
                </div>

                <div className="text-sm">
                  <Link
                    href="/forgot-password"
                    className="text-[#468BE6] hover:text-[#3a7bd5] transition-colors"
                  >
                    Forgot your password?
                  </Link>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading || !password}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-[#468BE6] hover:bg-[#3a7bd5] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#468BE6] focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column - Image */}
        <div className="hidden lg:block relative flex-1">
          <div className="absolute inset-0 bg-gradient-to-br from-[#1A5799] to-[#468BE6]">
            <div className="h-full flex items-center justify-center p-12">
              <div className="text-center text-white">
                {/* Placeholder content - replace with actual image */}
                <div className="w-96 h-96 bg-white/10 rounded-2xl flex items-center justify-center mb-8">
                  <div className="text-center">
                    <div className="w-24 h-24 bg-white/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-lg font-medium">Secure Access</p>
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-4">
                  Transform your data processing workflow
                </h3>
                <p className="text-lg text-white/80 max-w-md">
                  Join thousands of data teams who trust Schlep-engine for their AI-powered data preparation needs.
                </p>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
  )
}

export default function PasswordPage() {
  return (
    <AuthWrapper>
      <PasswordPageContent />
    </AuthWrapper>
  )
}