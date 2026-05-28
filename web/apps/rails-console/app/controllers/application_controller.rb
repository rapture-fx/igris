class ApplicationController < ActionController::Base
  helper_method :time_ago, :data_source, :demo_mode?
  protect_from_forgery with: :exception

  # Console front door — HTTP Basic auth, env-driven.
  #
  # When both ADMIN_USERNAME and ADMIN_PASSWORD are set (production), every
  # request must present matching Basic credentials before the controller
  # runs. Comparison uses ActiveSupport::SecurityUtils.secure_compare so
  # timing leakage doesn't reveal the username/password. When either env
  # var is unset (development / test), auth is disabled — the demo
  # indicator already tells operators the console is unconfigured.
  #
  # Health probes (`/up`) bypass auth so Render's liveness check works.
  #
  # This is the MVP front-door; replace with Clerk / BetterAuth-direct
  # once multi-user identity is needed.
  before_action :require_admin_login!

  private

  def require_admin_login!
    return if Rails.env.test? && !ENV['ADMIN_USERNAME']
    username = ENV['ADMIN_USERNAME'].to_s
    password = ENV['ADMIN_PASSWORD'].to_s
    return if username.empty? || password.empty? # auth disabled in dev/unconfigured
    authenticate_or_request_with_http_basic('Igris Console') do |u, p|
      # Hash both sides so `secure_compare` always sees equal-length input
      # (it raises ArgumentError otherwise — which would itself leak length).
      u_ok = ActiveSupport::SecurityUtils.secure_compare(
        ::Digest::SHA256.hexdigest(u.to_s), ::Digest::SHA256.hexdigest(username)
      )
      p_ok = ActiveSupport::SecurityUtils.secure_compare(
        ::Digest::SHA256.hexdigest(p.to_s), ::Digest::SHA256.hexdigest(password)
      )
      u_ok & p_ok
    end
  end

  public

  def time_ago(time)
    return 'never' unless time
    delta = (Time.now - time).to_i
    case delta
    when 0..59          then "#{delta}s ago"
    when 60..3599       then "#{delta / 60}m ago"
    when 3600..86_399   then "#{delta / 3600}h ago"
    else                     "#{delta / 86_400}d ago"
    end
  end

  # Per-request DataSource — picks real Overture or fixtures based on env.
  def data_source
    @data_source ||= Igris::DataSource.new
  end

  def demo_mode?
    data_source.fixtures?
  end
end
