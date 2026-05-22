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
