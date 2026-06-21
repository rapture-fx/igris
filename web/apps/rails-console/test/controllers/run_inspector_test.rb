require 'test_helper'

# Run Inspector — the server-rendered, redacted quick-inspection block now
# embedded inside the run detail page (/runs/:id), directly above the Audit
# interpretation. It must:
#   - never appear on the runs list itself (the list is just the list);
#   - show Overview, Agent request, Action input, Execution assessment, Audit
#     interpretation, Evidence, and Next steps from already-safe run fields;
#   - render an honest unavailable state for prompt/request when none exists,
#     and a safe summary only when the API hands one back already redacted;
#   - never leak raw bodies, failure text, auth headers, keys, hosts, IPs, env
#     values, or signatures, and never use legacy / compliance wording.
#
# Fixture mode (default in test) backs the structural cases; a small real-mode
# double drives the safe-summary branch and the redaction guarantees.
class RunInspectorTest < ActionDispatch::IntegrationTest
  # ── Real-mode Overture double ───────────────────────────────────────────
  class FakeClient
    def initialize(tasks: [], actions: [], runtimes: [], steps: {})
      @tasks = tasks; @actions = actions; @runtimes = runtimes; @steps = steps
    end
    def configured?            = true
    def list_actions           = @actions
    def list_tasks(**)         = @tasks
    def list_runtimes          = @runtimes
    def get_task(id)           = @tasks.find { |t| (t['task_id'] || t[:task_id]).to_s == id.to_s }
    def get_task_steps(id)     = @steps[id.to_s] || []
    def list_agent_memory(**)  = []
    def list_execution_eval_runs(_) = []
    def get_action(_)          = nil
    def find_action_by_name(n) = @actions.find { |a| (a['name'] || a[:name]).to_s == n.to_s }
  end

  def with_real_ds(client)
    ds = Igris::DataSource.new(client: client)
    ApplicationController.class_eval do
      alias_method :__orig_ds_insp, :data_source
      define_method(:data_source) { @data_source ||= ds }
    end
    assert ds.real?, 'expected real mode'
    yield ds
  ensure
    ApplicationController.class_eval { alias_method :data_source, :__orig_ds_insp }
  end

  # ── Never on the list ────────────────────────────────────────────────────
  test 'the runs list itself never renders the inspector' do
    get '/runs'
    assert_response :success
    assert_select '.ic-runinspector', 0
  end

  test 'run rows link straight to the run detail page' do
    get '/runs?filter=failed'
    assert_response :success
    assert_select "a.ic-run-row__open[href=?]", run_path('run_01HGJ5W0M3B')
  end

  # ── Embedded in the opened run, above the Audit interpretation ───────────
  test 'the run detail page renders the Run Inspector' do
    get run_path('run_01HGJ8K2Z9F')
    assert_response :success
    assert_select '.ic-runinspector', 1
    assert_match 'Run Inspector', response.body
  end

  test 'the inspector carries its own Audit interpretation and no separate block remains' do
    get run_path('run_01HGJ8K2Z9F')
    assert_response :success
    # The standalone bottom Audit interpretation block was removed — the
    # inspector now carries that reading inline, so no duplicate is rendered.
    assert_select '.ic-runinspector .ic-runinspector__sechead', text: 'Audit interpretation'
    assert_select '.ic-audit', false
    assert_select '#audit', false
  end

  test 'the embedded inspector renders no close control' do
    get run_path('run_01HGJ5W0M3B')
    assert_response :success
    # Inline on the run detail page the inspector is always present, so it has
    # no close button.
    assert_select 'a.ic-runinspector__close', false
  end

  # ── Overview ────────────────────────────────────────────────────────────
  test 'inspector overview shows action, status, routed via, and proof' do
    get run_path('run_01HGJ8K2Z9F') # send_email, Succeeded, proof verified
    assert_response :success
    assert_select '.ic-runinspector' do
      assert_select '.ic-runinspector__sechead', text: 'Overview'
      assert_match 'send_email', response.body
      assert_match 'Routed via', response.body
      assert_match 'Proof verified', response.body
    end
  end

  test 'inspector shows safe registered agent attribution when present' do
    get run_path('run_01HGJ8K2Z9F')
    assert_response :success
    assert_match 'Claude Code Agent', response.body
    assert_match 'claude_code', response.body
    refute_match 'a1f2c3d4-e5f6-7890-abcd-ef1234567890', response.body
  end

  # ── Agent request: honest unavailable state ─────────────────────────────
  test 'inspector shows the agent request unavailable state when none exists' do
    get run_path('run_01HGJ8K2Z9F')
    assert_response :success
    assert_select '.ic-runinspector__sechead', text: 'Agent request'
    assert_match 'No prompt or request payload is available for this run.', response.body
  end

  # ── Agent request: safe summary only when the API provides one ──────────
  test 'inspector renders a safe redacted request summary when one is provided' do
    task = {
      'task_id' => 'task_safe', 'status' => 'completed',
      'executed_target' => 'hosted_api',
      'dispatched_at' => 1.minute.ago.iso8601,
      'completed_at' => 50.seconds.ago.iso8601,
      'request_summary' => 'tool=http_call · POST /v1/orders · body redacted',
    }
    with_real_ds(FakeClient.new(tasks: [task])) do
      get run_path('task_safe')
      assert_response :success
      assert_select 'pre.ic-runinspector__code', /POST \/v1\/orders · body redacted/
      refute_match 'No prompt or request payload is available', response.body
    end
  end

  # ── Execution assessment ────────────────────────────────────────────────
  test 'inspector execution assessment renders the five assessment rows' do
    get run_path('run_01HGJ8K2Z9F')
    assert_response :success
    assert_select '.ic-runinspector__sechead', text: 'Execution assessment'
    ['Action completed', 'Policy followed', 'Runtime path', 'Recovery', 'Proof'].each do |label|
      assert_match label, response.body
    end
  end

  # ── Audit interpretation: careful language + disclaimer ─────────────────
  test 'inspector audit interpretation uses careful, non-certification language' do
    get run_path('run_01HGJ8K2Z9F')
    assert_response :success
    assert_select '.ic-runinspector__sechead', text: 'Audit interpretation'
    assert_match 'Interpretation only — not a compliance certification.', response.body
    assert_match 'Raw inputs/outputs are not shown here; only safe identifiers and digests are displayed.', response.body
    assert_match 'A signed receipt indicates a registered runtime reported this execution event.', response.body
  end

  test 'inspector explains proof unavailability for a run without signed evidence' do
    get run_path('run_01HGJ9N7P4D') # the running run, proof pending
    assert_response :success
    assert_match 'Proof is unavailable when signed runtime evidence was not produced or attached to this run.', response.body
  end

  # ── Next steps ──────────────────────────────────────────────────────────
  test 'inspector does not offer redundant action or full-run links' do
    get run_path('run_01HGJ8K2Z9F')
    assert_response :success
    assert_select '.ic-runinspector__actions a', text: 'Open action', count: 0
    assert_select '.ic-runinspector__link', 0
    assert_select '.ic-runinspector__openfull', 0
    assert_select '.ic-runinspector__actions a', text: 'Open full run', count: 0
  end

  test 'a runtime-unavailable run offers connect runtime in the inspector' do
    task = {
      'task_id' => 'task_rt', 'status' => 'failed',
      'executed_target' => 'local_runtime', 'runtime_id' => '',
      'dispatched_at' => 4.minutes.ago.iso8601,
      'failure' => { 'reason' => 'runtime not connected' },
    }
    with_real_ds(FakeClient.new(tasks: [task])) do
      get run_path('task_rt')
      assert_response :success
      assert_select '.ic-runinspector__actions a', text: 'Connect runtime'
    end
  end

  # ── Redaction: unsafe fields never leak into the opened run ─────────────
  test 'the opened run never renders auth headers, keys, hosts, env, or failure text' do
    task = {
      'task_id' => 'task_leak', 'status' => 'failed',
      'executed_target' => 'hosted_api',
      'dispatched_at' => 2.minutes.ago.iso8601,
      'failure' => {
        'reason' => 'Authorization: Bearer sk_live_LEAKTOKEN ; ' \
                    'postgres://admin:pw@db.internal:5432/app ; ' \
                    'OVERTURE_API_KEY=zzz ; ADMIN_PASSWORD=secret',
      },
    }
    with_real_ds(FakeClient.new(tasks: [task])) do
      get run_path('task_leak')
      assert_response :success
      %w[
        sk_live_LEAKTOKEN postgres:// db.internal OVERTURE_API_KEY
        ADMIN_PASSWORD Authorization:\ Bearer
      ].each do |needle|
        refute_match needle, response.body, "opened run leaked #{needle}"
      end
    end
  end

  # ── No legacy / compliance wording ──────────────────────────────────────
  test 'the inspector avoids legacy and overclaiming wording' do
    get run_path('run_01HGJ8K2Z9F')
    assert_response :success
    refute_match(/Overture/, response.body)
    refute_match(/Next\.js/, response.body)
    refute_match(/SOC ?2|HIPAA|ISO ?27001|GDPR|legally admissible/i, response.body)
    refute_match(/\btenant\b/i, response.body)
    refute_match(/\blicense\b/i, response.body)
  end
end
