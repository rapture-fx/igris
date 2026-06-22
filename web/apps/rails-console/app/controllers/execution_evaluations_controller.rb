# frozen_string_literal: true

# Execution Evaluation definitions — operator UX for the deterministic
# execution-evaluation engine in Go Overture. Operators define expectations
# about *execution behaviour* (which action ran, whether approval was required,
# whether proof was generated, whether a secret leaked) and run them against
# recorded runs. This is NOT a prompt/model evaluation surface: no prompts,
# chain-of-thought, raw bodies, ciphertext, or secrets are ever rendered.
#
# Boundary: Go Overture is the source of truth. It validates every assertion
# against an allow-list and derives tenant identity server-side; Rails never
# persists definitions and never sends tenant_id in the body. The Evaluations
# list lives under the Runs lens (no new top-level navigation).
class ExecutionEvaluationsController < ApplicationController
  rescue_from Igris::OvertureClient::Unavailable, with: :overture_unavailable

  # The phase-1 supported assertion types, expressed in operator language.
  #   :requires — :action (needs an action name), :agent (needs an agent),
  #               or :none (a pure behavioural check with no target value).
  ASSERTION_TYPES = {
    'action_called'         => { label: 'Expected action was called',       requires: :action,
                                 help: 'Passes when the run actually invoked this action.' },
    'action_not_called'     => { label: 'Forbidden action was NOT called',  requires: :action,
                                 help: 'Passes when the run never invoked this action.' },
    'agent_used'            => { label: 'Expected agent ran the action',    requires: :agent,
                                 help: 'Passes when this registered agent executed the run.' },
    'approval_required'     => { label: 'Human approval was required',      requires: :none,
                                 help: 'Passes when the run paused for human approval.' },
    'approval_not_required' => { label: 'No human approval was required',   requires: :none,
                                 help: 'Passes when the run did not need human approval.' },
    'recovery_occurred'     => { label: 'Recovery occurred',               requires: :none,
                                 help: 'Passes when the run recovered from a failure.' },
    'recovery_not_required' => { label: 'Recovery was not required',        requires: :none,
                                 help: 'Passes when the run completed without recovery.' },
    'proof_generated'       => { label: 'Proof / receipt was generated',    requires: :none,
                                 help: 'Passes when a signed proof or receipt was recorded.' },
    'no_secret_leak'        => { label: 'No secret was leaked',             requires: :none,
                                 help: 'Passes when no secret marker was found in execution metadata.' },
  }.freeze

  helper_method :assertion_types, :assertion_value, :assertion_label

  def index
    # Optional action/agent filters arrive from entity-scoped investigation
    # links (Action Detail, Agent Detail, Trust recommendations). Both are exact
    # matches the DataSource applies over the fully tenant-scoped list.
    @filter_action = params[:action_name].to_s.strip.presence || params[:q].to_s.strip.presence
    @filter_agent  = params[:agent].to_s.strip.presence
    @evaluations = data_source.execution_evals(action: @filter_action, agent_id: @filter_agent)
    @degraded_error = data_source.error
  end

  def show
    @evaluation = data_source.find_execution_eval(params[:id])
    return head :not_found unless @evaluation

    # The edit pane lives in the detail page's right panel, so it needs the same
    # agent options the standalone edit form does.
    @agents = data_source.agents_for_select
    @eval_history = data_source.execution_eval_history(@evaluation[:id])
    @errors = {}
    @degraded_error = data_source.error
  end

  def new
    @evaluation = blank_draft
    @errors = {}
    @agents = data_source.agents_for_select
  end

  def create
    @evaluation = draft_from_params
    @agents = data_source.agents_for_select

    if data_source.fixtures?
      @errors = {}
      flash.now[:notice] = demo_notice
      return render :new
    end

    if (errs = validate_draft).present?
      @errors = errs
      flash.now[:error] = errs.values.first
      return render :new, status: :unprocessable_entity
    end

    created = data_source.create_execution_eval(eval_payload)
    redirect_to evaluation_path(created[:id]), notice: "Evaluation “#{created[:name]}” created."
  rescue Igris::OvertureClient::ValidationError => e
    @errors = { base: e.message }
    flash.now[:error] = "Invalid evaluation: #{e.message}"
    render :new, status: :unprocessable_entity
  end

  def edit
    @evaluation = data_source.find_execution_eval(params[:id])
    return head :not_found unless @evaluation

    @errors = {}
    @agents = data_source.agents_for_select
  end

  def update
    @evaluation = draft_from_params.merge(id: params[:id].to_s)
    @agents = data_source.agents_for_select

    if data_source.fixtures?
      @errors = {}
      flash.now[:notice] = demo_notice
      return render :edit
    end

    if (errs = validate_draft).present?
      @errors = errs
      flash.now[:error] = errs.values.first
      return render :edit, status: :unprocessable_entity
    end

    updated = data_source.update_execution_eval(params[:id], eval_payload)
    redirect_to evaluation_path(updated[:id]), notice: "Evaluation “#{updated[:name]}” updated."
  rescue Igris::OvertureClient::NotFound
    redirect_to evaluations_path, alert: 'Evaluation not found.'
  rescue Igris::OvertureClient::ValidationError => e
    @errors = { base: e.message }
    flash.now[:error] = "Invalid evaluation: #{e.message}"
    render :edit, status: :unprocessable_entity
  end

  def destroy
    if data_source.fixtures?
      return redirect_to evaluations_path, alert: 'Demo mode — nothing was archived. Set OVERTURE_API_BASE_URL.'
    end

    data_source.archive_execution_eval(params[:id])
    redirect_to evaluations_path, notice: 'Evaluation archived.'
  rescue Igris::OvertureClient::NotFound
    redirect_to evaluations_path, alert: 'Evaluation not found.'
  rescue Igris::OvertureClient::Error
    redirect_to evaluations_path, alert: 'Could not archive the evaluation right now.'
  end

  # POST /runs/evaluations/:id/run — run this definition against one run/task id.
  # The result renders inline on the definition page; only safe assertion names,
  # pass/fail status, and reasons are ever shown.
  def run
    @evaluation = data_source.find_execution_eval(params[:id])
    return head :not_found unless @evaluation

    @task_id = params[:task_id].to_s.strip
    @agents = data_source.agents_for_select
    @errors = {}
    @degraded_error = data_source.error
    @eval_history = data_source.execution_eval_history(@evaluation[:id])

    if data_source.fixtures?
      flash.now[:error] = 'Demo mode — evaluations cannot run against real runs here. Set OVERTURE_API_BASE_URL.'
      return render :show
    end
    if @task_id.empty?
      flash.now[:error] = 'Enter a run or task ID to evaluate.'
      return render :show, status: :unprocessable_entity
    end

    @eval_result = data_source.run_execution_eval(@evaluation[:id], task_id: @task_id)
    @eval_history = data_source.execution_eval_history(@evaluation[:id])
    flash.now[:notice] = "Evaluation ran against #{@task_id} — #{@eval_result[:status]}."
    render :show
  rescue Igris::OvertureClient::NotFound
    flash.now[:error] = 'No run was found for that ID (or the evaluation no longer exists).'
    render :show, status: :not_found
  rescue Igris::OvertureClient::Conflict
    flash.now[:error] = 'This evaluation is disabled. Enable it before running it.'
    render :show, status: :conflict
  rescue Igris::OvertureClient::ValidationError => e
    flash.now[:error] = "Could not run evaluation: #{e.message}"
    render :show, status: :unprocessable_entity
  rescue Igris::OvertureClient::Error
    flash.now[:error] = 'The Igris API could not run this evaluation right now. Try again in a moment.'
    render :show, status: :service_unavailable
  end

  private

  def assertion_types
    ASSERTION_TYPES
  end

  # Human label for a stored assertion type, falling back to the raw type so an
  # unknown/legacy type still renders something safe.
  def assertion_label(type)
    ASSERTION_TYPES.dig(type.to_s, :label) || type.to_s.tr('_', ' ')
  end

  # The single editable "target value" for an assertion row, collapsing the
  # backend's action_name / agent_id / value fields into one form input.
  def assertion_value(assertion)
    assertion = assertion.with_indifferent_access if assertion.respond_to?(:with_indifferent_access)
    assertion[:value].presence || assertion[:action_name].presence || assertion[:agent_id].presence || ''
  end

  def blank_draft
    {
      id: nil, name: '', description: '', target_action_name: '', target_agent_id: '',
      enabled: true, assertions: [{ type: '', value: '', name: '' }],
    }
  end

  def draft_from_params
    {
      id: params[:id].to_s.presence,
      name: params[:name].to_s,
      description: params[:description].to_s,
      target_action_name: params[:target_action_name].to_s,
      target_agent_id: params[:target_agent_id].to_s,
      enabled: bool_param(:enabled),
      assertions: assertion_rows.map do |r|
        { type: r[:type].to_s, value: r[:value].to_s, name: r[:name].to_s }
      end.presence || [{ type: '', value: '', name: '' }],
    }
  end

  # Strongly-typed, allow-listed assertion rows from the form. Each row is a
  # plain {type, value, name} — `type` is validated against ASSERTION_TYPES and
  # `value` is treated as an opaque string that the backend re-validates.
  def assertion_rows
    raw = params[:assertions]
    return [] if raw.blank?

    rows = raw.respond_to?(:values) ? raw.values : Array(raw)
    rows.filter_map do |row|
      permitted =
        if row.respond_to?(:permit)
          row.permit(:type, :value, :name)
        else
          ActionController::Parameters.new(row.to_h).permit(:type, :value, :name)
        end
      next if permitted[:type].to_s.strip.empty?

      permitted
    end
  end

  # Build the exact body Go Overture accepts. tenant_id is intentionally omitted
  # — the backend derives it from the session and rejects any override.
  def eval_payload
    {
      name: params[:name].to_s.strip,
      description: params[:description].to_s.strip,
      target_action_name: params[:target_action_name].to_s.strip,
      target_agent_id: params[:target_agent_id].to_s.strip,
      enabled: bool_param(:enabled),
      assertions_json: build_assertions,
    }
  end

  def build_assertions
    assertion_rows.filter_map do |row|
      type = row[:type].to_s.strip
      meta = ASSERTION_TYPES[type]
      next unless meta

      value = row[:value].to_s.strip
      assertion = { type: type, name: assertion_name(row[:name], type, value) }
      case meta[:requires]
      when :action then assertion[:action_name] = value
      when :agent  then assertion[:agent_id] = value
      end
      assertion
    end
  end

  # A clear default name when the operator leaves the label blank, so result
  # rows read as plain sentences instead of enum names.
  def assertion_name(given, type, value)
    name = given.to_s.strip
    return name if name.present?

    base = ASSERTION_TYPES.dig(type, :label) || type.to_s.tr('_', ' ')
    value.present? ? "#{base}: #{value}" : base
  end

  # Light client-side guidance only; the backend is the source of truth and may
  # still reject a payload we considered valid.
  def validate_draft
    errors = {}
    errors[:name] = 'Give the evaluation a name.' if params[:name].to_s.strip.empty?

    rows = assertion_rows
    if rows.empty?
      errors[:assertions] = 'Add at least one assertion.'
    else
      rows.each do |row|
        meta = ASSERTION_TYPES[row[:type].to_s]
        next unless meta && meta[:requires] != :none

        next if row[:value].to_s.strip.present?

        target = meta[:requires] == :action ? 'an action name' : 'an agent'
        errors[:assertions] = "“#{meta[:label]}” needs #{target}."
        break
      end
    end
    errors
  end

  def bool_param(key)
    %w[1 true t yes on].include?(params[key].to_s.strip.downcase)
  end

  def demo_notice
    'Demo mode — submission is inert and creates no real evaluation. ' \
      'Set OVERTURE_API_BASE_URL to manage evaluations for real.'
  end

  def overture_unavailable(_e)
    @evaluations = []
    @degraded_error = data_source.error || Igris::OvertureClient::Unavailable.new('igris unreachable')
    flash.now[:alert] = 'Igris is unreachable — showing empty state.'
    render :index, status: :service_unavailable
  end
end
