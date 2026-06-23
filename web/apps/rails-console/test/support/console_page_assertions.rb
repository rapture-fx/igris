# Shared stable markers for the Rails console onboarding/workspace split.
#
# /home     — first-run onboarding inside console chrome (hero, diagram, CTAs).
# /overview — everyday workspace (needs-attention, status summaries, recent runs).
#
# Product-promise stage `rails-console-alignment` runs the full Rails suite.
# When adding auth or route tests, use these helpers instead of ad-hoc strings
# like bare "Workspace" on /home — that page intentionally does not render
# workspace chrome. See welcome_home_split_test.rb for the canonical split.
module ConsolePageAssertions
  # /home — onboarding entry point (install-first layout)
  HOME_ONBOARDING_TITLE = 'Install Igris'
  HOME_CONSOLE_RAIL = 'ic-rail'
  HOME_OVERVIEW_LINK = 'Go to Overview'

  # /overview — workspace markers (must not appear on /home)
  OVERVIEW_WORKSPACE_LABEL = 'Workspace'
  OVERVIEW_WORKSPACE_VIEWS = 'Workspace views'
  OVERVIEW_NEEDS_ATTENTION = 'Needs attention'

  def assert_home_onboarding_page(body = response.body)
    assert_match HOME_ONBOARDING_TITLE, body
    assert_match HOME_CONSOLE_RAIL, body
    assert_match HOME_OVERVIEW_LINK, body
    assert_match 'igris.sh/install', body
    refute_match OVERVIEW_WORKSPACE_VIEWS, body,
                 '/home is onboarding; workspace views live on /overview'
  end

  def assert_overview_workspace_page(body = response.body, needs_attention: false)
    refute_match HOME_ONBOARDING_TITLE, body,
                 '/overview must not render the /home install hero'
    assert_match OVERVIEW_WORKSPACE_LABEL, body
    assert_match OVERVIEW_NEEDS_ATTENTION, body if needs_attention
  end
end