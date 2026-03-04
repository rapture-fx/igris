import { MOCK_RUNS, MOCK_AGENTS } from './execution';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minsAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString();
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60_000).toISOString();
}

function genTs(count: number, rangeMs: number): string[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) =>
    new Date(now - ((count - 1 - i) / (count - 1)) * rangeMs).toISOString()
  );
}

// ─── /v1/stats/overview ───────────────────────────────────────────────────────

export const MOCK_STATS_OVERVIEW = {
  active_executions: 2,
  violations_24h: 3,
  online_devices: 4,
  model_requests_24h: 847,
  quota_usage_percent: 62,
  active_alerts: 1,
};

// ─── /v1/stats/model-usage ────────────────────────────────────────────────────

export const MOCK_MODEL_USAGE = [
  { hour: '0h',  requests: 12  },
  { hour: '2h',  requests: 28  },
  { hour: '4h',  requests: 41  },
  { hour: '6h',  requests: 35  },
  { hour: '8h',  requests: 67  },
  { hour: '10h', requests: 92  },
  { hour: '12h', requests: 84  },
  { hour: '14h', requests: 110 },
  { hour: '16h', requests: 97  },
  { hour: '18h', requests: 73  },
  { hour: '20h', requests: 58  },
  { hour: '22h', requests: 44  },
];

// ─── /v1/fleet/devices ────────────────────────────────────────────────────────

export const MOCK_DEVICES = [
  {
    id: 'dev-arm64-gpu-001',
    status: 'ONLINE',
    version: '1.4.2',
    last_seen_at: minsAgo(1),
    execution_count: 127,
    violation_count: 0,
    health: {
      cpu_percent: 42.3,
      memory_mb: 1812,
      memory_limit_mb: 4096,
      uptime_seconds: 72 * 3600,
    },
    recent_executions: [
      { id: 'exec-3f7a9b2c-1d4e-4f8a-9c2b-8e1d7f4a3b9c', status: 'RUNNING',    started_at: minsAgo(2)   },
      { id: 'exec-7c2d1e8f-4b5a-4c9d-8e3f-2a7b4d6c1e9f', status: 'COMPLETED',  started_at: minsAgo(18)  },
      { id: 'exec-6a9b2c5d-8e1f-4a6b-9c2d-5e8f1a4b7c2d', status: 'COMPLETED',  started_at: minsAgo(190) },
    ],
    policy_snapshot: {
      cpu_limit_percent: 75,
      memory_limit_mb: 2048,
      max_tick_ms: 500,
      quota_limit: 1000,
    },
    violation_history: [],
  },
  {
    id: 'dev-arm64-gpu-002',
    status: 'ONLINE',
    version: '1.4.2',
    last_seen_at: minsAgo(3),
    execution_count: 89,
    violation_count: 2,
    health: {
      cpu_percent: 78.1,
      memory_mb: 3680,
      memory_limit_mb: 4096,
      uptime_seconds: 48 * 3600,
    },
    recent_executions: [
      { id: 'exec-5e8f1a2b-6c3d-4e9f-8a1b-2c7d4e6f9a8b', status: 'VIOLATION',  started_at: minsAgo(47)  },
      { id: 'exec-2c5d8e1f-4a7b-4c2d-9e5f-8a1b4c7d2e5f', status: 'VIOLATION',  started_at: minsAgo(130) },
      { id: 'exec-8f1a4b7c-2d5e-4f9a-8b1c-4d7e2f5a8b1c', status: 'COMPLETED',  started_at: minsAgo(115) },
    ],
    policy_snapshot: {
      cpu_limit_percent: 90,
      memory_limit_mb: 4096,
      max_tick_ms: 1000,
      quota_limit: 5000,
    },
    violation_history: [
      { kind: 'TICK_TIMEOUT',  created_at: minsAgo(44)  },
      { kind: 'MEMORY_LIMIT',  created_at: minsAgo(127) },
    ],
  },
  {
    id: 'dev-x86-cpu-003',
    status: 'ONLINE',
    version: '1.3.8',
    last_seen_at: minsAgo(1),
    execution_count: 214,
    violation_count: 0,
    health: {
      cpu_percent: 18.4,
      memory_mb: 312,
      memory_limit_mb: 512,
      uptime_seconds: 120 * 3600,
    },
    recent_executions: [
      { id: 'exec-0b3c6d9e-2f5a-4b0c-6d9e-2f5a8b1c4d7e', status: 'RUNNING',   started_at: minsAgo(1)  },
      { id: 'exec-1a4b7c2d-9e3f-4a8b-7c1d-4e9f2a7b3c1d', status: 'COMPLETED', started_at: minsAgo(35) },
      { id: 'exec-3d6e9f2a-5b8c-4d1e-7f4a-9b2c5d8e1f4a', status: 'COMPLETED', started_at: minsAgo(90) },
    ],
    policy_snapshot: {
      cpu_limit_percent: 50,
      memory_limit_mb: 512,
      max_tick_ms: 200,
      quota_limit: 200,
    },
    violation_history: [],
  },
  {
    id: 'dev-arm64-cpu-005',
    status: 'ONLINE',
    version: '1.4.1',
    last_seen_at: minsAgo(4),
    execution_count: 62,
    violation_count: 0,
    health: {
      cpu_percent: 31.7,
      memory_mb: 498,
      memory_limit_mb: 1024,
      uptime_seconds: 36 * 3600,
    },
    recent_executions: [
      { id: 'exec-9b2c5d8e-1f4a-4b7c-9d2e-5f8a1b4c7d2e', status: 'ERROR',     started_at: minsAgo(62)  },
      { id: 'exec-4e7f1a2b-3c6d-4e9f-1a4b-7c2d5e8f1a4b', status: 'COMPLETED', started_at: minsAgo(240) },
    ],
    policy_snapshot: {
      cpu_limit_percent: 60,
      memory_limit_mb: 1024,
      max_tick_ms: 300,
      quota_limit: 500,
    },
    violation_history: [],
  },
  {
    id: 'dev-x86-cpu-006',
    status: 'OFFLINE',
    version: '1.3.5',
    last_seen_at: minsAgo(420),
    execution_count: 28,
    violation_count: 0,
    health: null,
    recent_executions: [],
    policy_snapshot: null,
    violation_history: [],
  },
  {
    id: 'dev-x86-cpu-007',
    status: 'OFFLINE',
    version: '1.2.9',
    last_seen_at: minsAgo(800),
    execution_count: 11,
    violation_count: 0,
    health: null,
    recent_executions: [],
    policy_snapshot: null,
    violation_history: [],
  },
];

