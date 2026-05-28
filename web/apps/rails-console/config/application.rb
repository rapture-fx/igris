require_relative 'boot'

# Pick only the framework pieces we need — no Active Record (the spike does not own data).
require 'rails'
require 'action_controller/railtie'
require 'action_view/railtie'
require 'propshaft'

Bundler.require(*Rails.groups)

module RailsConsole
  class Application < Rails::Application
    config.load_defaults 7.1

    # No autoloading drama for a spike — Zeitwerk handles app/services etc.
    config.autoload_lib(ignore: %w[assets tasks])

    config.time_zone = 'UTC'

    # Rails normally insists on a master key for credentials; the spike has none.
    config.require_master_key = false

    # Don't generate Active Record helpers
    config.generators do |g|
      g.orm :none
      g.test_framework :test_unit, fixture: false
      g.helper false
      g.assets false
    end

    # Hosts allowed (let the dev server be reachable from the host machine)
    config.hosts << /.*/

    # Spike isolation: no shared session DB, signed cookies are fine
    config.session_store :cookie_store, key: '_igris_rails_console_session'
  end
end
