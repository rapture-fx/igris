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
    def list_execution_eval_runs(_) = []
    def get_execution_intelligence(**) = @intelligence
    def get_trust_recommendations(**) = { 'recommendations' => [] }
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
      assert_select '#evidence-memory .ic-memory__status', text: 'Redacted'
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
          'approval_required_runs' => 7, 'eval_run_count' => 40, 'eval_passed_runs' => 36,
          'proof_covered_runs' => 96, 'approval_rate' => 0.058,
          'eval_pass_rate' => 0.9, 'proof_coverage' => 0.8,
          'average_duration_ms' => 480.0, 'success_rate' => 0.933,
          'failure_rate' => 0.041, 'recovery_rate' => 0.025 },
      ],
      'actions' => [
        { 'key' => 'charge_customer', 'name' => 'charge_customer', 'total_runs' => 88,
          'successful_runs' => 80, 'failed_runs' => 6, 'recovery_runs' => 4,
          'approval_required_runs' => 11, 'eval_run_count' => 22, 'eval_passed_runs' => 18,
          'proof_covered_runs' => 70, 'approval_rate' => 0.125,
          'eval_pass_rate' => 0.818, 'proof_coverage' => 0.795,
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
      assert_match 'Eval pass', response.body
      assert_match 'Proof', response.body
      # Policy Simulation card is present with its read-only preview form.
      assert_match 'Policy simulation', response.body
      assert_select 'form.ic-polsim__form'
      assert_match 'Run preview', response.body
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

  # ── Security / redaction hardening ──────────────────────────────────────
  # The console renders operator-facing Evidence Memory summaries verbatim, so
  # a malicious or buggy upstream that slips HTML/script markup into a summary
  # must be ERB-escaped on render — never executed or injected into the DOM.
  test 'malicious Evidence Memory summaries are ERB-escaped, never rendered as HTML' do
    malicious = memory_record.merge(
      'goal_summary'     => 'Goal <script>alert("xss")</script>',
      'decision_summary' => 'Decision <img src=x onerror=alert(1)>',
      'evidence_summary' => ['Ev <b>bold</b>', 'Ev2 "onmouseover=alert(2)'],
      'outcome_summary'  => 'Outcome </p><script>alert(3)</script>',
    )
    with_real_ds(FakeClient.new(tasks: [completed_task], memory: [malicious])) do
      get run_path('task_intel')
      assert_response :success
      # The raw markup is never present; the escaped entities are.
      refute_includes response.body, '<script>alert("xss")</script>'
      refute_includes response.body, '<img src=x onerror=alert(1)>'
      refute_includes response.body, '</p><script>alert(3)</script>'
      assert_match '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;', response.body
      assert_match '&lt;img src=x onerror=alert(1)&gt;', response.body
    end
  end

  # A degraded backend must surface a calm, operator-safe banner — the raw
  # upstream error message (which can carry internal hostnames, stack detail, or
  # secrets) is never echoed into the page. The banner carries only the error
  # class, HTTP status, and machine code.
  test 'a degraded backend never leaks the raw upstream error message into the page' do
    hostile_msg = 'internal-db.corp.local:5432 OVERTURE_API_KEY=sk_live_LEAK ' \
                  'postgres://admin:pw@db.internal/main stack: pg/connect.rs:42'
    failing = FakeClient.new(tasks: [completed_task], memory: [])
    def failing.get_task(_id)
      raise Igris::OvertureClient::ServerError.new(
        'internal-db.corp.local:5432 OVERTURE_API_KEY=sk_live_LEAK postgres://admin:pw@db.internal/main stack: pg/connect.rs:42',
        status: 502, code: 'upstream_db'
      )
    end
    with_real_ds(failing) do
      get run_path('task_intel')
      assert_response :success
      # The page renders an honest unavailable state, not a crash.
      assert_select '#evidence-memory'
      # The hostile raw message is never echoed; only the safe class/status/code.
      refute_includes response.body, 'internal-db.corp.local'
      refute_includes response.body, 'sk_live_LEAK'
      refute_includes response.body, 'postgres://admin:pw'
      refute_includes response.body, 'pg/connect.rs'
      # The safe, derived banner fields ARE shown so the operator can act.
      assert_match 'upstream_db', response.body
      assert_match '502', response.body
    end
  end

  # Hostile task fields carrying prompt text, chain-of-thought, ciphertext,
  # nonces, bearer tokens, cookies, API keys, and private keys must be redacted
  # by the DataSource boundary before the run page ever renders them.
  test 'run detail redacts prompt/cot/ciphertext/nonce/token/cookie/key/private-key fields' do
    task = completed_task.merge(
      'prompt'           => 'SYSTEM: you are a helpful agent. <think>hidden reasoning</think>',
      'chain_of_thought' => 'step 1: reason about X. step 2: decide Y.',
      'hidden_reasoning' => 'internal deliberation the operator must never see',
      'ciphertext'       => 'BASE64ENCRYPTEDPAYLOAD==',
      'nonce'            => 'g3F7c1p9Q0vZ2aR4',
      'authorization'    => 'Bearer sk_live bearerTokenSecret',
      'cookie'           => 'session=abc123; better-auth.session_token=xyz',
      'api_key'          => 'sk_live_supersecret',
      'private_key'      => '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDLEAK\n-----END PRIVATE KEY-----',
      'bearer_token'     => 'Bearer_eyJhbGciOiJIUzI1NiJ9.payload.sig',
    )
    with_real_ds(FakeClient.new(tasks: [task], memory: [])) do
      get run_path('task_intel')
      assert_response :success
      body = response.body
      [
        'you are a helpful agent', 'hidden reasoning', 'internal deliberation',
        'BASE64ENCRYPTEDPAYLOAD', 'g3F7c1p9Q0vZ2aR4',
        'bearerTokenSecret', 'better-auth.session_token=xyz',
        'sk_live_supersecret', 'BEGIN PRIVATE KEY', 'Bearer_eyJhbGci',
      ].each do |secret|
        refute_includes body, secret, "run detail rendered unsafe field content: #{secret}"
      end
    end
  end

  # ── Performance: bounded backend calls ──────────────────────────────────
  # Run detail must not fan out to the intelligence endpoint or make per-run
  # memory calls inside a loop. A single render should touch each backend
  # endpoint a bounded number of times (here: once for the task, once for
  # steps, once for memory, once for the runtimes heartbeat, and the task list
  # for the sidebar — never the intelligence endpoint).
  test 'run detail render does not call the execution intelligence endpoint' do
    calls = Hash.new(0)
    instrumented = FakeClient.new(tasks: [completed_task], memory: [memory_record])
    instrumented.define_singleton_method(:get_execution_intelligence) do |**|
      calls[:intelligence] += 1
      raise Igris::OvertureClient::ServerError.new('must not be called', status: 500)
    end
    %i[get_task get_task_steps list_agent_memory list_tasks list_runtimes list_actions].each do |m|
      instrumented.define_singleton_method(m) do |*a, **k, &b|
        calls[m] += 1
        super(*a, **k, &b)
      end
    end
    with_real_ds(instrumented) do
      get run_path('task_intel')
      assert_response :success
    end
    assert_equal 0, calls[:intelligence], 'run detail invoked the intelligence endpoint'
    # Each per-run endpoint is called at most a bounded number of times.
    assert_operator calls[:get_task], :<=, 2
    assert_operator calls[:list_agent_memory], :<=, 2
    assert_operator calls[:get_task_steps], :<=, 2
  end

  # The intelligence view must not trigger per-run memory or task-step fetches
  # for every row in the breakdown — it reads the aggregate endpoint once.
  test 'intelligence view does not call per-run memory or task-step endpoints' do
    calls = Hash.new(0)
    instrumented = FakeClient.new(intelligence: {
      'range' => 'last_30d', 'source' => 'task_records',
      'summary' => { 'total_runs' => 5, 'successful_runs' => 4, 'failed_runs' => 1,
                     'success_rate' => 0.8, 'failure_rate' => 0.2, 'recovery_rate' => 0.0,
                     'approval_rate' => 0.0, 'recovery_runs' => 0, 'approval_required_runs' => 0,
                     'human_intervention_runs' => 0, 'average_duration_ms' => 100.0 },
      'agents'  => [{ 'key' => 'a', 'name' => 'Agent A', 'total_runs' => 5, 'successful_runs' => 4,
                      'failed_runs' => 1, 'success_rate' => 0.8, 'failure_rate' => 0.2,
                      'recovery_rate' => 0.0, 'average_duration_ms' => 100.0 }],
      'actions' => [{ 'key' => 'act', 'name' => 'act', 'total_runs' => 5, 'successful_runs' => 4,
                      'failed_runs' => 1, 'success_rate' => 0.8, 'failure_rate' => 0.2,
                      'recovery_rate' => 0.0, 'average_duration_ms' => 100.0 }],
    })
    %i[list_agent_memory get_task_steps get_task].each do |m|
      instrumented.define_singleton_method(m) do |*a, **k, &b|
        calls[m] += 1
        []
      end
    end
    with_real_ds(instrumented) do
      get runs_path(view: 'intelligence')
      assert_response :success
    end
    assert_equal 0, calls[:list_agent_memory], 'intelligence view called per-run memory endpoint'
    assert_equal 0, calls[:get_task_steps], 'intelligence view called per-run steps endpoint'
    assert_equal 0, calls[:get_task], 'intelligence view called per-run task endpoint'
  end
end
