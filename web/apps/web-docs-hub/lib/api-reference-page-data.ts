import 'server-only';

import type {
  ApiCodeSample,
  ApiEndpoint,
  ApiEndpointPageData,
  ApiField,
  ApiSection,
  ApiStatusCode,
} from '@/lib/api-reference-shared';
import {
  getApiEndpointHref,
  getApiEndpointSlug,
  getApiSectionSlug,
} from '@/lib/api-reference-shared';

type ApiQueryExampleValue = string | number | boolean;
type ApiExampleObject = Record<string, unknown>;
type ApiExampleValue = string | ApiExampleObject | Array<ApiExampleObject>;

type EndpointOverride = {
  functionality?: string;
  notes?: string[];
  pathParams?: ApiField[];
  queryParams?: ApiField[];
  queryExample?: Record<string, ApiQueryExampleValue>;
  requestBodyFields?: ApiField[];
  requestExample?: ApiExampleValue | null;
  responseExample?: ApiExampleValue | null;
  statusCodes?: ApiStatusCode[];
};

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function endpointKey(endpoint: ApiEndpoint) {
  return `${endpoint.method} ${endpoint.path}`;
}

const endpointOverrides: Record<string, EndpointOverride> = {
  'POST /v1/chat/completions': {
    functionality:
      'OpenAI-compatible chat completion entrypoint. Use this when you want portable client compatibility while still routing through Igris policy, receipts, and provider selection.',
    requestBodyFields: [
      { name: 'model', type: 'string', required: true, description: 'Upstream model identifier or routed model name.' },
      { name: 'messages', type: 'array', required: true, description: 'Conversation turns in OpenAI chat format.' },
      { name: 'temperature', type: 'number', description: 'Optional sampling control.' },
      { name: 'stream', type: 'boolean', description: 'Enable streamed responses when supported by the deployment.' },
    ],
    requestExample: {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You answer concisely.' },
        { role: 'user', content: 'Summarize the latest runtime health.' },
      ],
      temperature: 0.2,
    },
    responseExample: {
      id: 'chatcmpl_01HV8YZB4B6MQQ1Q8',
      object: 'chat.completion',
      created: 1712338123,
      model: 'gpt-4o-mini',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'Runtime fleet is healthy and accepting traffic.' },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 28,
        completion_tokens: 12,
        total_tokens: 40,
      },
    },
  },
  'POST /v1/infer': {
    functionality:
      'Native inference contract for integrations that want routing hints, provider pinning, or request metadata beyond the OpenAI-compatible surface.',
    requestBodyFields: [
      { name: 'model', type: 'string', required: true, description: 'Requested model or routing target.' },
      { name: 'messages', type: 'array', required: true, description: 'Conversation turns in Igris message format.' },
      { name: 'provider', type: 'string', description: 'Optional provider pin.' },
      { name: 'optimize_for', type: 'string', description: 'Routing preference such as `latency` or `cost`.' },
    ],
    requestExample: {
      model: 'gpt-4o-mini',
      provider: 'openai',
      optimize_for: 'latency',
      messages: [{ role: 'user', content: 'Classify this alert severity.' }],
    },
    responseExample: {
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'severity=warning' },
          finish_reason: 'stop',
        },
      ],
      route: {
        provider: 'openai',
        optimize_for: 'latency',
      },
      receipt_id: 'rcpt_01HV93C2PKR0N8SVQ',
    },
  },
  'GET /v1/models': {
    functionality:
      'Returns the model names currently exposed by the inference layer. Use it to populate model pickers or to verify what a deployment has enabled.',
    responseExample: {
      object: 'list',
      data: [
        { id: 'gpt-4o-mini', object: 'model', owned_by: 'openai' },
        { id: 'claude-3-5-sonnet', object: 'model', owned_by: 'anthropic' },
      ],
    },
  },
  'GET /v1/providers/stats': {
    functionality:
      'Exposes high-level provider health and routing telemetry so you can understand latency, error rate, and current selection pressure.',
    responseExample: {
      providers: [
        { provider: 'openai', latency_ms_p50: 410, success_rate_percent: 99.4, status: 'healthy' },
        { provider: 'anthropic', latency_ms_p50: 620, success_rate_percent: 98.9, status: 'healthy' },
      ],
      generated_at: '2026-04-04T06:10:00Z',
    },
  },
  'POST /v1/vault/keys': {
    functionality:
      'Stores a provider credential for tenant-scoped routing. The raw upstream key is encrypted server-side; list and get calls only return masked values.',
    requestBodyFields: [
      { name: 'provider', type: 'string', required: true, description: 'Public provider identifier such as `openai` or `anthropic`.' },
      { name: 'key_name', type: 'string', required: true, description: 'Human-readable label for the key record.' },
      { name: 'api_key', type: 'string', required: true, description: 'Raw provider credential to encrypt and store.' },
    ],
    requestExample: {
      provider: 'openai',
      key_name: 'production',
      api_key: 'sk-live-redacted',
    },
    responseExample: {
      id: 'vault_01HV8Z7R5J8Q4KSY3',
      provider: 'openai',
      key_name: 'production',
      masked_key: 'sk-li...cted',
      is_active: true,
      created_at: '2026-04-04T06:12:00Z',
    },
    statusCodes: [
      {
        code: 201,
        title: 'Created',
        description: 'The provider key was stored and masked metadata is returned.',
      },
      {
        code: 400,
        title: 'Invalid request',
        description: 'The body was invalid, the provider was unsupported, or the upstream key failed validation.',
        example: JSON.stringify({ error: 'Invalid provider. Must be one of: openai, anthropic, benchmark', code: 'INVALID_PROVIDER' }, null, 2),
      },
      {
        code: 401,
        title: 'Unauthorized',
        description: 'Session or API key auth failed.',
        example: JSON.stringify({ error: 'unauthorized', code: 'INVALID_API_KEY' }, null, 2),
      },
      {
        code: 500,
        title: 'Storage failed',
        description: 'The key vault could not persist the encrypted key.',
        example: JSON.stringify({ error: 'Failed to store API key', code: 'STORAGE_FAILED' }, null, 2),
      },
    ],
  },
  'GET /v1/vault/keys': {
    functionality:
      'Lists stored provider keys for the current tenant. Returned keys are masked and include usage metadata when available.',
    queryParams: [{ name: 'provider', type: 'string', description: 'Optional provider filter.' }],
    queryExample: { provider: 'openai' },
    responseExample: {
      keys: [
        {
          id: 'vault_01HV8Z7R5J8Q4KSY3',
          provider: 'openai',
          key_name: 'production',
          masked_key: 'sk-li...cted',
          is_active: true,
          usage_count: 182,
          created_at: '2026-04-04T06:12:00Z',
        },
      ],
      count: 1,
    },
  },
  'GET /v1/account/api-key': {
    functionality:
      'Returns metadata for the tenant API key without exposing the raw secret again. Use this to check whether a key exists and when it was last rotated.',
    responseExample: {
      has_key: true,
      prefix: 'igris_a1b2c3',
      created_at: '2026-04-04T06:15:00Z',
    },
  },
  'POST /v1/account/api-key': {
    functionality:
      'Creates a new tenant API key and returns the raw secret once. The previous key is revoked immediately when the new one is issued.',
    responseExample: {
      api_key: 'igris_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      prefix: 'igris_012345',
      created_at: '2026-04-04T06:15:00Z',
    },
    statusCodes: [
      {
        code: 201,
        title: 'Created',
        description: 'A new tenant API key was created and returned one time.',
      },
      {
        code: 401,
        title: 'Unauthorized',
        description: 'Session or API key auth failed.',
        example: JSON.stringify({ error: 'unauthorized', code: 'MISSING_SESSION' }, null, 2),
      },
      {
        code: 500,
        title: 'Generation failed',
        description: 'The platform could not generate or persist the new key.',
        example: JSON.stringify({ error: 'key_storage_failed' }, null, 2),
      },
    ],
  },
  'POST /api/v1/runtime/register': {
    functionality:
      'Registers an igris-runtime instance against a tenant so it can appear in Fleet and receive commands from the control plane.',
    requestBodyFields: [
      { name: 'machine_id', type: 'string', required: true, description: 'Stable runtime fingerprint for the host.' },
      { name: 'hostname', type: 'string', required: true, description: 'Display hostname for fleet views.' },
      { name: 'platform', type: 'string', description: 'Platform identifier such as `linux-amd64`.' },
      { name: 'runtime_version', type: 'string', required: true, description: 'Runtime version string.' },
      { name: 'endpoint', type: 'string', description: 'Optional public endpoint for the runtime.' },
    ],
    requestExample: {
      machine_id: 'dev_0f4c3f1a2d9b45cf',
      hostname: 'edge-node-01',
      platform: 'linux-amd64',
      runtime_version: 'runtime-v1.6.0',
      endpoint: 'http://10.0.0.12:8080',
    },
    responseExample: {
      runtime_id: 'rt_01HV94AS6G98PZ2YH',
      tier: 'seed',
      runtime_limit: 3,
      registered_at: '2026-04-04T06:21:00Z',
    },
  },
  'POST /api/v1/runtime/heartbeat': {
    functionality:
      'Refreshes liveness for an already-registered runtime instance and optionally carries the latest behavior-tree execution snapshot.',
    requestBodyFields: [
      { name: 'machine_id', type: 'string', required: true, description: 'Stable runtime fingerprint for the host.' },
      { name: 'bt_state', type: 'object', description: 'Optional current behavior-tree state snapshot.' },
    ],
    requestExample: {
      machine_id: 'dev_0f4c3f1a2d9b45cf',
      bt_state: {
        tick: 418,
        status: 'running',
      },
    },
    responseExample: {
      status: 'ok',
      machine_id: 'dev_0f4c3f1a2d9b45cf',
      heartbeat_at: '2026-04-04T06:22:00Z',
    },
  },
  'GET /api/v1/runtime/list': {
    functionality:
      'Lists runtime instances already registered to a tenant. This fleet read model accepts either authenticated tenant context or an explicit `tenant_id` query parameter.',
    queryParams: [
      { name: 'tenant_id', type: 'string', description: 'Optional explicit tenant identifier when no authenticated tenant context is present.' },
    ],
    queryExample: {
      tenant_id: 'tenant_01HV95QXYD8FAPJ',
    },
    responseExample: {
      runtimes: [
        {
          runtime_id: 'rt_01HV94AS6G98PZ2YH',
          tenant_id: 'tenant_01HV95QXYD8FAPJ',
          registered_at: '2026-04-04T06:21:00Z',
          last_heartbeat: '2026-04-04T06:33:00Z',
          stats: {
            hostname: 'edge-node-01',
            platform: 'linux-amd64',
          },
        },
      ],
      count: 1,
    },
    statusCodes: [
      {
        code: 200,
        title: 'Success',
        description: 'Runtime inventory was returned for the resolved tenant.',
      },
      {
        code: 400,
        title: 'Missing tenant',
        description: 'The request did not include an authenticated tenant context or a `tenant_id` query parameter.',
        example: prettyJson({
          error: 'missing_tenant_id',
          message: 'tenant_id query parameter or authentication required',
        }),
      },
    ],
    notes: [
      'When you call this route outside an authenticated console session, include the `tenant_id` query parameter explicitly.',
    ],
  },
  'POST /api/v1/runtime/config/push': {
    functionality:
      'Queues a configuration update for one or more runtimes. The runtime fetches the queued command on its next command poll.',
    requestBodyFields: [
      { name: 'runtime_ids', type: 'array', required: true, description: 'One or more runtime IDs to target.' },
      { name: 'config', type: 'object', required: true, description: 'Configuration payload to push.' },
    ],
    requestExample: {
      runtime_ids: ['rt_01HV94AS6G98PZ2YH'],
      config: {
        local_fallback: {
          enabled: true,
          model_path: '/models/phi-3-mini.gguf',
        },
      },
    },
    responseExample: {
      status: 'queued',
      dispatched_to: 1,
    },
  },
  'POST /api/v1/runtime/update': {
    functionality:
      'Queues a runtime update command. Use this to coordinate OTA rollout from the control plane rather than pulling binaries manually on every node.',
    requestBodyFields: [
      { name: 'runtime_ids', type: 'array', required: true, description: 'One or more runtime IDs to target.' },
      { name: 'version', type: 'string', required: true, description: 'Target runtime version or release channel.' },
    ],
    requestExample: {
      runtime_ids: ['rt_01HV94AS6G98PZ2YH'],
      version: 'runtime-v1.6.0',
    },
    responseExample: {
      status: 'queued',
      dispatched_to: 1,
    },
  },
  'GET /v1/history/events': {
    functionality:
      'Returns recent execution history events for the tenant. Use filters to scope by time range, agent, or device.',
    queryParams: [
      { name: 'range', type: 'string', description: 'Time window such as `last_1h`, `last_24h`, or `last_7d`.' },
      { name: 'limit', type: 'integer', description: 'Maximum number of events to return.' },
      { name: 'agent_id', type: 'string', description: 'Optional agent filter.' },
      { name: 'device_id', type: 'string', description: 'Optional runtime/device filter.' },
    ],
    queryExample: {
      range: 'last_24h',
      limit: 50,
    },
    responseExample: [
      {
        id: 'evt_01HV95R97QYPV4B8M',
        execution_id: 'exec_01HV95R5Y3TVVJ7R3',
        agent_id: 'agent_router',
        device_id: 'rt_01HV94AS6G98PZ2YH',
        timestamp: '2026-04-04T06:33:00Z',
        duration_ms: 483,
        event_type: 'execution_completed',
        severity: 'info',
        message: 'Execution completed successfully',
      },
    ],
  },
  'GET /v1/receipts': {
    functionality:
      'Lists execution receipts for the tenant from the coordination layer. Use time and agent filters to build audit views or exports.',
    queryParams: [
      { name: 'limit', type: 'integer', description: 'Maximum number of receipts to return.' },
      { name: 'from', type: 'string', description: 'RFC3339 lower time bound.' },
      { name: 'to', type: 'string', description: 'RFC3339 upper time bound.' },
      { name: 'agent_id', type: 'string', description: 'Optional agent filter.' },
      { name: 'violations_only', type: 'boolean', description: 'Restrict results to violation receipts.' },
    ],
    queryExample: {
      limit: 50,
      violations_only: false,
    },
    responseExample: [
      {
        execution_id: 'exec_01HV95R5Y3TVVJ7R3',
        agent_id: 'agent_router',
        runtime_id: 'rt_01HV94AS6G98PZ2YH',
        tenant_id: 'tenant_01HV95QXYD8FAPJ',
        timestamp_utc: '2026-04-04T06:33:00Z',
        wall_time_ms: 483,
        cpu_time_ms: 422,
        memory_peak_mb: 190,
        tool_calls: 2,
        violation_occurred: false,
        status: 'completed',
        receipt_hash: '6f16f4bc...',
        previous_hash: 'eb03e1a0...',
        signature: 'MEUCID...',
      },
    ],
  },
  'GET /v1/receipts/export': {
    functionality:
      'Streams an execution receipt export as an attachment. Use `format=jsonl` for NDJSON or `format=csv` for spreadsheet-compatible output.',
    queryParams: [
      { name: 'format', type: 'string', description: 'Export format. `jsonl` is the default; `csv` streams comma-separated rows.' },
      { name: 'from', type: 'string', description: 'RFC3339 lower time bound.' },
      { name: 'to', type: 'string', description: 'RFC3339 upper time bound.' },
    ],
    queryExample: {
      format: 'jsonl',
    },
    responseExample: `{"execution_id":"exec_01HV95R5Y3TVVJ7R3","agent_id":"agent_router","runtime_id":"rt_01HV94AS6G98PZ2YH","timestamp_utc":"2026-04-04T06:33:00Z","wall_time_ms":483,"cpu_time_ms":422,"memory_peak_mb":190,"tool_calls":2,"violation_occurred":false,"status":"completed","receipt_hash":"6f16f4bc..."}
{"execution_id":"exec_01HV96B3W64CK1KPG","agent_id":"agent_dispatch","runtime_id":"rt_01HV94AS6G98PZ2YH","timestamp_utc":"2026-04-04T06:41:00Z","wall_time_ms":612,"cpu_time_ms":501,"memory_peak_mb":214,"tool_calls":4,"violation_occurred":true,"status":"completed","receipt_hash":"9db11ce7..."}`,
    statusCodes: [
      {
        code: 200,
        title: 'Attachment stream',
        description: 'The response body is streamed directly as `application/x-ndjson` or `text/csv` with `Content-Disposition` set for download.',
      },
      {
        code: 401,
        title: 'Unauthorized',
        description: 'The request did not include a valid tenant session or API key.',
        example: prettyJson({ error: 'unauthorized' }),
      },
      {
        code: 500,
        title: 'Server error',
        description: 'The export query failed before the attachment stream could be produced.',
        example: prettyJson({ error: 'internal_error' }),
      },
    ],
    notes: [
      'The default format is NDJSON (`application/x-ndjson`) with filename `receipts.jsonl`.',
      'When `format=csv`, the same route streams `text/csv` with filename `receipts.csv`.',
    ],
  },
  'POST /proof/receipts/verify': {
    functionality:
      'Verifies a receipt hash and signature for a known execution. Use this to confirm the proof chain before presenting a receipt externally.',
    requestBodyFields: [
      { name: 'execution_id', type: 'string', required: true, description: 'Execution identifier to verify.' },
      { name: 'expected_hash', type: 'string', description: 'Optional expected receipt hash for direct comparison.' },
    ],
    requestExample: {
      execution_id: 'exec_01HV95R5Y3TVVJ7R3',
      expected_hash: '6f16f4bc4d6627240ca4c7d66ea2d7d2',
    },
    responseExample: {
      valid: true,
      execution_id: 'exec_01HV95R5Y3TVVJ7R3',
      hash: '6f16f4bc4d6627240ca4c7d66ea2d7d2',
      signature: 'MEUCID...==',
    },
  },
  'GET /v1/health': {
    functionality:
      'Simple health probe for the local runtime API. Use it for readiness checks and to confirm the local process is serving traffic.',
    responseExample: {
      status: 'ok',
      version: 'runtime-v1.6.0',
    },
  },
  'POST /v1/tasks/submit': {
    functionality:
      'Submits a durable multi-step task to the coordination layer. The layer creates a task record, selects the healthiest available runtime (lowest active task count), and dispatches asynchronously. Returns immediately with a task_id — poll GET /v1/tasks/:id for status.\n\nEach step is backed by a Write-Ahead Log: the runtime writes an Intent entry before executing and a signed Committed entry after. Periodic checkpoints are pushed back to the coordination layer so a new runtime can resume exactly where the previous one stopped.',
    requestBodyFields: [
      { name: 'task_type', type: 'string', required: true, description: 'Workflow category. One of `agent_workflow`, `robotics_workflow`, or `single_inference`.' },
      { name: 'task_definition', type: 'object', required: true, description: 'Task payload. Must include a nested `task_type` object with the steps or inference parameters.' },
      { name: 'idempotency_key', type: 'string', description: 'Deduplicated on the coordination layer. Submitting the same key twice returns the original response.' },
      { name: 'deadline_at', type: 'string', description: 'RFC3339 deadline. The runtime checkpoints and stops if execution reaches this time.' },
    ],
    requestExample: {
      task_type: 'agent_workflow',
      task_definition: {
        task_type: {
          type: 'agent_workflow',
          steps: [
            { step_index: 0, model: 'gpt-4o', messages: [{ role: 'user', content: 'Summarize the Q3 report' }] },
            { step_index: 1, model: 'gpt-4o', messages: [{ role: 'user', content: 'Extract action items from the summary' }] },
          ],
        },
      },
      idempotency_key: 'report-q3-2026-run-1',
      deadline_at: '2026-04-04T18:00:00Z',
    },
    responseExample: {
      task_id: '018f4a2b-3c1e-7a2d-9b8f-4d5e6f7a8b9c',
      status: 'dispatched',
      created_at: '2026-04-04T14:30:00Z',
    },
    statusCodes: [
      { code: 202, title: 'Accepted', description: 'Task created and dispatched to a runtime. Poll GET /v1/tasks/:id for progress.' },
      { code: 400, title: 'Bad request', description: 'Missing task_definition or task_type.', example: prettyJson({ error: 'task_definition required' }) },
      { code: 401, title: 'Unauthorized', description: 'Session or API key auth failed.', example: prettyJson({ error: 'unauthenticated' }) },
      { code: 503, title: 'No runtime available', description: 'No healthy runtime is registered for this tenant.', example: prettyJson({ error: 'dispatch_failed', message: 'no healthy runtime for tenant tenant_01HV' }) },
    ],
    notes: [
      'The idempotency_key is deduplicated on the coordination layer. Submitting the same key with the same body returns the cached response without re-executing.',
      'The coordination layer selects the runtime with the lowest active task count, not a round-robin assignment.',
    ],
  },
  'GET /v1/tasks/:id': {
    functionality:
      'Returns the current status, runtime assignment, and last checkpoint metadata for a durable task. Use this to poll for completion or to retrieve a resume token after interruption.',
    pathParams: [
      { name: 'id', type: 'string', required: true, description: 'Task ID returned by POST /v1/tasks/submit.' },
    ],
    responseExample: {
      task_id: '018f4a2b-3c1e-7a2d-9b8f-4d5e6f7a8b9c',
      status: 'checkpointed',
      runtime_id: 'runtime-edge-03',
      last_step: 9,
      checkpoint_digest: 'a3f8e2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1',
      dispatched_at: '2026-04-04T14:30:01Z',
      completed_at: null,
    },
    statusCodes: [
      { code: 200, title: 'Success', description: 'Task record returned.' },
      { code: 401, title: 'Unauthorized', description: 'Session or API key auth failed.' },
      { code: 404, title: 'Not found', description: 'No task with this ID exists for the authenticated tenant.', example: prettyJson({ error: 'task not found' }) },
    ],
    notes: [
      'Status values: `pending`, `dispatched`, `checkpointed`, `completed`, `failed`, `recovering`.',
      '`last_step` and `checkpoint_digest` are only present once the runtime has pushed at least one checkpoint.',
    ],
  },
  'GET /v1/tasks': {
    functionality:
      'Lists recent durable tasks for the authenticated tenant, newest first. Useful for building status dashboards and monitoring long-running workflows.',
    queryParams: [
      { name: 'limit', type: 'integer', description: 'Maximum number of tasks to return. Defaults to 20, maximum 100.' },
    ],
    queryExample: { limit: 20 },
    responseExample: {
      tasks: [
        {
          task_id: '018f4a2b-3c1e-7a2d-9b8f-4d5e6f7a8b9c',
          status: 'completed',
          runtime_id: 'runtime-edge-03',
          dispatched_at: '2026-04-04T14:30:01Z',
          completed_at: '2026-04-04T14:31:45Z',
          created_at: '2026-04-04T14:30:00Z',
        },
        {
          task_id: '018f4a2b-0000-1111-2222-333344445555',
          status: 'checkpointed',
          runtime_id: 'runtime-edge-01',
          last_step: 4,
          dispatched_at: '2026-04-04T14:28:00Z',
          completed_at: null,
          created_at: '2026-04-04T14:27:58Z',
        },
      ],
      total: 2,
    },
  },
  'POST /v1/tasks/:id/checkpoint': {
    functionality:
      'Persists a WAL checkpoint from the executing runtime to the coordination layer. The coordination layer stores both the checkpoint payload and a `ResumeToken` so any subsequent runtime can verify and resume from this step.\n\nThis endpoint is called by the runtime automatically at each checkpoint interval. You do not need to call it directly unless you are building a custom runtime integration.',
    pathParams: [
      { name: 'id', type: 'string', required: true, description: 'Task ID.' },
    ],
    requestBodyFields: [
      { name: 'resume_token', type: 'object', required: true, description: 'Resume token with `last_committed_step`, `checkpoint_digest` (hex), and `runtime_id`.' },
      { name: 'wal_entries', type: 'array', required: true, description: 'WAL entries since the last checkpoint. Each entry is an Ed25519-signed step record.' },
    ],
    requestExample: {
      resume_token: {
        last_committed_step: 9,
        checkpoint_digest: 'a3f8e2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1',
        runtime_id: 'runtime-edge-03',
      },
      wal_entries: [
        {
          entry_id: '01900000-0000-7000-8000-000000000001',
          task_id: '018f4a2b-3c1e-7a2d-9b8f-4d5e6f7a8b9c',
          step_index: 9,
          step_type: { type: 'inference', model: 'gpt-4o' },
          status: 'committed',
          input_digest: 'e3b0c44298fc1c149afb',
          output_digest: 'a3f8e2b1c4d5e6f7a8b9',
          timestamp_ms: 1743778201000,
          runtime_id: 'runtime-edge-03',
          signature: 'MEUCIQDx...',
        },
      ],
    },
    responseExample: { ok: true, step: 9 },
    statusCodes: [
      { code: 200, title: 'Saved', description: 'Checkpoint persisted and task record updated to `checkpointed`.' },
      { code: 400, title: 'Bad request', description: 'Checkpoint body could not be parsed.' },
      { code: 401, title: 'Unauthorized', description: 'Auth failed.' },
      { code: 404, title: 'Not found', description: 'Task not found for this tenant.' },
      { code: 409, title: 'Terminal state', description: 'Task is already completed or failed — checkpoints are rejected.', example: prettyJson({ error: 'task_terminal', status: 'completed' }) },
    ],
    notes: [
      'The coordination layer validates task ownership (tenant_id) before saving. A runtime cannot push checkpoints to tasks it does not own.',
      'Checkpoints are rejected if the task is already in a terminal state (`completed` or `failed`).',
    ],
  },
  'POST /v1/tasks/:id/complete': {
    functionality:
      'Marks a durable task as completed. Called by the runtime when all steps have executed successfully and the final output has been produced.',
    pathParams: [
      { name: 'id', type: 'string', required: true, description: 'Task ID.' },
    ],
    responseExample: { ok: true },
    statusCodes: [
      { code: 200, title: 'Marked complete', description: 'Task transitioned to `completed` state.' },
      { code: 401, title: 'Unauthorized', description: 'Auth failed.' },
      { code: 404, title: 'Not found', description: 'Task not found for this tenant.' },
    ],
  },
  'POST /v1/tasks/:id/failed': {
    functionality:
      'Marks a durable task as failed with a human-readable reason. Called by the runtime when a step encounters a non-recoverable error that should not trigger the automatic recovery path.',
    pathParams: [
      { name: 'id', type: 'string', required: true, description: 'Task ID.' },
    ],
    requestBodyFields: [
      { name: 'reason', type: 'string', description: 'Human-readable failure description stored in the task record.' },
    ],
    requestExample: { reason: 'Step 3 failed: navigation goal rejected by ROS2 action server' },
    responseExample: { ok: true },
    statusCodes: [
      { code: 200, title: 'Marked failed', description: 'Task transitioned to `failed` state.' },
      { code: 401, title: 'Unauthorized', description: 'Auth failed.' },
      { code: 404, title: 'Not found', description: 'Task not found for this tenant.' },
    ],
    notes: [
      'A failed task is terminal — no further checkpoints or completions are accepted.',
      'The automatic recovery loop does not reassign tasks in `failed` state. Only tasks in `dispatched` or `checkpointed` state on a dead runtime are reassigned.',
    ],
  },
  'POST /v1/btree/validate': {
    functionality:
      'Validates a behavior-tree document against the runtime schema before deploy or execution.',
    requestBodyFields: [
      { name: 'tree', type: 'object', required: true, description: 'Behavior-tree definition in runtime JSON format.' },
    ],
    requestExample: {
      tree: {
        type: 'sequence',
        children: [
          { type: 'condition', name: 'battery_ok' },
          { type: 'action', name: 'dispatch_task' },
        ],
      },
    },
    responseExample: {
      valid: true,
      errors: [],
    },
  },
};

