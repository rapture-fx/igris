class HomeController < ApplicationController
  def index
    @actions = data_source.actions
    @recent_runs = data_source.recent_runs(limit: 3)
    @daily_runs = data_source.daily_run_counts
    @degraded_error = data_source.error
  end
end
