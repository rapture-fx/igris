from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, JSON, ForeignKey, Float, Enum, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.connection import Base
import uuid
import enum

# Import from ml_preparation_models
from app.database.ml_preparation_models import DataQualityAssessment

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

class OAuthProvider(str, enum.Enum):
    GOOGLE = "google"
    GITHUB = "github"
    FACEBOOK = "facebook"
    MICROSOFT = "microsoft"

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)  # Nullable for OAuth users
    first_name = Column(String)
    last_name = Column(String)
    role = Column(Enum(UserRole), default=UserRole.ANALYST)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    avatar_url = Column(String)
    
    # OAuth fields
    oauth_provider = Column(Enum(OAuthProvider), nullable=True)
    oauth_provider_id = Column(String, nullable=True)  # Provider's user ID
    oauth_access_token = Column(String, nullable=True)  # Encrypted OAuth access token
    oauth_refresh_token = Column(String, nullable=True)  # Encrypted OAuth refresh token
    oauth_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    oauth_profile_data = Column(JSON, nullable=True)  # Store additional profile info from OAuth provider
    
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
    
    # Optimized relationships with eager loading configuration
    organization = relationship("Organization", back_populates="users", lazy="select")
    api_keys = relationship("ApiKey", back_populates="user", lazy="dynamic", order_by="ApiKey.created_at.desc()")
    data_investigations = relationship("DataInvestigation", back_populates="created_by", lazy="dynamic", order_by="DataInvestigation.updated_at.desc()")
    audit_logs = relationship("AuditLog", back_populates="user", lazy="dynamic", order_by="AuditLog.created_at.desc()")
    user_sessions = relationship("UserSession", back_populates="user", lazy="dynamic", order_by="UserSession.last_accessed.desc()")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user", lazy="dynamic", order_by="PasswordResetToken.created_at.desc()")
    
    # Security relationships (commented out until security models are properly defined)
    # encrypted_fields = relationship("EncryptedField", foreign_keys="[EncryptedField.users_id]", back_populates="user")
    # audit_trail = relationship("AuditTrail", foreign_keys="[AuditTrail.users_id]", back_populates="user")
    # data_classification = relationship("DataClassificationRecord", foreign_keys="[DataClassificationRecord.users_id]", back_populates="user")
    # compliance_events = relationship("ComplianceEvent", foreign_keys="[ComplianceEvent.users_id]", back_populates="user")
    
    # OAuth relationships
    oauth_accounts = relationship("OAuthAccount", back_populates="user", lazy="dynamic", order_by="OAuthAccount.last_used_at.desc()")
    
    # Feedback Learning relationships - optimized for performance
    feedback_events = relationship("UserFeedback", back_populates="user", lazy="dynamic", order_by="UserFeedback.created_at.desc()")
    learning_profile = relationship("UserLearningProfile", back_populates="user", uselist=False, lazy="select")

class OAuthAccount(Base):
    """OAuth account linking table for multiple OAuth providers per user"""
    __tablename__ = "oauth_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    provider = Column(Enum(OAuthProvider), nullable=False)
    provider_user_id = Column(String, nullable=False)
    provider_username = Column(String, nullable=True)
    access_token = Column(String, nullable=True)  # Encrypted
    refresh_token = Column(String, nullable=True)  # Encrypted
    token_expires_at = Column(DateTime(timezone=True), nullable=True)
    profile_data = Column(JSON, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_used_at = Column(DateTime(timezone=True))
    
    # Relationships
    user = relationship("User", back_populates="oauth_accounts")
    
    # Unique constraint per provider per user
    __table_args__ = (
        Index('ix_oauth_provider_user', 'provider', 'provider_user_id', unique=True),
    )

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True)
    domain = Column(String)
    subscription_plan = Column(String, default="free")  # free, pro, enterprise
    subscription_status = Column(String, default="active")
    lemonsqueezy_subscription_id = Column(String)  # LemonSqueezy subscription ID
    lemonsqueezy_customer_id = Column(String)  # LemonSqueezy customer ID
    settings = Column(JSON, default={})
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Optimized relationships
    users = relationship("User", back_populates="organization", lazy="dynamic", order_by="User.created_at.desc()")
    workspaces = relationship("Workspace", back_populates="organization", lazy="dynamic", order_by="Workspace.created_at.desc()")
    integrations = relationship("Integration", back_populates="organization", lazy="dynamic", order_by="Integration.updated_at.desc()")
    
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
    
    # Optimized relationships
    organization = relationship("Organization", back_populates="workspaces", lazy="select")
    data_investigations = relationship("DataInvestigation", back_populates="workspace", lazy="dynamic", order_by="DataInvestigation.updated_at.desc()")

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
    lemonsqueezy_subscription_id = Column(String)  # Associated LemonSqueezy subscription
    
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
    
    # Optimized relationships with eager loading hints
    workspace = relationship("Workspace", back_populates="data_investigations", lazy="select")
    created_by = relationship("User", back_populates="data_investigations", lazy="select")
    processing_jobs = relationship("ProcessingJob", back_populates="investigation", lazy="dynamic", order_by="ProcessingJob.created_at.desc()")
    
    # Security relationships (optional - for security models) - lazy loaded for performance
    encrypted_fields = relationship("EncryptedField", foreign_keys="[EncryptedField.data_investigations_id]", back_populates="data_investigation", lazy="dynamic")
    audit_trail = relationship("AuditTrail", foreign_keys="[AuditTrail.data_investigations_id]", back_populates="data_investigation", lazy="dynamic")
    data_classification = relationship("DataClassificationRecord", foreign_keys="[DataClassificationRecord.data_investigations_id]", back_populates="data_investigation", lazy="dynamic")
    compliance_events = relationship("ComplianceEvent", foreign_keys="[ComplianceEvent.data_investigations_id]", back_populates="data_investigation", lazy="dynamic")

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