function getBaseUrl(surface: string) {
  return surface === 'Local runtime'
    ? 'http://localhost:8080'
    : 'https://overture.igrisinertial.com';
}

function getAuthHeaders(endpoint: ApiEndpoint) {
  if (endpoint.auth === 'Public') {
    return [] as Array<{ name: string; value: string }>;
  }
  if (endpoint.auth === 'Session cookie') {
    return [{ name: 'Cookie', value: 'better-auth.session_token=$IGRIS_SESSION_TOKEN' }];
  }
  if (
    endpoint.auth.includes('Session cookie or igris_ API key') ||
    endpoint.auth.includes('Session or API key') ||
    endpoint.auth === 'Deployment-dependent' ||
    endpoint.auth === 'Tenant auth'
  ) {
    return [{ name: 'Authorization', value: 'Bearer $IGRIS_API_KEY' }];
  }
  if (endpoint.auth.includes('igris_ API key')) {
    return [{ name: 'Authorization', value: 'Bearer $IGRIS_API_KEY' }];
  }
  if (endpoint.auth === 'Runtime-config dependent') {
    return [{ name: 'Authorization', value: 'Bearer $IGRIS_RUNTIME_API_KEY' }];
  }
  if (endpoint.auth.toLowerCase().includes('tenant_id query')) {
    return [];
  }
  return [{ name: 'Authorization', value: 'Bearer $IGRIS_API_KEY' }];
}

