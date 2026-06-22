# frozen_string_literal: true

# Trust Recommendation lifecycle actions — acknowledge / snooze / resolve /
# reactivate a deterministic finding. This is operator triage only: Go Overture
# stores just the status, an optional safe note, and timestamps, keyed by the
# stable recommendation id. Nothing here mutates execution data, policy, or
# proposals, and recommendation generation stays deterministic. The surface lives
# under Runs > Intelligence (no new top-level navigation); every action redirects
# back to that tab with the active filter and range preserved.
class TrustRecommendationsController < ApplicationController
  rescue_from Igris::OvertureClient::Unavailable, with: :overture_unavailable

  STATUSES = %w[active acknowledged snoozed resolved].freeze
  SNOOZE_DURATIONS = %w[1d 7d 30d].freeze

  def update
    rec_id = params[:rec_id].to_s
    status = params[:status].to_s
    return back_to_intel(alert: 'Unknown lifecycle action.') unless STATUSES.include?(status)
    return back_to_intel(alert: 'Missing recommendation reference.') if rec_id.empty?

    if data_source.fixtures?
      return back_to_intel(alert: 'Demo mode — lifecycle changes are inert. Set OVERTURE_API_BASE_URL to triage for real.')
    end

    snooze = SNOOZE_DURATIONS.include?(params[:snooze_duration].to_s) ? params[:snooze_duration].to_s : nil
    reason = params[:reason].to_s.strip.presence
    data_source.update_trust_recommendation_state(rec_id, status: status, reason: reason, snooze_duration: snooze)
    back_to_intel(notice: state_notice(status))
  rescue Igris::OvertureClient::ValidationError => e
    back_to_intel(alert: "Could not update this recommendation: #{e.message}")
  rescue Igris::OvertureClient::Error
    back_to_intel(alert: 'Could not update this recommendation right now. Try again in a moment.')
  end

  private

  def back_to_intel(**flash)
    redirect_to runs_path(view: 'intelligence', range: params[:range].presence, trust_state: params[:trust_state].presence), **flash
  end

  def state_notice(status)
    case status
    when 'acknowledged' then 'Recommendation acknowledged.'
    when 'snoozed'      then 'Recommendation snoozed.'
    when 'resolved'     then 'Recommendation resolved.'
    else 'Recommendation reactivated.'
    end
  end

  def overture_unavailable(_e)
    back_to_intel(alert: 'Igris is unreachable — no change was made.')
  end
end
