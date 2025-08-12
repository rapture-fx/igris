-- Supabase Database Schema for Schlep Engine
-- Optimized for enterprise data processing and ML workloads

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pgjwt";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "ltree";

-- Custom types and enums
CREATE TYPE user_role AS ENUM ('admin', 'user', 'viewer', 'api_user');
CREATE TYPE subscription_tier AS ENUM ('free', 'starter', 'pro', 'enterprise');
CREATE TYPE job_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE job_type AS ENUM ('data_processing', 'ml_training', 'document_extraction', 'data_quality');
CREATE TYPE model_type AS ENUM ('classification', 'regression', 'nlp', 'computer_vision', 'embedding');

-- =============================================================================
-- AUTHENTICATION & USER MANAGEMENT SCHEMA
-- =============================================================================

-- User profiles (extends Supabase auth.users)
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role user_role DEFAULT 'user',
    subscription_tier subscription_tier DEFAULT 'free',
    
    -- API usage tracking
    api_quota_limit INTEGER DEFAULT 1000,
    api_quota_used INTEGER DEFAULT 0,
    api_quota_reset_date TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 month'),
    
    -- Preferences and metadata
    preferences JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ,
    
    -- Constraints
    UNIQUE(email),
    CHECK (api_quota_used >= 0),
    CHECK (api_quota_used <= api_quota_limit)
);

-- API keys for programmatic access
CREATE TABLE public.api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    prefix TEXT NOT NULL, -- First 8 chars for identification
    
    -- Permissions and limits
    scopes TEXT[] DEFAULT ARRAY['read'],
    rate_limit INTEGER DEFAULT 100, -- requests per minute
    is_active BOOLEAN DEFAULT true,
    
    -- Usage tracking
    last_used_at TIMESTAMPTZ,
    usage_count BIGINT DEFAULT 0,
    
    -- Expiration
    expires_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- DATA PROCESSING SCHEMA
-- =============================================================================

-- Data processing jobs
CREATE TABLE public.jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    
    -- Job details
    name TEXT NOT NULL,
    description TEXT,
    job_type job_type NOT NULL,
    status job_status DEFAULT 'pending',
    
    -- Configuration and data
    input_config JSONB NOT NULL,
    output_config JSONB DEFAULT '{}',
    processing_config JSONB DEFAULT '{}',
    
    -- Results and metrics
    result_data JSONB,
    processing_metrics JSONB DEFAULT '{}',
    error_details JSONB,
    
    -- ML-specific fields
    ml_model_id UUID,
    ml_model_version TEXT,
    
    -- Progress tracking
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    estimated_completion_time TIMESTAMPTZ,
    
    -- Resource usage
    cpu_time_seconds NUMERIC(10,3),
    memory_peak_mb INTEGER,
    storage_used_mb INTEGER,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job execution logs
CREATE TABLE public.job_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    
    level TEXT NOT NULL DEFAULT 'info', -- debug, info, warning, error
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Datasets
CREATE TABLE public.datasets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    
    -- Dataset metadata
    name TEXT NOT NULL,
    description TEXT,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Data schema and stats
    schema_info JSONB,
    statistics JSONB,
    quality_metrics JSONB,
    
    -- Storage information
    storage_path TEXT,
    file_format TEXT, -- csv, json, parquet, excel
    file_size_bytes BIGINT,
    row_count INTEGER,
    column_count INTEGER,
    
    -- Versioning
    version INTEGER DEFAULT 1,
    parent_dataset_id UUID REFERENCES public.datasets(id),
    
    -- Access control
    is_public BOOLEAN DEFAULT false,
    sharing_config JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- ML & AI SCHEMA
-- =============================================================================

-- ML model registry
CREATE TABLE public.ml_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    
    -- Model metadata
    name TEXT NOT NULL,
    description TEXT,
    model_type model_type NOT NULL,
    framework TEXT NOT NULL, -- tensorflow, pytorch, scikit-learn, huggingface
    
    -- Version control
    version TEXT NOT NULL,
    is_active BOOLEAN DEFAULT false,
    
    -- Model configuration
    config JSONB NOT NULL,
    hyperparameters JSONB DEFAULT '{}',
    
    -- Performance metrics
    training_metrics JSONB DEFAULT '{}',
    validation_metrics JSONB DEFAULT '{}',
    performance_benchmark JSONB DEFAULT '{}',
    
    -- Storage and deployment
    storage_path TEXT,
    model_size_mb NUMERIC(10,2),
    deployment_status TEXT DEFAULT 'inactive',
    
    -- Training information
    training_dataset_id UUID REFERENCES public.datasets(id),
    training_job_id UUID REFERENCES public.jobs(id),
    training_duration_minutes INTEGER,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document embeddings for semantic search
CREATE TABLE public.document_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    
    -- Document reference
    document_id UUID NOT NULL,
    document_name TEXT,
    
    -- Chunk information
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    chunk_tokens INTEGER,
    
    -- Embedding data
    embedding vector(1536), -- OpenAI/Cohere dimension
    embedding_model TEXT NOT NULL DEFAULT 'text-embedding-ada-002',
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector similarity search index
CREATE INDEX ON public.document_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- =============================================================================
-- ANALYTICS & MONITORING SCHEMA
-- =============================================================================

