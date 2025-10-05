"""
Automated Retraining Database Models
==================================

Database models for automated retraining pipelines including:
- Retraining pipeline configurations and schedules
- Data drift detection and monitoring
- Performance monitoring and triggers
- Continuous learning configurations
- Pipeline execution tracking
- Quality assurance and validation
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
class RetrainingTriggerType(str, Enum):
    """Types of retraining triggers."""
    SCHEDULED = "scheduled"
    PERFORMANCE_DEGRADATION = "performance_degradation"
    DATA_DRIFT = "data_drift"
    LABEL_DRIFT = "label_drift"
    MANUAL = "manual"
    FEEDBACK_THRESHOLD = "feedback_threshold"
    TIME_BASED = "time_based"
    DATA_VOLUME = "data_volume"


class RetrainingPipelineStatus(str, Enum):
    """Retraining pipeline execution status."""
    PENDING = "pending"
    PREPARING = "preparing"
    DATA_VALIDATION = "data_validation"
    FEATURE_ENGINEERING = "feature_engineering"
    TRAINING = "training"
    VALIDATION = "validation"
    DEPLOYMENT = "deployment"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    ROLLBACK = "rollback"


class DriftDetectionMethod(str, Enum):
    """Data drift detection methods."""
    STATISTICAL = "statistical"
    KS_TEST = "ks_test"
    CHI_SQUARE = "chi_square"
    PSI = "psi"  # Population Stability Index
    KL_DIVERGENCE = "kl_divergence"
    WASSERSTEIN = "wasserstein"
    MMD = "mmd"  # Maximum Mean Discrepancy
    DOMAIN_CLASSIFIER = "domain_classifier"


class LearningMode(str, Enum):
    """Continuous learning modes."""
    BATCH = "batch"
    INCREMENTAL = "incremental"
    ONLINE = "online"
    ACTIVE = "active"
    SEMI_SUPERVISED = "semi_supervised"
    REINFORCEMENT = "reinforcement"


class QualityGate(str, Enum):
    """Quality gate stages."""
    DATA_QUALITY = "data_quality"
    MODEL_PERFORMANCE = "model_performance"
    DRIFT_VALIDATION = "drift_validation"
    BUSINESS_METRICS = "business_metrics"
    INFRASTRUCTURE = "infrastructure"
    COMPLIANCE = "compliance"


class AlertSeverity(str, Enum):
    """Alert severity levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# Database Models
class RetrainingPipeline(Base):
    """Automated retraining pipeline configuration."""
    
    __tablename__ = 'retraining_pipelines'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    pipeline_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text)
    
    # Model association
    model_id = Column(String(100), ForeignKey('ml_models.model_id'), nullable=False)
    model_version = Column(String(50))
    
    # Pipeline configuration
    pipeline_type = Column(String(50), default="full_retrain")  # 'full_retrain', 'incremental', 'transfer_learning'
    learning_mode = Column(SQLEnum(LearningMode), default=LearningMode.BATCH)
    
    # Trigger configuration
    trigger_types = Column(JSON)  # List of trigger types
    schedule_config = Column(JSON)  # Cron-like scheduling configuration
    performance_thresholds = Column(JSON)  # Performance degradation thresholds
    drift_thresholds = Column(JSON)  # Data drift detection thresholds
    
    # Data configuration
    training_data_config = Column(JSON)  # Training data source configuration
    validation_data_config = Column(JSON)  # Validation data configuration
    data_retention_days = Column(Integer, default=90)
    min_training_samples = Column(Integer, default=1000)
    max_training_samples = Column(Integer)
    
    # Feature engineering configuration
    feature_engineering_config = Column(JSON)  # Feature engineering pipeline
    preprocessing_config = Column(JSON)  # Data preprocessing configuration
    feature_selection_config = Column(JSON)  # Feature selection strategy
    
    # Training configuration
    training_config = Column(JSON)  # Model training parameters
    hyperparameter_tuning_config = Column(JSON)  # HPO configuration
    cross_validation_config = Column(JSON)  # Cross-validation settings
    early_stopping_config = Column(JSON)  # Early stopping configuration
    
    # Quality gates
    quality_gates = Column(JSON)  # Quality gate configurations
    approval_required = Column(Boolean, default=True)
    auto_deploy = Column(Boolean, default=False)
    rollback_strategy = Column(JSON)  # Rollback configuration
    
    # Resource configuration
    compute_resources = Column(JSON)  # Required compute resources
    max_training_time_hours = Column(Float, default=4.0)
    parallel_jobs = Column(Integer, default=1)
    
    # Notification configuration
    notification_config = Column(JSON)  # Notification settings
    alert_channels = Column(JSON)  # Alert channels (email, slack, etc.)
    
    # Status and metadata
    is_active = Column(Boolean, default=True, index=True)
    last_triggered_at = Column(DateTime)
    next_scheduled_run = Column(DateTime)
    execution_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)
    
    # Metadata
    created_by = Column(String(100), nullable=False)
    tags = Column(JSON)  # Pipeline tags
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    executions = relationship("RetrainingExecution", back_populates="pipeline", cascade="all, delete-orphan")
    drift_monitors = relationship("DriftMonitor", back_populates="pipeline", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index('idx_pipeline_model', 'model_id'),
        Index('idx_pipeline_active', 'is_active'),
        Index('idx_pipeline_next_run', 'next_scheduled_run'),
        Index('idx_pipeline_created_by', 'created_by'),
    )
    
    @property
    def success_rate(self) -> float:
        """Calculate pipeline success rate."""
        if self.execution_count > 0:
            return self.success_count / self.execution_count * 100
        return 0.0
    
    @property
    def is_due(self) -> bool:
        """Check if pipeline is due for execution."""
        if self.next_scheduled_run:
            return datetime.utcnow() >= self.next_scheduled_run
        return False


