from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, JSON, ForeignKey, Float, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.connection import Base
import uuid
import enum

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    ANALYST = "analyst"
    VIEWER = "viewer"
    ENTERPRISE_ADMIN = "enterprise_admin"

class JobStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class DataSourceType(str, enum.Enum):
    CSV = "csv"
    JSON = "json"
    EXCEL = "excel"
    DATABASE = "database"
    API = "api"
    STREAM = "stream"

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    first_name = Column(String)
    last_name = Column(String)
    role = Column(Enum(UserRole), default=UserRole.ANALYST)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    avatar_url = Column(String)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True))
    
    # Relationships
    organization = relationship("Organization", back_populates="users")
    api_keys = relationship("ApiKey", back_populates="user")
    data_investigations = relationship("DataInvestigation", back_populates="created_by")
    audit_logs = relationship("AuditLog", back_populates="user")
    
    # Security relationships (optional - for security models)
    encrypted_fields = relationship("EncryptedField", foreign_keys="[EncryptedField.users_id]", back_populates="user")
    audit_trail = relationship("AuditTrail", foreign_keys="[AuditTrail.users_id]", back_populates="user")
    data_classification = relationship("DataClassificationRecord", foreign_keys="[DataClassificationRecord.users_id]", back_populates="user")
    compliance_events = relationship("ComplianceEvent", foreign_keys="[ComplianceEvent.users_id]", back_populates="user")

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True)
    domain = Column(String)
    subscription_plan = Column(String, default="free")  # free, pro, enterprise
    subscription_status = Column(String, default="active")
    settings = Column(JSON, default={})
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    users = relationship("User", back_populates="organization")
    workspaces = relationship("Workspace", back_populates="organization")
    integrations = relationship("Integration", back_populates="organization")
    
    # Security relationships (optional - for security models)
    encrypted_fields = relationship("EncryptedField", foreign_keys="[EncryptedField.organizations_id]", back_populates="organization")
    audit_trail = relationship("AuditTrail", foreign_keys="[AuditTrail.organizations_id]", back_populates="organization")
    data_classification = relationship("DataClassificationRecord", foreign_keys="[DataClassificationRecord.organizations_id]", back_populates="organization")
    compliance_events = relationship("ComplianceEvent", foreign_keys="[ComplianceEvent.organizations_id]", back_populates="organization")

class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    settings = Column(JSON, default={})
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    organization = relationship("Organization", back_populates="workspaces")
    data_investigations = relationship("DataInvestigation", back_populates="workspace")

class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    key_hash = Column(String, nullable=False, unique=True)
    key_preview = Column(String)  # Last 4 characters for display
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    permissions = Column(JSON, default=[])  # List of permissions
    is_active = Column(Boolean, default=True)
    last_used = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="api_keys")

class DataInvestigation(Base):
    __tablename__ = "data_investigations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"))
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Investigation metadata
    data_source_type = Column(Enum(DataSourceType))
    data_source_config = Column(JSON, default={})
    schema_info = Column(JSON, default={})
    analysis_config = Column(JSON, default={})
    original_file_path = Column(String, nullable=True)
    processed_file_path = Column(String, nullable=True)
    
    # Results and insights
    quality_score = Column(Float)
    anomalies_detected = Column(JSON, default=[])
    patterns_found = Column(JSON, default=[])
    recommendations = Column(JSON, default=[])
    
    # Status
    status = Column(Enum(JobStatus), default=JobStatus.PENDING)
    progress_percentage = Column(Float, default=0.0)
    error_message = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True))
    
    # Relationships
    workspace = relationship("Workspace", back_populates="data_investigations")
    created_by = relationship("User", back_populates="data_investigations")
    processing_jobs = relationship("ProcessingJob", back_populates="investigation")
    
    # Security relationships (optional - for security models)
    encrypted_fields = relationship("EncryptedField", foreign_keys="[EncryptedField.data_investigations_id]", back_populates="data_investigation")
    audit_trail = relationship("AuditTrail", foreign_keys="[AuditTrail.data_investigations_id]", back_populates="data_investigation")
    data_classification = relationship("DataClassificationRecord", foreign_keys="[DataClassificationRecord.data_investigations_id]", back_populates="data_investigation")
    compliance_events = relationship("ComplianceEvent", foreign_keys="[ComplianceEvent.data_investigations_id]", back_populates="data_investigation")

class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    investigation_id = Column(UUID(as_uuid=True), ForeignKey("data_investigations.id"))
    job_type = Column(String, nullable=False)  # analysis, cleaning, validation, etc.
    config = Column(JSON, default={})
    
    # Job execution
    status = Column(Enum(JobStatus), default=JobStatus.PENDING)
    progress_percentage = Column(Float, default=0.0)
    output_summary = Column(JSON, default={})
    output_artifact_path = Column(String, nullable=True)
    error_message = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    
    # Relationships
    investigation = relationship("DataInvestigation", back_populates="processing_jobs")

class Integration(Base):
    __tablename__ = "integrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    integration_type = Column(String, nullable=False)  # database, webhook, storage, etc.
    provider = Column(String, nullable=False)  # postgresql, slack, s3, etc.
    name = Column(String, nullable=False)
    config = Column(JSON, default={})
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    organization = relationship("Organization", back_populates="integrations")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    action = Column(String, nullable=False)
    resource_type = Column(String)
    resource_id = Column(String)
    details = Column(JSON, default={})
    ip_address = Column(String)
    user_agent = Column(String)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="audit_logs")

class WebhookEndpoint(Base):
    __tablename__ = "webhook_endpoints"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    name = Column(String, nullable=False)
    url = Column(String, nullable=False)
    secret = Column(String)
    events = Column(JSON, default=[])  # List of events to listen for
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class UsageMetric(Base):
    __tablename__ = "usage_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    metric_type = Column(String, nullable=False)  # api_calls, data_processed, storage_used
    metric_value = Column(Float, nullable=False)
    metric_unit = Column(String)  # bytes, rows, calls
    
    # Timestamps
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())
    period_start = Column(DateTime(timezone=True))
    period_end = Column(DateTime(timezone=True)) 