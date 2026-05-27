/**
 * Mock execution data for design preview.
 * Used as a fallback in useTasks/useTask when the API returns nothing,
 * so the execution console renders with realistic content.
 */

import type { Task, TaskListResponse } from '@/hooks/useTasks';

const now = Date.now();
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();

const completedTask: Task = {
  task_id: 'task_01HXQK3M2NPS9F4K8B7CGW3RTA',
  status: 'completed',
  task_type: 'action_workflow',
  runtime_id: 'rt-prod-east-04a7c1',
  created_at: minutesAgo(42),
  dispatched_at: minutesAgo(41),
  completed_at: minutesAgo(38),
  last_step: 7,
  checkpoint_summary: {
    checkpoint_status: 'committed',
    last_committed_step: 7,
    checkpoint_digest: 'sha256:7c4e9a1f0b3d8a25e64c1f8b9d2a3e7c4f0b1d6e8a9c2f5b3d4e1a7c8b9f0e2d',
    resume_token_present: true,
    wal_entry_count: 14,
    proof_status: 'verified',
  },
  recovery: {
    redispatch_eligible: true,
    events: [
      {
        event_type: 'host_fault',
        source_runtime_id: 'rt-prod-east-09b3e2',
        target_runtime_id: 'rt-prod-east-04a7c1',
        last_committed_step: 4,
        replay_allowed: true,
        reason: 'kernel oom — recovered from step 4 checkpoint',
        created_at: minutesAgo(40),
      },
    ],
  },
  policy: {
    decision: 'allowed',
    action_name: 'refund_customer_order',
    risk_level: 'medium',
    replay_class: 'idempotent',
    irreversible: false,
    human_gated: false,
    policy_version: '2.4.1',
    reason: 'amount within auto-approval threshold; merchant in good standing',
    action_digest: 'sha256:a3f9c2e1b4d7e8a0c5f2b1d6e9a3c7f0b4d2e8a1c6f9b3d7e0a4c8f1b5d2e6a9',
  },
  runtime_boundary: {
    environment_label: 'prod-payments',
    allowed_tools: ['stripe.refund', 'db.orders.read', 'db.orders.write', 'email.send'],
    denied_tools: ['db.users.delete', 'stripe.charge'],
    network_scope: 'allowlist:stripe.com,resend.com',
    filesystem_scope: 'readonly:/tmp/payments',
    api_scope: 'tenant:acme-corp',
    boundary_digest: 'sha256:f1e8c2a9b3d4e7f0a1c5b8d2e6f9a3c7b0d4e1f5a8c2b9d6e3f7a0c4b1d8e5f2',
  },
  runtime_handoff: {
    source_runtime_id: 'rt-prod-east-09b3e2',
    target_runtime_id: 'rt-prod-east-04a7c1',
    checkpoint_digest: 'sha256:7c4e9a1f0b3d8a25e64c1f8b9d2a3e7c4f0b1d6e8a9c2f5b3d4e1a7c8b9f0e2d',
    decision: 'allowed',
    created_at: minutesAgo(40),
  },
  lifecycle: {
    terminal: true,
    runtime_mutation_allowed: false,
    dispatch_allowed: false,
    recovery_redispatch_allowed: true,
    cancellation_allowed: false,
  },
  action_evidence: [
    { step_index: 1, action_type: 'read_file',  target_summary: 'orders/2026-05-27/order_8842.json', status: 'committed', result_digest: 'sha256:1a2b3c', recorded_at: minutesAgo(41) },
    { step_index: 2, action_type: 'http_call',  tool_name: 'stripe.refund', target_summary: 'POST stripe.com/v1/refunds', status: 'committed', result_digest: 'sha256:4d5e6f', recorded_at: minutesAgo(41) },
    { step_index: 3, action_type: 'db_write',   target_summary: 'orders.refund_status=pending', status: 'committed', result_digest: 'sha256:7g8h9i', recorded_at: minutesAgo(41) },
    { step_index: 4, action_type: 'db_write',   target_summary: 'orders.refund_status=succeeded', status: 'committed', result_digest: 'sha256:0j1k2l', recorded_at: minutesAgo(40) },
    { step_index: 5, action_type: 'read_file',  target_summary: 'templates/refund_email.mjml', status: 'committed', result_digest: 'sha256:3m4n5o', recorded_at: minutesAgo(39) },
    { step_index: 6, action_type: 'http_call',  tool_name: 'resend.send', target_summary: 'POST resend.com/emails', status: 'committed', result_digest: 'sha256:6p7q8r', recorded_at: minutesAgo(38) },
    { step_index: 7, action_type: 'db_write',   target_summary: 'audit_log += refund_completed', status: 'committed', result_digest: 'sha256:9s0t1u', recorded_at: minutesAgo(38) },
  ],
  receipt: {
    id: 'rcpt_01HXQK3N4PTQ8G5L9C0DHW4SUB',
    hash: 'sha256:b8a3c1e9f4d7a2c5b8e1f4d7a0c3b6e9f2d5a8c1b4e7f0d3a6c9b2e5f8d1a4c7',
    previous_hash: 'sha256:e2d5a8c1b4e7f0d3a6c9b2e5f8d1a4c7b8a3c1e9f4d7a2c5b8e1f4d7a0c3b6e9',
    signature: 'ed25519:9f4d7a2c5b8e1f4d7a0c3b6e9f2d5a8c1b4e7f0d3a6c9b2e5f8d1a4c7b8a3c1e',
    signed: true,
  },
  proof: {
    execution_id: 'exec_01HXQK3M2NPS9F4K8B7CGW3RTA',
    expected_hash: 'sha256:b8a3c1e9f4d7a2c5b8e1f4d7a0c3b6e9f2d5a8c1b4e7f0d3a6c9b2e5f8d1a4c7',
    stored_hash:   'sha256:b8a3c1e9f4d7a2c5b8e1f4d7a0c3b6e9f2d5a8c1b4e7f0d3a6c9b2e5f8d1a4c7',
    signature: 'ed25519:9f4d7a2c5b8e1f4d7a0c3b6e9f2d5a8c1b4e7f0d3a6c9b2e5f8d1a4c7b8a3c1e',
    status: 'verified',
    verified: true,
    hash_valid: true,
    signature_matches: true,
    runtime_key_found: true,
    chain_link_valid: true,
    verified_at: minutesAgo(37),
  },
};

