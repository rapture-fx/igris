"""
ML Model Lifecycle Management Database Models

This module contains SQLAlchemy models for comprehensive ML model lifecycle management,
including model registry, versioning, performance tracking, and deployment management.
"""

from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, JSON, ForeignKey, Float, Enum, Index, LargeBinary
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base
import uuid
import enum
from typing import Dict, List, Any, Optional
from datetime import datetime

# Use the main Base from the API app
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'api'))
from app.database.connection import Base


class ModelStatus(str, enum.Enum):
    """Model status enumeration"""
    DEVELOPMENT = "development"
    TESTING = "testing"
    STAGING = "staging"
    PRODUCTION = "production"
    ARCHIVED = "archived"
    DEPRECATED = "deprecated"


class ModelType(str, enum.Enum):
    """Model type enumeration"""
    CLASSIFICATION = "classification"
    REGRESSION = "regression"
    CLUSTERING = "clustering"
    TIME_SERIES = "time_series"
    NEURAL_NETWORK = "neural_network"
    ENSEMBLE = "ensemble"
    REINFORCEMENT_LEARNING = "reinforcement_learning"


class DeploymentStrategy(str, enum.Enum):
    """Deployment strategy enumeration"""
    BLUE_GREEN = "blue_green"
    CANARY = "canary"
    ROLLING = "rolling"
    SHADOW = "shadow"
    A_B_TEST = "a_b_test"


class PerformanceMetricType(str, enum.Enum):
    """Performance metric type enumeration"""
    ACCURACY = "accuracy"
    PRECISION = "precision"
    RECALL = "recall"
    F1_SCORE = "f1_score"
    AUC_ROC = "auc_roc"
    MSE = "mse"
    RMSE = "rmse"
    MAE = "mae"
    R2_SCORE = "r2_score"
    CUSTOM = "custom"


