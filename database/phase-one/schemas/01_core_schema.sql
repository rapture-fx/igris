-- Schlep Engine Phase One Database Schema
-- Optimized for PostgreSQL -> YugabyteDB migration
-- Design principles:
-- 1. Use UUID primary keys for better distribution in YugabyteDB
-- 2. Avoid SERIAL columns (use UUID or application-generated sequences)
-- 3. Design with eventual horizontal scaling in mind
-- 4. Use JSONB for flexible metadata storage
-- 5. Ensure all constraints are YugabyteDB compatible

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Custom types for domain-specific enums
CREATE TYPE user_role_type AS ENUM (
    'admin',
    'user',
    'service_account'
);

CREATE TYPE task_status_type AS ENUM (
    'pending',
    'running',
    'completed',
    'failed',
    'cancelled'
);

CREATE TYPE task_priority_type AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);

-- Organizations table (top-level tenant isolation)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,

    -- Subscription and limits
    plan_type VARCHAR(50) DEFAULT 'free',
    max_users INTEGER DEFAULT 5,
    max_tasks_per_month INTEGER DEFAULT 1000,

    -- Metadata
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Soft delete support
    deleted_at TIMESTAMPTZ NULL,

    -- Indexing for performance
    CONSTRAINT organizations_slug_check CHECK (slug ~ '^[a-z0-9-]+$')
);

-- Users table with multi-tenancy support
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Authentication
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- NULL for OAuth-only users

    -- Profile
    full_name VARCHAR(255),
    avatar_url VARCHAR(500),
    role user_role_type DEFAULT 'user',

    -- OAuth integration
    oauth_providers JSONB DEFAULT '[]', -- Store provider info

    -- Settings and preferences
    preferences JSONB DEFAULT '{}',
    timezone VARCHAR(50) DEFAULT 'UTC',

    -- Security
    last_login_at TIMESTAMPTZ,
    email_verified_at TIMESTAMPTZ,
    mfa_enabled BOOLEAN DEFAULT FALSE,

    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,

    -- Performance indexes
    CONSTRAINT users_email_check CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$')
);

-- API Keys for programmatic access
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Key management
    key_hash VARCHAR(255) NOT NULL UNIQUE, -- Store hash, not plain key
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Permissions and restrictions
    scopes JSONB DEFAULT '[]', -- Array of allowed scopes
    rate_limit_rpm INTEGER DEFAULT 1000,

    -- Lifecycle
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    usage_count BIGINT DEFAULT 0,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ NULL,

    -- Ensure reasonable key names
    CONSTRAINT api_keys_name_length CHECK (LENGTH(name) BETWEEN 1 AND 255)
);

-- Task definitions (what can be executed)
CREATE TABLE task_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Task identity
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    version VARCHAR(50) DEFAULT '1.0.0',

    -- Execution configuration
    runtime_config JSONB NOT NULL DEFAULT '{}', -- Python/Rust runtime settings
    resource_limits JSONB DEFAULT '{"cpu": 1, "memory": "512MB", "timeout": 300}',

    -- Code and dependencies
    code_location VARCHAR(500), -- S3 path or git reference
    dependencies JSONB DEFAULT '[]', -- Package dependencies
    environment_vars JSONB DEFAULT '{}', -- Environment variables template

    -- Metadata
    tags JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint per organization
    UNIQUE(organization_id, slug)
);

-- Task executions (runtime instances)
CREATE TABLE task_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_definition_id UUID NOT NULL REFERENCES task_definitions(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Execution context
    triggered_by UUID REFERENCES users(id), -- NULL for system/scheduled tasks
    parent_execution_id UUID REFERENCES task_executions(id), -- For sub-tasks

    -- Status and lifecycle
    status task_status_type DEFAULT 'pending',
    priority task_priority_type DEFAULT 'normal',

    -- Execution details
    input_data JSONB DEFAULT '{}',
    output_data JSONB DEFAULT '{}',
    error_details JSONB DEFAULT '{}',

    -- Resource usage tracking
    resource_usage JSONB DEFAULT '{}', -- CPU, memory, execution time

    -- Timeline
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,

    -- Retry logic
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    -- Metadata
    execution_context JSONB DEFAULT '{}', -- Runtime environment info
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session storage (for Redis compatibility testing)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_key VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Session data
    data JSONB DEFAULT '{}',

    -- Lifecycle
    expires_at TIMESTAMPTZ NOT NULL,
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- IP tracking for security
    ip_address INET,
    user_agent TEXT
);

-- System logs and audit trail
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    user_id UUID REFERENCES users(id),

    -- Event details
    event_type VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,

    -- Event data
    event_data JSONB DEFAULT '{}',
    changes JSONB DEFAULT '{}', -- Before/after for updates

    -- Context
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),

    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Partitioning hint for future scaling
    partition_date DATE GENERATED ALWAYS AS (created_at::date) STORED
);

-- Indexes for performance (optimized for both PostgreSQL and YugabyteDB)

-- Organizations
CREATE INDEX idx_organizations_slug ON organizations(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_created_at ON organizations(created_at);

-- Users
CREATE INDEX idx_users_organization_id ON users(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role_org ON users(organization_id, role) WHERE deleted_at IS NULL;

-- API Keys
CREATE INDEX idx_api_keys_organization_id ON api_keys(organization_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- Task Definitions
CREATE INDEX idx_task_definitions_org_slug ON task_definitions(organization_id, slug);
CREATE INDEX idx_task_definitions_active ON task_definitions(organization_id) WHERE is_active = TRUE;

-- Task Executions (most frequently queried)
CREATE INDEX idx_task_executions_org_status ON task_executions(organization_id, status);
CREATE INDEX idx_task_executions_definition_id ON task_executions(task_definition_id);
CREATE INDEX idx_task_executions_created_at ON task_executions(created_at DESC);
CREATE INDEX idx_task_executions_status_created ON task_executions(status, created_at DESC);
CREATE INDEX idx_task_executions_triggered_by ON task_executions(triggered_by) WHERE triggered_by IS NOT NULL;

-- Sessions
CREATE INDEX idx_sessions_key ON sessions(session_key);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Audit Logs (with partitioning consideration)
CREATE INDEX idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Triggers for updated_at maintenance
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_definitions_updated_at BEFORE UPDATE ON task_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE organizations IS 'Multi-tenant organization structure for user isolation';
COMMENT ON TABLE users IS 'User accounts with OAuth and MFA support';
COMMENT ON TABLE api_keys IS 'Programmatic access keys with rate limiting';
COMMENT ON TABLE task_definitions IS 'Reusable task templates with versioning';
COMMENT ON TABLE task_executions IS 'Runtime task instances with full lifecycle tracking';
COMMENT ON TABLE sessions IS 'User session storage (Redis cache alternative)';
COMMENT ON TABLE audit_logs IS 'Complete audit trail for compliance and debugging';