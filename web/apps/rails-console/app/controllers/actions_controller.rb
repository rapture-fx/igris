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

  def index
    @actions = data_source.actions
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
    # Local-runtime actions need a connected runtime before they can run. Used
    # by the view to show "Runtime required" guidance above the test panel.
    @runtime_required = data_source.runtime_required_for?(@action)
    @degraded_error = data_source.error
  end

  # POST /actions/:id/run  — fire a test run against the live Overture endpoint.
  def run
    @action = data_source.find_action(params[:id])
    return head :not_found unless @action

    if data_source.fixtures?
      redirect_to action_path(@action[:name], tab: 'overview'),
                  notice: 'Demo mode — submission is inert and creates no real run. Set OVERTURE_API_BASE_URL to send real requests.'
      return
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
                  notice: "Request sent · status=#{result['status']} proof=#{result['proof_status']}"
    else
      redirect_to action_path(@action[:name], tab: 'overview'),
                  notice: 'Request sent, but Igris returned no run id.'
    end
  rescue JSON::ParserError
    redirect_to action_path(@action[:name], tab: 'overview'), alert: 'Input must be valid JSON.'
  rescue Igris::OvertureClient::ValidationError => e
    redirect_to action_path(@action[:name], tab: 'overview'), alert: "Invalid request: #{e.message}"
  rescue Igris::OvertureClient::PolicyDenied => e
    redirect_to action_path(@action[:name], tab: 'overview'), alert: "Policy denied: #{e.message}"
  rescue Igris::OvertureClient::NotFound
    redirect_to actions_path, alert: 'Action not found.'
  rescue Igris::OvertureClient::ServiceUnavailable => e
    redirect_to action_path(@action[:name], tab: 'overview'),
                alert: e.code == 'runtime_unavailable' ?
                       'No runtime is connected. Use Mock demo or connect a runtime, then retry.' :
                       "Igris is unavailable right now: #{e.message}"
  rescue Igris::OvertureClient::Error => e
    redirect_to action_path(@action[:name], tab: 'overview'),
                alert: "Igris error (#{e.status}): #{e.message}"
  end

  private

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
