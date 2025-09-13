'use client'

import React, { useState, useEffect } from 'react'
import { 
  Key, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Copy, 
  Check, 
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Shield
} from 'lucide-react'

interface JWTAuthManagerProps {
  token: string
  onTokenChange: (token: string) => void
}

interface JWTPayload {
  sub?: string
  iat?: number
  exp?: number
  aud?: string
  iss?: string
  [key: string]: any
}

export function JWTAuthManager({ token, onTokenChange }: JWTAuthManagerProps) {
  const [showToken, setShowToken] = useState(false)
  const [copied, setCopied] = useState(false)
  const [tokenInfo, setTokenInfo] = useState<JWTPayload | null>(null)
  const [tokenStatus, setTokenStatus] = useState<'valid' | 'expired' | 'invalid' | 'none'>('none')

  // Parse JWT token
  const parseJWT = (token: string): JWTPayload | null => {
    try {
      const base64Url = token.split('.')[1]
      if (!base64Url) return null
      
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
      
      return JSON.parse(jsonPayload)
    } catch (error) {
      return null
    }
  }

  // Check token validity
  useEffect(() => {
    if (!token) {
      setTokenStatus('none')
      setTokenInfo(null)
      return
    }

    const payload = parseJWT(token)
    if (!payload) {
      setTokenStatus('invalid')
      setTokenInfo(null)
      return
    }

    setTokenInfo(payload)

    // Check if token is expired
    if (payload.exp) {
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp < now) {
        setTokenStatus('expired')
      } else {
        setTokenStatus('valid')
      }
    } else {
      setTokenStatus('valid')
    }
  }, [token])

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy token:', err)
    }
  }

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  const getTimeUntilExpiry = (exp: number): string => {
    const now = Math.floor(Date.now() / 1000)
    const diff = exp - now
    
    if (diff <= 0) return 'Expired'
    
    const hours = Math.floor(diff / 3600)
    const minutes = Math.floor((diff % 3600) / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`
    } else {
      return `${minutes}m remaining`
    }
  }

  const getStatusColor = () => {
    switch (tokenStatus) {
      case 'valid': return 'text-green-600 dark:text-green-400'
      case 'expired': return 'text-red-600 dark:text-red-400'
      case 'invalid': return 'text-orange-600 dark:text-orange-400'
      default: return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getStatusIcon = () => {
    switch (tokenStatus) {
      case 'valid': return <CheckCircle className="w-4 h-4" />
      case 'expired': return <AlertTriangle className="w-4 h-4" />
      case 'invalid': return <AlertTriangle className="w-4 h-4" />
      default: return <Key className="w-4 h-4" />
    }
  }

  const getStatusText = () => {
    switch (tokenStatus) {
      case 'valid': return 'Valid Token'
      case 'expired': return 'Token Expired'
      case 'invalid': return 'Invalid Token'
      default: return 'No Token'
    }
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 max-w-sm z-40">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Key className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            JWT Authentication
          </h3>
        </div>
        <div className={`flex items-center space-x-1 text-xs ${getStatusColor()}`}>
          {getStatusIcon()}
          <span>{getStatusText()}</span>
        </div>
      </div>

      {/* Token Input */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          JWT Token
        </label>
        <div className="relative">
          <input
            type={showToken ? "text" : "password"}
            value={token}
            onChange={(e) => onTokenChange(e.target.value)}
            placeholder="Paste your JWT token here..."
            className="w-full pr-20 pl-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="absolute right-1 top-1 flex items-center space-x-1">
            <button
              onClick={() => setShowToken(!showToken)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title={showToken ? "Hide token" : "Show token"}
            >
              {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
            {token && (
              <button
                onClick={copyToClipboard}
                className={`p-1 transition-colors ${
                  copied 
                    ? 'text-green-500' 
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
                title="Copy token"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Token Information */}
      {tokenInfo && (
        <div className="space-y-2">
          {/* Subject */}
          {tokenInfo.sub && (
            <div className="flex items-center space-x-2 text-xs">
              <User className="w-3 h-3 text-gray-400" />
              <span className="text-gray-600 dark:text-gray-400">Subject:</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {tokenInfo.sub}
              </span>
            </div>
          )}

          {/* Issuer */}
          {tokenInfo.iss && (
            <div className="flex items-center space-x-2 text-xs">
              <Shield className="w-3 h-3 text-gray-400" />
              <span className="text-gray-600 dark:text-gray-400">Issuer:</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {tokenInfo.iss}
              </span>
            </div>
          )}

          {/* Expiry */}
          {tokenInfo.exp && (
            <div className="flex items-center space-x-2 text-xs">
              <Clock className="w-3 h-3 text-gray-400" />
              <span className="text-gray-600 dark:text-gray-400">Expires:</span>
              <div className="flex flex-col">
                <span className="text-gray-900 dark:text-white font-medium">
                  {formatDate(tokenInfo.exp)}
                </span>
                <span className={`text-xs ${
                  tokenStatus === 'expired' 
                    ? 'text-red-600 dark:text-red-400' 
                    : 'text-green-600 dark:text-green-400'
                }`}>
                  {getTimeUntilExpiry(tokenInfo.exp)}
                </span>
              </div>
            </div>
          )}

          {/* Issued At */}
          {tokenInfo.iat && (
            <div className="flex items-center space-x-2 text-xs">
              <Clock className="w-3 h-3 text-gray-400" />
              <span className="text-gray-600 dark:text-gray-400">Issued:</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {formatDate(tokenInfo.iat)}
              </span>
            </div>
          )}

          {/* Custom Claims */}
          {Object.entries(tokenInfo).some(([key]) => 
            !['sub', 'iat', 'exp', 'aud', 'iss', 'nbf', 'jti'].includes(key)
          ) && (
            <details className="mt-2">
              <summary className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-white">
                Custom Claims
              </summary>
              <div className="mt-1 ml-2 space-y-1">
                {Object.entries(tokenInfo)
                  .filter(([key]) => 
                    !['sub', 'iat', 'exp', 'aud', 'iss', 'nbf', 'jti'].includes(key)
                  )
                  .map(([key, value]) => (
                    <div key={key} className="flex items-center space-x-2 text-xs">
                      <span className="text-gray-600 dark:text-gray-400">{key}:</span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Warning for expired token */}
      {tokenStatus === 'expired' && (
        <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs">
          <div className="flex items-center space-x-2 text-red-700 dark:text-red-300">
            <AlertTriangle className="w-3 h-3" />
            <span>Token has expired. Please obtain a new token.</span>
          </div>
        </div>
      )}

      {/* Warning for invalid token */}
      {tokenStatus === 'invalid' && token && (
        <div className="mt-3 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded text-xs">
          <div className="flex items-center space-x-2 text-orange-700 dark:text-orange-300">
            <AlertTriangle className="w-3 h-3" />
            <span>Invalid JWT token format.</span>
          </div>
        </div>
      )}

      {/* Help text when no token */}
      {tokenStatus === 'none' && (
        <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs">
          <div className="text-blue-700 dark:text-blue-300">
            <p className="mb-1">Paste your JWT token to authenticate API requests.</p>
            <p className="text-blue-600 dark:text-blue-400">
              The token will be automatically included in Authorization headers.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}