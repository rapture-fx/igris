# frozen_string_literal: true

require 'test_helper'

# Covers the Run Activity Map on the Overview page (/overview?tab=map): it renders
# one dot per loaded run, each dot links to its run detail and carries an
# accessible summary, the no-runs state is honest (no fabricated dots), fixture
# data is clearly labelled, and no unsafe fields or off-brand wording leak into
# the page. Uses a stub DataSource so we never touch Overture.
class RunActivityMapTest < ActionDispatch::IntegrationTest
  # One ready action so Home renders the workspace tabs (and thus the map tab)
  # instead of the zero-actions onboarding state.
  STUB_ACTION = { id: 'charge_card', name: 'charge_card', target_type: 'hosted_api',
                  target_label: 'Hosted API', setup: 'Ready',
                  endpoint_readiness: 'ready' }.freeze

  class StubRuns
    attr_reader :mode

    def initialize(runs:, mode: :real)
      @runs = runs
      @mode = mode
    end

    def fixtures? = @mode == :fixtures
    def real?     = @mode == :real
    def error     = nil

    def all_runs(limit: 100) = @runs
    def recent_runs(limit: 8) = @runs.first(limit)
    def actions = [STUB_ACTION]
    def runtimes = []
    def healthy_runtime? = false
    def find_run(id) = @runs.find { |r| r[:id] == id }

    def run_through_runtime?(run)
      run[:runtime_id].to_s.strip != '' || run[:executed_target].to_s == 'local_runtime'
    end

    def project = { name: 'Test Project', mode: @mode, needs_name: false }
  end

  # Swap the per-request DataSource for our stub, mirroring runs_loop_test —
  # this project doesn't load Minitest's Object#stub.
  def stub_with(runs, mode: :real)
    ds = StubRuns.new(runs: runs, mode: mode)
    ApplicationController.class_eval do
      alias_method :__orig_ds_map, :data_source
      define_method(:data_source) { @data_source ||= ds }
    end
    yield
  ensure
    ApplicationController.class_eval { alias_method :data_source, :__orig_ds_map }
  end

  def run_row(id:, action:, status:, routed_via: 'Hosted API', proof: 'Proof verified',
              recovery: 'Not needed', runtime_id: '', executed_target: '', ms: 100, ago: 60, **extra)
    {
      id: id, action: action, status: status, routed_via: routed_via,
      executed_target: executed_target, runtime_id: runtime_id,
      policy: 'Safe automation', recovery: recovery, proof: proof,
      started_at: Time.now - ago, duration_ms: ms,
    }.merge(extra)
  end

  def sample_runs
    [
      run_row(id: 'run_v', action: 'charge_card',    status: 'Succeeded', proof: 'Proof verified'),
      run_row(id: 'run_c', action: 'send_email',     status: 'Succeeded', proof: 'Receipt present'),
      run_row(id: 'run_r', action: 'export_report',  status: 'Succeeded', proof: 'Receipt present',
              recovery: 'Retried 1x', routed_via: 'Runtime · rt_localdev',
              executed_target: 'local_runtime', runtime_id: 'rt_localdev'),
      run_row(id: 'run_w', action: 'charge_card',    status: 'Running',   proof: 'Proof unavailable'),
      run_row(id: 'run_b', action: 'sync_inventory', status: 'Failed',    proof: 'Proof unavailable',
              recovery: 'Awaiting review', routed_via: 'Local runtime',
              executed_target: 'local_runtime', runtime_id: ''),
      run_row(id: 'run_f', action: 'ship_order',     status: 'Failed',    proof: 'Proof failed'),
    ]
  end

  test 'renders the Run Activity Map with one dot per loaded run' do
    stub_with(sample_runs) do
      get overview_path(tab: 'map')
      assert_response :success
      assert_select 'section.ic-runmap'
      assert_select '.ic-runmap__title', text: 'Run Activity Map'
      assert_select '.ic-runmap__dot[href]', count: sample_runs.size
    end
  end

  test 'each dot links to its run detail page' do
    stub_with(sample_runs) do
      get overview_path(tab: 'map')
      assert_select "a.ic-runmap__dot[href=?]", run_path('run_v')
      assert_select "a.ic-runmap__dot[href=?]", run_path('run_f')
    end
  end

  test 'dots carry an accessible label with action, status and proof' do
    stub_with(sample_runs) do
      get overview_path(tab: 'map')
      # Verified run dot — action + band + proof are all present in the label.
      assert_select 'a.ic-runmap__dot[aria-label*=?]', 'charge_card'
      assert_select 'a.ic-runmap__dot[aria-label*=?]', 'Verified'
      assert_select 'a.ic-runmap__dot[aria-label*=?]', 'Proof verified'
      # The custom hover tooltip reads from data-tip (the native browser title
      # was replaced by a styled, dot-tracking tooltip).
      assert_select 'a.ic-runmap__dot[data-tip]'
      assert_select '.ic-runmap__tip'
    end
  end

  test 'outcome lanes are mapped honestly across statuses' do
    stub_with(sample_runs) do
      get overview_path(tab: 'map')
      assert_select '.ic-runmap__band', text: /Verified/
      assert_select '.ic-runmap__band', text: /Waiting/
      assert_select 'a.ic-runmap__dot.ic-runmap__dot--verified'
      assert_select 'a.ic-runmap__dot.ic-runmap__dot--completed'
      assert_select 'a.ic-runmap__dot.ic-runmap__dot--recovered'
      assert_select 'a.ic-runmap__dot.ic-runmap__dot--waiting'
      assert_select 'a.ic-runmap__dot.ic-runmap__dot--blocked'
      assert_select 'a.ic-runmap__dot.ic-runmap__dot--failed'
    end
  end

  test 'activity map renders concrete lane grid rows' do
    stub_with(sample_runs) do
      get overview_path(tab: 'map')
      assert_response :success
      assert_match(/grid-template-columns: minmax\(82px, max-content\) repeat\(\d+, minmax\(0, 1fr\)\)/, response.body)
      assert_match(/class="ic-runmap__band"[^>]+grid-row: \d+;/, response.body)
      assert_no_match(/grid-row: ;/, response.body)
    end
  end

  test 'no-runs state renders an honest empty map with no dots' do
    stub_with([]) do
      get overview_path(tab: 'map')
      assert_response :success
      assert_select 'section.ic-runmap'
      assert_select '.ic-runmap__empty-title', text: 'No run activity yet'
      assert_select '.ic-runmap__dot', count: 0
    end
  end

  test 'map header has a View all link to the runs page' do
    stub_with(sample_runs, mode: :fixtures) do
      get overview_path(tab: 'map')
      assert_response :success
      assert_select ".ic-runmap__head a.ic-runmap__viewall[href=?]", runs_path, text: 'View all'
    end
  end

  test 'map no longer renders the demo data badge' do
    stub_with(sample_runs, mode: :fixtures) do
      get overview_path(tab: 'map')
      assert_select '.ic-runmap__demo', count: 0
    end
  end

  test 'no unsafe fields leak into the rendered map' do
    runs = [
      run_row(id: 'run_x', action: 'charge_card', status: 'Failed', proof: 'Proof failed',
              failure_reason: 'SECRET_FAILURE_REASON',
              host: 'internal-host-10-0-0-1',
              db_url: 'postgres://leaked',
              signature: 'RAWSIGNATUREBYTES'),
    ]
    stub_with(runs) do
      get overview_path(tab: 'map')
      assert_response :success
      %w[SECRET_FAILURE_REASON internal-host-10-0-0-1 postgres://leaked RAWSIGNATUREBYTES].each do |leak|
        assert_not_includes response.body, leak
      end
    end
  end

  test 'map copy avoids off-brand and overclaiming wording' do
    stub_with(sample_runs) do
      get overview_path(tab: 'map')
      body = response.body.downcase
      File.write('/tmp/runs_body.html', response.body) unless body.exclude?('overture')
      assert_not_includes body, 'overture'
      assert_not_includes body, 'next.js'
      assert_not_includes body, 'compliance certified'
    end
  end
end
