"""
Automated Retraining API Schemas
================================

Pydantic schemas for automated retraining pipeline API validation and serialization.
Comprehensive schemas for pipeline configuration, execution tracking, drift detection,
and quality assurance in automated ML model retraining systems.

Features:
- Pipeline configuration and policy management schemas
- Execution tracking and status monitoring schemas
- Drift detection and monitoring configuration schemas
- Quality gate validation and result schemas
- Alert and notification management schemas
- Performance tracking and analytics schemas
"""

from pydantic import BaseModel, Field, validator, root_validator
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta
from enum import Enum
import re


# Enums matching database models
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
    PSI = "psi"
    KL_DIVERGENCE = "kl_divergence"
    WASSERSTEIN = "wasserstein"
    MMD = "mmd"
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


class DeploymentStrategy(str, Enum):
    """Deployment strategies."""
    CANARY = "canary"
    BLUE_GREEN = "blue_green"
    ROLLING = "rolling"
    IMMEDIATE = "immediate"


# Base schemas
class BaseSchema(BaseModel):
    """Base schema with common configuration."""
    
    class Config:
        use_enum_values = True
        validate_assignment = True
        arbitrary_types_allowed = True


# Pipeline Configuration Schemas
class TriggerConfig(BaseSchema):
    """Configuration for a specific trigger."""
    trigger_type: RetrainingTriggerType
    enabled: bool = True
    threshold: float = Field(0.05, ge=0.0, le=1.0)
    window_hours: int = Field(24, ge=1, le=8760)  # Max 1 year
    min_samples: int = Field(100, ge=10)
    custom_params: Dict[str, Any] = Field(default_factory=dict)


class DataDriftConfig(BaseSchema):
    """Data drift detection configuration."""
    enabled: bool = True
    detection_method: DriftDetectionMethod = DriftDetectionMethod.STATISTICAL
    threshold: float = Field(0.1, ge=0.0, le=1.0)
    window_size: int = Field(1000, ge=50)
    reference_period_days: int = Field(30, ge=1, le=365)
    categorical_threshold: float = Field(0.05, ge=0.0, le=1.0)
    numerical_threshold: float = Field(0.1, ge=0.0, le=1.0)
    min_samples: int = Field(50, ge=10)
    feature_columns: Optional[List[str]] = None


class HyperparameterOptimizationConfig(BaseSchema):
    """Hyperparameter optimization configuration."""
    enabled: bool = True
    method: str = Field("random_search", regex="^(grid_search|random_search|bayesian)$")
    n_trials: int = Field(50, ge=5, le=1000)
    cv_folds: int = Field(5, ge=2, le=10)
    scoring_metric: str = Field("accuracy", regex="^(accuracy|precision|recall|f1|roc_auc|mse|mae|r2)$")
    timeout_minutes: int = Field(60, ge=5, le=720)  # Max 12 hours
    parallel_jobs: int = Field(-1, ge=-1)


class ValidationConfig(BaseSchema):
    """Model validation configuration."""
    validation_split: float = Field(0.2, ge=0.1, le=0.5)
    performance_thresholds: Dict[str, float] = Field(default_factory=lambda: {
        "accuracy": 0.8,
        "precision": 0.75,
        "recall": 0.75
    })
    improvement_threshold: float = Field(0.01, ge=0.0)
    statistical_significance: float = Field(0.05, ge=0.01, le=0.2)
    holdout_period_hours: int = Field(24, ge=1, le=168)


class DeploymentConfig(BaseSchema):
    """Deployment configuration."""
    strategy: DeploymentStrategy = DeploymentStrategy.CANARY
    canary_percentage: float = Field(0.1, ge=0.01, le=1.0)
    canary_duration_hours: float = Field(2.0, ge=0.1, le=48.0)
    rollback_threshold: float = Field(0.95, ge=0.5, le=1.0)
    health_check_interval: int = Field(30, ge=10, le=300)
    max_deployment_time: int = Field(3600, ge=300, le=7200)  # Max 2 hours
    blue_green_switch_delay: int = Field(300, ge=60, le=1800)


class QualityGateConfig(BaseSchema):
    """Quality gate configuration."""
    gate_type: QualityGate
    enabled: bool = True
    threshold: float = Field(0.8, ge=0.0, le=1.0)
    weight: float = Field(1.0, ge=0.0, le=10.0)
    failure_action: str = Field("stop", regex="^(stop|warn|continue)$")
    custom_rules: Dict[str, Any] = Field(default_factory=dict)


