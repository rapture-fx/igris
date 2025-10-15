"""Add ML Lifecycle Management tables

Revision ID: 007_ml_lifecycle_management
Revises: 006_add_manufacturing_mes_tables
Create Date: 2024-09-15 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers, used by Alembic.
revision = '007_ml_lifecycle_management'
down_revision = '006_add_manufacturing_mes_tables'
branch_labels = None
depends_on = None


def upgrade():
    """Create ML lifecycle management tables"""

    # Create enum types
    model_status_enum = postgresql.ENUM(
        'DEVELOPMENT', 'TESTING', 'STAGING', 'PRODUCTION', 'ARCHIVED', 'DEPRECATED',
        name='modelstatus'
    )
    model_status_enum.create(op.get_bind())

    model_type_enum = postgresql.ENUM(
        'CLASSIFICATION', 'REGRESSION', 'CLUSTERING', 'TIME_SERIES',
        'NEURAL_NETWORK', 'ENSEMBLE', 'REINFORCEMENT_LEARNING',
        name='modeltype'
    )
    model_type_enum.create(op.get_bind())

    deployment_strategy_enum = postgresql.ENUM(
        'BLUE_GREEN', 'CANARY', 'ROLLING', 'SHADOW', 'A_B_TEST',
        name='deploymentstrategy'
    )
    deployment_strategy_enum.create(op.get_bind())

    performance_metric_type_enum = postgresql.ENUM(
        'ACCURACY', 'PRECISION', 'RECALL', 'F1_SCORE', 'AUC_ROC',
        'MSE', 'RMSE', 'MAE', 'R2_SCORE', 'CUSTOM',
        name='performancemetrictype'
    )
    performance_metric_type_enum.create(op.get_bind())

    alert_severity_enum = postgresql.ENUM(
        'LOW', 'MEDIUM', 'HIGH', 'CRITICAL',
        name='alertseverity'
    )
    alert_severity_enum.create(op.get_bind())

    # Create ml_model_registry table
    op.create_table(
        'ml_model_registry',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('name', sa.String(255), nullable=False, index=True),
        sa.Column('description', sa.Text),
        sa.Column('model_type', model_type_enum, nullable=False),
        sa.Column('framework', sa.String(100)),
        sa.Column('algorithm', sa.String(255)),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id')),
        sa.Column('tags', sa.JSON),
        sa.Column('business_context', sa.Text),
        sa.Column('use_case', sa.String(255)),
        sa.Column('current_status', model_status_enum, default='DEVELOPMENT'),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    # Create ml_model_versions table
    op.create_table(
        'ml_model_versions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('model_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ml_model_registry.id'), nullable=False),
        sa.Column('version_number', sa.String(50), nullable=False),
        sa.Column('version_hash', sa.String(64), unique=True, nullable=False),
        sa.Column('is_latest', sa.Boolean, default=False),
        sa.Column('artifact_path', sa.String(1000)),
        sa.Column('artifact_size_bytes', sa.Integer),
        sa.Column('artifact_checksum', sa.String(64)),
        sa.Column('training_dataset_id', postgresql.UUID(as_uuid=True)),
        sa.Column('training_config', sa.JSON),
        sa.Column('training_metrics', sa.JSON),
        sa.Column('training_duration_seconds', sa.Integer),
        sa.Column('model_parameters', sa.JSON),
        sa.Column('feature_schema', sa.JSON),
        sa.Column('model_size_mb', sa.Float),
        sa.Column('dependencies', sa.JSON),
        sa.Column('validation_metrics', sa.JSON),
        sa.Column('benchmark_metrics', sa.JSON),
        sa.Column('parent_version_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ml_model_versions.id')),
        sa.Column('lineage_metadata', sa.JSON),
        sa.Column('changelog', sa.Text),
        sa.Column('documentation', sa.Text),
        sa.Column('status', model_status_enum, default='DEVELOPMENT'),
        sa.Column('is_approved', sa.Boolean, default=False),
        sa.Column('approved_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('approved_at', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    # Create ml_model_deployments table
    op.create_table(
        'ml_model_deployments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('model_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ml_model_registry.id'), nullable=False),
        sa.Column('version_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ml_model_versions.id'), nullable=False),
        sa.Column('deployment_name', sa.String(255), nullable=False),
        sa.Column('environment', sa.String(100)),
        sa.Column('endpoint_url', sa.String(1000)),
        sa.Column('strategy', deployment_strategy_enum, default='ROLLING'),
        sa.Column('strategy_config', sa.JSON),
        sa.Column('traffic_percentage', sa.Float, default=100.0),
        sa.Column('target_instances', sa.Integer, default=1),
        sa.Column('current_instances', sa.Integer, default=0),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('health_check_url', sa.String(1000)),
        sa.Column('last_health_check', sa.DateTime(timezone=True)),
        sa.Column('health_status', sa.String(50)),
        sa.Column('performance_thresholds', sa.JSON),
        sa.Column('auto_rollback_enabled', sa.Boolean, default=True),
        sa.Column('deployed_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('deployment_config', sa.JSON),
        sa.Column('rollback_version_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ml_model_versions.id')),
        sa.Column('deployed_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('last_updated', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.Column('stopped_at', sa.DateTime(timezone=True)),
    )

    # Create ml_model_performance_metrics table
    op.create_table(
        'ml_model_performance_metrics',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('model_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ml_model_registry.id'), nullable=False),
        sa.Column('metric_name', sa.String(255), nullable=False),
        sa.Column('metric_type', performance_metric_type_enum, nullable=False),
        sa.Column('metric_description', sa.Text),
        sa.Column('warning_threshold', sa.Float),
        sa.Column('critical_threshold', sa.Float),
        sa.Column('target_value', sa.Float),
        sa.Column('higher_is_better', sa.Boolean, default=True),
        sa.Column('calculation_config', sa.JSON),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    # Create ml_model_performance_logs table
    op.create_table(
        'ml_model_performance_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('model_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ml_model_registry.id'), nullable=False),
        sa.Column('version_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ml_model_versions.id'), nullable=False),
        sa.Column('deployment_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ml_model_deployments.id')),
        sa.Column('metric_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ml_model_performance_metrics.id'), nullable=False),
        sa.Column('metric_value', sa.Float, nullable=False),
        sa.Column('evaluation_dataset_id', postgresql.UUID(as_uuid=True)),
        sa.Column('sample_size', sa.Integer),
        sa.Column('evaluation_context', sa.JSON),
        sa.Column('data_drift_score', sa.Float),
        sa.Column('model_confidence', sa.Float),
        sa.Column('computation_time_ms', sa.Integer),
        sa.Column('memory_usage_mb', sa.Float),
        sa.Column('measured_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Create ml_model_lineage table
    op.create_table(
        'ml_model_lineage',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('model_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ml_model_registry.id'), nullable=False),
        sa.Column('version_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ml_model_versions.id'), nullable=False),
        sa.Column('input_datasets', sa.JSON),
        sa.Column('feature_store_snapshots', sa.JSON),
        sa.Column('preprocessing_pipeline', sa.JSON),
        sa.Column('experiment_id', sa.String(255)),
        sa.Column('experiment_config', sa.JSON),
        sa.Column('hyperparameters', sa.JSON),
        sa.Column('code_repository', sa.String(500)),
        sa.Column('code_commit_hash', sa.String(64)),
        sa.Column('code_branch', sa.String(255)),
        sa.Column('environment_snapshot', sa.JSON),
        sa.Column('training_infrastructure', sa.JSON),
        sa.Column('training_start_time', sa.DateTime(timezone=True)),
        sa.Column('training_end_time', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Create ml_model_alerts table
    op.create_table(
        'ml_model_alerts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('model_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ml_model_registry.id'), nullable=False),
        sa.Column('deployment_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ml_model_deployments.id')),
        sa.Column('metric_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ml_model_performance_metrics.id')),
        sa.Column('alert_type', sa.String(100), nullable=False),
        sa.Column('severity', alert_severity_enum, nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('trigger_value', sa.Float),
        sa.Column('threshold_value', sa.Float),
        sa.Column('alert_data', sa.JSON),
        sa.Column('is_resolved', sa.Boolean, default=False),
        sa.Column('resolved_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('resolved_at', sa.DateTime(timezone=True)),
        sa.Column('resolution_notes', sa.Text),
        sa.Column('notification_channels', sa.JSON),
        sa.Column('notification_sent', sa.Boolean, default=False),
        sa.Column('notification_attempts', sa.Integer, default=0),
        sa.Column('triggered_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Create ml_model_audit_logs table
    op.create_table(
        'ml_model_audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('model_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ml_model_registry.id')),
        sa.Column('version_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ml_model_versions.id')),
        sa.Column('deployment_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ml_model_deployments.id')),
        sa.Column('action_type', sa.String(100), nullable=False),
        sa.Column('action_description', sa.Text),
        sa.Column('action_data', sa.JSON),
        sa.Column('performed_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('ip_address', sa.String(45)),
        sa.Column('user_agent', sa.String(500)),
        sa.Column('session_id', sa.String(255)),
        sa.Column('action_result', sa.String(50)),
        sa.Column('error_message', sa.Text),
        sa.Column('changes_made', sa.JSON),
        sa.Column('performed_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Create indexes for performance optimization

    # Model registry indexes
    op.create_index('idx_model_registry_name', 'ml_model_registry', ['name'])
    op.create_index('idx_model_registry_type', 'ml_model_registry', ['model_type'])
    op.create_index('idx_model_registry_status', 'ml_model_registry', ['current_status'])
    op.create_index('idx_model_registry_created_by', 'ml_model_registry', ['created_by'])

    # Model version indexes
    op.create_index('idx_model_version_model_id', 'ml_model_versions', ['model_id'])
    op.create_index('idx_model_version_number', 'ml_model_versions', ['version_number'])
    op.create_index('idx_model_version_hash', 'ml_model_versions', ['version_hash'])
    op.create_index('idx_model_version_latest', 'ml_model_versions', ['is_latest'])
    op.create_index('idx_model_version_status', 'ml_model_versions', ['status'])

    # Model deployment indexes
    op.create_index('idx_model_deployment_model_id', 'ml_model_deployments', ['model_id'])
    op.create_index('idx_model_deployment_version_id', 'ml_model_deployments', ['version_id'])
    op.create_index('idx_model_deployment_environment', 'ml_model_deployments', ['environment'])
    op.create_index('idx_model_deployment_active', 'ml_model_deployments', ['is_active'])

    # Performance metric indexes
    op.create_index('idx_model_metric_model_id', 'ml_model_performance_metrics', ['model_id'])
    op.create_index('idx_model_metric_name', 'ml_model_performance_metrics', ['metric_name'])
    op.create_index('idx_model_metric_type', 'ml_model_performance_metrics', ['metric_type'])

    # Performance log indexes
    op.create_index('idx_model_perf_log_model_id', 'ml_model_performance_logs', ['model_id'])
    op.create_index('idx_model_perf_log_version_id', 'ml_model_performance_logs', ['version_id'])
    op.create_index('idx_model_perf_log_deployment_id', 'ml_model_performance_logs', ['deployment_id'])
    op.create_index('idx_model_perf_log_metric_id', 'ml_model_performance_logs', ['metric_id'])
    op.create_index('idx_model_perf_log_measured_at', 'ml_model_performance_logs', ['measured_at'])

    # Lineage indexes
    op.create_index('idx_model_lineage_model_id', 'ml_model_lineage', ['model_id'])
    op.create_index('idx_model_lineage_version_id', 'ml_model_lineage', ['version_id'])
    op.create_index('idx_model_lineage_experiment_id', 'ml_model_lineage', ['experiment_id'])

    # Alert indexes
    op.create_index('idx_model_alert_model_id', 'ml_model_alerts', ['model_id'])
    op.create_index('idx_model_alert_deployment_id', 'ml_model_alerts', ['deployment_id'])
    op.create_index('idx_model_alert_severity', 'ml_model_alerts', ['severity'])
    op.create_index('idx_model_alert_resolved', 'ml_model_alerts', ['is_resolved'])
    op.create_index('idx_model_alert_triggered_at', 'ml_model_alerts', ['triggered_at'])

    # Audit log indexes
    op.create_index('idx_model_audit_model_id', 'ml_model_audit_logs', ['model_id'])
    op.create_index('idx_model_audit_performed_by', 'ml_model_audit_logs', ['performed_by'])
    op.create_index('idx_model_audit_action_type', 'ml_model_audit_logs', ['action_type'])
    op.create_index('idx_model_audit_performed_at', 'ml_model_audit_logs', ['performed_at'])


def downgrade():
    """Drop ML lifecycle management tables"""

    # Drop indexes first
    op.drop_index('idx_model_audit_performed_at', 'ml_model_audit_logs')
    op.drop_index('idx_model_audit_action_type', 'ml_model_audit_logs')
    op.drop_index('idx_model_audit_performed_by', 'ml_model_audit_logs')
    op.drop_index('idx_model_audit_model_id', 'ml_model_audit_logs')

    op.drop_index('idx_model_alert_triggered_at', 'ml_model_alerts')
    op.drop_index('idx_model_alert_resolved', 'ml_model_alerts')
    op.drop_index('idx_model_alert_severity', 'ml_model_alerts')
    op.drop_index('idx_model_alert_deployment_id', 'ml_model_alerts')
    op.drop_index('idx_model_alert_model_id', 'ml_model_alerts')

    op.drop_index('idx_model_lineage_experiment_id', 'ml_model_lineage')
    op.drop_index('idx_model_lineage_version_id', 'ml_model_lineage')
    op.drop_index('idx_model_lineage_model_id', 'ml_model_lineage')

    op.drop_index('idx_model_perf_log_measured_at', 'ml_model_performance_logs')
    op.drop_index('idx_model_perf_log_metric_id', 'ml_model_performance_logs')
    op.drop_index('idx_model_perf_log_deployment_id', 'ml_model_performance_logs')
    op.drop_index('idx_model_perf_log_version_id', 'ml_model_performance_logs')
    op.drop_index('idx_model_perf_log_model_id', 'ml_model_performance_logs')

    op.drop_index('idx_model_metric_type', 'ml_model_performance_metrics')
    op.drop_index('idx_model_metric_name', 'ml_model_performance_metrics')
    op.drop_index('idx_model_metric_model_id', 'ml_model_performance_metrics')

    op.drop_index('idx_model_deployment_active', 'ml_model_deployments')
    op.drop_index('idx_model_deployment_environment', 'ml_model_deployments')
    op.drop_index('idx_model_deployment_version_id', 'ml_model_deployments')
    op.drop_index('idx_model_deployment_model_id', 'ml_model_deployments')

    op.drop_index('idx_model_version_status', 'ml_model_versions')
    op.drop_index('idx_model_version_latest', 'ml_model_versions')
    op.drop_index('idx_model_version_hash', 'ml_model_versions')
    op.drop_index('idx_model_version_number', 'ml_model_versions')
    op.drop_index('idx_model_version_model_id', 'ml_model_versions')

    op.drop_index('idx_model_registry_created_by', 'ml_model_registry')
    op.drop_index('idx_model_registry_status', 'ml_model_registry')
    op.drop_index('idx_model_registry_type', 'ml_model_registry')
    op.drop_index('idx_model_registry_name', 'ml_model_registry')

    # Drop tables
    op.drop_table('ml_model_audit_logs')
    op.drop_table('ml_model_alerts')
    op.drop_table('ml_model_lineage')
    op.drop_table('ml_model_performance_logs')
    op.drop_table('ml_model_performance_metrics')
    op.drop_table('ml_model_deployments')
    op.drop_table('ml_model_versions')
    op.drop_table('ml_model_registry')

    # Drop enum types
    postgresql.ENUM(name='alertseverity').drop(op.get_bind())
    postgresql.ENUM(name='performancemetrictype').drop(op.get_bind())
    postgresql.ENUM(name='deploymentstrategy').drop(op.get_bind())
    postgresql.ENUM(name='modeltype').drop(op.get_bind())
    postgresql.ENUM(name='modelstatus').drop(op.get_bind())