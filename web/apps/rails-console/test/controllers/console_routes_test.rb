require 'test_helper'

# Smoke tests — every page renders. Fixture mode is the default since
# OVERTURE_API_BASE_URL is not set in the test env. Real-mode behavior
# is exercised in overture_client_test.rb and actions_controller_test.rb.
class ConsoleRoutesTest < ActionDispatch::IntegrationTest
  test 'home renders' do
    get '/home'
    assert_response :success
    assert_match 'Run agent actions that recover', response.body
    assert_match 'Create an action', response.body
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

  test '/welcome renders the onboarding page' do
    get '/welcome'
    assert_response :success
    assert_match 'Welcome to Igris Inertial', response.body
    assert_match 'Create an action', response.body
    assert_match 'Enter console', response.body
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
    %w[identity target policy endpoint].each do |step|
      get "/actions/new?step=#{step}"
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
    assert_match 'API keys', response.body
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
