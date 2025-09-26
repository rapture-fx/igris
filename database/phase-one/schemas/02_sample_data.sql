-- Sample data for development and testing
-- This demonstrates the schema usage patterns

-- Sample organizations
INSERT INTO organizations (id, name, slug, plan_type, max_users, max_tasks_per_month, settings) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Acme Corp', 'acme-corp', 'business', 50, 10000, '{"features": ["advanced_analytics", "priority_support"], "billing_email": "billing@acme.com"}'),
('550e8400-e29b-41d4-a716-446655440001', 'Startup Inc', 'startup-inc', 'startup', 10, 5000, '{"features": ["basic_analytics"], "trial_expires": "2024-12-31"}'),
('550e8400-e29b-41d4-a716-446655440002', 'Demo Organization', 'demo-org', 'free', 5, 1000, '{}');

-- Sample users
INSERT INTO users (id, organization_id, email, full_name, role, oauth_providers, preferences, timezone, email_verified_at) VALUES
-- Acme Corp users
('660e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', 'admin@acme.com', 'Alice Administrator', 'admin',
 '[{"provider": "google", "provider_id": "google123"}]',
 '{"theme": "dark", "notifications": {"email": true, "in_app": true}}',
 'America/New_York', NOW()),

('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'dev@acme.com', 'Bob Developer', 'user',
 '[{"provider": "github", "provider_id": "github456"}]',
 '{"theme": "light", "preferred_runtime": "python"}',
 'America/Los_Angeles', NOW()),

-- Startup Inc users
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'founder@startup.com', 'Charlie Founder', 'admin',
 '[]',
 '{"theme": "auto", "dashboard_layout": "compact"}',
 'UTC', NOW()),

-- Demo org user
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', 'demo@example.com', 'Demo User', 'user',
 '[]',
 '{}',
 'UTC', NOW());

-- Sample API keys (hashed for security)
INSERT INTO api_keys (id, organization_id, user_id, key_hash, name, description, scopes, rate_limit_rpm) VALUES
('770e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000',
 '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LEGvrt9BcOSzL8Xmu', -- hashed version of 'dev-api-key-123'
 'Development API Key', 'Key for local development and testing',
 '["tasks:read", "tasks:write", "executions:read"]', 5000),

('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440002',
 '$2b$12$3h5v8j2kBwVHxkd0LHAkCOYz6TtxMQJqhN8/LEGvrt9BcOSzL8Abc', -- hashed version of 'startup-prod-key-456'
 'Production API Key', 'Key for production integration',
 '["tasks:read", "tasks:write", "executions:read", "executions:write"]', 2000);

-- Sample task definitions
INSERT INTO task_definitions (id, organization_id, name, slug, description, version, runtime_config, resource_limits, code_location, dependencies, environment_vars, tags, created_by) VALUES
('880e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000',
 'Data Processing Pipeline', 'data-processing',
 'Processes incoming data files and generates analytics reports',
 '1.2.0',
 '{"runtime": "python3.11", "framework": "asyncio", "worker_type": "cpu_bound"}',
 '{"cpu": 2, "memory": "1GB", "timeout": 900, "max_concurrent": 5}',
 's3://schlep-tasks/acme-corp/data-processing-v1.2.0.zip',
 '["pandas>=2.0.0", "numpy>=1.24.0", "asyncio-mqtt>=0.13.0"]',
 '{"DATA_SOURCE_URL": "${DATA_SOURCE_URL}", "OUTPUT_FORMAT": "json", "LOG_LEVEL": "INFO"}',
 '["analytics", "etl", "production"]',
 '660e8400-e29b-41d4-a716-446655440000'),

('880e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000',
 'Email Notification Service', 'email-notifications',
 'Sends customized email notifications based on user preferences',
 '2.1.0',
 '{"runtime": "python3.11", "framework": "fastapi", "worker_type": "io_bound"}',
 '{"cpu": 1, "memory": "256MB", "timeout": 120, "max_concurrent": 20}',
 's3://schlep-tasks/acme-corp/email-service-v2.1.0.zip',
 '["fastapi>=0.104.0", "jinja2>=3.1.0", "sendgrid>=6.10.0"]',
 '{"SENDGRID_API_KEY": "${SENDGRID_API_KEY}", "FROM_EMAIL": "notifications@acme.com"}',
 '["notifications", "email", "production"]',
 '660e8400-e29b-41d4-a716-446655440000'),

('880e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001',
 'Simple Log Processor', 'log-processor',
 'Basic log processing and filtering for startup workloads',
 '1.0.0',
 '{"runtime": "python3.11", "framework": "asyncio", "worker_type": "cpu_bound"}',
 '{"cpu": 1, "memory": "512MB", "timeout": 300, "max_concurrent": 3}',
 's3://schlep-tasks/startup-inc/log-processor-v1.0.0.zip',
 '["asyncio>=3.4.3", "regex>=2023.0.0"]',
 '{"LOG_LEVEL": "DEBUG", "OUTPUT_FORMAT": "jsonl"}',
 '["logs", "processing", "development"]',
 '660e8400-e29b-41d4-a716-446655440002');

