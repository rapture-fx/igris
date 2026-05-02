'use client';

import { api } from '@/lib/apiClient';

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
}

export interface ReceiptViolationRecord {
  timestamp?: string;
  violation_type: string;
  policy_rule?: string;
  action_taken?: string;
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
  kind: string;
  agent_id: string;
  device_id: string;
  timestamp: string;
  created_at?: string;
  execution_id: string;
  limit_value?: number | null;
  observed_value?: number | null;
  execution?: {
    id: string;
    status: string;
    model: string;
    agent_id: string;
    device_id: string;
    started_at: string;
    duration_ms: number;
  };
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
} = {}): Promise<ExecutionRun[]> {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));
  if (params.sort) query.set('sort', params.sort);
  if (params.range) query.set('range', params.range);
  if (params.status) query.set('status', params.status);

  const suffix = query.toString();
  return api.get<ExecutionRun[]>(`/v1/execution/runs${suffix ? `?${suffix}` : ''}`);
}

export async function fetchExecutionRun(id: string): Promise<ExecutionRun | null> {
  try {
    return await api.get<ExecutionRun>(`/v1/execution/runs/${encodeURIComponent(id)}`);
  } catch {
    try {
      const runs = await fetchExecutionRuns({ limit: 500, sort: 'created_at:desc' });
      return runs.find((run) => run.id === id) ?? null;
    } catch {
      return null;
    }
  }
}

export async function fetchExecutionReceipts(limit = 500): Promise<ExecutionReceipt[]> {
  try {
    return await api.get<ExecutionReceipt[]>(`/proof/receipts?limit=${limit}&sort=timestamp:desc`);
  } catch {
    try {
      return await api.get<ExecutionReceipt[]>(`/v1/proof/receipts?limit=${limit}&sort=timestamp:desc`);
    } catch {
      return [];
    }
  }
}

export async function fetchExecutionViolations(range = 'last_24h', limit = 500): Promise<ExecutionViolation[]> {
  try {
    return await api.get<ExecutionViolation[]>(`/v1/proof/violations?range=${range}&limit=${limit}`);
  } catch {
    return [];
  }
}
