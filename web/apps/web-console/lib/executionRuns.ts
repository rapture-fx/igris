'use client';

import { api } from '@/lib/apiClient';

interface FetchOptions {
  strict?: boolean;
}

export interface ExecutionRun {
  id: string;
  agent_id: string;
  model: string;
  device_id: string;
  started_at: string;
  ended_at?: string;
  duration_ms?: number;
  status: string;
  has_violation: boolean;
  receipt_id?: string;
  receipt_signature?: string;
  receipt_hash?: string;
  receipt_previous_hash?: string;
  policy_snapshot?: Record<string, unknown>;
  capability_snapshot?: Record<string, unknown>;
  logs?: string[];
  llm_proposal?: string;
  enforced_output?: string;
  verification_status?: string;
}

export interface ReceiptViolationRecord {
  timestamp?: string;
  violation_type: string;
  policy_rule?: string;
  action_taken?: string;
  severity?: string;
  limit_value?: number | null;
  observed_value?: number | null;
}

export interface ExecutionReceipt {
  id: string;
  execution_id: string;
  agent_id: string;
  device_id: string;
  timestamp: string;
  start_time?: string;
  end_time?: string;
  status?: 'verified' | 'unverified' | 'failed';
  verification_status?: string;
  signature?: string;
  hash?: string;
  prev_hash?: string;
  has_violation: boolean;
  signed?: boolean;
  model?: string;
  duration?: number;
  duration_ms?: number;
  public_key?: string;
  violations?: ReceiptViolationRecord[];
  violation_type?: string;
  limit_value?: number;
  observed_value?: number;
  device_context?: Record<string, unknown>;
  agent_context?: Record<string, unknown>;
}

export interface ExecutionViolation {
  id: string;
  agent_id: string;
  device_id: string;
  timestamp: string;
  execution_id: string;
  status?: string;
  violation_type?: string;
  severity?: string;
  policy_rule?: string;
  capability_rule?: string;
  bounds_rule?: string;
  action_taken?: string;
  execution_state?: string;
  supervisor_action?: string;
  containment_result?: string;
  hash?: string;
  previous_hash?: string;
  signature?: string;
  details?: Record<string, unknown> | null;
  limit_value?: number | null;
  observed_value?: number | null;
}

export interface ExecutionRunReceiptReference {
  id: string;
  hash?: string;
  previous_hash?: string;
  signature?: string;
  signed: boolean;
  verification_status?: string;
}

export interface ExecutionRunEvent {
  timestamp: string;
  kind: string;
  message: string;
}

export interface ExecutionRunDetail extends ExecutionRun {
  route_decision?: string | null;
  provider?: string | null;
  provider_path?: string | null;
  receipt?: ExecutionRunReceiptReference | null;
  violations?: ExecutionViolation[];
  events?: ExecutionRunEvent[];
  logs?: string[];
}

export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

export async function fetchExecutionRuns(params: {
  limit?: number;
  offset?: number;
  sort?: string;
  range?: string;
  status?: string;
} = {}, options: FetchOptions = {}): Promise<ExecutionRun[]> {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));
  if (params.sort) query.set('sort', params.sort);
  if (params.range) query.set('range', params.range);
  if (params.status) query.set('status', params.status);

  const suffix = query.toString();
  return api.get<ExecutionRun[]>(`/v1/execution/runs${suffix ? `?${suffix}` : ''}`, {
    allowMockFallback: !options.strict,
  });
}

export async function fetchExecutionRun(id: string, options: FetchOptions = {}): Promise<ExecutionRunDetail | null> {
  return api.get<ExecutionRunDetail>(`/v1/execution/runs/${encodeURIComponent(id)}`, {
    allowMockFallback: !options.strict,
  });
}

export async function fetchExecutionReceipts(limit = 500, options: FetchOptions = {}): Promise<ExecutionReceipt[]> {
  try {
    return await api.get<ExecutionReceipt[]>(`/proof/receipts?limit=${limit}&sort=timestamp:desc`, {
      allowMockFallback: !options.strict,
    });
  } catch {
    if (options.strict) {
      throw new Error('Failed to load execution receipts from /proof/receipts');
    }
    try {
      return await api.get<ExecutionReceipt[]>(`/v1/proof/receipts?limit=${limit}&sort=timestamp:desc`);
    } catch {
      return [];
    }
  }
}

export async function fetchExecutionViolations(
  range = 'last_24h',
  limit = 500,
  options: FetchOptions = {},
): Promise<ExecutionViolation[]> {
  return api.get<ExecutionViolation[]>(`/v1/proof/violations?range=${range}&limit=${limit}`, {
    allowMockFallback: !options.strict,
  });
}
