require 'test_helper'

# Durable action approval gate — console UI. Drives the real DataSource →
# OvertureClient normalization path with a fake client so the approval panel,
# the approve/reject controls, and the controller forwarding to the durable
# action routes are all exercised end to end.
class RunApprovalTest < ActionDispatch::IntegrationTest
  # Fake Overture client. Records approve/reject calls so tests can assert the
  # console forwarded to the durable-action routes with the right arguments.
  class FakeClient
    attr_reader :approved, :rejected

    def initialize(task, approve_error: nil)
      @task = task
      @approve_error = approve_error
      @approved = []
      @rejected = []
    end

    def configured?                 = true
    def list_actions                = []
    def list_tasks(**)              = [@task]
    def list_runtimes               = [{ 'runtime_id' => 'rt_1', 'healthy' => true, 'endpoint' => 'https://rt.test' }]
    def get_task(_id)               = @task
    def get_task_steps(_id)         = []
    def list_agent_memory(**)       = []
    def list_execution_eval_runs(_) = []
    def get_action(_)               = nil
    def find_action_by_name(_)      = nil

    def approve_action_run(id)
      raise @approve_error if @approve_error
      @approved << id
      { 'status' => 'dispatched', 'decision' => 'approved', 'run_id' => id }
    end

    def reject_action_run(id, reason: nil)
      @rejected << [id, reason]
      { 'status' => 'failed', 'decision' => 'rejected', 'dispatched' => false, 'run_id' => id }
    end
  end

  def approval_task(overrides = {})
    {
      'task_id' => 'task_appr_1',
      'status' => 'approval_required',
      'created_at' => 30.minutes.ago.iso8601,
      'failure_reason' => 'Human-gated policy — this action requires human approval before it can run.',
      'input_summary' => { 'action' => 'refund_charge' },
    }.merge(overrides)
  end

  def completed_task(overrides = {})
    {
      'task_id' => 'task_done_1',
      'status' => 'completed',
      'created_at' => 30.minutes.ago.iso8601,
      'dispatched_at' => 29.minutes.ago.iso8601,
      'completed_at' => 28.minutes.ago.iso8601,
    }.merge(overrides)
  end

  def with_real_ds(client)
    ds = Igris::DataSource.new(client: client)
    ApplicationController.class_eval do
      alias_method :__orig_ds_appr, :data_source
      define_method(:data_source) { @data_source ||= ds }
    end
    assert ds.real?, 'expected real mode'
    yield ds
  ensure
    ApplicationController.class_eval { alias_method :data_source, :__orig_ds_appr }
  end

  test 'approval-required run shows the approval panel with safe metadata and both actions' do
    with_real_ds(FakeClient.new(approval_task)) do
      get '/runs/task_appr_1'
      assert_response :success
      body = response.body
      assert_match 'Approval required', body
      assert_match 'Human approval gate', body
      assert_match 'Approve and dispatch', body
      assert_match 'Reject run', body
      assert_match 'Why approval is required', body
      assert_match 'requires human approval', body
      # Forms point at the durable action routes, not execution_lineage.
      assert_match %r{/runs/task_appr_1/approve}, body
      assert_match %r{/runs/task_appr_1/reject}, body
      refute_match %r{/v1/execution/runs}, body
    end
  end

  test 'non-approval run does not show approve or reject controls' do
    with_real_ds(FakeClient.new(completed_task)) do
      get '/runs/task_done_1'
      assert_response :success
      body = response.body
      refute_match 'Approve and dispatch', body
      refute_match 'Reject run', body
      refute_match 'Human approval gate', body
    end
  end

  test 'approve forwards to the durable action approve route and redirects with a notice' do
    client = FakeClient.new(approval_task)
    with_real_ds(client) do
      post '/runs/task_appr_1/approve'
      assert_redirected_to run_path('task_appr_1')
      assert_equal ['task_appr_1'], client.approved
      assert_empty client.rejected
      follow_redirect!
      assert_match 'Run approved', response.body
    end
  end

  test 'reject forwards to the durable action reject route with the reason and redirects' do
    client = FakeClient.new(approval_task)
    with_real_ds(client) do
      post '/runs/task_appr_1/reject', params: { reason: 'not allowed by finance policy' }
      assert_redirected_to run_path('task_appr_1')
      assert_equal [['task_appr_1', 'not allowed by finance policy']], client.rejected
      assert_empty client.approved
      follow_redirect!
      assert_match 'Run rejected', response.body
    end
  end

  test 'approve maps a backend 409 to a safe not-awaiting-approval alert' do
    client = FakeClient.new(approval_task, approve_error: Igris::OvertureClient::Conflict.new('conflict', status: 409, code: 'not_awaiting_approval'))
    with_real_ds(client) do
      post '/runs/task_appr_1/approve'
      assert_redirected_to run_path('task_appr_1')
      follow_redirect!
      assert_match 'not awaiting approval', response.body
    end
  end
end
