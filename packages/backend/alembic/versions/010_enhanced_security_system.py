"""Enhanced Security System

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


def upgrade() -> None:
    # Create enum types
    op.execute("CREATE TYPE mfamethod AS ENUM ('totp', 'sms', 'email')")
    op.execute("CREATE TYPE sessionstatus AS ENUM ('active', 'expired', 'revoked', 'suspicious')")
    
    # Add enhanced security fields to users table
    op.add_column('users', sa.Column('mfa_enabled', sa.Boolean(), nullable=True, default=False))
    op.add_column('users', sa.Column('mfa_method', postgresql.ENUM('totp', 'sms', 'email', name='mfamethod'), nullable=True))
    op.add_column('users', sa.Column('mfa_secret', sa.String(), nullable=True))
    op.add_column('users', sa.Column('mfa_backup_codes', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('users', sa.Column('failed_login_attempts', sa.Integer(), nullable=True, default=0))
    op.add_column('users', sa.Column('account_locked_until', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('password_changed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('last_password_reset_request', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('security_questions', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    
    # Add enhanced fields to api_keys table
    op.add_column('api_keys', sa.Column('rate_limit', sa.Integer(), nullable=True))
    op.add_column('api_keys', sa.Column('usage_count', sa.Integer(), nullable=True, default=0))
    
    # Add enhanced fields to audit_logs table
    op.add_column('audit_logs', sa.Column('severity', sa.String(), nullable=True, default='info'))
    op.add_column('audit_logs', sa.Column('category', sa.String(), nullable=True))
    
    # Create user_sessions table
    op.create_table('user_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', sa.String(), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('ip_address', sa.String(), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('device_fingerprint', sa.String(), nullable=True),
        sa.Column('status', postgresql.ENUM('active', 'expired', 'revoked', 'suspicious', name='sessionstatus'), nullable=True, default='active'),
        sa.Column('security_level', sa.String(), nullable=True, default='medium'),
        sa.Column('mfa_verified', sa.Boolean(), nullable=True, default=False),
        sa.Column('risk_score', sa.Float(), nullable=True, default=0.0),
        sa.Column('metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('last_accessed', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_sessions_session_id'), 'user_sessions', ['session_id'], unique=True)
    
    # Create password_reset_tokens table
    op.create_table('password_reset_tokens',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('token', sa.String(), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=True, default='pending'),
        sa.Column('attempts', sa.Integer(), nullable=True, default=0),
        sa.Column('ip_address', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_password_reset_tokens_token'), 'password_reset_tokens', ['token'], unique=True)
    
    # Create encrypted_fields table
    op.create_table('encrypted_fields',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('field_name', sa.String(), nullable=False),
        sa.Column('encrypted_value', sa.Text(), nullable=False),
        sa.Column('encryption_key_id', sa.String(), nullable=True),
        sa.Column('users_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('organizations_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('data_investigations_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['data_investigations_id'], ['data_investigations.id'], ),
        sa.ForeignKeyConstraint(['organizations_id'], ['organizations.id'], ),
        sa.ForeignKeyConstraint(['users_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create audit_trail table
    op.create_table('audit_trail',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('event_data', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('ip_address', sa.String(), nullable=True),
        sa.Column('user_agent', sa.String(), nullable=True),
        sa.Column('users_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('organizations_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('data_investigations_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['data_investigations_id'], ['data_investigations.id'], ),
        sa.ForeignKeyConstraint(['organizations_id'], ['organizations.id'], ),
        sa.ForeignKeyConstraint(['users_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create data_classification_records table
    op.create_table('data_classification_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('classification_level', sa.String(), nullable=False),
        sa.Column('classification_reason', sa.String(), nullable=True),
        sa.Column('data_type', sa.String(), nullable=True),
        sa.Column('detection_method', sa.String(), nullable=True),
        sa.Column('users_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('organizations_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('data_investigations_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['data_investigations_id'], ['data_investigations.id'], ),
        sa.ForeignKeyConstraint(['organizations_id'], ['organizations.id'], ),
        sa.ForeignKeyConstraint(['users_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create compliance_events table
    op.create_table('compliance_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('compliance_standard', sa.String(), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('event_details', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('compliance_status', sa.String(), nullable=True),
        sa.Column('users_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('organizations_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('data_investigations_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['data_investigations_id'], ['data_investigations.id'], ),
        sa.ForeignKeyConstraint(['organizations_id'], ['organizations.id'], ),
        sa.ForeignKeyConstraint(['users_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    # Drop compliance_events table
    op.drop_table('compliance_events')
    
    # Drop data_classification_records table
    op.drop_table('data_classification_records')
    
    # Drop audit_trail table
    op.drop_table('audit_trail')
    
    # Drop encrypted_fields table
    op.drop_table('encrypted_fields')
    
    # Drop password_reset_tokens table
    op.drop_index(op.f('ix_password_reset_tokens_token'), table_name='password_reset_tokens')
    op.drop_table('password_reset_tokens')
    
    # Drop user_sessions table
    op.drop_index(op.f('ix_user_sessions_session_id'), table_name='user_sessions')
    op.drop_table('user_sessions')
    
    # Remove enhanced fields from audit_logs table
    op.drop_column('audit_logs', 'category')
    op.drop_column('audit_logs', 'severity')
    
    # Remove enhanced fields from api_keys table
    op.drop_column('api_keys', 'usage_count')
    op.drop_column('api_keys', 'rate_limit')
    
    # Remove enhanced security fields from users table
    op.drop_column('users', 'security_questions')
    op.drop_column('users', 'last_password_reset_request')
    op.drop_column('users', 'password_changed_at')
    op.drop_column('users', 'account_locked_until')
    op.drop_column('users', 'failed_login_attempts')
    op.drop_column('users', 'mfa_backup_codes')
    op.drop_column('users', 'mfa_secret')
    op.drop_column('users', 'mfa_method')
    op.drop_column('users', 'mfa_enabled')
    
    # Drop enum types
    op.execute("DROP TYPE sessionstatus")
    op.execute("DROP TYPE mfamethod") 