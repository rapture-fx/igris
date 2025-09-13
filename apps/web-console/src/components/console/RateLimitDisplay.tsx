'use client'

import React, { useState, useEffect } from 'react'
import { 
  Zap, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  Gauge
} from 'lucide-react'

interface RateLimitDisplayProps {
  remaining?: number
  reset?: string
  limit?: number
  window?: string
}

export function RateLimitDisplay({ 
  remaining, 
  reset, 
  limit = 1000,
  window = '1 hour'
}: RateLimitDisplayProps) {
  const [timeUntilReset, setTimeUntilReset] = useState<string>('')
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!reset) return

    const updateTimeUntilReset = () => {
      const resetTime = typeof reset === 'string' ? parseInt(reset) * 1000 : new Date(reset).getTime()
      const now = Date.now()
      const diff = resetTime - now

      if (diff <= 0) {
        setTimeUntilReset('Reset available')
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      if (hours > 0) {
        setTimeUntilReset(`${hours}h ${minutes}m ${seconds}s`)
      } else if (minutes > 0) {
        setTimeUntilReset(`${minutes}m ${seconds}s`)
      } else {
        setTimeUntilReset(`${seconds}s`)
      }
    }

    updateTimeUntilReset()
    const interval = setInterval(updateTimeUntilReset, 1000)

    return () => clearInterval(interval)
  }, [reset])

  const getUsagePercentage = (): number => {
    if (remaining === undefined) return 0
    return ((limit - remaining) / limit) * 100
  }

  const getStatusColor = (): string => {
    const percentage = getUsagePercentage()
    if (percentage >= 90) return 'text-red-600 dark:text-red-400'
    if (percentage >= 70) return 'text-orange-600 dark:text-orange-400'
    return 'text-green-600 dark:text-green-400'
  }

  const getProgressBarColor = (): string => {
    const percentage = getUsagePercentage()
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 70) return 'bg-orange-500'
    return 'bg-green-500'
  }

  const getStatusIcon = () => {
    const percentage = getUsagePercentage()
    if (percentage >= 90) return <AlertTriangle className="w-4 h-4" />
    if (percentage >= 70) return <Info className="w-4 h-4" />
    return <CheckCircle className="w-4 h-4" />
  }

  const getStatusMessage = (): string => {
    const percentage = getUsagePercentage()
    if (remaining === undefined) return 'Rate limit info not available'
    if (percentage >= 90) return 'Rate limit nearly exhausted'
    if (percentage >= 70) return 'Rate limit usage high'
    return 'Rate limit usage normal'
  }

  if (remaining === undefined) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 max-w-xs z-40">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center space-x-2">
          <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Rate Limit
          </span>
        </div>
        <div className={`flex items-center space-x-1 text-xs ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="font-medium">{remaining}</span>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Usage Bar */}
          <div>
            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
              <span>Usage</span>
              <span>{limit - remaining}/{limit} requests</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
                style={{ width: `${getUsagePercentage()}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {getUsagePercentage().toFixed(1)}% used
            </div>
          </div>

          {/* Status Message */}
          <div className={`text-xs ${getStatusColor()}`}>
            {getStatusMessage()}
          </div>

          {/* Reset Timer */}
          {reset && (
            <div className="flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400">
              <Clock className="w-3 h-3" />
              <span>Resets in: {timeUntilReset}</span>
            </div>
          )}

          {/* Rate Limit Details */}
          <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-2">
            <div className="flex items-center justify-between">
              <span>Limit:</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {limit.toLocaleString()} requests
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Window:</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {window}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Remaining:</span>
              <span className={`font-medium ${getStatusColor()}`}>
                {remaining.toLocaleString()} requests
              </span>
            </div>
          </div>

          {/* Recommendations */}
          {getUsagePercentage() >= 70 && (
            <div className="text-xs bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-2">
              <div className="flex items-start space-x-2 text-yellow-700 dark:text-yellow-300">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">Rate Limit Advisory</p>
                  <ul className="space-y-1 text-yellow-600 dark:text-yellow-400">
                    <li>• Consider implementing request caching</li>
                    <li>• Batch multiple operations when possible</li>
                    <li>• Add retry logic with exponential backoff</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Critical Warning */}
          {getUsagePercentage() >= 95 && (
            <div className="text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2">
              <div className="flex items-start space-x-2 text-red-700 dark:text-red-300">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">Critical Rate Limit</p>
                  <p className="text-red-600 dark:text-red-400">
                    You're approaching the rate limit. Requests may be throttled or rejected.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}