class NotificationConfig(BaseSchema):
    """Notification configuration."""
    alert_channels: List[str] = Field(default_factory=lambda: ["email", "webhook"])
    alert_on_trigger: bool = True
    alert_on_failure: bool = True
    alert_on_success: bool = False
    alert_on_drift: bool = True
    alert_thresholds: Dict[AlertSeverity, float] = Field(default_factory=lambda: {
        AlertSeverity.LOW: 0.05,
        AlertSeverity.MEDIUM: 0.1,
        AlertSeverity.HIGH: 0.15,
        AlertSeverity.CRITICAL: 0.2
    })
    webhook_url: Optional[str] = None
    email_recipients: Optional[List[str]] = None
    slack_channel: Optional[str] = None


# Request Schemas
class CreateRetrainingPipelineRequest(BaseSchema):
    """Request to create a new retraining pipeline."""
    model_id: str = Field(..., min_length=1, max_length=100)
    pipeline_name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    
    # Trigger configuration
    triggers: List[TriggerConfig] = Field(..., min_items=1)
    
    # Data configuration
    data_drift_config: DataDriftConfig = Field(default_factory=DataDriftConfig)
    min_training_samples: int = Field(1000, ge=100, le=1000000)
    max_training_samples: int = Field(100000, ge=1000, le=10000000)
    data_retention_days: int = Field(90, ge=7, le=365)
    data_quality_threshold: float = Field(0.8, ge=0.5, le=1.0)
    
    # Training configuration
    learning_mode: LearningMode = LearningMode.BATCH
    hyperparameter_optimization: HyperparameterOptimizationConfig = Field(
        default_factory=HyperparameterOptimizationConfig
    )
    validation_config: ValidationConfig = Field(default_factory=ValidationConfig)
    max_training_time_hours: float = Field(4.0, ge=0.5, le=48.0)
    
    # Quality gates
    quality_gates: List[QualityGateConfig] = Field(default_factory=lambda: [
        QualityGateConfig(gate_type=QualityGate.DATA_QUALITY),
        QualityGateConfig(gate_type=QualityGate.MODEL_PERFORMANCE),
    ])
    
    # Deployment configuration
    auto_deploy: bool = True
    deployment_config: DeploymentConfig = Field(default_factory=DeploymentConfig)
    enable_rollback: bool = True
    
    # Notification configuration
    notification_config: NotificationConfig = Field(default_factory=NotificationConfig)
    
    # Metadata
    tags: Optional[Dict[str, str]] = Field(default_factory=dict)
    
    @validator('max_training_samples')
    def validate_max_samples(cls, v, values):
        min_samples = values.get('min_training_samples', 1000)
        if v < min_samples:
            raise ValueError('max_training_samples must be >= min_training_samples')
        return v


class TriggerRetrainingRequest(BaseSchema):
    """Request to manually trigger retraining."""
    trigger_type: RetrainingTriggerType = RetrainingTriggerType.MANUAL
    reason: Optional[str] = Field(None, max_length=500)
    force: bool = False
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class UpdatePipelineRequest(BaseSchema):
    """Request to update pipeline configuration."""
    pipeline_name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    is_active: Optional[bool] = None
    
    # Partial updates allowed for all configuration sections
    triggers: Optional[List[TriggerConfig]] = None
    data_drift_config: Optional[DataDriftConfig] = None
    hyperparameter_optimization: Optional[HyperparameterOptimizationConfig] = None
    validation_config: Optional[ValidationConfig] = None
    deployment_config: Optional[DeploymentConfig] = None
    quality_gates: Optional[List[QualityGateConfig]] = None
    notification_config: Optional[NotificationConfig] = None
    
    tags: Optional[Dict[str, str]] = None


class DriftDetectionConfigRequest(BaseSchema):
    """Request to configure drift detection."""
    model_id: str = Field(..., min_length=1, max_length=100)
    monitor_name: str = Field(..., min_length=1, max_length=200)
    
    # Detection configuration
    detection_method: DriftDetectionMethod = DriftDetectionMethod.STATISTICAL
    drift_threshold: float = Field(0.05, ge=0.001, le=1.0)
    warning_threshold: float = Field(0.03, ge=0.001, le=1.0)
    
    # Data configuration
    feature_columns: Optional[List[str]] = None
    target_columns: Optional[List[str]] = None
    window_size: int = Field(1000, ge=100, le=100000)
    stability_window_days: int = Field(7, ge=1, le=30)
    
    # Monitoring configuration
    monitoring_frequency: str = Field("daily", regex="^(hourly|daily|weekly)$")
    sample_size: int = Field(1000, ge=100, le=10000)
    confidence_level: float = Field(0.95, ge=0.8, le=0.99)
    
    # Alert configuration
    alert_enabled: bool = True
    alert_channels: List[str] = Field(default_factory=lambda: ["email"])
    alert_frequency_hours: int = Field(1, ge=1, le=24)
    
    @validator('warning_threshold')
    def validate_warning_threshold(cls, v, values):
        drift_threshold = values.get('drift_threshold', 0.05)
        if v >= drift_threshold:
            raise ValueError('warning_threshold must be < drift_threshold')
        return v


