class RunsController < ApplicationController
  def index
    @runs = data_source.all_runs
    @degraded_error = data_source.error
  end

  def show
    @run = data_source.find_run(params[:id])
    return head :not_found unless @run
    @tab = (params[:tab].presence || 'story').to_s
    @degraded_error = data_source.error
  end
end
