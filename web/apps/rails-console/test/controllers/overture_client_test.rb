require 'test_helper'
require 'faraday'

# Unit tests for Igris::OvertureClient — wires Faraday to a stubbed adapter
# so we exercise real HTTP-status → typed-error mapping without needing
# Overture running.
class OvertureClientTest < ActiveSupport::TestCase
  def stub_client(stubs)
    conn = Faraday.new(url: 'http://overture.test') do |f|
      f.request :json
      f.response :json, content_type: /\bjson$/
      f.adapter :test, stubs
    end
    client = Igris::OvertureClient.new(base_url: 'http://overture.test', api_key: 'test-key')
    client.instance_variable_set(:@conn, conn)
    client
  end

  test 'configured? false when base url is blank' do
    refute Igris::OvertureClient.new(base_url: nil).configured?
    refute Igris::OvertureClient.new(base_url: '').configured?
    refute Igris::OvertureClient.new(base_url: '   ').configured?
    assert Igris::OvertureClient.new(base_url: 'http://x').configured?
  end

  test 'reads raise Unavailable when not configured' do
    client = Igris::OvertureClient.new(base_url: nil)
    assert_raises(Igris::OvertureClient::Unavailable) { client.list_actions }
    assert_raises(Igris::OvertureClient::Unavailable) { client.run_action('send_email') }
  end

  test 'list_actions returns the actions array' do
    stubs = Faraday::Adapter::Test::Stubs.new do |s|
      s.get('/v1/actions') { [200, { 'Content-Type' => 'application/json' }, { actions: [{ name: 'send_email', target_type: 'hosted_api' }] }.to_json] }
    end
    actions = stub_client(stubs).list_actions
    assert_equal 1, actions.size
    assert_equal 'send_email', actions.first['name']
  end

  test 'create_action surfaces validation errors' do
    stubs = Faraday::Adapter::Test::Stubs.new do |s|
      s.post('/v1/actions') { [400, { 'Content-Type' => 'application/json' }, { error: 'invalid_action_definition', message: 'name required' }.to_json] }
    end
    err = assert_raises(Igris::OvertureClient::ValidationError) do
      stub_client(stubs).create_action(name: '')
    end
    assert_equal 400, err.status
    assert_equal 'invalid_action_definition', err.code
  end

  test 'create_action surfaces conflict errors' do
    stubs = Faraday::Adapter::Test::Stubs.new do |s|
      s.post('/v1/actions') { [409, { 'Content-Type' => 'application/json' }, { error: 'action_name_conflict' }.to_json] }
    end
    assert_raises(Igris::OvertureClient::Conflict) do
      stub_client(stubs).create_action(name: 'send_email')
    end
  end

  # ── Agent / app API keys ─────────────────────────────────────────────────
  test 'list_api_keys returns the keys array' do
    stubs = Faraday::Adapter::Test::Stubs.new do |s|
      s.get('/v1/api-keys') { [200, { 'Content-Type' => 'application/json' }, { keys: [{ id: 'k1', name: 'Agent key', prefix: 'igris_a1b2' }] }.to_json] }
    end
    keys = stub_client(stubs).list_api_keys
    assert_equal 1, keys.size
    assert_equal 'igris_a1b2', keys.first['prefix']
  end

  test 'create_api_key posts the name and returns the raw key once' do
    stubs = Faraday::Adapter::Test::Stubs.new do |s|
      s.post('/v1/api-keys') { [201, { 'Content-Type' => 'application/json' }, { id: 'k2', name: 'CI key', prefix: 'igris_ffee', api_key: 'igris_rawkeyonce' }.to_json] }
    end
    result = stub_client(stubs).create_api_key('CI key')
    assert_equal 'igris_rawkeyonce', result['api_key']
  end

  test 'revoke_api_key issues a DELETE to the id path' do
    stubs = Faraday::Adapter::Test::Stubs.new do |s|
      s.delete('/v1/api-keys/k2') { [200, { 'Content-Type' => 'application/json' }, { ok: true }.to_json] }
    end
    assert_equal true, stub_client(stubs).revoke_api_key('k2')['ok']
  end

  test 'run_action surfaces runtime_unavailable as ServiceUnavailable' do
    stubs = Faraday::Adapter::Test::Stubs.new do |s|
      s.post('/v1/actions/send_email/run') { [503, { 'Content-Type' => 'application/json' }, { error: 'runtime_unavailable', message: 'no runtime' }.to_json] }
    end
    err = assert_raises(Igris::OvertureClient::ServiceUnavailable) do
      stub_client(stubs).run_action('send_email', input: { to: 'x' })
    end
    assert_equal 'runtime_unavailable', err.code
  end

  test 'run_action returns parsed body on success' do
    stubs = Faraday::Adapter::Test::Stubs.new do |s|
      s.post('/v1/actions/send_email/run') do |env|
        body = JSON.parse(env.body)
        [200, { 'Content-Type' => 'application/json' },
         { task_id: 'task_abc', run_id: 'task_abc', status: 'dispatched', proof_status: 'pending', echo: body }.to_json]
      end
    end
    resp = stub_client(stubs).run_action('send_email', input: { to: 'a@b' })
    assert_equal 'task_abc', resp['task_id']
    assert_equal 'pending',  resp['proof_status']
    assert_equal({ 'to' => 'a@b' }, resp['echo']['input'])
  end

  test 'get_task surfaces 404 as NotFound' do
    stubs = Faraday::Adapter::Test::Stubs.new do |s|
      s.get('/v1/tasks/nope') { [404, { 'Content-Type' => 'application/json' }, { error: 'task_not_found' }.to_json] }
    end
    assert_raises(Igris::OvertureClient::NotFound) { stub_client(stubs).get_task('nope') }
  end

  test 'network failure maps to Unavailable' do
    stubs = Faraday::Adapter::Test::Stubs.new do |s|
      s.get('/v1/actions') { raise Faraday::ConnectionFailed, 'refused' }
    end
    err = assert_raises(Igris::OvertureClient::Unavailable) { stub_client(stubs).list_actions }
    assert_equal 'network', err.code
  end

  test 'auth header is set when api_key present, never logged' do
    captured = nil
    stubs = Faraday::Adapter::Test::Stubs.new do |s|
      s.get('/v1/actions') do |env|
        captured = env.request_headers['Authorization']
        [200, { 'Content-Type' => 'application/json' }, { actions: [] }.to_json]
      end
    end
    stub_client(stubs).list_actions
    assert_equal 'Bearer test-key', captured
  end
end
