class PasswordResetsController < ApplicationController
  # Password-reset email links land here before the operator console chrome.
  # Skip the HTTP Basic preview gate so the handoff page is reachable without
  # ADMIN credentials. Overture data routes remain protected.
  skip_before_action :authenticate_console_access!, only: :show

  layout 'minimal'

  def show
    landing = landing_origin

    if request.query_string.present?
      redirect_to "#{landing}/auth?#{request.query_string}", allow_other_host: true
      return
    end

    @landing_auth_url = "#{landing}/auth"
  end

  private

  def landing_origin
    ENV.fetch('LANDING_URL', 'https://igrisinertial.com').to_s.chomp('/')
  end
end