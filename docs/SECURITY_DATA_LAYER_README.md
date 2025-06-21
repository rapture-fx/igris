# Security Data Layer for Sherringfords API

This security data layer provides comprehensive data protection capabilities for the Sherringfords API without modifying existing table structures. All security features are implemented as additive components that work alongside your existing models.

##  Quick Start

### 1. Run the Migration

```bash
# Apply the security data layer migration
cd backend
alembic upgrade head
```

### 2. Basic Usage Example

```python
from app.database.security_integration_example import SecureUser
from app.database.security_crud import SecurityCRUD
from app.database.security_mixins import DataClassification, EncryptionLevel

# Create a secure user wrapper
user = User.query.get(user_id)  # Get existing user
secure_user = SecureUser()
secure_user.id = user.id
secure_user.__dict__.update(user.__dict__)

# Encrypt sensitive data
await SecurityCRUD.set_encrypted_field(
    session, secure_user, 'ssn', '123-45-6789', EncryptionLevel.CRITICAL
)

# Set data classification
await SecurityCRUD.set_data_classification(
    session, secure_user, DataClassification.CONFIDENTIAL
)

# Create audit record
await SecurityCRUD.create_audit_record(
    session, secure_user, AuditAction.UPDATE, user_id='admin123'
)
```

##  Architecture

### Design Principles

1. **Additive Only**: No modifications to existing tables
2. **Polymorphic Relationships**: Security tables work with any model
3. **Mixin-Based**: Easy to add security features via inheritance
4. **Backward Compatible**: Existing code continues to work unchanged

### Component Overview

```
Security Data Layer
  Mixins (security_mixins.py)
    EncryptedFieldsMixin     # Encrypted field management
    AuditTrailMixin          # Audit logging
    SoftDeleteMixin          # Soft delete functionality
    DataClassificationMixin  # Data classification
    ComplianceTrackingMixin  # Compliance events

  Models (security_models.py)
    EncryptedField           # Stores encrypted data
    AuditTrail              # Audit log records
    DataClassificationRecord # Data classification info
    ComplianceEvent         # Compliance events
    SecurityPolicy          # Security policies
    SecurityPolicyAssignment # Policy assignments
    DataRetentionSchedule    # Data retention

  CRUD (security_crud.py)
    SecurityCRUD            # High-level operations

  Examples (security_integration_example.py)
    SecureUser              # Enhanced User model
    SecureOrganization      # Enhanced Organization model
    SecurityIntegrationExamples # Usage examples

  Migration (001_add_security_data_layer.py)
     Alembic migration script
```

##  Security Features

### 1. Encrypted Fields

Store sensitive data in encrypted form without modifying original tables.

```python
# Set encrypted field
await SecurityCRUD.set_encrypted_field(
    session=session,
    model_instance=user,
    field_name='credit_card_number',
    value='4111-1111-1111-1111',
    encryption_level=EncryptionLevel.CRITICAL
)

# Get decrypted value
credit_card = await SecurityCRUD.get_encrypted_field(
    session, user, 'credit_card_number'
)

# List all encrypted fields
encrypted_fields = await SecurityCRUD.list_encrypted_fields(session, user)
```

**Features:**
- Automatic PII detection
- Multiple encryption levels (LOW, MEDIUM, HIGH, CRITICAL)
- Integration with existing encryption infrastructure
- Key versioning and rotation support

### 2. Audit Trail

Comprehensive audit logging for all model operations.

```python
# Create audit record
await SecurityCRUD.create_audit_record(
    session=session,
    model_instance=user,
    action=AuditAction.UPDATE,
    user_id='admin123',
    changes={'email': {'old': 'old@example.com', 'new': 'new@example.com'}},
    metadata={'admin_operation': True},
    ip_address='192.168.1.100'
)

# Get audit history
history = await SecurityCRUD.get_audit_history(
    session, user, limit=50
)

# Get audit summary
summary = await SecurityCRUD.get_audit_summary(
    session, user, period_days=30
)
```

**Features:**
- Complete change tracking
- User context capture
- Request correlation
- Compliance framework integration
- Performance optimized queries

### 3. Data Classification

Classify data according to sensitivity levels and compliance requirements.

```python
# Set data classification
await SecurityCRUD.set_data_classification(
    session=session,
    model_instance=user,
    classification=DataClassification.CONFIDENTIAL,
    compliance_frameworks=[ComplianceFramework.GDPR, ComplianceFramework.CCPA],
    retention_period_days=2555,  # 7 years
    handling_instructions="PII data - handle with care"
)

# Get classification info
classification = await SecurityCRUD.get_data_classification(session, user)
```

