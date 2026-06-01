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
          id: 'create_invoice',
          name: 'create_invoice',
          target_type: 'webhook',
          target_label: 'Webhook · Stripe',
          policy: 'Single-flight per customer · review on >$5k',
          replay: 'Off',
          last_run_at: 38.minutes.ago,
          last_run_status: 'warn',
          proof: 'Proof verified',
          endpoint: 'https://api.igrisinertial.com/v1/actions/create_invoice/run',
          endpoint_readiness: 'ready',
          setup: 'Ready',
          secrets_state: 'Configured',
          description: 'Creates a customer invoice. High-value invoices route to a review queue before the side effect runs.',
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
          id: 'refund_charge',
          name: 'refund_charge',
          target_type: 'hosted_api',
          target_label: 'Hosted API · Stripe',
          policy: 'Manual approval required',
          replay: 'Off',
          last_run_at: 2.hours.ago,
          last_run_status: 'bad',
          proof: 'Proof failed',
          endpoint: 'https://api.igrisinertial.com/v1/actions/refund_charge/run',
          endpoint_readiness: 'needs_target',
          setup: 'Needs target',
          secrets_state: 'Not configured',
          description: 'Refund flow with a human-in-the-loop policy. Currently flagged: a proof mismatch on the last run is awaiting review.',
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
        { id: 'run_01HGJ8K2Z9F', action: 'send_email',          status: 'Succeeded',  routed_via: 'Hosted API · Resend',         policy: 'Idempotent · 3 retries', recovery: 'Not needed',             proof: 'Proof verified',   started_at: 4.minutes.ago,   duration_ms: 312   }, # verified
        { id: 'rdm_01',          action: 'process_payment',     status: 'Succeeded',  routed_via: 'Hosted API · Stripe',         policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof verified',   started_at: 8.minutes.ago,   duration_ms: 441   }, # verified
        { id: 'rdm_02',          action: 'notify_webhook',      status: 'Succeeded',  routed_via: 'Webhook · Slack',             policy: 'Fire-and-forget',        recovery: 'Not needed',             proof: 'Proof unavailable',started_at: 12.minutes.ago,  duration_ms: 87    }, # completed
        { id: 'rdm_03',          action: 'sync_contacts',       status: 'Running',    routed_via: 'Hosted API · HubSpot',        policy: 'Idempotent',             recovery: 'In flight',              proof: 'Pending',          started_at: 15.minutes.ago,  duration_ms: nil   }, # waiting
        { id: 'rdm_04',          action: 'validate_policy',     status: 'Succeeded',  routed_via: 'Runtime · rt_prod_01',        policy: 'Single-flight',          recovery: 'Retried 2x',             proof: 'Proof unavailable',started_at: 22.minutes.ago,  duration_ms: 1_230, executed_target: 'local_runtime', runtime_id: 'rt_prod_01' }, # recovered
        { id: 'rdm_05',          action: 'generate_report',     status: 'Failed',     routed_via: 'Hosted API · S3',             policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof failed',     started_at: 28.minutes.ago,  duration_ms: 5_400 }, # failed
        { id: 'rdm_06',          action: 'archive_document',    status: 'Cancelled',  routed_via: 'Hosted API · S3',             policy: 'Manual approval',        recovery: 'Not needed',             proof: 'Proof unavailable',started_at: 33.minutes.ago,  duration_ms: nil   }, # blocked
        { id: 'run_01HGJ7Q4X1A', action: 'create_invoice',      status: 'Succeeded',  routed_via: 'Webhook · Stripe',            policy: 'Single-flight',          recovery: 'Retried 1x',             proof: 'Proof verified',   started_at: 38.minutes.ago,  duration_ms: 988   }, # verified (proof before recovered)
        { id: 'rdm_07',          action: 'send_email',          status: 'Succeeded',  routed_via: 'Hosted API · Resend',         policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof verified',   started_at: 41.minutes.ago,  duration_ms: 198   }, # verified
        { id: 'rdm_08',          action: 'update_subscription', status: 'Succeeded',  routed_via: 'Webhook · Polar',             policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof unavailable',started_at: 47.minutes.ago,  duration_ms: 356   }, # completed
        { id: 'run_01HGJ3R6T7E', action: 'export_ledger',       status: 'Succeeded',  routed_via: 'Runtime · rt_prod_01',        policy: 'Single-flight',          recovery: 'Not needed',             proof: 'Proof verified',   started_at: 52.minutes.ago,  duration_ms: 1_740, executed_target: 'local_runtime', runtime_id: 'rt_prod_01' }, # verified
        { id: 'rdm_09',          action: 'process_payment',     status: 'Failed',     routed_via: 'Hosted API · Stripe',         policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof failed',     started_at: 54.minutes.ago,  duration_ms: 3_800 }, # failed
        { id: 'rdm_10',          action: 'run_audit',           status: 'Succeeded',  routed_via: 'Runtime · rt_prod_02',        policy: 'Single-flight',          recovery: 'Not needed',             proof: 'Proof verified',   started_at: 58.minutes.ago,  duration_ms: 2_100, executed_target: 'local_runtime', runtime_id: 'rt_prod_02' }, # verified
        { id: 'rdm_11',          action: 'notify_webhook',      status: 'Awaiting approval', routed_via: 'Webhook · Slack',       policy: 'Human-gated',            recovery: 'Not needed',             proof: 'Pending',          started_at: (1.1 * 3600).seconds.ago, duration_ms: nil }, # waiting
        { id: 'rdm_12',          action: 'refund_charge',       status: 'Denied',     routed_via: 'Hosted API · Stripe',         policy: 'Manual approval',        recovery: 'Not needed',             proof: 'Proof unavailable',started_at: (1.4 * 3600).seconds.ago, duration_ms: nil }, # blocked
        { id: 'rdm_13',          action: 'export_ledger',       status: 'Succeeded',  routed_via: 'Runtime · rt_prod_01',        policy: 'Single-flight',          recovery: 'Compensated',            proof: 'Proof unavailable',started_at: (1.8 * 3600).seconds.ago, duration_ms: 2_870, executed_target: 'local_runtime', runtime_id: 'rt_prod_01' }, # recovered
        { id: 'run_01HGJ5W0M3B', action: 'refund_charge',       status: 'Failed',     routed_via: 'Hosted API · Stripe',         policy: 'Manual approval',        recovery: 'Awaiting review',        proof: 'Proof failed',     started_at: 2.hours.ago,     duration_ms: 4_120 }, # failed
        { id: 'rdm_14',          action: 'create_invoice',      status: 'Succeeded',  routed_via: 'Webhook · Stripe',            policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof verified',   started_at: (2.2 * 3600).seconds.ago, duration_ms: 620 }, # verified
        { id: 'rdm_15',          action: 'sync_contacts',       status: 'Succeeded',  routed_via: 'Hosted API · HubSpot',        policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof unavailable',started_at: (2.7 * 3600).seconds.ago, duration_ms: 1_100 }, # completed
        { id: 'rdm_16',          action: 'generate_report',     status: 'Failed',     routed_via: 'Hosted API · S3',             policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof failed',     started_at: (3.2 * 3600).seconds.ago, duration_ms: 8_200 }, # failed
        { id: 'rdm_17',          action: 'archive_document',    status: 'Succeeded',  routed_via: 'Hosted API · S3',             policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof verified',   started_at: (3.8 * 3600).seconds.ago, duration_ms: 390 }, # verified
        { id: 'rdm_18',          action: 'process_payment',     status: 'Blocked',    routed_via: 'Runtime · rt_prod_01',        policy: 'Single-flight',          recovery: 'Not needed',             proof: 'Proof unavailable',started_at: (4.3 * 3600).seconds.ago, duration_ms: nil, runtime_unavailable: true, executed_target: 'local_runtime' }, # blocked
        { id: 'rdm_19',          action: 'send_email',          status: 'Succeeded',  routed_via: 'Hosted API · Resend',         policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof verified',   started_at: (4.9 * 3600).seconds.ago, duration_ms: 211 }, # verified
        { id: 'rdm_20',          action: 'update_subscription', status: 'Succeeded',  routed_via: 'Webhook · Polar',             policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof unavailable',started_at: (5.4 * 3600).seconds.ago, duration_ms: 480 }, # completed
        { id: 'rdm_21',          action: 'run_audit',           status: 'Pending',    routed_via: 'Runtime · rt_prod_02',        policy: 'Single-flight',          recovery: 'Not needed',             proof: 'Pending',          started_at: (5.8 * 3600).seconds.ago, duration_ms: nil }, # waiting
        { id: 'rdm_22',          action: 'validate_policy',     status: 'Succeeded',  routed_via: 'Runtime · rt_prod_01',        policy: 'Single-flight',          recovery: 'Retried 3x',             proof: 'Proof unavailable',started_at: (5.9 * 3600).seconds.ago, duration_ms: 3_410, executed_target: 'local_runtime', runtime_id: 'rt_prod_01' }, # recovered
        { id: 'run_01HGJ4D8L0C', action: 'send_email',          status: 'Succeeded',  routed_via: 'Hosted API · Resend',         policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof verified',   started_at: 6.hours.ago,     duration_ms: 220 }, # verified
        { id: 'rdm_23',          action: 'refund_charge',       status: 'Failed',     routed_via: 'Hosted API · Stripe',         policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof failed',     started_at: 7.hours.ago,     duration_ms: 6_700 }, # failed
        { id: 'rdm_24',          action: 'notify_webhook',      status: 'Succeeded',  routed_via: 'Webhook · Slack',             policy: 'Fire-and-forget',        recovery: 'Not needed',             proof: 'Proof verified',   started_at: 8.hours.ago,     duration_ms: 93 }, # verified
        { id: 'rdm_25',          action: 'export_ledger',       status: 'Succeeded',  routed_via: 'Runtime · rt_prod_01',        policy: 'Single-flight',          recovery: 'Not needed',             proof: 'Proof unavailable',started_at: 9.hours.ago,     duration_ms: 1_980, executed_target: 'local_runtime', runtime_id: 'rt_prod_01' }, # completed
        { id: 'rdm_26',          action: 'create_invoice',      status: 'Succeeded',  routed_via: 'Webhook · Stripe',            policy: 'Single-flight',          recovery: 'Resumed from checkpoint',proof: 'Proof unavailable',started_at: 11.hours.ago,    duration_ms: 4_200 }, # recovered
        { id: 'rdm_27',          action: 'sync_contacts',       status: 'Succeeded',  routed_via: 'Hosted API · HubSpot',        policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof verified',   started_at: 12.hours.ago,    duration_ms: 760 }, # verified
        { id: 'rdm_28',          action: 'process_payment',     status: 'Cancelled',  routed_via: 'Hosted API · Stripe',         policy: 'Manual approval',        recovery: 'Not needed',             proof: 'Proof unavailable',started_at: 13.hours.ago,    duration_ms: nil }, # blocked
        { id: 'rdm_29',          action: 'generate_report',     status: 'Error',      routed_via: 'Hosted API · S3',             policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof failed',     started_at: 14.hours.ago,    duration_ms: 9_100 }, # failed
        { id: 'rdm_30',          action: 'archive_document',    status: 'Succeeded',  routed_via: 'Hosted API · S3',             policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof verified',   started_at: 15.hours.ago,    duration_ms: 340 }, # verified
        { id: 'rdm_31',          action: 'send_email',          status: 'Succeeded',  routed_via: 'Hosted API · Resend',         policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof unavailable',started_at: 16.hours.ago,    duration_ms: 175 }, # completed
        { id: 'rdm_32',          action: 'validate_policy',     status: 'Succeeded',  routed_via: 'Runtime · rt_prod_02',        policy: 'Single-flight',          recovery: 'Not needed',             proof: 'Proof verified',   started_at: 17.hours.ago,    duration_ms: 890, executed_target: 'local_runtime', runtime_id: 'rt_prod_02' }, # verified
        { id: 'rdm_33',          action: 'run_audit',           status: 'Succeeded',  routed_via: 'Runtime · rt_prod_01',        policy: 'Single-flight',          recovery: 'Not needed',             proof: 'Proof verified',   started_at: 19.hours.ago,    duration_ms: 1_560, executed_target: 'local_runtime', runtime_id: 'rt_prod_01' }, # verified
        { id: 'rdm_34',          action: 'refund_charge',       status: 'Failed',     routed_via: 'Hosted API · Stripe',         policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof failed',     started_at: 22.hours.ago,    duration_ms: 4_900 }, # failed
        { id: 'rdm_35',          action: 'create_invoice',      status: 'Succeeded',  routed_via: 'Webhook · Stripe',            policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof verified',   started_at: 1.day.ago,       duration_ms: 530 }, # verified
        { id: 'rdm_36',          action: 'sync_contacts',       status: 'Succeeded',  routed_via: 'Hosted API · HubSpot',        policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof unavailable',started_at: (1.5 * 86400).seconds.ago, duration_ms: 1_340 }, # completed
        { id: 'rdm_37',          action: 'process_payment',     status: 'Succeeded',  routed_via: 'Hosted API · Stripe',         policy: 'Idempotent',             recovery: 'Retried 1x',             proof: 'Proof unavailable',started_at: 2.days.ago,      duration_ms: 2_010 }, # recovered
        { id: 'rdm_38',          action: 'generate_report',     status: 'Failed',     routed_via: 'Hosted API · S3',             policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof failed',     started_at: (2.3 * 86400).seconds.ago, duration_ms: 7_300 }, # failed
        { id: 'rdm_39',          action: 'archive_document',    status: 'Succeeded',  routed_via: 'Hosted API · S3',             policy: 'Idempotent',             recovery: 'Not needed',             proof: 'Proof verified',   started_at: (2.7 * 86400).seconds.ago, duration_ms: 410 }, # verified
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
          { kind: :action, num: '01', name: 'read_file',  detail: '/uploads/policy-v3.pdf · 1.2KB digest', latency: 12, status: :committed, receipt: 'r₀₁', signed_at: '14:07:42.218' },
          { kind: :action, num: '02', name: 'http_call',  detail: 'POST /v3/sync · 200 OK',               latency: 38, status: :committed, receipt: 'r₀₂', signed_at: '14:07:42.481' },
          { kind: :fault,            name: 'host_fault', detail: 'worker_a failed · checkpoint preserved · resumed on worker_b', latency: 31, status: :committed },
          { kind: :action, num: '03', name: 'http_call',  detail: 'retry 2 of 3 succeeded',                latency: 42, status: :committed, receipt: 'r₀₃', signed_at: '14:07:43.014' },
          { kind: :action, num: '04', name: 'db_write',   detail: 'orders_fulfilled · r_8421',                          status: :running },
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
