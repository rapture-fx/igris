"""
MLflow Integration Service

Comprehensive MLflow integration for enterprise-grade model lifecycle management.
Provides model registry management, experiment tracking, deployment integration,
artifact management, and seamless integration with existing AI services.

Features:
- Model Registry Management (versioning, lifecycle, metadata)
- Experiment Tracking (runs, metrics, parameters, artifacts)
- Model Deployment Integration (serving, monitoring, A/B testing)
- Artifact Management (models, datasets, pipelines, evaluations)
- Integration with existing AI services
- Production Features (validation, drift detection, rollback)
"""

import asyncio
import logging
import json
import os
import pickle
import shutil
import tempfile
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple, Union, Callable, Set
from dataclasses import dataclass, field, asdict
from enum import Enum
from contextlib import contextmanager, asynccontextmanager
import warnings
from functools import wraps, lru_cache
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
import threading
import time

# MLflow imports
try:
    import mlflow
    import mlflow.sklearn
    import mlflow.tensorflow
    import mlflow.pytorch
    import mlflow.xgboost
    import mlflow.lightgbm
    import mlflow.catboost
    import mlflow.spark
    import mlflow.pyfunc
    from mlflow import MlflowClient
    from mlflow.entities import ViewType, Experiment, Run
    from mlflow.models.signature import infer_signature
    from mlflow.tracking.artifact_utils import get_artifact_uri
    from mlflow.exceptions import MlflowException, RestException
    MLFLOW_AVAILABLE = True
except ImportError:
    MLFLOW_AVAILABLE = False
    warnings.warn("MLflow not installed. MLflow integration will be disabled.")

# Core ML libraries
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.model_selection import cross_val_score
from sklearn.metrics import (
    accuracy_score, precision_recall_fscore_support, roc_auc_score,
    mean_squared_error, r2_score, mean_absolute_error
)
from sklearn.pipeline import Pipeline

# Deep learning libraries
try:
    import tensorflow as tf
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False

try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

# Service imports
from .core.error_handling import handle_service_errors
from .monitoring_service import MonitoringService
from .confidence_scoring_engine import ConfidenceScoringEngine
from .smart_feature_engineering import SmartFeatureEngineeringService
from .active_learning_engine import ActiveLearningEngine
from .pattern_recognition_service import PatternRecognitionService
from ..core.config import settings
from ..core.redis_client import get_redis_client


# Configure logging
logger = logging.getLogger(__name__)


class ModelStage(Enum):
    """Model lifecycle stages"""
    STAGING = "Staging"
    PRODUCTION = "Production"
    ARCHIVED = "Archived"
    NONE = "None"


class ExperimentStatus(Enum):
    """Experiment status types"""
    ACTIVE = "ACTIVE"
    DELETED = "DELETED"


class ModelType(Enum):
    """Supported model types"""
    SKLEARN = "sklearn"
    TENSORFLOW = "tensorflow"
    PYTORCH = "pytorch"
    XGBOOST = "xgboost"
    LIGHTGBM = "lightgbm"
    CATBOOST = "catboost"
    PYFUNC = "pyfunc"
    CUSTOM = "custom"


class ArtifactType(Enum):
    """Artifact types for organization"""
    MODEL = "model"
    DATASET = "dataset"
    PIPELINE = "pipeline"
    EVALUATION = "evaluation"
    VISUALIZATION = "visualization"
    CONFIG = "config"
    FEATURE_STORE = "feature_store"
    PREPROCESSING = "preprocessing"


class DeploymentTarget(Enum):
    """Model deployment targets"""
    REST_API = "rest_api"
    BATCH = "batch"
    STREAMING = "streaming"
    EDGE = "edge"
    DOCKER = "docker"
    KUBERNETES = "kubernetes"


@dataclass
class ModelMetadata:
    """Model metadata structure"""
    name: str
    version: str
    stage: ModelStage
    description: Optional[str] = None
    tags: Dict[str, str] = field(default_factory=dict)
    metrics: Dict[str, float] = field(default_factory=dict)
    parameters: Dict[str, Any] = field(default_factory=dict)
    model_type: Optional[ModelType] = None
    created_timestamp: Optional[datetime] = None
    updated_timestamp: Optional[datetime] = None
    run_id: Optional[str] = None
    experiment_id: Optional[str] = None
    artifact_uri: Optional[str] = None
    signature: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        result = asdict(self)
        # Handle enum serialization
        result['stage'] = self.stage.value if self.stage else None
        result['model_type'] = self.model_type.value if self.model_type else None
        # Handle datetime serialization
        if self.created_timestamp:
            result['created_timestamp'] = self.created_timestamp.isoformat()
        if self.updated_timestamp:
            result['updated_timestamp'] = self.updated_timestamp.isoformat()
        return result


@dataclass
class ExperimentMetadata:
    """Experiment metadata structure"""
    experiment_id: str
    name: str
    artifact_location: str
    lifecycle_stage: ExperimentStatus
    tags: Dict[str, str] = field(default_factory=dict)
    creation_time: Optional[datetime] = None
    last_update_time: Optional[datetime] = None
    run_count: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        result = asdict(self)
        result['lifecycle_stage'] = self.lifecycle_stage.value
        if self.creation_time:
            result['creation_time'] = self.creation_time.isoformat()
        if self.last_update_time:
            result['last_update_time'] = self.last_update_time.isoformat()
        return result


@dataclass
class DeploymentConfig:
    """Model deployment configuration"""
    target: DeploymentTarget
    model_name: str
    model_version: str
    endpoint_name: Optional[str] = None
    replicas: int = 1
    cpu_request: str = "500m"
    memory_request: str = "1Gi"
    cpu_limit: str = "1000m"
    memory_limit: str = "2Gi"
    environment_vars: Dict[str, str] = field(default_factory=dict)
    health_check_path: str = "/health"
    batch_size: Optional[int] = None
    timeout_seconds: int = 30
    autoscaling_enabled: bool = False
    min_replicas: int = 1
    max_replicas: int = 10
    target_cpu_utilization: int = 70
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        result = asdict(self)
        result['target'] = self.target.value
        return result


@dataclass
class ModelPerformanceMetrics:
    """Model performance tracking"""
    model_name: str
    model_version: str
    timestamp: datetime
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1_score: Optional[float] = None
    auc_roc: Optional[float] = None
    mse: Optional[float] = None
    rmse: Optional[float] = None
    mae: Optional[float] = None
    r2: Optional[float] = None
    prediction_latency_ms: Optional[float] = None
    throughput_rps: Optional[float] = None
    error_rate: Optional[float] = None
    drift_score: Optional[float] = None
    data_quality_score: Optional[float] = None
    confidence_score: Optional[float] = None
    sample_count: int = 0
    custom_metrics: Dict[str, float] = field(default_factory=dict)


class MLflowIntegrationError(Exception):
    """Base exception for MLflow integration errors"""
    pass


class ModelRegistryError(MLflowIntegrationError):
    """Model registry related errors"""
    pass


class ExperimentTrackingError(MLflowIntegrationError):
    """Experiment tracking related errors"""
    pass


class DeploymentError(MLflowIntegrationError):
    """Model deployment related errors"""
    pass


