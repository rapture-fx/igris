# Schlep-engine Ruby SDK

**Status:** 🚧 In Development - Planned for Future Release

## Overview

The Schlep-engine Ruby SDK is currently under development and not yet ready for production use.

## Planned Features

- Ruby 3.0+ support
- Idiomatic Ruby API
- ActiveSupport integration
- Rails generator for configuration
- RSpec test helpers
- RubyGems distribution

## Installation (Coming Soon)

```ruby
gem install schlep
```

Or add to your Gemfile:

```ruby
gem 'schlep', '~> 1.0'
```

## Planned Usage

```ruby
require 'schlep'

client = Schlep::Client.new(
  base_url: 'http://localhost:8081',
  api_key: 'your-api-key'
)

response = client.infer(
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'Hello, world!' }
  ],
  max_tokens: 100
)

puts response.choices.first.message.content
```

## Rails Integration

```ruby
# config/initializers/schlep.rb
Schlep.configure do |config|
  config.base_url = ENV['SCHLEP_BASE_URL']
  config.api_key = ENV['SCHLEP_API_KEY']
  config.timeout = 30
end

# app/services/chat_service.rb
class ChatService
  def initialize
    @client = Schlep::Client.new
  end

  def chat(message)
    @client.infer(
      model: 'gpt-4',
      messages: [{ role: 'user', content: message }]
    )
  end
end
```

## Current Status

This SDK is in the planning phase. We are designing the API and Rails integration.

## Contributing

Interested in contributing to the Ruby SDK? Please see our [Contributing Guide](https://github.com/schlep-engine/schlep-engine/blob/main/CONTRIBUTING.md).

## Timeline

- **Q3 2026**: Alpha release with basic functionality
- **Q4 2026**: Beta release with Rails generators
- **Q1 2027**: v1.0 stable release

## Alternative Solutions

While we work on the official Ruby SDK, you can use:
- Direct HTTP requests with Net::HTTP or Faraday
- HTTParty for simplified REST calls
- Community-maintained Ruby clients (not officially supported)

## Contact

For questions or to express interest in early access:
- Email: hello@schlep-engine.com
- GitHub: https://github.com/schlep-engine/schlep-engine/issues

---

**Schlep-engine** - Intelligent AI Routing and Cost Optimization