function materializePath(path: string) {
  return path
    .replace(/:provider/g, 'openai')
    .replace(/:id/g, 'example-id');
}

function buildRequestUrl(endpoint: ApiEndpoint, queryExample?: Record<string, ApiQueryExampleValue>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(queryExample ?? {})) {
    params.set(key, String(value));
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : '';
  return `${getBaseUrl(endpoint.surface)}${materializePath(endpoint.path)}${suffix}`;
}

function fallbackFunctionality(section: ApiSection, endpoint: ApiEndpoint) {
  return `${endpoint.description} This endpoint belongs to the ${section.title} group and is documented here so customers can understand the contract, auth model, and verified sample traffic without reading the server implementation.`;
}

function fallbackPathParams(endpoint: ApiEndpoint): ApiField[] {
  const matches = [...endpoint.path.matchAll(/:([a-zA-Z0-9_]+)/g)];
  return matches.map((match) => ({
    name: match[1],
    type: 'string',
    required: true,
    description: `Path identifier for \`${match[1]}\`.`,
  }));
}

function fallbackQueryParams(endpoint: ApiEndpoint): ApiField[] {
  const key = endpointKey(endpoint);

  if (key === 'GET /v1/runtime/install' || key === 'GET /v1/runtime/checksum' || key === 'GET /v1/runtime/download') {
    return [{ name: 'platform', type: 'string', description: 'Target archive platform such as `linux-amd64` or `macos-arm64`.' }];
  }

  return [];
}