# EncryptedField is now defined in security_models.py to avoid duplication

# AuditTrail is now defined in security_models.py to avoid duplication

# DataClassificationRecord is now defined in security_models.py to avoid duplication

# ComplianceEvent is now defined in security_models.py to avoid duplication

# ==================== FEEDBACK LEARNING MODELS ====================

class FeedbackTypeEnum(str, enum.Enum):
    TRANSFORMATION_RATING = "transformation_rating"
    PREDICTION_ACCURACY = "prediction_accuracy"  
    PATTERN_RELEVANCE = "pattern_relevance"
    DATA_QUALITY_IMPROVEMENT = "data_quality_improvement"
    FEATURE_USEFULNESS = "feature_usefulness"
    MODEL_PERFORMANCE = "model_performance"
    UI_EXPERIENCE = "ui_experience"
    API_SATISFACTION = "api_satisfaction"

class FeedbackSentimentEnum(str, enum.Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative" 
    NEUTRAL = "neutral"

class UserFeedback(Base):
    __tablename__ = "user_feedback"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    
    # Feedback details
    feedback_type = Column(Enum(FeedbackTypeEnum), nullable=False)
    rating = Column(Float)  # 1-5 scale
    binary_feedback = Column(Boolean)  # thumbs up/down
    text_feedback = Column(Text)
    sentiment = Column(Enum(FeedbackSentimentEnum))
    
    # Context information
    service_name = Column(String)
    operation_type = Column(String)
    context_data = Column(JSON, default={})
    session_id = Column(String)
    
    # Processing metadata
    processed = Column(Boolean, default=False)
    processing_notes = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True))
    
    # Relationships
    user = relationship("User", back_populates="feedback_events")
    organization = relationship("Organization")
    
    # Indexes for efficient querying
    __table_args__ = (
        Index('idx_user_feedback_user_type', 'user_id', 'feedback_type'),
        Index('idx_user_feedback_service', 'service_name', 'created_at'),
        Index('idx_user_feedback_rating', 'rating', 'feedback_type'),
    )

class UserLearningProfile(Base):
    __tablename__ = "user_learning_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    
    # User characteristics
    expertise_level = Column(String, default="intermediate")  # beginner, intermediate, advanced
    preferences = Column(JSON, default={})
    behavior_patterns = Column(JSON, default={})
    
    # Learning metrics
    total_feedback_count = Column(Integer, default=0)
    average_satisfaction = Column(Float, default=3.0)
    engagement_score = Column(Float, default=0.5)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_activity = Column(DateTime(timezone=True))
    
    # Relationships
    user = relationship("User", back_populates="learning_profile")
    organization = relationship("Organization")

class LearningRule(Base):
    __tablename__ = "learning_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_id = Column(String, nullable=False, unique=True)
    
    # Rule definition
    rule_type = Column(String, nullable=False)  # user_preference, context_based, temporal
    condition = Column(JSON, nullable=False)
    action = Column(JSON, nullable=False)
    
    # Rule metrics
    confidence = Column(Float, nullable=False)
    support = Column(Integer, default=0)  # Number of feedback events supporting this rule
    effectiveness = Column(Float, default=0.0)  # Measured effectiveness of rule
    
    # Rule lifecycle
    is_active = Column(Boolean, default=True)
    validation_count = Column(Integer, default=0)
    last_validated = Column(DateTime(timezone=True))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Indexes
    __table_args__ = (
        Index('idx_learning_rules_type_confidence', 'rule_type', 'confidence'),
        Index('idx_learning_rules_active', 'is_active', 'confidence'),
    )

class ABTest(Base):
    __tablename__ = "ab_tests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    test_name = Column(String, nullable=False)
    test_id = Column(String, nullable=False, unique=True)
    
    # Test configuration
    variants = Column(JSON, nullable=False)
    success_metric = Column(String, nullable=False)
    description = Column(Text)
    
    # Test lifecycle
    status = Column(String, default="active")  # active, paused, completed, cancelled
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    
    # Test results
    results = Column(JSON, default={})
    winner_variant = Column(String)
    confidence_level = Column(Float)
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Optimized relationships
    creator = relationship("User", lazy="select")
    organization = relationship("Organization", lazy="select")
    test_results = relationship("ABTestResult", back_populates="ab_test", lazy="dynamic", order_by="ABTestResult.recorded_at.desc()")

