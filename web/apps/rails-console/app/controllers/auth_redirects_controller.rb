class AuthRedirectsController < ApplicationController
  # Landing post-auth URLs hit these first. Skip the HTTP Basic preview gate so
  # redirects resolve without a 404; /welcome and /home remain protected.
  skip_before_action :authenticate_console_access!, only: %i[onboarding dashboard]

  def onboarding
    redirect_to welcome_path
  end

  def dashboard
    redirect_to home_path
  end
end