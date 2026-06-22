# frozen_string_literal: true

require 'faraday'
require 'faraday/net_http'
require 'json'
require 'uri'

#
# Igris::OvertureClient — the **only** way Rails talks to Go Overture.
#
# Boundary: Rails owns presentation. Overture owns action registry, policy,
# routing, recovery, proof verification, receipts, and task/run state. This
# client is read/write but state-of-record always stays in Overture.
#
# Auth: `OVERTURE_API_KEY` is sent as `Authorization: Bearer <token>`.
# Never log the raw header. Errors include status + machine code + message
# but **never** echo back the request body or auth header.
#
module Igris
  class OvertureClient
    # ── Errors ────────────────────────────────────────────────────────────
    class Error < StandardError
      attr_reader :status, :code
      def initialize(message, status: nil, code: nil)
        super(message)
        @status = status
        @code = code
      end
    end

    # Network-level failures (DNS, TCP, timeout, TLS) or missing config.
    class Unavailable < Error; end
    # Auth failures from Overture (401).
    class Unauthenticated < Error; end
    # 403 (capability/policy denied).
    class PolicyDenied < Error; end
    # 404.
    class NotFound < Error; end
    # 409 (conflict, e.g. action_name_conflict, target_not_configured).
    class Conflict < Error; end
    # 400 / 422 (invalid body, invalid_action_name, invalid_action_definition).
    class ValidationError < Error; end
    # 503 (runtime_unavailable, dispatch_failed, etc).
    class ServiceUnavailable < Error; end
    # 5xx everything else.
    class ServerError < Error; end

    # ── Construction ──────────────────────────────────────────────────────
    def initialize(base_url: ENV['OVERTURE_API_BASE_URL'], api_key: ENV['OVERTURE_API_KEY'],
                   session_cookie: nil, logger: Rails.logger, timeout: 6)
      @base_url = base_url.to_s.strip.presence
      @api_key = api_key.to_s.strip.presence unless session_cookie.present?
      @session_cookie = session_cookie.to_s.strip.presence
      @logger = logger
      @timeout = timeout
    end

    def configured?
      @base_url.present?
    end

    # ── Actions ───────────────────────────────────────────────────────────

    # GET /v1/actions → { "actions": [actionDefinition...] }
    def list_actions
      body = request(:get, '/v1/actions')
      Array(body && body['actions'])
    end

    # POST /v1/actions → actionDefinition (201)
    def create_action(payload)
      request(:post, '/v1/actions', body: payload)
    end

    # GET /v1/actions/:id → actionDefinition
    def get_action(id)
      request(:get, "/v1/actions/#{escape(id)}")
    end

    # GET /v1/actions/:name → same handler accepts UUID OR name; the Go side's
    # `handleActionGet` keys on id only, so name-lookup goes via list. We do
    # a single GET first and fall back to scanning the list.
    def find_action_by_name(name)
      direct = safe { get_action(name) }
      return direct if direct && direct['name'] == name
      list_actions.find { |a| a['name'] == name }
    end

    # POST /v1/actions/:name/run → run response
    def run_action(name, input: {}, metadata: nil, idempotency_key: nil, deadline_at: nil)
      body = { input: input || {} }
      body[:metadata]        = metadata        if metadata.present?
      body[:idempotency_key] = idempotency_key if idempotency_key.present?
      body[:deadline_at]     = deadline_at     if deadline_at.present?
      request(:post, "/v1/actions/#{escape(name)}/run", body: body)
    end

    # ── Tasks / Runs ─────────────────────────────────────────────────────

    # GET /v1/tasks/:id → full task response (lifecycle, recovery, proof, …)
    def get_task(id)
      request(:get, "/v1/tasks/#{escape(id)}")
    end

    # GET /v1/tasks/:id/steps → { steps: [WalEntry...], total }
    # WAL entries are already digest-only (no raw inputs/outputs) and
    # tenant-scoped server-side. Ordered by step_index ascending.
    def get_task_steps(id)
      body = request(:get, "/v1/tasks/#{escape(id)}/steps")
      Array(body && body['steps'])
    end

    # GET /v1/tasks → { items: [...], next_cursor: ... }
    def list_tasks(limit: 50)
      body = request(:get, '/v1/tasks', query: { limit: limit })
      Array(body && (body['items'] || body['tasks']))
    end

    # GET /v1/execution/runs/:id → execution detail (alternative shape)
    def get_execution_run(id)
      request(:get, "/v1/execution/runs/#{escape(id)}")
    end

    # ── Runtimes ─────────────────────────────────────────────────────────

    # GET /v1/execution/governance/runtimes → runtime ops summaries
    def list_runtimes
      body = request(:get, '/v1/execution/governance/runtimes')
      Array(body.is_a?(Hash) ? (body['items'] || body['runtimes']) : body)
    end

    # ── Execution Intelligence ────────────────────────────────────────────
    # Read-only operational metrics derived from execution truth (task records,
    # policy decisions, recovery events). Never reads prompts or model output.

    # GET /v1/execution/intelligence?range=… →
    #   { range, source, summary{…}, agents[…], actions[…] }
    def get_execution_intelligence(range: nil)
      query = range.present? ? { range: range } : nil
      request(:get, '/v1/execution/intelligence', query: query)
    end

    # GET /v1/execution/trust-recommendations?range=&limit= →
    #   { range, generated_at, recommendations: [{ id, severity, category, title,
    #     summary, reason, recommended_action, entity_type, entity_id,
    #     entity_name, metrics, links }] }
    # Deterministic, read-only attention items derived from execution truth. No
    # prompts or model output; tenant identity is derived server-side.
    def get_trust_recommendations(range: nil, limit: nil, include_resolved: false, include_snoozed: false)
      query = {}
      query[:range] = range if range.present?
      query[:limit] = limit if limit.present?
      query[:include_resolved] = true if include_resolved
      query[:include_snoozed] = true if include_snoozed
      request(:get, '/v1/execution/trust-recommendations', query: query.presence)
    end

    # PATCH /v1/execution/trust-recommendations/:id/state → { state }
    # Sets the operator lifecycle decision for a finding. Tenant identity is
    # derived server-side; never send tenant_id.
    def update_trust_recommendation_state(id, status:, reason: nil, snooze_duration: nil)
      body = { status: status }
      body[:reason] = reason if reason.present?
      body[:snooze_duration] = snooze_duration if snooze_duration.present?
      result = request(:patch, "/v1/execution/trust-recommendations/#{escape(id)}/state", body: body)
      result && result['state']
    end

    # GET /v1/execution/trust-recommendations/states → { states: [...], total }
    def list_trust_recommendation_states
      body = request(:get, '/v1/execution/trust-recommendations/states')
      Array(body && body['states'])
    end

    # GET /v1/execution/affinity?range=&agent_id=&action_name=&pack= →
    #   { agent_actions[…], action_agents[…], pack_edges[…], hotspots[…] }
    # Read-only aggregates only; Overture never returns raw execution payloads.
    def get_execution_affinity(range: nil, agent_id: nil, action_name: nil, pack: nil)
      query = {}
      query[:range] = range if range.present?
      query[:agent_id] = agent_id if agent_id.present?
      query[:action_name] = action_name if action_name.present?
      query[:pack] = pack if pack.present?
      request(:get, '/v1/execution/affinity', query: query.presence)
    end

    # GET /v1/execution-evals/runs/:run_id →
    #   { eval_runs: [{ eval_name, status, passed_count, failed_count, results_json }] }
    # The Rails console asks by task/run id on the run detail page. Overture
    # returns only safe assertion names, statuses, and reasons.
    def list_execution_eval_runs(run_id)
      body = request(:get, "/v1/execution-evals/runs/#{escape(run_id)}")
      Array(body && (body['eval_runs'] || body['runs']))
    end

    # GET /v1/execution-evals/:id/runs →
    #   { eval_runs: [{ task_id, status, passed_count, failed_count, results_json, created_at }] }
    # Tenant-scoped recent history for one evaluation definition.
    def list_execution_eval_history(eval_id, limit: 20)
      body = request(:get, "/v1/execution-evals/#{escape(eval_id)}/runs", query: { limit: limit })
      Array(body && (body['eval_runs'] || body['runs']))
    end

    # ── Policy Simulation ─────────────────────────────────────────────────
    # POST /v1/policy/simulate → read-only, deterministic preview of how a
    # proposed policy rule would have classified recent execution records.
    # The backend mutates nothing, replays nothing, and reads only execution
    # truth (no prompts or model output). Tenant identity is derived server-side
    # and must never be sent in the body.
    #
    # → { range, policy_mode, total_runs_considered, would_allow,
    #     would_require_approval, would_block, affected_run_count,
    #     affected_agents[], affected_actions[], sample_runs[], warnings[] }
    def simulate_policy(payload)
      request(:post, '/v1/policy/simulate', body: payload)
    end

    # ── Policy Proposals ──────────────────────────────────────────────────
    # Lifecycle for tenant-owned draft policy rules, built on top of the
    # read-only policy simulation surface. Approval is governance metadata only —
    # the backend never mutates active policy, replays runs, or dispatches tasks,
    # and persists only safe metadata, allow-listed criteria, and safe simulation
    # summaries. Tenant identity is derived server-side; tenant_id is never sent.

    # GET /v1/policy/proposals → { proposals: [Proposal...], total }
    def list_policy_proposals
      body = request(:get, '/v1/policy/proposals')
      Array(body && body['proposals'])
    end

    # GET /v1/policy/proposals/:id → { proposal: Proposal, events: [Event...] }
    def get_policy_proposal(id)
      request(:get, "/v1/policy/proposals/#{escape(id)}")
    end

    # POST /v1/policy/proposals → { proposal: Proposal } (201)
    def create_policy_proposal(payload)
      body = request(:post, '/v1/policy/proposals', body: payload)
      body && body['proposal']
    end

    # PATCH /v1/policy/proposals/:id → { proposal: Proposal }
    def update_policy_proposal(id, payload)
      body = request(:patch, "/v1/policy/proposals/#{escape(id)}", body: payload)
      body && body['proposal']
    end

    # DELETE /v1/policy/proposals/:id → { ok: true } (soft archive)
    def archive_policy_proposal(id)
      request(:delete, "/v1/policy/proposals/#{escape(id)}")
    end

    # POST /v1/policy/proposals/:id/simulate → { proposal: Proposal, simulation: {...} }
    # Re-runs the read-only simulation over fresh execution truth (no body).
    def simulate_policy_proposal(id)
      request(:post, "/v1/policy/proposals/#{escape(id)}/simulate")
    end

    # POST /v1/policy/proposals/:id/approve → { proposal: Proposal }
    def approve_policy_proposal(id)
      body = request(:post, "/v1/policy/proposals/#{escape(id)}/approve")
      body && body['proposal']
    end

    # ── Execution Evaluation definitions ──────────────────────────────────
    # CRUD for operator-authored deterministic execution-evaluation definitions.
    # The backend is the source of truth and validates every assertion against an
    # allow-list of types; tenant identity is derived server-side and must never
    # be sent in the body.

    # GET /v1/execution-evals → { evals: [Eval...], total }
    def list_execution_evals
      body = request(:get, '/v1/execution-evals')
      Array(body && body['evals'])
    end

    # GET /v1/execution-evals/:id → { eval: Eval }
    def get_execution_eval(id)
      body = request(:get, "/v1/execution-evals/#{escape(id)}")
      body && body['eval']
    end

    # POST /v1/execution-evals → { eval: Eval } (201)
    def create_execution_eval(payload)
      body = request(:post, '/v1/execution-evals', body: payload)
      body && body['eval']
    end

    # PATCH /v1/execution-evals/:id → { eval: Eval }
    def update_execution_eval(id, payload)
      body = request(:patch, "/v1/execution-evals/#{escape(id)}", body: payload)
      body && body['eval']
    end

    # DELETE /v1/execution-evals/:id → { ok: true } (soft archive)
    def archive_execution_eval(id)
      request(:delete, "/v1/execution-evals/#{escape(id)}")
    end

    # POST /v1/execution-evals/:id/run → { eval_run: Run } (201)
    def run_execution_eval(id, task_id:)
      body = request(:post, "/v1/execution-evals/#{escape(id)}/run", body: { task_id: task_id })
      body && body['eval_run']
    end

    # ── Agent Evidence Memory ─────────────────────────────────────────────
    # Summary-only operator memory for agent runs. The API stores and returns
    # ONLY operator-facing summaries (goal / decision / evidence / outcome) —
    # never prompts, chain-of-thought, tokens, or raw bodies.

    # GET /v1/agent-memory?task_id=&execution_id=&registered_agent_id=&
    #   registered_agent_name=&limit= → { memory: [Memory…], total }
    def list_agent_memory(task_id: nil, execution_id: nil, registered_agent_id: nil,
                          registered_agent_name: nil, limit: 50)
      query = { limit: limit }
      query[:task_id] = task_id                             if task_id.present?
      query[:execution_id] = execution_id                   if execution_id.present?
      query[:registered_agent_id] = registered_agent_id     if registered_agent_id.present?
      query[:registered_agent_name] = registered_agent_name if registered_agent_name.present?
      body = request(:get, '/v1/agent-memory', query: query)
      Array(body && body['memory'])
    end

    # ── Agent Registry ────────────────────────────────────────────────────

    # GET /v1/agents → { agents: [{ agent_id, name, display_name, agent_type, … }] }
    def list_agents(include_archived: false)
      query = include_archived ? { include_archived: 'true' } : nil
      body = request(:get, '/v1/agents', query: query)
      Array(body && body['agents'])
    end

    # GET /v1/agents/:id → { agent_id, name, display_name, agent_type, … }
    def get_agent(id)
      request(:get, "/v1/agents/#{escape(id)}")
    end

    # DELETE /v1/agents/:id → 204 (soft archive). Returns nil on success.
    def archive_agent(id)
      request(:delete, "/v1/agents/#{escape(id)}")
    end

    # ── Action Packs ──────────────────────────────────────────────────────
    # Built-in, tenant-installable bundles of safe action definitions. The list
    # is the catalog of available packs; install creates registered actions only.

    # GET /v1/action-packs → { packs: [{ name, display_name, description, action_count }] }
    def list_action_packs
      body = request(:get, '/v1/action-packs')
      Array(body && body['packs'])
    end

    # ── Runtime API key ──────────────────────────────────────────────────
    # Dedicated runtime-connect keys, stored separately from the console
    # service key so minting one never revokes OVERTURE_API_KEY.

    # GET /v1/runtime/api-key → { has_key, prefix?, created_at? } (never raw)
    def get_runtime_api_key
      request(:get, '/v1/runtime/api-key')
    end

    # POST /v1/runtime/api-key → { api_key, prefix, created_at } — raw key once.
    def create_runtime_api_key
      request(:post, '/v1/runtime/api-key')
    end

    # ── Agent / app API keys ──────────────────────────────────────────────
    # Named keys an agent or app uses to call action endpoints. Distinct from
    # the runtime key and from the host-configured console service key.

    # GET /v1/api-keys → { keys: [{ id, name, prefix, created_at, last_used_at }] }
    def list_api_keys
      body = request(:get, '/v1/api-keys')
      Array(body && body['keys'])
    end

    # POST /v1/api-keys → { id, name, prefix, api_key, created_at } — raw once.
    def create_api_key(name)
      request(:post, '/v1/api-keys', body: { name: name })
    end

    # DELETE /v1/api-keys/:id → { ok: true }
    def revoke_api_key(id)
      request(:delete, "/v1/api-keys/#{escape(id)}")
    end

    # ── Project ──────────────────────────────────────────────────────────

    # GET /v1/project → { "name": "..." }
    def get_project
      request(:get, '/v1/project')
    end

    # PATCH /v1/project → { "name": "..." }
    def update_project(name)
      request(:patch, '/v1/project', body: { name: name })
    end

    # ── Health ───────────────────────────────────────────────────────────
    def health
      request(:get, '/v1/health')
    end

    # ── Plumbing ─────────────────────────────────────────────────────────
    private

    def request(verb, path, body: nil, query: nil)
      raise Unavailable.new('OVERTURE_API_BASE_URL not configured', code: 'unconfigured') unless configured?

      resp = conn.public_send(verb) do |req|
        req.url path
        req.headers.merge!(headers)
        req.params = query if query
        req.body = body.to_json if body
      end

      handle_response(resp, verb: verb, path: path)
    rescue Faraday::TimeoutError, Faraday::ConnectionFailed => e
      raise Unavailable.new("overture unreachable (#{e.class.name.split('::').last})", code: 'network')
    rescue Faraday::SSLError => e
      raise Unavailable.new("overture TLS error: #{e.message}", code: 'tls')
    end

    def handle_response(resp, verb:, path:)
      status = resp.status
      payload = resp.body.is_a?(Hash) ? resp.body : safe_json(resp.body)

      return payload if status.between?(200, 299)

      err_code = (payload.is_a?(Hash) && payload['error']).to_s
      err_msg  = (payload.is_a?(Hash) && (payload['message'] || payload['error'])).to_s

      case status
      when 400, 422
        raise ValidationError.new(err_msg.presence || 'invalid request', status: status, code: err_code)
      when 401
        raise Unauthenticated.new(err_msg.presence || 'unauthenticated', status: status, code: err_code)
      when 403
        raise PolicyDenied.new(err_msg.presence || 'policy denied', status: status, code: err_code)
      when 404
        raise NotFound.new(err_msg.presence || 'not found', status: status, code: err_code)
      when 409
        raise Conflict.new(err_msg.presence || 'conflict', status: status, code: err_code)
      when 503
        raise ServiceUnavailable.new(err_msg.presence || 'service unavailable', status: status, code: err_code)
      when 500..599
        raise ServerError.new(err_msg.presence || "server error #{status}", status: status, code: err_code)
      else
        raise Error.new(err_msg.presence || "unexpected #{status}", status: status, code: err_code)
      end
    end

    def safe_json(body)
      return body if body.is_a?(Hash) || body.is_a?(Array)
      return nil if body.to_s.strip.empty?
      JSON.parse(body)
    rescue JSON::ParserError
      { 'error' => 'invalid_response', 'message' => 'non-JSON response from overture' }
    end

    def safe
      yield
    rescue NotFound
      nil
    end

    def conn
      @conn ||= Faraday.new(url: @base_url) do |f|
        f.request :json
        f.response :json, content_type: /\bjson$/
        f.options.timeout      = @timeout
        f.options.open_timeout = [@timeout, 4].min
      end
    end

    def headers
      h = { 'Accept' => 'application/json', 'User-Agent' => 'igris-rails-console/0.1' }
      if @session_cookie.present?
        h['Cookie'] = @session_cookie
      elsif @api_key.present?
        h['Authorization'] = "Bearer #{@api_key}"
      end
      h
    end

    def escape(part)
      URI.encode_www_form_component(part.to_s)
    end
  end
end
