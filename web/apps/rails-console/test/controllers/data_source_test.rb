require 'test_helper'

# Igris::DataSource normalizes Overture's raw response shapes into the
# field-set the views render. These tests exercise that translation
# without requiring Overture to be reachable.
class DataSourceTest < ActiveSupport::TestCase
  class FakeClient
    def initialize(actions: [], tasks: [], runtimes: [], errors: {})
      @actions = actions; @tasks = tasks; @runtimes = runtimes; @errors = errors
    end
    def configured?      = true
    def list_actions     = raise_or(@actions, :list_actions)
    def list_tasks(**)   = raise_or(@tasks, :list_tasks)
    def list_runtimes    = raise_or(@runtimes, :list_runtimes)
    def get_task(id)     = raise_or(@tasks.find { |t| t['task_id'] == id || t[:task_id] == id }, :get_task)
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
