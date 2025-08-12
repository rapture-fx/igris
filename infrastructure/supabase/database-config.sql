-- Supabase Database Configuration for Schlep-engine
-- Optimized for ML data processing workloads

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Optimize PostgreSQL settings for ML workloads
-- Note: These are recommendations for Supabase configuration

-- Connection pooling optimization
-- shared_preload_libraries = 'pg_stat_statements'
-- max_connections = 200
-- shared_buffers = '1GB'
-- effective_cache_size = '3GB'
-- work_mem = '32MB'
-- maintenance_work_mem = '256MB'

-- ML-specific optimizations
-- random_page_cost = 1.1  -- For SSD storage
-- effective_io_concurrency = 200
-- checkpoint_completion_target = 0.9
-- wal_buffers = '16MB'
-- default_statistics_target = 100

-- Create optimized indexes for ML data processing
-- These will be applied via Alembic migrations

-- Connection pool configuration for high-concurrency ML processing
-- Recommended Supabase connection settings:
-- - Database size: Pro plan (8GB+ recommended for ML workloads)
-- - Connection limit: 500+ connections
-- - Connection pooling: Transaction mode for API requests, Session mode for ML processing

-- Performance monitoring views
CREATE OR REPLACE VIEW ml_performance_stats AS
SELECT 
    schemaname,
    tablename,
    attname as column_name,
    n_distinct,
    correlation,
    most_common_vals,
    most_common_freqs
FROM pg_stats 
WHERE schemaname = 'public' 
    AND tablename IN ('data_processing_jobs', 'ml_models', 'dataset_versions');

-- Index usage monitoring
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Connection monitoring for ML workloads
CREATE OR REPLACE VIEW connection_stats AS
SELECT 
    state,
    count(*) as connection_count,
    max(now() - query_start) as max_duration,
    avg(now() - query_start) as avg_duration
FROM pg_stat_activity 
WHERE state IS NOT NULL
GROUP BY state;

-- ML workload specific indexes (will be created via Alembic)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ml_jobs_status_created 
--     ON data_processing_jobs(status, created_at) 
--     WHERE status IN ('pending', 'processing');

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ml_models_type_version 
--     ON ml_models(model_type, version) 
--     WHERE active = true;

-- Row Level Security policies for multi-tenant ML processing
-- Note: Configure these based on your authentication requirements

-- Enable RLS on sensitive tables
-- ALTER TABLE data_processing_jobs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ml_models ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE dataset_versions ENABLE ROW LEVEL SECURITY;

-- Sample RLS policy (customize based on your auth system)
-- CREATE POLICY ml_jobs_user_access ON data_processing_jobs
--     FOR ALL USING (auth.uid() = user_id);

-- Backup and maintenance automation
-- Recommend setting up daily backups via Supabase dashboard
-- Point-in-time recovery should be enabled for production

-- Monitoring queries for Railway deployment
CREATE OR REPLACE FUNCTION get_ml_system_health()
RETURNS TABLE(
    metric_name text,
    metric_value numeric,
    status text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'active_connections'::text,
        count(*)::numeric,
        CASE WHEN count(*) < 100 THEN 'healthy' ELSE 'warning' END
    FROM pg_stat_activity 
    WHERE state = 'active'
    
    UNION ALL
    
    SELECT 
        'cache_hit_ratio'::text,
        round((sum(blks_hit) * 100.0 / nullif(sum(blks_hit + blks_read), 0))::numeric, 2),
        CASE WHEN round((sum(blks_hit) * 100.0 / nullif(sum(blks_hit + blks_read), 0))::numeric, 2) > 95 
             THEN 'healthy' ELSE 'warning' END
    FROM pg_stat_database
    
    UNION ALL
    
    SELECT 
        'ml_jobs_pending'::text,
        count(*)::numeric,
        CASE WHEN count(*) < 50 THEN 'healthy' ELSE 'warning' END
    FROM data_processing_jobs 
    WHERE status = 'pending';
END;
$$ LANGUAGE plpgsql;

-- Create materialized view for dashboard analytics
-- Will be refreshed periodically by background job
CREATE MATERIALIZED VIEW IF NOT EXISTS ml_analytics_summary AS
SELECT 
    date_trunc('hour', created_at) as hour,
    count(*) as total_jobs,
    count(*) FILTER (WHERE status = 'completed') as completed_jobs,
    count(*) FILTER (WHERE status = 'failed') as failed_jobs,
    avg(processing_duration) as avg_duration,
    sum(records_processed) as total_records
FROM data_processing_jobs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY date_trunc('hour', created_at)
ORDER BY hour DESC;

-- Index for the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_ml_analytics_hour 
    ON ml_analytics_summary(hour);

-- Function to refresh analytics (call from Railway cron job)
CREATE OR REPLACE FUNCTION refresh_ml_analytics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY ml_analytics_summary;
END;
$$ LANGUAGE plpgsql;