class AlertSeverity(str, enum.Enum):
    """Alert severity enumeration"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ModelRegistry(Base):
    """
    Central model registry for tracking all ML models in the system
    """
    __tablename__ = "ml_model_registry"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    model_type = Column(Enum(ModelType), nullable=False)
    framework = Column(String(100))  # e.g., sklearn, tensorflow, pytorch
    algorithm = Column(String(255))  # e.g., RandomForest, XGBoost

    # Ownership and collaboration
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))

    # Model metadata
    tags = Column(JSON)  # Key-value pairs for categorization
    business_context = Column(Text)  # Business problem being solved
    use_case = Column(String(255))  # Manufacturing, Finance, etc.

    # Status and lifecycle
    current_status = Column(Enum(ModelStatus), default=ModelStatus.DEVELOPMENT)
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    versions = relationship("ModelVersion", back_populates="model", order_by="ModelVersion.version_number.desc()")
    deployments = relationship("ModelDeployment", back_populates="model")
    performance_metrics = relationship("ModelPerformanceMetric", back_populates="model")

    # Indexes for performance
    __table_args__ = (
        Index('idx_model_registry_name', name),
        Index('idx_model_registry_type', model_type),
        Index('idx_model_registry_status', current_status),
        Index('idx_model_registry_created_by', created_by),
    )


class ModelVersion(Base):
    """
    Model versioning system supporting semantic versioning and lineage tracking
    """
    __tablename__ = "ml_model_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(UUID(as_uuid=True), ForeignKey("ml_model_registry.id"), nullable=False)

    # Version information
    version_number = Column(String(50), nullable=False)  # e.g., "1.2.3"
    version_hash = Column(String(64), unique=True, nullable=False)  # SHA256 hash
    is_latest = Column(Boolean, default=False)

    # Artifact storage
    artifact_path = Column(String(1000))  # Path to model artifacts
    artifact_size_bytes = Column(Integer)
    artifact_checksum = Column(String(64))  # SHA256 checksum for integrity

    # Training information
    training_dataset_id = Column(UUID(as_uuid=True))  # Reference to training dataset
    training_config = Column(JSON)  # Hyperparameters, training settings
    training_metrics = Column(JSON)  # Training loss, validation metrics
    training_duration_seconds = Column(Integer)

    # Model metadata
    model_parameters = Column(JSON)  # Model configuration
    feature_schema = Column(JSON)  # Input feature schema
    model_size_mb = Column(Float)
    dependencies = Column(JSON)  # Library versions, requirements

    # Performance benchmarks
    validation_metrics = Column(JSON)  # Validation performance
    benchmark_metrics = Column(JSON)  # Performance on benchmark datasets

    # Lineage and provenance
    parent_version_id = Column(UUID(as_uuid=True), ForeignKey("ml_model_versions.id"))
    lineage_metadata = Column(JSON)  # Data lineage, experiment tracking

    # Documentation
    changelog = Column(Text)  # What changed in this version
    documentation = Column(Text)  # Version-specific documentation

    # Status and lifecycle
    status = Column(Enum(ModelStatus), default=ModelStatus.DEVELOPMENT)
    is_approved = Column(Boolean, default=False)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_at = Column(DateTime(timezone=True))

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    model = relationship("ModelRegistry", back_populates="versions")
    parent_version = relationship("ModelVersion", remote_side=[id])
    child_versions = relationship("ModelVersion", back_populates="parent_version")
    deployments = relationship("ModelDeployment", back_populates="version")
    performance_logs = relationship("ModelPerformanceLog", back_populates="version")

    # Indexes for performance
    __table_args__ = (
        Index('idx_model_version_model_id', model_id),
        Index('idx_model_version_number', version_number),
        Index('idx_model_version_hash', version_hash),
        Index('idx_model_version_latest', is_latest),
        Index('idx_model_version_status', status),
    )


class ModelDeployment(Base):
    """
    Model deployment management with support for different deployment strategies
    """
    __tablename__ = "ml_model_deployments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(UUID(as_uuid=True), ForeignKey("ml_model_registry.id"), nullable=False)
    version_id = Column(UUID(as_uuid=True), ForeignKey("ml_model_versions.id"), nullable=False)

    # Deployment information
    deployment_name = Column(String(255), nullable=False)
    environment = Column(String(100))  # dev, staging, production
    endpoint_url = Column(String(1000))

    # Deployment strategy
    strategy = Column(Enum(DeploymentStrategy), default=DeploymentStrategy.ROLLING)
    strategy_config = Column(JSON)  # Strategy-specific configuration

    # Traffic management
    traffic_percentage = Column(Float, default=100.0)  # For canary/A-B testing
    target_instances = Column(Integer, default=1)
    current_instances = Column(Integer, default=0)

    # Health and status
    is_active = Column(Boolean, default=True)
    health_check_url = Column(String(1000))
    last_health_check = Column(DateTime(timezone=True))
    health_status = Column(String(50))  # healthy, unhealthy, unknown

    # Performance thresholds
    performance_thresholds = Column(JSON)  # Thresholds for auto-rollback
    auto_rollback_enabled = Column(Boolean, default=True)

    # Deployment metadata
    deployed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    deployment_config = Column(JSON)  # Deployment-specific configuration
    rollback_version_id = Column(UUID(as_uuid=True), ForeignKey("ml_model_versions.id"))

    # Timestamps
    deployed_at = Column(DateTime(timezone=True), server_default=func.now())
    last_updated = Column(DateTime(timezone=True), onupdate=func.now())
    stopped_at = Column(DateTime(timezone=True))

    # Relationships
    model = relationship("ModelRegistry", back_populates="deployments")
    version = relationship("ModelVersion", back_populates="deployments", foreign_keys=[version_id])
    rollback_version = relationship("ModelVersion", foreign_keys=[rollback_version_id])
    performance_logs = relationship("ModelPerformanceLog", back_populates="deployment")

    # Indexes for performance
    __table_args__ = (
        Index('idx_model_deployment_model_id', model_id),
        Index('idx_model_deployment_version_id', version_id),
        Index('idx_model_deployment_environment', environment),
        Index('idx_model_deployment_active', is_active),
    )


class ModelPerformanceMetric(Base):
    """
    Model performance metrics definition and configuration
    """
    __tablename__ = "ml_model_performance_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(UUID(as_uuid=True), ForeignKey("ml_model_registry.id"), nullable=False)

    # Metric definition
    metric_name = Column(String(255), nullable=False)
    metric_type = Column(Enum(PerformanceMetricType), nullable=False)
    metric_description = Column(Text)

    # Thresholds and alerting
    warning_threshold = Column(Float)
    critical_threshold = Column(Float)
    target_value = Column(Float)
    higher_is_better = Column(Boolean, default=True)

    # Configuration
    calculation_config = Column(JSON)  # Custom calculation parameters
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    model = relationship("ModelRegistry", back_populates="performance_metrics")
    performance_logs = relationship("ModelPerformanceLog", back_populates="metric")

    # Indexes for performance
    __table_args__ = (
        Index('idx_model_metric_model_id', model_id),
        Index('idx_model_metric_name', metric_name),
        Index('idx_model_metric_type', metric_type),
    )


class ModelPerformanceLog(Base):
    """
    Real-time model performance tracking and monitoring
    """
    __tablename__ = "ml_model_performance_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(UUID(as_uuid=True), ForeignKey("ml_model_registry.id"), nullable=False)
    version_id = Column(UUID(as_uuid=True), ForeignKey("ml_model_versions.id"), nullable=False)
    deployment_id = Column(UUID(as_uuid=True), ForeignKey("ml_model_deployments.id"))
    metric_id = Column(UUID(as_uuid=True), ForeignKey("ml_model_performance_metrics.id"), nullable=False)

    # Performance data
    metric_value = Column(Float, nullable=False)
    evaluation_dataset_id = Column(UUID(as_uuid=True))  # Reference to evaluation dataset
    sample_size = Column(Integer)

    # Context information
    evaluation_context = Column(JSON)  # Additional context about evaluation
    data_drift_score = Column(Float)  # Measure of data drift
    model_confidence = Column(Float)  # Model prediction confidence

    # Computation metadata
    computation_time_ms = Column(Integer)
    memory_usage_mb = Column(Float)

    # Timestamps
    measured_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    model = relationship("ModelRegistry")
    version = relationship("ModelVersion", back_populates="performance_logs")
    deployment = relationship("ModelDeployment", back_populates="performance_logs")
    metric = relationship("ModelPerformanceMetric", back_populates="performance_logs")

    # Indexes for performance
    __table_args__ = (
        Index('idx_model_perf_log_model_id', model_id),
        Index('idx_model_perf_log_version_id', version_id),
        Index('idx_model_perf_log_deployment_id', deployment_id),
        Index('idx_model_perf_log_metric_id', metric_id),
        Index('idx_model_perf_log_measured_at', measured_at),
    )


class ModelLineage(Base):
    """
    Model lineage tracking for data provenance and reproducibility
    """
    __tablename__ = "ml_model_lineage"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(UUID(as_uuid=True), ForeignKey("ml_model_registry.id"), nullable=False)
    version_id = Column(UUID(as_uuid=True), ForeignKey("ml_model_versions.id"), nullable=False)

    # Data lineage
    input_datasets = Column(JSON)  # List of input dataset references
    feature_store_snapshots = Column(JSON)  # Feature store snapshot references
    preprocessing_pipeline = Column(JSON)  # Preprocessing steps and versions

    # Experiment tracking
    experiment_id = Column(String(255))  # MLflow, Weights & Biases, etc.
    experiment_config = Column(JSON)  # Experiment configuration
    hyperparameters = Column(JSON)  # Model hyperparameters

    # Code and environment
    code_repository = Column(String(500))  # Git repository URL
    code_commit_hash = Column(String(64))  # Git commit hash
    code_branch = Column(String(255))  # Git branch
    environment_snapshot = Column(JSON)  # Python environment, Docker image, etc.

    # Execution context
    training_infrastructure = Column(JSON)  # Computing resources used
    training_start_time = Column(DateTime(timezone=True))
    training_end_time = Column(DateTime(timezone=True))

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    model = relationship("ModelRegistry")
    version = relationship("ModelVersion")

    # Indexes for performance
    __table_args__ = (
        Index('idx_model_lineage_model_id', model_id),
        Index('idx_model_lineage_version_id', version_id),
        Index('idx_model_lineage_experiment_id', experiment_id),
    )


class ModelAlert(Base):
    """
    Model performance alerts and notifications
    """
    __tablename__ = "ml_model_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(UUID(as_uuid=True), ForeignKey("ml_model_registry.id"), nullable=False)
    deployment_id = Column(UUID(as_uuid=True), ForeignKey("ml_model_deployments.id"))
    metric_id = Column(UUID(as_uuid=True), ForeignKey("ml_model_performance_metrics.id"))

    # Alert information
    alert_type = Column(String(100), nullable=False)  # performance_degradation, data_drift, etc.
    severity = Column(Enum(AlertSeverity), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)

    # Alert data
    trigger_value = Column(Float)
    threshold_value = Column(Float)
    alert_data = Column(JSON)  # Additional alert context

    # Status and resolution
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    resolved_at = Column(DateTime(timezone=True))
    resolution_notes = Column(Text)

    # Notifications
    notification_channels = Column(JSON)  # Email, Slack, webhook URLs
    notification_sent = Column(Boolean, default=False)
    notification_attempts = Column(Integer, default=0)

    # Timestamps
    triggered_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    model = relationship("ModelRegistry")
    deployment = relationship("ModelDeployment")
    metric = relationship("ModelPerformanceMetric")

    # Indexes for performance
    __table_args__ = (
        Index('idx_model_alert_model_id', model_id),
        Index('idx_model_alert_deployment_id', deployment_id),
        Index('idx_model_alert_severity', severity),
        Index('idx_model_alert_resolved', is_resolved),
        Index('idx_model_alert_triggered_at', triggered_at),
    )


class ModelAuditLog(Base):
    """
    Comprehensive audit logging for ML model operations
    """
    __tablename__ = "ml_model_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(UUID(as_uuid=True), ForeignKey("ml_model_registry.id"))
    version_id = Column(UUID(as_uuid=True), ForeignKey("ml_model_versions.id"))
    deployment_id = Column(UUID(as_uuid=True), ForeignKey("ml_model_deployments.id"))

    # Action information
    action_type = Column(String(100), nullable=False)  # create, update, deploy, rollback, etc.
    action_description = Column(Text)
    action_data = Column(JSON)  # Action-specific data

    # User and context
    performed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    ip_address = Column(String(45))  # IPv4 or IPv6
    user_agent = Column(String(500))
    session_id = Column(String(255))

    # Results and impacts
    action_result = Column(String(50))  # success, failure, partial
    error_message = Column(Text)
    changes_made = Column(JSON)  # What specifically changed

    # Timestamps
    performed_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    model = relationship("ModelRegistry")
    version = relationship("ModelVersion")
    deployment = relationship("ModelDeployment")

    # Indexes for performance
    __table_args__ = (
        Index('idx_model_audit_model_id', model_id),
        Index('idx_model_audit_performed_by', performed_by),
        Index('idx_model_audit_action_type', action_type),
        Index('idx_model_audit_performed_at', performed_at),
    )