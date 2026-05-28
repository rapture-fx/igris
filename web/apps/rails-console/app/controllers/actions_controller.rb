class ActionsController < ApplicationController
  rescue_from Igris::OvertureClient::Unavailable, with: :overture_unavailable

  def index
    @actions = data_source.actions
    @degraded_error = data_source.error
  end

  def new
    @step = (params[:step].presence || 'identity').to_s
    @step = 'identity' unless %w[identity target policy endpoint].include?(@step)
    @draft = {
      name:         params[:name].presence || 'send_email',
      display_name: params[:display_name],
      description:  params[:description],
      target_type:  params[:target_type].presence || 'mock_demo',
      target_url:   params[:target_url],
      method:       params[:method].presence || 'POST',
      policy:       params[:policy].presence || 'idempotent',
      replay_class: params[:replay_class].presence || 'retryable',
      approval_required: params[:approval_required] == '1',
    }
  end

  def create
    payload = {
      name:              params[:name].to_s.strip,
      display_name:      params[:display_name].to_s.strip.presence || params[:name].to_s.strip.humanize,
      description:       params[:description].to_s,
      target_type:       params[:target_type].to_s,
      target_url:        params[:target_url].to_s,
      method:            params[:method].to_s.upcase.presence || 'POST',
      policy_preset:     params[:policy].to_s,
      replay_class:      params[:replay_class].to_s.presence || 'retryable',
      approval_required: params[:approval_required] == '1',
    }

    if data_source.fixtures?
      flash[:notice] = 'Demo mode — set OVERTURE_API_BASE_URL to create actions for real.'
      return redirect_to action_path(payload[:name].presence || 'send_email')
    end

    action = data_source.create_action(payload)
    redirect_to action_path(action[:name]), notice: "Action “#{action[:name]}” created."
  rescue Igris::OvertureClient::ValidationError => e
    flash.now[:error] = "Invalid action: #{e.message}"
    @step = 'identity'
    @draft = payload.merge(policy: payload[:policy_preset])
    render :new, status: :unprocessable_entity
  rescue Igris::OvertureClient::Conflict => e
    flash.now[:error] = "Name conflict: #{e.message}"
    @step = 'identity'
    @draft = payload.merge(policy: payload[:policy_preset])
    render :new, status: :conflict
  end

  def show
    @action = data_source.find_action(params[:id])
    return head :not_found unless @action
    @tab = (params[:tab].presence || 'overview').to_s
    @runs_for_action = data_source.runs_for_action(@action[:name])
    @degraded_error = data_source.error
  end

  # POST /actions/:id/run  — fire a test run against the live Overture endpoint.
  def run
    @action = data_source.find_action(params[:id])
    return head :not_found unless @action

    if data_source.fixtures?
      redirect_to action_path(@action[:name], tab: 'runs'),
                  notice: 'Demo mode — set OVERTURE_API_BASE_URL to fire real runs.'
      return
    end

    parsed_input =
      if params[:input].present?
        JSON.parse(params[:input])
      else
        {}
      end

    result = data_source.run_action(
      @action[:name],
      input: parsed_input,
      idempotency_key: params[:idempotency_key].presence,
    )

    task_id = result['task_id'] || result['run_id']
    if task_id.present?
      redirect_to run_path(task_id),
                  notice: "Submitted · status=#{result['status']} proof=#{result['proof_status']}"
    else
      redirect_to action_path(@action[:name], tab: 'runs'),
                  notice: 'Submitted but Overture returned no task id.'
    end
  rescue JSON::ParserError
    redirect_to action_path(@action[:name], tab: 'overview'), alert: 'Input must be valid JSON.'
  rescue Igris::OvertureClient::ValidationError => e
    redirect_to action_path(@action[:name], tab: 'overview'), alert: "Invalid: #{e.message}"
  rescue Igris::OvertureClient::PolicyDenied => e
    redirect_to action_path(@action[:name], tab: 'overview'), alert: "Policy denied: #{e.message}"
  rescue Igris::OvertureClient::NotFound
    redirect_to actions_path, alert: 'Action not found in Overture.'
  rescue Igris::OvertureClient::ServiceUnavailable => e
    redirect_to action_path(@action[:name], tab: 'overview'),
                alert: e.code == 'runtime_unavailable' ?
                       'No runtime available. Install or reconnect a runtime, then retry.' :
                       "Overture unavailable: #{e.message}"
  rescue Igris::OvertureClient::Error => e
    redirect_to action_path(@action[:name], tab: 'overview'),
                alert: "Overture error (#{e.status}): #{e.message}"
  end

  private

  def overture_unavailable(_e)
    @actions = []
    @degraded_error = data_source.error || Igris::OvertureClient::Unavailable.new('overture unreachable')
    flash.now[:alert] = 'Overture is unreachable — showing empty state.'
    render :index, status: :service_unavailable
  end
end
