"""Add monitoring and observability tables

Revision ID: 010
Revises: 009
Create Date: 2024-01-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '010'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade():
    # Create health check history table
    op.create_table(
        'health_check_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('service', sa.String(50), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('response_time', sa.Float(), nullable=True),
        sa.Column('details', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_health_check_service', 'health_check_history', ['service'])
    op.create_index('idx_health_check_status', 'health_check_history', ['status'])
    op.create_index('idx_health_check_created_at', 'health_check_history', ['created_at'])

    # Create metrics history table
    op.create_table(
        'metrics_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('metric_name', sa.String(100), nullable=False),
        sa.Column('metric_value', sa.Float(), nullable=False),
        sa.Column('metric_type', sa.String(20), nullable=False),
        sa.Column('labels', postgresql.JSONB(), nullable=True),
        sa.Column('timestamp', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_metrics_name', 'metrics_history', ['metric_name'])
    op.create_index('idx_metrics_type', 'metrics_history', ['metric_type'])
    op.create_index('idx_metrics_timestamp', 'metrics_history', ['timestamp'])

    # Create error tracking table
    op.create_table(
        'error_tracking',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('error_type', sa.String(100), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('severity', sa.String(20), nullable=False),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('stack_trace', sa.Text(), nullable=True),
        sa.Column('context', postgresql.JSONB(), nullable=True),
        sa.Column('user_id', sa.String(50), nullable=True),
        sa.Column('request_id', sa.String(50), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_error_type', 'error_tracking', ['error_type'])
    op.create_index('idx_error_severity', 'error_tracking', ['severity'])
    op.create_index('idx_error_category', 'error_tracking', ['category'])
    op.create_index('idx_error_created_at', 'error_tracking', ['created_at'])
    op.create_index('idx_error_user_id', 'error_tracking', ['user_id'])

    # Create performance monitoring table
    op.create_table(
        'performance_monitoring',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('endpoint', sa.String(200), nullable=False),
        sa.Column('method', sa.String(10), nullable=False),
        sa.Column('response_time', sa.Float(), nullable=False),
        sa.Column('status_code', sa.Integer(), nullable=False),
        sa.Column('request_size', sa.Integer(), nullable=True),
        sa.Column('response_size', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.String(50), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_performance_endpoint', 'performance_monitoring', ['endpoint'])
    op.create_index('idx_performance_method', 'performance_monitoring', ['method'])
    op.create_index('idx_performance_status_code', 'performance_monitoring', ['status_code'])
    op.create_index('idx_performance_created_at', 'performance_monitoring', ['created_at'])

    # Create system metrics table
    op.create_table(
        'system_metrics',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('cpu_usage', sa.Float(), nullable=False),
        sa.Column('memory_usage', sa.BigInteger(), nullable=False),
        sa.Column('memory_percent', sa.Float(), nullable=False),
        sa.Column('disk_usage', sa.BigInteger(), nullable=False),
        sa.Column('disk_percent', sa.Float(), nullable=False),
        sa.Column('network_bytes_sent', sa.BigInteger(), nullable=False),
        sa.Column('network_bytes_recv', sa.BigInteger(), nullable=False),
        sa.Column('active_connections', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_system_metrics_created_at', 'system_metrics', ['created_at'])

    # Create business metrics table
    op.create_table(
        'business_metrics',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('metric_name', sa.String(100), nullable=False),
        sa.Column('metric_value', sa.Float(), nullable=False),
        sa.Column('currency', sa.String(3), nullable=True),
        sa.Column('user_type', sa.String(50), nullable=True),
        sa.Column('plan_type', sa.String(50), nullable=True),
        sa.Column('additional_data', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_business_metrics_name', 'business_metrics', ['metric_name'])
    op.create_index('idx_business_metrics_created_at', 'business_metrics', ['created_at'])

    # Create alerting rules table
    op.create_table(
        'alerting_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('rule_name', sa.String(100), nullable=False),
        sa.Column('rule_type', sa.String(50), nullable=False),
        sa.Column('metric_name', sa.String(100), nullable=True),
        sa.Column('threshold', sa.Float(), nullable=False),
        sa.Column('operator', sa.String(10), nullable=False),  # >, <, >=, <=, ==
        sa.Column('severity', sa.String(20), nullable=False),
        sa.Column('message_template', sa.Text(), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_alerting_rules_type', 'alerting_rules', ['rule_type'])
    op.create_index('idx_alerting_rules_active', 'alerting_rules', ['is_active'])

    # Create alerts table
    op.create_table(
        'alerts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('rule_id', sa.Integer(), nullable=False),
        sa.Column('alert_type', sa.String(50), nullable=False),
        sa.Column('severity', sa.String(20), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('metric_value', sa.Float(), nullable=True),
        sa.Column('threshold_value', sa.Float(), nullable=True),
        sa.Column('context', postgresql.JSONB(), nullable=True),
        sa.Column('is_resolved', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('resolved_by', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['rule_id'], ['alerting_rules.id'], ondelete='CASCADE')
    )
    op.create_index('idx_alerts_type', 'alerts', ['alert_type'])
    op.create_index('idx_alerts_severity', 'alerts', ['severity'])
    op.create_index('idx_alerts_resolved', 'alerts', ['is_resolved'])
    op.create_index('idx_alerts_created_at', 'alerts', ['created_at'])

    # Create dashboard configurations table
    op.create_table(
        'dashboard_configs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('dashboard_type', sa.String(50), nullable=False),
        sa.Column('config_data', postgresql.JSONB(), nullable=False),
        sa.Column('is_default', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_by', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_dashboard_configs_type', 'dashboard_configs', ['dashboard_type'])
    op.create_index('idx_dashboard_configs_default', 'dashboard_configs', ['is_default'])


def downgrade():
    # Drop tables in reverse order
    op.drop_table('dashboard_configs')
    op.drop_table('alerts')
    op.drop_table('alerting_rules')
    op.drop_table('business_metrics')
    op.drop_table('system_metrics')
    op.drop_table('performance_monitoring')
    op.drop_table('error_tracking')
    op.drop_table('metrics_history')
    op.drop_table('health_check_history') 