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
                   logger: Rails.logger, timeout: 6)
      @base_url = base_url.to_s.strip.presence
      @api_key = api_key.to_s.strip.presence
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
      h['Authorization'] = "Bearer #{@api_key}" if @api_key
      h
    end

    def escape(part)
      URI.encode_www_form_component(part.to_s)
    end
  end
end
