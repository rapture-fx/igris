require 'test_helper'

# Locks the onboarding/workspace split: /welcome teaches Igris (hero, diagram,
# first-action checklist, target/runtime explanation), while /home is the
# everyday workspace (needs-attention, status summaries, recent runs) with no
# education hero and no fake activity chart.
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

  # ── Welcome is the onboarding page ───────────────────────────────────────
  test 'welcome contains the product explanation and architecture diagram' do
    get '/welcome'
    assert_response :success
    assert_match 'Give your AI agent a safe action endpoint.', response.body
    assert_match 'Your agent calls Igris instead of calling the tool directly.', response.body
    assert_match 'ic-diagram', response.body                       # the diagram is present
    assert_match 'Where actions run', response.body                # target explanation
    assert_match 'No runtime needed', response.body
    assert_match 'Runtime required', response.body
    assert_match 'only needed for private files', response.body    # runtime explanation
  end

  test 'welcome links to create-first-action and to overview' do
    get '/welcome'
    assert_match 'Create your first action', response.body
    assert_match 'Go to Overview', response.body
  end

  # ── Welcome lives inside the console chrome (not a standalone page) ───────
  test 'welcome renders inside the console chrome with the icon rail' do
    get '/welcome'
    assert_response :success
    assert_match 'ic-rail', response.body                      # icon rail present
    assert_match 'Overview', response.body                     # Overview rail item
    assert_match 'Get started', response.body                  # topbar title
  end

  test 'create-first-action CTA lands on the new-action wizard' do
    post '/welcome/enter', params: { to: 'new_action' }
    assert_redirected_to new_action_path
    assert_equal '1', cookies[:igris_welcomed]
  end

  # ── Home is the workspace ────────────────────────────────────────────────
  test 'home does not render the education hero or diagram when actions exist' do
    get '/home' # fixture mode ships actions
    assert_response :success
    refute_match 'Give your AI agent a safe action endpoint.', response.body
    refute_match 'ic-diagram', response.body
  end

  test 'home shows compact workspace sections when actions exist' do
    get '/home?tab=attention' # the needs-attention section lives on its own tab
    assert_response :success
    assert_match 'Needs attention', response.body
    assert_match 'Workspace', response.body
    assert_match 'Actions ready', response.body
    assert_match 'Runtime status', response.body
  end

  test 'home shows a first-action empty state with a welcome link when no actions' do
    with_fake_ds(FakeDS.new(actions: [])) do
      get '/home'
      assert_response :success
      assert_match 'Create your first action', response.body
      assert_match 'See how Igris works', response.body
      assert_match welcome_path, response.body
      refute_match 'Needs attention', response.body # no workspace sections with zero actions
    end
  end

  # ── No fake production metrics in demo mode ──────────────────────────────
  test 'home never renders a 105-day fake activity chart in demo mode' do
    get '/home' # fixture/demo mode
    assert_response :success
    refute_match 'ic-chartcard', response.body
    refute_match 'ic-pulse', response.body
    refute_match 'runs / day', response.body
  end

  # ── Workspace profile layout ─────────────────────────────────────────────
  test 'home renders the workspace banner using /home.png' do
    get '/home'
    assert_response :success
    assert_match '/home.png', response.body
    assert_match 'ic-workspace-banner', response.body
  end

  test 'home workspace panel shows the status rows' do
    get '/home'
    assert_response :success
    assert_match 'Actions ready', response.body
    assert_match 'Last run', response.body
    assert_match 'Runtime status', response.body
    assert_match 'Igris API', response.body
  end

  test 'home quick actions include create action, connect runtime, view runs' do
    get '/home'
    assert_response :success
    assert_match 'Create action', response.body
    assert_match 'Connect runtime', response.body
    assert_match 'View runs', response.body
  end

  test 'home feed shows notification-style activity events when runs exist' do
    get '/home?tab=feed' # fixtures ship runs; feed events live on the feed tab
    assert_response :success
    assert_match 'ic-feed-item', response.body          # separate events, not a table
    assert_match 'ic-feed-item__ico', response.body     # per-event status glyph
    assert_match(%r{Action <strong>\w+</strong>}, response.body)
    assert_match 'ic-feed-badge', response.body         # routing/proof/status now render as badges
  end

  test 'home feed shows an honest empty state when no runs in real mode' do
    action = { id: 'a1', name: 'send_email', target_type: 'hosted_api',
               target_label: 'Hosted API', setup: 'Ready', endpoint_readiness: 'ready' }
    with_fake_ds(FakeDS.new(actions: [action], runtimes: [], runs: [])) do
      get '/home?tab=feed' # the no-activity empty state lives on the feed tab
      assert_response :success
      assert_match 'No activity yet', response.body
      refute_match 'ic-chartcard', response.body
    end
  end

  test 'home zero-actions state links to the new-action wizard and welcome' do
    with_fake_ds(FakeDS.new(actions: [])) do
      get '/home'
      assert_response :success
      assert_match new_action_path, response.body
      assert_match welcome_path, response.body
      assert_match 'ic-workspace-banner', response.body # banner stays
    end
  end

  # ── Copy guardrail ───────────────────────────────────────────────────────
  test 'welcome and home never expose Overture wording' do
    %w[/welcome /home].each do |path|
      get path
      assert_response :success
      refute_match(/Overture/, response.body, "#{path} exposed 'Overture'")
    end
  end
end
