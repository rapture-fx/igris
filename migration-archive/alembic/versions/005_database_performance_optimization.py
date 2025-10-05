"""Database performance optimization - JSON indexing and strategic indexes

Revision ID: 005_database_performance_optimization
Revises: 004_add_rl_optimization_tables
Create Date: 2025-08-31 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '005_database_performance_optimization'
down_revision = '004_add_rl_optimization_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add comprehensive database performance optimizations."""
    
    # ==================== JSON COLUMN OPTIMIZATIONS ====================
    
    # Users table JSON optimizations
    op.create_index('idx_users_oauth_profile_gin', 'users', ['oauth_profile_data'], postgresql_using='gin')
    op.create_index('idx_users_mfa_backup_codes_gin', 'users', ['mfa_backup_codes'], postgresql_using='gin')
    op.create_index('idx_users_security_questions_gin', 'users', ['security_questions'], postgresql_using='gin')
    
    # Organizations table JSON optimizations
    op.create_index('idx_organizations_settings_gin', 'organizations', ['settings'], postgresql_using='gin')
    
    # OAuth accounts JSON optimizations
    op.create_index('idx_oauth_accounts_profile_data_gin', 'oauth_accounts', ['profile_data'], postgresql_using='gin')
    
    # Workspaces JSON optimizations
    op.create_index('idx_workspaces_settings_gin', 'workspaces', ['settings'], postgresql_using='gin')
    
    # API keys JSON optimizations
    op.create_index('idx_api_keys_permissions_gin', 'api_keys', ['permissions'], postgresql_using='gin')
    
    # User sessions JSON optimizations
    op.create_index('idx_user_sessions_metadata_gin', 'user_sessions', ['session_metadata'], postgresql_using='gin')
    
    # Data investigations JSON optimizations - critical for performance
    op.create_index('idx_data_investigations_source_config_gin', 'data_investigations', ['data_source_config'], postgresql_using='gin')
    op.create_index('idx_data_investigations_schema_info_gin', 'data_investigations', ['schema_info'], postgresql_using='gin')
    op.create_index('idx_data_investigations_analysis_config_gin', 'data_investigations', ['analysis_config'], postgresql_using='gin')
    op.create_index('idx_data_investigations_anomalies_gin', 'data_investigations', ['anomalies_detected'], postgresql_using='gin')
    op.create_index('idx_data_investigations_patterns_gin', 'data_investigations', ['patterns_found'], postgresql_using='gin')
    op.create_index('idx_data_investigations_recommendations_gin', 'data_investigations', ['recommendations'], postgresql_using='gin')
    
    # Processing jobs JSON optimizations
    op.create_index('idx_processing_jobs_config_gin', 'processing_jobs', ['config'], postgresql_using='gin')
    op.create_index('idx_processing_jobs_output_summary_gin', 'processing_jobs', ['output_summary'], postgresql_using='gin')
    
    # Integrations JSON optimizations
    op.create_index('idx_integrations_config_gin', 'integrations', ['config'], postgresql_using='gin')
    
    # Audit logs JSON optimizations
    op.create_index('idx_audit_logs_details_gin', 'audit_logs', ['details'], postgresql_using='gin')
    
    # Webhook endpoints JSON optimizations
    op.create_index('idx_webhook_endpoints_events_gin', 'webhook_endpoints', ['events'], postgresql_using='gin')
    
    # Feedback learning JSON optimizations
    op.create_index('idx_user_feedback_context_data_gin', 'user_feedback', ['context_data'], postgresql_using='gin')
    op.create_index('idx_user_learning_profiles_preferences_gin', 'user_learning_profiles', ['preferences'], postgresql_using='gin')
    op.create_index('idx_user_learning_profiles_behavior_gin', 'user_learning_profiles', ['behavior_patterns'], postgresql_using='gin')
    op.create_index('idx_learning_rules_condition_gin', 'learning_rules', ['condition'], postgresql_using='gin')
    op.create_index('idx_learning_rules_action_gin', 'learning_rules', ['action'], postgresql_using='gin')
    op.create_index('idx_ab_tests_variants_gin', 'ab_tests', ['variants'], postgresql_using='gin')
    op.create_index('idx_ab_tests_results_gin', 'ab_tests', ['results'], postgresql_using='gin')
    op.create_index('idx_ab_test_results_context_gin', 'ab_test_results', ['context_data'], postgresql_using='gin')
    
    # ==================== STRATEGIC COMPOSITE INDEXES ====================
    
    # Critical foreign key + status/date combinations for frequent queries
    op.create_index('idx_data_investigations_workspace_status', 'data_investigations', ['workspace_id', 'status', 'created_at'])
    op.create_index('idx_data_investigations_user_status', 'data_investigations', ['created_by_id', 'status', 'updated_at'])
    op.create_index('idx_processing_jobs_investigation_status', 'processing_jobs', ['investigation_id', 'status', 'created_at'])
    
    # User activity and security patterns
    op.create_index('idx_users_org_role_active_created', 'users', ['organization_id', 'role', 'is_active', 'created_at'])
    op.create_index('idx_user_sessions_user_status_accessed', 'user_sessions', ['user_id', 'status', 'last_accessed'])
    op.create_index('idx_api_keys_user_active_expires', 'api_keys', ['user_id', 'is_active', 'expires_at'])
    
    # Audit and monitoring patterns
    op.create_index('idx_audit_logs_user_action_created', 'audit_logs', ['user_id', 'action', 'created_at'])
    op.create_index('idx_audit_logs_resource_severity', 'audit_logs', ['resource_type', 'severity', 'created_at'])
    
    # Usage analytics patterns
    op.create_index('idx_usage_metrics_org_type_date', 'usage_metrics', ['organization_id', 'metric_type', 'recorded_at'])
    op.create_index('idx_usage_metrics_user_type_period', 'usage_metrics', ['user_id', 'metric_type', 'period_start', 'period_end'])
    
    # Feedback learning optimization patterns
    op.create_index('idx_user_feedback_user_type_rating', 'user_feedback', ['user_id', 'feedback_type', 'rating', 'created_at'])
    op.create_index('idx_user_feedback_org_service_sentiment', 'user_feedback', ['organization_id', 'service_name', 'sentiment', 'created_at'])
    op.create_index('idx_learning_rules_type_active_confidence', 'learning_rules', ['rule_type', 'is_active', 'confidence', 'last_validated'])
    op.create_index('idx_ab_test_results_test_user_variant', 'ab_test_results', ['test_id', 'user_id', 'variant_name', 'recorded_at'])
    
    # ==================== PARTIAL INDEXES FOR PERFORMANCE ====================
    
    # Active records only indexes
    op.create_index('idx_integrations_org_active', 'integrations', ['organization_id', 'integration_type'], postgresql_where=sa.text('is_active = true'))
    op.create_index('idx_learning_rules_active_validated', 'learning_rules', ['rule_type', 'confidence'], postgresql_where=sa.text('is_active = true'))
    
    # Recent activity indexes
    op.create_index('idx_user_sessions_recent_active', 'user_sessions', ['user_id', 'last_accessed'], 
                   postgresql_where=sa.text("status = 'active' AND last_accessed > NOW() - INTERVAL '24 hours'"))
    op.create_index('idx_processing_jobs_recent_running', 'processing_jobs', ['investigation_id', 'created_at'], 
                   postgresql_where=sa.text("status IN ('pending', 'running')"))
    op.create_index('idx_data_investigations_recent_active', 'data_investigations', ['workspace_id', 'updated_at'], 
                   postgresql_where=sa.text("status IN ('pending', 'running')"))
    
    # ==================== EXPRESSION INDEXES FOR COMPLEX QUERIES ====================
    
    # Email domain extraction for analytics
    op.create_index('idx_users_email_domain', 'users', [sa.text("split_part(email, '@', 2)")], postgresql_where=sa.text('is_active = true'))
    
    # Date truncation indexes for time-series queries
    op.create_index('idx_audit_logs_date_trunc_day', 'audit_logs', [sa.text("date_trunc('day', created_at)")], postgresql_where=sa.text("created_at >= NOW() - INTERVAL '90 days'"))
    op.create_index('idx_usage_metrics_date_trunc_hour', 'usage_metrics', [sa.text("date_trunc('hour', recorded_at)")], postgresql_where=sa.text("recorded_at >= NOW() - INTERVAL '30 days'"))
    
    # Text search optimization for data investigations
    op.create_index('idx_data_investigations_name_trgm', 'data_investigations', ['name'], postgresql_using='gin', postgresql_ops={'name': 'gin_trgm_ops'})
    op.create_index('idx_data_investigations_description_trgm', 'data_investigations', ['description'], postgresql_using='gin', postgresql_ops={'description': 'gin_trgm_ops'})
    
    # ==================== COVERING INDEXES FOR READ-HEAVY QUERIES ====================
    
    # User profile information with frequent columns
    op.create_index('idx_users_id_email_name_role', 'users', ['id', 'email', 'first_name', 'last_name', 'role', 'is_active'])
    
    # Data investigation summary information
    op.create_index('idx_data_investigations_summary', 'data_investigations', 
                   ['id', 'name', 'workspace_id', 'status', 'quality_score', 'created_at', 'updated_at'])


