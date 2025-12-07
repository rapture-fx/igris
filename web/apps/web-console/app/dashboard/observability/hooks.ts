import { useQuery, useQueryClient } from '@tanstack/react-query';

type RequestTag = 'expected' | 'bug' | 'reviewed' | 'spam' | 'golden' | null;

interface RequestTrace {
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

interface RealTimeMetrics {
  requestsPerSecond: number;
  avgLatency: number;
  errorRate: number;
  totalTokens: number;
  totalCost: number;
  cacheHitRate: number;
  activeProviders: string[];
  statusDistribution: Record<string, number>;
}

const API_BASE_URL = typeof window !== 'undefined'
  ? window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : `https://api.${window.location.hostname}`
  : 'http://localhost:8000';

export function useTraces() {
  return useQuery<RequestTrace[]>({
    queryKey: ['traces'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/v1/traces?limit=150`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to fetch traces');
      const data = await response.json();
      return data?.traces || [];
    },
    refetchInterval: 5000,
    staleTime: 3000,
  });
}

export function useRealTimeMetrics() {
  return useQuery<RealTimeMetrics>({
    queryKey: ['realTimeMetrics'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/v1/metrics/realtime`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        return {
          requestsPerSecond: 0,
          avgLatency: 0,
          errorRate: 0,
          totalTokens: 0,
          totalCost: 0,
          cacheHitRate: 0,
          activeProviders: [],
          statusDistribution: {},
        };
      }
      return response.json();
    },
    refetchInterval: 5000,
    staleTime: 3000,
  });
}

export function useInvalidateTraces() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['traces'] });
    queryClient.invalidateQueries({ queryKey: ['realTimeMetrics'] });
  };
}