const runningTask: Task = {
  task_id: 'task_01HXQK7P5RVTBJ6M0E2KGY5UVD',
  status: 'dispatched',
  task_type: 'action_workflow',
  runtime_id: 'rt-prod-west-12c9d3',
  created_at: minutesAgo(3),
  dispatched_at: minutesAgo(3),
  last_step: 2,
  checkpoint_summary: {
    checkpoint_status: 'in_progress',
    last_committed_step: 2,
    wal_entry_count: 5,
  },
  recovery: { redispatch_eligible: true },
  policy: {
    decision: 'allowed',
    action_name: 'sync_user_segments',
    risk_level: 'low',
    replay_class: 'idempotent',
    policy_version: '1.8.0',
  },
  runtime_boundary: {
    environment_label: 'prod-growth',
    allowed_tools: ['db.users.read', 'segment.send'],
    network_scope: 'allowlist:segment.com',
    api_scope: 'tenant:acme-corp',
  },
  lifecycle: { terminal: false, cancellation_allowed: true, recovery_redispatch_allowed: true },
  action_evidence: [
    { step_index: 1, action_type: 'db_write', target_summary: 'snapshot.create()', status: 'committed', result_digest: 'sha256:aa11bb', recorded_at: minutesAgo(3) },
    { step_index: 2, action_type: 'read_file', target_summary: 'segments/active_users.sql', status: 'committed', result_digest: 'sha256:cc22dd', recorded_at: minutesAgo(2) },
    { step_index: 3, action_type: 'http_call', tool_name: 'segment.send', target_summary: 'POST segment.com/v1/batch', status: 'running' },
  ],
  receipt: { signature: 'ed25519:partial', signed: false },
  proof: { status: 'pending' },
};