// ─── /v1/model/routing ────────────────────────────────────────────────────────

export const MOCK_MODEL_ROUTING = {
  primary_provider: 'anthropic',
  fallback_provider: 'openai',
  success_rate_percent: 99.2,
  avg_latency_ms: 847,
  shadow_mode: false,
  rules: [
    {
      id: 'rule-001',
      name: 'Sonnet → Anthropic',
      condition: 'model.includes("sonnet")',
      target_provider: 'anthropic',
      priority: 1,
      enabled: true,
    },
    {
      id: 'rule-002',
      name: 'Opus → Anthropic',
      condition: 'model.includes("opus")',
      target_provider: 'anthropic',
      priority: 2,
      enabled: true,
    },
    {
      id: 'rule-003',
      name: 'Haiku → Anthropic (fallback: openai)',
      condition: 'model.includes("haiku")',
      target_provider: 'anthropic',
      priority: 3,
      enabled: true,
    },
    {
      id: 'rule-004',
      name: 'GPT-4 → OpenAI',
      condition: 'model.includes("gpt-4")',
      target_provider: 'openai',
      priority: 4,
      enabled: false,
    },
  ],
  fallback_chain: [
    { provider: 'anthropic', order: 1, condition: 'default',  status: 'ACTIVE'  },
    { provider: 'openai',    order: 2, condition: 'on_error', status: 'ACTIVE'  },
    { provider: 'google',    order: 3, condition: 'on_error', status: 'STANDBY' },
  ],
};

// ─── /v1/model/providers ──────────────────────────────────────────────────────

export const MOCK_MODEL_PROVIDERS = [
  {
    id: 'prov-anthropic',
    name: 'Anthropic',
    kind: 'cloud',
    status: 'ACTIVE',
    endpoint: 'https://api.anthropic.com',
    model_count: 3,
    request_count_24h: 612,
    error_rate_percent: 0.3,
    avg_latency_ms: 920,
    last_checked_at: minsAgo(3),
    api_key_masked: 'sk-ant-••••••••••••••••••••••••••••••••••••XYZ',
    supported_models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    health: { latency_ms: 920, status: 'ACTIVE', checked_at: minsAgo(3) },
  },
  {
    id: 'prov-openai',
    name: 'OpenAI',
    kind: 'cloud',
    status: 'ACTIVE',
    endpoint: 'https://api.openai.com',
    model_count: 4,
    request_count_24h: 235,
    error_rate_percent: 0.8,
    avg_latency_ms: 640,
    last_checked_at: minsAgo(5),
    api_key_masked: 'sk-proj-••••••••••••••••••••••••••••••••••••XYZ',
    supported_models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-preview'],
    health: { latency_ms: 640, status: 'ACTIVE', checked_at: minsAgo(5) },
  },
  {
    id: 'prov-google',
    name: 'Google Gemini',
    kind: 'cloud',
    status: 'ACTIVE',
    endpoint: 'https://generativelanguage.googleapis.com',
    model_count: 2,
    request_count_24h: 0,
    error_rate_percent: 0.0,
    avg_latency_ms: 520,
    last_checked_at: minsAgo(8),
    api_key_masked: 'AIza••••••••••••••••••••••••••••••••••••••••XYZ',
    supported_models: ['gemini-2.0-flash', 'gemini-1.5-pro'],
    health: { latency_ms: 520, status: 'ACTIVE', checked_at: minsAgo(8) },
  },
  {
    id: 'prov-groq',
    name: 'Groq',
    kind: 'cloud',
    status: 'OFFLINE',
    endpoint: 'https://api.groq.com',
    model_count: 2,
    request_count_24h: 0,
    error_rate_percent: 100.0,
    avg_latency_ms: 0,
    last_checked_at: minsAgo(25),
    api_key_masked: 'gsk_•••••••••••••••••••••••••••••••••••••••••XYZ',
    supported_models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
    health: { latency_ms: 0, status: 'OFFLINE', checked_at: minsAgo(25) },
  },
];

