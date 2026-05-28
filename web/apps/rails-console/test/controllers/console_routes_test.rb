require 'test_helper'

class ConsoleRoutesTest < ActionDispatch::IntegrationTest
  test 'home renders' do
    get '/home'
    assert_response :success
    assert_match 'Keep your AI stack', response.body
    assert_match 'Setup guide', response.body
  end

  test 'root redirects to home' do
    get '/'
    assert_redirected_to '/home'
  end

  test 'actions index renders with fixture rows' do
    get '/actions'
    assert_response :success
    assert_match 'send_email', response.body
    assert_match 'Registry', response.body
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

  test 'runtimes index renders' do
    get '/runtimes'
    assert_response :success
    assert_match 'igris-runtime-prod-01', response.body
  end

  test 'settings index renders' do
    get '/settings'
    assert_response :success
    assert_match 'API keys', response.body
  end

  test 'up returns 200' do
    get '/up'
    assert_response :success
  end
end