const failedTask: Task = {
  task_id: 'task_01HXQK9R6SWUCK7N1F3LHZ6VWE',
  status: 'failed',
  task_type: 'action_workflow',
  runtime_id: 'rt-prod-east-04a7c1',
  created_at: minutesAgo(18),
  dispatched_at: minutesAgo(18),
  completed_at: minutesAgo(16),
  failure_reason: 'policy denied: action attempted to call denied tool `db.users.delete`',
  last_step: 3,
  checkpoint_summary: {
    checkpoint_status: 'committed',
    last_committed_step: 2,
    wal_entry_count: 6,
  },
  recovery: { redispatch_eligible: false, skip_reason: 'policy violation — not replayable' },
  policy: {
    decision: 'denied',
    action_name: 'gdpr_user_purge',
    risk_level: 'high',
    replay_class: 'irreversible',
    irreversible: true,
    human_gated: true,
    policy_version: '2.4.1',
    reason: 'action invoked db.users.delete which is in denied_tools for prod boundary',
  },
  runtime_boundary: {
    environment_label: 'prod-compliance',
    allowed_tools: ['db.users.read', 'audit.write'],
    denied_tools: ['db.users.delete', 'db.orders.delete'],
    network_scope: 'denied',
    api_scope: 'tenant:acme-corp',
  },
  lifecycle: { terminal: true },
  action_evidence: [
    { step_index: 1, action_type: 'read_file', target_summary: 'gdpr/request_4421.json', status: 'committed', result_digest: 'sha256:ee33ff', recorded_at: minutesAgo(18) },
    { step_index: 2, action_type: 'db_write', target_summary: 'audit_log += gdpr_request_received', status: 'committed', result_digest: 'sha256:gg44hh', recorded_at: minutesAgo(17) },
    { step_index: 3, action_type: 'db_write', target_summary: 'users.delete(user_id=...)', status: 'denied' },
  ],
  proof: {
    execution_id: 'exec_01HXQK9R6SWUCK7N1F3LHZ6VWE',
    status: 'mismatch',
    verified: false,
    verification_reason: 'execution halted before receipt sealing',
  },
};

const approvalTask: Task = {
  task_id: 'task_01HXQKBT8UXVDM8P2G4MJA7XYG',
  status: 'approval_required',
  task_type: 'action_workflow',
  runtime_id: 'rt-prod-east-11f5a8',
  created_at: minutesAgo(8),
  dispatched_at: minutesAgo(8),
  last_step: 1,
  policy: {
    decision: 'approval_required',
    action_name: 'wire_transfer_high_value',
    risk_level: 'high',
    replay_class: 'irreversible',
    irreversible: true,
    human_gated: true,
    policy_version: '2.4.1',
    reason: 'amount $48,200 exceeds auto-approval ceiling of $10,000',
  },
  runtime_boundary: {
    environment_label: 'prod-payments',
    allowed_tools: ['bank.wire', 'db.ledger.write'],
    api_scope: 'tenant:acme-corp',
  },
  recovery: { redispatch_eligible: false, skip_reason: 'awaiting human approval' },
  lifecycle: { terminal: false, cancellation_allowed: true },
  action_evidence: [
    { step_index: 1, action_type: 'read_file', target_summary: 'wire_requests/req_2298.json', status: 'committed', result_digest: 'sha256:ii55jj', recorded_at: minutesAgo(8) },
  ],
  proof: { status: 'pending' },
};

