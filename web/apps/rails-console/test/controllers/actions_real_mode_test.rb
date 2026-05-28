require 'test_helper'

# Exercises the controller paths in "real mode" by stubbing the DataSource
# the controllers reach through. Keeps the test isolated from network.
class ActionsRealModeTest < ActionDispatch::IntegrationTest
  class FakeDS
    attr_reader :mode, :error
    attr_accessor :actions_data, :run_response, :run_error

    def initialize
      @mode = :real
      @error = nil
      @actions_data = [{
        id: 'a-1', name: 'send_email', display_name: 'Send email',
        description: 'Outbound email', target_type: 'hosted_api',
        target_label: 'Hosted API', target_url: 'https://api.resend.com/emails',
        method: 'POST', policy: 'Idempotent · safe retries', policy_preset: 'idempotent',
        replay: 'On', secrets_state: 'Configured',
        endpoint: 'https://api.igrisinertial.com/v1/actions/send_email/run',
        setup: 'Ready', last_run_at: nil, last_run_status: nil, proof: 'No run yet',
        approval_required: false, irreversible: false, raw: {},
      }]
    end

    def fixtures?  = false
    def real?      = true
    def degraded?  = !@error.nil?
    def actions    = @actions_data
    def find_action(id_or_name) = @actions_data.find { |a| a[:id] == id_or_name || a[:name] == id_or_name }
    def runs_for_action(_) = []
    def recent_runs(**) = []
    def all_runs(**) = []
    def find_run(_) = nil
    def runtimes = []
    def create_action(p) = @actions_data.first.merge(name: p[:name])
    def run_action(_name, **_)
      raise @run_error if @run_error
      @run_response || { 'task_id' => 'task_xyz', 'status' => 'dispatched', 'proof_status' => 'pending' }
    end
  end

  def with_fake_ds(ds = FakeDS.new)
    ApplicationController.class_eval do
      alias_method :__original_ds, :data_source
      define_method(:data_source) { @data_source ||= ds }
    end
    yield ds
  ensure
    ApplicationController.class_eval { alias_method :data_source, :__original_ds }
  end

  test 'actions index calls real data source' do
    with_fake_ds do
      get '/actions'
      assert_response :success
      assert_match 'send_email', response.body
      refute_match 'Demo data — OVERTURE_API_BASE_URL not set', response.body
    end
  end

  test 'run action submits to Overture and redirects to run detail' do
    with_fake_ds do |ds|
      ds.run_response = { 'task_id' => 'task_xyz', 'status' => 'dispatched', 'proof_status' => 'pending' }
      post '/actions/a-1/run', params: { input: '{"to":"user@example.com"}' }
      assert_response :redirect
      assert_match %r{/runs/task_xyz}, response.headers['Location']
    end
  end

  test 'run action surfaces runtime_unavailable as friendly alert' do
    with_fake_ds do |ds|
      ds.run_error = Igris::OvertureClient::ServiceUnavailable.new('no runtime', status: 503, code: 'runtime_unavailable')
      post '/actions/a-1/run', params: { input: '{}' }
      assert_response :redirect
      follow_redirect!
      assert_match 'No runtime available', response.body
    end
  end

  test 'run action surfaces policy denial' do
    with_fake_ds do |ds|
      ds.run_error = Igris::OvertureClient::PolicyDenied.new('denied', status: 403, code: 'capability_policy_denied')
      post '/actions/a-1/run', params: { input: '{}' }
      follow_redirect!
      assert_match 'Policy denied', response.body
    end
  end

  test 'run action validates JSON input' do
    with_fake_ds do
      post '/actions/a-1/run', params: { input: 'not-json' }
      follow_redirect!
      assert_match 'Input must be valid JSON', response.body
    end
  end

  test 'run detail page shows unavailable when DataSource returns nil' do
    with_fake_ds do
      get '/runs/missing-run'
      assert_response :not_found
    end
  end

  test 'create action POSTs through to Overture' do
    with_fake_ds do
      post '/actions', params: {
        name: 'invoice_create', display_name: 'Invoice create',
        target_type: 'webhook', target_url: 'https://example.com/hook',
        method: 'POST', policy: 'single_flight', replay_class: 'retryable',
      }
      assert_response :redirect
      assert_match %r{/actions/invoice_create}, response.headers['Location']
    end
  end
end