def downgrade() -> None:
    """Remove performance optimization indexes."""
    
    # Drop covering indexes
    op.drop_index('idx_data_investigations_summary', table_name='data_investigations')
    op.drop_index('idx_users_id_email_name_role', table_name='users')
    
    # Drop expression indexes
    op.drop_index('idx_data_investigations_description_trgm', table_name='data_investigations')
    op.drop_index('idx_data_investigations_name_trgm', table_name='data_investigations')
    op.drop_index('idx_usage_metrics_date_trunc_hour', table_name='usage_metrics')
    op.drop_index('idx_audit_logs_date_trunc_day', table_name='audit_logs')
    op.drop_index('idx_users_email_domain', table_name='users')
    
    # Drop partial indexes
    op.drop_index('idx_data_investigations_recent_active', table_name='data_investigations')
    op.drop_index('idx_processing_jobs_recent_running', table_name='processing_jobs')
    op.drop_index('idx_user_sessions_recent_active', table_name='user_sessions')
    op.drop_index('idx_learning_rules_active_validated', table_name='learning_rules')
    op.drop_index('idx_integrations_org_active', table_name='integrations')
    
    # Drop strategic composite indexes
    op.drop_index('idx_ab_test_results_test_user_variant', table_name='ab_test_results')
    op.drop_index('idx_learning_rules_type_active_confidence', table_name='learning_rules')
    op.drop_index('idx_user_feedback_org_service_sentiment', table_name='user_feedback')
    op.drop_index('idx_user_feedback_user_type_rating', table_name='user_feedback')
    op.drop_index('idx_usage_metrics_user_type_period', table_name='usage_metrics')
    op.drop_index('idx_usage_metrics_org_type_date', table_name='usage_metrics')
    op.drop_index('idx_audit_logs_resource_severity', table_name='audit_logs')
    op.drop_index('idx_audit_logs_user_action_created', table_name='audit_logs')
    op.drop_index('idx_api_keys_user_active_expires', table_name='api_keys')
    op.drop_index('idx_user_sessions_user_status_accessed', table_name='user_sessions')
    op.drop_index('idx_users_org_role_active_created', table_name='users')
    op.drop_index('idx_processing_jobs_investigation_status', table_name='processing_jobs')
    op.drop_index('idx_data_investigations_user_status', table_name='data_investigations')
    op.drop_index('idx_data_investigations_workspace_status', table_name='data_investigations')
    
    # Drop JSON GIN indexes
    op.drop_index('idx_ab_test_results_context_gin', table_name='ab_test_results')
    op.drop_index('idx_ab_tests_results_gin', table_name='ab_tests')
    op.drop_index('idx_ab_tests_variants_gin', table_name='ab_tests')
    op.drop_index('idx_learning_rules_action_gin', table_name='learning_rules')
    op.drop_index('idx_learning_rules_condition_gin', table_name='learning_rules')
    op.drop_index('idx_user_learning_profiles_behavior_gin', table_name='user_learning_profiles')
    op.drop_index('idx_user_learning_profiles_preferences_gin', table_name='user_learning_profiles')
    op.drop_index('idx_user_feedback_context_data_gin', table_name='user_feedback')
    op.drop_index('idx_webhook_endpoints_events_gin', table_name='webhook_endpoints')
    op.drop_index('idx_audit_logs_details_gin', table_name='audit_logs')
    op.drop_index('idx_integrations_config_gin', table_name='integrations')
    op.drop_index('idx_processing_jobs_output_summary_gin', table_name='processing_jobs')
    op.drop_index('idx_processing_jobs_config_gin', table_name='processing_jobs')
    op.drop_index('idx_data_investigations_recommendations_gin', table_name='data_investigations')
    op.drop_index('idx_data_investigations_patterns_gin', table_name='data_investigations')
    op.drop_index('idx_data_investigations_anomalies_gin', table_name='data_investigations')
    op.drop_index('idx_data_investigations_analysis_config_gin', table_name='data_investigations')
    op.drop_index('idx_data_investigations_schema_info_gin', table_name='data_investigations')
    op.drop_index('idx_data_investigations_source_config_gin', table_name='data_investigations')
    op.drop_index('idx_user_sessions_metadata_gin', table_name='user_sessions')
    op.drop_index('idx_api_keys_permissions_gin', table_name='api_keys')
    op.drop_index('idx_workspaces_settings_gin', table_name='workspaces')
    op.drop_index('idx_oauth_accounts_profile_data_gin', table_name='oauth_accounts')
    op.drop_index('idx_organizations_settings_gin', table_name='organizations')
    op.drop_index('idx_users_security_questions_gin', table_name='users')
    op.drop_index('idx_users_mfa_backup_codes_gin', table_name='users')
    op.drop_index('idx_users_oauth_profile_gin', table_name='users')