// ─── /v1/model/cost ───────────────────────────────────────────────────────────

export const MOCK_MODEL_COST = {
  total_cost_usd: 142.83,
  total_tokens: 4820000,
  cost_trend_percent: -8.2,
  top_model: 'claude-sonnet-4-6',
  by_model: [
    {
      model: 'claude-sonnet-4-6',
      provider: 'anthropic',
      tokens_used: 2840000,
      cost_usd: 71.00,
      request_count: 412,
      cost_per_1k_tokens: 0.025,
    },
    {
      model: 'claude-opus-4-6',
      provider: 'anthropic',
      tokens_used: 980000,
      cost_usd: 58.80,
      request_count: 87,
      cost_per_1k_tokens: 0.060,
    },
    {
      model: 'claude-haiku-4-5-20251001',
      provider: 'anthropic',
      tokens_used: 1000000,
      cost_usd: 13.03,
      request_count: 348,
      cost_per_1k_tokens: 0.013,
    },
  ],
  by_day: [
    { date: '2026-02-25', cost_usd: 18.40 },
    { date: '2026-02-26', cost_usd: 22.10 },
    { date: '2026-02-27', cost_usd: 16.80 },
    { date: '2026-02-28', cost_usd: 19.20 },
    { date: '2026-03-01', cost_usd: 21.40 },
    { date: '2026-03-02', cost_usd: 24.93 },
    { date: '2026-03-03', cost_usd: 20.00 },
  ],
};

// ─── /v1/policy/bounds ────────────────────────────────────────────────────────

export const MOCK_POLICY_BOUNDS = {
  cpu_percent: 75,
  memory_mb: 2048,
  max_tick_duration_ms: 500,
  quota: 50000,
};

// ─── /v1/policy/bounds/history ────────────────────────────────────────────────

export const MOCK_POLICY_BOUNDS_HISTORY = [
  {
    id: 'chg-001',
    field: 'cpu_percent',
    old_value: 80,
    new_value: 75,
    changed_at: minsAgo(1440),
    changed_by: 'admin@igrisinertial.com',
  },
  {
    id: 'chg-002',
    field: 'max_tick_duration_ms',
    old_value: 1000,
    new_value: 500,
    changed_at: minsAgo(2880),
    changed_by: 'admin@igrisinertial.com',
  },
  {
    id: 'chg-003',
    field: 'memory_mb',
    old_value: 1024,
    new_value: 2048,
    changed_at: minsAgo(4320),
    changed_by: 'ops@igrisinertial.com',
  },
  {
    id: 'chg-004',
    field: 'quota',
    old_value: 10000,
    new_value: 50000,
    changed_at: minsAgo(7200),
    changed_by: 'admin@igrisinertial.com',
  },
];

// ─── /v1/policy/capabilities ──────────────────────────────────────────────────

export const MOCK_POLICY_CAPABILITIES = {
  http_access: true,
  shell_access: false,
  filesystem_access: true,
  allowed_domains: [
    'api.anthropic.com',
    'api.openai.com',
    'huggingface.co',
    'storage.googleapis.com',
  ],
  filesystem_write_limits: [
    { path: '/tmp',         max_size_mb: 512,   read_only: false },
    { path: '/data/models', max_size_mb: 10240, read_only: true  },
  ],
};

// ─── /v1/proof/receipts ───────────────────────────────────────────────────────
//
// Chain of 8 receipts (desc order). Each receipt[i].prev_hash === receipt[i+1].hash.
// Receipt[7] (oldest) has prev_hash: '' → genesis.

const HASHES = [
  'sha256:0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b',
  'sha256:1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c',
  'sha256:2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d',
  'sha256:3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e',
  'sha256:4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f',
  'sha256:5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a',
  'sha256:6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b',
  'sha256:7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c',
];

