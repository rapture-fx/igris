ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'
require 'rails/test_help'

Dir[Rails.root.join('test/support/**/*.rb')].sort.each { |f| require f }

class ActiveSupport::TestCase
  # no parallel — keeps the spike simple
end

class ActionDispatch::IntegrationTest
  include ConsolePageAssertions
end
