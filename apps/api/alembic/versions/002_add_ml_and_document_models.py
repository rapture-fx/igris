"""Add ML Pipeline and Document Extraction models

Revision ID: 002_add_ml_and_document_models
Revises: 001_add_security_data_layer
Create Date: 2024-01-24 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '002_add_ml_and_document_models'
down_revision = '001_add_security_data_layer'
branch_labels = None
depends_on = None


def upgrade():
    # Create ml_pipelines table
    op.create_table('ml_pipelines',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('model_type', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('preprocessing_steps', sa.JSON(), nullable=True),
        sa.Column('feature_columns', sa.JSON(), nullable=True),
        sa.Column('target_column', sa.String(length=255), nullable=True),
        sa.Column('hyperparameters', sa.JSON(), nullable=True),
        sa.Column('metrics', sa.JSON(), nullable=True),
        sa.Column('model_path', sa.String(length=500), nullable=True),
        sa.Column('scaler_path', sa.String(length=500), nullable=True),
        sa.Column('feature_names', sa.JSON(), nullable=True),
        sa.Column('deployment_endpoint', sa.String(length=500), nullable=True),
        sa.Column('is_deployed', sa.Boolean(), nullable=True),
        sa.Column('deployment_config', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('trained_at', sa.DateTime(), nullable=True),
        sa.Column('deployed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ml_pipelines_user_id'), 'ml_pipelines', ['user_id'], unique=False)
    op.create_index(op.f('ix_ml_pipelines_status'), 'ml_pipelines', ['status'], unique=False)
    op.create_index(op.f('ix_ml_pipelines_created_at'), 'ml_pipelines', ['created_at'], unique=False)

    # Create ml_predictions table
    op.create_table('ml_predictions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('pipeline_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('input_data', sa.JSON(), nullable=False),
        sa.Column('prediction_result', sa.JSON(), nullable=False),
        sa.Column('confidence_score', sa.Float(), nullable=True),
        sa.Column('processing_time_ms', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['pipeline_id'], ['ml_pipelines.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ml_predictions_pipeline_id'), 'ml_predictions', ['pipeline_id'], unique=False)
    op.create_index(op.f('ix_ml_predictions_user_id'), 'ml_predictions', ['user_id'], unique=False)
    op.create_index(op.f('ix_ml_predictions_created_at'), 'ml_predictions', ['created_at'], unique=False)

    # Create document_extractions table
    op.create_table('document_extractions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('file_type', sa.String(length=50), nullable=False),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('file_path', sa.String(length=500), nullable=True),
        sa.Column('extract_tables', sa.Boolean(), nullable=True),
        sa.Column('extract_text', sa.Boolean(), nullable=True),
        sa.Column('detect_structure', sa.Boolean(), nullable=True),
        sa.Column('output_format', sa.String(length=20), nullable=True),
        sa.Column('extracted_data', sa.JSON(), nullable=True),
        sa.Column('tables', sa.JSON(), nullable=True),
        sa.Column('text_content', sa.Text(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('processing_time_seconds', sa.Float(), nullable=True),
        sa.Column('extraction_method', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_document_extractions_user_id'), 'document_extractions', ['user_id'], unique=False)
    op.create_index(op.f('ix_document_extractions_file_type'), 'document_extractions', ['file_type'], unique=False)
    op.create_index(op.f('ix_document_extractions_status'), 'document_extractions', ['status'], unique=False)
    op.create_index(op.f('ix_document_extractions_created_at'), 'document_extractions', ['created_at'], unique=False)


def downgrade():
    # Drop tables in reverse order due to foreign key constraints
    op.drop_index(op.f('ix_document_extractions_created_at'), table_name='document_extractions')
    op.drop_index(op.f('ix_document_extractions_status'), table_name='document_extractions')
    op.drop_index(op.f('ix_document_extractions_file_type'), table_name='document_extractions')
    op.drop_index(op.f('ix_document_extractions_user_id'), table_name='document_extractions')
    op.drop_table('document_extractions')
    
    op.drop_index(op.f('ix_ml_predictions_created_at'), table_name='ml_predictions')
    op.drop_index(op.f('ix_ml_predictions_user_id'), table_name='ml_predictions')
    op.drop_index(op.f('ix_ml_predictions_pipeline_id'), table_name='ml_predictions')
    op.drop_table('ml_predictions')
    
    op.drop_index(op.f('ix_ml_pipelines_created_at'), table_name='ml_pipelines')
    op.drop_index(op.f('ix_ml_pipelines_status'), table_name='ml_pipelines')
    op.drop_index(op.f('ix_ml_pipelines_user_id'), table_name='ml_pipelines')
    op.drop_table('ml_pipelines')