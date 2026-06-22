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

    REDACTION_POLICY_VERSION = 'rails-console-input-redaction-v1'
    SAFE_METADATA_KEYS = %w[
      content_redacted content_digest content_digest_sha256 content_bytes content_type
      input_redacted input_digest_sha256 input_bytes input_content_type
      encrypted_input_ref encrypted_input_ref_id encrypted_input_refs purpose key_version
      created_at updated_at expires_at safe_summary sensitive_fields_redacted
      redaction_policy_version safe_path_digest safe_basename safe_host
    ].freeze
    SENSITIVE_KEY_PATTERN = /
      authorization|cookie|set[_-]?cookie|token|secret|password|api[_-]?key|apikey|
      access[_-]?key|refresh[_-]?token|private[_-]?key|credential|body|raw[_-]?body|
      request[_-]?body|response[_-]?body|payload|content|file[_-]?content|
      file[_-]?contents|full[_-]?text|file[_-]?path|absolute[_-]?path|full[_-]?absolute[_-]?path|
      hostname|ip[_-]?address|database[_-]?url|dsn|
      prompt|chain[_-]?of[_-]?thought|hidden[_-]?reasoning|ciphertext
    /ix
    SAFE_HEADER_KEYS = %w[
      content_type content_length etag last_modified cache_control x_request_id x_correlation_id
    ].freeze

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

    # When agent_id is given the backend scopes the window to that registered
    # agent, so the result is the agent's own runs (bounded by limit) rather than
    # a client-side filter over a truncated tenant window. Fixtures mode filters
    # locally on the same agent_id so the demo console behaves the same way.
    def recent_runs(limit: 5, agent_id: nil)
      aid = agent_id.to_s.strip
      if real?
        @client.list_tasks(limit: limit, agent_id: aid.presence).map { |t| normalize_run_summary(t) }
      else
        runs = Fixtures.runs
        runs = runs.select { |r| r[:agent_id].to_s == aid } if aid.present?
        runs.first(limit)
      end
    rescue OvertureClient::Error => e
      capture(e); []
    end

    def all_runs(limit: 100, agent_id: nil)
      recent_runs(limit: limit, agent_id: agent_id)
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

    # ── Agent Evidence Memory ─────────────────────────────────────────────
    # Operator-facing, summary-only memory attached to a run. The API persists
    # and returns ONLY summaries (goal / decision / evidence / outcome) — never
    # prompts, chain-of-thought, tokens, or raw bodies. We surface those
    # summaries as-is and add safe presentation metadata (retention, status).
    # Returns [] (honest empty state) when a run has no memory or the endpoint
    # is unavailable.
    def agent_memory_for_run(run)
      return Fixtures.agent_memory_for_run(run) unless real?
      return [] unless run

      task_id = run[:id].to_s.strip
      return [] if task_id.empty?

      @client.list_agent_memory(task_id: task_id, limit: 20).map { |m| normalize_agent_memory(m) }
    rescue OvertureClient::Error => e
      capture(e); []
    end

    # ── Agent Catalog (adoption layer) ────────────────────────────────────
    # The operator-facing roster of registered agents in the tenant, each joined
    # with its execution metrics. Built from existing aggregate endpoints only —
    # the Agent Registry (identity) plus Execution Intelligence (per-agent run
    # counts, success/eval/proof rates, keyed by registered_agent_id) and a
    # single Evidence Memory read for last-activity. No per-agent fan-out, so the
    # roster costs three aggregate reads regardless of how many agents exist.
    #
    # Metrics reflect the requested window (default last 30 days — the widest the
    # intelligence contract offers); the view labels them as such. Never surfaces
    # agent metadata, prompts, or any free-text the registry may hold.
    def agent_catalog(range: 'last_30d', include_archived: false)
      agents   = agents_registry(include_archived: include_archived)
      metrics  = execution_intelligence(range: range)[:agents].index_by { |b| b[:key].to_s }
      last_map = agent_last_activity_map
      agents.map do |agent|
        m = metrics[agent[:agent_id].to_s]
        agent.merge(
          run_count:        m ? m[:total_runs] : 0,
          success_rate:     m ? m[:success_rate] : 0.0,
          failure_rate:     m ? m[:failure_rate] : 0.0,
          recovery_rate:    m ? m[:recovery_rate] : 0.0,
          eval_run_count:   m ? m[:eval_run_count] : 0,
          eval_pass_rate:   m ? m[:eval_pass_rate] : 0.0,
          proof_coverage:   m ? m[:proof_coverage] : 0.0,
          has_metrics:      !m.nil?,
          last_activity_at: last_map[agent[:agent_id].to_s] || agent[:last_activity_at],
        )
      end
    end

    # One agent's safe registry identity, or nil when unknown. Used by the Agent
    # Detail page (which adds metrics + memory on top).
    def find_agent(id)
      if real?
        normalize_registry_agent(@client.get_agent(id))
      else
        Fixtures.agents.find { |a| a[:agent_id].to_s == id.to_s || a[:name].to_s == id.to_s }
      end
    rescue OvertureClient::NotFound
      nil
    rescue OvertureClient::Error => e
      capture(e); nil
    end

    # Per-agent execution metrics from the intelligence breakdown (keyed by
    # registered_agent_id), or nil when the agent has no runs in the window.
    def agent_metrics(agent_id, range: 'last_30d')
      execution_intelligence(range: range)[:agents].find { |b| b[:key].to_s == agent_id.to_s }
    end

    # Recent Evidence Memory attributed to one agent — summary-only (goal /
    # decision / evidence / outcome), the same safe shape the run-detail surface
    # uses. [] when the agent has no memory or the endpoint is unavailable.
    def agent_memory_for_agent(agent_id, limit: 10)
      return Fixtures.agent_memory_for_agent(agent_id) unless real?
      return [] if agent_id.to_s.strip.empty?

      @client.list_agent_memory(registered_agent_id: agent_id.to_s, limit: limit)
             .map { |m| normalize_agent_memory(m) }
    rescue OvertureClient::Error => e
      capture(e); []
    end

    # Soft-archive an agent. Raises in fixture mode and on error so the
    # controller can surface the outcome.
    def archive_agent(id)
      raise OvertureClient::Unavailable.new('overture not configured', code: 'unconfigured') unless real?
      @client.archive_agent(id)
    end

    # ── Action Pack Catalog (adoption layer) ──────────────────────────────
    # The catalog of built-in Action Packs joined with what this tenant has
    # actually installed. Built from two aggregate reads — the pack list and the
    # action list — with no per-pack fan-out. A pack reads as "installed" when
    # the tenant has registered actions tagged with that pack (target_metadata
    # carries the pack name on pack-installed actions); the contributed action
    # names and earliest install time come from those actions.
    def action_packs
      return Fixtures.action_packs.map { |p| normalize_action_pack(p) } unless real?

      installed = installed_pack_index
      packs = @client.list_action_packs.map { |p| normalize_action_pack(p) }
      seen  = packs.map { |p| p[:name] }.to_set
      # Surface any installed pack that is no longer in the built-in catalog, so
      # the tenant's real state is never hidden by a catalog change.
      installed.each do |name, info|
        next if seen.include?(name)
        packs << normalize_action_pack(name: name, display_name: name, description: '', action_count: info[:actions].size)
      end
      packs.map { |pack| merge_installed_pack(pack, installed[pack[:name]]) }
    rescue OvertureClient::Error => e
      capture(e); []
    end

    def find_action_pack(id)
      action_packs.find { |pack| pack[:name].to_s == id.to_s || pack[:display_name].to_s == id.to_s }
    end

    # ── Adoption Health (adoption layer) ──────────────────────────────────
    # An honest onboarding checklist derived entirely from real backend state:
    # has the tenant registered an agent, installed a pack, executed an action,
    # produced proof, and authored an evaluation. Every step is true only when
    # the corresponding read confirms it — no fabricated completion.
    def adoption_health
      agents = agents_registry
      packs  = action_packs
      runs   = all_runs(limit: 50)
      evals  = execution_evals

      has_agent  = agents.any?
      has_pack   = packs.any? { |p| p[:installed] }
      has_run    = runs.any?
      has_proof  = runs.any? { |r| r[:proof].to_s.match?(/verified|present|receipt/i) }
      has_eval   = evals.any?

      steps = [
        adoption_step(:agent,      'Register an agent', has_agent,
                      'A registered agent lets Igris attribute every run to a known caller.'),
        adoption_step(:pack,       'Install an action pack', has_pack,
                      'Action packs give an agent a safe first set of capabilities to call.'),
        adoption_step(:action,     'Execute a first action', has_run,
                      'Running an action proves the path from agent to target end to end.'),
        adoption_step(:proof,      'Generate proof', has_proof,
                      'A signed receipt makes a run independently verifiable after the fact.'),
        adoption_step(:evaluation, 'Create a first evaluation', has_eval,
                      'Evaluations assert how a run should behave and check it deterministically.'),
      ]
      done = steps.count { |s| s[:done] }
      { steps: steps, done: done, total: steps.size,
        complete: done == steps.size, counts: {
          agents: agents.size,
          packs:  packs.count { |p| p[:installed] },
          runs:   runs.size,
          evals:  evals.size,
        } }
    end

    # ── Execution Intelligence ────────────────────────────────────────────
    # Read-only operational metrics derived from execution truth. Returns a
    # normalized { range:, summary:, agents:, actions: } hash, or a degraded
    # shell (zeros + empty breakdowns) when the endpoint is unavailable so the
    # view always renders an honest empty state rather than crashing.
    VALID_INTELLIGENCE_RANGES = %w[last_1h last_6h last_24h last_7d last_30d].freeze

    def execution_intelligence(range: 'last_30d')
      range = 'last_30d' unless VALID_INTELLIGENCE_RANGES.include?(range.to_s)
      return Fixtures.execution_intelligence(range) unless real?

      raw = @client.get_execution_intelligence(range: range)
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      {
        range:   raw[:range].to_s.presence || range,
        source:  raw[:source].to_s,
        summary: normalize_intelligence_summary(raw[:summary]),
        agents:  Array(raw[:agents]).map { |b| normalize_intelligence_breakdown(b) },
        actions: Array(raw[:actions]).map { |b| normalize_intelligence_breakdown(b) },
      }
    rescue OvertureClient::Error => e
      capture(e)
      { range: range, source: '', summary: normalize_intelligence_summary(nil), agents: [], actions: [] }
    end

    # One action's execution-intelligence breakdown row (run counts and
    # success/failure/recovery/approval/proof/eval rates over the window), or nil
    # when the action has no recorded runs in the window. Reuses the single
    # aggregate execution-intelligence read — no per-run fan-out — so action
    # detail can show reliability without its own query path.
    def action_intelligence(action_name, range: 'last_30d')
      name = action_name.to_s
      return nil if name.empty?

      execution_intelligence(range: range)[:actions].find { |b| b[:key] == name }
    end

    # ── Trust Recommendations ─────────────────────────────────────────────
    # Deterministic, read-only execution-trust attention items computed by Igris
    # from aggregate execution truth (recovery/proof/eval/approval thresholds and
    # stale approved proposals). Not AI advice: no prompts, no model output, no
    # confidence scores. Degrades to an honest unavailable state on backend error.
    TRUST_SEVERITIES = %w[critical warning info].freeze
    TRUST_STATES = %w[active acknowledged snoozed resolved].freeze
    # Operator-facing state filters → which extra states the backend should
    # include. The default focuses on active + acknowledged findings.
    TRUST_STATE_FILTERS = {
      'active'   => { include_resolved: false, include_snoozed: false },
      'snoozed'  => { include_resolved: false, include_snoozed: true },
      'resolved' => { include_resolved: true,  include_snoozed: false },
      'all'      => { include_resolved: true,  include_snoozed: true },
    }.freeze
    TRUST_SNOOZE_DURATIONS = %w[1d 7d 30d].freeze

    def trust_recommendations(range: 'last_30d', state_filter: 'active')
      filter = TRUST_STATE_FILTERS.fetch(state_filter.to_s, TRUST_STATE_FILTERS['active'])
      return Fixtures.trust_recommendations(range, state_filter: state_filter) unless real?

      raw = @client.get_trust_recommendations(range: range, **filter)
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      items = Array(raw[:recommendations]).map { |r| normalize_trust_recommendation(r) }
      { state: items.any? ? :ok : :empty,
        generated_at: parse_time(raw[:generated_at]),
        recommendations: items }
    rescue OvertureClient::Error => e
      capture(e)
      { state: :unavailable, generated_at: nil, recommendations: [] }
    end

    # Sets the operator lifecycle decision for one finding (acknowledge / snooze /
    # resolve / reactivate). Raises typed errors so the controller surfaces them.
    def update_trust_recommendation_state(recommendation_id, status:, reason: nil, snooze_duration: nil)
      raise OvertureClient::Unavailable.new('overture not configured', code: 'unconfigured') unless real?
      @client.update_trust_recommendation_state(recommendation_id, status: status, reason: reason, snooze_duration: snooze_duration)
    end

    # ── Execution Affinity ────────────────────────────────────────────────
    # Agent ↔ action ↔ pack relationship metrics derived from backend aggregate
    # SQL. Rails only normalizes and groups the safe response: identifiers,
    # labels, counts, rates, and observation text. It never asks for raw task
    # records and never renders unsafe execution payloads.
    def execution_affinity(range: 'last_30d', agent_id: nil, action_name: nil, pack: nil)
      range = 'last_30d' unless VALID_INTELLIGENCE_RANGES.include?(range.to_s)
      return normalize_execution_affinity(Fixtures.execution_affinity(range: range, agent_id: agent_id, action_name: action_name, pack: pack)) unless real?

      raw = @client.get_execution_affinity(range: range, agent_id: agent_id, action_name: action_name, pack: pack)
      normalize_execution_affinity(raw, fallback_range: range)
    rescue OvertureClient::Error => e
      capture(e)
      empty_execution_affinity(range)
    end

    def agent_action_affinity(agent_id, range: 'last_30d')
      execution_affinity(range: range, agent_id: agent_id)
    end

    def action_consumer_affinity(action_name, range: 'last_30d')
      execution_affinity(range: range, action_name: action_name)
    end

    def pack_affinity(pack_name, range: 'last_30d')
      execution_affinity(range: range, pack: pack_name)
    end

    # ── Policy Simulation ─────────────────────────────────────────────────
    # Read-only, deterministic preview of how a proposed policy rule would have
    # classified recent execution records. Igris (Go) owns the computation; it
    # mutates nothing, replays nothing, and reads only execution truth. This
    # layer validates/bounds the operator's inputs, forwards them, and
    # normalizes the safe response. It NEVER sends tenant_id (derived server
    # side). Degrades to an honest :unavailable state on backend error so the
    # card renders a calm notice instead of crashing.
    POLICY_SIM_RANGES = %w[24h 7d 30d].freeze
    POLICY_SIM_MODES  = %w[require_approval block].freeze
    POLICY_SIM_STATUSES = %w[
      completed failed canceled approval_required dispatched in_flight running pending
    ].freeze

    def simulate_policy(range:, policy_mode:, criteria: {})
      range = '30d' unless POLICY_SIM_RANGES.include?(range.to_s)
      policy_mode = 'require_approval' unless POLICY_SIM_MODES.include?(policy_mode.to_s)
      payload = build_policy_sim_payload(range, policy_mode, criteria)
      requested = { range: range, policy_mode: policy_mode, criteria: payload.except(:range, :policy_mode) }

      return Fixtures.policy_simulation(payload).merge(requested: requested) unless real?

      raw = @client.simulate_policy(payload)
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      normalize_policy_simulation(raw).merge(requested: requested)
    rescue OvertureClient::Error => e
      capture(e)
      { state: :unavailable, requested: requested, range: range, policy_mode: policy_mode,
        total_runs_considered: 0, would_allow: 0, would_require_approval: 0, would_block: 0,
        affected_run_count: 0, affected_agents: [], affected_actions: [], sample_runs: [], warnings: [] }
    end

    # ── Policy Proposals ──────────────────────────────────────────────────
    # Lifecycle for tenant-owned draft policy rules built on top of Policy
    # Simulation. Igris (Go) is the source of truth: it derives tenant identity
    # server-side, never mutates active policy, and persists only safe metadata,
    # allow-listed criteria, and safe simulation summaries. Rails never persists
    # proposals and never sends tenant_id. Reads degrade to honest empty states;
    # writes raise typed errors so the controller can surface them inline.
    PROPOSAL_STATUS_LABELS = {
      'draft'        => 'Draft',
      'review_ready' => 'Ready for review',
      'approved'     => 'Approved',
      'archived'     => 'Archived',
    }.freeze
    PROPOSAL_MODE_LABELS = {
      'require_approval' => 'Require approval',
      'block'            => 'Block',
    }.freeze

    # Optional action/agent filters keep only proposals whose match criteria
    # target a specific action name or registered agent. The proposal list is a
    # bounded, fully tenant-scoped read, so this client-side narrowing is exact.
    # A proposal matches an action filter when either its exact action-name
    # criterion equals the action OR its action-prefix criterion is a prefix of
    # it; it matches an agent filter on the agent-id criterion. Blank filters
    # leave the list untouched.
    def policy_proposals(action: nil, agent_id: nil)
      raw = real? ? @client.list_policy_proposals : Fixtures.policy_proposals
      proposals = raw.map { |p| normalize_policy_proposal(p) }
      filter_proposals_by_criteria(proposals, action: action, agent_id: agent_id)
    rescue OvertureClient::Error => e
      capture(e); []
    end

    def find_policy_proposal(id)
      if real?
        body = @client.get_policy_proposal(id)
        return nil unless body
        body = body.with_indifferent_access if body.respond_to?(:with_indifferent_access)
        proposal = normalize_policy_proposal(body[:proposal])
        proposal.merge(events: Array(body[:events]).map { |e| normalize_policy_proposal_event(e) })
      else
        raw = Fixtures.find_policy_proposal(id)
        return nil unless raw
        normalize_policy_proposal(raw).merge(
          events: Fixtures.policy_proposal_events(id).map { |e| normalize_policy_proposal_event(e) }
        )
      end
    rescue OvertureClient::NotFound
      nil
    rescue OvertureClient::Error => e
      capture(e); nil
    end

    def create_policy_proposal(payload)
      raise OvertureClient::Unavailable.new('overture not configured', code: 'unconfigured') unless real?
      normalize_policy_proposal(@client.create_policy_proposal(payload))
    end

    def update_policy_proposal(id, payload)
      raise OvertureClient::Unavailable.new('overture not configured', code: 'unconfigured') unless real?
      normalize_policy_proposal(@client.update_policy_proposal(id, payload))
    end

    def archive_policy_proposal(id)
      raise OvertureClient::Unavailable.new('overture not configured', code: 'unconfigured') unless real?
      @client.archive_policy_proposal(id)
    end

    # Re-runs the read-only simulation for a stored proposal over fresh execution
    # truth and returns the normalized proposal (with its refreshed summary).
    def simulate_policy_proposal(id)
      raise OvertureClient::Unavailable.new('overture not configured', code: 'unconfigured') unless real?
      body = @client.simulate_policy_proposal(id)
      body = body.with_indifferent_access if body.respond_to?(:with_indifferent_access)
      normalize_policy_proposal(body[:proposal])
    end

    def approve_policy_proposal(id)
      raise OvertureClient::Unavailable.new('overture not configured', code: 'unconfigured') unless real?
      normalize_policy_proposal(@client.approve_policy_proposal(id))
    end

    # ── Execution Evaluations ─────────────────────────────────────────────
    # Deterministic assertion results over execution truth. The API returns
    # only safe assertion names, pass/fail status, and reasons; never prompts,
    # raw request/response bodies, ciphertext, nonces, or secrets.
    def execution_evaluations_for_run(run)
      return { state: :not_evaluated, runs: [] } unless run
      return Fixtures.execution_evaluations_for_run(run) unless real?

      task_id = run[:id].to_s.strip
      return { state: :not_evaluated, runs: [] } if task_id.empty?

      runs = @client.list_execution_eval_runs(task_id).map { |item| normalize_execution_eval_run(item) }.compact
      { state: runs.any? ? :evaluated : :not_evaluated, runs: runs }
    rescue OvertureClient::Error => e
      capture(e)
      { state: :unavailable, runs: [] }
    end

    # ── Execution Evaluation definitions ──────────────────────────────────
    # Operator-authored deterministic evaluation definitions. The backend is the
    # source of truth and validates every assertion type/value; Rails never
    # persists them. Reads degrade to an honest empty list; writes raise typed
    # errors so the controller can surface them inline.

    # Optional action/agent filters narrow the definition list to those targeting
    # a specific action name or registered agent. The full list is already a
    # bounded, fully tenant-scoped read (no windowing), so filtering the
    # normalized result here is exact — every matching definition is present.
    # Both filters are case-insensitive exact matches on the definition's
    # declared target; unmatched/blank filters leave the list untouched.
    def execution_evals(action: nil, agent_id: nil)
      raw = real? ? @client.list_execution_evals : Fixtures.execution_evals
      evals = raw.map { |e| normalize_execution_eval(e) }
      filter_by_target(evals, action: action, agent_id: agent_id,
                        action_key: :target_action_name, agent_key: :target_agent_id)
    rescue OvertureClient::Error => e
      capture(e); []
    end

    def find_execution_eval(id)
      raw = real? ? @client.get_execution_eval(id) : Fixtures.find_execution_eval(id)
      raw && normalize_execution_eval(raw)
    rescue OvertureClient::NotFound
      nil
    rescue OvertureClient::Error => e
      capture(e); nil
    end

    def create_execution_eval(payload)
      raise OvertureClient::Unavailable.new('overture not configured', code: 'unconfigured') unless real?
      normalize_execution_eval(@client.create_execution_eval(payload))
    end

    def update_execution_eval(id, payload)
      raise OvertureClient::Unavailable.new('overture not configured', code: 'unconfigured') unless real?
      normalize_execution_eval(@client.update_execution_eval(id, payload))
    end

    def archive_execution_eval(id)
      raise OvertureClient::Unavailable.new('overture not configured', code: 'unconfigured') unless real?
      @client.archive_execution_eval(id)
    end

    # Runs one evaluation definition against a single task/run id and returns the
    # normalized eval-run result (same safe shape the run-detail surface uses).
    def run_execution_eval(id, task_id:)
      raise OvertureClient::Unavailable.new('overture not configured', code: 'unconfigured') unless real?
      normalize_execution_eval_run(@client.run_execution_eval(id, task_id: task_id))
    end

    # Recent eval-run history for one definition. Read-only, tenant scoped by
    # Overture, and summary-only: assertion names/statuses/reasons, no raw
    # request bodies or prompts.
    def execution_eval_history(eval_id, limit: 20)
      runs =
        if real?
          @client.list_execution_eval_history(eval_id, limit: limit).map { |item| normalize_execution_eval_run(item) }.compact
        else
          Fixtures.execution_eval_history(eval_id).map { |item| normalize_execution_eval_run(item) }.compact
        end
      build_execution_eval_history(runs)
    rescue OvertureClient::Error => e
      capture(e)
      build_execution_eval_history([], state: :unavailable)
    end

    # Agents available for the optional target-agent selector. Honest empty list
    # when the registry is unavailable so the form falls back to a free-text id.
    def agents_for_select
      return [] unless real?

      @client.list_agents.map do |a|
        a = a.with_indifferent_access if a.respond_to?(:with_indifferent_access)
        { id: a[:agent_id].to_s, name: a[:display_name].to_s.presence || a[:name].to_s }
      end.reject { |a| a[:id].empty? }
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

    # Narrow a list of normalized records to those whose target action/agent
    # match the requested filters. Exact, case-insensitive comparison; blank
    # filters are no-ops. Used by entity-scoped investigation links so an
    # operator landing on "evaluations for this action" sees only the relevant
    # definitions, not the whole list.
    def filter_by_target(records, action:, agent_id:, action_key:, agent_key:)
      act = action.to_s.strip.downcase
      aid = agent_id.to_s.strip.downcase
      records = records.select { |r| r[action_key].to_s.strip.downcase == act } if act.present?
      records = records.select { |r| r[agent_key].to_s.strip.downcase == aid } if aid.present?
      records
    end

    # Narrow proposals by the action/agent encoded in their match criteria. An
    # action filter matches an exact action-name criterion or an action-prefix
    # criterion that the action begins with; an agent filter matches the agent-id
    # criterion. Blank filters are no-ops.
    def filter_proposals_by_criteria(proposals, action:, agent_id:)
      act = action.to_s.strip.downcase
      aid = agent_id.to_s.strip.downcase
      if act.present?
        proposals = proposals.select do |p|
          c = p[:match_criteria] || {}
          name   = c[:match_action_name].to_s.strip.downcase
          prefix = c[:match_action_prefix].to_s.strip.downcase
          (name.present? && name == act) || (prefix.present? && act.start_with?(prefix))
        end
      end
      if aid.present?
        proposals = proposals.select { |p| (p[:match_criteria] || {})[:match_agent_id].to_s.strip.downcase == aid }
      end
      proposals
    end

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

    # The registered-agent roster as safe view rows. Real mode reads the Agent
    # Registry; fixture mode serves the demo roster. Honest empty list on error.
    def agents_registry(include_archived: false)
      if real?
        @client.list_agents(include_archived: include_archived).map { |a| normalize_registry_agent(a) }
      else
        Fixtures.agents
      end
    rescue OvertureClient::Error => e
      capture(e); []
    end

    # Map a raw Agent Registry row → safe view hash. Surfaces only identity,
    # template, version, and timestamps. Metadata is intentionally dropped — it
    # is free-form and could carry values we don't render in this layer.
    def normalize_registry_agent(raw)
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      {
        agent_id:      raw[:agent_id].to_s,
        name:          raw[:name].to_s,
        display_name:  raw[:display_name].to_s.presence || raw[:name].to_s,
        agent_type:    raw[:agent_type].to_s,
        template_name: raw[:template_name].to_s,
        version:       raw[:version].to_s,
        description:   raw[:description].to_s,
        created_at:    parse_time(raw[:created_at]),
        updated_at:    parse_time(raw[:updated_at]),
        archived:      parse_time(raw[:archived_at]).present?,
        archived_at:   parse_time(raw[:archived_at]),
      }
    end

    # agent_id → most-recent activity timestamp, from a single tenant-wide
    # Evidence Memory read. Evidence Memory is written as agents execute, so its
    # newest entry per agent is an honest "last activity" without a per-agent
    # fan-out. Empty in fixture mode (the roster carries its own demo timestamps)
    # and on error.
    def agent_last_activity_map
      return {} unless real?

      @client.list_agent_memory(limit: 100).each_with_object({}) do |raw, acc|
        raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
        id = raw[:registered_agent_id].to_s
        ts = parse_time(raw[:created_at])
        next if id.empty? || ts.nil?
        acc[id] = ts if acc[id].nil? || ts > acc[id]
      end
    rescue OvertureClient::Error => e
      capture(e); {}
    end

    # The pack tag an installed action carries in its target_metadata, or nil.
    # Pack-installed actions are stamped with target_metadata.pack; plain actions
    # are not, so this is how the catalog tells installed-from-a-pack apart.
    def action_pack_tag(metadata)
      return nil unless metadata.respond_to?(:[]) || metadata.is_a?(Hash)
      meta = metadata.respond_to?(:with_indifferent_access) ? metadata.with_indifferent_access : metadata
      meta[:pack].to_s.strip.presence
    end

    # pack_name → { actions: [safe action row], installed_at: earliest created_at }
    # built from the tenant's action list grouped by pack tag. One read, no
    # per-pack queries.
    def installed_pack_index
      actions.each_with_object({}) do |action, acc|
        pack = action[:pack].to_s
        next if pack.empty?

        bucket = (acc[pack] ||= { actions: [], installed_at: nil })
        bucket[:actions] << {
          name:         action[:name].to_s,
          display_name: action[:display_name].to_s,
          policy:       action[:policy].to_s,
          target_label: action[:target_label].to_s,
        }
        ts = action[:created_at]
        bucket[:installed_at] = ts if ts && (bucket[:installed_at].nil? || ts < bucket[:installed_at])
      end
    end

    # Normalize a raw pack summary (real list, fixtures, or a synthesized
    # installed-only entry) → safe catalog row.
    def normalize_action_pack(raw)
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      {
        name:         raw[:name].to_s,
        display_name: raw[:display_name].to_s.presence || raw[:name].to_s,
        description:  raw[:description].to_s,
        action_count: raw[:action_count].to_i,
        # Fixture-mode rich shape (real mode fills these from installed_pack_index).
        installed:         raw.key?(:installed) ? !!raw[:installed] : false,
        installed_actions: Array(raw[:installed_actions]),
        installed_count:   raw[:installed_count].to_i,
        installed_at:      parse_time(raw[:installed_at]),
      }
    end

    # Layer a pack's installed state (from installed_pack_index) onto its catalog
    # row. nil info means the tenant has not installed the pack.
    def merge_installed_pack(pack, info)
      return pack.merge(installed: false, installed_actions: [], installed_count: 0, installed_at: nil) unless info

      actions = info[:actions]
      pack.merge(
        installed:         true,
        installed_actions: actions,
        installed_count:   actions.size,
        installed_at:      info[:installed_at],
      )
    end

    # One adoption-health checklist step from a real boolean signal.
    def adoption_step(key, label, done, hint)
      { key: key, label: label, done: !!done, hint: hint }
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
      display_raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      secrets_configured = action_secret_refs_configured?(display_raw || raw)
      raw = scrub_sensitive_payload(raw)
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      target_type = raw[:target_type].to_s
      target_url = sanitize_display_url((display_raw || raw)[:target_url])
      {
        id:             raw[:id] || raw[:name],
        name:           raw[:name],
        display_name:   raw[:display_name].presence || raw[:name],
        description:    raw[:description].to_s,
        target_type:    target_type,
        target_label:   target_label_for(target_type, target_url),
        target_url:     target_url,
        pack:           action_pack_tag(raw[:target_metadata]),
        created_at:     parse_time(raw[:created_at]),
        method:         raw[:method].to_s.upcase.presence || 'POST',
        policy:         policy_label_for(raw[:policy_preset], raw[:approval_required], raw[:irreversible]),
        policy_preset:  raw[:policy_preset].to_s,
        replay:         (raw[:replay_class].to_s == 'retryable' ? 'On' : 'Off'),
        secrets_state:  secrets_configured ? 'Configured' : 'Not configured',
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

    def action_secret_refs_configured?(raw)
      refs =
        if raw.respond_to?(:[])
          raw[:secret_refs] || raw['secret_refs']
        end

      Array(refs).any? { |ref| ref.to_s.strip.present? }
    end

    def normalize_run_summary(raw)
      raw = scrub_sensitive_payload(raw)
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      proof = proof_state_for(raw[:proof])
      agent = raw[:agent].is_a?(Hash) ? raw[:agent] : {}
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
        # Safe registered-agent attribution from the API `agent` object only —
        # never the run's runtime/runtime_id. Lets the run list be scoped to one
        # agent and lets a row name its caller without a per-run fan-out.
        agent_id:     agent[:agent_id].to_s,
        agent_name:   (agent[:display_name].presence || agent[:name]).to_s,
        started_at:   parse_time(raw[:dispatched_at] || raw[:created_at]),
        duration_ms:  raw[:duration_ms] || compute_duration_ms(raw[:dispatched_at], raw[:completed_at]),
      }
    end

    def normalize_run_detail(raw)
      return nil unless raw
      runtime_unavailable = runtime_unavailable?(raw.with_indifferent_access)
      raw = scrub_sensitive_payload(raw)
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
        failure_reason: safe_failure_text(raw.dig(:failure, :reason) || raw[:failure_reason]),
        runtime_unavailable: runtime_unavailable,
        request_summary: safe_request_summary(raw),
        request_digest:  truncate_digest(raw[:input_digest] || raw.dig(:input_summary, :input_digest_sha256) || raw.dig(:request, :digest)),
        agent: normalize_registered_agent(raw[:agent]),
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
      summary = sanitize_sensitive_string(raw[:request_summary] || raw.dig(:request, :summary)).to_s.strip
      return nil if summary.blank? || summary == '[redacted]'

      summary
    end

    # Safe registered-agent attribution from the API `agent` object only.
    # Never fabricates ids, names, or metadata that were not returned by Overture.
    def normalize_registered_agent(raw)
      return nil unless raw.is_a?(Hash)

      agent = scrub_sensitive_payload(raw).with_indifferent_access
      agent_id = agent[:agent_id].to_s.strip
      name = agent[:name].to_s.strip
      return nil if agent_id.blank? && name.blank?

      {
        agent_id: agent_id.presence,
        name: name.presence,
        display_name: agent[:display_name].to_s.strip.presence || name.presence,
        agent_type: agent[:agent_type].to_s.strip.presence,
        template_name: agent[:template_name].to_s.strip.presence,
      }.compact
    end

    # Map one raw Evidence Memory row → safe view hash. The summaries are
    # already operator-only and server-validated against prompt/CoT/secret
    # leakage; we surface them verbatim (the view HTML-escapes) and only
    # normalize identifiers, timestamps, and the retention/status presentation.
    def normalize_agent_memory(raw)
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      evidence = Array(raw[:evidence_summary]).map { |e| e.to_s.strip }.reject(&:empty?)
      expires  = parse_time(raw[:retention_expires_at])
      {
        memory_id:       raw[:memory_id].to_s,
        task_id:         raw[:task_id].to_s,
        execution_id:    raw[:execution_id].to_s,
        agent_id:        raw[:registered_agent_id].to_s,
        agent_name:      raw[:registered_agent_name].to_s,
        goal_summary:    raw[:goal_summary].to_s.strip,
        decision_summary: raw[:decision_summary].to_s.strip,
        evidence_summary: evidence,
        outcome_summary: raw[:outcome_summary].to_s.strip,
        redaction_status: raw[:redaction_status].to_s.strip.presence || 'redacted',
        retention_expires_at: expires,
        retention_label: retention_label_for(expires),
        created_at:      parse_time(raw[:created_at]),
      }
    end

    # Human label for a memory's retention window. Past expiry reads as expired;
    # absent expiry reads as indefinite. Never invents a date.
    def retention_label_for(expires)
      return 'No expiry set' unless expires

      days = ((expires - Time.now) / 86_400.0).ceil
      return 'Retention expired' if days <= 0
      return 'Expires today'     if days == 1
      "Expires in #{days} days"
    end

    def normalize_intelligence_summary(raw)
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      raw ||= {}
      {
        total_runs:              raw[:total_runs].to_i,
        successful_runs:         raw[:successful_runs].to_i,
        failed_runs:             raw[:failed_runs].to_i,
        approval_required_runs:  raw[:approval_required_runs].to_i,
        human_intervention_runs: raw[:human_intervention_runs].to_i,
        recovery_runs:           raw[:recovery_runs].to_i,
        average_duration_ms:     raw[:average_duration_ms].to_f,
        success_rate:            raw[:success_rate].to_f,
        failure_rate:            raw[:failure_rate].to_f,
        approval_rate:           raw[:approval_rate].to_f,
        human_intervention_rate: raw[:human_intervention_rate].to_f,
        recovery_rate:           raw[:recovery_rate].to_f,
      }
    end

    def normalize_intelligence_breakdown(raw)
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      {
        key:                    raw[:key].to_s,
        name:                   raw[:name].to_s.presence || raw[:key].to_s.presence || '—',
        total_runs:             raw[:total_runs].to_i,
        successful_runs:        raw[:successful_runs].to_i,
        failed_runs:            raw[:failed_runs].to_i,
        approval_required_runs: raw[:approval_required_runs].to_i,
        recovery_runs:          raw[:recovery_runs].to_i,
        eval_run_count:         raw[:eval_run_count].to_i,
        eval_passed_runs:       raw[:eval_passed_runs].to_i,
        proof_covered_runs:     raw[:proof_covered_runs].to_i,
        average_duration_ms:    raw[:average_duration_ms].to_f,
        success_rate:           raw[:success_rate].to_f,
        failure_rate:           raw[:failure_rate].to_f,
        approval_rate:          raw[:approval_rate].to_f,
        recovery_rate:          raw[:recovery_rate].to_f,
        eval_pass_rate:         raw[:eval_pass_rate].to_f,
        proof_coverage:         raw[:proof_coverage].to_f,
      }
    end

    def normalize_execution_affinity(raw, fallback_range: 'last_30d')
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      raw ||= {}
      pack_edges = Array(raw[:pack_edges]).map { |row| normalize_affinity_pack_edge(row) }
      {
        range: raw[:range].to_s.presence || fallback_range,
        source: raw[:source].to_s,
        agent_actions: Array(raw[:agent_actions]).map { |row| normalize_affinity_action(row) },
        action_agents: Array(raw[:action_agents]).map { |row| normalize_affinity_agent(row) },
        pack_edges: pack_edges,
        pack_actions: group_affinity_pack_actions(pack_edges),
        hotspots: Array(raw[:hotspots]).map { |row| normalize_affinity_hotspot(row) },
      }
    end

    def empty_execution_affinity(range)
      {
        range: range, source: '', agent_actions: [], action_agents: [],
        pack_edges: [], pack_actions: [], hotspots: [],
      }
    end

    def normalize_affinity_action(raw)
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      {
        action_name: raw[:action_name].to_s,
        action_display_name: raw[:action_display_name].to_s.presence || raw[:action_name].to_s,
        pack_name: raw[:pack_name].to_s,
        run_count: raw[:run_count].to_i,
        successful_runs: raw[:successful_runs].to_i,
        failed_runs: raw[:failed_runs].to_i,
        approval_required_runs: raw[:approval_required_runs].to_i,
        recovery_runs: raw[:recovery_runs].to_i,
        eval_run_count: raw[:eval_run_count].to_i,
        eval_passed_runs: raw[:eval_passed_runs].to_i,
        proof_covered_runs: raw[:proof_covered_runs].to_i,
        success_rate: raw[:success_rate].to_f,
        failure_rate: raw[:failure_rate].to_f,
        approval_rate: raw[:approval_rate].to_f,
        recovery_rate: raw[:recovery_rate].to_f,
        eval_pass_rate: raw[:eval_pass_rate].to_f,
        proof_coverage: raw[:proof_coverage].to_f,
      }
    end

    def normalize_affinity_agent(raw)
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      normalize_affinity_action(raw).merge(
        agent_id: raw[:agent_id].to_s,
        agent_name: raw[:agent_name].to_s.presence || raw[:agent_id].to_s.presence || 'unattributed',
        agent_type: raw[:agent_type].to_s,
      )
    end

    def normalize_affinity_pack_edge(raw)
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      {
        pack_name: raw[:pack_name].to_s.presence || 'unpacked',
        action_name: raw[:action_name].to_s,
        action_display_name: raw[:action_display_name].to_s.presence || raw[:action_name].to_s,
        agent_id: raw[:agent_id].to_s,
        agent_name: raw[:agent_name].to_s.presence || raw[:agent_id].to_s.presence || 'unattributed',
        run_count: raw[:run_count].to_i,
        success_rate: raw[:success_rate].to_f,
        recovery_rate: raw[:recovery_rate].to_f,
        approval_rate: raw[:approval_rate].to_f,
        eval_pass_rate: raw[:eval_pass_rate].to_f,
        proof_coverage: raw[:proof_coverage].to_f,
      }
    end

    def normalize_affinity_hotspot(raw)
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      {
        scope: raw[:scope].to_s,
        name: raw[:name].to_s,
        observation: raw[:observation].to_s,
        run_count: raw[:run_count].to_i,
      }
    end

    def group_affinity_pack_actions(pack_edges)
      pack_edges.group_by { |edge| edge[:action_name] }.map do |action_name, edges|
        first = edges.first || {}
        {
          pack_name: first[:pack_name].to_s,
          action_name: action_name.to_s,
          action_display_name: first[:action_display_name].to_s.presence || action_name.to_s,
          run_count: edges.sum { |edge| edge[:run_count].to_i },
          agent_count: edges.map { |edge| edge[:agent_id].to_s }.reject(&:empty?).uniq.size,
          agents: edges.sort_by { |edge| [-edge[:run_count].to_i, edge[:agent_name].to_s] },
        }
      end.sort_by { |row| [-row[:run_count].to_i, row[:action_name].to_s] }
    end

    # Build the allow-listed POST body from operator inputs. Only non-blank,
    # bounded criteria are forwarded; tenant_id is never included. Match strings
    # are length-capped here too so an over-long value is rejected before it ever
    # reaches the API.
    def build_policy_sim_payload(range, policy_mode, criteria)
      criteria = (criteria || {}).respond_to?(:with_indifferent_access) ? criteria.with_indifferent_access : (criteria || {})
      payload = { range: range, policy_mode: policy_mode }

      {
        match_action_name:   :match_action_name,
        match_action_prefix: :match_action_prefix,
        match_agent_id:      :match_agent_id,
        match_agent_type:    :match_agent_type,
      }.each do |key, src|
        val = criteria[src].to_s.strip
        payload[key] = val[0, 256] if val.present?
      end

      status = criteria[:match_result_status].to_s.strip
      payload[:match_result_status] = status if POLICY_SIM_STATUSES.include?(status)

      payload[:require_proof_missing]     = true if truthy?(criteria[:require_proof_missing])
      payload[:require_recovery_occurred] = true if truthy?(criteria[:require_recovery_occurred])
      payload[:require_eval_failed]       = true if truthy?(criteria[:require_eval_failed])
      payload
    end

    def truthy?(value)
      %w[1 true on yes].include?(value.to_s.strip.downcase)
    end

    # Normalize the safe simulation response. Counts are coerced to integers and
    # breakdown rows carry only safe identifiers (agent key/name, action name)
    # and task ids — never raw bodies, prompts, or secrets. State is :empty when
    # the window had no runs, else :ok.
    def normalize_policy_simulation(raw)
      raw ||= {}
      total = raw[:total_runs_considered].to_i
      {
        state:                  total.zero? ? :empty : :ok,
        range:                  raw[:range].to_s.presence || '30d',
        policy_mode:            raw[:policy_mode].to_s.presence || 'require_approval',
        total_runs_considered:  total,
        would_allow:            raw[:would_allow].to_i,
        would_require_approval: raw[:would_require_approval].to_i,
        would_block:            raw[:would_block].to_i,
        affected_run_count:     raw[:affected_run_count].to_i,
        affected_agents: Array(raw[:affected_agents]).map do |a|
          a = a.with_indifferent_access if a.respond_to?(:with_indifferent_access)
          { key: a[:key].to_s, name: a[:name].to_s.presence || a[:key].to_s.presence || '—', run_count: a[:run_count].to_i }
        end,
        affected_actions: Array(raw[:affected_actions]).map do |a|
          a = a.with_indifferent_access if a.respond_to?(:with_indifferent_access)
          { name: a[:name].to_s.presence || '—', run_count: a[:run_count].to_i }
        end,
        sample_runs: Array(raw[:sample_runs]).map do |s|
          s = s.with_indifferent_access if s.respond_to?(:with_indifferent_access)
          { task_id: s[:task_id].to_s, status: status_label_for(s[:status]) }
        end,
        warnings: Array(raw[:warnings]).map { |w| w.to_s.strip }.reject(&:blank?),
      }
    end

    # Normalize one trust recommendation to a safe, view-ready hash. Severity and
    # category are bounded to known values; metrics are scalar-only; links carry
    # only a rel + label (the view resolves the rel to a path). Nothing here can
    # carry prompts, raw bodies, or secrets.
    def normalize_trust_recommendation(raw)
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      severity = raw[:severity].to_s
      severity = 'info' unless TRUST_SEVERITIES.include?(severity)
      state = raw[:state].to_s
      state = 'active' unless TRUST_STATES.include?(state)
      {
        id:                 raw[:id].to_s,
        severity:           severity,
        category:           raw[:category].to_s.presence || 'general',
        title:              raw[:title].to_s,
        summary:            raw[:summary].to_s,
        reason:             raw[:reason].to_s,
        recommended_action: raw[:recommended_action].to_s,
        entity_type:        raw[:entity_type].to_s,
        entity_id:          raw[:entity_id].to_s,
        entity_name:        raw[:entity_name].to_s,
        metrics:            normalize_trust_metrics(raw[:metrics]),
        links:              normalize_trust_links(raw[:links]),
        state:              state,
        state_reason:       raw[:state_reason].to_s,
        snoozed_until:      parse_time(raw[:snoozed_until]),
        acknowledged_at:    parse_time(raw[:acknowledged_at]),
        resolved_at:        parse_time(raw[:resolved_at]),
      }
    end

    TRUST_STATE_LABELS = {
      'active' => 'Active', 'acknowledged' => 'Acknowledged',
      'snoozed' => 'Snoozed', 'resolved' => 'Resolved'
    }.freeze

    def normalize_trust_metrics(raw)
      return {} unless raw.respond_to?(:each)
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      out = {}
      raw.each do |key, value|
        next unless value.is_a?(Numeric) || value.is_a?(String) || [true, false].include?(value)
        out[key.to_s] = value
      end
      out
    end

    def normalize_trust_links(raw)
      Array(raw).filter_map do |link|
        link = link.with_indifferent_access if link.respond_to?(:with_indifferent_access)
        rel = link[:rel].to_s
        next if rel.empty?
        { rel: rel, label: link[:label].to_s }
      end
    end

    # Normalize a policy proposal to a safe, view-ready hash. Only allow-listed
    # metadata, criteria, and the safe simulation summary are surfaced — never
    # raw bodies, prompts, secrets, or the tenant id.
    def normalize_policy_proposal(raw)
      raw ||= {}
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      status = raw[:status].to_s.presence || 'draft'
      mode   = raw[:policy_mode].to_s
      sim    = raw[:latest_simulation_json]
      {
        id:                raw[:proposal_id].to_s,
        name:              raw[:name].to_s,
        description:       raw[:description].to_s,
        status:            status,
        status_label:      PROPOSAL_STATUS_LABELS[status] || status.tr('_', ' '),
        policy_mode:       mode,
        policy_mode_label: PROPOSAL_MODE_LABELS[mode] || mode.tr('_', ' '),
        editable:          status == 'draft',
        can_mark_ready:    status == 'draft',
        can_unmark_ready:  status == 'review_ready',
        can_approve:       status == 'review_ready',
        match_criteria:    normalize_proposal_criteria(raw[:match_criteria_json]),
        last_simulation:   normalize_proposal_simulation(sim),
        created_at:        parse_time(raw[:created_at]),
        updated_at:        parse_time(raw[:updated_at]),
        events:            [],
      }
    end

    def normalize_proposal_criteria(raw)
      raw ||= {}
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      {
        range:                     raw[:range].to_s.presence || '30d',
        match_action_name:         raw[:match_action_name].to_s,
        match_action_prefix:       raw[:match_action_prefix].to_s,
        match_agent_id:            raw[:match_agent_id].to_s,
        match_agent_type:          raw[:match_agent_type].to_s,
        match_result_status:       raw[:match_result_status].to_s,
        require_proof_missing:     !!raw[:require_proof_missing],
        require_recovery_occurred: !!raw[:require_recovery_occurred],
        require_eval_failed:       !!raw[:require_eval_failed],
      }
    end

    # The stored simulation summary shares the safe Policy Simulation shape, plus
    # a simulated_at timestamp. nil when the proposal has never been simulated.
    def normalize_proposal_simulation(raw)
      return nil if raw.blank?
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      normalize_policy_simulation(raw).merge(simulated_at: parse_time(raw[:simulated_at]))
    end

    def normalize_policy_proposal_event(raw)
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      {
        type:       raw[:event_type].to_s,
        summary:    raw[:safe_summary].to_s,
        created_at: parse_time(raw[:created_at]),
      }
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
      return redacted_string_digest(raw, 'private_path') if private_path_string?(raw)

      uri = URI.parse(raw)
      if uri.scheme && uri.host
        return redacted_string_digest(raw, 'url') if uri.userinfo.present? || uri.query.present? || !%w[http https].include?(uri.scheme)

        return safe_url_string(uri, raw)
      end

      raw
    rescue URI::InvalidURIError
      raw
    end

    def scrub_sensitive_payload(value, parent_key = nil)
      case value
      when Hash
        value.each_with_object({}) do |(key, child), out|
          normalized = normalize_sensitive_key(key)
          out[key] =
            if SAFE_METADATA_KEYS.include?(normalized)
              scrub_sensitive_payload(child, normalized)
            elsif normalized == 'headers'
              scrub_headers(child)
            elsif normalized == 'url' || normalized == 'target_url'
              sanitize_url_or_envelope(child)
            elsif sensitive_key?(normalized)
              redacted_input_envelope(child, normalized)
            elsif normalized == 'path' && private_path_string?(child.to_s)
              redacted_path_envelope(child.to_s)
            else
              scrub_sensitive_payload(child, normalized)
            end
        end
      when Array
        value.map { |child| scrub_sensitive_payload(child, parent_key) }
      when String
        if sensitive_key?(parent_key)
          redacted_input_envelope(value, parent_key)
        elsif private_path_string?(value)
          redacted_path_envelope(value)
        else
          sanitize_sensitive_string(value)
        end
      else
        value
      end
    end

    def scrub_headers(value)
      return redacted_input_envelope(value, 'headers') unless value.is_a?(Hash)

      redacted = []
      safe = {
        'input_redacted' => true,
        'sensitive_fields_redacted' => redacted,
        'redaction_policy_version' => REDACTION_POLICY_VERSION,
      }
      value.each do |key, child|
        normalized = normalize_sensitive_key(key)
        if SAFE_HEADER_KEYS.include?(normalized)
          safe[key] = scrub_sensitive_payload(child, normalized)
        else
          safe[key] = redacted_input_envelope(child, sensitive_key?(normalized) ? 'sensitive_header' : 'non_allowlisted_header')
          redacted << key.to_s
        end
      end
      safe
    end

    def sanitize_url_or_envelope(value)
      raw = value.to_s.strip
      return '' if raw.empty?

      uri = URI.parse(raw)
      return sanitize_sensitive_string(raw) unless uri.scheme && uri.host

      safe = safe_url_string(uri, raw)
      return safe unless uri.query.present? || uri.userinfo.present?

      redacted_input_envelope(raw, 'url_query_or_credentials').merge(
        'safe_url' => safe.delete_suffix('?[redacted]'),
        'safe_host' => uri.host,
      )
    rescue URI::InvalidURIError
      sanitize_sensitive_string(raw)
    end

    def safe_url_string(uri, _raw)
      safe = +"#{uri.scheme}://#{uri.host}"
      safe << ":#{uri.port}" if uri.port && ![80, 443].include?(uri.port)
      safe << uri.path.to_s
      safe << '?[redacted]' if uri.query.present? || uri.userinfo.present?
      safe
    end

    def safe_failure_text(value)
      text = sanitize_sensitive_string(value).to_s
      text == '[redacted]' ? 'failure details redacted' : text
    end

    def redacted_input_envelope(value, reason)
      raw = value.is_a?(String) ? value : value.to_json
      {
        'input_redacted' => true,
        'safe_summary' => "#{reason} redacted",
        'input_digest_sha256' => Digest::SHA256.hexdigest(raw),
        'input_bytes' => raw.bytesize,
        'sensitive_fields_redacted' => [reason.to_s],
        'redaction_policy_version' => REDACTION_POLICY_VERSION,
      }
    end

    def redacted_path_envelope(path)
      basename = File.basename(path.to_s)
      basename = '[redacted]' if sanitize_sensitive_string(basename) == '[redacted]'
      redacted_input_envelope(path, 'private_path').merge(
        'safe_path_digest' => Digest::SHA256.hexdigest(path.to_s),
        'safe_basename' => basename,
      )
    end

    def redacted_string_digest(value, reason)
      "[redacted:#{reason}:#{Digest::SHA256.hexdigest(value.to_s)[0, 16]}]"
    end

    def normalize_sensitive_key(key)
      key.to_s.strip.downcase.tr('-', '_')
    end

    def sensitive_key?(key)
      normalize_sensitive_key(key).match?(SENSITIVE_KEY_PATTERN)
    end

    def private_path_string?(value)
      raw = value.to_s.strip
      raw.start_with?('/', '~/', '\\\\') || raw.match?(/[A-Za-z]:[\\\/]/)
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
      status = runtime_status_label(raw[:status] || raw[:health], last_seen)
      status = 'Degraded' if raw.key?(:routable) && raw[:routable] == false
      {
        runtime_id:    raw[:runtime_id] || raw[:id],
        name:          (raw[:runtime_label] || raw[:runtime_id] || raw[:id]).to_s,
        status:        status,
        routable:      raw.key?(:routable) ? !!raw[:routable] : nil,
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
                   meta: safe_failure_text(raw[:failure_reason]).presence || 'see failure details' }
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
      title = state[:label] == 'Proof verified' ? 'Receipt signed' : 'Receipt status'
      { title: title, tone: tone, meta: meta }
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

    def normalize_execution_eval_run(raw)
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      results = Array(raw[:results_json] || raw[:results]).map do |result|
        r = result.respond_to?(:with_indifferent_access) ? result.with_indifferent_access : result
        {
          name:   r[:name].to_s,
          status: normalize_eval_status(r[:status]),
          reason: r[:reason].to_s,
        }
      end
      {
        eval_run_id:  raw[:eval_run_id].to_s,
        eval_id:      raw[:eval_id].to_s,
        task_id:      raw[:task_id].to_s,
        execution_id: raw[:execution_id].to_s,
        eval_name:    raw[:eval_name].to_s.presence || 'Execution evaluation',
        status:       normalize_eval_status(raw[:status]),
        passed_count: raw[:passed_count].to_i,
        failed_count: raw[:failed_count].to_i,
        results:      results,
        created_at:   parse_time(raw[:created_at]),
      }
    end

    def normalize_eval_status(status)
      case status.to_s.downcase
      when 'passed' then 'Passed'
      when 'failed' then 'Failed'
      else 'Unavailable'
      end
    end

    # Map one raw evaluation definition → safe view hash. Definitions are
    # operator-authored and the backend already rejects prompts/secrets via its
    # own allow-list; we surface the values verbatim (ERB escapes on render) and
    # only normalize identifiers, the assertion list, and timestamps.
    def normalize_execution_eval(raw)
      return nil unless raw
      raw = raw.with_indifferent_access if raw.respond_to?(:with_indifferent_access)
      assertions = Array(raw[:assertions_json] || raw[:assertions]).map do |a|
        a = a.with_indifferent_access if a.respond_to?(:with_indifferent_access)
        {
          name:        a[:name].to_s,
          type:        a[:type].to_s,
          value:       a[:value].to_s,
          action_name: a[:action_name].to_s,
          agent_id:    a[:agent_id].to_s,
        }
      end
      {
        id:                 raw[:eval_id].to_s,
        name:               raw[:name].to_s,
        description:        raw[:description].to_s,
        target_action_name: raw[:target_action_name].to_s,
        target_agent_id:    raw[:target_agent_id].to_s,
        enabled:            raw.key?(:enabled) ? !!raw[:enabled] : true,
        archived:           parse_time(raw[:archived_at]).present?,
        assertions:         assertions,
        assertion_count:    assertions.size,
        created_at:         parse_time(raw[:created_at]),
        updated_at:         parse_time(raw[:updated_at]),
      }
    end

    def build_execution_eval_history(runs, state: nil)
      passed = runs.count { |run| run[:status] == 'Passed' }
      failed = runs.count { |run| run[:status] == 'Failed' }
      total = runs.size
      reasons = runs.flat_map do |run|
        next [] unless run[:status] == 'Failed'

        run[:results].select { |result| result[:status] == 'Failed' }
                     .map { |result| result[:reason].to_s.strip }
      end.reject(&:blank?)

      {
        state: state || (runs.any? ? :evaluated : :empty),
        runs: runs,
        total: total,
        passed: passed,
        failed: failed,
        pass_rate: total.positive? ? passed.to_f / total : 0.0,
        failure_reasons: reasons.tally.sort_by { |reason, count| [-count, reason] }.first(5)
                              .map { |reason, count| { reason: reason, count: count } },
      }
    end
  end
end
