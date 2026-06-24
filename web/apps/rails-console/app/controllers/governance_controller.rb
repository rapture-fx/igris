# frozen_string_literal: true

# Governance — a thin hub that presents the four governance surfaces as one
# workflow rather than four unrelated concepts: Recommendations (what needs
# attention), Evaluations (does behavior meet the bar), Policy proposals (review
# a change before it ships), and Policy simulation (try a rule against past
# runs). Each card links to the existing surface that already implements it — no
# new backend, no duplicated workflow.
class GovernanceController < ApplicationController
  def index
    @degraded_error = data_source.error
  end
end