const SIGS = [
  'sha256:a3f8b2c9d1e7f4a6b8c2d9e1f7a4b6c8d2e9f1a7b4c6d8e2f9a1b7c4d6e8f2a9b1',
  'sha256:b4c9d1e7f4a6b8c2d9e1f7a4b6c8d2e9f1a7b4c6d8e2f9a1b7c4d6e8f2a9b1c7d4',
  'sha256:c5d1e7f4a6b8c2d9e1f7a4b6c8d2e9f1a7b4c6d8e2f9a1b7c4d6e8f2a9b1c7d4e6',
  'sha256:d6e7f4a6b8c2d9e1f7a4b6c8d2e9f1a7b4c6d8e2f9a1b7c4d6e8f2a9b1c7d4e6f8',
  'sha256:e7f4a6b8c2d9e1f7a4b6c8d2e9f1a7b4c6d8e2f9a1b7c4d6e8f2a9b1c7d4e6f8a2',
  'sha256:f8a6b8c2d9e1f7a4b6c8d2e9f1a7b4c6d8e2f9a1b7c4d6e8f2a9b1c7d4e6f8a2b9',
  'sha256:a9b8c2d9e1f7a4b6c8d2e9f1a7b4c6d8e2f9a1b7c4d6e8f2a9b1c7d4e6f8a2b9c1',
  'sha256:b0c2d9e1f7a4b6c8d2e9f1a7b4c6d8e2f9a1b7c4d6e8f2a9b1c7d4e6f8a2b9c1d7',
];

const PUB_KEY = 'ed25519:pub_a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4';

export const MOCK_RECEIPTS = [
  // index 0: newest
  {
    id: 'rcpt-r01',
    execution_id: 'exec-3f7a9b2c-1d4e-4f8a-9c2b-8e1d7f4a3b9c',
    timestamp: minsAgo(2),
    signature: SIGS[0],
    hash: HASHES[0],
    prev_hash: HASHES[1],
    has_violation: false,
    signed: true,
    agent_id: 'agent-alpha-prod-01',
    device_id: 'dev-arm64-gpu-001',
    model: 'claude-sonnet-4-6',
    duration: 47320,
    public_key: PUB_KEY,
    verification_status: 'VERIFIED',
    device_context: { os: 'linux', arch: 'arm64', runtime_version: '1.4.2' },
    agent_context: { namespace: 'prod/inference/primary', policy_version: '3' },
  },
  // index 1
  {
    id: 'rcpt-r02',
    execution_id: 'exec-0b3c6d9e-2f5a-4b0c-6d9e-2f5a8b1c4d7e',
    timestamp: minsAgo(1),
    signature: SIGS[1],
    hash: HASHES[1],
    prev_hash: HASHES[2],
    has_violation: false,
    signed: true,
    agent_id: 'agent-beta-staging-02',
    device_id: 'dev-x86-cpu-003',
    model: 'claude-haiku-4-5-20251001',
    duration: 8940,
    public_key: PUB_KEY,
    verification_status: 'VERIFIED',
    device_context: { os: 'linux', arch: 'x86_64', runtime_version: '1.3.8' },
    agent_context: { namespace: 'staging/inference/batch', policy_version: '2' },
  },
  // index 2
  {
    id: 'rcpt-r03',
    execution_id: 'exec-7c2d1e8f-4b5a-4c9d-8e3f-2a7b4d6c1e9f',
    timestamp: minsAgo(18),
    signature: SIGS[2],
    hash: HASHES[2],
    prev_hash: HASHES[3],
    has_violation: false,
    signed: true,
    agent_id: 'agent-alpha-prod-01',
    device_id: 'dev-arm64-gpu-001',
    model: 'claude-sonnet-4-6',
    duration: 47320,
    public_key: PUB_KEY,
    verification_status: 'VERIFIED',
    device_context: { os: 'linux', arch: 'arm64', runtime_version: '1.4.2' },
    agent_context: { namespace: 'prod/inference/primary', policy_version: '3' },
  },
  // index 3: violation
  {
    id: 'rcpt-r04',
    execution_id: 'exec-5e8f1a2b-6c3d-4e9f-8a1b-2c7d4e6f9a8b',
    timestamp: minsAgo(47),
    signature: SIGS[3],
    hash: HASHES[3],
    prev_hash: HASHES[4],
    has_violation: true,
    signed: true,
    agent_id: 'agent-gamma-prod-03',
    device_id: 'dev-arm64-gpu-002',
    model: 'claude-opus-4-6',
    duration: 182500,
    violation_type: 'TICK_TIMEOUT',
    limit_value: 1000,
    observed_value: 1247,
    public_key: PUB_KEY,
    verification_status: 'VERIFIED',
    device_context: { os: 'linux', arch: 'arm64', runtime_version: '1.4.2' },
    agent_context: { namespace: 'prod/inference/heavy', policy_version: '3' },
  },
  // index 4
  {
    id: 'rcpt-r05',
    execution_id: 'exec-1a4b7c2d-9e3f-4a8b-7c1d-4e9f2a7b3c1d',
    timestamp: minsAgo(35),
    signature: SIGS[4],
    hash: HASHES[4],
    prev_hash: HASHES[5],
    has_violation: false,
    signed: true,
    agent_id: 'agent-beta-staging-02',
    device_id: 'dev-x86-cpu-003',
    model: 'claude-haiku-4-5-20251001',
    duration: 12300,
    public_key: PUB_KEY,
    verification_status: 'VERIFIED',
    device_context: { os: 'linux', arch: 'x86_64', runtime_version: '1.3.8' },
    agent_context: { namespace: 'staging/inference/batch', policy_version: '2' },
  },
  // index 5: unsigned (no signature)
  {
    id: 'rcpt-r06',
    execution_id: 'exec-9b2c5d8e-1f4a-4b7c-9d2e-5f8a1b4c7d2e',
    timestamp: minsAgo(62),
    signature: '',
    hash: HASHES[5],
    prev_hash: HASHES[6],
    has_violation: false,
    signed: false,
    agent_id: 'agent-delta-prod-04',
    device_id: 'dev-arm64-cpu-005',
    model: 'claude-sonnet-4-6',
    duration: 73100,
    public_key: '',
    verification_status: 'UNSIGNED',
    device_context: { os: 'linux', arch: 'arm64', runtime_version: '1.4.1' },
    agent_context: { namespace: 'prod/tools/http-delegate', policy_version: '3' },
  },
  // index 6: violation
  {
    id: 'rcpt-r07',
    execution_id: 'exec-2c5d8e1f-4a7b-4c2d-9e5f-8a1b4c7d2e5f',
    timestamp: minsAgo(130),
    signature: SIGS[6],
    hash: HASHES[6],
    prev_hash: HASHES[7],
    has_violation: true,
    signed: true,
    agent_id: 'agent-gamma-prod-03',
    device_id: 'dev-arm64-gpu-002',
    model: 'claude-opus-4-6',
    duration: 156200,
    violation_type: 'MEMORY_LIMIT',
    limit_value: 4096,
    observed_value: 4812,
    public_key: PUB_KEY,
    verification_status: 'VERIFIED',
    device_context: { os: 'linux', arch: 'arm64', runtime_version: '1.4.2' },
    agent_context: { namespace: 'prod/inference/heavy', policy_version: '2' },
  },
  // index 7: oldest / genesis
  {
    id: 'rcpt-r08',
    execution_id: 'exec-8f1a4b7c-2d5e-4f9a-8b1c-4d7e2f5a8b1c',
    timestamp: minsAgo(115),
    signature: SIGS[7],
    hash: HASHES[7],
    prev_hash: '',
    has_violation: false,
    signed: true,
    agent_id: 'agent-epsilon-prod-05',
    device_id: 'dev-arm64-gpu-002',
    model: 'claude-opus-4-6',
    duration: 214800,
    public_key: PUB_KEY,
    verification_status: 'VERIFIED',
    device_context: { os: 'linux', arch: 'arm64', runtime_version: '1.4.2' },
    agent_context: { namespace: 'prod/inference/multimodal', policy_version: '2' },
  },
];

