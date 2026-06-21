# frozen_string_literal: true

#
# Static visual-spike fixtures.
#
# IMPORTANT: This file is the ONLY source of action/run data in the Rails
# spike. It is intentionally hard-coded so it can never be confused with
# production data. The visible "Demo data" badge on Home reflects this.
#
# When the Overture API client (igris/overture_client.rb) goes live, the
# controllers should branch on it; this file should stay frozen so the
# offline UI demo still works.
#
module Igris
  module Fixtures
    module_function

    def actions
      [
        {
          id: 'send_email',
          name: 'send_email',
          target_type: 'hosted_api',
          target_label: 'Hosted API · Resend',
          policy: 'Idempotent · 3 retries · signed request',
          replay: 'On',
          last_run_at: 4.minutes.ago,
          last_run_status: 'ok',
          proof: 'Proof verified',
          endpoint: 'https://api.igrisinertial.com/v1/actions/send_email/run',
          endpoint_readiness: 'ready',
          setup: 'Ready',
          secrets_state: 'Configured',
          description: "Outbound transactional email — proxied so agent runs are policy-checked, retried, and recorded with a signed receipt before Resend ever sees them.",
        },
        {
          id: 'deploy_preview',
          name: 'deploy_preview',
          target_type: 'hosted_api',
          target_label: 'Hosted API · Vercel',
          policy: 'Single-flight per branch · 2 retries',
          replay: 'On',
          last_run_at: 9.minutes.ago,
          last_run_status: 'ok',
          proof: 'Proof verified',
          endpoint: 'https://api.igrisinertial.com/v1/actions/deploy_preview/run',
          endpoint_readiness: 'ready',
          setup: 'Ready',
          secrets_state: 'Configured',
          description: 'Triggers a Vercel preview deployment for a branch. Single-flight so an agent retry can never fan out into duplicate builds.',
        },
        {
          id: 'open_pull_request',
          name: 'open_pull_request',
          target_type: 'hosted_api',
          target_label: 'Hosted API · GitHub',
          policy: 'Idempotent on branch · review on protected paths',
          replay: 'Off',
          last_run_at: 21.minutes.ago,
          last_run_status: 'warn',
          proof: 'Proof verified',
          endpoint: 'https://api.igrisinertial.com/v1/actions/open_pull_request/run',
          endpoint_readiness: 'ready',
          setup: 'Ready',
          secrets_state: 'Configured',
          description: 'Opens a pull request from an agent-authored branch. Edits to protected paths route to a review queue before the PR is created.',
        },
        {
          id: 'create_issue',
          name: 'create_issue',
          target_type: 'hosted_api',
          target_label: 'Hosted API · Linear',
          policy: 'Idempotent · dedup by fingerprint',
          replay: 'On',
          last_run_at: 15.minutes.ago,
          last_run_status: 'ok',
          proof: 'Proof verified',
          endpoint: 'https://api.igrisinertial.com/v1/actions/create_issue/run',
          endpoint_readiness: 'ready',
          setup: 'Ready',
          secrets_state: 'Configured',
          description: 'Files a Linear issue. Deduplicated by content fingerprint so repeated agent runs collapse onto one ticket instead of spamming the board.',
        },
        {
          id: 'purge_cache',
          name: 'purge_cache',
          target_type: 'hosted_api',
          target_label: 'Hosted API · Cloudflare',
          policy: 'Fire-and-forget · rate-limited 10/min',
          replay: 'On',
          last_run_at: 33.minutes.ago,
          last_run_status: 'ok',
          proof: 'Proof unavailable',
          endpoint: 'https://api.igrisinertial.com/v1/actions/purge_cache/run',
          endpoint_readiness: 'ready',
          setup: 'Ready',
          secrets_state: 'Configured',
          description: 'Purges a Cloudflare cache tag. Rate-limited at the proxy so an agent loop cannot hammer the zone into a global purge storm.',
        },
        {
          id: 'run_migration',
          name: 'run_migration',
          target_type: 'hosted_api',
          target_label: 'Hosted API · Neon',
          policy: 'Manual approval required · single-flight',
          replay: 'Off',
          last_run_at: 28.minutes.ago,
          last_run_status: 'bad',
          proof: 'Proof failed',
          endpoint: 'https://api.igrisinertial.com/v1/actions/run_migration/run',
          endpoint_readiness: 'needs_target',
          setup: 'Needs target',
          secrets_state: 'Not configured',
          description: 'Applies a schema migration on a Neon branch. Human-in-the-loop by default; currently flagged — a proof mismatch on the last run is awaiting review.',
        },
        {
          id: 'export_ledger',
          name: 'export_ledger',
          target_type: 'local_runtime',
          target_label: 'Local runtime',
          policy: 'Single-flight · signed receipt',
          replay: 'On',
          last_run_at: 52.minutes.ago,
          last_run_status: 'ok',
          proof: 'Proof verified',
          endpoint: 'https://api.igrisinertial.com/v1/actions/export_ledger/run',
          endpoint_readiness: 'ready',
          setup: 'Ready',
          secrets_state: 'Configured',
          description: 'Exports an internal ledger snapshot. Routes through the connected runtime that owns the data, then records a signed receipt.',
        },
        {
          id: 'rebuild_search_index',
          name: 'rebuild_search_index',
          target_type: 'local_runtime',
          target_label: 'Local runtime',
          policy: 'Single-flight · never retried',
          replay: 'On',
          last_run_at: nil,
          last_run_status: nil,
          proof: 'No run yet',
          endpoint: 'https://api.igrisinertial.com/v1/actions/rebuild_search_index/run',
          endpoint_readiness: 'needs_runtime',
          setup: 'Needs runtime',
          secrets_state: 'Not configured',
          description: 'Reindexes an internal corpus. Needs the Igris runtime installed on the box that owns the files.',
        },
      ]
    end

    def find_action(id)
      actions.find { |a| a[:id] == id }
    end

    def runs
      # Ordered newest-first so the activity map renders oldest-left → newest-right.
      # Band key (run_activity_band priority): waiting > blocked > failed > verified > recovered > completed
      [
        { id: 'run_01HGJ9N7P4D', action: 'send_email',          status: 'Running',    routed_via: 'Hosted API · Resend',         policy: 'Idempotent · 3 retries', recovery: 'In flight',              proof: 'Pending',          started_at: 6.seconds.ago,   duration_ms: nil   }, # waiting
        { id: 'run_01HGJ8K2Z9F', action: 'send_email',          status: 'Succeeded',  routed_via: 'Hosted API · Resend',         policy: 'Idempotent · 3 retries', recovery: 'Not needed',             proof: 'Proof verified',   started_at: 4.minutes.ago,   duration_ms: 312,   agent: { agent_id: 'a1f2c3d4-e5f6-7890-abcd-ef1234567890', name: 'claude_code_agent', display_name: 'Claude Code Agent', agent_type: 'claude_code', template_name: 'claude-code' } }, # verified
        { id: 'rdm_01',          action: 'deploy_preview',      status: 'Succeeded',  routed_via: 'Hosted API · Vercel',         policy: 'Single-flight per branch', recovery: 'Not needed',           proof: 'Proof verified',   started_at: 8.minutes.ago,   duration_ms: 441   }, # verified
        { id: 'rdm_02',          action: 'capture_exception',      status: 'Succeeded',  routed_via: 'Hosted API · Sentry',             policy: 'Fire-and-forget',        recovery: 'Not needed',             proof: 'Proof unavailable',started_at: 12.minutes.ago,  duration_ms: 87    }, # completed
        { id: 'rdm_03',          action: 'create_issue',       status: 'Running',    routed_via: 'Hosted API · Linear',        policy: 'Idempotent',             recovery: 'In flight',              proof: 'Pending',          started_at: 15.minutes.ago,  duration_ms: nil   }, # waiting
        { id: 'rdm_04',          action: 'validate_policy',     status: 'Succeeded',  routed_via: 'Runtime · rt_prod_01',        policy: 'Single-flight',          recovery: 'Retried 2x',             proof: 'Proof unavailable',started_at: 22.minutes.ago,  duration_ms: 1_230, executed_target: 'local_runtime', runtime_id: 'rt_prod_01' }, # recovered
        { id: 'rdm_05',          action: 'run_migration',     status: 'Failed',     routed_via: 'Hosted API · Neon',             policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof failed',     started_at: 28.minutes.ago,  duration_ms: 5_400 }, # failed
        { id: 'rdm_06',          action: 'purge_cache',    status: 'Cancelled',  routed_via: 'Hosted API · Cloudflare',             policy: 'Manual approval',        recovery: 'Not needed',             proof: 'Proof unavailable',started_at: 33.minutes.ago,  duration_ms: nil   }, # blocked
        { id: 'run_01HGJ7Q4X1A', action: 'create_invoice',      status: 'Succeeded',  routed_via: 'Webhook · Stripe',            policy: 'Single-flight',          recovery: 'Retried 1x',             proof: 'Proof verified',   started_at: 38.minutes.ago,  duration_ms: 988   }, # verified (proof before recovered)
        { id: 'rdm_07',          action: 'send_email',          status: 'Succeeded',  routed_via: 'Hosted API · Resend',         policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof verified',   started_at: 41.minutes.ago,  duration_ms: 198   }, # verified
        { id: 'rdm_08',          action: 'open_pull_request', status: 'Succeeded',  routed_via: 'Hosted API · GitHub',             policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof unavailable',started_at: 47.minutes.ago,  duration_ms: 356   }, # completed
        { id: 'run_01HGJ3R6T7E', action: 'export_ledger',       status: 'Succeeded',  routed_via: 'Runtime · rt_prod_01',        policy: 'Single-flight',          recovery: 'Not needed',             proof: 'Proof verified',   started_at: 52.minutes.ago,  duration_ms: 1_740, executed_target: 'local_runtime', runtime_id: 'rt_prod_01' }, # verified
        { id: 'rdm_09',          action: 'deploy_preview',      status: 'Failed',     routed_via: 'Hosted API · Vercel',         policy: 'Single-flight per branch', recovery: 'Not needed',           proof: 'Proof failed',     started_at: 54.minutes.ago,  duration_ms: 3_800 }, # failed
        { id: 'rdm_10',          action: 'run_audit',           status: 'Succeeded',  routed_via: 'Runtime · rt_prod_02',        policy: 'Single-flight',          recovery: 'Not needed',             proof: 'Proof verified',   started_at: 58.minutes.ago,  duration_ms: 2_100, executed_target: 'local_runtime', runtime_id: 'rt_prod_02' }, # verified
        { id: 'rdm_11',          action: 'resolve_issue',      status: 'Awaiting approval', routed_via: 'Hosted API · Sentry',       policy: 'Human-gated',            recovery: 'Not needed',             proof: 'Pending',          started_at: (1.1 * 3600).seconds.ago, duration_ms: nil }, # waiting
        { id: 'rdm_12',          action: 'refund_charge',       status: 'Denied',     routed_via: 'Hosted API · Stripe',         policy: 'Manual approval',        recovery: 'Not needed',             proof: 'Proof unavailable',started_at: (1.4 * 3600).seconds.ago, duration_ms: nil }, # blocked
        { id: 'rdm_13',          action: 'export_ledger',       status: 'Succeeded',  routed_via: 'Runtime · rt_prod_01',        policy: 'Single-flight',          recovery: 'Compensated',            proof: 'Proof unavailable',started_at: (1.8 * 3600).seconds.ago, duration_ms: 2_870, executed_target: 'local_runtime', runtime_id: 'rt_prod_01' }, # recovered
        { id: 'run_01HGJ5W0M3B', action: 'refund_charge',       status: 'Failed',     routed_via: 'Hosted API · Stripe',         policy: 'Manual approval',        recovery: 'Awaiting review',        proof: 'Proof failed',     started_at: 2.hours.ago,     duration_ms: 4_120 }, # failed
        { id: 'rdm_14',          action: 'deploy_preview',      status: 'Succeeded',  routed_via: 'Hosted API · Vercel',         policy: 'Single-flight per branch', recovery: 'Not needed',           proof: 'Proof verified',   started_at: (2.2 * 3600).seconds.ago, duration_ms: 620 }, # verified
        { id: 'rdm_15',          action: 'create_issue',       status: 'Succeeded',  routed_via: 'Hosted API · Linear',        policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof unavailable',started_at: (2.7 * 3600).seconds.ago, duration_ms: 1_100 }, # completed
        { id: 'rdm_16',          action: 'run_migration',     status: 'Failed',     routed_via: 'Hosted API · Neon',             policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof failed',     started_at: (3.2 * 3600).seconds.ago, duration_ms: 8_200 }, # failed
        { id: 'rdm_17',          action: 'purge_cache',    status: 'Succeeded',  routed_via: 'Hosted API · Cloudflare',             policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof verified',   started_at: (3.8 * 3600).seconds.ago, duration_ms: 390 }, # verified
        { id: 'rdm_18',          action: 'rebuild_search_index',     status: 'Blocked',    routed_via: 'Runtime · rt_prod_01',        policy: 'Single-flight',          recovery: 'Not needed',             proof: 'Proof unavailable',started_at: (4.3 * 3600).seconds.ago, duration_ms: nil, runtime_unavailable: true, executed_target: 'local_runtime' }, # blocked
        { id: 'rdm_19',          action: 'send_email',          status: 'Succeeded',  routed_via: 'Hosted API · Resend',         policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof verified',   started_at: (4.9 * 3600).seconds.ago, duration_ms: 211 }, # verified
        { id: 'rdm_20',          action: 'open_pull_request', status: 'Succeeded',  routed_via: 'Hosted API · GitHub',             policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof unavailable',started_at: (5.4 * 3600).seconds.ago, duration_ms: 480 }, # completed
        { id: 'rdm_21',          action: 'run_audit',           status: 'Pending',    routed_via: 'Runtime · rt_prod_02',        policy: 'Single-flight',          recovery: 'Not needed',             proof: 'Pending',          started_at: (5.8 * 3600).seconds.ago, duration_ms: nil }, # waiting
        { id: 'rdm_22',          action: 'validate_policy',     status: 'Succeeded',  routed_via: 'Runtime · rt_prod_01',        policy: 'Single-flight',          recovery: 'Retried 3x',             proof: 'Proof unavailable',started_at: (5.9 * 3600).seconds.ago, duration_ms: 3_410, executed_target: 'local_runtime', runtime_id: 'rt_prod_01' }, # recovered
        { id: 'run_01HGJ4D8L0C', action: 'send_email',          status: 'Succeeded',  routed_via: 'Hosted API · Resend',         policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof verified',   started_at: 6.hours.ago,     duration_ms: 220 }, # verified
        { id: 'rdm_23',          action: 'refund_charge',       status: 'Failed',     routed_via: 'Hosted API · Stripe',         policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof failed',     started_at: 7.hours.ago,     duration_ms: 6_700 }, # failed
        { id: 'rdm_24',          action: 'capture_exception',      status: 'Succeeded',  routed_via: 'Hosted API · Sentry',             policy: 'Fire-and-forget',        recovery: 'Not needed',             proof: 'Proof verified',   started_at: 8.hours.ago,     duration_ms: 93 }, # verified
        { id: 'rdm_25',          action: 'export_ledger',       status: 'Succeeded',  routed_via: 'Runtime · rt_prod_01',        policy: 'Single-flight',          recovery: 'Not needed',             proof: 'Proof unavailable',started_at: 9.hours.ago,     duration_ms: 1_980, executed_target: 'local_runtime', runtime_id: 'rt_prod_01' }, # completed
        { id: 'rdm_26',          action: 'deploy_preview',      status: 'Succeeded',  routed_via: 'Hosted API · Vercel',         policy: 'Single-flight per branch', recovery: 'Resumed from checkpoint',proof: 'Proof unavailable',started_at: 11.hours.ago,    duration_ms: 4_200 }, # recovered
        { id: 'rdm_27',          action: 'create_issue',       status: 'Succeeded',  routed_via: 'Hosted API · Linear',        policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof verified',   started_at: 12.hours.ago,    duration_ms: 760 }, # verified
        { id: 'rdm_28',          action: 'charge_customer',     status: 'Cancelled',  routed_via: 'Hosted API · Stripe',         policy: 'Manual approval',        recovery: 'Not needed',             proof: 'Proof unavailable',started_at: 13.hours.ago,    duration_ms: nil }, # blocked
        { id: 'rdm_29',          action: 'run_migration',     status: 'Error',      routed_via: 'Hosted API · Neon',             policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof failed',     started_at: 14.hours.ago,    duration_ms: 9_100 }, # failed
        { id: 'rdm_30',          action: 'purge_cache',    status: 'Succeeded',  routed_via: 'Hosted API · Cloudflare',             policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof verified',   started_at: 15.hours.ago,    duration_ms: 340 }, # verified
        { id: 'rdm_31',          action: 'send_email',          status: 'Succeeded',  routed_via: 'Hosted API · Resend',         policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof unavailable',started_at: 16.hours.ago,    duration_ms: 175 }, # completed
        { id: 'rdm_32',          action: 'validate_policy',     status: 'Succeeded',  routed_via: 'Runtime · rt_prod_02',        policy: 'Single-flight',          recovery: 'Not needed',             proof: 'Proof verified',   started_at: 17.hours.ago,    duration_ms: 890, executed_target: 'local_runtime', runtime_id: 'rt_prod_02' }, # verified
        { id: 'rdm_33',          action: 'run_audit',           status: 'Succeeded',  routed_via: 'Runtime · rt_prod_01',        policy: 'Single-flight',          recovery: 'Not needed',             proof: 'Proof verified',   started_at: 19.hours.ago,    duration_ms: 1_560, executed_target: 'local_runtime', runtime_id: 'rt_prod_01' }, # verified
        { id: 'rdm_34',          action: 'refund_charge',       status: 'Failed',     routed_via: 'Hosted API · Stripe',         policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof failed',     started_at: 22.hours.ago,    duration_ms: 4_900 }, # failed
        { id: 'rdm_35',          action: 'capture_exception',   status: 'Succeeded',  routed_via: 'Hosted API · Sentry',         policy: 'Fire-and-forget',        recovery: 'Not needed',             proof: 'Proof verified',   started_at: 1.day.ago,       duration_ms: 530 }, # verified
        { id: 'rdm_36',          action: 'create_issue',       status: 'Succeeded',  routed_via: 'Hosted API · Linear',        policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof unavailable',started_at: (1.5 * 86400).seconds.ago, duration_ms: 1_340 }, # completed
        { id: 'rdm_37',          action: 'open_pull_request',   status: 'Succeeded',  routed_via: 'Hosted API · GitHub',         policy: 'Idempotent on branch',   recovery: 'Retried 1x',             proof: 'Proof unavailable',started_at: 2.days.ago,      duration_ms: 2_010 }, # recovered
        { id: 'rdm_38',          action: 'run_migration',     status: 'Failed',     routed_via: 'Hosted API · Neon',             policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof failed',     started_at: (2.3 * 86400).seconds.ago, duration_ms: 7_300 }, # failed
        { id: 'rdm_39',          action: 'purge_cache',    status: 'Succeeded',  routed_via: 'Hosted API · Cloudflare',             policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof verified',   started_at: (2.7 * 86400).seconds.ago, duration_ms: 410 }, # verified
        { id: 'rdm_40',          action: 'run_audit',           status: 'Denied',     routed_via: 'Runtime · rt_prod_02',        policy: 'Human-gated',            recovery: 'Not needed',             proof: 'Proof unavailable',started_at: 3.days.ago,      duration_ms: nil }, # blocked
      ]
    end

    def find_run(id)
      runs.find { |r| r[:id] == id }
    end

    # Hero-style action steps. Mirrors STEPS in
    # web/apps/web-landing/src/components/sections/Products.tsx so the
    # Run detail page can render the same tree visually.
    def steps_for(base)
      case base[:status]
      when 'Running'
        [
          { kind: :action, num: '01', name: 'read_file',  detail: '/uploads/policy-v3.pdf · 1.2KB digest',      latency: 12,  status: :committed, receipt: 'r₀₁',  signed_at: '14:07:42.218' },
          { kind: :action, num: '02', name: 'http_call',  detail: 'GET /v3/accounts/8821 · 200 OK',             latency: 24,  status: :committed, receipt: 'r₀₂',  signed_at: '14:07:42.301' },
          { kind: :action, num: '03', name: 'http_call',  detail: 'POST /v3/sync · 200 OK',                     latency: 38,  status: :committed, receipt: 'r₀₃',  signed_at: '14:07:42.481' },
          { kind: :fault,            name: 'host_fault', detail: 'worker_a failed · checkpoint preserved · resumed on worker_b', latency: 31, status: :committed },
          { kind: :action, num: '04', name: 'http_call',  detail: 'retry 2 of 3 succeeded',                     latency: 42,  status: :committed, receipt: 'r₀₄',  signed_at: '14:07:43.014' },
          { kind: :action, num: '05', name: 'read_file',  detail: '/tmp/manifest.json · 0.8KB digest',          latency: 9,   status: :committed, receipt: 'r₀₅',  signed_at: '14:07:43.140' },
          { kind: :action, num: '06', name: 'inference',  detail: 'classify_intent · 128 tok · 0.31 conf',      latency: 210, status: :committed, receipt: 'r₀₆',  signed_at: '14:07:43.402' },
          { kind: :action, num: '07', name: 'http_call',  detail: 'POST /v3/accounts/8821/ledger · 200 OK',     latency: 47,  status: :committed, receipt: 'r₀₇',  signed_at: '14:07:43.509' },
          { kind: :action, num: '08', name: 'db_write',   detail: 'accounts_staged · r_7720',                   latency: 54,  status: :committed, receipt: 'r₀₈',  signed_at: '14:07:43.612' },
          { kind: :action, num: '09', name: 'http_call',  detail: 'POST /v3/notify · 202 Accepted',             latency: 33,  status: :committed, receipt: 'r₀₉',  signed_at: '14:07:43.701' },
          { kind: :fault,            name: 'rate_limit', detail: 'upstream 429 · backoff 250ms · resumed',      latency: 250, status: :committed },
          { kind: :action, num: '10', name: 'http_call',  detail: 'POST /v3/notify · retry 1 of 3 · 202',       latency: 29,  status: :committed, receipt: 'r₁₀',  signed_at: '14:07:44.012' },
          { kind: :action, num: '11', name: 'read_file',  detail: '/var/run/lock/orders · 0.1KB digest',        latency: 6,   status: :committed, receipt: 'r₁₁',  signed_at: '14:07:44.119' },
          { kind: :action, num: '12', name: 'db_write',   detail: 'orders_fulfilled · r_8421',                                status: :running },
        ]
      when 'Failed'
        [
          { kind: :action, num: '01', name: 'read_file', detail: 'request body · 0.4KB', latency: 8,  status: :committed, receipt: 'r₀₁' },
          { kind: :action, num: '02', name: 'http_call', detail: 'POST /refund · HTTP 402 ⨯',          latency: 920, status: :failed,    receipt: nil },
        ]
      else # Succeeded
        [
          { kind: :action, num: '01', name: 'read_file', detail: 'payload · 0.6KB digest',         latency: 9,  status: :committed, receipt: 'r₀₁' },
          { kind: :action, num: '02', name: 'http_call', detail: 'POST /v1/' + base[:action] + ' · 200 OK', latency: base[:duration_ms].to_i.clamp(20, 600), status: :committed, receipt: 'r₀₂' },
        ]
      end
    end

    def run_detail(id)
      base = find_run(id) or return nil
      base.merge(
        steps: steps_for(base),
        story: [
          { title: 'Action received', tone: :ok,
            meta: 'POST /v1/actions/' + base[:action] + '/run · request signature valid' },
          { title: 'Policy evaluated', tone: :ok,
            meta: base[:policy] + ' · accepted' },
          { title: 'Routed to target', tone: :ok,
            meta: base[:routed_via] },
          base[:status] == 'Failed' ?
            { title: 'Target responded with 4xx', tone: :bad, meta: 'HTTP 402 · raw response redacted' } :
            { title: 'Side effect completed', tone: :ok, meta: 'HTTP 200 · ' + base[:duration_ms].to_s + ' ms' },
          { title: 'Receipt signed', tone: base[:proof] == 'Proof verified' ? :ok : :bad,
            meta: base[:proof] == 'Proof verified' ? 'sha256:redacted… · co-signed by runtime' : 'signature mismatch · receipt withheld' },
        ],
        raw_evidence: [
          { key: 'request_body',  value: '«redacted in spike»' },
          { key: 'response_body', value: '«redacted in spike»' },
          { key: 'receipt_digest', value: base[:proof] == 'Proof verified' ? 'sha256:redacted…3f9a' : 'unavailable' },
        ]
      )
    end

    # Evidence Memory for a demo run — operator-facing summaries only (goal /
    # decision / evidence / outcome), mirroring the shape the real API returns.
    # Verified runs carry richer memory; failed runs record the failure outcome.
    def agent_memory_for_run(run)
      return [] unless run

      agent = run[:agent] || { name: 'support_agent', display_name: 'Support Agent' }
      failed = run[:status].to_s.casecmp('Failed').zero?
      [
        {
          memory_id:        'mem_demo_01',
          task_id:          run[:id].to_s,
          execution_id:     'exec_demo_01',
          agent_id:         agent[:agent_id].to_s,
          agent_name:       agent[:name].to_s.presence || 'support_agent',
          goal_summary:     "Complete the #{run[:action]} action requested by the calling agent.",
          decision_summary: failed ?
            'Chose the configured target and proceeded; the downstream call was rejected.' :
            'Selected the configured target after policy allowed the call, then executed once.',
          evidence_summary: failed ?
            ['Policy preset allowed the call', 'Target returned a non-2xx response', 'No signed receipt produced'] :
            ['Policy preset allowed the call', 'Target acknowledged the side effect', 'Runtime co-signed the receipt'],
          outcome_summary:  failed ?
            'Action failed at the target; recorded for review, no proof attached.' :
            'Action completed and a verified proof receipt was recorded.',
          redaction_status:     'redacted',
          retention_expires_at: 83.days.from_now,
          retention_label:      'Expires in 83 days',
          created_at:           run[:started_at],
        },
      ]
    end

    # Registered-agent roster for the Agent Catalog demo. agent_id values match
    # the Execution Intelligence demo breakdown keys below so the catalog join
    # produces real-looking per-agent metrics offline.
    def agents
      [
        {
          agent_id: 'a1f2c3d4-e5f6-7890-abcd-ef1234567890',
          name: 'claude_code_agent',
          display_name: 'Claude Code Agent',
          agent_type: 'claude_code',
          template_name: 'claude-code',
          version: '1.4.0',
          description: 'Coding agent that opens pull requests and triggers preview deploys through Igris.',
          created_at: 24.days.ago,
          updated_at: 2.days.ago,
          archived: false,
          archived_at: nil,
          last_activity_at: 4.minutes.ago,
        },
        {
          agent_id: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
          name: 'support_agent',
          display_name: 'Support Agent',
          agent_type: 'support',
          template_name: 'customer-support',
          version: '0.9.2',
          description: 'Handles inbound support actions — transactional email, refunds, and issue triage.',
          created_at: 12.days.ago,
          updated_at: 5.hours.ago,
          archived: false,
          archived_at: nil,
          last_activity_at: 38.minutes.ago,
        },
      ]
    end

    # Recent Evidence Memory for one demo agent — reuses the per-run memory
    # shape, attributed to the agent across a couple of recent runs.
    def agent_memory_for_agent(agent_id)
      agent = agents.find { |a| a[:agent_id].to_s == agent_id.to_s || a[:name].to_s == agent_id.to_s }
      return [] unless agent

      sample = runs.select { |r| r[:agent] }.first(2)
      sample = runs.first(2) if sample.empty?
      sample.each_with_index.map do |run, i|
        agent_memory_for_run(run.merge(agent: agent)).first.merge(
          memory_id: "mem_agent_#{i}",
          agent_id: agent[:agent_id],
          agent_name: agent[:name],
        )
      end
    end

    # Action Pack catalog demo. The Starter Pack is shown as installed with its
    # three mock_demo actions so the Pack Catalog renders its full shape offline.
    def action_packs
      [
        {
          name: 'starter',
          display_name: 'Starter Pack',
          description: 'Safe mock_demo actions for first-agent onboarding: echo, simulated failure, and approval gate.',
          action_count: 3,
          installed: true,
          installed_at: 10.days.ago,
          installed_actions: [
            { name: 'demo.echo',           display_name: 'Demo Echo',           policy: 'Read-only',       target_label: 'Mock demo' },
            { name: 'demo.fail_once',      display_name: 'Demo Fail Once',      policy: 'Safe automation', target_label: 'Mock demo' },
            { name: 'demo.needs_approval', display_name: 'Demo Needs Approval', policy: 'Human-gated · approval required', target_label: 'Mock demo' },
          ],
        },
      ]
    end

    # Execution Intelligence demo metrics — deterministic, plausible operational
    # numbers so the metrics tab renders its full shape offline. Rates are
    # fractions (0..1) to match the real API contract.
    def execution_intelligence(range = 'last_30d')
      summary = {
        total_runs: 342, successful_runs: 298, failed_runs: 28,
        approval_required_runs: 16, human_intervention_runs: 9, recovery_runs: 21,
        average_duration_ms: 486.0,
        success_rate: 298 / 342.0, failure_rate: 28 / 342.0,
        approval_rate: 16 / 342.0, human_intervention_rate: 9 / 342.0,
        recovery_rate: 21 / 342.0,
      }
      agents = [
        intel_row('a1f2c3d4-e5f6-7890-abcd-ef1234567890', 'Claude Code Agent', 181, 168, 9, 7, 11, 442.0),
        intel_row('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Support Agent',     112, 96, 12, 6, 8, 503.0),
        intel_row('unattributed', 'unattributed', 49, 34, 7, 3, 2, 612.0),
      ]
      actions = [
        intel_row('send_email',      'send_email',      154, 142, 6, 4, 5, 318.0),
        intel_row('charge_customer', 'charge_customer', 88, 71, 11, 9, 9, 642.0),
        intel_row('sync_inventory',  'sync_inventory',  61, 55, 4, 1, 4, 421.0),
        intel_row('open_pr',         'open_pr',         39, 30, 7, 2, 3, 587.0),
      ]
      { range: range, source: 'demo', summary: summary, agents: agents, actions: actions }
    end

    def execution_affinity(range: 'last_30d', agent_id: nil, action_name: nil, pack: nil)
      agent_actions = [
        affinity_action('demo.echo', 'Demo Echo', 'starter', 88, 83, 2, 0, 4, 22, 21, 84),
        affinity_action('demo.needs_approval', 'Demo Needs Approval', 'starter', 31, 28, 1, 31, 1, 8, 8, 30),
        affinity_action('charge_customer', 'Charge Customer', 'finance', 18, 14, 3, 11, 4, 12, 10, 15),
      ]
      action_agents = [
        affinity_agent('a1f2c3d4-e5f6-7890-abcd-ef1234567890', 'Claude Code Agent', 'developer_agent', 'demo.echo', 'Demo Echo', 'starter', 88, 83, 2, 0, 4, 22, 21, 84),
        affinity_agent('a1f2c3d4-e5f6-7890-abcd-ef1234567890', 'Claude Code Agent', 'developer_agent', 'demo.needs_approval', 'Demo Needs Approval', 'starter', 31, 28, 1, 31, 1, 8, 8, 30),
        affinity_agent('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Support Agent', 'support_agent', 'demo.echo', 'Demo Echo', 'starter', 54, 50, 2, 0, 3, 12, 12, 53),
      ]
      pack_edges = action_agents.map do |row|
        {
          pack_name: row[:pack_name], action_name: row[:action_name],
          action_display_name: row[:action_display_name], agent_id: row[:agent_id],
          agent_name: row[:agent_name], run_count: row[:run_count],
          success_rate: row[:success_rate], recovery_rate: row[:recovery_rate],
          approval_rate: row[:approval_rate], eval_pass_rate: row[:eval_pass_rate],
          proof_coverage: row[:proof_coverage],
        }
      end

      agent_actions = agent_actions.select { |row| row[:action_name] == action_name.to_s } if action_name.present?
      agent_actions = agent_actions.select { |row| row[:pack_name] == pack.to_s } if pack.present?
      action_agents = action_agents.select { |row| row[:agent_id] == agent_id.to_s } if agent_id.present?
      action_agents = action_agents.select { |row| row[:action_name] == action_name.to_s } if action_name.present?
      action_agents = action_agents.select { |row| row[:pack_name] == pack.to_s } if pack.present?
      pack_edges = pack_edges.select { |row| row[:agent_id] == agent_id.to_s } if agent_id.present?
      pack_edges = pack_edges.select { |row| row[:action_name] == action_name.to_s } if action_name.present?
      pack_edges = pack_edges.select { |row| row[:pack_name] == pack.to_s } if pack.present?

      {
        range: range,
        source: 'demo',
        agent_actions: agent_actions,
        action_agents: action_agents,
        pack_edges: pack_edges,
        hotspots: [
          { scope: 'action', name: 'Demo Needs Approval', observation: 'Approval appears in at least half of recorded runs.', run_count: 31 },
          { scope: 'action', name: 'Charge Customer', observation: 'Recovery appeared in at least one in ten recorded runs.', run_count: 18 },
        ],
      }
    end

    # Demo Policy Simulation result so the read-only preview card renders
    # offline. Deterministic, derived from the requested mode, and clearly demo
    # data (the page carries the global "Demo data" indicator). Never real.
    def policy_simulation(payload)
      payload = payload.respond_to?(:with_indifferent_access) ? payload.with_indifferent_access : payload
      mode  = payload[:policy_mode].to_s
      range = payload[:range].to_s.presence || '30d'
      total = 124 + 18
      affected = 18
      {
        state: :ok,
        range: range,
        policy_mode: mode.presence || 'require_approval',
        total_runs_considered: total,
        would_allow: total - affected,
        would_require_approval: mode == 'block' ? 0 : affected,
        would_block: mode == 'block' ? affected : 0,
        affected_run_count: affected,
        affected_agents: [{ key: 'demo-agent', name: 'claude-production', run_count: affected }],
        affected_actions: [{ name: 'stripe.refund_payment', run_count: affected }],
        sample_runs: [
          { task_id: 'run_demo_sim_01', status: 'Succeeded' },
          { task_id: 'run_demo_sim_02', status: 'Succeeded' },
        ],
        warnings: [],
      }
    end

    # Demo policy proposals so the Proposals surface renders offline. Hard-coded
    # and never confused with real data (the page shows the global "Demo data"
    # indicator and writes are inert in fixture mode). Shaped like the backend
    # response so it flows through the same normalizer.
    def policy_proposals
      now = Time.current
      [
        {
          'proposal_id' => 'prop_demo_refund_guard',
          'name' => 'Pause large Stripe refunds',
          'description' => 'Require human approval for stripe.refund actions before they execute.',
          'status' => 'review_ready',
          'policy_mode' => 'require_approval',
          'match_criteria_json' => { 'range' => '30d', 'match_action_prefix' => 'stripe.refund' },
          'latest_simulation_json' => demo_proposal_simulation('require_approval', now - 3.hours),
          'created_at' => (now - 6.days).iso8601,
          'updated_at' => (now - 3.hours).iso8601,
        },
        {
          'proposal_id' => 'prop_demo_block_unproven_writes',
          'name' => 'Block db writes without proof',
          'description' => 'Block db.write actions that completed without a recorded proof.',
          'status' => 'draft',
          'policy_mode' => 'block',
          'match_criteria_json' => { 'range' => '7d', 'match_action_prefix' => 'db.', 'require_proof_missing' => true },
          'latest_simulation_json' => nil,
          'created_at' => (now - 2.days).iso8601,
          'updated_at' => (now - 2.days).iso8601,
        },
      ]
    end

    def find_policy_proposal(id)
      policy_proposals.find { |p| p['proposal_id'] == id.to_s }
    end

    def policy_proposal_events(id)
      now = Time.current
      case id.to_s
      when 'prop_demo_refund_guard'
        [
          { 'event_type' => 'status_changed', 'safe_summary' => 'Marked ready for review', 'created_at' => (now - 3.hours).iso8601 },
          { 'event_type' => 'simulated', 'safe_summary' => 'Re-simulated: 18 of 142 runs affected', 'created_at' => (now - 3.hours).iso8601 },
          { 'event_type' => 'created', 'safe_summary' => 'Draft proposal created', 'created_at' => (now - 6.days).iso8601 },
        ]
      when 'prop_demo_block_unproven_writes'
        [{ 'event_type' => 'created', 'safe_summary' => 'Draft proposal created', 'created_at' => (now - 2.days).iso8601 }]
      else
        []
      end
    end

    def demo_proposal_simulation(mode, at)
      total = 142
      affected = 18
      {
        'range' => '30d',
        'policy_mode' => mode,
        'total_runs_considered' => total,
        'would_allow' => total - affected,
        'would_require_approval' => mode == 'block' ? 0 : affected,
        'would_block' => mode == 'block' ? affected : 0,
        'affected_run_count' => affected,
        'affected_agents' => [{ 'key' => 'demo-agent', 'name' => 'claude-production', 'run_count' => affected }],
        'affected_actions' => [{ 'name' => 'stripe.refund_payment', 'run_count' => affected }],
        'sample_runs' => [
          { 'task_id' => 'run_demo_sim_01', 'status' => 'completed' },
          { 'task_id' => 'run_demo_sim_02', 'status' => 'completed' },
        ],
        'warnings' => [],
        'simulated_at' => at.iso8601,
      }
    end

    def execution_evaluations_for_run(run)
      return { state: :not_evaluated, runs: [] } unless run

      passed = !run[:status].to_s.match?(/failed/i) && run[:proof].to_s.match?(/verified/i)
      {
        state: :evaluated,
        runs: [
          {
            eval_run_id: 'eval_run_demo_01',
            eval_id: 'eval_demo_01',
            eval_name: 'Demo execution evaluation',
            status: passed ? 'Passed' : 'Failed',
            passed_count: passed ? 3 : 1,
            failed_count: passed ? 0 : 2,
            created_at: run[:started_at],
            results: [
              { name: 'Required action completed', status: passed ? 'Passed' : 'Failed',
                reason: passed ? 'action was observed in execution truth' : 'action was not observed in execution truth' },
              { name: 'Proof generated', status: run[:proof].to_s.match?(/verified/i) ? 'Passed' : 'Failed',
                reason: run[:proof].to_s.match?(/verified/i) ? 'proof or receipt state was recorded' : 'proof or receipt state was not recorded' },
              { name: 'No unsafe marker detected', status: 'Passed',
                reason: 'no unsafe marker was detected in stored execution metadata' },
            ],
          },
        ],
      }
    end

    # Demo execution-evaluation definitions so the Evaluations surface renders
    # offline. Hard-coded, never confused with real data (the page shows the
    # global "Demo data" indicator and writes are inert in fixture mode).
    def execution_evals
      [
        {
          eval_id: 'eval_demo_send_email',
          name: 'send_email behaves safely',
          description: 'The email action must call the expected target, never escalate, and produce a signed receipt.',
          target_action_name: 'send_email',
          target_agent_id: '',
          enabled: true,
          assertions_json: [
            { name: 'send_email was called',     type: 'action_called',   action_name: 'send_email' },
            { name: 'No approval was required',  type: 'approval_not_required' },
            { name: 'A signed proof exists',     type: 'proof_generated' },
            { name: 'No secret was leaked',      type: 'no_secret_leak' },
          ],
          created_at: 6.days.ago.iso8601,
          updated_at: 2.days.ago.iso8601,
        },
        {
          eval_id: 'eval_demo_run_migration',
          name: 'run_migration stays human-gated',
          description: 'Schema migrations must pause for human approval and must not run a destructive action without review.',
          target_action_name: 'run_migration',
          target_agent_id: '',
          enabled: true,
          assertions_json: [
            { name: 'Approval was required',           type: 'approval_required' },
            { name: 'refund_charge was not called',    type: 'action_not_called', action_name: 'refund_charge' },
            { name: 'Recovery was not required',       type: 'recovery_not_required' },
          ],
          created_at: 11.days.ago.iso8601,
          updated_at: 9.days.ago.iso8601,
        },
      ]
    end

    def find_execution_eval(id)
      execution_evals.find { |e| e[:eval_id] == id }
    end

    def execution_eval_history(eval_id)
      now = Time.current
      case eval_id.to_s
      when 'eval_demo_send_email'
        [
          eval_history_row(eval_id, 'run_01HGJ8K2Z9F', 'passed', 4, 0, now - 2.hours),
          eval_history_row(eval_id, 'rdm_07', 'passed', 4, 0, now - 5.hours),
          eval_history_row(eval_id, 'rdm_31', 'failed', 3, 1, now - 16.hours,
                           'proof or receipt state was not recorded'),
        ]
      when 'eval_demo_run_migration'
        [
          eval_history_row(eval_id, 'rdm_16', 'passed', 3, 0, now - 3.hours),
          eval_history_row(eval_id, 'rdm_29', 'failed', 2, 1, now - 14.hours,
                           'approval was not recorded for this run'),
        ]
      else
        []
      end
    end

    def intel_row(key, name, total, ok, failed, approvals, recoveries, avg)
      eval_runs = [(total * 0.62).round, 1].max
      eval_passed = [(eval_runs * (ok.to_f / total)).round, eval_runs].min
      proof_covered = [(total * 0.72).round, total].min
      {
        key: key, name: name, total_runs: total, successful_runs: ok,
        failed_runs: failed, approval_required_runs: approvals, recovery_runs: recoveries,
        eval_run_count: eval_runs, eval_passed_runs: eval_passed,
        proof_covered_runs: proof_covered,
        average_duration_ms: avg,
        success_rate: total.positive? ? ok.to_f / total : 0.0,
        failure_rate: total.positive? ? failed.to_f / total : 0.0,
        approval_rate: total.positive? ? approvals.to_f / total : 0.0,
        recovery_rate: total.positive? ? recoveries.to_f / total : 0.0,
        eval_pass_rate: eval_runs.positive? ? eval_passed.to_f / eval_runs : 0.0,
        proof_coverage: total.positive? ? proof_covered.to_f / total : 0.0,
      }
    end

    def affinity_action(action_name, display_name, pack_name, total, ok, failed, approvals, recoveries, eval_runs, eval_passed, proof_runs)
      {
        action_name: action_name, action_display_name: display_name, pack_name: pack_name,
        run_count: total, successful_runs: ok, failed_runs: failed,
        approval_required_runs: approvals, recovery_runs: recoveries,
        eval_run_count: eval_runs, eval_passed_runs: eval_passed,
        proof_covered_runs: proof_runs,
        success_rate: total.positive? ? ok.to_f / total : 0.0,
        failure_rate: total.positive? ? failed.to_f / total : 0.0,
        approval_rate: total.positive? ? approvals.to_f / total : 0.0,
        recovery_rate: total.positive? ? recoveries.to_f / total : 0.0,
        eval_pass_rate: eval_runs.positive? ? eval_passed.to_f / eval_runs : 0.0,
        proof_coverage: total.positive? ? proof_runs.to_f / total : 0.0,
      }
    end

    def affinity_agent(agent_id, agent_name, agent_type, action_name, display_name, pack_name, total, ok, failed, approvals, recoveries, eval_runs, eval_passed, proof_runs)
      affinity_action(action_name, display_name, pack_name, total, ok, failed, approvals, recoveries, eval_runs, eval_passed, proof_runs).merge(
        agent_id: agent_id, agent_name: agent_name, agent_type: agent_type,
      )
    end

    def eval_history_row(eval_id, task_id, status, passed, failed, created_at, failed_reason = nil)
      {
        eval_run_id: "eval_run_#{eval_id}_#{task_id}",
        eval_id: eval_id,
        eval_name: execution_evals.find { |e| e[:eval_id] == eval_id }&.dig(:name) || 'Demo evaluation',
        task_id: task_id,
        execution_id: '',
        status: status,
        passed_count: passed,
        failed_count: failed,
        created_at: created_at.iso8601,
        results_json: [
          { name: 'Required action matched', status: status == 'passed' ? 'passed' : 'failed',
            reason: failed_reason || 'all required execution facts matched' },
        ],
      }
    end

    # 14-day daily run counts for the Home sparkline. Hand-tuned to feel
    # realistic — weekend dip, midweek spike — and small enough that the
    # SVG is calm and readable.
    # ~15 weeks of daily run counts for the Home contribution chart.
    # Deterministic but uneven — weekend dips, midweek peaks, a couple of
    # empty days so the legend's "no runs" cell shows up in the real grid.
    def daily_run_counts
      seed = 42
      days = 105
      Array.new(days) do |i|
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        dow = (i + 3) % 7
        weekend = (dow == 0 || dow == 6)
        # Most weekends and ~1-in-10 weekdays are blank, so the legend's
        # "no runs" cell actually appears in the grid.
        skip = (weekend && (seed % 5 < 3)) || (!weekend && (seed % 11 == 0))
        next 0 if skip
        base = weekend ? 1 : ([3, 4, 5][dow % 3] || 3)
        wave = (Math.sin(i * 0.45) * 3).round.abs
        jitter = seed % 5
        base + wave + jitter
      end
    end

    def runtimes
      [
        {
          runtime_id: 'rt_prod_01',
          name: 'rt_prod_01',
          os: 'linux-amd64',
          status: 'Healthy',
          last_seen_at: 18.seconds.ago,
          capabilities: ['read_file', 'http_call', 'db_write'],
        },
        {
          runtime_id: 'rt_staging_01',
          name: 'rt_staging_01',
          os: 'macos-arm64',
          status: 'Stale',
          last_seen_at: 22.minutes.ago,
          capabilities: ['read_file', 'http_call'],
        },
      ]
    end
  end
end
