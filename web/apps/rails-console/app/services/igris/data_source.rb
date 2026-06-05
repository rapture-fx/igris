# frozen_string_literal: true

require 'digest'
require 'uri'

#
# Igris::DataSource — the single layer controllers ask for action/run/runtime
# state. Behind it:
#
#   - **Real mode** (default when OVERTURE_API_BASE_URL is set) — calls
#     Igris::OvertureClient. Rails never persists action/run state.
#   - **Fixture mode** (only when Overture is unconfigured) — serves
#     Igris::Fixtures so the UI is still inspectable offline. Views check
#     `mode == :fixtures` and render a visible "Demo data" indicator.
#
# Boundary: this module owns adaption / normalization only. It does not
# evaluate policy, route execution, verify proofs, sign receipts, or persist
# state. All such logic lives in Go Overture.
#
module Igris
  class DataSource
    attr_reader :mode, :error

    def initialize(client: nil)
      @client = client || OvertureClient.new
      @mode   = @client.configured? ? :real : :fixtures
      @error  = nil
    end

    def fixtures?       = @mode == :fixtures
    def real?           = @mode == :real
    def degraded?       = !@error.nil?

    # ── Actions ───────────────────────────────────────────────────────────

    def actions
      if real?
        @client.list_actions.map { |a| normalize_action(a) }
      else
        Fixtures.actions
      end
    rescue OvertureClient::Error => e
      capture(e)
      [] # surface the empty state honestly; view shows the error chip
    end

    def find_action(id_or_name)
      if real?
        raw = @client.find_action_by_name(id_or_name) ||
              (safe_get_action(id_or_name) if uuidish?(id_or_name))
        raw && normalize_action(raw)
      else
        Fixtures.find_action(id_or_name)
      end
    rescue OvertureClient::NotFound
      nil
    rescue OvertureClient::Error => e
      capture(e); nil
    end

    def runs_for_action(action_name, limit: 50)
      return Fixtures.runs.select { |r| r[:action] == action_name } unless real?

      @client.list_tasks(limit: limit).map { |t| normalize_run_summary(t) }
                                       .select { |r| r[:action] == action_name }
    rescue OvertureClient::Error => e
      capture(e); []
    end

    def recent_runs(limit: 5)
      if real?
        @client.list_tasks(limit: limit).map { |t| normalize_run_summary(t) }
      else
        Fixtures.runs.first(limit)
      end
    rescue OvertureClient::Error => e
      capture(e); []
    end

    def all_runs(limit: 100)
      recent_runs(limit: limit)
    end

    def find_run(id)
      if real?
        detail = normalize_run_detail(@client.get_task(id))
        detail && detail.merge(execution_steps: fetch_execution_steps(id))
      else
        Fixtures.run_detail(id)
      end
    rescue OvertureClient::NotFound
      nil
    rescue OvertureClient::Error => e
      capture(e); nil
    end

    # Ordered, redacted per-step WAL evidence. Returns [] (honest empty state)
    # if the task has no checkpoints yet or the endpoint is unavailable.
    def fetch_execution_steps(id)
      normalize_execution_steps(@client.get_task_steps(id))
    rescue OvertureClient::Error => e
      capture(e); []
    end

    # Daily run counts (14d) for the Home sparkline. Real mode would aggregate
    # `/v1/runs` server-side; for now we just return the fixture or [].
    def daily_run_counts
      real? ? [] : Fixtures.daily_run_counts
    rescue OvertureClient::Error => e
      capture(e); []
    end

    # ── Runtimes ──────────────────────────────────────────────────────────

    # Memoized per request — the runtimes list is read by the controller, the
    # lens sidebar, and the onboarding helpers below, so we fetch it once. An
    # empty array is truthy in Ruby, so a genuinely-empty fleet is cached too.
    def runtimes
      @runtimes ||= load_runtimes
    end

    # True when at least one connected runtime is currently healthy. Drives the
    # local-runtime onboarding guidance. In fixture mode this reflects the demo
    # runtimes — the global demo indicator already marks the data as not real,
    # so we never imply a real connection that doesn't exist.
    def healthy_runtime?
      runtimes.any? { |r| r[:status] == 'Healthy' }
    end

    # Whether a local_runtime action should guide the user to connect a runtime
    # before testing: true only for local_runtime targets when no healthy
    # runtime is currently connected. Hosted-API and webhook actions never need
    # a runtime, so they always return false.
    def runtime_required_for?(action)
      return false unless action
      action[:target_type].to_s == 'local_runtime' && !healthy_runtime?
    end

    # Compact fleet status counts for the runtime summary strip.
    def runtime_summary
      rts = runtimes
      {
        total:   rts.size,
        healthy: rts.count { |r| r[:status] == 'Healthy' },
        stale:   rts.count { |r| %w[Stale Degraded].include?(r[:status]) },
        offline: rts.count { |r| r[:status] == 'Offline' },
      }
    end

    # Actions that route through a local runtime — the ones the Runtimes page
    # should surface as "needs a runtime".
    def local_runtime_actions
      actions.select { |a| a[:target_type].to_s == 'local_runtime' }
    end

    # Recent runs that executed through a runtime, newest first. Used by the
    # Runtimes page to connect runtimes back to the Runs they powered.
    def runtime_runs(limit: 5)
      all_runs(limit: 50).select { |r| run_through_runtime?(r) }.first(limit)
    end

    # A run touched a runtime if it bound a runtime_id or routed to the
    # local_runtime target. Works for both normalized real runs and fixtures.
    def run_through_runtime?(run)
      run[:runtime_id].to_s.strip.present? ||
        run[:executed_target].to_s == 'local_runtime' ||
        run[:routed_via].to_s.match?(/\A(Runtime|Local runtime)/)
    end

    # ── Runtime API key ───────────────────────────────────────────────────
    # The key a runtime uses to connect (IGRIS_API_KEY). Issued separately from
    # the console service key. Never fabricated in fixture mode.

    # Metadata for the tenant's runtime key: { 'has_key' => bool, 'prefix' =>,
    # 'created_at' => } or nil. Returns nil in fixture mode (no fabrication) and
    # on error (the page falls back to the generic instructions).
    def runtime_api_key_status
      return nil unless real?
      @client.get_runtime_api_key
    rescue OvertureClient::Error => e
      capture(e); nil
    end

    # Mint a new runtime key. Returns the response hash including the raw
    # 'api_key' shown exactly once. Raises in fixture mode so the controller can
    # show the demo notice instead of a fabricated key.
    def create_runtime_api_key
      raise OvertureClient::Unavailable.new('overture not configured', code: 'unconfigured') unless real?
      @client.create_runtime_api_key
    end

    # ── Agent / app API keys ──────────────────────────────────────────────
    # The keys an agent or app uses to call action endpoints. Read-only metadata
    # (id/name/prefix/timestamps) — never a raw key. Empty in fixture mode (no
    # fabrication) and on error (the view falls back to the explainer).
    def agent_api_keys
      return [] unless real?
      @client.list_api_keys.map { |k| normalize_api_key(k) }
    rescue OvertureClient::Error => e
      capture(e); []
    end

    # Mint a new agent/app key. Returns the response hash including the raw
    # 'api_key' shown exactly once. Raises in fixture mode so the controller can
    # show the demo notice instead of a fabricated key.
    def create_agent_api_key(name)
      raise OvertureClient::Unavailable.new('overture not configured', code: 'unconfigured') unless real?
      @client.create_api_key(name)
    end

    # Revoke an agent/app key by id. Raises in fixture mode.
    def revoke_agent_api_key(id)
      raise OvertureClient::Unavailable.new('overture not configured', code: 'unconfigured') unless real?
      @client.revoke_api_key(id)
    end

    # ── Project identity ──────────────────────────────────────────────────
    # "Project" is the user-facing name for the container that holds this
    # tenant's actions, runs, runtimes, keys, and evidence. The state of record
    # is the Go tenant row (tenants.tenant_name) — Rails never persists it.
    #
    # Normalized shape: { name:, mode:, needs_name: }
    #   - name       — the project name, or nil when unset
    #   - mode       — :real | :fixtures | :degraded
    #   - needs_name — true only in real mode with no name yet (drives the
    #                  first-run "Create your project" prompt on /welcome)
    def project
      @project ||= load_project
    end

    # PATCH the project name through Go. Returns the response hash. Raises in
    # fixture mode (the controller shows the demo notice) and on validation /
    # network errors (the controller surfaces them inline). Busts the memo so a
    # later read in the same request reflects the new name.
    def update_project(name)
      raise OvertureClient::Unavailable.new('overture not configured', code: 'unconfigured') unless real?
      raw = @client.update_project(name)
      @project = nil
      raw
    end

    # ── Writes ────────────────────────────────────────────────────────────

    # Returns the created action hash (normalized). Raises on validation /
    # conflict so the controller can show the message inline.
    def create_action(params)
      raise OvertureClient::Unavailable.new('overture not configured', code: 'unconfigured') unless real?
      normalize_action(@client.create_action(params))
    end

    # Returns the run-submission response hash. Raises typed errors.
    def run_action(name, input: {}, metadata: nil, idempotency_key: nil)
      raise OvertureClient::Unavailable.new('overture not configured', code: 'unconfigured') unless real?
      @client.run_action(name, input: input, metadata: metadata, idempotency_key: idempotency_key)
    end

    # ── Normalization ─────────────────────────────────────────────────────

    private

    def load_runtimes
      if real?
        @client.list_runtimes.map { |r| normalize_runtime(r) }
      else
        Fixtures.runtimes
      end
    rescue OvertureClient::Error => e
      capture(e); []
    end

    # Map a raw agent-key metadata hash → safe view row. Never carries a raw
    # key or hash (the API never returns them); only id/name/prefix/timestamps.
    def normalize_api_key(raw)
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      {
        id:           raw[:id].to_s,
        name:         raw[:name].to_s.presence || 'Agent key',
        prefix:       raw[:prefix].to_s,
        created_at:   parse_time(raw[:created_at]),
        last_used_at: parse_time(raw[:last_used_at]),
      }
    end

    def load_project
      unless real?
        return { name: 'Support Agent', mode: :fixtures, needs_name: false }
      end

      raw  = @client.get_project
      name = (raw.is_a?(Hash) ? (raw['name'] || raw[:name]) : nil).to_s.strip
      { name: name.presence, mode: :real, needs_name: name.empty? }
    rescue OvertureClient::Error => e
      # Degraded: don't block the console or falsely prompt for a name on error.
      capture(e)
      { name: nil, mode: :degraded, needs_name: false }
    end

    def capture(error)
      @error = error
      Rails.logger.warn("[Overture] #{error.class.name.split('::').last}: #{error.message} (status=#{error.status} code=#{error.code})")
    end

    def safe_get_action(id)
      @client.get_action(id)
    rescue OvertureClient::NotFound, OvertureClient::ValidationError
      nil
    end

    def uuidish?(s)
      !!s.to_s.match?(/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i)
    end

    def normalize_action(raw)
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      target_type = raw[:target_type].to_s
      target_url = sanitize_display_url(raw[:target_url])
      {
        id:             raw[:id] || raw[:name],
        name:           raw[:name],
        display_name:   raw[:display_name].presence || raw[:name],
        description:    raw[:description].to_s,
        target_type:    target_type,
        target_label:   target_label_for(target_type, target_url),
        target_url:     target_url,
        method:         raw[:method].to_s.upcase.presence || 'POST',
        policy:         policy_label_for(raw[:policy_preset], raw[:approval_required], raw[:irreversible]),
        policy_preset:  raw[:policy_preset].to_s,
        replay:         (raw[:replay_class].to_s == 'retryable' ? 'On' : 'Off'),
        secrets_state:  raw[:secret_refs].is_a?(Array) && raw[:secret_refs].any? ? 'Configured' : 'Not configured',
        endpoint:       endpoint_url(raw[:name]),
        setup:          setup_status_for(target_type, target_url),
        last_run_at:    nil,
        last_run_status: nil,
        proof:          'No run yet',
        approval_required: !!raw[:approval_required],
        irreversible:   !!raw[:irreversible],
        raw:            raw,
      }
    end

    def normalize_run_summary(raw)
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      proof = proof_state_for(raw[:proof])
      {
        id:           (raw[:task_id] || raw[:id]).to_s,
        action:       extract_action_name(raw),
        status:       status_label_for(raw[:status]),
        routed_via:   routed_via_for(raw[:executed_target], raw[:runtime_id]),
        executed_target: raw[:executed_target].to_s,
        runtime_id:   raw[:runtime_id].to_s,
        policy:       raw.dig(:proof, :policy_preset) || raw[:policy_preset] || 'default',
        recovery:     recovery_label_for(raw[:recovery]),
        proof:        proof[:label],
        started_at:   parse_time(raw[:dispatched_at] || raw[:created_at]),
        duration_ms:  raw[:duration_ms] || compute_duration_ms(raw[:dispatched_at], raw[:completed_at]),
      }
    end

    def normalize_run_detail(raw)
      return nil unless raw
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      summary = normalize_run_summary(raw)
      summary.merge(
        steps: [],
        story: build_story(raw),
        raw_evidence: build_raw_evidence(raw),
        proof_payload: raw[:proof],
        recovery_payload: raw[:recovery],
        executed_target: raw[:executed_target].to_s,
        runtime_id: raw[:runtime_id].to_s,
        failure_reason: raw.dig(:failure, :reason) || raw[:failure_reason].to_s,
        runtime_unavailable: runtime_unavailable?(raw),
        request_summary: safe_request_summary(raw),
        request_digest:  truncate_digest(raw[:input_digest] || raw.dig(:input_summary, :input_digest_sha256) || raw.dig(:request, :digest)),
      )
    end

    # The Run Inspector's "Agent request" section shows a request/prompt summary
    # ONLY when the API hands back an already-safe, server-redacted summary
    # string (`request_summary` / `request.summary`). Igris deliberately never
    # echoes the raw request body — so this is nil for every run the current API
    # returns, and the drawer falls back to the honest "no payload" state. The
    # mapping exists so a future, server-side-redacted summary renders without
    # any further change, and a raw body never can.
    def safe_request_summary(raw)
      (raw[:request_summary] || raw.dig(:request, :summary)).to_s.strip.presence
    end

    def sanitize_display_url(value)
      raw = value.to_s.strip
      return '' if raw.empty?

      uri = URI.parse(raw)
      return sanitize_sensitive_string(raw) unless uri.scheme && uri.host

      safe = +"#{uri.scheme}://#{uri.host}"
      safe << ":#{uri.port}" if uri.port && ![80, 443].include?(uri.port)
      safe << uri.path.to_s
      safe << '?[redacted]' if uri.query.present? || uri.userinfo.present?
      safe
    rescue URI::InvalidURIError
      sanitize_sensitive_string(raw)
    end

    def sanitize_sensitive_string(value)
      raw = value.to_s
      return '' if raw.empty?
      return '[redacted]' if raw.match?(/authorization|bearer|cookie|token|secret|password|api[_-]?key/i)
      return "[redacted:#{Digest::SHA256.hexdigest(raw)[0, 16]}]" if raw.start_with?('/', '~/', '\\\\')

      raw
    end

    # True when a run failed because the runtime it needed was not available.
    # Derived from the failure reason / error code as a BOOLEAN signal only —
    # the underlying free text is never returned or rendered. Also infers the
    # case where a local_runtime route never bound to a runtime and failed.
    def runtime_unavailable?(raw)
      blob = [raw.dig(:failure, :reason), raw[:failure_reason], raw[:error_code],
              raw[:error]].compact.join(' ').downcase
      return true if blob.match?(/runtime[ _-]?(unavailable|offline|not[ _-]?connected|disconnected)|no[ _-]runtime|runtime_unavailable/)

      raw[:status].to_s == 'failed' &&
        raw[:executed_target].to_s == 'local_runtime' &&
        raw[:runtime_id].to_s.strip.empty?
    end

    # Map raw WAL entries → safe per-step rows for Run detail. Surfaces only
    # operation identifiers and digests; never raw inputs/outputs, failure
    # reason text, robotics targets, signatures, or env values.
    def normalize_execution_steps(steps)
      Array(steps).map do |s|
        s = s.with_indifferent_access if s.respond_to?(:with_indifferent_access)
        kind, label = step_type_kind_label(s[:step_type])
        status, tone = wal_status_label(s[:status])
        {
          index:      s[:step_index].to_i,
          label:      label,
          kind:       kind,
          status:     status,
          status_tone: tone,
          digest:     truncate_digest(s[:output_digest]),
          proof:      (s[:signature].to_s.present? ? 'Signed' : '—'),
          runtime_id: s[:runtime_id].to_s,
          at:         parse_time_ms(s[:timestamp_ms]),
        }
      end
    end

    # step_type is either a unit-variant string ("Checkpoint", "tool") or an
    # externally-tagged hash like {"ToolCall" => {"tool_name" => "http_call"}}.
    def step_type_kind_label(step_type)
      case step_type
      when String
        [step_type.underscore, step_type.underscore.tr('_', ' ')]
      when Hash
        variant = step_type.keys.first.to_s
        inner   = step_type[variant] || {}
        inner   = inner.with_indifferent_access if inner.respond_to?(:with_indifferent_access)
        kind    = variant.underscore
        label =
          case variant
          when 'ToolCall'       then inner[:tool_name].to_s.presence || 'tool call'
          when 'Inference'      then inner[:model].to_s.presence || 'inference'
          when 'RoboticsAction' then inner[:action].to_s.presence || 'robotics action' # never the target
          when 'BtNode'         then inner[:node_type].to_s.presence || 'bt node'
          when 'Checkpoint'     then 'checkpoint'
          else variant.underscore.tr('_', ' ')
          end
        [kind, label]
      else
        ['step', 'step']
      end
    end

    # WalStatus is "Intent"/"Executing"/"Committed" or {"Failed" => {reason}}.
    # The failure reason is intentionally dropped — it can carry free text.
    def wal_status_label(status)
      variant = status.is_a?(Hash) ? status.keys.first.to_s : status.to_s
      case variant
      when 'Committed'  then ['Committed', :ok]
      when 'Executing'  then ['Running',   :warn]
      when 'Intent'     then ['Planned',   :muted]
      when 'Failed'     then ['Failed',    :bad]
      when ''           then ['Unknown',   :muted]
      else [variant.tr('_', ' ').capitalize, :muted]
      end
    end

    def truncate_digest(hex)
      h = hex.to_s.strip
      return nil if h.empty?
      h.length > 14 ? "#{h[0, 14]}…" : h
    end

    def parse_time_ms(ms)
      return nil if ms.nil? || ms.to_i.zero?
      Time.at(ms.to_i / 1000.0)
    rescue StandardError
      nil
    end

    # Normalize one runtime summary. The live source is the governance
    # endpoint (GET /v1/execution/governance/runtimes), whose safe shape is
    # { runtime_id, runtime_label, last_seen, capability_summary, trust_state,
    #   …counts }. Older/alternate shapes (last_seen_at, capabilities, status)
    # are still accepted so fixtures and any future endpoint keep working.
    # Only safe identifiers are surfaced — never hostnames, IPs, or env values.
    def normalize_runtime(raw)
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      last_seen = parse_time(raw[:last_seen] || raw[:last_seen_at] || raw[:last_heartbeat_at])
      caps = Array(raw[:capability_summary] || raw[:capabilities] || raw[:supported_tools])
             .map { |c| c.to_s.strip }.reject(&:empty?)
      {
        runtime_id:    raw[:runtime_id] || raw[:id],
        name:          (raw[:runtime_label] || raw[:runtime_id] || raw[:id]).to_s,
        status:        runtime_status_label(raw[:status] || raw[:health], last_seen),
        trust_state:   trust_state_label(raw[:trust_state]),
        last_seen_at:  last_seen,
        capabilities:  caps,
        # The governance endpoint does not return a runtime version; surface it
        # only if a future/alternate source provides one (view shows "—" if nil).
        version:       (raw[:runtime_version] || raw[:version]).to_s.strip.presence,
        # Safe activity counts straight from the governance summary (0 when the
        # source doesn't provide them, e.g. fixtures).
        active_executions: raw[:active_execution_count].to_i,
        recent_executions: raw[:recent_execution_count].to_i,
        os:            raw[:os].to_s,            # safe summary string if present
        host:          nil,                       # intentionally not exposed
      }
    end

    # Human label for the governance trust_state, or nil when absent. Kept
    # distinct from connection status: trust is about boundary/verification
    # history, status is about whether the runtime is currently reporting.
    def trust_state_label(state)
      case state.to_s
      when 'trusted'            then 'Trusted'
      when 'limited_trust'      then 'Limited trust'
      when 'boundary_violation' then 'Boundary violation'
      else state.to_s.tr('_', ' ').capitalize.presence
      end
    end

    # ── Label helpers ────────────────────────────────────────────────────

    def target_label_for(type, url)
      case type
      when 'hosted_api'        then 'Hosted API'
      when 'webhook'           then 'Webhook' + (url.present? ? " · #{display_host(url)}" : '')
      when 'local_runtime'     then 'Local runtime'
      when 'mock_demo'         then 'Mock demo'
      when 'hybrid_fallback'   then 'Hybrid / fallback'
      else type.to_s.titleize
      end
    end

    def display_host(url)
      URI.parse(url.to_s).host
    rescue URI::InvalidURIError
      nil
    end

    def policy_label_for(preset, approval_required, irreversible)
      parts = []
      parts << case preset.to_s
               when 'Safe automation' then 'Safe automation'
               when 'Human-gated'     then 'Human-gated'
               when 'Non-replayable'  then 'Non-replayable'
               when 'Read-only'       then 'Read-only'
               # Legacy / pre-canonical presets, kept readable just in case.
               when 'idempotent'      then 'Safe automation'
               when 'manual_approval' then 'Human-gated'
               when ''                then 'Safe automation'
               else preset.to_s.tr('_', ' ').capitalize
               end
      parts << 'approval required' if approval_required
      parts << 'irreversible'      if irreversible
      parts.join(' · ')
    end

    def setup_status_for(target_type, url)
      return 'Coming soon'  if target_type == 'hybrid_fallback'
      return 'Needs runtime' if target_type == 'local_runtime'
      return 'Needs target' if %w[webhook hosted_api].include?(target_type) && url.to_s.strip.empty?
      'Ready'
    end

    def status_label_for(status)
      case status.to_s
      when 'completed'         then 'Succeeded'
      when 'failed'            then 'Failed'
      when 'canceled'          then 'Canceled'
      when 'approval_required' then 'Awaiting approval'
      when 'dispatched', 'in_flight', 'running' then 'Running'
      when ''                  then 'Unknown'
      else status.to_s.titleize
      end
    end

    def proof_state_for(proof)
      return { label: 'Proof unavailable', tone: :muted } unless proof
      status = proof['status'] || proof[:status]
      verified = proof['verified'] || proof[:verified]
      return { label: 'Proof verified', tone: :ok }     if verified == true || status == 'verified'
      return { label: 'Proof failed',   tone: :bad }    if verified == false || status == 'mismatch'
      return { label: 'Receipt present', tone: :warn }  if status == 'present'
      { label: 'Proof unavailable', tone: :muted }
    end

    def recovery_label_for(recovery)
      return 'Not needed' unless recovery
      retries = recovery['retry_count'] || recovery[:retry_count] || 0
      return "Retried #{retries}x"      if retries.to_i > 0
      state = recovery['state'] || recovery[:state]
      case state.to_s
      when 'awaiting_review' then 'Awaiting review'
      when 'compensated'     then 'Compensated'
      when 'failed'          then 'Recovery failed'
      else 'Not needed'
      end
    end

    def routed_via_for(executed_target, runtime_id)
      case executed_target.to_s
      when 'hosted_api'    then 'Hosted API'
      when 'webhook'       then 'Webhook'
      when 'local_runtime' then runtime_id.present? ? "Runtime · #{runtime_id}" : 'Local runtime'
      when 'mock_demo'     then 'Mock demo'
      when '' then 'Pending dispatch'
      else executed_target.to_s.titleize
      end
    end

    # Connection status from heartbeat freshness, falling back to an explicit
    # status string when one is provided. The governance endpoint returns no
    # status field, so liveness is derived from `last_seen`:
    #   < 2 min  → Healthy   ·   2–30 min → Stale   ·   ≥ 30 min / never → Offline
    # An explicit "offline"/"degraded" is always honoured; we only ever move a
    # runtime toward "more stale", never fabricate Healthy from a stale beat.
    HEALTHY_WITHIN = 2.minutes
    STALE_WITHIN   = 30.minutes

    def runtime_status_label(raw, last_seen)
      explicit = raw.to_s.downcase
      return 'Offline'  if explicit == 'offline'
      return 'Degraded' if explicit == 'degraded'

      if last_seen
        age = Time.now - last_seen
        return 'Healthy' if age < HEALTHY_WITHIN
        return 'Stale'   if age < STALE_WITHIN
        return 'Offline'
      end

      case explicit
      when 'healthy', 'connected', 'online', 'ok', 'active' then 'Healthy'
      when 'stale' then 'Stale'
      when ''      then 'Offline' # registered but never reported a heartbeat
      else raw.to_s.titleize
      end
    end

    def extract_action_name(raw)
      raw.dig(:policy, :action_name) ||
        raw.dig('policy', 'action_name') ||
        raw[:action_name] ||
        raw[:task_type].to_s.sub(/^action\./, '').presence ||
        '—'
    end

    def parse_time(value)
      return nil if value.blank?
      return value if value.is_a?(Time)
      Time.parse(value.to_s)
    rescue ArgumentError, TypeError
      nil
    end

    def compute_duration_ms(start_at, end_at)
      s = parse_time(start_at)
      e = parse_time(end_at)
      return 0 unless s && e
      ((e - s) * 1000).to_i
    end

    def endpoint_url(name)
      base = ENV['OVERTURE_PUBLIC_API_URL'].presence || 'https://api.igrisinertial.com'
      "#{base.chomp('/')}/v1/actions/#{name}/run"
    end

    def build_story(raw)
      story = []
      story << { title: 'Action received', tone: :ok,
                 meta: "POST /v1/actions/#{extract_action_name(raw)}/run · request validated" }

      lifecycle = raw[:lifecycle] || {}
      if lifecycle[:policy_state] == 'denied' || lifecycle['policy_state'] == 'denied'
        story << { title: 'Policy denied', tone: :bad, meta: 'Request did not pass policy' }
        return story
      end
      story << { title: 'Policy evaluated', tone: :ok, meta: 'accepted' }

      target = raw[:executed_target] || raw['executed_target']
      story << { title: 'Routed to target', tone: :ok, meta: routed_via_for(target, raw[:runtime_id]) } if target.present?

      status = raw[:status].to_s
      case status
      when 'completed'
        story << { title: 'Side effect completed', tone: :ok,
                   meta: "duration: #{compute_duration_ms(raw[:dispatched_at], raw[:completed_at])} ms" }
      when 'failed'
        story << { title: 'Side effect failed', tone: :bad,
                   meta: raw[:failure_reason].to_s.presence || 'see failure details' }
      when 'approval_required'
        story << { title: 'Awaiting human approval', tone: :warn,
                   meta: 'Action paused until reviewer decides' }
      when 'dispatched', 'in_flight', 'running'
        story << { title: 'In flight', tone: :warn, meta: 'execution underway' }
      end

      proof = raw[:proof] || raw['proof']
      story << build_proof_step(proof) if proof
      story
    end

    def build_proof_step(proof)
      state = proof_state_for(proof)
      tone = state[:tone]
      meta = if state[:label] == 'Proof verified'
               sig = proof['signature_digest'] || proof[:signature_digest] || 'redacted'
               "co-signed · digest #{sig.to_s.first(20)}…"
             elsif state[:label] == 'Proof failed'
               'signature mismatch · receipt withheld'
             else
               'no verified receipt yet'
             end
      { title: 'Receipt signed', tone: tone, meta: meta }
    end

    def build_raw_evidence(raw)
      receipt = raw[:receipt] || raw['receipt']
      [
        { key: 'task_id',         value: raw[:task_id].to_s.presence || '—' },
        { key: 'executed_target', value: raw[:executed_target].to_s.presence || '—' },
        { key: 'runtime_id',      value: raw[:runtime_id].to_s.presence || '—' },
        { key: 'receipt_hash',    value: (receipt && (receipt['hash'] || receipt[:hash])).to_s.presence || '—' },
        { key: 'receipt_signed',  value: (receipt ? (receipt['signed'] || receipt[:signed]).to_s : '—') },
      ]
    end
  end
end
