import Link from 'next/link'
import { ArrowRightIcon, CheckCircleIcon, DocumentTextIcon } from '@heroicons/react/24/outline'

export default function RubySDKPage() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 text-gray-900">
          Ruby SDK
        </h1>
        <p className="text-xl text-gray-600 mb-6">
          Elegant Ruby SDK for Schlep Engine - Built for Rails applications, background jobs, and API integrations with idiomatic Ruby patterns and comprehensive testing support.
        </p>

        <div className="flex items-center gap-4 mb-6">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            Latest: v0.9.0
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            Ruby 3.0+
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
            Rails Ready
          </span>
        </div>

        <div className="flex gap-4">
          <Link
            href="https://rubygems.org/gems/schlep_engine"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            View on RubyGems
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link
            href="https://github.com/schlep-engine/ruby-sdk"
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            GitHub Repository
          </Link>
        </div>
      </div>

      <div className="prose prose-lg max-w-none">
        <div className="bg-red-50 border-l-4 border-red-400 p-6 mb-8">
          <h3 className="text-lg font-semibold text-red-800 mb-2">
            Ruby-First Design
          </h3>
          <p className="text-red-700">
            Designed with Ruby idioms in mind - blocks, mixins, and expressive APIs that feel natural to Ruby developers.
          </p>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Installation</h2>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Gemfile</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`gem 'schlep_engine', '~> 0.9.0'

# Optional: Rails integration
gem 'schlep_engine-rails', '~> 0.9.0'

# Optional: Background job integration
gem 'schlep_engine-sidekiq', '~> 0.9.0'`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Bundle Install</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`bundle add schlep_engine

# Or install directly
gem install schlep_engine`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Rails Generator</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`# Generate configuration initializer
rails generate schlep_engine:install

# Generate example controllers and models
rails generate schlep_engine:examples`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Quick Start</h2>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Basic Usage</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`require 'schlep_engine'

# Initialize client
client = SchlepEngine::Client.new(
  api_key: 'your-api-key-here',
  base_url: 'https://api.schlep-engine.com',
  timeout: 30
)

# Process data with Ruby blocks
result = client.data.process_file('data/sales.csv') do |config|
  config.output_format = :json
  config.transformations << { type: 'filter', condition: 'age > 18' }
  config.transformations << { type: 'aggregate', column: 'revenue', operation: 'sum' }
end

puts "Job ID: #{result.job_id}"

# Or using method chaining
result = client.data
  .filter('age > 18')
  .aggregate('revenue', :sum)
  .process_file('data/sales.csv', format: :json)

puts "Processing started: #{result.job_id}"`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibold mt-8 mb-4">Rails Integration</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`# config/initializers/schlep_engine.rb
SchlepEngine.configure do |config|
  config.api_key = Rails.application.credentials.schlep_engine_api_key
  config.base_url = 'https://api.schlep-engine.com'
  config.timeout = 30
  config.logger = Rails.logger
  config.environment = Rails.env
end

# app/models/data_processor.rb
class DataProcessor
  include SchlepEngine::Rails::Integration

  def process_customer_data(file_path)
    schlep_client.data.process_file(file_path) do |config|
      config.transformations = [
        { type: 'clean', remove_nulls: true },
        { type: 'validate', email_format: true }
      ]
    end
  end

  def process_with_callbacks(file_path)
    schlep_client.data.process_file(file_path) do |config|
      config.on_progress { |percentage| Rails.logger.info "Progress: #{percentage}%" }
      config.on_complete { |result| NotifyUserJob.perform_later(result) }
      config.on_error { |error| Rails.logger.error "Processing failed: #{error}" }
    end
  end
end

# app/controllers/data_controller.rb
class DataController < ApplicationController
  def process
    processor = DataProcessor.new
    result = processor.process_customer_data(params[:file_path])

    render json: { job_id: result.job_id, status: 'started' }
  rescue SchlepEngine::Error => e
    render json: { error: e.message }, status: :unprocessable_entity
  end
end`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibond mt-8 mb-4">Background Jobs with Sidekiq</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`# app/workers/data_processing_worker.rb
class DataProcessingWorker
  include Sidekiq::Worker
  include SchlepEngine::Sidekiq::Worker

  sidekiq_options retry: 3, queue: 'data_processing'

  def perform(file_path, user_id)
    logger.info "Starting data processing for user #{user_id}"

    result = schlep_client.data.process_file(file_path) do |config|
      config.transformations = [
        { type: 'clean', strategy: 'advanced' },
        { type: 'feature_engineering', auto_detect: true }
      ]

      # Progress callbacks
      config.on_progress do |percentage|
        broadcast_progress(user_id, percentage)
      end

      config.on_complete do |result|
        User.find(user_id).update!(
          last_processing_job: result.job_id,
          last_processed_at: Time.current
        )
        NotificationMailer.processing_complete(user_id, result).deliver_now
      end
    end

    logger.info "Processing job started: #{result.job_id}"
    result.job_id
  rescue SchlepEngine::Error => e
    logger.error "Processing failed: #{e.message}"
    NotificationMailer.processing_failed(user_id, e.message).deliver_now
    raise
  end

  private

  def broadcast_progress(user_id, percentage)
    ActionCable.server.broadcast(
      "processing_#{user_id}",
      { type: 'progress', percentage: percentage }
    )
  end
