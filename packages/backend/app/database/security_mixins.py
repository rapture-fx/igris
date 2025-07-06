"""
Security Mixins for Database Models

This module provides reusable mixins that add security features to existing models
without modifying the original table structures. These mixins create separate
tables for encrypted data, audit trails, and soft delete functionality.

Features:
- Encrypted fields mixin (separate encrypted_fields table)
- Audit trail mixin (separate audit_trail table)
- Soft delete mixin (additive fields)
- Data classification mixin
- Compliance tracking mixin

Usage:
    # Add encrypted fields to existing model
    class User(EncryptedFieldsMixin, Base):
        __tablename__ = "users"
        # existing fields...
        
        # Encrypted fields configuration
        _encrypted_fields_config = {
            'social_security_number': {'level': 'critical', 'pii': True},
            'credit_card_number': {'level': 'critical', 'pii': True},
            'phone_number': {'level': 'medium', 'pii': True}
        }
"""

import json
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Set
from sqlalchemy import Column, String, DateTime, Text, Boolean, JSON, ForeignKey, Integer, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, declared_attr, Session
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declared_attr
import enum
from sqlalchemy import event
from sqlalchemy.orm import attributes

from app.database.security_models import EncryptedField, DataClassificationRecord, ComplianceEvent
from app.security.encryption.field_encryption import field_encryptor
from app.security.encryption.pii_detector import pii_detector, SensitivityLevel
from app.database.security_models import AuditTrail
from app.database.connection import SessionLocal
from app.core.request_context import get_request_context


