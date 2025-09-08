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

class MFAMethod(str, enum.Enum):
    TOTP = "totp"
    SMS = "sms"
    EMAIL = "email"

class SessionStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"
    SUSPICIOUS = "suspicious"

class DatasetStatus(str, enum.Enum):
    DRAFT = "draft"
    PROCESSING = "processing"
    PUBLISHED = "published"
    DEPRECATED = "deprecated"
    PRIVATE = "private"

class DatasetFormat(str, enum.Enum):
    CSV = "csv"
    PARQUET = "parquet"
    JSON = "json"
    JSONL = "jsonl"
    XLSX = "xlsx"
    IMAGE_ZIP = "image_zip"
    AUDIO_ZIP = "audio_zip"
    VIDEO_ZIP = "video_zip"
    HDF5 = "hdf5"
    ARROW = "arrow"

class DatasetCategory(str, enum.Enum):
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    TABULAR = "tabular"
    TIMESERIES = "timeseries"
    GRAPH = "graph"
    GEOSPATIAL = "geospatial"
    MULTIMODAL = "multimodal"

class AccessLevel(str, enum.Enum):
    PUBLIC = "public"
    PRIVATE = "private"
    ORGANIZATION = "organization"
    SHARED = "shared"

class QualityGrade(str, enum.Enum):
    A_PLUS = "A+"
    A = "A"
    B_PLUS = "B+"
    B = "B"
    C_PLUS = "C+"
    C = "C"
    D = "D"
    F = "F"

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
    
    # Enhanced security fields
    mfa_enabled = Column(Boolean, default=False)
    mfa_method = Column(Enum(MFAMethod))
    mfa_secret = Column(String)  # Encrypted TOTP secret
    mfa_backup_codes = Column(JSON)  # Encrypted backup codes
    failed_login_attempts = Column(Integer, default=0)
    account_locked_until = Column(DateTime(timezone=True))
    password_changed_at = Column(DateTime(timezone=True))
    last_password_reset_request = Column(DateTime(timezone=True))
    security_questions = Column(JSON)  # Encrypted security questions/answers
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True))
    
    # Relationships
    organization = relationship("Organization", back_populates="users")
    api_keys = relationship("ApiKey", back_populates="user")
    data_investigations = relationship("DataInvestigation", back_populates="created_by")
    audit_logs = relationship("AuditLog", back_populates="user")
    user_sessions = relationship("UserSession", back_populates="user")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user")
    
    # Security relationships (optional - for security models)
    encrypted_fields = relationship("EncryptedField", foreign_keys="[EncryptedField.users_id]", back_populates="user")
    audit_trail = relationship("AuditTrail", foreign_keys="[AuditTrail.users_id]", back_populates="user")
    data_classification = relationship("DataClassificationRecord", foreign_keys="[DataClassificationRecord.users_id]", back_populates="user")
    compliance_events = relationship("ComplianceEvent", foreign_keys="[ComplianceEvent.users_id]", back_populates="user")
    
    # Dataset marketplace relationships
    created_datasets = relationship("Dataset", back_populates="created_by")
    dataset_versions = relationship("DatasetVersion", back_populates="created_by")
    dataset_reviews = relationship("DatasetReview", back_populates="reviewer")
    shared_datasets = relationship("DatasetShare", foreign_keys="[DatasetShare.shared_by_id]", back_populates="shared_by")
    received_datasets = relationship("DatasetShare", foreign_keys="[DatasetShare.shared_with_id]", back_populates="shared_with_user")
    dataset_usage_logs = relationship("DatasetUsageLog", back_populates="user")
    dataset_collaborations = relationship("DatasetCollaboration", foreign_keys="[DatasetCollaboration.collaborator_id]", back_populates="collaborator")
    dataset_invitations = relationship("DatasetCollaboration", foreign_keys="[DatasetCollaboration.invited_by_id]", back_populates="invited_by")

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
    
    # Dataset marketplace relationships
    datasets = relationship("Dataset", back_populates="organization")
    received_datasets = relationship("DatasetShare", foreign_keys="[DatasetShare.shared_with_organization_id]", back_populates="shared_with_organization")

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
    rate_limit = Column(Integer)  # Requests per minute
    usage_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="api_keys")

class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    ip_address = Column(String)
    user_agent = Column(Text)
    device_fingerprint = Column(String)
    status = Column(Enum(SessionStatus), default=SessionStatus.ACTIVE)
    security_level = Column(String, default="medium")  # low, medium, high, critical
    mfa_verified = Column(Boolean, default=False)
    risk_score = Column(Float, default=0.0)
    session_metadata = Column(JSON, default={})
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_accessed = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="user_sessions")

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    email = Column(String, nullable=False)
    status = Column(String, default="pending")  # pending, completed, expired, invalid
    attempts = Column(Integer, default=0)
    ip_address = Column(String)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True))
    
    # Relationships
    user = relationship("User", back_populates="password_reset_tokens")

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
    severity = Column(String, default="info")  # info, warning, error, critical
    category = Column(String)  # authentication, authorization, data_access, etc.
    
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

