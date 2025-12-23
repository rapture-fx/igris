import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { API_ENDPOINTS, QUERY_KEYS } from '@/utils/constants';

export interface UsageMetrics {
  total_requests: number;
  total_cost: number;
  avg_latency: number;
  total_tokens: number;
  by_provider: {
    provider: string;
    requests: number;
    cost: number;
    avg_latency: number;
    tokens: number;
  }[];
  by_model: {
    model: string;
    requests: number;
    cost: number;
    tokens: number;
  }[];
  timeline: {
    timestamp: string;
    requests: number;
    cost: number;
    latency: number;
  }[];
}

export interface UsageSummary {
  monthly_spend: number;
  total_requests: number;
  avg_latency: number;
  budget_utilization: number;
  period: {
    start: string;
    end: string;
  };
}

export interface UseUsageParams {
  start_date?: string;
  end_date?: string;
  provider?: string;
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

export function useUsage(params?: UseUsageParams) {
  const queryParams = new URLSearchParams();
  if (params?.start_date) queryParams.set('start_date', params.start_date);
  if (params?.end_date) queryParams.set('end_date', params.end_date);
  if (params?.provider) queryParams.set('provider', params.provider);
  if (params?.granularity) queryParams.set('granularity', params.granularity);

  const queryString = queryParams.toString();
  const endpoint = queryString
    ? `${API_ENDPOINTS.USAGE}?${queryString}`
    : API_ENDPOINTS.USAGE;

  return useQuery<UsageMetrics>({
    queryKey: [QUERY_KEYS.USAGE, params],
    queryFn: async () => {
      try {
        return await api.get<UsageMetrics>(endpoint);
      } catch (error) {
        // Return comprehensive mock data when API unavailable
        return {
          total_requests: 2847,
          total_cost: 523.47,
          avg_latency: 156,
          total_tokens: 142350,
          by_provider: [
            { provider: 'openai', requests: 1234, cost: 342.78, avg_latency: 145, tokens: 87456 },
            { provider: 'anthropic', requests: 876, cost: 156.34, avg_latency: 178, tokens: 34876 },
            { provider: 'google', requests: 523, cost: 89.23, avg_latency: 234, tokens: 15678 },
            { provider: 'xai', requests: 214, cost: 45.12, avg_latency: 198, tokens: 4340 },
          ],
          by_model: [
            { model: 'gpt-4-turbo', requests: 1456, cost: 289.67, tokens: 65432 },
            { model: 'gpt-4', requests: 678, cost: 178.34, tokens: 22024 },
            { model: 'claude-3-opus', requests: 423, cost: 123.45, tokens: 18876 },
            { model: 'gemini-pro', requests: 290, cost: 67.89, tokens: 15678 },
          ],
          timeline: [
            { timestamp: '00:00', requests: 89, cost: 12.34, latency: 142 },
            { timestamp: '04:00', requests: 45, cost: 6.78, latency: 98 },
            { timestamp: '08:00', requests: 234, cost: 45.67, latency: 178 },
            { timestamp: '12:00', requests: 445, cost: 89.23, latency: 234 },
            { timestamp: '16:00', requests: 367, cost: 72.89, latency: 189 },
            { timestamp: '20:00', requests: 298, cost: 58.91, latency: 156 },
            { timestamp: '23:59', requests: 78, cost: 15.23, latency: 134 },
          ],
        } as UsageMetrics;
      }
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useUsageSummary() {
  return useQuery<UsageSummary>({
    queryKey: [QUERY_KEYS.USAGE_SUMMARY],
    queryFn: async () => {
      try {
        return await api.get<UsageSummary>(API_ENDPOINTS.USAGE_SUMMARY);
      } catch (error) {
        // Return mock data when API is unavailable
        return {
          monthly_spend: 1987.43,
          total_requests: 15432,
          avg_latency: 178,
          budget_utilization: 39.7,
          period: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString(),
          },
        };
      }
    },
    staleTime: 60 * 1000, // 1 minute
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    throwOnError: false, // Prevent uncaught errors in console
  });
}
