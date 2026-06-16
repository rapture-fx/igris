require 'test_helper'
require 'faraday'

class CustomerSessionTest < ActiveSupport::TestCase
  setup do
    @prev_base = ENV['OVERTURE_API_BASE_URL']
    ENV['OVERTURE_API_BASE_URL'] = 'http://overture.test'
  end

  teardown do
    ENV['OVERTURE_API_BASE_URL'] = @prev_base
  end

  test 'cookie header is built from Rails cookie jar names only' do
    request = ActionDispatch::TestRequest.create
    request.cookies['better-auth.session_token'] = 'abc'
    header = Igris::CustomerSession.cookie_header_from_request(request)
    assert_equal 'better-auth.session_token=abc', header
  end

  test 'validate returns valid when Overture accepts session' do
    stubs = Faraday::Adapter::Test::Stubs.new do |s|
      s.get('/v1/project') do |env|
        assert_equal 'better-auth.session_token=good', env.request_headers['Cookie']
        assert_nil env.request_headers['Authorization']
        [200, { 'Content-Type' => 'application/json' }, { name: 'Demo' }.to_json]
      end
    end

    conn = Faraday.new(url: 'http://overture.test') do |f|
      f.adapter :test, stubs
    end

    session = Igris::CustomerSession.new(cookie_header: 'better-auth.session_token=good')
    session.instance_variable_set(:@probe_conn, conn)
    assert_equal :valid, session.validate
  end

  test 'validate returns invalid on 401' do
    stubs = Faraday::Adapter::Test::Stubs.new do |s|
      s.get('/v1/project') { [401, { 'Content-Type' => 'application/json' }, { error: 'unauthorized' }.to_json] }
    end
    conn = Faraday.new(url: 'http://overture.test') { |f| f.adapter :test, stubs }
    session = Igris::CustomerSession.new(cookie_header: 'better-auth.session_token=expired')
    session.instance_variable_set(:@probe_conn, conn)
    assert_equal :invalid, session.validate
  end
end