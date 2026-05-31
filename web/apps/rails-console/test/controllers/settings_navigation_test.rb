require 'test_helper'

# Locks Settings navigation: every section is reachable by its canonical
# ?section= slug and renders its own content (server-rendered, no client tabs),
# the short legacy slugs still resolve via aliases, an unknown slug falls back
# to Project, and the nav links carry the canonical query params. Also proves
# demo mode is informative — every write-capable section explains itself and
# how to enable real mode — and never leaks a secret.
class SettingsNavigationTest < ActionDispatch::IntegrationTest
  # Canonical slug → a heading string that only appears when that section
  # actually renders (not just the nav label, which is present on every page).
  CANONICAL = {
    'project'            => 'Project is the name for everything you own here',
    'api_endpoints'      => 'Where this console talks to the Igris API',
    'agent_keys'         => 'An agent or app calls an Igris action endpoint',
    'runtime_keys'       => 'A runtime key is used on a machine where',
    'target_access'      => 'The agent never gets direct tool access',
    'console_front_door' => 'Console access is configured on the host',
    'environment'        => 'The runtime variables that decide what mode',
    'advanced'           => 'Rarely-used operations',
  }.freeze

  # ── Every canonical section renders its own content ──────────────────────
  CANONICAL.each do |slug, marker|
    test "section #{slug} renders its own content server-side" do
      get "/settings?section=#{slug}"
      assert_response :success
      assert_match marker, response.body, "#{slug} did not render its own content"
      # The active nav item is highlighted for the requested section.
      assert_select 'a.ic-settings__nav-item.is-active'
    end
  end

  # ── Default + invalid fall back to Project ───────────────────────────────
  test 'no section param renders Project' do
    get '/settings'
    assert_response :success
    assert_match CANONICAL['project'], response.body
  end

  test 'an unknown section falls back to Project, never a blank page' do
    get '/settings?section=does_not_exist'
    assert_response :success
    assert_match CANONICAL['project'], response.body
  end

  # ── Legacy short slugs still resolve (no dead bookmarks) ──────────────────
  {
    'api'       => 'api_endpoints',
    'access'    => 'agent_keys',
    'runtime'   => 'runtime_keys',
    'tools'     => 'target_access',
    'frontdoor' => 'console_front_door',
    'env'       => 'environment',
  }.each do |legacy, canonical|
    test "legacy slug #{legacy} aliases to #{canonical}" do
      get "/settings?section=#{legacy}"
      assert_response :success
      assert_match CANONICAL[canonical], response.body
    end
  end

  # ── Nav links carry the canonical query params (server-rendered anchors) ──
  test 'in-page nav links use the canonical section slugs' do
    get '/settings'
    assert_response :success
    CANONICAL.each_key do |slug|
      assert_select "nav.ic-settings__nav a[href=?]", "/settings?section=#{slug}"
    end
  end

  test 'lens sidebar links use the canonical section slugs' do
    get '/settings'
    assert_response :success
    CANONICAL.each_key do |slug|
      assert_select "a[href=?]", "/settings?section=#{slug}"
    end
  end

  # ── Demo mode is informative, not a dead end ─────────────────────────────
  # The integration env has no OVERTURE_API_BASE_URL, so the real DataSource is
  # in fixture/demo mode here.
  test 'write-capable sections show the read-only demo notice with enable steps' do
    %w[project agent_keys runtime_keys].each do |slug|
      get "/settings?section=#{slug}"
      assert_response :success
      assert_select '.ic-settings__pane .ic-demobar', { count: 1 }, "#{slug} missing the demo notice"
      assert_match 'Demo mode is read-only', response.body, slug
      assert_match 'OVERTURE_API_BASE_URL', response.body, slug
      assert_match 'OVERTURE_API_KEY', response.body, slug
    end
  end

  test 'demo mode shows a page-level banner explaining what Settings is for' do
    get '/settings'
    assert_response :success
    assert_select '.ic-demobar--page'
    assert_match 'looking at the demo console', response.body
  end

  # ── There is always something to do: theme works regardless of mode ──────
  test 'advanced section has a working local theme control even in demo mode' do
    get '/settings?section=advanced'
    assert_response :success
    assert_match 'Console appearance', response.body
    assert_select '#ic-appearance button[data-theme=?]', 'light'
    assert_select '#ic-appearance button[data-theme=?]', 'dark'
    # Reset onboarding remains a real, working action here too.
    assert_select "form[action=?]", reset_onboarding_path
  end

  # ── Settings lives in exactly one place: the icon rail ───────────────────
  test 'settings appears once in the icon rail and not in the account dropdown' do
    get '/home' # any in-console page renders the rail + dropdown
    assert_response :success
    assert_select 'a.ic-rail__btn[href=?]', settings_path        # rail gear
    assert_select 'a.ic-rail__menu__item[href=?]', settings_path, count: 0
  end

  test 'demo mode disables agent key creation but still explains the key' do
    get '/settings?section=agent_keys'
    assert_response :success
    refute_match 'Create API key', response.body          # no live create button
    assert_match 'Authorization: Bearer', response.body   # still explains usage
  end

  # ── Cross-section CTAs solve the next problem ────────────────────────────
  test 'api endpoints section links to the agent keys section' do
    get '/settings?section=api_endpoints'
    assert_response :success
    assert_select "a[href=?]", '/settings?section=agent_keys'
  end

  test 'runtime keys section links to Runtimes for key creation' do
    get '/settings?section=runtime_keys'
    assert_response :success
    assert_select "a[href=?]", runtimes_path
  end

  # ── Redaction across every section ───────────────────────────────────────
  test 'no section leaks env values, secrets, hosts, or db urls' do
    prev = {
      'OVERTURE_API_KEY'     => ENV['OVERTURE_API_KEY'],
      'ADMIN_PASSWORD'       => ENV['ADMIN_PASSWORD'],
      'OVERTURE_API_BASE_URL'=> ENV['OVERTURE_API_BASE_URL'],
      'DATABASE_URL'         => ENV['DATABASE_URL'],
    }
    ENV['OVERTURE_API_KEY']      = 'igris_service_secret_value_abc123'
    ENV['ADMIN_PASSWORD']        = 'admin_pw_value_xyz789'
    ENV['DATABASE_URL']          = 'postgres://u:p@db.internal:5432/igris'
    CANONICAL.each_key do |slug|
      get "/settings?section=#{slug}"
      assert_response :success
      refute_match 'igris_service_secret_value_abc123', response.body, slug
      refute_match 'admin_pw_value_xyz789', response.body, slug
      refute_match 'postgres://', response.body, slug
      refute_match 'db.internal', response.body, slug
    end
  ensure
    prev.each { |k, v| v.nil? ? ENV.delete(k) : ENV[k] = v }
  end

  # ── Vocabulary guardrail across every section ────────────────────────────
  test 'no section uses forbidden user-facing vocabulary' do
    CANONICAL.each_key do |slug|
      get "/settings?section=#{slug}"
      assert_response :success
      refute_match(/Overture/, response.body, "#{slug} leaked Overture")
      refute_match(/Next\.js/, response.body, "#{slug} leaked Next.js")
      refute_match(/\btenant\b/i, response.body, "#{slug} leaked tenant")
      refute_match(/\blicense\b/i, response.body, "#{slug} leaked license")
    end
  end
end
