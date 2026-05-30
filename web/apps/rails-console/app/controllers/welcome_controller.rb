class WelcomeController < ApplicationController
  # Root dispatcher — first-time visitors land on Home (/welcome, the
  # get-started lens), returning visitors go straight to the Overview
  # workspace (/home). State lives in a cookie so we don't need DB writes.
  def root
    if cookies[:igris_welcomed].present?
      redirect_to home_path
    else
      redirect_to welcome_path
    end
  end

  # Home — the get-started/onboarding lens. Renders inside the console chrome
  # (icon rail + topbar) via the default application layout.
  def index; end

  # Mark the user as onboarded and send them on. `to` is a whitelisted
  # destination so the "Create your first action" CTA can land on the
  # new-action wizard; everything else goes to the Overview workspace.
  def enter
    cookies.permanent[:igris_welcomed] = '1'
    redirect_to(params[:to] == 'new_action' ? new_action_path : home_path)
  end
end
