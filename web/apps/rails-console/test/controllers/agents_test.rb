require 'test_helper'

# Agent Adoption Layer — the operator-first surface above the execution engine:
# Agent Catalog, Agent Detail, Action Pack Catalog, Adoption Health, and the
# Trust Journey. Covers fixture + real modes, the honest empty/derived states,
# IA (single Agents lens with in-page views), archive, degraded behaviour, and
# the hard security guarantee: no metadata, prompts, chain-of-thought, raw
# bodies, ciphertext, tokens, cookies, or keys are ever rendered.
class AgentsTest < ActionDispatch::IntegrationTest
  # ── Real-mode Overture double ───────────────────────────────────────────
  class FakeClient
    attr_reader :archived_id

    def initialize(agents: [], packs: [], actions: [], tasks: [], memory: [],
                   intelligence: nil, affinity: nil, evals: [])
      @agents = agents
      @packs = packs
      @actions = actions
      @tasks = tasks
      @memory = memory
      @intelligence = intelligence || { 'range' => 'last_30d', 'summary' => {}, 'agents' => [], 'actions' => [] }
      @affinity = affinity || { 'range' => 'last_30d', 'agent_actions' => [], 'action_agents' => [], 'pack_edges' => [], 'hotspots' => [] }
      @evals = evals
    end

    def configured? = true
    def list_actions = @actions
    def list_tasks(**) = @tasks
    def list_runtimes = []
    def list_execution_evals = @evals
    def list_agents(**) = @agents
    def get_agent(id) = @agents.find { |a| (a['agent_id'] || a[:agent_id]).to_s == id.to_s } || raise(Igris::OvertureClient::NotFound.new('not found', status: 404))
    def list_action_packs = @packs
    def get_execution_intelligence(**) = @intelligence
    def get_execution_affinity(**) = @affinity

    def list_agent_memory(task_id: nil, execution_id: nil, registered_agent_id: nil, **)
      rows = @memory
      rows = rows.select { |m| (m['registered_agent_id'] || m[:registered_agent_id]).to_s == registered_agent_id.to_s } if registered_agent_id
      rows
    end

    def archive_agent(id)
      @archived_id = id
      nil
    end
  end

  def with_real_ds(client)
    ds = Igris::DataSource.new(client: client)
    ApplicationController.class_eval do
      alias_method :__orig_ds_agents, :data_source
      define_method(:data_source) { @data_source ||= ds }
    end
    assert ds.real?, 'expected real mode'
    yield ds
  ensure
    ApplicationController.class_eval { alias_method :data_source, :__orig_ds_agents }
  end

  def sample_agent
    {
      'agent_id' => 'aaaaaaaa-1111-2222-3333-444444444444',
      'name' => 'support_agent',
      'display_name' => 'Support Agent',
      'agent_type' => 'support',
      'template_name' => 'customer-support',
      'version' => '0.9.2',
      'description' => 'Handles inbound support actions.',
      'created_at' => 12.days.ago.iso8601,
      'updated_at' => 5.hours.ago.iso8601,
    }
  end

  def intel_with_agent(agent_id)
    {
      'range' => 'last_30d', 'summary' => { 'total_runs' => 40 },
      'agents' => [
        { 'key' => agent_id, 'name' => 'Support Agent', 'total_runs' => 40,
          'successful_runs' => 36, 'success_rate' => 0.9, 'failure_rate' => 0.1,
          'recovery_rate' => 0.05, 'eval_run_count' => 10, 'eval_passed_runs' => 8,
          'eval_pass_rate' => 0.8, 'proof_coverage' => 0.75 },
      ],
      'actions' => [],
    }
  end

  def affinity_with_agent(agent_id)
    {
      'range' => 'last_30d',
      'source' => 'test',
      'agent_actions' => [
        {
          'action_name' => 'demo.echo', 'action_display_name' => 'Demo Echo', 'pack_name' => 'starter',
          'run_count' => 12, 'successful_runs' => 11, 'failed_runs' => 1,
          'approval_required_runs' => 0, 'recovery_runs' => 1,
          'eval_run_count' => 4, 'eval_passed_runs' => 4, 'proof_covered_runs' => 10,
          'success_rate' => 11 / 12.0, 'recovery_rate' => 1 / 12.0,
          'approval_rate' => 0.0, 'eval_pass_rate' => 1.0, 'proof_coverage' => 10 / 12.0,
        },
      ],
      'action_agents' => [
        {
          'agent_id' => agent_id, 'agent_name' => 'Support Agent', 'agent_type' => 'support',
          'action_name' => 'demo.echo', 'action_display_name' => 'Demo Echo', 'pack_name' => 'starter',
          'run_count' => 12, 'successful_runs' => 11, 'failed_runs' => 1,
          'approval_required_runs' => 0, 'recovery_runs' => 1,
          'eval_run_count' => 4, 'eval_passed_runs' => 4, 'proof_covered_runs' => 10,
          'success_rate' => 11 / 12.0, 'recovery_rate' => 1 / 12.0,
          'approval_rate' => 0.0, 'eval_pass_rate' => 1.0, 'proof_coverage' => 10 / 12.0,
        },
      ],
      'pack_edges' => [
        {
          'pack_name' => 'starter', 'action_name' => 'demo.echo', 'action_display_name' => 'Demo Echo',
          'agent_id' => agent_id, 'agent_name' => 'Support Agent',
          'run_count' => 12, 'success_rate' => 11 / 12.0,
          'recovery_rate' => 1 / 12.0, 'approval_rate' => 0.0,
          'eval_pass_rate' => 1.0, 'proof_coverage' => 10 / 12.0,
        },
      ],
      'hotspots' => [
        { 'scope' => 'action', 'name' => 'Demo Echo', 'observation' => 'Proof coverage is below 80 percent for recorded runs.', 'run_count' => 12 },
      ],
    }
  end

  def starter_pack_summary
    { 'name' => 'starter', 'display_name' => 'Starter Pack',
      'description' => 'Safe mock_demo actions for first-agent onboarding.', 'action_count' => 3 }
  end

  def pack_action(name)
    { 'name' => name, 'display_name' => name, 'target_type' => 'mock_demo',
      'policy_preset' => 'Read-only', 'target_metadata' => { 'pack' => 'starter' },
      'created_at' => 10.days.ago.iso8601 }
  end

  def memory_row(agent_id, task_id, outcome)
    {
      'memory_id' => "mem_#{task_id}", 'task_id' => task_id, 'execution_id' => 'exec',
      'registered_agent_id' => agent_id, 'registered_agent_name' => 'support_agent',
      'goal_summary' => 'Complete the support action.', 'decision_summary' => 'Proceeded after policy allowed.',
      'evidence_summary' => ['Policy allowed the call', 'Runtime co-signed the receipt'],
      'outcome_summary' => outcome, 'redaction_status' => 'redacted',
      'created_at' => 1.hour.ago.iso8601,
    }
  end

  # ── Navigation / IA ─────────────────────────────────────────────────────
  test 'the icon rail exposes a single Agents lens' do
    get '/home'
    assert_response :success
    assert_select 'a.ic-rail__btn[href=?]', agents_path
  end

  test 'agents index lives at /agents with in-page view tabs (no parallel nav)' do
    get agents_path
    assert_response :success
    assert_equal '/agents', agents_path
    assert_select '.ic-viewtab', text: 'Agents'
    assert_select '.ic-viewtab', text: 'Action packs'
    assert_select '.ic-viewtab', text: 'Getting started'
    assert_select '.ic-viewtab.is-active', text: 'Agents'
  end

  # ── Agent Catalog ───────────────────────────────────────────────────────
  test 'fixture-mode catalog lists registered agents with their metrics' do
    get agents_path
    assert_response :success
    assert_match 'Agent catalog', response.body
    assert_match 'Claude Code Agent', response.body
    assert_match 'Support Agent', response.body
  end

  test 'real-mode catalog joins registry agents with execution metrics' do
    client = FakeClient.new(agents: [sample_agent],
                            intelligence: intel_with_agent('aaaaaaaa-1111-2222-3333-444444444444'),
                            memory: [memory_row('aaaaaaaa-1111-2222-3333-444444444444', 't1', 'done')])
    with_real_ds(client) do
      get agents_path
      assert_response :success
      assert_match 'Support Agent', response.body
      assert_match '90%', response.body  # success rate
      assert_match '80%', response.body  # eval pass rate
    end
  end

  test 'real-mode empty catalog shows an honest empty state' do
    with_real_ds(FakeClient.new(agents: [])) do
      get agents_path
      assert_response :success
      assert_match 'No agents registered yet', response.body
    end
  end

  test 'catalog rows link to agent detail' do
    with_real_ds(FakeClient.new(agents: [sample_agent], intelligence: intel_with_agent('aaaaaaaa-1111-2222-3333-444444444444'))) do
      get agents_path
      assert_response :success
      assert_select 'a[href=?]', agent_path('aaaaaaaa-1111-2222-3333-444444444444')
    end
  end

  # ── Agent Detail ────────────────────────────────────────────────────────
  test 'agent detail explains the agent: identity, metrics, runs, memory' do
    agent_id = 'aaaaaaaa-1111-2222-3333-444444444444'
    client = FakeClient.new(
      agents: [sample_agent], intelligence: intel_with_agent(agent_id),
      affinity: affinity_with_agent(agent_id),
      memory: [memory_row(agent_id, 'run_99', 'Action completed and proof recorded.')]
    )
    with_real_ds(client) do
      get agent_path(agent_id)
      assert_response :success
      assert_match 'Support Agent', response.body
      assert_match 'customer-support', response.body  # template
      assert_match 'Execution metrics', response.body
      assert_match 'Actions used', response.body
      assert_match 'Demo Echo', response.body
      assert_select 'a[href=?]', action_path('demo.echo')
      assert_match 'Proof coverage', response.body
      assert_match 'Evidence Memory', response.body
      # Recent runs derived from evidence link to run detail.
      assert_select 'a[href=?]', run_path('run_99')
    end
  end

  test 'unknown agent id is a clean 404' do
    with_real_ds(FakeClient.new(agents: [])) do
      get agent_path('nope-does-not-exist')
      assert_response :not_found
    end
  end

  test 'fixture-mode agent detail renders for a demo agent' do
    get agent_path('a1f2c3d4-e5f6-7890-abcd-ef1234567890')
    assert_response :success
    assert_match 'Claude Code Agent', response.body
  end

  # ── Archive ─────────────────────────────────────────────────────────────
  test 'archive calls the backend and returns to the catalog' do
    client = FakeClient.new(agents: [sample_agent])
    with_real_ds(client) do
      post archive_agent_path('aaaaaaaa-1111-2222-3333-444444444444')
      assert_redirected_to agents_path
      assert_equal 'aaaaaaaa-1111-2222-3333-444444444444', client.archived_id
    end
  end

  test 'detail page shows an archive control in real mode only' do
    with_real_ds(FakeClient.new(agents: [sample_agent], intelligence: intel_with_agent('aaaaaaaa-1111-2222-3333-444444444444'))) do
      get agent_path('aaaaaaaa-1111-2222-3333-444444444444')
      assert_select 'form[action=?]', archive_agent_path('aaaaaaaa-1111-2222-3333-444444444444')
    end
  end

  test 'fixture-mode archive is inert' do
    post archive_agent_path('a1f2c3d4-e5f6-7890-abcd-ef1234567890')
    assert_redirected_to agents_path
    follow_redirect!
    assert_match 'Demo mode', response.body
  end

  # ── Action Pack Catalog ─────────────────────────────────────────────────
  test 'fixture-mode pack catalog shows the Starter Pack and its actions' do
    get agents_path(view: 'packs')
    assert_response :success
    assert_match 'Action packs', response.body
    assert_match 'Starter Pack', response.body
    assert_match 'demo.echo', response.body
    assert_match 'Installed', response.body
    assert_select 'a[href=?]', agent_pack_path('starter')
  end

  test 'real-mode pack catalog reports installed state from tenant actions' do
    client = FakeClient.new(packs: [starter_pack_summary],
                            actions: [pack_action('demo.echo'), pack_action('demo.fail_once')])
    with_real_ds(client) do
      get agents_path(view: 'packs')
      assert_response :success
      assert_match 'Starter Pack', response.body
      assert_match 'Installed', response.body
      assert_match 'demo.echo', response.body
    end
  end

  test 'pack detail shows pack action agent relationships' do
    agent_id = 'aaaaaaaa-1111-2222-3333-444444444444'
    client = FakeClient.new(
      packs: [starter_pack_summary],
      actions: [pack_action('demo.echo')],
      affinity: affinity_with_agent(agent_id)
    )
    with_real_ds(client) do
      get agent_pack_path('starter')
      assert_response :success
      assert_match 'Pack relationships', response.body
      assert_match 'Demo Echo', response.body
      assert_match 'Support Agent', response.body
      assert_select 'a[href=?]', action_path('demo.echo')
      assert_select 'a[href=?]', agent_path(agent_id)
    end
  end

  test 'a pack with no installed actions reads as not installed' do
    with_real_ds(FakeClient.new(packs: [starter_pack_summary], actions: [])) do
      get agents_path(view: 'packs')
      assert_response :success
      assert_match 'Not installed', response.body
    end
  end

  # ── Adoption Health + Trust Journey ─────────────────────────────────────
  test 'getting started shows an honest checklist and the trust journey' do
    get agents_path(view: 'adoption')
    assert_response :success
    assert_match 'Getting started', response.body
    assert_match 'Trust journey', response.body
    assert_select '.ic-journey'
    assert_select '.ic-adopt-step'
  end

  test 'adoption health reflects real backend state, not fabricated completion' do
    agent_id = 'aaaaaaaa-1111-2222-3333-444444444444'
    # Agent + installed pack + a run with proof + an eval => fully onboarded.
    client = FakeClient.new(
      agents: [sample_agent],
      packs: [starter_pack_summary], actions: [pack_action('demo.echo')],
      tasks: [{ 'task_id' => 't1', 'status' => 'completed', 'proof' => { 'verified' => true } }],
      evals: [{ 'eval_id' => 'e1', 'name' => 'demo', 'assertions_json' => [] }]
    )
    with_real_ds(client) do
      get agents_path(view: 'adoption')
      assert_response :success
      assert_match '5 / 5', response.body
      assert_match 'Onboarding complete', response.body
    end
  end

  test 'adoption health surfaces missing steps for a brand-new tenant' do
    with_real_ds(FakeClient.new) do
      get agents_path(view: 'adoption')
      assert_response :success
      assert_match '0 / 5', response.body
      assert_match 'Missing', response.body
    end
  end

  # ── Degraded backend ────────────────────────────────────────────────────
  test 'catalog stays available with a calm banner when the registry errors' do
    failing = FakeClient.new
    def failing.list_agents(**) = raise(Igris::OvertureClient::ServerError.new('boom', status: 500, code: 'db_error'))
    with_real_ds(failing) do
      get agents_path
      assert_response :success
      assert_match 'No agents registered yet', response.body
      assert_match 'degraded', response.body
    end
  end

  test 'a degraded backend never leaks the raw upstream error message' do
    failing = FakeClient.new
    def failing.list_agents(**)
      raise Igris::OvertureClient::ServerError.new(
        'internal-db.corp.local OVERTURE_API_KEY=sk_live_LEAK postgres://admin:pw@db/main',
        status: 502, code: 'upstream_db'
      )
    end
    with_real_ds(failing) do
      get agents_path
      assert_response :success
      refute_includes response.body, 'internal-db.corp.local'
      refute_includes response.body, 'sk_live_LEAK'
      refute_includes response.body, 'postgres://admin:pw'
    end
  end

  # ── Security: escaping & no unsafe payloads ─────────────────────────────
  test 'hostile agent fields are ERB-escaped, never rendered as HTML' do
    hostile = sample_agent.merge(
      'display_name' => 'Agent <script>alert(1)</script>',
      'description' => 'Desc <img src=x onerror=alert(2)>'
    )
    with_real_ds(FakeClient.new(agents: [hostile], intelligence: intel_with_agent('aaaaaaaa-1111-2222-3333-444444444444'))) do
      get agent_path('aaaaaaaa-1111-2222-3333-444444444444')
      assert_response :success
      refute_includes response.body, '<script>alert(1)</script>'
      refute_includes response.body, '<img src=x onerror=alert(2)>'
      assert_match '&lt;script&gt;alert(1)&lt;/script&gt;', response.body
    end
  end

  test 'no prompt, chain-of-thought, secret, or token markers appear on the surfaces' do
    agent_id = 'aaaaaaaa-1111-2222-3333-444444444444'
    client = FakeClient.new(agents: [sample_agent], intelligence: intel_with_agent(agent_id),
                            memory: [memory_row(agent_id, 't1', 'done')],
                            packs: [starter_pack_summary], actions: [pack_action('demo.echo')])
    with_real_ds(client) do
      [agents_path, agents_path(view: 'packs'), agents_path(view: 'adoption'), agent_path(agent_id)].each do |path|
        get path
        assert_response :success
        body = response.body.downcase
        ['chain-of-thought', 'chain_of_thought', 'hidden reasoning', 'ciphertext',
         'bearer ', 'set-cookie', 'private key', 'request_body', 'response_body'].each do |marker|
          refute_includes body, marker, "#{path} rendered unsafe marker: #{marker}"
        end
      end
    end
  end
end
