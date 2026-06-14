require 'test_helper'

# Front-door auth — HTTP Basic, env-driven.
#
# When ADMIN_USERNAME and ADMIN_PASSWORD are both set, every controller
# request must present matching Basic credentials. /up bypasses (it is a
# Rack lambda, not a controller). In production, unset credentials fail
# closed; in local test/dev they can stay unset for fixture-mode inspection.
class BasicAuthTest < ActionDispatch::IntegrationTest
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

  def basic_auth(u, p)
    ActionController::HttpAuthentication::Basic.encode_credentials(u, p)
  end

  test 'request without credentials is challenged with 401' do
    get '/home'
    assert_response :unauthorized
    assert_match 'Basic realm="Igris Console"', response.headers['WWW-Authenticate'].to_s
  end

  test 'request with wrong password is rejected with 401' do
    get '/home', headers: { 'HTTP_AUTHORIZATION' => basic_auth('wira', 'wrong') }
    assert_response :unauthorized
  end

  test 'request with wrong username is rejected with 401' do
    get '/home', headers: { 'HTTP_AUTHORIZATION' => basic_auth('not-wira', 'correct-horse-battery-staple') }
    assert_response :unauthorized
  end

  test 'request with empty credentials is rejected with 401' do
    get '/home', headers: { 'HTTP_AUTHORIZATION' => basic_auth('', '') }
    assert_response :unauthorized
  end

  test 'request with correct credentials renders the page' do
    get '/home', headers: { 'HTTP_AUTHORIZATION' => basic_auth('wira', 'correct-horse-battery-staple') }
    assert_response :success
    assert_match 'Give your AI agent a safe action endpoint.', response.body
  end

  test '/up bypasses Basic auth even when configured' do
    get '/up'
    assert_response :success
    assert_equal 'ok', response.body.strip
  end

  test 'production rejects requests when admin credentials are unset' do
    ENV.delete('ADMIN_USERNAME')
    ENV.delete('ADMIN_PASSWORD')
    ENV.delete('OVERTURE_API_BASE_URL')

    ApplicationController.class_eval do
      alias_method :__orig_production_env_basic_auth_test, :production_env?
      define_method(:production_env?) { true }
    end
    begin
      get '/home'
      assert_response :redirect
      assert_match %r{/auth\z}, response.redirect_url

      get '/home', headers: { 'HTTP_AUTHORIZATION' => basic_auth('', '') }
      assert_response :redirect
    ensure
      ApplicationController.class_eval do
        alias_method :production_env?, :__orig_production_env_basic_auth_test
        remove_method :__orig_production_env_basic_auth_test
      end
    end
  end

  test 'short and long passwords behave the same (no length leak)' do
    # secure_compare requires equal-length input — hashing equalizes it.
    # A short wrong password and a long wrong password should both
    # produce the same 401 response.
    get '/home', headers: { 'HTTP_AUTHORIZATION' => basic_auth('wira', 'x') }
    short_status = response.status
    get '/home', headers: { 'HTTP_AUTHORIZATION' => basic_auth('wira', 'x' * 200) }
    long_status = response.status
    assert_equal short_status, long_status
    assert_equal 401, short_status
  end
end