class RetrainingExecution(Base):
    """Retraining pipeline execution tracking."""
    
    __tablename__ = 'retraining_executions'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    execution_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    pipeline_id = Column(String(100), ForeignKey('retraining_pipelines.pipeline_id'), nullable=False)
    
    # Execution metadata
    execution_type = Column(String(50), default="scheduled")  # 'scheduled', 'triggered', 'manual'
    trigger_reason = Column(String(100))  # Reason for execution
    trigger_data = Column(JSON)  # Additional trigger information
    
    # Status and progress
    status = Column(SQLEnum(RetrainingPipelineStatus), default=RetrainingPipelineStatus.PENDING, index=True)
    progress_percent = Column(Float, default=0.0)
    current_stage = Column(String(100))
    
    # Data information
    training_data_info = Column(JSON)  # Information about training data used
    validation_data_info = Column(JSON)  # Information about validation data
    data_quality_metrics = Column(JSON)  # Data quality assessment
    
    # Training information
    training_start_time = Column(DateTime)
    training_end_time = Column(DateTime)
    training_metrics = Column(JSON)  # Training performance metrics
    validation_metrics = Column(JSON)  # Validation performance metrics
    
    # Model information
    baseline_model_id = Column(String(100))  # Previous model version
    new_model_id = Column(String(100))  # Newly trained model
    model_comparison = Column(JSON)  # Comparison between old and new models
    
    # Quality gate results
    quality_gate_results = Column(JSON)  # Results from quality gates
    quality_passed = Column(Boolean)
    quality_failures = Column(JSON)  # Failed quality checks
    
    # Resource usage
    compute_resources_used = Column(JSON)  # Actual resource consumption
    training_time_minutes = Column(Float)
    peak_memory_usage_gb = Column(Float)
    cost_usd = Column(Float)
    
    # Deployment information
    deployment_attempted = Column(Boolean, default=False)
    deployment_successful = Column(Boolean)
    deployment_id = Column(String(100))
    rollback_executed = Column(Boolean, default=False)
    
    # Error handling
    error_message = Column(Text)
    error_details = Column(JSON)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    
    # Performance analysis
    performance_improvement = Column(Float)  # Percentage improvement
    drift_scores = Column(JSON)  # Drift detection scores
    feature_importance_changes = Column(JSON)  # Changes in feature importance
    
    # Metadata
    configuration_snapshot = Column(JSON)  # Pipeline configuration at execution time
    environment_info = Column(JSON)  # Environment and infrastructure info
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    failed_at = Column(DateTime)
    
    # Relationships
    pipeline = relationship("RetrainingPipeline", back_populates="executions")
    
    # Indexes
    __table_args__ = (
        Index('idx_execution_pipeline_status', 'pipeline_id', 'status'),
        Index('idx_execution_created', 'created_at'),
        Index('idx_execution_trigger', 'trigger_reason'),
        Index('idx_execution_quality', 'quality_passed'),
    )
    
    @property
    def duration_minutes(self) -> Optional[float]:
        """Calculate execution duration in minutes."""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds() / 60
        return None
    
    @property
    def is_running(self) -> bool:
        """Check if execution is currently running."""
        return self.status in [
            RetrainingPipelineStatus.PREPARING,
            RetrainingPipelineStatus.DATA_VALIDATION,
            RetrainingPipelineStatus.FEATURE_ENGINEERING,
            RetrainingPipelineStatus.TRAINING,
            RetrainingPipelineStatus.VALIDATION,
            RetrainingPipelineStatus.DEPLOYMENT
        ]


