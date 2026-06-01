require 'test_helper'

# The Action → Run → Runtime loop on /runs, /runs/:id, and /runtimes.
#
# Runs must read as a debugging surface (summary strip, filters, status,
# next actions), Run detail must give strong context + a single clear next
# step and linkbacks, and Runtimes must connect back to the Actions and Runs
# that depend on them — all without leaking secrets or legacy wording.
#
# Fixture mode (default in test) backs most cases; a small real-mode double
# drives the empty state and the runtime-unavailable guidance branch.
class RunsLoopTest < ActionDispatch::IntegrationTest
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
      alias_method :__orig_ds_loop, :data_source
      define_method(:data_source) { @data_source ||= ds }
    end
    assert ds.real?, 'expected real mode'
    yield ds
  ensure
    ApplicationController.class_eval { alias_method :data_source, :__orig_ds_loop }
  end

  # ── Runs index: just the list of runs + a filter/search bar ─────────────
  test 'runs index shows the title and run status labels' do
    get '/runs'
    assert_response :success
    assert_match 'Action executions — evidence, policy, recovery, and proof', response.body
    assert_match 'Running', response.body            # the in-flight fixture run
    assert_match 'Failed', response.body             # the failed fixture run
  end

  # ── Runs index: custom dropdown filters (status / route / date) + search ─
  test 'runs index renders the status/route/date dropdowns and a search field' do
    get '/runs'
    assert_response :success
    assert_select 'details.ic-dropdown', 3                       # status / route / date
    assert_select 'a.ic-dropdown__item[href*=?]', 'status=failed'
    assert_select 'a.ic-dropdown__item[href*=?]', 'range=week'
    assert_select 'form.ic-runsearch input[name=?]', 'q'
    assert_select 'select', false                                # no native browser dropdowns
    assert_select 'nav.ig-tabs', false                           # tabs removed
    assert_select 'a.ic-filter', false                           # no count pills
  end

  test 'status filter narrows the list to failed runs' do
    get '/runs?status=failed'
    assert_response :success
    assert_select '.ic-run-row', 8 # 7 Failed + 1 Error
    assert_select '.ic-run-row__id', /run_01HGJ5W0M3B/ # refund_charge failed
  end

  test 'route filter narrows the list to one routed-via target' do
    get '/runs', params: { route: 'Hosted API · Resend' }
    assert_response :success
    assert_select '.ic-run-row', 6
    assert_select '.ic-run-row__title', text: 'send_email'
  end

  test 'an unknown status falls back to all runs' do
    get '/runs?status=bogus'
    assert_response :success
    assert_select '.ic-run-row', 46 # every fixture run is shown
  end

  test 'search narrows the list by run id' do
    get '/runs?q=run_01HGJ5W0M3B'
    assert_response :success
    assert_select '.ic-run-row', 1
    assert_select '.ic-run-row__id', /run_01HGJ5W0M3B/
  end

  test 'search narrows the list by action name' do
    get '/runs?q=refund_charge'
    assert_response :success
    assert_select '.ic-run-row', minimum: 1
    assert_select '.ic-run-row__title', text: 'refund_charge'
    refute_match 'send_email', response.body         # non-matching actions excluded
  end

  # ── Runs index: each row is itself the link to the run detail ───────────
  # The redundant per-row "Open run" / "Open action" hover buttons were
  # removed — the whole row is clickable.
  test 'run rows link to the run detail with no redundant per-row buttons' do
    get '/runs'
    assert_response :success
    assert_select 'a.ic-run-row__open[href=?]', run_path('run_01HGJ9N7P4D')
    assert_select '.ic-run-row__actions', false # the hover action group is gone
    assert_select '.ic-run-row__act', false     # …and its Open run / Open action buttons
  end

  # ── Runs index: empty state (real mode, no runs) ────────────────────────
  test 'runs index shows the no-runs empty state with create CTAs' do
    with_real_ds(FakeClient.new(tasks: [], actions: [])) do
      get '/runs'
      assert_response :success
      assert_match 'No runs yet', response.body
      assert_match 'Runs appear when an agent or app calls an Igris action endpoint.', response.body
      assert_match 'Create action', response.body
    end
  end

  # ── Run detail: title id + copy, linkbacks, at-a-glance summary ─────────
  test 'run detail shows the copyable run id, linkbacks, and routed-via context' do
    get '/runs/run_01HGJ3R6T7E' # export_ledger, routed through a runtime
    assert_response :success
    assert_match 'run_01HGJ3R6T7E', response.body    # run id shown in the topbar
    assert_match 'Routed via', response.body         # at-a-glance context in the summary
    assert_match 'Copy', response.body               # inline copy button
    assert_match 'Back to action', response.body     # action is known in fixtures
    assert_match 'Open runtime', response.body       # ran through a runtime
  end

  # ── Run detail: "What to do next" is state-aware ────────────────────────
  test 'successful run suggests opening the action and viewing evidence' do
    get '/runs/run_01HGJ8K2Z9F' # send_email, Succeeded, proof verified
    assert_response :success
    assert_match 'What to do next', response.body
    assert_match 'Run completed successfully.', response.body
    assert_match 'View evidence', response.body
  end

  test 'failed run suggests opening the action and copying the run id' do
    get '/runs/run_01HGJ5W0M3B' # refund_charge, Failed
    assert_response :success
    assert_match 'What to do next', response.body
    assert_match 'Run failed.', response.body
    assert_match 'Copy run ID', response.body
  end

  test 'a runtime-unavailable failure points the developer at connecting a runtime' do
    task = {
      'task_id' => 'task_rt_fail', 'status' => 'failed',
      'executed_target' => 'local_runtime', 'runtime_id' => '',
      'dispatched_at' => 3.minutes.ago.iso8601,
      'failure' => { 'reason' => 'no runtime connected' },
    }
    with_real_ds(FakeClient.new(tasks: [task])) do
      get '/runs/task_rt_fail'
      assert_response :success
      assert_match 'This run required a runtime that was unavailable.', response.body
      assert_match 'Connect runtime', response.body
      refute_match 'no runtime connected', response.body # raw failure text never rendered
    end
  end

  # ── Runtimes: connected back to Actions and Runs ────────────────────────
  test 'runtimes page lists the actions that need a runtime' do
    get '/runtimes'
    assert_response :success
    assert_match 'Actions requiring runtime', response.body
    assert_match 'rebuild_search_index', response.body # local_runtime fixture action
    assert_match 'export_ledger', response.body        # second local_runtime action
    assert_select 'a[href=?]', action_path('rebuild_search_index') # links to the action
  end

  test 'runtimes page lists recent runs that went through a runtime' do
    get '/runtimes'
    assert_response :success
    assert_match 'Runtime runs', response.body
    assert_match 'run_01HGJ3R6T7E', response.body      # the runtime-routed fixture run
    assert_select 'a[href=?]', run_path('run_01HGJ3R6T7E') # links to the run
  end

  test 'runtimes page summarises fleet status by health' do
    get '/runtimes'
    assert_response :success
    assert_match 'healthy', response.body
    assert_match 'stale', response.body                # one stale fixture runtime
  end

  # ── Safety: no secrets, no legacy / cross-stack wording ─────────────────
  test 'runs surfaces never mention Overture or Next.js' do
    ['/runs', '/runs/run_01HGJ3R6T7E', '/runs/run_01HGJ5W0M3B'].each do |path|
      get path
      assert_response :success
      refute_match(/Overture/, response.body, "#{path} leaked legacy wording")
      refute_match(/Next\.js/, response.body, "#{path} leaked cross-stack wording")
    end
  end

  test 'runtimes and settings never mention Overture or Next.js' do
    %w[/runtimes /settings /settings?section=runtime /settings?section=tools /settings?section=access].each do |path|
      get path
      assert_response :success
      refute_match(/Overture/, response.body, "#{path} leaked legacy wording")
      refute_match(/Next\.js/, response.body, "#{path} leaked cross-stack wording")
    end
  end

  test 'settings never echoes the console service key value' do
    prev = ENV['OVERTURE_API_KEY']
    ENV['OVERTURE_API_KEY'] = 'igris_service_secret_must_never_render_xyz'
    %w[/settings?section=access /settings?section=env].each do |path|
      get path
      assert_response :success
      refute_match 'igris_service_secret_must_never_render_xyz', response.body
    end
  ensure
    ENV['OVERTURE_API_KEY'] = prev
  end

  test 'settings explains agents get an action endpoint, not direct tool access' do
    get '/settings?section=tools'
    assert_response :success
    assert_match 'target access', response.body          # heading ("Tool &amp; target access")
    assert_match 'never gets direct tool access', response.body
    assert_match 'Igris action endpoint', response.body
  end

  test 'settings uses runtime key wording, never runtime license' do
    get '/settings?section=runtime'
    assert_response :success
    assert_match 'Runtime keys', response.body
    refute_match(/[Ll]icense/, response.body)
  end
end
