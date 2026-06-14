class WelcomeController < ApplicationController
  # Legacy /welcome URLs redirect to /home (the onboarding lens).
  def root
    redirect_to home_path
  end

  def index
    redirect_to home_path
  end

  # Back-compat for old forms that still POST to /welcome/enter.
  def enter
    cookies.permanent[:igris_welcomed] = '1'
    redirect_to(params[:to] == 'new_action' ? new_action_path : overview_path)
  end

  def reset
    cookies.delete(:igris_welcomed)
    redirect_to home_path, notice: 'Console onboarding reset.'
  end
end