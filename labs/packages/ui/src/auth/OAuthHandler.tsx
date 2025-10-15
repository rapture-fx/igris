/**
 * OAuth Integration Handler
 * Manages OAuth flow including popup handling and callback processing
 */

'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Loader2, AlertTriangle, ExternalLink } from 'lucide-react'
import type { 
  OAuthProvider, 
  OAuthAuthorizationUrl, 
  OAuthCallbackRequest,
  AuthError 
} from '@schlep-engine/types/auth'

interface OAuthHandlerProps {
  provider: OAuthProvider
  onSuccess: (data: any) => Promise<void>
  onError: (error: AuthError) => void
  children?: React.ReactNode
  mode?: 'popup' | 'redirect'
  width?: number
  height?: number
}

interface OAuthState {
  isLoading: boolean
  error: AuthError | null
  popup: Window | null
  authUrl: string | null
}

const POPUP_FEATURES = {
  width: 500,
  height: 600,
  left: 0,
  top: 0,
  toolbar: 'no',
  menubar: 'no',
  scrollbars: 'yes',
  resizable: 'yes',
  status: 'no'
}

export function OAuthHandler({
  provider,
  onSuccess,
  onError,
  children,
  mode = 'popup',
  width = POPUP_FEATURES.width,
  height = POPUP_FEATURES.height
}: OAuthHandlerProps) {
  const [state, setState] = useState<OAuthState>({
    isLoading: false,
    error: null,
    popup: null,
    authUrl: null
  })

  // Update state helper
  const updateState = useCallback((updates: Partial<OAuthState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])

  // Generate popup position
  const getPopupPosition = useCallback(() => {
    const screenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX
    const screenTop = window.screenTop !== undefined ? window.screenTop : window.screenY
    const windowWidth = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth
    const windowHeight = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight
    
    const left = screenLeft + (windowWidth - width) / 2
    const top = screenTop + (windowHeight - height) / 2
    
    return { left: Math.max(0, left), top: Math.max(0, top) }
  }, [width, height])

  // Create popup features string
  const createPopupFeatures = useCallback(() => {
    const position = getPopupPosition()
    
    return Object.entries({
      ...POPUP_FEATURES,
      width,
      height,
      left: position.left,
      top: position.top
    })
      .map(([key, value]) => `${key}=${value}`)
      .join(',')
  }, [width, height, getPopupPosition])

  // Generate PKCE challenge (for OAuth2 with PKCE)
  const generatePKCE = useCallback(async () => {
    if (!window.crypto || !window.crypto.subtle) {
      return null // PKCE not supported in this environment
    }

    try {
      // Generate code verifier
      const array = new Uint8Array(32)
      window.crypto.getRandomValues(array)
      const codeVerifier = btoa(String.fromCharCode(...array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')

      // Generate code challenge
      const encoder = new TextEncoder()
      const data = encoder.encode(codeVerifier)
      const digest = await window.crypto.subtle.digest('SHA-256', data)
      const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')

      return { codeVerifier, codeChallenge }
    } catch (error) {
      console.error('PKCE generation failed:', error)
      return null
    }
  }, [])

  // Handle popup message
  const handlePopupMessage = useCallback((event: MessageEvent) => {
    // Validate origin
    const allowedOrigins = [
      window.location.origin,
      process.env.NEXT_PUBLIC_API_URL,
      'https://accounts.google.com',
      'https://github.com'
    ]
    
    if (!allowedOrigins.some(origin => event.origin === origin)) {
      console.warn('OAuth message from unauthorized origin:', event.origin)
      return
    }

    const { type, data, error } = event.data

    if (type === 'oauth_success') {
      handleOAuthSuccess(data)
    } else if (type === 'oauth_error') {
      handleOAuthError(error)
    } else if (type === 'oauth_callback') {
      handleOAuthCallback(data)
    }
  }, [])

  // Handle OAuth success
  const handleOAuthSuccess = useCallback(async (data: any) => {
    updateState({ isLoading: true, error: null })
    
    try {
      await onSuccess(data)
    } catch (error) {
      const authError: AuthError = {
        code: 'OAUTH_SUCCESS_HANDLER_FAILED',
        message: error instanceof Error ? error.message : 'OAuth success handler failed',
        timestamp: new Date().toISOString()
      }
      onError(authError)
      updateState({ error: authError })
    } finally {
      updateState({ isLoading: false })
      if (state.popup) {
        state.popup.close()
        updateState({ popup: null })
      }
    }
  }, [onSuccess, onError, state.popup, updateState])

  // Handle OAuth error
  const handleOAuthError = useCallback((error: any) => {
    const authError: AuthError = {
      code: error?.code || 'OAUTH_ERROR',
      message: error?.message || 'OAuth authentication failed',
      timestamp: new Date().toISOString(),
      details: error
    }
    
    onError(authError)
    updateState({ error: authError, isLoading: false })
    
    if (state.popup) {
      state.popup.close()
      updateState({ popup: null })
    }
  }, [onError, state.popup, updateState])

  // Handle OAuth callback
  const handleOAuthCallback = useCallback(async (callbackData: any) => {
    updateState({ isLoading: true })
    
    try {
      // Process the callback data
      const callbackRequest: OAuthCallbackRequest = {
        code: callbackData.code,
        state: callbackData.state,
        codeVerifier: callbackData.codeVerifier
      }
      
      await handleOAuthSuccess(callbackRequest)
    } catch (error) {
      handleOAuthError(error)
    }
  }, [handleOAuthSuccess, handleOAuthError, updateState])

  // Monitor popup
  const monitorPopup = useCallback(() => {
    if (!state.popup) return

    const checkClosed = setInterval(() => {
      if (state.popup?.closed) {
        clearInterval(checkClosed)
        updateState({ popup: null, isLoading: false })
        
        // If still loading when popup is closed, treat as cancelled
        if (state.isLoading) {
          const authError: AuthError = {
            code: 'OAUTH_CANCELLED',
            message: 'OAuth authentication was cancelled',
            timestamp: new Date().toISOString()
          }
          onError(authError)
          updateState({ error: authError })
        }
      }
    }, 1000)

    // Cleanup after 5 minutes
    setTimeout(() => {
      clearInterval(checkClosed)
      if (state.popup && !state.popup.closed) {
        state.popup.close()
        updateState({ popup: null, isLoading: false })
      }
    }, 300000)
  }, [state.popup, state.isLoading, onError, updateState])

  // Start OAuth flow
  const startOAuthFlow = useCallback(async () => {
    if (state.isLoading) return

    updateState({ isLoading: true, error: null })

    try {
      // Generate PKCE if supported
      const pkce = await generatePKCE()
      
      // Get authorization URL from backend
      const authUrlResponse = await fetch(`/api/auth/oauth/${provider.name}/authorize`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!authUrlResponse.ok) {
        throw new Error('Failed to get OAuth authorization URL')
      }

      const authData: OAuthAuthorizationUrl = await authUrlResponse.json()
      
      updateState({ authUrl: authData.url })

      if (mode === 'redirect') {
        // Redirect mode: navigate to OAuth provider
        window.location.href = authData.url
      } else {
        // Popup mode: open popup window
        const popup = window.open(
          authData.url,
          `oauth_${provider.name}`,
          createPopupFeatures()
        )

        if (!popup) {
          throw new Error('Popup was blocked. Please allow popups for this site.')
        }

        updateState({ popup })
        
        // Focus the popup
        popup.focus()
        
        // Start monitoring the popup
        monitorPopup()
      }
    } catch (error) {
      const authError: AuthError = {
        code: 'OAUTH_START_FAILED',
        message: error instanceof Error ? error.message : 'Failed to start OAuth flow',
        timestamp: new Date().toISOString()
      }
      
      onError(authError)
      updateState({ error: authError, isLoading: false })
    }
  }, [
    state.isLoading, 
    provider.name, 
    mode, 
    generatePKCE, 
    createPopupFeatures, 
    monitorPopup, 
    onError, 
    updateState
  ])

  // Setup message listener
  useEffect(() => {
    if (mode === 'popup') {
      window.addEventListener('message', handlePopupMessage)
      return () => window.removeEventListener('message', handlePopupMessage)
    }
  }, [mode, handlePopupMessage])

  // Cleanup popup on unmount
  useEffect(() => {
    return () => {
      if (state.popup && !state.popup.closed) {
        state.popup.close()
      }
    }
  }, [state.popup])

  // Default children if none provided
  const defaultChildren = (
    <button
      onClick={startOAuthFlow}
      disabled={state.isLoading}
      className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {state.isLoading ? (
        <>
          <Loader2 className="animate-spin h-4 w-4 mr-2" />
          Connecting...
        </>
      ) : (
        <>
          Continue with {provider.displayName}
          {mode === 'popup' && <ExternalLink className="h-3 w-3 ml-2 opacity-60" />}
        </>
      )}
    </button>
  )

  return (
    <div className="oauth-handler">
      {/* Error Display */}
      {state.error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-4">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" />
            <div className="text-sm text-red-700">
              <strong>OAuth Error:</strong> {state.error.message}
              {state.error.code === 'OAUTH_CANCELLED' && (
                <div className="mt-1">
                  <button
                    onClick={() => updateState({ error: null })}
                    className="text-red-600 hover:text-red-500 underline focus:outline-none"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Popup Blocked Warning */}
      {mode === 'popup' && (
        <div className="mb-4 text-xs text-gray-500">
          <AlertTriangle className="h-3 w-3 inline mr-1" />
          Make sure popups are enabled for OAuth authentication
        </div>
      )}

      {/* Children or Default Button */}
      {children ? (
        React.cloneElement(children as React.ReactElement, {
          onClick: startOAuthFlow,
          disabled: state.isLoading
        })
      ) : (
        defaultChildren
      )}
      
      {/* Loading State */}
      {state.isLoading && mode === 'popup' && (
        <div className="mt-2 text-xs text-gray-500 text-center">
          Please complete authentication in the popup window
        </div>
      )}
    </div>
  )
}

export default OAuthHandler