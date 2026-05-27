import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';

export type ActionTargetType = 'mock_demo' | 'webhook' | 'api' | 'local_runtime';
export type ActionPolicyPreset = 'Safe automation' | 'Human-gated' | 'Non-replayable' | 'Read-only';
export type ActionReplayClass = 'retryable' | 'non_retryable' | 'read_only';

export interface ActionDefinition {
  id: string;
  name: string;
  display_name: string;
  description: string;
  target_type: ActionTargetType;
  target_url: string;
  method: string;
  policy_preset: ActionPolicyPreset;
  replay_class: ActionReplayClass;
  approval_required: boolean;
  irreversible: boolean;
  secret_refs: string[];
  target_metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ActionListResponse {
  actions: ActionDefinition[];
}

export interface ActionCreateRequest {
  name: string;
  display_name?: string;
  description?: string;
  target_type: ActionTargetType;
  target_url?: string;
  method?: string;
  policy_preset: ActionPolicyPreset;
  replay_class?: ActionReplayClass;
  approval_required?: boolean;
  irreversible?: boolean;
  secret_refs?: string[];
  target_metadata?: Record<string, unknown>;
}

export interface ActionRunResponse {
  task_id?: string;
  run_id?: string;
  execution_id?: string;
  status: string;
  proof_status?: string;
  console_url?: string;
  error?: string;
  message?: string;
}

export const ACTIONS_QUERY_KEY = 'actions';
export const ACTION_DETAIL_QUERY_KEY = 'action_detail';

export function useActions() {
  return useQuery<ActionListResponse>({
    queryKey: [ACTIONS_QUERY_KEY],
    queryFn: () => api.get<ActionListResponse>('/v1/actions', { allowMockFallback: false }),
    staleTime: 10_000,
    refetchInterval: 15_000,
    retry: false,
  });
}

export function useAction(actionId: string | null) {
  return useQuery<ActionDefinition>({
    queryKey: [ACTION_DETAIL_QUERY_KEY, actionId],
    queryFn: () => api.get<ActionDefinition>(`/v1/actions/${encodeURIComponent(actionId!)}`, { allowMockFallback: false }),
    enabled: Boolean(actionId),
    staleTime: 10_000,
    retry: false,
  });
}

export function useCreateAction() {
  const queryClient = useQueryClient();
  return useMutation<ActionDefinition, Error, ActionCreateRequest>({
    mutationFn: (payload) => api.post<ActionDefinition>('/v1/actions', payload, { allowMockFallback: false }),
    onSuccess: (action) => {
      queryClient.invalidateQueries({ queryKey: [ACTIONS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ACTION_DETAIL_QUERY_KEY, action.id] });
    },
  });
}

export function useRunAction(actionName: string) {
  return useMutation<ActionRunResponse, Error, { input?: Record<string, unknown>; metadata?: Record<string, unknown> }>({
    mutationFn: (payload) => api.post<ActionRunResponse>(
      `/v1/actions/${encodeURIComponent(actionName)}/run`,
      payload,
      { allowMockFallback: false },
    ),
  });
}
