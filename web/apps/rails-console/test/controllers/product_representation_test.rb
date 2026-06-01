require 'test_helper'

# Product-representation pass across Actions, Runs, Runtimes, and Settings.
#
# Locks the behaviour added in the representation slice:
#   - Action Detail surfaces test-run outcomes INLINE (result/error in the
#     test panel), not only in a top-of-page flash.
#   - Run Detail translates receipts into plain-language audit language
#     without claiming legal compliance or certification.
#   - Settings stays read-only (no dead Save/Discard) and never echoes the
#     configured base URL, host, admin username, or any key value.
#   - Cross-links connect the Action -> Run -> Runtime -> Settings loop.
class ProductRepresentationTest < ActionDispatch::IntegrationTest
  # Minimal real-mode DataSource so we can drive the run-error branches that
  # only exist when Overture is connected.
  class FakeDS
    attr_reader :mode, :error
    attr_accessor :run_error

    ACTION = {
      id: 'a-1', name: 'send_email', display_name: 'Send email',
      description: 'Outbound email', target_type: 'hosted_api',
      target_label: 'Hosted API', target_url: 'https://api.resend.com/emails',
      method: 'POST', policy: 'Safe automation', policy_preset: 'Safe automation',
      replay: 'On', secrets_state: 'Configured',
      endpoint: 'https://api.igrisinertial.com/v1/actions/send_email/run',
      setup: 'Ready', last_run_at: nil, last_run_status: nil, proof: 'No run yet',
      approval_required: false, irreversible: false, raw: {},
    }.freeze

    def initialize = (@mode = :real; @error = nil)
    def fixtures? = false
    def real?     = true
    def degraded? = !@error.nil?
    def actions   = [ACTION]
    def find_action(id) = (ACTION if ACTION[:id] == id || ACTION[:name] == id)
    def runs_for_action(_) = []
    def recent_runs(**) = []
    def all_runs(**) = []
    def runtimes = []
    def healthy_runtime? = false
    def runtime_required_for?(a) = a && a[:target_type].to_s == 'local_runtime' && !healthy_runtime?
    def find_run(_) = nil
    def run_action(_name, **_)
      raise @run_error if @run_error
      { 'task_id' => 'task_ok', 'status' => 'dispatched', 'proof_status' => 'pending' }
    end
  end

  def with_fake_ds(ds = FakeDS.new)
    ApplicationController.class_eval do
      alias_method :__orig_ds_pr, :data_source
      define_method(:data_source) { @data_source ||= ds }
    end
    yield ds
  ensure
    ApplicationController.class_eval { alias_method :data_source, :__orig_ds_pr }
  end

  # ── Action Detail: inline test-run results ───────────────────────────────
  test 'fixture-mode test run reports an inline demo result, not a fake run' do
    post '/actions/send_email/run', params: { input: '{}' }
    follow_redirect!
    assert_match 'ic-testresult', response.body
    assert_match 'Demo mode — no real run was created', response.body
  end

  test 'invalid JSON shows an inline error and echoes the submitted body back' do
    with_fake_ds do
      post '/actions/a-1/run', params: { input: '{ not valid' }
      follow_redirect!
      assert_match 'ic-testresult--bad', response.body
      assert_match 'Request body must be valid JSON', response.body
      assert_match '{ not valid', response.body # input preserved for correction
    end
  end

  test 'runtime-unavailable run shows an inline error with a connect-runtime CTA' do
    ds = FakeDS.new
    ds.run_error = Igris::OvertureClient::ServiceUnavailable.new('unavailable', status: 503, code: 'runtime_unavailable')
    with_fake_ds(ds) do
      post '/actions/a-1/run', params: { input: '{}' }
      follow_redirect!
      assert_match 'No runtime is connected', response.body
      assert_select "a[href=?]", runtimes_path
    end
  end

  test 'action detail explains the endpoint replaces direct tool access' do
    get '/actions/send_email'
    assert_response :success
    assert_match 'This is the endpoint your agent calls.', response.body
    assert_match 'does not get direct tool access', response.body
  end

  # ── Run Detail: audit interpretation, no compliance overclaim ────────────
  test 'run detail renders an audit interpretation panel in plain language' do
    get '/runs/run_01HGJ8K2Z9F' # succeeded, proof verified (fixture)
    assert_response :success
    assert_match 'Audit interpretation', response.body
    assert_match 'Control decision', response.body
    assert_match 'Execution record', response.body
    assert_match 'Evidence receipt', response.body
    assert_match 'Verification status', response.body
    assert_match 'Data exposure', response.body
    assert_match 'tamper-evident record', response.body
    assert_match 'Raw inputs/outputs are not shown here', response.body
  end

  test 'audit interpretation never claims legal compliance or certification' do
    %w[run_01HGJ8K2Z9F run_01HGJ5W0M3B run_01HGJ3R6T7E].each do |id|
      get "/runs/#{id}"
      assert_response :success
      body = response.body
      ['SOC 2', 'SOC2', 'HIPAA', 'GDPR', 'ISO 27001', 'certified', 'legally compliant',
       'regulatory approval'].each do |claim|
        refute_includes body, claim, "/runs/#{id} overclaimed compliance: #{claim}"
      end
    end
  end

  test 'run detail no longer shows the fake Verify chain / Re-run buttons' do
    get '/runs/run_01HGJ8K2Z9F'
    assert_response :success
    refute_match 'Verify chain', response.body
    refute_match(/>\s*Re-run\s*</, response.body)
  end

  # ── Settings: no dead buttons, host config not edited here ────────────────
  test 'settings has no dead Save or Discard buttons and never echoes host config' do
    get '/settings'
    assert_response :success
    refute_match(/>\s*Save\s*</, response.body)      # no bare dead "Save"
    refute_match(/>\s*Discard\s*</, response.body)
    # Host-configured values are surfaced as state, not editable fields.
    assert_match 'Host configuration is shown but not edited here', response.body
  end

  test 'settings never echoes the configured base URL, host, or admin username' do
    %w[OVERTURE_API_BASE_URL APP_HOST ADMIN_USERNAME].each { |k| ENV["__prev_#{k}"] = ENV[k] }
    ENV['OVERTURE_API_BASE_URL'] = 'https://overture.internal.corp:8443'
    ENV['APP_HOST'] = 'console.internal.corp'
    ENV['ADMIN_USERNAME'] = 'rootadmin_secret'
    %w[/settings?section=api /settings?section=access /settings?section=env].each do |path|
      get path
      assert_response :success
      refute_match 'overture.internal.corp', response.body
      refute_match 'console.internal.corp', response.body
      refute_match 'rootadmin_secret', response.body
    end
  ensure
    %w[OVERTURE_API_BASE_URL APP_HOST ADMIN_USERNAME].each { |k| ENV[k] = ENV.delete("__prev_#{k}") }
  end

  test 'settings advanced keeps only the implemented reset action' do
    get '/settings?section=advanced'
    assert_response :success
    assert_match 'Reset console onboarding', response.body
    refute_match 'Export audit log', response.body # was a dead button
    refute_match 'Pause all runtimes', response.body # was a dead button
    # The reset button must post to the reset route, not the (opposite) enter route.
    assert_select "form[action=?]", reset_onboarding_path
  end

  test 'reset onboarding forgets the welcomed cookie and returns to /welcome' do
    # Become onboarded first, then reset.
    post enter_console_path
    assert cookies[:igris_welcomed].present?
    post reset_onboarding_path
    assert_redirected_to welcome_path
    assert cookies[:igris_welcomed].blank?, 'reset should clear the welcomed cookie'
  end

  test 'settings agent-access section states agents get an endpoint, not tools' do
    get '/settings?section=access'
    assert_response :success
    assert_match 'Agent / app API keys', response.body
    assert_match 'never receives direct tool access', response.body
  end

  # ── Runtimes: connect + verify, verified against the real commands ───────
  test 'runtimes shows a Connect a runtime section with the verify step' do
    get '/runtimes'
    assert_response :success
    assert_match 'Connect a runtime', response.body
    assert_match 'Create a runtime key', response.body
    assert_match 'Verify the heartbeat', response.body
    # The actual, repo-confirmed commands — not invented flags.
    assert_match 'curl -fsSL https://igrisinertial.com/install | bash', response.body
    assert_match 'igris-runtime serve', response.body
  end

  # ── Cross-page linking: Settings reaches the rest of the loop ────────────
  test 'settings tool section links to create-action, actions, and runs' do
    get '/settings?section=tools'
    assert_response :success
    assert_select "a[href=?]", new_action_path
    assert_select "a[href=?]", actions_path
    assert_select "a[href=?]", runs_path
  end

  test 'settings runtime and access sections link to runtimes' do
    %w[/settings?section=runtime /settings?section=access].each do |path|
      get path
      assert_response :success
      assert_select "a[href=?]", runtimes_path
    end
  end

  # ── Redaction sweep across the operational surfaces ──────────────────────
  test 'runtimes, runs, and settings never render internal IPs' do
    ['/runtimes', '/runs', '/runs/run_01HGJ3R6T7E', '/settings?section=env'].each do |path|
      get path
      assert_response :success
      refute_match(/\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, response.body, "#{path} leaked an internal IP")
    end
  end
end
