"""Add RL optimization tables

Revision ID: 004_add_rl_optimization_tables
Revises: 003_feedback_learning_system
Create Date: 2025-08-28 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '004_add_rl_optimization_tables'
down_revision = '003_feedback_learning_system'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if tables already exist to avoid conflicts
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()
    
    if 'rl_optimization_sessions' in existing_tables:
        print("RL optimization tables already exist, skipping creation")
        return
    # Create RL optimization sessions table
    op.create_table('rl_optimization_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('pipeline_id', sa.String(), nullable=False),
        sa.Column('optimization_type', sa.String(), nullable=False),
        sa.Column('strategy', sa.String(), nullable=False),
        sa.Column('objective', sa.String(), nullable=False),
        sa.Column('config', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('best_performance', sa.Float(), nullable=True),
        sa.Column('best_hyperparameters', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('total_episodes', sa.Integer(), nullable=True),
        sa.Column('optimization_time', sa.Float(), nullable=True),
        sa.Column('convergence_episode', sa.Integer(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create RL optimization episodes table
    op.create_table('rl_optimization_episodes',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('episode_number', sa.Integer(), nullable=False),
        sa.Column('reward', sa.Float(), nullable=False),
        sa.Column('performance_metrics', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('hyperparameters', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('training_time', sa.Float(), nullable=True),
        sa.Column('memory_usage', sa.Float(), nullable=True),
        sa.Column('cpu_usage', sa.Float(), nullable=True),
        sa.Column('convergence_indicator', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['rl_optimization_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create RL performance metrics table
    op.create_table('rl_performance_metrics',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('episode_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('metric_name', sa.String(), nullable=False),
        sa.Column('metric_value', sa.Float(), nullable=False),
        sa.Column('metric_type', sa.String(), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('metric_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['session_id'], ['rl_optimization_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['episode_id'], ['rl_optimization_episodes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create hyperparameter results table
    op.create_table('hyperparameter_results',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('episode_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('hyperparameters', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('performance_score', sa.Float(), nullable=False),
        sa.Column('detailed_metrics', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('training_duration', sa.Float(), nullable=True),
        sa.Column('validation_score', sa.Float(), nullable=True),
        sa.Column('test_score', sa.Float(), nullable=True),
        sa.Column('is_best', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['rl_optimization_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['episode_id'], ['rl_optimization_episodes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create RL agent checkpoints table
    op.create_table('rl_agent_checkpoints',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('episode_number', sa.Integer(), nullable=False),
        sa.Column('checkpoint_path', sa.String(), nullable=False),
        sa.Column('model_state', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('performance_score', sa.Float(), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('checksum', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['rl_optimization_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create RL resource allocations table
    op.create_table('rl_resource_allocations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('pipeline_id', sa.String(), nullable=False),
        sa.Column('allocated_cpu_cores', sa.Float(), nullable=False),
        sa.Column('allocated_memory_gb', sa.Float(), nullable=False),
        sa.Column('allocated_storage_gb', sa.Float(), nullable=True),
        sa.Column('gpu_allocation', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('cost_per_hour', sa.Float(), nullable=True),
        sa.Column('performance_score', sa.Float(), nullable=True),
        sa.Column('efficiency_score', sa.Float(), nullable=True),
        sa.Column('allocation_start', sa.DateTime(), nullable=False),
        sa.Column('allocation_end', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['rl_optimization_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for performance
    op.create_index('idx_rl_sessions_pipeline_id', 'rl_optimization_sessions', ['pipeline_id'])
    op.create_index('idx_rl_sessions_status', 'rl_optimization_sessions', ['status'])
    op.create_index('idx_rl_sessions_created_at', 'rl_optimization_sessions', ['created_at'])
    op.create_index('idx_rl_episodes_session_id', 'rl_optimization_episodes', ['session_id'])
    op.create_index('idx_rl_episodes_episode_number', 'rl_optimization_episodes', ['episode_number'])
    op.create_index('idx_rl_metrics_session_id', 'rl_performance_metrics', ['session_id'])
    op.create_index('idx_rl_metrics_timestamp', 'rl_performance_metrics', ['timestamp'])
    op.create_index('idx_hyperparams_session_id', 'hyperparameter_results', ['session_id'])
    op.create_index('idx_hyperparams_is_best', 'hyperparameter_results', ['is_best'])
    op.create_index('idx_checkpoints_session_id', 'rl_agent_checkpoints', ['session_id'])
    op.create_index('idx_resource_alloc_pipeline', 'rl_resource_allocations', ['pipeline_id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_resource_alloc_pipeline')
    op.drop_index('idx_checkpoints_session_id')
    op.drop_index('idx_hyperparams_is_best')
    op.drop_index('idx_hyperparams_session_id')
    op.drop_index('idx_rl_metrics_timestamp')
    op.drop_index('idx_rl_metrics_session_id')
    op.drop_index('idx_rl_episodes_episode_number')
    op.drop_index('idx_rl_episodes_session_id')
    op.drop_index('idx_rl_sessions_created_at')
    op.drop_index('idx_rl_sessions_status')
    op.drop_index('idx_rl_sessions_pipeline_id')
    
    # Drop tables in reverse order
    op.drop_table('rl_resource_allocations')
    op.drop_table('rl_agent_checkpoints')
    op.drop_table('hyperparameter_results')
    op.drop_table('rl_performance_metrics')
    op.drop_table('rl_optimization_episodes')
    op.drop_table('rl_optimization_sessions')