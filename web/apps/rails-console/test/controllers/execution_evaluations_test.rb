require 'test_helper'

# Execution Evaluation definitions UX — operator surface for the deterministic
# execution-evaluation engine. Covers list/create/edit/archive/run flows, the
# assertion builder payload shape, degraded-backend behaviour, and the hard
# security guarantee: no prompts, chain-of-thought, raw bodies, ciphertext,
# nonces, tokens, cookies, or keys are ever rendered.
class ExecutionEvaluationsTest < ActionDispatch::IntegrationTest
  # ── Real-mode Overture double ───────────────────────────────────────────
  class FakeClient
    attr_reader :created_payload, :updated_payload, :archived_id, :ran

    def initialize(evals: [], agents: [], eval_run: nil, eval_history: [])
      @evals = evals
      @agents = agents
      @eval_run = eval_run
      @eval_history = eval_history
    end

    def configured? = true
    # Shared reads used by the layout / data source on these pages.
    def list_actions = []
    def list_tasks(**) = []
    def list_runtimes = []
    def list_agents(**) = @agents

    def list_execution_evals = @evals
    def get_execution_eval(id) = @evals.find { |e| (e['eval_id'] || e[:eval_id]).to_s == id.to_s }
    def list_execution_eval_history(_id, limit: 20) = @eval_history.first(limit)

    def create_execution_eval(payload)
      @created_payload = payload
      (@evals.first || {}).merge('eval_id' => 'eval_new', 'name' => payload[:name])
    end

    def update_execution_eval(id, payload)
      @updated_payload = payload
      (get_execution_eval(id) || {}).merge('eval_id' => id.to_s, 'name' => payload[:name])
    end

    def archive_execution_eval(id)
      @archived_id = id
      { 'ok' => true }
    end

    def run_execution_eval(id, task_id:)
      @ran = { id: id, task_id: task_id }
      @eval_run
    end
  end

  def with_real_ds(client)
    ds = Igris::DataSource.new(client: client)
    ApplicationController.class_eval do
      alias_method :__orig_ds_eval, :data_source
      define_method(:data_source) { @data_source ||= ds }
    end
    assert ds.real?, 'expected real mode'
    yield ds
  ensure
    ApplicationController.class_eval { alias_method :data_source, :__orig_ds_eval }
  end

  def sample_eval
    {
      'eval_id' => 'eval_abc',
      'name' => 'send_email behaves safely',
      'description' => 'Email must call the target and produce proof.',
      'target_action_name' => 'send_email',
      'target_agent_id' => '',
      'enabled' => true,
      'assertions_json' => [
        { 'name' => 'send_email was called', 'type' => 'action_called', 'action_name' => 'send_email' },
        { 'name' => 'A signed proof exists', 'type' => 'proof_generated' },
      ],
      'created_at' => 3.days.ago.iso8601,
      'updated_at' => 1.day.ago.iso8601,
    }
  end

  def passing_run
    {
      'eval_run_id' => 'er_1', 'eval_id' => 'eval_abc', 'eval_name' => 'send_email behaves safely',
      'status' => 'passed', 'passed_count' => 2, 'failed_count' => 0,
      'results_json' => [
        { 'name' => 'send_email was called', 'status' => 'passed', 'reason' => 'action was observed in execution truth' },
        { 'name' => 'A signed proof exists', 'status' => 'passed', 'reason' => 'proof or receipt state was recorded' },
      ],
      'created_at' => Time.now.iso8601,
    }
  end

  def failing_history_run
    passing_run.merge(
      'eval_run_id' => 'er_failed',
      'task_id' => '44444444-4444-4444-4444-444444444444',
      'status' => 'failed',
      'passed_count' => 1,
      'failed_count' => 1,
      'results_json' => [
        { 'name' => 'A signed proof exists', 'status' => 'failed', 'reason' => 'proof or receipt state was not recorded' },
      ],
      'created_at' => 2.hours.ago.iso8601,
    )
  end

  # ── Navigation / IA ─────────────────────────────────────────────────────
  test 'runs page exposes an Evaluations tab under the Runs lens' do
    get runs_path
    assert_response :success
    assert_select '.ic-viewtab', text: 'Evaluations'
  end

  test 'evaluations index lives under /runs and keeps the Runs view tabs' do
    get evaluations_path
    assert_response :success
    assert_equal '/runs/evaluations', evaluations_path
    assert_select '.ic-viewtab', text: 'Run history'
    assert_select '.ic-viewtab.is-active', text: 'Evaluations'
  end

  test 'a run id at /runs/:id still resolves to run detail, not evaluations' do
    get run_path('run_01HGJ8K2Z9F')
    assert_response :success
    assert_select '#evaluation-results'
  end

  # ── List ────────────────────────────────────────────────────────────────
  test 'fixture-mode index lists demo definitions without dumping raw JSON' do
    get evaluations_path
    assert_response :success
    assert_match 'send_email behaves safely', response.body
    assert_match 'run_migration stays human-gated', response.body
    # The list shows assertion counts, not the assertions JSON.
    assert_match 'assertions', response.body
    refute_match '"type":"action_called"', response.body
  end

  test 'index is a plain explanatory list (no card layout)' do
    get evaluations_path
    assert_response :success
    assert_select '.ic-eval-list .ic-eval-row'
    assert_select '.ic-eval-card', false
  end

  test 'real-mode empty list shows an explanatory empty state' do
    with_real_ds(FakeClient.new(evals: [])) do
      get evaluations_path
      assert_response :success
      assert_match 'No evaluations yet', response.body
    end
  end

  # ── Create ──────────────────────────────────────────────────────────────
  test 'new renders the form with a custom (non-native) assertion dropdown' do
    get new_evaluation_path
    assert_response :success
    # No native <select> — a custom <details> dropdown backed by a hidden input.
    assert_select 'select', false
    assert_select 'input[type=hidden][data-assert-type]'
    assert_select '.ic-assert-type-dd .ic-dropdown__menu [data-dd-opt][data-value=?]', 'action_called'
    assert_select '.ic-assert-type-dd .ic-dropdown__menu [data-dd-opt][data-value=?]', 'no_secret_leak'
  end

  test 'create builds the correct payload and never sends tenant_id' do
    client = FakeClient.new(evals: [sample_eval])
    with_real_ds(client) do
      post evaluations_path, params: {
        name: 'My eval', description: 'desc', target_action_name: 'send_email',
        target_agent_id: '', enabled: '1',
        assertions: {
          '0' => { type: 'action_called', value: 'send_email', name: '' },
          '1' => { type: 'no_secret_leak', value: 'ignored', name: 'No leak' },
          '2' => { type: '', value: '', name: '' }, # blank row dropped
        },
      }
      assert_response :redirect
      payload = client.created_payload
      refute payload.key?(:tenant_id), 'payload must not include tenant_id'
      assert_equal 'My eval', payload[:name]
      assert_equal true, payload[:enabled]
      # Blank row dropped; valueless type carries no target; action carries action_name.
      assert_equal 2, payload[:assertions_json].size
      called = payload[:assertions_json].find { |a| a[:type] == 'action_called' }
      assert_equal 'send_email', called[:action_name]
      assert_equal 'Expected action was called: send_email', called[:name]
      leak = payload[:assertions_json].find { |a| a[:type] == 'no_secret_leak' }
      refute leak.key?(:action_name)
      refute leak.key?(:agent_id)
    end
  end

  test 'agent_used assertion maps the value into agent_id' do
    client = FakeClient.new(evals: [sample_eval])
    with_real_ds(client) do
      post evaluations_path, params: {
        name: 'Agent eval',
        assertions: { '0' => { type: 'agent_used', value: 'billing_agent', name: '' } },
      }
      assert_response :redirect
      a = client.created_payload[:assertions_json].first
      assert_equal 'agent_used', a[:type]
      assert_equal 'billing_agent', a[:agent_id]
    end
  end

  test 'create without a name re-renders with a guidance error' do
    with_real_ds(FakeClient.new) do
      post evaluations_path, params: {
        name: '', assertions: { '0' => { type: 'proof_generated', value: '', name: '' } },
      }
      assert_response :unprocessable_entity
      assert_match 'Give the evaluation a name.', response.body
    end
  end

  test 'create without any assertion re-renders with a guidance error' do
    with_real_ds(FakeClient.new) do
      post evaluations_path, params: { name: 'X', assertions: { '0' => { type: '', value: '', name: '' } } }
      assert_response :unprocessable_entity
      assert_match 'Add at least one assertion.', response.body
    end
  end

  test 'action_called assertion without a target value is rejected client-side' do
    with_real_ds(FakeClient.new) do
      post evaluations_path, params: {
        name: 'X', assertions: { '0' => { type: 'action_called', value: '', name: '' } },
      }
      assert_response :unprocessable_entity
      assert_match 'needs an action name', response.body
    end
  end

  test 'backend validation errors surface inline without leaking internals' do
    failing = FakeClient.new
    def failing.create_execution_eval(_p)
      raise Igris::OvertureClient::ValidationError.new('assertions_json[0].type is unsupported', status: 400, code: 'invalid_execution_eval')
    end
    with_real_ds(failing) do
      post evaluations_path, params: {
        name: 'X', assertions: { '0' => { type: 'proof_generated', value: '', name: '' } },
      }
      assert_response :unprocessable_entity
      assert_match 'Invalid evaluation', response.body
    end
  end

  test 'fixture-mode create is inert and shows a demo notice' do
    post evaluations_path, params: {
      name: 'X', assertions: { '0' => { type: 'proof_generated', value: '', name: '' } },
    }
    assert_response :success
    assert_match 'Demo mode', response.body
  end

  # ── Detail page: split report + right-panel View/Edit/Archive ───────────
  test 'detail page renders the report on the left with View/Edit/Archive panes' do
    with_real_ds(FakeClient.new(evals: [sample_eval])) do
      get evaluation_path('eval_abc')
      assert_response :success
      # The explanatory report (not cards) on the left.
      assert_select '.ic-eval-report .ic-evidence__head', text: 'send_email behaves safely'
      assert_select '.ic-eval-card', false
      # The three buttons open right-side panes (labels bound to the radio inputs).
      assert_select 'label[for=?]', 'pane-view', text: 'View'
      assert_select 'label[for=?]', 'pane-edit', text: 'Edit'
      assert_select 'label[for=?]', 'pane-archive', text: 'Archive'
      # Their content lives in the right panel — Edit is the form, in-page (no redirect).
      assert_select '.ic-eval-side .ic-eval-side__pane--edit form'
      assert_select '.ic-eval-side .ic-eval-side__pane--edit input#name[value=?]', 'send_email behaves safely'
      assert_select '.ic-eval-side .ic-eval-side__pane--archive form[action=?]', evaluation_path('eval_abc')
    end
  end

  test 'detail page shows recent evaluation history with pass rate and run links' do
    history = [passing_run.merge('task_id' => '33333333-3333-3333-3333-333333333333'), failing_history_run]
    with_real_ds(FakeClient.new(evals: [sample_eval], eval_history: history)) do
      get evaluation_path('eval_abc')
      assert_response :success
      assert_match 'Recent runs', response.body
      assert_match 'Pass rate', response.body
      assert_match '50%', response.body
      assert_select 'a[href=?]', run_path('33333333-3333-3333-3333-333333333333')
      assert_match 'proof or receipt state was not recorded', response.body
    end
  end

  # ── Edit / Update / Archive ─────────────────────────────────────────────
  test 'edit prefills the definition and its checks' do
    with_real_ds(FakeClient.new(evals: [sample_eval])) do
      get edit_evaluation_path('eval_abc')
      assert_response :success
      assert_select 'input#name[value=?]', 'send_email behaves safely'
      # The custom dropdown reflects the stored type via its hidden input + active option.
      assert_select 'input[type=hidden][data-assert-type][value=?]', 'action_called'
      assert_select '.ic-assert-type-dd [data-dd-opt].is-active[data-value=?]', 'action_called'
    end
  end

  test 'update sends the edited payload' do
    client = FakeClient.new(evals: [sample_eval])
    with_real_ds(client) do
      patch evaluation_path('eval_abc'), params: {
        name: 'Renamed', enabled: '0',
        assertions: { '0' => { type: 'proof_generated', value: '', name: 'Proof' } },
      }
      assert_response :redirect
      assert_equal 'Renamed', client.updated_payload[:name]
      assert_equal false, client.updated_payload[:enabled]
    end
  end

  test 'archive calls the backend and returns to the list' do
    client = FakeClient.new(evals: [sample_eval])
    with_real_ds(client) do
      delete evaluation_path('eval_abc')
      assert_redirected_to evaluations_path
      assert_equal 'eval_abc', client.archived_id
    end
  end

  test 'fixture-mode archive is inert' do
    delete evaluation_path('eval_demo_send_email')
    assert_redirected_to evaluations_path
    follow_redirect!
    assert_match 'Demo mode', response.body
  end

  # ── Run ─────────────────────────────────────────────────────────────────
  test 'running an evaluation against a run renders the result inline' do
    client = FakeClient.new(evals: [sample_eval], eval_run: passing_run)
    with_real_ds(client) do
      post run_evaluation_path('eval_abc'), params: { task_id: 'task_xyz' }
      assert_response :success
      assert_equal({ id: 'eval_abc', task_id: 'task_xyz' }, client.ran)
      assert_select '#eval-run-result #evaluation-results'
      assert_match 'send_email was called', response.body
      assert_match 'Passed', response.body
    end
  end

  test 'running without a task id shows a guidance error' do
    with_real_ds(FakeClient.new(evals: [sample_eval])) do
      post run_evaluation_path('eval_abc'), params: { task_id: '' }
      assert_response :unprocessable_entity
      assert_match 'Enter a run or task ID', response.body
    end
  end

  test 'running a disabled evaluation surfaces the conflict cleanly' do
    failing = FakeClient.new(evals: [sample_eval])
    def failing.run_execution_eval(_id, task_id:)
      raise Igris::OvertureClient::Conflict.new('eval_disabled', status: 409, code: 'eval_disabled')
    end
    with_real_ds(failing) do
      post run_evaluation_path('eval_abc'), params: { task_id: 'task_xyz' }
      assert_response :conflict
      assert_match 'disabled', response.body
    end
  end

  test 'running an unknown run id is reported safely' do
    failing = FakeClient.new(evals: [sample_eval])
    def failing.run_execution_eval(_id, task_id:)
      raise Igris::OvertureClient::NotFound.new('not found', status: 404, code: 'not_found')
    end
    with_real_ds(failing) do
      post run_evaluation_path('eval_abc'), params: { task_id: 'nope' }
      assert_response :not_found
      assert_match 'No run was found', response.body
    end
  end

  # ── Degraded backend ────────────────────────────────────────────────────
  test 'index stays available and shows a calm banner when the list endpoint errors' do
    failing = FakeClient.new
    def failing.list_execution_evals = raise(Igris::OvertureClient::ServerError.new('boom', status: 500, code: 'db_error'))
    with_real_ds(failing) do
      get evaluations_path
      assert_response :success
      assert_match 'No evaluations yet', response.body
      assert_match 'degraded', response.body
    end
  end

  test 'a degraded backend never leaks the raw upstream error message' do
    failing = FakeClient.new
    def failing.list_execution_evals
      raise Igris::OvertureClient::ServerError.new(
        'internal-db.corp.local OVERTURE_API_KEY=sk_live_LEAK postgres://admin:pw@db/main', status: 502, code: 'upstream_db'
      )
    end
    with_real_ds(failing) do
      get evaluations_path
      assert_response :success
      refute_includes response.body, 'internal-db.corp.local'
      refute_includes response.body, 'sk_live_LEAK'
      refute_includes response.body, 'postgres://admin:pw'
      assert_match 'upstream_db', response.body
    end
  end

  # ── Security: escaping & no unsafe payloads ─────────────────────────────
  test 'malicious assertion names/values are ERB-escaped, never rendered as HTML' do
    hostile = sample_eval.merge(
      'name' => 'Eval <script>alert(1)</script>',
      'description' => 'Desc <img src=x onerror=alert(2)>',
      'assertions_json' => [
        { 'name' => 'Check </span><script>alert(3)</script>', 'type' => 'action_called',
          'action_name' => 'send_email"><script>alert(4)</script>' },
      ],
    )
    with_real_ds(FakeClient.new(evals: [hostile])) do
      get evaluation_path('eval_abc')
      assert_response :success
      refute_includes response.body, '<script>alert(1)</script>'
      refute_includes response.body, '<img src=x onerror=alert(2)>'
      refute_includes response.body, '<script>alert(3)</script>'
      refute_includes response.body, '<script>alert(4)</script>'
      assert_match '&lt;script&gt;alert(1)&lt;/script&gt;', response.body
    end
  end

  test 'an unsafe eval-run result from the backend is escaped on render' do
    hostile_run = passing_run.merge(
      'status' => 'failed', 'passed_count' => 0, 'failed_count' => 1,
      'results_json' => [
        { 'name' => 'Check <script>alert(5)</script>', 'status' => 'failed',
          'reason' => 'reason <img src=x onerror=alert(6)>' },
      ],
    )
    with_real_ds(FakeClient.new(evals: [sample_eval], eval_run: hostile_run)) do
      post run_evaluation_path('eval_abc'), params: { task_id: 'task_xyz' }
      assert_response :success
      refute_includes response.body, '<script>alert(5)</script>'
      refute_includes response.body, '<img src=x onerror=alert(6)>'
    end
  end

  test 'no prompt, chain-of-thought, secret, or token markers appear on the detail page' do
    with_real_ds(FakeClient.new(evals: [sample_eval], eval_run: passing_run)) do
      post run_evaluation_path('eval_abc'), params: { task_id: 'task_xyz' }
      assert_response :success
      body = response.body.downcase
      ['chain-of-thought', 'chain_of_thought', 'hidden reasoning', 'ciphertext',
       'bearer ', 'set-cookie', 'private key', 'request_body', 'response_body'].each do |marker|
        refute_includes body, marker, "detail page rendered unsafe marker: #{marker}"
      end
    end
  end
end