class EncryptionLevel(str, enum.Enum):
    """Encryption levels for different data sensitivity"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AuditAction(str, enum.Enum):
    """Types of audit actions"""
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    EXPORT = "export"
    ACCESS = "access"
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"


class DataClassification(str, enum.Enum):
    """Data classification levels"""
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"
    HIGHLY_RESTRICTED = "highly_restricted"


class ComplianceFramework(str, enum.Enum):
    """Compliance frameworks"""
    GDPR = "gdpr"
    CCPA = "ccpa"
    SOX = "sox"
    HIPAA = "hipaa"
    PCI_DSS = "pci_dss"
    SOC2 = "soc2"
    ISO27001 = "iso27001"


# ============================================================================
# ENCRYPTED FIELDS MIXIN
# ============================================================================

class EncryptedFieldsMixin:
    """
    Mixin to add encrypted field capabilities to existing models.
    
    Creates a separate encrypted_fields table that stores encrypted data
    linked to the original model via foreign key relationship.
    """
    
    # Configuration for encrypted fields (to be set in model classes)
    _encrypted_fields_config: Dict[str, Dict[str, Any]] = {}
    
    @declared_attr
    def encrypted_fields(cls):
        """Relationship to encrypted fields"""
        return relationship(
            "EncryptedField",
            foreign_keys=f"EncryptedField.{cls.__tablename__}_id",
            back_populates=cls.__tablename__.rstrip('s'),
            cascade="all, delete-orphan",
            lazy="select"
        )
    
    def set_encrypted_field(
        self, 
        field_name: str, 
        value: Any, 
        encryption_level: EncryptionLevel = EncryptionLevel.MEDIUM,
        session: Optional[Session] = None
    ) -> None:
        """Set an encrypted field value"""
        if session is None:
            session = Session.object_session(self)
        
        # Get or create encrypted field record
        encrypted_field = session.query(EncryptedField).filter_by(
            **{f"{self.__tablename__}_id": self.id},
            field_name=field_name
        ).first()
        
        if not encrypted_field:
            encrypted_field = EncryptedField(
                **{f"{self.__tablename__}_id": self.id},
                field_name=field_name,
                encryption_level=encryption_level
            )
            session.add(encrypted_field)
        
        # Encrypt the value
        encryption_context = f"{self.__tablename__}:{self.id}:{field_name}"
        encrypted_data = field_encryptor.encrypt_field(
            str(value), 
            encryption_context,
            encryption_level=encryption_level.value
        )
        
        encrypted_field.encrypted_value = encrypted_data['encrypted_data']
        encrypted_field.encryption_version = encrypted_data.get('version', '1.0')
        encrypted_field.encryption_algorithm = encrypted_data.get('algorithm', 'AES-256-GCM')
        encrypted_field.updated_at = datetime.now(timezone.utc)
        
        # Auto-detect PII if not specified
        if encrypted_field.contains_pii is None:
            try:
                detection_result = pii_detector.detect_pii_comprehensive(str(value))
                encrypted_field.contains_pii = detection_result.get('contains_pii', False)
                encrypted_field.pii_types = json.dumps(detection_result.get('pii_types', []))
                encrypted_field.sensitivity_level = detection_result.get(
                    'overall_classification', {}
                ).get('sensitivity_level', 'INTERNAL')
            except Exception:
                encrypted_field.contains_pii = False
        
        session.commit()
    
    def get_encrypted_field(
        self, 
        field_name: str, 
        session: Optional[Session] = None
    ) -> Optional[Any]:
        """Get decrypted field value"""
        if session is None:
            session = Session.object_session(self)
        
        encrypted_field = session.query(EncryptedField).filter_by(
            **{f"{self.__tablename__}_id": self.id},
            field_name=field_name
        ).first()
        
        if not encrypted_field:
            return None
        
        try:
            encryption_context = f"{self.__tablename__}:{self.id}:{field_name}"
            decrypted_data = field_encryptor.decrypt_field(
                encrypted_field.encrypted_value,
                encryption_context
            )
            return decrypted_data['decrypted_data']
        except Exception as e:
            # Log decryption failure but don't expose details
            return None
    
    def list_encrypted_fields(self, session: Optional[Session] = None) -> List[str]:
        """List all encrypted field names for this record"""
        if session is None:
            session = Session.object_session(self)
        
        encrypted_fields = session.query(EncryptedField).filter_by(
            **{f"{self.__tablename__}_id": self.id}
        ).all()
        
        return [field.field_name for field in encrypted_fields]
    
    def get_encryption_metadata(
        self, 
        field_name: str,
        session: Optional[Session] = None
    ) -> Optional[Dict[str, Any]]:
        """Get encryption metadata for a field"""
        if session is None:
            session = Session.object_session(self)
        
        encrypted_field = session.query(EncryptedField).filter_by(
            **{f"{self.__tablename__}_id": self.id},
            field_name=field_name
        ).first()
        
        if not encrypted_field:
            return None
        
        return {
            'encryption_level': encrypted_field.encryption_level,
            'encryption_version': encrypted_field.encryption_version,
            'encryption_algorithm': encrypted_field.encryption_algorithm,
            'contains_pii': encrypted_field.contains_pii,
            'pii_types': json.loads(encrypted_field.pii_types or '[]'),
            'sensitivity_level': encrypted_field.sensitivity_level,
            'created_at': encrypted_field.created_at,
            'updated_at': encrypted_field.updated_at
        }


# ============================================================================
# AUDIT TRAIL MIXIN
# ============================================================================

class AuditTrailMixin:
    """
    Mixin to add audit trail capabilities to existing models.
    
    Creates separate audit_trail table that tracks all changes
    to the original model without modifying the original table.
    """
    
    @declared_attr
    def audit_trail(cls):
        """Relationship to audit trail records"""
        return relationship(
            "AuditTrail",
            foreign_keys=f"AuditTrail.{cls.__tablename__}_id",
            back_populates=cls.__tablename__.rstrip('s'),
            cascade="all, delete-orphan",
            order_by="AuditTrail.created_at.desc()",
            lazy="select"
        )
    
    @staticmethod
    def _get_user_info_from_context():
        """Gets user info from the request context variables."""
        context = get_request_context()
        return (
            context.get("user_id") or "system",
            context.get("ip_address") or "unknown",
            context.get("user_agent") or "unknown"
        )

    @classmethod
    def __declare_last__(cls):
        event.listen(cls, 'after_insert', cls._audit_insert)
        event.listen(cls, 'after_update', cls._audit_update)
        event.listen(cls, 'after_delete', cls._audit_delete)

    @staticmethod
    def _audit_insert(mapper, connection, target):
        """Listen for inserts and create an audit record."""
        user_id, ip_address, user_agent = AuditTrailMixin._get_user_info_from_context()
        
        with SessionLocal() as session:
            audit_record = AuditTrail(
                table_name=target.__tablename__,
                record_id=str(target.id),
                action=AuditAction.CREATE,
                user_id=user_id,
                changes={col.name: getattr(target, col.name) for col in target.__table__.columns},
                ip_address=ip_address,
                user_agent=user_agent
            )
            session.add(audit_record)
            session.commit()

    @staticmethod
    def _audit_update(mapper, connection, target):
        """Listen for updates and create an audit record."""
        user_id, ip_address, user_agent = AuditTrailMixin._get_user_info_from_context()
        changes = {}
        for attr in attributes.instance_state(target).attrs:
            hist = attributes.get_history(target, attr.key)
            if hist.has_changes():
                changes[attr.key] = {
                    "old": hist.deleted[0] if hist.deleted else None,
                    "new": hist.added[0] if hist.added else None,
                }
        
        if changes:
            with SessionLocal() as session:
                audit_record = AuditTrail(
                    table_name=target.__tablename__,
                    record_id=str(target.id),
                    action=AuditAction.UPDATE,
                    user_id=user_id,
                    changes=changes,
                    ip_address=ip_address,
                    user_agent=user_agent
                )
                session.add(audit_record)
                session.commit()

    @staticmethod
    def _audit_delete(mapper, connection, target):
        """Listen for deletes and create an audit record."""
        user_id, ip_address, user_agent = AuditTrailMixin._get_user_info_from_context()
        
        with SessionLocal() as session:
            audit_record = AuditTrail(
                table_name=target.__tablename__,
                record_id=str(target.id),
                action=AuditAction.DELETE,
                user_id=user_id,
                changes={col.name: getattr(target, col.name) for col in target.__table__.columns},
                ip_address=ip_address,
                user_agent=user_agent
            )
            session.add(audit_record)
            session.commit()
    
    def create_audit_record(
        self,
        action: AuditAction,
        user_id: Optional[str] = None,
        changes: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        session: Optional[Session] = None
    ) -> None:
        """Create an audit trail record"""
        if session is None:
            session = Session.object_session(self)
        
        audit_record = AuditTrail(
            **{f"{self.__tablename__}_id": self.id},
            action=action,
            user_id=user_id,
            changes=changes or {},
            metadata=metadata or {},
            ip_address=ip_address,
            user_agent=user_agent,
            table_name=self.__tablename__,
            record_id=str(self.id)
        )
        
        session.add(audit_record)
        session.commit()
    
    def get_audit_history(
        self,
        action_filter: Optional[AuditAction] = None,
        user_filter: Optional[str] = None,
        limit: int = 100,
        session: Optional[Session] = None
    ) -> List[Dict[str, Any]]:
        """Get audit history for this record"""
        if session is None:
            session = Session.object_session(self)
        
        query = session.query(AuditTrail).filter_by(
            **{f"{self.__tablename__}_id": self.id}
        )
        
        if action_filter:
            query = query.filter(AuditTrail.action == action_filter)
        
        if user_filter:
            query = query.filter(AuditTrail.user_id == user_filter)
        
        audit_records = query.order_by(AuditTrail.created_at.desc()).limit(limit).all()
        
        return [
            {
                'id': record.id,
                'action': record.action,
                'user_id': record.user_id,
                'changes': record.changes,
                'metadata': record.metadata,
                'ip_address': record.ip_address,
                'user_agent': record.user_agent,
                'created_at': record.created_at
            }
            for record in audit_records
        ]


# ============================================================================
# SOFT DELETE MIXIN
# ============================================================================

class SoftDeleteMixin:
    """
    Mixin to add soft delete capabilities to existing models.
    
    Adds fields to track deletion without actually removing records.
    This is additive and doesn't modify existing table structure.
    """
    
    # Soft delete fields (added to existing tables via migration)
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by_id = Column(UUID(as_uuid=True), nullable=True)
    deletion_reason = Column(String, nullable=True)
    deletion_metadata = Column(JSON, default={})
    
    def soft_delete(
        self,
        user_id: Optional[str] = None,
        reason: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        session: Optional[Session] = None
    ) -> None:
        """Perform soft delete"""
        if session is None:
            session = Session.object_session(self)
        
        self.is_deleted = True
        self.deleted_at = datetime.now(timezone.utc)
        self.deleted_by_id = user_id
        self.deletion_reason = reason
        self.deletion_metadata = metadata or {}
        
        # Create audit record if mixin is available
        if hasattr(self, 'create_audit_record'):
            self.create_audit_record(
                action=AuditAction.DELETE,
                user_id=user_id,
                metadata={
                    'soft_delete': True,
                    'reason': reason,
                    **(metadata or {})
                },
                session=session
            )
        
        session.commit()
    
    def restore(
        self,
        user_id: Optional[str] = None,
        session: Optional[Session] = None
    ) -> None:
        """Restore soft deleted record"""
        if session is None:
            session = Session.object_session(self)
        
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by_id = None
        self.deletion_reason = None
        self.deletion_metadata = {}
        
        # Create audit record if mixin is available
        if hasattr(self, 'create_audit_record'):
            self.create_audit_record(
                action=AuditAction.UPDATE,
                user_id=user_id,
                metadata={'restored': True},
                session=session
            )
        
        session.commit()
    
    @hybrid_property
    def is_active(self):
        """Check if record is active (not soft deleted)"""
        return not self.is_deleted
    
    @classmethod
    def active_records(cls):
        """Query filter for active (non-deleted) records"""
        return cls.is_deleted == False
    
    @classmethod
    def deleted_records(cls):
        """Query filter for deleted records"""
        return cls.is_deleted == True


# ============================================================================
# DATA CLASSIFICATION MIXIN
# ============================================================================

class DataClassificationMixin:
    """
    Mixin to add data classification capabilities to existing models.
    
    Creates separate table to store data classification information
    without modifying original table structure.
    """
    
    @declared_attr
    def data_classification(cls):
        """Relationship to data classification"""
        return relationship(
            "DataClassificationRecord",
            foreign_keys=f"DataClassificationRecord.{cls.__tablename__}_id",
            back_populates=cls.__tablename__.rstrip('s'),
            uselist=False,
            cascade="all, delete-orphan"
        )
    
    def set_data_classification(
        self,
        classification: DataClassification,
        compliance_frameworks: Optional[List[ComplianceFramework]] = None,
        retention_period_days: Optional[int] = None,
        handling_instructions: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        session: Optional[Session] = None
    ) -> None:
        """Set data classification for this record"""
        if session is None:
            session = Session.object_session(self)
        
        # Get or create classification record
        classification_record = session.query(DataClassificationRecord).filter_by(
            **{f"{self.__tablename__}_id": self.id}
        ).first()
        
        if not classification_record:
            classification_record = DataClassificationRecord(
                **{f"{self.__tablename__}_id": self.id},
                table_name=self.__tablename__,
                record_id=str(self.id)
            )
            session.add(classification_record)
        
        classification_record.classification = classification
        classification_record.compliance_frameworks = json.dumps([
            fw.value for fw in (compliance_frameworks or [])
        ])
        classification_record.retention_period_days = retention_period_days
        classification_record.handling_instructions = handling_instructions
        classification_record.metadata = metadata or {}
        classification_record.updated_at = datetime.now(timezone.utc)
        
        session.commit()
    
    def get_data_classification(
        self, 
        session: Optional[Session] = None
    ) -> Optional[Dict[str, Any]]:
        """Get data classification information"""
        if session is None:
            session = Session.object_session(self)
        
        classification_record = session.query(DataClassificationRecord).filter_by(
            **{f"{self.__tablename__}_id": self.id}
        ).first()
        
        if not classification_record:
            return None
        
        return {
            'classification': classification_record.classification,
            'compliance_frameworks': json.loads(classification_record.compliance_frameworks or '[]'),
            'retention_period_days': classification_record.retention_period_days,
            'handling_instructions': classification_record.handling_instructions,
            'metadata': classification_record.metadata,
            'created_at': classification_record.created_at,
            'updated_at': classification_record.updated_at
        }


# ============================================================================
# COMPLIANCE TRACKING MIXIN
# ============================================================================

class ComplianceTrackingMixin:
    """
    Mixin to add compliance tracking capabilities to existing models.
    
    Creates separate table to track compliance-related events and requirements.
    """
    
    @declared_attr
    def compliance_events(cls):
        """Relationship to compliance events"""
        return relationship(
            "ComplianceEvent",
            foreign_keys=f"ComplianceEvent.{cls.__tablename__}_id",
            back_populates=cls.__tablename__.rstrip('s'),
            cascade="all, delete-orphan",
            order_by="ComplianceEvent.created_at.desc()"
        )
    
    def create_compliance_event(
        self,
        event_type: str,
        framework: ComplianceFramework,
        description: str,
        metadata: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
        session: Optional[Session] = None
    ) -> None:
        """Create a compliance event record"""
        if session is None:
            session = Session.object_session(self)
        
        compliance_event = ComplianceEvent(
            **{f"{self.__tablename__}_id": self.id},
            table_name=self.__tablename__,
            record_id=str(self.id),
            event_type=event_type,
            framework=framework,
            description=description,
            metadata=metadata or {},
            user_id=user_id
        )
        
        session.add(compliance_event)
        session.commit()
    
    def get_compliance_history(
        self,
        framework_filter: Optional[ComplianceFramework] = None,
        event_type_filter: Optional[str] = None,
        limit: int = 100,
        session: Optional[Session] = None
    ) -> List[Dict[str, Any]]:
        """Get compliance event history"""
        if session is None:
            session = Session.object_session(self)
        
        query = session.query(ComplianceEvent).filter_by(
            **{f"{self.__tablename__}_id": self.id}
        )
        
        if framework_filter:
            query = query.filter(ComplianceEvent.framework == framework_filter)
        
        if event_type_filter:
            query = query.filter(ComplianceEvent.event_type == event_type_filter)
        
        events = query.order_by(ComplianceEvent.created_at.desc()).limit(limit).all()
        
        return [
            {
                'id': event.id,
                'event_type': event.event_type,
                'framework': event.framework,
                'description': event.description,
                'metadata': event.metadata,
                'user_id': event.user_id,
                'created_at': event.created_at
            }
            for event in events
        ]


# Export mixins
__all__ = [
    'EncryptedFieldsMixin',
    'AuditTrailMixin',
    'SoftDeleteMixin',
    'DataClassificationMixin',
    'ComplianceTrackingMixin',
    'EncryptionLevel',
    'AuditAction',
    'DataClassification',
    'ComplianceFramework'
] 