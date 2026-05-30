require 'test_helper'

# Locks the Settings access/configuration center: the Agent / app API keys
# section lists and mints keys (prefix-only, read-once), Console front door is
# its own section, secrets never leak, and the section links resolve the next
# step instead of bouncing the user in a circle.
class SettingsAccessTest < ActionDispatch::IntegrationTest
  # Real-mode DataSource double exposing the agent-key surface. create/revoke
  # record their calls and raise in fixture mode so we can prove no real write
  # happens there.
  class FakeDS
    attr_reader :mode, :error, :create_calls, :revoke_calls
    attr_accessor :keys, :created_key

    def initialize(mode: :real, keys: [])
      @mode = mode
      @error = nil
      @keys = keys
      @created_key = { 'api_key' => 'igris_rawagentkeyshownonce0000', 'prefix' => 'igris_rawage', 'name' => 'Agent key', 'id' => 'k-new' }
      @create_calls = []
      @revoke_calls = []
    end

    def fixtures? = @mode == :fixtures
    def real?     = @mode == :real
    def degraded? = false

    def project = { name: 'Support Agent', mode: @mode == :fixtures ? :fixtures : :real, needs_name: false }
    def agent_api_keys = @keys

    def create_agent_api_key(name)
      raise 'real write in fixture mode' if fixtures?
      @create_calls << name
      @created_key
    end

    def revoke_agent_api_key(id)
      raise 'real write in fixture mode' if fixtures?
      @revoke_calls << id
      { 'ok' => true }
    end
  end

  def with_fake_ds(ds)
    ApplicationController.class_eval do
      alias_method :__orig_ds_sa, :data_source
      define_method(:data_source) { @data_source ||= ds }
    end
    yield ds
  ensure
    ApplicationController.class_eval { alias_method :data_source, :__orig_ds_sa }
  end

  AGENT_KEY = { id: 'k-1', name: 'Support Agent key', prefix: 'igris_a1b2c3',
                created_at: Time.now - 3600, last_used_at: nil }.freeze

  # ── Section structure ────────────────────────────────────────────────────
  test 'settings has all eight access-center sections in the nav' do
    get '/settings'
    assert_response :success
    ['Project', 'API endpoints', 'Agent / app API keys', 'Runtime keys',
     'Tool &amp; target access', 'Console front door', 'Environment', 'Advanced'].each do |label|
      assert_match label, response.body, "nav missing #{label}"
    end
  end

  test 'console front door is its own section and never shows the password value' do
    prev = ENV['ADMIN_PASSWORD']
    ENV['ADMIN_PASSWORD'] = 'supersecret_admin_pw_xyz'
    get '/settings?section=frontdoor'
    assert_response :success
    assert_match 'Console front door', response.body
    refute_match 'supersecret_admin_pw_xyz', response.body
  ensure
    ENV['ADMIN_PASSWORD'] = prev
  end

  # ── Agent / app API keys: real mode ──────────────────────────────────────
  test 'access section lists agent keys by prefix and offers a create form' do
    with_fake_ds(FakeDS.new(keys: [AGENT_KEY])) do
      get '/settings?section=access'
      assert_response :success
      assert_match 'Agent / app API keys', response.body
      assert_match 'never receives direct tool access', response.body
      assert_match 'Support Agent key', response.body      # key label
      assert_match 'igris_a1b2c3', response.body            # prefix only
      assert_select "form[action=?]", settings_api_keys_path # create form
      assert_select "form[action=?]", settings_api_key_path(AGENT_KEY[:id]) # revoke form
    end
  end

  test 'access section explains the three kinds of key and links to runtimes' do
    with_fake_ds(FakeDS.new) do
      get '/settings?section=access'
      assert_response :success
      assert_match 'Three kinds of key', response.body
      assert_select "a[href=?]", runtimes_path
      assert_select "a[href=?]", actions_path
    end
  end

  test 'creating an agent key shows the raw key once through the data source' do
    with_fake_ds(FakeDS.new) do |ds|
      post settings_api_keys_path, params: { name: 'CI key' }
      assert_response :success
      assert_equal ['CI key'], ds.create_calls
      assert_match 'igris_rawagentkeyshownonce0000', response.body # raw key shown once
      assert_match(/[Ss]hown once/, response.body)
    end
  end

  test 'revoking an agent key calls through and redirects with a notice' do
    with_fake_ds(FakeDS.new(keys: [AGENT_KEY])) do |ds|
      delete settings_api_key_path('k-1')
      assert_redirected_to settings_path(section: 'access')
      assert_equal ['k-1'], ds.revoke_calls
      assert_equal 'API key revoked.', flash[:notice]
    end
  end

  # ── Fixture/demo mode never writes ───────────────────────────────────────
  test 'fixture mode shows an inert create form and makes no real key' do
    get '/settings?section=access' # real fixture DataSource (demo)
    assert_response :success
    assert_match(/Demo mode/i, response.body)
    refute_match 'Create API key', response.body # no live create button in demo
  end

  test 'fixture-mode create is inert and makes no real write' do
    with_fake_ds(FakeDS.new(mode: :fixtures)) do |ds|
      post settings_api_keys_path, params: { name: 'CI key' }
      assert_redirected_to settings_path(section: 'access')
      assert_empty ds.create_calls
      assert_match(/Demo mode/i, flash[:notice])
    end
  end

  # ── Redaction ────────────────────────────────────────────────────────────
  test 'settings never renders the console service key value' do
    prev = ENV['OVERTURE_API_KEY']
    ENV['OVERTURE_API_KEY'] = 'igris_service_secret_never_render_abc'
    %w[/settings?section=access /settings?section=api /settings?section=env].each do |path|
      get path
      assert_response :success
      refute_match 'igris_service_secret_never_render_abc', response.body, path
    end
  ensure
    ENV['OVERTURE_API_KEY'] = prev
  end

  test 'a generated key is never persisted to the session' do
    with_fake_ds(FakeDS.new) do
      post settings_api_keys_path, params: { name: 'CI key' }
      assert_response :success
      assert_nil session[:generated_agent_key]
      # On a fresh GET the raw key must be gone (read-once).
    end
    with_fake_ds(FakeDS.new(keys: [AGENT_KEY])) do
      get '/settings?section=access'
      refute_match 'igris_rawagentkeyshownonce0000', response.body
    end
  end

  # ── Copy guardrail ───────────────────────────────────────────────────────
  test 'access and front door sections avoid legacy and license wording' do
    with_fake_ds(FakeDS.new(keys: [AGENT_KEY])) do
      %w[access frontdoor].each do |s|
        get "/settings?section=#{s}"
        assert_response :success
        refute_match(/Overture/, response.body, "#{s} leaked Overture")
        refute_match(/Next\.js/, response.body, "#{s} leaked Next.js")
        refute_match(/\btenant\b/i, response.body, "#{s} leaked tenant")
        refute_match(/\blicense\b/i, response.body, "#{s} leaked license")
      end
    end
  end
end