end

# Usage
DataProcessingWorker.perform_async('/uploads/customer_data.csv', current_user.id)`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibond mt-12 mb-6">Key Features</h2>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900">Idiomatic Ruby</h4>
              <p className="text-gray-600">Blocks, mixins, and Ruby conventions</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900">Rails Integration</h4>
              <p className="text-gray-600">Generators, initializers, and Rails patterns</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900">Background Jobs</h4>
              <p className="text-gray-600">Sidekiq, Resque, and DelayedJob support</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900">Testing Support</h4>
              <p className="text-gray-600">RSpec matchers and test helpers</p>
            </div>
          </div>
        </div>

        <h2 className="text-3xl font-semibond mt-12 mb-6">Core Features</h2>

        <h3 className="text-2xl font-semibond mt-8 mb-4">Machine Learning Pipeline</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`# Create ML pipeline with Ruby DSL
pipeline = client.ml.create_pipeline do |config|
  config.name = 'Customer Segmentation'
  config.task_type = :clustering
  config.model_type = :kmeans
  config.features = %w[age income purchase_frequency]
  config.auto_optimize = true

  # Preprocessing pipeline
  config.preprocessing do |prep|
    prep.scale_features = true
    prep.handle_outliers = :remove
    prep.fill_missing = :median
  end

  # Training configuration
  config.training do |train|
    train.validation_split = 0.2
    train.cross_validation = 5
    train.early_stopping = true
  end
end

# Train with progress monitoring
training_job = pipeline.train do |progress|
  puts "Training progress: #{progress.percentage}%"
  puts "Current metric: #{progress.metrics[:silhouette_score]}" if progress.metrics
end

# Wait for completion
model = training_job.wait_for_completion!

puts "Training completed!"
puts "Model clusters: #{model.metadata[:n_clusters]}"
puts "Silhouette score: #{model.metrics[:silhouette_score]}"

# Make predictions
segments = model.predict([
  { age: 35, income: 65000, purchase_frequency: 12 },
  { age: 22, income: 35000, purchase_frequency: 3 }
])

segments.each_with_index do |segment, index|
  puts "Customer #{index + 1} belongs to segment: #{segment.cluster_id}"
  puts "Confidence: #{segment.confidence}"
end`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibond mt-8 mb-4">Data Processing DSL</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`# Fluent data processing API
processor = client.data.processor

# Method chaining approach
result = processor
  .load('customer_data.csv')
  .filter { |row| row[:age] > 18 && row[:income] > 30000 }
  .transform(:standardize, columns: [:income, :age])
  .aggregate(group_by: :region, metrics: { total_income: :sum, avg_age: :mean })
  .save(format: :json, destination: 's3://my-bucket/processed/')

# Block-based configuration
processor.process do |p|
  p.load 'sales_data.csv'

  p.clean do |clean|
    clean.remove_nulls = true
    clean.deduplicate = true
    clean.standardize_dates format: '%Y-%m-%d'
  end

  p.transform do |transform|
    transform.add_column :profit_margin do |row|
      (row[:revenue] - row[:cost]) / row[:revenue]
    end

    transform.categorize :customer_segment do |row|
      case row[:total_purchases]
      when 0..5 then 'bronze'
      when 6..20 then 'silver'
      when 21..50 then 'gold'
      else 'platinum'
      end
    end
  end

  p.validate do |validate|
    validate.check :email, format: :email
    validate.check :age, range: 18..100
    validate.check :revenue, greater_than: 0
  end

  p.export format: :parquet, compression: :snappy
end`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibond mt-8 mb-4">Error Handling and Retries</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`# Comprehensive error handling
begin
  result = client.data.process_file('large_dataset.csv') do |config|
    config.retry_on_failure = true
    config.max_retries = 3
    config.retry_delay = 2.seconds
    config.exponential_backoff = true
  end
rescue SchlepEngine::AuthenticationError => e
  Rails.logger.error "Authentication failed: #{e.message}"
  # Handle auth error - maybe refresh token
rescue SchlepEngine::ValidationError => e
  Rails.logger.error "Validation failed:"
  e.validation_errors.each do |field, error|
    Rails.logger.error "  #{field}: #{error}"
  end
