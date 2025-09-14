"""Add RL model tables for enhanced model persistence

Revision ID: add_rl_model_tables
Revises: (previous revision)
Create Date: 2024-01-20 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_rl_model_tables'
down_revision = None  # Replace with actual previous revision
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create rl_models table
    op.create_table(
        'rl_models',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('model_id', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('model_type', sa.String(length=100), nullable=True),
        sa.Column('algorithm', sa.String(length=100), nullable=True),
        sa.Column('environment', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('is_production', sa.Boolean(), nullable=True),
        sa.Column('best_performance', sa.Float(), nullable=True),
        sa.Column('total_episodes_trained', sa.Integer(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('model_id')
    )

    # Create indexes for rl_models
    op.create_index('idx_rl_models_model_id', 'rl_models', ['model_id'])
    op.create_index('idx_rl_models_organization', 'rl_models', ['organization_id', 'created_at'])
    op.create_index('idx_rl_models_active', 'rl_models', ['is_active', 'updated_at'])

    # Create rl_model_versions table
    op.create_table(
        'rl_model_versions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('model_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('version', sa.String(length=255), nullable=False),
        sa.Column('episode', sa.Integer(), nullable=False),
        sa.Column('performance_metrics', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('hyperparameters', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('training_metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('session_id', sa.String(length=255), nullable=True),
        sa.Column('local_path', sa.String(length=1024), nullable=True),
        sa.Column('cloud_url', sa.String(length=1024), nullable=True),
        sa.Column('backup_url', sa.String(length=1024), nullable=True),
        sa.Column('file_hash', sa.String(length=64), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('is_archived', sa.Boolean(), nullable=True),
        sa.Column('stable_baselines3_version', sa.String(length=50), nullable=True),
        sa.Column('python_version', sa.String(length=20), nullable=True),
        sa.Column('dependencies', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['model_id'], ['rl_models.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for rl_model_versions
    op.create_index('idx_rl_model_versions_model_version', 'rl_model_versions', ['model_id', 'version'])
    op.create_index('idx_rl_model_versions_session', 'rl_model_versions', ['session_id', 'created_at'])
    op.create_index('idx_rl_model_versions_active', 'rl_model_versions', ['model_id', 'is_active'])
    op.create_index('idx_rl_model_versions_episode', 'rl_model_versions', ['model_id', 'episode'])

    # Set default values
    op.execute("UPDATE rl_models SET model_type = 'hyperparameter_optimization' WHERE model_type IS NULL")
    op.execute("UPDATE rl_models SET is_active = true WHERE is_active IS NULL")
    op.execute("UPDATE rl_models SET is_production = false WHERE is_production IS NULL")
    op.execute("UPDATE rl_models SET total_episodes_trained = 0 WHERE total_episodes_trained IS NULL")

    op.execute("UPDATE rl_model_versions SET performance_metrics = '{}' WHERE performance_metrics IS NULL")
    op.execute("UPDATE rl_model_versions SET hyperparameters = '{}' WHERE hyperparameters IS NULL")
    op.execute("UPDATE rl_model_versions SET training_metadata = '{}' WHERE training_metadata IS NULL")
    op.execute("UPDATE rl_model_versions SET dependencies = '{}' WHERE dependencies IS NULL")
    op.execute("UPDATE rl_model_versions SET is_active = false WHERE is_active IS NULL")
    op.execute("UPDATE rl_model_versions SET is_archived = false WHERE is_archived IS NULL")


def downgrade() -> None:
    # Drop indexes first
    op.drop_index('idx_rl_model_versions_episode', table_name='rl_model_versions')
    op.drop_index('idx_rl_model_versions_active', table_name='rl_model_versions')
    op.drop_index('idx_rl_model_versions_session', table_name='rl_model_versions')
    op.drop_index('idx_rl_model_versions_model_version', table_name='rl_model_versions')

    op.drop_index('idx_rl_models_active', table_name='rl_models')
    op.drop_index('idx_rl_models_organization', table_name='rl_models')
    op.drop_index('idx_rl_models_model_id', table_name='rl_models')

    # Drop tables
    op.drop_table('rl_model_versions')
    op.drop_table('rl_models')