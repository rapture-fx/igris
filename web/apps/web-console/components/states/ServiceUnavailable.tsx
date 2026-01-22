'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ServiceUnavailableProps {
  message?: string;
  lastChecked?: string;
  onRetry?: () => void;
}

/**
 * Service Unavailable UI
 *
 * Shown when the backend API is unreachable or unhealthy.
 * This prevents users from seeing mock data or broken dashboards.
 */
export function ServiceUnavailable({
  message = 'Our service is temporarily unavailable',
  lastChecked,
  onRetry,
}: ServiceUnavailableProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-beige-primary dark:bg-background p-4">
      <Card className="max-w-lg w-full border-border-light shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-950 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
          </div>
          <CardTitle className="text-xl font-semibold text-gray-900">
            Service Temporarily Unavailable
          </CardTitle>
          <CardDescription className="text-sm text-gray-600 mt-2">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-beige-primary dark:bg-muted rounded-lg p-4 border border-border-light dark:border-border">
            <p className="text-sm text-foreground">
              We're experiencing technical difficulties. Our team has been notified and is working to restore service as quickly as possible.
            </p>
          </div>

          {lastChecked && (
            <p className="text-xs text-muted-foreground text-center">
              Last checked: {new Date(lastChecked).toLocaleTimeString()}
            </p>
          )}

          {onRetry && (
            <Button
              onClick={onRetry}
              className="w-full flex items-center justify-center gap-2"
              variant="outline"
            >
              <RefreshCw className="h-4 w-4" />
              Check Again
            </Button>
          )}

          <div className="pt-4 border-t border-border-light dark:border-border">
            <p className="text-xs text-muted-foreground text-center">
              If this problem persists, please contact support at{' '}
              <a href="mailto:support@igris.com" className="text-blue-600 hover:underline">
                support@igris.com
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
