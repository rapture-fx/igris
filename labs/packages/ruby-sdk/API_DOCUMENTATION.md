# Igris-engine Ruby SDK - API Documentation

Complete API documentation for the Igris-engine Ruby SDK.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Modules](#api-modules)
  - [Data Processing API](#data-processing-api)
  - [ML Pipeline API](#ml-pipeline-api)
  - [Analytics API](#analytics-api)
  - [Document Extraction API](#document-extraction-api)
  - [Data Quality API](#data-quality-api)
  - [Storage API](#storage-api)
  - [Monitoring API](#monitoring-api)
  - [Users API](#users-api)
  - [Admin API](#admin-api)
- [Error Handling](#error-handling)
- [Response Types](#response-types)

## Installation

Add to your Gemfile:

```ruby
gem 'igris_overture'
```

Or install directly:

```bash
gem install igris_overture
```

## Quick Start

```ruby
require 'igris_overture'

# Initialize client with API key
client = Igris::Engine::Client.new('your-api-key')

# Or use environment variable
ENV['IGRIS_API_KEY'] = 'your-api-key'
client = Igris::Engine::Client.from_env

# Process data
result = client.data.process_file('data.csv')

# Train ML model
config = { name: 'My Model', task_type: 'classification' }
pipeline = client.ml.create_pipeline(config)
```

## API Modules

### Data Processing API

Process, transform, and manage data files.

```ruby
# Access the data API
data_api = client.data

# Process a file
result = data_api.process_file(
  '/path/to/data.csv',
  data_format: 'csv',
  processing_mode: 'batch',
  transformations: [
    { type: 'filter', column: 'age', operator: '>', value: 18 },
    { type: 'rename', from: 'name', to: 'full_name' }
  ],
  output_format: 'json'
)

# Process from URL
result = data_api.process_url(
  'https://example.com/data.csv',
  data_format: 'csv'
)

# Upload a file
upload = data_api.upload_file('/path/to/file.csv')

# Get job status
status = data_api.job_status(result['job_id'])

# Get job result
result = data_api.job_result(result['job_id'])

# Cancel a job
data_api.cancel_job(job_id)

# List jobs
jobs = data_api.list_jobs(page: 1, page_size: 20, status: 'completed')

# Create data pipeline
pipeline = data_api.create_pipeline({
  name: 'ETL Pipeline',
  steps: [
    { type: 'extract', source: 's3://bucket/data.csv' },
    { type: 'transform', rules: [...] },
    { type: 'load', destination: 's3://bucket/output/' }
  ]
})

# Run pipeline
result = data_api.run_pipeline(pipeline['id'], parameters: { date: '2024-01-01' })

# List pipelines
pipelines = data_api.list_pipelines(page: 1, active_only: true)
```

### ML Pipeline API

Create, train, and manage machine learning models.

```ruby
# Access the ML API
ml_api = client.ml

# Create ML pipeline
pipeline = ml_api.create_pipeline({
  name: 'Customer Churn Predictor',
  task_type: 'classification',
  model_type: 'random_forest',
  target_column: 'churn',
  features: ['age', 'tenure', 'monthly_charges'],
  hyperparameters: {
    n_estimators: 100,
    max_depth: 10
  }
})

# Train pipeline
training = ml_api.train_pipeline(
  pipeline['id'],
  training_data_path: '/path/to/training.csv',
  parameters: {
    validation_split: 0.2,
    epochs: 10
  }
)

# Get training status
status = ml_api.get_training_job(training['job_id'])

# Get training logs
logs = ml_api.get_training_logs(training['job_id'], lines: 100)

# Cancel training
ml_api.cancel_training(job_id)

# List training jobs
jobs = ml_api.list_training_jobs(
  page: 1,
  status: 'running',
  pipeline_id: pipeline['id']
)

# Make predictions
predictions = ml_api.predict(
  model_id,
  { age: 35, tenure: 24, monthly_charges: 75.0 },
  return_probabilities: true,
  explain_predictions: true
)

# Batch predictions
batch_job = ml_api.batch_predict(
  model_id,
  '/path/to/input.csv',
  output_path: '/path/to/predictions.csv'
)

# Get model info
model = ml_api.get_model(model_id)

# List models
models = ml_api.list_models(
  page: 1,
  task_type: 'classification'
)

# Get model metrics
metrics = ml_api.get_model_metrics(model_id)

# Delete model
ml_api.delete_model(model_id)

# Get model download URL
url = ml_api.download_model_url(model_id)
```

### Analytics API

Execute analytics queries and generate insights.

```ruby
# Access the analytics API
analytics_api = client.analytics

# Execute query
result = analytics_api.query({
  dataset: 'users',
  metrics: ['count', 'avg(age)', 'sum(revenue)'],
  dimensions: ['country', 'subscription_tier'],
  filters: {
    status: 'active',
    created_at: { gte: '2024-01-01' }
  },
  time_range: {
    start: '2024-01-01',
    end: '2024-12-31',
    granularity: 'month'
  }
})

# Get available datasets
datasets = analytics_api.get_datasets

# Get dataset schema
schema = analytics_api.get_schema('users')

# Run aggregation
result = analytics_api.aggregate(
  'orders',
  ['count', 'sum(amount)'],
  dimensions: ['product_category'],
  filters: { status: 'completed' }
)

# Create custom report
report = analytics_api.create_report({
  name: 'Monthly Revenue Report',
  query: {
    dataset: 'orders',
    metrics: ['sum(amount)'],
    dimensions: ['month']
  },
  schedule: 'monthly'
})

# Get report
report = analytics_api.get_report(report_id)

# List reports
reports = analytics_api.list_reports(page: 1)

# Delete report
analytics_api.delete_report(report_id)
```

### Document Extraction API

Extract text, tables, and metadata from documents.

```ruby
# Access the document API
doc_api = client.document

# Extract text from document
result = doc_api.extract_text(
  '/path/to/document.pdf',
  extract_tables: true,
  extract_images: false
)

# Extract only tables
tables = doc_api.extract_tables('/path/to/document.pdf')

# Extract metadata
metadata = doc_api.extract_metadata('/path/to/document.pdf')

# Extract images
images = doc_api.extract_images('/path/to/document.pdf')

# Extract all content
content = doc_api.extract_all('/path/to/document.pdf')

# Get job status
status = doc_api.job_status(job_id)

# List extraction jobs
jobs = doc_api.list_jobs(page: 1, status: 'completed')
```

### Data Quality API

Assess and monitor data quality.

```ruby
# Access the quality API
quality_api = client.quality

# Assess data quality
report = quality_api.assess_quality(
  '/path/to/data.csv',
  checks: ['completeness', 'validity', 'consistency', 'accuracy']
)

# Get quality report
report = quality_api.get_report(report_id)

# List reports
reports = quality_api.list_reports(page: 1, status: 'completed')

# Create quality rules
rules = quality_api.create_rules({
  name: 'Customer Data Rules',
  rules: [
    { field: 'email', type: 'format', pattern: /^[^@]+@[^@]+\.[^@]+$/ },
    { field: 'age', type: 'range', min: 0, max: 120 },
    { field: 'country', type: 'enum', values: ['US', 'UK', 'CA'] }
  ]
})

# Validate data against rules
result = quality_api.validate('/path/to/data.csv', rules['id'])

# Get quality metrics
metrics = quality_api.get_metrics(
  '/path/to/data.csv',
  metric_types: ['completeness', 'uniqueness', 'consistency']
)

# List rules
rules = quality_api.list_rules(page: 1)

# Update rules
quality_api.update_rules(rule_id, updated_rules)

# Delete rules
quality_api.delete_rules(rule_id)
```

### Storage API

Manage file storage and organization.

```ruby
# Access the storage API
storage_api = client.storage

# Upload file
file = storage_api.upload_file(
  '/path/to/file.txt',
  filename: 'custom_name.txt',
  folder: 'documents'
)

# List files
files = storage_api.list_files(
  folder: 'documents',
  page: 1,
  page_size: 20
)

# Get file info
file = storage_api.get_file(file_id)

# Delete file
storage_api.delete_file(file_id)

# Get download URL
url = storage_api.download_file_url(file_id)

# Create folder
folder = storage_api.create_folder(
  'invoices',
  parent_folder: 'documents'
)

# List folders
folders = storage_api.list_folders(parent_folder: 'documents')

# Delete folder
storage_api.delete_folder(folder_id, recursive: true)

# Get storage usage
usage = storage_api.get_usage

# Share file
share = storage_api.share_file(file_id, {
  permissions: ['read'],
  expires_at: '2024-12-31T23:59:59Z'
})

# Revoke share
storage_api.revoke_share(file_id, share_id)
```

### Monitoring API

Monitor system health and performance.

```ruby
# Access the monitoring API
monitoring_api = client.monitoring

# Get system health
health = monitoring_api.system_health

# Get metrics
metrics = monitoring_api.get_metrics(
  metric_names: ['cpu_usage', 'memory_usage', 'request_rate'],
  time_range: {
    start: '2024-01-01T00:00:00Z',
    end: '2024-01-02T00:00:00Z'
  }
)

# Get service status
status = monitoring_api.service_status(service_name: 'api')

# Get alerts
alerts = monitoring_api.get_alerts(
  severity: 'critical',
  page: 1
)

# Acknowledge alert
monitoring_api.acknowledge_alert(alert_id, comment: 'Investigating')

# Get performance metrics
perf = monitoring_api.performance_metrics(
  'cpu',
  time_range: { start: '2024-01-01', end: '2024-01-02' }
)

# Get logs
logs = monitoring_api.get_logs(
  service: 'api',
  level: 'error',
  lines: 100
)

# Get uptime stats
uptime = monitoring_api.uptime_stats

# Create alert rule
rule = monitoring_api.create_alert_rule({
  name: 'High CPU Usage',
  condition: 'cpu_usage > 80',
  severity: 'warning',
  actions: ['email', 'slack']
})

# List alert rules
rules = monitoring_api.list_alert_rules

# Delete alert rule
monitoring_api.delete_alert_rule(rule_id)
```

### Users API

Manage user profiles and settings.

```ruby
# Access the users API
users_api = client.users

# Get current user profile
profile = users_api.get_profile

# Update profile
updated = users_api.update_profile(
  name: 'John Doe',
  timezone: 'America/New_York'
)

# Get user by ID
user = users_api.get_user(user_id)

# Update avatar
users_api.update_avatar('/path/to/avatar.jpg')

# Change password
users_api.change_password('old_password', 'new_password')

# Get preferences
prefs = users_api.get_preferences

# Update preferences
users_api.update_preferences({
  notifications: {
    email: true,
    push: false
  },
  theme: 'dark'
})

# Get API keys
keys = users_api.get_api_keys

# Create API key
key = users_api.create_api_key(
  'Production Key',
  scopes: ['read', 'write'],
  expires_at: '2025-12-31T23:59:59Z'
)

# Revoke API key
users_api.revoke_api_key(key_id)

# Get active sessions
sessions = users_api.get_sessions

# Revoke session
users_api.revoke_session(session_id)

# Get activity log
activity = users_api.get_activity(
  page: 1,
  action_type: 'login'
)

# Get notifications
notifications = users_api.get_notifications(
  unread_only: true,
  page: 1
)

# Mark notification as read
users_api.mark_notification_read(notification_id)

# Mark all as read
users_api.mark_all_notifications_read
```

### Admin API

Administrative functions (requires admin privileges).

```ruby
# Access the admin API
admin_api = client.admin

# Get system statistics
stats = admin_api.system_stats

# List all users
users = admin_api.list_users(
  page: 1,
  status: 'active',
  role: 'user'
)

# Get user by ID
user = admin_api.get_user(user_id)

# Update user
admin_api.update_user(user_id, role: 'admin')

# Delete user
admin_api.delete_user(user_id)

# Suspend user
admin_api.suspend_user(user_id, reason: 'Policy violation')

# Unsuspend user
admin_api.unsuspend_user(user_id)

# Change user role
admin_api.change_user_role(user_id, 'moderator')

# List organizations
orgs = admin_api.list_organizations(page: 1)

# Get organization
org = admin_api.get_organization(org_id)

# Update organization
admin_api.update_organization(org_id, name: 'New Name')

# Delete organization
admin_api.delete_organization(org_id)

# Get system config
config = admin_api.get_config

# Update config
admin_api.update_config({
  max_upload_size: 100_000_000,
  rate_limit: 1000
})

# Get audit logs
logs = admin_api.get_audit_logs(
  page: 1,
  user_id: user_id,
  action_type: 'delete',
  start_date: '2024-01-01',
  end_date: '2024-12-31'
)

# List system jobs
jobs = admin_api.list_system_jobs(
  page: 1,
  status: 'running'
)

# Cancel system job
admin_api.cancel_system_job(job_id)

# Get resource usage
usage = admin_api.get_resource_usage(
  resource_type: 'storage',
  start_date: '2024-01-01'
)

# Run maintenance
admin_api.run_maintenance('cleanup_temp_files')
```

## Error Handling

The SDK provides custom exception classes for different error types:

```ruby
begin
  client.data.process_file('invalid.csv')
rescue Igris::Engine::ApiError => e
  puts "API Error (#{e.status_code}): #{e.message}"
rescue Igris::Engine::NetworkError => e
  puts "Network Error: #{e.message}"
rescue Igris::Engine::ConfigurationError => e
  puts "Configuration Error: #{e.message}"
rescue Igris::Engine::Error => e
  puts "General Error: #{e.message}"
end
```

### Error Types

- `Igris::Engine::Error` - Base error class
- `Igris::Engine::ApiError` - API returned an error (includes status code)
- `Igris::Engine::NetworkError` - Network or connection error
- `Igris::Engine::ConfigurationError` - Client configuration error

## Response Types

The SDK includes typed response classes for better IDE support:

```ruby
# Data processing
result = client.data.process_file('data.csv')
# Returns: Hash with job_id, status, etc.

# ML training
training = client.ml.train_pipeline(pipeline_id)
# Returns: Hash with job_id, pipeline_id, status, etc.

# Model info
model = client.ml.get_model(model_id)
# Returns: Hash with model_id, name, metrics, etc.

# User profile
profile = client.users.get_profile
# Returns: Hash with user_id, email, name, role, etc.

# File upload
upload = client.storage.upload_file('file.txt')
# Returns: Hash with file_id, filename, url, size, etc.
```

All response types inherit from `BaseResponse` and provide attribute accessors for all fields returned by the API.

## Advanced Usage

### Custom Base URL

```ruby
client = Igris::Engine::Client.new(
  'api-key',
  base_url: 'https://custom.api.example.com/v1'
)
```

### Environment Variables

```ruby
ENV['IGRIS_API_KEY'] = 'your-api-key'
client = Igris::Engine::Client.from_env
```

### Pagination

Many list methods support pagination:

```ruby
page = 1
loop do
  result = client.data.list_jobs(page: page, page_size: 50)

  result['data'].each do |job|
    puts "Job: #{job['job_id']}"
  end

  break unless result['pagination'] && result['pagination']['has_next']
  page += 1
end
```

## Contributing

Contributions are welcome! Please see CONTRIBUTING.md for details.

## License

MIT License - see LICENSE file for details.