require 'test_helper'

# Igris::DataSource normalizes Overture's raw response shapes into the
# field-set the views render. These tests exercise that translation
# without requiring Overture to be reachable.
class DataSourceTest < ActiveSupport::TestCase
  class FakeClient
    def initialize(actions: [], tasks: [], runtimes: [], errors: {}, steps_by_task: {})
      @actions = actions; @tasks = tasks; @runtimes = runtimes; @errors = errors
      @steps_by_task = steps_by_task
    end
    def configured?      = true
    def list_actions     = raise_or(@actions, :list_actions)
    def list_tasks(**)   = raise_or(@tasks, :list_tasks)
    def list_runtimes    = raise_or(@runtimes, :list_runtimes)
    def get_task(id)     = raise_or(@tasks.find { |t| t['task_id'] == id || t[:task_id] == id }, :get_task)
    def get_task_steps(id) = raise_or(@steps_by_task&.dig(id) || [], :get_task_steps)
    def get_action(id)   = @actions.find { |a| a['id'] == id || a[:id] == id || a['name'] == id || a[:name] == id }
    def find_action_by_name(n) = @actions.find { |a| a['name'] == n || a[:name] == n }
    def create_action(p) = p
    def run_action(name, **) = { 'task_id' => 'task_new', 'status' => 'dispatched', 'proof_status' => 'pending' }
    private
    def raise_or(value, key)
      raise @errors[key] if @errors[key]
      value
    end
  end

  test 'fixture mode when client unconfigured' do
    src = Igris::DataSource.new(client: Igris::OvertureClient.new(base_url: nil))
    assert src.fixtures?
    assert_operator src.actions.size, :>, 0
    assert_operator src.runtimes.size, :>, 0
  end

  test 'runtime normalization treats unroutable live runtime as degraded' do
    client = FakeClient.new(runtimes: [{
      'runtime_id' => 'rt_unroutable',
      'status' => 'active',
      'routable' => false,
      'last_seen' => Time.now.iso8601,
      'capability_summary' => ['filesystem'],
    }])

    runtime = Igris::DataSource.new(client: client).runtimes.first

    assert_equal 'rt_unroutable', runtime[:runtime_id]
    assert_equal 'Degraded', runtime[:status]
    assert_equal false, runtime[:routable]
  end

  test 'real mode normalizes hosted_api action' do
    client = FakeClient.new(actions: [{
      'id' => 'a-1', 'name' => 'send_email', 'display_name' => 'Send email',
      'target_type' => 'hosted_api', 'target_url' => 'https://api.resend.com/emails',
      'method' => 'POST', 'policy_preset' => 'Safe automation', 'replay_class' => 'retryable',
      'approval_required' => false, 'irreversible' => false, 'secret_refs' => ['resend_key'],
    }])
    src = Igris::DataSource.new(client: client)
    a = src.actions.first
    assert_equal 'send_email', a[:name]
    assert_equal 'Hosted API', a[:target_label]
    assert_match(/Safe automation/, a[:policy])
    assert_equal 'On', a[:replay]
    assert_equal 'Configured', a[:secrets_state]
    assert_equal 'Ready', a[:setup]
  end

  test 'action normalization redacts unsafe target url before rendering' do
    marker = 'IGRIS_SHOULD_NEVER_PERSIST_INPUT_SECRET'
    client = FakeClient.new(actions: [{
      'id' => 'a-unsafe', 'name' => 'unsafe_webhook',
      'target_type' => 'webhook',
      'target_url' => "https://user:#{marker}@api.example.test/hook?token=#{marker}",
      'method' => 'POST',
    }])

    action = Igris::DataSource.new(client: client).actions.first

    assert_equal 'https://api.example.test/hook?[redacted]', action[:target_url]
    refute_includes action[:target_url], marker
    refute_includes action[:target_url], 'user:'
    assert_equal 'Ready', action[:setup]
  end

  test 'action normalization scrubs unsafe metadata before views receive it' do
    marker = 'IGRIS_SHOULD_NEVER_PERSIST_INPUT_SECRET'
    client = FakeClient.new(actions: [{
      'id' => 'a-sensitive', 'name' => 'sensitive_webhook',
      'target_type' => 'webhook',
      'target_url' => "https://user:#{marker}@api.example.test/hook?token=#{marker}",
      'method' => 'POST',
      'target_metadata' => {
        'headers' => {
          'Authorization' => "Bearer #{marker}",
          'Cookie' => "session=#{marker}",
          'Content-Type' => 'application/json',
        },
        'request_body' => marker,
        'file_path' => "/Users/customer/private/#{marker}.json",
      },
    }])

    action = Igris::DataSource.new(client: client).actions.first
    encoded = action.to_json

    refute_includes encoded, marker
    refute_includes encoded, 'Bearer'
    refute_includes encoded, 'session='
    refute_includes encoded, '/Users/customer/private'
    refute_includes encoded, '?token='
    assert_includes encoded, 'input_redacted'
    assert_includes encoded, 'input_digest_sha256'
    assert_includes encoded, Igris::DataSource::REDACTION_POLICY_VERSION
  end

  test 'local_runtime action without runtime shows Needs runtime setup' do
    client = FakeClient.new(actions: [{
      'name' => 'rebuild_index', 'target_type' => 'local_runtime',
      'target_url' => '', 'policy_preset' => 'single_flight',
    }])
    a = Igris::DataSource.new(client: client).actions.first
    assert_equal 'Needs runtime', a[:setup]
  end

  test 'webhook missing url is flagged Needs target' do
    client = FakeClient.new(actions: [{
      'name' => 'foo', 'target_type' => 'webhook', 'target_url' => '',
    }])
    a = Igris::DataSource.new(client: client).actions.first
    assert_equal 'Needs target', a[:setup]
  end

  test 'run summary maps overture status and routed_via' do
    client = FakeClient.new(tasks: [{
      'task_id' => 't1', 'status' => 'completed', 'executed_target' => 'hosted_api',
      'runtime_id' => '', 'policy_preset' => 'idempotent',
      'dispatched_at' => 1.minute.ago.iso8601, 'completed_at' => Time.now.iso8601,
      'proof' => { 'status' => 'verified', 'verified' => true },
    }])
    runs = Igris::DataSource.new(client: client).all_runs
    assert_equal 'Succeeded', runs.first[:status]
    assert_equal 'Hosted API', runs.first[:routed_via]
    assert_equal 'Proof verified', runs.first[:proof]
  end

  test 'run detail builds story and raw evidence honestly when proof missing' do
    client = FakeClient.new(tasks: [{
      'task_id' => 't2', 'status' => 'failed', 'executed_target' => 'webhook',
      'failure_reason' => 'HTTP 402',
      'dispatched_at' => 5.minutes.ago.iso8601, 'completed_at' => 4.minutes.ago.iso8601,
    }])
    detail = Igris::DataSource.new(client: client).find_run('t2')
    assert detail
    titles = detail[:story].map { |s| s[:title] }
    assert_includes titles, 'Action received'
    assert_includes titles, 'Side effect failed'
    refute_includes titles, 'Receipt signed'  # no proof → no proof step
    refute(detail[:raw_evidence].any? { |row| row[:value].to_s.include?('redacted') && row[:key] != 'receipt_hash' })
  end

  test 'run detail uses safe input summary digest only' do
    marker = 'IGRIS_ENCRYPTED_INPUT_SECRET_MARKER'
    digest = 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd'
    client = FakeClient.new(tasks: [{
      'task_id' => 't-input', 'status' => 'completed',
      'input_summary' => {
        'input_redacted' => true,
        'input_digest_sha256' => digest,
        'encrypted_input_refs' => [{
          'encrypted_input_ref_id' => '11111111-1111-1111-1111-111111111111',
          'purpose' => 'execution_payload',
        }],
      },
      'request' => { 'body' => marker, 'ciphertext' => marker },
    }])

    detail = Igris::DataSource.new(client: client).find_run('t-input')

    assert_equal 'abc123def456ab…', detail[:request_digest]
    refute_equal marker, detail[:request_summary]
  end

  test 'run detail recursively scrubs historical unsafe input fields' do
    marker = 'IGRIS_SHOULD_NEVER_PERSIST_INPUT_SECRET'
    digest = 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd'
    client = FakeClient.new(tasks: [{
      'task_id' => 't-sensitive', 'status' => 'failed',
      'executed_target' => 'hosted_api',
      'input_summary' => {
        'input_redacted' => true,
        'input_digest_sha256' => digest,
        'input_bytes' => 128,
      },
      'request' => {
        'body' => marker,
        'headers' => {
          'Authorization' => "Bearer #{marker}",
          'Cookie' => "session=#{marker}",
        },
        'path' => "/Users/customer/private/#{marker}.json",
      },
      'failure_reason' => "Authorization: Bearer #{marker}",
    }])

    detail = Igris::DataSource.new(client: client).find_run('t-sensitive')
    encoded = detail.to_json

    assert_equal 'abc123def456ab…', detail[:request_digest]
    assert_equal 'failure details redacted', detail[:failure_reason]
    refute_includes encoded, marker
    refute_includes encoded, 'Bearer'
    refute_includes encoded, 'session='
    refute_includes encoded, '/Users/customer/private'
    assert_includes encoded, 'input_redacted'
    assert_includes encoded, 'input_digest_sha256'
  end

  test 'execution steps map safely and drop reasons, targets, and signatures' do
    client = FakeClient.new(
      tasks: [{ 'task_id' => 't9', 'status' => 'completed', 'executed_target' => 'local_runtime', 'runtime_id' => 'rt_x' }],
      steps_by_task: { 't9' => [
        { 'step_index' => 0, 'step_type' => { 'ToolCall' => { 'tool_name' => 'read_file' } },
          'status' => 'Committed', 'output_digest' => 'abcdef0123456789feedface',
          'signature' => 'SIGNATURE==', 'runtime_id' => 'rt_x', 'timestamp_ms' => 1_700_000_000_000 },
        { 'step_index' => 1, 'step_type' => { 'RoboticsAction' => { 'action' => 'navigate', 'target' => 'host.internal' } },
          'status' => { 'Failed' => { 'reason' => 'boom at 10.0.0.9' } }, 'input_digest' => 'rawinput' },
      ] },
    )
    steps = Igris::DataSource.new(client: client).find_run('t9')[:execution_steps]
    assert_equal 2, steps.size
    assert_equal 'read_file', steps[0][:label]
    assert_equal 'tool_call', steps[0][:kind]
    assert_equal 'Committed', steps[0][:status]
    assert_equal 'Signed', steps[0][:proof]
    assert steps[0][:digest].start_with?('abcdef01234567')
    assert steps[0][:digest].end_with?('…')
    assert_equal 'Failed', steps[1][:status]
    assert_equal 'navigate', steps[1][:label]
    assert_equal '—', steps[1][:proof] # no signature

    flat = steps.flat_map { |s| s.values.map(&:to_s) }.join(' ')
    ['host.internal', '10.0.0.9', 'boom', 'SIGNATURE==', 'rawinput'].each do |secret|
      refute_includes flat, secret, "step mapping leaked: #{secret}"
    end
  end

  test 'runtime normalization never exposes hostname' do
    client = FakeClient.new(runtimes: [{
      'runtime_id' => 'rt_x', 'status' => 'healthy', 'capabilities' => ['http_call'],
      'hostname_cached' => 'internal.example', 'ip_address' => '10.0.0.5',
      'last_seen_at' => 1.minute.ago.iso8601,
    }])
    rt = Igris::DataSource.new(client: client).runtimes.first
    assert_equal 'rt_x', rt[:runtime_id]
    assert_nil rt[:host]
    refute rt.values.any? { |v| v.to_s.include?('internal.example') || v.to_s.include?('10.0.0.5') }
  end

  test 'errors are captured and surface empty state' do
    client = FakeClient.new(errors: { list_actions: Igris::OvertureClient::ServerError.new('boom', status: 500) })
    src = Igris::DataSource.new(client: client)
    assert_equal [], src.actions
    assert src.degraded?
    assert_equal 500, src.error.status
  end
end
