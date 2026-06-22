require 'test_helper'

# Trust Recommendations (operator UX) — a read-only, deterministic attention list
# under Runs > Intelligence. Guarantees: nothing is mutated; only safe fields are
# rendered (never prompts, raw bodies, or secrets), always ERB-escaped; links
# only point at existing console surfaces; honest empty + degraded states.
class TrustRecommendationsTest < ActionDispatch::IntegrationTest
  class FakeClient
    attr_reader :last_state_update

    def initialize(trust: nil, trust_error: nil)
      @trust = trust
      @trust_error = trust_error
    end

    def configured?            = true
    def list_actions           = []
    def list_tasks(**)         = []
    def list_runtimes          = []
    def get_task(_id)          = nil
    def get_task_steps(_id)    = []
    def get_action(_)          = nil
    def find_action_by_name(_) = nil
    def list_agent_memory(**)  = []
    def list_execution_eval_runs(_) = []

    def get_execution_intelligence(**)
      {
        'range' => 'last_30d', 'source' => 'task_records',
        'summary' => { 'total_runs' => 5, 'successful_runs' => 5, 'failed_runs' => 0,
                       'success_rate' => 1.0, 'failure_rate' => 0.0, 'recovery_rate' => 0.0,
                       'approval_rate' => 0.0, 'recovery_runs' => 0, 'approval_required_runs' => 0,
                       'human_intervention_runs' => 0, 'average_duration_ms' => 100.0 },
        'agents' => [], 'actions' => [],
      }
    end

    def get_trust_recommendations(**)
      raise @trust_error if @trust_error

      @trust
    end

    def update_trust_recommendation_state(id, status:, reason: nil, snooze_duration: nil)
      @last_state_update = { id: id, status: status, reason: reason, snooze_duration: snooze_duration }
      { 'state_id' => 's1', 'recommendation_id' => id, 'status' => status }
    end
  end

  def with_real_ds(client)
    ds = Igris::DataSource.new(client: client)
    ApplicationController.class_eval do
      alias_method :__orig_ds_trust, :data_source
      define_method(:data_source) { @data_source ||= ds }
    end
    assert ds.real?, 'expected real mode'
    yield ds
  ensure
    ApplicationController.class_eval { alias_method :data_source, :__orig_ds_trust }
  end

  def trust_payload(overrides = {})
    {
      'range' => '30d', 'generated_at' => '2026-06-22T00:00:00Z',
      'recommendations' => [
        {
          'id' => 'action:low_proof:stripe.refund', 'severity' => 'critical', 'category' => 'proof',
          'title' => 'Action proof coverage is low',
          'summary' => 'Some runs completed without recorded proof.',
          'reason' => '82% proof coverage across 44 runs in the last 30 days.',
          'recommended_action' => 'Inspect proof and receipt state.',
          'entity_type' => 'action', 'entity_id' => 'stripe.refund', 'entity_name' => 'stripe.refund',
          'metrics' => { 'proof_coverage' => 0.82, 'total_runs' => 44 },
          'links' => [{ 'rel' => 'action', 'label' => 'Open action' }],
        },
      ],
    }.merge(overrides)
  end

  # ── Render ──────────────────────────────────────────────────────────────────
  test 'fixture mode renders the Trust Recommendations section' do
    get runs_path(view: 'intelligence')
    assert_response :success
    assert_select '.ic-trust'
    assert_match 'Trust recommendations', response.body
    # An active demo finding is visible in the default (active) view.
    assert_match 'Action proof coverage is low', response.body
  end

  test 'real mode renders findings, recommended action, and a link to the entity' do
    with_real_ds(FakeClient.new(trust: trust_payload)) do
      get runs_path(view: 'intelligence')
      assert_response :success
      assert_match 'Action proof coverage is low', response.body
      assert_match 'Inspect proof and receipt state.', response.body
      assert_select 'a[href=?]', action_path('stripe.refund')
      assert_select '.ic-trust__sev.is-critical'
    end
  end

  test 'empty recommendations render the honest empty state' do
    with_real_ds(FakeClient.new(trust: trust_payload('recommendations' => []))) do
      get runs_path(view: 'intelligence')
      assert_response :success
      assert_match 'No attention items found for this window.', response.body
    end
  end

  test 'a degraded backend renders a calm notice and never crashes' do
    failing = FakeClient.new(trust_error: Igris::OvertureClient::ServerError.new('boom', status: 500, code: 'db_error'))
    with_real_ds(failing) do
      get runs_path(view: 'intelligence')
      assert_response :success
      assert_match 'Recommendations are unavailable right now', response.body
    end
  end

  # ── Security ──────────────────────────────────────────────────────────────
  test 'hostile recommendation values are ERB-escaped, never executed' do
    hostile = trust_payload('recommendations' => [
      trust_payload['recommendations'].first.merge(
        'title' => '<script>alert(1)</script>',
        'reason' => '<img src=x onerror=alert(2)>'
      ),
    ])
    with_real_ds(FakeClient.new(trust: hostile)) do
      get runs_path(view: 'intelligence')
      assert_response :success
      refute_includes response.body, '<script>alert(1)</script>'
      refute_includes response.body, '<img src=x onerror=alert(2)>'
      assert_match '&lt;script&gt;alert(1)&lt;/script&gt;', response.body
    end
  end

  # ── DataSource contract ───────────────────────────────────────────────────
  test 'normalizer bounds severity and keeps metrics scalar-only' do
    ds = Igris::DataSource.new(client: FakeClient.new(trust: trust_payload('recommendations' => [
      { 'id' => 'x', 'severity' => 'apocalyptic', 'category' => 'action', 'title' => 't',
        'reason' => 'r', 'recommended_action' => 'a', 'entity_type' => 'action',
        'entity_id' => 'a.b', 'entity_name' => 'a.b',
        'metrics' => { 'ok' => 0.5, 'nested' => { 'bad' => 1 }, 'arr' => [1, 2] },
        'links' => [{ 'rel' => '', 'label' => 'skip me' }, { 'rel' => 'action', 'label' => 'Open' }] },
    ])))
    result = ds.trust_recommendations(range: 'last_7d')
    rec = result[:recommendations].first
    assert_equal 'info', rec[:severity]                 # unknown severity falls back
    assert_equal({ 'ok' => 0.5 }, rec[:metrics])        # non-scalar metrics dropped
    assert_equal 1, rec[:links].length                  # empty-rel link dropped
    assert_equal 'action', rec[:links].first[:rel]
  end

  test 'trust_recommendations degrades to unavailable on backend error' do
    failing = FakeClient.new(trust_error: Igris::OvertureClient::ServerError.new('x', status: 500))
    ds = Igris::DataSource.new(client: failing)
    result = ds.trust_recommendations(range: 'last_30d')
    assert_equal :unavailable, result[:state]
    assert_empty result[:recommendations]
  end

  # ── Lifecycle overlay UI + actions ──────────────────────────────────────────
  test 'state chip, lifecycle filter, and actions render' do
    acked = trust_payload('recommendations' => [
      trust_payload['recommendations'].first.merge('state' => 'acknowledged', 'state_reason' => 'tracked by oncall'),
    ])
    with_real_ds(FakeClient.new(trust: acked)) do
      get runs_path(view: 'intelligence', trust_state: 'all')
      assert_response :success
      assert_select '.ic-trust__filter'
      assert_match 'Acknowledged', response.body
      assert_match 'tracked by oncall', response.body
      assert_match 'Resolve', response.body
    end
  end

  test 'acknowledge posts the lifecycle change and redirects to the intelligence tab' do
    client = FakeClient.new(trust: trust_payload)
    with_real_ds(client) do
      post trust_recommendation_state_path, params: {
        rec_id: 'action:low_proof:stripe.refund', status: 'acknowledged', range: 'last_7d', trust_state: 'active'
      }
      assert_redirected_to runs_path(view: 'intelligence', range: 'last_7d', trust_state: 'active')
    end
    assert_equal 'acknowledged', client.last_state_update[:status]
    assert_equal 'action:low_proof:stripe.refund', client.last_state_update[:id]
  end

  test 'snooze posts the chosen duration' do
    client = FakeClient.new(trust: trust_payload)
    with_real_ds(client) do
      post trust_recommendation_state_path, params: { rec_id: 'r1', status: 'snoozed', snooze_duration: '7d' }
      assert_response :redirect
    end
    assert_equal 'snoozed', client.last_state_update[:status]
    assert_equal '7d', client.last_state_update[:snooze_duration]
  end

  test 'resolve and reactivate post the right statuses' do
    client = FakeClient.new(trust: trust_payload)
    with_real_ds(client) do
      post trust_recommendation_state_path, params: { rec_id: 'r1', status: 'resolved' }
      assert_response :redirect
      assert_equal 'resolved', client.last_state_update[:status]

      post trust_recommendation_state_path, params: { rec_id: 'r1', status: 'active' }
      assert_response :redirect
      assert_equal 'active', client.last_state_update[:status]
    end
  end

  test 'an unknown lifecycle status is rejected before any backend call' do
    client = FakeClient.new(trust: trust_payload)
    with_real_ds(client) do
      post trust_recommendation_state_path, params: { rec_id: 'r1', status: 'deferred' }
      assert_response :redirect
    end
    assert_nil client.last_state_update
  end

  test 'fixture mode lifecycle changes are inert' do
    post trust_recommendation_state_path, params: { rec_id: 'r1', status: 'resolved' }
    assert_response :redirect
    follow_redirect!
    assert_match 'Demo mode', response.body
  end

  test 'hostile state_reason is ERB-escaped' do
    hostile = trust_payload('recommendations' => [
      trust_payload['recommendations'].first.merge('state' => 'acknowledged', 'state_reason' => '<script>alert(9)</script>'),
    ])
    with_real_ds(FakeClient.new(trust: hostile)) do
      get runs_path(view: 'intelligence')
      assert_response :success
      refute_includes response.body, '<script>alert(9)</script>'
      assert_match '&lt;script&gt;alert(9)&lt;/script&gt;', response.body
    end
  end
end
