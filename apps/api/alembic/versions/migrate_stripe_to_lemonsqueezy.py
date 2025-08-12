"""Migrate from Stripe to LemonSqueezy

Revision ID: migrate_stripe_to_lemonsqueezy
Revises: b4666f8be3af
Create Date: 2025-07-31 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'migrate_stripe_to_lemonsqueezy'
down_revision = 'b4666f8be3af'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add LemonSqueezy fields to organizations and api_keys tables."""
    
    # Add LemonSqueezy fields to organizations table
    op.add_column('organizations', sa.Column('lemonsqueezy_subscription_id', sa.String(), nullable=True))
    op.add_column('organizations', sa.Column('lemonsqueezy_customer_id', sa.String(), nullable=True))
    
    # Add LemonSqueezy field to api_keys table
    op.add_column('api_keys', sa.Column('lemonsqueezy_subscription_id', sa.String(), nullable=True))
    
    # Create indexes for better performance
    op.create_index('ix_organizations_lemonsqueezy_subscription_id', 'organizations', ['lemonsqueezy_subscription_id'])
    op.create_index('ix_organizations_lemonsqueezy_customer_id', 'organizations', ['lemonsqueezy_customer_id'])
    op.create_index('ix_api_keys_lemonsqueezy_subscription_id', 'api_keys', ['lemonsqueezy_subscription_id'])


def downgrade() -> None:
    """Remove LemonSqueezy fields from organizations and api_keys tables."""
    
    # Drop indexes
    op.drop_index('ix_api_keys_lemonsqueezy_subscription_id', table_name='api_keys')
    op.drop_index('ix_organizations_lemonsqueezy_customer_id', table_name='organizations')
    op.drop_index('ix_organizations_lemonsqueezy_subscription_id', table_name='organizations')
    
    # Remove LemonSqueezy fields
    op.drop_column('api_keys', 'lemonsqueezy_subscription_id')
    op.drop_column('organizations', 'lemonsqueezy_customer_id')
    op.drop_column('organizations', 'lemonsqueezy_subscription_id')