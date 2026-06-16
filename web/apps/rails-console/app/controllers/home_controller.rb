class HomeController < ApplicationController
  # Home is the onboarding lens — product education, first-run project naming,
  # and the path to creating the first action. The everyday workspace lives on
  # /overview.

  def root
    if cookies[:igris_welcomed].present?
      redirect_to overview_path
    else
      redirect_to home_path
    end
  end

  def index
    @project = helpers.project_context
    @actions = data_source.actions
    @recent_runs = data_source.recent_runs(limit: 8)
    @degraded_error = data_source.error
  end

  def enter
    cookies.permanent[:igris_welcomed] = '1'
    redirect_to(params[:to] == 'new_action' ? new_action_path : overview_path)
  end

  def reset
    cookies.delete(:igris_welcomed)
    redirect_to home_path, notice: 'Console onboarding reset.'
  end
end