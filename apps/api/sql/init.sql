-- Schlep-engine AI-Powered Data Intelligence Database Schema
-- Production-ready database setup for MVP launch

-- Create database if not exists (handled by Docker)
-- CREATE DATABASE IF NOT EXISTS Schlep-engine;

-- Use the database
-- \c Schlep-engine;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- USER MANAGEMENT TABLES
-- =============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    subscription_tier VARCHAR(50) DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP WITH TIME ZONE
);

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_used TIMESTAMP WITH TIME ZONE,
    usage_count INTEGER DEFAULT 0,
    rate_limit_tier VARCHAR(50) DEFAULT 'basic',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- DATA PROCESSING TABLES
-- =============================================================================

-- Processing jobs table
CREATE TABLE IF NOT EXISTS processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_id UUID NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT,
    file_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Analysis results table
CREATE TABLE IF NOT EXISTS analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES processing_jobs(id) ON DELETE CASCADE,
    quality_score DECIMAL(5,2),
    completeness_score DECIMAL(5,2),
    uniqueness_score DECIMAL(5,2),
    consistency_score DECIMAL(5,2),
    validity_score DECIMAL(5,2),
    anomaly_count INTEGER DEFAULT 0,
    duplicate_count INTEGER DEFAULT 0,
    missing_values_count INTEGER DEFAULT 0,
    total_rows INTEGER,
    total_columns INTEGER,
    insights JSONB,
    suggestions JSONB,
    anomalies JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- File metadata table
CREATE TABLE IF NOT EXISTS file_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES processing_jobs(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    content_type VARCHAR(100),
    encoding VARCHAR(50),
    delimiter VARCHAR(10),
    has_header BOOLEAN DEFAULT true,
    preview_data JSONB,
    schema_info JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- RATE LIMITING AND USAGE TRACKING
-- =============================================================================

-- Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identifier VARCHAR(255) NOT NULL, -- user_id, ip_address, or api_key
    identifier_type VARCHAR(50) NOT NULL, -- 'user', 'ip', 'api_key'
    endpoint VARCHAR(255),
    requests_count INTEGER DEFAULT 0,
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_end TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(identifier, identifier_type, endpoint, window_start)
);

-- Usage statistics table
CREATE TABLE IF NOT EXISTS usage_statistics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    files_processed INTEGER DEFAULT 0,
    data_analyzed_mb DECIMAL(10,2) DEFAULT 0,
    api_requests INTEGER DEFAULT 0,
    processing_time_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

-- =============================================================================
-- AUDIT AND SECURITY TABLES
-- =============================================================================

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    request_data JSONB,
    response_data JSONB,
    status_code INTEGER,
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Security events table
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    source_ip INET,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    description TEXT,
    metadata JSONB,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- API key indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);

-- Session indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Processing job indexes
CREATE INDEX IF NOT EXISTS idx_processing_jobs_user_id ON processing_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_created_at ON processing_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_file_id ON processing_jobs(file_id);

-- Analysis result indexes
CREATE INDEX IF NOT EXISTS idx_analysis_results_job_id ON analysis_results(job_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_quality_score ON analysis_results(quality_score);
CREATE INDEX IF NOT EXISTS idx_analysis_results_created_at ON analysis_results(created_at);

-- Rate limiting indexes
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier, identifier_type);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start, window_end);

-- Usage statistics indexes
CREATE INDEX IF NOT EXISTS idx_usage_statistics_user_id_date ON usage_statistics(user_id, date);
CREATE INDEX IF NOT EXISTS idx_usage_statistics_date ON usage_statistics(date);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address);

-- Security event indexes
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_source_ip ON security_events(source_ip);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);

-- =============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processing_jobs_updated_at BEFORE UPDATE ON processing_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- INITIAL DATA (DEFAULT ADMIN USER)
-- =============================================================================

-- Insert default admin user (password: admin123)
-- Password hash generated with bcrypt
INSERT INTO users (
    id,
    email,
    username,
    password_hash,
    first_name,
    last_name,
    is_active,
    is_verified,
    subscription_tier
) VALUES (
    uuid_generate_v4(),
    'admin@Schlep-engine.com',
    'admin',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewB5hx9YAW5hMGAS', -- admin123
    'System',
    'Administrator',
    true,
    true,
    'enterprise'
) ON CONFLICT (email) DO NOTHING;

-- Create default API key for admin (key: sk_live_admin_key_123)
INSERT INTO api_keys (
    id,
    user_id,
    key_hash,
    name,
    is_active,
    rate_limit_tier
) VALUES (
    uuid_generate_v4(),
    (SELECT id FROM users WHERE email = 'admin@Schlep-engine.com' LIMIT 1),
    encode(digest('sk_live_admin_key_123', 'sha256'), 'hex'),
    'Default Admin Key',
    true,
    'enterprise'
) ON CONFLICT (key_hash) DO NOTHING;

-- =============================================================================
-- CLEANUP AND MAINTENANCE FUNCTIONS
-- =============================================================================

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old audit logs (keep 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_logs WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old rate limit records
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM rate_limits WHERE window_end < CURRENT_TIMESTAMP - INTERVAL '1 day';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMPLETION
-- =============================================================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO Schlep-engine;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO Schlep-engine;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO Schlep-engine;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Schlep-engine database initialization completed successfully!';
    RAISE NOTICE 'Default admin user created: admin@Schlep-engine.com (password: admin123)';
    RAISE NOTICE 'Default API key created: sk_live_admin_key_123';
    RAISE NOTICE 'Database is ready for production use.';
END
$$; 