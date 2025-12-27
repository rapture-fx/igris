-- ============================================================================
-- IGRIS FLEET MANAGEMENT SCHEMA
-- ============================================================================
-- Version: 1.0.0
-- Purpose: Enable centralized fleet management for distributed Igris Runtime instances
-- ============================================================================

-- Enable UUID extension for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE: fleet_agents
-- Purpose: Track registered Igris Runtime instances
-- ============================================================================
CREATE TABLE IF NOT EXISTS fleet_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(255) UNIQUE NOT NULL,  -- Unique identifier from Runtime
    fleet_id VARCHAR(255) NOT NULL,         -- Fleet group identifier

    -- Agent metadata
    hostname VARCHAR(255),
    platform VARCHAR(50),                   -- OS: linux, darwin, windows
    version VARCHAR(50),                    -- Runtime version
    endpoint VARCHAR(255),                  -- Agent HTTP endpoint (if applicable)
    location VARCHAR(255),                  -- Optional: geographic location

    -- Agent capabilities
    capabilities JSONB,                     -- Array of capability strings
    metadata JSONB,                         -- Additional custom metadata

    -- Status tracking
    status VARCHAR(50) DEFAULT 'active',    -- active, inactive, offline, degraded
    health VARCHAR(50) DEFAULT 'unknown',   -- healthy, degraded, unhealthy, unknown
    last_seen TIMESTAMP DEFAULT NOW(),

    -- Configuration tracking
    config_version BIGINT DEFAULT 0,        -- Current config version assigned
    assigned_role VARCHAR(100),             -- Optional: assigned role/purpose

    -- Audit timestamps
    registered_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_fleet_agents_agent_id
    ON fleet_agents(agent_id);

CREATE INDEX IF NOT EXISTS idx_fleet_agents_fleet_id
    ON fleet_agents(fleet_id);

CREATE INDEX IF NOT EXISTS idx_fleet_agents_status
    ON fleet_agents(status, last_seen DESC);

CREATE INDEX IF NOT EXISTS idx_fleet_agents_health
    ON fleet_agents(health) WHERE health IN ('degraded', 'unhealthy');

-- GIN index for capabilities queries
CREATE INDEX IF NOT EXISTS idx_fleet_agents_capabilities
    ON fleet_agents USING GIN (capabilities);

-- ============================================================================
-- TABLE: fleet_configs
-- Purpose: Store fleet-wide and per-agent configurations
-- ============================================================================
CREATE TABLE IF NOT EXISTS fleet_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fleet_id VARCHAR(255),                  -- NULL = global default
    agent_id VARCHAR(255),                  -- NULL = applies to all in fleet

    -- Config versioning
    version BIGINT NOT NULL,
    config_data JSONB NOT NULL,             -- Full configuration as JSON

    -- Metadata
    description TEXT,
    requires_restart BOOLEAN DEFAULT FALSE,

    -- Audit
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255),

    -- Ensure unique version per fleet/agent combination
    UNIQUE(fleet_id, agent_id, version)
);

-- Indexes for config lookups
CREATE INDEX IF NOT EXISTS idx_fleet_configs_fleet
    ON fleet_configs(fleet_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_fleet_configs_agent
    ON fleet_configs(agent_id, version DESC);

-- ============================================================================
-- TABLE: fleet_telemetry
-- Purpose: Store telemetry data from fleet agents
-- ============================================================================
CREATE TABLE IF NOT EXISTS fleet_telemetry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(255) NOT NULL,
    fleet_id VARCHAR(255),

    -- Timestamp
    timestamp TIMESTAMP DEFAULT NOW(),
    received_at TIMESTAMP DEFAULT NOW(),

    -- Health metrics
    health_status VARCHAR(50),              -- healthy, degraded, unhealthy
    uptime_secs BIGINT,
    cpu_usage_percent DECIMAL(5, 2),
    memory_usage_mb BIGINT,
    active_tasks INTEGER,

    -- Performance metrics
    metrics JSONB,                          -- Custom metrics map

    -- Logs (optional)
    logs JSONB,                             -- Array of log entries

    -- Foreign key
    CONSTRAINT fk_agent FOREIGN KEY (agent_id)
        REFERENCES fleet_agents(agent_id) ON DELETE CASCADE
);

