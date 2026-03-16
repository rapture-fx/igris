import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { API_ENDPOINTS, QUERY_KEYS } from '@/utils/constants';

export interface FederatedStatus {
  enabled: boolean;
  active_round: number | null;
  total_rounds: number;
  participants: number;
  last_aggregated: string | null;
  privacy_budget: number;
  noise_scale: number;
  updated_at: string;
}

export interface FederatedParticipant {
  id: string;
  device_id: string;
  hostname: string;
  status: 'active' | 'idle' | 'uploading' | 'aggregating';
  updates_count: number;
  last_seen: string;
  model_version: string;
}

export interface FederatedRound {
  id: number;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed';
  participant_count: number;
  updates_received: number;
  aggregation_loss: number | null;
  model_version: string;
}

export interface FederatedConfig {
  enabled: boolean;
  min_participants: number;
  privacy_budget: number;
  noise_scale: number;
  round_interval_mins: number;
  max_rounds_per_day: number;
}

export function useFederatedStatus() {
  return useQuery<FederatedStatus>({
    queryKey: [QUERY_KEYS.FEDERATED_STATUS],
    queryFn: () => api.get(API_ENDPOINTS.FEDERATED_STATUS),
    refetchInterval: 15000,
  });
}

export function useFederatedParticipants() {
  return useQuery<FederatedParticipant[]>({
    queryKey: [QUERY_KEYS.FEDERATED_PARTICIPANTS],
    queryFn: () => api.get(API_ENDPOINTS.FEDERATED_PARTICIPANTS),
    refetchInterval: 10000,
  });
}

export function useFederatedRounds() {
  return useQuery<FederatedRound[]>({
    queryKey: [QUERY_KEYS.FEDERATED_ROUNDS],
    queryFn: () => api.get(API_ENDPOINTS.FEDERATED_ROUNDS),
    refetchInterval: 20000,
  });
}

export function useFederatedConfig() {
  return useQuery<FederatedConfig>({
    queryKey: [QUERY_KEYS.FEDERATED_CONFIG],
    queryFn: () => api.get(API_ENDPOINTS.FEDERATED_CONFIG),
  });
}

export function useStartFederatedRound() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(API_ENDPOINTS.FEDERATED_ROUNDS_START, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FEDERATED_STATUS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FEDERATED_ROUNDS] });
    },
  });
}

export function useUpdateFederatedConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: Partial<FederatedConfig>) =>
      api.put(API_ENDPOINTS.FEDERATED_CONFIG, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FEDERATED_CONFIG] });
    },
  });
}
