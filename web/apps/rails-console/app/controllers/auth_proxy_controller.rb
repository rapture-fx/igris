# frozen_string_literal: true

require 'net/http'
require 'uri'

# Reverse-proxy BetterAuth API traffic to the configured upstream handler.
# Landing sign-in calls /api/auth/* on the console host; this controller
# forwards those requests without exposing upstream secrets in responses.
class AuthProxyController < ApplicationController
  skip_before_action :authenticate_console_access!

  PROXY_TIMEOUT = 15
  HOP_BY_HOP = %w[connection keep-alive proxy-authenticate proxy-authorization te trailer transfer-encoding upgrade].freeze

  def forward
    upstream = upstream_base_url
    unless upstream
      return render json: { error: 'auth_upstream_not_configured', code: 'AUTH_UPSTREAM_MISSING' },
                    status: :service_unavailable
    end

    target = build_target_uri(upstream)
    response = proxy_request(target)
    render_proxy_response(response)
  rescue URI::InvalidURIError
    render json: { error: 'invalid_auth_path', code: 'INVALID_AUTH_PATH' }, status: :bad_request
  rescue Net::OpenTimeout, Net::ReadTimeout, Errno::ECONNREFUSED, SocketError
    render json: { error: 'auth_upstream_unreachable', code: 'AUTH_UPSTREAM_UNREACHABLE' },
           status: :bad_gateway
  end

  private

  def upstream_base_url
    ENV['BETTER_AUTH_UPSTREAM_URL'].to_s.strip.presence
  end

  def build_target_uri(upstream)
    base = URI.parse(upstream)
    suffix = params[:path].to_s
    base.path = [base.path.chomp('/'), suffix].reject(&:empty?).join('/')
    base.query = request.query_string.presence
    base
  end

  def proxy_request(target)
    http = Net::HTTP.new(target.host, target.port)
    http.use_ssl = target.scheme == 'https'
    http.open_timeout = PROXY_TIMEOUT
    http.read_timeout = PROXY_TIMEOUT

    klass = proxy_request_class
    req = klass.new(target)
    copy_proxy_request_headers(req)
    req.body = request.raw_post if %w[POST PUT PATCH].include?(request.method)

    http.request(req)
  end

  def proxy_request_class
    {
      'GET' => Net::HTTP::Get,
      'POST' => Net::HTTP::Post,
      'PUT' => Net::HTTP::Put,
      'PATCH' => Net::HTTP::Patch,
      'DELETE' => Net::HTTP::Delete,
      'HEAD' => Net::HTTP::Head,
      'OPTIONS' => Net::HTTP::Options,
    }.fetch(request.method.upcase, Net::HTTP::Get)
  end

  def copy_proxy_request_headers(req)
    env_to_header = {
      'CONTENT_TYPE' => 'Content-Type',
      'HTTP_ACCEPT' => 'Accept',
      'HTTP_ACCEPT_LANGUAGE' => 'Accept-Language',
      'HTTP_ORIGIN' => 'Origin',
      'HTTP_REFERER' => 'Referer',
      'HTTP_USER_AGENT' => 'User-Agent',
    }
    env_to_header.each do |env_key, header|
      req[header] = request.env[env_key] if request.env[env_key].present?
    end
    req['Cookie'] = request.env['HTTP_COOKIE'] if request.env['HTTP_COOKIE'].present?
  end

  def render_proxy_response(upstream_response)
    upstream_response.each_header do |key, value|
      next if HOP_BY_HOP.include?(key.downcase)

      response.headers[key] = value
    end
    render plain: upstream_response.body, status: upstream_response.code.to_i
  end
end