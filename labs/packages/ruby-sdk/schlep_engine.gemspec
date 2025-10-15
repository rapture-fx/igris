# frozen_string_literal: true

require_relative 'lib/schlep/engine/version'

Gem::Specification.new do |spec|
  spec.name = 'schlep_engine'
  spec.version = Schlep::Engine::VERSION
  spec.authors = ['Schlep-engine Team']
  spec.email = ['support@schlep-engine.com']

  spec.summary = 'Official Ruby SDK for the Schlep-engine API platform'
  spec.description = 'A comprehensive Ruby SDK for interacting with the Schlep-engine API, ' \
                     'providing methods for data upload, model training, deployment, and real-time streaming.'
  spec.homepage = 'https://github.com/schlep-engine/ruby-sdk'
  spec.license = 'MIT'
  spec.required_ruby_version = '>= 3.0.0'

  spec.metadata['homepage_uri'] = spec.homepage
  spec.metadata['source_code_uri'] = 'https://github.com/schlep-engine/ruby-sdk'
  spec.metadata['changelog_uri'] = 'https://github.com/schlep-engine/ruby-sdk/blob/main/CHANGELOG.md'
  spec.metadata['documentation_uri'] = 'https://docs.schlep-engine.com/sdk/ruby'
  spec.metadata['bug_tracker_uri'] = 'https://github.com/schlep-engine/ruby-sdk/issues'

  # Specify which files should be added to the gem when it is released.
  spec.files = Dir.chdir(__dir__) do
    `git ls-files -z`.split("\x0").reject do |f|
      (File.expand_path(f) == __FILE__) ||
        f.start_with?(*%w[bin/ test/ spec/ features/ .git .circleci appveyor Gemfile])
    end
  end
  spec.bindir = 'exe'
  spec.executables = spec.files.grep(%r{\Aexe/}) { |f| File.basename(f) }
  spec.require_paths = ['lib']

  # Runtime dependencies
  spec.add_dependency 'faraday', '~> 2.7'
  spec.add_dependency 'faraday-net_http', '~> 3.0'
  spec.add_dependency 'websocket-client-simple', '~> 0.8.0'

  # Development dependencies
  spec.add_development_dependency 'bundler', '~> 2.0'
  spec.add_development_dependency 'rake', '~> 13.0'
  spec.add_development_dependency 'rspec', '~> 3.12'
  spec.add_development_dependency 'webmock', '~> 3.18'
  spec.add_development_dependency 'vcr', '~> 6.2'
  spec.add_development_dependency 'rubocop', '~> 1.56'
  spec.add_development_dependency 'rubocop-rspec', '~> 2.24'
  spec.add_development_dependency 'yard', '~> 0.9'
  spec.add_development_dependency 'simplecov', '~> 0.22'

  # For more information and examples about making a new gem, check out our
  # guide at: https://bundler.io/guides/creating_gem.html
end