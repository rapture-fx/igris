/**
 * OAuth Integration Hook
 * Provides easy-to-use OAuth functionality with provider management
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import type { 
  OAuthProvider, 
  AuthError,
  UseOAuthReturn,
  OAuthAuthorizationUrl,
  AuthResponse 
} from '@igris-inertial/types/auth'
import { authAPI, AuthError as APIError } from './AuthAPI'

interface UseOAuthOptions {
  onSuccess?: (response: AuthResponse) => void
  onError?: (error: AuthError) => void
  autoFetchProviders?: boolean
}

export function useOAuth(options: UseOAuthOptions = {}): UseOAuthReturn {
  const [providers, setProviders] = useState<OAuthProvider[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<AuthError | null>(null)

  const { onSuccess, onError, autoFetchProviders = true } = options

  // Fetch available OAuth providers
  const fetchProviders = useCallback(async () => {
    try {
      setError(null)
      const fetchedProviders = await authAPI.getOAuthProviders()
      setProviders(fetchedProviders.filter(p => p.enabled))
    } catch (err) {
      const authError = err instanceof APIError ? 
        { code: err.code, message: err.message, details: err.details, timestamp: err.timestamp } as AuthError :
        { code: 'FETCH_PROVIDERS_FAILED', message: 'Failed to fetch OAuth providers', timestamp: new Date().toISOString() } as AuthError
      
      setError(authError)
      if (onError) onError(authError)
    }
  }, [onError])

  // Get authorization URL for a provider
  const getAuthUrl = useCallback(async (providerName: string): Promise<string> => {
    try {
      setError(null)
      setIsLoading(true)
      
      const provider = providers.find(p => p.name === providerName)
      if (!provider) {
        throw new Error(`Provider ${providerName} not found or not enabled`)
      }

      const authUrlResponse = await authAPI.getOAuthAuthorizationUrl(providerName)
      return authUrlResponse.url
    } catch (err) {
      const authError = err instanceof APIError ? 
        { code: err.code, message: err.message, details: err.details, timestamp: err.timestamp } as AuthError :
        { code: 'GET_AUTH_URL_FAILED', message: `Failed to get authorization URL for ${providerName}`, timestamp: new Date().toISOString() } as AuthError
      
      setError(authError)
      if (onError) onError(authError)
      throw authError
    } finally {
      setIsLoading(false)
    }
  }, [providers, onError])

  // Handle OAuth callback
  const handleCallback = useCallback(async (providerName: string, params: URLSearchParams): Promise<AuthResponse> => {
    try {
      setError(null)
      setIsLoading(true)

      const provider = providers.find(p => p.name === providerName)
      if (!provider) {
        throw new Error(`Provider ${providerName} not found or not enabled`)
      }

      // Extract callback parameters
      const code = params.get('code')
      const state = params.get('state')
      const error = params.get('error')
      const errorDescription = params.get('error_description')

      // Handle OAuth errors
      if (error) {
        const authError: AuthError = {
          code: `OAUTH_${error.toUpperCase()}`,
          message: errorDescription || `OAuth error: ${error}`,
          timestamp: new Date().toISOString(),
          details: { error, error_description: errorDescription }
        }
        throw authError
      }

      // Validate required parameters
      if (!code) {
        throw new Error('Missing authorization code in callback')
      }

      if (!state) {
        throw new Error('Missing state parameter in callback')
      }

      // Call backend to handle the callback
      const callbackData = {
        code,
        state,
        // Include PKCE verifier if it exists in session storage
        codeVerifier: sessionStorage.getItem(`oauth_${providerName}_verifier`) || undefined
      }

      const response = await authAPI.handleOAuthCallback(providerName, callbackData)

      // Clean up session storage
      sessionStorage.removeItem(`oauth_${providerName}_verifier`)
      sessionStorage.removeItem(`oauth_${providerName}_state`)

      if (onSuccess) onSuccess(response)
      return response

    } catch (err) {
      const authError = err instanceof APIError ? 
        { code: err.code, message: err.message, details: err.details, timestamp: err.timestamp } as AuthError :
        { code: 'OAUTH_CALLBACK_FAILED', message: err instanceof Error ? err.message : 'OAuth callback failed', timestamp: new Date().toISOString() } as AuthError
      
      setError(authError)
      if (onError) onError(authError)
      throw authError
    } finally {
      setIsLoading(false)
    }
  }, [providers, onSuccess, onError])

  // Start OAuth flow with popup
  const startPopupFlow = useCallback(async (providerName: string): Promise<AuthResponse> => {
    return new Promise(async (resolve, reject) => {
      try {
        const authUrl = await getAuthUrl(providerName)
        
        // Generate and store state for CSRF protection
        const state = crypto.getRandomValues(new Uint8Array(16))
          .reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '')
        
        sessionStorage.setItem(`oauth_${providerName}_state`, state)

        // Create popup
        const popup = window.open(
          authUrl,
          `oauth_${providerName}`,
          'width=500,height=600,scrollbars=yes,resizable=yes'
        )

        if (!popup) {
          throw new Error('Popup blocked. Please allow popups for this site.')
        }

        // Focus popup
        popup.focus()

        // Listen for messages from popup
        const messageListener = (event: MessageEvent) => {
          // Validate origin
          if (event.origin !== window.location.origin) return

          const { type, data, error } = event.data

          if (type === 'oauth_success') {
            cleanup()
            resolve(data)
          } else if (type === 'oauth_error') {
            cleanup()
            reject(error)
          }
        }

        // Monitor popup close
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            cleanup()
            reject(new Error('OAuth flow was cancelled'))
          }
        }, 1000)

        // Cleanup function
        const cleanup = () => {
          window.removeEventListener('message', messageListener)
          clearInterval(checkClosed)
          if (!popup.closed) {
            popup.close()
          }
        }

        // Add message listener
        window.addEventListener('message', messageListener)

        // Timeout after 5 minutes
        setTimeout(() => {
          cleanup()
          reject(new Error('OAuth flow timed out'))
        }, 300000)

      } catch (err) {
        reject(err)
      }
    })
  }, [getAuthUrl])

  // Start OAuth flow with redirect
  const startRedirectFlow = useCallback(async (providerName: string, redirectTo?: string): Promise<never> => {
    try {
      const authUrl = await getAuthUrl(providerName)
      
      // Store redirect URL if provided
      if (redirectTo) {
        sessionStorage.setItem('oauth_redirect_to', redirectTo)
      }

      // Redirect to OAuth provider
      window.location.href = authUrl
      
      // This function never returns as it redirects
      return new Promise(() => {}) as Promise<never>
    } catch (err) {
      throw err
    }
  }, [getAuthUrl])

  // Get provider by name
  const getProvider = useCallback((name: string): OAuthProvider | undefined => {
    return providers.find(p => p.name === name)
  }, [providers])

  // Check if provider is available and enabled
  const isProviderAvailable = useCallback((name: string): boolean => {
    const provider = getProvider(name)
    return !!(provider && provider.enabled)
  }, [getProvider])

  // Auto-fetch providers on mount
  useEffect(() => {
    if (autoFetchProviders) {
      fetchProviders()
    }
  }, [autoFetchProviders, fetchProviders])

  return {
    providers,
    getAuthUrl,
    handleCallback,
    startPopupFlow,
    startRedirectFlow,
    getProvider,
    isProviderAvailable,
    fetchProviders,
    isLoading,
    error
  }
}

// Higher-order component for OAuth callback handling
export function withOAuthCallback<P extends object>(
  Component: React.ComponentType<P>,
  providerName: string
) {
  return function OAuthCallbackWrapper(props: P) {
    const { handleCallback } = useOAuth()
    const [isProcessing, setIsProcessing] = useState(true)
    const [error, setError] = useState<AuthError | null>(null)

    useEffect(() => {
      const processCallback = async () => {
        try {
          const params = new URLSearchParams(window.location.search)
          await handleCallback(providerName, params)
          
          // Redirect to intended page or home
          const redirectTo = sessionStorage.getItem('oauth_redirect_to') || '/'
          sessionStorage.removeItem('oauth_redirect_to')
          window.location.href = redirectTo
        } catch (err) {
          setError(err as AuthError)
        } finally {
          setIsProcessing(false)
        }
      }

      processCallback()
    }, [handleCallback])

    if (isProcessing) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Processing OAuth callback...</p>
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-red-800 mb-2">Authentication Error</h2>
              <p className="text-red-700 mb-4">{error.message}</p>
              <button
                onClick={() => window.location.href = '/login'}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      )
    }

    return <Component {...props} />
  }
}

export default useOAuth