# ==================== SECURITY MODELS ====================

class EncryptedField(Base):
    __tablename__ = "encrypted_fields"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    field_name = Column(String, nullable=False)
    encrypted_value = Column(Text, nullable=False)
    encryption_key_id = Column(String)
    
    # Foreign keys for different entities
    users_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    organizations_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    data_investigations_id = Column(UUID(as_uuid=True), ForeignKey("data_investigations.id"))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", foreign_keys=[users_id], back_populates="encrypted_fields")
    organization = relationship("Organization", foreign_keys=[organizations_id], back_populates="encrypted_fields")
    data_investigation = relationship("DataInvestigation", foreign_keys=[data_investigations_id], back_populates="encrypted_fields")

class AuditTrail(Base):
    __tablename__ = "audit_trail"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type = Column(String, nullable=False)
    event_data = Column(JSON, default={})
    ip_address = Column(String)
    user_agent = Column(String)
    
    # Foreign keys for different entities
    users_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    organizations_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    data_investigations_id = Column(UUID(as_uuid=True), ForeignKey("data_investigations.id"))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", foreign_keys=[users_id], back_populates="audit_trail")
    organization = relationship("Organization", foreign_keys=[organizations_id], back_populates="audit_trail")
    data_investigation = relationship("DataInvestigation", foreign_keys=[data_investigations_id], back_populates="audit_trail")

class DataClassificationRecord(Base):
    __tablename__ = "data_classification_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    classification_level = Column(String, nullable=False)  # public, internal, confidential, restricted
    classification_reason = Column(String)
    data_type = Column(String)  # pii, phi, financial, etc.
    detection_method = Column(String)  # automated, manual, ai
    
    # Foreign keys for different entities
    users_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    organizations_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    data_investigations_id = Column(UUID(as_uuid=True), ForeignKey("data_investigations.id"))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", foreign_keys=[users_id], back_populates="data_classification")
    organization = relationship("Organization", foreign_keys=[organizations_id], back_populates="data_classification")
    data_investigation = relationship("DataInvestigation", foreign_keys=[data_investigations_id], back_populates="data_classification")

class ComplianceEvent(Base):
    __tablename__ = "compliance_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    compliance_standard = Column(String, nullable=False)  # gdpr, hipaa, sox, etc.
    event_type = Column(String, nullable=False)  # data_access, data_export, consent_given, etc.
    event_details = Column(JSON, default={})
    compliance_status = Column(String)  # compliant, non_compliant, requires_review
    
    # Foreign keys for different entities
    users_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    organizations_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    data_investigations_id = Column(UUID(as_uuid=True), ForeignKey("data_investigations.id"))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", foreign_keys=[users_id], back_populates="compliance_events")
    organization = relationship("Organization", foreign_keys=[organizations_id], back_populates="compliance_events")
    data_investigation = relationship("DataInvestigation", foreign_keys=[data_investigations_id], back_populates="compliance_events")

# Dataset Marketplace Models

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    category = Column(Enum(DatasetCategory), nullable=False)
    format = Column(Enum(DatasetFormat), nullable=False)
    status = Column(Enum(DatasetStatus), default=DatasetStatus.DRAFT)
    access_level = Column(Enum(AccessLevel), default=AccessLevel.PRIVATE)
    
    # Metadata
    version = Column(String, default="1.0.0")
    size_bytes = Column(Integer)
    row_count = Column(Integer)
    column_count = Column(Integer)
    tags = Column(JSON, default=list)
    schema_info = Column(JSON, default=dict)
    sample_data = Column(JSON, default=dict)
    
    # File storage
    file_path = Column(String)
    preview_path = Column(String)
    processed_path = Column(String)
    
    # Quality metrics
    quality_score = Column(Float)
    quality_grade = Column(Enum(QualityGrade))
    completeness_score = Column(Float)
    consistency_score = Column(Float)
    validity_score = Column(Float)
    uniqueness_score = Column(Float)
    bias_score = Column(Float)
    
    # Statistics
    download_count = Column(Integer, default=0)
    view_count = Column(Integer, default=0)
    rating_average = Column(Float)
    rating_count = Column(Integer, default=0)
    
    # Relationships
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    published_at = Column(DateTime(timezone=True))
    
    # Relationships
    created_by = relationship("User", back_populates="created_datasets")
    organization = relationship("Organization", back_populates="datasets")
    versions = relationship("DatasetVersion", back_populates="dataset", cascade="all, delete-orphan")
    quality_reports = relationship("DatasetQualityReport", back_populates="dataset", cascade="all, delete-orphan")
    reviews = relationship("DatasetReview", back_populates="dataset", cascade="all, delete-orphan")
    shares = relationship("DatasetShare", back_populates="dataset", cascade="all, delete-orphan")
    usage_logs = relationship("DatasetUsageLog", back_populates="dataset", cascade="all, delete-orphan")
    collaborations = relationship("DatasetCollaboration", back_populates="dataset", cascade="all, delete-orphan")

