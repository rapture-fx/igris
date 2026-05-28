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
      [
        {
          id: 'run_01HGJ9N7P4D',
          action: 'send_email',
          status: 'Running',
          routed_via: 'Hosted API · Resend',
          policy: 'Idempotent · 3 retries',
          recovery: 'In flight',
          proof: 'Pending',
          started_at: 6.seconds.ago,
          duration_ms: nil,
        },
        {
          id: 'run_01HGJ8K2Z9F',
          action: 'send_email',
          status: 'Succeeded',
          routed_via: 'Hosted API · Resend',
          policy: 'Idempotent · 3 retries',
          recovery: 'Not needed',
          proof: 'Proof verified',
          started_at: 4.minutes.ago,
          duration_ms: 312,
        },
        {
          id: 'run_01HGJ7Q4X1A',
          action: 'create_invoice',
          status: 'Succeeded',
          routed_via: 'Webhook · Stripe',
          policy: 'Single-flight',
          recovery: 'Retried 1x',
          proof: 'Proof verified',
          started_at: 38.minutes.ago,
          duration_ms: 988,
        },
        {
          id: 'run_01HGJ5W0M3B',
          action: 'refund_charge',
          status: 'Failed',
          routed_via: 'Hosted API · Stripe',
          policy: 'Manual approval',
          recovery: 'Awaiting review',
          proof: 'Proof failed',
          started_at: 2.hours.ago,
          duration_ms: 4_120,
        },
        {
          id: 'run_01HGJ4D8L0C',
          action: 'send_email',
          status: 'Succeeded',
          routed_via: 'Hosted API · Resend',
          policy: 'Idempotent',
          recovery: 'Not needed',
          proof: 'Proof verified',
          started_at: 6.hours.ago,
          duration_ms: 220,
        },
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
