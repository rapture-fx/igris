require 'test_helper'

# Covers the First Action Experience: Home first-use loop, the create-action
# wizard's local validation, fixture-mode safety, the action-detail test
# panel, and the run-result summary. Real-mode paths inject a fake DataSource.
class FirstActionExperienceTest < ActionDispatch::IntegrationTest
  # ── Fake DataSource (real mode) ──────────────────────────────────────────
  class FakeDS
    attr_reader :mode, :error, :created_payload
    attr_accessor :actions_data, :run_response, :run_error, :run_detail

    def initialize(actions: nil)
      @mode = :real
      @error = nil
      @actions_data = actions || [default_action]
      @run_detail = nil
    end

    def default_action
      {
        id: 'a-1', name: 'send_email', display_name: 'Send email',
        description: 'Outbound email', target_type: 'hosted_api',
        target_label: 'Hosted API', target_url: 'https://api.resend.com/emails',
        method: 'POST', policy: 'Safe automation', policy_preset: 'Safe automation',
        replay: 'On', secrets_state: 'Configured',
        endpoint: 'https://api.igrisinertial.com/v1/actions/send_email/run',
        setup: 'Ready', last_run_at: nil, last_run_status: nil, proof: 'No run yet',
        approval_required: false, irreversible: false, raw: {},
      }
    end

    def fixtures?  = false
    def real?      = true
    def degraded?  = !@error.nil?
    def actions    = @actions_data
    def find_action(id) = @actions_data.find { |a| a[:id] == id || a[:name] == id }
    def runs_for_action(_) = []
    def recent_runs(**) = []
    def all_runs(**) = []
    def runtimes = []
    def daily_run_counts = []
    def healthy_runtime? = false
    def runtime_required_for?(action) = action && action[:target_type].to_s == 'local_runtime' && !healthy_runtime?

    def find_run(_)
      @run_detail
    end

    def create_action(p)
      @created_payload = p
      @actions_data.first.merge(name: p[:name])
    end

    def run_action(_name, **_)
      raise @run_error if @run_error
      @run_response || { 'task_id' => 'task_xyz', 'status' => 'dispatched', 'proof_status' => 'pending' }
    end
  end

  def with_fake_ds(ds)
    ApplicationController.class_eval do
      alias_method :__orig_ds, :data_source
      define_method(:data_source) { @data_source ||= ds }
    end
    yield ds
  ensure
    ApplicationController.class_eval { alias_method :data_source, :__orig_ds }
  end

  # ── Home (fixture mode) ──────────────────────────────────────────────────
  test 'home shows hero copy and the 4-step first-use checklist' do
    get '/home'
    assert_response :success
    assert_match 'Give your AI agent a safe action endpoint.', response.body
    assert_match 'Route your first AI action through Igris', response.body
    %w[Create\ action Copy\ endpoint Send\ test\ request Inspect\ run].each do |label|
      assert_match label, response.body
    end
  end

  test 'home with existing actions offers Open Actions and Create another' do
    # Fixture mode ships sample actions, so this is the populated branch.
    get '/home'
    assert_match 'Open Actions', response.body
    assert_match 'Create another action', response.body
  end

  test 'home with no actions emphasizes creating the first one' do
    with_fake_ds(FakeDS.new(actions: [])) do
      get '/home'
      assert_response :success
      assert_match 'Create your first action', response.body
    end
  end

  # ── Wizard validation ────────────────────────────────────────────────────
  test 'wizard bounces to identity when name is missing' do
    get '/actions/new?step=endpoint'
    assert_response :success
    assert_match 'Action name is required.', response.body
    assert_match 'Identity', response.body
  end

  test 'wizard rejects an invalid name with spaces or capitals' do
    get '/actions/new?step=target&name=Send%20Email'
    assert_response :success
    assert_match 'lowercase letters, numbers, and underscores', response.body
  end

  test 'wizard requires a target URL for hosted_api' do
    get '/actions/new?step=policy&name=send_email&target_type=hosted_api'
    assert_response :success
    assert_match 'A target URL is required', response.body
  end

  test 'wizard allows local_runtime without a target URL' do
    get '/actions/new?step=policy&name=read_private_file&target_type=local_runtime'
    assert_response :success
    assert_match 'Policy', response.body
    refute_match 'A target URL is required', response.body
  end

  test 'wizard marks hybrid_fallback as coming soon and disabled' do
    get '/actions/new?step=target&name=send_email'
    assert_response :success
    assert_match 'Coming soon', response.body
    assert_match 'disabled', response.body
  end

  test 'wizard shows name examples on the identity step' do
    get '/actions/new'
    assert_response :success
    %w[send_email create_ticket update_customer_record read_private_file].each do |ex|
      assert_match ex, response.body
    end
  end

  # ── Wizard create (real mode) maps policy preset to Go-accepted strings ──
  test 'create maps human_gated to the exact Go policy_preset and fields' do
    ds = FakeDS.new
    with_fake_ds(ds) do
      post '/actions', params: {
        name: 'create_ticket', target_type: 'webhook',
        target_url: 'https://example.com/hook', policy: 'human_gated',
      }
      assert_response :redirect
      payload = ds.created_payload
      assert_equal 'Human-gated', payload[:policy_preset]
      assert_equal 'non_retryable', payload[:replay_class]
      assert_equal true, payload[:approval_required]
    end
  end

  test 'create rejects hybrid_fallback before reaching Go' do
    ds = FakeDS.new
    with_fake_ds(ds) do
      post '/actions', params: { name: 'send_email', target_type: 'hybrid_fallback' }
      assert_response :unprocessable_entity
      assert_nil ds.created_payload
      assert_match 'coming soon', response.body
    end
  end

  test 'create rejects an invalid name before reaching Go' do
    ds = FakeDS.new
    with_fake_ds(ds) do
      post '/actions', params: { name: 'Bad Name', target_type: 'mock_demo' }
      assert_response :unprocessable_entity
      assert_nil ds.created_payload
    end
  end

  test 'create redirects to the action with created flag' do
    with_fake_ds(FakeDS.new) do
      post '/actions', params: { name: 'send_email', target_type: 'mock_demo', policy: 'safe_automation' }
      assert_response :redirect
      assert_match %r{/actions/send_email\?created=1}, response.headers['Location']
    end
  end

  # ── Fixture-mode safety ──────────────────────────────────────────────────
  test 'fixture-mode create is inert and creates no real action' do
    post '/actions', params: { name: 'brand_new_action', target_type: 'mock_demo', policy: 'safe_automation' }
    assert_response :success # re-renders the wizard, no redirect to a fake action
    assert_match 'Demo mode', response.body
    assert_match 'inert', response.body
  end

  test 'fixture-mode run is inert' do
    post '/actions/send_email/run', params: { input: '{}' }
    assert_response :redirect
    follow_redirect!
    assert_match 'Demo mode', response.body
  end

  # ── Action detail ────────────────────────────────────────────────────────
  test 'action detail shows endpoint card and editable test request panel' do
    get '/actions/send_email'
    assert_response :success
    assert_match 'Test this action', response.body
    assert_match 'Request body (JSON)', response.body
    assert_match 'Hello from Igris', response.body # sample payload seeded
    assert_match '/v1/actions/send_email/run', response.body
  end

  test 'action detail next-step card prompts a test request when no runs' do
    get '/actions/rebuild_search_index'
    assert_response :success
    assert_match 'Next step', response.body
    assert_match 'Send a test request', response.body
  end

  # ── Run result summary ───────────────────────────────────────────────────
  test 'run detail shows a What happened summary' do
    get '/runs/run_01HGJ8K2Z9F'
    assert_response :success
    assert_match 'What happened', response.body
    assert_match 'Routed via', response.body
    assert_match 'Proof', response.body
  end

  test 'run success in real mode redirects to the run detail' do
    with_fake_ds(FakeDS.new) do
      post '/actions/a-1/run', params: { input: '{"to":"user@example.com"}' }
      assert_response :redirect
      assert_match %r{/runs/task_xyz}, response.headers['Location']
    end
  end

  # ── Copy guardrail ───────────────────────────────────────────────────────
  test 'product-flow pages never expose Overture wording' do
    pages = ['/home', '/actions', '/actions/new', '/actions/send_email',
             '/runs', '/runs/run_01HGJ8K2Z9F']
    pages.each do |path|
      get path
      assert_response :success
      refute_match(/Overture/, response.body, "#{path} exposed 'Overture'")
    end
  end
end
