import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { API_ENDPOINTS, QUERY_KEYS } from '@/utils/constants';

// Cognitive Advisor Status
export interface CognitiveStatus {
  status: 'active' | 'paused' | 'learning';
  confidence_score: number;
  potential_savings_low: number;
  potential_savings_high: number;
  acceptance_rate: number;
  last_recommendation: {
    timestamp: string;
    summary: string;
  };
  observations_count: number;
  recommendations_count: number;
}

// Observation
export interface Observation {
  id: string;
  timestamp: string;
  type: 'latency' | 'quality' | 'cost' | 'error_rate';
  severity: 'low' | 'medium' | 'high' | 'critical';
  provider?: string;
  model?: string;
  description: string;
  metric_change: number;
  metric_unit: string;
  trend: 'up' | 'down';
}

// Recommendation
export interface Recommendation {
  id: string;
  timestamp: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
  predicted_impact: {
    quality_change: number;
    cost_change: number;
    latency_change: number;
  };
  confidence: number;
  reason: string;
  status: 'pending' | 'applied' | 'scheduled' | 'dismissed' | 'ignored';
}

// History Entry
export interface HistoryEntry {
  id: string;
  date: string;
  action: string;
  accepted: boolean;
  predicted_impact: {
    quality: number;
    cost: number;
    latency: number;
  };
  actual_impact?: {
    quality: number;
    cost: number;
    latency: number;
  };
  variance?: number;
}

// Cognitive Config
export interface CognitiveConfig {
  enabled: boolean;
  aggressiveness: number;
  min_confidence_threshold: number;
  auto_apply_threshold: number;
  observation_window_hours: number;
  learning_mode: boolean;
}

