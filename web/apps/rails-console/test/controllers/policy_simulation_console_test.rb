require 'test_helper'

# Policy Simulation (operator UX) — a read-only, deterministic preview under
# Runs > Intelligence of how a proposed policy rule would have classified recent
# execution records. The hard guarantees: nothing is mutated, replayed, or
# dispatched; tenant_id is never sent; and only safe identifiers/counts are
# rendered (never prompts, raw bodies, or secrets), always ERB-escaped.
class PolicySimulationConsoleTest < ActionDispatch::IntegrationTest
  # Minimal real-mode Overture double. Records the last simulate payload so we
  # can assert tenant_id is never forwarded.
  class FakeClient
    attr_reader :last_sim_payload

    def initialize(intelligence: default_intelligence, simulation: nil, sim_error: nil)
      @intelligence = intelligence
      @simulation = simulation
      @sim_error = sim_error
    end

    def configured?            = true
    def list_actions           = []
    def list_tasks(**)         = []
    def list_runtimes          = []
    def get_task(_id)          = nil
    def get_task_steps(_id)    = []
    def get_action(_)          = nil
    def find_action_by_name(_) = nil
    def list_agent_memory(**)  = []
    def list_execution_eval_runs(_) = []
    def get_execution_intelligence(**) = @intelligence
    def get_trust_recommendations(**) = { 'recommendations' => [] }

    def simulate_policy(payload)
      @last_sim_payload = payload
      raise @sim_error if @sim_error
      @simulation
    end

    def default_intelligence
      {
        'range' => 'last_30d', 'source' => 'task_records',
        'summary' => { 'total_runs' => 5, 'successful_runs' => 4, 'failed_runs' => 1,
                       'success_rate' => 0.8, 'failure_rate' => 0.2, 'recovery_rate' => 0.0,
                       'approval_rate' => 0.0, 'recovery_runs' => 0, 'approval_required_runs' => 0,
                       'human_intervention_runs' => 0, 'average_duration_ms' => 100.0 },
        'agents' => [], 'actions' => [],
      }
    end
  end

  def with_real_ds(client)
    ds = Igris::DataSource.new(client: client)
    ApplicationController.class_eval do
      alias_method :__orig_ds_polsim, :data_source
      define_method(:data_source) { @data_source ||= ds }
    end
    assert ds.real?, 'expected real mode'
    yield ds
  ensure
    ApplicationController.class_eval { alias_method :data_source, :__orig_ds_polsim }
  end

  def simulation_result(overrides = {})
    {
      'range' => '30d', 'policy_mode' => 'require_approval',
      'total_runs_considered' => 142, 'would_allow' => 124,
      'would_require_approval' => 18, 'would_block' => 0,
      'affected_run_count' => 18,
      'affected_agents' => [{ 'key' => 'agent-1', 'name' => 'claude-production', 'run_count' => 18 }],
      'affected_actions' => [{ 'name' => 'stripe.refund_payment', 'run_count' => 18 }],
      'sample_runs' => [{ 'task_id' => 'run_abc', 'status' => 'completed' }],
      'warnings' => [],
    }.merge(overrides)
  end

  # ── Form presence ─────────────────────────────────────────────────────────
  test 'intelligence tab renders the read-only Policy Simulation form' do
    with_real_ds(FakeClient.new) do
      get runs_path(view: 'intelligence')
      assert_response :success
      assert_select 'form.ic-polsim__form'
      assert_match 'Would require approval', response.body
      assert_match 'Would block', response.body
    end
  end

  test 'simulation is not computed unless the operator submits the form' do
    client = FakeClient.new
    with_real_ds(client) do
      get runs_path(view: 'intelligence')
      assert_response :success
    end
    assert_nil client.last_sim_payload, 'simulate_policy must not run on a plain page load'
  end

  # ── Success state ─────────────────────────────────────────────────────────
  test 'submitting the form renders allow / approval / block counts and affected breakdowns' do
    with_real_ds(FakeClient.new(simulation: simulation_result)) do
      get runs_path(view: 'intelligence', simulate: '1', sim_range: '30d',
                    sim_mode: 'require_approval', sim_match_kind: 'match_action_prefix',
                    sim_match_value: 'stripe.refund')
      assert_response :success
      assert_select '.ic-polsim__count-v.is-allow', text: '124'
      assert_select '.ic-polsim__count-v.is-approval', text: '18'
      assert_select '.ic-polsim__count-v.is-block', text: '0'
      assert_match 'claude-production', response.body
      assert_match 'stripe.refund_payment', response.body
      # Sample affected runs link to the run detail page.
      assert_select "a[href=?]", run_path('run_abc')
    end
  end

  test 'block mode preview surfaces would-block counts' do
    with_real_ds(FakeClient.new(simulation: simulation_result(
      'policy_mode' => 'block', 'would_require_approval' => 0, 'would_block' => 18
    ))) do
      get runs_path(view: 'intelligence', simulate: '1', sim_mode: 'block',
                    sim_match_kind: 'match_action_name', sim_match_value: 'db.write')
      assert_response :success
      assert_select '.ic-polsim__count-v.is-block', text: '18'
    end
  end

  # ── Empty / degraded states ───────────────────────────────────────────────
  test 'empty simulation window renders an honest empty notice' do
    with_real_ds(FakeClient.new(simulation: simulation_result(
      'total_runs_considered' => 0, 'would_allow' => 0, 'would_require_approval' => 0,
      'affected_run_count' => 0, 'affected_agents' => [], 'affected_actions' => [], 'sample_runs' => []
    ))) do
      get runs_path(view: 'intelligence', simulate: '1', sim_match_value: 'nothing',
                    sim_match_kind: 'match_action_name')
      assert_response :success
      assert_match 'No execution records were found in the selected window', response.body
    end
  end

  test 'a degraded simulation backend renders a calm notice and never crashes' do
    failing = FakeClient.new(sim_error: Igris::OvertureClient::ServerError.new('boom', status: 500, code: 'db_error'))
    with_real_ds(failing) do
      get runs_path(view: 'intelligence', simulate: '1', sim_match_value: 'x',
                    sim_match_kind: 'match_action_name')
      assert_response :success
      assert_match 'simulation service is unavailable', response.body
    end
  end

  # ── Backend warnings surface verbatim (escaped) ───────────────────────────
  test 'simulation warnings render to the operator' do
    with_real_ds(FakeClient.new(simulation: simulation_result(
      'warnings' => ['No match criteria were provided, so no runs were classified as affected.']
    ))) do
      get runs_path(view: 'intelligence', simulate: '1', sim_match_value: 'x',
                    sim_match_kind: 'match_action_name')
      assert_response :success
      assert_match 'No match criteria were provided', response.body
    end
  end

  # ── Security: hostile upstream values are ERB-escaped, never rendered raw ──
  test 'malicious affected names and warnings are ERB-escaped, never executed' do
    with_real_ds(FakeClient.new(simulation: simulation_result(
      'affected_actions' => [{ 'name' => '<script>alert(1)</script>', 'run_count' => 3 }],
      'affected_agents'  => [{ 'key' => 'a', 'name' => '<img src=x onerror=alert(2)>', 'run_count' => 3 }],
      'warnings' => ['<b>warn</b><script>alert(3)</script>']
    ))) do
      get runs_path(view: 'intelligence', simulate: '1', sim_match_value: 'x',
                    sim_match_kind: 'match_action_name')
      assert_response :success
      refute_includes response.body, '<script>alert(1)</script>'
      refute_includes response.body, '<img src=x onerror=alert(2)>'
      refute_includes response.body, '<script>alert(3)</script>'
      assert_match '&lt;script&gt;alert(1)&lt;/script&gt;', response.body
    end
  end

  # ── DataSource contract ───────────────────────────────────────────────────
  test 'simulate_policy never sends tenant_id and bounds range / mode' do
    client = FakeClient.new(simulation: simulation_result)
    ds = Igris::DataSource.new(client: client)
    ds.simulate_policy(range: 'not_a_range', policy_mode: 'delete', criteria: {
      tenant_id: 'tenant-evil', match_action_prefix: 'stripe.', require_proof_missing: '1',
      match_result_status: 'completed'
    })
    payload = client.last_sim_payload
    refute payload.key?(:tenant_id), 'payload must never carry tenant_id'
    refute payload.key?('tenant_id')
    assert_equal '30d', payload[:range]               # invalid range falls back
    assert_equal 'require_approval', payload[:policy_mode] # invalid mode falls back
    assert_equal 'stripe.', payload[:match_action_prefix]
    assert_equal true, payload[:require_proof_missing]
    assert_equal 'completed', payload[:match_result_status]
  end

  test 'simulate_policy drops unknown criteria and out-of-range statuses' do
    client = FakeClient.new(simulation: simulation_result)
    ds = Igris::DataSource.new(client: client)
    ds.simulate_policy(range: '7d', policy_mode: 'block', criteria: {
      match_result_status: 'not_a_status', bogus_key: 'x'
    })
    payload = client.last_sim_payload
    refute payload.key?(:match_result_status)
    refute payload.key?(:bogus_key)
    assert_equal '7d', payload[:range]
    assert_equal 'block', payload[:policy_mode]
  end

  test 'simulate_policy degrades to an unavailable state on backend error' do
    failing = FakeClient.new(sim_error: Igris::OvertureClient::ServerError.new('x', status: 500))
    ds = Igris::DataSource.new(client: failing)
    result = ds.simulate_policy(range: '30d', policy_mode: 'block', criteria: { match_action_name: 'y' })
    assert_equal :unavailable, result[:state]
    assert_equal 0, result[:total_runs_considered]
  end

  # ── Fixture mode (offline demo) ───────────────────────────────────────────
  test 'fixture mode renders a deterministic demo Policy Simulation' do
    get runs_path(view: 'intelligence', simulate: '1', sim_mode: 'require_approval',
                  sim_match_kind: 'match_action_prefix', sim_match_value: 'stripe')
    assert_response :success
    assert_select 'form.ic-polsim__form'
    assert_match 'stripe.refund_payment', response.body
  end
end
