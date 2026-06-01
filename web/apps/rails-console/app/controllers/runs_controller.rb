class RunsController < ApplicationController
  # Status buckets the Status dropdown offers. Each maps to a predicate over a
  # run's normalized status string.
  STATUSES = %w[succeeded running failed blocked].freeze

  # Date-range options (value => cutoff lambda). 'all' / blank means no bound.
  RANGES = {
    'hour' => -> { 1.hour.ago },
    'day'  => -> { 24.hours.ago },
    'week' => -> { 7.days.ago },
  }.freeze

  def index
    @all_runs = data_source.all_runs

    # Selected filter values (blank = no filter on that dimension).
    @status = STATUSES.include?(params[:status].to_s) ? params[:status].to_s : ''
    @route  = params[:route].to_s
    @range  = RANGES.key?(params[:range].to_s) ? params[:range].to_s : ''
    @query  = params[:q].to_s.strip

    # Distinct routes available in the loaded window, for the Route dropdown.
    @routes = @all_runs.map { |r| r[:routed_via].to_s }.reject(&:empty?).uniq.sort

    @runs = @all_runs
    @runs = by_status(@runs, @status) if @status.present?
    @runs = @runs.select { |r| r[:routed_via].to_s == @route } if @route.present?
    @runs = by_range(@runs, @range)   if @range.present?
    @runs = search(@runs, @query)     if @query.present?

    @action_names = data_source.actions.map { |a| a[:name].to_s }.to_set
    @any_healthy_runtime = data_source.healthy_runtime?
    @degraded_error = data_source.error
  end

  def show
    @run = data_source.find_run(params[:id])
    return head :not_found unless @run
    @action_known = data_source.actions.any? { |a| a[:name].to_s == @run[:action].to_s }
    @any_healthy_runtime = data_source.healthy_runtime?
    @degraded_error = data_source.error
  end

  private

  def by_status(runs, status)
    case status
    when 'succeeded' then runs.select { |r| r[:status].to_s.match?(/succeeded|success|completed/i) }
    when 'running'   then runs.select { |r| r[:status].to_s.match?(/running|awaiting|pending|in.?flight/i) }
    when 'failed'    then runs.select { |r| r[:status].to_s.match?(/failed|error/i) }
    when 'blocked'   then runs.select { |r| r[:status].to_s.match?(/blocked|denied|cancel/i) }
    else runs
    end
  end

  def by_range(runs, range)
    cutoff = RANGES[range]&.call
    return runs unless cutoff

    runs.select do |r|
      at = r[:started_at]
      at.respond_to?(:to_time) && at.to_time >= cutoff
    end
  end

  # Free-text search over safe, already-normalized run fields: action name,
  # run id, and routed-via target. Case-insensitive substring match.
  def search(runs, query)
    needle = query.downcase
    runs.select do |r|
      r[:action].to_s.downcase.include?(needle) ||
        r[:id].to_s.downcase.include?(needle) ||
        r[:routed_via].to_s.downcase.include?(needle)
    end
  end
end
