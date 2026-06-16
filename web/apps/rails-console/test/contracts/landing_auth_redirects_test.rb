require 'test_helper'

# Cross-repo contract: landing AuthForm must keep using the stable console paths
# documented in AUTH_ROUTES.md.
class LandingAuthRedirectsTest < ActiveSupport::TestCase
  LANDING_ROOT = Rails.root.join('../web-landing').expand_path

  test 'landing auth form references stable console auth paths' do
    auth_form = File.read(LANDING_ROOT.join('src/components/auth/AuthForm.tsx'))
    paths = File.read(LANDING_ROOT.join('src/lib/console-auth-paths.ts'))

    %w[onboarding dashboard resetPassword reset-password /onboarding /dashboard /reset-password].each do |needle|
      assert(
        auth_form.include?(needle) || paths.include?(needle),
        "expected landing auth contract to mention #{needle}"
      )
    end
  end

  test 'landing local console dev port matches rails puma default' do
    console_url = File.read(LANDING_ROOT.join('src/lib/console-url.ts'))
    assert_match 'localhost:3100', console_url
  end

  test 'landing auth client targets console origin for BetterAuth API' do
    auth_client = File.read(LANDING_ROOT.join('src/lib/auth-client.ts'))
    assert_match 'getConsoleUrl', auth_client
  end

  test 'rails console mounts BetterAuth proxy route' do
    routes = File.read(Rails.root.join('config/routes.rb'))
    assert_match '/api/auth/*path', routes
    assert_match 'auth_proxy#forward', routes
  end
end