import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { API_ENDPOINTS, QUERY_KEYS } from '@/utils/constants';

// Shadow Mode Status
export interface ShadowStatus {
  enabled: boolean;
  shadow_traffic_percent: number;
  requests_24h: number;
  quality_delta: number;
  discrepancies_found: number;
  last_updated: string;
}

// Shadow Mode Config
export interface ShadowConfig {
  enabled: boolean;
  shadow_percent: number;
  primary_provider: string;
  shadow_provider: string;
  quality_threshold: number;
  auto_promote: boolean;
  auto_promote_threshold: number;
}

// Shadow Analytics
export interface ShadowAnalytics {
  latency_comparison: {
    timestamp: string;
    primary_latency: number;
    shadow_latency: number;
  }[];
  cost_comparison: {
    timestamp: string;
    primary_cost: number;
    shadow_cost: number;
  }[];
  quality_comparison: {
    timestamp: string;
    primary_quality: number;
    shadow_quality: number;
  }[];
  discrepancy_rate: {
    timestamp: string;
    rate: number;
  }[];
}

// Shadow Log Entry
export interface ShadowLogEntry {
  request_id: string;
  timestamp: string;
  primary_provider: string;
  shadow_provider: string;
  primary_latency: number;
  shadow_latency: number;
  primary_cost: number;
  shadow_cost: number;
  quality_match: boolean;
  discrepancy: string | null;
}

// Hook: Get Shadow Status
export function useShadowStatus() {
  return useQuery<ShadowStatus>({
    queryKey: [QUERY_KEYS.SHADOW_STATUS],
    queryFn: async () => {
      try {
        return await api.get<ShadowStatus>(API_ENDPOINTS.SHADOW_STATUS);
      } catch (error) {
        // Mock data
        return {
          enabled: true,
          shadow_traffic_percent: 10,
          requests_24h: 2847,
          quality_delta: -2.3,
          discrepancies_found: 12,
          last_updated: new Date().toISOString(),
        };
      }
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

// Hook: Get Shadow Config
export function useShadowConfig() {
  return useQuery<ShadowConfig>({
    queryKey: [QUERY_KEYS.SHADOW_CONFIG],
    queryFn: async () => {
      try {
        return await api.get<ShadowConfig>(API_ENDPOINTS.SHADOW_CONFIG);
      } catch (error) {
        // Mock data
        return {
          enabled: true,
          shadow_percent: 10,
          primary_provider: 'OpenAI',
          shadow_provider: 'Anthropic',
          quality_threshold: 85,
          auto_promote: false,
          auto_promote_threshold: 95,
        };
      }
    },
    staleTime: 60 * 1000,
  });
}

// Hook: Get Shadow Analytics
export function useShadowAnalytics() {
  return useQuery<ShadowAnalytics>({
    queryKey: [QUERY_KEYS.SHADOW_ANALYTICS],
    queryFn: async () => {
      try {
        return await api.get<ShadowAnalytics>(API_ENDPOINTS.SHADOW_ANALYTICS);
      } catch (error) {
        // Mock data
        const now = Date.now();
        return {
          latency_comparison: Array.from({ length: 24 }, (_, i) => ({
            timestamp: new Date(now - (23 - i) * 60 * 60 * 1000).toISOString(),
            primary_latency: Math.floor(Math.random() * 100) + 150,
            shadow_latency: Math.floor(Math.random() * 100) + 140,
          })),
          cost_comparison: Array.from({ length: 24 }, (_, i) => ({
            timestamp: new Date(now - (23 - i) * 60 * 60 * 1000).toISOString(),
            primary_cost: Math.random() * 0.05 + 0.03,
            shadow_cost: Math.random() * 0.04 + 0.025,
          })),
          quality_comparison: Array.from({ length: 24 }, (_, i) => ({
            timestamp: new Date(now - (23 - i) * 60 * 60 * 1000).toISOString(),
            primary_quality: Math.random() * 10 + 85,
            shadow_quality: Math.random() * 10 + 87,
          })),
          discrepancy_rate: Array.from({ length: 24 }, (_, i) => ({
            timestamp: new Date(now - (23 - i) * 60 * 60 * 1000).toISOString(),
            rate: Math.random() * 5,
          })),
        };
      }
    },
    staleTime: 60 * 1000,
  });
}

// Hook: Get Shadow Logs
export function useShadowLogs(limit: number = 50) {
  return useQuery<ShadowLogEntry[]>({
    queryKey: [QUERY_KEYS.SHADOW_LOGS, limit],
    queryFn: async () => {
      try {
        return await api.get<ShadowLogEntry[]>(`${API_ENDPOINTS.SHADOW_LOGS}?limit=${limit}`);
      } catch (error) {
        // Mock data
        return Array.from({ length: 10 }, (_, i) => ({
          request_id: `req_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(Date.now() - i * 5 * 60 * 1000).toISOString(),
          primary_provider: 'OpenAI',
          shadow_provider: 'Anthropic',
          primary_latency: Math.floor(Math.random() * 100) + 150,
          shadow_latency: Math.floor(Math.random() * 100) + 140,
          primary_cost: Math.random() * 0.05 + 0.03,
          shadow_cost: Math.random() * 0.04 + 0.025,
          quality_match: Math.random() > 0.1,
          discrepancy: Math.random() > 0.9 ? 'Quality score mismatch' : null,
        }));
      }
    },
    staleTime: 30 * 1000,
  });
}

// Mutation: Update Shadow Config
export function useUpdateShadowConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: ShadowConfig) => {
      return await api.patch<ShadowConfig>(API_ENDPOINTS.SHADOW_CONFIG, config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SHADOW_CONFIG] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SHADOW_STATUS] });
    },
  });
}

// Mutation: Start Shadow Mode
export function useStartShadow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return await api.post(API_ENDPOINTS.SHADOW_START);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SHADOW_STATUS] });
    },
  });
}

// Mutation: Stop Shadow Mode
export function useStopShadow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return await api.post(API_ENDPOINTS.SHADOW_STOP);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SHADOW_STATUS] });
    },
  });
}

// Mutation: Promote Shadow Provider
export function usePromoteShadow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return await api.post(API_ENDPOINTS.SHADOW_PROMOTE);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SHADOW_CONFIG] });
    },
  });
}
