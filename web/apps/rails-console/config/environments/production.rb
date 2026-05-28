require 'active_support/core_ext/integer/time'

Rails.application.configure do
  config.enable_reloading = false
  config.eager_load = true
  config.consider_all_requests_local = false
  config.action_controller.perform_caching = true

  config.public_file_server.enabled = ENV['RAILS_SERVE_STATIC_FILES'].present?

  config.assets.compile = false

  config.log_level = :info
  config.log_tags = [:request_id]

  config.action_dispatch.show_exceptions = :rescuable

  config.force_ssl = false # spike — leave off
end
