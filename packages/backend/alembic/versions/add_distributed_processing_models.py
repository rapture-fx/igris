"""Add distributed processing and training data management models

Revision ID: add_distributed_processing_models
Revises: 51eb2357e1f2
Create Date: 2024-01-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_distributed_processing_models'
down_revision = '51eb2357e1f2'
branch_labels = None
depends_on = None


def upgrade():
    # Create enum types
    op.execute("CREATE TYPE splitstrategy AS ENUM ('random', 'stratified', 'temporal', 'custom')")
    op.execute("CREATE TYPE processingformat AS ENUM ('csv', 'jsonl', 'parquet', 'tsv')")

    # Create dataset_splits table
    op.create_table('dataset_splits',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('dataset_version_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('split_strategy', sa.Enum('random', 'stratified', 'temporal', 'custom', name='splitstrategy'), nullable=False),
        sa.Column('train_ratio', sa.Float(), nullable=True, default=0.7),
        sa.Column('val_ratio', sa.Float(), nullable=True, default=0.15),
        sa.Column('test_ratio', sa.Float(), nullable=True, default=0.15),
        sa.Column('target_column', sa.String(), nullable=True),
        sa.Column('time_column', sa.String(), nullable=True),
        sa.Column('random_seed', sa.Integer(), nullable=True, default=42),
        sa.Column('train_path', sa.String(), nullable=False),
        sa.Column('val_path', sa.String(), nullable=False),
        sa.Column('test_path', sa.String(), nullable=False),
        sa.Column('train_rows', sa.Integer(), nullable=True),
        sa.Column('val_rows', sa.Integer(), nullable=True),
        sa.Column('test_rows', sa.Integer(), nullable=True),
        sa.Column('train_quality_score', sa.Float(), nullable=True),
        sa.Column('val_quality_score', sa.Float(), nullable=True),
        sa.Column('test_quality_score', sa.Float(), nullable=True),
        sa.Column('provenance_info', sa.JSON(), nullable=True),
        sa.Column('split_metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['dataset_version_id'], ['dataset_versions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create foundation_model_jobs table
    op.create_table('foundation_model_jobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('input_path', sa.String(), nullable=False),
        sa.Column('output_path', sa.String(), nullable=True),
        sa.Column('model_name_or_path', sa.String(), nullable=True, default='gpt2'),
        sa.Column('max_sequence_length', sa.Integer(), nullable=True, default=2048),
        sa.Column('tokenization_strategy', sa.String(), nullable=True, default='autoregressive'),
        sa.Column('text_column', sa.String(), nullable=True, default='text'),
        sa.Column('enable_deduplication', sa.Boolean(), nullable=True, default=True),
        sa.Column('enable_sequence_packing', sa.Boolean(), nullable=True, default=True),
        sa.Column('total_sequences', sa.Integer(), nullable=True),
        sa.Column('total_tokens', sa.Integer(), nullable=True),
        sa.Column('vocab_size', sa.Integer(), nullable=True),
        sa.Column('avg_sequence_length', sa.Float(), nullable=True),
        sa.Column('dedup_removed_count', sa.Integer(), nullable=True, default=0),
        sa.Column('status', sa.Enum('pending', 'running', 'completed', 'failed', 'cancelled', name='jobstatus'), nullable=True, default='pending'),
        sa.Column('progress_percentage', sa.Float(), nullable=True, default=0.0),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('processing_time_seconds', sa.Float(), nullable=True),
        sa.Column('quality_metrics', sa.JSON(), nullable=True),
        sa.Column('tokenizer_info', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create distributed_processing_jobs table
    op.create_table('distributed_processing_jobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('input_path', sa.String(), nullable=False),
        sa.Column('output_path', sa.String(), nullable=True),
        sa.Column('file_format', sa.Enum('csv', 'jsonl', 'parquet', 'tsv', name='processingformat'), nullable=False),
        sa.Column('chunk_size', sa.Integer(), nullable=True, default=50000),
        sa.Column('max_workers', sa.Integer(), nullable=True, default=4),
        sa.Column('enable_quality_checks', sa.Boolean(), nullable=True, default=True),
        sa.Column('total_rows', sa.Integer(), nullable=True),
        sa.Column('total_size_mb', sa.Float(), nullable=True),
        sa.Column('quality_score', sa.Float(), nullable=True),
        sa.Column('status', sa.Enum('pending', 'running', 'completed', 'failed', 'cancelled', name='jobstatus'), nullable=True, default='pending'),
        sa.Column('progress_percentage', sa.Float(), nullable=True, default=0.0),
        sa.Column('current_operation', sa.String(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('processing_time_seconds', sa.Float(), nullable=True),
        sa.Column('peak_memory_usage_mb', sa.Float(), nullable=True),
        sa.Column('avg_cpu_usage_percent', sa.Float(), nullable=True),
        sa.Column('job_metadata', sa.JSON(), nullable=True),
        sa.Column('performance_metrics', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create quality_monitoring_jobs table
    op.create_table('quality_monitoring_jobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('dataset_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('dataset_path', sa.String(), nullable=False),
        sa.Column('target_column', sa.String(), nullable=True),
        sa.Column('reference_dataset_path', sa.String(), nullable=True),
        sa.Column('enable_pdf_report', sa.Boolean(), nullable=True, default=False),
        sa.Column('overall_quality_score', sa.Float(), nullable=True),
        sa.Column('quality_grade', sa.String(), nullable=True),
        sa.Column('missing_values_ratio', sa.Float(), nullable=True),
        sa.Column('class_imbalance_ratio', sa.Float(), nullable=True),
        sa.Column('drift_detected', sa.Boolean(), nullable=True, default=False),
        sa.Column('missing_values_analysis', sa.JSON(), nullable=True),
        sa.Column('class_imbalance_analysis', sa.JSON(), nullable=True),
        sa.Column('drift_analysis', sa.JSON(), nullable=True),
        sa.Column('column_profiles', sa.JSON(), nullable=True),
        sa.Column('outlier_analysis', sa.JSON(), nullable=True),
        sa.Column('duplicate_analysis', sa.JSON(), nullable=True),
        sa.Column('quality_recommendations', sa.JSON(), nullable=True),
        sa.Column('status', sa.Enum('pending', 'running', 'completed', 'failed', 'cancelled', name='jobstatus'), nullable=True, default='pending'),
        sa.Column('progress_percentage', sa.Float(), nullable=True, default=0.0),
        sa.Column('current_operation', sa.String(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('processing_time_seconds', sa.Float(), nullable=True),
        sa.Column('json_report_path', sa.String(), nullable=True),
        sa.Column('pdf_report_path', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['dataset_id'], ['datasets.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create dataset_lineage table
    op.create_table('dataset_lineage',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('dataset_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('parent_dataset_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('transformation_type', sa.String(), nullable=False),
        sa.Column('transformation_config', sa.JSON(), nullable=True),
        sa.Column('transformation_description', sa.Text(), nullable=True),
        sa.Column('processing_job_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('processing_job_type', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['dataset_id'], ['datasets.id'], ),
        sa.ForeignKeyConstraint(['parent_dataset_id'], ['datasets.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for better performance
    op.create_index(op.f('ix_dataset_splits_dataset_version_id'), 'dataset_splits', ['dataset_version_id'], unique=False)
    op.create_index(op.f('ix_dataset_splits_created_at'), 'dataset_splits', ['created_at'], unique=False)

    op.create_index(op.f('ix_foundation_model_jobs_status'), 'foundation_model_jobs', ['status'], unique=False)
    op.create_index(op.f('ix_foundation_model_jobs_created_at'), 'foundation_model_jobs', ['created_at'], unique=False)

    op.create_index(op.f('ix_distributed_processing_jobs_status'), 'distributed_processing_jobs', ['status'], unique=False)
    op.create_index(op.f('ix_distributed_processing_jobs_created_at'), 'distributed_processing_jobs', ['created_at'], unique=False)

    op.create_index(op.f('ix_quality_monitoring_jobs_dataset_id'), 'quality_monitoring_jobs', ['dataset_id'], unique=False)
    op.create_index(op.f('ix_quality_monitoring_jobs_status'), 'quality_monitoring_jobs', ['status'], unique=False)
    op.create_index(op.f('ix_quality_monitoring_jobs_created_at'), 'quality_monitoring_jobs', ['created_at'], unique=False)

    op.create_index(op.f('ix_dataset_lineage_dataset_id'), 'dataset_lineage', ['dataset_id'], unique=False)
    op.create_index(op.f('ix_dataset_lineage_parent_dataset_id'), 'dataset_lineage', ['parent_dataset_id'], unique=False)


def downgrade():
    # Drop indexes
    op.drop_index(op.f('ix_dataset_lineage_parent_dataset_id'), table_name='dataset_lineage')
    op.drop_index(op.f('ix_dataset_lineage_dataset_id'), table_name='dataset_lineage')
    op.drop_index(op.f('ix_quality_monitoring_jobs_created_at'), table_name='quality_monitoring_jobs')
    op.drop_index(op.f('ix_quality_monitoring_jobs_status'), table_name='quality_monitoring_jobs')
    op.drop_index(op.f('ix_quality_monitoring_jobs_dataset_id'), table_name='quality_monitoring_jobs')
    op.drop_index(op.f('ix_distributed_processing_jobs_created_at'), table_name='distributed_processing_jobs')
    op.drop_index(op.f('ix_distributed_processing_jobs_status'), table_name='distributed_processing_jobs')
    op.drop_index(op.f('ix_foundation_model_jobs_created_at'), table_name='foundation_model_jobs')
    op.drop_index(op.f('ix_foundation_model_jobs_status'), table_name='foundation_model_jobs')
    op.drop_index(op.f('ix_dataset_splits_created_at'), table_name='dataset_splits')
    op.drop_index(op.f('ix_dataset_splits_dataset_version_id'), table_name='dataset_splits')

    # Drop tables
    op.drop_table('dataset_lineage')
    op.drop_table('quality_monitoring_jobs')
    op.drop_table('distributed_processing_jobs')
    op.drop_table('foundation_model_jobs')
    op.drop_table('dataset_splits')

    # Drop enum types
    op.execute("DROP TYPE processingformat")
    op.execute("DROP TYPE splitstrategy")