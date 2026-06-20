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