// ─── /v1/proof/violations ─────────────────────────────────────────────────────

// Violations: include both `timestamp` (violations page) and `created_at` (dashboard)
function mkViol(
  id: string,
  kind: string,
  agent_id: string,
  device_id: string,
  minsOffset: number,
  execution_id: string,
  limit_value: number | null,
  observed_value: number | null,
  exec: object
) {
  const ts = minsAgo(minsOffset);
  return { id, kind, agent_id, device_id, timestamp: ts, created_at: ts, execution_id, limit_value, observed_value, execution: exec };
}

export const MOCK_VIOLATIONS = [
  mkViol(
    'viol-tick-001', 'TICK_TIMEOUT',
    'agent-gamma-prod-03', 'dev-arm64-gpu-002', 44,
    'exec-5e8f1a2b-6c3d-4e9f-8a1b-2c7d4e6f9a8b',
    1000, 1247,
    { id: 'exec-5e8f1a2b-6c3d-4e9f-8a1b-2c7d4e6f9a8b', status: 'VIOLATION', model: 'claude-opus-4-6', agent_id: 'agent-gamma-prod-03', device_id: 'dev-arm64-gpu-002', started_at: minsAgo(47), duration_ms: 182500 }
  ),
  mkViol(
    'viol-mem-001', 'MEMORY_LIMIT',
    'agent-gamma-prod-03', 'dev-arm64-gpu-002', 127,
    'exec-2c5d8e1f-4a7b-4c2d-9e5f-8a1b4c7d2e5f',
    4096, 4812,
    { id: 'exec-2c5d8e1f-4a7b-4c2d-9e5f-8a1b4c7d2e5f', status: 'VIOLATION', model: 'claude-opus-4-6', agent_id: 'agent-gamma-prod-03', device_id: 'dev-arm64-gpu-002', started_at: minsAgo(130), duration_ms: 156200 }
  ),
  mkViol(
    'viol-quota-001', 'QUOTA_EXCEEDED',
    'agent-eta-prod-07', 'dev-arm64-gpu-001', 300,
    'exec-7d0e3f6a-9b2c-4d7e-0f3a-6b9c2d5e8f1a',
    10000, 10183,
    { id: 'exec-7d0e3f6a-9b2c-4d7e-0f3a-6b9c2d5e8f1a', status: 'ERROR', model: 'claude-opus-4-6', agent_id: 'agent-eta-prod-07', device_id: 'dev-arm64-gpu-001', started_at: minsAgo(300), duration_ms: 332000 }
  ),
  mkViol(
    'viol-cpu-001', 'CPU_LIMIT',
    'agent-epsilon-prod-05', 'dev-arm64-gpu-002', 480,
    'exec-4d2e6f1a-8b3c-4d7e-9f2a-1b4c7d2e5f8a',
    80, 94,
    { id: 'exec-4d2e6f1a-8b3c-4d7e-9f2a-1b4c7d2e5f8a', status: 'VIOLATION', model: 'claude-opus-4-6', agent_id: 'agent-epsilon-prod-05', device_id: 'dev-arm64-gpu-002', started_at: minsAgo(485), duration_ms: 95000 }
  ),
  mkViol(
    'viol-cap-001', 'CAPABILITY_DENIED',
    'agent-theta-dev-08', 'dev-x86-cpu-007', 820,
    'exec-9e1f3a6b-2c4d-4e8f-1a3b-6c4d7e2f9a1b',
    null, null,
    { id: 'exec-9e1f3a6b-2c4d-4e8f-1a3b-6c4d7e2f9a1b', status: 'ERROR', model: 'claude-haiku-4-5-20251001', agent_id: 'agent-theta-dev-08', device_id: 'dev-x86-cpu-007', started_at: minsAgo(822), duration_ms: 4200 }
  ),
];

