"""
Machine Learning models for Igris-engine SDK
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Union
from datetime import datetime
from enum import Enum

from .common import JobStatus


class MLTaskType(str, Enum):
    """Machine learning task types."""
    
    CLASSIFICATION = "classification"
    REGRESSION = "regression"
    CLUSTERING = "clustering"
    ANOMALY_DETECTION = "anomaly_detection"
    TIME_SERIES_FORECASTING = "time_series_forecasting"
    RECOMMENDATION = "recommendation"
    NATURAL_LANGUAGE_PROCESSING = "nlp"
    COMPUTER_VISION = "computer_vision"


class ModelType(str, Enum):
    """Supported model types."""
    
    LINEAR_REGRESSION = "linear_regression"
    LOGISTIC_REGRESSION = "logistic_regression"
    RANDOM_FOREST = "random_forest"
    GRADIENT_BOOSTING = "gradient_boosting"
    SVM = "svm"
    NEURAL_NETWORK = "neural_network"
    DEEP_LEARNING = "deep_learning"
    ENSEMBLE = "ensemble"


class TrainingStatus(str, Enum):
    """Training job status."""
    
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class MLPipelineConfig:
    """Machine learning pipeline configuration."""
    
    name: str
    task_type: MLTaskType
    model_type: ModelType
    target_column: str
    feature_columns: List[str] = field(default_factory=list)
    training_data_path: Optional[str] = None
    validation_split: float = 0.2
    test_split: float = 0.1
    hyperparameters: Dict[str, Any] = field(default_factory=dict)
    preprocessing_steps: List[Dict[str, Any]] = field(default_factory=list)
    evaluation_metrics: List[str] = field(default_factory=list)
    cross_validation_folds: int = 5
    auto_feature_selection: bool = True
    auto_hyperparameter_tuning: bool = True
    early_stopping: bool = True
    description: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API request."""
        return {
            "name": self.name,
            "task_type": self.task_type.value,
            "model_type": self.model_type.value,
            "target_column": self.target_column,
            "feature_columns": self.feature_columns,
            "training_data_path": self.training_data_path,
            "validation_split": self.validation_split,
            "test_split": self.test_split,
            "hyperparameters": self.hyperparameters,
            "preprocessing_steps": self.preprocessing_steps,
            "evaluation_metrics": self.evaluation_metrics,
            "cross_validation_folds": self.cross_validation_folds,
            "auto_feature_selection": self.auto_feature_selection,
            "auto_hyperparameter_tuning": self.auto_hyperparameter_tuning,
            "early_stopping": self.early_stopping,
            "description": self.description,
            "tags": self.tags
        }


@dataclass
class ModelMetrics:
    """Model evaluation metrics."""
    
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1_score: Optional[float] = None
    auc_roc: Optional[float] = None
    mse: Optional[float] = None
    rmse: Optional[float] = None
    mae: Optional[float] = None
    r2_score: Optional[float] = None
    confusion_matrix: Optional[List[List[int]]] = None
    classification_report: Optional[Dict[str, Any]] = None
    feature_importance: Optional[Dict[str, float]] = None
    custom_metrics: Dict[str, float] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "accuracy": self.accuracy,
            "precision": self.precision,
            "recall": self.recall,
            "f1_score": self.f1_score,
            "auc_roc": self.auc_roc,
            "mse": self.mse,
            "rmse": self.rmse,
            "mae": self.mae,
            "r2_score": self.r2_score,
            "confusion_matrix": self.confusion_matrix,
            "classification_report": self.classification_report,
            "feature_importance": self.feature_importance,
            "custom_metrics": self.custom_metrics
        }


