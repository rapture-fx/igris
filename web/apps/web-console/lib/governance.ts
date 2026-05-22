/**
 * Execution governance types and operator-language helpers.
 *
 * These mirror the backend governance ledgers (migration 051) exposed through
 * `/v1/execution/governance/*` and `/v1/tasks/:id`. Every helper here maps a
 * raw backend value to plain operator language — Allowed, Denied, Recovered,
 * Verified, Boundary violation — so the console never shows academic jargon.
 */

// ── Backend payloads ────────────────────────────────────────────────────────

export interface GovernanceTrustSummary {
  verified_executions: number;
  recovered_executions: number;
  policy_blocked_actions: number;
  approval_required_actions: number;
  boundary_violations: number;
  failed_proof_verification: number;
}

export interface GovernanceActiveStates {
  running: number;
  approval_required: number;
  recovering: number;
  failed: number;
  verified: number;
  partially_verified: number;
  blocked: number;
}

export interface GovernanceCriticalEvent {
  kind: string;
  category: 'policy' | 'proof' | 'boundary' | 'handoff' | 'recovery' | string;
  task_id?: string;
  runtime_id?: string;
  severity: 'info' | 'warning' | 'error' | 'critical' | string;
  reason: string;
  created_at: string;
}

export interface GovernanceSummary {
  trust_summary: GovernanceTrustSummary;
  active_execution_states: GovernanceActiveStates;
  recent_critical_events: GovernanceCriticalEvent[];
  generated_at: string;
}

export interface GovernanceListResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface GovernancePolicyDecision {
  decision_id: string;
  task_id?: string;
  agent_id?: string;
  runtime_id?: string;
  task_type: string;
  action_name: string;
  environment_label?: string;
  resource_scope?: string;
  risk_level: string;
  decision: 'allowed' | 'denied' | 'approval_required' | string;
  replay_class: 'retryable' | 'non_retryable' | string;
  irreversible: boolean;
  human_gated: boolean;
  policy_version: string;
  policy_reason: string;
  action_digest: string;
  boundary_digest?: string;
  checkpoint_portability: string;
  created_at: string;
}

export interface GovernanceRecoveryEvent {
  recovery_event_id: string;
  task_id: string;
  event_type: string;
  source_runtime_id?: string;
  target_runtime_id?: string;
  checkpoint_digest?: string;
  last_committed_step?: number;
  replay_allowed?: boolean;
  reason: string;
  created_at: string;
}

export interface GovernanceHandoffEvent {
  handoff_event_id: string;
  task_id: string;
  source_runtime_id?: string;
  target_runtime_id?: string;
  checkpoint_digest?: string;
  checkpoint_portability: string;
  decision: 'allowed' | 'denied' | string;
  reason: string;
  created_at: string;
}

export interface GovernanceExecutionBoundary {
  boundary_id: string;
  task_id?: string;
  runtime_id?: string;
  policy_decision_id?: string;
  environment_label?: string;
  allowed_tools?: unknown;
  denied_tools?: unknown;
  network_scope: string;
  filesystem_scope: string;
  api_scope: string;
  resource_limits?: unknown;
  runtime_capabilities?: unknown;
  boundary_digest: string;
  created_at: string;
}

export interface GovernanceBoundaryViolation {
  violation_id: string;
  task_id?: string;
  runtime_id?: string;
  boundary_id?: string;
  violation_type: string;
  severity: string;
  reason: string;
  evidence_digest?: string;
  created_at: string;
}

export interface GovernanceVerificationResult {
  verification_id: string;
  task_id?: string;
  execution_id?: string;
  policy_decision_id?: string;
  checkpoint_digest?: string;
  action_digest?: string;
  status: 'verified' | 'partially_verified' | 'unverifiable' | 'failed_verification' | 'policy_violation' | string;
  policy_compliant?: boolean;
  hash_valid?: boolean;
  signature_matches?: boolean;
  runtime_key_found?: boolean;
  chain_link_valid?: boolean;
  evidence_digest?: string;
  reason: string;
  created_at: string;
}

export interface GovernanceRuntimePortabilitySummary {
  same_runtime_only: number;
  compatible_runtime: number;
  any_runtime: number;
}

export interface GovernanceRuntimeSummary {
  runtime_id: string;
  runtime_label: string;
  last_seen?: string;
  capability_summary?: unknown;
  trust_state: string;
  active_execution_count: number;
  recent_execution_count: number;
  boundary_count: number;
  violation_count: number;
  handoff_count: number;
  verified_proof_count: number;
  failed_verification_count: number;
  checkpoint_portability_summary: GovernanceRuntimePortabilitySummary;
  enforcement_warning?: string;
}

export interface GovernanceListParams {
  limit?: number;
  offset?: number;
  sort?: 'asc' | 'desc';
  range?: string;
  task_id?: string;
  agent_id?: string;
  runtime_id?: string;
  action?: string;
  decision?: string;
  risk_level?: string;
  replay_class?: string;
  irreversible?: boolean;
  human_gated?: boolean;
  event_type?: string;
  handoff_decision?: string;
  severity?: string;
  status?: string;
  execution_id?: string;
}

// ── Tone vocabulary ─────────────────────────────────────────────────────────
//
// A small, fixed set of visual tones. Components map a tone to colour so the
// whole console reads consistently: green = trusted, red = failed/blocked,
// amber = needs attention, slate = neutral/unknown, blue = informational.

export type Tone = 'success' | 'danger' | 'warning' | 'neutral' | 'info';

export interface Labelled {
  label: string;
  tone: Tone;
}

// ── Policy ──────────────────────────────────────────────────────────────────

