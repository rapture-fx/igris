"""
Enhanced MLOps API Schemas
==========================

Pydantic schemas for enhanced MLOps platform API validation and serialization.
Comprehensive schemas for model registry, advanced experiment tracking, training pipelines,
deployments, monitoring, and analytics.

Features:
- Model registry schemas with versioning and lineage
- Enhanced experiment configuration and result schemas
- Real-time metrics tracking schemas
- Collaborative experiment sharing schemas
- Multi-objective optimization schemas
- Training job orchestration schemas
- Deployment and serving schemas
- A/B testing and monitoring schemas
- Performance tracking and alert schemas
- Analytics and insights schemas
"""

from pydantic import BaseModel, Field, validator, root_validator
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta
from enum import Enum
import re


# Enums
class ModelStatus(str, Enum):
    """Model status options."""
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
    """Experiment status options."""
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TrainingJobStatus(str, Enum):
    """Training job status options."""
    QUEUED = "queued"
    PREPARING = "preparing"
    TRAINING = "training"
    OPTIMIZING = "optimizing"
    EVALUATING = "evaluating"
    COMPLETING = "completing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class DeploymentType(str, Enum):
    """Deployment type options."""
    PRODUCTION = "production"
    STAGING = "staging"
    DEVELOPMENT = "development"
    A_B_TEST = "ab_test"
    CANARY = "canary"
    SHADOW = "shadow"


class DeploymentStatus(str, Enum):
    """Deployment status options."""
    PENDING = "pending"
    DEPLOYING = "deploying"
    DEPLOYED = "deployed"
    FAILED = "failed"
    SCALING = "scaling"
    UPDATING = "updating"
    TERMINATED = "terminated"


class OptimizationMethod(str, Enum):
    """Hyperparameter optimization methods."""
    GRID_SEARCH = "grid_search"
    RANDOM_SEARCH = "random_search"
    BAYESIAN_OPTIMIZATION = "bayesian_optimization"
    EVOLUTIONARY = "evolutionary"
    OPTUNA = "optuna"