-- Sample task executions (showing different states)
INSERT INTO task_executions (id, task_definition_id, organization_id, triggered_by, status, priority, input_data, output_data, resource_usage, scheduled_at, started_at, completed_at, execution_context) VALUES
-- Completed execution
('990e8400-e29b-41d4-a716-446655440000', '880e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000',
 '660e8400-e29b-41d4-a716-446655440001', 'completed', 'normal',
 '{"input_file": "s3://data-bucket/2024/01/15/raw-data.csv", "processing_mode": "full"}',
 '{"output_file": "s3://results-bucket/2024/01/15/processed-data.json", "records_processed": 15420, "execution_time": 145.2}',
 '{"cpu_usage": "75%", "memory_peak": "650MB", "execution_time_seconds": 145.2}',
 NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours' + INTERVAL '145 seconds',
 '{"worker_id": "worker-001", "runtime_version": "python3.11.7", "hostname": "schlep-worker-1a2b3c"}'),

-- Currently running execution
('990e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000',
 '660e8400-e29b-41d4-a716-446655440000', 'running', 'high',
 '{"recipients": ["user1@acme.com", "user2@acme.com"], "template": "weekly_report", "data": {"report_date": "2024-01-15"}}',
 '{}',
 '{"cpu_usage": "25%", "memory_current": "128MB"}',
 NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '4 minutes', NULL,
 '{"worker_id": "worker-002", "runtime_version": "python3.11.7", "hostname": "schlep-worker-4d5e6f"}'),

-- Failed execution with retry
('990e8400-e29b-41d4-a716-446655440002', '880e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001',
 '660e8400-e29b-41d4-a716-446655440002', 'failed', 'normal',
 '{"log_source": "s3://logs-bucket/app-logs/2024-01-15/", "filter_pattern": "ERROR|WARN"}',
 '{}',
 '{"cpu_usage": "15%", "memory_peak": "200MB", "execution_time_seconds": 45.7}',
 NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '29 minutes', NOW() - INTERVAL '28 minutes',
 '{"worker_id": "worker-003", "error": "Connection timeout to log source", "retry_count": 2, "max_retries": 3}'),

-- Pending execution (queued)
('990e8400-e29b-41d4-a716-446655440003', '880e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000',
 NULL, 'pending', 'low', -- System triggered (scheduled)
 '{"input_file": "s3://data-bucket/2024/01/16/raw-data.csv", "processing_mode": "incremental"}',
 '{}', '{}',
 NOW() + INTERVAL '1 hour', NULL, NULL,
 '{"scheduled_by": "cron", "schedule_expression": "0 */4 * * *"}');

-- Sample sessions (demonstrating Redis-style session storage)
INSERT INTO sessions (id, session_key, user_id, data, expires_at, ip_address, user_agent) VALUES
('aa0e8400-e29b-41d4-a716-446655440000', 'sess:550e8400-e29b-41d4-a716-446655440000:1705123456',
 '660e8400-e29b-41d4-a716-446655440000',
 '{"cart_items": ["item-123", "item-456"], "current_page": "/dashboard", "preferences": {"theme": "dark"}}',
 NOW() + INTERVAL '7 days',
 '192.168.1.100',
 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'),

('aa0e8400-e29b-41d4-a716-446655440001', 'sess:660e8400-e29b-41d4-a716-446655440001:1705123500',
 '660e8400-e29b-41d4-a716-446655440001',
 '{"active_task_definition": "880e8400-e29b-41d4-a716-446655440000", "dashboard_filters": {"status": ["completed", "running"]}}',
 NOW() + INTERVAL '7 days',
 '10.0.0.50',
 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

-- Sample audit logs
INSERT INTO audit_logs (id, organization_id, user_id, event_type, resource_type, resource_id, event_data, ip_address, user_agent) VALUES
('bb0e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000',
 'user.login', 'user', '660e8400-e29b-41d4-a716-446655440000',
 '{"login_method": "oauth_google", "session_duration": 86400}',
 '192.168.1.100', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'),

('bb0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001',
 'task_definition.create', 'task_definition', '880e8400-e29b-41d4-a716-446655440000',
 '{"task_name": "Data Processing Pipeline", "version": "1.2.0", "runtime": "python3.11"}',
 '10.0.0.50', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),

('bb0e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001',
 'task_execution.start', 'task_execution', '990e8400-e29b-41d4-a716-446655440000',
 '{"task_definition_id": "880e8400-e29b-41d4-a716-446655440000", "priority": "normal", "worker_assigned": "worker-001"}',
 '10.0.0.50', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),

('bb0e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440002',
 'api_key.create', 'api_key', '770e8400-e29b-41d4-a716-446655440001',
 '{"key_name": "Production API Key", "scopes": ["tasks:read", "tasks:write", "executions:read", "executions:write"]}',
 '203.0.113.195', 'curl/7.68.0');