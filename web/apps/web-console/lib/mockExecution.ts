/**
 * Mock execution + runtime data for design previews. Only used when a page is
 * rendered with `?mock=1`. Never imported by the real fetch path.
 *
 * Covers the four hero states explicitly so the polished console can be
 * inspected end-to-end without a backend: Recovered+Verified, Running,
 * Approval required, Failed+Proof failure, Proof unavailable.
 */

import type { Task, WalEntry } from '@/hooks/useTasks';
import type { GovernanceRuntimeSummary } from '@/lib/governance';

const min = (n: number) => new Date(Date.now() - 1000 * 60 * n).toISOString();
const sha = (s: string) => `sha256:${s.padEnd(64, '0').slice(0, 64)}`;

// ── Hero canonical: Recovered + Verified ─────────────────────────────────

export const MOCK_TASK_ID = 'tsk_01HZX7E4MQGYK9QH4F3JC2NMD8';

const recoveredVerified: Task = {
  task_id: MOCK_TASK_ID,
  status: 'completed',
  task_type: 'action_workflow',
  runtime_id: 'rt_us-east-1_worker_04',
  created_at: min(17),
  dispatched_at: min(16),
  completed_at: min(4),
  last_step: 4,
  requested_mode: 'durable',
  resolved_strategy: 'checkpointed',
  checkpoint_summary: {
    checkpoint_status: 'committed',
    last_committed_step: 3,
    checkpoint_digest: sha('8f4c2b9e1a7d3f6c5b8e2d4a9f7c1b3e5d8a2f4c6b9e1d3a7f5c8b2e4d6a9f7c'),
    checkpoint_runtime_id: 'rt_us-east-1_worker_04',
    resume_token_present: true,
    wal_entry_count: 4,
    proof_status: 'verified',
  },
  policy: {
    decision_id: 'pol_decision_8a2f4c6b9e1d3a7f',
    decision: 'allowed',
    action_name: 'Fulfill order #4821',
    risk_level: 'medium',
    replay_class: 'idempotent',
    irreversible: false,
    human_gated: false,
    policy_version: '3',
    reason: 'Action matches allowed pattern fulfill_order(*) with idempotency key present.',
    action_digest: sha('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'),
    checkpoint_portability: 'portable',
    created_at: min(17),
  },
  runtime_boundary: {
    boundary_id: 'bnd_us-east-1_prod',
    runtime_id: 'rt_us-east-1_worker_04',
    environment_label: 'acme-orders',
    allowed_tools: ['http_call', 'db_write', 'read_file'],
    denied_tools: ['shell_exec', 'network_raw'],
    network_scope: 'egress-allowlist',
    filesystem_scope: 'workspace-only',
    api_scope: 'tenant-scoped',
    resource_limits: { cpu_ms: 5000, memory_mb: 512, wall_clock_ms: 30000 },
    runtime_capabilities: { isolation: 'process', proof: 'sha256', wal: 'durable' },
    boundary_digest: sha('7e9d2c4b6a8f1e3d5c7b9a2f4e6d8c1b3a5f7e9d2c4b6a8f1e3d5c7b9a2f4e6d'),
    created_at: min(17),
  },
  recovery: {
    redispatch_eligible: true,
    events: [
      {
        event_type: 'runtime_handoff',
        source_runtime_id: 'rt_us-east-1_worker_02',
        target_runtime_id: 'rt_us-east-1_worker_04',
        checkpoint_digest: sha('8f4c2b9e1a7d3f6c5b8e2d4a9f7c1b3e5d8a2f4c6b9e1d3a7f5c8b2e4d6a9f7c'),
        last_committed_step: 2,
        replay_allowed: false,
        reason: 'Source runtime reported heartbeat loss; resumed from checkpoint without replay.',
        created_at: min(11),
      },
    ],
  },
  runtime_handoff: {
    source_runtime_id: 'rt_us-east-1_worker_02',
    target_runtime_id: 'rt_us-east-1_worker_04',
    checkpoint_digest: sha('8f4c2b9e1a7d3f6c5b8e2d4a9f7c1b3e5d8a2f4c6b9e1d3a7f5c8b2e4d6a9f7c'),
    checkpoint_portability: 'portable',
    decision: 'allowed',
    reason: 'Boundary digests match; portable checkpoint accepted.',
    created_at: min(11),
  },
  durability: { class: 'durable', streaming: false, resume_supported: true },
  lifecycle: {
    terminal: true,
    runtime_mutation_allowed: false,
    dispatch_allowed: false,
    recovery_redispatch_allowed: true,
    cancellation_allowed: false,
  },
  action_evidence: [
    { step_index: 1, node_id: 'n1', action_type: 'read_file', tool_name: 'read_file', status: 'committed',
      target_summary: 'orders/4821.json', result_summary: { bytes: 412 },
      result_digest: sha('1a2b3c4d5e6f7a8b'), runtime_id: 'rt_us-east-1_worker_02', recorded_at: min(15) },
    { step_index: 2, node_id: 'n2', action_type: 'http_call', tool_name: 'http_call', status: 'committed',
      target_summary: 'POST api.stripe.com/v1/charges', result_summary: { status: 200 },
      result_digest: sha('9f8e7d6c5b4a3f2e'), runtime_id: 'rt_us-east-1_worker_02', recorded_at: min(13) },
    { step_index: 3, node_id: 'n3', action_type: 'db_write', tool_name: 'db_write', status: 'committed',
      target_summary: 'ledger.orders (id=4821)', result_summary: { rows: 1 },
      result_digest: sha('5d4c3b2a1f0e9d8c'), runtime_id: 'rt_us-east-1_worker_04', recorded_at: min(8) },
    { step_index: 4, node_id: 'n4', action_type: 'http_call', tool_name: 'http_call', status: 'committed',
      target_summary: 'POST api.resend.com/emails', result_summary: { status: 202 },
      result_digest: sha('7c6b5a4f3e2d1c0b'), runtime_id: 'rt_us-east-1_worker_04', recorded_at: min(5) },
  ],
  execution_envelope: { execution_id: 'exec_01HZX7E6S3P4L5N6Q7R8S9T0U1', runtime_id: 'rt_us-east-1_worker_04', sealed_at: min(4) },
  execution_receipt: {
    receipt_id: 'rcpt_01HZX7E7T4Q5M6P7R8S9T0U1V2',
    expected_hash: sha('c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5b6c7d8e9f0a1b2'),
    stored_hash: sha('c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5b6c7d8e9f0a1b2'),
    signed: true,
  },
  receipt: {
    id: 'rcpt_01HZX7E7T4Q5M6P7R8S9T0U1V2',
    hash: sha('c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5b6c7d8e9f0a1b2'),
    previous_hash: sha('0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b'),
    signature: 'ed25519:abc…',
    signed: true,
  },
  proof: {
    execution_id: 'exec_01HZX7E6S3P4L5N6Q7R8S9T0U1',
    expected_hash: sha('c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5b6c7d8e9f0a1b2'),
    stored_hash: sha('c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5b6c7d8e9f0a1b2'),
    signature: 'ed25519:abc…',
    status: 'verified',
    checked_at: min(3),
    present: true,
    matched: true,
    verified: true,
    hash_valid: true,
    signature_matches: true,
    runtime_key_found: true,
    chain_link_valid: true,
    verification_reason: 'All proof checks passed.',
    verified_at: min(3),
  },
  links: {
    task: `/v1/tasks/${MOCK_TASK_ID}`,
    steps: `/v1/tasks/${MOCK_TASK_ID}/steps`,
    verify: `/v1/tasks/${MOCK_TASK_ID}/proof/verify`,
  },
};
(recoveredVerified as any).submitter = 'agent.orders@acme';