class AlertSeverity(str, Enum):
    """Alert severity levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# Base schemas
class BaseSchema(BaseModel):
    """Base schema with common configuration."""
    
    class Config:
        use_enum_values = True
        validate_assignment = True
        extra = "forbid"


class TimestampMixin(BaseModel):
    """Mixin for timestamp fields."""
    created_at: datetime
    updated_at: Optional[datetime] = None


# Model Registry Schemas
class ModelRegistrationRequest(BaseSchema):
    """Request schema for model registration."""
    name: str = Field(..., min_length=1, max_length=200, description="Model name")
    version: Optional[str] = Field(None, max_length=50, description="Model version")
    framework: ModelFramework = Field(..., description="ML framework")
    model_type: str = Field(..., min_length=1, max_length=50, description="Model type (classification, regression, etc.)")
    description: Optional[str] = Field(None, description="Model description")
    tags: Optional[List[str]] = Field(default_factory=list, description="Model tags")
    author: str = Field(..., min_length=1, max_length=100, description="Model author")
    
    # Model specifications
    input_schema: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Input data schema")
    output_schema: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Output data schema")
    feature_names: Optional[List[str]] = Field(default_factory=list, description="Feature names")
    target_names: Optional[List[str]] = Field(default_factory=list, description="Target names")
    
    # Training information
    training_dataset_id: Optional[str] = Field(None, description="Training dataset ID")
    hyperparameters: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Model hyperparameters")
    training_metrics: Optional[Dict[str, float]] = Field(default_factory=dict, description="Training metrics")
    validation_metrics: Optional[Dict[str, float]] = Field(default_factory=dict, description="Validation metrics")
    
    # Lineage
    parent_model_id: Optional[str] = Field(None, description="Parent model ID")
    experiment_id: Optional[str] = Field(None, description="Experiment ID")
    dependencies: Optional[List[str]] = Field(default_factory=list, description="Model dependencies")
    
    @validator('name')
    def validate_name(cls, v):
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Name must contain only alphanumeric characters, hyphens, and underscores')
        return v
    
    @validator('version')
    def validate_version(cls, v):
        if v and not re.match(r'^\d+\.\d+(\.\d+)?$', v):
            raise ValueError('Version must follow semantic versioning (e.g., 1.0.0)')
        return v
    
    @validator('tags')
    def validate_tags(cls, v):
        if v:
            for tag in v:
                if not isinstance(tag, str) or len(tag) > 50:
                    raise ValueError('Each tag must be a string with max 50 characters')
        return v


class ModelResponse(BaseSchema, TimestampMixin):
    """Response schema for model information."""
    model_id: str
    name: str
    version: str
    framework: ModelFramework
    model_type: str
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    author: str
    status: ModelStatus
    
    # Model specifications
    input_schema: Dict[str, Any] = Field(default_factory=dict)
    output_schema: Dict[str, Any] = Field(default_factory=dict)
    feature_names: List[str] = Field(default_factory=list)
    target_names: List[str] = Field(default_factory=list)
    
    # Training information
    training_dataset_id: Optional[str] = None
    hyperparameters: Dict[str, Any] = Field(default_factory=dict)
    training_metrics: Dict[str, float] = Field(default_factory=dict)
    validation_metrics: Dict[str, float] = Field(default_factory=dict)
    
    # Deployment information
    deployment_config: Dict[str, Any] = Field(default_factory=dict)
    resource_requirements: Dict[str, Any] = Field(default_factory=dict)
    
    # Lineage
    parent_model_id: Optional[str] = None
    experiment_id: Optional[str] = None
    dependencies: List[str] = Field(default_factory=list)
    
    # Artifact information
    artifact_path: Optional[str] = None
    artifact_checksum: Optional[str] = None
    artifact_size_bytes: Optional[int] = None


class ModelListResponse(BaseSchema):
    """Response schema for model listing."""
    models: List[ModelResponse]
    total: int
    page: int = 1
    page_size: int = 50


class ModelUpdateRequest(BaseSchema):
    """Request schema for model updates."""
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[ModelStatus] = None
    deployment_config: Optional[Dict[str, Any]] = None
    resource_requirements: Optional[Dict[str, Any]] = None


class ModelSearchRequest(BaseSchema):
    """Request schema for model search."""
    query: Optional[str] = Field(None, description="Text search query")
    frameworks: Optional[List[ModelFramework]] = Field(None, description="Framework filters")
    statuses: Optional[List[ModelStatus]] = Field(None, description="Status filters")
    tags: Optional[List[str]] = Field(None, description="Tag filters")
    author: Optional[str] = Field(None, description="Author filter")
    min_score: Optional[float] = Field(None, ge=0, le=1, description="Minimum score filter")
    score_metric: Optional[str] = Field("accuracy", description="Metric for score filtering")
    created_after: Optional[datetime] = Field(None, description="Created after date")
    created_before: Optional[datetime] = Field(None, description="Created before date")
    page: int = Field(1, ge=1, description="Page number")
    page_size: int = Field(50, ge=1, le=100, description="Page size")


# Experiment Schemas
class ExperimentCreateRequest(BaseSchema):
    """Request schema for experiment creation."""
    name: str = Field(..., min_length=1, max_length=200, description="Experiment name")
    description: Optional[str] = Field(None, description="Experiment description")
    
    # Data configuration
    dataset_config: Dict[str, Any] = Field(..., description="Dataset configuration")
    target_column: str = Field(..., min_length=1, description="Target column name")
    feature_columns: Optional[List[str]] = Field(None, description="Feature columns")
    
    # Model configurations
    model_configs: List[Dict[str, Any]] = Field(..., min_items=1, description="Model configurations")
    
    # Training configuration
    train_test_split: Optional[Dict[str, Any]] = Field(
        default_factory=lambda: {"test_size": 0.2, "random_state": 42},
        description="Train-test split configuration"
    )
    cross_validation: Optional[Dict[str, Any]] = Field(
        default_factory=lambda: {"cv": 5},
        description="Cross-validation configuration"
    )
    
    # Optimization configuration
    hyperparameter_search: Optional[Dict[str, Any]] = Field(
        default_factory=lambda: {"method": "random_search", "n_iter": 50},
        description="Hyperparameter search configuration"
    )
    optimization_budget: Optional[int] = Field(50, ge=1, le=1000, description="Optimization budget")
    max_training_time_minutes: Optional[int] = Field(60, ge=1, le=10080, description="Max training time")
    
    # Evaluation configuration
    evaluation_metrics: Optional[List[str]] = Field(
        default_factory=lambda: ["accuracy", "precision", "recall", "f1"],
        description="Evaluation metrics"
    )
    early_stopping: Optional[Dict[str, Any]] = Field(
        default_factory=lambda: {"patience": 10, "monitor": "val_loss"},
        description="Early stopping configuration"
    )
    
    @validator('dataset_config')
    def validate_dataset_config(cls, v):
        required_fields = ['file_path', 'sql_query', 'api_endpoint']
        if not any(field in v for field in required_fields):
            raise ValueError('Dataset config must contain at least one of: file_path, sql_query, api_endpoint')
        return v
    
    @validator('model_configs')
    def validate_model_configs(cls, v):
        for i, config in enumerate(v):
            if 'name' not in config:
                config['name'] = f'model_{i}'
            if 'framework' not in config:
                config['framework'] = 'sklearn'
        return v


class ExperimentResponse(BaseSchema, TimestampMixin):
    """Response schema for experiment information."""
    experiment_id: str
    name: str
    description: Optional[str] = None
    created_by: str
    status: ExperimentStatus
    
    # Configuration
    dataset_config: Dict[str, Any]
    target_column: str
    feature_columns: List[str] = Field(default_factory=list)
    model_configs: List[Dict[str, Any]]
    
    # Training configuration
    train_test_split: Dict[str, Any]
    cross_validation: Dict[str, Any]
    hyperparameter_search: Dict[str, Any]
    optimization_budget: int
    max_training_time_minutes: int
    evaluation_metrics: List[str]
    early_stopping: Dict[str, Any]
    
    # Results
    results: Optional[Dict[str, Any]] = None
    
    # Resource usage
    total_training_time_minutes: Optional[float] = None
    peak_memory_usage_gb: Optional[float] = None
    cpu_hours_used: Optional[float] = None
    
    # Timestamps
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class ExperimentListResponse(BaseSchema):
    """Response schema for experiment listing."""
    experiments: List[ExperimentResponse]
    total: int
    page: int = 1
    page_size: int = 50


# Training Job Schemas
class TrainingJobCreateRequest(BaseSchema):
    """Request schema for training job creation."""
    name: str = Field(..., min_length=1, max_length=200, description="Job name")
    description: Optional[str] = Field(None, description="Job description")
    experiment_id: Optional[str] = Field(None, description="Associated experiment ID")
    
    # Data configuration
    data_config: Dict[str, Any] = Field(..., description="Data configuration")
    target_column: str = Field(..., min_length=1, description="Target column")
    feature_columns: Optional[List[str]] = Field(None, description="Feature columns")
    
    # Model configurations
    model_configs: List[Dict[str, Any]] = Field(..., min_items=1, description="Model configurations")
    
    # Training configuration
    train_test_split_config: Optional[Dict[str, Any]] = Field(
        default_factory=lambda: {"test_size": 0.2, "random_state": 42}
    )
    validation_config: Optional[Dict[str, Any]] = Field(
        default_factory=lambda: {"cv": 5}
    )
    
    # Optimization configuration
    optimization_method: OptimizationMethod = Field(OptimizationMethod.RANDOM_SEARCH)
    optimization_budget: int = Field(50, ge=1, le=1000)
    max_training_time_hours: float = Field(2.0, gt=0, le=24)
    early_stopping_config: Optional[Dict[str, Any]] = Field(
        default_factory=lambda: {"patience": 10}
    )
    
    # Resource configuration
    max_parallel_jobs: Optional[int] = Field(None, ge=1, le=20)
    memory_limit_gb: float = Field(4.0, gt=0, le=64)
    gpu_enabled: bool = Field(False)
    distributed_training: bool = Field(False)
    
    # Output configuration
    save_intermediate_models: bool = Field(True)
    model_registry_config: Optional[Dict[str, Any]] = Field(default_factory=dict)
    
    # Job priority
    priority: int = Field(1, ge=1, le=10, description="Job priority (1-10)")


class TrainingJobResponse(BaseSchema, TimestampMixin):
    """Response schema for training job information."""
    job_id: str
    experiment_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    status: TrainingJobStatus
    progress: float = Field(ge=0, le=100)
    current_step: Optional[str] = None
    error_message: Optional[str] = None
    
    # Configuration
    data_config: Dict[str, Any]
    target_column: str
    feature_columns: List[str]
    model_configs: List[Dict[str, Any]]
    
    # Results
    total_models_trained: int = 0
    successful_models: int = 0
    failed_models: int = 0
    best_model_id: Optional[str] = None
    best_score: Optional[float] = None
    
    # Resource usage
    training_time_hours: Optional[float] = None
    peak_memory_usage_gb: Optional[float] = None
    cpu_hours_used: Optional[float] = None
    
    # Metadata
    created_by: str
    priority: int
    
    # Timestamps
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class TrainingJobListResponse(BaseSchema):
    """Response schema for training job listing."""
    jobs: List[TrainingJobResponse]
    total: int
    page: int = 1
    page_size: int = 50


# Deployment Schemas
class DeploymentCreateRequest(BaseSchema):
    """Request schema for model deployment."""
    model_id: str = Field(..., description="Model ID to deploy")
    name: str = Field(..., min_length=1, max_length=200, description="Deployment name")
    deployment_type: DeploymentType = Field(..., description="Deployment type")
    environment: str = Field(..., min_length=1, max_length=50, description="Deployment environment")
    
    # Infrastructure configuration
    replicas: int = Field(1, ge=1, le=100, description="Number of replicas")
    resource_limits: Optional[Dict[str, Any]] = Field(
        default_factory=lambda: {"cpu": "1", "memory": "2Gi"},
        description="Resource limits"
    )
    auto_scaling: Optional[Dict[str, Any]] = Field(
        default_factory=lambda: {"enabled": False, "min_replicas": 1, "max_replicas": 10},
        description="Auto-scaling configuration"
    )
    
    # Traffic routing
    traffic_percentage: float = Field(100.0, ge=0, le=100, description="Traffic percentage")
    routing_rules: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Routing rules")
    
    # Monitoring
    monitoring_config: Optional[Dict[str, Any]] = Field(
        default_factory=lambda: {"enabled": True, "metrics_interval": 60},
        description="Monitoring configuration"
    )
    alert_rules: Optional[List[Dict[str, Any]]] = Field(
        default_factory=list,
        description="Alert rules"
    )
    health_check_config: Optional[Dict[str, Any]] = Field(
        default_factory=lambda: {"path": "/health", "interval": 30},
        description="Health check configuration"
    )
    
    # A/B Testing
    ab_test_config: Optional[Dict[str, Any]] = Field(None, description="A/B test configuration")
    
    # Metadata
    deployment_notes: Optional[str] = Field(None, description="Deployment notes")
    
    @validator('traffic_percentage')
    def validate_traffic_percentage(cls, v):
        if not 0 <= v <= 100:
            raise ValueError('Traffic percentage must be between 0 and 100')
        return v


class DeploymentResponse(BaseSchema, TimestampMixin):
    """Response schema for deployment information."""
    deployment_id: str
    model_id: str
    name: str
    deployment_type: DeploymentType
    environment: str
    status: DeploymentStatus
    health_status: Optional[str] = None
    
    # Infrastructure
    replicas: int
    resource_limits: Dict[str, Any]
    auto_scaling: Dict[str, Any]
    
    # Traffic routing
    traffic_percentage: float
    routing_rules: Dict[str, Any]
    
    # Monitoring
    monitoring_config: Dict[str, Any]
    alert_rules: List[Dict[str, Any]]
    health_check_config: Dict[str, Any]
    last_health_check: Optional[datetime] = None
    
    # Performance metrics
    request_count: int = 0
    avg_response_time_ms: Optional[float] = None
    error_rate: Optional[float] = None
    throughput_rps: Optional[float] = None
    
    # A/B Testing
    ab_test_id: Optional[str] = None
    ab_test_config: Optional[Dict[str, Any]] = None
    champion_challenger: Optional[str] = None
    
    # Metadata
    deployed_by: str
    deployment_notes: Optional[str] = None
    
    # Timestamps
    deployed_at: Optional[datetime] = None
    last_updated_at: datetime
    terminated_at: Optional[datetime] = None


class DeploymentListResponse(BaseSchema):
    """Response schema for deployment listing."""
    deployments: List[DeploymentResponse]
    total: int
    page: int = 1
    page_size: int = 50


class DeploymentUpdateRequest(BaseSchema):
    """Request schema for deployment updates."""
    replicas: Optional[int] = Field(None, ge=1, le=100)
    resource_limits: Optional[Dict[str, Any]] = None
    auto_scaling: Optional[Dict[str, Any]] = None
    traffic_percentage: Optional[float] = Field(None, ge=0, le=100)
    routing_rules: Optional[Dict[str, Any]] = None
    monitoring_config: Optional[Dict[str, Any]] = None
    alert_rules: Optional[List[Dict[str, Any]]] = None
    deployment_notes: Optional[str] = None


# Prediction Schemas
class PredictionRequest(BaseSchema):
    """Request schema for model predictions."""
    input_data: Union[Dict[str, Any], List[Dict[str, Any]]] = Field(
        ..., description="Input data for prediction"
    )
    return_probabilities: bool = Field(False, description="Return prediction probabilities")
    return_explanations: bool = Field(False, description="Return prediction explanations")
    
    @validator('input_data')
    def validate_input_data(cls, v):
        if isinstance(v, list):
            if len(v) > 1000:
                raise ValueError('Batch size cannot exceed 1000')
            for item in v:
                if not isinstance(item, dict):
                    raise ValueError('Each item in input_data must be a dictionary')
        elif not isinstance(v, dict):
            raise ValueError('input_data must be a dictionary or list of dictionaries')
        return v


class PredictionResponse(BaseSchema):
    """Response schema for model predictions."""
    model_id: str
    model_name: str
    model_version: str
    predictions: Union[List[Any], Any]
    probabilities: Optional[Union[List[List[float]], List[float]]] = None
    explanations: Optional[Union[List[Dict[str, Any]], Dict[str, Any]]] = None
    prediction_timestamp: datetime
    response_time_ms: Optional[float] = None


# A/B Testing Schemas
class ABTestCreateRequest(BaseSchema):
    """Request schema for A/B test creation."""
    name: str = Field(..., min_length=1, max_length=200, description="Test name")
    description: Optional[str] = Field(None, description="Test description")
    champion_model_id: str = Field(..., description="Champion model ID")
    challenger_model_id: str = Field(..., description="Challenger model ID")
    
    # Traffic allocation
    champion_traffic_pct: float = Field(50.0, ge=0, le=100, description="Champion traffic percentage")
    challenger_traffic_pct: float = Field(50.0, ge=0, le=100, description="Challenger traffic percentage")
    
    # Test parameters
    target_metric: str = Field(..., description="Target metric to optimize")
    minimum_sample_size: int = Field(1000, ge=100, description="Minimum sample size")
    statistical_significance: float = Field(0.95, gt=0, lt=1, description="Statistical significance")
    max_duration_days: int = Field(30, ge=1, le=365, description="Maximum test duration")
    
    # Metadata
    notes: Optional[str] = Field(None, description="Test notes")
    
    @root_validator
    def validate_traffic_allocation(cls, values):
        champion_pct = values.get('champion_traffic_pct', 0)
        challenger_pct = values.get('challenger_traffic_pct', 0)
        if abs(champion_pct + challenger_pct - 100.0) > 0.1:
            raise ValueError('Traffic percentages must sum to 100')
        return values


class ABTestResponse(BaseSchema, TimestampMixin):
    """Response schema for A/B test information."""
    test_id: str
    name: str
    description: Optional[str] = None
    status: str
    
    # Models
    champion_model_id: str
    challenger_model_id: str
    winner_model_id: Optional[str] = None
    
    # Traffic allocation
    champion_traffic_pct: float
    challenger_traffic_pct: float
    
    # Test parameters
    target_metric: str
    minimum_sample_size: int
    statistical_significance: float
    max_duration_days: int
    
    # Results
    champion_metrics: Optional[Dict[str, Any]] = None
    challenger_metrics: Optional[Dict[str, Any]] = None
    statistical_results: Optional[Dict[str, Any]] = None
    
    # Metadata
    created_by: str
    notes: Optional[str] = None
    
    # Timestamps
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None


# Performance Monitoring Schemas
class PerformanceLogRequest(BaseSchema):
    """Request schema for logging model performance."""
    model_id: str = Field(..., description="Model ID")
    deployment_id: Optional[str] = Field(None, description="Deployment ID")
    dataset_name: str = Field("production", description="Dataset name")
    metrics: Dict[str, float] = Field(..., description="Performance metrics")
    sample_size: Optional[int] = Field(None, ge=1, description="Sample size")
    
    # Data drift
    feature_drift_score: Optional[float] = Field(None, ge=0, le=1, description="Feature drift score")
    label_drift_score: Optional[float] = Field(None, ge=0, le=1, description="Label drift score")
    drift_detected: bool = Field(False, description="Whether drift was detected")
    
    # Predictions analysis
    prediction_distribution: Optional[Dict[str, Any]] = Field(None, description="Prediction distribution")
    confidence_distribution: Optional[Dict[str, Any]] = Field(None, description="Confidence distribution")
    
    # Time period
    data_period_start: Optional[datetime] = Field(None, description="Data period start")
    data_period_end: Optional[datetime] = Field(None, description="Data period end")


class PerformanceLogResponse(BaseSchema, TimestampMixin):
    """Response schema for performance logs."""
    log_id: int
    model_id: str
    deployment_id: Optional[str] = None
    dataset_name: str
    metrics: Dict[str, float]
    sample_size: Optional[int] = None
    
    # Data drift
    feature_drift_score: Optional[float] = None
    label_drift_score: Optional[float] = None
    drift_detected: bool
    
    # Predictions analysis
    prediction_distribution: Optional[Dict[str, Any]] = None
    confidence_distribution: Optional[Dict[str, Any]] = None
    
    # Time period
    recorded_at: datetime
    data_period_start: Optional[datetime] = None
    data_period_end: Optional[datetime] = None


class ModelPerformanceResponse(BaseSchema):
    """Response schema for model performance overview."""
    model_id: str
    model_name: str
    model_version: str
    framework: ModelFramework
    status: ModelStatus
    
    # Current metrics
    latest_metrics: Optional[Dict[str, float]] = None
    latest_metrics_date: Optional[datetime] = None
    
    # Historical performance
    performance_history: List[PerformanceLogResponse] = Field(default_factory=list)
    performance_trend: Optional[Dict[str, Any]] = None
    
    # Alerts
    active_alerts: int = 0
    last_alert_date: Optional[datetime] = None
    
    # Drift detection
    drift_detected: bool = False
    last_drift_date: Optional[datetime] = None


# Alert Schemas
class AlertCreateRequest(BaseSchema):
    """Request schema for alert creation."""
    model_id: str = Field(..., description="Model ID")
    deployment_id: Optional[str] = Field(None, description="Deployment ID")
    alert_type: str = Field(..., description="Alert type")
    severity: AlertSeverity = Field(..., description="Alert severity")
    title: str = Field(..., min_length=1, max_length=200, description="Alert title")
    description: Optional[str] = Field(None, description="Alert description")
    
    # Alert triggers
    metric_name: Optional[str] = Field(None, description="Metric name")
    metric_value: Optional[float] = Field(None, description="Metric value")
    threshold_value: Optional[float] = Field(None, description="Threshold value")
    
    # Configuration
    alert_rule_config: Optional[Dict[str, Any]] = Field(None, description="Alert rule configuration")


class AlertResponse(BaseSchema, TimestampMixin):
    """Response schema for alert information."""
    alert_id: str
    model_id: str
    deployment_id: Optional[str] = None
    alert_type: str
    severity: AlertSeverity
    title: str
    description: Optional[str] = None
    status: str
    
    # Alert triggers
    metric_name: Optional[str] = None
    metric_value: Optional[float] = None
    threshold_value: Optional[float] = None
    
    # Resolution
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    
    # Configuration
    alert_rule_config: Optional[Dict[str, Any]] = None
    notification_sent: bool = False
    
    # Timestamps
    triggered_at: datetime


class AlertListResponse(BaseSchema):
    """Response schema for alert listing."""
    alerts: List[AlertResponse]
    total: int
    page: int = 1
    page_size: int = 50


# Statistics and Health Schemas
class ModelHealthReport(BaseSchema):
    """Response schema for model health report."""
    model_id: str
    model_name: str
    model_version: str
    status: ModelStatus
    health_score: float = Field(ge=0, le=100, description="Health score (0-100)")
    
    # Health components
    integrity_status: str
    performance_trend: Dict[str, Any]
    approval_status: str
    
    # Recommendations
    recommendations: List[str]
    
    # Timestamps
    last_updated: datetime
    report_generated_at: datetime


class PlatformStatistics(BaseSchema):
    """Response schema for platform statistics."""
    # Model statistics
    total_models: int
    models_by_status: Dict[str, int]
    models_by_framework: Dict[str, int]
    models_by_type: Dict[str, int]
    
    # Experiment statistics
    total_experiments: int
    experiments_by_status: Dict[str, int]
    active_experiments: int
    
    # Training job statistics
    total_training_jobs: int
    jobs_by_status: Dict[str, int]
    active_training_jobs: int
    
    # Deployment statistics
    total_deployments: int
    deployments_by_status: Dict[str, int]
    deployments_by_environment: Dict[str, int]
    active_deployments: int
    
    # Performance statistics
    total_predictions_served: int
    avg_response_time_ms: Optional[float] = None
    models_with_active_monitoring: int
    active_alerts: int
    
    # Resource utilization
    resource_utilization: Optional[Dict[str, Any]] = None
    
    # Metadata
    platform_version: str
    statistics_generated_at: datetime


# Error Schemas
class MLOpsError(BaseSchema):
    """Error response schema."""
    error_code: str
    error_message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    request_id: Optional[str] = None


class ValidationError(BaseSchema):
    """Validation error response schema."""
    error_type: str = "validation_error"
    message: str
    field_errors: Optional[List[Dict[str, str]]] = None


# Enhanced Experiment Tracking Schemas

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


class MetricDefinitionCreate(BaseSchema):
    """Schema for creating custom metric definitions."""
    name: str = Field(..., min_length=1, max_length=100, description="Metric name")
    description: Optional[str] = Field(None, description="Metric description")
    metric_type: MetricType = Field(MetricType.CUSTOM, description="Type of metric")
    objective: OptimizationObjective = Field(OptimizationObjective.MAXIMIZE, description="Optimization objective")
    weight: float = Field(1.0, ge=0.0, le=10.0, description="Metric weight for multi-objective optimization")
    threshold: Optional[float] = Field(None, description="Performance threshold")
    aggregation_method: str = Field("mean", regex="^(mean|median|max|min|last)$", description="Aggregation method")
    is_primary: bool = Field(False, description="Whether this is a primary metric")
    tags: Optional[List[str]] = Field(default_factory=list, description="Metric tags")
    formula: Optional[str] = Field(None, description="Mathematical formula if applicable")
    units: Optional[str] = Field(None, max_length=50, description="Measurement units")

    @validator('name')
    def validate_metric_name(cls, v):
        if not re.match(r'^[a-zA-Z][a-zA-Z0-9_]*$', v):
            raise ValueError('Metric name must start with a letter and contain only letters, numbers, and underscores')
        return v


class MetricDefinitionResponse(MetricDefinitionCreate):
    """Schema for metric definition responses."""
    usage_count: int = Field(0, description="Number of experiments using this metric")
    created_by: str = Field(..., description="Creator of the metric")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


class CollaborationSettings(BaseSchema):
    """Schema for experiment collaboration settings."""
    shared_with: Optional[Dict[str, SharePermission]] = Field(default_factory=dict, description="Users with access")
    shared_teams: Optional[Dict[str, SharePermission]] = Field(default_factory=dict, description="Teams with access")
    public: bool = Field(False, description="Whether experiment is publicly accessible")
    allow_comments: bool = Field(True, description="Whether comments are allowed")
    auto_share_results: bool = Field(False, description="Auto-share results with collaborators")


class OptimizationObjectiveCreate(BaseSchema):
    """Schema for optimization objectives."""
    name: str = Field(..., min_length=1, max_length=100, description="Objective name (metric name)")
    description: Optional[str] = Field(None, description="Objective description")
    metric_type: MetricType = Field(MetricType.CUSTOM, description="Type of metric")
    objective: OptimizationObjective = Field(..., description="Optimization direction")
    weight: float = Field(1.0, ge=0.0, le=10.0, description="Objective weight")
    threshold: Optional[float] = Field(None, description="Target threshold")
    is_primary: bool = Field(False, description="Whether this is the primary objective")


class EnhancedExperimentCreate(BaseSchema):
    """Schema for creating enhanced experiments."""
    name: str = Field(..., min_length=1, max_length=200, description="Experiment name")
    description: Optional[str] = Field(None, description="Experiment description")
    experiment_type: ExperimentType = Field(..., description="Type of experiment")
    
    # Data configuration
    dataset_config: Dict[str, Any] = Field(..., description="Dataset configuration")
    
    # Model configurations
    model_configs: List[Dict[str, Any]] = Field(..., min_items=1, description="Model configurations")
    
    # Optimization objectives
    optimization_objectives: List[OptimizationObjectiveCreate] = Field(..., min_items=1, description="Optimization objectives")
    
    # Experiment settings
    tags: Optional[List[str]] = Field(default_factory=list, description="Experiment tags")
    parent_experiment_ids: Optional[List[str]] = Field(default_factory=list, description="Parent experiment IDs")
    fork_reason: Optional[str] = Field(None, description="Reason for forking from parent")
    
    # Resource configuration
    max_training_time_minutes: int = Field(60, ge=1, le=43200, description="Maximum training time in minutes")
    optimization_budget: int = Field(50, ge=1, le=1000, description="Optimization budget (iterations)")
    resource_requirements: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Required resources")
    
    # Collaboration settings
    collaboration_settings: Optional[CollaborationSettings] = Field(None, description="Collaboration settings")
    
    # Automation settings
    auto_start_monitoring: bool = Field(True, description="Automatically start monitoring")
    auto_start_training: bool = Field(False, description="Automatically start training")
    
    # Custom metadata
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional metadata")

    @validator('parent_experiment_ids')
    def validate_parent_ids(cls, v):
        if v and len(v) > 5:  # Reasonable limit on lineage complexity
            raise ValueError('Maximum 5 parent experiments allowed')
        return v

    @validator('model_configs')
    def validate_model_configs(cls, v):
        for config in v:
            if 'model_type' not in config:
                raise ValueError('model_type is required in each model configuration')
            if 'framework' not in config:
                raise ValueError('framework is required in each model configuration')
        return v


class MetricLogEntry(BaseSchema):
    """Schema for individual metric log entries."""
    name: str = Field(..., min_length=1, max_length=100, description="Metric name")
    value: Union[float, int] = Field(..., description="Metric value")
    step: Optional[int] = Field(None, ge=0, description="Training step")
    epoch: Optional[int] = Field(None, ge=0, description="Training epoch")
    timestamp: Optional[datetime] = Field(None, description="Custom timestamp")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional metadata")
    source: Optional[str] = Field("training", regex="^(training|validation|test|custom)$", description="Metric source")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Confidence in metric value")


class MetricLogBatch(BaseSchema):
    """Schema for batch metric logging."""
    metrics: List[MetricLogEntry] = Field(..., min_items=1, max_items=1000, description="Batch of metrics")
    experiment_step: Optional[int] = Field(None, ge=0, description="Overall experiment step")


class HyperparameterLogEntry(BaseSchema):
    """Schema for hyperparameter logging."""
    name: str = Field(..., min_length=1, max_length=100, description="Parameter name")
    value: Any = Field(..., description="Parameter value")
    parameter_type: Optional[str] = Field(None, regex="^(int|float|str|bool|list|dict)$", description="Parameter type")
    search_space: Optional[Dict[str, Any]] = Field(None, description="Search space definition")
    importance_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Parameter importance")
    is_optimized: bool = Field(False, description="Whether this parameter is being optimized")


class HyperparameterLogBatch(BaseSchema):
    """Schema for batch hyperparameter logging."""
    hyperparameters: Dict[str, Any] = Field(..., description="Hyperparameter dictionary")


class ExperimentSharingRequest(BaseSchema):
    """Schema for experiment sharing requests."""
    user_id: str = Field(..., min_length=1, max_length=100, description="User ID to share with")
    permission: SharePermission = Field(..., description="Permission level")
    message: Optional[str] = Field(None, description="Optional message")
    notify_user: bool = Field(True, description="Whether to notify the user")


class ExperimentCommentCreate(BaseSchema):
    """Schema for creating experiment comments."""
    content: str = Field(..., min_length=1, max_length=2000, description="Comment content")
    parent_comment_id: Optional[str] = Field(None, description="Parent comment ID for threading")
    comment_type: str = Field("user", regex="^(user|system|insight)$", description="Comment type")
    attachments: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="File attachments")
    mentions: Optional[List[str]] = Field(default_factory=list, description="Mentioned users")


class ExperimentCommentResponse(BaseSchema):
    """Schema for experiment comment responses."""
    comment_id: str = Field(..., description="Comment ID")
    experiment_id: str = Field(..., description="Experiment ID")
    author: str = Field(..., description="Comment author")
    content: str = Field(..., description="Comment content")
    comment_type: str = Field(..., description="Comment type")
    parent_comment_id: Optional[str] = Field(None, description="Parent comment ID")
    thread_depth: int = Field(0, description="Thread depth")
    is_resolved: bool = Field(False, description="Whether comment is resolved")
    attachments: List[Dict[str, Any]] = Field(default_factory=list, description="Attachments")
    mentions: List[str] = Field(default_factory=list, description="Mentioned users")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


class ExperimentComparisonRequest(BaseSchema):
    """Schema for experiment comparison requests."""
    experiment_ids: List[str] = Field(..., min_items=2, max_items=10, description="Experiments to compare")
    comparison_metrics: Optional[List[str]] = Field(None, description="Specific metrics to compare")
    statistical_test: str = Field("ttest", regex="^(ttest|anova|wilcoxon|mannwhitney)$", description="Statistical test")
    confidence_level: float = Field(0.95, ge=0.5, le=0.99, description="Statistical confidence level")
    include_effect_size: bool = Field(True, description="Include effect size calculation")


class ExperimentComparisonResult(BaseSchema):
    """Schema for experiment comparison results."""
    comparison_id: str = Field(..., description="Comparison ID")
    comparison_type: str = Field(..., description="Type of comparison")
    experiments_compared: List[str] = Field(..., description="Experiment IDs compared")
    winner: Optional[str] = Field(None, description="Winning experiment ID")
    performance_improvement: float = Field(..., description="Performance improvement percentage")
    statistical_significance: float = Field(..., description="Statistical significance")
    confidence_level: float = Field(..., description="Confidence level")
    effect_size: float = Field(..., description="Effect size")
    comparison_metrics: Dict[str, Any] = Field(..., description="Detailed metric comparison")
    insights: List[str] = Field(default_factory=list, description="Generated insights")
    created_at: datetime = Field(..., description="Comparison timestamp")


class TrendAnalysisRequest(BaseSchema):
    """Schema for trend analysis requests."""
    experiment_ids: List[str] = Field(..., min_items=2, description="Experiments to analyze")
    metric_names: List[str] = Field(..., min_items=1, description="Metrics to analyze")
    time_period_days: int = Field(30, ge=1, le=365, description="Time period for analysis")
    include_predictions: bool = Field(True, description="Include trend predictions")
    prediction_steps: int = Field(5, ge=1, le=20, description="Number of prediction steps")


class TrendAnalysisResult(BaseSchema):
    """Schema for trend analysis results."""
    metric_name: str = Field(..., description="Analyzed metric name")
    time_period_days: int = Field(..., description="Analysis time period")
    trend_direction: str = Field(..., description="Trend direction")
    trend_strength: float = Field(..., ge=0.0, le=1.0, description="Trend strength")
    seasonal_pattern: bool = Field(..., description="Whether seasonal pattern detected")
    volatility: float = Field(..., ge=0.0, description="Metric volatility")
    predictions: List[Dict[str, Any]] = Field(default_factory=list, description="Future predictions")
    confidence_interval: Optional[Dict[str, float]] = Field(None, description="Confidence interval")
    r_squared: Optional[float] = Field(None, description="R-squared value")
    p_value: Optional[float] = Field(None, description="Statistical significance")


class ResourceEfficiencyAnalysis(BaseSchema):
    """Schema for resource efficiency analysis results."""
    efficiency_score: float = Field(..., ge=0.0, le=1.0, description="Overall efficiency score")
    cpu_efficiency: float = Field(..., ge=0.0, le=1.0, description="CPU efficiency")
    memory_efficiency: float = Field(..., ge=0.0, le=1.0, description="Memory efficiency")
    gpu_efficiency: float = Field(..., ge=0.0, le=1.0, description="GPU efficiency")
    time_efficiency: float = Field(..., ge=0.0, le=1.0, description="Time efficiency")
    cost_efficiency: Optional[float] = Field(None, description="Cost efficiency")
    carbon_efficiency: Optional[float] = Field(None, description="Carbon efficiency")
    recommendations: List[str] = Field(default_factory=list, description="Efficiency recommendations")
    benchmark_comparison: Dict[str, float] = Field(default_factory=dict, description="Benchmark comparison")


class BestPracticeRecommendation(BaseSchema):
    """Schema for best practice recommendations."""
    category: str = Field(..., description="Recommendation category")
    recommendation: str = Field(..., description="Recommendation text")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence in recommendation")
    supporting_experiments: List[str] = Field(default_factory=list, description="Supporting experiments")
    expected_improvement: float = Field(..., description="Expected improvement percentage")
    implementation_difficulty: str = Field(..., regex="^(easy|medium|hard)$", description="Implementation difficulty")


class ExperimentPortfolioAnalysis(BaseSchema):
    """Schema for experiment portfolio analysis."""
    total_experiments: int = Field(..., ge=0, description="Total experiments analyzed")
    success_rate: float = Field(..., ge=0.0, le=1.0, description="Overall success rate")
    avg_performance: float = Field(..., ge=0.0, le=1.0, description="Average performance")
    performance_distribution: Dict[str, int] = Field(..., description="Performance distribution")
    resource_utilization: Dict[str, float] = Field(..., description="Resource utilization stats")
    experiment_diversity: float = Field(..., ge=0.0, le=1.0, description="Experiment diversity score")
    exploration_exploitation_balance: float = Field(..., ge=0.0, le=1.0, description="Exploration vs exploitation balance")
    portfolio_health_score: float = Field(..., ge=0.0, le=1.0, description="Overall portfolio health")
    recommendations: List[BestPracticeRecommendation] = Field(default_factory=list, description="Portfolio recommendations")


class ExperimentInsights(BaseSchema):
    """Schema for experiment insights."""
    performance_summary: Dict[str, float] = Field(default_factory=dict, description="Performance summary")
    best_hyperparameters: Dict[str, Any] = Field(default_factory=dict, description="Best hyperparameters")
    feature_importance_ranking: List[Dict[str, Any]] = Field(default_factory=list, description="Feature importance")
    convergence_analysis: Dict[str, Any] = Field(default_factory=dict, description="Convergence analysis")
    stability_metrics: Dict[str, float] = Field(default_factory=dict, description="Stability metrics")
    efficiency_score: float = Field(..., ge=0.0, le=1.0, description="Resource efficiency score")
    recommendations: List[str] = Field(default_factory=list, description="Automated recommendations")
    anomalies: List[Dict[str, Any]] = Field(default_factory=list, description="Detected anomalies")
    comparison_insights: Dict[str, Any] = Field(default_factory=dict, description="Comparison insights")


class ExperimentLineage(BaseSchema):
    """Schema for experiment genealogy and lineage."""
    experiment_id: str = Field(..., description="Current experiment ID")
    lineage_depth: int = Field(0, ge=0, description="Lineage depth")
    ancestors: List[Dict[str, Any]] = Field(default_factory=list, description="Ancestor experiments")
    descendants: List[Dict[str, Any]] = Field(default_factory=list, description="Descendant experiments")
    siblings: List[Dict[str, Any]] = Field(default_factory=list, description="Sibling experiments")
    related: List[str] = Field(default_factory=list, description="Related experiment IDs")
    fork_reason: Optional[str] = Field(None, description="Reason for forking")


class EnhancedExperimentResponse(BaseSchema):
    """Schema for enhanced experiment responses."""
    experiment_id: str = Field(..., description="Experiment ID")
    name: str = Field(..., description="Experiment name")
    description: Optional[str] = Field(None, description="Experiment description")
    experiment_type: ExperimentType = Field(..., description="Experiment type")
    status: ExperimentStatus = Field(..., description="Current status")
    progress: float = Field(0.0, ge=0.0, le=100.0, description="Progress percentage")
    
    # Configuration
    dataset_config: Dict[str, Any] = Field(default_factory=dict, description="Dataset configuration")
    model_configs: List[Dict[str, Any]] = Field(default_factory=list, description="Model configurations")
    optimization_objectives: List[Dict[str, Any]] = Field(default_factory=list, description="Optimization objectives")
    
    # Results
    performance_summary: Dict[str, float] = Field(default_factory=dict, description="Performance summary")
    best_hyperparameters: Dict[str, Any] = Field(default_factory=dict, description="Best hyperparameters")
    efficiency_score: Optional[float] = Field(None, description="Resource efficiency score")
    
    # Metadata
    tags: List[str] = Field(default_factory=list, description="Experiment tags")
    created_by: str = Field(..., description="Experiment creator")
    shared_with: Dict[str, str] = Field(default_factory=dict, description="Shared users")
    is_public: bool = Field(False, description="Public visibility")
    
    # Lineage
    parent_experiment_ids: List[str] = Field(default_factory=list, description="Parent experiments")
    child_experiment_ids: List[str] = Field(default_factory=list, description="Child experiments")
    lineage_depth: int = Field(0, description="Lineage depth")
    
    # Timestamps
    created_at: datetime = Field(..., description="Creation timestamp")
    started_at: Optional[datetime] = Field(None, description="Start timestamp")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")
    last_activity_at: datetime = Field(..., description="Last activity timestamp")


class AutomatedReportRequest(BaseSchema):
    """Schema for automated report generation requests."""
    experiment_ids: List[str] = Field(..., min_items=1, description="Experiments to include in report")
    report_type: str = Field("comprehensive", regex="^(comprehensive|performance|efficiency|comparison|recommendations)$", description="Type of report")
    include_visualizations: bool = Field(True, description="Include visualizations")
    time_period_days: Optional[int] = Field(None, ge=1, le=365, description="Time period for analysis")
    custom_sections: Optional[List[str]] = Field(None, description="Custom report sections")
    output_format: str = Field("json", regex="^(json|html|pdf)$", description="Output format")


class AutomatedReportResponse(BaseSchema):
    """Schema for automated report responses."""
    report_id: str = Field(..., description="Report ID")
    generated_at: datetime = Field(..., description="Generation timestamp")
    report_type: str = Field(..., description="Report type")
    experiments_analyzed: List[str] = Field(..., description="Analyzed experiments")
    
    # Report content
    summary: Dict[str, Any] = Field(default_factory=dict, description="Executive summary")
    sections: Dict[str, Any] = Field(default_factory=dict, description="Report sections")
    
    # Metadata
    generation_time_seconds: Optional[float] = Field(None, description="Report generation time")
    total_pages: Optional[int] = Field(None, description="Total pages (if applicable)")


class PlatformAnalytics(BaseSchema):
    """Schema for platform analytics."""
    platform_summary: Dict[str, Any] = Field(default_factory=dict, description="Platform summary")
    experiment_distribution: Dict[str, Any] = Field(default_factory=dict, description="Experiment distribution")
    resource_utilization: Dict[str, Any] = Field(default_factory=dict, description="Resource utilization")
    collaboration_stats: Dict[str, Any] = Field(default_factory=dict, description="Collaboration statistics")
    lineage_stats: Dict[str, Any] = Field(default_factory=dict, description="Lineage statistics")
    performance_trends: Dict[str, Any] = Field(default_factory=dict, description="Performance trends")
    timestamp: datetime = Field(..., description="Analytics timestamp")


# ===========================
# Advanced Model Serving Schemas
# ===========================

class ServingEndpointStatus(str, Enum):
    """Serving endpoint status options."""
    PENDING = "pending"
    ACTIVE = "active"
    INACTIVE = "inactive"
    FAILED = "failed"
    SCALING = "scaling"
    UPDATING = "updating"


class ServingProtocol(str, Enum):
    """Serving protocol options."""
    HTTP = "http"
    GRPC = "grpc"
    WEBSOCKET = "websocket"


class ComputeBackend(str, Enum):
    """Compute backend options."""
    KUBERNETES = "kubernetes"
    DOCKER = "docker"
    SERVERLESS = "serverless"
    CLOUD_RUN = "cloud_run"
    AWS_LAMBDA = "aws_lambda"


class InstanceType(str, Enum):
    """Instance type options."""
    CPU_OPTIMIZED = "cpu-optimized"
    GPU_ENABLED = "gpu-enabled"
    MEMORY_OPTIMIZED = "memory-optimized"
    BALANCED = "balanced"


class TrafficSplitStrategy(str, Enum):
    """Traffic split strategy options."""
    RANDOM = "random"
    USER_BASED = "user_based"
    GEOGRAPHIC = "geographic"
    DEVICE_TYPE = "device_type"
    AB_TESTING = "ab_testing"


class InferenceType(str, Enum):
    """Inference type options."""
    REAL_TIME = "real_time"
    BATCH = "batch"
    STREAMING = "streaming"
    ASYNC_CALLBACK = "async_callback"


class BatchJobStatus(str, Enum):
    """Batch job status options."""
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"


class AlertSeverity(str, Enum):
    """Alert severity levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# Serving Endpoint Schemas
