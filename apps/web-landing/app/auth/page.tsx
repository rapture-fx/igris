'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Mail, Github, ArrowRight, Chrome } from 'lucide-react'
import { checkEmailExists, initiateOAuthLogin, loginWithCredentials, registerUser, type ApiError } from '@/lib/auth'
import { AuthWrapper } from '../../src/components/AuthWrapper'
import { useTheme } from "next-themes"

function AuthPageContent() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [authStep, setAuthStep] = useState('email_input') // 'email_input', 'password_input', 'registration_form'
  const { theme } = useTheme()

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      setError('Please enter your email address')
      return
    }

    setIsLoading(true)
    setError('')
    
    try {
      const { exists } = await checkEmailExists(email)
      
      if (exists) {
        setAuthStep('password_input')
      } else {
        setAuthStep('registration_form')
      }
    } catch (error) {
      const apiError = error as ApiError
      setError(apiError.message || 'An error occurred while checking your email')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      await loginWithCredentials({ email, password })
      router.push('/dashboard') // Redirect to dashboard on successful login
    } catch (error) {
      const apiError = error as ApiError
      setError(apiError.message || 'Invalid email or password')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const [firstName, lastName] = fullName.split(' ')
      await registerUser({ 
        firstName: firstName || fullName, 
        lastName: lastName || '', 
        email, 
        password 
      })
      router.push('/dashboard') // Redirect to dashboard on successful registration
    } catch (error) {
      const apiError = error as ApiError
      setError(apiError.message || 'Registration failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    setIsLoading(true)
    setError('')
    
    try {
      initiateOAuthLogin(provider)
    } catch (error) {
      setError(`Failed to initiate ${provider} authentication`)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
        <div className="flex min-h-screen">
        {/* Left Column - Form */}
        <div className="flex-1 flex flex-col justify-center px-12 py-24 lg:px-32 xl:px-48 bg-white">
          <div className="mx-auto w-full max-w-sm lg:w-96">
            

            {/* Header */}
            <div className="mb-8 flex flex-col items-center justify-center">
              <div className="flex items-center justify-center mb-4">
                <Image 
                  src={theme === "dark" ? "/Schlep Engine Dark mode logo.svg" : "/Schlep Engine Light mode logo.svg"} 
                  alt="Schlep Engine" 
                  width={45} 
                  height={45}
                  className="mr-3"
                />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Welcome to Schlep Engine
              </h2>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* OAuth Buttons */}
            <div className="mb-6 space-y-3">
              <button
                onClick={() => handleOAuthLogin('google')}
                disabled={isLoading}
                className="w-full flex items-center justify-center px-4 py-3 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{boxShadow: '0 10px 15px -3px rgba(22, 22, 22, 0.1), 0 4px 6px -2px rgba(22, 22, 22, 0.05)', borderColor: '#161616', color: '#fcfcf7', backgroundColor: '#161616'}}
              >
                <Mail className="w-5 h-5 mr-3" />
                Continue with Gmail
              </button>
              <button
                onClick={() => handleOAuthLogin('github')}
                disabled={isLoading}
                className="w-full flex items-center justify-center px-4 py-3 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{boxShadow: '0 10px 15px -3px rgba(22, 22, 22, 0.1), 0 4px 6px -2px rgba(22, 22, 22, 0.05)', borderColor: '#161616', color: '#fcfcf7', backgroundColor: '#161616'}}
              >
                <Github className="w-5 h-5 mr-3" />
                Continue with GitHub
              </button>
            </div>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-600">Or continue with email</span>
              </div>
            </div>

            {/* Email Form */}
            {authStep === 'email_input' && (
              <form onSubmit={handleEmailSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2" style={{color: '#fcfcf7'}}>
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (error) setError('')
                    }}
                    disabled={isLoading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-500 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#161616] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    placeholder="Enter your email"
                  />
                </div>

                <div className="flex items-center mb-4">
                  <input
                    id="terms"
                    name="terms"
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="terms" className="ml-2 block text-sm text-gray-900">
                    I agree to the{' '}
                    <Link href="/terms" className="text-blue-600 hover:text-blue-500">
                      Terms and Conditions
                    </Link>
                  </label>
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white !bg-black focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    style={{backgroundColor: 'black', boxShadow: '0 10px 15px -3px rgba(22, 22, 22, 0.1), 0 4px 6px -2px rgba(22, 22, 22, 0.05)'}}
                  >
                    {isLoading ? (
                      'Checking...'
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="ml-2 w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
                <p className="mt-4 text-center text-sm text-gray-600">
                  Already have an account?{' '}
                  <Link href="/auth/password" className="font-medium text-blue-600 hover:text-blue-500">
                    Sign In
                  </Link>
                </p>
              </form>
            )}

            {/* Password Input Form */}
            {authStep === 'password_input' && (
              <form onSubmit={handlePasswordSubmit} className="space-y-6">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium mb-2" style={{color: '#fcfcf7'}}>
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-500 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#161616] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    placeholder="Enter your password"
                  />
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white !bg-black focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    style={{backgroundColor: 'black', boxShadow: '0 10px 15px -3px rgba(22, 22, 22, 0.1), 0 4px 6px -2px rgba(22, 22, 22, 0.05)'}}
                  >
                    {isLoading ? (
                      'Signing In...'
                    ) : (
                      <>
                        Sign In
                        <ArrowRight className="ml-2 w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
                <div className="text-center">
                  <Link href="/auth/forgot-password" className="text-sm text-[#468BE6] hover:text-[#3a7bd5]">
                    Forgot password?
                  </Link>
                </div>
              </form>
            )}

            {/* Registration Form */}
            {authStep === 'registration_form' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-6">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium mb-2" style={{color: '#fcfcf7'}}>
                    Full Name
                  </label>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-500 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#161616] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <label htmlFor="email-register" className="block text-sm font-medium mb-2" style={{color: '#fcfcf7'}}>
                    Email address
                  </label>
                  <input
                    id="email-register"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={true} // Email is pre-filled and not editable
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-500 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#161616] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    placeholder="Your email"
                  />
                </div>
                <div>
                  <label htmlFor="password-register" className="block text-sm font-medium mb-2">
                    Password
                  </label>
                  <input
                    id="password-register"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-500 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#161616] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    placeholder="Create a password"
                  />
                </div>
                <div className="flex items-center mb-4">
                  <input
                    id="terms-register"
                    name="terms"
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="terms-register" className="ml-2 block text-sm text-gray-900">
                    I agree to the{' '}
                    <Link href="/terms" className="text-blue-600 hover:text-blue-500">
                      Terms and Conditions
                    </Link>
                  </label>
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white !bg-black focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    style={{backgroundColor: 'black', boxShadow: '0 10px 15px -3px rgba(22, 22, 22, 0.1), 0 4px 6px -2px rgba(22, 22, 22, 0.05)'}}
                  >
                    {isLoading ? (
                      'Registering...'
                    ) : (
                      <>
                        Register
                        <ArrowRight className="ml-2 w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
        
        {/* Right Column */}
        <div className="hidden lg:block relative flex-1">
          <div className="absolute inset-0 bg-white">
            <div className="h-full flex items-center justify-center p-12">
              <div className="text-center text-gray-900">
                {/* Image removed */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <AuthWrapper>
      <AuthPageContent />
    </AuthWrapper>
  )
}