**Supported Classifications:**
- `PUBLIC` - Publicly available information
- `INTERNAL` - Internal use only
- `CONFIDENTIAL` - Confidential information
- `RESTRICTED` - Restricted access required
- `HIGHLY_RESTRICTED` - Highest level of protection

**Supported Compliance Frameworks:**
- GDPR (General Data Protection Regulation)
- CCPA (California Consumer Privacy Act)
- SOX (Sarbanes-Oxley Act)
- HIPAA (Health Insurance Portability and Accountability Act)
- PCI DSS (Payment Card Industry Data Security Standard)
- SOC2 (Service Organization Control 2)
- ISO27001 (Information Security Management)

### 4. Soft Delete

Safe deletion with audit trail and recovery capability.

```python
# Soft delete
await SecurityCRUD.soft_delete(
    session=session,
    model_instance=user,
    user_id='admin123',
    reason='User requested account deletion',
    metadata={'gdpr_request': True}
)

# Restore
await SecurityCRUD.restore(
    session=session,
    model_instance=user,
    user_id='admin123'
)

# Query active records only
active_users = session.query(User).filter(User.is_deleted == False).all()
```

### 5. Compliance Event Tracking

Track compliance-related events and violations.

```python
# Create compliance event
await SecurityCRUD.create_compliance_event(
    session=session,
    model_instance=user,
    event_type="data_access",
    framework=ComplianceFramework.GDPR,
    description="User data accessed for support request",
    severity="medium",
    user_id='support123'
)

# Get compliance events
events = await SecurityCRUD.get_compliance_events(
    session, user, framework_filter=ComplianceFramework.GDPR
)

# Resolve compliance event
await SecurityCRUD.resolve_compliance_event(
    session, event_id, resolved_by_id='admin123',
    resolution_notes="Issue resolved - access was authorized"
)
```

### 6. Data Retention Scheduling

Automated data retention based on compliance requirements.

```python
# Schedule data retention
await SecurityCRUD.schedule_data_retention(
    session=session,
    model_instance=user,
    retention_period_days=2555,  # 7 years
    retention_reason="GDPR compliance",
    applicable_frameworks=['GDPR', 'CCPA']
)

# Get schedules ready for execution
schedules = await SecurityCRUD.get_retention_schedules_for_execution(session)
```

##  Integration Patterns

### Pattern 1: Enhanced Model Classes

Create secure versions of existing models:

```python
from app.database.security_mixins import (
    EncryptedFieldsMixin, AuditTrailMixin, SoftDeleteMixin
)

class SecureUser(User, EncryptedFieldsMixin, AuditTrailMixin, SoftDeleteMixin):
    """Enhanced User with security features"""
    
    _encrypted_fields_config = {
        'ssn': {'level': EncryptionLevel.CRITICAL, 'pii': True},
        'phone': {'level': EncryptionLevel.MEDIUM, 'pii': True}
    }
    
    async def secure_update(self, session, field_name, value, user_id):
        """Update with automatic encryption and audit"""
        if field_name in self._encrypted_fields_config:
            await SecurityCRUD.set_encrypted_field(
                session, self, field_name, value
            )
        else:
            setattr(self, field_name, value)
        
        await SecurityCRUD.create_audit_record(
            session, self, AuditAction.UPDATE, user_id
        )
```

### Pattern 2: Decorator-Based Security

Apply security to existing endpoints:

```python
from app.middleware import basic_security_stack, encrypt_pii_data

@basic_security_stack()
@encrypt_pii_data()
@router.get("/users/{user_id}")
async def get_user(user_id: str, session: Session = Depends(get_db)):
    user = session.query(User).filter_by(id=user_id).first()
    # Response will be automatically encrypted if PII is detected
    return user
```

### Pattern 3: Service Layer Integration

Integrate security into service classes:

```python
class UserService:
    async def update_user_profile(
        self, 
        session: Session, 
        user_id: str, 
        updates: Dict[str, Any],
        requesting_user_id: str
    ):
        user = session.query(User).filter_by(id=user_id).first()
        
        # Apply updates with security
        for field, value in updates.items():
            if field in ['ssn', 'credit_card', 'phone']:
                # Encrypt sensitive fields
                await SecurityCRUD.set_encrypted_field(
                    session, user, field, value, EncryptionLevel.HIGH
                )
            else:
                setattr(user, field, value)
        
        # Create audit record
        await SecurityCRUD.create_audit_record(
            session, user, AuditAction.UPDATE, 
            requesting_user_id, changes=updates
        )
        
        session.commit()
        return user
```

##  Database Schema

### Core Security Tables

