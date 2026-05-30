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
  # (icon rail + topbar) via the default application layout. We resolve the
  # project so the view can show the first-run "Create your project" prompt
  # when a real tenant has not named their project yet.
  def index
    @project = helpers.project_context
  end

  # Mark the user as onboarded and send them on. `to` is a whitelisted
  # destination so the "Create your first action" CTA can land on the
  # new-action wizard; everything else goes to the Overview workspace.
  def enter
    cookies.permanent[:igris_welcomed] = '1'
    redirect_to(params[:to] == 'new_action' ? new_action_path : home_path)
  end

  # Forget the onboarded cookie so the next visit lands back on /welcome.
  # Backs the Settings → Advanced "Reset console onboarding" control.
  def reset
    cookies.delete(:igris_welcomed)
    redirect_to welcome_path, notice: 'Console onboarding reset.'
  end
end
