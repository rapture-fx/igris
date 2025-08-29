-- Manual SQL script to create RL optimization tables
-- This bypasses alembic for immediate deployment

-- Create RL optimization sessions table
CREATE TABLE IF NOT EXISTS rl_optimization_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id VARCHAR NOT NULL,
    optimization_type VARCHAR NOT NULL,
    strategy VARCHAR NOT NULL,
    objective VARCHAR NOT NULL,
    config JSONB,
    status VARCHAR NOT NULL,
    best_performance FLOAT,
    best_hyperparameters JSONB,
    total_episodes INTEGER,
    optimization_time FLOAT,
    convergence_episode INTEGER,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP,
    completed_at TIMESTAMP,
    user_id VARCHAR
);

-- Create RL optimization episodes table
CREATE TABLE IF NOT EXISTS rl_optimization_episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES rl_optimization_sessions(id) ON DELETE CASCADE,
    episode_number INTEGER NOT NULL,
    reward FLOAT NOT NULL,
    performance_metrics JSONB,
    hyperparameters JSONB,
    training_time FLOAT,
    memory_usage FLOAT,
    cpu_usage FLOAT,
    convergence_indicator FLOAT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create RL performance metrics table
CREATE TABLE IF NOT EXISTS rl_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES rl_optimization_sessions(id) ON DELETE CASCADE,
    episode_id UUID REFERENCES rl_optimization_episodes(id) ON DELETE CASCADE,
    metric_name VARCHAR NOT NULL,
    metric_value FLOAT NOT NULL,
    metric_type VARCHAR NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    metadata JSONB
);

-- Create hyperparameter results table
CREATE TABLE IF NOT EXISTS hyperparameter_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES rl_optimization_sessions(id) ON DELETE CASCADE,
    episode_id UUID REFERENCES rl_optimization_episodes(id) ON DELETE CASCADE,
    hyperparameters JSONB NOT NULL,
    performance_score FLOAT NOT NULL,
    detailed_metrics JSONB,
    training_duration FLOAT,
    validation_score FLOAT,
    test_score FLOAT,
    is_best BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create RL agent checkpoints table
CREATE TABLE IF NOT EXISTS rl_agent_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES rl_optimization_sessions(id) ON DELETE CASCADE,
    episode_number INTEGER NOT NULL,
    checkpoint_path VARCHAR NOT NULL,
    model_state JSONB,
    performance_score FLOAT NOT NULL,
    file_size BIGINT,
    checksum VARCHAR,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create RL resource allocations table
CREATE TABLE IF NOT EXISTS rl_resource_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES rl_optimization_sessions(id) ON DELETE CASCADE,
    pipeline_id VARCHAR NOT NULL,
    allocated_cpu_cores FLOAT NOT NULL,
    allocated_memory_gb FLOAT NOT NULL,
    allocated_storage_gb FLOAT,
    gpu_allocation JSONB,
    cost_per_hour FLOAT,
    performance_score FLOAT,
    efficiency_score FLOAT,
    allocation_start TIMESTAMP NOT NULL DEFAULT NOW(),
    allocation_end TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rl_sessions_pipeline_id ON rl_optimization_sessions(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_rl_sessions_status ON rl_optimization_sessions(status);
CREATE INDEX IF NOT EXISTS idx_rl_sessions_created_at ON rl_optimization_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_rl_episodes_session_id ON rl_optimization_episodes(session_id);
CREATE INDEX IF NOT EXISTS idx_rl_episodes_episode_number ON rl_optimization_episodes(episode_number);
CREATE INDEX IF NOT EXISTS idx_rl_metrics_session_id ON rl_performance_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_rl_metrics_timestamp ON rl_performance_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_hyperparams_session_id ON hyperparameter_results(session_id);
CREATE INDEX IF NOT EXISTS idx_hyperparams_is_best ON hyperparameter_results(is_best);
CREATE INDEX IF NOT EXISTS idx_checkpoints_session_id ON rl_agent_checkpoints(session_id);
CREATE INDEX IF NOT EXISTS idx_resource_alloc_pipeline ON rl_resource_allocations(pipeline_id);

-- Record this as a manual migration
INSERT INTO alembic_version (version_num) VALUES ('004_add_rl_optimization_tables')
ON CONFLICT (version_num) DO NOTHING;