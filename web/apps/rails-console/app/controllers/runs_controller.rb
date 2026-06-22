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

  # The two in-page views on /runs. History is the filterable run list;
  # intelligence is the read-only Execution Intelligence metrics surface. Both
  # live under the Runs lens — no parallel navigation.
  VIEWS = %w[history intelligence].freeze

  # Range options the intelligence tab offers, mapped to the API's range tokens.
  INTELLIGENCE_RANGES = {
    'last_24h' => 'Last 24 hours',
    'last_7d'  => 'Last 7 days',
    'last_30d' => 'Last 30 days',
  }.freeze

  # Policy Simulation form options (operator-facing label => API token). The
  # backend re-validates every value; these only shape the compact form.
  POLICY_SIM_RANGES = {
    '24h' => 'Last 24 hours',
    '7d'  => 'Last 7 days',
    '30d' => 'Last 30 days',
  }.freeze
  POLICY_SIM_MODES = {
    'require_approval' => 'Would require approval',
    'block'           => 'Would block',
  }.freeze
  POLICY_SIM_MATCH_KINDS = {
    'match_action_name'   => 'Action name is',
    'match_action_prefix' => 'Action name starts with',
  }.freeze
  POLICY_SIM_STATUSES = %w[
    completed failed canceled approval_required dispatched in_flight running pending
  ].freeze

  # Trust Recommendation lifecycle filters (operator label) and snooze windows.
  TRUST_STATE_FILTERS = {
    'active'   => 'Active',
    'snoozed'  => 'Snoozed',
    'resolved' => 'Resolved',
    'all'      => 'All',
  }.freeze
  TRUST_STATE_LABELS = {
    'active' => 'Active', 'acknowledged' => 'Acknowledged',
    'snoozed' => 'Snoozed', 'resolved' => 'Resolved'
  }.freeze
  TRUST_SNOOZE_DURATIONS = { '1d' => '1 day', '7d' => '7 days', '30d' => '30 days' }.freeze

  helper_method :trust_link_href, :trust_severity_label, :trust_state_label

  def index
    @view = VIEWS.include?(params[:view].to_s) ? params[:view].to_s : 'history'

    if @view == 'intelligence'
      @range = INTELLIGENCE_RANGES.key?(params[:range].to_s) ? params[:range].to_s : 'last_30d'
      @intelligence = data_source.execution_intelligence(range: @range)
      # Policy Simulation is a read-only preview computed only when the operator
      # submits the form (params[:simulate]); otherwise the card shows its intro.
      @policy_simulation = run_policy_simulation if params[:simulate].present?
      # Trust Recommendations — deterministic attention items over the same
      # window, with an operator lifecycle filter. Read-only; degrades to its own
      # safe state on backend error.
      @trust_state = TRUST_STATE_FILTERS.key?(params[:trust_state].to_s) ? params[:trust_state].to_s : 'active'
      @trust_recommendations = data_source.trust_recommendations(range: @range, state_filter: @trust_state)
      @degraded_error = data_source.error
      return
    end

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
    if @run.nil?
      # A clean not-found is a 404. A backend ERROR instead renders a degraded
      # page with a calm, safe banner (the flash partial shows only the error
      # class / HTTP status / machine code — never the raw upstream message).
      return head :not_found unless data_source.error
      @run = degraded_run(params[:id])
    end
    # Recent runs power the master-detail mini-sidebar picker, grouped by status.
    @all_runs = data_source.all_runs
    @run_groups = group_runs_by_status(@all_runs)
    @action_known = data_source.actions.any? { |a| a[:name].to_s == @run[:action].to_s }
    @any_healthy_runtime = data_source.healthy_runtime?
    # Operator-facing Evidence Memory for this run — summary-only (goal /
    # decision / evidence / outcome). [] when the run has none.
    @agent_memory = data_source.agent_memory_for_run(@run)
    @evaluation_results = data_source.execution_evaluations_for_run(@run)
    @degraded_error = data_source.error
  end

  # Resolve a Trust Recommendation link rel to an existing console path, using
  # the finding's entity. Unknown/unlinkable rels return nil so the view skips
  # them. No new surfaces are invented here.
  def trust_link_href(rec, rel)
    id = rec[:entity_id].to_s
    case rel.to_s
    when 'agent'           then id.present? ? agent_path(id) : nil
    when 'action'          then id.present? ? action_path(id) : nil
    when 'proposal'        then id.present? ? proposal_path(id) : nil
    when 'evaluations'     then evaluations_path
    when 'evaluations_new' then new_evaluation_path
    when 'runs'            then runs_path
    end
  end

  def trust_severity_label(severity)
    severity.to_s.capitalize.presence || 'Info'
  end

  def trust_state_label(state)
    TRUST_STATE_LABELS[state.to_s] || state.to_s.capitalize.presence || 'Active'
  end

  private

  # Build the read-only Policy Simulation from the submitted form params. Only
  # allow-listed, bounded values are passed through; the DataSource forwards
  # them to Igris (which re-validates and computes deterministically) and never
  # sends a tenant id. The match-kind selector maps one text value to exactly
  # one of the action-match criteria.
  def run_policy_simulation
    sim_range = POLICY_SIM_RANGES.key?(params[:sim_range].to_s) ? params[:sim_range].to_s : '30d'
    sim_mode  = POLICY_SIM_MODES.key?(params[:sim_mode].to_s) ? params[:sim_mode].to_s : 'require_approval'

    criteria = {}
    match_kind  = params[:sim_match_kind].to_s
    match_value = params[:sim_match_value].to_s.strip
    criteria[match_kind] = match_value if POLICY_SIM_MATCH_KINDS.key?(match_kind) && match_value.present?

    status = params[:sim_status].to_s
    criteria[:match_result_status] = status if POLICY_SIM_STATUSES.include?(status)

    criteria[:require_proof_missing]     = true if params[:sim_proof_missing].present?
    criteria[:require_recovery_occurred] = true if params[:sim_recovery].present?
    criteria[:require_eval_failed]       = true if params[:sim_eval_failed].present?

    data_source.simulate_policy(range: sim_range, policy_mode: sim_mode, criteria: criteria)
  end

  # The mini-sidebar groups recent runs by a real run attribute — their status
  # bucket — newest first within each group. No synthetic folders: every group
  # is derived from data the run actually carries.
  RUN_STATUS_ORDER = %w[Running Succeeded Blocked Failed].freeze

  # A safe placeholder run for the degraded page: only the id is known. Every
  # other field is an honest empty/unavailable value so the normal layout
  # renders without crashing — and the banner carries the safe error detail.
  def degraded_run(id)
    {
      id: id.to_s, action: '', status: 'Unavailable',
      routed_via: '', executed_target: '', runtime_id: '',
      policy: '', recovery: '', proof: 'Proof unavailable',
      started_at: nil, duration_ms: nil,
      story: [], execution_steps: [], steps: [], raw_evidence: [],
      agent: nil, request_summary: nil, request_digest: nil,
      runtime_unavailable: false,
    }
  end

  def status_bucket_for(run)
    s = run[:status].to_s
    return 'Running'   if s.match?(/running|awaiting|pending|in.?flight/i)
    return 'Failed'    if s.match?(/failed|error/i)
    return 'Blocked'   if s.match?(/denied|blocked|cancel/i)
    return 'Succeeded' if s.match?(/succeeded|success|completed/i)
    'Other'
  end

  # => [[status, [runs...]], ...] in RUN_STATUS_ORDER, skipping empty buckets
  # and appending any unmapped ones at the end.
  def group_runs_by_status(runs)
    grouped = runs.group_by { |r| status_bucket_for(r) }
    ordered = RUN_STATUS_ORDER.filter_map { |b| [b, grouped[b]] if grouped[b]&.any? }
    extras  = grouped.reject { |b, _| RUN_STATUS_ORDER.include?(b) }.to_a
    ordered + extras
  end

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
