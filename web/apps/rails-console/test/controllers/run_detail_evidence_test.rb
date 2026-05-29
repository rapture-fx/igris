require 'test_helper'

# Run Detail must show ONLY data-derived evidence in real mode. The
# illustrative execution tree / identity rows / footer flavor are allowed
# only in fixture mode, behind a visible "Demo data" indicator. These tests
# drive the full real path (DataSource → OvertureClient normalization) so the
# redaction guarantees in build_raw_evidence/build_story are exercised too.
class RunDetailEvidenceTest < ActionDispatch::IntegrationTest
  # Minimal Overture client stub returning one task. The task carries hostile
  # extra fields that must never reach the rendered page.
  class FakeClient
    def initialize(task) = (@task = task)
    def configured?            = true
    def list_actions           = []
    def list_tasks(**)         = [@task]
    def list_runtimes          = []
    def get_task(_id)          = @task
    def get_action(_)          = nil
    def find_action_by_name(_) = nil
  end

  def real_task(overrides = {})
    {
      'task_id' => 'task_real_1',
      'status' => 'completed',
      'executed_target' => 'hosted_api',
      'runtime_id' => 'rt_prod_01',
      'policy_preset' => 'Safe automation',
      'dispatched_at' => 2.minutes.ago.iso8601,
      'completed_at' => 1.minute.ago.iso8601,
      'proof' => { 'status' => 'verified', 'verified' => true, 'signature_digest' => 'abcd1234ef567890aaaa' },
      'receipt' => { 'hash' => 'sha256:deadbeefcafe', 'signed' => true },
      # ── Hostile fields: hostnames, IPs, tokens, env, callback bodies ──
      'target_url' => 'https://internal-db.corp.local:5432/path',
      'host' => '10.1.2.3',
      'api_key' => 'sk_live_supersecret',
      'env' => { 'DATABASE_URL' => 'postgres://user:pw@db.internal/main' },
      'callback_body' => '{"secret":"leakme"}',
    }.merge(overrides)
  end

  def with_real_ds(client)
    ds = Igris::DataSource.new(client: client)
    ApplicationController.class_eval do
      alias_method :__orig_ds_rd, :data_source
      define_method(:data_source) { @data_source ||= ds }
    end
    assert ds.real?, 'expected real mode'
    yield ds
  ensure
    ApplicationController.class_eval { alias_method :data_source, :__orig_ds_rd }
  end

  test 'real-mode run detail shows data-derived evidence and story' do
    with_real_ds(FakeClient.new(real_task)) do
      get '/runs/task_real_1'
      assert_response :success
      assert_match 'What happened', response.body
      assert_match 'Evidence', response.body
      assert_match 'Task ID', response.body
      assert_match 'task_real_1', response.body
      assert_match 'Executed target', response.body
      assert_match 'rt_prod_01', response.body        # runtime id is a safe identifier
      assert_match 'sha256:deadbeefcafe', response.body # receipt hash is safe
      assert_match 'Execution story', response.body
    end
  end

  test 'real-mode run detail omits demo-only identity rows and illustrative tree' do
    with_real_ds(FakeClient.new(real_task)) do
      get '/runs/task_real_1'
      body = response.body
      ['mateo@acme.io', 'fra1', 'worker_b', 'Committed actions',
       'action_workflow v1', 'Receipts ed25519', 'Verify chain', 'Demo data'].each do |needle|
        refute_includes body, needle, "real-mode run detail leaked illustrative content: #{needle}"
      end
    end
  end

  test 'real-mode run detail never leaks hostnames, IPs, tokens, env, or callback bodies' do
    with_real_ds(FakeClient.new(real_task)) do
      get '/runs/task_real_1'
      body = response.body
      ['internal-db.corp.local', '10.1.2.3', 'sk_live_supersecret',
       'postgres://', 'DATABASE_URL', 'leakme', 'callback_body'].each do |secret|
        refute_includes body, secret, "run detail leaked sensitive value: #{secret}"
      end
    end
  end

  test 'real-mode run detail shows the proof-unavailable note when proof is missing' do
    task = real_task.tap { |t| t.delete('proof'); t.delete('receipt') }
    with_real_ds(FakeClient.new(task)) do
      get '/runs/task_real_1'
      assert_response :success
      assert_match 'Proof is available when signed runtime evidence exists.', response.body
    end
  end

  test 'real-mode renders dashes for missing executed_target / runtime / receipt' do
    task = real_task.tap do |t|
      t['executed_target'] = ''
      t['runtime_id'] = ''
      t.delete('receipt')
    end
    with_real_ds(FakeClient.new(task)) do
      get '/runs/task_real_1'
      assert_response :success
      assert_match 'Evidence', response.body
      assert_match '—', response.body # missing fields shown honestly
    end
  end

  # ── Fixture mode keeps the illustrative demo, clearly labelled ──────────
  test 'fixture-mode run detail shows demo content behind a visible demo indicator' do
    get '/runs/run_01HGJ8K2Z9F' # ships in Igris::Fixtures
    assert_response :success
    assert_match 'Demo data', response.body
    assert_match 'Committed actions', response.body
  end
end
