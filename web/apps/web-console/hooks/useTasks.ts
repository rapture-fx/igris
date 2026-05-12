import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { API_ENDPOINTS, QUERY_KEYS } from '@/utils/constants';

// ── Types ──────────────────────────────────────────────────────────────────────

export type TaskStatus =
  | 'pending'
  | 'dispatched'
  | 'checkpointed'
  | 'completed'
  | 'failed'
  | 'recovering';

export interface Task {
  task_id: string;
  status: TaskStatus;
  task_type?: string;
  runtime_id?: string;
  dispatched_at?: string;
  completed_at?: string;
  created_at: string;
  deadline_at?: string;
  last_step?: number;
  checkpoint_digest?: string;
  checkpoint_runtime_id?: string;
  checkpoint_summary?: {
    checkpoint_status?: string;
    last_committed_step?: number;
    checkpoint_digest?: string;
    checkpoint_runtime_id?: string;
    resume_token_present?: boolean;
    wal_entry_count?: number;
    proof_status?: string;
  };
  checkpoint_metadata?: unknown;
  failure_reason?: string;
  requested_mode?: string;
  resolved_strategy?: string;
  graph_blackboard?: unknown;
  graph_nodes?: unknown;
  graph_slots?: unknown;
  action_evidence?: ActionEvidenceRow[];
  execution_envelope?: unknown;
  execution_receipt?: unknown;
  proof?: {
    execution_id?: string;
    expected_hash?: string;
    stored_hash?: string;
    signature?: string;
    status?: 'pending' | 'missing' | 'present' | 'verified' | 'mismatch';
    checked_at?: string;
    present?: boolean;
    matched?: boolean;
    // Persisted verification summary (from the last /proof/verify run).
    // Undefined ⇒ verification has not run yet.
    verified?: boolean;
    hash_valid?: boolean;
    signature_matches?: boolean;
    runtime_key_found?: boolean;
    chain_link_valid?: boolean;
    verification_reason?: string;
    verified_at?: string;
  };
  links?: {
    task?: string;
    steps?: string;
    verify?: string;
    run?: string;
    receipt_verify?: string;
  };
}

/**
 * One Action Task V1 step as exposed authoritatively by `GET /v1/tasks/:id`.
 * The backend builds this from the compiled execution graph + WAL + checkpoint
 * blackboard, exposing only safe summaries — never file contents, request/
 * response bodies, or raw records.
 */
export interface ActionEvidenceRow {
  step_index: number;
  node_id?: string;
  action_type: string;
  tool_name?: string;
  status?: string;
  target_summary?: string;
  result_summary?: Record<string, string | number>;
  result_digest?: string;
  runtime_id?: string;
  recorded_at?: string;
}

export interface TaskListResponse {
  tasks: Task[];
  total: number;
}

export interface WalEntry {
  entry_id: string;
  task_id: string;
  step_index: number;
  step_type: unknown;
  status: string;
  input_digest: string;
  output_digest?: string;
  timestamp_ms: number;
  runtime_id: string;
  signature?: string;
}

export interface TaskStepsResponse {
  steps: WalEntry[];
  total: number;
}

// ── Hooks ──────────────────────────────────────────────────────────────────────

/** List recent durable tasks for the current tenant, newest first. */
export function useTasks(opts?: { limit?: number; status?: string }) {
  const params = new URLSearchParams();
  if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts?.status) params.set('status', opts.status);
  const qs = params.toString();

  return useQuery<TaskListResponse>({
    queryKey: [QUERY_KEYS.TASKS_LIST, opts?.status, opts?.limit],
    queryFn: async () => {
      try {
        return await api.get<TaskListResponse>(
          `${API_ENDPOINTS.TASKS_LIST}${qs ? '?' + qs : ''}`,
        );
      } catch {
        return { tasks: [], total: 0 };
      }
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
    retry: false,
  });
}

/** Poll a single durable task by ID. */
export function useTask(taskId: string | null) {
  return useQuery<Task>({
    queryKey: [QUERY_KEYS.TASKS_DETAIL, taskId],
    queryFn: () => api.get<Task>(API_ENDPOINTS.TASKS_GET(taskId!)),
    enabled: !!taskId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || status === 'completed' || status === 'failed') return false;
      return 5_000;
    },
    retry: false,
  });
}

/** Fetch the signed WAL step entries from the latest checkpoint for a task. */
export function useTaskSteps(taskId: string | null) {
  return useQuery<TaskStepsResponse>({
    queryKey: [QUERY_KEYS.TASKS_STEPS, taskId],
    queryFn: async () => {
      try {
        return await api.get<TaskStepsResponse>(API_ENDPOINTS.TASKS_STEPS(taskId!));
      } catch {
        return { steps: [], total: 0 };
      }
    },
    enabled: !!taskId,
    staleTime: 30_000,
    retry: false,
  });
}
