class ActionsController < ApplicationController
  rescue_from Igris::OvertureClient::Unavailable, with: :overture_unavailable

  WIZARD_STEPS = %w[identity target policy endpoint].freeze

  # Action names become part of the endpoint path, so they follow Go Overture's
  # actionNamePattern exactly: lowercase letter, then 1–63 of [a-z0-9_].
  NAME_PATTERN = /\A[a-z][a-z0-9_]{1,63}\z/

  # UI policy presets → the exact payload fields Go Overture accepts. The
  # policy_preset strings here are the only values validPolicyPreset() allows;
  # the rest mirror applyPolicyPresetDefaults() so Go never rejects the body.
  POLICY_PRESETS = {
    'safe_automation' => {
      label: 'Safe automation', preset: 'Safe automation',
      replay_class: 'retryable',     approval_required: false, irreversible: false,
      blurb: 'Igris runs the action automatically when the request matches policy.',
    },
    'human_gated' => {
      label: 'Human-gated', preset: 'Human-gated',
      replay_class: 'non_retryable', approval_required: true,  irreversible: false,
      blurb: 'Igris pauses for a human review before the action runs.',
    },
    'non_replayable' => {
      label: 'Non-replayable', preset: 'Non-replayable',
      replay_class: 'non_retryable', approval_required: false, irreversible: true,
      blurb: 'Igris will not automatically replay this action — it may cause irreversible side effects.',
    },
    'read_only' => {
      label: 'Read-only', preset: 'Read-only',
      replay_class: 'read_only',     approval_required: false, irreversible: false,
      blurb: 'For actions that inspect information without changing systems.',
    },
  }.freeze

  # Readiness buckets the Readiness dropdown offers (value => label). Mirrors
  # the readiness tones rendered on each row.
  READINESS = {
    'ready'         => 'Ready',
    'needs_target'  => 'Needs target',
    'needs_runtime' => 'Needs runtime',
    'demo_only'     => 'Demo only',
  }.freeze

  def index
    @all_actions = data_source.actions

    # Selected filter values (blank = no filter on that dimension).
    @readiness = READINESS.key?(params[:readiness].to_s) ? params[:readiness].to_s : ''
    @policy    = params[:policy].to_s
    @query     = params[:q].to_s.strip

    # Distinct policies present, for the Policy dropdown.
    @policies = @all_actions.map { |a| a[:policy].to_s }.reject(&:empty?).uniq.sort

    @actions = @all_actions
    @actions = @actions.select { |a| action_readiness(a) == @readiness } if @readiness.present?
    @actions = @actions.select { |a| a[:policy].to_s == @policy }        if @policy.present?
    @actions = search_actions(@actions, @query)                          if @query.present?

    @degraded_error = data_source.error
  end

  def new
    @step   = normalize_step(params[:step])
    @draft  = build_draft
    @errors = {}
    # Gate forward navigation: you cannot land on a later step while an earlier
    # one is invalid. This keeps invalid payloads from ever reaching Go.
    enforce_step_gates
  end

  def create
    @draft = build_draft

    if (err = name_error(@draft[:name]))
      return render_wizard_error('identity', :name, err, status: :unprocessable_entity)
    end
    if @draft[:target_type] == 'hybrid_fallback'
      return render_wizard_error('target', :target_type,
        'Hybrid / fallback is coming soon — choose another target.', status: :unprocessable_entity)
    end
    if (err = target_url_error(@draft[:target_type], @draft[:target_url]))
      return render_wizard_error('target', :target_url, err, status: :unprocessable_entity)
    end

    if data_source.fixtures?
      @step = 'endpoint'
      @errors = {}
      flash.now[:notice] = 'Demo mode — submission is inert and creates no real action. ' \
                           'Set OVERTURE_API_BASE_URL to create actions for real.'
      return render :new
    end

    action = data_source.create_action(create_payload)
    redirect_to action_path(action[:name], created: 1), notice: "Action “#{action[:name]}” created."
  rescue Igris::OvertureClient::ValidationError => e
    render_wizard_error('identity', :base, "Invalid action: #{e.message}", status: :unprocessable_entity)
  rescue Igris::OvertureClient::Conflict => e
    render_wizard_error('identity', :name, "An action named “#{@draft[:name]}” already exists.", status: :conflict)
  end

  def show
    @action = data_source.find_action(params[:id])
    return head :not_found unless @action
    @tab = (params[:tab].presence || 'overview').to_s
    @just_created = params[:created].present?
    @runs_for_action = data_source.runs_for_action(@action[:name])
    @affinity = data_source.action_consumer_affinity(@action[:name])
    # Action-level reliability from the single execution-intelligence aggregate
    # (no per-run fan-out). nil when the action has no recorded runs in the
    # window; the view then shows an honest empty state instead of zeroes.
    @action_intel = data_source.respond_to?(:action_intelligence) ? data_source.action_intelligence(@action[:name]) : nil
    # Local-runtime actions need a connected runtime before they can run. Used
    # by the view to show "Runtime required" guidance above the test panel.
    @runtime_required = data_source.runtime_required_for?(@action)
    @degraded_error = data_source.error
  end

  # POST /actions/:id/run  — fire a test run against the live Overture endpoint.
  #
  # Every outcome is reported *inline* on the action's Overview test panel via
  # `flash[:test_result]` (state + safe message), so the result is visible
  # right where the developer submitted it instead of disappearing into a
  # top-of-page flash. The one exception is a successful real run, which
  # redirects to /runs/:task_id where the full "What happened" evidence lives.
  def run
    @action = data_source.find_action(params[:id])
    return head :not_found unless @action

    if data_source.fixtures?
      return test_outcome(:demo,
        'Demo mode — no real run was created. Set OVERTURE_API_BASE_URL to send real requests.')
    end

    parsed_input = params[:input].present? ? JSON.parse(params[:input]) : {}

    result = data_source.run_action(
      @action[:name],
      input: parsed_input,
      idempotency_key: params[:idempotency_key].presence,
    )

    task_id = result['task_id'] || result['run_id']
    if task_id.present?
      redirect_to run_path(task_id),
                  notice: "Request sent — status=#{result['status']} proof=#{result['proof_status']}"
    else
      test_outcome(:sent, 'Request was accepted, but Igris returned no run id to open.')
    end
  rescue JSON::ParserError
    test_outcome(:invalid_json,
      'Request body must be valid JSON. Fix the highlighted body and send again.', echo_input: true)
  rescue Igris::OvertureClient::ValidationError => e
    test_outcome(:invalid_request, "Igris rejected the request: #{e.message}", echo_input: true)
  rescue Igris::OvertureClient::PolicyDenied => e
    test_outcome(:policy_denied, "Policy denied this request: #{e.message}")
  rescue Igris::OvertureClient::NotFound
    redirect_to actions_path, alert: 'Action not found.'
  rescue Igris::OvertureClient::ServiceUnavailable => e
    if e.code == 'runtime_unavailable'
      test_outcome(:runtime_unavailable,
        'No runtime is connected, so this action could not run. Connect a runtime, then send the test again.')
    else
      test_outcome(:unavailable, 'The Igris API is unavailable right now. Try again in a moment.')
    end
  rescue Igris::OvertureClient::Error => e
    test_outcome(:api_error,
      "Igris returned an error (HTTP #{e.status}). Check the action's target and policy, then retry.")
  end

  private

  # Normalized readiness key for an action — the same logic the row view uses to
  # pick a readiness chip. Falls back to setup state when the API omits it.
  def action_readiness(action)
    action[:endpoint_readiness].to_s.presence ||
      (action[:setup].to_s.casecmp('Ready').zero? ? 'ready' : 'needs_target')
  end

  # Free-text search over safe, already-normalized action fields: name, target
  # label, policy, and endpoint. Case-insensitive substring match.
  def search_actions(actions, query)
    needle = query.downcase
    actions.select do |a|
      a[:name].to_s.downcase.include?(needle) ||
        a[:target_label].to_s.downcase.include?(needle) ||
        a[:policy].to_s.downcase.include?(needle) ||
        a[:endpoint].to_s.downcase.include?(needle)
    end
  end

  # Stash a safe, structured test outcome and bounce back to the Overview test
  # panel (anchored, so the result is in view). The message is operator-facing
  # copy only — never raw bodies, tokens, or upstream payloads. On input
  # errors the submitted JSON is echoed back (bounded) so it can be corrected.
  def test_outcome(state, message, echo_input: false)
    flash[:test_result] = { 'state' => state.to_s, 'message' => message }
    flash[:test_input] = params[:input].to_s if echo_input && params[:input].to_s.length <= 4_000
    redirect_to action_path(@action[:name], tab: 'overview', anchor: 'test-request')
  end

  # ── Wizard helpers ──────────────────────────────────────────────────────

  def normalize_step(step)
    s = step.to_s.presence || 'identity'
    WIZARD_STEPS.include?(s) ? s : 'identity'
  end

  def build_draft
    {
      name:         params[:name].to_s.strip,
      display_name: params[:display_name].to_s,
      description:  params[:description].to_s,
      target_type:  params[:target_type].presence || 'mock_demo',
      target_url:   params[:target_url].to_s,
      method:       params[:method].presence || 'POST',
      policy:       (POLICY_PRESETS.key?(params[:policy]) ? params[:policy] : 'safe_automation'),
    }
  end

  def enforce_step_gates
    idx = WIZARD_STEPS.index(@step) || 0

    if idx >= 1 && (err = name_error(@draft[:name]))
      @errors[:name] = err
      @step = 'identity'
      return
    end
    if idx >= 2
      if @draft[:target_type] == 'hybrid_fallback'
        @errors[:target_type] = 'Hybrid / fallback is coming soon — choose another target.'
        @step = 'target'
        return
      end
      if (err = target_url_error(@draft[:target_type], @draft[:target_url]))
        @errors[:target_url] = err
        @step = 'target'
      end
    end
  end

  def render_wizard_error(step, field, message, status:)
    @step = step
    @errors = { field => message }
    flash.now[:error] = message
    render :new, status: status
  end

  def name_error(name)
    n = name.to_s.strip
    return 'Action name is required.' if n.empty?
    return 'Use lowercase letters, numbers, and underscores only — no spaces.' unless n.match?(NAME_PATTERN)
    nil
  end

  def target_url_error(target_type, url)
    return nil unless %w[hosted_api webhook].include?(target_type.to_s)
    return nil if url.to_s.strip.present?
    label = target_type.to_s == 'hosted_api' ? 'Hosted API' : 'Webhook'
    "A target URL is required for #{label} actions."
  end

  def create_payload
    mapping = POLICY_PRESETS.fetch(@draft[:policy], POLICY_PRESETS['safe_automation'])
    {
      name:              @draft[:name],
      display_name:      @draft[:display_name].presence || @draft[:name].humanize,
      description:       @draft[:description],
      target_type:       @draft[:target_type],
      target_url:        @draft[:target_url],
      method:            @draft[:method].to_s.upcase.presence || 'POST',
      policy_preset:     mapping[:preset],
      replay_class:      mapping[:replay_class],
      approval_required: mapping[:approval_required],
      irreversible:      mapping[:irreversible],
    }
  end

  def overture_unavailable(_e)
    @actions = []
    @degraded_error = data_source.error || Igris::OvertureClient::Unavailable.new('igris unreachable')
    flash.now[:alert] = 'Igris is unreachable — showing empty state.'
    render :index, status: :service_unavailable
  end
end
