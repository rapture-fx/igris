"""
Security Models for Database Layer

This module contains security-related database models that work alongside
the security mixins to provide comprehensive data protection without
modifying existing table structures.

Models:
- EncryptedField: Stores encrypted field data separately
- AuditTrail: Comprehensive audit logging for all model changes
- DataClassificationRecord: Data classification and compliance metadata
- ComplianceEvent: Compliance-related event tracking
- SecurityPolicy: Security policy definitions and assignments

All these models are additive and don't require changes to existing tables.
"""

import json
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from sqlalchemy import (
    Column, String, DateTime, Text, Boolean, JSON, ForeignKey, 
    Integer, Enum, Index, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func

from app.database.connection import Base
from app.database.security_enums import (
    EncryptionLevel, AuditAction, DataClassification, ComplianceFramework
)


# ============================================================================
# ENCRYPTED FIELDS TABLE
# ============================================================================

class EncryptedField(Base):
    """
    Stores encrypted field data for any model using EncryptedFieldsMixin.
    
    This table stores encrypted versions of sensitive fields from other tables
    without modifying the original table structures.
    """
    __tablename__ = "encrypted_fields"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign key references (polymorphic approach)
    table_name = Column(String, nullable=False, index=True)
    record_id = Column(String, nullable=False, index=True)  # String to support various ID types
    field_name = Column(String, nullable=False, index=True)
    
    # Encryption details
    encrypted_value = Column(Text, nullable=False)
    encryption_level = Column(Enum(EncryptionLevel), default=EncryptionLevel.MEDIUM)
    encryption_version = Column(String, default="1.0")
    encryption_algorithm = Column(String, default="AES-256-GCM")
    
    # PII and sensitivity metadata
    contains_pii = Column(Boolean, default=False)
    pii_types = Column(JSON, default=lambda: [])  # List of detected PII types
    sensitivity_level = Column(String, default="INTERNAL")
    
    # Key management
    key_version = Column(String)
    encryption_context = Column(String)  # Context used for encryption
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Specific foreign key columns for major tables
    users_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    organizations_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    data_investigations_id = Column(UUID(as_uuid=True), ForeignKey("data_investigations.id"), nullable=True)
    
    # Relationships (dynamically created by mixins)
    user = relationship("User", foreign_keys=[users_id], back_populates="encrypted_fields")
    organization = relationship("Organization", foreign_keys=[organizations_id], back_populates="encrypted_fields")
    data_investigation = relationship("DataInvestigation", foreign_keys=[data_investigations_id], back_populates="encrypted_fields")
    
    # Composite indexes for performance
    __table_args__ = (
        Index('idx_encrypted_fields_lookup', 'table_name', 'record_id', 'field_name'),
        Index('idx_encrypted_fields_pii', 'contains_pii', 'sensitivity_level'),
        UniqueConstraint('table_name', 'record_id', 'field_name', name='uq_encrypted_field_record'),
    )
    
    def __repr__(self):
        return f"<EncryptedField(table={self.table_name}, record={self.record_id}, field={self.field_name})>"


# ============================================================================
# AUDIT TRAIL TABLE
# ============================================================================

class AuditTrail(Base):
    """
    Comprehensive audit trail for all model changes.
    
    Tracks create, read, update, delete operations on any model
    using AuditTrailMixin without modifying original tables.
    """
    __tablename__ = "audit_trail"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign key references (polymorphic approach)
    table_name = Column(String, nullable=False, index=True)
    record_id = Column(String, nullable=False, index=True)
    
    # Audit details
    action = Column(Enum(AuditAction), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # Change tracking
    changes = Column(JSON, default=lambda: {})  # Before/after values
    extra_metadata = Column(JSON, default=lambda: {})  # Additional context
    
    # Request context
    ip_address = Column(String)
    user_agent = Column(Text)
    request_id = Column(String)  # Correlation with request logs
    session_id = Column(String)
    
    # Compliance and security context
    security_level = Column(String)
    compliance_frameworks = Column(JSON, default=lambda: [])
    data_classification = Column(Enum(DataClassification), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Specific foreign key columns for major tables
    users_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    organizations_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    data_investigations_id = Column(UUID(as_uuid=True), ForeignKey("data_investigations.id"), nullable=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[users_id], back_populates="audit_trail")
    organization = relationship("Organization", foreign_keys=[organizations_id], back_populates="audit_trail")
    data_investigation = relationship("DataInvestigation", foreign_keys=[data_investigations_id], back_populates="audit_trail")
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_audit_trail_lookup', 'table_name', 'record_id', 'created_at'),
        Index('idx_audit_trail_user_action', 'user_id', 'action', 'created_at'),
        Index('idx_audit_trail_security', 'security_level', 'data_classification'),
        Index('idx_audit_trail_compliance', 'compliance_frameworks', postgresql_using='gin'),
    )
    
    def __repr__(self):
        return f"<AuditTrail(table={self.table_name}, action={self.action}, user={self.user_id})>"


# ============================================================================
# DATA CLASSIFICATION TABLE
# ============================================================================

class DataClassificationRecord(Base):
    """
    Data classification and compliance metadata for any model.
    
    Stores classification information separately without modifying
    original table structures.
    """
    __tablename__ = "data_classification_records"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign key references (polymorphic approach)
    table_name = Column(String, nullable=False, index=True)
    record_id = Column(String, nullable=False, index=True)
    
    # Classification details
    classification = Column(Enum(DataClassification), nullable=False, index=True)
    compliance_frameworks = Column(JSON, default=lambda: [])  # List of applicable frameworks
    
    # Retention and handling
    retention_period_days = Column(Integer)
    retention_start_date = Column(DateTime(timezone=True))
    handling_instructions = Column(Text)
    
    # Additional metadata
    extra_metadata = Column(JSON, default=lambda: {})
    tags = Column(JSON, default=lambda: [])  # Classification tags
    
    # Review and approval
    approved_by_id = Column(UUID(as_uuid=True), nullable=True)
    approved_at = Column(DateTime(timezone=True))
    review_required = Column(Boolean, default=False)
    next_review_date = Column(DateTime(timezone=True))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Specific foreign key columns for major tables
    users_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    organizations_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    data_investigations_id = Column(UUID(as_uuid=True), ForeignKey("data_investigations.id"), nullable=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[users_id], back_populates="data_classification")
    organization = relationship("Organization", foreign_keys=[organizations_id], back_populates="data_classification")
    data_investigation = relationship("DataInvestigation", foreign_keys=[data_investigations_id], back_populates="data_classification")
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    
    # Indexes and constraints
    __table_args__ = (
        Index('idx_data_classification_lookup', 'table_name', 'record_id'),
        Index('idx_data_classification_level', 'classification', 'compliance_frameworks', postgresql_using='gin'),
        Index('idx_data_classification_retention', 'retention_period_days', 'retention_start_date'),
        UniqueConstraint('table_name', 'record_id', name='uq_data_classification_record'),
    )
    
    def __repr__(self):
        return f"<DataClassificationRecord(table={self.table_name}, classification={self.classification})>"


# ============================================================================
# COMPLIANCE EVENTS TABLE
# ============================================================================

class ComplianceEvent(Base):
    """
    Compliance-related event tracking for any model.
    
    Tracks compliance events, violations, and remediation actions
    without modifying original table structures.
    """
    __tablename__ = "compliance_events"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Foreign key references (polymorphic approach)
    table_name = Column(String, nullable=False, index=True)
    record_id = Column(String, nullable=False, index=True)
    
    # Event details
    event_type = Column(String, nullable=False, index=True)  # access, export, deletion, breach, etc.
    framework = Column(Enum(ComplianceFramework), nullable=False, index=True)
    description = Column(Text, nullable=False)
    
    # Event metadata
    extra_metadata = Column(JSON, default=lambda: {})
    severity = Column(String, default="medium")  # low, medium, high, critical
    status = Column(String, default="open")  # open, investigating, resolved, closed
    
    # Event context
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    ip_address = Column(String)
    user_agent = Column(Text)
    request_id = Column(String)
    
    # Resolution tracking
    resolved_by_id = Column(UUID(as_uuid=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True))
    resolution_notes = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Specific foreign key columns for major tables
    users_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    organizations_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    data_investigations_id = Column(UUID(as_uuid=True), ForeignKey("data_investigations.id"), nullable=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[users_id], back_populates="compliance_events")
    organization = relationship("Organization", foreign_keys=[organizations_id], back_populates="compliance_events")
    data_investigation = relationship("DataInvestigation", foreign_keys=[data_investigations_id], back_populates="compliance_events")
    resolved_by = relationship("User", foreign_keys=[resolved_by_id])
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_compliance_events_lookup', 'table_name', 'record_id', 'created_at'),
        Index('idx_compliance_events_framework', 'framework', 'event_type', 'status'),
        Index('idx_compliance_events_severity', 'severity', 'status', 'created_at'),
    )
    
    def __repr__(self):
        return f"<ComplianceEvent(type={self.event_type}, framework={self.framework}, severity={self.severity})>"


# ============================================================================
# SECURITY POLICY TABLE
# ============================================================================

class SecurityPolicy(Base):
    """
    Security policy definitions and assignments.
    
    Defines security policies that can be applied to different
    models and records without modifying original tables.
    """
    __tablename__ = "security_policies"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Policy identification
    name = Column(String, nullable=False, unique=True, index=True)
    description = Column(Text)
    version = Column(String, default="1.0")
    
    # Policy definition
    policy_document = Column(JSON, nullable=False)  # Detailed policy rules
    encryption_requirements = Column(JSON, default=lambda: {})
    audit_requirements = Column(JSON, default=lambda: {})
    retention_requirements = Column(JSON, default=lambda: {})
    
    # Applicability
    applies_to_tables = Column(JSON, default=lambda: [])  # List of table names
    applies_to_roles = Column(JSON, default=lambda: [])  # List of user roles
    applies_to_organizations = Column(JSON, default=lambda: [])  # List of organization IDs
    
    # Policy status
    is_active = Column(Boolean, default=True, index=True)
    is_mandatory = Column(Boolean, default=False)
    effective_date = Column(DateTime(timezone=True))
    expiration_date = Column(DateTime(timezone=True))
    
    # Compliance mapping
    compliance_frameworks = Column(JSON, default=lambda: [])
    regulatory_requirements = Column(JSON, default=lambda: {})
    
    # Management
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    policy_assignments = relationship("SecurityPolicyAssignment", back_populates="policy", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index('idx_security_policies_active', 'is_active', 'effective_date', 'expiration_date'),
        Index('idx_security_policies_compliance', 'compliance_frameworks', postgresql_using='gin'),
    )
    
    def __repr__(self):
        return f"<SecurityPolicy(name={self.name}, version={self.version}, active={self.is_active})>"


# ============================================================================
# SECURITY POLICY ASSIGNMENT TABLE
# ============================================================================

class SecurityPolicyAssignment(Base):
    """
    Individual security policy assignments to specific records.
    
    Tracks which security policies are applied to which records
    without modifying original table structures.
    """
    __tablename__ = "security_policy_assignments"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Policy reference
    policy_id = Column(UUID(as_uuid=True), ForeignKey("security_policies.id"), nullable=False)
    
    # Target record (polymorphic approach)
    table_name = Column(String, nullable=False, index=True)
    record_id = Column(String, nullable=False, index=True)
    
    # Assignment details
    assigned_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    assignment_reason = Column(Text)
    assignment_metadata = Column(JSON, default=lambda: {})
    
    # Assignment status
    is_active = Column(Boolean, default=True, index=True)
    effective_date = Column(DateTime(timezone=True), server_default=func.now())
    expiration_date = Column(DateTime(timezone=True))
    
    # Override capabilities
    policy_overrides = Column(JSON, default=lambda: {})  # Policy modifications for this assignment
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    policy = relationship("SecurityPolicy", back_populates="policy_assignments")
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])
    
    # Indexes and constraints
    __table_args__ = (
        Index('idx_policy_assignments_lookup', 'table_name', 'record_id', 'is_active'),
        Index('idx_policy_assignments_policy', 'policy_id', 'is_active'),
        UniqueConstraint('policy_id', 'table_name', 'record_id', name='uq_policy_assignment'),
    )
    
    def __repr__(self):
        return f"<SecurityPolicyAssignment(policy={self.policy_id}, table={self.table_name}, record={self.record_id})>"


