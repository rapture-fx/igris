"""Performance indexes for frequently accessed tables

Revision ID: 002_performance_indexes
Revises: 001_initial_schema
Create Date: 2025-08-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002_performance_indexes'
down_revision = '001_initial_schema'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add performance indexes for frequently accessed tables."""
    
    # User table indexes
    op.create_index('idx_users_email_active', 'users', ['email'], postgresql_where=sa.text('is_active = true'))
    op.create_index('idx_users_created_at', 'users', ['created_at'])
    op.create_index('idx_users_role', 'users', ['role'])
    op.create_index('idx_users_organization_id', 'users', ['organization_id'])
    
    # OAuth accounts indexes
    op.create_index('idx_oauth_accounts_provider_user', 'oauth_accounts', ['provider', 'user_id'])
    op.create_index('idx_oauth_accounts_provider_id', 'oauth_accounts', ['provider_user_id'])
    
    # API keys indexes
    op.create_index('idx_api_keys_user_active', 'api_keys', ['user_id'], postgresql_where=sa.text('is_active = true'))
    op.create_index('idx_api_keys_key_prefix', 'api_keys', [sa.text('substring(key_hash, 1, 8)')])
    op.create_index('idx_api_keys_expires_at', 'api_keys', ['expires_at'])
    
    # User sessions indexes
    op.create_index('idx_user_sessions_user_active', 'user_sessions', ['user_id'], postgresql_where=sa.text("status = 'active'"))
    op.create_index('idx_user_sessions_expires_at', 'user_sessions', ['expires_at'])
    op.create_index('idx_user_sessions_status', 'user_sessions', ['status'])
    
    # Processing jobs indexes
    op.create_index('idx_processing_jobs_user_status', 'processing_jobs', ['user_id', 'status'])
    op.create_index('idx_processing_jobs_status_created', 'processing_jobs', ['status', 'created_at'])
    op.create_index('idx_processing_jobs_created_at', 'processing_jobs', ['created_at'])
    op.create_index('idx_processing_jobs_workspace_id', 'processing_jobs', ['workspace_id'])
    
    # Data investigations indexes
    op.create_index('idx_data_investigations_user_id', 'data_investigations', ['user_id'])
    op.create_index('idx_data_investigations_created_at', 'data_investigations', ['created_at'])
    op.create_index('idx_data_investigations_workspace_id', 'data_investigations', ['workspace_id'])
    
    # Audit logs indexes (for monitoring and compliance)
    op.create_index('idx_audit_logs_user_action', 'audit_logs', ['user_id', 'action'])
    op.create_index('idx_audit_logs_timestamp', 'audit_logs', ['timestamp'])
    op.create_index('idx_audit_logs_resource_type', 'audit_logs', ['resource_type'])
    
    # Usage metrics indexes (for analytics)
    op.create_index('idx_usage_metrics_user_date', 'usage_metrics', ['user_id', 'recorded_at'])
    op.create_index('idx_usage_metrics_metric_type', 'usage_metrics', ['metric_type'])
    op.create_index('idx_usage_metrics_recorded_at', 'usage_metrics', ['recorded_at'])
    
    # Dataset versioning indexes
    op.create_index('idx_datasets_user_created', 'datasets', ['user_id', 'created_at'])
    op.create_index('idx_datasets_name', 'datasets', ['name'])
    op.create_index('idx_dataset_versions_dataset_version', 'dataset_versions', ['dataset_id', 'version_number'])
    op.create_index('idx_dataset_versions_created_at', 'dataset_versions', ['created_at'])
    
    # ML preparation pipeline indexes
    op.create_index('idx_data_prep_pipelines_user_created', 'data_preparation_pipelines', ['user_id', 'created_at'])
    op.create_index('idx_data_prep_pipelines_status', 'data_preparation_pipelines', ['status'])
    op.create_index('idx_preparation_steps_pipeline_order', 'preparation_steps', ['pipeline_id', 'step_order'])
    
    # Data quality assessment indexes
    op.create_index('idx_data_quality_dataset_created', 'data_quality_assessments', ['dataset_id', 'created_at'])
    op.create_index('idx_data_quality_score', 'data_quality_assessments', ['overall_score'])
    
    # Framework output indexes
    op.create_index('idx_framework_outputs_pipeline_framework', 'framework_outputs', ['pipeline_id', 'target_framework'])
    op.create_index('idx_framework_outputs_created_at', 'framework_outputs', ['created_at'])
    
    # Security and compliance indexes
    op.create_index('idx_audit_trail_user_timestamp', 'audit_trail', ['user_id', 'timestamp'])
    op.create_index('idx_audit_trail_action', 'audit_trail', ['action'])
    op.create_index('idx_audit_trail_resource_type', 'audit_trail', ['resource_type'])
    
    op.create_index('idx_data_classification_dataset', 'data_classification_records', ['dataset_id'])
    op.create_index('idx_data_classification_level', 'data_classification_records', ['classification_level'])
    
    op.create_index('idx_compliance_events_type_timestamp', 'compliance_events', ['event_type', 'timestamp'])
    op.create_index('idx_compliance_events_status', 'compliance_events', ['status'])
    
    # Workspaces indexes
    op.create_index('idx_workspaces_organization_id', 'workspaces', ['organization_id'])
    op.create_index('idx_workspaces_created_at', 'workspaces', ['created_at'])
    
    # Organizations indexes
    op.create_index('idx_organizations_created_at', 'organizations', ['created_at'])
    op.create_index('idx_organizations_subscription_status', 'organizations', ['subscription_status'])
    
    # Webhook endpoints indexes
    op.create_index('idx_webhook_endpoints_user_active', 'webhook_endpoints', ['user_id'], postgresql_where=sa.text('is_active = true'))
    op.create_index('idx_webhook_endpoints_event_types', 'webhook_endpoints', [sa.text('event_types')], postgresql_using='gin')
    
    # Integrations indexes
    op.create_index('idx_integrations_user_type', 'integrations', ['user_id', 'integration_type'])
    op.create_index('idx_integrations_active', 'integrations', ['is_active'])
    
    # Composite indexes for common query patterns
    op.create_index('idx_processing_jobs_user_workspace_status', 'processing_jobs', ['user_id', 'workspace_id', 'status'])
    op.create_index('idx_users_org_role_active', 'users', ['organization_id', 'role'], postgresql_where=sa.text('is_active = true'))


