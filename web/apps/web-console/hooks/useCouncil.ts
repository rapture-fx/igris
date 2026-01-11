import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { API_ENDPOINTS, QUERY_KEYS } from '@/utils/constants';
import { handleApiError } from '@/lib/mockDataGuard';

// Council Status
export interface CouncilStatus {
  enabled: boolean;
  current_council_size: number;
  avg_quality_improvement: number;
  cost_overhead_24h: number;
  last_run: {
    timestamp: string;
    summary: string;
  };
}

// Council Config
export interface CouncilConfig {
  enabled: boolean;
  num_models: number;
  models: string[];
  voting_strategy: 'majority' | 'weighted' | 'chairman-led';
  quality_threshold: number;
  max_tokens: number;
  cost_limit: number;
  chairman_model?: string;
}

// Council Analytics
export interface CouncilAnalytics {
  quality_delta: Array<{
    timestamp: string;
    council: number;
    single: number;
    delta: number;
  }>;
  latency_overhead: Array<{
    model_count: number;
    avg_latency_ms: number;
  }>;
  cost_quality_tradeoff: Array<{
    cost: number;
    quality: number;
    model_count: number;
  }>;
  model_win_rate: Array<{
    model: string;
    wins: number;
    total: number;
    win_rate: number;
  }>;
}

// Council History Entry
export interface CouncilHistoryEntry {
  id: string;
  timestamp: string;
  request_id: string;
  models_used: string[];
  vote_outcome: string;
  quality_score_council: number;
  quality_score_single: number;
  cost_delta: number;
  latency_delta: number;
  full_response?: string;
}

// Hook: Get Council Status
export function useCouncilStatus() {
  return useQuery<CouncilStatus>({
    queryKey: [QUERY_KEYS.COUNCIL_STATUS],
    queryFn: async () => {
      try {
        return await api.get<CouncilStatus>(API_ENDPOINTS.COUNCIL_STATUS);
      } catch (error) {
        return handleApiError<CouncilStatus>(
          error,
          {
            enabled: true,
            current_council_size: 3,
            avg_quality_improvement: 15.2,
            cost_overhead_24h: 2.3,
            last_run: {
              timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
              summary: 'Successfully synthesized response from 3 models with 92% agreement',
            },
          },
          'useCouncilStatus'
        );
      }
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

// Hook: Get Council Config
export function useCouncilConfig() {
  return useQuery<CouncilConfig>({
    queryKey: [QUERY_KEYS.COUNCIL_CONFIG],
    queryFn: async () => {
      try {
        return await api.get<CouncilConfig>(API_ENDPOINTS.COUNCIL_CONFIG);
      } catch (error) {
        return handleApiError<CouncilConfig>(
          error,
          {
            enabled: true,
            num_models: 3,
            models: ['gpt-4', 'claude-3-opus', 'gemini-pro'],
            voting_strategy: 'majority',
            quality_threshold: 85,
            max_tokens: 2000,
            cost_limit: 0.5,
          },
          'useCouncilConfig'
        );
      }
    },
    staleTime: 60 * 1000,
  });
}

// Hook: Get Council Analytics
export function useCouncilAnalytics(timeRange: '24h' | '7d' | '30d' = '24h') {
  return useQuery<CouncilAnalytics>({
    queryKey: [QUERY_KEYS.COUNCIL_ANALYTICS, timeRange],
    queryFn: async () => {
      try {
        return await api.get<CouncilAnalytics>(`${API_ENDPOINTS.COUNCIL_ANALYTICS}?range=${timeRange}`);
      } catch (error) {
        const now = Date.now();
        return handleApiError<CouncilAnalytics>(
          error,
          {
            quality_delta: Array.from({ length: 24 }, (_, i) => ({
              timestamp: new Date(now - (23 - i) * 60 * 60 * 1000).toISOString(),
              council: 85 + Math.random() * 10,
              single: 75 + Math.random() * 8,
              delta: 10 + Math.random() * 5,
            })),
            latency_overhead: [
              { model_count: 2, avg_latency_ms: 1200 },
              { model_count: 3, avg_latency_ms: 1800 },
              { model_count: 4, avg_latency_ms: 2400 },
              { model_count: 5, avg_latency_ms: 3000 },
            ],
            cost_quality_tradeoff: Array.from({ length: 20 }, (_, i) => ({
              cost: 0.01 + i * 0.02,
              quality: 70 + Math.random() * 25,
              model_count: 2 + Math.floor(Math.random() * 4),
            })),
            model_win_rate: [
              { model: 'gpt-4', wins: 145, total: 320, win_rate: 45.3 },
              { model: 'claude-3-opus', wins: 125, total: 320, win_rate: 39.1 },
              { model: 'gemini-pro', wins: 50, total: 320, win_rate: 15.6 },
            ],
          },
          'useCouncilAnalytics'
        );
      }
    },
    staleTime: 60 * 1000,
  });
}

// Hook: Get Council History
export function useCouncilHistory(limit: number = 50) {
  return useQuery<CouncilHistoryEntry[]>({
    queryKey: [QUERY_KEYS.COUNCIL_HISTORY, limit],
    queryFn: async () => {
      try {
        return await api.get<CouncilHistoryEntry[]>(`${API_ENDPOINTS.COUNCIL_HISTORY}?limit=${limit}`);
      } catch (error) {
        const now = Date.now();
        const models = ['gpt-4', 'claude-3-opus', 'gemini-pro', 'gpt-4-turbo'];
        return handleApiError<CouncilHistoryEntry[]>(
          error,
          Array.from({ length: 15 }, (_, i) => ({
            id: `council_${i + 1}`,
            timestamp: new Date(now - i * 15 * 60 * 1000).toISOString(),
            request_id: `req_${Math.random().toString(36).substring(7)}`,
            models_used: models.slice(0, 2 + Math.floor(Math.random() * 3)),
            vote_outcome: i % 3 === 0 ? 'Unanimous' : i % 3 === 1 ? 'Majority (2/3)' : 'Chairman decided',
            quality_score_council: 85 + Math.random() * 10,
            quality_score_single: 75 + Math.random() * 8,
            cost_delta: 0.02 + Math.random() * 0.05,
            latency_delta: 800 + Math.random() * 400,
          })),
          'useCouncilHistory'
        );
      }
    },
    staleTime: 30 * 1000,
  });
}

// Mutation: Update Council Config
export function useUpdateCouncilConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: CouncilConfig) => {
      return await api.patch<CouncilConfig>(API_ENDPOINTS.COUNCIL_CONFIG, config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COUNCIL_CONFIG] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COUNCIL_STATUS] });
    },
  });
}

// Mutation: Test Council
export function useTestCouncil() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prompt: string) => {
      return await api.post(API_ENDPOINTS.COUNCIL_TEST, { prompt });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COUNCIL_HISTORY] });
    },
  });
}
