import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';

export type RequestTag = 'expected' | 'bug' | 'reviewed' | 'spam' | 'golden' | null;

export interface RequestTrace {
  id: string;
  timestamp: string;
  model: string;
  model_version?: string;
  model_fingerprint?: string;
  provider: string;
  status: number;
  latency: number;
  cost: number;
  cost_breakdown: {
    input: number;
    output: number;
    overhead: number;
  };
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  user_id?: string;
  session_id?: string;
  client_ip?: string;
  user_agent?: string;
  request_id: string;
  parent_request_id?: string;
  child_request_ids?: string[];
  headers?: Record<string, string>;
  request_body?: any;
  response_body?: any;
  prompt?: string;
  completion?: string;
  generation_params?: any;
  error?: {
    message: string;
    stack?: string;
    provider_error?: string;
  };
  token_timeline?: Array<{ token_index: number; timestamp: number; is_first?: boolean; is_last?: boolean }>;
  speculative_traces?: any[];
  retry_attempts?: any[];
  retry_count?: number;
  tag?: RequestTag;
  shared_url?: string;
  curl_command?: string;
  was_streamed: boolean;
  used_speculative: boolean;
  cache_hit?: boolean;
  cache_savings?: number;
  evaluation_score?: number;
  human_feedback?: 'positive' | 'negative' | null;
  timeline_markers?: any[];
}

export interface RealTimeMetrics {
  requestsPerSecond: number;
  avgLatency: number;
  errorRate: number;
  totalTokens: number;
  totalCost: number;
  cacheHitRate: number;
  activeProviders: string[];
  statusDistribution: Record<string, number>;
  requestsSparkline?: Array<{ time: number; value: number }>;
}

export function useTraces(limit = 150) {
  return useQuery<RequestTrace[]>({
    queryKey: ['traces', limit],
    queryFn: async () => {
      try {
        const res = await api.get<{ traces: RequestTrace[] } | RequestTrace[]>(
          `/v1/traces?limit=${limit}`,
        );
        return Array.isArray(res) ? res : (res as { traces: RequestTrace[] }).traces ?? [];
      } catch {
        return [] as RequestTrace[];
      }
    },
    refetchInterval: 10_000,
    staleTime: 5_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useRealTimeMetrics() {
  return useQuery<RealTimeMetrics>({
    queryKey: ['realTimeMetrics'],
    queryFn: () => api.get<RealTimeMetrics>('/v1/metrics/realtime'),
    refetchInterval: 5_000,
    staleTime: 3_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useInvalidateTraces() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['traces'] });
    queryClient.invalidateQueries({ queryKey: ['realTimeMetrics'] });
  };
}