class ServingEndpointCreate(BaseSchema):
    """Schema for creating a serving endpoint."""
    name: str = Field(..., min_length=1, max_length=200, description="Endpoint name")
    model_id: str = Field(..., description="Model ID to serve")
    deployment_id: Optional[str] = Field(None, description="Specific deployment ID")
    
    # Infrastructure configuration
    compute_backend: ComputeBackend = Field(ComputeBackend.KUBERNETES, description="Compute backend")
    instance_type: InstanceType = Field(InstanceType.CPU_OPTIMIZED, description="Instance type")
    min_replicas: int = Field(1, ge=1, le=100, description="Minimum replicas")
    max_replicas: int = Field(10, ge=1, le=1000, description="Maximum replicas")
    target_cpu_utilization: int = Field(70, ge=10, le=95, description="Target CPU utilization %")
    target_memory_utilization: int = Field(80, ge=10, le=95, description="Target memory utilization %")
    
    # Performance configuration  
    batch_size: int = Field(1, ge=1, le=1000, description="Batch size for inference")
    max_batch_delay_ms: int = Field(100, ge=0, le=10000, description="Max batch delay in ms")
    request_timeout_ms: int = Field(30000, ge=1000, le=300000, description="Request timeout in ms")
    concurrent_requests: int = Field(100, ge=1, le=10000, description="Max concurrent requests")
    
    # Circuit breaker configuration
    circuit_breaker_enabled: bool = Field(True, description="Enable circuit breaker")
    failure_threshold: int = Field(5, ge=1, le=100, description="Failure threshold")
    recovery_timeout_ms: int = Field(60000, ge=1000, le=600000, description="Recovery timeout in ms")
    
    # Caching configuration
    cache_enabled: bool = Field(True, description="Enable response caching")
    cache_ttl_seconds: int = Field(300, ge=0, le=86400, description="Cache TTL in seconds")
    cache_size_mb: int = Field(512, ge=0, le=10240, description="Cache size in MB")
    
    # Security configuration
    authentication_required: bool = Field(True, description="Require authentication")
    api_key_required: bool = Field(True, description="Require API key")
    rate_limit_rpm: int = Field(1000, ge=1, le=100000, description="Rate limit per minute")
    allowed_origins: Optional[List[str]] = Field(None, description="Allowed CORS origins")
    
    # Additional configuration
    configuration: Optional[Dict[str, Any]] = Field(None, description="Additional configuration")

    @validator('name')
    def validate_name(cls, v):
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Name can only contain letters, numbers, underscores, and hyphens')
        return v