class DriftMonitor(Base):
    """Data drift monitoring configuration and tracking."""
    
    __tablename__ = 'drift_monitors'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    monitor_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    pipeline_id = Column(String(100), ForeignKey('retraining_pipelines.pipeline_id'), nullable=False)
    name = Column(String(200), nullable=False)
    
    # Monitoring configuration
    monitor_type = Column(String(50), default="feature_drift")  # 'feature_drift', 'label_drift', 'concept_drift'
    detection_method = Column(SQLEnum(DriftDetectionMethod), default=DriftDetectionMethod.STATISTICAL)
    
    # Data configuration
    reference_data_config = Column(JSON)  # Reference dataset configuration
    monitoring_data_config = Column(JSON)  # Live data monitoring configuration
    feature_columns = Column(JSON)  # Columns to monitor for drift
    target_columns = Column(JSON)  # Target columns (for label drift)
    
    # Detection thresholds
    drift_threshold = Column(Float, default=0.05)  # Statistical significance threshold
    warning_threshold = Column(Float, default=0.03)  # Warning threshold
    stability_window_days = Column(Integer, default=7)  # Days to consider for stability
    
    # Monitoring schedule
    monitoring_frequency = Column(String(50), default="daily")  # 'hourly', 'daily', 'weekly'
    monitoring_schedule = Column(JSON)  # Cron-like schedule configuration
    
    # Statistical configuration
    statistical_test_config = Column(JSON)  # Statistical test parameters
    confidence_level = Column(Float, default=0.95)
    sample_size = Column(Integer, default=1000)
    
    # Alert configuration
    alert_enabled = Column(Boolean, default=True)
    alert_threshold = Column(Float, default=0.05)
    alert_channels = Column(JSON)  # Alert notification channels
    alert_frequency_hours = Column(Integer, default=1)  # Minimum hours between alerts
    
    # Status and results
    is_active = Column(Boolean, default=True, index=True)
    last_checked_at = Column(DateTime)
    next_check_at = Column(DateTime)
    last_drift_detected_at = Column(DateTime)
    current_drift_score = Column(Float)
    drift_trend = Column(String(20))  # 'stable', 'increasing', 'decreasing'
    
    # Historical tracking
    check_count = Column(Integer, default=0)
    drift_detection_count = Column(Integer, default=0)
    false_positive_count = Column(Integer, default=0)
    
    # Metadata
    created_by = Column(String(100), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    pipeline = relationship("RetrainingPipeline", back_populates="drift_monitors")
    drift_reports = relationship("DriftReport", back_populates="monitor", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index('idx_monitor_pipeline', 'pipeline_id'),
        Index('idx_monitor_active', 'is_active'),
        Index('idx_monitor_next_check', 'next_check_at'),
        Index('idx_monitor_type', 'monitor_type'),
    )
    
    @property
    def drift_detection_rate(self) -> float:
        """Calculate drift detection rate."""
        if self.check_count > 0:
            return self.drift_detection_count / self.check_count * 100
        return 0.0


class DriftReport(Base):
    """Data drift detection reports."""
    
    __tablename__ = 'drift_reports'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    monitor_id = Column(String(100), ForeignKey('drift_monitors.monitor_id'), nullable=False)
    
    # Report metadata
    report_type = Column(String(50), default="feature_drift")
    detection_method = Column(String(50))
    data_period_start = Column(DateTime, nullable=False)
    data_period_end = Column(DateTime, nullable=False)
    
    # Drift analysis results
    overall_drift_score = Column(Float, nullable=False)
    drift_detected = Column(Boolean, default=False, index=True)
    drift_severity = Column(String(20))  # 'low', 'medium', 'high', 'critical'
    
    # Feature-level drift analysis
    feature_drift_scores = Column(JSON)  # Drift scores per feature
    drifted_features = Column(JSON)  # List of features with significant drift
    feature_statistics = Column(JSON)  # Statistical summaries per feature
    
    # Statistical test results
    statistical_test_results = Column(JSON)  # P-values, test statistics
    confidence_intervals = Column(JSON)  # Confidence intervals for estimates
    effect_sizes = Column(JSON)  # Effect sizes for detected changes
    
    # Data quality metrics
    data_quality_issues = Column(JSON)  # Data quality problems detected
    missing_values_pct = Column(Float)
    outlier_pct = Column(Float)
    data_freshness_hours = Column(Float)
    
    # Distribution analysis
    distribution_changes = Column(JSON)  # Changes in data distributions
    distribution_plots = Column(JSON)  # Plot data for visualizations
    histogram_comparisons = Column(JSON)  # Histogram comparison data
    
    # Model impact analysis
    predicted_performance_impact = Column(Float)  # Predicted impact on model performance
    feature_importance_changes = Column(JSON)  # Changes in feature importance
    correlation_changes = Column(JSON)  # Changes in feature correlations
    
    # Alert information
    alert_triggered = Column(Boolean, default=False)
    alert_level = Column(SQLEnum(AlertSeverity))
    alert_message = Column(Text)
    alert_sent_at = Column(DateTime)
    
    # Recommendations
    recommended_actions = Column(JSON)  # Recommended actions based on analysis
    retraining_recommended = Column(Boolean, default=False)
    urgency_level = Column(String(20))  # 'low', 'medium', 'high', 'critical'
    
    # Metadata
    sample_size = Column(Integer)
    analysis_duration_seconds = Column(Float)
    analysis_config = Column(JSON)  # Configuration used for analysis
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    monitor = relationship("DriftMonitor", back_populates="drift_reports")
    
    # Indexes
    __table_args__ = (
        Index('idx_report_monitor_date', 'monitor_id', 'created_at'),
        Index('idx_report_drift_detected', 'drift_detected'),
        Index('idx_report_severity', 'drift_severity'),
        Index('idx_report_period', 'data_period_start', 'data_period_end'),
    )


class PerformanceMonitor(Base):
    """Model performance monitoring and degradation detection."""
    
    __tablename__ = 'performance_monitors'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    monitor_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    model_id = Column(String(100), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    
    # Monitoring configuration
    metrics_to_monitor = Column(JSON)  # List of metrics to track
    baseline_metrics = Column(JSON)  # Baseline performance metrics
    degradation_thresholds = Column(JSON)  # Thresholds for performance degradation
    
    # Monitoring schedule
    monitoring_frequency = Column(String(50), default="hourly")
    monitoring_window_hours = Column(Integer, default=24)
    minimum_sample_size = Column(Integer, default=100)
    
    # Statistical configuration
    statistical_significance = Column(Float, default=0.05)
    confidence_level = Column(Float, default=0.95)
    trend_analysis_days = Column(Integer, default=7)
    
    # Alert configuration
    alert_enabled = Column(Boolean, default=True)
    alert_thresholds = Column(JSON)  # Alert threshold configuration
    alert_channels = Column(JSON)  # Notification channels
    
    # Status
    is_active = Column(Boolean, default=True, index=True)
    last_checked_at = Column(DateTime)
    current_performance_score = Column(Float)
    performance_trend = Column(String(20))  # 'improving', 'stable', 'degrading'
    
    # Degradation tracking
    degradation_detected = Column(Boolean, default=False, index=True)
    last_degradation_detected_at = Column(DateTime)
    degradation_severity = Column(String(20))
    consecutive_degradations = Column(Integer, default=0)
    
    # Metadata
    created_by = Column(String(100), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('idx_perf_monitor_model', 'model_id'),
        Index('idx_perf_monitor_active', 'is_active'),
        Index('idx_perf_monitor_degradation', 'degradation_detected'),
    )


class ContinuousLearningConfig(Base):
    """Continuous learning configuration and state."""
    
    __tablename__ = 'continuous_learning_configs'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    config_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    model_id = Column(String(100), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    
    # Learning configuration
    learning_mode = Column(SQLEnum(LearningMode), default=LearningMode.INCREMENTAL)
    learning_rate_schedule = Column(JSON)  # Learning rate scheduling
    batch_size = Column(Integer, default=32)
    update_frequency = Column(String(50), default="daily")  # 'hourly', 'daily', 'weekly'
    
    # Data configuration
    data_stream_config = Column(JSON)  # Streaming data configuration
    buffer_size = Column(Integer, default=10000)  # Size of data buffer
    data_validation_rules = Column(JSON)  # Data validation configuration
    
    # Incremental learning configuration
    memory_buffer_size = Column(Integer, default=1000)  # Memory replay buffer size
    forgetting_strategy = Column(String(50), default="fifo")  # 'fifo', 'importance', 'uncertainty'
    adaptation_rate = Column(Float, default=0.01)  # Rate of adaptation to new data
    
    # Active learning configuration
    uncertainty_sampling_method = Column(String(50))  # 'entropy', 'margin', 'variation_ratio'
    query_strategy = Column(String(50))  # 'uncertainty', 'diversity', 'hybrid'
    labeling_budget = Column(Integer)  # Budget for active labeling
    annotation_source = Column(String(100))  # Source for obtaining labels
    
    # Online learning configuration
    online_learning_algorithm = Column(String(50))  # 'sgd', 'adam', 'adagrad'
    regularization_config = Column(JSON)  # Regularization parameters
    drift_adaptation_strategy = Column(String(50))  # Strategy for adapting to drift
    
    # Quality control
    performance_monitoring = Column(JSON)  # Performance monitoring configuration
    rollback_triggers = Column(JSON)  # Conditions for rolling back updates
    validation_strategy = Column(String(50))  # 'holdout', 'sliding_window', 'prequential'
    
    # Feedback integration
    feedback_sources = Column(JSON)  # Sources of feedback (user ratings, business metrics)
    feedback_weight = Column(Float, default=1.0)  # Weight of feedback in learning
    feedback_lag_tolerance_hours = Column(Integer, default=24)  # Max delay for feedback
    
    # Status and state
    is_active = Column(Boolean, default=True, index=True)
    current_model_version = Column(String(50))
    last_update_at = Column(DateTime)
    next_update_at = Column(DateTime)
    
    # Learning statistics
    total_updates = Column(Integer, default=0)
    successful_updates = Column(Integer, default=0)
    failed_updates = Column(Integer, default=0)
    average_learning_time_seconds = Column(Float)
    
    # Data statistics
    total_samples_processed = Column(Integer, default=0)
    samples_in_buffer = Column(Integer, default=0)
    labeled_samples_count = Column(Integer, default=0)
    annotation_requests_pending = Column(Integer, default=0)
    
    # Performance tracking
    performance_history = Column(JSON)  # Historical performance metrics
    improvement_rate = Column(Float)  # Rate of performance improvement
    stability_score = Column(Float)  # Model stability score
    
    # Metadata
    created_by = Column(String(100), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('idx_cl_config_model', 'model_id'),
        Index('idx_cl_config_active', 'is_active'),
        Index('idx_cl_config_next_update', 'next_update_at'),
        Index('idx_cl_config_mode', 'learning_mode'),
    )
    
    @property
    def update_success_rate(self) -> float:
        """Calculate update success rate."""
        if self.total_updates > 0:
            return self.successful_updates / self.total_updates * 100
        return 0.0


class FeedbackLog(Base):
    """Feedback data for continuous learning."""
    
    __tablename__ = 'feedback_logs'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    feedback_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    model_id = Column(String(100), nullable=False, index=True)
    config_id = Column(String(100), ForeignKey('continuous_learning_configs.config_id'))
    
    # Feedback data
    prediction_id = Column(String(100))  # ID of the prediction being feedback on
    feedback_type = Column(String(50), nullable=False)  # 'explicit', 'implicit', 'business_metric'
    feedback_value = Column(JSON)  # The actual feedback value
    feedback_score = Column(Float)  # Normalized feedback score (0-1)
    
    # Context information
    user_id = Column(String(100))
    session_id = Column(String(100))
    request_context = Column(JSON)  # Context of the original request
    
    # Feedback metadata
    source = Column(String(100))  # Source of feedback (user, system, business)
    confidence = Column(Float)  # Confidence in the feedback
    feedback_delay_hours = Column(Float)  # Delay between prediction and feedback
    
    # Processing status
    processed = Column(Boolean, default=False, index=True)
    processed_at = Column(DateTime)
    used_for_training = Column(Boolean, default=False)
    weight_in_training = Column(Float)
    
    # Validation
    feedback_quality_score = Column(Float)  # Quality assessment of feedback
    is_outlier = Column(Boolean, default=False)
    validation_notes = Column(Text)
    
    # Timestamps
    prediction_timestamp = Column(DateTime)  # When the original prediction was made
    received_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Indexes
    __table_args__ = (
        Index('idx_feedback_model_received', 'model_id', 'received_at'),
        Index('idx_feedback_processed', 'processed'),
        Index('idx_feedback_type', 'feedback_type'),
        Index('idx_feedback_prediction', 'prediction_id'),
    )


class RetrainingAlert(Base):
    """Alerts and notifications for retraining events."""
    
    __tablename__ = 'retraining_alerts'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    
    # Alert context
    alert_type = Column(String(50), nullable=False, index=True)  # 'drift_detected', 'performance_degradation', 'execution_failed'
    alert_source = Column(String(100), nullable=False)  # 'drift_monitor', 'performance_monitor', 'pipeline_execution'
    source_id = Column(String(100), nullable=False)  # ID of the source that triggered the alert
    
    # Model and pipeline context
    model_id = Column(String(100))
    pipeline_id = Column(String(100))
    execution_id = Column(String(100))
    
    # Alert details
    severity = Column(SQLEnum(AlertSeverity), default=AlertSeverity.MEDIUM, index=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    alert_data = Column(JSON)  # Additional alert-specific data
    
    # Recommended actions
    recommended_actions = Column(JSON)  # List of recommended actions
    auto_action_taken = Column(String(100))  # Automatic action taken (if any)
    manual_action_required = Column(Boolean, default=False)
    
    # Status tracking
    status = Column(String(20), default="active", index=True)  # 'active', 'acknowledged', 'resolved', 'suppressed'
    acknowledged_by = Column(String(100))
    acknowledged_at = Column(DateTime)
    resolved_by = Column(String(100))
    resolved_at = Column(DateTime)
    resolution_notes = Column(Text)
    
    # Notification tracking
    notification_sent = Column(Boolean, default=False)
    notification_channels = Column(JSON)  # Channels where notification was sent
    notification_failures = Column(JSON)  # Failed notification attempts
    
    # Escalation
    escalation_level = Column(Integer, default=0)  # Escalation level (0 = not escalated)
    escalated_at = Column(DateTime)
    escalation_reason = Column(Text)
    
    # Suppression
    suppressed_until = Column(DateTime)  # Suppress similar alerts until this time
    suppression_reason = Column(Text)
    
    # Timestamps
    triggered_at = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('idx_alert_type_severity', 'alert_type', 'severity'),
        Index('idx_alert_status', 'status'),
        Index('idx_alert_source', 'alert_source', 'source_id'),
        Index('idx_alert_model', 'model_id'),
        Index('idx_alert_pipeline', 'pipeline_id'),
    )


class QualityGateResult(Base):
    """Quality gate validation results."""
    
    __tablename__ = 'quality_gate_results'
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    result_id = Column(String(100), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    execution_id = Column(String(100), ForeignKey('retraining_executions.execution_id'), nullable=False)
    
    # Quality gate information
    gate_name = Column(String(100), nullable=False, index=True)
    gate_type = Column(SQLEnum(QualityGate), nullable=False)
    gate_config = Column(JSON)  # Configuration for this quality gate
    
    # Validation results
    passed = Column(Boolean, nullable=False, index=True)
    score = Column(Float)  # Quality score (0-1)
    threshold = Column(Float)  # Threshold that was applied
    
    # Detailed results
    validation_results = Column(JSON)  # Detailed validation results
    metrics_evaluated = Column(JSON)  # Metrics that were evaluated
    checks_performed = Column(JSON)  # Individual checks and their results
    
    # Failure information
    failure_reason = Column(Text)  # Reason for failure (if failed)
    failure_details = Column(JSON)  # Detailed failure information
    recommendations = Column(JSON)  # Recommendations for addressing failures
    
    # Execution information
    validation_start_time = Column(DateTime)
    validation_end_time = Column(DateTime)
    validation_duration_seconds = Column(Float)
    
    # Metadata
    validator_version = Column(String(50))  # Version of the validator used
    environment_info = Column(JSON)  # Environment information
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('idx_qg_result_execution', 'execution_id'),
        Index('idx_qg_result_gate', 'gate_name', 'gate_type'),
        Index('idx_qg_result_passed', 'passed'),
    )
    
    @property
    def duration_seconds(self) -> Optional[float]:
        """Calculate validation duration in seconds."""
        if self.validation_start_time and self.validation_end_time:
            return (self.validation_end_time - self.validation_start_time).total_seconds()
        return None