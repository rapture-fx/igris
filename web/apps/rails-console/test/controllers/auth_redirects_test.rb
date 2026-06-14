require 'test_helper'

class AuthRedirectsTest < ActionDispatch::IntegrationTest
  setup do
    @prev_user = ENV['ADMIN_USERNAME']
    @prev_pass = ENV['ADMIN_PASSWORD']
    ENV['ADMIN_USERNAME'] = 'wira'
    ENV['ADMIN_PASSWORD'] = 'correct-horse-battery-staple'
  end

  teardown do
    ENV['ADMIN_USERNAME'] = @prev_user
    ENV['ADMIN_PASSWORD'] = @prev_pass
  end

  test 'onboarding redirects to welcome without basic auth' do
    get '/onboarding'
    assert_redirected_to '/welcome'
  end

  test 'dashboard redirects to home without basic auth' do
    get '/dashboard'
    assert_redirected_to '/home'
  end

  test 'reset-password without token renders handoff page without basic auth' do
    get '/reset-password'
    assert_response :success
    assert_match 'Reset your password', response.body
    assert_match 'igrisinertial.com/auth', response.body
  end

  test 'reset-password with token redirects to landing auth with query preserved' do
    get '/reset-password', params: { token: 'reset-token-abc' }
    assert_redirected_to 'https://igrisinertial.com/auth?token=reset-token-abc'
  end

  test 'reset-password respects LANDING_URL override' do
    prev = ENV['LANDING_URL']
    ENV['LANDING_URL'] = 'http://localhost:3000'
    begin
      get '/reset-password', params: { token: 'xyz' }
      assert_redirected_to 'http://localhost:3000/auth?token=xyz'
    ensure
      ENV['LANDING_URL'] = prev
    end
  end
end