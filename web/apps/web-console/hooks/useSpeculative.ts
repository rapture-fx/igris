import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { API_ENDPOINTS, QUERY_KEYS } from '@/utils/constants';
import { handleApiError } from '@/lib/mockDataGuard';

// Speculative Router Status
export interface SpeculativeStatus {
  enabled: boolean;
  success_rate: number;
  latency_improvement_ms: number;
  cost_delta_percent: number;
  races_24h: number;
  wins_by_provider: { [provider: string]: number };
}

// Speculative Router Config
export interface SpeculativeConfig {
  enabled: boolean;
  max_parallel_providers: number;
  timeout_ms: number;
  first_token_threshold_ms: number;
  enabled_providers: string[];
}

// Speculative Analytics
export interface SpeculativeAnalytics {
  race_win_rate: {
    provider: string;
    wins: number;
    total_races: number;
    win_rate: number;
  }[];
  latency_distribution: {
    bucket: string;
    count: number;
  }[];
  cost_savings_timeline: {
    timestamp: string;
    savings_usd: number;
    cumulative_savings: number;
  }[];
  performance_by_model: {
    model: string;
    avg_latency: number;
    win_rate: number;
  }[];
}

// Race Entry
export interface RaceEntry {
  request_id: string;
  timestamp: string;
  winner: string;
  participants: string[];
  latency_gain_ms: number;
  cost_saving_usd: number;
  first_token_time_ms: number;
}

// Hook: Get Speculative Status
export function useSpeculativeStatus() {
  return useQuery<SpeculativeStatus>({
    queryKey: [QUERY_KEYS.SPECULATIVE_STATUS],
    queryFn: async () => {
      try {
        return await api.get<SpeculativeStatus>(API_ENDPOINTS.SPECULATIVE_STATUS);
      } catch (error) {
        // Mock data
        return handleApiError<SpeculativeStatus>(
          error,
          {
          enabled: true,
          success_rate: 94.5,
          latency_improvement_ms: 127,
          cost_delta_percent: 8.3,
          races_24h: 3421,
          wins_by_provider: {
            'OpenAI': 1234,
            'Anthropic': 1098,
            'Google': 789,
            'xAI': 300,
          },
        },
          'useSpeculativeStatus'
        );
      }
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

// Hook: Get Speculative Config
export function useSpeculativeConfig() {
  return useQuery<SpeculativeConfig>({
    queryKey: [QUERY_KEYS.SPECULATIVE_CONFIG],
    queryFn: async () => {
      try {
        return await api.get<SpeculativeConfig>(API_ENDPOINTS.SPECULATIVE_CONFIG);
      } catch (error) {
        // Mock data
        return handleApiError<SpeculativeConfig>(
          error,
          {
          enabled: true,
          max_parallel_providers: 3,
          timeout_ms: 2000,
          first_token_threshold_ms: 500,
          enabled_providers: ['OpenAI', 'Anthropic', 'Google', 'xAI'],
        },
          'useSpeculativeConfig'
        );
      }
    },
    staleTime: 60 * 1000,
  });
}

// Hook: Get Speculative Analytics
export function useSpeculativeAnalytics() {
  return useQuery<SpeculativeAnalytics>({
    queryKey: [QUERY_KEYS.SPECULATIVE_ANALYTICS],
    queryFn: async () => {
      try {
        return await api.get<SpeculativeAnalytics>(API_ENDPOINTS.SPECULATIVE_ANALYTICS);
      } catch (error) {
        // Mock data
        const now = Date.now();
        return handleApiError<SpeculativeAnalytics>(
          error,
          {
          race_win_rate: [
            { provider: 'OpenAI', wins: 1234, total_races: 3421, win_rate: 36.1 },
            { provider: 'Anthropic', wins: 1098, total_races: 3421, win_rate: 32.1 },
            { provider: 'Google', wins: 789, total_races: 3421, win_rate: 23.1 },
            { provider: 'xAI', wins: 300, total_races: 3421, win_rate: 8.7 },
          ],
          latency_distribution: [
            { bucket: '0-100ms', count: 456 },
            { bucket: '100-200ms', count: 1234 },
            { bucket: '200-300ms', count: 987 },
            { bucket: '300-400ms', count: 543 },
            { bucket: '400-500ms', count: 201 },
          ],
          cost_savings_timeline: Array.from({ length: 24 }, (_, i) => ({
            timestamp: new Date(now - (23 - i) * 60 * 60 * 1000).toISOString(),
            savings_usd: Math.random() * 15 + 5,
            cumulative_savings: (i + 1) * 12.5,
          })),
          performance_by_model: [
            { model: 'gpt-4-turbo', avg_latency: 145, win_rate: 38.2 },
            { model: 'claude-3-opus', avg_latency: 156, win_rate: 34.5 },
            { model: 'gemini-pro', avg_latency: 178, win_rate: 27.3 },
          ],
        },
          'useSpeculativeAnalytics'
        );
      }
    },
    staleTime: 60 * 1000,
  });
}

// Hook: Get Race History
export function useSpeculativeRaces(limit: number = 50) {
  return useQuery<RaceEntry[]>({
    queryKey: [QUERY_KEYS.SPECULATIVE_RACES, limit],
    queryFn: async () => {
      try {
        return await api.get<RaceEntry[]>(`${API_ENDPOINTS.SPECULATIVE_RACES}?limit=${limit}`);
      } catch (error) {
        // Mock data
        const providers = ['OpenAI', 'Anthropic', 'Google', 'xAI'];
        return Array.from({ length: 10 }, (_, i) => ({
          request_id: `race_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(Date.now() - i * 3 * 60 * 1000).toISOString(),
          winner: providers[Math.floor(Math.random() * providers.length)],
          participants: providers.slice(0, 3),
          latency_gain_ms: Math.floor(Math.random() * 200) + 50,
          cost_saving_usd: Math.random() * 0.02 + 0.005,
          first_token_time_ms: Math.floor(Math.random() * 300) + 100,
        }));
      }
    },
    staleTime: 30 * 1000,
  });
}

// Mutation: Update Speculative Config
export function useUpdateSpeculativeConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: SpeculativeConfig) => {
      return await api.patch<SpeculativeConfig>(API_ENDPOINTS.SPECULATIVE_CONFIG, config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SPECULATIVE_CONFIG] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SPECULATIVE_STATUS] });
    },
  });
}

// Mutation: Force Simulation
export function useForceSimulation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return await api.post(API_ENDPOINTS.SPECULATIVE_SIMULATE);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SPECULATIVE_RACES] });
    },
  });
}