class MLflowIntegrationService:
    """
    Comprehensive MLflow integration service for enterprise-grade model lifecycle management
    """
    
    def __init__(self, 
                 tracking_uri: Optional[str] = None,
                 registry_uri: Optional[str] = None,
                 artifact_root: Optional[str] = None,
                 enable_monitoring: bool = True,
                 redis_client = None):
        """
        Initialize MLflow integration service
        
        Args:
            tracking_uri: MLflow tracking server URI
            registry_uri: MLflow model registry URI  
            artifact_root: Root directory for artifacts
            enable_monitoring: Enable performance monitoring
            redis_client: Redis client for caching
        """
        self.tracking_uri = tracking_uri or os.getenv('MLFLOW_TRACKING_URI', 'sqlite:///mlflow.db')
        self.registry_uri = registry_uri or os.getenv('MLFLOW_REGISTRY_URI', self.tracking_uri)
        self.artifact_root = artifact_root or os.getenv('MLFLOW_ARTIFACT_ROOT', './mlflow-artifacts')
        self.enable_monitoring = enable_monitoring
        self.redis_client = redis_client or get_redis_client() if hasattr(settings, 'USE_REDIS_CACHE') and settings.USE_REDIS_CACHE else None
        
        # Initialize MLflow if available
        if MLFLOW_AVAILABLE:
            mlflow.set_tracking_uri(self.tracking_uri)
            mlflow.set_registry_uri(self.registry_uri)
            self.client = MlflowClient(tracking_uri=self.tracking_uri, registry_uri=self.registry_uri)
        else:
            self.client = None
            logger.warning("MLflow not available. Service will operate in mock mode.")
        
        # Initialize service dependencies
        self.monitoring_service = MonitoringService() if enable_monitoring else None
        self.confidence_engine = None  # Will be initialized lazily
        self.feature_engineering = None  # Will be initialized lazily
        self.active_learning = None  # Will be initialized lazily
        self.pattern_recognition = None  # Will be initialized lazily
        
        # Thread pool for async operations
        self._executor = ThreadPoolExecutor(max_workers=4)
        self._process_executor = ProcessPoolExecutor(max_workers=2)
        
        # Performance tracking
        self._model_performance_cache: Dict[str, List[ModelPerformanceMetrics]] = {}
        self._deployment_cache: Dict[str, DeploymentConfig] = {}
        
        # Ensure artifact directory exists
        Path(self.artifact_root).mkdir(parents=True, exist_ok=True)
        
        logger.info(f"MLflowIntegrationService initialized with tracking_uri: {self.tracking_uri}")
    
    def _lazy_init_services(self):
        """Lazy initialization of service dependencies"""
        if self.confidence_engine is None:
            try:
                self.confidence_engine = ConfidenceScoringEngine()
            except Exception as e:
                logger.warning(f"Could not initialize confidence engine: {e}")
                
        if self.feature_engineering is None:
            try:
                self.feature_engineering = SmartFeatureEngineeringService()
            except Exception as e:
                logger.warning(f"Could not initialize feature engineering: {e}")
                
        if self.active_learning is None:
            try:
                self.active_learning = ActiveLearningEngine()
            except Exception as e:
                logger.warning(f"Could not initialize active learning: {e}")
                
        if self.pattern_recognition is None:
            try:
                self.pattern_recognition = PatternRecognitionService()
            except Exception as e:
                logger.warning(f"Could not initialize pattern recognition: {e}")
    
    @handle_service_errors(MLflowIntegrationError)
    def _ensure_mlflow_available(self):
        """Ensure MLflow is available"""
        if not MLFLOW_AVAILABLE or self.client is None:
            raise MLflowIntegrationError("MLflow is not available. Please install mlflow package.")
    
    @contextmanager
    def _mlflow_context(self):
        """Context manager for MLflow operations"""
        if MLFLOW_AVAILABLE:
            original_tracking_uri = mlflow.get_tracking_uri()
            original_registry_uri = mlflow.get_registry_uri()
            try:
                mlflow.set_tracking_uri(self.tracking_uri)
                mlflow.set_registry_uri(self.registry_uri)
                yield
            finally:
                mlflow.set_tracking_uri(original_tracking_uri)
                mlflow.set_registry_uri(original_registry_uri)
        else:
            yield
    
    def _cache_key(self, *parts: str) -> str:
        """Generate cache key"""
        return f"mlflow:{':'.join(parts)}"
    
    def _get_cached(self, key: str) -> Optional[Any]:
        """Get cached value"""
        if self.redis_client:
            try:
                value = self.redis_client.get(key)
                return json.loads(value) if value else None
            except Exception as e:
                logger.warning(f"Cache get error: {e}")
        return None
    
    def _set_cached(self, key: str, value: Any, ttl: int = 3600):
        """Set cached value"""
        if self.redis_client:
            try:
                self.redis_client.setex(key, ttl, json.dumps(value, default=str))
            except Exception as e:
                logger.warning(f"Cache set error: {e}")
    
    def _detect_model_type(self, model: Any) -> ModelType:
        """Detect model type from model object"""
        if hasattr(model, 'fit') and hasattr(model, 'predict'):
            # Sklearn-like interface
            if hasattr(model, 'get_params'):
                return ModelType.SKLEARN
        
        if TF_AVAILABLE and isinstance(model, (tf.keras.Model, tf.keras.Sequential)):
            return ModelType.TENSORFLOW
            
        if TORCH_AVAILABLE and isinstance(model, nn.Module):
            return ModelType.PYTORCH
        
        # Check for specific ML libraries
        model_class_name = type(model).__name__
        if 'XGB' in model_class_name or 'xgb' in str(type(model)):
            return ModelType.XGBOOST
        elif 'LightGBM' in model_class_name or 'lgb' in str(type(model)):
            return ModelType.LIGHTGBM
        elif 'CatBoost' in model_class_name or 'catboost' in str(type(model)):
            return ModelType.CATBOOST
        
        return ModelType.CUSTOM
    
    # =============================================================================
    # MODEL REGISTRY MANAGEMENT
    # =============================================================================
    
    @handle_service_errors(ModelRegistryError)
    async def register_model(self,
                           model: Any,
                           model_name: str,
                           description: Optional[str] = None,
                           tags: Optional[Dict[str, str]] = None,
                           signature: Optional[Any] = None,
                           input_example: Optional[Any] = None,
                           pip_requirements: Optional[List[str]] = None,
                           extra_files: Optional[List[str]] = None,
                           registered_model_name: Optional[str] = None) -> ModelMetadata:
        """
        Register a model in MLflow model registry
        
        Args:
            model: Model object to register
            model_name: Name for the model
            description: Model description
            tags: Model tags
            signature: Model signature
            input_example: Input example for the model
            pip_requirements: Python package requirements
            extra_files: Additional files to include
            registered_model_name: Name in model registry (defaults to model_name)
            
        Returns:
            ModelMetadata: Registered model metadata
        """
        self._ensure_mlflow_available()
        
        registered_model_name = registered_model_name or model_name
        tags = tags or {}
        
        # Detect model type
        model_type = self._detect_model_type(model)
        tags['model_type'] = model_type.value
        
        # Auto-generate signature if not provided
        if signature is None and input_example is not None:
            try:
                signature = infer_signature(input_example, model.predict(input_example))
            except Exception as e:
                logger.warning(f"Could not infer signature: {e}")
        
        with self._mlflow_context():
            # Start a new MLflow run
            with mlflow.start_run() as run:
                run_id = run.info.run_id
                
                # Log model metadata
                mlflow.set_tags(tags)
                if description:
                    mlflow.set_tag("model_description", description)
                
                # Log the model based on its type
                model_uri = None
                if model_type == ModelType.SKLEARN:
                    mlflow.sklearn.log_model(
                        sk_model=model,
                        artifact_path="model",
                        signature=signature,
                        input_example=input_example,
                        pip_requirements=pip_requirements,
                        extra_files=extra_files,
                        registered_model_name=registered_model_name
                    )
                    model_uri = f"runs:/{run_id}/model"
                    
                elif model_type == ModelType.TENSORFLOW and TF_AVAILABLE:
                    mlflow.tensorflow.log_model(
                        tf_saved_model_dir=None,
                        tf_meta_graph_tags=None,
                        tf_signature_def_key=None,
                        artifact_path="model",
                        signature=signature,
                        input_example=input_example,
                        pip_requirements=pip_requirements,
                        registered_model_name=registered_model_name
                    )
                    model_uri = f"runs:/{run_id}/model"
                    
                elif model_type == ModelType.PYTORCH and TORCH_AVAILABLE:
                    mlflow.pytorch.log_model(
                        pytorch_model=model,
                        artifact_path="model",
                        signature=signature,
                        input_example=input_example,
                        pip_requirements=pip_requirements,
                        extra_files=extra_files,
                        registered_model_name=registered_model_name
                    )
                    model_uri = f"runs:/{run_id}/model"
                    
                else:
                    # Use pyfunc for custom models
                    mlflow.pyfunc.log_model(
                        artifact_path="model",
                        python_model=model,
                        signature=signature,
                        input_example=input_example,
                        pip_requirements=pip_requirements,
                        extra_files=extra_files,
                        registered_model_name=registered_model_name
                    )
                    model_uri = f"runs:/{run_id}/model"
                
                # Get the registered model version
                registered_model = self.client.get_registered_model(registered_model_name)
                latest_version = self.client.get_latest_versions(registered_model_name, stages=["None"])[0]
                
                # Create model metadata
                metadata = ModelMetadata(
                    name=registered_model_name,
                    version=latest_version.version,
                    stage=ModelStage.NONE,
                    description=description,
                    tags=tags,
                    model_type=model_type,
                    created_timestamp=datetime.now(),
                    updated_timestamp=datetime.now(),
                    run_id=run_id,
                    experiment_id=run.info.experiment_id,
                    artifact_uri=model_uri,
                    signature=signature.to_dict() if signature else None
                )
                
                # Cache the metadata
                cache_key = self._cache_key("model", registered_model_name, latest_version.version)
                self._set_cached(cache_key, metadata.to_dict())
                
                logger.info(f"Model {registered_model_name} v{latest_version.version} registered successfully")
                return metadata
    
    @handle_service_errors(ModelRegistryError)
    async def get_model_metadata(self, model_name: str, version: Optional[str] = None) -> Optional[ModelMetadata]:
        """
        Get model metadata from registry
        
        Args:
            model_name: Name of the model
            version: Model version (latest if None)
            
        Returns:
            ModelMetadata: Model metadata or None if not found
        """
        self._ensure_mlflow_available()
        
        # Try cache first
        if version:
            cache_key = self._cache_key("model", model_name, version)
            cached = self._get_cached(cache_key)
            if cached:
                # Convert back to ModelMetadata
                cached['stage'] = ModelStage(cached['stage']) if cached['stage'] else ModelStage.NONE
                cached['model_type'] = ModelType(cached['model_type']) if cached['model_type'] else None
                if cached.get('created_timestamp'):
                    cached['created_timestamp'] = datetime.fromisoformat(cached['created_timestamp'])
                if cached.get('updated_timestamp'):
                    cached['updated_timestamp'] = datetime.fromisoformat(cached['updated_timestamp'])
                return ModelMetadata(**cached)
        
        try:
            with self._mlflow_context():
                # Get model version
                if version:
                    model_version = self.client.get_model_version(model_name, version)
                else:
                    # Get latest version
                    latest_versions = self.client.get_latest_versions(model_name, stages=["None", "Staging", "Production"])
                    if not latest_versions:
                        return None
                    model_version = latest_versions[0]
                
                # Get run details
                run = self.client.get_run(model_version.run_id)
                
                # Create metadata
                metadata = ModelMetadata(
                    name=model_name,
                    version=model_version.version,
                    stage=ModelStage(model_version.current_stage),
                    description=model_version.description,
                    tags=model_version.tags,
                    model_type=ModelType(run.data.tags.get('model_type', 'custom')),
                    created_timestamp=datetime.fromtimestamp(model_version.creation_timestamp / 1000),
                    updated_timestamp=datetime.fromtimestamp(model_version.last_updated_timestamp / 1000),
                    run_id=model_version.run_id,
                    experiment_id=run.info.experiment_id,
                    artifact_uri=model_version.source,
                    metrics=run.data.metrics,
                    parameters=run.data.params
                )
                
                # Cache the metadata
                cache_key = self._cache_key("model", model_name, model_version.version)
                self._set_cached(cache_key, metadata.to_dict())
                
                return metadata
                
        except MlflowException as e:
            if "RESOURCE_DOES_NOT_EXIST" in str(e):
                return None
            raise ModelRegistryError(f"Failed to get model metadata: {e}")
    
    @handle_service_errors(ModelRegistryError)
    async def list_models(self, 
                         filter_string: Optional[str] = None,
                         max_results: int = 100,
                         order_by: List[str] = None) -> List[ModelMetadata]:
        """
        List registered models
        
        Args:
            filter_string: Filter string for models
            max_results: Maximum number of results
            order_by: Order by fields
            
        Returns:
            List[ModelMetadata]: List of model metadata
        """
        self._ensure_mlflow_available()
        
        try:
            with self._mlflow_context():
                registered_models = self.client.search_registered_models(
                    filter_string=filter_string,
                    max_results=max_results,
                    order_by=order_by
                )
                
                models = []
                for registered_model in registered_models:
                    # Get latest version for each model
                    latest_versions = self.client.get_latest_versions(
                        registered_model.name, 
                        stages=["None", "Staging", "Production"]
                    )
                    
                    if latest_versions:
                        model_version = latest_versions[0]
                        try:
                            run = self.client.get_run(model_version.run_id)
                            
                            metadata = ModelMetadata(
                                name=registered_model.name,
                                version=model_version.version,
                                stage=ModelStage(model_version.current_stage),
                                description=registered_model.description,
                                tags=registered_model.tags,
                                model_type=ModelType(run.data.tags.get('model_type', 'custom')),
                                created_timestamp=datetime.fromtimestamp(registered_model.creation_timestamp / 1000),
                                updated_timestamp=datetime.fromtimestamp(registered_model.last_updated_timestamp / 1000),
                                run_id=model_version.run_id,
                                artifact_uri=model_version.source
                            )
                            models.append(metadata)
                            
                        except Exception as e:
                            logger.warning(f"Could not get details for model {registered_model.name}: {e}")
                
                return models
                
        except MlflowException as e:
            raise ModelRegistryError(f"Failed to list models: {e}")
    
    @handle_service_errors(ModelRegistryError)
    async def transition_model_stage(self, 
                                   model_name: str, 
                                   version: str,
                                   stage: ModelStage,
                                   archive_existing_versions: bool = False) -> ModelMetadata:
        """
        Transition model to a different stage
        
        Args:
            model_name: Name of the model
            version: Model version
            stage: Target stage
            archive_existing_versions: Archive existing versions in target stage
            
        Returns:
            ModelMetadata: Updated model metadata
        """
        self._ensure_mlflow_available()
        
        try:
            with self._mlflow_context():
                # Transition the model
                model_version = self.client.transition_model_version_stage(
                    name=model_name,
                    version=version,
                    stage=stage.value,
                    archive_existing_versions=archive_existing_versions
                )
                
                # Clear cache for this model
                cache_key = self._cache_key("model", model_name, version)
                if self.redis_client:
                    self.redis_client.delete(cache_key)
                
                # Get updated metadata
                return await self.get_model_metadata(model_name, version)
                
        except MlflowException as e:
            raise ModelRegistryError(f"Failed to transition model stage: {e}")
    
    @handle_service_errors(ModelRegistryError)
    async def load_model(self, 
                        model_name: str, 
                        version: Optional[str] = None,
                        stage: Optional[ModelStage] = None) -> Any:
        """
        Load model from registry
        
        Args:
            model_name: Name of the model
            version: Model version
            stage: Model stage (if version not specified)
            
        Returns:
            Loaded model object
        """
        self._ensure_mlflow_available()
        
        try:
            with self._mlflow_context():
                if version:
                    model_uri = f"models:/{model_name}/{version}"
                elif stage:
                    model_uri = f"models:/{model_name}/{stage.value}"
                else:
                    model_uri = f"models:/{model_name}/latest"
                
                # Load model using appropriate method
                metadata = await self.get_model_metadata(model_name, version)
                if metadata and metadata.model_type:
                    if metadata.model_type == ModelType.SKLEARN:
                        return mlflow.sklearn.load_model(model_uri)
                    elif metadata.model_type == ModelType.TENSORFLOW and TF_AVAILABLE:
                        return mlflow.tensorflow.load_model(model_uri)
                    elif metadata.model_type == ModelType.PYTORCH and TORCH_AVAILABLE:
                        return mlflow.pytorch.load_model(model_uri)
                    elif metadata.model_type == ModelType.XGBOOST:
                        return mlflow.xgboost.load_model(model_uri)
                    elif metadata.model_type == ModelType.LIGHTGBM:
                        return mlflow.lightgbm.load_model(model_uri)
                    elif metadata.model_type == ModelType.CATBOOST:
                        return mlflow.catboost.load_model(model_uri)
                
                # Fallback to pyfunc
                return mlflow.pyfunc.load_model(model_uri)
                
        except MlflowException as e:
            raise ModelRegistryError(f"Failed to load model: {e}")
    
    # =============================================================================
    # EXPERIMENT TRACKING
    # =============================================================================
    
    @handle_service_errors(ExperimentTrackingError)
    async def create_experiment(self,
                              experiment_name: str,
                              artifact_location: Optional[str] = None,
                              tags: Optional[Dict[str, str]] = None) -> ExperimentMetadata:
        """
        Create a new experiment
        
        Args:
            experiment_name: Name of the experiment
            artifact_location: Artifact storage location
            tags: Experiment tags
            
        Returns:
            ExperimentMetadata: Created experiment metadata
        """
        self._ensure_mlflow_available()
        
        tags = tags or {}
        artifact_location = artifact_location or os.path.join(self.artifact_root, experiment_name)
        
        try:
            with self._mlflow_context():
                experiment_id = self.client.create_experiment(
                    name=experiment_name,
                    artifact_location=artifact_location,
                    tags=tags
                )
                
                experiment = self.client.get_experiment(experiment_id)
                
                metadata = ExperimentMetadata(
                    experiment_id=experiment_id,
                    name=experiment_name,
                    artifact_location=artifact_location,
                    lifecycle_stage=ExperimentStatus(experiment.lifecycle_stage),
                    tags=tags,
                    creation_time=datetime.fromtimestamp(experiment.creation_time / 1000),
                    last_update_time=datetime.fromtimestamp(experiment.last_update_time / 1000)
                )
                
                logger.info(f"Experiment {experiment_name} created with ID: {experiment_id}")
                return metadata
                
        except MlflowException as e:
            if "already exists" in str(e):
                # Get existing experiment
                experiment = self.client.get_experiment_by_name(experiment_name)
                return ExperimentMetadata(
                    experiment_id=experiment.experiment_id,
                    name=experiment_name,
                    artifact_location=experiment.artifact_location,
                    lifecycle_stage=ExperimentStatus(experiment.lifecycle_stage),
                    tags=experiment.tags,
                    creation_time=datetime.fromtimestamp(experiment.creation_time / 1000),
                    last_update_time=datetime.fromtimestamp(experiment.last_update_time / 1000)
                )
            raise ExperimentTrackingError(f"Failed to create experiment: {e}")
    
    @handle_service_errors(ExperimentTrackingError)
    async def get_experiment(self, experiment_name: str) -> Optional[ExperimentMetadata]:
        """
        Get experiment metadata
        
        Args:
            experiment_name: Name of the experiment
            
        Returns:
            ExperimentMetadata: Experiment metadata or None if not found
        """
        self._ensure_mlflow_available()
        
        try:
            with self._mlflow_context():
                experiment = self.client.get_experiment_by_name(experiment_name)
                if not experiment:
                    return None
                
                # Get run count
                runs = self.client.search_runs(
                    experiment_ids=[experiment.experiment_id],
                    max_results=1
                )
                
                return ExperimentMetadata(
                    experiment_id=experiment.experiment_id,
                    name=experiment.name,
                    artifact_location=experiment.artifact_location,
                    lifecycle_stage=ExperimentStatus(experiment.lifecycle_stage),
                    tags=experiment.tags,
                    creation_time=datetime.fromtimestamp(experiment.creation_time / 1000),
                    last_update_time=datetime.fromtimestamp(experiment.last_update_time / 1000),
                    run_count=len(runs)
                )
                
        except MlflowException as e:
            if "RESOURCE_DOES_NOT_EXIST" in str(e):
                return None
            raise ExperimentTrackingError(f"Failed to get experiment: {e}")
    
    @contextmanager
    def start_run(self,
                  experiment_name: Optional[str] = None,
                  run_name: Optional[str] = None,
                  nested: bool = False,
                  tags: Optional[Dict[str, str]] = None):
        """
        Context manager for MLflow runs
        
        Args:
            experiment_name: Name of the experiment
            run_name: Name of the run
            nested: Whether this is a nested run
            tags: Run tags
        """
        self._ensure_mlflow_available()
        
        with self._mlflow_context():
            if experiment_name:
                experiment = mlflow.get_experiment_by_name(experiment_name)
                if not experiment:
                    # Create experiment if it doesn't exist
                    asyncio.create_task(self.create_experiment(experiment_name))
                    experiment = mlflow.get_experiment_by_name(experiment_name)
                mlflow.set_experiment(experiment_name)
            
            with mlflow.start_run(run_name=run_name, nested=nested, tags=tags) as run:
                yield run
    
    @handle_service_errors(ExperimentTrackingError)
    async def log_metrics(self, metrics: Dict[str, float], step: Optional[int] = None):
        """Log metrics to current run"""
        self._ensure_mlflow_available()
        
        with self._mlflow_context():
            for name, value in metrics.items():
                mlflow.log_metric(name, value, step=step)
    
    @handle_service_errors(ExperimentTrackingError)
    async def log_parameters(self, params: Dict[str, Any]):
        """Log parameters to current run"""
        self._ensure_mlflow_available()
        
        with self._mlflow_context():
            mlflow.log_params(params)
    
    @handle_service_errors(ExperimentTrackingError) 
    async def log_artifact(self, artifact_path: str, artifact_name: Optional[str] = None):
        """Log artifact to current run"""
        self._ensure_mlflow_available()
        
        with self._mlflow_context():
            mlflow.log_artifact(artifact_path, artifact_name)
    
    @handle_service_errors(ExperimentTrackingError)
    async def log_model_with_signature(self,
                                     model: Any,
                                     artifact_path: str,
                                     X_sample: Optional[Any] = None,
                                     y_sample: Optional[Any] = None,
                                     **kwargs):
        """Log model with automatically inferred signature"""
        self._ensure_mlflow_available()
        
        # Infer signature if sample data provided
        signature = None
        if X_sample is not None:
            try:
                if y_sample is not None:
                    signature = infer_signature(X_sample, y_sample)
                else:
                    predictions = model.predict(X_sample)
                    signature = infer_signature(X_sample, predictions)
            except Exception as e:
                logger.warning(f"Could not infer signature: {e}")
        
        # Detect model type and log appropriately
        model_type = self._detect_model_type(model)
        
        with self._mlflow_context():
            if model_type == ModelType.SKLEARN:
                mlflow.sklearn.log_model(model, artifact_path, signature=signature, **kwargs)
            elif model_type == ModelType.TENSORFLOW and TF_AVAILABLE:
                mlflow.tensorflow.log_model(model, artifact_path, signature=signature, **kwargs)
            elif model_type == ModelType.PYTORCH and TORCH_AVAILABLE:
                mlflow.pytorch.log_model(model, artifact_path, signature=signature, **kwargs)
            else:
                mlflow.pyfunc.log_model(model, artifact_path, signature=signature, **kwargs)
    
    # =============================================================================
    # MODEL DEPLOYMENT INTEGRATION
    # =============================================================================
    
    @handle_service_errors(DeploymentError)
    async def prepare_model_deployment(self,
                                     model_name: str,
                                     version: str,
                                     deployment_config: DeploymentConfig) -> Dict[str, Any]:
        """
        Prepare model for deployment
        
        Args:
            model_name: Name of the model
            version: Model version
            deployment_config: Deployment configuration
            
        Returns:
            Dict with deployment artifacts and configuration
        """
        self._ensure_mlflow_available()
        
        # Get model metadata
        metadata = await self.get_model_metadata(model_name, version)
        if not metadata:
            raise DeploymentError(f"Model {model_name} v{version} not found")
        
        # Create deployment directory
        deployment_id = f"{model_name}-{version}-{uuid.uuid4().hex[:8]}"
        deployment_dir = Path(self.artifact_root) / "deployments" / deployment_id
        deployment_dir.mkdir(parents=True, exist_ok=True)
        
        try:
            with self._mlflow_context():
                # Download model artifacts
                model_uri = f"models:/{model_name}/{version}"
                local_model_path = mlflow.artifacts.download_artifacts(
                    artifact_uri=model_uri,
                    dst_path=str(deployment_dir)
                )
                
                # Generate deployment configuration files
                deployment_artifacts = {
                    "model_path": local_model_path,
                    "deployment_id": deployment_id,
                    "deployment_dir": str(deployment_dir),
                    "model_metadata": metadata.to_dict(),
                    "deployment_config": deployment_config.to_dict()
                }
                
                # Generate deployment-specific files based on target
                if deployment_config.target == DeploymentTarget.REST_API:
                    # Generate FastAPI service code
                    api_code = self._generate_rest_api_code(metadata, deployment_config)
                    api_file = deployment_dir / "api_service.py"
                    api_file.write_text(api_code)
                    deployment_artifacts["api_file"] = str(api_file)
                    
                    # Generate requirements.txt
                    requirements = self._generate_requirements(metadata)
                    requirements_file = deployment_dir / "requirements.txt"
                    requirements_file.write_text("\n".join(requirements))
                    deployment_artifacts["requirements_file"] = str(requirements_file)
                    
                elif deployment_config.target == DeploymentTarget.DOCKER:
                    # Generate Dockerfile
                    dockerfile_content = self._generate_dockerfile(metadata, deployment_config)
                    dockerfile = deployment_dir / "Dockerfile"
                    dockerfile.write_text(dockerfile_content)
                    deployment_artifacts["dockerfile"] = str(dockerfile)
                    
                elif deployment_config.target == DeploymentTarget.KUBERNETES:
                    # Generate Kubernetes manifests
                    k8s_manifests = self._generate_k8s_manifests(metadata, deployment_config)
                    for filename, content in k8s_manifests.items():
                        manifest_file = deployment_dir / filename
                        manifest_file.write_text(content)
                        deployment_artifacts[f"k8s_{filename}"] = str(manifest_file)
                
                # Cache deployment configuration
                self._deployment_cache[deployment_id] = deployment_config
                
                logger.info(f"Model deployment prepared: {deployment_id}")
                return deployment_artifacts
                
        except Exception as e:
            # Cleanup on failure
            if deployment_dir.exists():
                shutil.rmtree(deployment_dir)
            raise DeploymentError(f"Failed to prepare deployment: {e}")
    
    def _generate_rest_api_code(self, metadata: ModelMetadata, config: DeploymentConfig) -> str:
        """Generate FastAPI service code for model serving"""
        return f'''"""
Auto-generated MLflow model serving API
Model: {metadata.name} v{metadata.version}
Generated at: {datetime.now()}
"""

import mlflow
import mlflow.pyfunc
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="{metadata.name} Model API",
    description="MLflow model serving API",
    version="{metadata.version}"
)

# Load model
MODEL_URI = "./model"
model = None

@app.on_event("startup")
async def load_model():
    global model
    try:
        model = mlflow.pyfunc.load_model(MODEL_URI)
        logger.info("Model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load model: {{e}}")
        raise e

class PredictionRequest(BaseModel):
    data: List[Dict[str, Any]]
    
class PredictionResponse(BaseModel):
    predictions: List[Any]
    model_name: str = "{metadata.name}"
    model_version: str = "{metadata.version}"

@app.get("/health")
async def health_check():
    return {{"status": "healthy", "model_loaded": model is not None}}

@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        # Convert to DataFrame
        df = pd.DataFrame(request.data)
        
        # Make predictions
        predictions = model.predict(df)
        
        # Convert numpy arrays to lists for JSON serialization
        if isinstance(predictions, np.ndarray):
            predictions = predictions.tolist()
        elif not isinstance(predictions, list):
            predictions = [predictions]
        
        return PredictionResponse(predictions=predictions)
        
    except Exception as e:
        logger.error(f"Prediction error: {{e}}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/model/info")
async def model_info():
    return {{
        "name": "{metadata.name}",
        "version": "{metadata.version}",
        "stage": "{metadata.stage.value if metadata.stage else 'None'}",
        "model_type": "{metadata.model_type.value if metadata.model_type else 'unknown'}",
        "description": "{metadata.description or ''}"
    }}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "api_service:app",
        host="0.0.0.0", 
        port={config.environment_vars.get('PORT', 8000)},
        workers=1
    )
'''
    
    def _generate_requirements(self, metadata: ModelMetadata) -> List[str]:
        """Generate requirements.txt for model deployment"""
        base_requirements = [
            "mlflow",
            "fastapi",
            "uvicorn",
            "pandas",
            "numpy",
            "pydantic"
        ]
        
        if metadata.model_type:
            if metadata.model_type == ModelType.SKLEARN:
                base_requirements.append("scikit-learn")
            elif metadata.model_type == ModelType.TENSORFLOW:
                base_requirements.append("tensorflow")
            elif metadata.model_type == ModelType.PYTORCH:
                base_requirements.extend(["torch", "torchvision"])
            elif metadata.model_type == ModelType.XGBOOST:
                base_requirements.append("xgboost")
            elif metadata.model_type == ModelType.LIGHTGBM:
                base_requirements.append("lightgbm")
            elif metadata.model_type == ModelType.CATBOOST:
                base_requirements.append("catboost")
        
        return base_requirements
    
    def _generate_dockerfile(self, metadata: ModelMetadata, config: DeploymentConfig) -> str:
        """Generate Dockerfile for model deployment"""
        return f'''FROM python:3.9-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy model and API code
COPY . .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:8000/health || exit 1

# Run the application
CMD ["python", "api_service.py"]
'''
    
    def _generate_k8s_manifests(self, metadata: ModelMetadata, config: DeploymentConfig) -> Dict[str, str]:
        """Generate Kubernetes deployment manifests"""
        deployment_name = config.endpoint_name or f"{metadata.name}-{metadata.version}".lower()
        
        deployment_yaml = f'''apiVersion: apps/v1
kind: Deployment
metadata:
  name: {deployment_name}
  labels:
    app: {deployment_name}
    model: {metadata.name}
    version: {metadata.version}
spec:
  replicas: {config.replicas}
  selector:
    matchLabels:
      app: {deployment_name}
  template:
    metadata:
      labels:
        app: {deployment_name}
        model: {metadata.name}
        version: {metadata.version}
    spec:
      containers:
      - name: model-server
        image: {deployment_name}:latest
        ports:
        - containerPort: 8000
        resources:
          requests:
            cpu: {config.cpu_request}
            memory: {config.memory_request}
          limits:
            cpu: {config.cpu_limit}
            memory: {config.memory_limit}
        env:
        - name: MODEL_NAME
          value: {metadata.name}
        - name: MODEL_VERSION
          value: {metadata.version}
        livenessProbe:
          httpGet:
            path: {config.health_check_path}
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: {config.health_check_path}
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
'''
        
        service_yaml = f'''apiVersion: v1
kind: Service
metadata:
  name: {deployment_name}-service
  labels:
    app: {deployment_name}
spec:
  selector:
    app: {deployment_name}
  ports:
  - port: 80
    targetPort: 8000
    protocol: TCP
  type: ClusterIP
'''
        
        manifests = {
            "deployment.yaml": deployment_yaml,
            "service.yaml": service_yaml
        }
        
        # Add HPA if autoscaling is enabled
        if config.autoscaling_enabled:
            hpa_yaml = f'''apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {deployment_name}-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {deployment_name}
  minReplicas: {config.min_replicas}
  maxReplicas: {config.max_replicas}
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: {config.target_cpu_utilization}
'''
            manifests["hpa.yaml"] = hpa_yaml
        
        return manifests
    
    # =============================================================================
    # ARTIFACT MANAGEMENT
    # =============================================================================
    
    @handle_service_errors(MLflowIntegrationError)
    async def store_dataset_version(self,
                                  dataset: pd.DataFrame,
                                  dataset_name: str,
                                  version: Optional[str] = None,
                                  tags: Optional[Dict[str, str]] = None,
                                  description: Optional[str] = None) -> str:
        """
        Store and version dataset
        
        Args:
            dataset: Dataset to store
            dataset_name: Name of the dataset
            version: Version identifier
            tags: Dataset tags
            description: Dataset description
            
        Returns:
            str: Dataset artifact URI
        """
        version = version or datetime.now().strftime("%Y%m%d_%H%M%S")
        tags = tags or {}
        tags.update({
            "artifact_type": ArtifactType.DATASET.value,
            "dataset_name": dataset_name,
            "version": version,
            "rows": str(len(dataset)),
            "columns": str(len(dataset.columns))
        })
        
        with self._mlflow_context():
            with mlflow.start_run(run_name=f"{dataset_name}_v{version}", tags=tags) as run:
                if description:
                    mlflow.set_tag("description", description)
                
                # Log dataset statistics
                mlflow.log_metrics({
                    "row_count": len(dataset),
                    "column_count": len(dataset.columns),
                    "memory_usage_mb": dataset.memory_usage(deep=True).sum() / (1024 * 1024)
                })
                
                # Save dataset
                dataset_path = f"dataset_{dataset_name}_v{version}.parquet"
                temp_path = Path(tempfile.gettempdir()) / dataset_path
                dataset.to_parquet(temp_path, index=False)
                
                mlflow.log_artifact(str(temp_path), "dataset")
                
                # Cleanup temp file
                temp_path.unlink()
                
                artifact_uri = f"runs:/{run.info.run_id}/dataset/{dataset_path}"
                logger.info(f"Dataset {dataset_name} v{version} stored: {artifact_uri}")
                return artifact_uri
    
    @handle_service_errors(MLflowIntegrationError)
    async def store_pipeline_artifact(self,
                                    pipeline: Any,
                                    pipeline_name: str,
                                    version: Optional[str] = None,
                                    tags: Optional[Dict[str, str]] = None,
                                    description: Optional[str] = None) -> str:
        """
        Store pipeline artifact
        
        Args:
            pipeline: Pipeline object to store
            pipeline_name: Name of the pipeline
            version: Version identifier
            tags: Pipeline tags
            description: Pipeline description
            
        Returns:
            str: Pipeline artifact URI
        """
        version = version or datetime.now().strftime("%Y%m%d_%H%M%S")
        tags = tags or {}
        tags.update({
            "artifact_type": ArtifactType.PIPELINE.value,
            "pipeline_name": pipeline_name,
            "version": version,
            "pipeline_type": type(pipeline).__name__
        })
        
        with self._mlflow_context():
            with mlflow.start_run(run_name=f"{pipeline_name}_v{version}", tags=tags) as run:
                if description:
                    mlflow.set_tag("description", description)
                
                # Save pipeline
                pipeline_path = f"pipeline_{pipeline_name}_v{version}.pkl"
                temp_path = Path(tempfile.gettempdir()) / pipeline_path
                
                with open(temp_path, 'wb') as f:
                    pickle.dump(pipeline, f)
                
                mlflow.log_artifact(str(temp_path), "pipeline")
                
                # Cleanup temp file
                temp_path.unlink()
                
                artifact_uri = f"runs:/{run.info.run_id}/pipeline/{pipeline_path}"
                logger.info(f"Pipeline {pipeline_name} v{version} stored: {artifact_uri}")
                return artifact_uri
    
    @handle_service_errors(MLflowIntegrationError)
    async def load_dataset_version(self, dataset_name: str, version: str) -> pd.DataFrame:
        """Load specific dataset version"""
        # Search for dataset run
        with self._mlflow_context():
            runs = self.client.search_runs(
                experiment_ids=[exp.experiment_id for exp in self.client.search_experiments()],
                filter_string=f"tags.dataset_name = '{dataset_name}' and tags.version = '{version}'",
                max_results=1
            )
            
            if not runs:
                raise MLflowIntegrationError(f"Dataset {dataset_name} v{version} not found")
            
            run = runs[0]
            # Download and load dataset
            artifact_path = mlflow.artifacts.download_artifacts(
                artifact_uri=f"runs:/{run.info.run_id}/dataset",
                dst_path=tempfile.gettempdir()
            )
            
            # Find the parquet file
            dataset_files = list(Path(artifact_path).glob("*.parquet"))
            if not dataset_files:
                raise MLflowIntegrationError(f"Dataset file not found for {dataset_name} v{version}")
            
            return pd.read_parquet(dataset_files[0])
    
    # =============================================================================
    # INTEGRATION WITH EXISTING AI SERVICES
    # =============================================================================
    
    @handle_service_errors(MLflowIntegrationError)
    async def track_feature_engineering_experiment(self,
                                                 experiment_name: str,
                                                 dataset: pd.DataFrame,
                                                 target_column: Optional[str] = None,
                                                 feature_config: Optional[Dict[str, Any]] = None) -> str:
        """
        Track feature engineering experiment using smart feature engineering service
        
        Args:
            experiment_name: Name of the experiment
            dataset: Input dataset
            target_column: Target column name
            feature_config: Feature engineering configuration
            
        Returns:
            str: Run ID
        """
        self._lazy_init_services()
        
        if not self.feature_engineering:
            raise MLflowIntegrationError("Smart Feature Engineering service not available")
        
        # Create or get experiment
        await self.create_experiment(f"feature_engineering_{experiment_name}")
        
        with self.start_run(experiment_name=f"feature_engineering_{experiment_name}",
                          run_name=f"feature_eng_{datetime.now().strftime('%Y%m%d_%H%M%S')}") as run:
            
            # Log original dataset info
            await self.log_parameters({
                "dataset_rows": len(dataset),
                "dataset_cols": len(dataset.columns),
                "target_column": target_column or "None",
                "feature_config": json.dumps(feature_config) if feature_config else "None"
            })
            
            # Run feature engineering
            result = await self.feature_engineering.engineer_features(
                data=dataset,
                target_column=target_column,
                **(feature_config or {})
            )
            
            # Log feature engineering results
            await self.log_metrics({
                "original_features": len(dataset.columns),
                "generated_features": result['feature_count'],
                "feature_importance_mean": np.mean(list(result['feature_importance'].values())),
                "processing_time": result.get('processing_time', 0)
            })
            
            # Log feature importance
            mlflow.log_dict(result['feature_importance'], "feature_importance.json")
            
            # Store transformed dataset
            await self.store_dataset_version(
                dataset=result['transformed_data'],
                dataset_name=f"{experiment_name}_features",
                tags={
                    "experiment_type": "feature_engineering",
                    "original_experiment": experiment_name
                }
            )
            
            # Store feature engineering pipeline
            if 'pipeline' in result:
                await self.store_pipeline_artifact(
                    pipeline=result['pipeline'],
                    pipeline_name=f"{experiment_name}_feature_pipeline",
                    tags={
                        "experiment_type": "feature_engineering",
                        "original_experiment": experiment_name
                    }
                )
            
            logger.info(f"Feature engineering experiment tracked: {run.info.run_id}")
            return run.info.run_id
    
    @handle_service_errors(MLflowIntegrationError)
    async def track_confidence_scoring_experiment(self,
                                                experiment_name: str,
                                                model: Any,
                                                X_test: Any,
                                                y_test: Any,
                                                confidence_config: Optional[Dict[str, Any]] = None) -> str:
        """
        Track confidence scoring experiment
        
        Args:
            experiment_name: Name of the experiment
            model: Model to evaluate
            X_test: Test features
            y_test: Test targets
            confidence_config: Confidence scoring configuration
            
        Returns:
            str: Run ID
        """
        self._lazy_init_services()
        
        if not self.confidence_engine:
            raise MLflowIntegrationError("Confidence Scoring service not available")
        
        await self.create_experiment(f"confidence_scoring_{experiment_name}")
        
        with self.start_run(experiment_name=f"confidence_scoring_{experiment_name}",
                          run_name=f"confidence_{datetime.now().strftime('%Y%m%d_%H%M%S')}") as run:
            
            # Log configuration
            await self.log_parameters({
                "model_type": type(model).__name__,
                "test_samples": len(X_test),
                "confidence_config": json.dumps(confidence_config) if confidence_config else "None"
            })
            
            # Run confidence scoring
            confidence_results = await self.confidence_engine.assess_model_confidence(
                model=model,
                X=X_test,
                y_true=y_test,
                **(confidence_config or {})
            )
            
            # Log confidence metrics
            await self.log_metrics({
                "mean_confidence": float(confidence_results.confidence_score),
                "uncertainty_aleatoric": float(confidence_results.uncertainty_breakdown.get('aleatoric', 0)),
                "uncertainty_epistemic": float(confidence_results.uncertainty_breakdown.get('epistemic', 0)),
                "calibration_error": float(confidence_results.metrics.get('calibration_error', 0)),
                "reliability_score": float(confidence_results.metrics.get('reliability', 0))
            })
            
            # Store confidence results
            mlflow.log_dict(confidence_results.to_dict(), "confidence_results.json")
            
            logger.info(f"Confidence scoring experiment tracked: {run.info.run_id}")
            return run.info.run_id
    
    @handle_service_errors(MLflowIntegrationError)
    async def track_active_learning_experiment(self,
                                             experiment_name: str,
                                             initial_labeled: pd.DataFrame,
                                             unlabeled_pool: pd.DataFrame,
                                             target_column: str,
                                             query_strategy: str = "uncertainty",
                                             batch_size: int = 10,
                                             iterations: int = 5) -> str:
        """
        Track active learning experiment
        
        Args:
            experiment_name: Name of the experiment
            initial_labeled: Initial labeled data
            unlabeled_pool: Unlabeled data pool
            target_column: Target column name
            query_strategy: Query strategy to use
            batch_size: Batch size for labeling
            iterations: Number of active learning iterations
            
        Returns:
            str: Run ID
        """
        self._lazy_init_services()
        
        if not self.active_learning:
            raise MLflowIntegrationError("Active Learning service not available")
        
        await self.create_experiment(f"active_learning_{experiment_name}")
        
        with self.start_run(experiment_name=f"active_learning_{experiment_name}",
                          run_name=f"active_learning_{datetime.now().strftime('%Y%m%d_%H%M%S')}") as run:
            
            # Log configuration
            await self.log_parameters({
                "initial_labeled_size": len(initial_labeled),
                "unlabeled_pool_size": len(unlabeled_pool),
                "target_column": target_column,
                "query_strategy": query_strategy,
                "batch_size": batch_size,
                "max_iterations": iterations
            })
            
            # Initialize active learning session
            session_id = await self.active_learning.start_learning_session(
                initial_data=initial_labeled,
                target_column=target_column,
                query_strategy=query_strategy
            )
            
            # Track each iteration
            for iteration in range(iterations):
                # Query next batch
                query_result = await self.active_learning.query_samples(
                    session_id=session_id,
                    unlabeled_data=unlabeled_pool,
                    batch_size=batch_size
                )
                
                # Log iteration metrics
                await self.log_metrics({
                    f"iteration_{iteration}_uncertainty_mean": float(np.mean(query_result.get('uncertainty_scores', [0]))),
                    f"iteration_{iteration}_selected_samples": len(query_result.get('selected_indices', [])),
                    f"iteration_{iteration}_confidence": float(query_result.get('confidence', 0))
                }, step=iteration)
                
                # Simulate labeling (in practice, this would involve human feedback)
                # For demo purposes, we'll use existing labels if available
                selected_indices = query_result.get('selected_indices', [])
                if len(selected_indices) > 0 and target_column in unlabeled_pool.columns:
                    # Simulate adding labeled samples
                    new_labels = unlabeled_pool.iloc[selected_indices]
                    await self.active_learning.update_with_labels(
                        session_id=session_id,
                        newly_labeled_data=new_labels
                    )
            
            # Get final session results
            session_results = await self.active_learning.get_session_results(session_id)
            
            # Log final metrics
            await self.log_metrics({
                "final_labeled_size": session_results.get('total_labeled', 0),
                "total_queries": session_results.get('total_queries', 0),
                "final_model_score": session_results.get('model_performance', 0),
                "labeling_efficiency": session_results.get('labeling_efficiency', 0)
            })
            
            # Store session results
            mlflow.log_dict(session_results, "active_learning_results.json")
            
            logger.info(f"Active learning experiment tracked: {run.info.run_id}")
            return run.info.run_id
    
    # =============================================================================
    # PRODUCTION FEATURES
    # =============================================================================
    
    @handle_service_errors(MLflowIntegrationError)
    async def validate_model_for_production(self,
                                          model_name: str,
                                          version: str,
                                          validation_dataset: pd.DataFrame,
                                          target_column: str,
                                          performance_thresholds: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
        """
        Validate model for production deployment
        
        Args:
            model_name: Name of the model
            version: Model version
            validation_dataset: Validation dataset
            target_column: Target column name
            performance_thresholds: Performance thresholds to check
            
        Returns:
            Dict with validation results
        """
        performance_thresholds = performance_thresholds or {
            "accuracy": 0.8,
            "precision": 0.75,
            "recall": 0.75
        }
        
        # Load model
        model = await self.load_model(model_name, version)
        
        # Prepare data
        X_val = validation_dataset.drop(columns=[target_column])
        y_val = validation_dataset[target_column]
        
        # Make predictions
        y_pred = model.predict(X_val)
        
        # Calculate metrics
        if len(np.unique(y_val)) == 2:  # Binary classification
            accuracy = accuracy_score(y_val, y_pred)
            precision, recall, f1, _ = precision_recall_fscore_support(y_val, y_pred, average='binary')
            try:
                y_pred_proba = model.predict_proba(X_val)[:, 1]
                auc = roc_auc_score(y_val, y_pred_proba)
            except:
                auc = None
                
            metrics = {
                "accuracy": float(accuracy),
                "precision": float(precision),
                "recall": float(recall),
                "f1_score": float(f1),
                "auc_roc": float(auc) if auc else None
            }
        else:  # Regression or multiclass
            if np.issubdtype(y_val.dtype, np.number):  # Regression
                mse = mean_squared_error(y_val, y_pred)
                mae = mean_absolute_error(y_val, y_pred)
                r2 = r2_score(y_val, y_pred)
                metrics = {
                    "mse": float(mse),
                    "rmse": float(np.sqrt(mse)),
                    "mae": float(mae),
                    "r2": float(r2)
                }
            else:  # Multiclass
                accuracy = accuracy_score(y_val, y_pred)
                precision, recall, f1, _ = precision_recall_fscore_support(y_val, y_pred, average='macro')
                metrics = {
                    "accuracy": float(accuracy),
                    "precision": float(precision),
                    "recall": float(recall),
                    "f1_score": float(f1)
                }
        
        # Check thresholds
        validation_results = {
            "model_name": model_name,
            "model_version": version,
            "validation_timestamp": datetime.now().isoformat(),
            "metrics": metrics,
            "thresholds": performance_thresholds,
            "passed_validation": True,
            "failed_checks": []
        }
        
        # Check each threshold
        for metric, threshold in performance_thresholds.items():
            if metric in metrics and metrics[metric] is not None:
                if metrics[metric] < threshold:
                    validation_results["passed_validation"] = False
                    validation_results["failed_checks"].append({
                        "metric": metric,
                        "expected": threshold,
                        "actual": metrics[metric]
                    })
        
        # Log validation results
        await self.create_experiment(f"validation_{model_name}")
        with self.start_run(experiment_name=f"validation_{model_name}",
                          run_name=f"validation_{version}_{datetime.now().strftime('%Y%m%d_%H%M%S')}") as run:
            
            await self.log_parameters({
                "model_name": model_name,
                "model_version": version,
                "validation_samples": len(validation_dataset)
            })
            
            await self.log_metrics(metrics)
            
            mlflow.log_dict(validation_results, "validation_results.json")
        
        return validation_results
    
    @handle_service_errors(MLflowIntegrationError)
    async def monitor_model_performance(self,
                                      model_name: str,
                                      version: str,
                                      predictions: np.ndarray,
                                      actual_values: Optional[np.ndarray] = None,
                                      input_data: Optional[pd.DataFrame] = None,
                                      custom_metrics: Optional[Dict[str, float]] = None) -> ModelPerformanceMetrics:
        """
        Monitor model performance in production
        
        Args:
            model_name: Name of the model
            version: Model version
            predictions: Model predictions
            actual_values: Actual target values (if available)
            input_data: Input data for drift detection
            custom_metrics: Additional custom metrics
            
        Returns:
            ModelPerformanceMetrics: Performance metrics
        """
        timestamp = datetime.now()
        custom_metrics = custom_metrics or {}
        
        # Initialize metrics
        performance_metrics = ModelPerformanceMetrics(
            model_name=model_name,
            model_version=version,
            timestamp=timestamp,
            sample_count=len(predictions),
            custom_metrics=custom_metrics
        )
        
        # Calculate metrics if actual values are available
        if actual_values is not None:
            if len(np.unique(actual_values)) == 2:  # Binary classification
                performance_metrics.accuracy = float(accuracy_score(actual_values, predictions))
                precision, recall, f1, _ = precision_recall_fscore_support(actual_values, predictions, average='binary')
                performance_metrics.precision = float(precision)
                performance_metrics.recall = float(recall)
                performance_metrics.f1_score = float(f1)
                
            elif np.issubdtype(actual_values.dtype, np.number):  # Regression
                performance_metrics.mse = float(mean_squared_error(actual_values, predictions))
                performance_metrics.rmse = float(np.sqrt(performance_metrics.mse))
                performance_metrics.mae = float(mean_absolute_error(actual_values, predictions))
                performance_metrics.r2 = float(r2_score(actual_values, predictions))
        
        # Calculate drift score if input data is available
        if input_data is not None and hasattr(self, '_reference_data'):
            try:
                # Simple drift detection using statistical tests
                drift_scores = []
                for col in input_data.select_dtypes(include=[np.number]).columns:
                    if col in self._reference_data.columns:
                        from scipy.stats import ks_2samp
                        statistic, p_value = ks_2samp(
                            self._reference_data[col].values,
                            input_data[col].values
                        )
                        drift_scores.append(1 - p_value)  # Higher score means more drift
                
                if drift_scores:
                    performance_metrics.drift_score = float(np.mean(drift_scores))
            except Exception as e:
                logger.warning(f"Could not calculate drift score: {e}")
        
        # Calculate confidence score if confidence engine is available
        if self.confidence_engine and input_data is not None:
            try:
                model = await self.load_model(model_name, version)
                confidence_result = await self.confidence_engine.assess_prediction_confidence(
                    model=model,
                    X=input_data.values if hasattr(input_data, 'values') else input_data,
                    predictions=predictions
                )
                performance_metrics.confidence_score = float(confidence_result.confidence_score)
            except Exception as e:
                logger.warning(f"Could not calculate confidence score: {e}")
        
        # Store performance metrics
        model_key = f"{model_name}:{version}"
        if model_key not in self._model_performance_cache:
            self._model_performance_cache[model_key] = []
        self._model_performance_cache[model_key].append(performance_metrics)
        
        # Keep only recent metrics (last 1000 records)
        if len(self._model_performance_cache[model_key]) > 1000:
            self._model_performance_cache[model_key] = self._model_performance_cache[model_key][-1000:]
        
        # Log to MLflow if monitoring is enabled
        if self.monitoring_service:
            try:
                await self.create_experiment(f"monitoring_{model_name}")
                with self.start_run(experiment_name=f"monitoring_{model_name}",
                                  run_name=f"monitoring_{timestamp.strftime('%Y%m%d_%H%M%S')}") as run:
                    
                    # Log performance metrics
                    metrics_dict = {}
                    for field_name, field_value in performance_metrics.__dict__.items():
                        if field_value is not None and isinstance(field_value, (int, float)):
                            metrics_dict[field_name] = field_value
                    
                    await self.log_metrics(metrics_dict)
                    
                    # Log custom metrics
                    if custom_metrics:
                        await self.log_metrics(custom_metrics)
                    
            except Exception as e:
                logger.warning(f"Could not log monitoring metrics: {e}")
        
        return performance_metrics
    
    @handle_service_errors(MLflowIntegrationError)
    async def detect_model_drift(self,
                               model_name: str,
                               version: str,
                               current_data: pd.DataFrame,
                               reference_data: Optional[pd.DataFrame] = None,
                               threshold: float = 0.1) -> Dict[str, Any]:
        """
        Detect model drift using statistical tests
        
        Args:
            model_name: Name of the model
            version: Model version
            current_data: Current input data
            reference_data: Reference data for comparison
            threshold: Drift detection threshold
            
        Returns:
            Dict with drift detection results
        """
        if reference_data is None:
            # Try to load reference data from artifacts
            try:
                reference_data = await self.load_dataset_version(f"{model_name}_reference", "latest")
            except:
                logger.warning("No reference data available for drift detection")
                return {
                    "model_name": model_name,
                    "model_version": version,
                    "drift_detected": False,
                    "error": "No reference data available"
                }
        
        drift_results = {
            "model_name": model_name,
            "model_version": version,
            "timestamp": datetime.now().isoformat(),
            "drift_detected": False,
            "drift_score": 0.0,
            "feature_drift_scores": {},
            "drifted_features": []
        }
        
        try:
            from scipy.stats import ks_2samp, chi2_contingency
            
            drift_scores = []
            
            for col in current_data.columns:
                if col not in reference_data.columns:
                    continue
                
                if current_data[col].dtype in ['object', 'category']:
                    # Categorical feature - use chi-square test
                    try:
                        current_counts = current_data[col].value_counts()
                        ref_counts = reference_data[col].value_counts()
                        
                        # Align the counts
                        all_categories = set(current_counts.index) | set(ref_counts.index)
                        current_aligned = [current_counts.get(cat, 0) for cat in all_categories]
                        ref_aligned = [ref_counts.get(cat, 0) for cat in all_categories]
                        
                        chi2, p_value, dof, expected = chi2_contingency([current_aligned, ref_aligned])
                        drift_score = 1 - p_value
                        
                    except Exception as e:
                        logger.warning(f"Could not calculate drift for categorical feature {col}: {e}")
                        continue
                        
                else:
                    # Numerical feature - use Kolmogorov-Smirnov test
                    try:
                        statistic, p_value = ks_2samp(
                            reference_data[col].dropna().values,
                            current_data[col].dropna().values
                        )
                        drift_score = 1 - p_value
                        
                    except Exception as e:
                        logger.warning(f"Could not calculate drift for numerical feature {col}: {e}")
                        continue
                
                drift_results["feature_drift_scores"][col] = float(drift_score)
                drift_scores.append(drift_score)
                
                if drift_score > threshold:
                    drift_results["drifted_features"].append(col)
            
            # Overall drift score
            if drift_scores:
                drift_results["drift_score"] = float(np.mean(drift_scores))
                drift_results["drift_detected"] = drift_results["drift_score"] > threshold
            
            # Log drift detection results
            await self.create_experiment(f"drift_detection_{model_name}")
            with self.start_run(experiment_name=f"drift_detection_{model_name}",
                              run_name=f"drift_{datetime.now().strftime('%Y%m%d_%H%M%S')}") as run:
                
                await self.log_parameters({
                    "model_name": model_name,
                    "model_version": version,
                    "threshold": threshold,
                    "current_data_size": len(current_data),
                    "reference_data_size": len(reference_data)
                })
                
                await self.log_metrics({
                    "overall_drift_score": drift_results["drift_score"],
                    "drifted_features_count": len(drift_results["drifted_features"])
                })
                
                mlflow.log_dict(drift_results, "drift_detection_results.json")
            
            return drift_results
            
        except Exception as e:
            drift_results["error"] = str(e)
            logger.error(f"Drift detection failed: {e}")
            return drift_results
    
    async def get_model_performance_history(self,
                                          model_name: str,
                                          version: str,
                                          days: int = 30) -> List[ModelPerformanceMetrics]:
        """Get model performance history"""
        model_key = f"{model_name}:{version}"
        if model_key not in self._model_performance_cache:
            return []
        
        # Filter by date range
        cutoff_date = datetime.now() - timedelta(days=days)
        return [
            metrics for metrics in self._model_performance_cache[model_key]
            if metrics.timestamp >= cutoff_date
        ]
    
    # =============================================================================
    # CLEANUP AND UTILITIES
    # =============================================================================
    
    def set_reference_data(self, reference_data: pd.DataFrame):
        """Set reference data for drift detection"""
        self._reference_data = reference_data.copy()
    
    async def cleanup_old_artifacts(self, days_to_keep: int = 30):
        """Clean up old artifacts and experiments"""
        cutoff_date = datetime.now() - timedelta(days=days_to_keep)
        
        if MLFLOW_AVAILABLE:
            try:
                with self._mlflow_context():
                    # Get all experiments
                    experiments = self.client.search_experiments()
                    
                    for experiment in experiments:
                        # Get runs older than cutoff date
                        runs = self.client.search_runs(
                            experiment_ids=[experiment.experiment_id],
                            filter_string=f"attributes.start_time < {int(cutoff_date.timestamp() * 1000)}"
                        )
                        
                        # Delete old runs
                        for run in runs:
                            try:
                                self.client.delete_run(run.info.run_id)
                                logger.info(f"Deleted old run: {run.info.run_id}")
                            except Exception as e:
                                logger.warning(f"Could not delete run {run.info.run_id}: {e}")
                
                logger.info(f"Cleaned up artifacts older than {days_to_keep} days")
                
            except Exception as e:
                logger.error(f"Artifact cleanup failed: {e}")
    
    def __del__(self):
        """Cleanup resources"""
        if hasattr(self, '_executor'):
            self._executor.shutdown(wait=False)
        if hasattr(self, '_process_executor'):
            self._process_executor.shutdown(wait=False)


# =============================================================================
# FACTORY FUNCTION
# =============================================================================

def create_mlflow_integration_service(
    tracking_uri: Optional[str] = None,
    registry_uri: Optional[str] = None,
    artifact_root: Optional[str] = None,
    enable_monitoring: bool = True
) -> MLflowIntegrationService:
    """
    Factory function to create MLflow integration service
    
    Args:
        tracking_uri: MLflow tracking server URI
        registry_uri: MLflow model registry URI
        artifact_root: Root directory for artifacts
        enable_monitoring: Enable performance monitoring
        
    Returns:
        MLflowIntegrationService: Configured service instance
    """
    return MLflowIntegrationService(
        tracking_uri=tracking_uri,
        registry_uri=registry_uri,
        artifact_root=artifact_root,
        enable_monitoring=enable_monitoring
    )


# Global service instance (can be configured via environment variables)
mlflow_service = create_mlflow_integration_service()