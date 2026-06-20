require 'test_helper'

# Execution Intelligence Console (operator UX) — surfaces Evidence Memory and
# Execution Intelligence inside the console:
#   · Run detail (/runs/:id): Agent attribution, Evidence Memory (operator
#     summaries only), and the Run Story (Agent → Action → Decision → Evidence
#     → Outcome → Proof).
#   · Runs page (/runs?view=intelligence): read-only metrics with agent and
#     action comparisons.
#
# The hard guarantees: only persisted summaries and execution data are shown —
# never prompts, chain-of-thought, hidden reasoning, keys, or runtime secrets.
class ExecutionIntelligenceConsoleTest < ActionDispatch::IntegrationTest
  # ── Real-mode Overture double ───────────────────────────────────────────
  class FakeClient
    def initialize(tasks: [], memory: [], intelligence: {})
      @tasks = tasks; @memory = memory; @intelligence = intelligence
    end
    def configured?            = true
    def list_actions           = []
    def list_tasks(**)         = @tasks
    def list_runtimes          = []
    def get_task(id)           = @tasks.find { |t| (t['task_id'] || t[:task_id]).to_s == id.to_s }
    def get_task_steps(_id)    = []
    def get_action(_)          = nil
    def find_action_by_name(_) = nil
    def list_agent_memory(**)  = @memory
    def get_execution_intelligence(**) = @intelligence
  end

  def with_real_ds(client)
    ds = Igris::DataSource.new(client: client)
    ApplicationController.class_eval do
      alias_method :__orig_ds_eic, :data_source
      define_method(:data_source) { @data_source ||= ds }
    end
    assert ds.real?, 'expected real mode'
    yield ds
  ensure
    ApplicationController.class_eval { alias_method :data_source, :__orig_ds_eic }
  end

  def completed_task
    {
      'task_id' => 'task_intel', 'status' => 'completed',
      'executed_target' => 'hosted_api',
      'dispatched_at' => 2.minutes.ago.iso8601,
      'completed_at' => 110.seconds.ago.iso8601,
      'agent' => {
        'agent_id' => 'd1e2f3a4-b5c6-7890-abcd-ef0123456789',
        'name' => 'billing_agent', 'display_name' => 'Billing Agent',
        'agent_type' => 'claude_code', 'template_name' => 'claude-code',
      },
      'proof' => { 'status' => 'verified', 'verified' => true },
    }
  end

  def memory_record
    {
      'memory_id' => 'mem_01', 'task_id' => 'task_intel',
      'registered_agent_name' => 'billing_agent',
      'goal_summary' => 'Charge the customer for invoice INV-204.',
      'decision_summary' => 'Selected the configured Stripe target after policy allowed the call.',
      'evidence_summary' => ['Policy preset allowed the call', 'Target acknowledged the charge'],
      'outcome_summary' => 'Charge completed and a verified receipt was recorded.',
      'redaction_status' => 'redacted',
      'retention_expires_at' => 80.days.from_now.iso8601,
      'created_at' => 110.seconds.ago.iso8601,
    }
  end

  # ── Run detail: the three operator surfaces ─────────────────────────────
  test 'fixture run detail renders Run Story, Agent attribution, and Evidence Memory' do
    get run_path('run_01HGJ8K2Z9F')
    assert_response :success
    assert_select '#run-story'
    assert_select '#agent-attribution'
    assert_select '#evidence-memory'
    # The six narrative beats are all present.
    %w[Agent Action Decision Evidence Outcome Proof].each do |label|
      assert_select '.ic-runstory__label', text: label
    end
  end

  test 'real-mode run detail shows persisted Evidence Memory summaries' do
    with_real_ds(FakeClient.new(tasks: [completed_task], memory: [memory_record])) do
      get run_path('task_intel')
      assert_response :success
      assert_match 'Charge the customer for invoice INV-204.', response.body
      assert_match 'Selected the configured Stripe target', response.body
      assert_match 'Target acknowledged the charge', response.body
      assert_match 'Charge completed and a verified receipt was recorded.', response.body
      assert_select '#evidence-memory .ig-pill', text: 'Redacted'
    end
  end

  test 'run detail attributes the run to the registered agent without leaking the agent UUID' do
    with_real_ds(FakeClient.new(tasks: [completed_task], memory: [])) do
      get run_path('task_intel')
      assert_response :success
      assert_select '#agent-attribution'
      assert_match 'Billing Agent', response.body
      # The raw agent UUID is never surfaced on the run page.
      refute_match 'd1e2f3a4-b5c6-7890-abcd-ef0123456789', response.body
    end
  end

  test 'run detail renders an honest empty Evidence Memory state when none exists' do
    with_real_ds(FakeClient.new(tasks: [completed_task], memory: [])) do
      get run_path('task_intel')
      assert_response :success
      assert_match 'No Evidence Memory was recorded for this run.', response.body
    end
  end

  test 'run detail stays available when the memory endpoint errors' do
    failing = FakeClient.new(tasks: [completed_task], memory: [])
    def failing.list_agent_memory(**) = raise Igris::OvertureClient::ServerError.new('boom', status: 500)
    with_real_ds(failing) do
      get run_path('task_intel')
      assert_response :success
      assert_select '#evidence-memory'
      assert_match 'No Evidence Memory was recorded for this run.', response.body
    end
  end

  # ── Intelligence tab ────────────────────────────────────────────────────
  test 'runs page exposes a Run history / Intelligence view switch' do
    get runs_path
    assert_response :success
    assert_select '.ic-viewtab', text: 'Run history'
    assert_select '.ic-viewtab', text: 'Intelligence'
  end

  test 'intelligence tab renders summary rates and agent / action comparisons' do
    intel = {
      'range' => 'last_30d', 'source' => 'task_records',
      'summary' => {
        'total_runs' => 200, 'successful_runs' => 180, 'failed_runs' => 14,
        'approval_required_runs' => 6, 'human_intervention_runs' => 3,
        'recovery_runs' => 9, 'average_duration_ms' => 512.0,
        'success_rate' => 0.9, 'failure_rate' => 0.07, 'approval_rate' => 0.03,
        'human_intervention_rate' => 0.015, 'recovery_rate' => 0.045,
      },
      'agents' => [
        { 'key' => 'a1', 'name' => 'Billing Agent', 'total_runs' => 120,
          'successful_runs' => 112, 'failed_runs' => 5, 'recovery_runs' => 3,
          'average_duration_ms' => 480.0, 'success_rate' => 0.933,
          'failure_rate' => 0.041, 'recovery_rate' => 0.025 },
      ],
      'actions' => [
        { 'key' => 'charge_customer', 'name' => 'charge_customer', 'total_runs' => 88,
          'successful_runs' => 80, 'failed_runs' => 6, 'recovery_runs' => 4,
          'average_duration_ms' => 640.0, 'success_rate' => 0.909,
          'failure_rate' => 0.068, 'recovery_rate' => 0.045 },
      ],
    }
    with_real_ds(FakeClient.new(intelligence: intel)) do
      get runs_path(view: 'intelligence')
      assert_response :success
      assert_select '.ic-intel'
      assert_select '.ic-intel__stat-k', text: 'Success rate'
      assert_match '90%', response.body
      assert_select '.ic-intel__table', 2 # agent + action comparison
      assert_match 'Billing Agent', response.body
      assert_match 'charge_customer', response.body
    end
  end

  test 'intelligence tab shows an honest empty state with no runs' do
    empty = {
      'range' => 'last_30d', 'summary' => { 'total_runs' => 0 },
      'agents' => [], 'actions' => [],
    }
    with_real_ds(FakeClient.new(intelligence: empty)) do
      get runs_path(view: 'intelligence')
      assert_response :success
      assert_match 'No runs in this window', response.body
    end
  end

  # ── DataSource normalization ────────────────────────────────────────────
  test 'execution_intelligence rejects unknown ranges and degrades cleanly on error' do
    failing = FakeClient.new
    def failing.get_execution_intelligence(**) = raise Igris::OvertureClient::ServerError.new('x', status: 500)
    ds = Igris::DataSource.new(client: failing)
    result = ds.execution_intelligence(range: 'not_a_range')
    assert_equal 'last_30d', result[:range]
    assert_equal 0, result[:summary][:total_runs]
    assert_empty result[:agents]
  end
end
