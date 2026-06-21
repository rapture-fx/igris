# frozen_string_literal: true

# Policy Proposals — operator UX for the policy proposal lifecycle in Go
# Overture. An operator saves a simulated policy rule as a draft, re-simulates it
# over fresh execution truth, marks it ready for review, and (optionally) approves
# it. Approval is governance metadata only: NOTHING here mutates active policy,
# replays runs, or dispatches tasks.
#
# Boundary: Go Overture is the source of truth. It validates every field, derives
# tenant identity server-side, reuses the read-only simulation engine, and
# persists only safe metadata, allow-listed criteria, and safe simulation
# summaries. Rails never persists proposals and never sends tenant_id. This
# surface lives under the Runs lens (no new top-level navigation) and never
# renders prompts, raw bodies, secrets, or arbitrary JSON as the primary view.
class PolicyProposalsController < ApplicationController
  rescue_from Igris::OvertureClient::Unavailable, with: :overture_unavailable

  # Operator-facing label => API token. The backend re-validates every value.
  RANGES = {
    '24h' => 'Last 24 hours',
    '7d'  => 'Last 7 days',
    '30d' => 'Last 30 days',
  }.freeze
  MODES = {
    'require_approval' => 'Require approval',
    'block'           => 'Block',
  }.freeze
  MATCH_KINDS = {
    'match_action_name'   => 'Action name is',
    'match_action_prefix' => 'Action name starts with',
    'match_agent_id'      => 'Agent ID is',
    'match_agent_type'    => 'Agent type is',
  }.freeze
  STATUSES = %w[
    completed failed canceled approval_required dispatched in_flight running pending
  ].freeze

  helper_method :proposal_ranges, :proposal_modes, :proposal_match_kinds,
                :proposal_statuses, :match_kind_for, :match_value_for

  def index
    @proposals = data_source.policy_proposals
    @degraded_error = data_source.error
  end

  def show
    @proposal = data_source.find_policy_proposal(params[:id])
    return head :not_found unless @proposal

    @errors = {}
    @degraded_error = data_source.error
  end

  def new
    # Prefilled from the Policy Simulation card's "Save as proposal" link when
    # those params are present; otherwise a blank draft.
    @proposal = draft_from_params
    @errors = {}
  end

  def create
    @proposal = draft_from_params

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

    created = data_source.create_policy_proposal(proposal_payload)
    redirect_to proposal_path(created[:id]), notice: "Proposal “#{created[:name]}” saved as a draft."
  rescue Igris::OvertureClient::ValidationError => e
    @errors = { base: e.message }
    flash.now[:error] = "Invalid proposal: #{e.message}"
    render :new, status: :unprocessable_entity
  end

  def edit
    @proposal = data_source.find_policy_proposal(params[:id])
    return head :not_found unless @proposal

    unless @proposal[:editable]
      return redirect_to proposal_path(@proposal[:id]),
                         alert: 'Only a draft proposal can be edited. Move it back to draft first.'
    end
    @errors = {}
  end

  def update
    @proposal = draft_from_params.merge(id: params[:id].to_s)

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

    updated = data_source.update_policy_proposal(params[:id], proposal_payload)
    redirect_to proposal_path(updated[:id]), notice: "Proposal “#{updated[:name]}” updated."
  rescue Igris::OvertureClient::NotFound
    redirect_to proposals_path, alert: 'Proposal not found.'
  rescue Igris::OvertureClient::Conflict
    redirect_to proposal_path(params[:id]), alert: 'This proposal can no longer be edited in its current state.'
  rescue Igris::OvertureClient::ValidationError => e
    @errors = { base: e.message }
    flash.now[:error] = "Invalid proposal: #{e.message}"
    render :edit, status: :unprocessable_entity
  end

  def destroy
    if data_source.fixtures?
      return redirect_to proposals_path, alert: 'Demo mode — nothing was archived. Set OVERTURE_API_BASE_URL.'
    end

    data_source.archive_policy_proposal(params[:id])
    redirect_to proposals_path, notice: 'Proposal archived.'
  rescue Igris::OvertureClient::NotFound
    redirect_to proposals_path, alert: 'Proposal not found.'
  rescue Igris::OvertureClient::Error
    redirect_to proposals_path, alert: 'Could not archive the proposal right now.'
  end

  # POST /runs/proposals/:id/simulate — re-run the read-only simulation over fresh
  # execution truth and attach the safe summary as evidence.
  def simulate
    if data_source.fixtures?
      return redirect_to proposal_path(params[:id]),
                         alert: 'Demo mode — simulation is inert here. Set OVERTURE_API_BASE_URL.'
    end

    proposal = data_source.simulate_policy_proposal(params[:id])
    redirect_to proposal_path(proposal[:id]), notice: 'Re-simulated over recent runs.'
  rescue Igris::OvertureClient::NotFound
    redirect_to proposals_path, alert: 'Proposal not found.'
  rescue Igris::OvertureClient::Error
    redirect_to proposal_path(params[:id]), alert: 'Could not simulate this proposal right now.'
  end

  # POST /runs/proposals/:id/approve — approve a reviewed proposal. Governance
  # only; this never promotes the rule into live policy.
  def approve
    if data_source.fixtures?
      return redirect_to proposal_path(params[:id]),
                         alert: 'Demo mode — approval is inert here. Set OVERTURE_API_BASE_URL.'
    end

    proposal = data_source.approve_policy_proposal(params[:id])
    redirect_to proposal_path(proposal[:id]), notice: 'Proposal approved. It is not yet promoted to live policy.'
  rescue Igris::OvertureClient::NotFound
    redirect_to proposals_path, alert: 'Proposal not found.'
  rescue Igris::OvertureClient::Conflict => e
    redirect_to proposal_path(params[:id]), alert: approve_conflict_message(e)
  rescue Igris::OvertureClient::Error
    redirect_to proposal_path(params[:id]), alert: 'Could not approve this proposal right now.'
  end

  # POST /runs/proposals/:id/ready — toggle review readiness (draft<->review_ready).
  def ready
    if data_source.fixtures?
      return redirect_to proposal_path(params[:id]),
                         alert: 'Demo mode — status changes are inert here. Set OVERTURE_API_BASE_URL.'
    end

    target = params[:to].to_s == 'draft' ? 'draft' : 'review_ready'
    proposal = data_source.update_policy_proposal(params[:id], { status: target })
    notice = target == 'review_ready' ? 'Proposal marked ready for review.' : 'Proposal moved back to draft.'
    redirect_to proposal_path(proposal[:id]), notice: notice
  rescue Igris::OvertureClient::NotFound
    redirect_to proposals_path, alert: 'Proposal not found.'
  rescue Igris::OvertureClient::Conflict
    redirect_to proposal_path(params[:id]), alert: 'That status change is not allowed right now.'
  rescue Igris::OvertureClient::Error
    redirect_to proposal_path(params[:id]), alert: 'Could not update this proposal right now.'
  end

  private

  def proposal_ranges       = RANGES
  def proposal_modes        = MODES
  def proposal_match_kinds  = MATCH_KINDS
  def proposal_statuses     = STATUSES

  # The single match-kind selector collapses the four optional action/agent
  # criteria into one row, picking the first populated criterion for display.
  def match_kind_for(criteria)
    criteria = criteria || {}
    MATCH_KINDS.keys.find { |k| criteria[k.to_sym].to_s.present? } || 'match_action_prefix'
  end

  def match_value_for(criteria)
    criteria = criteria || {}
    key = match_kind_for(criteria)
    criteria[key.to_sym].to_s
  end

  # A blank or prefilled draft used to render the form (new / re-render on error).
  def draft_from_params
    {
      id: params[:id].to_s.presence,
      name: params[:name].to_s,
      description: params[:description].to_s,
      policy_mode: normalized_mode,
      status: 'draft',
      status_label: 'Draft',
      editable: true,
      match_criteria: form_criteria,
      last_simulation: nil,
      events: [],
    }
  end

  # The criteria hash in the same normalized shape the DataSource produces, so the
  # form re-renders identically from either a saved proposal or submitted params.
  def form_criteria
    criteria = { range: normalized_range }
    MATCH_KINDS.each_key { |k| criteria[k.to_sym] = '' }
    kind = params[:match_kind].to_s
    value = params[:match_value].to_s.strip
    criteria[kind.to_sym] = value[0, 256] if MATCH_KINDS.key?(kind) && value.present?

    status = params[:match_result_status].to_s
    criteria[:match_result_status] = STATUSES.include?(status) ? status : ''
    criteria[:require_proof_missing]     = bool_param(:require_proof_missing)
    criteria[:require_recovery_occurred] = bool_param(:require_recovery_occurred)
    criteria[:require_eval_failed]       = bool_param(:require_eval_failed)
    criteria
  end

  # The exact body Go Overture accepts. tenant_id is intentionally omitted — the
  # backend derives it from the session and rejects any override.
  def proposal_payload
    { name: params[:name].to_s.strip, description: params[:description].to_s.strip,
      policy_mode: normalized_mode, match_criteria_json: criteria_payload }
  end

  # Only allow-listed, populated criteria are forwarded. Empty values are dropped
  # so the backend stores a clean object.
  def criteria_payload
    payload = { range: normalized_range }
    kind = params[:match_kind].to_s
    value = params[:match_value].to_s.strip
    payload[kind.to_sym] = value[0, 256] if MATCH_KINDS.key?(kind) && value.present?

    status = params[:match_result_status].to_s
    payload[:match_result_status] = status if STATUSES.include?(status)
    payload[:require_proof_missing]     = true if bool_param(:require_proof_missing)
    payload[:require_recovery_occurred] = true if bool_param(:require_recovery_occurred)
    payload[:require_eval_failed]       = true if bool_param(:require_eval_failed)
    payload
  end

  def normalized_range
    RANGES.key?(params[:range].to_s) ? params[:range].to_s : '30d'
  end

  def normalized_mode
    MODES.key?(params[:policy_mode].to_s) ? params[:policy_mode].to_s : 'require_approval'
  end

  # Light client-side guidance only; the backend is the source of truth.
  def validate_draft
    errors = {}
    errors[:name] = 'Give the proposal a name.' if params[:name].to_s.strip.empty?
    errors
  end

  def approve_conflict_message(error)
    case error.code.to_s
    when 'not_simulated' then 'Simulate the proposal before approving it.'
    else 'Only a proposal marked ready for review can be approved.'
    end
  end

  def bool_param(key)
    %w[1 true t yes on].include?(params[key].to_s.strip.downcase)
  end

  def demo_notice
    'Demo mode — submission is inert and creates no real proposal. ' \
      'Set OVERTURE_API_BASE_URL to manage proposals for real.'
  end

  def overture_unavailable(_e)
    @proposals = []
    @degraded_error = data_source.error || Igris::OvertureClient::Unavailable.new('igris unreachable')
    flash.now[:alert] = 'Igris is unreachable — showing empty state.'
    render :index, status: :service_unavailable
  end
end