rescue SchlepEngine::RateLimitError => e
  Rails.logger.warn "Rate limited. Retry after #{e.retry_after} seconds"
  sleep(e.retry_after)
  retry
rescue SchlepEngine::TimeoutError => e
  Rails.logger.error "Request timed out: #{e.message}"
  # Maybe try with smaller batch size
rescue SchlepEngine::APIError => e
  Rails.logger.error "API error (#{e.status_code}): #{e.message}"
  case e.status_code
  when 503
    # Service unavailable - maybe schedule for later
    DataProcessingWorker.perform_in(5.minutes, file_path)
  else
    raise # Re-raise unknown errors
  end
end

# Using Ruby's safe navigation and error handling
result = client.data
  .process_file(file_path)
  &.tap { |r| Rails.logger.info "Started job: #{r.job_id}" }
  &.wait_for_completion(timeout: 5.minutes)
  &.tap { |r| Rails.logger.info "Completed: #{r.status}" }

# Custom error handlers
SchlepEngine.configure do |config|
  config.on_error do |error, context|
    Sentry.capture_exception(error, extra: context)
    SlackNotifier.notify("Schlep Engine error: #{error.message}")
  end

  config.on_rate_limit do |retry_after, context|
    Rails.logger.warn "Rate limited for #{retry_after}s: #{context[:endpoint]}"
  end
end`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibond mt-12 mb-6">Testing</h2>

        <h3 className="text-2xl font-semibond mt-8 mb-4">RSpec Integration</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`# spec/spec_helper.rb
require 'schlep_engine/rspec'

RSpec.configure do |config|
  config.include SchlepEngine::RSpec::Helpers
  config.include SchlepEngine::RSpec::Matchers
end

# spec/models/data_processor_spec.rb
RSpec.describe DataProcessor do
  let(:processor) { described_class.new }

  describe '#process_customer_data' do
    before do
      stub_schlep_engine_request(:post, '/data/process')
        .with_file('customer_data.csv')
        .to_return_job(id: 'test-job-123')
    end

    it 'processes customer data successfully' do
      result = processor.process_customer_data('customer_data.csv')

      expect(result).to be_a(SchlepEngine::ProcessingResult)
      expect(result.job_id).to eq('test-job-123')
    end

    it 'applies correct transformations' do
      processor.process_customer_data('customer_data.csv')

      expect(schlep_engine).to have_received_request
        .with_transformations([
          { type: 'clean', remove_nulls: true },
          { type: 'validate', email_format: true }
        ])
    end
  end

  describe '#process_with_ml_pipeline' do
    let(:pipeline_config) do
      {
        name: 'Test Pipeline',
        task_type: 'classification',
        model_type: 'random_forest'
      }
    end

    it 'creates ML pipeline with correct configuration' do
      expect {
        processor.create_ml_pipeline(pipeline_config)
      }.to create_schlep_engine_pipeline
        .with_name('Test Pipeline')
        .with_task_type('classification')
    end
  end
end

# Custom matchers
RSpec::Matchers.define :create_schlep_engine_pipeline do
  match do |block|
    expect(block).to change { schlep_engine_requests.count }.by(1)
    expect(last_schlep_engine_request.endpoint).to eq('/ml/pipelines')
  end

  chain :with_name do |name|
    @expected_name = name
  end

  chain :with_task_type do |task_type|
    @expected_task_type = task_type
  end
end`}</code></pre>
        </div>

        <h3 className="text-2xl font-semibond mt-8 mb-4">Mock and Stub Helpers</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`# spec/support/schlep_engine_helpers.rb
module SchlepEngineHelpers
  def mock_schlep_engine_client
    instance_double(SchlepEngine::Client).tap do |client|
      allow(SchlepEngine::Client).to receive(:new).and_return(client)
      allow(client).to receive(:data).and_return(mock_data_service)
      allow(client).to receive(:ml).and_return(mock_ml_service)
    end
  end

  def mock_data_service
    instance_double(SchlepEngine::DataService).tap do |service|
      allow(service).to receive(:process_file).and_return(mock_processing_result)
    end
  end

  def mock_processing_result(job_id: 'test-job-123')
    instance_double(
      SchlepEngine::ProcessingResult,
      job_id: job_id,
      status: 'processing',
      progress: 0
    )
  end

  def stub_processing_job(job_id:, status: 'completed', progress: 100)
    allow_any_instance_of(SchlepEngine::ProcessingResult)
      .to receive(:wait_for_completion)
      .and_return(
        instance_double(
          SchlepEngine::ProcessingResult,
          job_id: job_id,
          status: status,
          progress: progress
        )
      )
  end
end

RSpec.configure do |config|
  config.include SchlepEngineHelpers
end