function fallbackQueryExample(endpoint: ApiEndpoint): Record<string, ApiQueryExampleValue> | undefined {
  const key = endpointKey(endpoint);

  if (key === 'GET /v1/runtime/install' || key === 'GET /v1/runtime/checksum' || key === 'GET /v1/runtime/download') {
    return { platform: 'linux-amd64' };
  }

  return undefined;
}

function serializeExample(example: ApiExampleValue | null | undefined) {
  if (example == null) {
    return null;
  }

  return typeof example === 'string' ? example : prettyJson(example);
}

function toJavaScriptHeaderValue(value: string) {
  if (value === 'Bearer $IGRIS_API_KEY') {
    return '`Bearer ${process.env.IGRIS_API_KEY}`';
  }
  if (value === 'Bearer $IGRIS_RUNTIME_API_KEY') {
    return '`Bearer ${process.env.IGRIS_RUNTIME_API_KEY}`';
  }
  if (value === 'better-auth.session_token=$IGRIS_SESSION_TOKEN') {
    return '`better-auth.session_token=${process.env.IGRIS_SESSION_TOKEN}`';
  }
  return JSON.stringify(value);
}

function toGoHeaderValue(value: string) {
  if (value === 'Bearer $IGRIS_API_KEY') {
    return '"Bearer " + os.Getenv("IGRIS_API_KEY")';
  }
  if (value === 'Bearer $IGRIS_RUNTIME_API_KEY') {
    return '"Bearer " + os.Getenv("IGRIS_RUNTIME_API_KEY")';
  }
  if (value === 'better-auth.session_token=$IGRIS_SESSION_TOKEN') {
    return '"better-auth.session_token=" + os.Getenv("IGRIS_SESSION_TOKEN")';
  }
  return JSON.stringify(value);
}