-- Indexes for telemetry queries
CREATE INDEX IF NOT EXISTS idx_fleet_telemetry_agent
    ON fleet_telemetry(agent_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_fleet_telemetry_fleet
    ON fleet_telemetry(fleet_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_fleet_telemetry_health
    ON fleet_telemetry(health_status, timestamp DESC)
    WHERE health_status IN ('degraded', 'unhealthy');

-- GIN index for metrics queries
CREATE INDEX IF NOT EXISTS idx_fleet_telemetry_metrics
    ON fleet_telemetry USING GIN (metrics);

-- ============================================================================
-- TABLE: fleet_events
-- Purpose: Audit trail for fleet management events
-- ============================================================================
CREATE TABLE IF NOT EXISTS fleet_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(255),
    fleet_id VARCHAR(255),

    -- Event classification
    event_type VARCHAR(50) NOT NULL,        -- registration, heartbeat, config_sync,
                                            -- status_change, error, etc.
    severity VARCHAR(20) NOT NULL,          -- info, warning, error, critical

    -- Event details
    message TEXT,
    metadata JSONB,

    -- Error tracking
    error_message TEXT,

    -- Timestamp
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Indexes for event queries
CREATE INDEX IF NOT EXISTS idx_fleet_events_agent
    ON fleet_events(agent_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_fleet_events_fleet
    ON fleet_events(fleet_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_fleet_events_type
    ON fleet_events(event_type, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_fleet_events_severity
    ON fleet_events(severity, timestamp DESC)
    WHERE severity IN ('error', 'critical');

-- ============================================================================
-- VIEWS: Fleet monitoring and reporting
-- ============================================================================

-- View: Fleet health overview
CREATE OR REPLACE VIEW v_fleet_health AS
SELECT
    fleet_id,
    COUNT(*) AS total_agents,
    COUNT(*) FILTER (WHERE status = 'active') AS active_agents,
    COUNT(*) FILTER (WHERE health = 'healthy') AS healthy_agents,
    COUNT(*) FILTER (WHERE health = 'degraded') AS degraded_agents,
    COUNT(*) FILTER (WHERE health = 'unhealthy') AS unhealthy_agents,
    COUNT(*) FILTER (WHERE last_seen < NOW() - INTERVAL '5 minutes') AS offline_agents,
    MAX(last_seen) AS last_agent_seen,
    MIN(registered_at) AS oldest_agent_registered
FROM fleet_agents
GROUP BY fleet_id;

-- View: Recent agent telemetry (last 24 hours)
CREATE OR REPLACE VIEW v_recent_telemetry AS
SELECT
    t.agent_id,
    a.fleet_id,
    a.hostname,
    t.health_status,
    t.cpu_usage_percent,
    t.memory_usage_mb,
    t.active_tasks,
    t.timestamp,
    a.last_seen,
    a.status
FROM fleet_telemetry t
JOIN fleet_agents a ON t.agent_id = a.agent_id
WHERE t.timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY t.timestamp DESC;

-- View: Fleet events summary (last 24 hours)
CREATE OR REPLACE VIEW v_recent_fleet_events AS
SELECT
    fleet_id,
    event_type,
    severity,
    COUNT(*) AS event_count,
    MAX(timestamp) AS last_occurrence,
    array_agg(DISTINCT agent_id ORDER BY agent_id) AS affected_agents
FROM fleet_events
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY fleet_id, event_type, severity
ORDER BY last_occurrence DESC;

-- ============================================================================
-- FUNCTIONS: Fleet management operations
-- ============================================================================

-- Function: Register or update fleet agent
CREATE OR REPLACE FUNCTION register_fleet_agent(
    p_agent_id VARCHAR(255),
    p_hostname VARCHAR(255),
    p_platform VARCHAR(50),
    p_version VARCHAR(50),
    p_capabilities JSONB,
    p_location VARCHAR(255) DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS TABLE(fleet_id VARCHAR, config_version BIGINT) AS $$
DECLARE
    v_fleet_id VARCHAR(255);
    v_config_version BIGINT;
BEGIN
    -- Generate fleet_id from agent_id (simple grouping: first 8 chars)
    -- In production, this could be more sophisticated
    v_fleet_id := 'fleet-default';

    -- Insert or update agent
    INSERT INTO fleet_agents (
        agent_id, fleet_id, hostname, platform, version,
        capabilities, location, metadata, status, health, last_seen
    ) VALUES (
        p_agent_id, v_fleet_id, p_hostname, p_platform, p_version,
        p_capabilities, p_location, p_metadata, 'active', 'healthy', NOW()
    )
    ON CONFLICT (agent_id) DO UPDATE SET
        hostname = EXCLUDED.hostname,
        platform = EXCLUDED.platform,
        version = EXCLUDED.version,
        capabilities = EXCLUDED.capabilities,
        location = EXCLUDED.location,
        metadata = EXCLUDED.metadata,
        status = 'active',
        last_seen = NOW(),
        updated_at = NOW();

    -- Get latest config version for this fleet
    SELECT COALESCE(MAX(fc.version), 0) INTO v_config_version
    FROM fleet_configs fc
    WHERE fc.fleet_id = v_fleet_id OR fc.fleet_id IS NULL;

    -- Update agent's config version
    UPDATE fleet_agents
    SET config_version = v_config_version
    WHERE agent_id = p_agent_id;

    -- Log registration event
    INSERT INTO fleet_events (agent_id, fleet_id, event_type, severity, message)
    VALUES (p_agent_id, v_fleet_id, 'registration', 'info', 'Agent registered successfully');

    RETURN QUERY SELECT v_fleet_id, v_config_version;
END;
$$ LANGUAGE plpgsql;

-- Function: Update agent heartbeat
CREATE OR REPLACE FUNCTION update_agent_heartbeat(
    p_agent_id VARCHAR(255),
    p_health VARCHAR(50),
    p_uptime_secs BIGINT,
    p_cpu_usage DECIMAL(5, 2),
    p_memory_usage_mb BIGINT,
    p_active_tasks INTEGER
) RETURNS VOID AS $$
BEGIN
    -- Update last_seen and health status
    UPDATE fleet_agents
    SET last_seen = NOW(),
        health = p_health,
        status = 'active',
        updated_at = NOW()
    WHERE agent_id = p_agent_id;

    -- If agent not found, log warning event
    IF NOT FOUND THEN
        INSERT INTO fleet_events (agent_id, event_type, severity, message)
        VALUES (p_agent_id, 'heartbeat', 'warning', 'Heartbeat from unregistered agent');
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: Record telemetry data
CREATE OR REPLACE FUNCTION record_fleet_telemetry(
    p_agent_id VARCHAR(255),
    p_health VARCHAR(50),
    p_uptime_secs BIGINT,
    p_cpu_usage DECIMAL(5, 2),
    p_memory_usage_mb BIGINT,
    p_active_tasks INTEGER,
    p_metrics JSONB DEFAULT NULL,
    p_logs JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_telemetry_id UUID;
    v_fleet_id VARCHAR(255);
BEGIN
    -- Get fleet_id for this agent
    SELECT fleet_id INTO v_fleet_id
    FROM fleet_agents
    WHERE agent_id = p_agent_id;

    -- Insert telemetry record
    INSERT INTO fleet_telemetry (
        agent_id, fleet_id, health_status, uptime_secs,
        cpu_usage_percent, memory_usage_mb, active_tasks,
        metrics, logs
    ) VALUES (
        p_agent_id, v_fleet_id, p_health, p_uptime_secs,
        p_cpu_usage, p_memory_usage_mb, p_active_tasks,
        p_metrics, p_logs
    ) RETURNING id INTO v_telemetry_id;

    -- Update agent heartbeat
    PERFORM update_agent_heartbeat(
        p_agent_id, p_health, p_uptime_secs,
        p_cpu_usage, p_memory_usage_mb, p_active_tasks
    );

    RETURN v_telemetry_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Get latest config for agent
CREATE OR REPLACE FUNCTION get_agent_config(
    p_agent_id VARCHAR(255)
) RETURNS TABLE(version BIGINT, config_data JSONB, requires_restart BOOLEAN) AS $$
DECLARE
    v_fleet_id VARCHAR(255);
BEGIN
    -- Get fleet_id for this agent
    SELECT fleet_id INTO v_fleet_id
    FROM fleet_agents
    WHERE agent_id = p_agent_id;

    IF v_fleet_id IS NULL THEN
        RAISE EXCEPTION 'Agent not found: %', p_agent_id;
    END IF;

    -- Return agent-specific config if exists, otherwise fleet config, otherwise global
    RETURN QUERY
    SELECT fc.version, fc.config_data, fc.requires_restart
    FROM fleet_configs fc
    WHERE (fc.agent_id = p_agent_id OR fc.fleet_id = v_fleet_id OR fc.fleet_id IS NULL)
    ORDER BY
        CASE
            WHEN fc.agent_id = p_agent_id THEN 1
            WHEN fc.fleet_id = v_fleet_id THEN 2
            ELSE 3
        END,
        fc.version DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS: Automatic timestamp updates
-- ============================================================================

CREATE OR REPLACE FUNCTION update_fleet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fleet_agents_updated_at
    BEFORE UPDATE ON fleet_agents
    FOR EACH ROW
    EXECUTE FUNCTION update_fleet_updated_at();

-- ============================================================================
-- DATA: Default fleet configuration
-- ============================================================================

-- Insert default global configuration
INSERT INTO fleet_configs (fleet_id, agent_id, version, config_data, description, requires_restart)
VALUES (
    NULL,
    NULL,
    1,
    '{"model": "gpt-4o-mini", "temperature": 0.7, "max_tokens": 1000}'::jsonb,
    'Default global configuration for all agents',
    false
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMMENTS: Documentation
-- ============================================================================

COMMENT ON TABLE fleet_agents IS 'Registry of all Igris Runtime instances in the fleet';
COMMENT ON TABLE fleet_configs IS 'Configuration versions for fleet management';
COMMENT ON TABLE fleet_telemetry IS 'Telemetry data collected from fleet agents';
COMMENT ON TABLE fleet_events IS 'Audit trail for fleet management operations';

COMMENT ON FUNCTION register_fleet_agent IS 'Register or update a fleet agent and return fleet_id and config_version';
COMMENT ON FUNCTION update_agent_heartbeat IS 'Update agent last_seen timestamp and health status';
COMMENT ON FUNCTION record_fleet_telemetry IS 'Record telemetry data from an agent';
COMMENT ON FUNCTION get_agent_config IS 'Retrieve the latest configuration for an agent';

-- ============================================================================
-- END OF FLEET MANAGEMENT SCHEMA
-- ============================================================================