class ServingEndpointUpdate(BaseSchema):
    """Schema for updating a serving endpoint."""
    name: Optional[str] = Field(None, min_length=1, max_length=200, description="Endpoint name")
    
    # Infrastructure configuration
    min_replicas: Optional[int] = Field(None, ge=1, le=100, description="Minimum replicas")
    max_replicas: Optional[int] = Field(None, ge=1, le=1000, description="Maximum replicas")
    target_cpu_utilization: Optional[int] = Field(None, ge=10, le=95, description="Target CPU utilization %")
    target_memory_utilization: Optional[int] = Field(None, ge=10, le=95, description="Target memory utilization %")
    
    # Performance configuration
    batch_size: Optional[int] = Field(None, ge=1, le=1000, description="Batch size for inference")
    max_batch_delay_ms: Optional[int] = Field(None, ge=0, le=10000, description="Max batch delay in ms")
    request_timeout_ms: Optional[int] = Field(None, ge=1000, le=300000, description="Request timeout in ms")
    concurrent_requests: Optional[int] = Field(None, ge=1, le=10000, description="Max concurrent requests")
    
    # Circuit breaker configuration
    circuit_breaker_enabled: Optional[bool] = Field(None, description="Enable circuit breaker")
    failure_threshold: Optional[int] = Field(None, ge=1, le=100, description="Failure threshold")
    recovery_timeout_ms: Optional[int] = Field(None, ge=1000, le=600000, description="Recovery timeout in ms")
    
    # Caching configuration
    cache_enabled: Optional[bool] = Field(None, description="Enable response caching")
    cache_ttl_seconds: Optional[int] = Field(None, ge=0, le=86400, description="Cache TTL in seconds")
    cache_size_mb: Optional[int] = Field(None, ge=0, le=10240, description="Cache size in MB")
    
    # Security configuration
    authentication_required: Optional[bool] = Field(None, description="Require authentication")
    api_key_required: Optional[bool] = Field(None, description="Require API key")
    rate_limit_rpm: Optional[int] = Field(None, ge=1, le=100000, description="Rate limit per minute")
    allowed_origins: Optional[List[str]] = Field(None, description="Allowed CORS origins")
    
    # Additional configuration
    configuration: Optional[Dict[str, Any]] = Field(None, description="Additional configuration")

    @validator('name')
    def validate_name(cls, v):
        if v and not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Name can only contain letters, numbers, underscores, and hyphens')
        return v