export function policyDecisionLabel(decision?: string | null): Labelled {
  switch (String(decision ?? '').toLowerCase()) {
    case 'allowed':
      return { label: 'Allowed', tone: 'success' };
    case 'denied':
      return { label: 'Denied', tone: 'danger' };
    case 'approval_required':
      return { label: 'Approval required', tone: 'warning' };
    default:
      return { label: 'Not evaluated', tone: 'neutral' };
  }
}

export function riskLabel(risk?: string | null): Labelled {
  switch (String(risk ?? '').toLowerCase()) {
    case 'critical':
      return { label: 'Critical risk', tone: 'danger' };
    case 'high':
      return { label: 'High risk', tone: 'danger' };
    case 'medium':
      return { label: 'Medium risk', tone: 'warning' };
    case 'low':
      return { label: 'Low risk', tone: 'success' };
    default:
      return { label: 'Risk not set', tone: 'neutral' };
  }
}

export function replayClassLabel(replayClass?: string | null): Labelled {
  switch (String(replayClass ?? '').toLowerCase()) {
    case 'retryable':
      return { label: 'Retryable', tone: 'success' };
    case 'non_retryable':
      return { label: 'Non-replayable', tone: 'warning' };
    default:
      return { label: 'Replay class not set', tone: 'neutral' };
  }
}

// ── Recovery ────────────────────────────────────────────────────────────────

export function recoveryStateLabel(status?: string | null): Labelled {
  switch (String(status ?? '').toLowerCase()) {
    case 'running':
    case 'dispatched':
    case 'checkpointed':
    case 'pending':
      return { label: 'Running', tone: 'info' };
    case 'recovering':
      return { label: 'Recovering', tone: 'warning' };
    case 'recovered':
      return { label: 'Recovered', tone: 'success' };
    case 'failed':
      return { label: 'Recovery failed', tone: 'danger' };
    case 'interrupted':
      return { label: 'Interrupted', tone: 'warning' };
    case 'manual_recovery_required':
    case 'approval_required':
      return { label: 'Manual recovery required', tone: 'warning' };
    case 'replay_skipped':
      return { label: 'Replay skipped', tone: 'warning' };
    case 'completed':
      return { label: 'Completed', tone: 'success' };
    case 'canceled':
    case 'cancelled':
      return { label: 'Cancelled', tone: 'neutral' };
    default:
      return { label: status ? String(status) : 'Unknown', tone: 'neutral' };
  }
}

// ── Proof ───────────────────────────────────────────────────────────────────

export function proofStateLabel(status?: string | null): Labelled {
  switch (String(status ?? '').toLowerCase()) {
    case 'verified':
      return { label: 'Verified', tone: 'success' };
    case 'partially_verified':
      return { label: 'Partially verified', tone: 'warning' };
    case 'unverifiable':
      return { label: 'Unverifiable', tone: 'neutral' };
    case 'failed_verification':
    case 'mismatch':
      return { label: 'Failed verification', tone: 'danger' };
    case 'policy_violation':
      return { label: 'Policy violation', tone: 'danger' };
    case 'present':
      return { label: 'Recorded, not verified', tone: 'info' };
    case 'missing':
      return { label: 'Receipt missing', tone: 'neutral' };
    case 'pending':
      return { label: 'Verification pending', tone: 'info' };
    default:
      return { label: 'Not recorded', tone: 'neutral' };
  }
}

// ── Runtime ─────────────────────────────────────────────────────────────────

export function handoffLabel(decision?: string | null): Labelled {
  switch (String(decision ?? '').toLowerCase()) {
    case 'allowed':
      return { label: 'Handoff allowed', tone: 'success' };
    case 'denied':
      return { label: 'Handoff blocked', tone: 'danger' };
    default:
      return { label: 'No handoff', tone: 'neutral' };
  }
}

export function runtimeTrustLabel(state?: string | null): Labelled {
  switch (String(state ?? '').toLowerCase()) {
    case 'trusted':
      return { label: 'Trusted', tone: 'success' };
    case 'boundary_violation':
      return { label: 'Boundary violation', tone: 'danger' };
    case 'capability_mismatch':
      return { label: 'Capability mismatch', tone: 'warning' };
    case 'handoff_blocked':
      return { label: 'Handoff blocked', tone: 'danger' };
    case 'limited_trust':
      return { label: 'Limited trust', tone: 'warning' };
    default:
      return { label: 'Trust not available', tone: 'neutral' };
  }
}

export function severityTone(severity?: string | null): Tone {
  switch (String(severity ?? '').toLowerCase()) {
    case 'critical':
    case 'error':
      return 'danger';
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    default:
      return 'neutral';
  }
}

// ── Checkpoint portability ──────────────────────────────────────────────────

/** Human label for a checkpoint portability mode, plus whether it's experimental. */
export function portabilityLabel(mode?: string | null): {
  label: string;
  experimental: boolean;
} {
  switch (String(mode ?? '').toLowerCase()) {
    case 'same_runtime_only':
      return { label: 'Same runtime only', experimental: false };
    case 'compatible_runtime':
      return { label: 'Compatible runtime', experimental: true };
    case 'any_runtime':
      return { label: 'Any runtime', experimental: true };
    default:
      return { label: 'Not set', experimental: false };
  }
}

/** Plain-English description of one governance critical-event category. */
export function criticalEventTitle(event: GovernanceCriticalEvent): string {
  switch (event.kind) {
    case 'policy_denied':
      return 'Action denied by policy';
    case 'proof_failed':
      return 'Proof verification failed';
    case 'boundary_violation':
      return 'Runtime boundary violation';
    case 'handoff_denied':
      return 'Runtime handoff blocked';
    case 'replay_skipped':
      return 'Recovery replay skipped';
    default:
      return event.kind.replace(/[_-]+/g, ' ');
  }
}