# ============================================================================
# DATA RETENTION SCHEDULE TABLE
# ============================================================================

class DataRetentionSchedule(Base):
    """
    Data retention schedule for compliance and governance.
    
    Tracks when data should be archived or deleted based on
    retention policies without modifying original tables.
    """
    __tablename__ = "data_retention_schedules"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Target record
    table_name = Column(String, nullable=False, index=True)
    record_id = Column(String, nullable=False, index=True)
    
    # Retention details
    retention_period_days = Column(Integer, nullable=False)
    retention_start_date = Column(DateTime(timezone=True), nullable=False)
    scheduled_deletion_date = Column(DateTime(timezone=True), nullable=False, index=True)
    
    # Retention rules
    retention_reason = Column(String)  # legal_hold, compliance, business_need
    applicable_frameworks = Column(JSON, default=lambda: [])
    exemptions = Column(JSON, default=lambda: [])  # Reasons to delay deletion
    
    # Execution status
    status = Column(String, default="scheduled", index=True)  # scheduled, executed, exempted, cancelled
    executed_at = Column(DateTime(timezone=True))
    executed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    execution_metadata = Column(JSON, default=lambda: {})
    
    # Approval workflow
    requires_approval = Column(Boolean, default=False)
    approved_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    executed_by = relationship("User", foreign_keys=[executed_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    
    # Indexes
    __table_args__ = (
        Index('idx_retention_schedule_lookup', 'table_name', 'record_id'),
        Index('idx_retention_schedule_execution', 'scheduled_deletion_date', 'status'),
        Index('idx_retention_schedule_frameworks', 'applicable_frameworks', postgresql_using='gin'),
    )
    
    def __repr__(self):
        return f"<DataRetentionSchedule(table={self.table_name}, deletion_date={self.scheduled_deletion_date})>"


# Export all security models
__all__ = [
    'EncryptedField',
    'AuditTrail',
    'DataClassificationRecord',
    'ComplianceEvent',
    'SecurityPolicy',
    'SecurityPolicyAssignment',
    'DataRetentionSchedule'
] 