class ServingEndpointResponse(BaseSchema):
    """Schema for serving endpoint response."""
    id: int = Field(..., description="Database ID")
    endpoint_id: str = Field(..., description="Unique endpoint ID")
    name: str = Field(..., description="Endpoint name")
    model_id: str = Field(..., description="Model ID")
    deployment_id: str = Field(..., description="Deployment ID")
    
    # Endpoint configuration
    endpoint_url: str = Field(..., description="Endpoint URL")
    api_version: str = Field(..., description="API version")
    protocol: str = Field(..., description="Protocol")
    port: int = Field(..., description="Port number")
    
    # Infrastructure configuration
    compute_backend: str = Field(..., description="Compute backend")
    instance_type: Optional[str] = Field(None, description="Instance type")
    min_replicas: int = Field(..., description="Minimum replicas")
    max_replicas: int = Field(..., description="Maximum replicas")
    target_cpu_utilization: int = Field(..., description="Target CPU utilization")
    target_memory_utilization: int = Field(..., description="Target memory utilization")
    
    # Performance configuration
    batch_size: int = Field(..., description="Batch size")
    max_batch_delay_ms: int = Field(..., description="Max batch delay")
    request_timeout_ms: int = Field(..., description="Request timeout")
    concurrent_requests: int = Field(..., description="Max concurrent requests")
    
    # Status and health
    status: str = Field(..., description="Endpoint status")
    health_status: str = Field(..., description="Health status")
    last_health_check: Optional[datetime] = Field(None, description="Last health check")
    
    # Performance metrics
    total_requests: int = Field(..., description="Total requests")
    successful_requests: int = Field(..., description="Successful requests")
    failed_requests: int = Field(..., description="Failed requests")
    avg_response_time_ms: float = Field(..., description="Average response time")
    p95_response_time_ms: float = Field(..., description="P95 response time")
    p99_response_time_ms: float = Field(..., description="P99 response time")
    throughput_rps: float = Field(..., description="Throughput in RPS")
    success_rate: float = Field(..., description="Success rate percentage")
    
    # Cost tracking
    estimated_hourly_cost: float = Field(..., description="Estimated hourly cost")
    total_compute_hours: float = Field(..., description="Total compute hours")
    
    # Timestamps
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    activated_at: Optional[datetime] = Field(None, description="Activation timestamp")


