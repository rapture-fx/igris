require 'test_helper'

# Overview operating model — a compact, operational explainer of the execution
# lifecycle (Run / Recover / Prove / Evaluate / Govern). It orients a first-time
# operator without docs, uses operational (not marketing) language, and links
# each stage to the surface where that step is observed or governed.
class OverviewOperatingModelTest < ActionDispatch::IntegrationTest
  test 'overview renders the operating model with all five lifecycle stages' do
    get overview_path
    assert_response :success
    assert_select '.ic-opmodel'
    %w[Run Recover Prove Evaluate Govern].each do |stage|
      assert_select '.ic-opmodel__label', text: stage
    end
  end

  test 'each operating-model stage links to an existing console surface' do
    get overview_path
    assert_response :success
    assert_select 'a.ic-opmodel__stage[href=?]', runs_path
    assert_select 'a.ic-opmodel__stage[href=?]', evaluations_path
    assert_select 'a.ic-opmodel__stage[href=?]', runs_path(view: 'intelligence')
  end
end
