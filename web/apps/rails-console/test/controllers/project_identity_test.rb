require 'test_helper'

# Locks the single-project naming flow and project identity across the console:
#   - /home prompts "Create your project" only when a real tenant has no name
#   - the project name shows on Home, Actions, Runs, Runtimes, and Settings
#   - Settings can rename the project through the DataSource (real mode)
#   - fixture/demo mode never writes to a real backend
#   - invalid and HTML/script names are rejected/escaped, shown inline
#   - the project surfaces never leak Overture / Next.js / tenant wording
class ProjectIdentityTest < ActionDispatch::IntegrationTest
  # Real-mode DataSource double exposing the project methods plus the minimal
  # surface each page reads. update_project records its calls so we can assert
  # whether a real write happened; it raises in fixture mode to prove the
  # controller never writes there.
  class FakeDS
    attr_reader :mode, :error, :update_calls

    def initialize(mode: :real, project_name: 'Support Agent', needs_name: false)
      @mode = mode
      @error = nil
      @project_name = project_name
      @needs_name = needs_name
      @update_calls = []
    end

    def fixtures? = @mode == :fixtures
    def real?     = @mode == :real
    def degraded? = false

    def project
      return { name: 'Support Agent', mode: :fixtures, needs_name: false } if fixtures?
      { name: @project_name, mode: :real, needs_name: @needs_name }
    end

    def update_project(name)
      raise 'real backend write attempted in fixture mode' if fixtures?
      @update_calls << name
      { 'name' => name }
    end

    # ── Page data (minimal, honest empties) ──────────────────────────────
    def actions = []
    def recent_runs(**) = []
    def all_runs(**) = []
    def runtimes = []
    def healthy_runtime? = false
    def runtime_summary = { total: 0, healthy: 0, stale: 0, offline: 0 }
    def local_runtime_actions = []
    def runtime_runs(**) = []
    def runtime_api_key_status = nil
    def agent_api_keys = []
    def find_action(_) = nil
    def find_run(_) = nil
    def runs_for_action(_) = []
    def runtime_required_for?(_) = false
  end

  def with_fake_ds(ds)
    ApplicationController.class_eval do
      alias_method :__orig_ds_proj, :data_source
      define_method(:data_source) { @data_source ||= ds }
    end
    yield ds
  ensure
    ApplicationController.class_eval { alias_method :data_source, :__orig_ds_proj }
  end

  # ── First-run naming on /home ────────────────────────────────────────────
  test 'home prompts to create a project when real mode has no name' do
    with_fake_ds(FakeDS.new(project_name: nil, needs_name: true)) do
      get '/home'
      assert_response :success
      assert_match 'Create your project', response.body
      assert_match 'This project will contain your actions, runs, runtime keys, and evidence.', response.body
      assert_select "form[action=?][method=?]", project_path, 'post' # _method=patch
      assert_match 'Continue to create first action', response.body
    end
  end

  test 'home does not prompt for a project when one is already named' do
    with_fake_ds(FakeDS.new(project_name: 'Acme AI Actions', needs_name: false)) do
      get '/home'
      assert_response :success
      refute_match 'Create your project', response.body
      assert_match 'Acme AI Actions', response.body # chip still shows the name
    end
  end

  test 'home without a live API shows the sample project name and never prompts' do
    get '/home' # real fixture DataSource (no OVERTURE_API_BASE_URL in test)
    assert_response :success
    refute_match 'Create your project', response.body
    assert_match 'Support Agent', response.body
    assert_match 'Demo data', response.body # fixture mode shows the demo chip on Home
  end

  # ── Project name appears across the console ──────────────────────────────
  test 'project name appears on home, overview, actions, runs, runtimes, and settings' do
    %w[/home /overview /actions /runs /runtimes /settings].each do |path|
      with_fake_ds(FakeDS.new(project_name: 'Support Agent')) do
        get path
        assert_response :success
        assert_match 'Support Agent', response.body, "#{path} should show the project name"
      end
    end
  end

  test 'without a live API the sample project name shows on the workspace surfaces' do
    %w[/home /overview /actions /runs /runtimes /settings].each do |path|
      get path
      assert_response :success
      assert_match 'Support Agent', response.body, "#{path} should show the sample project name"
    end
  end

  test 'the project name is never the literal "Demo Project" anywhere' do
    %w[/home /overview /actions /runs /runtimes /settings].each do |path|
      get path
      assert_response :success
      refute_match 'Demo Project', response.body, "#{path} still shows the Demo Project name"
    end
  end

  # ── Settings can rename the project (real mode) ──────────────────────────
  test 'settings has an editable Project section in real mode' do
    with_fake_ds(FakeDS.new(project_name: 'Support Agent')) do
      get '/settings?section=project'
      assert_response :success
      assert_match 'Project name', response.body
      assert_select "form[action=?]", project_path
      assert_match(/>\s*Save project name\s*</, response.body)
    end
  end

  test 'patching the project name in real mode writes through the data source' do
    with_fake_ds(FakeDS.new(project_name: 'Support Agent')) do |ds|
      patch project_path, params: { name: 'Finance Ops Agent', source: 'settings' }
      assert_redirected_to settings_path(section: 'project')
      assert_equal ['Finance Ops Agent'], ds.update_calls
      assert_equal 'Project name updated.', flash[:notice]
    end
  end

  test 'naming the project from home completes onboarding and continues to the wizard' do
    with_fake_ds(FakeDS.new(project_name: nil, needs_name: true)) do |ds|
      patch project_path, params: { name: 'Support Agent', source: 'home' }
      assert_redirected_to new_action_path
      assert_equal ['Support Agent'], ds.update_calls
      assert_equal '1', cookies[:igris_welcomed]
    end
  end

  # ── Fixture/demo mode never writes ───────────────────────────────────────
  test 'fixture-mode project update is inert and makes no real write' do
    with_fake_ds(FakeDS.new(mode: :fixtures)) do |ds|
      patch project_path, params: { name: 'Support Agent', source: 'settings' }
      assert_redirected_to settings_path(section: 'project')
      assert_empty ds.update_calls, 'no real write may happen in fixture mode'
      assert_match(/Demo mode/i, flash[:notice])
    end
  end

  # ── Inline validation ────────────────────────────────────────────────────
  test 'an invalid project name shows an inline error and does not write' do
    with_fake_ds(FakeDS.new(project_name: 'Support Agent')) do |ds|
      patch project_path, params: { name: 'a', source: 'settings' }
      assert_redirected_to settings_path(section: 'project')
      assert_empty ds.update_calls
      follow_redirect!
      assert_match 'between 2 and 80 characters', response.body
      assert_select 'p.ic-fielderror'
    end
  end

  test 'a script or HTML project name is rejected and never echoed unescaped' do
    with_fake_ds(FakeDS.new(project_name: 'Support Agent')) do |ds|
      patch project_path, params: { name: '<script>alert(1)</script>', source: 'settings' }
      assert_redirected_to settings_path(section: 'project')
      assert_empty ds.update_calls, 'a script name must never be written'
      follow_redirect!
      refute_match '<script>alert(1)', response.body, 'the raw script tag must never render'
      assert_match 'basic punctuation only', response.body
    end
  end

  # ── Copy guardrail ───────────────────────────────────────────────────────
  test 'project surfaces never leak Overture, Next.js, or tenant wording' do
    # /home with the naming card, plus the Settings project section.
    with_fake_ds(FakeDS.new(project_name: nil, needs_name: true)) do
      get '/home'
      assert_no_legacy_wording('/home')
    end
    with_fake_ds(FakeDS.new(project_name: 'Support Agent')) do
      get '/settings?section=project'
      assert_no_legacy_wording('/settings?section=project')
    end
  end

  private

  def assert_no_legacy_wording(path)
    assert_response :success
    refute_match(/Overture/, response.body, "#{path} leaked Overture wording")
    refute_match(/Next\.js/, response.body, "#{path} leaked Next.js wording")
    refute_match(/\btenant\b/i, response.body, "#{path} leaked tenant wording")
  end
end