class PredictionRequest(BaseSchema):
    """Schema for real-time prediction request."""
    instances: List[Dict[str, Any]] = Field(..., min_items=1, max_items=1000, description="Input instances for prediction")
    parameters: Optional[Dict[str, Any]] = Field(None, description="Additional prediction parameters")
    explanation: bool = Field(False, description="Include prediction explanations")
    confidence_threshold: Optional[float] = Field(None, ge=0.0, le=1.0, description="Minimum confidence threshold")
    
    # Request metadata
    request_id: Optional[str] = Field(None, description="Client request ID for tracking")
    timeout_ms: Optional[int] = Field(None, ge=100, le=60000, description="Request timeout override")
    
    @validator('instances')
    def validate_instances(cls, v):
        if not v:
            raise ValueError('At least one instance is required')
        return v


class PredictionResponse(BaseSchema):
    """Schema for real-time prediction response."""
    predictions: List[Dict[str, Any]] = Field(..., description="Prediction results")
    
    # Metadata
    model_id: str = Field(..., description="Model ID used for prediction")
    model_version: Optional[str] = Field(None, description="Model version")
    endpoint_id: str = Field(..., description="Endpoint ID")
    request_id: Optional[str] = Field(None, description="Request ID")
    
    # Performance metadata
    prediction_time_ms: float = Field(..., description="Prediction time in milliseconds")
    processing_time_ms: float = Field(..., description="Total processing time")
    batch_size: int = Field(..., description="Batch size processed")
    
    # Quality metadata
    confidence_scores: Optional[List[float]] = Field(None, description="Confidence scores for predictions")
    explanations: Optional[List[Dict[str, Any]]] = Field(None, description="Prediction explanations")
    feature_importance: Optional[Dict[str, float]] = Field(None, description="Feature importance scores")
    
    # Caching metadata
    cached_response: bool = Field(False, description="Whether response was cached")
    cache_key: Optional[str] = Field(None, description="Cache key used")
    
    # Timestamp
    timestamp: datetime = Field(..., description="Prediction timestamp")


