'use client'

import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { handleOAuthCallback, tokenStorage, type ApiError } from '@/lib/auth'
import { AuthWrapper } from '@/src/components/AuthWrapper'

function AuthCallbackContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code')
        const provider = searchParams.get('provider') as 'google' | 'github'
        const error = searchParams.get('error')

        if (error) {
          throw new Error('OAuth authorization was denied or failed')
        }

        if (!code || !provider) {
          throw new Error('Missing authorization code or provider')
        }

        // Handle the OAuth callback
        const response = await handleOAuthCallback(code, provider)
        
        // Store tokens
        tokenStorage.setTokens(response.access_token, response.refresh_token)
        
        setStatus('success')
        
        // Redirect after a short delay
        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 2000)
        
      } catch (error) {
        const apiError = error as ApiError
        setError(apiError.message || 'Authentication failed')
        setStatus('error')
      }
    }

    handleCallback()
  }, [searchParams])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-gray-900 p-8 rounded-lg shadow-lg text-center">
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            <img 
              src="/assets/Schlep Engine logo.svg" 
              alt="Schlep Engine - AI-Powered Data Preparation" 
              className="h-10 w-auto"
            />
            <span className="ml-3 text-xl font-bold text-white" style={{fontFamily: '"DM Sans", sans-serif'}}>
              Schlep-engine
            </span>
          </div>

          {status === 'loading' && (
            <div>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#468BE6] mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Completing authentication...
              </h2>
              <p className="text-gray-300">
                Please wait while we sign you in.
              </p>
            </div>
          )}

          {status === 'success' && (
            <div>
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Authentication successful!
              </h2>
              <p className="text-gray-300">
                Redirecting you to your dashboard...
              </p>
            </div>
          )}

          {status === 'error' && (
            <div>
              <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Authentication failed
              </h2>
              <p className="text-gray-300 mb-4">
                {error}
              </p>
              <a
                href="/signin"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-[#468BE6] hover:bg-[#3a7bd5] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#468BE6] focus:ring-offset-gray-900 transition-colors"
              >
                Try again
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AuthCallback() {
  return (
    <AuthWrapper>
      <AuthCallbackContent />
    </AuthWrapper>
  )
}