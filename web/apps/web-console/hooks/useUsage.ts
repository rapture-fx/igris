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
    queryFn: () => api.get<UsageMetrics>(endpoint),
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useUsageSummary() {
  return useQuery<UsageSummary>({
    queryKey: [QUERY_KEYS.USAGE_SUMMARY],
    queryFn: () => api.get<UsageSummary>(API_ENDPOINTS.USAGE_SUMMARY),
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}
