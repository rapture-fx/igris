class RunsController < ApplicationController
  # Server-rendered filters — each maps to a predicate over the loaded runs.
  # We keep the full set for the summary counts and filter only what we show,
  # so the strip always reports the real picture of the loaded window.
  FILTERS = %w[all failed attention proof_unavailable].freeze

  def index
    @all_runs = data_source.all_runs
    @filter   = FILTERS.include?(params[:filter].to_s) ? params[:filter].to_s : 'all'
    @runs     = filtered(@all_runs, @filter)
    @counts   = run_counts(@all_runs)
    @action_names = data_source.actions.map { |a| a[:name].to_s }.to_set
    @any_healthy_runtime = data_source.healthy_runtime?
    @degraded_error = data_source.error
  end

  def show
    @run = data_source.find_run(params[:id])
    return head :not_found unless @run
    @action_known = data_source.actions.any? { |a| a[:name].to_s == @run[:action].to_s }
    @degraded_error = data_source.error
  end

  private

  def filtered(runs, filter)
    case filter
    when 'failed'            then runs.select { |r| helpers.run_failed?(r) }
    when 'attention'         then runs.select { |r| helpers.run_needs_attention?(r) }
    when 'proof_unavailable' then runs.select { |r| helpers.run_proof_unavailable?(r) }
    else runs
    end
  end

  def run_counts(runs)
    {
      total:             runs.size,
      failed:            runs.count { |r| helpers.run_failed?(r) },
      running:           runs.count { |r| helpers.run_running?(r) },
      attention:         runs.count { |r| helpers.run_needs_attention?(r) },
      proof_verified:    runs.count { |r| r[:proof].to_s.casecmp('Proof verified').zero? },
      proof_unavailable: runs.count { |r| helpers.run_proof_unavailable?(r) },
    }
  end
end