// ── Running task ─────────────────────────────────────────────────────────

const RUNNING_ID = 'tsk_01HZRUN9G8P1Q2R3S4T5U6V7W8';

const running: Task = {
  task_id: RUNNING_ID,
  status: 'pending',
  task_type: 'action_workflow',
  runtime_id: 'rt_us-east-1_worker_07',
  created_at: min(2),
  dispatched_at: min(2),
  requested_mode: 'durable',
  checkpoint_summary: {
    checkpoint_status: 'in_progress',
    last_committed_step: 2,
    checkpoint_digest: sha('aa11bb22cc33dd44'),
    checkpoint_runtime_id: 'rt_us-east-1_worker_07',
    resume_token_present: true,
    wal_entry_count: 3,
  },
  policy: {
    decision: 'allowed',
    action_name: 'Sync customer accounts',
    risk_level: 'low',
    replay_class: 'idempotent',
    irreversible: false,
    human_gated: false,
    policy_version: '3',
    reason: 'Allowlisted batch sync.',
    action_digest: sha('bbcc11dd22ee33ff44'),
  },
  runtime_boundary: {
    environment_label: 'acme-orders',
    allowed_tools: ['http_call', 'db_write'],
    denied_tools: ['shell_exec'],
    network_scope: 'egress-allowlist',
    filesystem_scope: 'workspace-only',
    api_scope: 'tenant-scoped',
    boundary_digest: sha('cc11dd22ee33ff44aa55'),
  },
  recovery: { redispatch_eligible: true },
  lifecycle: { terminal: false, dispatch_allowed: true, runtime_mutation_allowed: false, recovery_redispatch_allowed: true, cancellation_allowed: true },
  action_evidence: [
    { step_index: 1, action_type: 'read_file',  tool_name: 'read_file',  status: 'committed', target_summary: 'customers/batch_88.json', result_digest: sha('11aa22bb'), runtime_id: 'rt_us-east-1_worker_07', recorded_at: min(2) },
    { step_index: 2, action_type: 'http_call',  tool_name: 'http_call',  status: 'committed', target_summary: 'GET api.salesforce.com/sobjects/Account', result_digest: sha('22bb33cc'), runtime_id: 'rt_us-east-1_worker_07', recorded_at: min(1) },
    { step_index: 3, action_type: 'db_write',   tool_name: 'db_write',   status: 'running',   target_summary: 'crm.accounts (upsert 88 rows)', runtime_id: 'rt_us-east-1_worker_07' },
  ],
};

