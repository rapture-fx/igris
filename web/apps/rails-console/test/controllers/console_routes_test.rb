require 'test_helper'

# Smoke tests — every page renders. Fixture mode is the default since
# OVERTURE_API_BASE_URL is not set in the test env. Real-mode behavior
# is exercised in overture_client_test.rb and actions_controller_test.rb.
class ConsoleRoutesTest < ActionDispatch::IntegrationTest
  test 'home renders as a workspace, not an onboarding page' do
    get '/home?tab=feed'
    assert_response :success
    assert_match 'Workspace', response.body
    # Needs-attention now lives on its own tab, not the feed.
    get '/home?tab=attention'
    assert_match 'Needs attention', response.body
    # Education copy now lives on /welcome, not /home.
    refute_match 'Give your AI agent a safe action endpoint.', response.body
    refute_match 'Route your first AI action through Igris', response.body
  end

  test 'root sends first-time visitors to /welcome' do
    get '/'
    assert_redirected_to '/welcome'
  end

  test 'root sends returning visitors straight to /home' do
    cookies[:igris_welcomed] = '1'
    get '/'
    assert_redirected_to '/home'
  end

  test '/welcome renders the onboarding page inside the console chrome' do
    get '/welcome'
    assert_response :success
    assert_match 'Give your AI agent a safe action endpoint.', response.body
    assert_match 'Your first action', response.body
    assert_match 'Create your first action', response.body
    assert_match 'Go to Overview', response.body
    assert_match 'ic-rail', response.body # rendered with the icon rail, not standalone
  end

  test 'entering the console sets the cookie and redirects to /home' do
    post '/welcome/enter'
    assert_redirected_to '/home'
    assert_equal '1', cookies[:igris_welcomed]
  end

  test 'actions index renders with fixture rows' do
    get '/actions'
    assert_response :success
    assert_match 'send_email', response.body
    assert_match 'registered', response.body
  end

  test 'actions wizard renders each step' do
    # A valid name is required to advance past identity; pass one so each
    # later step renders instead of bouncing back to identity.
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
