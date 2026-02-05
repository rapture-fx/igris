-- ============================================================================
-- IGRIS LICENSE SYSTEM: DATABASE SCHEMA
-- ============================================================================
-- Version: 1.0.0
-- Purpose: Enable license-based access control for igris-runtime with
--          device tracking and tier enforcement
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE: licenses
-- Purpose: Store software licenses for igris-runtime
-- ============================================================================
CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_key VARCHAR(64) UNIQUE NOT NULL,
    tier VARCHAR(20) NOT NULL, -- seed, horizon, infinite, enterprise
    customer_email VARCHAR(255) NOT NULL,
    customer_id UUID,
    devices_limit INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL, -- active, suspended, expired
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP,
    metadata JSONB
);

-- Indexes for licenses table
CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_customer ON licenses(customer_email);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status) WHERE status = 'active';

-- ============================================================================
-- TABLE: devices
-- Purpose: Track devices registered under each license
-- ============================================================================
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    device_id VARCHAR(128) UNIQUE NOT NULL,
    hostname VARCHAR(255),
    platform VARCHAR(64),
    runtime_version VARCHAR(32),
    first_seen TIMESTAMP NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, inactive
    metadata JSONB
);

-- Indexes for devices table
CREATE INDEX IF NOT EXISTS idx_devices_license ON devices(license_id);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(license_id, status) WHERE status = 'active';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to count active devices for a license
CREATE OR REPLACE FUNCTION count_active_devices(p_license_id UUID)
RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER
    FROM devices
    WHERE license_id = p_license_id
    AND status = 'active'
    AND last_seen > NOW() - INTERVAL '1 hour';
$$ LANGUAGE SQL;

-- Function to mark devices inactive if they haven't sent a heartbeat
CREATE OR REPLACE FUNCTION mark_inactive_devices()
RETURNS INTEGER AS $$
    UPDATE devices
    SET status = 'inactive'
    WHERE status = 'active'
    AND last_seen < NOW() - INTERVAL '1 hour'
    RETURNING 1;
$$ LANGUAGE SQL;

-- ============================================================================
-- SAMPLE DATA (for development)
-- ============================================================================

-- Insert a free tier license for testing
INSERT INTO licenses (license_key, tier, customer_email, devices_limit, status)
VALUES ('lic_seed_dev123456_abc1', 'seed', 'dev@example.com', 1, 'active')
ON CONFLICT (license_key) DO NOTHING;

-- Insert a horizon tier license for testing
INSERT INTO licenses (license_key, tier, customer_email, devices_limit, status)
VALUES ('lic_horizon_test7890_def2', 'horizon', 'test@example.com', 50, 'active')
ON CONFLICT (license_key) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE licenses IS 'Software licenses for igris-runtime with tier-based access control';
COMMENT ON TABLE devices IS 'Devices registered under each license for tracking and enforcement';
COMMENT ON COLUMN licenses.tier IS 'License tier: seed (free, 1 device), horizon ($149/mo, 50 devices), infinite ($399/mo, 250 devices), enterprise (custom)';
COMMENT ON COLUMN devices.status IS 'Device status: active (heartbeat within 1 hour), inactive (no recent heartbeat)';