```sql
-- Encrypted fields storage
CREATE TABLE encrypted_fields (
    id UUID PRIMARY KEY,
    table_name VARCHAR NOT NULL,
    record_id VARCHAR NOT NULL,
    field_name VARCHAR NOT NULL,
    encrypted_value TEXT NOT NULL,
    encryption_level encryption_level_enum DEFAULT 'medium',
    contains_pii BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(table_name, record_id, field_name)
);

-- Comprehensive audit trail
CREATE TABLE audit_trail (
    id UUID PRIMARY KEY,
    table_name VARCHAR NOT NULL,
    record_id VARCHAR NOT NULL,
    action audit_action_enum NOT NULL,
    user_id UUID,
    changes JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    ip_address VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Data classification records
CREATE TABLE data_classification_records (
    id UUID PRIMARY KEY,
    table_name VARCHAR NOT NULL,
    record_id VARCHAR NOT NULL,
    classification data_classification_enum NOT NULL,
    compliance_frameworks JSONB DEFAULT '[]',
    retention_period_days INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(table_name, record_id)
);
```

### Soft Delete Columns Added to Existing Tables

```sql
-- Added to all existing tables
ALTER TABLE users ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN deleted_by_id UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN deletion_reason VARCHAR;
ALTER TABLE users ADD COLUMN deletion_metadata JSONB DEFAULT '{}';

-- Similar columns added to:
-- organizations, data_investigations, api_keys, workspaces, 
-- processing_jobs, integrations, webhook_endpoints, usage_metrics
```

##  Migration Guide

### Phase 1: Infrastructure Setup

1. **Run Migration**
   ```bash
   alembic upgrade head
   ```

2. **Verify Tables Created**
   ```sql
   \dt *security*
   \dt *audit*
   \dt *encrypted*
   ```

### Phase 2: Gradual Enhancement

1. **Start with High-Value Data**
   ```python
   # Encrypt SSNs for existing users
   for user in session.query(User).all():
       if user.ssn:
           await SecurityCRUD.set_encrypted_field(
               session, user, 'ssn', user.ssn, EncryptionLevel.CRITICAL
           )
           user.ssn = None  # Remove from original column
   ```

2. **Add Audit Trails**
   ```python
   # Add audit trail to critical operations
   @audit_sensitive_operation("user_creation", "personal")
   @router.post("/users")
   async def create_user(user_data: UserCreate):
       # Existing logic unchanged
       pass
   ```

### Phase 3: Full Integration

1. **Create Enhanced Models**
   ```python
   # Use enhanced models for new features
   secure_user = SecureUser()
   secure_user.__dict__.update(existing_user.__dict__)
   ```

2. **Implement Data Classification**
   ```python
   # Classify all sensitive data
   await SecurityCRUD.set_data_classification(
       session, user, DataClassification.CONFIDENTIAL,
       compliance_frameworks=[ComplianceFramework.GDPR]
   )
   ```

##  Monitoring and Compliance

### Audit Dashboards

```python
# Get security summary for organization
async def get_security_dashboard(org_id: str):
    # Get audit metrics
    audit_summary = await SecurityCRUD.get_audit_summary(
        session, organization, period_days=30
    )
    
    # Get compliance events
    compliance_events = await SecurityCRUD.get_compliance_events(
        session, organization, limit=100
    )
    
    # Get encrypted fields count
    encrypted_count = session.query(EncryptedField).filter_by(
        organizations_id=org_id
    ).count()
    
    return {
        'audit_summary': audit_summary,
        'compliance_events': compliance_events,
        'encrypted_fields_count': encrypted_count,
        'security_score': calculate_security_score(audit_summary, compliance_events)
    }
```

### Compliance Reporting

```python
# Generate GDPR compliance report
async def generate_gdpr_report(org_id: str, start_date: datetime, end_date: datetime):
    events = await SecurityCRUD.get_compliance_events(
        session, organization,
        framework_filter=ComplianceFramework.GDPR,
        date_from=start_date,
        date_to=end_date
    )
    
    return {
        'total_events': len(events),
        'data_access_events': [e for e in events if e['event_type'] == 'data_access'],
        'data_exports': [e for e in events if e['event_type'] == 'data_export'],
        'violations': [e for e in events if e['severity'] in ['high', 'critical']],
        'resolution_rate': calculate_resolution_rate(events)
    }
```

##  Advanced Usage

### Custom Security Policies

```python
# Create custom security policy
policy = await SecurityCRUD.create_security_policy(
    session=session,
    name="Financial Data Protection Policy",
    description="Enhanced protection for financial data",
    policy_document={
        'encryption_required': True,
        'encryption_level': 'critical',
        'audit_all_access': True,
        'retention_period_days': 2555,
        'compliance_frameworks': ['PCI_DSS', 'SOX']
    },
    created_by_id='admin123'
)

# Assign policy to records
await SecurityCRUD.assign_security_policy(
    session, policy.id, financial_record, 'admin123'
)
```