class DatasetVersion(Base):
    __tablename__ = "dataset_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    version = Column(String, nullable=False)
    description = Column(Text)
    
    # Version-specific metadata
    size_bytes = Column(Integer)
    row_count = Column(Integer)
    column_count = Column(Integer)
    schema_info = Column(JSON, default=dict)
    changes_summary = Column(Text)
    
    # File storage
    file_path = Column(String)
    processed_path = Column(String)
    
    # Quality metrics for this version
    quality_score = Column(Float)
    quality_grade = Column(Enum(QualityGrade))
    
    # Relationships
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    dataset = relationship("Dataset", back_populates="versions")
    created_by = relationship("User", back_populates="dataset_versions")

class DatasetQualityReport(Base):
    __tablename__ = "dataset_quality_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    dataset_version_id = Column(UUID(as_uuid=True), ForeignKey("dataset_versions.id"))
    
    # Overall quality metrics
    quality_score = Column(Float, nullable=False)
    quality_grade = Column(Enum(QualityGrade), nullable=False)
    
    # Detailed quality metrics
    completeness_score = Column(Float)
    consistency_score = Column(Float)
    validity_score = Column(Float)
    uniqueness_score = Column(Float)
    bias_score = Column(Float)
    
    # Detailed analysis results
    missing_values_analysis = Column(JSON, default=dict)
    data_types_analysis = Column(JSON, default=dict)
    statistical_summary = Column(JSON, default=dict)
    anomalies_detected = Column(JSON, default=list)
    bias_analysis = Column(JSON, default=dict)
    schema_validation = Column(JSON, default=dict)
    
    # Processing metadata
    analysis_config = Column(JSON, default=dict)
    processing_time_seconds = Column(Float)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    dataset = relationship("Dataset", back_populates="quality_reports")
    dataset_version = relationship("DatasetVersion")

class DatasetReview(Base):
    __tablename__ = "dataset_reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    reviewer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    rating = Column(Integer, nullable=False)  # 1-5 stars
    title = Column(String)
    comment = Column(Text)
    
    # Review categories
    data_quality_rating = Column(Integer)  # 1-5
    documentation_rating = Column(Integer)  # 1-5
    usability_rating = Column(Integer)  # 1-5
    
    # Flags
    is_verified_purchase = Column(Boolean, default=False)  # For paid datasets
    is_flagged = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    dataset = relationship("Dataset", back_populates="reviews")
    reviewer = relationship("User", back_populates="dataset_reviews")

class DatasetShare(Base):
    __tablename__ = "dataset_shares"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    shared_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    shared_with_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    shared_with_organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    
    # Access control
    access_level = Column(Enum(AccessLevel), default=AccessLevel.SHARED)
    permissions = Column(JSON, default=dict)  # read, write, delete, share permissions
    expires_at = Column(DateTime(timezone=True))
    
    # Usage tracking
    download_count = Column(Integer, default=0)
    last_accessed_at = Column(DateTime(timezone=True))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    dataset = relationship("Dataset", back_populates="shares")
    shared_by = relationship("User", foreign_keys=[shared_by_id], back_populates="shared_datasets")
    shared_with_user = relationship("User", foreign_keys=[shared_with_id], back_populates="received_datasets")
    shared_with_organization = relationship("Organization", back_populates="received_datasets")

class DatasetUsageLog(Base):
    __tablename__ = "dataset_usage_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    action = Column(String, nullable=False)  # view, download, convert, analyze
    details = Column(JSON, default=dict)
    
    # Context
    experiment_id = Column(UUID(as_uuid=True))  # Link to MLOps experiments
    session_id = Column(String)
    ip_address = Column(String)
    user_agent = Column(String)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    dataset = relationship("Dataset", back_populates="usage_logs")
    user = relationship("User", back_populates="dataset_usage_logs")

class DatasetCollaboration(Base):
    __tablename__ = "dataset_collaborations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    collaborator_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    invited_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    role = Column(String, default="contributor")  # viewer, contributor, maintainer
    permissions = Column(JSON, default=dict)
    
    # Status
    status = Column(String, default="pending")  # pending, accepted, declined, revoked
    invited_at = Column(DateTime(timezone=True), server_default=func.now())
    responded_at = Column(DateTime(timezone=True))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    dataset = relationship("Dataset", back_populates="collaborations")
    collaborator = relationship("User", foreign_keys=[collaborator_id], back_populates="dataset_collaborations")
    invited_by = relationship("User", foreign_keys=[invited_by_id], back_populates="dataset_invitations") 