// ─── /v1/history/logs ─────────────────────────────────────────────────────────

function makeLog(
  id: string,
  minsOffset: number,
  severity: string,
  device_id: string | undefined,
  agent_id: string | undefined,
  message: string
) {
  return { id, timestamp: minsAgo(minsOffset), severity, device_id, agent_id, message };
}

export const MOCK_LOGS = [
  makeLog('log-001', 0.1,  'INFO',  'dev-arm64-gpu-001', 'agent-alpha-prod-01',   'Tick #42 dispatched. tokens=3412'),
  makeLog('log-002', 0.5,  'INFO',  'dev-x86-cpu-003',   'agent-beta-staging-02', 'Agent started. Model: claude-haiku-4-5-20251001'),
  makeLog('log-003', 1.0,  'DEBUG', 'dev-arm64-gpu-001', 'agent-alpha-prod-01',   'HTTP GET api.openai.com/v1/models → 200 (412 bytes)'),
  makeLog('log-004', 1.5,  'INFO',  'dev-arm64-gpu-001', 'agent-alpha-prod-01',   'Tool call: read_file("/data/config.yaml") → 2048 bytes'),
  makeLog('log-005', 2.2,  'WARN',  'dev-arm64-gpu-002', 'agent-gamma-prod-03',   'Tick #3 approaching budget: 892ms / 1000ms limit'),
  makeLog('log-006', 2.5,  'ERROR', 'dev-arm64-gpu-002', 'agent-gamma-prod-03',   'VIOLATION: max_tick_ms exceeded (policy: 1000ms, actual: 1247ms)'),
  makeLog('log-007', 2.6,  'INFO',  'dev-arm64-gpu-002', 'agent-gamma-prod-03',   'Agent terminated by SLO enforcer'),
  makeLog('log-008', 3.0,  'INFO',  'dev-x86-cpu-003',   'agent-beta-staging-02', 'Execution complete. Ticks: 1, tokens: 842'),
  makeLog('log-009', 3.5,  'DEBUG', 'dev-arm64-gpu-001', 'agent-alpha-prod-01',   'Tick #43 started (budget: 500ms)'),
  makeLog('log-010', 4.0,  'INFO',  'dev-arm64-cpu-005', 'agent-delta-prod-04',   'Agent started. Model: claude-sonnet-4-6'),
  makeLog('log-011', 4.5,  'ERROR', 'dev-arm64-cpu-005', 'agent-delta-prod-04',   'HTTP call failed: connection timeout (api.anthropic.com)'),
  makeLog('log-012', 4.6,  'ERROR', 'dev-arm64-cpu-005', 'agent-delta-prod-04',   'Retry 1/2 — waiting 2000ms'),
  makeLog('log-013', 5.0,  'INFO',  'dev-arm64-gpu-001', 'agent-alpha-prod-01',   'Tick #44 complete. 38ms'),
  makeLog('log-014', 5.5,  'INFO',  'dev-arm64-gpu-002', 'agent-epsilon-prod-05', 'Agent started. Multi-modal task. tokens=8192'),
  makeLog('log-015', 6.0,  'DEBUG', 'dev-arm64-gpu-001', 'agent-alpha-prod-01',   'Inference call dispatched'),
  makeLog('log-016', 6.5,  'WARN',  'dev-arm64-gpu-002', undefined,               'Device memory at 89.8% capacity'),
  makeLog('log-017', 7.0,  'INFO',  'dev-x86-cpu-003',   'agent-beta-staging-02', 'Batch job started. queue_depth=12'),
  makeLog('log-018', 8.0,  'DEBUG', 'dev-arm64-gpu-002', 'agent-epsilon-prod-05', 'File write: /tmp/output.bin 12.4MB'),
  makeLog('log-019', 9.0,  'INFO',  'dev-arm64-gpu-001', 'agent-alpha-prod-01',   'Execution complete. Ticks: 4, tokens: 11840, duration: 47.3s'),
  makeLog('log-020', 10.0, 'INFO',  'dev-arm64-gpu-002', 'agent-epsilon-prod-05', 'Execution complete. Ticks: 6, tokens: 38440, duration: 214.8s'),
  makeLog('log-021', 11.0, 'INFO',  'dev-x86-cpu-003',   'agent-beta-staging-02', 'Batch item 1/12 processed'),
  makeLog('log-022', 12.0, 'DEBUG', undefined,            undefined,               'Fleet heartbeat — 4 devices online'),
  makeLog('log-023', 13.0, 'INFO',  'dev-arm64-gpu-001', 'agent-alpha-prod-01',   'Agent restarted for new task'),
  makeLog('log-024', 14.0, 'WARN',  'dev-x86-cpu-003',   'agent-beta-staging-02', 'Quota at 68% for current billing period'),
  makeLog('log-025', 15.0, 'FATAL', 'dev-arm64-gpu-002', 'agent-eta-prod-07',     'Runtime panic: nil pointer dereference in router.go:142'),
  makeLog('log-026', 15.1, 'INFO',  'dev-arm64-gpu-002', 'agent-eta-prod-07',     'Crash handler triggered — recovery process started'),
  makeLog('log-027', 18.0, 'INFO',  'dev-x86-cpu-003',   'agent-beta-staging-02', 'Batch item 6/12 processed'),
  makeLog('log-028', 20.0, 'INFO',  'dev-arm64-gpu-001', 'agent-alpha-prod-01',   'Tick #1 started. agent=alpha-prod-01'),
  makeLog('log-029', 22.0, 'DEBUG', 'dev-arm64-gpu-002', 'agent-eta-prod-07',     'Recovery complete — runtime context restored'),
  makeLog('log-030', 25.0, 'INFO',  'dev-x86-cpu-003',   'agent-beta-staging-02', 'Batch complete. 12/12 items processed'),
];

