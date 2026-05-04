import type { ChainStatus } from '@/components/proof/HashChainIndicator';
import type { ExecutionReceipt, ReceiptViolationRecord } from '@/lib/executionRuns';

export interface ReceiptEvidenceSource extends ExecutionReceipt {
  cpu_ms?: number;
  memory_mb?: number;
  tokens_used?: number;
  tool_calls?: number;
}

export interface ReceiptEvidenceRecord {
  evidence_type: 'execution_receipt';
  receipt_id: string;
  execution_id: string;
  agent_id: string;
  device_id: string;
  runtime_id: string;
  runtime_label: string;
  timestamp: string;
  start_time: string;
  end_time: string;
  status: string;
  verification_status: string;
  signed: boolean;
  chain_status: ChainStatus;
  has_violation: boolean;
  hash: string;
  previous_hash: string;
  signature: string;
  cpu_ms?: number;
  memory_mb?: number;
  tokens_used?: number;
  tool_calls?: number;
  duration_ms?: number;
  violation_count: number;
  violation_types: string[];
  violations: ReceiptViolationRecord[];
}

export interface ReceiptEvidenceExportFilters {
  time_range: string;
  violations_only: boolean;
  search: string;
}

export interface ReceiptEvidenceListExport {
  exported_at: string;
  filters: ReceiptEvidenceExportFilters;
  receipts: ReceiptEvidenceRecord[];
}

export interface ReceiptEvidenceCSVRow {
  receipt_id: string;
  execution_id: string;
  agent_id: string;
  device_id: string;
  runtime_id: string;
  runtime_label: string;
  timestamp: string;
  start_time: string;
  end_time: string;
  status: string;
  verification_status: string;
  signed: boolean;
  chain_status: ChainStatus;
  has_violation: boolean;
  hash: string;
  previous_hash: string;
  signature: string;
  cpu_ms?: number;
  memory_mb?: number;
  tokens_used?: number;
  tool_calls?: number;
  duration_ms?: number;
  violation_count: number;
  violation_types: string;
}

export function buildReceiptEvidenceRecord(
  receipt: ReceiptEvidenceSource,
  chainStatus: ChainStatus,
): ReceiptEvidenceRecord {
  return {
    evidence_type: 'execution_receipt',
    receipt_id: receipt.id,
    execution_id: receipt.execution_id,
    agent_id: receipt.agent_id,
    device_id: receipt.device_id ?? '',
    runtime_id: receipt.runtime_id ?? '',
    runtime_label: receipt.runtime_label ?? '',
    timestamp: receipt.timestamp,
    start_time: receipt.start_time ?? '',
    end_time: receipt.end_time ?? '',
    status: receipt.status ?? '',
    verification_status: receipt.verification_status ?? receipt.status ?? '',
    signed: receipt.signed ?? false,
    chain_status: chainStatus,
    has_violation: receipt.has_violation,
    hash: receipt.hash ?? '',
    previous_hash: receipt.prev_hash ?? '',
    signature: receipt.signature ?? '',
    cpu_ms: receipt.cpu_ms,
    memory_mb: receipt.memory_mb,
    tokens_used: receipt.tokens_used,
    tool_calls: receipt.tool_calls,
    duration_ms: receipt.duration_ms,
    violation_count: receipt.violations?.length ?? 0,
    violation_types: (receipt.violations ?? []).map((violation) => violation.violation_type),
    violations: receipt.violations ?? [],
  };
}

export function buildReceiptEvidenceCSVRow(
  receipt: ReceiptEvidenceSource,
  chainStatus: ChainStatus,
): ReceiptEvidenceCSVRow {
  const evidence = buildReceiptEvidenceRecord(receipt, chainStatus);
  return {
    receipt_id: evidence.receipt_id,
    execution_id: evidence.execution_id,
    agent_id: evidence.agent_id,
    device_id: evidence.device_id,
    runtime_id: evidence.runtime_id,
    runtime_label: evidence.runtime_label,
    timestamp: evidence.timestamp,
    start_time: evidence.start_time,
    end_time: evidence.end_time,
    status: evidence.status,
    verification_status: evidence.verification_status,
    signed: evidence.signed,
    chain_status: evidence.chain_status,
    has_violation: evidence.has_violation,
    hash: evidence.hash,
    previous_hash: evidence.previous_hash,
    signature: evidence.signature,
    cpu_ms: evidence.cpu_ms,
    memory_mb: evidence.memory_mb,
    tokens_used: evidence.tokens_used,
    tool_calls: evidence.tool_calls,
    duration_ms: evidence.duration_ms,
    violation_count: evidence.violation_count,
    violation_types: evidence.violation_types.join('|'),
  };
}

export function buildReceiptEvidenceListExport(
  receipts: ReceiptEvidenceSource[],
  chainStatuses: Map<string, ChainStatus>,
  filters: ReceiptEvidenceExportFilters,
  exportedAt = new Date().toISOString(),
): ReceiptEvidenceListExport {
  return {
    exported_at: exportedAt,
    filters,
    receipts: receipts.map((receipt) =>
      buildReceiptEvidenceRecord(receipt, chainStatuses.get(receipt.id) ?? 'unknown')),
  };
}

export function buildReceiptEvidenceCSVRows(
  receipts: ReceiptEvidenceSource[],
  chainStatuses: Map<string, ChainStatus>,
): ReceiptEvidenceCSVRow[] {
  return receipts.map((receipt) =>
    buildReceiptEvidenceCSVRow(receipt, chainStatuses.get(receipt.id) ?? 'unknown'));
}
