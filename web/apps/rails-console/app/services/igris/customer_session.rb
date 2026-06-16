# frozen_string_literal: true

require 'faraday'
require 'faraday/net_http'

module Igris
  # Validates a BetterAuth browser session by probing Overture with the
  # session cookie only — never a service API key. Tenant identity is
  # resolved server-side by Overture's BetterAuth middleware; Rails must not
  # trust client-supplied tenant headers or params.
  #
  # Cookie values are taken from Rails' signed cookie jar (request.cookies),
  # not from the raw Cookie header.
  class CustomerSession
    SESSION_COOKIE_NAMES = %w[
      __Secure-better-auth.session_token
      better-auth.session_token
    ].freeze

    class << self
      def from_request(request)
        header = cookie_header_from_request(request)
        header ? new(cookie_header: header) : nil
      end

      def cookie_header_from_request(request)
        parts = SESSION_COOKIE_NAMES.filter_map do |name|
          value = request.cookies[name].to_s
          "#{name}=#{value}" if value.present?
        end
        parts.join('; ').presence
      end

      def probe_configured?
        ENV['OVERTURE_API_BASE_URL'].to_s.strip.present?
      end
    end

    attr_reader :cookie_header

    def initialize(cookie_header:)
      @cookie_header = cookie_header.to_s
    end

    # :valid, :invalid, or :unavailable (Overture unreachable / misconfigured).
    def validate
      return :invalid if cookie_header.blank?
      return :unavailable unless self.class.probe_configured?

      resp = probe_conn.get('/v1/project') do |req|
        req.headers['Cookie'] = cookie_header
        req.headers['Accept'] = 'application/json'
      end

      case resp.status
      when 200 then :valid
      when 401, 403 then :invalid
      else :unavailable
      end
    rescue Faraday::TimeoutError, Faraday::ConnectionFailed, Faraday::SSLError
      :unavailable
    end

    private

    def probe_conn
      @probe_conn ||= Faraday.new(url: ENV['OVERTURE_API_BASE_URL'].to_s.strip) do |f|
        f.options.timeout = 4
        f.options.open_timeout = 3
        f.adapter Faraday.default_adapter
      end
    end
  end
end