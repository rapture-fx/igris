"""Add LemonSqueezy fields

Revision ID: 999_lemonsqueezy
Revises: 
Create Date: 2025-07-31 17:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '999_lemonsqueezy'
down_revision = None  # This will be a standalone migration
branch_labels = None
depends_on = None

def upgrade():
    """Add LemonSqueezy fields to organizations and api_keys tables"""
    
    # Add LemonSqueezy fields to organizations table if it exists
    try:
        op.add_column('organizations', sa.Column('lemonsqueezy_subscription_id', sa.String(length=255), nullable=True))
        op.add_column('organizations', sa.Column('lemonsqueezy_customer_id', sa.String(length=255), nullable=True))
        
        # Create indexes for performance
        op.create_index('idx_organizations_lemonsqueezy_subscription', 'organizations', ['lemonsqueezy_subscription_id'])
        op.create_index('idx_organizations_lemonsqueezy_customer', 'organizations', ['lemonsqueezy_customer_id'])
        
        print("✅ Added LemonSqueezy fields to organizations table")
    except Exception as e:
        print(f"⚠️  Organizations table may not exist or fields already added: {e}")
    
    # Add LemonSqueezy fields to api_keys table if it exists
    try:
        op.add_column('api_keys', sa.Column('lemonsqueezy_subscription_id', sa.String(length=255), nullable=True))
        
        # Create index for performance
        op.create_index('idx_api_keys_lemonsqueezy_subscription', 'api_keys', ['lemonsqueezy_subscription_id'])
        
        print("✅ Added LemonSqueezy fields to api_keys table")
    except Exception as e:
        print(f"⚠️  API keys table may not exist or fields already added: {e}")

def downgrade():
    """Remove LemonSqueezy fields"""
    
    # Remove from api_keys table
    try:
        op.drop_index('idx_api_keys_lemonsqueezy_subscription', table_name='api_keys')
        op.drop_column('api_keys', 'lemonsqueezy_subscription_id')
        print("✅ Removed LemonSqueezy fields from api_keys table")
    except Exception as e:
        print(f"⚠️  Could not remove from api_keys: {e}")
    
    # Remove from organizations table
    try:
        op.drop_index('idx_organizations_lemonsqueezy_customer', table_name='organizations')
        op.drop_index('idx_organizations_lemonsqueezy_subscription', table_name='organizations')
        op.drop_column('organizations', 'lemonsqueezy_customer_id')
        op.drop_column('organizations', 'lemonsqueezy_subscription_id')
        print("✅ Removed LemonSqueezy fields from organizations table")
    except Exception as e:
        print(f"⚠️  Could not remove from organizations: {e}")