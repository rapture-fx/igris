require 'test_helper'

# Run Inspector — the server-rendered, right-side quick-inspection drawer on
# /runs, opened with ?inspect=<run_id>. It must:
#   - stay closed unless inspect is present, and never break the list;
#   - preserve the active filter when opening/closing;
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

  # ── Closed by default ───────────────────────────────────────────────────
  test 'runs without inspect does not render the drawer' do
    get '/runs'
    assert_response :success
    assert_select '.ic-runinspector', 0
    refute_match 'Run Inspector', response.body
  end

  # ── Opens via the query param ───────────────────────────────────────────
  test 'runs with inspect renders the Run Inspector drawer' do
    get '/runs?inspect=run_01HGJ8K2Z9F'
    assert_response :success
    assert_select '.ic-runinspector', 1
    assert_match 'Run Inspector', response.body
  end

  # ── Inspect links preserve the active filter ────────────────────────────
  test 'run rows link to the inspector preserving the active filter' do
    get '/runs?filter=failed'
    assert_response :success
    assert_select "a.ic-run-row__open[href*='inspect=run_01HGJ5W0M3B']" do |els|
      assert els.first['href'].include?('filter=failed'),
             "inspect link should preserve filter=failed, got #{els.first['href']}"
    end
  end

  test 'closing the drawer preserves the filter and drops inspect' do
    get '/runs?filter=failed&inspect=run_01HGJ5W0M3B'
    assert_response :success
    assert_select "a.ic-runinspector__close[href*='filter=failed']"
    assert_select "a.ic-runinspector__close[href*='inspect=']", 0
  end

  # ── Selected row active state ───────────────────────────────────────────
  test 'the inspected run row gets a selected state' do
    get '/runs?inspect=run_01HGJ5W0M3B'
    assert_response :success
    assert_select '.ic-run-row.is-selected', 1
  end

  # ── Overview ────────────────────────────────────────────────────────────
  test 'drawer overview shows action, status, routed via, and proof' do
    get '/runs?inspect=run_01HGJ8K2Z9F' # send_email, Succeeded, proof verified
    assert_response :success
    assert_select '.ic-runinspector' do
      assert_select '.ic-runinspector__sechead', text: 'Overview'
      assert_match 'send_email', response.body
      assert_match 'Routed via', response.body
      assert_match 'Proof verified', response.body
    end
  end

  # ── Agent request: honest unavailable state ─────────────────────────────
  test 'drawer shows the agent request unavailable state when none exists' do
    get '/runs?inspect=run_01HGJ8K2Z9F'
    assert_response :success
    assert_select '.ic-runinspector__sechead', text: 'Agent request'
    assert_match 'No prompt or request payload is available for this run.', response.body
  end

  # ── Agent request: safe summary only when the API provides one ──────────
  test 'drawer renders a safe redacted request summary when one is provided' do
    task = {
      'task_id' => 'task_safe', 'status' => 'completed',
      'executed_target' => 'hosted_api',
      'dispatched_at' => 1.minute.ago.iso8601,
      'completed_at' => 50.seconds.ago.iso8601,
      'request_summary' => 'tool=http_call · POST /v1/orders · body redacted',
    }
    with_real_ds(FakeClient.new(tasks: [task])) do
      get '/runs?inspect=task_safe'
      assert_response :success
      assert_select 'pre.ic-runinspector__code', /POST \/v1\/orders · body redacted/
      refute_match 'No prompt or request payload is available', response.body
    end
  end

  # ── Execution assessment ────────────────────────────────────────────────
  test 'drawer execution assessment renders the five assessment rows' do
    get '/runs?inspect=run_01HGJ8K2Z9F'
    assert_response :success
    assert_select '.ic-runinspector__sechead', text: 'Execution assessment'
    ['Action completed', 'Policy followed', 'Runtime path', 'Recovery', 'Proof'].each do |label|
      assert_match label, response.body
    end
  end

  # ── Audit interpretation: careful language + disclaimer ─────────────────
  test 'drawer audit interpretation uses careful, non-certification language' do
    get '/runs?inspect=run_01HGJ8K2Z9F'
    assert_response :success
    assert_select '.ic-runinspector__sechead', text: 'Audit interpretation'
    assert_match 'Interpretation only — not a compliance certification.', response.body
    assert_match 'Raw inputs/outputs are not shown here; only safe identifiers and digests are displayed.', response.body
    assert_match 'A signed receipt indicates a registered runtime reported this execution event.', response.body
  end

  test 'drawer explains proof unavailability for a run without signed evidence' do
    get '/runs?inspect=run_01HGJ9N7P4D' # the running run, proof pending
    assert_response :success
    assert_match 'Proof is unavailable when signed runtime evidence was not produced or attached to this run.', response.body
  end

  # ── Next steps ──────────────────────────────────────────────────────────
  test 'drawer next steps always offer open full run and the action' do
    get '/runs?inspect=run_01HGJ8K2Z9F'
    assert_response :success
    assert_select '.ic-runinspector__sechead', text: 'Next steps'
    assert_select "a.ic-btn[href=?]", run_path('run_01HGJ8K2Z9F')
    assert_select '.ic-runinspector__actions a', text: 'Open action'
  end

  test 'a runtime-unavailable run offers connect runtime in the drawer' do
    task = {
      'task_id' => 'task_rt', 'status' => 'failed',
      'executed_target' => 'local_runtime', 'runtime_id' => '',
      'dispatched_at' => 4.minutes.ago.iso8601,
      'failure' => { 'reason' => 'runtime not connected' },
    }
    with_real_ds(FakeClient.new(tasks: [task])) do
      get '/runs?inspect=task_rt'
      assert_response :success
      assert_select '.ic-runinspector__actions a', text: 'Connect runtime'
    end
  end

  # ── Unavailable / unknown run ───────────────────────────────────────────
  test 'inspecting an unknown run renders the error state, not a crash' do
    with_real_ds(FakeClient.new(tasks: [])) do
      get '/runs?inspect=does_not_exist'
      assert_response :success
      assert_match 'Run not found or unavailable', response.body
    end
  end

  # ── Redaction: unsafe fields never leak into the drawer ─────────────────
  test 'the drawer never renders auth headers, keys, hosts, env, or failure text' do
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
      get '/runs?inspect=task_leak'
      assert_response :success
      %w[
        sk_live_LEAKTOKEN postgres:// db.internal OVERTURE_API_KEY
        ADMIN_PASSWORD Authorization:\ Bearer
      ].each do |needle|
        refute_match needle, response.body, "drawer leaked #{needle}"
      end
    end
  end

  # ── No legacy / compliance wording ──────────────────────────────────────
  test 'the inspector page avoids legacy and overclaiming wording' do
    get '/runs?inspect=run_01HGJ8K2Z9F'
    assert_response :success
    refute_match(/Overture/, response.body)
    refute_match(/Next\.js/, response.body)
    refute_match(/SOC ?2|HIPAA|ISO ?27001|GDPR|legally admissible/i, response.body)
    refute_match(/\btenant\b/i, response.body)
    refute_match(/\blicense\b/i, response.body)
  end
end
