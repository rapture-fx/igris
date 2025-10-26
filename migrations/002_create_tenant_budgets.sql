-- Migration: 002_create_tenant_budgets
-- Purpose: Create tenant budget tracking tables for multi-tenancy
-- Phase: 2 - Multi-Tenancy
-- Date: 2025-10-25

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
    tenant_id VARCHAR(255) PRIMARY KEY,
    tenant_name VARCHAR(255) NOT NULL,
    tenant_email VARCHAR(255),

    -- Budget configuration
    monthly_budget_usd DECIMAL(10, 2) NOT NULL DEFAULT 100.00,
    budget_reset_day INTEGER NOT NULL DEFAULT 1, -- Day of month (1-28)

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    suspended_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_budget CHECK (monthly_budget_usd >= 0),
    CONSTRAINT valid_reset_day CHECK (budget_reset_day BETWEEN 1 AND 28)
);

-- Create tenant_budget_usage table for tracking spend
CREATE TABLE IF NOT EXISTS tenant_budget_usage (
    usage_id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    -- Billing period
    billing_month DATE NOT NULL, -- First day of the billing month

    -- Usage tracking
    total_requests BIGINT NOT NULL DEFAULT 0,
    total_tokens BIGINT NOT NULL DEFAULT 0,
    total_cost_usd DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,

    -- Provider breakdown
    provider_usage JSONB NOT NULL DEFAULT '{}', -- {"openai": {"requests": 100, "cost": 5.0}, ...}

    -- Model breakdown
    model_usage JSONB NOT NULL DEFAULT '{}', -- {"gpt-4": {"requests": 50, "cost": 4.0}, ...}

    -- Last update
    last_request_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE(tenant_id, billing_month)
);

-- Create tenant_request_log table for detailed audit trail
CREATE TABLE IF NOT EXISTS tenant_request_log (
    log_id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    -- Request details
    request_id VARCHAR(255) NOT NULL,
    trace_id VARCHAR(255),

    -- Provider and model
    provider VARCHAR(100) NOT NULL,
    model VARCHAR(255) NOT NULL,

    -- Cost and tokens
    cost_usd DECIMAL(10, 6) NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_tokens INTEGER,

    -- Request metadata
    status VARCHAR(50) NOT NULL, -- "success", "error", "budget_exceeded"
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('success', 'error', 'budget_exceeded', 'rate_limited'))
);

-- Indexes for tenants
CREATE INDEX idx_tenants_active ON tenants(is_active) WHERE is_active = true;
CREATE INDEX idx_tenants_created ON tenants(created_at DESC);

-- Indexes for tenant_budget_usage
CREATE INDEX idx_budget_usage_tenant ON tenant_budget_usage(tenant_id);
CREATE INDEX idx_budget_usage_month ON tenant_budget_usage(billing_month DESC);
CREATE INDEX idx_budget_usage_composite ON tenant_budget_usage(tenant_id, billing_month DESC);

-- GIN indexes for JSONB columns
CREATE INDEX idx_budget_usage_provider ON tenant_budget_usage USING GIN (provider_usage);
CREATE INDEX idx_budget_usage_model ON tenant_budget_usage USING GIN (model_usage);

-- Indexes for tenant_request_log
CREATE INDEX idx_request_log_tenant ON tenant_request_log(tenant_id);
CREATE INDEX idx_request_log_created ON tenant_request_log(created_at DESC);
CREATE INDEX idx_request_log_request_id ON tenant_request_log(request_id);
CREATE INDEX idx_request_log_trace_id ON tenant_request_log(trace_id);
CREATE INDEX idx_request_log_composite ON tenant_request_log(tenant_id, created_at DESC);
CREATE INDEX idx_request_log_status ON tenant_request_log(status);

-- Add comments
COMMENT ON TABLE tenants IS 'Multi-tenant configuration and budget limits';
COMMENT ON TABLE tenant_budget_usage IS 'Monthly budget usage aggregation per tenant';
COMMENT ON TABLE tenant_request_log IS 'Detailed audit log of all tenant requests';

COMMENT ON COLUMN tenants.budget_reset_day IS 'Day of month when budget resets (1-28 to handle all months)';
COMMENT ON COLUMN tenant_budget_usage.provider_usage IS 'JSONB object with per-provider request counts and costs';
COMMENT ON COLUMN tenant_budget_usage.model_usage IS 'JSONB object with per-model request counts and costs';

-- Trigger to automatically update updated_at for tenants
CREATE OR REPLACE FUNCTION update_tenants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_tenants_updated_at();

-- Trigger to automatically update updated_at for tenant_budget_usage
CREATE OR REPLACE FUNCTION update_budget_usage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_budget_usage_updated_at
    BEFORE UPDATE ON tenant_budget_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_budget_usage_updated_at();

-- Insert default tenant for backward compatibility
INSERT INTO tenants (tenant_id, tenant_name, monthly_budget_usd, is_active)
VALUES ('default', 'Default Tenant', 100.00, true)
ON CONFLICT (tenant_id) DO NOTHING;