# Response Schemas
class PipelineResponse(BaseSchema):
    """Response containing pipeline information."""
    pipeline_id: str
    model_id: str
    pipeline_name: str
    description: Optional[str]
    is_active: bool
    learning_mode: LearningMode
    
    # Statistics
    execution_count: int = 0
    success_count: int = 0
    failure_count: int = 0
    success_rate: float = 0.0
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    last_triggered_at: Optional[datetime] = None
    next_scheduled_run: Optional[datetime] = None
    
    # Configuration summary
    enabled_triggers: List[RetrainingTriggerType]
    auto_deploy: bool
    deployment_strategy: DeploymentStrategy


class ExecutionResponse(BaseSchema):
    """Response containing execution information."""
    execution_id: str
    pipeline_id: str
    model_id: str
    
    # Execution details
    trigger_type: RetrainingTriggerType
    trigger_reason: Optional[str]
    status: RetrainingPipelineStatus
    progress_percent: float = 0.0
    current_stage: Optional[str] = None
    
    # Data information
    training_data_size: int = 0
    validation_data_size: int = 0
    data_quality_score: Optional[float] = None
    
    # Model performance
    baseline_metrics: Optional[Dict[str, float]] = None
    new_model_metrics: Optional[Dict[str, float]] = None
    performance_improvement: Optional[float] = None
    
    # Quality gates
    quality_gates_passed: Optional[Dict[str, bool]] = None
    quality_issues: Optional[List[str]] = None
    
    # Deployment info
    deployment_attempted: bool = False
    deployment_successful: Optional[bool] = None
    deployed_version: Optional[str] = None
    rollback_executed: bool = False
    
    # Resource usage
    training_time_minutes: Optional[float] = None
    peak_memory_usage_gb: Optional[float] = None
    cost_usd: Optional[float] = None
    
    # Timestamps
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Error information
    error_message: Optional[str] = None
    retry_count: int = 0


class DriftReportResponse(BaseSchema):
    """Response containing drift detection report."""
    report_id: str
    model_id: str
    monitor_id: str
    
    # Report metadata
    report_type: str
    detection_method: str
    data_period_start: datetime
    data_period_end: datetime
    
    # Drift analysis
    overall_drift_score: float
    drift_detected: bool
    drift_severity: str
    drifted_features: Optional[List[str]] = None
    
    # Feature analysis
    feature_drift_scores: Optional[Dict[str, float]] = None
    feature_statistics: Optional[Dict[str, Any]] = None
    
    # Data quality
    data_quality_issues: Optional[List[str]] = None
    missing_values_pct: Optional[float] = None
    outlier_pct: Optional[float] = None
    
    # Recommendations
    recommended_actions: Optional[List[str]] = None
    retraining_recommended: bool = False
    urgency_level: str = "low"
    
    # Metadata
    sample_size: int
    analysis_duration_seconds: Optional[float] = None
    created_at: datetime


class AlertResponse(BaseSchema):
    """Response containing alert information."""
    alert_id: str
    pipeline_id: Optional[str] = None
    model_id: Optional[str] = None
    execution_id: Optional[str] = None
    
    # Alert details
    alert_type: str
    severity: AlertSeverity
    title: str
    message: str
    alert_data: Optional[Dict[str, Any]] = None
    
    # Recommended actions
    recommended_actions: Optional[List[str]] = None
    auto_action_taken: Optional[str] = None
    manual_action_required: bool = False
    
    # Status
    status: str = "active"
    acknowledged: bool = False
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    
    # Notification
    notification_sent: bool = False
    notification_channels: Optional[List[str]] = None
    
    # Timestamps
    triggered_at: datetime
    created_at: datetime


class QualityGateResultResponse(BaseSchema):
    """Response containing quality gate validation results."""
    result_id: str
    execution_id: str
    gate_name: str
    gate_type: QualityGate
    
    # Results
    passed: bool
    score: Optional[float] = None
    threshold: Optional[float] = None
    
    # Detailed results
    validation_results: Optional[Dict[str, Any]] = None
    metrics_evaluated: Optional[Dict[str, float]] = None
    checks_performed: Optional[List[Dict[str, Any]]] = None
    
    # Failure information
    failure_reason: Optional[str] = None
    failure_details: Optional[Dict[str, Any]] = None
    recommendations: Optional[List[str]] = None
    
    # Execution info
    validation_duration_seconds: Optional[float] = None
    created_at: datetime


