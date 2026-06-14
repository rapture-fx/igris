# frozen_string_literal: true

require 'base64'

# Console front door — customer BetterAuth session (primary) with HTTP Basic
# admin/preview fallback. Production fails closed when neither path is
# configured or when the request presents neither valid credentials.
module ConsoleAuthentication
  extend ActiveSupport::Concern

  included do
    helper_method :console_auth_mode, :customer_session_active?
    before_action :authenticate_console_access!
  end

  private

  def authenticate_console_access!
    return if open_fixture_mode?

    @console_auth_mode = resolve_console_auth_mode
    return if @console_auth_mode == :customer
    return if @console_auth_mode == :admin
    return if @console_auth_mode == :fixture

    deny_console_access
  end

  def resolve_console_auth_mode
    if customer_session_valid?
      @customer_session_cookie_header = customer_session_candidate.cookie_header
      return :customer
    end

    return :admin if admin_basic_credentials_configured? && admin_basic_authenticated?

    if !production_env? && !customer_auth_configured? && !admin_basic_credentials_configured?
      return :fixture
    end

    return :deny unless customer_auth_configured? || admin_basic_credentials_configured?

    :deny
  end

  def customer_session_valid?
    session = customer_session_candidate
    return false unless session

    @customer_session_validation ||= {}
    @customer_session_validation[session.cookie_header] ||= session.validate
    @customer_session_validation[session.cookie_header] == :valid
  end

  def customer_session_candidate
    @customer_session_candidate ||= Igris::CustomerSession.from_request(request)
  end

  def customer_auth_configured?
    Igris::CustomerSession.probe_configured?
  end

  def admin_basic_credentials_configured?
    ENV['ADMIN_USERNAME'].to_s.present? && ENV['ADMIN_PASSWORD'].to_s.present?
  end

  def admin_basic_authenticated?
    auth = request.env['HTTP_AUTHORIZATION'].to_s
    return false unless auth.start_with?('Basic ')

    decoded = Base64.decode64(auth.split(' ', 2).last.to_s)
    username, password = decoded.split(':', 2)
    return false if username.nil? || password.nil?
    u_ok = ActiveSupport::SecurityUtils.secure_compare(
      ::Digest::SHA256.hexdigest(username.to_s), ::Digest::SHA256.hexdigest(ENV['ADMIN_USERNAME'].to_s)
    )
    p_ok = ActiveSupport::SecurityUtils.secure_compare(
      ::Digest::SHA256.hexdigest(password.to_s), ::Digest::SHA256.hexdigest(ENV['ADMIN_PASSWORD'].to_s)
    )
    u_ok & p_ok
  end

  def production_env?
    Rails.env.production?
  end

  def deny_console_access
    if admin_basic_credentials_configured?
      request_http_basic_authentication('Igris Console')
      head :unauthorized
      return
    end

    redirect_to "#{landing_origin}/auth", allow_other_host: true
  end

  def open_fixture_mode?
    Rails.env.test? && !production_env? && !admin_basic_credentials_configured? && !customer_auth_configured?
  end

  def landing_origin
    ENV.fetch('LANDING_URL', 'https://igrisinertial.com').to_s.chomp('/')
  end

  def console_auth_mode
    @console_auth_mode || :fixture
  end

  def customer_session_active?
    console_auth_mode == :customer
  end

  public

  def overture_client_for_request
    if customer_session_active? && @customer_session_cookie_header.present?
      Igris::OvertureClient.new(session_cookie: @customer_session_cookie_header)
    else
      Igris::OvertureClient.new
    end
  end

  def data_source
    @data_source ||= Igris::DataSource.new(client: overture_client_for_request)
  end
end