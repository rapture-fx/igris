"""add enhanced auth tables

Revision ID: add_enhanced_auth_tables
Revises: add_security_enhancements
Create Date: 2024-01-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_enhanced_auth_tables'
down_revision = 'add_security_enhancements'
branch_labels = None
depends_on = None

def upgrade() -> None:
    """Add enhanced authentication features"""
    
    # Add MFA columns to users table
    op.add_column('users', sa.Column('mfa_secret', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('mfa_enabled', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('mfa_backup_codes', sa.JSON(), nullable=True))
    op.add_column('users', sa.Column('password_changed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('failed_login_attempts', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('last_password_check', sa.DateTime(timezone=True), nullable=True))
    
    # Create user_sessions table for session management
    op.create_table('user_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', sa.String(255), nullable=False, unique=True),
        sa.Column('device_fingerprint', sa.String(255), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('location', sa.String(255), nullable=True),
        sa.Column('security_level', sa.Integer(), nullable=False, server_default='2'),
        sa.Column('mfa_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('risk_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('status', sa.Enum('active', 'expired', 'revoked', 'suspicious', 'locked', name='session_status'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_accessed', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.Index('idx_user_sessions_user_id', 'user_id'),
        sa.Index('idx_user_sessions_session_id', 'session_id'),
        sa.Index('idx_user_sessions_status', 'status'),
        sa.Index('idx_user_sessions_expires_at', 'expires_at')
    )
    
    # Create authentication_attempts table for tracking login attempts
    op.create_table('authentication_attempts',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('username', sa.String(255), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('method', sa.Enum('password', 'api_key', 'mfa_totp', 'mfa_sms', 'mfa_email', 'refresh_token', 'sso', name='auth_method'), nullable=False),
        sa.Column('success', sa.Boolean(), nullable=False),
        sa.Column('failure_reason', sa.String(255), nullable=True),
        sa.Column('risk_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.Index('idx_auth_attempts_username', 'username'),
        sa.Index('idx_auth_attempts_user_id', 'user_id'),
        sa.Index('idx_auth_attempts_timestamp', 'timestamp'),
        sa.Index('idx_auth_attempts_success', 'success'),
        sa.Index('idx_auth_attempts_ip_address', 'ip_address')
    )
    
    # Create password_history table for password reuse prevention
    op.create_table('password_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.Index('idx_password_history_user_id', 'user_id'),
        sa.Index('idx_password_history_created_at', 'created_at')
    )
    
    # Create refresh_tokens table for token management
    op.create_table('refresh_tokens',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', sa.String(255), nullable=False),
        sa.Column('token_hash', sa.String(255), nullable=False, unique=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.Index('idx_refresh_tokens_user_id', 'user_id'),
        sa.Index('idx_refresh_tokens_session_id', 'session_id'),
        sa.Index('idx_refresh_tokens_token_hash', 'token_hash'),
        sa.Index('idx_refresh_tokens_expires_at', 'expires_at'),
        sa.Index('idx_refresh_tokens_is_active', 'is_active')
    )
    
    # Create device_trust table for device fingerprinting
    op.create_table('device_trust',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('device_fingerprint', sa.String(255), nullable=False),
        sa.Column('device_name', sa.String(255), nullable=True),
        sa.Column('trust_level', sa.Enum('untrusted', 'pending', 'trusted', 'verified', name='trust_level'), nullable=False, server_default='untrusted'),
        sa.Column('first_seen', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_seen', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_id', 'device_fingerprint', name='uq_user_device_fingerprint'),
        sa.Index('idx_device_trust_user_id', 'user_id'),
        sa.Index('idx_device_trust_fingerprint', 'device_fingerprint'),
        sa.Index('idx_device_trust_level', 'trust_level')
    )
    
    # Create security_events table for audit logging
    op.create_table('security_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('event_type', sa.Enum(
            'login_success', 'login_failure', 'logout', 'password_change', 
            'mfa_setup', 'mfa_disable', 'session_revoked', 'account_locked',
            'account_unlocked', 'suspicious_activity', 'token_refresh',
            'api_key_created', 'api_key_revoked', 'profile_updated',
            name='security_event_type'
        ), nullable=False),
        sa.Column('severity', sa.Enum('low', 'medium', 'high', 'critical', name='event_severity'), nullable=False),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.Index('idx_security_events_user_id', 'user_id'),
        sa.Index('idx_security_events_type', 'event_type'),
        sa.Index('idx_security_events_severity', 'severity'),
        sa.Index('idx_security_events_timestamp', 'timestamp')
    )
    
    # Create password_policy_violations table for tracking policy violations
    op.create_table('password_policy_violations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('username', sa.String(255), nullable=False),
        sa.Column('violation_type', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.Index('idx_password_violations_user_id', 'user_id'),
        sa.Index('idx_password_violations_type', 'violation_type'),
        sa.Index('idx_password_violations_timestamp', 'timestamp')
    )
    
    # Add indexes for performance
    op.create_index('idx_users_mfa_enabled', 'users', ['mfa_enabled'])
    op.create_index('idx_users_locked_until', 'users', ['locked_until'])
    op.create_index('idx_users_failed_attempts', 'users', ['failed_login_attempts'])

def downgrade() -> None:
    """Remove enhanced authentication features"""
    
    # Drop tables in reverse order
    op.drop_table('password_policy_violations')
    op.drop_table('security_events')
    op.drop_table('device_trust')
    op.drop_table('refresh_tokens')
    op.drop_table('password_history')
    op.drop_table('authentication_attempts')
    op.drop_table('user_sessions')
    
    # Drop enums
    op.execute('DROP TYPE IF EXISTS security_event_type CASCADE')
    op.execute('DROP TYPE IF EXISTS event_severity CASCADE')
    op.execute('DROP TYPE IF EXISTS trust_level CASCADE')
    op.execute('DROP TYPE IF EXISTS auth_method CASCADE')
    op.execute('DROP TYPE IF EXISTS session_status CASCADE')
    
    # Drop indexes from users table
    op.drop_index('idx_users_failed_attempts', 'users')
    op.drop_index('idx_users_locked_until', 'users')
    op.drop_index('idx_users_mfa_enabled', 'users')
    
    # Remove columns from users table
    op.drop_column('users', 'last_password_check')
    op.drop_column('users', 'locked_until')
    op.drop_column('users', 'failed_login_attempts')
    op.drop_column('users', 'password_changed_at')
    op.drop_column('users', 'mfa_backup_codes')
    op.drop_column('users', 'mfa_enabled')
    op.drop_column('users', 'mfa_secret') 