"""
Enhanced MLOps Database Models
==============================

Comprehensive database models for enhanced MLOps platform including:
- Model registry with versioning and lineage
- Advanced experiment tracking and management
- Real-time metrics and resource monitoring
- Collaborative experiment sharing
- Multi-objective optimization tracking
- Experiment genealogy and lineage
- Training job orchestration
- Model deployments and A/B testing
- Performance monitoring and alerts
- Approval workflows and governance
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean, JSON, Index, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from enum import Enum
import uuid

# Import existing base from manufacturing models
try:
    from app.models.manufacturing import Base
except ImportError:
    Base = declarative_base()


# Enums
class ModelStatus(str, Enum):
    """Model status in the registry."""
    REGISTERED = "registered"
    TRAINING = "training"
    TRAINED = "trained"
    VALIDATING = "validating"
    VALIDATED = "validated"
    DEPLOYING = "deploying"
    DEPLOYED = "deployed"
    DEPRECATED = "deprecated"
    ARCHIVED = "archived"


class ModelFramework(str, Enum):
    """Supported ML frameworks."""
    TENSORFLOW = "tensorflow"
    PYTORCH = "pytorch"
    SKLEARN = "sklearn"
    XGBOOST = "xgboost"
    LIGHTGBM = "lightgbm"
    CATBOOST = "catboost"
    CUSTOM = "custom"


class ExperimentStatus(str, Enum):
    """Experiment status."""
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TrainingJobStatus(str, Enum):
    """Training job status."""
    QUEUED = "queued"
    PREPARING = "preparing"
    TRAINING = "training"
    OPTIMIZING = "optimizing"
    EVALUATING = "evaluating"
    COMPLETING = "completing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class DeploymentStatus(str, Enum):
    """Deployment status."""
    PENDING = "pending"
    DEPLOYING = "deploying"
    DEPLOYED = "deployed"
    FAILED = "failed"
    SCALING = "scaling"
    UPDATING = "updating"
    TERMINATED = "terminated"


class DeploymentType(str, Enum):
    """Deployment types."""
    PRODUCTION = "production"
    STAGING = "staging"
    DEVELOPMENT = "development"
    A_B_TEST = "ab_test"
    CANARY = "canary"
    SHADOW = "shadow"


class ApprovalStatus(str, Enum):
    """Approval workflow status."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


# Database Models
class MLModel(Base):
    """Model registry table."""
    
    __tablename__ = 'ml_models'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False, index=True)
    version = Column(String(50), nullable=False)
    framework = Column(SQLEnum(ModelFramework), nullable=False)
    model_type = Column(String(50), nullable=False)  # 'classification', 'regression', etc.
    
    # Description and metadata
    description = Column(Text)
    tags = Column(JSON)  # List of tags
    author = Column(String(100), nullable=False)
    
    # Model specifications
    input_schema = Column(JSON)  # Input data schema
    output_schema = Column(JSON)  # Output data schema
    feature_names = Column(JSON)  # List of feature names
    target_names = Column(JSON)  # List of target names
    
    # Training information
    training_dataset_id = Column(String(100))
    hyperparameters = Column(JSON)
    training_metrics = Column(JSON)
    validation_metrics = Column(JSON)
    
    # Deployment information
    deployment_config = Column(JSON)
    resource_requirements = Column(JSON)
    
    # Lineage and dependencies
    parent_model_id = Column(String(100), ForeignKey('ml_models.model_id'))
    experiment_id = Column(String(100), ForeignKey('ml_experiments.experiment_id'))
    dependencies = Column(JSON)  # List of dependencies
    
    # Status and lifecycle
    status = Column(SQLEnum(ModelStatus), default=ModelStatus.REGISTERED, index=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Model artifact information
    artifact_path = Column(String(500))  # Path to model artifact
    artifact_checksum = Column(String(128))  # SHA-256 checksum
    artifact_size_bytes = Column(Integer)
    
    # Relationships
    parent_model = relationship("MLModel", remote_side=[model_id])
    child_models = relationship("MLModel", back_populates="parent_model")
    experiment = relationship("MLExperiment", back_populates="models")
    deployments = relationship("ModelDeployment", back_populates="model")
    performance_logs = relationship("ModelPerformanceLog", back_populates="model")
    approvals = relationship("ModelApproval", back_populates="model")
    
    # Indexes
    __table_args__ = (
        Index('idx_model_name_version', 'name', 'version'),
        Index('idx_model_status_framework', 'status', 'framework'),
        Index('idx_model_created_at', 'created_at'),
    )
    
    @property
    def full_name(self) -> str:
        """Get full model name with version."""
        return f"{self.name}:{self.version}"
    
    @property
    def is_deployed(self) -> bool:
        """Check if model is currently deployed."""
        return self.status == ModelStatus.DEPLOYED
    
    @property
    def lineage_depth(self) -> int:
        """Calculate lineage depth (how many ancestors)."""
        depth = 0
        current = self
        while current.parent_model_id:
            depth += 1
            current = current.parent_model
            if depth > 100:  # Prevent infinite loops
                break
        return depth


class MLExperiment(Base):
    """Experiment tracking table."""
    
    __tablename__ = 'ml_experiments'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    experiment_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text)
    created_by = Column(String(100), nullable=False)
    
    # Experiment configuration
    dataset_config = Column(JSON)  # Data source configuration
    target_column = Column(String(100))
    feature_columns = Column(JSON)  # List of feature columns
    
    # Model configurations
    model_configs = Column(JSON)  # List of model configurations
    
    # Training configuration
    train_test_split = Column(JSON)
    cross_validation = Column(JSON)
    
    # Optimization configuration
    hyperparameter_search = Column(JSON)
    optimization_budget = Column(Integer, default=50)
    max_training_time_minutes = Column(Integer, default=60)
    
    # Evaluation configuration
    evaluation_metrics = Column(JSON)  # List of metrics to evaluate
    early_stopping = Column(JSON)
    
    # Status and results
    status = Column(SQLEnum(ExperimentStatus), default=ExperimentStatus.QUEUED, index=True)
    results = Column(JSON)  # Experiment results
    
    # Resource usage
    total_training_time_minutes = Column(Float)
    peak_memory_usage_gb = Column(Float)
    cpu_hours_used = Column(Float)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    
    # Relationships
    models = relationship("MLModel", back_populates="experiment")
    training_jobs = relationship("TrainingJob", back_populates="experiment")
    
    # Indexes
    __table_args__ = (
        Index('idx_experiment_status_created', 'status', 'created_at'),
        Index('idx_experiment_created_by', 'created_by'),
    )
    
    @property
    def duration_minutes(self) -> Optional[float]:
        """Calculate experiment duration in minutes."""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds() / 60
        return None
    
    @property
    def is_running(self) -> bool:
        """Check if experiment is currently running."""
        return self.status == ExperimentStatus.RUNNING


