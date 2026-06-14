require 'test_helper'

class CustomerSessionAuthTest < ActionDispatch::IntegrationTest
  VALID_COOKIE = 'better-auth.session_token=signed.valid.session'

  setup do
    @prev_user = ENV['ADMIN_USERNAME']
    @prev_pass = ENV['ADMIN_PASSWORD']
    @prev_overture = ENV['OVERTURE_API_BASE_URL']
    ENV.delete('ADMIN_USERNAME')
    ENV.delete('ADMIN_PASSWORD')
    ENV['OVERTURE_API_BASE_URL'] = 'http://overture.test'

    @orig_validate = Igris::CustomerSession.instance_method(:validate)
    Igris::CustomerSession.define_method(:validate) do
      cookie_header.include?('valid.session') ? :valid : :invalid
    end
  end

  teardown do
    ENV['ADMIN_USERNAME'] = @prev_user
    ENV['ADMIN_PASSWORD'] = @prev_pass
    ENV['OVERTURE_API_BASE_URL'] = @prev_overture
    Igris::CustomerSession.define_method(:validate, @orig_validate)
  end

  test 'valid customer session reaches /home without Basic Auth' do
    get '/home', headers: { 'HTTP_COOKIE' => VALID_COOKIE }
    assert_response :success
    # /home is onboarding inside console chrome; everyday workspace is /overview.
    assert_match 'Give your AI agent a safe action endpoint.', response.body
    assert_match 'ic-rail', response.body
    assert_match 'Go to Overview', response.body
    refute_match 'Workspace views', response.body
  end

  test 'invalid customer session is denied' do
    get '/home', headers: { 'HTTP_COOKIE' => 'better-auth.session_token=bad' }
    assert_response :redirect
    assert_match %r{/auth\z}, response.redirect_url
  end

  test 'missing session is denied when customer auth is configured' do
    get '/home'
    assert_response :redirect
    assert_match %r{/auth\z}, response.redirect_url
  end

  test 'admin Basic Auth still works as fallback when configured' do
    ENV['ADMIN_USERNAME'] = 'wira'
    ENV['ADMIN_PASSWORD'] = 'correct-horse-battery-staple'
    creds = ActionController::HttpAuthentication::Basic.encode_credentials('wira', 'correct-horse-battery-staple')

    get '/home', headers: { 'HTTP_AUTHORIZATION' => creds }
    assert_response :success
  end

  test 'production fails closed when neither customer nor admin auth is configured' do
    ENV.delete('OVERTURE_API_BASE_URL')

    ApplicationController.class_eval do
      alias_method :__orig_production_env_customer_auth_test, :production_env?
      define_method(:production_env?) { true }
    end
    begin
      get '/home'
      assert_response :redirect
      assert_match %r{/auth\z}, response.redirect_url
    ensure
      ApplicationController.class_eval do
        alias_method :production_env?, :__orig_production_env_customer_auth_test
        remove_method :__orig_production_env_customer_auth_test
      end
    end
  end

  test 'customer session uses session cookie for Overture not service API key' do
    captured_auth = nil
    captured_cookie = nil

    stubs = Faraday::Adapter::Test::Stubs.new do |s|
      s.get('/v1/actions') do |env|
        captured_auth = env.request_headers['Authorization']
        captured_cookie = env.request_headers['Cookie']
        [200, { 'Content-Type' => 'application/json' }, { actions: [] }.to_json]
      end
    end

    conn = Faraday.new(url: 'http://overture.test') do |f|
      f.request :json
      f.response :json, content_type: /\bjson$/
      f.adapter :test, stubs
    end

    client = Igris::OvertureClient.new(
      base_url: 'http://overture.test',
      api_key: 'igris_service_secret_never_forward',
      session_cookie: VALID_COOKIE,
    )
    client.instance_variable_set(:@conn, conn)
    client.list_actions

    assert_nil captured_auth
    assert_equal VALID_COOKIE, captured_cookie
  end
end