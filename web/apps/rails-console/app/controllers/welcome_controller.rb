class WelcomeController < ApplicationController
  # Root dispatcher — first-time visitors see /welcome, returning visitors
  # go straight to /home. State lives in a cookie so we don't need DB writes.
  def root
    if cookies[:igris_welcomed].present?
      redirect_to home_path
    else
      redirect_to welcome_path
    end
  end

  def index
    # Standalone layout (no console chrome) — declared via layout below.
  end

  # Mark the user as onboarded and send them into the console. `to` is a
  # whitelisted destination so the "Create your first action" CTA can land on
  # the new-action wizard; everything else goes to the Home workspace.
  def enter
    cookies.permanent[:igris_welcomed] = '1'
    redirect_to(params[:to] == 'new_action' ? new_action_path : home_path)
  end

  layout 'welcome', only: %i[index]
end
