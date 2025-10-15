# Schlep-engine Ruby SDK

Official Ruby SDK for the Schlep-engine API platform.

[![Gem Version](https://badge.fury.io/rb/schlep_engine.svg)](https://badge.fury.io/rb/schlep_engine)
[![Documentation](https://img.shields.io/badge/docs-online-blue.svg)](https://docs.schlep-engine.com/sdk/ruby)
[![License](https://img.shields.io/github/license/schlep-engine/ruby-sdk.svg)](LICENSE)

## Features

- 🚀 **Simple & Elegant**: Clean Ruby API with intuitive method names
- 🔒 **Type-safe**: Consistent response objects with proper error handling
- 🛡️ **Error Handling**: Comprehensive exception types with detailed messages
- 📡 **Streaming**: WebSocket support for real-time events
- 🔑 **Authentication**: Bearer token authentication with environment variable support
- 📚 **Well Documented**: Extensive YARD documentation and examples
- 💎 **Ruby 3.0+**: Built for modern Ruby with performance optimizations

## Installation

Add this line to your application's Gemfile:

```ruby
gem 'schlep_engine'
```

And then execute:

```bash
$ bundle install
```

Or install it yourself as:

```bash
$ gem install schlep_engine
```

## Quick Start

```ruby
require 'schlep_engine'

# Create client with API key
client = Schlep::Engine::Client.new('your-api-key')

# Or from environment variable SCHLEP_API_KEY
client = Schlep::Engine::Client.from_env

# Upload data
upload_result = client.upload('Hello, world!')
puts "Upload job ID: #{upload_result.job_id}"

# Train a model
config = {
  model_type: 'classification',
  dataset_id: upload_result.job_id
}
train_result = client.train(config)

# Deploy model
if train_result.model_id
  deploy_result = client.deploy(train_result.model_id)
  puts "Model deployed at: #{deploy_result.endpoint_url}"
end
```

## API Reference

### Client Creation

```ruby
# With API key
client = Schlep::Engine::Client.new('your-api-key')

# From environment variable
client = Schlep::Engine::Client.from_env

# With custom base URL
client = Schlep::Engine::Client.new('your-api-key', base_url: 'https://custom.api.com/v1')
```

### Upload Data

```ruby
result = client.upload('your data here')
puts "Job ID: #{result.job_id}"
```

### Train Model

```ruby
# Using Hash configuration
config = {
  model_type: 'classification',
  dataset_id: 'upload_job_123',
  parameters: {
    algorithm: 'random_forest',
    test_size: 0.2
  }
}
result = client.train(config)

# Using JSON string
config_json = '{
  "model_type": "classification",
  "dataset_id": "upload_job_123",
  "parameters": {
    "algorithm": "random_forest"
  }
}'
result = client.train(config_json)
```

### Deploy Model

```ruby
result = client.deploy('model_456')
puts "Endpoint: #{result.endpoint_url}"
```

### Check Status

```ruby
status = client.status('job_123')
puts "Status: #{status.status}"
puts "Progress: #{status.progress}%" if status.progress
```

### Stream Events

```ruby
config = {
  event_types: ['training', 'deployment'],
  filters: { user_id: '123' }
}

client.stream(config) do |event|
  puts "Received event: #{event[:event_type]}"
  puts "Data: #{event[:data]}"
end
```

## Error Handling

The SDK provides comprehensive error handling:

```ruby
begin
  result = client.upload('data')
  puts "Success: #{result.job_id}"
rescue Schlep::Engine::ApiError => e
  puts "API error #{e.status_code}: #{e.message}"

  # Handle specific error codes
  case e.status_code
  when 401
    puts 'Authentication failed'
  when 429
    puts 'Rate limit exceeded'
  else
    puts 'Unexpected error'
  end
rescue Schlep::Engine::ConfigurationError => e
  puts "Configuration error: #{e.message}"
rescue Schlep::Engine::NetworkError => e
  puts "Network error: #{e.message}"
end
```

## Response Objects

All API methods return structured response objects:

### UploadResponse
```ruby
upload_result.job_id    # => "upload_123"
upload_result.status    # => "processing"
upload_result.message   # => "Upload successful"
```

### TrainResponse
```ruby
train_result.job_id     # => "train_456"
train_result.model_id   # => "model_789"
train_result.status     # => "training"
train_result.message    # => "Training started"
```

### DeployResponse
```ruby
deploy_result.deployment_id  # => "deploy_101"
deploy_result.endpoint_url   # => "https://api.schlep-engine.com/models/model_789/predict"
deploy_result.status         # => "deployed"
deploy_result.message        # => "Model deployed successfully"
```

### StatusResponse
```ruby
status.job_id       # => "job_123"
status.status       # => "completed"
status.progress     # => 100.0
status.result       # => {"output" => "Job completed successfully"}
status.error        # => nil
status.created_at   # => "2024-01-01T00:00:00Z"
status.updated_at   # => "2024-01-01T01:00:00Z"
```

## Environment Variables

- `SCHLEP_API_KEY`: Your Schlep-engine API key

## Development

After checking out the repo, run `bin/setup` to install dependencies. Then, run `rake spec` to run the tests. You can also run `bin/console` for an interactive prompt that will allow you to experiment.

```bash
# Install dependencies
bundle install

# Run tests
bundle exec rspec

# Run tests with coverage
COVERAGE=true bundle exec rspec

# Run linter
bundle exec rubocop

# Generate documentation
bundle exec yard

# Build and install gem locally
gem build schlep_engine.gemspec
gem install ./schlep_engine-1.0.0.gem
```

## Testing

The SDK includes comprehensive tests with mocked HTTP responses:

```bash
# Run all tests
bundle exec rspec

# Run specific test file
bundle exec rspec spec/schlep_engine_spec.rb

# Run tests with detailed output
bundle exec rspec --format documentation

# Run tests with coverage report
COVERAGE=true bundle exec rspec
```

### Example Usage in Rails

```ruby
# In your Rails application

# config/initializers/schlep_engine.rb
Rails.application.config.after_initialize do
  $schlep_client = Schlep::Engine::Client.from_env
end

# In your controller
class DataController < ApplicationController
  def upload
    begin
      result = $schlep_client.upload(params[:data])
      render json: { job_id: result.job_id, status: result.status }
    rescue Schlep::Engine::ApiError => e
      render json: { error: e.message }, status: e.status_code
    end
  end

  def train
    begin
      config = {
        model_type: params[:model_type],
        dataset_id: params[:dataset_id],
        parameters: params[:parameters] || {}
      }

      result = $schlep_client.train(config)
      render json: { job_id: result.job_id, model_id: result.model_id }
    rescue Schlep::Engine::ApiError => e
      render json: { error: e.message }, status: e.status_code
    end
  end
end
```

### Example Usage with Background Jobs

```ruby
class TrainingJob < ApplicationJob
  queue_as :default

  def perform(dataset_id, model_config)
    client = Schlep::Engine::Client.from_env

    begin
      result = client.train(model_config.merge(dataset_id: dataset_id))

      # Poll for completion
      loop do
        status = client.status(result.job_id)

        case status.status
        when 'completed'
          # Handle successful completion
          handle_training_success(status)
          break
        when 'failed'
          # Handle failure
          handle_training_failure(status)
          break
        else
          # Still processing, wait and check again
          sleep 30
        end
      end
    rescue Schlep::Engine::ApiError => e
      handle_training_error(e)
    end
  end

  private

  def handle_training_success(status)
    Rails.logger.info "Training completed for job #{status.job_id}"
    # Add your success handling logic here
  end

  def handle_training_failure(status)
    Rails.logger.error "Training failed for job #{status.job_id}: #{status.error}"
    # Add your failure handling logic here
  end

  def handle_training_error(error)
    Rails.logger.error "Training API error: #{error.message}"
    # Add your error handling logic here
  end
end
```

## Ruby Version Compatibility

- **Ruby 3.0+**: Fully supported
- **Ruby 2.7**: Not officially supported (may work but not tested)

## Dependencies

- [faraday](https://github.com/lostisland/faraday) - HTTP client library
- [websocket-client-simple](https://github.com/shokai/websocket-client-simple) - WebSocket client

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://docs.schlep-engine.com/sdk/ruby)
- 🐛 [Issues](https://github.com/schlep-engine/ruby-sdk/issues)
- 💬 [Support](https://support.schlep-engine.com)

## Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/schlep-engine/ruby-sdk.

### Development Setup

1. Clone the repository
2. Run `bundle install` to install dependencies
3. Run `bundle exec rspec` to run the tests
4. Run `bundle exec rubocop` to check code style

### Code Style

This project follows standard Ruby conventions:
- Use 2 spaces for indentation
- Maximum line length of 120 characters
- Follow the [Ruby Style Guide](https://rubystyle.guide/)
- Use RuboCop for automated style checking