-- API usage analytics
CREATE TABLE public.api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
    
    -- Request details
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER,
    
    -- Request metadata
    user_agent TEXT,
    ip_address INET,
    request_size_bytes INTEGER,
    response_size_bytes INTEGER,
    
    -- Business metrics
    credits_consumed INTEGER DEFAULT 0,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System metrics
CREATE TABLE public.system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Metric details
    metric_name TEXT NOT NULL,
    metric_value NUMERIC NOT NULL,
    metric_unit TEXT,
    
    -- Dimensions
    service_name TEXT,
    environment TEXT DEFAULT 'production',
    tags JSONB DEFAULT '{}',
    
    -- Timestamp
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- COLLABORATION & SHARING SCHEMA
-- =============================================================================

-- Shared datasets and models
CREATE TABLE public.sharing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    shared_with_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    
    -- Shared resource
    resource_type TEXT NOT NULL, -- 'dataset', 'model', 'job'
    resource_id UUID NOT NULL,
    
    -- Permissions
    permissions TEXT[] DEFAULT ARRAY['read'], -- read, write, admin
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    -- Constraints
    UNIQUE(owner_id, shared_with_id, resource_type, resource_id)
);

-- =============================================================================
-- AUDIT & COMPLIANCE SCHEMA
-- =============================================================================

-- Audit trail
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    tenant_id UUID,
    
    -- Action details
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    
    -- Change details
    old_values JSONB,
    new_values JSONB,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    session_id TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sharing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Jobs policies (tenant-based)
CREATE POLICY "Users can view own tenant jobs" ON public.jobs
    FOR SELECT USING (
        tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users can create jobs in own tenant" ON public.jobs
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND
        tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users can update own jobs" ON public.jobs
    FOR UPDATE USING (user_id = auth.uid());

-- Similar policies for other tables...
-- (Additional policies would be added here for each table)

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_datasets_updated_at BEFORE UPDATE ON public.datasets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ml_models_updated_at BEFORE UPDATE ON public.ml_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function for real-time job updates
CREATE OR REPLACE FUNCTION notify_job_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Notify job status changes for real-time updates
    PERFORM pg_notify(
        'job_updates',
        json_build_object(
            'id', NEW.id,
            'status', NEW.status,
            'progress_percentage', NEW.progress_percentage,
            'user_id', NEW.user_id,
            'tenant_id', NEW.tenant_id
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Job status change trigger
CREATE TRIGGER job_status_change
    AFTER UPDATE ON public.jobs
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.progress_percentage IS DISTINCT FROM NEW.progress_percentage)
    EXECUTE FUNCTION notify_job_change();

-- Function to reset API quota monthly
CREATE OR REPLACE FUNCTION reset_api_quota()
RETURNS void AS $$
BEGIN
    UPDATE public.user_profiles
    SET 
        api_quota_used = 0,
        api_quota_reset_date = NOW() + INTERVAL '1 month'
    WHERE api_quota_reset_date <= NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule monthly API quota reset
SELECT cron.schedule('reset-api-quota', '0 0 1 * *', 'SELECT reset_api_quota();');

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- User profiles indexes
CREATE INDEX idx_user_profiles_tenant_id ON public.user_profiles(tenant_id);
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);

-- Jobs indexes
CREATE INDEX idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX idx_jobs_tenant_id ON public.jobs(tenant_id);
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_jobs_created_at ON public.jobs(created_at DESC);
CREATE INDEX idx_jobs_type_status ON public.jobs(job_type, status);

-- API usage indexes
CREATE INDEX idx_api_usage_user_id ON public.api_usage(user_id);
CREATE INDEX idx_api_usage_created_at ON public.api_usage(created_at DESC);
CREATE INDEX idx_api_usage_endpoint ON public.api_usage(endpoint);

-- Document embeddings indexes
CREATE INDEX idx_document_embeddings_user_id ON public.document_embeddings(user_id);
CREATE INDEX idx_document_embeddings_document_id ON public.document_embeddings(document_id);
CREATE INDEX idx_document_embeddings_tenant_id ON public.document_embeddings(tenant_id);

-- =============================================================================
-- SAMPLE DATA (OPTIONAL)
-- =============================================================================

-- Insert default admin user (update with real admin details)
-- INSERT INTO public.user_profiles (id, email, full_name, role, subscription_tier)
-- VALUES (
--     '00000000-0000-0000-0000-000000000000',
--     'admin@schlep-engine.com',
--     'System Administrator',
--     'admin',
--     'enterprise'
-- );

-- =============================================================================
-- COMMENTS AND DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE public.user_profiles IS 'Extended user profiles with subscription and tenant information';
COMMENT ON TABLE public.jobs IS 'Data processing and ML jobs with comprehensive tracking';
COMMENT ON TABLE public.document_embeddings IS 'Vector embeddings for semantic search and AI features';
COMMENT ON TABLE public.ml_models IS 'ML model registry with versioning and deployment tracking';
COMMENT ON TABLE public.api_usage IS 'API usage analytics and billing tracking';

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;