class BatchPredictionRequest(BaseSchema):
    """Schema for batch prediction request."""
    name: str = Field(..., min_length=1, max_length=200, description="Job name")
    model_id: str = Field(..., description="Model ID to use for prediction")
    
    # Input configuration
    input_source_type: str = Field(..., description="Input source type")
    input_source_config: Dict[str, Any] = Field(..., description="Input source configuration")
    input_format: str = Field("json", description="Input format")
    
    # Output configuration
    output_destination_type: str = Field(..., description="Output destination type")
    output_destination_config: Dict[str, Any] = Field(..., description="Output destination configuration")
    output_format: str = Field("json", description="Output format")
    
    # Processing configuration
    batch_size: int = Field(1000, ge=1, le=10000, description="Processing batch size")
    max_parallel_batches: int = Field(5, ge=1, le=20, description="Max parallel batches")
    retry_count: int = Field(3, ge=0, le=10, description="Retry count for failed batches")
    timeout_minutes: int = Field(60, ge=1, le=1440, description="Job timeout in minutes")
    
    # Callback configuration
    callback_url: Optional[str] = Field(None, description="Callback URL for completion notification")
    callback_headers: Optional[Dict[str, str]] = Field(None, description="Headers for callback request")
    
    # Error handling
    error_threshold_percent: float = Field(5.0, ge=0.0, le=100.0, description="Fail job if error rate exceeds this")
    
    # Additional parameters
    job_parameters: Optional[Dict[str, Any]] = Field(None, description="Additional job parameters")
    labels: Optional[Dict[str, str]] = Field(None, description="Job labels")
    
    @validator('name')
    def validate_name(cls, v):
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Name can only contain letters, numbers, underscores, and hyphens')
        return v


class BatchPredictionResponse(BaseSchema):
    """Schema for batch prediction response."""
    id: int = Field(..., description="Database ID")
    job_id: str = Field(..., description="Unique job ID")
    name: str = Field(..., description="Job name")
    model_id: str = Field(..., description="Model ID")
    
    # Job status and progress
    status: str = Field(..., description="Job status")
    progress_percent: float = Field(..., description="Progress percentage")
    total_records: int = Field(..., description="Total records to process")
    processed_records: int = Field(..., description="Records processed")
    successful_predictions: int = Field(..., description="Successful predictions")
    failed_predictions: int = Field(..., description="Failed predictions")
    success_rate: float = Field(..., description="Success rate percentage")
    
    # Performance metrics
    avg_prediction_time_ms: float = Field(..., description="Average prediction time")
    total_processing_time_seconds: int = Field(..., description="Total processing time")
    throughput_records_per_second: float = Field(..., description="Processing throughput")
    
    # Error details
    error_count: int = Field(..., description="Total error count")
    error_details: Optional[Dict[str, Any]] = Field(None, description="Error details")
    
    # Cost tracking
    estimated_cost_usd: float = Field(..., description="Estimated cost")
    actual_cost_usd: float = Field(..., description="Actual cost")
    
    # Timestamps
    created_at: datetime = Field(..., description="Creation timestamp")
    started_at: Optional[datetime] = Field(None, description="Start timestamp")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")


class CanaryDeploymentCreate(BaseSchema):
    """Schema for creating a canary deployment."""
    name: str = Field(..., min_length=1, max_length=200, description="Canary deployment name")
    baseline_deployment_id: str = Field(..., description="Baseline deployment ID")
    canary_deployment_id: str = Field(..., description="Canary deployment ID")
    
    # Traffic routing configuration
    traffic_split_percent: float = Field(5.0, ge=1.0, le=50.0, description="Traffic percentage to canary")
    traffic_split_strategy: TrafficSplitStrategy = Field(TrafficSplitStrategy.RANDOM, description="Traffic split strategy")
    routing_rules: Optional[Dict[str, Any]] = Field(None, description="Additional routing rules")
    
    # Success criteria
    success_criteria: Dict[str, Any] = Field(..., description="Success criteria thresholds")
    min_sample_size: int = Field(100, ge=10, le=10000, description="Minimum sample size")
    evaluation_period_minutes: int = Field(60, ge=5, le=1440, description="Evaluation period")
    
    # Rollback configuration
    auto_rollback_enabled: bool = Field(True, description="Enable automatic rollback")
    rollback_threshold_error_rate: float = Field(5.0, ge=0.1, le=50.0, description="Rollback error rate threshold")
    rollback_threshold_latency_ms: float = Field(2000.0, ge=100.0, le=60000.0, description="Rollback latency threshold")
    rollback_evaluation_window_minutes: int = Field(10, ge=1, le=60, description="Rollback evaluation window")
    
    # Statistical analysis
    statistical_test: str = Field("chi_squared", description="Statistical test to use")
    significance_level: float = Field(0.05, ge=0.01, le=0.1, description="Statistical significance level")
    
    # Additional configuration
    configuration: Optional[Dict[str, Any]] = Field(None, description="Additional configuration")

    @validator('name')
    def validate_name(cls, v):
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Name can only contain letters, numbers, underscores, and hyphens')
        return v


class CanaryDeploymentResponse(BaseSchema):
    """Schema for canary deployment response."""
    id: int = Field(..., description="Database ID")
    canary_id: str = Field(..., description="Unique canary ID")
    name: str = Field(..., description="Canary deployment name")
    
    # Model deployments
    baseline_deployment_id: str = Field(..., description="Baseline deployment ID")
    canary_deployment_id: str = Field(..., description="Canary deployment ID")
    
    # Traffic routing
    traffic_split_percent: float = Field(..., description="Configured traffic split")
    current_traffic_percent: float = Field(..., description="Current traffic split")
    traffic_split_strategy: str = Field(..., description="Traffic split strategy")
    
    # Status and progress
    status: str = Field(..., description="Canary deployment status")
    evaluation_results: Optional[Dict[str, Any]] = Field(None, description="Evaluation results")
    
    # Statistical analysis
    statistical_test: str = Field(..., description="Statistical test used")
    significance_level: float = Field(..., description="Significance level")
    p_value: Optional[float] = Field(None, description="Statistical p-value")
    confidence_interval: Optional[Dict[str, Any]] = Field(None, description="Confidence intervals")
    
    # Performance comparison
    baseline_metrics: Optional[Dict[str, Any]] = Field(None, description="Baseline metrics")
    canary_metrics: Optional[Dict[str, Any]] = Field(None, description="Canary metrics")
    improvement_percent: Optional[float] = Field(None, description="Performance improvement")
    
    # Duration
    duration_minutes: float = Field(..., description="Deployment duration")
    
    # Timestamps
    created_at: datetime = Field(..., description="Creation timestamp")
    started_at: Optional[datetime] = Field(None, description="Start timestamp")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")
    rolled_back_at: Optional[datetime] = Field(None, description="Rollback timestamp")


