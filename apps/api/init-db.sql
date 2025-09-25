-- Schlep Engine Database Initialization
-- Creates initial database structure and data

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create initial user and database (if not exists)
-- Note: This will only run if the database doesn't exist
-- The main database setup is handled by environment variables

-- Create application schema
CREATE SCHEMA IF NOT EXISTS app_data;

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA app_data TO CURRENT_USER;

-- Create a simple test table to verify connection
CREATE TABLE IF NOT EXISTS app_data.health_check (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'healthy'
);

-- Insert initial health check record
INSERT INTO app_data.health_check (status) VALUES ('initial_setup')
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_health_check_timestamp
ON app_data.health_check(timestamp);

-- Create a simple metrics table for monitoring
CREATE TABLE IF NOT EXISTS app_data.app_metrics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    labels JSONB
);

-- Create index for metrics querying
CREATE INDEX IF NOT EXISTS idx_metrics_name_timestamp
ON app_data.app_metrics(metric_name, timestamp);

-- Log successful initialization
INSERT INTO app_data.health_check (status) VALUES ('database_initialized');