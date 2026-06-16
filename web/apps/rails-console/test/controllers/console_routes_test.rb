require 'test_helper'

# Smoke tests — every page renders. Fixture mode is the default since
# OVERTURE_API_BASE_URL is not set in the test env. Real-mode behavior
# is exercised in overture_client_test.rb and actions_controller_test.rb.
class ConsoleRoutesTest < ActionDispatch::IntegrationTest
  test 'overview renders as a workspace, not an onboarding page' do
    get '/overview?tab=feed'
    assert_response :success
    assert_overview_workspace_page
    get '/overview?tab=attention'
    assert_overview_workspace_page(needs_attention: true)
    refute_match 'Route your first AI action through Igris', response.body
  end

  test 'root sends first-time visitors to /home' do
    get '/'
    assert_redirected_to '/home'
  end

  test 'root sends returning visitors straight to /overview' do
    cookies[:igris_welcomed] = '1'
    get '/'
    assert_redirected_to '/overview'
  end

  test '/home renders the onboarding page inside the console chrome' do
    get '/home'
    assert_response :success
    assert_home_onboarding_page
    assert_match 'Call Igris from your agent', response.body
    assert_match 'Action endpoint', response.body
    assert_match 'Create your first action', response.body
  end

  test 'legacy /welcome redirects to /home' do
    get '/welcome'
    assert_redirected_to '/home'
  end

  test 'entering the console sets the cookie and redirects to /overview' do
    post '/home/enter'
    assert_redirected_to '/overview'
    assert_equal '1', cookies[:igris_welcomed]
  end

  test 'actions index renders with fixture rows' do
    get '/actions'
    assert_response :success
    assert_match 'send_email', response.body
    assert_match 'registered', response.body
  end

  test 'actions wizard renders each step' do
    %w[identity target policy endpoint].each do |step|
      get "/actions/new?step=#{step}&name=send_email"
      assert_response :success
      assert_match step.titleize, response.body
    end
  end

  test 'action show renders all tabs' do
    %w[overview endpoint target policy secrets runs].each do |tab|
      get "/actions/send_email?tab=#{tab}"
      assert_response :success
      assert_match 'send_email', response.body
    end
  end

  test 'action show 404s for unknown id' do
    get '/actions/does_not_exist'
    assert_response :not_found
  end

  test 'runs index renders' do
    get '/runs'
    assert_response :success
    assert_match 'verified', response.body
  end

  test 'run show renders all tabs' do
    %w[story policy recovery proof raw].each do |tab|
      get "/runs/run_01HGJ8K2Z9F?tab=#{tab}"
      assert_response :success
    end
  end

  test 'runtimes index renders fixture runtime ids' do
    get '/runtimes'
    assert_response :success
    assert_match 'rt_prod_01', response.body
  end

  test 'settings index renders' do
    get '/settings'
    assert_response :success
    assert_match 'API endpoints', response.body
  end

  test 'run action in fixture mode just redirects with notice' do
    post '/actions/send_email/run', params: { input: '{}' }
    assert_response :redirect
    follow_redirect!
    assert_match 'Demo mode', response.body
  end

  test 'up returns 200' do
    get '/up'
    assert_response :success
  end
end