# Usage in tests
RSpec.describe 'Data processing workflow' do
  before do
    mock_schlep_engine_client
    stub_processing_job(job_id: 'workflow-123', status: 'completed')
  end

  it 'completes the workflow successfully' do
    # Test implementation
  end
end`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibond mt-12 mb-6">Configuration</h2>

        <h3 className="text-2xl font-semibond mt-8 mb-4">Environment Configuration</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`# config/initializers/schlep_engine.rb
SchlepEngine.configure do |config|
  config.api_key = ENV.fetch('SCHLEP_ENGINE_API_KEY')
  config.base_url = ENV.fetch('SCHLEP_ENGINE_BASE_URL', 'https://api.schlep-engine.com')
  config.timeout = ENV.fetch('SCHLEP_ENGINE_TIMEOUT', 30).to_i
  config.environment = Rails.env
  config.logger = Rails.logger

  # Retry configuration
  config.retry_on_failure = true
  config.max_retries = ENV.fetch('SCHLEP_ENGINE_MAX_RETRIES', 3).to_i
  config.retry_delay = ENV.fetch('SCHLEP_ENGINE_RETRY_DELAY', 1).to_i.seconds
  config.exponential_backoff = true

  # Rate limiting
  config.rate_limit_retry = true
  config.rate_limit_max_wait = 60.seconds

  # Environment-specific settings
  case Rails.env
  when 'development'
    config.debug = true
    config.log_requests = true
  when 'test'
    config.mock_mode = true
    config.raise_on_error = true
  when 'production'
    config.enable_metrics = true
    config.sentry_integration = true
  end

  # Background job integration
  config.background_job_adapter = :sidekiq
  config.default_queue = 'data_processing'
  config.priority_queue = 'urgent_processing'

  # Callbacks
  config.before_request do |request|
    Rails.logger.debug "Schlep Engine request: #{request.method} #{request.url}"
  end

  config.after_request do |request, response|
    Rails.logger.debug "Schlep Engine response: #{response.status}"
  end
end

# config/database.yml equivalent for Schlep Engine
# config/schlep_engine.yml
development:
  api_key: <%= ENV['SCHLEP_ENGINE_API_KEY'] %>
  base_url: https://dev-api.schlep-engine.com
  timeout: 60
  debug: true

test:
  api_key: test-key
  base_url: http://localhost:3001
  mock_mode: true

production:
  api_key: <%= ENV['SCHLEP_ENGINE_API_KEY'] %>
  base_url: https://api.schlep-engine.com
  timeout: 30
  enable_metrics: true`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibond mt-12 mb-6">Requirements</h2>

        <ul className="list-disc list-inside space-y-2 mb-8">
          <li>Ruby 3.0.0 or later</li>
          <li>Rails 7.0+ (for Rails integration)</li>
          <li>Faraday gem for HTTP requests</li>
          <li>JSON gem for data serialization</li>
        </ul>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="border border-gray-200 rounded-lg p-6">
            <DocumentTextIcon className="h-8 w-8 text-blue-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">API Documentation</h3>
            <p className="text-gray-600 mb-4">
              Complete YARD documentation with examples and usage patterns.
            </p>
            <Link href="https://rubydoc.info/gems/schlep_engine" className="text-blue-600 hover:text-blue-700 font-medium">
              View on RubyDoc →
            </Link>
          </div>

          <div className="border border-gray-200 rounded-lg p-6">
            <div className="text-2xl mb-3">💎</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Examples</h3>
            <p className="text-gray-600 mb-4">
              Rails applications and background job integration examples.
            </p>
            <Link href="https://github.com/schlep-engine/ruby-sdk-examples" className="text-blue-600 hover:text-blue-700 font-medium">
              View Examples →
            </Link>
          </div>

          <div className="border border-gray-200 rounded-lg p-6">
            <div className="text-2xl mb-3">🚀</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Rails Guide</h3>
            <p className="text-gray-600 mb-4">
              Best practices for integrating with Rails applications.
            </p>
            <Link href="/guides/rails-integration" className="text-blue-600 hover:text-blue-700 font-medium">
              View Rails Guide →
            </Link>
          </div>
        </div>

        <div className="bg-red-50 border-l-4 border-red-400 p-6">
          <h3 className="text-lg font-semibold text-red-800 mb-2">
            Ready to Build with Ruby?
          </h3>
          <p className="text-red-700 mb-4">
            Integrate Schlep Engine into your Ruby applications with elegant, idiomatic code and comprehensive Rails support.
          </p>
          <div className="flex gap-4">
            <Link
              href="/introduction/quickstart"
              className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Quick Start Guide
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/api-reference"
              className="inline-flex items-center gap-2 border border-red-300 text-red-700 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors"
            >
              API Reference
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}