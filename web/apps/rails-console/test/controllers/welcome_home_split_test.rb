require 'test_helper'

# Locks the onboarding/workspace split: /home teaches Igris (endpoint call,
# target/runtime explanation), while /overview is the everyday workspace
# (needs-attention, status summaries, recent runs) with no education hero and
# no fake activity chart.
class WelcomeHomeSplitTest < ActionDispatch::IntegrationTest
  # Real-mode DataSource double so we can drive the zero-actions branch.
  class FakeDS
    attr_reader :mode, :error

    def initialize(actions: [], runtimes: [], runs: [])
      @mode = :real
      @error = nil
      @actions = actions
      @runtimes = runtimes
      @runs = runs
    end

    def fixtures? = false
    def real?     = true
    def degraded? = false
    def actions   = @actions
    def recent_runs(**) = @runs
    def runtimes  = @runtimes
    def find_action(id) = @actions.find { |a| a[:id] == id || a[:name] == id }
    def runs_for_action(_) = []
    def runtime_required_for?(_) = false
    def healthy_runtime? = false
    def runtime_api_key_status = nil
  end

  def with_fake_ds(ds)
    ApplicationController.class_eval do
      alias_method :__orig_ds_split, :data_source
      define_method(:data_source) { @data_source ||= ds }
    end
    yield ds
  ensure
    ApplicationController.class_eval { alias_method :data_source, :__orig_ds_split }
  end

  # ── Home is the onboarding page ─────────────────────────────────────────
  test 'home contains the product explanation and first action call path' do
    get '/home'
    assert_response :success
    assert_match 'Give your AI agent a safe action endpoint.', response.body
    assert_match 'Your agent calls Igris instead of calling the tool directly.', response.body
    assert_match 'Call Igris from your agent', response.body
    assert_match 'Action endpoint', response.body
    assert_match 'Example request', response.body
    assert_match 'Where actions run', response.body
    assert_match 'No runtime needed', response.body
    assert_match 'Runtime required', response.body
    assert_match 'only needed for private files', response.body
    assert_match 'ic-diagram', response.body
    assert_match 'Register an action', response.body
  end

  test 'home links to create-first-action and to overview' do
    get '/home'
    assert_match 'Create your first action', response.body
    assert_match 'Go to Overview', response.body
  end

  test 'legacy /welcome redirects to /home' do
    get '/welcome'
    assert_redirected_to home_path
  end

  test 'home renders inside the console chrome with the icon rail' do
    get '/home'
    assert_response :success
    assert_match 'ic-rail', response.body
    assert_match 'Overview', response.body
    assert_match 'Home', response.body
  end

  test 'create-first-action CTA lands on the new-action wizard' do
    post '/home/enter', params: { to: 'new_action' }
    assert_redirected_to new_action_path
    assert_equal '1', cookies[:igris_welcomed]
  end

  # ── Overview is the workspace ───────────────────────────────────────────
  test 'overview does not render the education hero when actions exist' do
    get '/overview' # fixture mode ships actions
    assert_response :success
    refute_match 'Give your AI agent a safe action endpoint.', response.body
  end

  test 'overview shows compact workspace sections when actions exist' do
    get '/overview?tab=attention'
    assert_response :success
    assert_match 'Needs attention', response.body
    assert_match 'Workspace', response.body
    assert_match 'Actions ready', response.body
    assert_match 'Runtime status', response.body
  end

  test 'overview shows a first-action empty state with a home link when no actions' do
    with_fake_ds(FakeDS.new(actions: [])) do
      get '/overview'
      assert_response :success
      assert_match 'Create your first action', response.body
      assert_match 'See how Igris works', response.body
      assert_match home_path, response.body
      refute_match 'Needs attention', response.body
    end
  end

  # ── No fake production metrics in demo mode ──────────────────────────────
  test 'overview never renders a 105-day fake activity chart in demo mode' do
    get '/overview'
    assert_response :success
    refute_match 'ic-chartcard', response.body
    refute_match 'ic-pulse', response.body
    refute_match 'runs / day', response.body
  end

  # ── Workspace profile layout ─────────────────────────────────────────────
  test 'overview renders the workspace shell without the retired banner' do
    get '/overview'
    assert_response :success
    assert_match 'ic-workspace-layout', response.body
    refute_match '/home.png', response.body
    refute_match 'ic-workspace-banner', response.body
  end

  test 'overview workspace panel shows the status rows' do
    get '/overview'
    assert_response :success
    assert_match 'Actions ready', response.body
    assert_match 'Last run', response.body
    assert_match 'Runtime status', response.body
    assert_match 'Igris API', response.body
  end

  test 'overview quick actions include create action, connect runtime, view runs' do
    get '/overview'
    assert_response :success
    assert_match 'Create action', response.body
    assert_match 'Connect runtime', response.body
    assert_match 'View runs', response.body
  end

  test 'overview feed shows notification-style activity events when runs exist' do
    get '/overview?tab=feed'
    assert_response :success
    assert_match 'ic-feed-item', response.body
    assert_match(%r{Action <strong>\w+</strong>}, response.body)
    assert_match 'ic-feed-badge', response.body
  end

  test 'overview feed shows an honest empty state when no runs in real mode' do
    action = { id: 'a1', name: 'send_email', target_type: 'hosted_api',
               target_label: 'Hosted API', setup: 'Ready', endpoint_readiness: 'ready' }
    with_fake_ds(FakeDS.new(actions: [action], runtimes: [], runs: [])) do
      get '/overview?tab=feed'
      assert_response :success
      assert_match 'No activity yet', response.body
      refute_match 'ic-chartcard', response.body
    end
  end

  test 'map tab renders the Run Activity Map with outcome bands' do
    get '/overview?tab=map'
    assert_response :success
    assert_match 'ic-runmap', response.body
    ['Verified', 'Completed', 'Recovered', 'Waiting', 'Blocked', 'Failed'].each do |band|
      assert_match band, response.body
    end
  end

  test 'map tab does not invent caller identity' do
    get '/overview?tab=map'
    assert_response :success
    refute_match 'Caller unavailable', response.body
    refute_match 'Submitter', response.body
  end

  test 'run activity map shows empty state and create-action cta with no runs' do
    action = { id: 'a1', name: 'send_email', target_type: 'hosted_api',
               target_label: 'Hosted API', setup: 'Ready', endpoint_readiness: 'ready' }
    with_fake_ds(FakeDS.new(actions: [action], runtimes: [], runs: [])) do
      get '/overview?tab=map'
      assert_response :success
      assert_match 'Run Activity Map', response.body
      assert_match 'No run activity yet', response.body
      assert_match new_action_path, response.body
    end
  end

  test 'run activity map shows proof unavailable when proof fields are absent' do
    action = { id: 'a1', name: 'send_email', target_type: 'hosted_api', setup: 'Ready' }
    run = { id: 'run_x', action: 'send_email', status: 'Succeeded',
            proof: 'Proof unavailable', routed_via: 'Hosted API',
            executed_target: 'hosted_api', policy: 'Safe automation' }
    with_fake_ds(FakeDS.new(actions: [action], runtimes: [], runs: [run])) do
      get '/overview?tab=map'
      assert_response :success
      assert_match 'Proof unavailable', response.body
      refute_match 'Signed', response.body
    end
  end

  test 'execution machine never leaks unsafe target detail' do
    action = { id: 'a1', name: 'send_email', target_type: 'hosted_api', setup: 'Ready' }
    run = { id: 'run_x', action: 'send_email', status: 'Succeeded',
            proof: 'Proof verified', routed_via: 'Hosted API',
            executed_target: 'hosted_api', policy: 'Safe automation',
            target_url: 'https://secret.internal/private', runtime_id: 'rt_local' }
    with_fake_ds(FakeDS.new(actions: [action], runtimes: [], runs: [run])) do
      get '/overview?tab=map'
      assert_response :success
      refute_match 'secret.internal', response.body
    end
  end

  test 'overview zero-actions state links to the new-action wizard and home' do
    with_fake_ds(FakeDS.new(actions: [])) do
      get '/overview'
      assert_response :success
      assert_match new_action_path, response.body
      assert_match home_path, response.body
      refute_match 'ic-workspace-banner', response.body
    end
  end

  # ── Copy guardrail ───────────────────────────────────────────────────────
  test 'home and overview never expose Overture wording' do
    %w[/home /overview].each do |path|
      get path
      assert_response :success
      refute_match(/Overture/, response.body, "#{path} exposed 'Overture'")
    end
  end
end