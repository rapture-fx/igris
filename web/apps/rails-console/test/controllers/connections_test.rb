require 'test_helper'

# Connections — the read-only "where does work go" view derived from action
# targets + the runtime fleet. Runs in fixtures mode (no live Overture).
class ConnectionsTest < ActionDispatch::IntegrationTest
  test 'connections page renders destinations grouped from action targets' do
    get '/connections'
    assert_response :success
    assert_select '.ic-topbar__title', text: 'Connections'
    assert_match 'Where your actions send work', response.body
    # Fixtures include local-runtime actions and hosted-API providers.
    assert_match 'Local runtime', response.body
    assert_match 'Resend', response.body
  end

  test 'connections links out to runtime and secret management, not its own backend' do
    get '/connections'
    assert_select "a[href=?]", runtimes_path
    assert_select "a[href=?]", new_action_path
  end

  test 'connection labels never expose a full target URL' do
    get '/connections'
    # Connection labels are host/provider only — assert no scheme leaks into a
    # connection card label.
    assert_select '.ic-conn-label' do |labels|
      labels.each { |l| refute_match %r{https?://}, l.text }
    end
  end

  test 'rail exposes Connections and Governance and folds Runtimes off the rail' do
    get '/connections'
    assert_select 'a.ic-rail__btn[href=?]', connections_path
    assert_select 'a.ic-rail__btn[href=?]', governance_path
    # Runtimes is now reached through Connections/Settings, not the top rail.
    assert_select 'a.ic-rail__btn[href=?]', runtimes_path, false
  end
end
