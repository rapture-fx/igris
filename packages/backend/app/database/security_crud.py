"""
Security CRUD Operations

This module provides CRUD operations for the security data layer models.
These operations handle encrypted fields, audit trails, data classification,
and compliance tracking without modifying existing table structures.

Features:
- Encrypted field management with automatic PII detection
- Audit trail creation and querying
- Data classification and compliance tracking
- Soft delete operations
- Security policy management
- Data retention scheduling

Usage:
    # Encrypt a field
    await SecurityCRUD.set_encrypted_field(
        session, user_instance, 'ssn', '123-45-6789'
    )
    
    # Create audit record
    await SecurityCRUD.create_audit_record(
        session, user_instance, AuditAction.UPDATE, user_id='user123'
    )
    
    # Set data classification
    await SecurityCRUD.set_data_classification(
        session, user_instance, DataClassification.CONFIDENTIAL
    )
"""

import json
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List, Type, Union
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc, asc
from sqlalchemy.exc import IntegrityError

from app.database.security_models import (
    EncryptedField, AuditTrail, DataClassificationRecord, ComplianceEvent,
    SecurityPolicy, SecurityPolicyAssignment, DataRetentionSchedule
)
from app.database.security_mixins import (
    EncryptionLevel, AuditAction, DataClassification, ComplianceFramework
)
from app.security.encryption.field_encryption import field_encryptor
from app.security.encryption.pii_detector import pii_detector


