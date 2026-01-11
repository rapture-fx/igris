import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { API_ENDPOINTS, QUERY_KEYS } from '@/utils/constants';
import { handleApiError } from '@/lib/mockDataGuard';

// EscapeVector Status
export interface EscapeVectorStatus {
  cache_status: 'active' | 'expired' | 'empty';
  time_remaining_hours: number;
  last_refresh: string;
  hit_rate_24h: number;
  estimated_savings: number;
  total_entries: number;
  cache_size_mb: number;
}

// EscapeVector Config
export interface EscapeVectorConfig {
  enabled: boolean;
  cache_ttl_hours: number;
  min_quality_threshold: number;
  refresh_interval_hours: number;
}

// EscapeVector History Entry
export interface EscapeVectorHistoryEntry {
  timestamp: string;
  trigger: 'manual' | 'auto';
  size_mb: number;
  ttl_hours: number;
  entries_count: number;
}

// EscapeVector Analytics
export interface EscapeVectorAnalytics {
  cache_usage_timeline: {
    timestamp: string;
    cache_hits: number;
    direct_requests: number;
    cache_percentage: number;
  }[];
  cost_savings_timeline: {
    timestamp: string;
    savings_usd: number;
    cumulative_savings: number;
  }[];
  provider_failover_events: {
    provider: string;
    count: number;
    last_occurred: string;
  }[];
  total_requests_24h: number;
  total_cache_hits_24h: number;
  total_savings_24h: number;
  avg_response_time_cache: number;
  avg_response_time_direct: number;
}

