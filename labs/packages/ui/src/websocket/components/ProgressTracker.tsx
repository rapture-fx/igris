import React from 'react'
import * as Progress from '@radix-ui/react-progress'
import { CheckCircle, XCircle, Clock, AlertCircle, Loader2 } from 'lucide-react'
import { ProgressTrackingConfig } from '@igris-inertial/types'
import { useProgress } from '../hooks'
import { cn } from '../../styles/utils'

export interface ProgressTrackerProps {
  config: ProgressTrackingConfig
  showDetails?: boolean
  showStatus?: boolean
  showETA?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'success' | 'warning' | 'error'
  className?: string
}

export function ProgressTracker({ 
  config, 
  showDetails = true,
  showStatus = true,
  showETA = false,
  size = 'md',
  variant = 'default',
  className 
}: ProgressTrackerProps) {
  const { progress, status, data, error, isConnected } = useProgress(config)

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'processing':
      case 'training':
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'paused':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getProgressColor = () => {
    if (variant !== 'default') {
      switch (variant) {
        case 'success': return 'bg-green-500'
        case 'warning': return 'bg-yellow-500'
        case 'error': return 'bg-red-500'
      }
    }

    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'failed': return 'bg-red-500'
      case 'paused': return 'bg-yellow-500'
      default: return 'bg-blue-500'
    }
  }

  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  }

  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')
  }

  const formatETA = (eta?: number) => {
    if (!eta) return null
    
    const minutes = Math.floor(eta / 60)
    const seconds = Math.floor(eta % 60)
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s remaining`
    }
    return `${seconds}s remaining`
  }

  return (
    <div className={cn("space-y-2", className)}>
      {showDetails && (
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className="font-medium">
              {config.operationType.charAt(0).toUpperCase() + config.operationType.slice(1)}
            </span>
            {!isConnected && (
              <span className="text-xs text-gray-400">(offline)</span>
            )}
          </div>
          
          <div className="flex items-center space-x-2 text-gray-600">
            {showStatus && (
              <span className="text-xs">
                {formatStatus(status)}
              </span>
            )}
            <span className="text-xs font-mono">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      )}

      <Progress.Root
        className={cn(
          "relative overflow-hidden bg-gray-200 rounded-full",
          sizeClasses[size]
        )}
        value={progress}
        max={100}
      >
        <Progress.Indicator
          className={cn(
            "h-full w-full flex-1 transition-all duration-300 ease-in-out rounded-full",
            getProgressColor()
          )}
          style={{ transform: `translateX(-${100 - progress}%)` }}
        />
      </Progress.Root>

      {(error || (showETA && data?.estimatedTimeRemaining)) && (
        <div className="text-xs text-gray-500">
          {error && (
            <div className="text-red-500 flex items-center space-x-1">
              <XCircle className="h-3 w-3" />
              <span>{error}</span>
            </div>
          )}
          {showETA && data?.estimatedTimeRemaining && (
            <div className="text-gray-600">
              {formatETA(data.estimatedTimeRemaining)}
            </div>
          )}
        </div>
      )}

      {showDetails && data && (
        <div className="text-xs text-gray-500 space-y-1">
          {data.processed !== undefined && data.total !== undefined && (
            <div>
              Processed: {data.processed.toLocaleString()} / {data.total.toLocaleString()}
            </div>
          )}
          {data.processingRate && (
            <div>
              Rate: {data.processingRate.toFixed(1)} items/sec
            </div>
          )}
          {data.uploadSpeed && (
            <div>
              Speed: {(data.uploadSpeed / 1024 / 1024).toFixed(1)} MB/s
            </div>
          )}
        </div>
      )}
    </div>
  )
}