class SecurityCRUD:
    """
    Comprehensive CRUD operations for security data layer.
    
    This class provides high-level operations for managing encrypted fields,
    audit trails, compliance tracking, and data classification.
    """
    
    # ============================================================================
    # ENCRYPTED FIELDS OPERATIONS
    # ============================================================================
    
    @staticmethod
    async def set_encrypted_field(
        session: Session,
        model_instance: Any,
        field_name: str,
        value: Any,
        encryption_level: EncryptionLevel = EncryptionLevel.MEDIUM,
        auto_detect_pii: bool = True
    ) -> EncryptedField:
        """
        Set an encrypted field value for any model instance.
        
        Args:
            session: Database session
            model_instance: The model instance to encrypt field for
            field_name: Name of the field to encrypt
            value: Value to encrypt
            encryption_level: Level of encryption to apply
            auto_detect_pii: Whether to automatically detect PII
            
        Returns:
            EncryptedField: The created/updated encrypted field record
        """
        table_name = model_instance.__tablename__
        record_id = str(model_instance.id)
        
        # Get or create encrypted field record
        encrypted_field = session.query(EncryptedField).filter_by(
            table_name=table_name,
            record_id=record_id,
            field_name=field_name
        ).first()
        
        if not encrypted_field:
            encrypted_field = EncryptedField(
                table_name=table_name,
                record_id=record_id,
                field_name=field_name,
                encryption_level=encryption_level
            )
            
            # Set foreign key if applicable
            if hasattr(encrypted_field, f"{table_name}_id"):
                setattr(encrypted_field, f"{table_name}_id", model_instance.id)
            
            session.add(encrypted_field)
        
        # Encrypt the value
        encryption_context = f"{table_name}:{record_id}:{field_name}"
        encrypted_data = field_encryptor.encrypt_field(
            str(value),
            encryption_context,
            encryption_level=encryption_level.value
        )
        
        encrypted_field.encrypted_value = encrypted_data['encrypted_data']
        encrypted_field.encryption_version = encrypted_data.get('version', '1.0')
        encrypted_field.encryption_algorithm = encrypted_data.get('algorithm', 'AES-256-GCM')
        encrypted_field.encryption_context = encryption_context
        encrypted_field.key_version = field_encryptor.get_current_key_version()
        encrypted_field.updated_at = datetime.now(timezone.utc)
        
        # Auto-detect PII if enabled
        if auto_detect_pii:
            try:
                detection_result = pii_detector.detect_pii_comprehensive(str(value))
                encrypted_field.contains_pii = detection_result.get('contains_pii', False)
                encrypted_field.pii_types = json.dumps(detection_result.get('pii_types', []))
                encrypted_field.sensitivity_level = detection_result.get(
                    'overall_classification', {}
                ).get('sensitivity_level', 'INTERNAL')
            except Exception:
                encrypted_field.contains_pii = False
                encrypted_field.pii_types = json.dumps([])
                encrypted_field.sensitivity_level = 'INTERNAL'
        
        session.commit()
        return encrypted_field
    
    @staticmethod
    async def get_encrypted_field(
        session: Session,
        model_instance: Any,
        field_name: str
    ) -> Optional[Any]:
        """Get decrypted field value."""
        table_name = model_instance.__tablename__
        record_id = str(model_instance.id)
        
        encrypted_field = session.query(EncryptedField).filter_by(
            table_name=table_name,
            record_id=record_id,
            field_name=field_name
        ).first()
        
        if not encrypted_field:
            return None
        
        try:
            encryption_context = f"{table_name}:{record_id}:{field_name}"
            decrypted_data = field_encryptor.decrypt_field(
                encrypted_field.encrypted_value,
                encryption_context
            )
            return decrypted_data['decrypted_data']
        except Exception:
            return None
    
    @staticmethod
    async def list_encrypted_fields(
        session: Session,
        model_instance: Any
    ) -> List[Dict[str, Any]]:
        """List all encrypted fields for a model instance."""
        table_name = model_instance.__tablename__
        record_id = str(model_instance.id)
        
        encrypted_fields = session.query(EncryptedField).filter_by(
            table_name=table_name,
            record_id=record_id
        ).all()
        
        return [
            {
                'field_name': field.field_name,
                'encryption_level': field.encryption_level,
                'contains_pii': field.contains_pii,
                'pii_types': json.loads(field.pii_types or '[]'),
                'sensitivity_level': field.sensitivity_level,
                'created_at': field.created_at,
                'updated_at': field.updated_at
            }
            for field in encrypted_fields
        ]
    
    @staticmethod
    async def delete_encrypted_field(
        session: Session,
        model_instance: Any,
        field_name: str
    ) -> bool:
        """Delete an encrypted field."""
        table_name = model_instance.__tablename__
        record_id = str(model_instance.id)
        
        encrypted_field = session.query(EncryptedField).filter_by(
            table_name=table_name,
            record_id=record_id,
            field_name=field_name
        ).first()
        
        if encrypted_field:
            session.delete(encrypted_field)
            session.commit()
            return True
        return False
    
    # ============================================================================
    # AUDIT TRAIL OPERATIONS
    # ============================================================================
    
    @staticmethod
    async def create_audit_record(
        session: Session,
        model_instance: Any,
        action: AuditAction,
        user_id: Optional[str] = None,
        changes: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_id: Optional[str] = None,
        session_id: Optional[str] = None,
        security_level: Optional[str] = None,
        compliance_frameworks: Optional[List[str]] = None,
        data_classification: Optional[DataClassification] = None
    ) -> AuditTrail:
        """Create a comprehensive audit trail record."""
        table_name = model_instance.__tablename__
        record_id = str(model_instance.id)
        
        audit_record = AuditTrail(
            table_name=table_name,
            record_id=record_id,
            action=action,
            user_id=user_id,
            changes=changes or {},
            metadata=metadata or {},
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
            session_id=session_id,
            security_level=security_level,
            compliance_frameworks=compliance_frameworks or [],
            data_classification=data_classification
        )
        
        # Set foreign key if applicable
        if hasattr(audit_record, f"{table_name}_id"):
            setattr(audit_record, f"{table_name}_id", model_instance.id)
        
        session.add(audit_record)
        session.commit()
        return audit_record
    
    @staticmethod
    async def get_audit_history(
        session: Session,
        model_instance: Any,
        action_filter: Optional[AuditAction] = None,
        user_filter: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get audit history for a model instance."""
        table_name = model_instance.__tablename__
        record_id = str(model_instance.id)
        
        query = session.query(AuditTrail).filter_by(
            table_name=table_name,
            record_id=record_id
        )
        
        if action_filter:
            query = query.filter(AuditTrail.action == action_filter)
        
        if user_filter:
            query = query.filter(AuditTrail.user_id == user_filter)
        
        if date_from:
            query = query.filter(AuditTrail.created_at >= date_from)
        
        if date_to:
            query = query.filter(AuditTrail.created_at <= date_to)
        
        audit_records = query.order_by(desc(AuditTrail.created_at)).offset(offset).limit(limit).all()
        
        return [
            {
                'id': record.id,
                'action': record.action,
                'user_id': record.user_id,
                'changes': record.changes,
                'metadata': record.metadata,
                'ip_address': record.ip_address,
                'user_agent': record.user_agent,
                'request_id': record.request_id,
                'session_id': record.session_id,
                'security_level': record.security_level,
                'compliance_frameworks': record.compliance_frameworks,
                'data_classification': record.data_classification,
                'created_at': record.created_at
            }
            for record in audit_records
        ]
    
    @staticmethod
    async def get_audit_summary(
        session: Session,
        model_instance: Any,
        period_days: int = 30
    ) -> Dict[str, Any]:
        """Get audit summary statistics for a model instance."""
        table_name = model_instance.__tablename__
        record_id = str(model_instance.id)
        
        date_from = datetime.now(timezone.utc) - timedelta(days=period_days)
        
        # Get action counts
        action_counts = session.query(
            AuditTrail.action,
            func.count(AuditTrail.id).label('count')
        ).filter(
            AuditTrail.table_name == table_name,
            AuditTrail.record_id == record_id,
            AuditTrail.created_at >= date_from
        ).group_by(AuditTrail.action).all()
        
        # Get user activity
        user_activity = session.query(
            AuditTrail.user_id,
            func.count(AuditTrail.id).label('count')
        ).filter(
            AuditTrail.table_name == table_name,
            AuditTrail.record_id == record_id,
            AuditTrail.created_at >= date_from,
            AuditTrail.user_id.isnot(None)
        ).group_by(AuditTrail.user_id).all()
        
        return {
            'period_days': period_days,
            'total_events': sum(count for _, count in action_counts),
            'action_breakdown': {action.value: count for action, count in action_counts},
            'unique_users': len(user_activity),
            'user_activity': {user_id: count for user_id, count in user_activity}
        }
    
    # ============================================================================
    # DATA CLASSIFICATION OPERATIONS
    # ============================================================================
    
    @staticmethod
    async def set_data_classification(
        session: Session,
        model_instance: Any,
        classification: DataClassification,
        compliance_frameworks: Optional[List[ComplianceFramework]] = None,
        retention_period_days: Optional[int] = None,
        handling_instructions: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        approved_by_id: Optional[str] = None
    ) -> DataClassificationRecord:
        """Set data classification for a model instance."""
        table_name = model_instance.__tablename__
        record_id = str(model_instance.id)
        
        # Get or create classification record
        classification_record = session.query(DataClassificationRecord).filter_by(
            table_name=table_name,
            record_id=record_id
        ).first()
        
        if not classification_record:
            classification_record = DataClassificationRecord(
                table_name=table_name,
                record_id=record_id
            )
            
            # Set foreign key if applicable
            if hasattr(classification_record, f"{table_name}_id"):
                setattr(classification_record, f"{table_name}_id", model_instance.id)
            
            session.add(classification_record)
        
        classification_record.classification = classification
        classification_record.compliance_frameworks = json.dumps([
            fw.value for fw in (compliance_frameworks or [])
        ])
        classification_record.retention_period_days = retention_period_days
        classification_record.handling_instructions = handling_instructions
        classification_record.metadata = metadata or {}
        classification_record.approved_by_id = approved_by_id
        classification_record.updated_at = datetime.now(timezone.utc)
        
        if approved_by_id:
            classification_record.approved_at = datetime.now(timezone.utc)
        
        session.commit()
        return classification_record
    
    @staticmethod
    async def get_data_classification(
        session: Session,
        model_instance: Any
    ) -> Optional[Dict[str, Any]]:
        """Get data classification for a model instance."""
        table_name = model_instance.__tablename__
        record_id = str(model_instance.id)
        
        classification_record = session.query(DataClassificationRecord).filter_by(
            table_name=table_name,
            record_id=record_id
        ).first()
        
        if not classification_record:
            return None
        
        return {
            'classification': classification_record.classification,
            'compliance_frameworks': json.loads(classification_record.compliance_frameworks or '[]'),
            'retention_period_days': classification_record.retention_period_days,
            'handling_instructions': classification_record.handling_instructions,
            'metadata': classification_record.metadata,
            'approved_by_id': classification_record.approved_by_id,
            'approved_at': classification_record.approved_at,
            'created_at': classification_record.created_at,
            'updated_at': classification_record.updated_at
        }
    
    # ============================================================================
    # COMPLIANCE EVENT OPERATIONS
    # ============================================================================
    
    @staticmethod
    async def create_compliance_event(
        session: Session,
        model_instance: Any,
        event_type: str,
        framework: ComplianceFramework,
        description: str,
        metadata: Optional[Dict[str, Any]] = None,
        severity: str = "medium",
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_id: Optional[str] = None
    ) -> ComplianceEvent:
        """Create a compliance event record."""
        table_name = model_instance.__tablename__
        record_id = str(model_instance.id)
        
        compliance_event = ComplianceEvent(
            table_name=table_name,
            record_id=record_id,
            event_type=event_type,
            framework=framework,
            description=description,
            metadata=metadata or {},
            severity=severity,
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id
        )
        
        # Set foreign key if applicable
        if hasattr(compliance_event, f"{table_name}_id"):
            setattr(compliance_event, f"{table_name}_id", model_instance.id)
        
        session.add(compliance_event)
        session.commit()
        return compliance_event
    
    @staticmethod
    async def get_compliance_events(
        session: Session,
        model_instance: Any,
        framework_filter: Optional[ComplianceFramework] = None,
        event_type_filter: Optional[str] = None,
        severity_filter: Optional[str] = None,
        status_filter: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get compliance events for a model instance."""
        table_name = model_instance.__tablename__
        record_id = str(model_instance.id)
        
        query = session.query(ComplianceEvent).filter_by(
            table_name=table_name,
            record_id=record_id
        )
        
        if framework_filter:
            query = query.filter(ComplianceEvent.framework == framework_filter)
        
        if event_type_filter:
            query = query.filter(ComplianceEvent.event_type == event_type_filter)
        
        if severity_filter:
            query = query.filter(ComplianceEvent.severity == severity_filter)
        
        if status_filter:
            query = query.filter(ComplianceEvent.status == status_filter)
        
        events = query.order_by(desc(ComplianceEvent.created_at)).offset(offset).limit(limit).all()
        
        return [
            {
                'id': event.id,
                'event_type': event.event_type,
                'framework': event.framework,
                'description': event.description,
                'metadata': event.metadata,
                'severity': event.severity,
                'status': event.status,
                'user_id': event.user_id,
                'ip_address': event.ip_address,
                'resolved_by_id': event.resolved_by_id,
                'resolved_at': event.resolved_at,
                'resolution_notes': event.resolution_notes,
                'created_at': event.created_at,
                'updated_at': event.updated_at
            }
            for event in events
        ]
    
    @staticmethod
    async def resolve_compliance_event(
        session: Session,
        event_id: str,
        resolved_by_id: str,
        resolution_notes: str
    ) -> bool:
        """Resolve a compliance event."""
        event = session.query(ComplianceEvent).filter_by(id=event_id).first()
        
        if not event:
            return False
        
        event.status = "resolved"
        event.resolved_by_id = resolved_by_id
        event.resolved_at = datetime.now(timezone.utc)
        event.resolution_notes = resolution_notes
        event.updated_at = datetime.now(timezone.utc)
        
        session.commit()
        return True
    
    # ============================================================================
    # SOFT DELETE OPERATIONS
    # ============================================================================
    
    @staticmethod
    async def soft_delete(
        session: Session,
        model_instance: Any,
        user_id: Optional[str] = None,
        reason: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Perform soft delete with audit trail."""
        if not hasattr(model_instance, 'is_deleted'):
            raise ValueError("Model does not support soft delete")
        
        model_instance.is_deleted = True
        model_instance.deleted_at = datetime.now(timezone.utc)
        model_instance.deleted_by_id = user_id
        model_instance.deletion_reason = reason
        model_instance.deletion_metadata = metadata or {}
        
        # Create audit record
        await SecurityCRUD.create_audit_record(
            session=session,
            model_instance=model_instance,
            action=AuditAction.DELETE,
            user_id=user_id,
            metadata={
                'soft_delete': True,
                'reason': reason,
                **(metadata or {})
            }
        )
        
        session.commit()
        return True
    
    @staticmethod
    async def restore(
        session: Session,
        model_instance: Any,
        user_id: Optional[str] = None
    ) -> bool:
        """Restore soft deleted record."""
        if not hasattr(model_instance, 'is_deleted'):
            raise ValueError("Model does not support soft delete")
        
        if not model_instance.is_deleted:
            return False
        
        model_instance.is_deleted = False
        model_instance.deleted_at = None
        model_instance.deleted_by_id = None
        model_instance.deletion_reason = None
        model_instance.deletion_metadata = {}
        
        # Create audit record
        await SecurityCRUD.create_audit_record(
            session=session,
            model_instance=model_instance,
            action=AuditAction.UPDATE,
            user_id=user_id,
            metadata={'restored': True}
        )
        
        session.commit()
        return True
    
    # ============================================================================
    # DATA RETENTION OPERATIONS
    # ============================================================================
    
    @staticmethod
    async def schedule_data_retention(
        session: Session,
        model_instance: Any,
        retention_period_days: int,
        retention_reason: str = "compliance",
        applicable_frameworks: Optional[List[str]] = None,
        requires_approval: bool = False
    ) -> DataRetentionSchedule:
        """Schedule data retention for a model instance."""
        table_name = model_instance.__tablename__
        record_id = str(model_instance.id)
        
        retention_start_date = datetime.now(timezone.utc)
        scheduled_deletion_date = retention_start_date + timedelta(days=retention_period_days)
        
        retention_schedule = DataRetentionSchedule(
            table_name=table_name,
            record_id=record_id,
            retention_period_days=retention_period_days,
            retention_start_date=retention_start_date,
            scheduled_deletion_date=scheduled_deletion_date,
            retention_reason=retention_reason,
            applicable_frameworks=applicable_frameworks or [],
            requires_approval=requires_approval
        )
        
        session.add(retention_schedule)
        session.commit()
        return retention_schedule
    
    @staticmethod
    async def get_retention_schedules_for_execution(
        session: Session,
        execution_date: Optional[datetime] = None,
        limit: int = 100
    ) -> List[DataRetentionSchedule]:
        """Get retention schedules ready for execution."""
        if execution_date is None:
            execution_date = datetime.now(timezone.utc)
        
        return session.query(DataRetentionSchedule).filter(
            DataRetentionSchedule.scheduled_deletion_date <= execution_date,
            DataRetentionSchedule.status == "scheduled"
        ).limit(limit).all()
    
    # ============================================================================
    # SECURITY POLICY OPERATIONS
    # ============================================================================
    
    @staticmethod
    async def create_security_policy(
        session: Session,
        name: str,
        description: str,
        policy_document: Dict[str, Any],
        created_by_id: str,
        applies_to_tables: Optional[List[str]] = None,
        compliance_frameworks: Optional[List[str]] = None,
        is_mandatory: bool = False
    ) -> SecurityPolicy:
        """Create a new security policy."""
        policy = SecurityPolicy(
            name=name,
            description=description,
            policy_document=policy_document,
            created_by_id=created_by_id,
            applies_to_tables=applies_to_tables or [],
            compliance_frameworks=compliance_frameworks or [],
            is_mandatory=is_mandatory
        )
        
        session.add(policy)
        session.commit()
        return policy
    
    @staticmethod
    async def assign_security_policy(
        session: Session,
        policy_id: str,
        model_instance: Any,
        assigned_by_id: str,
        assignment_reason: Optional[str] = None,
        policy_overrides: Optional[Dict[str, Any]] = None
    ) -> SecurityPolicyAssignment:
        """Assign a security policy to a model instance."""
        table_name = model_instance.__tablename__
        record_id = str(model_instance.id)
        
        assignment = SecurityPolicyAssignment(
            policy_id=policy_id,
            table_name=table_name,
            record_id=record_id,
            assigned_by_id=assigned_by_id,
            assignment_reason=assignment_reason,
            policy_overrides=policy_overrides or {}
        )
        
        session.add(assignment)
        session.commit()
        return assignment


# Export the CRUD class
__all__ = ['SecurityCRUD'] 