# List and pagination schemas
class PaginationParams(BaseSchema):
    """Pagination parameters."""
    page: int = Field(1, ge=1)
    size: int = Field(20, ge=1, le=100)


class PipelineListResponse(BaseSchema):
    """Response for listing pipelines."""
    pipelines: List[PipelineResponse]
    total_count: int
    page: int
    size: int
    has_more: bool


class ExecutionListResponse(BaseSchema):
    """Response for listing executions."""
    executions: List[ExecutionResponse]
    total_count: int
    page: int
    size: int
    has_more: bool


class DriftReportListResponse(BaseSchema):
    """Response for listing drift reports."""
    reports: List[DriftReportResponse]
    total_count: int
    page: int
    size: int
    has_more: bool


class AlertListResponse(BaseSchema):
    """Response for listing alerts."""
    alerts: List[AlertResponse]
    total_count: int
    page: int
    size: int
    has_more: bool


# Status and health schemas
class PipelineStatusResponse(BaseSchema):
    """Response for pipeline status check."""
    pipeline_id: str
    is_active: bool
    is_healthy: bool
    current_executions: int
    last_execution_status: Optional[RetrainingPipelineStatus] = None
    last_execution_time: Optional[datetime] = None
    next_scheduled_run: Optional[datetime] = None
    
    # Health indicators
    drift_monitoring_active: bool = False
    performance_monitoring_active: bool = False
    data_pipeline_healthy: bool = True
    model_serving_healthy: bool = True
    
    # Recent statistics
    executions_last_24h: int = 0
    success_rate_last_7d: float = 0.0
    avg_execution_time_minutes: Optional[float] = None


class SystemHealthResponse(BaseSchema):
    """Response for system health check."""
    status: str = "healthy"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Component health
    database_healthy: bool = True
    mlflow_healthy: bool = True
    drift_detection_healthy: bool = True
    data_quality_healthy: bool = True
    
    # System statistics
    active_pipelines: int = 0
    running_executions: int = 0
    pending_executions: int = 0
    total_models_monitored: int = 0
    
    # Performance metrics
    avg_response_time_ms: Optional[float] = None
    memory_usage_percent: Optional[float] = None
    cpu_usage_percent: Optional[float] = None


# Analytics and insights schemas
class ModelPerformanceInsights(BaseSchema):
    """Model performance insights and trends."""
    model_id: str
    analysis_period_days: int = 30
    
    # Performance trends
    accuracy_trend: Optional[List[Dict[str, Any]]] = None
    drift_trend: Optional[List[Dict[str, Any]]] = None
    volume_trend: Optional[List[Dict[str, Any]]] = None
    
    # Key metrics
    current_accuracy: Optional[float] = None
    accuracy_change_30d: Optional[float] = None
    drift_score: Optional[float] = None
    prediction_volume_24h: Optional[int] = None
    
    # Recommendations
    recommendations: List[str] = Field(default_factory=list)
    risk_level: str = "low"
    next_retraining_recommended: Optional[datetime] = None


class RetrainingAnalytics(BaseSchema):
    """Analytics for retraining activities."""
    analysis_period_days: int = 30
    
    # Execution statistics
    total_executions: int = 0
    successful_executions: int = 0
    failed_executions: int = 0
    avg_execution_time_hours: Optional[float] = None
    
    # Trigger analysis
    trigger_distribution: Dict[str, int] = Field(default_factory=dict)
    most_common_trigger: Optional[str] = None
    
    # Performance improvements
    avg_performance_improvement: Optional[float] = None
    models_with_positive_improvement: int = 0
    models_with_negative_improvement: int = 0
    
    # Cost analysis
    total_training_cost_usd: Optional[float] = None
    avg_cost_per_training_usd: Optional[float] = None
    cost_savings_from_automation_usd: Optional[float] = None
    
    # Recommendations
    optimization_opportunities: List[str] = Field(default_factory=list)
    system_health_score: float = 1.0


# Error schemas
class ErrorResponse(BaseSchema):
    """Error response schema."""
    error_code: str
    error_type: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    request_id: Optional[str] = None
    
    # Validation errors
    validation_errors: Optional[List[Dict[str, str]]] = None
    
    # Troubleshooting
    suggested_actions: Optional[List[str]] = None
    documentation_link: Optional[str] = None


class SuccessResponse(BaseSchema):
    """Generic success response."""
    success: bool = True
    message: str
    data: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)