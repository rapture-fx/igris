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
  whenToUse?: string;
  retryGuidance?: string;
  commonMistakes?: string[];
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
      'Primary hosted inference route for customers who want the shortest path to production. It preserves the OpenAI chat-completions contract while still running through Igris routing, policy, and receipt generation.',
    whenToUse:
      'Use this endpoint when you want the default customer integration path: hosted inference with the broadest client compatibility. It is the right choice when you want to keep the client portable and do not need the native Igris request contract.',
    retryGuidance:
      'Retry transient 5xx or 429 responses with backoff. Do not automatically retry 4xx responses until you have corrected the request, credentials, or provider configuration.',
    commonMistakes: [
      'Treating this route like the native Igris inference contract and expecting extra request fields that belong on `/v1/infer`.',
      'Skipping provider-key setup and assuming hosted routing will work before any upstream credential is stored.',
      'Using a browser session flow for backend automation instead of a tenant API key.',
    ],
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
      'Native hosted inference route for customers who want more control than the OpenAI-compatible surface exposes. It is the endpoint to use when routing intent, provider pinning, or Igris-specific request metadata should be part of the contract.',
    whenToUse:
      'Use this endpoint when the OpenAI-compatible path is too narrow for the integration you are building. It is the right choice when your application needs routing hints, provider selection, or Igris-native response metadata.',
    retryGuidance:
      'Retry transient 5xx or 429 responses with backoff. For write-once or audit-sensitive workflows, make sure your application can tolerate replay before retrying automatically.',
    commonMistakes: [
      'Reusing an OpenAI-only request shape and forgetting to adopt the native Igris fields that make this route valuable.',
      'Using `/v1/infer` for broad portability when `/v1/chat/completions` would have been the simpler contract.',
      'Assuming provider pinning will work without a matching provider key already configured for the tenant.',
    ],
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
      'Returns the model identifiers currently visible to the inference layer. Use it to confirm what a deployment can actually serve before you hardcode model selection into a client.',
    whenToUse:
      'Use this endpoint when you need a model picker, startup validation, or an operational check that confirms what the current deployment exposes.',
    retryGuidance:
      'Safe to retry on transient 5xx or 429 responses. If the list looks unexpectedly empty or incomplete, investigate provider configuration before treating it as a temporary server failure.',
    commonMistakes: [
      'Assuming every upstream provider model is available without checking what the deployment currently exposes.',
      'Using this route as a substitute for tenant provider configuration or entitlement checks.',
    ],
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
      'Stores a tenant-scoped provider credential for hosted routing. The raw upstream key is encrypted on write, and later reads only return masked metadata so the secret does not become part of the ordinary control-plane surface.',
    whenToUse:
      'Use this endpoint when you are setting up or rotating hosted routing credentials for a tenant. It is usually one of the first administrative calls you make before sending production inference traffic.',
    retryGuidance:
      'Do not replay this request casually. Retry only on clearly transient 5xx or 429 responses, and make sure your client can tolerate the possibility that the first write may already have succeeded.',
    commonMistakes: [
      'Sending a raw provider name that is not part of the currently supported public identifiers.',
      'Assuming a successful write means the key will ever be returned again in plaintext.',
      'Using ad hoc key labels that make later rotation and operational ownership harder to understand.',
    ],
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
      'Lists the provider keys currently stored for the tenant. Returned entries are masked and operationally useful, but they are not a secret-retrieval mechanism.',
    whenToUse:
      'Use this endpoint when you need to confirm which provider credentials exist, which key names are active, or whether a tenant is ready for hosted routing.',
    retryGuidance:
      'Safe to retry on transient 5xx or 429 responses. If the list is unexpectedly empty, verify tenant context and recent key-management activity before treating it as a server fault.',
    commonMistakes: [
      'Expecting this route to reveal the full upstream key rather than masked metadata.',
      'Treating an empty list as proof that the vault is broken without first checking the tenant context or provider filter.',
    ],
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
      'Returns metadata about the current tenant API key without exposing the secret itself. Use it to confirm whether a key exists, what prefix it has, and when it was last rotated.',
    whenToUse:
      'Use this endpoint when you are auditing tenant access state, confirming whether an environment already has a key, or checking whether key rotation happened when expected.',
    retryGuidance:
      'Safe to retry on transient 5xx or 429 responses. A missing key is a product state question, not a retry condition.',
    commonMistakes: [
      'Expecting the raw API key to be returned again after creation.',
      'Using this route as if it creates or rotates credentials; it only reports metadata.',
    ],
    responseExample: {
      has_key: true,
      prefix: 'igris_a1b2c3',
      created_at: '2026-04-04T06:15:00Z',
    },
  },
  'POST /v1/account/api-key': {
    functionality:
      'Creates a new tenant API key and returns the raw secret exactly once. The previous key is revoked when the new key is issued, so treat this route as a credential-rotation operation rather than a harmless read/write call.',
    whenToUse:
      'Use this endpoint when you are creating the first tenant API key or intentionally rotating the current one. Plan the rollout so dependent systems can adopt the new credential immediately.',
    retryGuidance:
      'Do not automatically replay this request. If the response is ambiguous, verify the current key state before attempting another rotation.',
    commonMistakes: [
      'Calling the route without a rollout plan and breaking existing integrations when the old key is revoked.',
      'Assuming the raw secret can be recovered later if it is not stored at creation time.',
      'Using this route as part of routine request flow instead of as a deliberate credential-management action.',
    ],
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
      timestamp: '2026-04-04T06:22:00Z',
      has_pending_commands: true,
    },
  },
  'GET /api/v1/runtime/download': {
    functionality:
      'Downloads or redirects to the runtime archive through the API-key authenticated runtime lifecycle surface. This is the endpoint custom installers use when they operate with a tenant API key rather than a browser session.',
    whenToUse:
      'Use this endpoint from provisioning scripts, fleet bootstrap tooling, or custom installers that already hold a tenant API key. Use `/v1/runtime/download` when the download is initiated from a session-authenticated hosted workflow.',
    retryGuidance:
      'Treat this as a provisioning operation. Retry 429 and transient 5xx responses with backoff, but do not call it repeatedly from the application hot path.',
    queryParams: [
      { name: 'platform', type: 'string', description: 'Runtime archive platform. Supported values include `linux-amd64`, `linux-arm64`, `linux-armv7`, `macos-arm64`, and `macos-x64`.' },
    ],
    queryExample: { platform: 'linux-amd64' },
    responseExample: {
      note: 'On success the response is either an archive download or an HTTP 302 redirect to the configured binary host.',
    },
    statusCodes: [
      { code: 200, title: 'Archive download', description: 'The runtime archive is streamed from local binary storage.' },
      { code: 302, title: 'Redirect', description: 'The runtime archive is hosted externally and the response redirects to it.' },
      { code: 400, title: 'Unsupported platform', description: 'The requested platform is not available.', example: prettyJson({ error: 'unsupported_platform', supported: ['linux-amd64', 'linux-arm64', 'linux-armv7', 'macos-arm64', 'macos-x64'] }) },
      { code: 401, title: 'Unauthorized', description: 'The tenant API key is missing or invalid.', example: prettyJson({ error: 'missing_api_key', message: 'Provide your tenant API key via X-API-Key header' }) },
      { code: 503, title: 'Not configured', description: 'Runtime binary hosting is not configured on this server.', example: prettyJson({ error: 'not_configured', message: 'Binary hosting not yet configured on this server. Contact support.' }) },
    ],
  },
  'GET /api/v1/runtime/commands': {
    functionality:
      'Fetches queued runtime commands for a registered machine and clears the queue atomically. Runtimes use this after heartbeat to pick up config-push and OTA update commands.',
    whenToUse:
      'Use this endpoint only from runtime lifecycle clients or compatible custom launchers. Application clients should use the higher-level fleet configuration and update routes instead of polling commands directly.',
    retryGuidance:
      'This is a destructive read because returned commands are cleared. Retry only when the first request clearly did not reach the server.',
    queryParams: [
      { name: 'machine_id', type: 'string', required: true, description: 'Stable runtime machine identifier used during registration.' },
    ],
    queryExample: { machine_id: 'dev_0f4c3f1a2d9b45cf' },
    responseExample: {
      commands: [
        {
          type: 'config_push',
          config: {
            local_fallback: {
              enabled: true,
              model_path: '/models/phi-3-mini.gguf',
            },
          },
          queued_at: '2026-04-04T06:35:00Z',
        },
      ],
    },
    statusCodes: [
      { code: 200, title: 'Success', description: 'Commands were returned and cleared.' },
      { code: 400, title: 'Missing machine ID', description: '`machine_id` query parameter was not supplied.', example: prettyJson({ error: 'missing_machine_id', message: 'machine_id query parameter is required' }) },
      { code: 404, title: 'Not registered', description: 'No runtime with this machine ID is registered for the tenant.', example: prettyJson({ error: 'not_registered', message: 'Runtime not found - call /api/v1/runtime/register first' }) },
    ],
  },
  'DELETE /api/v1/runtime/deregister': {
    functionality:
      'Marks a runtime as deregistered and unhealthy for the current tenant. The runtime remains in historical records but should no longer be treated as an active fleet member.',
    requestBodyFields: [
      { name: 'machine_id', type: 'string', required: true, description: 'Stable runtime machine identifier used during registration.' },
    ],
    requestExample: {
      machine_id: 'dev_0f4c3f1a2d9b45cf',
    },
    responseExample: {
      status: 'ok',
    },
    statusCodes: [
      { code: 200, title: 'Success', description: 'The runtime was marked deregistered, or it was already no longer active.' },
      { code: 400, title: 'Bad request', description: 'The request body was invalid or missing `machine_id`.' },
      { code: 401, title: 'Unauthorized', description: 'The tenant API key is missing or invalid.' },
    ],
  },
  'GET /api/v1/runtime/list': {
    functionality:
      'Lists the runtimes currently registered for a tenant. This is the fleet inventory view customers use to confirm that runtimes are visible, healthy enough to appear in management flows, and correctly associated with the expected tenant.',
    whenToUse:
      'Use this endpoint when you need an inventory view before a rollout, during fleet troubleshooting, or when validating that runtime registration is working as expected.',
    retryGuidance:
      'Safe to retry on transient 5xx or 429 responses. If the result is empty, verify tenant context and registration health before assuming a server-side problem.',
    commonMistakes: [
      'Calling the route without tenant context and forgetting to supply the `tenant_id` query parameter.',
      'Treating this inventory view as if it were a command surface rather than a read model.',
      'Assuming an absent runtime means rollout should continue before registration health has been checked.',
    ],
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
      'Queues a configuration update for the tenant fleet. Matching runtimes fetch the queued command on their next command poll.',
    requestBodyFields: [
      { name: 'selector', type: 'object', description: 'Optional selector metadata for the fleet command. Current server behavior queues the command for the tenant fleet.' },
      { name: 'config', type: 'object', required: true, description: 'Configuration payload to push.' },
    ],
    requestExample: {
      selector: { tags: ['site-a'] },
      config: {
        local_fallback: {
          enabled: true,
          model_path: '/models/phi-3-mini.gguf',
        },
      },
    },
    responseExample: {
      queued: true,
      instances: 3,
      queued_at: '2026-04-04T06:35:00Z',
    },
  },
  'POST /api/v1/runtime/update': {
    functionality:
      'Queues a runtime update command. Use this to coordinate OTA rollout from the control plane rather than pulling binaries manually on every node.',
    requestBodyFields: [
      { name: 'version', type: 'string', required: true, description: 'Target runtime version or release channel.' },
      { name: 'strategy', type: 'string', description: 'Rollout strategy. Defaults to `rolling`.' },
      { name: 'max_unavailable', type: 'integer', description: 'Maximum unavailable runtimes for a rolling update. Defaults to `1`.' },
      { name: 'selector', type: 'object', description: 'Optional selector metadata for the fleet command. Current server behavior queues the command for the tenant fleet.' },
    ],
    requestExample: {
      version: 'runtime-v1.6.0',
      strategy: 'rolling',
      max_unavailable: 1,
      selector: { tags: ['site-a'] },
    },
    responseExample: {
      queued: true,
      version: 'runtime-v1.6.0',
      strategy: 'rolling',
      instances: 3,
      queued_at: '2026-04-04T06:36:00Z',
    },
  },
  'GET /v1/history/events': {
    functionality:
      'Returns recent execution history for the tenant in a timeline-friendly format. Use it to understand what happened across agents and runtimes before you move into receipt-level proof review.',
    whenToUse:
      'Use this endpoint for dashboards, operational investigations, and recent-activity views. It is the right first stop when you need a timeline, not a cryptographic artifact.',
    retryGuidance:
      'Safe to retry on transient 5xx or 429 responses. Adjust your time window or filters if the dataset is larger than you expected rather than hammering the same request repeatedly.',
    commonMistakes: [
      'Treating history events as the signed audit artifact instead of as an operational timeline.',
      'Pulling an unnecessarily large range without filters when you already know the agent or runtime you want to inspect.',
    ],
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
      'Lists execution receipts for the tenant from the coordination layer. This is the read surface for audit-oriented views where you care about the execution record itself rather than only the timeline around it.',
    whenToUse:
      'Use this endpoint when you need to review receipt records, prepare export jobs, or feed an audit-oriented UI that is centered on execution artifacts.',
    retryGuidance:
      'Safe to retry on transient 5xx or 429 responses. Prefer narrower filters over repeated broad scans if the query is being used interactively.',
    commonMistakes: [
      'Using receipt listing when a history timeline would be easier to interpret for the question at hand.',
      'Treating the list response like a bulk export instead of using the dedicated export route.',
    ],
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
      'Streams execution receipts as a downloadable attachment. It is designed for export and downstream processing, not for interactive paging or ordinary list views.',
    whenToUse:
      'Use this endpoint when receipt data needs to leave the product boundary for BI, compliance, archive, or offline analysis. Choose NDJSON for machine pipelines and CSV for spreadsheet-oriented workflows.',
    retryGuidance:
      'Retry transient 5xx or 429 responses with backoff, but treat export like a batch operation rather than a request you fire repeatedly from an interactive client.',
    commonMistakes: [
      'Expecting a JSON metadata payload instead of a streamed attachment response.',
      'Using export for ordinary UI pagination when the list and detail routes are the correct interactive surfaces.',
      'Starting repeated large exports without narrowing the time range or planning downstream retention.',
    ],
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
      'Simple health probe for the selected Igris API surface. On the hosted API it reports control-plane availability; on a local runtime it reports whether the runtime process is serving traffic.',
    whenToUse:
      'Use this endpoint for readiness checks, deployment smoke tests, and basic connectivity validation before calling higher-level APIs.',
    responseExample: {
      status: 'ok',
      service: 'igris',
    },
  },
  'POST /v1/tasks/submit': {
    functionality:
      'Submits a durable task to the coordination layer and returns immediately with a task ID. The product records the workflow, dispatches it to an available runtime, and preserves progress with checkpoints so interruptions do not force the whole task back to the beginning.',
    whenToUse:
      'Use this endpoint when the unit of work is too long-lived, multi-step, or failure-sensitive for an ordinary synchronous inference call. It is the right contract for workflows that must survive runtime interruption and resume from durable state.',
    retryGuidance:
      'Prefer an idempotency key and treat retries as deliberate. If submission fails ambiguously, check for the existing task record before replaying the same workload.',
    commonMistakes: [
      'Submitting a workflow without an idempotency key even though the caller may retry on timeout or network failure.',
      'Using durable tasks for simple synchronous inference that would have been clearer on the standard inference routes.',
      'Nesting another `task_type` object inside `task_definition` instead of using the public request shape.',
    ],
    requestBodyFields: [
      { name: 'task_type', type: 'string', required: true, description: 'Task category. One of `agent_workflow`, `robotics_workflow`, `single_inference`, or `behavior_tree`.' },
      { name: 'task_definition', type: 'object', required: true, description: 'Task payload for the selected `task_type`. Do not nest another `task_type` object inside this field.' },
      { name: 'idempotency_key', type: 'string', description: 'Stable client-generated key for deduplicating repeat submissions of the same task request.' },
      { name: 'deadline_at', type: 'string', description: 'RFC3339 deadline. The runtime checkpoints and stops if execution reaches this time.' },
    ],
    requestExample: {
      task_type: 'agent_workflow',
      task_definition: {
        steps: [
          { step_index: 0, model: 'gpt-4o', messages: [{ role: 'user', content: 'Summarize the Q3 report' }] },
          { step_index: 1, model: 'gpt-4o', messages: [{ role: 'user', content: 'Extract action items from the summary' }] },
        ],
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
      { code: 400, title: 'Bad request', description: 'Missing task_type, missing task_definition, or malformed task_definition payload.', example: prettyJson({ error: 'task_definition required' }) },
      { code: 401, title: 'Unauthorized', description: 'Session or API key auth failed.', example: prettyJson({ error: 'unauthenticated' }) },
      { code: 503, title: 'No runtime available', description: 'No healthy runtime is registered for this tenant.', example: prettyJson({ error: 'dispatch_failed', message: 'no healthy runtime for tenant tenant_01HV' }) },
    ],
    notes: [
      'For `agent_workflow` and `robotics_workflow`, `task_definition` should contain a `steps` array. For `single_inference`, use inference fields such as `model` and `messages`. For `behavior_tree`, provide `tree` and any optional execution limits such as `max_ticks` or `checkpoint_every`.',
      'Submitting the same `idempotency_key` for the same tenant returns the existing task record instead of creating a second task.',
    ],
  },
  'GET /v1/tasks/:id': {
    functionality:
      'Returns the current state of one durable task, including runtime assignment and the latest checkpoint metadata when available. This is the status route you poll while a durable workflow is still in progress.',
    whenToUse:
      'Use this endpoint after submission when you need to monitor progress, completion, failure, or recovery state for a specific task.',
    retryGuidance:
      'Safe to retry on transient 5xx or 429 responses. Poll at a reasonable interval rather than continuously, especially for long-running tasks.',
    commonMistakes: [
      'Polling too aggressively and turning task status checks into avoidable background load.',
      'Treating checkpoint metadata as if it will exist before the runtime has actually produced a checkpoint.',
    ],
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
      { code: 400, title: 'Bad request', description: 'Task ID is not a valid UUID.', example: prettyJson({ error: 'invalid task_id' }) },
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
      'Lists recent durable tasks for the authenticated tenant, newest first. Use it to build operational views of long-running work rather than polling every task individually from scratch.',
    whenToUse:
      'Use this endpoint for dashboards, recent-work views, and operator workflows that need to see multiple durable tasks at once.',
    retryGuidance:
      'Safe to retry on transient 5xx or 429 responses. Keep the query narrow and the refresh interval reasonable if the list is backing an active dashboard.',
    commonMistakes: [
      'Using the list route when the client already has a single task ID and should call the detail route instead.',
      'Refreshing the task list too aggressively for long-running workloads that do not change every second.',
    ],
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
    statusCodes: [
      { code: 200, title: 'Success', description: 'Task list returned.' },
      { code: 401, title: 'Unauthorized', description: 'Session or API key auth failed.' },
    ],
  },
  'GET /v1/tasks/:id/steps': {
    functionality:
      'Returns the execution-graph steps and slot metadata that the coordinator can expose for a durable task. The response is empty for task types that do not produce step-level graph state.',
    pathParams: [
      { name: 'id', type: 'string', required: true, description: 'Task ID returned by POST /v1/tasks/submit.' },
    ],
    responseExample: {
      steps: [
        {
          node_id: 'summarize',
          status: 'completed',
          step_index: 0,
          write_slot: 'reason.0.summarize',
        },
      ],
      total: 1,
    },
    statusCodes: [
      { code: 200, title: 'Success', description: 'Step list returned. The list may be empty.' },
      { code: 400, title: 'Bad request', description: 'Task ID is not a valid UUID.' },
      { code: 404, title: 'Not found', description: 'No task with this ID exists for the authenticated tenant.' },
    ],
  },
  'POST /v1/tasks/:id/cancel': {
    functionality:
      'Requests cancellation for a durable task that is still cancellable. When the task is assigned to a runtime with a known endpoint, the coordinator also attempts to propagate the cancellation to the runtime.',
    retryGuidance:
      'Do not retry blindly. A second cancellation request can return conflict once the task has moved into a terminal state.',
    pathParams: [
      { name: 'id', type: 'string', required: true, description: 'Task ID returned by POST /v1/tasks/submit.' },
    ],
    requestExample: null,
    responseExample: {
      ok: true,
      task_id: '018f4a2b-3c1e-7a2d-9b8f-4d5e6f7a8b9c',
      status: 'canceled',
      runtime_cancel_attempted: true,
      runtime_cancel_signaled: true,
    },
    statusCodes: [
      { code: 200, title: 'Canceled', description: 'The task was moved to canceled state.' },
      { code: 400, title: 'Bad request', description: 'Task ID is not a valid UUID.' },
      { code: 404, title: 'Not found', description: 'No task with this ID exists for the authenticated tenant.' },
      { code: 409, title: 'Transition rejected', description: 'The task is already terminal or otherwise cannot be canceled.', example: prettyJson({ error: 'task_transition_rejected', status: 'completed' }) },
    ],
  },
  'GET /v1/tasks/proof/readiness': {
    functionality:
      'Reports whether trigger-backed task proof synchronization is active. Use this before relying on immediate proof freshness for newly completed durable tasks.',
    responseExample: {
      proof_sync_mode: 'trigger',
      trigger_available: true,
      read_reconciliation_fallback: true,
    },
    statusCodes: [
      { code: 200, title: 'Success', description: 'Proof synchronization mode was returned.' },
      { code: 401, title: 'Unauthorized', description: 'Session or API key auth failed.' },
    ],
  },
  'POST /v1/tasks/:id/proof/verify': {
    functionality:
      'Synchronizes persisted proof state for a durable task and returns the current verification view. The task must already have a persisted proof reference.',
    pathParams: [
      { name: 'id', type: 'string', required: true, description: 'Task ID returned by POST /v1/tasks/submit.' },
    ],
    requestExample: null,
    responseExample: {
      task_id: '018f4a2b-3c1e-7a2d-9b8f-4d5e6f7a8b9c',
      proof: {
        status: 'verified',
        needs_refresh: false,
        reconcile_on_read: false,
        execution_id: 'exec_01HV95R5Y3TVVJ7R3',
        expected_hash: '6f16f4bc...',
        stored_hash: '6f16f4bc...',
        present: true,
        matched: true,
      },
    },
    statusCodes: [
      { code: 200, title: 'Success', description: 'Proof state was synchronized and returned.' },
      { code: 400, title: 'Proof unavailable', description: 'The task has no persisted proof reference yet.', example: prettyJson({ error: 'proof_unavailable', message: 'task does not have a persisted proof reference' }) },
      { code: 404, title: 'Not found', description: 'No task with this ID exists for the authenticated tenant.' },
    ],
  },
  'GET /v1/routing/speculative/status': {
    functionality:
      'Returns the current speculative-routing status read model for the authenticated tenant. The response is best-effort and falls back to zeroed metrics when telemetry tables have not been populated yet.',
    responseExample: {
      enabled: true,
      success_rate: 68.2,
      latency_improvement_ms: 380,
      cost_delta_percent: -4.5,
      races_24h: 4821,
      wins_by_provider: [
        { provider: 'openai', win_rate: 54.8 },
        { provider: 'anthropic', win_rate: 45.2 },
      ],
    },
  },
  'GET /v1/routing/stats': {
    functionality:
      'Returns aggregate routing telemetry for the authenticated tenant. Fresh deployments return a valid empty shape until telemetry has accumulated.',
    responseExample: {
      total_requests: 4821,
      avg_latency_ms: 420,
      provider_breakdown: [
        { provider: 'openai', count: 3012, avg_latency_ms: 390 },
        { provider: 'anthropic', count: 1809, avg_latency_ms: 470 },
      ],
    },
  },
  'GET /v1/routing/recent': {
    functionality:
      'Lists recent routed requests for operational inspection and support workflows.',
    responseExample: [
      {
        id: 'route_01HV9A1R7Q5ZP88K',
        provider: 'openai',
        latency_ms: 392,
        created_at: '2026-04-04T06:40:00Z',
      },
    ],
  },
  'GET /v1/routing/leaderboard': {
    functionality:
      'Ranks providers by recent request count and average latency so operators can see which providers are currently carrying traffic.',
    responseExample: [
      {
        provider: 'openai',
        request_count: 3012,
        avg_latency_ms: 390,
      },
      {
        provider: 'anthropic',
        request_count: 1809,
        avg_latency_ms: 470,
      },
    ],
  },
  'GET /v1/routing/speculative/config': {
    functionality:
      'Returns the active speculative-routing configuration read model used by the console.',
    responseExample: {
      enabled: true,
      max_parallel_providers: 3,
      timeout_ms: 5000,
      first_token_threshold_ms: 500,
      enabled_providers: ['openai', 'anthropic'],
    },
  },
  'POST /v1/routing/speculative': {
    functionality:
      'Persists tenant speculative-routing configuration. The current endpoint stores the submitted JSON under the `speculative` routing config key and returns an acknowledgement.',
    requestBodyFields: [
      { name: 'enabled', type: 'boolean', description: 'Whether speculative routing should be enabled for tenant traffic.' },
      { name: 'max_parallel_providers', type: 'integer', description: 'Optional maximum provider race width.' },
    ],
    requestExample: {
      enabled: true,
      max_parallel_providers: 3,
    },
    responseExample: {
      saved: true,
    },
  },
  'GET /v1/routing/speculative/analytics': {
    functionality:
      'Returns speculative-routing analytics series used by operational dashboards.',
    responseExample: {
      race_win_rate: [],
      latency_distribution: [],
      cost_savings_timeline: [],
    },
  },
  'POST /v1/routing/speculative/simulate': {
    functionality:
      'Triggers a speculative-routing simulation. The current implementation acknowledges the request rather than returning a full modeled race result.',
    requestBodyFields: [
      { name: 'messages', type: 'array', description: 'Representative chat messages for the simulation request.' },
      { name: 'model', type: 'string', description: 'Requested model or routing target.' },
    ],
    requestExample: {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Summarize these notes in three bullets.' }],
    },
    responseExample: {
      simulated: true,
      message: 'simulation triggered',
    },
  },
  'GET /v1/routing/circuit-breaker/status': {
    functionality:
      'Returns aggregate and per-provider circuit-breaker state. If no provider rows exist yet, the endpoint returns a default closed state so dashboards can render on a fresh deployment.',
    responseExample: {
      enabled: true,
      state: 'closed',
      trip_count: 0,
      providers: [
        {
          provider: 'openai',
          state: 'closed',
          failure_count: 0,
          trip_count: 0,
        },
      ],
    },
  },
  'GET /v1/routing/council/analytics': {
    functionality:
      'Returns council-mode aggregate metrics and a per-chairman/winner breakdown for the authenticated tenant.',
    responseExample: {
      total_invocations: 128,
      last_24h: 17,
      avg_latency_ms: 1380,
      avg_cost_usd: 0.0182,
      by_chairman: [
        {
          chairman_provider: 'anthropic',
          winner_provider: 'openai',
          avg_total_latency_ms: 1410,
          avg_ranking_latency_ms: 120,
          avg_cost_usd: 0.019,
          invocation_count: 51,
        },
      ],
    },
  },
  'POST /v1/routing/strategy': {
    requestBodyFields: [
      { name: 'strategy', type: 'string', description: 'Routing strategy payload stored for the tenant.' },
    ],
    requestExample: { strategy: 'adaptive' },
    responseExample: { saved: true },
  },
  'POST /v1/routing/provider_weights': {
    requestBodyFields: [
      { name: 'weights', type: 'object', description: 'Provider weights keyed by provider identifier.' },
    ],
    requestExample: { weights: { openai: 0.7, anthropic: 0.3 } },
    responseExample: { saved: true },
  },
  'POST /v1/routing/council': {
    requestBodyFields: [
      { name: 'enabled', type: 'boolean', description: 'Whether council mode should be enabled for selected traffic.' },
      { name: 'chairman_provider', type: 'string', description: 'Provider used to rank or synthesize council results.' },
    ],
    requestExample: { enabled: true, chairman_provider: 'anthropic' },
    responseExample: { saved: true },
  },
  'POST /v1/routing/shadow': {
    requestBodyFields: [
      { name: 'enabled', type: 'boolean', description: 'Whether shadow routing should run for selected traffic.' },
      { name: 'shadow_traffic_percent', type: 'number', description: 'Percent of eligible traffic to shadow.' },
    ],
    requestExample: { enabled: true, shadow_traffic_percent: 10 },
    responseExample: { saved: true },
  },
  'POST /v1/mcp': {
    functionality:
      'Hosted JSON-RPC transport for MCP calls. Overture forwards the request body to the configured runtime MCP server and returns the runtime response.',
    requestBodyFields: [
      { name: 'jsonrpc', type: 'string', required: true, description: 'JSON-RPC version. Use `2.0`.' },
      { name: 'id', type: 'string | number', required: true, description: 'Client request identifier.' },
      { name: 'method', type: 'string', required: true, description: 'MCP method such as `tools/list` or a context operation.' },
      { name: 'params', type: 'object', description: 'Method-specific parameters.' },
    ],
    requestExample: {
      jsonrpc: '2.0',
      id: 'req_1',
      method: 'tools/list',
      params: {},
    },
    responseExample: {
      jsonrpc: '2.0',
      id: 'req_1',
      result: {
        tools: [],
      },
    },
  },
  'POST /v1/mcp/stream': {
    functionality:
      'Hosted streaming transport for MCP interactions that need incremental output. Overture forwards the request to the runtime MCP stream endpoint.',
    requestBodyFields: [
      { name: 'jsonrpc', type: 'string', required: true, description: 'JSON-RPC version. Use `2.0`.' },
      { name: 'id', type: 'string | number', required: true, description: 'Client request identifier.' },
      { name: 'method', type: 'string', required: true, description: 'MCP method to stream.' },
      { name: 'params', type: 'object', description: 'Method-specific parameters.' },
    ],
    requestExample: {
      jsonrpc: '2.0',
      id: 'req_stream_1',
      method: 'tools/call',
      params: { name: 'example', arguments: {} },
    },
    responseExample: 'event: message\ndata: {"jsonrpc":"2.0","id":"req_stream_1","result":{"chunk":"..."}}\n',
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
  if (endpoint.auth.includes('X-API-Key')) {
    return [{ name: 'X-API-Key', value: '$IGRIS_API_KEY' }];
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
    .replace(/\{task_id\}/g, '018f4a2b-3c1e-7a2d-9b8f-4d5e6f7a8b9c')
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

function fallbackWhenToUse(section: ApiSection, endpoint: ApiEndpoint) {
  if (endpoint.support === 'preview') {
    return `Use this endpoint when you need ${endpoint.description.toLowerCase()} and you are comfortable integrating against a preview surface. Confirm the current shape and rollout expectations before depending on it in a hard production path.`;
  }

  if (endpoint.deployment === 'local') {
    return `Use this endpoint when the operation belongs on the local runtime rather than the hosted API. It is part of the ${section.title} surface and should be called from the environment where the runtime is actually serving traffic.`;
  }

  if (endpoint.deployment === 'hybrid') {
    return `Use this endpoint when the workflow spans both the hosted control plane and one or more runtimes. It belongs to the ${section.title} area of the product and is most useful when you are coordinating runtime distribution, fleet state, or device operations.`;
  }

  return `Use this endpoint when you need ${endpoint.description.toLowerCase()} from the hosted API. It is part of the ${section.title} surface and is intended to be the customer-facing contract for that capability.`;
}

function fallbackRetryGuidance(endpoint: ApiEndpoint) {
  if (endpoint.path === '/v1/runtime/download' || endpoint.path === '/v1/runtime/install' || endpoint.path === '/v1/runtime/checksum') {
    return 'Treat download and distribution requests as provisioning operations. Retry on transient 5xx or 429 responses with backoff, but do not put these routes on a hot request path.';
  }

  if (endpoint.method === 'GET') {
    return 'Safe retries are usually reasonable for transient 5xx or 429 responses. Do not retry 4xx responses until you have fixed the request, credentials, or addressed resource.';
  }

  if (endpoint.support === 'preview') {
    return 'Retry only on clearly transient 5xx or 429 responses, and prefer idempotent client behavior. For preview routes, avoid aggressive automatic replay until you have validated the behavior in your environment.';
  }

  return 'Do not blindly retry write operations. Retry only on transient 5xx or 429 responses, and make sure the client is idempotent or otherwise safe to replay.';
}

function fallbackCommonMistakes(endpoint: ApiEndpoint) {
  const mistakes: string[] = [];

  if (endpoint.auth.includes('Session cookie')) {
    mistakes.push('Calling the route with an API key when the workflow actually expects an authenticated browser session.');
  }

  if (endpoint.auth.includes('igris_ API key') || endpoint.auth.includes('Deployment-dependent') || endpoint.auth.includes('Runtime-config dependent')) {
    mistakes.push('Using the wrong credential type or forgetting to send the expected API key header.');
  }

  if (endpoint.deployment === 'local') {
    mistakes.push('Pointing the client at the hosted base URL even though this route is served by the local runtime.');
  }

  if (endpoint.deployment === 'hybrid') {
    mistakes.push('Treating a hybrid coordination route like a local-only runtime call without the required tenant context or fleet state.');
  }

  if (endpoint.path.includes(':id') || endpoint.path.includes(':provider')) {
    mistakes.push('Passing a placeholder path segment without replacing it with a real resource identifier.');
  }

  if (endpoint.method !== 'GET') {
    mistakes.push('Replaying a write request without thinking through idempotency, duplication, or partial success.');
  }

  return mistakes.slice(0, 3);
}

function buildRelatedEndpoints(section: ApiSection, endpoint: ApiEndpoint) {
  return section.endpoints
    .filter((candidate) => candidate.path !== endpoint.path || candidate.method !== endpoint.method)
    .slice(0, 3)
    .map((candidate) => ({
      label: `${candidate.method} ${candidate.path}`,
      href: getApiEndpointHref(section, candidate),
    }));
}

function buildRelatedGuides(endpoint: ApiEndpoint) {
  const path = endpoint.path;
  const guides: Array<{ label: string; href: string }> = [];

  const pushGuide = (label: string, href: string) => {
    if (!guides.some((guide) => guide.href === href)) {
      guides.push({ label, href });
    }
  };

  pushGuide('API Authentication', '/docs/api-reference/authentication');
  pushGuide('API Errors', '/docs/api-reference/errors');

  if (endpoint.deployment === 'local') {
    pushGuide('Deploy Local Runtime', '/docs/deploy-local-runtime');

    if (path.startsWith('/v1/tasks') || path.startsWith('/v1/btree')) {
      pushGuide('Context Engineering', '/docs/context-engineering');
      pushGuide('Behavior Trees', '/docs/behavior-trees');
    } else {
      pushGuide('SDK Integration Patterns', '/docs/sdk-integration-patterns');
      pushGuide('Local LLM Fallback', '/docs/local-llm-fallback');
    }
  } else if (endpoint.deployment === 'hybrid') {
    pushGuide('Hybrid Deployment Workflow', '/docs/hybrid-deployment-workflow');
    pushGuide('Fleet Rollout Workflow', '/docs/fleet-rollout-workflow');

    if (path.startsWith('/v1/tasks')) {
      pushGuide('Context Engineering', '/docs/context-engineering');
    }
  } else if (path.startsWith('/v1/chat/completions') || path.startsWith('/v1/infer') || path === '/v1/models' || path === '/v1/providers/stats') {
    pushGuide('First Cloud Integration', '/docs/first-cloud-integration');
    pushGuide('SDK Integration Patterns', '/docs/sdk-integration-patterns');
  } else if (path.startsWith('/v1/receipts') || path.startsWith('/v1/history') || path.startsWith('/proof/receipts')) {
    pushGuide('Receipts and Audit Workflow', '/docs/receipts-audit-workflow');
    pushGuide('Execution Receipts', '/docs/execution-receipts');
    pushGuide('Audit', '/docs/audit');
  } else if (path.startsWith('/v1/tasks') || path.startsWith('/v1/btree')) {
    pushGuide('Context Engineering', '/docs/context-engineering');
    pushGuide('Durable Tasks', '/docs/durable-tasks');
    pushGuide('Behavior Trees', '/docs/behavior-trees');
  } else if (path.startsWith('/v1/routing')) {
    pushGuide('Routing Engine', '/docs/escapevector');
    pushGuide('Speculative Execution', '/docs/speculative-execution');
    pushGuide('Circuit Breaker', '/docs/circuit-breaker');
  } else if (path.startsWith('/v1/mcp')) {
    pushGuide('MCP', '/docs/mcp');
    pushGuide('MCP Server', '/docs/mcp-server');
    pushGuide('MCP Integration Patterns', '/docs/mcp-integration-patterns');
  } else if (path.startsWith('/v1/vault') || path.startsWith('/v1/account') || path.startsWith('/api/subscription')) {
    pushGuide('Key Management', '/docs/key-management');
    pushGuide('SDKs', '/docs/sdk');
    pushGuide('First Cloud Integration', '/docs/first-cloud-integration');
  } else {
    pushGuide('API Rate Limits', '/docs/api-reference/rate-limits');
  }

  if (guides.length < 3) {
    pushGuide('API Rate Limits', '/docs/api-reference/rate-limits');
  }

  return guides.slice(0, 3);
}

function fallbackPathParams(endpoint: ApiEndpoint): ApiField[] {
  const colonMatches = [...endpoint.path.matchAll(/:([a-zA-Z0-9_]+)/g)].map((match) => match[1]);
  const braceMatches = [...endpoint.path.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]);
  return [...colonMatches, ...braceMatches].map((name) => ({
    name,
    type: 'string',
    required: true,
    description: `Path identifier for \`${name}\`.`,
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
  if (value === '$IGRIS_API_KEY') {
    return 'process.env.IGRIS_API_KEY';
  }
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
  if (value === '$IGRIS_API_KEY') {
    return 'os.Getenv("IGRIS_API_KEY")';
  }
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
  if (value === '$IGRIS_API_KEY') {
    return 'std::env::var("IGRIS_API_KEY")?';
  }
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
    whenToUse: override.whenToUse ?? fallbackWhenToUse(section, endpoint),
    retryGuidance: override.retryGuidance ?? fallbackRetryGuidance(endpoint),
    commonMistakes: override.commonMistakes ?? fallbackCommonMistakes(endpoint),
    relatedEndpoints: buildRelatedEndpoints(section, endpoint),
    relatedGuides: buildRelatedGuides(endpoint),
  };
}