class ABTestResult(Base):
    __tablename__ = "ab_test_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    test_id = Column(UUID(as_uuid=True), ForeignKey("ab_tests.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Result data
    variant_name = Column(String, nullable=False)
    metric_value = Column(Float, nullable=False)
    context_data = Column(JSON, default={})
    
    # Timestamps
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Optimized relationships
    ab_test = relationship("ABTest", back_populates="test_results", lazy="select")
    user = relationship("User", lazy="select")
    
    # Indexes
    __table_args__ = (
        Index('idx_ab_test_results_test_variant', 'test_id', 'variant_name'),
        Index('idx_ab_test_results_user', 'user_id', 'recorded_at'),
    )

class ServiceImprovementLog(Base):
    __tablename__ = "service_improvement_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Service information
    service_name = Column(String, nullable=False)
    improvement_type = Column(String, nullable=False)  # parameter_tuning, algorithm_change, ui_improvement
    
    # Improvement details
    description = Column(Text, nullable=False)
    old_configuration = Column(JSON)
    new_configuration = Column(JSON)
    
    # Impact metrics
    feedback_basis = Column(JSON)  # Feedback events that led to this improvement
    expected_impact = Column(String)
    measured_impact = Column(JSON)
    
    # Implementation tracking
    implemented = Column(Boolean, default=False)
    implementation_notes = Column(Text)
    rollback_needed = Column(Boolean, default=False)
    
    # Metadata
    created_by_rule = Column(UUID(as_uuid=True), ForeignKey("learning_rules.id"))
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    implemented_at = Column(DateTime(timezone=True))
    evaluated_at = Column(DateTime(timezone=True))
    
    # Relationships
    learning_rule = relationship("LearningRule")
    organization = relationship("Organization")

class RLModel(Base):
    """Reinforcement Learning Model Registry"""
    __tablename__ = "rl_models"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(String(255), unique=True, nullable=False, index=True)  # External unique identifier
    name = Column(String(255), nullable=False)
    description = Column(Text)

    # Model metadata
    model_type = Column(String(100), default="hyperparameter_optimization")  # optimization_type
    algorithm = Column(String(100))  # PPO, A2C, SAC, etc.
    environment = Column(String(255))  # Training environment description

    # Status and lifecycle
    is_active = Column(Boolean, default=True)
    is_production = Column(Boolean, default=False)

    # Performance tracking
    best_performance = Column(Float)
    total_episodes_trained = Column(Integer, default=0)

    # Ownership
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    versions = relationship("RLModelVersion", back_populates="model", cascade="all, delete-orphan")
    user = relationship("User")
    organization = relationship("Organization")

    # Indexes for performance
    __table_args__ = (
        Index('idx_rl_models_model_id', 'model_id'),
        Index('idx_rl_models_organization', 'organization_id', 'created_at'),
        Index('idx_rl_models_active', 'is_active', 'updated_at'),
    )

class RLModelVersion(Base):
    """RL Model Version with training metadata and performance tracking"""
    __tablename__ = "rl_model_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(UUID(as_uuid=True), ForeignKey("rl_models.id", ondelete="CASCADE"), nullable=False)

    # Version information
    version = Column(String(255), nullable=False)  # e.g., "episode_100_20231201_120000"
    episode = Column(Integer, nullable=False)

    # Performance metrics at time of save
    performance_metrics = Column(JSON, nullable=False, default={})

    # Training configuration
    hyperparameters = Column(JSON, nullable=False, default={})
    training_metadata = Column(JSON, default={})  # Additional training info

    # Session tracking
    session_id = Column(String(255), index=True)  # Links to optimization session

    # Storage locations
    local_path = Column(String(1024))  # Local filesystem path
    cloud_url = Column(String(1024))   # Cloud storage URL
    backup_url = Column(String(1024))  # Backup storage URL

    # File integrity
    file_hash = Column(String(64))     # SHA-256 hash for integrity verification
    file_size = Column(Integer)        # File size in bytes

    # Status
    is_active = Column(Boolean, default=False)  # Current active version for the model
    is_archived = Column(Boolean, default=False)

    # Compatibility information
    stable_baselines3_version = Column(String(50))
    python_version = Column(String(20))
    dependencies = Column(JSON, default={})

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    archived_at = Column(DateTime(timezone=True))

    # Relationships
    model = relationship("RLModel", back_populates="versions")

    # Indexes for performance
    __table_args__ = (
        Index('idx_rl_model_versions_model_version', 'model_id', 'version'),
        Index('idx_rl_model_versions_session', 'session_id', 'created_at'),
        Index('idx_rl_model_versions_active', 'model_id', 'is_active'),
        Index('idx_rl_model_versions_episode', 'model_id', 'episode'),
    ) 