// ── Approval required ────────────────────────────────────────────────────

const APPROVAL_ID = 'tsk_01HZAPVQR7S8T9U0V1W2X3Y4Z5';

const approvalRequired: Task = {
  task_id: APPROVAL_ID,
  status: 'approval_required',
  task_type: 'action_workflow',
  runtime_id: 'rt_us-east-1_worker_03',
  created_at: min(6),
  dispatched_at: min(6),
  policy: {
    decision: 'approval_required',
    action_name: 'Refund order #4128 — $1,240.00',
    risk_level: 'high',
    replay_class: 'non_idempotent',
    irreversible: true,
    human_gated: true,
    policy_version: '3',
    reason: 'Irreversible refund above $1,000 threshold requires human approval.',
    action_digest: sha('ddee11ff22aa33bb44'),
  },
  runtime_boundary: {
    environment_label: 'acme-orders',
    allowed_tools: ['http_call'],
    denied_tools: ['shell_exec', 'db_write'],
    network_scope: 'egress-allowlist',
    filesystem_scope: 'read-only',
    api_scope: 'tenant-scoped',
    boundary_digest: sha('ee22ff33aa44bb55cc'),
  },
  recovery: { redispatch_eligible: false, skip_reason: 'Awaiting approval' },
  action_evidence: [],
};

// ── Failed + proof verification failed ───────────────────────────────────

const FAILED_ID = 'tsk_01HZFAILEDV0W1X2Y3Z4A5B6C7';

