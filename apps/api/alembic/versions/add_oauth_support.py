"""add oauth support to users and oauth accounts table

Revision ID: add_oauth_support
Revises: 
Create Date: 2025-07-30 08:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_oauth_support'
down_revision = 'b4666f8be3af'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add OAuth columns to users table
    op.add_column('users', sa.Column('oauth_provider', sa.Enum('GOOGLE', 'GITHUB', 'FACEBOOK', 'MICROSOFT', name='oauthprovider'), nullable=True))
    op.add_column('users', sa.Column('oauth_provider_id', sa.String(), nullable=True))
    op.add_column('users', sa.Column('oauth_access_token', sa.String(), nullable=True))
    op.add_column('users', sa.Column('oauth_refresh_token', sa.String(), nullable=True))
    op.add_column('users', sa.Column('oauth_token_expires_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('oauth_profile_data', sa.JSON(), nullable=True))
    
    # Make hashed_password nullable for OAuth users
    op.alter_column('users', 'hashed_password', nullable=True)
    
    # Create oauth_accounts table
    op.create_table('oauth_accounts',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('provider', sa.Enum('GOOGLE', 'GITHUB', 'FACEBOOK', 'MICROSOFT', name='oauthprovider'), nullable=False),
        sa.Column('provider_user_id', sa.String(), nullable=False),
        sa.Column('provider_username', sa.String(), nullable=True),
        sa.Column('access_token', sa.String(), nullable=True),
        sa.Column('refresh_token', sa.String(), nullable=True),
        sa.Column('token_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('profile_data', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create unique index for OAuth provider and user ID combination
    op.create_index('ix_oauth_provider_user', 'oauth_accounts', ['provider', 'provider_user_id'], unique=True)


def downgrade() -> None:
    # Drop oauth_accounts table
    op.drop_index('ix_oauth_provider_user', table_name='oauth_accounts')
    op.drop_table('oauth_accounts')
    
    # Remove OAuth columns from users table
    op.drop_column('users', 'oauth_profile_data')
    op.drop_column('users', 'oauth_token_expires_at')
    op.drop_column('users', 'oauth_refresh_token')
    op.drop_column('users', 'oauth_access_token')
    op.drop_column('users', 'oauth_provider_id')
    op.drop_column('users', 'oauth_provider')
    
    # Make hashed_password not nullable again
    op.alter_column('users', 'hashed_password', nullable=False)
    
    # Drop the OAuth provider enum
    # Note: This requires checking if the enum is used elsewhere first
    op.execute("DROP TYPE IF EXISTS oauthprovider")