const stagingTask: Task = {
  task_id: 'task_01HXQKDV9VYWEN9Q3H5NKB8YZH',
  status: 'completed',
  task_type: 'action_workflow',
  runtime_id: 'rt-stg-west-22d6e4',
  created_at: minutesAgo(95),
  completed_at: minutesAgo(94),
  last_step: 3,
  checkpoint_summary: { checkpoint_status: 'committed', last_committed_step: 3, wal_entry_count: 6 },
  policy: { decision: 'allowed', action_name: 'nightly_index_rebuild', policy_version: '1.2.0', replay_class: 'idempotent' },
  runtime_boundary: { environment_label: 'staging', allowed_tools: ['db.index.rebuild'], api_scope: 'tenant:acme-corp' },
  action_evidence: [
    { step_index: 1, action_type: 'db_write', target_summary: 'index.lock(products)', status: 'committed', result_digest: 'sha256:kk66ll', recorded_at: minutesAgo(95) },
    { step_index: 2, action_type: 'db_write', target_summary: 'index.rebuild(products)', status: 'committed', result_digest: 'sha256:mm77nn', recorded_at: minutesAgo(94) },
    { step_index: 3, action_type: 'db_write', target_summary: 'index.unlock(products)', status: 'committed', result_digest: 'sha256:oo88pp', recorded_at: minutesAgo(94) },
  ],
  receipt: { signature: 'ed25519:stagingkey', signed: true },
  proof: { status: 'verified', verified: true, hash_valid: true, signature_matches: true },
};

const recoveringTask: Task = {
  task_id: 'task_01HXQKFX0WZXFP0R4J6PLC9ZA1',
  status: 'recovering',
  task_type: 'action_workflow',
  runtime_id: 'rt-prod-east-15a2b9',
  created_at: minutesAgo(6),
  dispatched_at: minutesAgo(6),
  last_step: 3,
  checkpoint_summary: { checkpoint_status: 'committed', last_committed_step: 3, wal_entry_count: 7 },
  recovery: {
    redispatch_eligible: true,
    events: [{
      event_type: 'network_partition',
      source_runtime_id: 'rt-prod-east-08c1d4',
      target_runtime_id: 'rt-prod-east-15a2b9',
      last_committed_step: 3,
      replay_allowed: true,
      reason: 'lost heartbeat 12s; redispatched from step 3 checkpoint',
      created_at: minutesAgo(1),
    }],
  },
  policy: { decision: 'allowed', action_name: 'invoice_batch_send', policy_version: '2.1.0', replay_class: 'idempotent' },
  runtime_boundary: { environment_label: 'prod-billing', allowed_tools: ['db.invoices.read', 'resend.send'], api_scope: 'tenant:acme-corp' },
  lifecycle: { terminal: false, recovery_redispatch_allowed: true },
  action_evidence: [
    { step_index: 1, action_type: 'db_write', target_summary: 'invoices.snapshot()', status: 'committed', result_digest: 'sha256:qq99rr', recorded_at: minutesAgo(6) },
    { step_index: 2, action_type: 'read_file', target_summary: 'invoices/may_2026.csv', status: 'committed', result_digest: 'sha256:ss00tt', recorded_at: minutesAgo(5) },
    { step_index: 3, action_type: 'http_call', tool_name: 'resend.send', target_summary: 'POST resend.com/batch (1/3)', status: 'committed', result_digest: 'sha256:uu11vv', recorded_at: minutesAgo(4) },
    { step_index: 4, action_type: 'http_call', tool_name: 'resend.send', target_summary: 'POST resend.com/batch (2/3)', status: 'running' },
  ],
  proof: { status: 'pending' },
};

export const MOCK_TASKS: Task[] = [
  runningTask,
  approvalTask,
  recoveringTask,
  completedTask,
  failedTask,
  stagingTask,
];

export const MOCK_TASKS_BY_ID: Record<string, Task> = MOCK_TASKS.reduce((acc, t) => {
  acc[t.task_id] = t;
  return acc;
}, {} as Record<string, Task>);

export const MOCK_TASK_LIST: TaskListResponse = {
  tasks: MOCK_TASKS,
  total: MOCK_TASKS.length,
};
