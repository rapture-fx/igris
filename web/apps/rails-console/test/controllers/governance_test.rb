require 'test_helper'

# Governance hub — presents the four governance surfaces as one workflow and
# links to the existing implementations under the Runs lens. Adds no backend.
class GovernanceTest < ActionDispatch::IntegrationTest
  test 'governance hub names the four governance surfaces' do
    get '/governance'
    assert_response :success
    assert_select '.ic-topbar__title', text: 'Governance'
    assert_match 'Recommendations', response.body
    assert_match 'Evaluations', response.body
    assert_match 'Policy proposals', response.body
    assert_match 'Policy simulation', response.body
  end

  test 'governance cards link to the existing surfaces' do
    get '/governance'
    assert_select "a[href=?]", evaluations_path
    assert_select "a[href=?]", proposals_path
    assert_select "a[href=?]", runs_path(view: 'intelligence')
  end
end