// Hook: Get Cognitive Status
export function useCognitiveStatus() {
  return useQuery<CognitiveStatus>({
    queryKey: [QUERY_KEYS.COGNITIVE_STATUS],
    queryFn: async () => {
      try {
        return await api.get<CognitiveStatus>(API_ENDPOINTS.COGNITIVE_STATUS);
      } catch (error) {
        // Mock data
        return {
          status: 'active',
          confidence_score: 87.5,
          potential_savings_low: 450,
          potential_savings_high: 720,
          acceptance_rate: 78.3,
          last_recommendation: {
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            summary: 'Increase OpenAI weight by 15% due to improved latency',
          },
          observations_count: 5,
          recommendations_count: 3,
        };
      }
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

// Hook: Get Observations
export function useCognitiveObservations() {
  return useQuery<Observation[]>({
    queryKey: [QUERY_KEYS.COGNITIVE_OBSERVATIONS],
    queryFn: async () => {
      try {
        return await api.get<Observation[]>(API_ENDPOINTS.COGNITIVE_OBSERVATIONS);
      } catch (error) {
        // Mock data
        return [
          {
            id: 'obs_1',
            timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            type: 'latency',
            severity: 'high',
            provider: 'OpenAI',
            description: 'Provider latency increased significantly',
            metric_change: 42,
            metric_unit: '% increase in last 6h',
            trend: 'up',
          },
          {
            id: 'obs_2',
            timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
            type: 'quality',
            severity: 'medium',
            model: 'gpt-4',
            description: 'Model quality degradation detected',
            metric_change: 8.5,
            metric_unit: '% quality score drop',
            trend: 'down',
          },
          {
            id: 'obs_3',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            type: 'cost',
            severity: 'medium',
            provider: 'Anthropic',
            description: 'Cost drift above average',
            metric_change: 18,
            metric_unit: '% above baseline',
            trend: 'up',
          },
          {
            id: 'obs_4',
            timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
            type: 'error_rate',
            severity: 'low',
            provider: 'Google',
            description: 'Elevated error rate detected',
            metric_change: 3.2,
            metric_unit: '% error rate',
            trend: 'up',
          },
          {
            id: 'obs_5',
            timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            type: 'latency',
            severity: 'low',
            provider: 'xAI',
            description: 'Latency improvement observed',
            metric_change: 25,
            metric_unit: '% faster response time',
            trend: 'down',
          },
        ];
      }
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

// Hook: Get Recommendations
export function useCognitiveRecommendations() {
  return useQuery<Recommendation[]>({
    queryKey: [QUERY_KEYS.COGNITIVE_RECOMMENDATIONS],
    queryFn: async () => {
      try {
        return await api.get<Recommendation[]>(API_ENDPOINTS.COGNITIVE_RECOMMENDATIONS);
      } catch (error) {
        // Mock data
        return [
          {
            id: 'rec_1',
            timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            priority: 'high',
            action: 'Increase weight of xAI provider by 20%',
            predicted_impact: {
              quality_change: 5.2,
              cost_change: -12.5,
              latency_change: -18.3,
            },
            confidence: 92.5,
            reason: 'xAI showing consistent latency improvements and cost efficiency',
            status: 'pending',
          },
          {
            id: 'rec_2',
            timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            priority: 'medium',
            action: 'Reduce OpenAI routing weight by 15%',
            predicted_impact: {
              quality_change: -2.1,
              cost_change: -8.7,
              latency_change: 12.4,
            },
            confidence: 85.3,
            reason: 'OpenAI latency degradation detected over 6-hour window',
            status: 'pending',
          },
          {
            id: 'rec_3',
            timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
            priority: 'low',
            action: 'Enable caching for gpt-4 model requests',
            predicted_impact: {
              quality_change: 0,
              cost_change: -15.2,
              latency_change: -25.6,
            },
            confidence: 78.9,
            reason: 'High rate of duplicate requests detected',
            status: 'pending',
          },
        ];
      }
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

// Hook: Get History
export function useCognitiveHistory(limit: number = 50) {
  return useQuery<HistoryEntry[]>({
    queryKey: [QUERY_KEYS.COGNITIVE_HISTORY, limit],
    queryFn: async () => {
      try {
        return await api.get<HistoryEntry[]>(`${API_ENDPOINTS.COGNITIVE_HISTORY}?limit=${limit}`);
      } catch (error) {
        // Mock data
        const now = Date.now();
        return Array.from({ length: 10 }, (_, i) => ({
          id: `hist_${i + 1}`,
          date: new Date(now - i * 24 * 60 * 60 * 1000).toISOString(),
          action: i % 3 === 0 ? 'Increased provider weight' : i % 3 === 1 ? 'Adjusted routing rules' : 'Modified cache settings',
          accepted: i % 4 !== 0,
          predicted_impact: {
            quality: Math.random() * 10 - 2,
            cost: Math.random() * -20 - 5,
            latency: Math.random() * -30 - 10,
          },
          actual_impact: i % 4 !== 0 ? {
            quality: Math.random() * 10 - 2,
            cost: Math.random() * -20 - 5,
            latency: Math.random() * -30 - 10,
          } : undefined,
          variance: i % 4 !== 0 ? Math.random() * 20 - 10 : undefined,
        }));
      }
    },
    staleTime: 60 * 1000,
  });
}

// Hook: Get Cognitive Config
export function useCognitiveConfig() {
  return useQuery<CognitiveConfig>({
    queryKey: [QUERY_KEYS.COGNITIVE_CONFIG],
    queryFn: async () => {
      try {
        return await api.get<CognitiveConfig>(API_ENDPOINTS.COGNITIVE_CONFIG);
      } catch (error) {
        // Mock data
        return {
          enabled: true,
          aggressiveness: 50,
          min_confidence_threshold: 75,
          auto_apply_threshold: 90,
          observation_window_hours: 6,
          learning_mode: false,
        };
      }
    },
    staleTime: 60 * 1000,
  });
}

// Mutation: Update Cognitive Config
export function useUpdateCognitiveConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: CognitiveConfig) => {
      return await api.patch<CognitiveConfig>(API_ENDPOINTS.COGNITIVE_CONFIG, config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COGNITIVE_CONFIG] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COGNITIVE_STATUS] });
    },
  });
}

// Mutation: Apply Recommendation
export function useApplyRecommendation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recommendationId: string) => {
      return await api.post(`${API_ENDPOINTS.COGNITIVE_RECOMMENDATIONS}/${recommendationId}/apply`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COGNITIVE_RECOMMENDATIONS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COGNITIVE_HISTORY] });
    },
  });
}

// Mutation: Dismiss Recommendation
export function useDismissRecommendation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recommendationId: string) => {
      return await api.post(`${API_ENDPOINTS.COGNITIVE_RECOMMENDATIONS}/${recommendationId}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COGNITIVE_RECOMMENDATIONS] });
    },
  });
}
