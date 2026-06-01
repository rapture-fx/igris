class HomeController < ApplicationController
  # Home is the everyday workspace, not an onboarding page — product education
  # lives on /welcome. We deliberately do NOT load daily_run_counts here: that
  # series is fixture-only and would render a fake 105-day activity chart in
  # demo mode, which Home must not show.
  # Server-rendered workspace tabs (no client JS). The Run Activity Map is the
  # first/default lens; the activity feed sits right after it.
  TABS = %w[map feed actions attention].freeze

  def index
    @actions = data_source.actions
    @recent_runs = data_source.recent_runs(limit: 8)
    @runtimes = data_source.runtimes
    @degraded_error = data_source.error
    @tab = TABS.include?(params[:tab].to_s) ? params[:tab].to_s : 'map'

    # Wider window for the Run Activity Map than the 8-row feed. Resilient to
    # DataSource doubles that predate #all_runs.
    @activity_runs = data_source.respond_to?(:all_runs) ? data_source.all_runs : @recent_runs
  end
end