function toRustHeaderValue(value: string) {
  if (value === 'Bearer $IGRIS_API_KEY') {
    return 'format!("Bearer {}", std::env::var("IGRIS_API_KEY")?)';
  }
  if (value === 'Bearer $IGRIS_RUNTIME_API_KEY') {
    return 'format!("Bearer {}", std::env::var("IGRIS_RUNTIME_API_KEY")?)';
  }
  if (value === 'better-auth.session_token=$IGRIS_SESSION_TOKEN') {
    return 'format!("better-auth.session_token={}", std::env::var("IGRIS_SESSION_TOKEN")?)';
  }
  return JSON.stringify(value);
}

function buildCurlSample(
  endpoint: ApiEndpoint,
  requestBody: ApiExampleValue | null | undefined,
  queryExample?: Record<string, ApiQueryExampleValue>,
) {
  const headers = getAuthHeaders(endpoint);
  const args = [`curl -X ${endpoint.method} ${buildRequestUrl(endpoint, queryExample)}`];

  for (const header of headers) {
    args.push(`  -H "${header.name}: ${header.value}"`);
  }

  if (requestBody) {
    args.push('  -H "Content-Type: application/json"');
    args.push(`  -d '${serializeExample(requestBody)}'`);
  }

  return args.join(' \\\n');
}

