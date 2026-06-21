require 'test_helper'

# Policy Proposals UX — operator surface for the policy proposal lifecycle.
# Covers list/detail/create/edit/archive/simulate/approve/ready flows, the safe
# payload shape (never sends tenant_id), honest empty/degraded states, and the
# hard security guarantee: no prompts, raw bodies, secrets, or tokens are ever
# rendered, and hostile upstream values are ERB-escaped.
class PolicyProposalsTest < ActionDispatch::IntegrationTest
  # ── Real-mode Overture double ───────────────────────────────────────────
  class FakeClient
    attr_reader :created_payload, :updated_payload, :archived_id, :simulated_id, :approved_id

    def initialize(proposals: [], detail: nil, simulate_result: nil, approve_result: nil, approve_error: nil)
      @proposals = proposals
      @detail = detail
      @simulate_result = simulate_result
      @approve_result = approve_result
      @approve_error = approve_error
    end

    def configured? = true
    def list_actions = []
    def list_tasks(**) = []
    def list_runtimes = []
    def list_agents(**) = []

    def list_policy_proposals = @proposals
    def get_policy_proposal(_id) = @detail

    def create_policy_proposal(payload)
      @created_payload = payload
      proposal_stub('prop_new', payload[:name].to_s)
    end

    def update_policy_proposal(id, payload)
      @updated_payload = payload
      proposal_stub(id.to_s, payload[:name].to_s.presence || 'Updated')
    end

    def archive_policy_proposal(id)
      @archived_id = id
      { 'ok' => true }
    end

    def simulate_policy_proposal(id)
      @simulated_id = id
      @simulate_result || { 'proposal' => proposal_stub(id.to_s, 'Refund guard') }
    end

    def approve_policy_proposal(id)
      @approved_id = id
      raise @approve_error if @approve_error

      @approve_result || proposal_stub(id.to_s, 'Refund guard').merge('status' => 'approved')
    end

    def proposal_stub(id, name)
      {
        'proposal_id' => id, 'name' => name, 'description' => '',
        'status' => 'draft', 'policy_mode' => 'require_approval',
        'match_criteria_json' => { 'range' => '30d' },
        'latest_simulation_json' => nil,
        'created_at' => Time.current.iso8601, 'updated_at' => Time.current.iso8601,
      }
    end
  end

  def with_real_ds(client)
    ds = Igris::DataSource.new(client: client)
    ApplicationController.class_eval do
      alias_method :__orig_ds_prop, :data_source
      define_method(:data_source) { @data_source ||= ds }
    end
    assert ds.real?, 'expected real mode'
    yield ds
  ensure
    ApplicationController.class_eval { alias_method :data_source, :__orig_ds_prop }
  end

  def sample_proposal(overrides = {})
    {
      'proposal_id' => 'prop_abc',
      'name' => 'Pause large Stripe refunds',
      'description' => 'Require approval for stripe.refund.',
      'status' => 'review_ready',
      'policy_mode' => 'require_approval',
      'match_criteria_json' => { 'range' => '30d', 'match_action_prefix' => 'stripe.refund' },
      'latest_simulation_json' => {
        'range' => '30d', 'policy_mode' => 'require_approval',
        'total_runs_considered' => 142, 'would_allow' => 124,
        'would_require_approval' => 18, 'would_block' => 0, 'affected_run_count' => 18,
        'affected_agents' => [{ 'key' => 'a', 'name' => 'claude-production', 'run_count' => 18 }],
        'affected_actions' => [{ 'name' => 'stripe.refund_payment', 'run_count' => 18 }],
        'sample_runs' => [{ 'task_id' => 'run_abc', 'status' => 'completed' }],
        'warnings' => [], 'simulated_at' => Time.current.iso8601,
      },
      'created_at' => 6.days.ago.iso8601, 'updated_at' => 3.hours.ago.iso8601,
    }.merge(overrides)
  end

  def detail_for(proposal, events: [])
    { 'proposal' => proposal, 'events' => events }
  end

  # ── List ────────────────────────────────────────────────────────────────
  test 'fixture mode renders the proposals list under the Runs lens' do
    get proposals_path
    assert_response :success
    assert_select 'a.ic-viewtab', text: 'Proposals'
    assert_match 'Pause large Stripe refunds', response.body
  end

  test 'real mode lists proposals with status, mode, and impact' do
    with_real_ds(FakeClient.new(proposals: [sample_proposal])) do
      get proposals_path
      assert_response :success
      assert_match 'Pause large Stripe refunds', response.body
      assert_select '.ic-status.is-review_ready'
      assert_match 'affected', response.body
    end
  end

  test 'empty real mode renders an honest empty state' do
    with_real_ds(FakeClient.new(proposals: [])) do
      get proposals_path
      assert_response :success
      assert_match 'No proposals yet', response.body
    end
  end

  test 'a degraded list backend renders an empty state and never crashes' do
    failing = FakeClient.new
    def failing.list_policy_proposals = raise Igris::OvertureClient::ServerError.new('boom', status: 500, code: 'db_error')
    with_real_ds(failing) do
      get proposals_path
      assert_response :success
      assert_match 'No proposals yet', response.body
    end
  end

  # ── Detail ──────────────────────────────────────────────────────────────
  test 'detail renders the proposed rule in plain language and the impact summary' do
    with_real_ds(FakeClient.new(detail: detail_for(sample_proposal,
      events: [{ 'event_type' => 'created', 'safe_summary' => 'Draft proposal created', 'created_at' => 6.days.ago.iso8601 }]))) do
      get proposal_path('prop_abc')
      assert_response :success
      assert_match 'Proposed rule', response.body
      assert_match 'Action starts with', response.body
      assert_match 'stripe.refund', response.body
      assert_select '.ic-polsim__count-v.is-approval', text: '18'
      assert_match 'Draft proposal created', response.body
      # Approve is offered for a review_ready proposal with a simulation.
      assert_match 'Approve', response.body
    end
  end

  test 'detail 404s for an unknown proposal' do
    client = FakeClient.new(detail: nil)
    def client.get_policy_proposal(_id) = nil
    with_real_ds(client) do
      get proposal_path('nope')
      assert_response :not_found
    end
  end

  test 'a not-simulated draft shows the simulate prompt and no approve button' do
    draft = sample_proposal('status' => 'draft', 'latest_simulation_json' => nil)
    with_real_ds(FakeClient.new(detail: detail_for(draft))) do
      get proposal_path('prop_abc')
      assert_response :success
      assert_match 'has not been simulated yet', response.body
      assert_select 'input[value=?]', 'Approve', count: 0
    end
  end

  # ── New / create ─────────────────────────────────────────────────────────
  test 'new renders the form prefilled from a simulation save link' do
    with_real_ds(FakeClient.new) do
      get new_proposal_path(range: '7d', policy_mode: 'block', match_kind: 'match_action_prefix',
                            match_value: 'stripe.refund', require_proof_missing: 'true')
      assert_response :success
      assert_select 'input#match_value[value=?]', 'stripe.refund'
      # Custom dropdown (no native <select>) — the choice rides on a hidden input
      # with the active option flagged in the menu.
      assert_select 'input#policy_mode[type=hidden][value=?]', 'block'
      assert_select '.ic-dropdown__item.is-active[data-value=?]', 'block'
      assert_select 'select', count: 0
      # Custom checkbox, not the native control.
      assert_select '.ic-check input[type=checkbox][name=?]', 'require_proof_missing'
    end
  end

  test 'create sends a safe payload without tenant_id and redirects to the proposal' do
    client = FakeClient.new
    with_real_ds(client) do
      post proposals_path, params: {
        name: 'Pause refunds', description: 'review big refunds', policy_mode: 'block',
        range: '30d', match_kind: 'match_action_prefix', match_value: 'stripe.refund',
        require_proof_missing: '1',
      }
      assert_response :redirect
    end
    payload = client.created_payload
    refute payload.key?(:tenant_id)
    refute payload.key?('tenant_id')
    assert_equal 'Pause refunds', payload[:name]
    assert_equal 'block', payload[:policy_mode]
    assert_equal '30d', payload[:match_criteria_json][:range]
    assert_equal 'stripe.refund', payload[:match_criteria_json][:match_action_prefix]
    assert_equal true, payload[:match_criteria_json][:require_proof_missing]
  end

  test 'create rejects a blank name before calling the backend' do
    client = FakeClient.new
    with_real_ds(client) do
      post proposals_path, params: { name: '', policy_mode: 'block', range: '30d' }
      assert_response :unprocessable_entity
      assert_match 'Give the proposal a name', response.body
    end
    assert_nil client.created_payload
  end

  test 'create in fixture mode is inert' do
    post proposals_path, params: { name: 'demo', policy_mode: 'block', range: '30d' }
    assert_response :success
    assert_match 'Demo mode', response.body
  end

  # ── Edit / update ──────────────────────────────────────────────────────────
  test 'edit is blocked for a non-draft proposal' do
    with_real_ds(FakeClient.new(detail: detail_for(sample_proposal('status' => 'approved')))) do
      get edit_proposal_path('prop_abc')
      assert_response :redirect
    end
  end

  test 'update sends the edited payload' do
    draft = sample_proposal('status' => 'draft')
    client = FakeClient.new(detail: detail_for(draft))
    with_real_ds(client) do
      patch proposal_path('prop_abc'), params: {
        name: 'Renamed', policy_mode: 'require_approval', range: '7d',
        match_kind: 'match_action_name', match_value: 'stripe.refund_payment',
      }
      assert_response :redirect
    end
    assert_equal 'Renamed', client.updated_payload[:name]
    assert_equal 'stripe.refund_payment', client.updated_payload[:match_criteria_json][:match_action_name]
  end

  # ── Archive ────────────────────────────────────────────────────────────────
  test 'destroy archives the proposal' do
    client = FakeClient.new
    with_real_ds(client) do
      delete proposal_path('prop_abc')
      assert_response :redirect
    end
    assert_equal 'prop_abc', client.archived_id
  end

  # ── Simulate / approve / ready ─────────────────────────────────────────────
  test 'simulate posts to the backend and redirects with a notice' do
    client = FakeClient.new
    with_real_ds(client) do
      post simulate_proposal_path('prop_abc')
      assert_response :redirect
    end
    assert_equal 'prop_abc', client.simulated_id
  end

  test 'approve posts to the backend and redirects' do
    client = FakeClient.new(detail: detail_for(sample_proposal('status' => 'approved')),
                            approve_result: sample_proposal('status' => 'approved'))
    with_real_ds(client) do
      post approve_proposal_path('prop_abc')
      assert_response :redirect
      follow_redirect!
    end
    assert_equal 'prop_abc', client.approved_id
  end

  test 'approve surfaces a not-simulated conflict as a safe alert' do
    client = FakeClient.new(detail: detail_for(sample_proposal),
                            approve_error: Igris::OvertureClient::Conflict.new('x', status: 409, code: 'not_simulated'))
    with_real_ds(client) do
      post approve_proposal_path('prop_abc')
      assert_response :redirect
      follow_redirect!
      assert_match 'Simulate the proposal before approving', response.body
    end
  end

  test 'ready toggles review readiness via a status-only update' do
    client = FakeClient.new
    with_real_ds(client) do
      post ready_proposal_path('prop_abc'), params: { to: 'review_ready' }
      assert_response :redirect
    end
    assert_equal({ status: 'review_ready' }, client.updated_payload)
  end

  # ── Security: hostile upstream values are ERB-escaped ───────────────────────
  test 'malicious proposal name and simulation values are ERB-escaped' do
    hostile = sample_proposal(
      'name' => '<script>alert(1)</script>',
      'latest_simulation_json' => sample_proposal['latest_simulation_json'].merge(
        'affected_actions' => [{ 'name' => '<img src=x onerror=alert(2)>', 'run_count' => 3 }],
        'warnings' => ['<b>w</b><script>alert(3)</script>']
      )
    )
    with_real_ds(FakeClient.new(detail: detail_for(hostile))) do
      get proposal_path('prop_abc')
      assert_response :success
      refute_includes response.body, '<script>alert(1)</script>'
      refute_includes response.body, '<img src=x onerror=alert(2)>'
      refute_includes response.body, '<script>alert(3)</script>'
      assert_match '&lt;script&gt;alert(1)&lt;/script&gt;', response.body
    end
  end

  # ── DataSource contract ─────────────────────────────────────────────────────
  test 'create_policy_proposal raises in fixture mode (never silently persists)' do
    ds = Igris::DataSource.new(client: Class.new { def configured? = false }.new)
    assert ds.fixtures?
    assert_raises(Igris::OvertureClient::Unavailable) do
      ds.create_policy_proposal({ name: 'x' })
    end
  end
end
