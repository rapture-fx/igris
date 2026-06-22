require 'test_helper'

# Action Detail = the workspace for one action. These cover the Overview tab
# acting as a self-sufficient surface: endpoint + copyable snippets, a test
# request panel seeded per target type, runtime-requirement clarity, the
# latest-runs section, and the safety guarantees (no secret values, no
# Overture/Next.js wording). Fixture mode drives the demo paths; a fake
# DataSource drives the real-mode runtime-required path.
class ActionDetailTest < ActionDispatch::IntegrationTest
  # Minimal real-mode DataSource. Surface mirrors the methods the controller
  # and console layout touch, so swapping it in never NoMethodErrors.
  class FakeDS
    attr_reader :mode, :error
    attr_accessor :action, :runs, :healthy

    def initialize(action:, runs: [], healthy: false)
      @mode = :real
      @error = nil
      @action = action
      @runs = runs
      @healthy = healthy
    end

    def fixtures? = false
    def real?     = true
    def degraded? = false
    def actions   = [@action]
    def find_action(id) = (@action if @action[:id] == id || @action[:name] == id)
    def runs_for_action(_) = @runs
    def action_consumer_affinity(_)
      {
        range: 'last_30d',
        action_agents: [],
        agent_actions: [],
        pack_edges: [],
        pack_actions: [],
        hotspots: [],
      }
    end
    def recent_runs(**) = []
    def all_runs(**) = []
    def runtimes = []
    def daily_run_counts = []
    def healthy_runtime? = @healthy
    def runtime_required_for?(a)
      a && a[:target_type].to_s == 'local_runtime' && !@healthy
    end
    def find_run(_) = nil
  end

  LOCAL_ACTION = {
    id: 'read_private_file', name: 'read_private_file', display_name: 'Read private file',
    description: 'Reads a local file', target_type: 'local_runtime',
    target_label: 'Local runtime', target_url: '', method: 'POST',
    policy: 'Read-only', policy_preset: 'Read-only', replay: 'Off',
    secrets_state: 'Not configured',
    endpoint: 'https://api.igrisinertial.com/v1/actions/read_private_file/run',
    setup: 'Needs runtime', last_run_at: nil, last_run_status: nil, proof: 'No run yet',
    approval_required: false, irreversible: false, raw: {},
  }.freeze

  def with_fake_ds(ds)
    ApplicationController.class_eval do
      alias_method :__orig_ds, :data_source
      define_method(:data_source) { @data_source ||= ds }
    end
    yield ds
  ensure
    ApplicationController.class_eval { alias_method :data_source, :__orig_ds }
  end

  # ── Overview is self-sufficient: endpoint visible without a second tab ────
  test 'overview shows the endpoint and copyable curl + JS without opening a tab' do
    get '/actions/send_email' # defaults to the overview tab
    assert_response :success
    assert_match 'Action endpoint', response.body
    assert_match '/v1/actions/send_email/run', response.body
    assert_match 'curl -X POST', response.body
    assert_match 'await fetch', response.body
  end

  HOSTED_ACTION = {
    id: 'a-send', name: 'send_email', display_name: 'Send email',
    description: '', target_type: 'hosted_api', target_label: 'Hosted API',
    target_url: 'https://api.example.com', method: 'POST',
    policy: 'Safe automation', policy_preset: 'Safe automation', replay: 'On',
    secrets_state: 'Configured',
    endpoint: 'https://api.igrisinertial.com/v1/actions/send_email/run',
    setup: 'Ready', last_run_at: nil, last_run_status: nil, proof: 'No run yet',
    approval_required: false, irreversible: false, raw: {},
  }.freeze

  WEBHOOK_ACTION = {
    id: 'create_invoice', name: 'create_invoice', display_name: 'Create invoice',
    description: '', target_type: 'webhook', target_label: 'Webhook',
    target_url: 'https://hooks.example.test/invoice', method: 'POST',
    policy: 'Safe automation', policy_preset: 'Safe automation', replay: 'On',
    secrets_state: 'Not configured',
    endpoint: 'https://api.igrisinertial.com/v1/actions/create_invoice/run',
    setup: 'Ready', last_run_at: nil, last_run_status: nil, proof: 'No run yet',
    approval_required: false, irreversible: false, raw: {},
  }.freeze

  test 'overview test panel is visible without tab hunting and explains success' do
    with_fake_ds(FakeDS.new(action: HOSTED_ACTION, runs: [], healthy: true)) do
      get action_path('a-send') # overview tab by default
      assert_response :success
      assert_match 'Test this action', response.body
      assert_match 'What should happen', response.body
      assert_match 'taken to the run record', response.body          # real mode success copy
      assert_select "form[action=?]", run_action_path('a-send') # test form posts to the run action
      assert_match 'Send test request', response.body
    end
  end

  test 'overview explains which agents use this action when affinity data exists' do
    ds = FakeDS.new(action: HOSTED_ACTION, runs: [], healthy: true)
    def ds.action_consumer_affinity(_)
      {
        range: 'last_30d',
        action_agents: [
          {
            agent_id: 'agent-1', agent_name: 'Support Agent', agent_type: 'support',
            run_count: 9, successful_runs: 8, failed_runs: 1,
            approval_required_runs: 2, recovery_runs: 1,
            eval_run_count: 3, eval_passed_runs: 3, proof_covered_runs: 8,
            success_rate: 8 / 9.0, approval_rate: 2 / 9.0,
            recovery_rate: 1 / 9.0, eval_pass_rate: 1.0, proof_coverage: 8 / 9.0,
          },
        ],
        agent_actions: [], pack_edges: [], pack_actions: [], hotspots: [],
      }
    end
    with_fake_ds(ds) do
      get action_path('a-send')
      assert_response :success
      assert_match 'Who uses this action', response.body
      assert_match 'Support Agent', response.body
      assert_match 'recorded executions', response.body
    end
  end

  # ── Operational context: Usage / Reliability / Investigation ──────────────
  test 'overview surfaces reliability rates from the intelligence aggregate' do
    ds = FakeDS.new(action: HOSTED_ACTION, runs: [], healthy: true)
    def ds.action_intelligence(_name, range: 'last_30d')
      {
        key: 'send_email', name: 'send_email', total_runs: 40,
        successful_runs: 34, failed_runs: 6, approval_required_runs: 2,
        recovery_runs: 5, eval_run_count: 4, eval_passed_runs: 4,
        proof_covered_runs: 38, average_duration_ms: 120.0,
        success_rate: 0.85, failure_rate: 0.15, approval_rate: 0.05,
        recovery_rate: 0.125, eval_pass_rate: 1.0, proof_coverage: 0.95,
      }
    end
    with_fake_ds(ds) do
      get action_path('a-send')
      assert_response :success
      assert_match 'Reliability', response.body
      assert_match 'Success rate', response.body
      assert_match '85%', response.body   # success_rate rendered
      assert_match '95%', response.body   # proof_coverage rendered
      assert_match 'Usage', response.body
      assert_match 'Investigation', response.body
    end
  end

  test 'overview shows an honest empty reliability state when the action has no runs' do
    ds = FakeDS.new(action: HOSTED_ACTION, runs: [], healthy: true)
    def ds.action_intelligence(_name, range: 'last_30d') = nil
    with_fake_ds(ds) do
      get action_path('a-send')
      assert_response :success
      assert_match 'Reliability', response.body
      assert_match 'No recorded runs for this action', response.body
    end
  end

  test 'investigation lists recent failed and recovered runs with run links' do
    runs = [
      { id: 'run_fail_1', action: 'send_email', status: 'Failed', routed_via: 'Hosted API',
        recovery: 'Not needed', proof: 'Proof unavailable', started_at: Time.current },
      { id: 'run_rec_1', action: 'send_email', status: 'Succeeded', routed_via: 'Hosted API',
        recovery: 'Retried 2x', proof: 'Proof verified', started_at: Time.current },
    ]
    ds = FakeDS.new(action: HOSTED_ACTION, runs: runs, healthy: true)
    def ds.action_intelligence(_name, range: 'last_30d') = nil
    with_fake_ds(ds) do
      get action_path('a-send')
      assert_response :success
      assert_match 'Recent failed runs', response.body
      assert_match 'Recent recovered runs', response.body
      assert_select 'a[href=?]', run_path('run_fail_1')
      assert_select 'a[href=?]', run_path('run_rec_1')
      # Investigation links scope the runs list to this action.
      assert_select 'a[href=?]', runs_path(q: 'send_email', status: 'failed')
      # Evaluations and proposals links are scoped to this action, not broad
      # index links.
      assert_select 'a[href=?]', evaluations_path(action_name: 'send_email')
      assert_select 'a[href=?]', proposals_path(action_name: 'send_email')
      assert_match 'Evaluations for this action', response.body
      assert_match 'Proposals for this action', response.body
    end
  end

  test 'snippets reference the IGRIS_API_KEY placeholder and never a real key' do
    get '/actions/send_email'
    assert_response :success
    assert_match 'IGRIS_API_KEY', response.body
    # No real/leaked credential shapes.
    refute_match(/igris_[A-Za-z0-9]{12,}/, response.body)
    refute_match(/Bearer\s+(sk-|eyJ)/, response.body)
  end

  # ── Test panel seeds a sample payload shaped to the target type ───────────
  test 'hosted_api action seeds the hosted sample payload' do
    get '/actions/send_email'
    assert_match 'Test this action', response.body
    assert_match 'Request body (JSON)', response.body
    assert_match 'Hello from Igris', response.body
  end

  test 'webhook action seeds the webhook sample payload' do
    with_fake_ds(FakeDS.new(action: WEBHOOK_ACTION, runs: [], healthy: true)) do
      get '/actions/create_invoice'
      assert_response :success
      assert_match 'test.action', response.body
    end
  end

  test 'local_runtime action seeds the local-runtime sample payload' do
    get '/actions/rebuild_search_index'
    assert_match 'read_file', response.body
    assert_match 'path_label', response.body
  end

  # ── Runtime requirement clarity ───────────────────────────────────────────
  test 'hosted_api action states no runtime needed' do
    get '/actions/send_email'
    assert_match 'No runtime needed', response.body
    refute_match 'Runtime required', response.body
  end

  test 'webhook action states no runtime needed' do
    with_fake_ds(FakeDS.new(action: WEBHOOK_ACTION, runs: [], healthy: true)) do
      get '/actions/create_invoice'
      assert_response :success
      assert_match 'No runtime needed', response.body
    end
  end

  test 'local_runtime without a healthy runtime shows Runtime required and a runtimes link' do
    with_fake_ds(FakeDS.new(action: LOCAL_ACTION, runs: [], healthy: false)) do
      get '/actions/read_private_file'
      assert_response :success
      assert_match 'Runtime required', response.body
      assert_select "a[href=?]", runtimes_path
      refute_match 'No runtime needed', response.body
    end
  end

  test 'local_runtime with a healthy runtime shows Runtime available' do
    with_fake_ds(FakeDS.new(action: LOCAL_ACTION, runs: [], healthy: true)) do
      get '/actions/read_private_file'
      assert_response :success
      assert_match 'Runtime available', response.body
      refute_match 'Runtime required', response.body
    end
  end

  # ── Latest runs section ───────────────────────────────────────────────────
  test 'action with runs shows current proof context' do
    get '/actions/send_email'
    assert_match 'proof: Pending', response.body
    assert_match 'Last run', response.body
  end

  test 'action with no runs shows the empty state' do
    get '/actions/rebuild_search_index'
    assert_response :success
    assert_match 'proof: Proof unavailable', response.body
    assert_match 'Test this action', response.body
  end

  # ── Created state ─────────────────────────────────────────────────────────
  test 'created flag shows a calm success banner pointing at the endpoint' do
    get '/actions/send_email?created=1'
    assert_response :success
    assert_match 'Created', response.body
    assert_match 'copy the endpoint', response.body
  end

  # ── Safety guarantees ─────────────────────────────────────────────────────
  test 'secrets section shows only a status, never a value' do
    get '/actions/send_email'
    assert_match 'Secrets are hidden', response.body
    refute_match(/sk_live|sk_test|api_secret|secret_value|password/i, response.body)
  end

  test 'action detail never exposes Overture or Next.js wording' do
    %w[send_email run_migration rebuild_search_index export_ledger].each do |name|
      get "/actions/#{name}"
      assert_response :success
      refute_match(/Overture/, response.body, "#{name} exposed 'Overture'")
      refute_match(/Next\.js/i, response.body, "#{name} exposed 'Next.js'")
    end
  end
end