function buildJavaScriptSample(
  endpoint: ApiEndpoint,
  requestBody: ApiExampleValue | null | undefined,
  queryExample?: Record<string, ApiQueryExampleValue>,
) {
  const authHeaders = getAuthHeaders(endpoint);
  const headerLines = authHeaders.map(({ name, value }) => `    '${name}': ${toJavaScriptHeaderValue(value)},`);

  if (requestBody) {
    headerLines.push("    'Content-Type': 'application/json',");
  }

  return `const response = await fetch('${buildRequestUrl(endpoint, queryExample)}', {
  method: '${endpoint.method}',
  headers: {
${headerLines.join('\n')}
  },${requestBody ? `
  body: JSON.stringify(${serializeExample(requestBody)}),` : ''}
});

const data = await response.text();
console.log(data);`;
}

function buildGoSample(
  endpoint: ApiEndpoint,
  requestBody: ApiExampleValue | null | undefined,
  queryExample?: Record<string, ApiQueryExampleValue>,
) {
  const requestText = serializeExample(requestBody);
  const body = requestText ? `body := strings.NewReader(${JSON.stringify(requestText)})` : 'body := http.NoBody';
  const authHeaders = getAuthHeaders(endpoint)
    .map(({ name, value }) => `req.Header.Set("${name}", ${toGoHeaderValue(value)})`)
    .join('\n');

  return `client := &http.Client{}
${body}

req, err := http.NewRequest("${endpoint.method}", "${buildRequestUrl(endpoint, queryExample)}", body)
if err != nil {
\tlog.Fatal(err)
}
${requestBody ? 'req.Header.Set("Content-Type", "application/json")' : ''}${authHeaders ? `\n${authHeaders}` : ''}

resp, err := client.Do(req)
if err != nil {
\tlog.Fatal(err)
}
defer resp.Body.Close()

payload, _ := io.ReadAll(resp.Body)
fmt.Println(string(payload))`;
}