// ─── /v1/history/metrics ──────────────────────────────────────────────────────

function wave(i: number, base: number, amp: number, freq: number): number {
  return Math.round((base + amp * Math.sin((i / freq) * Math.PI * 2)) * 10) / 10;
}

const METRIC_COUNT = 24;
const METRIC_TS = genTs(METRIC_COUNT, 60 * 60 * 1000); // 1h range

export const MOCK_METRICS = {
  timestamps:   METRIC_TS,
  latency_p50:  Array.from({ length: METRIC_COUNT }, (_, i) => wave(i, 820, 120, 8)),
  latency_p95:  Array.from({ length: METRIC_COUNT }, (_, i) => wave(i, 1400, 300, 6)),
  latency_p99:  Array.from({ length: METRIC_COUNT }, (_, i) => wave(i, 2100, 600, 5)),
  throughput:   Array.from({ length: METRIC_COUNT }, (_, i) => wave(i, 38, 14, 7)),
  error_rate:   Array.from({ length: METRIC_COUNT }, (_, i) => Math.max(0, wave(i, 0.4, 0.6, 4))),
  cpu_percent:  Array.from({ length: METRIC_COUNT }, (_, i) => wave(i, 45, 22, 9)),
  memory_mb:    Array.from({ length: METRIC_COUNT }, (_, i) => wave(i, 2100, 400, 8)),
};

// ─── /v1/history/alerts ───────────────────────────────────────────────────────

export const MOCK_ALERTS = [
  {
    id: 'alert-001',
    timestamp: minsAgo(5),
    severity: 'CRITICAL',
    message: 'Agent agent-eta-prod-07 encountered runtime panic — recovery triggered',
    status: 'ACTIVE',
    source: 'runtime-monitor',
  },
  {
    id: 'alert-002',
    timestamp: minsAgo(44),
    severity: 'WARNING',
    message: 'SLO violation: agent-gamma-prod-03 exceeded max_tick_ms (1000ms → 1247ms)',
    status: 'RESOLVED',
    source: 'slo-enforcer',
  },
  {
    id: 'alert-003',
    timestamp: minsAgo(127),
    severity: 'CRITICAL',
    message: 'Memory limit exceeded: agent-gamma-prod-03 used 4812MB / 4096MB limit',
    status: 'RESOLVED',
    source: 'slo-enforcer',
  },
  {
    id: 'alert-004',
    timestamp: minsAgo(300),
    severity: 'WARNING',
    message: 'Quota threshold reached: 97% of monthly request quota consumed',
    status: 'RESOLVED',
    source: 'quota-monitor',
  },
  {
    id: 'alert-005',
    timestamp: minsAgo(420),
    severity: 'INFO',
    message: 'Device dev-x86-cpu-006 went offline — last seen 7 hours ago',
    status: 'ACTIVE',
    source: 'fleet-monitor',
  },
  {
    id: 'alert-006',
    timestamp: minsAgo(820),
    severity: 'WARNING',
    message: 'Capability denied: agent-theta-dev-08 attempted filesystem write (not allowed)',
    status: 'RESOLVED',
    source: 'capability-enforcer',
  },
];