@dataclass
class TrainingJob:
    """Machine learning training job."""
    
    job_id: str
    pipeline_id: str
    status: TrainingStatus
    progress_percentage: float = 0.0
    current_epoch: Optional[int] = None
    total_epochs: Optional[int] = None
    training_loss: Optional[float] = None
    validation_loss: Optional[float] = None
    best_score: Optional[float] = None
    training_time_seconds: float = 0.0
    estimated_time_remaining: Optional[float] = None
    model_path: Optional[str] = None
    metrics: Optional[ModelMetrics] = None
    logs: List[str] = field(default_factory=list)
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    @property
    def is_completed(self) -> bool:
        """Check if training is completed."""
        return self.status in (TrainingStatus.COMPLETED, TrainingStatus.FAILED, TrainingStatus.CANCELLED)
    
    @property
    def is_running(self) -> bool:
        """Check if training is running."""
        return self.status in (TrainingStatus.PENDING, TrainingStatus.RUNNING)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "job_id": self.job_id,
            "pipeline_id": self.pipeline_id,
            "status": self.status.value,
            "progress_percentage": self.progress_percentage,
            "current_epoch": self.current_epoch,
            "total_epochs": self.total_epochs,
            "training_loss": self.training_loss,
            "validation_loss": self.validation_loss,
            "best_score": self.best_score,
            "training_time_seconds": self.training_time_seconds,
            "estimated_time_remaining": self.estimated_time_remaining,
            "model_path": self.model_path,
            "metrics": self.metrics.to_dict() if self.metrics else None,
            "logs": self.logs,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None
        }


@dataclass
class MLPipelineResult:
    """Result of ML pipeline execution."""
    
    pipeline_id: str
    job_id: str
    status: TrainingStatus
    model_id: Optional[str] = None
    model_path: Optional[str] = None
    metrics: Optional[ModelMetrics] = None
    predictions: Optional[List[Any]] = None
    feature_importance: Optional[Dict[str, float]] = None
    hyperparameters_used: Dict[str, Any] = field(default_factory=dict)
    training_summary: Dict[str, Any] = field(default_factory=dict)
    artifacts: Dict[str, str] = field(default_factory=dict)  # artifact_name -> path
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "pipeline_id": self.pipeline_id,
            "job_id": self.job_id,
            "status": self.status.value,
            "model_id": self.model_id,
            "model_path": self.model_path,
            "metrics": self.metrics.to_dict() if self.metrics else None,
            "predictions": self.predictions,
            "feature_importance": self.feature_importance,
            "hyperparameters_used": self.hyperparameters_used,
            "training_summary": self.training_summary,
            "artifacts": self.artifacts
        }


@dataclass
class PredictionRequest:
    """Request for model prediction."""
    
    model_id: str
    input_data: Union[Dict[str, Any], List[Dict[str, Any]]]
    return_probabilities: bool = False
    explain_predictions: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API request."""
        return {
            "model_id": self.model_id,
            "input_data": self.input_data,
            "return_probabilities": self.return_probabilities,
            "explain_predictions": self.explain_predictions
        }


@dataclass
class PredictionResult:
    """Result of model prediction."""
    
    predictions: List[Any]
    probabilities: Optional[List[List[float]]] = None
    explanations: Optional[List[Dict[str, Any]]] = None
    model_version: Optional[str] = None
    prediction_time_ms: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "predictions": self.predictions,
            "probabilities": self.probabilities,
            "explanations": self.explanations,
            "model_version": self.model_version,
            "prediction_time_ms": self.prediction_time_ms
        }


@dataclass
class ModelInfo:
    """Information about a trained model."""
    
    model_id: str
    name: str
    model_type: ModelType
    task_type: MLTaskType
    version: str
    status: str
    accuracy: Optional[float] = None
    training_date: Optional[datetime] = None
    last_used: Optional[datetime] = None
    size_bytes: Optional[int] = None
    feature_columns: List[str] = field(default_factory=list)
    target_column: Optional[str] = None
    metrics: Optional[ModelMetrics] = None
    tags: List[str] = field(default_factory=list)
    description: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "model_id": self.model_id,
            "name": self.name,
            "model_type": self.model_type.value,
            "task_type": self.task_type.value,
            "version": self.version,
            "status": self.status,
            "accuracy": self.accuracy,
            "training_date": self.training_date.isoformat() if self.training_date else None,
            "last_used": self.last_used.isoformat() if self.last_used else None,
            "size_bytes": self.size_bytes,
            "feature_columns": self.feature_columns,
            "target_column": self.target_column,
            "metrics": self.metrics.to_dict() if self.metrics else None,
            "tags": self.tags,
            "description": self.description
        }