function buildRustSample(
  endpoint: ApiEndpoint,
  requestBody: ApiExampleValue | null | undefined,
  queryExample?: Record<string, ApiQueryExampleValue>,
) {
  const authHeaders = getAuthHeaders(endpoint)
    .map(({ name, value }) => `        .header("${name}", ${toRustHeaderValue(value)})`)
    .join('\n');
  const requestJson = serializeExample(requestBody);

  return `let client = reqwest::Client::new();
let response = client
        .request(reqwest::Method::${endpoint.method}, "${buildRequestUrl(endpoint, queryExample)}")
${authHeaders}${requestJson ? `
        .json(&serde_json::json!(${requestJson}))` : ''}
        .send()
        .await?;

let payload = response.text().await?;
println!("{}", payload);`;
}

export function buildApiEndpointPageData(section: ApiSection, endpoint: ApiEndpoint): ApiEndpointPageData {
  const override = endpointOverrides[endpointKey(endpoint)] ?? {};
  const requestExample = serializeExample(override.requestExample);
  const responseExample = serializeExample(override.responseExample);
  const queryExample = override.queryExample ?? fallbackQueryExample(endpoint);

  return {
    section,
    sectionSlug: getApiSectionSlug(section.title),
    endpoint,
    endpointSlug: getApiEndpointSlug(endpoint),
    href: getApiEndpointHref(section, endpoint),
    title: `${endpoint.method} ${endpoint.path}`,
    baseUrl: getBaseUrl(endpoint.surface),
    functionality: override.functionality ?? fallbackFunctionality(section, endpoint),
    pathParams: override.pathParams ?? fallbackPathParams(endpoint),
    queryParams: override.queryParams ?? fallbackQueryParams(endpoint),
    requestBodyFields: override.requestBodyFields ?? [],
    requestExample,
    responseExample,
    statusCodes: override.statusCodes ?? [],
    codeSamples: [
      { label: 'cURL', language: 'bash', code: buildCurlSample(endpoint, override.requestExample, queryExample) },
      { label: 'JavaScript', language: 'javascript', code: buildJavaScriptSample(endpoint, override.requestExample, queryExample) },
      { label: 'Go', language: 'go', code: buildGoSample(endpoint, override.requestExample, queryExample) },
      { label: 'Rust', language: 'rust', code: buildRustSample(endpoint, override.requestExample, queryExample) },
    ],
    notes: override.notes ?? [],
  };
}
