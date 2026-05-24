'use client';

import React, { Component, ReactNode } from 'react';
import { ErrorState } from '@/components/states/ErrorState';
import { ENV } from '@/lib/config';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global Error Boundary
 *
 * Catches unhandled errors in the component tree and prevents
 * the entire app from crashing.
 *
 * PRODUCTION SAFETY:
 * - Catches errors from failed API calls (after handleApiError throws)
 * - Prevents white screen of death
 * - Shows user-friendly error messages
 * - Logs errors for monitoring in production
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, you would send this to your error monitoring service
    // e.g., Sentry, LogRocket, etc.
    if (ENV.isProduction) {
      // TODO: Send to error monitoring service
      // Example: Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  handleGoHome = () => {
    // Navigate to home page
    if (typeof window !== 'undefined') {
      window.location.href = '/home';
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <ErrorState
          error={this.state.error}
          title="Unexpected Error"
          description="We're sorry, something went wrong. Please try refreshing the page."
          onRetry={this.handleReset}
          onGoHome={this.handleGoHome}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-based error boundary for functional components.
 * Wraps the class-based ErrorBoundary.
 */
export function ErrorBoundaryWrapper({ children, ...props }: ErrorBoundaryProps) {
  return <ErrorBoundary {...props}>{children}</ErrorBoundary>;
}
