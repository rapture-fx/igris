'use client';

import { ReactNode } from 'react';
import { useBackendHealth } from '@/hooks/useBackendHealth';
import { ServiceUnavailable } from '@/components/states/ServiceUnavailable';
import { FEATURE_FLAGS } from '@/lib/config';

interface HealthCheckGateProps {
  children: ReactNode;
  /**
   * If true, skip health check and render children directly.
   * Useful for development when backend might be down.
   */
  skipHealthCheck?: boolean;
}

/**
 * Health Check Gate
 *
 * This component acts as a safety gate that prevents the dashboard from
 * rendering when the backend API is unavailable.
 *
 * CRITICAL FOR PRODUCTION SAFETY:
 * - Prevents users from seeing mock data
 * - Prevents users from seeing empty/broken dashboards
 * - Shows clear service status instead of confusing errors
 *
 * In production (NEXT_PUBLIC_ENV=production), this gate is ALWAYS enforced.
 * In development, it can be bypassed if NEXT_PUBLIC_ENABLE_MOCK_DATA=true.
 */
export function HealthCheckGate({ children, skipHealthCheck = false }: HealthCheckGateProps) {
  const { data: health, isLoading, refetch } = useBackendHealth();

  // Skip health check in development if explicitly disabled
  // OR if mock data is enabled (development convenience)
  const shouldSkip = skipHealthCheck || (!FEATURE_FLAGS.requireHealthCheck && FEATURE_FLAGS.enableMockData);

  if (shouldSkip) {
    // Development mode with mock data enabled - allow bypass
    return <>{children}</>;
  }

  // Loading health check
  if (isLoading || !health) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-beige-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Checking service status...</p>
        </div>
      </div>
    );
  }

  // Backend is unhealthy - block rendering
  if (!health.isHealthy) {
    return (
      <ServiceUnavailable
        message={health.message}
        lastChecked={health.checkedAt}
        onRetry={() => refetch()}
      />
    );
  }

  // Backend is healthy - render children
  return <>{children}</>;
}
