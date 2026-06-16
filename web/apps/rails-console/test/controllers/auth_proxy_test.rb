require 'test_helper'
require 'net/http'

class AuthProxyTest < ActionDispatch::IntegrationTest
  setup do
    @prev_upstream = ENV['BETTER_AUTH_UPSTREAM_URL']
    ENV['BETTER_AUTH_UPSTREAM_URL'] = 'http://auth-upstream.test/api/auth'
  end

  teardown do
    ENV['BETTER_AUTH_UPSTREAM_URL'] = @prev_upstream
    AuthProxyController.class_eval do
      if method_defined?(:__orig_proxy_request_auth_proxy_test, false)
        alias_method :proxy_request, :__orig_proxy_request_auth_proxy_test
        remove_method :__orig_proxy_request_auth_proxy_test
      end
    end
  end

  test 'auth proxy is reachable without console gate' do
    fake = build_fake_response('200', '{"session":null}', 'Content-Type' => 'application/json')
    stub_proxy_request(fake)

    get '/api/auth/get-session'
    assert_response :success
    assert_equal '{"session":null}', response.body
  end

  test 'auth proxy returns 503 when upstream is not configured' do
    ENV.delete('BETTER_AUTH_UPSTREAM_URL')
    get '/api/auth/get-session'
    assert_response :service_unavailable
    body = JSON.parse(response.body)
    assert_equal 'AUTH_UPSTREAM_MISSING', body['code']
  end

  private

  def build_fake_response(code, body, headers = {})
    response = Net::HTTPResponse.send(:response_class, code).new('1.0', code, 'OK')
    response.instance_variable_set(:@body, body)
    response.instance_variable_set(:@read, true)
    headers.each { |k, v| response[k] = v }
    response
  end

  def stub_proxy_request(fake_response)
    AuthProxyController.class_eval do
      alias_method :__orig_proxy_request_auth_proxy_test, :proxy_request
      define_method(:proxy_request) { |_target| fake_response }
    end
  end
end