// ─── /v1/settings/notifications ───────────────────────────────────────────────

export const MOCK_NOTIFICATION_PREFS = {
  email_violations: true,
  email_alerts: true,
  email_weekly_report: false,
  webhook_violations: false,
  webhook_alerts: false,
};

// ─── /v1/license ──────────────────────────────────────────────────────────────

export const MOCK_LICENSE = {
  license_key: 'igris-lic-horizon-demo-abc123456789',
  masked_key: 'igris-lic-hor••••••••••••••••••••••56789',
  plan: 'horizon',
  status: 'ACTIVE',
  valid_until: '2027-03-01T00:00:00Z',
  quota_requests: 50000,
  quota_used: 31240,
  quota_devices: 50,
  quota_devices_used: 4,
  features: [
    'Up to 50 instances',
    'Fleet dashboard',
    'OTA verified updates',
    '30-day retention',
    'Email support (24h)',
  ],
};

// ─── /v1/executions/{id} ──────────────────────────────────────────────────────

export const MOCK_EXECUTION_DETAIL = {
  id: 'exec-5e8f1a2b-6c3d-4e9f-8a1b-2c7d4e6f9a8b',
  status: 'VIOLATION',
  model: 'claude-opus-4-6',
  agent_id: 'agent-gamma-prod-03',
  device_id: 'dev-arm64-gpu-002',
  started_at: minsAgo(47),
  duration: 182500,
};

// ─── /v1/executions/{id}/policy ───────────────────────────────────────────────

export const MOCK_EXECUTION_POLICY = {
  cpu_limit_percent: 75,
  memory_limit_mb: 2048,
  max_tick_ms: 500,
  quota_limit: 1000,
};

// ─── Mock registry ────────────────────────────────────────────────────────────

const MOCK_DATA: Record<string, unknown> = {
  '/v1/stats/overview':            MOCK_STATS_OVERVIEW,
  '/v1/stats/model-usage':         MOCK_MODEL_USAGE,
  '/v1/execution/runs':            MOCK_RUNS,
  '/v1/execution/agents':          MOCK_AGENTS,
  '/v1/fleet/devices':             MOCK_DEVICES,
  '/v1/model/routing':             MOCK_MODEL_ROUTING,
  '/v1/model/providers':           MOCK_MODEL_PROVIDERS,
  '/v1/model/cost':                MOCK_MODEL_COST,
  '/v1/policy/bounds':             MOCK_POLICY_BOUNDS,
  '/v1/policy/bounds/history':     MOCK_POLICY_BOUNDS_HISTORY,
  '/v1/policy/capabilities':       MOCK_POLICY_CAPABILITIES,
  '/v1/proof/receipts':            MOCK_RECEIPTS,
  '/v1/proof/violations':          MOCK_VIOLATIONS,
  '/v1/history/logs':              MOCK_LOGS,
  '/v1/history/metrics':           MOCK_METRICS,
  '/v1/history/alerts':            MOCK_ALERTS,
  '/v1/settings/notifications':    MOCK_NOTIFICATION_PREFS,
  '/v1/license':                   MOCK_LICENSE,
  // dynamic: /v1/executions/{id} and /v1/executions/{id}/policy
  '/v1/executions/{id}':           MOCK_EXECUTION_DETAIL,
  '/v1/executions/{id}/policy':    MOCK_EXECUTION_POLICY,
};

/**
 * Return mock data for a given API path, or undefined if no mock exists.
 * Strips query params before lookup. Handles dynamic segments like {id}.
 */
export function getMockForPath(path: string): unknown {
  const basePath = path.split('?')[0].replace(/\/$/, '');

  // Exact match
  if (basePath in MOCK_DATA && MOCK_DATA[basePath] !== null) {
    return MOCK_DATA[basePath];
  }

  // Pattern match for dynamic segments
  for (const pattern of Object.keys(MOCK_DATA)) {
    if (!pattern.includes('{')) continue;
    const regex = new RegExp(
      '^' + pattern.replace(/\{[^}]+\}/g, '[^/]+') + '$'
    );
    if (regex.test(basePath) && MOCK_DATA[pattern] !== null) {
      return MOCK_DATA[pattern];
    }
  }

  return undefined;
}
