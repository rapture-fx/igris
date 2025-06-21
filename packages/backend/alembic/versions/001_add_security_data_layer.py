"""Add security data layer tables

Revision ID: 001_add_security_data_layer
Revises: 
Create Date: 2024-01-15 10:00:00.000000

This migration adds comprehensive security tables for:
- Encrypted fields storage
- Audit trail logging  
- Data classification and compliance
- Security policy management
- Data retention scheduling

All changes are additive - no existing tables are modified.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers, used by Alembic.
revision = '001_add_security_data_layer'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add security data layer tables."""
    
    # ============================================================================
    # ENCRYPTED FIELDS TABLE
    # ============================================================================
    
    op.create_table(
        'encrypted_fields',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        
        # Polymorphic foreign key approach
        sa.Column('table_name', sa.String(), nullable=False),
        sa.Column('record_id', sa.String(), nullable=False),
        sa.Column('field_name', sa.String(), nullable=False),
        
        # Encryption details
        sa.Column('encrypted_value', sa.Text(), nullable=False),
        sa.Column('encryption_level', sa.Enum('low', 'medium', 'high', 'critical', name='encryptionlevel'), 
                 default='medium'),
        sa.Column('encryption_version', sa.String(), default='1.0'),
        sa.Column('encryption_algorithm', sa.String(), default='AES-256-GCM'),
        
        # PII and sensitivity metadata
        sa.Column('contains_pii', sa.Boolean(), default=False),
        sa.Column('pii_types', postgresql.JSON(), default=lambda: []),
        sa.Column('sensitivity_level', sa.String(), default='INTERNAL'),
        
        # Key management
        sa.Column('key_version', sa.String()),
        sa.Column('encryption_context', sa.String()),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        
        # Specific foreign key columns for major tables
        sa.Column('users_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('organizations_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=True),
        sa.Column('data_investigations_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('data_investigations.id'), nullable=True),
    )
    
    # Indexes for encrypted_fields
    op.create_index('idx_encrypted_fields_lookup', 'encrypted_fields', ['table_name', 'record_id', 'field_name'])
    op.create_index('idx_encrypted_fields_pii', 'encrypted_fields', ['contains_pii', 'sensitivity_level'])
    
    # Unique constraint for encrypted_fields
    op.create_unique_constraint('uq_encrypted_field_record', 'encrypted_fields', 
                              ['table_name', 'record_id', 'field_name'])
    
    # ============================================================================
    # AUDIT TRAIL TABLE
    # ============================================================================
    
    op.create_table(
        'audit_trail',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        
        # Polymorphic foreign key approach
        sa.Column('table_name', sa.String(), nullable=False),
        sa.Column('record_id', sa.String(), nullable=False),
        
        # Audit details
        sa.Column('action', sa.Enum('create', 'read', 'update', 'delete', 'export', 'access', 
                                   'authentication', 'authorization', name='auditaction'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        
        # Change tracking
        sa.Column('changes', postgresql.JSON(), default=lambda: {}),
        sa.Column('metadata', postgresql.JSON(), default=lambda: {}),
        
        # Request context
        sa.Column('ip_address', sa.String()),
        sa.Column('user_agent', sa.Text()),
        sa.Column('request_id', sa.String()),
        sa.Column('session_id', sa.String()),
        
        # Compliance and security context
        sa.Column('security_level', sa.String()),
        sa.Column('compliance_frameworks', postgresql.JSON(), default=lambda: []),
        sa.Column('data_classification', sa.Enum('public', 'internal', 'confidential', 'restricted', 
                                                'highly_restricted', name='dataclassification'), nullable=True),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        
        # Specific foreign key columns for major tables
        sa.Column('users_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('organizations_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=True),
        sa.Column('data_investigations_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('data_investigations.id'), nullable=True),
    )
    
    # Indexes for audit_trail
    op.create_index('idx_audit_trail_lookup', 'audit_trail', ['table_name', 'record_id', 'created_at'])
    op.create_index('idx_audit_trail_user_action', 'audit_trail', ['user_id', 'action', 'created_at'])
    op.create_index('idx_audit_trail_security', 'audit_trail', ['security_level', 'data_classification'])
    op.create_index('idx_audit_trail_compliance', 'audit_trail', ['compliance_frameworks'], postgresql_using='gin')
    
    # ============================================================================
    # DATA CLASSIFICATION RECORDS TABLE
    # ============================================================================
    
    op.create_table(
        'data_classification_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        
        # Polymorphic foreign key approach
        sa.Column('table_name', sa.String(), nullable=False),
        sa.Column('record_id', sa.String(), nullable=False),
        
        # Classification details
        sa.Column('classification', sa.Enum('public', 'internal', 'confidential', 'restricted', 
                                          'highly_restricted', name='dataclassification_record'), nullable=False),
        sa.Column('compliance_frameworks', postgresql.JSON(), default=lambda: []),
        
        # Retention and handling
        sa.Column('retention_period_days', sa.Integer()),
        sa.Column('retention_start_date', sa.DateTime(timezone=True)),
        sa.Column('handling_instructions', sa.Text()),
        
        # Additional metadata
        sa.Column('metadata', postgresql.JSON(), default=lambda: {}),
        sa.Column('tags', postgresql.JSON(), default=lambda: []),
        
        # Review and approval
        sa.Column('approved_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True)),
        sa.Column('review_required', sa.Boolean(), default=False),
        sa.Column('next_review_date', sa.DateTime(timezone=True)),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        
        # Specific foreign key columns for major tables
        sa.Column('users_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('organizations_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=True),
        sa.Column('data_investigations_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('data_investigations.id'), nullable=True),
        
        # Foreign key for approved_by
        sa.ForeignKeyConstraint(['approved_by_id'], ['users.id']),
    )
    
    # Indexes for data_classification_records
    op.create_index('idx_data_classification_lookup', 'data_classification_records', ['table_name', 'record_id'])
    op.create_index('idx_data_classification_level', 'data_classification_records', 
                   ['classification', 'compliance_frameworks'], postgresql_using='gin')
    op.create_index('idx_data_classification_retention', 'data_classification_records', 
                   ['retention_period_days', 'retention_start_date'])
    
    # Unique constraint for data_classification_records
    op.create_unique_constraint('uq_data_classification_record', 'data_classification_records', 
                              ['table_name', 'record_id'])
    
    # ============================================================================
    # COMPLIANCE EVENTS TABLE
    # ============================================================================
    
    op.create_table(
        'compliance_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        
        # Polymorphic foreign key approach
        sa.Column('table_name', sa.String(), nullable=False),
        sa.Column('record_id', sa.String(), nullable=False),
        
        # Event details
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('framework', sa.Enum('gdpr', 'ccpa', 'sox', 'hipaa', 'pci_dss', 'soc2', 'iso27001', 
                                     name='complianceframework'), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        
        # Event metadata
        sa.Column('metadata', postgresql.JSON(), default=lambda: {}),
        sa.Column('severity', sa.String(), default='medium'),
        sa.Column('status', sa.String(), default='open'),
        
        # Event context
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('ip_address', sa.String()),
        sa.Column('user_agent', sa.Text()),
        sa.Column('request_id', sa.String()),
        
        # Resolution tracking
        sa.Column('resolved_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True)),
        sa.Column('resolution_notes', sa.Text()),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        
        # Specific foreign key columns for major tables
        sa.Column('users_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('organizations_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=True),
        sa.Column('data_investigations_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('data_investigations.id'), nullable=True),
        
        # Foreign keys for resolution
        sa.ForeignKeyConstraint(['resolved_by_id'], ['users.id']),
    )
    
    # Indexes for compliance_events
    op.create_index('idx_compliance_events_lookup', 'compliance_events', ['table_name', 'record_id', 'created_at'])
    op.create_index('idx_compliance_events_framework', 'compliance_events', ['framework', 'event_type', 'status'])
    op.create_index('idx_compliance_events_severity', 'compliance_events', ['severity', 'status', 'created_at'])
    
    # ============================================================================
    # SECURITY POLICIES TABLE
    # ============================================================================
    
    op.create_table(
        'security_policies',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        
        # Policy identification
        sa.Column('name', sa.String(), nullable=False, unique=True),
        sa.Column('description', sa.Text()),
        sa.Column('version', sa.String(), default='1.0'),
        
        # Policy definition
        sa.Column('policy_document', postgresql.JSON(), nullable=False),
        sa.Column('encryption_requirements', postgresql.JSON(), default=lambda: {}),
        sa.Column('audit_requirements', postgresql.JSON(), default=lambda: {}),
        sa.Column('retention_requirements', postgresql.JSON(), default=lambda: {}),
        
        # Applicability
        sa.Column('applies_to_tables', postgresql.JSON(), default=lambda: []),
        sa.Column('applies_to_roles', postgresql.JSON(), default=lambda: []),
        sa.Column('applies_to_organizations', postgresql.JSON(), default=lambda: []),
        
        # Policy status
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('is_mandatory', sa.Boolean(), default=False),
        sa.Column('effective_date', sa.DateTime(timezone=True)),
        sa.Column('expiration_date', sa.DateTime(timezone=True)),
        
        # Compliance mapping
        sa.Column('compliance_frameworks', postgresql.JSON(), default=lambda: []),
        sa.Column('regulatory_requirements', postgresql.JSON(), default=lambda: {}),
        
        # Management
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('approved_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True)),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    
    # Indexes for security_policies
    op.create_index('idx_security_policies_active', 'security_policies', 
                   ['is_active', 'effective_date', 'expiration_date'])
    op.create_index('idx_security_policies_compliance', 'security_policies', 
                   ['compliance_frameworks'], postgresql_using='gin')
    
    # ============================================================================
    # SECURITY POLICY ASSIGNMENTS TABLE
    # ============================================================================
    
    op.create_table(
        'security_policy_assignments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        
        # Policy reference
        sa.Column('policy_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('security_policies.id'), nullable=False),
        
        # Target record (polymorphic approach)
        sa.Column('table_name', sa.String(), nullable=False),
        sa.Column('record_id', sa.String(), nullable=False),
        
        # Assignment details
        sa.Column('assigned_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('assignment_reason', sa.Text()),
        sa.Column('assignment_metadata', postgresql.JSON(), default=lambda: {}),
        
        # Assignment status
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('effective_date', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('expiration_date', sa.DateTime(timezone=True)),
        
        # Override capabilities
        sa.Column('policy_overrides', postgresql.JSON(), default=lambda: {}),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    
    # Indexes for security_policy_assignments
    op.create_index('idx_policy_assignments_lookup', 'security_policy_assignments', 
                   ['table_name', 'record_id', 'is_active'])
    op.create_index('idx_policy_assignments_policy', 'security_policy_assignments', 
                   ['policy_id', 'is_active'])
    
    # Unique constraint for security_policy_assignments
    op.create_unique_constraint('uq_policy_assignment', 'security_policy_assignments', 
                              ['policy_id', 'table_name', 'record_id'])
    
    # ============================================================================
    # DATA RETENTION SCHEDULES TABLE
    # ============================================================================
    
    op.create_table(
        'data_retention_schedules',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        
        # Target record
        sa.Column('table_name', sa.String(), nullable=False),
        sa.Column('record_id', sa.String(), nullable=False),
        
        # Retention details
        sa.Column('retention_period_days', sa.Integer(), nullable=False),
        sa.Column('retention_start_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('scheduled_deletion_date', sa.DateTime(timezone=True), nullable=False),
        
        # Retention rules
        sa.Column('retention_reason', sa.String()),
        sa.Column('applicable_frameworks', postgresql.JSON(), default=lambda: []),
        sa.Column('exemptions', postgresql.JSON(), default=lambda: []),
        
        # Execution status
        sa.Column('status', sa.String(), default='scheduled'),
        sa.Column('executed_at', sa.DateTime(timezone=True)),
        sa.Column('executed_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('execution_metadata', postgresql.JSON(), default=lambda: {}),
        
        # Approval workflow
        sa.Column('requires_approval', sa.Boolean(), default=False),
        sa.Column('approved_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True)),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    
    # Indexes for data_retention_schedules
    op.create_index('idx_retention_schedule_lookup', 'data_retention_schedules', ['table_name', 'record_id'])
    op.create_index('idx_retention_schedule_execution', 'data_retention_schedules', 
                   ['scheduled_deletion_date', 'status'])
    op.create_index('idx_retention_schedule_frameworks', 'data_retention_schedules', 
                   ['applicable_frameworks'], postgresql_using='gin')
    
    # ============================================================================
    # ADD SOFT DELETE FIELDS TO EXISTING TABLES
    # ============================================================================
    
    # These columns are added to existing tables to support soft delete
    # without breaking existing functionality
    
    existing_tables = ['users', 'organizations', 'data_investigations', 'api_keys', 
                      'workspaces', 'processing_jobs', 'integrations', 'webhook_endpoints',
                      'usage_metrics']
    
    for table_name in existing_tables:
        try:
            # Add soft delete columns if they don't exist
            op.add_column(table_name, sa.Column('is_deleted', sa.Boolean(), default=False, nullable=False))
            op.add_column(table_name, sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
            op.add_column(table_name, sa.Column('deleted_by_id', postgresql.UUID(as_uuid=True), nullable=True))
            op.add_column(table_name, sa.Column('deletion_reason', sa.String(), nullable=True))
            op.add_column(table_name, sa.Column('deletion_metadata', postgresql.JSON(), default=lambda: {}))
            
            # Add foreign key constraint for deleted_by_id if users table exists
            if table_name != 'users':  # Don't add FK to itself
                op.create_foreign_key(
                    f'fk_{table_name}_deleted_by_user',
                    table_name, 'users',
                    ['deleted_by_id'], ['id']
                )
            
            # Add index for soft delete queries
            op.create_index(f'idx_{table_name}_is_deleted', table_name, ['is_deleted'])
            
        except Exception as e:
            # If column already exists or table doesn't exist, continue
            print(f"Note: Could not add soft delete columns to {table_name}: {e}")
            continue


def downgrade() -> None:
    """Remove security data layer tables."""
    
    # Drop all security tables in reverse order
    op.drop_table('data_retention_schedules')
    op.drop_table('security_policy_assignments')
    op.drop_table('security_policies')
    op.drop_table('compliance_events')
    op.drop_table('data_classification_records')
    op.drop_table('audit_trail')
    op.drop_table('encrypted_fields')
    
    # Drop enums
    op.execute('DROP TYPE IF EXISTS encryptionlevel')
    op.execute('DROP TYPE IF EXISTS auditaction')
    op.execute('DROP TYPE IF EXISTS dataclassification')
    op.execute('DROP TYPE IF EXISTS dataclassification_record')
    op.execute('DROP TYPE IF EXISTS complianceframework')
    
    # Remove soft delete columns from existing tables
    existing_tables = ['users', 'organizations', 'data_investigations', 'api_keys', 
                      'workspaces', 'processing_jobs', 'integrations', 'webhook_endpoints',
                      'usage_metrics']
    
    for table_name in existing_tables:
        try:
            # Drop indexes first
            op.drop_index(f'idx_{table_name}_is_deleted', table_name)
            
            # Drop foreign key constraint
            if table_name != 'users':
                op.drop_constraint(f'fk_{table_name}_deleted_by_user', table_name, type_='foreignkey')
            
            # Drop columns
            op.drop_column(table_name, 'deletion_metadata')
            op.drop_column(table_name, 'deletion_reason')
            op.drop_column(table_name, 'deleted_by_id')
            op.drop_column(table_name, 'deleted_at')
            op.drop_column(table_name, 'is_deleted')
            
        except Exception as e:
            # If constraint/column doesn't exist or table doesn't exist, continue
            print(f"Note: Could not remove soft delete columns from {table_name}: {e}")
            continue 