class OverviewController < ApplicationController
  # Overview is the everyday workspace — run activity, feeds, and status.
  # Onboarding and product education live on /home.
  TABS = %w[map feed actions attention].freeze

  def index
    @actions = data_source.actions
    @recent_runs = data_source.recent_runs(limit: 8)
    @runtimes = data_source.runtimes
    @degraded_error = data_source.error
    @tab = TABS.include?(params[:tab].to_s) ? params[:tab].to_s : 'map'

    @activity_runs = data_source.respond_to?(:all_runs) ? data_source.all_runs : @recent_runs
  end
end