def downgrade() -> None:
    """Remove performance indexes."""
    
    # Drop indexes in reverse order
    op.drop_index('idx_users_org_role_active', table_name='users')
    op.drop_index('idx_processing_jobs_user_workspace_status', table_name='processing_jobs')
    
    op.drop_index('idx_integrations_active', table_name='integrations')
    op.drop_index('idx_integrations_user_type', table_name='integrations')
    
    op.drop_index('idx_webhook_endpoints_event_types', table_name='webhook_endpoints')
    op.drop_index('idx_webhook_endpoints_user_active', table_name='webhook_endpoints')
    
    op.drop_index('idx_organizations_subscription_status', table_name='organizations')
    op.drop_index('idx_organizations_created_at', table_name='organizations')
    
    op.drop_index('idx_workspaces_created_at', table_name='workspaces')
    op.drop_index('idx_workspaces_organization_id', table_name='workspaces')
    
    op.drop_index('idx_compliance_events_status', table_name='compliance_events')
    op.drop_index('idx_compliance_events_type_timestamp', table_name='compliance_events')
    
    op.drop_index('idx_data_classification_level', table_name='data_classification_records')
    op.drop_index('idx_data_classification_dataset', table_name='data_classification_records')
    
    op.drop_index('idx_audit_trail_resource_type', table_name='audit_trail')
    op.drop_index('idx_audit_trail_action', table_name='audit_trail')
    op.drop_index('idx_audit_trail_user_timestamp', table_name='audit_trail')
    
    op.drop_index('idx_framework_outputs_created_at', table_name='framework_outputs')
    op.drop_index('idx_framework_outputs_pipeline_framework', table_name='framework_outputs')
    
    op.drop_index('idx_data_quality_score', table_name='data_quality_assessments')
    op.drop_index('idx_data_quality_dataset_created', table_name='data_quality_assessments')
    
    op.drop_index('idx_preparation_steps_pipeline_order', table_name='preparation_steps')
    op.drop_index('idx_data_prep_pipelines_status', table_name='data_preparation_pipelines')
    op.drop_index('idx_data_prep_pipelines_user_created', table_name='data_preparation_pipelines')
    
    op.drop_index('idx_dataset_versions_created_at', table_name='dataset_versions')
    op.drop_index('idx_dataset_versions_dataset_version', table_name='dataset_versions')
    op.drop_index('idx_datasets_name', table_name='datasets')
    op.drop_index('idx_datasets_user_created', table_name='datasets')
    
    op.drop_index('idx_usage_metrics_recorded_at', table_name='usage_metrics')
    op.drop_index('idx_usage_metrics_metric_type', table_name='usage_metrics')
    op.drop_index('idx_usage_metrics_user_date', table_name='usage_metrics')
    
    op.drop_index('idx_audit_logs_resource_type', table_name='audit_logs')
    op.drop_index('idx_audit_logs_timestamp', table_name='audit_logs')
    op.drop_index('idx_audit_logs_user_action', table_name='audit_logs')
    
    op.drop_index('idx_data_investigations_workspace_id', table_name='data_investigations')
    op.drop_index('idx_data_investigations_created_at', table_name='data_investigations')
    op.drop_index('idx_data_investigations_user_id', table_name='data_investigations')
    
    op.drop_index('idx_processing_jobs_workspace_id', table_name='processing_jobs')
    op.drop_index('idx_processing_jobs_created_at', table_name='processing_jobs')
    op.drop_index('idx_processing_jobs_status_created', table_name='processing_jobs')
    op.drop_index('idx_processing_jobs_user_status', table_name='processing_jobs')
    
    op.drop_index('idx_user_sessions_status', table_name='user_sessions')
    op.drop_index('idx_user_sessions_expires_at', table_name='user_sessions')
    op.drop_index('idx_user_sessions_user_active', table_name='user_sessions')
    
    op.drop_index('idx_api_keys_expires_at', table_name='api_keys')
    op.drop_index('idx_api_keys_key_prefix', table_name='api_keys')
    op.drop_index('idx_api_keys_user_active', table_name='api_keys')
    
    op.drop_index('idx_oauth_accounts_provider_id', table_name='oauth_accounts')
    op.drop_index('idx_oauth_accounts_provider_user', table_name='oauth_accounts')
    
    op.drop_index('idx_users_organization_id', table_name='users')
    op.drop_index('idx_users_role', table_name='users')
    op.drop_index('idx_users_created_at', table_name='users')
    op.drop_index('idx_users_email_active', table_name='users')