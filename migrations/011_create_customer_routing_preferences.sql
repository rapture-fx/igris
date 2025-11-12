-- Migration: Create customer routing preferences tables
-- Description: Add tables to store customer routing optimization preferences

-- Create customer_routing_preferences table
CREATE TABLE IF NOT EXISTS customer_routing_preferences (
    tenant_id UUID PRIMARY KEY,
    optimization_mode VARCHAR(20) NOT NULL DEFAULT 'balanced',

    -- Custom weights (nullable, only used if mode = 'custom')
    latency_weight DECIMAL(4,3) CHECK (latency_weight >= 0 AND latency_weight <= 1),
    quality_weight DECIMAL(4,3) CHECK (quality_weight >= 0 AND quality_weight <= 1),
    cost_weight DECIMAL(4,3) CHECK (cost_weight >= 0 AND cost_weight <= 1),

    -- Constraints
    max_cost_per_request DECIMAL(10,6) CHECK (max_cost_per_request >= 0),
    min_quality_score DECIMAL(4,3) CHECK (min_quality_score >= 0 AND min_quality_score <= 1),
    max_latency_ms INTEGER CHECK (max_latency_ms >= 0),

    -- Domain-specific preferences stored as JSONB
    domain_preferences JSONB DEFAULT '{}',

    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_optimization_mode CHECK (
        optimization_mode IN ('cost', 'balanced', 'quality', 'custom')
    ),
    CONSTRAINT custom_weights_check CHECK (
        (optimization_mode != 'custom') OR
        (latency_weight IS NOT NULL AND quality_weight IS NOT NULL AND cost_weight IS NOT NULL)
    ),
    CONSTRAINT weights_sum_check CHECK (
        (optimization_mode != 'custom') OR
        (latency_weight + quality_weight + cost_weight <= 1.0)
    )
);

-- Create index on optimization_mode for filtering
CREATE INDEX IF NOT EXISTS idx_routing_prefs_mode ON customer_routing_preferences(optimization_mode);

-- Create index on tenant_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_routing_prefs_tenant ON customer_routing_preferences(tenant_id);

-- Create index on JSONB domain_preferences for efficient querying
CREATE INDEX IF NOT EXISTS idx_routing_prefs_domain_preferences ON customer_routing_preferences USING GIN(domain_preferences);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_routing_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_routing_preferences_updated_at
    BEFORE UPDATE ON customer_routing_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_routing_preferences_updated_at();

-- Insert default preferences for existing tenants (if tenants table exists)
-- This is optional and can be run separately if needed
-- INSERT INTO customer_routing_preferences (tenant_id, optimization_mode)
-- SELECT id, 'balanced'
-- FROM tenants
-- WHERE NOT EXISTS (
--     SELECT 1 FROM customer_routing_preferences WHERE tenant_id = tenants.id
-- );

-- Comments for documentation
COMMENT ON TABLE customer_routing_preferences IS 'Stores routing optimization preferences for each tenant';
COMMENT ON COLUMN customer_routing_preferences.optimization_mode IS 'Routing optimization strategy: cost, balanced, quality, or custom';
COMMENT ON COLUMN customer_routing_preferences.latency_weight IS 'Weight for latency optimization (0.0-1.0, only for custom mode)';
COMMENT ON COLUMN customer_routing_preferences.quality_weight IS 'Weight for quality optimization (0.0-1.0, only for custom mode)';
COMMENT ON COLUMN customer_routing_preferences.cost_weight IS 'Weight for cost optimization (0.0-1.0, only for custom mode)';
COMMENT ON COLUMN customer_routing_preferences.domain_preferences IS 'Domain-specific routing preferences as JSONB (e.g., {"code": {"quality_weight": 0.5, "cost_weight": 0.2}})';