const failedProofFailed: Task = {
  task_id: FAILED_ID,
  status: 'failed',
  task_type: 'action_workflow',
  runtime_id: 'rt_us-east-1_worker_02',
  created_at: min(45),
  dispatched_at: min(45),
  completed_at: min(38),
  failure_reason: 'Stored receipt hash did not match the recomputed execution hash.',
  checkpoint_summary: {
    checkpoint_status: 'committed',
    last_committed_step: 2,
    wal_entry_count: 3,
    checkpoint_digest: sha('ffee11aa22bb33cc'),
    proof_status: 'mismatch',
  },
  policy: {
    decision: 'allowed',
    action_name: 'Webhook retry — invoice.paid',
    risk_level: 'low',
    replay_class: 'idempotent',
    irreversible: false,
    human_gated: false,
    policy_version: '3',
    action_digest: sha('1122aabbccdd33ee'),
  },
  runtime_boundary: { environment_label: 'mateo-pipeline', allowed_tools: ['http_call'], network_scope: 'egress-allowlist' },
  recovery: { redispatch_eligible: false, skip_reason: 'Proof mismatch — manual review required' },
  action_evidence: [
    { step_index: 1, action_type: 'read_file', tool_name: 'read_file', status: 'committed', target_summary: 'webhooks/queue_882.json', result_digest: sha('aa11'), runtime_id: 'rt_us-east-1_worker_02', recorded_at: min(45) },
    { step_index: 2, action_type: 'http_call', tool_name: 'http_call', status: 'committed', target_summary: 'POST hooks.acme.io/webhooks/invoice.paid', result_digest: sha('bb22'), runtime_id: 'rt_us-east-1_worker_02', recorded_at: min(40) },
    { step_index: 3, action_type: 'http_call', tool_name: 'http_call', status: 'failed', target_summary: 'POST hooks.acme.io/webhooks/invoice.paid (retry 3)', runtime_id: 'rt_us-east-1_worker_02', recorded_at: min(38) },
  ],
  execution_receipt: {
    receipt_id: 'rcpt_failed_98',
    expected_hash: sha('expected11aa22bb33cc'),
    stored_hash:   sha('different22aabbccdd44'),
    signed: true,
  },
  proof: {
    execution_id: 'exec_failed_98',
    expected_hash: sha('expected11aa22bb33cc'),
    stored_hash:   sha('different22aabbccdd44'),
    signature: 'ed25519:xyz…',
    status: 'mismatch',
    present: true,
    matched: false,
    verified: false,
    hash_valid: false,
    signature_matches: true,
    runtime_key_found: true,
    chain_link_valid: false,
    verification_reason: 'Recomputed execution hash differs from the stored receipt hash. Possible tamper or runtime version drift.',
    checked_at: min(35),
  },
};

// ── Proof unavailable (completed but no receipt) ─────────────────────────

const PROOFLESS_ID = 'tsk_01HZPROOFLES2T3U4V5W6X7Y8';

const proofUnavailable: Task = {
  task_id: PROOFLESS_ID,
  status: 'completed',
  task_type: 'action_workflow',
  runtime_id: 'rt_us-east-1_worker_06',
  created_at: min(180),
  dispatched_at: min(180),
  completed_at: min(176),
  policy: {
    decision: 'allowed',
    action_name: 'Reindex catalog',
    risk_level: 'low',
    replay_class: 'idempotent',
    irreversible: false,
    human_gated: false,
    policy_version: '3',
    action_digest: sha('reindex11aa22bb'),
  },
  runtime_boundary: { environment_label: 'enterprise-sync', allowed_tools: ['db_write', 'read_file'], network_scope: 'none' },
  recovery: { redispatch_eligible: true },
  action_evidence: [
    { step_index: 1, action_type: 'read_file', tool_name: 'read_file', status: 'committed', target_summary: 'catalog/products.snapshot', result_digest: sha('cc11'), runtime_id: 'rt_us-east-1_worker_06', recorded_at: min(180) },
    { step_index: 2, action_type: 'db_write',  tool_name: 'db_write',  status: 'committed', target_summary: 'search.catalog (reindex 12,402 rows)', runtime_id: 'rt_us-east-1_worker_06', recorded_at: min(176) },
  ],
};

// ── Exports ──────────────────────────────────────────────────────────────

export const mockTask = recoveredVerified;

const MOCK_TASKS_BY_ID: Record<string, Task> = {
  [MOCK_TASK_ID]:  recoveredVerified,
  [RUNNING_ID]:    running,
  [APPROVAL_ID]:   approvalRequired,
  [FAILED_ID]:     failedProofFailed,
  [PROOFLESS_ID]:  proofUnavailable,
  mock:            recoveredVerified,
};

