'use client';

import { XCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ENV } from '@/lib/config';
import { getErrorMessage } from '@/lib/mockDataGuard';

interface ErrorStateProps {
  error?: unknown;
  title?: string;
  description?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
  showDetails?: boolean;
}

/**
 * Error State UI
 *
 * Shown when data fetching fails or an error occurs.
 * In production, shows user-friendly messages.
 * In development, can show detailed error information.
 */
export function ErrorState({
  error,
  title = 'Something went wrong',
  description,
  onRetry,
  onGoHome,
  showDetails = ENV.isDevelopment,
}: ErrorStateProps) {
  const errorMessage = description || (error ? getErrorMessage(error) : 'An unexpected error occurred');
  const detailedError = error instanceof Error ? error.stack : String(error);

  return (
    <div className="flex items-center justify-center p-8">
      <Card className="max-w-lg w-full border-border-light">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <XCircle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-lg font-semibold text-gray-900">
            {title}
          </CardTitle>
          <CardDescription className="text-sm text-gray-600 mt-2">
            {errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {showDetails && detailedError && (
            <div className="bg-gray-100 rounded-lg p-3 border border-gray-200">
              <p className="text-xs font-mono text-gray-700 whitespace-pre-wrap">
                {detailedError}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            {onRetry && (
              <Button
                onClick={onRetry}
                className="flex-1 flex items-center justify-center gap-2"
                variant="outline"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            )}
            {onGoHome && (
              <Button
                onClick={onGoHome}
                className="flex-1 flex items-center justify-center gap-2"
                variant="outline"
              >
                <Home className="h-4 w-4" />
                Go Home
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