class ServingMetricsResponse(BaseSchema):
    """Schema for serving metrics response."""
    endpoint_id: str = Field(..., description="Endpoint ID")
    model_id: str = Field(..., description="Model ID")
    timestamp: datetime = Field(..., description="Metrics timestamp")
    
    # Request metrics
    request_count: int = Field(..., description="Total requests")
    successful_requests: int = Field(..., description="Successful requests")
    failed_requests: int = Field(..., description="Failed requests")
    timeout_requests: int = Field(..., description="Timeout requests")
    
    # Latency metrics
    avg_response_time: float = Field(..., description="Average response time")
    min_response_time: float = Field(..., description="Minimum response time")
    max_response_time: float = Field(..., description="Maximum response time")
    p50_response_time: float = Field(..., description="P50 response time")
    p95_response_time: float = Field(..., description="P95 response time")
    p99_response_time: float = Field(..., description="P99 response time")
    
    # Throughput metrics
    throughput_rps: float = Field(..., description="Throughput in RPS")
    concurrent_requests: int = Field(..., description="Concurrent requests")
    queue_size: int = Field(..., description="Request queue size")
    
    # Resource utilization
    cpu_usage_percent: float = Field(..., description="CPU usage percentage")
    memory_usage_percent: float = Field(..., description="Memory usage percentage")
    gpu_usage_percent: float = Field(..., description="GPU usage percentage")
    disk_usage_percent: float = Field(..., description="Disk usage percentage")
    
    # Infrastructure metrics
    active_replicas: int = Field(..., description="Active replicas")
    scaling_events: int = Field(..., description="Scaling events")
    container_restarts: int = Field(..., description="Container restarts")
    
    # Business metrics
    data_drift_score: float = Field(..., description="Data drift score")
    model_accuracy: float = Field(..., description="Model accuracy")
    prediction_confidence: float = Field(..., description="Average prediction confidence")
    
    # Cache metrics
    cache_hit_rate: float = Field(..., description="Cache hit rate")
    cache_size_mb: float = Field(..., description="Cache size in MB")
    cache_evictions: int = Field(..., description="Cache evictions")
    
    # Error details
    error_types: Optional[Dict[str, int]] = Field(None, description="Error type counts")
    error_rate_percent: float = Field(..., description="Error rate percentage")
    
    # Cost tracking
    compute_cost_usd: float = Field(..., description="Compute cost")
    data_transfer_cost_usd: float = Field(..., description="Data transfer cost")
    storage_cost_usd: float = Field(..., description="Storage cost")


class ModelServingAlertCreate(BaseSchema):
    """Schema for creating a model serving alert."""
    target_type: str = Field(..., description="Alert target type")
    target_id: str = Field(..., description="Target ID")
    alert_type: str = Field(..., description="Alert type")
    alert_name: str = Field(..., min_length=1, max_length=200, description="Alert name")
    description: Optional[str] = Field(None, description="Alert description")
    
    # Threshold configuration
    metric_name: str = Field(..., description="Metric name to monitor")
    threshold_value: float = Field(..., description="Threshold value")
    threshold_operator: str = Field(..., description="Threshold operator")
    evaluation_window_minutes: int = Field(5, ge=1, le=1440, description="Evaluation window")
    
    # Alert severity
    severity: AlertSeverity = Field(AlertSeverity.MEDIUM, description="Alert severity")
    priority: int = Field(3, ge=1, le=5, description="Alert priority")
    
    # Notification configuration
    notification_channels: List[Dict[str, Any]] = Field(..., description="Notification channels")
    notification_frequency_minutes: int = Field(15, ge=1, le=1440, description="Notification frequency")
    suppress_duration_minutes: int = Field(60, ge=1, le=1440, description="Alert suppression duration")
    
    # Additional configuration
    additional_conditions: Optional[Dict[str, Any]] = Field(None, description="Additional conditions")
    alert_rules: Optional[Dict[str, Any]] = Field(None, description="Alert rules")
    tags: Optional[Dict[str, str]] = Field(None, description="Alert tags")

    @validator('threshold_operator')
    def validate_operator(cls, v):
        valid_operators = ['>', '<', '>=', '<=', '==', '!=']
        if v not in valid_operators:
            raise ValueError(f'Operator must be one of: {valid_operators}')
        return v


class ModelServingAlertResponse(BaseSchema):
    """Schema for model serving alert response."""
    id: int = Field(..., description="Database ID")
    alert_id: str = Field(..., description="Unique alert ID")
    target_type: str = Field(..., description="Alert target type")
    target_id: str = Field(..., description="Target ID")
    alert_type: str = Field(..., description="Alert type")
    alert_name: str = Field(..., description="Alert name")
    description: Optional[str] = Field(None, description="Alert description")
    
    # Threshold configuration
    metric_name: str = Field(..., description="Metric name")
    threshold_value: float = Field(..., description="Threshold value")
    threshold_operator: str = Field(..., description="Threshold operator")
    evaluation_window_minutes: int = Field(..., description="Evaluation window")
    
    # Alert severity
    severity: str = Field(..., description="Alert severity")
    priority: int = Field(..., description="Alert priority")
    
    # Alert status
    is_active: bool = Field(..., description="Alert is active")
    last_triggered_at: Optional[datetime] = Field(None, description="Last triggered timestamp")
    trigger_count: int = Field(..., description="Total trigger count")
    
    # Timestamps
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


class ScalingRequest(BaseSchema):
    """Schema for manual scaling request."""
    min_replicas: Optional[int] = Field(None, ge=0, le=100, description="Minimum replicas")
    max_replicas: Optional[int] = Field(None, ge=1, le=1000, description="Maximum replicas")
    target_replicas: Optional[int] = Field(None, ge=1, le=1000, description="Target replicas (immediate)")
    
    # Scaling configuration
    scale_up_cooldown_seconds: Optional[int] = Field(None, ge=30, le=3600, description="Scale up cooldown")
    scale_down_cooldown_seconds: Optional[int] = Field(None, ge=30, le=3600, description="Scale down cooldown")
    
    # Resource thresholds
    target_cpu_utilization: Optional[int] = Field(None, ge=10, le=95, description="Target CPU utilization")
    target_memory_utilization: Optional[int] = Field(None, ge=10, le=95, description="Target memory utilization")
    
    @root_validator
    def validate_replicas(cls, values):
        min_replicas = values.get('min_replicas')
        max_replicas = values.get('max_replicas')
        target_replicas = values.get('target_replicas')
        
        if min_replicas is not None and max_replicas is not None:
            if min_replicas > max_replicas:
                raise ValueError('min_replicas cannot be greater than max_replicas')
        
        if target_replicas is not None:
            if min_replicas is not None and target_replicas < min_replicas:
                raise ValueError('target_replicas cannot be less than min_replicas')
            if max_replicas is not None and target_replicas > max_replicas:
                raise ValueError('target_replicas cannot be greater than max_replicas')
        
        return values


class ModelRollbackRequest(BaseSchema):
    """Schema for model rollback request."""
    target_deployment_id: Optional[str] = Field(None, description="Specific deployment to roll back to")
    rollback_reason: str = Field(..., min_length=1, description="Reason for rollback")
    immediate: bool = Field(False, description="Perform immediate rollback (bypass checks)")
    
    # Safety checks
    skip_health_checks: bool = Field(False, description="Skip health checks during rollback")
    skip_traffic_validation: bool = Field(False, description="Skip traffic validation")
    
    # Traffic management
    gradual_traffic_shift: bool = Field(True, description="Gradually shift traffic during rollback")
    traffic_shift_duration_minutes: int = Field(5, ge=1, le=60, description="Duration for traffic shift")


class EndpointHealthResponse(BaseSchema):
    """Schema for endpoint health response."""
    endpoint_id: str = Field(..., description="Endpoint ID")
    status: str = Field(..., description="Overall status")
    health_status: str = Field(..., description="Health status")
    last_health_check: Optional[datetime] = Field(None, description="Last health check")
    
    # Health checks
    health_checks: Dict[str, Any] = Field(..., description="Individual health check results")
    
    # Current metrics
    current_metrics: Dict[str, float] = Field(..., description="Current performance metrics")
    
    # Infrastructure status
    active_replicas: int = Field(..., description="Currently active replicas")
    desired_replicas: int = Field(..., description="Desired replicas")
    
    # Resource utilization
    resource_utilization: Dict[str, float] = Field(..., description="Current resource utilization")
    
    # Circuit breaker status
    circuit_breaker_status: str = Field(..., description="Circuit breaker status")
    recent_errors: List[Dict[str, Any]] = Field(..., description="Recent errors")
    
    # Timestamp
    timestamp: datetime = Field(..., description="Health check timestamp")