// Hook: Get EscapeVector Status
export function useEscapeVectorStatus() {
  return useQuery<EscapeVectorStatus>({
    queryKey: [QUERY_KEYS.ESCAPEVECTOR_STATUS],
    queryFn: async () => {
      try {
        return await api.get<EscapeVectorStatus>(API_ENDPOINTS.ESCAPEVECTOR_STATUS);
      } catch (error) {
        // Return mock data when API unavailable
        return handleApiError<EscapeVectorStatus>(
          error,
          {
          cache_status: 'active',
          time_remaining_hours: 58.3,
          last_refresh: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
          hit_rate_24h: 78.5,
          estimated_savings: 342.67,
          total_entries: 12847,
          cache_size_mb: 234.5,
        },
          'useEscapeVectorStatus'
        );
      }
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

// Hook: Get EscapeVector Config
export function useEscapeVectorConfig() {
  return useQuery<EscapeVectorConfig>({
    queryKey: [QUERY_KEYS.ESCAPEVECTOR_CONFIG],
    queryFn: async () => {
      try {
        return await api.get<EscapeVectorConfig>(API_ENDPOINTS.ESCAPEVECTOR_CONFIG);
      } catch (error) {
        // Return mock data when API unavailable
        return handleApiError<EscapeVectorConfig>(
          error,
          {
          enabled: true,
          cache_ttl_hours: 72,
          min_quality_threshold: 85,
          refresh_interval_hours: 24,
        },
          'useEscapeVectorConfig'
        );
      }
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

// Hook: Get EscapeVector History
export function useEscapeVectorHistory() {
  return useQuery<EscapeVectorHistoryEntry[]>({
    queryKey: [QUERY_KEYS.ESCAPEVECTOR_HISTORY],
    queryFn: async () => {
      try {
        return await api.get<EscapeVectorHistoryEntry[]>(API_ENDPOINTS.ESCAPEVECTOR_HISTORY);
      } catch (error) {
        // Return mock data when API unavailable
        const now = Date.now();
        return [
          {
            timestamp: new Date(now - 14 * 60 * 60 * 1000).toISOString(),
            trigger: 'auto',
            size_mb: 234.5,
            ttl_hours: 72,
            entries_count: 12847,
          },
          {
            timestamp: new Date(now - 38 * 60 * 60 * 1000).toISOString(),
            trigger: 'auto',
            size_mb: 228.3,
            ttl_hours: 72,
            entries_count: 12456,
          },
          {
            timestamp: new Date(now - 62 * 60 * 60 * 1000).toISOString(),
            trigger: 'manual',
            size_mb: 231.7,
            ttl_hours: 72,
            entries_count: 12678,
          },
          {
            timestamp: new Date(now - 86 * 60 * 60 * 1000).toISOString(),
            trigger: 'auto',
            size_mb: 225.1,
            ttl_hours: 72,
            entries_count: 12234,
          },
          {
            timestamp: new Date(now - 110 * 60 * 60 * 1000).toISOString(),
            trigger: 'auto',
            size_mb: 229.8,
            ttl_hours: 72,
            entries_count: 12567,
          },
        ];
      }
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

// Hook: Get EscapeVector Analytics
export function useEscapeVectorAnalytics() {
  return useQuery<EscapeVectorAnalytics>({
    queryKey: [QUERY_KEYS.ESCAPEVECTOR_ANALYTICS],
    queryFn: async () => {
      try {
        return await api.get<EscapeVectorAnalytics>(API_ENDPOINTS.ESCAPEVECTOR_ANALYTICS);
      } catch (error) {
        // Return mock data when API unavailable
        const now = Date.now();
        return handleApiError<EscapeVectorAnalytics>(
          error,
          {
          cache_usage_timeline: Array.from({ length: 24 }, (_, i) => {
            const cache_hits = Math.floor(Math.random() * 400) + 300;
            const direct = Math.floor(Math.random() * 150) + 50;
            return {
              timestamp: new Date(now - (23 - i) * 60 * 60 * 1000).toISOString(),
              cache_hits,
              direct_requests: direct,
              cache_percentage: (cache_hits / (cache_hits + direct)) * 100,
            };
          }),
          cost_savings_timeline: Array.from({ length: 24 }, (_, i) => {
            const savings = Math.random() * 20 + 10;
            return {
              timestamp: new Date(now - (23 - i) * 60 * 60 * 1000).toISOString(),
              savings_usd: savings,
              cumulative_savings: (i + 1) * 15.5,
            };
          }),
          provider_failover_events: [
            { provider: 'OpenAI', count: 23, last_occurred: new Date(now - 2 * 60 * 60 * 1000).toISOString() },
            { provider: 'Anthropic', count: 15, last_occurred: new Date(now - 5 * 60 * 60 * 1000).toISOString() },
            { provider: 'Google', count: 8, last_occurred: new Date(now - 12 * 60 * 60 * 1000).toISOString() },
            { provider: 'xAI', count: 4, last_occurred: new Date(now - 18 * 60 * 60 * 1000).toISOString() },
          ],
          total_requests_24h: 15432,
          total_cache_hits_24h: 12114,
          total_savings_24h: 342.67,
          avg_response_time_cache: 12,
          avg_response_time_direct: 156,
        },
          'useEscapeVectorAnalytics'
        );
      }
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

// Mutation: Update EscapeVector Config
export function useUpdateEscapeVectorConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: EscapeVectorConfig) => {
      return await api.patch<EscapeVectorConfig>(API_ENDPOINTS.ESCAPEVECTOR_CONFIG, config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ESCAPEVECTOR_CONFIG] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ESCAPEVECTOR_STATUS] });
    },
  });
}

// Mutation: Refresh Cache
export function useRefreshEscapeVectorCache() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return await api.post(API_ENDPOINTS.ESCAPEVECTOR_REFRESH);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ESCAPEVECTOR_STATUS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ESCAPEVECTOR_HISTORY] });
    },
  });
}

// Mutation: Clear Cache
export function useClearEscapeVectorCache() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return await api.delete(API_ENDPOINTS.ESCAPEVECTOR_CACHE);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ESCAPEVECTOR_STATUS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ESCAPEVECTOR_HISTORY] });
    },
  });
}
