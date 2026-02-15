'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, Bug, ExternalLink } from 'lucide-react'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
  eventId?: string
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, errorInfo: ErrorInfo, retry: () => void) => ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  isolate?: boolean
  level?: 'page' | 'section' | 'component'
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: number | null = null

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    // Call custom error handler
    this.props.onError?.(error, errorInfo)

    // Log to external service (Sentry, LogRocket, etc.)
    this.logErrorToService(error, errorInfo)

    this.setState({
      error,
      errorInfo,
      eventId: this.generateEventId(),
    })
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    try {
      // Send error to monitoring service
      if (process.env.NODE_ENV === 'production') {
        // Example: Sentry integration
        // Sentry.captureException(error, {
        //   contexts: {
        //     react: {
        //       componentStack: errorInfo.componentStack,
        //     },
        //   },
        // })

        // Or custom error logging
        fetch('/api/errors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: {
              message: error.message,
              stack: error.stack,
              name: error.name,
            },
            errorInfo: {
              componentStack: errorInfo.componentStack,
            },
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            userId: this.getUserId(),
          }),
        }).catch(console.error)
      }
    } catch (loggingError) {
      console.error('Failed to log error to service:', loggingError)
    }
  }

  private generateEventId = (): string => {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getUserId = (): string | null => {
    try {
      const userData = localStorage.getItem('user_data')
      return userData ? JSON.parse(userData).id : null
    } catch {
      return null
    }
  }

  private handleRetry = () => {
    // Clear any existing timeout
    if (this.retryTimeoutId) {
      window.clearTimeout(this.retryTimeoutId)
    }

    // Add a small delay to prevent immediate re-errors
    this.retryTimeoutId = window.setTimeout(() => {
      this.setState({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        eventId: undefined,
      })
    }, 100)
  }

  private handleReportError = () => {
    const { error, errorInfo, eventId } = this.state
    
    if (!error) return

    const errorDetails = {
      eventId,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.getUserId(),
    }

    // Create email with error details
    const subject = `Error Report - ${error.name}: ${error.message}`
    const body = `Please describe what you were doing when this error occurred:

---

Event ID: ${eventId}
Timestamp: ${errorDetails.timestamp}
Error: ${error.name}: ${error.message}

Stack Trace:
${error.stack}

Component Stack:
${errorInfo?.componentStack}

URL: ${errorDetails.url}
User Agent: ${errorDetails.userAgent}
User ID: ${errorDetails.userId || 'Anonymous'}

---

Additional Context:
`

    const mailtoLink = `mailto:support@igris-inertial.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.open(mailtoLink)
  }

  private renderErrorLevel() {
    const { level = 'component' } = this.props
    
    switch (level) {
      case 'page':
        return '🔥 Page Error'
      case 'section':
        return '⚠️ Section Error'
      case 'component':
      default:
        return '🐛 Component Error'
    }
  }

  private renderDefaultFallback() {
    const { error, errorInfo, eventId } = this.state
    const { level = 'component' } = this.props

    if (level === 'component') {
      // Minimal error UI for component-level errors
      return (
        <div className="flex items-center justify-center p-4 border border-red-200 bg-red-50 rounded-lg">
          <div className="flex items-center space-x-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm font-medium">Something went wrong</span>
            <button 
              onClick={this.handleRetry}
              className="text-red-600 hover:text-red-700 underline text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    // Full error UI for page/section level errors
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-lg w-full bg-white shadow-lg rounded-lg p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {this.renderErrorLevel()}
            </h1>
            <p className="text-gray-600">
              We're sorry, but something went wrong. Our team has been notified.
            </p>
          </div>

          {/* Error Details (Development Mode) */}
          {process.env.NODE_ENV === 'development' && error && (
            <div className="mb-6 p-4 bg-gray-100 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Error Details:</h3>
              <p className="text-xs text-gray-600 mb-2">{error.name}: {error.message}</p>
              {eventId && (
                <p className="text-xs text-gray-500">Event ID: {eventId}</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={this.handleRetry}
              className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </button>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => window.location.href = '/'}
                className="flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </button>
              
              <button
                onClick={this.handleReportError}
                className="flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Bug className="w-4 h-4 mr-2" />
                Report
              </button>
            </div>
          </div>

          {/* Support Links */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-500 mb-3">
              Need help? Check our support resources:
            </p>
            <div className="flex justify-center space-x-4 text-sm">
              <a 
                href="/help" 
                className="text-blue-600 hover:text-blue-700 flex items-center"
              >
                Help Center
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
              <a 
                href="/docs" 
                className="text-blue-600 hover:text-blue-700 flex items-center"
              >
                Documentation
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      window.clearTimeout(this.retryTimeoutId)
    }
  }

  render() {
    const { hasError, error, errorInfo } = this.state
    const { children, fallback } = this.props

    if (hasError && error && errorInfo) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback(error, errorInfo, this.handleRetry)
      }

      // Use default fallback
      return this.renderDefaultFallback()
    }

    return children
  }
}

// Higher-order component for adding error boundaries
export function withErrorBoundary<T extends {}>(
  Component: React.ComponentType<T>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  return function ErrorBoundaryWrappedComponent(props: T) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}

// Hook for triggering error boundaries
export function useErrorHandler() {
  return (error: Error, errorInfo?: ErrorInfo) => {
    // Trigger error boundary by throwing the error
    // This should be used in event handlers and effects
    throw error
  }
}

// Async error boundary for handling promise rejections
export class AsyncErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AsyncErrorBoundary caught an error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  componentDidMount() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', this.handlePromiseRejection)
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handlePromiseRejection)
  }

  handlePromiseRejection = (event: PromiseRejectionEvent) => {
    console.error('Unhandled promise rejection:', event.reason)
    
    // Create error from rejection
    const error = event.reason instanceof Error 
      ? event.reason 
      : new Error(String(event.reason))

    this.setState({
      hasError: true,
      error,
      eventId: `promise_rejection_${Date.now()}`,
    })

    // Prevent default browser behavior
    event.preventDefault()
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorBoundary {...this.props}>
          {this.props.children}
        </ErrorBoundary>
      )
    }

    return this.props.children
  }
}

// Global error handler setup
export function setupGlobalErrorHandling() {
  // Handle uncaught JavaScript errors
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error)
    
    // Log to monitoring service
    if (process.env.NODE_ENV === 'production') {
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'global_error',
          error: {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error?.stack,
          },
          timestamp: new Date().toISOString(),
        }),
      }).catch(console.error)
    }
  })

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Global unhandled promise rejection:', event.reason)
    
    if (process.env.NODE_ENV === 'production') {
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'unhandled_rejection',
          error: {
            reason: String(event.reason),
            stack: event.reason?.stack,
          },
          timestamp: new Date().toISOString(),
        }),
      }).catch(console.error)
    }
  })
}

export default ErrorBoundary