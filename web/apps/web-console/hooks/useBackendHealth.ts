import { useQuery } from '@tanstack/react-query';
import { FEATURE_FLAGS, API_CONFIG } from '@/lib/config';

export interface BackendHealthStatus {
  isHealthy: boolean;
  status: 'healthy' | 'unhealthy' | 'unknown';
  message?: string;
  checkedAt: string;
}

/**
 * Check backend API health status.
 *
 * This hook polls the backend health endpoint to ensure the API is available.
 * In production, this acts as a gate - if the backend is down, the dashboard
 * should not render and instead show a maintenance/service unavailable message.
 */
export function useBackendHealth() {
  return useQuery<BackendHealthStatus>({
    queryKey: ['backend-health'],
    queryFn: async (): Promise<BackendHealthStatus> => {
      const healthUrl = `${API_CONFIG.baseUrl}${API_CONFIG.healthCheckUrl}`;

      try {
        const response = await fetch(healthUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          // Short timeout for health checks
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          return {
            isHealthy: true,
            status: 'healthy',
            message: data.message || 'Backend is operational',
            checkedAt: new Date().toISOString(),
          };
        } else {
          return {
            isHealthy: false,
            status: 'unhealthy',
            message: `Backend returned ${response.status}`,
            checkedAt: new Date().toISOString(),
          };
        }
      } catch (error) {
        // In development, we might want to allow the dashboard to load anyway
        // In production, we want to block the dashboard from loading
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        return {
          isHealthy: false,
          status: 'unhealthy',
          message: `Health check failed: ${errorMessage}`,
          checkedAt: new Date().toISOString(),
        };
      }
    },
    // Poll every 30 seconds
    refetchInterval: FEATURE_FLAGS.healthCheckInterval,
    // Retry failed health checks
    retry: 3,
    retryDelay: 2000,
    // Always refetch when window regains focus
    refetchOnWindowFocus: true,
    // Don't cache stale health data
    staleTime: 0,
    // Keep trying even if it fails
    refetchOnMount: true,
  });
}

/**
 * Simpler hook that just returns whether the backend is healthy.
 * Useful for conditional rendering.
 */
export function useIsBackendHealthy(): boolean {
  const { data } = useBackendHealth();
  return data?.isHealthy ?? false;
}
