require 'test_helper'

# Runtime onboarding: the /runtimes page explains what a runtime is and when
# it's needed, presents the install/start commands, shows connected-runtime
# status (or an empty state), and never leaks unsafe runtime fields. Local
# runtime Action Detail guides the user to connect a runtime before testing.
class RuntimeOnboardingTest < ActionDispatch::IntegrationTest
  # ── Real-mode DataSource double ─────────────────────────────────────────
  class FakeDS
    attr_reader :mode, :error
    attr_accessor :key_status, :generated

    def initialize(runtimes: [], actions: [], key_status: nil, generated: nil)
      @mode = :real
      @error = nil
      @runtimes = runtimes
      @actions = actions
      @key_status = key_status
      @generated = generated
    end

    def fixtures?  = false
    def real?      = true
    def degraded?  = false
    def runtimes   = @runtimes
    def actions    = @actions
    def find_action(id) = @actions.find { |a| a[:id] == id || a[:name] == id }
    def runs_for_action(_) = []
    def recent_runs(**) = []
    def all_runs(**) = []
    def daily_run_counts = []
    def find_run(_) = nil
    def healthy_runtime? = @runtimes.any? { |r| r[:status] == 'Healthy' }
    def runtime_required_for?(action)
      action && action[:target_type].to_s == 'local_runtime' && !healthy_runtime?
    end
    def runtime_summary
      {
        total:   @runtimes.size,
        healthy: @runtimes.count { |r| r[:status] == 'Healthy' },
        stale:   @runtimes.count { |r| %w[Stale Degraded].include?(r[:status]) },
        offline: @runtimes.count { |r| r[:status] == 'Offline' },
      }
    end
    def local_runtime_actions = @actions.select { |a| a[:target_type].to_s == 'local_runtime' }
    def runtime_runs(**) = []
    def run_through_runtime?(run)
      run[:runtime_id].to_s.strip != '' || run[:executed_target].to_s == 'local_runtime'
    end
    def runtime_api_key_status = @key_status
    def create_runtime_api_key
      @generated || { 'api_key' => 'igris_generatedrawkey0123456789', 'prefix' => 'igris_genera', 'created_at' => '2026-05-30T00:00:00Z' }
    end
  end

  def local_action
    {
      id: 'rebuild_index', name: 'rebuild_index', display_name: 'Rebuild index',
      description: 'Reindex a private corpus.', target_type: 'local_runtime',
      target_label: 'Local runtime', target_url: '', method: 'POST',
      policy: 'Safe automation', policy_preset: 'Safe automation', replay: 'On',
      secrets_state: 'Not configured',
      endpoint: 'https://api.igrisinertial.com/v1/actions/rebuild_index/run',
      setup: 'Needs runtime', last_run_at: nil, last_run_status: nil, proof: 'No run yet',
      approval_required: false, irreversible: false, raw: {},
    }
  end

  def healthy_runtime_row
    { runtime_id: 'rt_x', name: 'rt_x', status: 'Healthy', last_seen_at: Time.now,
      capabilities: ['http_call'], os: 'linux-amd64', host: 'internal.example', ip: '10.0.0.9' }
  end

  def with_fake_ds(ds)
    ApplicationController.class_eval do
      alias_method :__orig_ds_rt, :data_source
      define_method(:data_source) { @data_source ||= ds }
    end
    yield ds
  ensure
    ApplicationController.class_eval { alias_method :data_source, :__orig_ds_rt }
  end

  # ── /runtimes explanation + commands (fixture mode) ──────────────────────
  test 'runtimes page explains when a runtime is and is not needed' do
    get '/runtimes'
    assert_response :success
    assert_match 'Use a runtime when an action needs private files, internal APIs, or', response.body
    assert_match 'Hosted API and webhook actions do not require a runtime', response.body
    assert_match 'Do I need a runtime?', response.body
    assert_match 'Runtime required', response.body
    assert_match 'No runtime needed', response.body
  end

  test 'runtimes page shows the install and start commands' do
    get '/runtimes'
    assert_response :success
    assert_match 'curl -fsSL https://igrisinertial.com/install | bash', response.body
    assert_match 'igris-runtime serve', response.body
  end

  test 'runtimes page security note: private systems are not exposed publicly' do
    get '/runtimes'
    assert_match 'do not need to be exposed to the public internet', response.body
  end

  # ── Fixture mode stays visibly labelled ──────────────────────────────────
  test 'runtimes page labels fixture runtimes as demo data' do
    get '/runtimes' # fixture mode by default in test env
    assert_response :success
    assert_match 'rt_prod_01', response.body            # demo runtime renders
    assert_match(/Demo data — these are sample runtimes/, response.body)
  end

  # ── Empty state (real mode, no runtimes) ─────────────────────────────────
  test 'runtimes page shows a no-runtime empty state in real mode' do
    with_fake_ds(FakeDS.new(runtimes: [])) do
      get '/runtimes'
      assert_response :success
      assert_match 'No runtime connected yet', response.body
      assert_match 'machine that has access', response.body
      assert_match 'curl -fsSL https://igrisinertial.com/install | bash', response.body
      refute_match(/Demo data/, response.body) # real mode must not claim demo
    end
  end

  # ── No unsafe fields leak ────────────────────────────────────────────────
  test 'runtimes page never renders hostnames, IPs, or env values' do
    with_fake_ds(FakeDS.new(runtimes: [healthy_runtime_row])) do
      get '/runtimes'
      assert_response :success
      assert_match 'rt_x', response.body # safe id is fine
      refute_match 'internal.example', response.body
      refute_match '10.0.0.9', response.body
    end
  end

  # ── Local runtime Action Detail guidance ─────────────────────────────────
  test 'local_runtime action shows Runtime required when no healthy runtime' do
    with_fake_ds(FakeDS.new(runtimes: [], actions: [local_action])) do
      get '/actions/rebuild_index'
      assert_response :success
      assert_match 'Runtime required', response.body
      assert_match 'Connect a runtime', response.body
      assert_match 'runs through a local runtime', response.body
      refute_match 'Runtime available', response.body
    end
  end

  test 'local_runtime action allows testing when a healthy runtime exists' do
    with_fake_ds(FakeDS.new(runtimes: [healthy_runtime_row], actions: [local_action])) do
      get '/actions/rebuild_index'
      assert_response :success
      assert_match 'Runtime available', response.body
      refute_match 'Runtime required', response.body
    end
  end

  # ── Create-action target step copy ───────────────────────────────────────
  test 'create wizard target step says hosted_api and webhook need no runtime' do
    get '/actions/new?step=target&name=foo'
    assert_response :success
    assert_match 'No runtime needed', response.body
    assert_match 'Runtime required', response.body
    assert_match 'Learn how runtimes work', response.body
  end

  # ── Runtime key issuance (read-once, safe) ───────────────────────────────
  test 'generating a runtime key shows the raw key once and wires the commands' do
    ds = FakeDS.new(generated: {
      'api_key' => 'igris_rawkeyshownonce0123456789abcdef', 'prefix' => 'igris_rawkey', 'created_at' => '2026-05-30T00:00:00Z',
    })
    with_fake_ds(ds) do
      post '/runtimes/api_key'
      assert_response :success
      assert_match 'igris_rawkeyshownonce0123456789abcdef', response.body
      assert_match 'Shown once', response.body
      # install + serve commands embed the freshly generated key
      assert_match 'IGRIS_API_KEY=igris_rawkeyshownonce0123456789abcdef curl', response.body
      assert_match 'IGRIS_API_KEY=igris_rawkeyshownonce0123456789abcdef igris-runtime serve', response.body
    end
  end

  test 'after refresh only the prefix is shown, never the raw key' do
    ds = FakeDS.new(key_status: { 'has_key' => true, 'prefix' => 'igris_rawkey' })
    with_fake_ds(ds) do
      get '/runtimes'
      assert_response :success
      assert_match 'igris_rawkey', response.body            # prefix shown
      assert_match 'already exists', response.body
      refute_match 'igris_rawkeyshownonce0123456789abcdef', response.body  # raw never shown again
      # placeholder, not a real key, in the commands
      assert_match 'IGRIS_API_KEY=igris_... curl', response.body
    end
  end

  test 'fixture mode does not fabricate a runtime key on generate' do
    post '/runtimes/api_key' # fixture mode (no injection)
    assert_response :success
    assert_match 'Demo mode', response.body
    assert_match(/Demo mode does not issue real keys|connect a live Igris API/i, response.body)
    refute_match(/igris_[0-9a-f]{16,}/, response.body) # no fabricated raw key
  end

  test 'runtimes page never renders the console service key (OVERTURE_API_KEY)' do
    prev = ENV['OVERTURE_API_KEY']
    ENV['OVERTURE_API_KEY'] = 'igris_service_secret_must_never_render_abc'
    get '/runtimes'
    assert_response :success
    refute_match 'igris_service_secret_must_never_render_abc', response.body
  ensure
    ENV['OVERTURE_API_KEY'] = prev
  end

  test 'generated runtime key is never the console service key' do
    prev = ENV['OVERTURE_API_KEY']
    ENV['OVERTURE_API_KEY'] = 'igris_service_secret_must_never_render_abc'
    ds = FakeDS.new(generated: {
      'api_key' => 'igris_distinct_runtime_key_999', 'prefix' => 'igris_distin', 'created_at' => '2026-05-30T00:00:00Z',
    })
    with_fake_ds(ds) do
      post '/runtimes/api_key'
      assert_response :success
      assert_match 'igris_distinct_runtime_key_999', response.body
      refute_match 'igris_service_secret_must_never_render_abc', response.body
    end
  ensure
    ENV['OVERTURE_API_KEY'] = prev
  end

  # ── Home contextual hint ─────────────────────────────────────────────────
  test 'home hints to connect a runtime when a local action has none' do
    with_fake_ds(FakeDS.new(runtimes: [], actions: [local_action])) do
      get '/home'
      assert_response :success
      assert_match 'Local runtime action needs a connected runtime', response.body
    end
  end

  test 'home does not nag about runtime when no local actions exist' do
    with_fake_ds(FakeDS.new(runtimes: [], actions: [])) do
      get '/home'
      assert_response :success
      refute_match 'needs a connected runtime', response.body
    end
  end

  # ── Copy guardrail ───────────────────────────────────────────────────────
  test 'runtimes page never exposes Overture wording' do
    get '/runtimes'
    assert_response :success
    refute_match(/Overture/, response.body)
  end

  test 'local_runtime action detail never exposes Overture wording' do
    with_fake_ds(FakeDS.new(runtimes: [], actions: [local_action])) do
      get '/actions/rebuild_index'
      assert_response :success
      refute_match(/Overture/, response.body)
    end
  end
end