export function mockTaskById(id: string): Task {
  return MOCK_TASKS_BY_ID[id] ?? recoveredVerified;
}

export const mockTaskSteps: WalEntry[] = [
  { entry_id: 'wal_01', task_id: MOCK_TASK_ID, step_index: 1, step_type: 'tool_call', status: 'committed', input_digest: sha('a1b2'), output_digest: sha('1a2b'), timestamp_ms: Date.now() - 1000 * 60 * 15, runtime_id: 'rt_us-east-1_worker_02', signature: 'ed25519:…' },
  { entry_id: 'wal_02', task_id: MOCK_TASK_ID, step_index: 2, step_type: 'tool_call', status: 'committed', input_digest: sha('b2c3'), output_digest: sha('9f8e'), timestamp_ms: Date.now() - 1000 * 60 * 13, runtime_id: 'rt_us-east-1_worker_02', signature: 'ed25519:…' },
  { entry_id: 'wal_03', task_id: MOCK_TASK_ID, step_index: 3, step_type: 'tool_call', status: 'committed', input_digest: sha('c3d4'), output_digest: sha('5d4c'), timestamp_ms: Date.now() - 1000 * 60 * 8,  runtime_id: 'rt_us-east-1_worker_04', signature: 'ed25519:…' },
  { entry_id: 'wal_04', task_id: MOCK_TASK_ID, step_index: 4, step_type: 'tool_call', status: 'committed', input_digest: sha('d4e5'), output_digest: sha('7c6b'), timestamp_ms: Date.now() - 1000 * 60 * 5,  runtime_id: 'rt_us-east-1_worker_04', signature: 'ed25519:…' },
];

export function mockTaskListForSidebar(): Task[] {
  return [
    running,
    approvalRequired,
    recoveredVerified,
    failedProofFailed,
    proofUnavailable,
  ];
}

// ── Runtimes ─────────────────────────────────────────────────────────────

export const MOCK_RUNTIME_ID = 'rt_us-east-1_worker_04';

const baseRuntime = (
  id: string,
  label: string,
  trust: string,
  active: number,
  recent: number,
  failures: number,
  lastSeenMin: number,
  warning?: string,
): GovernanceRuntimeSummary => ({
  runtime_id: id,
  runtime_label: label,
  last_seen: min(lastSeenMin),
  capability_summary: { isolation: 'process', proof: 'sha256', wal: 'durable' },
  trust_state: trust,
  active_execution_count: active,
  recent_execution_count: recent,
  boundary_count: 1,
  violation_count: failures,
  handoff_count: 1,
  verified_proof_count: recent - failures,
  failed_verification_count: failures,
  checkpoint_portability_summary: { same_runtime_only: 0, compatible_runtime: 1, any_runtime: 0 },
  enforcement_warning: warning,
});

export function mockRuntimes(): GovernanceRuntimeSummary[] {
  return [
    baseRuntime(MOCK_RUNTIME_ID,           'us-east-1 worker 04', 'trusted',     2, 84, 0, 0),
    baseRuntime('rt_us-east-1_worker_07',  'us-east-1 worker 07', 'trusted',     1, 42, 0, 1),
    baseRuntime('rt_us-east-1_worker_02',  'us-east-1 worker 02', 'degraded',    0, 28, 3, 38, 'Signature mismatch in 3 recent receipts'),
    baseRuntime('rt_us-east-1_worker_06',  'us-east-1 worker 06', 'trusted',     0, 17, 0, 176),
    baseRuntime('rt_eu-west-1_worker_01',  'eu-west-1 worker 01', 'trusted',     1, 61, 0, 2),
    baseRuntime('rt_eu-west-1_worker_03',  'eu-west-1 worker 03', 'unverified',  0, 4,  0, 90, 'Runtime key not yet attested'),
    baseRuntime('rt_ap-south-1_worker_01', 'ap-south-1 worker 01','trusted',     0, 9,  0, 220),
  ];
}

export function mockRuntimeById(id: string): GovernanceRuntimeSummary {
  return mockRuntimes().find((r) => r.runtime_id === id) ?? mockRuntimes()[0];
}