class TrainingJob(Base):
    """Training job orchestration table."""
    
    __tablename__ = 'training_jobs'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    experiment_id = Column(String(100), ForeignKey('ml_experiments.experiment_id'), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    
    # Data configuration
    data_config = Column(JSON)
    target_column = Column(String(100))
    feature_columns = Column(JSON)
    
    # Model configurations
    model_configs = Column(JSON)  # List of model configurations to train
    
    # Training configuration
    train_test_split_config = Column(JSON)
    validation_config = Column(JSON)
    
    # Optimization configuration
    optimization_method = Column(String(50))  # 'grid_search', 'random_search', 'bayesian'
    optimization_budget = Column(Integer, default=50)
    max_training_time_hours = Column(Float, default=2.0)
    early_stopping_config = Column(JSON)
    
    # Resource configuration
    max_parallel_jobs = Column(Integer, default=4)
    memory_limit_gb = Column(Float, default=4.0)
    gpu_enabled = Column(Boolean, default=False)
    distributed_training = Column(Boolean, default=False)
    
    # Output configuration
    save_intermediate_models = Column(Boolean, default=True)
    model_registry_config = Column(JSON)
    
    # Status and progress
    status = Column(SQLEnum(TrainingJobStatus), default=TrainingJobStatus.QUEUED, index=True)
    progress = Column(Float, default=0.0)  # 0-100 percentage
    current_step = Column(String(200))
    error_message = Column(Text)
    
    # Results
    total_models_trained = Column(Integer, default=0)
    successful_models = Column(Integer, default=0)
    failed_models = Column(Integer, default=0)
    best_model_id = Column(String(100))
    best_score = Column(Float)
    
    # Resource usage
    training_time_hours = Column(Float)
    peak_memory_usage_gb = Column(Float)
    cpu_hours_used = Column(Float)
    
    # Metadata
    created_by = Column(String(100), nullable=False)
    priority = Column(Integer, default=1)  # 1-10 priority scale
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    
    # Relationships
    experiment = relationship("MLExperiment", back_populates="training_jobs")
    
    # Indexes
    __table_args__ = (
        Index('idx_job_status_priority', 'status', 'priority'),
        Index('idx_job_created_by', 'created_by'),
        Index('idx_job_experiment', 'experiment_id'),
    )
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate of model training."""
        if self.total_models_trained > 0:
            return self.successful_models / self.total_models_trained
        return 0.0


class ModelDeployment(Base):
    """Model deployment tracking table."""
    
    __tablename__ = 'model_deployments'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    deployment_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    model_id = Column(String(100), ForeignKey('ml_models.model_id'), nullable=False)
    name = Column(String(200), nullable=False)
    
    # Deployment configuration
    deployment_type = Column(SQLEnum(DeploymentType), nullable=False)
    environment = Column(String(50), nullable=False)  # 'production', 'staging', 'development'
    
    # Infrastructure configuration
    replicas = Column(Integer, default=1)
    resource_limits = Column(JSON)  # CPU, memory limits
    auto_scaling = Column(JSON)  # Auto-scaling configuration
    
    # Traffic routing
    traffic_percentage = Column(Float, default=100.0)  # For A/B testing
    routing_rules = Column(JSON)
    
    # Monitoring configuration
    monitoring_config = Column(JSON)
    alert_rules = Column(JSON)
    health_check_config = Column(JSON)
    
    # Status and health
    status = Column(SQLEnum(DeploymentStatus), default=DeploymentStatus.PENDING, index=True)
    health_status = Column(String(50))  # 'healthy', 'unhealthy', 'degraded'
    last_health_check = Column(DateTime)
    
    # Performance metrics
    request_count = Column(Integer, default=0)
    avg_response_time_ms = Column(Float)
    error_rate = Column(Float)
    throughput_rps = Column(Float)  # Requests per second
    
    # A/B Testing
    ab_test_id = Column(String(100))
    ab_test_config = Column(JSON)
    champion_challenger = Column(String(50))  # 'champion', 'challenger'
    
    # Metadata
    deployed_by = Column(String(100), nullable=False)
    deployment_notes = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    deployed_at = Column(DateTime)
    last_updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    terminated_at = Column(DateTime)
    
    # Relationships
    model = relationship("MLModel", back_populates="deployments")
    
    # Indexes
    __table_args__ = (
        Index('idx_deployment_status_env', 'status', 'environment'),
        Index('idx_deployment_type', 'deployment_type'),
        Index('idx_deployment_ab_test', 'ab_test_id'),
    )
    
    @property
    def is_active(self) -> bool:
        """Check if deployment is active."""
        return self.status == DeploymentStatus.DEPLOYED
    
    @property
    def uptime_hours(self) -> float:
        """Calculate deployment uptime in hours."""
        if self.deployed_at:
            end_time = self.terminated_at or datetime.utcnow()
            return (end_time - self.deployed_at).total_seconds() / 3600
        return 0.0


class ModelPerformanceLog(Base):
    """Model performance tracking over time."""
    
    __tablename__ = 'model_performance_logs'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(String(100), ForeignKey('ml_models.model_id'), nullable=False)
    deployment_id = Column(String(100), ForeignKey('model_deployments.deployment_id'))
    
    # Performance data
    dataset_name = Column(String(100), default="production")
    metrics = Column(JSON)  # Dictionary of metric names to values
    sample_size = Column(Integer)
    
    # Data drift detection
    feature_drift_score = Column(Float)
    label_drift_score = Column(Float)
    drift_detected = Column(Boolean, default=False)
    
    # Model predictions analysis
    prediction_distribution = Column(JSON)
    confidence_distribution = Column(JSON)
    
    # Timestamps
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)
    data_period_start = Column(DateTime)  # Period of data this log represents
    data_period_end = Column(DateTime)
    
    # Relationships
    model = relationship("MLModel", back_populates="performance_logs")
    deployment = relationship("ModelDeployment")
    
    # Indexes
    __table_args__ = (
        Index('idx_perf_model_recorded', 'model_id', 'recorded_at'),
        Index('idx_perf_deployment', 'deployment_id'),
        Index('idx_perf_drift', 'drift_detected'),
    )


class ModelApproval(Base):
    """Model approval workflow table."""
    
    __tablename__ = 'model_approvals'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    approval_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    model_id = Column(String(100), ForeignKey('ml_models.model_id'), nullable=False)
    
    # Approval workflow
    status = Column(SQLEnum(ApprovalStatus), default=ApprovalStatus.PENDING, index=True)
    requester = Column(String(100), nullable=False)
    required_approvals = Column(Integer, default=2)
    
    # Approval details
    approvals = Column(JSON)  # List of approval records
    rejection_reason = Column(Text)
    comments = Column(JSON)  # List of comments
    
    # Approval criteria
    approval_criteria = Column(JSON)  # Criteria that must be met
    performance_thresholds = Column(JSON)  # Performance thresholds
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    approved_at = Column(DateTime)
    rejected_at = Column(DateTime)
    
    # Relationships
    model = relationship("MLModel", back_populates="approvals")
    
    # Indexes
    __table_args__ = (
        Index('idx_approval_status', 'status'),
        Index('idx_approval_requester', 'requester'),
    )
    
    @property
    def current_approval_count(self) -> int:
        """Get current number of approvals."""
        if self.approvals:
            return len(self.approvals)
        return 0
    
    @property
    def is_fully_approved(self) -> bool:
        """Check if model is fully approved."""
        return self.current_approval_count >= self.required_approvals


class ABTest(Base):
    """A/B testing configuration and results."""
    
    __tablename__ = 'ab_tests'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    description = Column(Text)
    
    # Test configuration
    champion_model_id = Column(String(100), ForeignKey('ml_models.model_id'), nullable=False)
    challenger_model_id = Column(String(100), ForeignKey('ml_models.model_id'), nullable=False)
    
    # Traffic allocation
    champion_traffic_pct = Column(Float, default=50.0)
    challenger_traffic_pct = Column(Float, default=50.0)
    
    # Test parameters
    target_metric = Column(String(100))  # Primary metric to optimize
    minimum_sample_size = Column(Integer, default=1000)
    statistical_significance = Column(Float, default=0.95)  # 95% confidence
    max_duration_days = Column(Integer, default=30)
    
    # Test results
    champion_metrics = Column(JSON)
    challenger_metrics = Column(JSON)
    statistical_results = Column(JSON)  # P-values, confidence intervals, etc.
    winner_model_id = Column(String(100))
    
    # Status
    status = Column(String(50), default="running", index=True)  # 'running', 'completed', 'stopped'
    
    # Metadata
    created_by = Column(String(100), nullable=False)
    notes = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    ended_at = Column(DateTime)
    
    # Relationships
    champion_model = relationship("MLModel", foreign_keys=[champion_model_id])
    challenger_model = relationship("MLModel", foreign_keys=[challenger_model_id])
    
    # Indexes
    __table_args__ = (
        Index('idx_abtest_status', 'status'),
        Index('idx_abtest_models', 'champion_model_id', 'challenger_model_id'),
    )
    
    @property
    def duration_days(self) -> Optional[float]:
        """Calculate test duration in days."""
        if self.started_at and self.ended_at:
            return (self.ended_at - self.started_at).total_seconds() / 86400
        elif self.started_at:
            return (datetime.utcnow() - self.started_at).total_seconds() / 86400
        return None


class ModelAlert(Base):
    """Model monitoring alerts."""
    
    __tablename__ = 'model_alerts'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    model_id = Column(String(100), ForeignKey('ml_models.model_id'), nullable=False)
    deployment_id = Column(String(100), ForeignKey('model_deployments.deployment_id'))
    
    # Alert details
    alert_type = Column(String(100), nullable=False)  # 'performance_degradation', 'drift_detected', etc.
    severity = Column(String(50), default="medium")  # 'low', 'medium', 'high', 'critical'
    title = Column(String(200), nullable=False)
    description = Column(Text)
    
    # Alert triggers
    metric_name = Column(String(100))
    metric_value = Column(Float)
    threshold_value = Column(Float)
    
    # Status
    status = Column(String(50), default="active", index=True)  # 'active', 'acknowledged', 'resolved'
    acknowledged_by = Column(String(100))
    acknowledged_at = Column(DateTime)
    resolved_by = Column(String(100))
    resolved_at = Column(DateTime)
    
    # Alert configuration
    alert_rule_config = Column(JSON)
    notification_sent = Column(Boolean, default=False)
    
    # Timestamps
    triggered_at = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    model = relationship("MLModel")
    deployment = relationship("ModelDeployment")
    
    # Indexes
    __table_args__ = (
        Index('idx_alert_status_severity', 'status', 'severity'),
        Index('idx_alert_type', 'alert_type'),
        Index('idx_alert_triggered', 'triggered_at'),
    )


class DatasetVersion(Base):
    """Dataset versioning for reproducibility."""
    
    __tablename__ = 'dataset_versions'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(String(100), index=True, nullable=False)
    version = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    
    # Dataset information
    description = Column(Text)
    data_source = Column(String(500))  # Path or connection string
    schema_config = Column(JSON)  # Dataset schema
    
    # Statistics
    row_count = Column(Integer)
    column_count = Column(Integer)
    file_size_bytes = Column(Integer)
    data_checksum = Column(String(128))  # SHA-256 of data
    
    # Quality metrics
    quality_score = Column(Float)
    completeness_score = Column(Float)
    consistency_score = Column(Float)
    data_quality_report = Column(JSON)
    
    # Lineage
    parent_dataset_id = Column(String(100))
    transformation_config = Column(JSON)  # How this version was created
    
    # Metadata
    created_by = Column(String(100), nullable=False)
    tags = Column(JSON)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Indexes
    __table_args__ = (
        Index('idx_dataset_id_version', 'dataset_id', 'version', unique=True),
        Index('idx_dataset_created', 'created_at'),
    )


# Association tables for many-to-many relationships
class ModelTag(Base):
    """Model tagging for organization."""
    
    __tablename__ = 'model_tags'
    
    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(String(100), ForeignKey('ml_models.model_id'), nullable=False)
    tag = Column(String(100), nullable=False)
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_model_tag', 'model_id', 'tag', unique=True),
    )


class ModelDependency(Base):
    """Model dependencies tracking."""
    
    __tablename__ = 'model_dependencies'
    
    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(String(100), ForeignKey('ml_models.model_id'), nullable=False)
    dependency_type = Column(String(50), nullable=False)  # 'feature_store', 'preprocessing', 'ensemble_member'
    dependency_id = Column(String(100), nullable=False)  # ID of the dependency
    dependency_version = Column(String(50))
    is_critical = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_model_dep', 'model_id', 'dependency_type'),
    )


# Enhanced Experiment Tracking Models

class ExperimentType(str, Enum):
    """Enhanced experiment types."""
    SINGLE_MODEL = "single_model"
    MODEL_COMPARISON = "model_comparison"
    HYPERPARAMETER_OPTIMIZATION = "hyperparameter_optimization"
    FEATURE_SELECTION = "feature_selection"
    ARCHITECTURE_SEARCH = "architecture_search"
    ENSEMBLE_OPTIMIZATION = "ensemble_optimization"
    MULTI_OBJECTIVE = "multi_objective"


class MetricType(str, Enum):
    """Types of metrics that can be tracked."""
    ACCURACY = "accuracy"
    PRECISION = "precision"
    RECALL = "recall"
    F1_SCORE = "f1_score"
    AUC_ROC = "auc_roc"
    AUC_PR = "auc_pr"
    MSE = "mse"
    MAE = "mae"
    RMSE = "rmse"
    R2 = "r2"
    LOSS = "loss"
    VAL_LOSS = "val_loss"
    CUSTOM = "custom"


class OptimizationObjective(str, Enum):
    """Multi-objective optimization objectives."""
    MAXIMIZE = "maximize"
    MINIMIZE = "minimize"
    TARGET = "target"


class SharePermission(str, Enum):
    """Experiment sharing permissions."""
    VIEW = "view"
    EDIT = "edit"
    ADMIN = "admin"


class EnhancedExperiment(Base):
    """Enhanced experiment tracking with advanced capabilities."""
    
    __tablename__ = 'enhanced_experiments'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    experiment_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text)
    experiment_type = Column(SQLEnum(ExperimentType), nullable=False)
    created_by = Column(String(100), nullable=False)
    
    # Experiment configuration
    dataset_config = Column(JSON)  # Enhanced dataset configuration
    model_configs = Column(JSON)  # List of model configurations
    optimization_objectives = Column(JSON)  # List of optimization objectives
    custom_metrics = Column(JSON)  # Custom metric definitions
    
    # Enhanced tracking features
    tags = Column(JSON)  # List of tags for organization
    metadata = Column(JSON)  # Additional metadata
    
    # Collaboration features
    shared_with = Column(JSON)  # Users with access {user_id: permission}
    shared_teams = Column(JSON)  # Teams with access {team_id: permission}
    is_public = Column(Boolean, default=False)
    comments = Column(JSON)  # Discussion comments
    discussion_thread_id = Column(String(100))
    
    # Lineage and genealogy
    parent_experiment_ids = Column(JSON)  # List of parent experiment IDs
    child_experiment_ids = Column(JSON)  # List of child experiment IDs
    related_experiment_ids = Column(JSON)  # Related experiments
    fork_reason = Column(Text)  # Reason for forking
    merge_source_ids = Column(JSON)  # Source experiments for merging
    lineage_depth = Column(Integer, default=0)
    
    # Resource tracking
    resource_requirements = Column(JSON)  # Required resources
    actual_resource_usage = Column(JSON)  # Actual resource consumption
    max_training_time_minutes = Column(Integer, default=60)
    optimization_budget = Column(Integer, default=50)
    
    # Status and lifecycle
    status = Column(SQLEnum(ExperimentStatus), default=ExperimentStatus.QUEUED, index=True)
    progress = Column(Float, default=0.0)  # 0-100 percentage
    current_step = Column(String(200))
    error_message = Column(Text)
    
    # Results and insights
    final_results = Column(JSON)  # Final experiment results
    performance_summary = Column(JSON)  # Performance summary metrics
    best_hyperparameters = Column(JSON)  # Best hyperparameters found
    convergence_analysis = Column(JSON)  # Convergence analysis results
    efficiency_score = Column(Float)  # Resource efficiency score
    insights = Column(JSON)  # Generated insights and recommendations
    anomalies = Column(JSON)  # Detected anomalies
    
    # MLflow integration
    mlflow_experiment_id = Column(String(100))  # MLflow experiment ID
    mlflow_run_ids = Column(JSON)  # Associated MLflow run IDs
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    last_activity_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    metrics = relationship("EnhancedExperimentMetric", back_populates="experiment", cascade="all, delete-orphan")
    hyperparameters = relationship("ExperimentHyperparameter", back_populates="experiment", cascade="all, delete-orphan")
    resource_logs = relationship("ExperimentResourceLog", back_populates="experiment", cascade="all, delete-orphan")
    comparisons = relationship("ExperimentComparison", foreign_keys="ExperimentComparison.experiment_id", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index('idx_enhanced_exp_status_created', 'status', 'created_at'),
        Index('idx_enhanced_exp_type', 'experiment_type'),
        Index('idx_enhanced_exp_created_by', 'created_by'),
        Index('idx_enhanced_exp_lineage', 'lineage_depth'),
    )
    
    @property
    def is_running(self) -> bool:
        """Check if experiment is currently running."""
        return self.status == ExperimentStatus.RUNNING
    
    @property
    def duration_minutes(self) -> Optional[float]:
        """Calculate experiment duration in minutes."""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds() / 60
        return None
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate based on objectives."""
        if not self.final_results:
            return 0.0
        
        # Simple success calculation - would be more sophisticated in practice
        performance_metrics = self.performance_summary or {}
        if performance_metrics:
            return min(1.0, sum(performance_metrics.values()) / len(performance_metrics))
        return 0.0


class EnhancedExperimentMetric(Base):
    """Real-time experiment metrics tracking."""
    
    __tablename__ = 'enhanced_experiment_metrics'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    experiment_id = Column(String(100), ForeignKey('enhanced_experiments.experiment_id'), nullable=False)
    metric_name = Column(String(100), nullable=False, index=True)
    
    # Metric data
    value = Column(Float, nullable=False)
    step = Column(Integer, default=0, index=True)
    epoch = Column(Integer)
    
    # Metric metadata
    metric_type = Column(SQLEnum(MetricType), default=MetricType.CUSTOM)
    objective = Column(SQLEnum(OptimizationObjective), default=OptimizationObjective.MAXIMIZE)
    weight = Column(Float, default=1.0)
    threshold = Column(Float)
    is_primary = Column(Boolean, default=False)
    
    # Additional context
    metadata = Column(JSON)  # Additional metric metadata
    tags = Column(JSON)  # Metric tags
    
    # Data quality
    confidence = Column(Float)  # Confidence in the metric value
    source = Column(String(50))  # Source of the metric (training, validation, test)
    
    # Timestamps
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    experiment = relationship("EnhancedExperiment", back_populates="metrics")
    
    # Indexes
    __table_args__ = (
        Index('idx_enhanced_metric_exp_name', 'experiment_id', 'metric_name'),
        Index('idx_enhanced_metric_step', 'experiment_id', 'step'),
        Index('idx_enhanced_metric_recorded', 'recorded_at'),
        Index('idx_enhanced_metric_primary', 'is_primary'),
    )


class ExperimentHyperparameter(Base):
    """Experiment hyperparameter tracking."""
    
    __tablename__ = 'experiment_hyperparameters'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    experiment_id = Column(String(100), ForeignKey('enhanced_experiments.experiment_id'), nullable=False)
    parameter_name = Column(String(100), nullable=False, index=True)
    
    # Parameter data
    parameter_value = Column(Text, nullable=False)  # JSON-serialized value
    parameter_type = Column(String(50))  # 'int', 'float', 'str', 'bool', 'list', 'dict'
    
    # Parameter metadata
    search_space = Column(JSON)  # Search space definition for optimization
    importance_score = Column(Float)  # Parameter importance (0-1)
    is_optimized = Column(Boolean, default=False)  # Whether this was optimized
    optimization_history = Column(JSON)  # History of values tried during optimization
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    experiment = relationship("EnhancedExperiment", back_populates="hyperparameters")
    
    # Indexes
    __table_args__ = (
        Index('idx_exp_hyperparam', 'experiment_id', 'parameter_name', unique=True),
        Index('idx_hyperparam_importance', 'importance_score'),
    )


class ExperimentResourceLog(Base):
    """Real-time experiment resource usage logging."""
    
    __tablename__ = 'experiment_resource_logs'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    experiment_id = Column(String(100), ForeignKey('enhanced_experiments.experiment_id'), nullable=False)
    
    # Resource metrics
    cpu_usage_percent = Column(Float)
    memory_usage_gb = Column(Float)
    gpu_usage_percent = Column(Float)
    gpu_memory_usage_gb = Column(Float)
    disk_io_mb_s = Column(Float)
    network_io_mb_s = Column(Float)
    
    # System information
    node_name = Column(String(100))
    process_id = Column(Integer)
    
    # Cost tracking (if available)
    estimated_cost_usd = Column(Float)  # Estimated cost per hour
    carbon_emissions_g = Column(Float)  # Estimated carbon emissions in grams
    
    # Timestamp
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    experiment = relationship("EnhancedExperiment", back_populates="resource_logs")
    
    # Indexes
    __table_args__ = (
        Index('idx_resource_log_exp_time', 'experiment_id', 'recorded_at'),
        Index('idx_resource_log_node', 'node_name'),
    )


class CustomMetricDefinition(Base):
    """Custom metric definitions for experiments."""
    
    __tablename__ = 'custom_metric_definitions'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    metric_name = Column(String(100), unique=True, nullable=False, index=True)
    
    # Metric specification
    description = Column(Text)
    metric_type = Column(SQLEnum(MetricType), default=MetricType.CUSTOM)
    objective = Column(SQLEnum(OptimizationObjective), default=OptimizationObjective.MAXIMIZE)
    
    # Configuration
    aggregation_method = Column(String(50), default="mean")  # mean, median, max, min, last
    weight = Column(Float, default=1.0)
    threshold = Column(Float)
    is_primary = Column(Boolean, default=False)
    
    # Metadata
    tags = Column(JSON)  # Metric tags
    formula = Column(Text)  # Mathematical formula (if applicable)
    units = Column(String(50))  # Measurement units
    
    # Usage tracking
    usage_count = Column(Integer, default=0)  # How many experiments use this metric
    
    # Metadata
    created_by = Column(String(100), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('idx_custom_metric_type', 'metric_type'),
        Index('idx_custom_metric_usage', 'usage_count'),
    )


class ExperimentComparison(Base):
    """Statistical experiment comparisons."""
    
    __tablename__ = 'experiment_comparisons'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    comparison_id = Column(String(100), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    
    # Comparison configuration
    experiment_id = Column(String(100), ForeignKey('enhanced_experiments.experiment_id'), nullable=False)
    compared_experiment_ids = Column(JSON)  # List of experiment IDs being compared
    comparison_type = Column(String(50), default="ttest")  # Statistical test type
    comparison_metrics = Column(JSON)  # Metrics being compared
    
    # Results
    winner_experiment_id = Column(String(100))
    statistical_significance = Column(Float)  # P-value or confidence level
    effect_size = Column(Float)  # Effect size (Cohen's d, etc.)
    confidence_level = Column(Float, default=0.95)
    performance_improvement = Column(Float)  # Percentage improvement
    
    # Detailed results
    comparison_results = Column(JSON)  # Detailed comparison results
    insights = Column(JSON)  # Generated insights from comparison
    
    # Metadata
    created_by = Column(String(100), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('idx_comparison_exp', 'experiment_id'),
        Index('idx_comparison_winner', 'winner_experiment_id'),
        Index('idx_comparison_created', 'created_at'),
    )


class ExperimentInsight(Base):
    """Generated experiment insights and recommendations."""
    
    __tablename__ = 'experiment_insights'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    insight_id = Column(String(100), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    experiment_id = Column(String(100), ForeignKey('enhanced_experiments.experiment_id'), nullable=False)
    
    # Insight details
    insight_type = Column(String(50), nullable=False)  # 'performance', 'efficiency', 'convergence', 'anomaly'
    category = Column(String(50))  # 'hyperparameters', 'architecture', 'training', 'data'
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    recommendation = Column(Text)
    
    # Confidence and impact
    confidence = Column(Float, default=0.5)  # Confidence in the insight (0-1)
    expected_improvement = Column(Float)  # Expected improvement percentage
    implementation_difficulty = Column(String(20))  # 'easy', 'medium', 'hard'
    
    # Supporting data
    supporting_data = Column(JSON)  # Data supporting the insight
    supporting_experiments = Column(JSON)  # Other experiments supporting this insight
    
    # Status
    status = Column(String(20), default="new")  # 'new', 'reviewed', 'applied', 'dismissed'
    reviewed_by = Column(String(100))
    reviewed_at = Column(DateTime)
    review_notes = Column(Text)
    
    # Timestamps
    generated_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Indexes
    __table_args__ = (
        Index('idx_insight_exp_type', 'experiment_id', 'insight_type'),
        Index('idx_insight_confidence', 'confidence'),
        Index('idx_insight_status', 'status'),
    )


class ExperimentCollaboration(Base):
    """Experiment collaboration and sharing."""
    
    __tablename__ = 'experiment_collaboration'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    experiment_id = Column(String(100), ForeignKey('enhanced_experiments.experiment_id'), nullable=False)
    user_id = Column(String(100), nullable=False)
    
    # Permission and access
    permission = Column(SQLEnum(SharePermission), nullable=False)
    granted_by = Column(String(100), nullable=False)
    
    # Activity tracking
    last_accessed_at = Column(DateTime)
    access_count = Column(Integer, default=0)
    
    # Timestamps
    shared_at = Column(DateTime, default=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('idx_collab_exp_user', 'experiment_id', 'user_id', unique=True),
        Index('idx_collab_user', 'user_id'),
        Index('idx_collab_permission', 'permission'),
    )


class ExperimentComment(Base):
    """Experiment discussion comments."""
    
    __tablename__ = 'experiment_comments'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    comment_id = Column(String(100), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    experiment_id = Column(String(100), ForeignKey('enhanced_experiments.experiment_id'), nullable=False)
    
    # Comment details
    author = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    comment_type = Column(String(20), default="user")  # 'user', 'system', 'insight'
    
    # Threading
    parent_comment_id = Column(String(100), ForeignKey('experiment_comments.comment_id'))
    thread_depth = Column(Integer, default=0)
    
    # Status
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(String(100))
    resolved_at = Column(DateTime)
    
    # Metadata
    attachments = Column(JSON)  # File attachments or links
    mentions = Column(JSON)  # Mentioned users
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    parent_comment = relationship("ExperimentComment", remote_side=[comment_id])
    
    # Indexes
    __table_args__ = (
        Index('idx_comment_exp', 'experiment_id'),
        Index('idx_comment_author', 'author'),
        Index('idx_comment_thread', 'parent_comment_id'),
    )


class ExperimentTrendAnalysis(Base):
    """Experiment trend analysis results."""
    
    __tablename__ = 'experiment_trend_analysis'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(String(100), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    
    # Analysis scope
    experiment_ids = Column(JSON)  # List of experiment IDs analyzed
    metric_name = Column(String(100), nullable=False, index=True)
    time_period_days = Column(Integer, default=30)
    
    # Trend results
    trend_direction = Column(String(20))  # 'improving', 'declining', 'stable'
    trend_strength = Column(Float)  # 0-1, strength of trend
    volatility = Column(Float)  # Volatility measure
    seasonal_pattern = Column(Boolean, default=False)
    
    # Predictions
    predictions = Column(JSON)  # Future predictions
    confidence_interval = Column(JSON)  # Confidence intervals
    
    # Statistical data
    r_squared = Column(Float)  # R-squared value for trend
    p_value = Column(Float)  # Statistical significance
    
    # Metadata
    analysis_parameters = Column(JSON)  # Parameters used for analysis
    
    # Timestamps
    analyzed_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Indexes
    __table_args__ = (
        Index('idx_trend_metric_time', 'metric_name', 'analyzed_at'),
        Index('idx_trend_direction', 'trend_direction'),
    )


# Advanced Model Serving Infrastructure Tables

class ServingEndpoint(Base):
    """Model serving endpoint configuration and management."""
    
    __tablename__ = 'serving_endpoints'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    endpoint_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False, index=True)
    model_id = Column(String(100), ForeignKey('ml_models.model_id'), nullable=False)
    deployment_id = Column(String(100), ForeignKey('model_deployments.deployment_id'), nullable=False)
    
    # Endpoint configuration
    endpoint_url = Column(String(500), nullable=False)
    api_version = Column(String(20), default="v1")
    protocol = Column(String(10), default="http")  # 'http', 'grpc'
    port = Column(Integer, default=8000)
    
    # Infrastructure configuration
    compute_backend = Column(String(50), default="kubernetes")  # 'kubernetes', 'docker', 'serverless'
    instance_type = Column(String(50))  # 'cpu-optimized', 'gpu-enabled', 'memory-optimized'
    min_replicas = Column(Integer, default=1)
    max_replicas = Column(Integer, default=10)
    target_cpu_utilization = Column(Integer, default=70)
    target_memory_utilization = Column(Integer, default=80)
    
    # Performance configuration
    batch_size = Column(Integer, default=1)
    max_batch_delay_ms = Column(Integer, default=100)
    request_timeout_ms = Column(Integer, default=30000)
    concurrent_requests = Column(Integer, default=100)
    
    # Circuit breaker configuration
    circuit_breaker_enabled = Column(Boolean, default=True)
    failure_threshold = Column(Integer, default=5)
    recovery_timeout_ms = Column(Integer, default=60000)
    
    # Caching configuration
    cache_enabled = Column(Boolean, default=True)
    cache_ttl_seconds = Column(Integer, default=300)
    cache_size_mb = Column(Integer, default=512)
    
    # Security and access control
    authentication_required = Column(Boolean, default=True)
    api_key_required = Column(Boolean, default=True)
    rate_limit_rpm = Column(Integer, default=1000)  # Requests per minute
    allowed_origins = Column(JSON)  # CORS configuration
    
    # Status and health
    status = Column(String(20), default="pending", index=True)  # 'pending', 'active', 'inactive', 'failed'
    health_status = Column(String(20), default="unknown")  # 'healthy', 'unhealthy', 'degraded'
    last_health_check = Column(DateTime)
    
    # Performance metrics
    total_requests = Column(Integer, default=0)
    successful_requests = Column(Integer, default=0)
    failed_requests = Column(Integer, default=0)
    avg_response_time_ms = Column(Float, default=0.0)
    p95_response_time_ms = Column(Float, default=0.0)
    p99_response_time_ms = Column(Float, default=0.0)
    throughput_rps = Column(Float, default=0.0)
    
    # Cost tracking
    estimated_hourly_cost = Column(Float, default=0.0)
    total_compute_hours = Column(Float, default=0.0)
    
    # Metadata
    created_by = Column(String(100), nullable=False)
    configuration = Column(JSON)  # Additional endpoint-specific configuration
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    activated_at = Column(DateTime)
    deactivated_at = Column(DateTime)
    
    # Relationships
    model = relationship("MLModel", back_populates="serving_endpoints")
    deployment = relationship("ModelDeployment", back_populates="serving_endpoints")
    
    # Indexes
    __table_args__ = (
        Index('idx_endpoint_status', 'status'),
        Index('idx_endpoint_health', 'health_status'),
        Index('idx_endpoint_model', 'model_id'),
        Index('idx_endpoint_deployment', 'deployment_id'),
    )
    
    @property
    def is_active(self) -> bool:
        """Check if endpoint is active."""
        return self.status == "active"
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate."""
        if self.total_requests > 0:
            return self.successful_requests / self.total_requests * 100
        return 0.0


class ServingMetrics(Base):
    """Real-time serving metrics collection."""
    
    __tablename__ = 'serving_metrics'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    endpoint_id = Column(String(100), ForeignKey('serving_endpoints.endpoint_id'), nullable=False)
    model_id = Column(String(100), ForeignKey('ml_models.model_id'), nullable=False)
    
    # Timestamp (using 1-minute intervals for aggregation)
    timestamp = Column(DateTime, nullable=False, index=True)
    
    # Request metrics
    request_count = Column(Integer, default=0)
    successful_requests = Column(Integer, default=0)
    failed_requests = Column(Integer, default=0)
    timeout_requests = Column(Integer, default=0)
    
    # Latency metrics (in milliseconds)
    avg_response_time = Column(Float, default=0.0)
    min_response_time = Column(Float, default=0.0)
    max_response_time = Column(Float, default=0.0)
    p50_response_time = Column(Float, default=0.0)
    p95_response_time = Column(Float, default=0.0)
    p99_response_time = Column(Float, default=0.0)
    
    # Throughput metrics
    throughput_rps = Column(Float, default=0.0)
    concurrent_requests = Column(Integer, default=0)
    queue_size = Column(Integer, default=0)
    
    # Resource utilization
    cpu_usage_percent = Column(Float, default=0.0)
    memory_usage_percent = Column(Float, default=0.0)
    gpu_usage_percent = Column(Float, default=0.0)
    disk_usage_percent = Column(Float, default=0.0)
    
    # Infrastructure metrics
    active_replicas = Column(Integer, default=1)
    scaling_events = Column(Integer, default=0)
    container_restarts = Column(Integer, default=0)
    
    # Business metrics
    data_drift_score = Column(Float, default=0.0)
    model_accuracy = Column(Float, default=0.0)
    prediction_confidence = Column(Float, default=0.0)
    
    # Cache metrics
    cache_hit_rate = Column(Float, default=0.0)
    cache_size_mb = Column(Float, default=0.0)
    cache_evictions = Column(Integer, default=0)
    
    # Error details
    error_types = Column(JSON)  # Dictionary of error types to counts
    error_rate_percent = Column(Float, default=0.0)
    
    # Cost tracking
    compute_cost_usd = Column(Float, default=0.0)
    data_transfer_cost_usd = Column(Float, default=0.0)
    storage_cost_usd = Column(Float, default=0.0)
    
    # Relationships
    endpoint = relationship("ServingEndpoint", back_populates="metrics")
    
    # Indexes
    __table_args__ = (
        Index('idx_metrics_endpoint_time', 'endpoint_id', 'timestamp'),
        Index('idx_metrics_model_time', 'model_id', 'timestamp'),
        Index('idx_metrics_timestamp', 'timestamp'),
    )


class CanaryDeployment(Base):
    """Canary deployment configuration and tracking."""
    
    __tablename__ = 'canary_deployments'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    canary_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    
    # Model deployments
    baseline_deployment_id = Column(String(100), ForeignKey('model_deployments.deployment_id'), nullable=False)
    canary_deployment_id = Column(String(100), ForeignKey('model_deployments.deployment_id'), nullable=False)
    
    # Traffic routing configuration
    traffic_split_percent = Column(Float, default=5.0)  # Percentage to canary
    traffic_split_strategy = Column(String(50), default="random")  # 'random', 'user_based', 'geographic'
    routing_rules = Column(JSON)  # Additional routing rules
    
    # Success criteria
    success_criteria = Column(JSON)  # Dictionary of metrics and thresholds
    min_sample_size = Column(Integer, default=100)
    evaluation_period_minutes = Column(Integer, default=60)
    
    # Rollback configuration  
    auto_rollback_enabled = Column(Boolean, default=True)
    rollback_threshold_error_rate = Column(Float, default=5.0)  # Percentage
    rollback_threshold_latency_ms = Column(Float, default=2000.0)
    rollback_evaluation_window_minutes = Column(Integer, default=10)
    
    # Status and progress
    status = Column(String(20), default="pending", index=True)  # 'pending', 'active', 'successful', 'failed', 'rolled_back'
    current_traffic_percent = Column(Float, default=0.0)
    evaluation_results = Column(JSON)  # Results from statistical tests
    
    # Statistical analysis
    statistical_test = Column(String(50), default="chi_squared")  # 'chi_squared', 't_test', 'mann_whitney'
    significance_level = Column(Float, default=0.05)
    p_value = Column(Float)
    confidence_interval = Column(JSON)
    
    # Performance comparison
    baseline_metrics = Column(JSON)  # Baseline performance metrics
    canary_metrics = Column(JSON)    # Canary performance metrics
    improvement_percent = Column(Float)  # Performance improvement
    
    # Metadata
    created_by = Column(String(100), nullable=False)
    configuration = Column(JSON)  # Additional configuration
    rollback_reason = Column(Text)   # Reason for rollback if applicable
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    rolled_back_at = Column(DateTime)
    
    # Relationships
    baseline_deployment = relationship("ModelDeployment", foreign_keys=[baseline_deployment_id], back_populates="canary_baselines")
    canary_deployment = relationship("ModelDeployment", foreign_keys=[canary_deployment_id], back_populates="canary_deployments")
    
    # Indexes
    __table_args__ = (
        Index('idx_canary_status', 'status'),
        Index('idx_canary_baseline', 'baseline_deployment_id'),
        Index('idx_canary_deployment', 'canary_deployment_id'),
    )
    
    @property
    def is_active(self) -> bool:
        """Check if canary deployment is active."""
        return self.status == "active"
    
    @property 
    def duration_minutes(self) -> float:
        """Calculate canary deployment duration."""
        if self.started_at:
            end_time = self.completed_at or self.rolled_back_at or datetime.utcnow()
            return (end_time - self.started_at).total_seconds() / 60
        return 0.0


class BatchInferenceJob(Base):
    """Batch inference job tracking."""
    
    __tablename__ = 'batch_inference_jobs'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    model_id = Column(String(100), ForeignKey('ml_models.model_id'), nullable=False)
    
    # Input configuration
    input_source_type = Column(String(50), nullable=False)  # 'file', 's3', 'database', 'kafka'
    input_source_config = Column(JSON, nullable=False)      # Source-specific configuration
    input_format = Column(String(20), default="json")       # 'json', 'csv', 'parquet'
    
    # Output configuration
    output_destination_type = Column(String(50), nullable=False)  # 'file', 's3', 'database', 'kafka'
    output_destination_config = Column(JSON, nullable=False)      # Destination-specific configuration
    output_format = Column(String(20), default="json")           # 'json', 'csv', 'parquet'
    
    # Processing configuration
    batch_size = Column(Integer, default=1000)
    max_parallel_batches = Column(Integer, default=5)
    retry_count = Column(Integer, default=3)
    timeout_minutes = Column(Integer, default=60)
    
    # Callback configuration
    callback_url = Column(String(500))  # URL to call when job completes
    callback_headers = Column(JSON)     # Headers for callback request
    
    # Job status and progress
    status = Column(String(20), default="queued", index=True)  # 'queued', 'running', 'completed', 'failed', 'cancelled'
    progress_percent = Column(Float, default=0.0)
    total_records = Column(Integer, default=0)
    processed_records = Column(Integer, default=0)
    successful_predictions = Column(Integer, default=0)
    failed_predictions = Column(Integer, default=0)
    
    # Resource utilization
    compute_resources = Column(JSON)  # Requested compute resources
    actual_resource_usage = Column(JSON)  # Actual resource usage
    
    # Performance metrics
    avg_prediction_time_ms = Column(Float, default=0.0)
    total_processing_time_seconds = Column(Integer, default=0)
    throughput_records_per_second = Column(Float, default=0.0)
    
    # Error handling
    error_count = Column(Integer, default=0)
    error_details = Column(JSON)  # Error details and statistics
    error_threshold_percent = Column(Float, default=5.0)  # Fail job if error rate exceeds this
    
    # Cost tracking
    estimated_cost_usd = Column(Float, default=0.0)
    actual_cost_usd = Column(Float, default=0.0)
    
    # Metadata
    created_by = Column(String(100), nullable=False)
    job_parameters = Column(JSON)    # Additional job parameters
    labels = Column(JSON)            # Job labels for organization
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    failed_at = Column(DateTime)
    
    # Relationships
    model = relationship("MLModel", back_populates="batch_jobs")
    
    # Indexes
    __table_args__ = (
        Index('idx_batch_job_status', 'status'),
        Index('idx_batch_job_model', 'model_id'),
        Index('idx_batch_job_created', 'created_at'),
    )
    
    @property
    def is_running(self) -> bool:
        """Check if job is currently running."""
        return self.status == "running"
    
    @property
    def success_rate(self) -> float:
        """Calculate prediction success rate."""
        if self.processed_records > 0:
            return self.successful_predictions / self.processed_records * 100
        return 0.0


class ModelServingAlert(Base):
    """Model serving alerts and notifications."""
    
    __tablename__ = 'model_serving_alerts'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    
    # Alert target
    target_type = Column(String(50), nullable=False)  # 'endpoint', 'model', 'canary', 'batch_job'
    target_id = Column(String(100), nullable=False, index=True)
    
    # Alert configuration
    alert_type = Column(String(50), nullable=False, index=True)  # 'latency', 'error_rate', 'throughput', 'resource', 'accuracy'
    alert_name = Column(String(200), nullable=False)
    description = Column(Text)
    
    # Threshold configuration
    metric_name = Column(String(100), nullable=False)
    threshold_value = Column(Float, nullable=False)
    threshold_operator = Column(String(10), nullable=False)  # '>', '<', '>=', '<=', '=='
    evaluation_window_minutes = Column(Integer, default=5)
    
    # Alert severity and priority
    severity = Column(String(20), default="medium")  # 'low', 'medium', 'high', 'critical'
    priority = Column(Integer, default=3)  # 1 (highest) to 5 (lowest)
    
    # Notification configuration
    notification_channels = Column(JSON)  # List of notification channels (email, slack, webhook)
    notification_frequency_minutes = Column(Integer, default=15)
    suppress_duration_minutes = Column(Integer, default=60)  # Suppress repeated alerts
    
    # Alert status
    is_active = Column(Boolean, default=True, index=True)
    last_triggered_at = Column(DateTime)
    trigger_count = Column(Integer, default=0)
    
    # Conditions and rules
    additional_conditions = Column(JSON)  # Additional alert conditions
    alert_rules = Column(JSON)          # Complex alert rule definitions
    
    # Metadata
    created_by = Column(String(100), nullable=False)
    tags = Column(JSON)  # Alert tags for organization
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('idx_alert_target', 'target_type', 'target_id'),
        Index('idx_alert_type', 'alert_type'),
        Index('idx_alert_active', 'is_active'),
        Index('idx_alert_severity', 'severity'),
    )
    
    @property
    def is_overdue(self) -> bool:
        """Check if alert should be suppressed."""
        if self.last_triggered_at and self.suppress_duration_minutes:
            elapsed = (datetime.utcnow() - self.last_triggered_at).total_seconds() / 60
            return elapsed < self.suppress_duration_minutes
        return False


# Update existing model relationships
MLModel.serving_endpoints = relationship("ServingEndpoint", back_populates="model")
MLModel.batch_jobs = relationship("BatchInferenceJob", back_populates="model")

ModelDeployment.serving_endpoints = relationship("ServingEndpoint", back_populates="deployment")
ModelDeployment.canary_baselines = relationship("CanaryDeployment", foreign_keys=[CanaryDeployment.baseline_deployment_id], back_populates="baseline_deployment")
ModelDeployment.canary_deployments = relationship("CanaryDeployment", foreign_keys=[CanaryDeployment.canary_deployment_id], back_populates="canary_deployment")

ServingEndpoint.metrics = relationship("ServingMetrics", back_populates="endpoint")