### Bulk Operations

```python
# Bulk classify existing data
from app.database.security_integration_example import SecurityMigrationHelpers

total_processed = await SecurityMigrationHelpers.bulk_classify_data(
    session=session,
    model_class=User,
    classification=DataClassification.CONFIDENTIAL,
    compliance_frameworks=[ComplianceFramework.GDPR],
    admin_user_id='admin123',
    batch_size=100
)
```

### Custom Encryption Configurations

```python
class SecureFinancialRecord(FinancialRecord, EncryptedFieldsMixin):
    _encrypted_fields_config = {
        'account_number': {
            'level': EncryptionLevel.CRITICAL,
            'pii': False,
            'compliance': [ComplianceFramework.PCI_DSS]
        },
        'routing_number': {
            'level': EncryptionLevel.CRITICAL,
            'pii': False,
            'compliance': [ComplianceFramework.PCI_DSS]
        },
        'customer_ssn': {
            'level': EncryptionLevel.CRITICAL,
            'pii': True,
            'compliance': [ComplianceFramework.PCI_DSS, ComplianceFramework.GDPR]
        }
    }
```

##  Security Considerations

### Key Management
- Encryption keys are managed by the existing field encryption system
- Key rotation is supported through version tracking
- Keys are never stored in plaintext

### Performance Impact
- Encrypted fields: Minimal impact, data stored separately
- Audit trail: Async processing minimizes request impact
- Soft delete: No impact, uses existing queries with filters

### Compliance Benefits
- **GDPR**: Right to be forgotten, data portability, audit trails
- **CCPA**: Data transparency, deletion rights, access logs
- **SOX**: Financial data protection, change tracking
- **HIPAA**: PHI protection, access logging, data classification
- **PCI DSS**: Credit card data encryption, access controls

##  Troubleshooting

### Common Issues

1. **Migration Fails**
   ```bash
   # Check if tables already exist
   psql -d your_db -c "\dt *security*"
   
   # Run specific migration
   alembic upgrade 001_add_security_data_layer
   ```

2. **Encryption Errors**
   ```python
   # Check if encryption service is initialized
   from app.security.encryption.field_encryption import field_encryptor
   print(field_encryptor.get_current_key_version())
   ```

3. **Performance Issues**
   ```sql
   -- Check index usage
   EXPLAIN ANALYZE SELECT * FROM audit_trail 
   WHERE table_name = 'users' AND record_id = 'user123';
   ```

### Best Practices

1. **Use Appropriate Encryption Levels**
   - `LOW`: Non-sensitive but private data
   - `MEDIUM`: Personally identifiable information
   - `HIGH`: Financial or health data
   - `CRITICAL`: Legal documents, authentication data

2. **Implement Proper Access Controls**
   ```python
   # Always verify user permissions before accessing encrypted data
   if not user.has_permission('access_encrypted_data'):
       raise HTTPException(403, "Insufficient permissions")
   ```

3. **Regular Compliance Audits**
   ```python
   # Schedule regular compliance checks
   async def daily_compliance_check():
       events = await SecurityCRUD.get_compliance_events(
           session, organization,
           status_filter='open',
           severity_filter='high'
       )
       if events:
           await notify_compliance_team(events)
   ```

##  API Reference

### SecurityCRUD Methods

- `set_encrypted_field()` - Encrypt and store sensitive data
- `get_encrypted_field()` - Retrieve and decrypt data
- `create_audit_record()` - Create audit trail entry
- `get_audit_history()` - Retrieve audit history
- `set_data_classification()` - Set data classification
- `create_compliance_event()` - Track compliance events
- `soft_delete()` - Perform soft deletion
- `schedule_data_retention()` - Schedule data retention

### Security Mixins

- `EncryptedFieldsMixin` - Adds encrypted field capabilities
- `AuditTrailMixin` - Adds audit trail functionality
- `SoftDeleteMixin` - Adds soft delete support
- `DataClassificationMixin` - Adds data classification
- `ComplianceTrackingMixin` - Adds compliance event tracking

---

##  Getting Started Checklist

- [ ] Run the security migration: `alembic upgrade head`
- [ ] Verify security tables are created
- [ ] Create your first secure model using mixins
- [ ] Test encrypted field storage and retrieval
- [ ] Set up audit logging for critical operations
- [ ] Configure data classification for sensitive data
- [ ] Implement soft delete for user data
- [ ] Set up compliance event tracking
- [ ] Create security dashboards and monitoring
- [ ] Schedule regular compliance audits

For additional support or questions, refer to the security integration examples or contact the development team. 