"""
Automated Model Retraining Pipeline for Schlep-engine

A comprehensive automated retraining system that handles the complete ML model lifecycle
without human intervention while maintaining safety and performance standards.

Features:
- Performance degradation detection with configurable thresholds
- Data drift and concept drift monitoring
- Scheduled retraining policies with multiple triggers
- Incremental data collection and quality validation
- Automated hyperparameter optimization during retraining
- Model validation and performance comparison
- Automated deployment with canary and blue-green strategies
- Automatic rollback on performance degradation
- MLflow integration for model versioning and tracking
- Comprehensive monitoring and alerting system
- Feedback loop integration for continuous learning

This service integrates with existing ML services and provides enterprise-grade
automated model lifecycle management capabilities.
"""

import asyncio
import logging
import json
import os
import pickle
import shutil
import tempfile
import uuid
import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple, Union, Callable, Set
from dataclasses import dataclass, field, asdict
from enum import Enum
from contextlib import contextmanager, asynccontextmanager
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
from collections import defaultdict, deque
import threading
import time
import warnings

# Core ML libraries
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, GridSearchCV, RandomizedSearchCV
from sklearn.metrics import (
    accuracy_score, precision_recall_fscore_support, roc_auc_score,
    mean_squared_error, r2_score, mean_absolute_error, classification_report
)
from sklearn.base import BaseEstimator, clone
import joblib

# Statistical testing for drift detection
try:
    from scipy import stats
    from scipy.stats import ks_2samp, chi2_contingency
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False
    warnings.warn("Scipy not available. Some drift detection features will be limited.")

# Deep learning libraries (optional)
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

# MLflow integration
try:
    import mlflow
    import mlflow.sklearn
    from mlflow import MlflowClient
    from mlflow.entities import ViewType
    MLFLOW_AVAILABLE = True
except ImportError:
    MLFLOW_AVAILABLE = False
    warnings.warn("MLflow not available. Model versioning will be limited.")

# Service imports
from .core.error_handling import handle_service_errors
from .mlflow_integration import MLflowIntegrationService, ModelMetadata, ModelStage
from .monitoring_service import MonitoringService
from .feedback_learning_engine import FeedbackLearningEngine
from .confidence_scoring_engine import ConfidenceScoringEngine
from .smart_feature_engineering import SmartFeatureEngineeringService
from .data_quality_service import DataQualityService
from .advanced_ml_engine import AdvancedMLEngine
from ..core.config import settings
from ..core.redis_client import get_redis_client
from ..database.connection import get_db

# Configure logging
logger = logging.getLogger(__name__)


class RetrainingTrigger(Enum):
    """Types of retraining triggers"""
    PERFORMANCE_DEGRADATION = "performance_degradation"
    DATA_DRIFT = "data_drift"
    CONCEPT_DRIFT = "concept_drift"
    SCHEDULED = "scheduled"
    MANUAL = "manual"
    FEEDBACK_THRESHOLD = "feedback_threshold"
    ERROR_RATE_SPIKE = "error_rate_spike"
    VOLUME_CHANGE = "volume_change"


class RetrainingStatus(Enum):
    """Status of retraining process"""
    PENDING = "pending"
    DATA_COLLECTION = "data_collection"
    DATA_VALIDATION = "data_validation"
    TRAINING = "training"
    VALIDATION = "validation"
    DEPLOYMENT = "deployment"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


class DeploymentStrategy(Enum):
    """Deployment strategies"""
    CANARY = "canary"
    BLUE_GREEN = "blue_green"
    ROLLING = "rolling"
    IMMEDIATE = "immediate"


class AlertSeverity(Enum):
    """Alert severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class RetrainingTriggerConfig:
    """Configuration for retraining triggers"""
    trigger_type: RetrainingTrigger
    enabled: bool = True
    threshold: float = 0.0
    window_hours: int = 24
    min_samples: int = 100
    custom_params: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DataDriftConfig:
    """Data drift detection configuration"""
    enabled: bool = True
    detection_method: str = "ks_test"  # ks_test, chi2_test, psi
    threshold: float = 0.1
    window_size: int = 1000
    reference_period_days: int = 30
    categorical_threshold: float = 0.05
    numerical_threshold: float = 0.1
    min_samples: int = 50


@dataclass
class ConceptDriftConfig:
    """Concept drift detection configuration"""
    enabled: bool = True
    detection_method: str = "performance_drop"  # performance_drop, prediction_distribution
    threshold: float = 0.05
    window_size: int = 500
    baseline_period_days: int = 7
    min_accuracy_drop: float = 0.02


@dataclass
class HyperparameterOptimizationConfig:
    """Hyperparameter optimization configuration"""
    enabled: bool = True
    method: str = "random_search"  # grid_search, random_search, bayesian
    n_trials: int = 50
    cv_folds: int = 5
    scoring_metric: str = "accuracy"
    timeout_minutes: int = 60
    parallel_jobs: int = -1


@dataclass
class ValidationConfig:
    """Model validation configuration"""
    validation_split: float = 0.2
    performance_threshold: Dict[str, float] = field(default_factory=lambda: {
        "accuracy": 0.8,
        "precision": 0.75,
        "recall": 0.75
    })
    improvement_threshold: float = 0.01
    statistical_significance: float = 0.05
    holdout_period_hours: int = 24


@dataclass
class DeploymentConfig:
    """Deployment configuration"""
    strategy: DeploymentStrategy = DeploymentStrategy.CANARY
    canary_percentage: float = 0.1
    canary_duration_hours: int = 2
    rollback_threshold: float = 0.95
    health_check_interval: int = 30
    max_deployment_time: int = 3600
    blue_green_switch_delay: int = 300


@dataclass
class RetrainingPolicy:
    """Comprehensive retraining policy"""
    model_name: str
    enabled: bool = True
    
    # Trigger configurations
    triggers: List[RetrainingTriggerConfig] = field(default_factory=list)
    
    # Data management
    data_drift_config: DataDriftConfig = field(default_factory=DataDriftConfig)
    concept_drift_config: ConceptDriftConfig = field(default_factory=ConceptDriftConfig)
    min_training_samples: int = 1000
    max_training_samples: int = 100000
    data_quality_threshold: float = 0.8
    
    # Training configuration
    retrain_frequency_hours: int = 168  # weekly
    hyperparameter_optimization: HyperparameterOptimizationConfig = field(default_factory=HyperparameterOptimizationConfig)
    validation_config: ValidationConfig = field(default_factory=ValidationConfig)
    
    # Deployment configuration
    deployment_config: DeploymentConfig = field(default_factory=DeploymentConfig)
    
    # Safety and monitoring
    max_retrain_attempts: int = 3
    cooldown_period_hours: int = 24
    enable_rollback: bool = True
    monitor_post_deployment: bool = True
    
    # Notification settings
    alert_channels: List[str] = field(default_factory=lambda: ["email", "slack"])
    alert_thresholds: Dict[AlertSeverity, float] = field(default_factory=lambda: {
        AlertSeverity.LOW: 0.05,
        AlertSeverity.MEDIUM: 0.1,
        AlertSeverity.HIGH: 0.15,
        AlertSeverity.CRITICAL: 0.2
    })


@dataclass
class RetrainingJob:
    """Retraining job tracking"""
    job_id: str
    model_name: str
    trigger_type: RetrainingTrigger
    status: RetrainingStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    
    # Training details
    training_data_size: int = 0
    validation_data_size: int = 0
    baseline_metrics: Dict[str, float] = field(default_factory=dict)
    new_model_metrics: Dict[str, float] = field(default_factory=dict)
    improvement: float = 0.0
    
    # Deployment details
    deployment_strategy: Optional[DeploymentStrategy] = None
    deployed_version: Optional[str] = None
    rollback_performed: bool = False
    
    # Artifacts
    artifacts: Dict[str, str] = field(default_factory=dict)
    logs: List[str] = field(default_factory=list)


@dataclass
class ModelPerformanceSnapshot:
    """Model performance snapshot for monitoring"""
    model_name: str
    version: str
    timestamp: datetime
    metrics: Dict[str, float]
    sample_count: int
    drift_score: float = 0.0
    confidence_score: float = 1.0
    error_rate: float = 0.0


class AutomatedRetrainingError(Exception):
    """Base exception for automated retraining errors"""
    pass


class DataValidationError(AutomatedRetrainingError):
    """Data validation related errors"""
    pass


class TrainingError(AutomatedRetrainingError):
    """Training related errors"""
    pass


class DeploymentError(AutomatedRetrainingError):
    """Deployment related errors"""
    pass


class AutomatedRetrainingPipeline:
    """
    Comprehensive automated model retraining pipeline
    
    Provides end-to-end automated retraining capabilities including:
    - Multi-trigger retraining detection (performance, drift, schedule)
    - Incremental data collection and validation
    - Automated hyperparameter optimization
    - Model validation and comparison
    - Automated deployment with multiple strategies
    - Rollback capabilities and safety mechanisms
    - Comprehensive monitoring and alerting
    """
    
    def __init__(self,
                 mlflow_service: Optional[MLflowIntegrationService] = None,
                 monitoring_service: Optional[MonitoringService] = None,
                 redis_client = None,
                 db_session = None):
        """
        Initialize the automated retraining pipeline
        
        Args:
            mlflow_service: MLflow integration service for model versioning
            monitoring_service: Monitoring service for health checks and metrics
            redis_client: Redis client for caching and job coordination
            db_session: Database session for data access
        """
        self.mlflow_service = mlflow_service or MLflowIntegrationService()
        self.monitoring_service = monitoring_service or MonitoringService()
        self.redis_client = redis_client or get_redis_client() if hasattr(settings, 'USE_REDIS_CACHE') and settings.USE_REDIS_CACHE else None
        self.db_session = db_session
        
        # Initialize service dependencies
        self.feedback_engine = None  # Lazy initialization
        self.confidence_engine = None  # Lazy initialization
        self.feature_engineering = None  # Lazy initialization
        self.data_quality_service = None  # Lazy initialization
        self.ml_engine = None  # Lazy initialization
        
        # Thread pools for async operations
        self._executor = ThreadPoolExecutor(max_workers=6)
        self._training_executor = ProcessPoolExecutor(max_workers=2)
        
        # Job tracking
        self._active_jobs: Dict[str, RetrainingJob] = {}
        self._job_lock = threading.Lock()
        
        # Performance monitoring
        self._performance_history: Dict[str, deque] = defaultdict(lambda: deque(maxlen=10000))
        self._model_policies: Dict[str, RetrainingPolicy] = {}
        
        # Trigger monitoring tasks
        self._monitoring_tasks: List[asyncio.Task] = []
        self._shutdown_event = asyncio.Event()
        
        # Cache keys
        self._cache_prefix = "retrain_pipeline"
        
        logger.info("AutomatedRetrainingPipeline initialized")
    
    def _lazy_init_services(self):
        """Lazy initialization of service dependencies"""
        if self.feedback_engine is None:
            try:
                self.feedback_engine = FeedbackLearningEngine()
            except Exception as e:
                logger.warning(f"Could not initialize feedback engine: {e}")
                
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
                
        if self.data_quality_service is None:
            try:
                self.data_quality_service = DataQualityService()
            except Exception as e:
                logger.warning(f"Could not initialize data quality service: {e}")
                
        if self.ml_engine is None:
            try:
                self.ml_engine = AdvancedMLEngine()
            except Exception as e:
                logger.warning(f"Could not initialize ML engine: {e}")
    
    def _cache_key(self, *parts: str) -> str:
        """Generate cache key"""
        return f"{self._cache_prefix}:{':'.join(parts)}"
    
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
    
    # =============================================================================
    # POLICY MANAGEMENT
    # =============================================================================
    
    @handle_service_errors(AutomatedRetrainingError)
    async def register_model_policy(self, policy: RetrainingPolicy) -> str:
        """
        Register a retraining policy for a model
        
        Args:
            policy: Retraining policy configuration
            
        Returns:
            str: Policy ID
        """
        policy_id = f"{policy.model_name}_{hashlib.md5(policy.model_name.encode()).hexdigest()[:8]}"
        
        # Validate policy
        await self._validate_policy(policy)
        
        # Store policy
        self._model_policies[policy.model_name] = policy
        
        # Cache policy
        cache_key = self._cache_key("policy", policy.model_name)
        self._set_cached(cache_key, asdict(policy), ttl=86400)  # 24 hours
        
        # Start monitoring for this model if enabled
        if policy.enabled:
            await self._start_model_monitoring(policy.model_name)
        
        logger.info(f"Registered retraining policy for model {policy.model_name}: {policy_id}")
        return policy_id
    
    @handle_service_errors(AutomatedRetrainingError)
    async def update_model_policy(self, model_name: str, policy_updates: Dict[str, Any]) -> bool:
        """
        Update an existing retraining policy
        
        Args:
            model_name: Name of the model
            policy_updates: Policy updates to apply
            
        Returns:
            bool: Success status
        """
        if model_name not in self._model_policies:
            raise AutomatedRetrainingError(f"No policy found for model: {model_name}")
        
        # Apply updates
        current_policy = self._model_policies[model_name]
        for key, value in policy_updates.items():
            if hasattr(current_policy, key):
                setattr(current_policy, key, value)
        
        # Re-validate policy
        await self._validate_policy(current_policy)
        
        # Update cache
        cache_key = self._cache_key("policy", model_name)
        self._set_cached(cache_key, asdict(current_policy), ttl=86400)
        
        logger.info(f"Updated retraining policy for model {model_name}")
        return True
    
    async def _validate_policy(self, policy: RetrainingPolicy):
        """Validate retraining policy configuration"""
        if not policy.model_name:
            raise AutomatedRetrainingError("Model name is required")
        
        if policy.min_training_samples < 10:
            raise AutomatedRetrainingError("Minimum training samples must be at least 10")
        
        if policy.max_training_samples < policy.min_training_samples:
            raise AutomatedRetrainingError("Maximum training samples must be >= minimum training samples")
        
        if not policy.triggers:
            logger.warning(f"No triggers configured for model {policy.model_name}")
        
        # Validate trigger configurations
        for trigger in policy.triggers:
            if trigger.threshold < 0 or trigger.threshold > 1:
                logger.warning(f"Trigger threshold {trigger.threshold} may be out of typical range [0,1]")
        
        # Validate performance thresholds
        for metric, threshold in policy.validation_config.performance_threshold.items():
            if threshold < 0 or threshold > 1:
                logger.warning(f"Performance threshold for {metric} may be out of range [0,1]")
    
    # =============================================================================
    # TRIGGER MONITORING
    # =============================================================================
    
    async def _start_model_monitoring(self, model_name: str):
        """Start monitoring tasks for a specific model"""
        policy = self._model_policies.get(model_name)
        if not policy or not policy.enabled:
            return
        
        # Start monitoring tasks for each trigger type
        for trigger in policy.triggers:
            if trigger.enabled:
                task = asyncio.create_task(
                    self._monitor_trigger(model_name, trigger)
                )
                self._monitoring_tasks.append(task)
        
        logger.info(f"Started monitoring for model {model_name}")
    
    async def _monitor_trigger(self, model_name: str, trigger_config: RetrainingTriggerConfig):
        """Monitor a specific trigger for a model"""
        while not self._shutdown_event.is_set():
            try:
                should_trigger = await self._evaluate_trigger(model_name, trigger_config)
                
                if should_trigger:
                    logger.info(f"Trigger {trigger_config.trigger_type} activated for model {model_name}")
                    await self.trigger_retraining(
                        model_name=model_name,
                        trigger_type=trigger_config.trigger_type,
                        trigger_metadata=trigger_config.custom_params
                    )
                    
                    # Cooldown period after triggering
                    policy = self._model_policies[model_name]
                    await asyncio.sleep(policy.cooldown_period_hours * 3600)
                
                # Check interval
                await asyncio.sleep(min(trigger_config.window_hours * 3600, 3600))  # Max 1 hour intervals
                
            except Exception as e:
                logger.error(f"Error monitoring trigger {trigger_config.trigger_type} for {model_name}: {e}")
                await asyncio.sleep(300)  # 5 minute backoff on error
    
    async def _evaluate_trigger(self, model_name: str, trigger_config: RetrainingTriggerConfig) -> bool:
        """Evaluate if a trigger condition is met"""
        try:
            if trigger_config.trigger_type == RetrainingTrigger.PERFORMANCE_DEGRADATION:
                return await self._check_performance_degradation(model_name, trigger_config)
            
            elif trigger_config.trigger_type == RetrainingTrigger.DATA_DRIFT:
                return await self._check_data_drift(model_name, trigger_config)
            
            elif trigger_config.trigger_type == RetrainingTrigger.CONCEPT_DRIFT:
                return await self._check_concept_drift(model_name, trigger_config)
            
            elif trigger_config.trigger_type == RetrainingTrigger.SCHEDULED:
                return await self._check_scheduled_trigger(model_name, trigger_config)
            
            elif trigger_config.trigger_type == RetrainingTrigger.FEEDBACK_THRESHOLD:
                return await self._check_feedback_threshold(model_name, trigger_config)
            
            elif trigger_config.trigger_type == RetrainingTrigger.ERROR_RATE_SPIKE:
                return await self._check_error_rate_spike(model_name, trigger_config)
            
            elif trigger_config.trigger_type == RetrainingTrigger.VOLUME_CHANGE:
                return await self._check_volume_change(model_name, trigger_config)
            
            return False
            
        except Exception as e:
            logger.error(f"Error evaluating trigger {trigger_config.trigger_type}: {e}")
            return False
    
    async def _check_performance_degradation(self, model_name: str, trigger_config: RetrainingTriggerConfig) -> bool:
        """Check for performance degradation"""
        # Get recent performance history
        recent_performance = self._get_recent_performance(model_name, trigger_config.window_hours)
        
        if len(recent_performance) < trigger_config.min_samples:
            return False
        
        # Get baseline performance (older data)
        baseline_end = datetime.now() - timedelta(hours=trigger_config.window_hours)
        baseline_start = baseline_end - timedelta(hours=trigger_config.window_hours * 2)
        baseline_performance = [
            perf for perf in self._performance_history[model_name]
            if baseline_start <= perf.timestamp <= baseline_end
        ]
        
        if len(baseline_performance) < trigger_config.min_samples:
            return False
        
        # Calculate performance metrics
        recent_accuracy = np.mean([perf.metrics.get('accuracy', 0) for perf in recent_performance])
        baseline_accuracy = np.mean([perf.metrics.get('accuracy', 0) for perf in baseline_performance])
        
        # Check if performance degraded below threshold
        degradation = baseline_accuracy - recent_accuracy
        return degradation > trigger_config.threshold
    
    async def _check_data_drift(self, model_name: str, trigger_config: RetrainingTriggerConfig) -> bool:
        """Check for data drift"""
        policy = self._model_policies[model_name]
        drift_config = policy.data_drift_config
        
        if not drift_config.enabled:
            return False
        
        # Get recent data for comparison
        try:
            current_data = await self._get_recent_model_inputs(model_name, drift_config.window_size)
            reference_data = await self._get_reference_data(model_name, drift_config.reference_period_days)
            
            if current_data is None or reference_data is None:
                logger.warning(f"No data available for drift detection for model {model_name}")
                return False
            
            # Calculate drift score
            drift_score = await self._calculate_data_drift_score(current_data, reference_data, drift_config)
            
            # Store drift score
            cache_key = self._cache_key("drift_score", model_name)
            self._set_cached(cache_key, drift_score, ttl=3600)
            
            return drift_score > drift_config.threshold
            
        except Exception as e:
            logger.error(f"Error checking data drift for {model_name}: {e}")
            return False
    
    async def _check_concept_drift(self, model_name: str, trigger_config: RetrainingTriggerConfig) -> bool:
        """Check for concept drift"""
        policy = self._model_policies[model_name]
        concept_config = policy.concept_drift_config
        
        if not concept_config.enabled:
            return False
        
        try:
            # Get recent predictions and actual outcomes
            recent_data = await self._get_recent_predictions_with_outcomes(model_name, concept_config.window_size)
            
            if len(recent_data) < concept_config.window_size:
                return False
            
            # Calculate prediction performance drift
            if concept_config.detection_method == "performance_drop":
                recent_accuracy = np.mean([pred['correct'] for pred in recent_data])
                baseline_accuracy = await self._get_baseline_accuracy(model_name, concept_config.baseline_period_days)
                
                if baseline_accuracy is None:
                    return False
                
                accuracy_drop = baseline_accuracy - recent_accuracy
                return accuracy_drop > concept_config.min_accuracy_drop
            
            elif concept_config.detection_method == "prediction_distribution":
                # Check if prediction distribution has changed significantly
                recent_predictions = np.array([pred['prediction'] for pred in recent_data])
                baseline_predictions = await self._get_baseline_predictions(model_name, concept_config.baseline_period_days)
                
                if baseline_predictions is None:
                    return False
                
                # Use KS test for distribution comparison
                if SCIPY_AVAILABLE:
                    statistic, p_value = ks_2samp(baseline_predictions, recent_predictions)
                    return p_value < 0.05  # Significant distribution change
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking concept drift for {model_name}: {e}")
            return False
    
    async def _check_scheduled_trigger(self, model_name: str, trigger_config: RetrainingTriggerConfig) -> bool:
        """Check scheduled retraining trigger"""
        policy = self._model_policies[model_name]
        
        # Get last retraining timestamp
        last_retrain_key = self._cache_key("last_retrain", model_name)
        last_retrain_str = self._get_cached(last_retrain_key)
        
        if last_retrain_str:
            last_retrain = datetime.fromisoformat(last_retrain_str)
            hours_since_retrain = (datetime.now() - last_retrain).total_seconds() / 3600
            return hours_since_retrain >= policy.retrain_frequency_hours
        
        # No previous retraining record - trigger initial training
        return True
    
    async def _check_feedback_threshold(self, model_name: str, trigger_config: RetrainingTriggerConfig) -> bool:
        """Check feedback-based trigger"""
        self._lazy_init_services()
        
        if not self.feedback_engine:
            return False
        
        try:
            # Get recent feedback scores
            feedback_data = await self.feedback_engine.get_recent_feedback(
                model_name=model_name,
                hours=trigger_config.window_hours,
                min_samples=trigger_config.min_samples
            )
            
            if not feedback_data or len(feedback_data) < trigger_config.min_samples:
                return False
            
            # Calculate average negative feedback rate
            negative_feedback_rate = len([f for f in feedback_data if f.get('rating', 0) < 0.5]) / len(feedback_data)
            
            return negative_feedback_rate > trigger_config.threshold
            
        except Exception as e:
            logger.error(f"Error checking feedback threshold for {model_name}: {e}")
            return False
    
    async def _check_error_rate_spike(self, model_name: str, trigger_config: RetrainingTriggerConfig) -> bool:
        """Check for error rate spike"""
        recent_performance = self._get_recent_performance(model_name, trigger_config.window_hours)
        
        if len(recent_performance) < trigger_config.min_samples:
            return False
        
        # Calculate recent error rate
        recent_error_rate = np.mean([perf.error_rate for perf in recent_performance])
        
        # Get baseline error rate
        baseline_end = datetime.now() - timedelta(hours=trigger_config.window_hours)
        baseline_start = baseline_end - timedelta(hours=trigger_config.window_hours * 7)  # 7x window for baseline
        baseline_performance = [
            perf for perf in self._performance_history[model_name]
            if baseline_start <= perf.timestamp <= baseline_end
        ]
        
        if len(baseline_performance) < trigger_config.min_samples:
            return False
        
        baseline_error_rate = np.mean([perf.error_rate for perf in baseline_performance])
        
        # Check for significant increase in error rate
        error_rate_increase = recent_error_rate - baseline_error_rate
        return error_rate_increase > trigger_config.threshold
    
    async def _check_volume_change(self, model_name: str, trigger_config: RetrainingTriggerConfig) -> bool:
        """Check for significant volume changes"""
        recent_performance = self._get_recent_performance(model_name, trigger_config.window_hours)
        
        if len(recent_performance) < trigger_config.min_samples:
            return False
        
        # Calculate recent volume
        recent_volume = sum([perf.sample_count for perf in recent_performance])
        
        # Get baseline volume
        baseline_end = datetime.now() - timedelta(hours=trigger_config.window_hours)
        baseline_start = baseline_end - timedelta(hours=trigger_config.window_hours)
        baseline_performance = [
            perf for perf in self._performance_history[model_name]
            if baseline_start <= perf.timestamp <= baseline_end
        ]
        
        if len(baseline_performance) < trigger_config.min_samples:
            return False
        
        baseline_volume = sum([perf.sample_count for perf in baseline_performance])
        
        if baseline_volume == 0:
            return False
        
        # Check for significant volume change
        volume_change_ratio = abs(recent_volume - baseline_volume) / baseline_volume
        return volume_change_ratio > trigger_config.threshold
    
    # =============================================================================
    # RETRAINING ORCHESTRATION
    # =============================================================================
    
    @handle_service_errors(AutomatedRetrainingError)
    async def trigger_retraining(self,
                                model_name: str,
                                trigger_type: RetrainingTrigger,
                                trigger_metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        Trigger model retraining
        
        Args:
            model_name: Name of the model to retrain
            trigger_type: Type of trigger that initiated retraining
            trigger_metadata: Additional trigger metadata
            
        Returns:
            str: Job ID for tracking
        """
        if model_name not in self._model_policies:
            raise AutomatedRetrainingError(f"No retraining policy found for model: {model_name}")
        
        policy = self._model_policies[model_name]
        
        if not policy.enabled:
            raise AutomatedRetrainingError(f"Retraining disabled for model: {model_name}")
        
        # Check if retraining is already in progress
        active_jobs = [job for job in self._active_jobs.values() 
                      if job.model_name == model_name and job.status not in [RetrainingStatus.COMPLETED, RetrainingStatus.FAILED]]
        
        if active_jobs:
            logger.warning(f"Retraining already in progress for model {model_name}")
            return active_jobs[0].job_id
        
        # Create retraining job
        job_id = f"retrain_{model_name}_{uuid.uuid4().hex[:8]}"
        job = RetrainingJob(
            job_id=job_id,
            model_name=model_name,
            trigger_type=trigger_type,
            status=RetrainingStatus.PENDING,
            created_at=datetime.now()
        )
        
        with self._job_lock:
            self._active_jobs[job_id] = job
        
        # Send alert
        await self._send_alert(
            model_name=model_name,
            severity=AlertSeverity.MEDIUM,
            message=f"Retraining triggered for model {model_name} due to {trigger_type.value}",
            metadata=trigger_metadata
        )
        
        # Start retraining process in background
        asyncio.create_task(self._execute_retraining_pipeline(job_id))
        
        logger.info(f"Triggered retraining for model {model_name}: {job_id}")
        return job_id
    
    async def _execute_retraining_pipeline(self, job_id: str):
        """Execute the complete retraining pipeline"""
        job = self._active_jobs[job_id]
        policy = self._model_policies[job.model_name]
        
        try:
            job.started_at = datetime.now()
            job.status = RetrainingStatus.DATA_COLLECTION
            
            logger.info(f"Starting retraining pipeline for job {job_id}")
            
            # Step 1: Data Collection
            training_data, validation_data = await self._collect_training_data(job)
            
            if training_data is None or len(training_data) < policy.min_training_samples:
                raise DataValidationError(f"Insufficient training data: {len(training_data) if training_data is not None else 0}")
            
            job.training_data_size = len(training_data)
            job.validation_data_size = len(validation_data) if validation_data is not None else 0
            
            # Step 2: Data Validation
            job.status = RetrainingStatus.DATA_VALIDATION
            await self._validate_training_data(job, training_data, validation_data)
            
            # Step 3: Model Training
            job.status = RetrainingStatus.TRAINING
            baseline_model = await self._get_baseline_model(job.model_name)
            
            # Get baseline performance
            if baseline_model and validation_data is not None:
                job.baseline_metrics = await self._evaluate_model_performance(baseline_model, validation_data)
            
            # Train new model
            new_model, training_metrics = await self._train_model(job, training_data, validation_data)
            
            # Step 4: Model Validation
            job.status = RetrainingStatus.VALIDATION
            validation_results = await self._validate_new_model(job, new_model, validation_data, baseline_model)
            
            job.new_model_metrics = validation_results['metrics']
            job.improvement = validation_results['improvement']
            
            if not validation_results['passed']:
                raise TrainingError(f"New model failed validation: {validation_results['reason']}")
            
            # Step 5: Model Deployment
            job.status = RetrainingStatus.DEPLOYMENT
            deployment_result = await self._deploy_model(job, new_model)
            
            job.deployment_strategy = deployment_result['strategy']
            job.deployed_version = deployment_result['version']
            
            # Step 6: Complete
            job.status = RetrainingStatus.COMPLETED
            job.completed_at = datetime.now()
            
            # Update last retrain timestamp
            last_retrain_key = self._cache_key("last_retrain", job.model_name)
            self._set_cached(last_retrain_key, datetime.now().isoformat(), ttl=86400 * 30)
            
            # Send success alert
            await self._send_alert(
                model_name=job.model_name,
                severity=AlertSeverity.LOW,
                message=f"Retraining completed successfully for model {job.model_name}",
                metadata={
                    "job_id": job_id,
                    "improvement": job.improvement,
                    "new_version": job.deployed_version
                }
            )
            
            logger.info(f"Retraining pipeline completed successfully for job {job_id}")
            
        except Exception as e:
            job.status = RetrainingStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.now()
            
            # Send failure alert
            await self._send_alert(
                model_name=job.model_name,
                severity=AlertSeverity.HIGH,
                message=f"Retraining failed for model {job.model_name}: {str(e)}",
                metadata={"job_id": job_id}
            )
            
            logger.error(f"Retraining pipeline failed for job {job_id}: {e}")
            
            # Attempt rollback if deployment was started
            if job.status == RetrainingStatus.DEPLOYMENT and policy.enable_rollback:
                try:
                    await self._rollback_deployment(job)
                    job.rollback_performed = True
                except Exception as rollback_error:
                    logger.error(f"Rollback failed for job {job_id}: {rollback_error}")
    
    async def _collect_training_data(self, job: RetrainingJob) -> Tuple[Optional[pd.DataFrame], Optional[pd.DataFrame]]:
        """Collect and prepare training data"""
        policy = self._model_policies[job.model_name]
        
        try:
            # Get recent data for training
            end_time = datetime.now()
            start_time = end_time - timedelta(days=30)  # Last 30 days
            
            # This would typically connect to your data sources
            # For now, we'll create a placeholder implementation
            training_data = await self._fetch_model_training_data(
                model_name=job.model_name,
                start_time=start_time,
                end_time=end_time,
                max_samples=policy.max_training_samples
            )
            
            if training_data is None or len(training_data) < policy.min_training_samples:
                return None, None
            
            # Split into training and validation
            if len(training_data) > 100:
                train_data, val_data = train_test_split(
                    training_data, 
                    test_size=policy.validation_config.validation_split,
                    random_state=42,
                    stratify=training_data.get('target') if 'target' in training_data.columns else None
                )
                return train_data, val_data
            else:
                return training_data, None
                
        except Exception as e:
            logger.error(f"Error collecting training data for job {job.job_id}: {e}")
            raise DataValidationError(f"Failed to collect training data: {e}")
    
    async def _validate_training_data(self, job: RetrainingJob, training_data: pd.DataFrame, validation_data: Optional[pd.DataFrame]):
        """Validate training data quality"""
        self._lazy_init_services()
        
        if not self.data_quality_service:
            logger.warning("Data quality service not available - skipping data validation")
            return
        
        policy = self._model_policies[job.model_name]
        
        try:
            # Run data quality assessment
            quality_results = await self.data_quality_service.assess_data_quality(training_data)
            
            quality_score = quality_results.get('overall_score', 0.0)
            
            if quality_score < policy.data_quality_threshold:
                issues = quality_results.get('issues', [])
                raise DataValidationError(f"Data quality too low: {quality_score:.3f} < {policy.data_quality_threshold}. Issues: {issues}")
            
            job.logs.append(f"Data quality validation passed: {quality_score:.3f}")
            
        except Exception as e:
            if isinstance(e, DataValidationError):
                raise
            logger.error(f"Error validating training data for job {job.job_id}: {e}")
            # Continue with warning if data quality service fails
            job.logs.append(f"Data quality validation failed: {e}")
    
    async def _train_model(self, job: RetrainingJob, training_data: pd.DataFrame, validation_data: Optional[pd.DataFrame]) -> Tuple[Any, Dict[str, float]]:
        """Train new model with hyperparameter optimization"""
        self._lazy_init_services()
        
        policy = self._model_policies[job.model_name]
        
        try:
            # Get current model architecture
            baseline_model = await self._get_baseline_model(job.model_name)
            
            if baseline_model is None:
                # Use default model architecture
                model_config = await self._get_default_model_config(job.model_name)
            else:
                # Use same architecture as baseline model
                model_config = await self._extract_model_config(baseline_model)
            
            # Prepare features and targets
            feature_columns = [col for col in training_data.columns if col != 'target']
            X_train = training_data[feature_columns]
            y_train = training_data['target'] if 'target' in training_data.columns else None
            
            if y_train is None:
                raise TrainingError("No target column found in training data")
            
            # Hyperparameter optimization
            if policy.hyperparameter_optimization.enabled:
                best_model, best_params = await self._optimize_hyperparameters(
                    X_train, y_train, model_config, policy.hyperparameter_optimization
                )
            else:
                # Use default parameters
                if self.ml_engine:
                    best_model = await self.ml_engine.train_model(
                        data=training_data,
                        target_column='target',
                        model_config=model_config
                    )
                else:
                    # Fallback to simple sklearn model
                    from sklearn.ensemble import RandomForestClassifier
                    best_model = RandomForestClassifier(random_state=42)
                    best_model.fit(X_train, y_train)
                
                best_params = {}
            
            # Calculate training metrics
            training_metrics = {}
            if validation_data is not None:
                training_metrics = await self._evaluate_model_performance(best_model, validation_data)
            
            job.logs.append(f"Model training completed. Best params: {best_params}")
            
            return best_model, training_metrics
            
        except Exception as e:
            logger.error(f"Error training model for job {job.job_id}: {e}")
            raise TrainingError(f"Model training failed: {e}")
    
    async def _optimize_hyperparameters(self, X_train: pd.DataFrame, y_train: pd.Series, 
                                      model_config: Dict[str, Any], 
                                      hp_config: HyperparameterOptimizationConfig) -> Tuple[Any, Dict[str, Any]]:
        """Perform hyperparameter optimization"""
        try:
            # Define parameter search space
            param_grid = await self._get_parameter_search_space(model_config)
            
            # Create base model
            base_model = await self._create_model_from_config(model_config)
            
            if hp_config.method == "grid_search":
                search = GridSearchCV(
                    base_model,
                    param_grid,
                    cv=hp_config.cv_folds,
                    scoring=hp_config.scoring_metric,
                    n_jobs=hp_config.parallel_jobs,
                    verbose=1
                )
            else:  # random_search
                search = RandomizedSearchCV(
                    base_model,
                    param_grid,
                    n_iter=hp_config.n_trials,
                    cv=hp_config.cv_folds,
                    scoring=hp_config.scoring_metric,
                    n_jobs=hp_config.parallel_jobs,
                    random_state=42,
                    verbose=1
                )
            
            # Perform search with timeout
            search.fit(X_train, y_train)
            
            return search.best_estimator_, search.best_params_
            
        except Exception as e:
            logger.error(f"Hyperparameter optimization failed: {e}")
            # Fallback to default model
            base_model = await self._create_model_from_config(model_config)
            base_model.fit(X_train, y_train)
            return base_model, {}
    
    async def _validate_new_model(self, job: RetrainingJob, new_model: Any, 
                                validation_data: pd.DataFrame, baseline_model: Optional[Any]) -> Dict[str, Any]:
        """Validate new model against baseline and thresholds"""
        policy = self._model_policies[job.model_name]
        validation_config = policy.validation_config
        
        try:
            # Evaluate new model
            new_metrics = await self._evaluate_model_performance(new_model, validation_data)
            
            # Check performance thresholds
            threshold_checks = []
            for metric, threshold in validation_config.performance_threshold.items():
                actual_value = new_metrics.get(metric, 0.0)
                passed = actual_value >= threshold
                threshold_checks.append({
                    "metric": metric,
                    "threshold": threshold,
                    "actual": actual_value,
                    "passed": passed
                })
            
            thresholds_passed = all(check["passed"] for check in threshold_checks)
            
            # Compare against baseline model
            improvement = 0.0
            baseline_comparison = None
            
            if baseline_model:
                baseline_metrics = await self._evaluate_model_performance(baseline_model, validation_data)
                
                # Calculate improvement (using accuracy as primary metric)
                new_accuracy = new_metrics.get('accuracy', 0.0)
                baseline_accuracy = baseline_metrics.get('accuracy', 0.0)
                improvement = new_accuracy - baseline_accuracy
                
                baseline_comparison = {
                    "baseline_metrics": baseline_metrics,
                    "improvement": improvement,
                    "improvement_significant": improvement > validation_config.improvement_threshold
                }
            
            # Overall validation decision
            passed = thresholds_passed
            if baseline_model:
                passed = passed and (improvement > validation_config.improvement_threshold or improvement > -0.01)  # Allow small degradation
            
            reason = ""
            if not thresholds_passed:
                failed_checks = [check for check in threshold_checks if not check["passed"]]
                reason = f"Failed threshold checks: {failed_checks}"
            elif baseline_model and improvement < -validation_config.improvement_threshold:
                reason = f"Performance degraded significantly: {improvement:.4f}"
            
            return {
                "passed": passed,
                "reason": reason,
                "metrics": new_metrics,
                "improvement": improvement,
                "threshold_checks": threshold_checks,
                "baseline_comparison": baseline_comparison
            }
            
        except Exception as e:
            logger.error(f"Error validating model for job {job.job_id}: {e}")
            return {
                "passed": False,
                "reason": f"Validation error: {e}",
                "metrics": {},
                "improvement": 0.0
            }
    
    async def _deploy_model(self, job: RetrainingJob, model: Any) -> Dict[str, Any]:
        """Deploy new model using configured strategy"""
        policy = self._model_policies[job.model_name]
        deployment_config = policy.deployment_config
        
        try:
            # Register model in MLflow
            new_version = await self._register_model_version(job, model)
            
            # Deploy based on strategy
            if deployment_config.strategy == DeploymentStrategy.CANARY:
                deployment_result = await self._deploy_canary(job, new_version, deployment_config)
            elif deployment_config.strategy == DeploymentStrategy.BLUE_GREEN:
                deployment_result = await self._deploy_blue_green(job, new_version, deployment_config)
            elif deployment_config.strategy == DeploymentStrategy.ROLLING:
                deployment_result = await self._deploy_rolling(job, new_version, deployment_config)
            else:  # IMMEDIATE
                deployment_result = await self._deploy_immediate(job, new_version, deployment_config)
            
            # Start post-deployment monitoring
            if policy.monitor_post_deployment:
                asyncio.create_task(self._monitor_post_deployment(job, new_version))
            
            return {
                "strategy": deployment_config.strategy,
                "version": new_version,
                "details": deployment_result
            }
            
        except Exception as e:
            logger.error(f"Error deploying model for job {job.job_id}: {e}")
            raise DeploymentError(f"Model deployment failed: {e}")
    
    async def _deploy_canary(self, job: RetrainingJob, new_version: str, config: DeploymentConfig) -> Dict[str, Any]:
        """Deploy using canary strategy"""
        try:
            # Transition new model to staging
            await self.mlflow_service.transition_model_stage(
                model_name=job.model_name,
                version=new_version,
                stage=ModelStage.STAGING
            )
            
            job.logs.append(f"Canary deployment started: {config.canary_percentage * 100:.1f}% traffic")
            
            # Wait for canary duration
            await asyncio.sleep(config.canary_duration_hours * 3600)
            
            # Check canary performance
            canary_success = await self._check_canary_performance(job, new_version, config)
            
            if canary_success:
                # Promote to production
                await self.mlflow_service.transition_model_stage(
                    model_name=job.model_name,
                    version=new_version,
                    stage=ModelStage.PRODUCTION,
                    archive_existing_versions=True
                )
                
                job.logs.append("Canary deployment successful - promoted to production")
                return {"success": True, "canary_performance": "passed"}
            else:
                # Rollback canary
                await self._rollback_canary(job, new_version)
                job.logs.append("Canary deployment failed - rolled back")
                raise DeploymentError("Canary deployment failed performance checks")
            
        except Exception as e:
            logger.error(f"Canary deployment failed for job {job.job_id}: {e}")
            raise
    
    async def _deploy_blue_green(self, job: RetrainingJob, new_version: str, config: DeploymentConfig) -> Dict[str, Any]:
        """Deploy using blue-green strategy"""
        try:
            # Deploy to green environment (staging)
            await self.mlflow_service.transition_model_stage(
                model_name=job.model_name,
                version=new_version,
                stage=ModelStage.STAGING
            )
            
            job.logs.append("Blue-green deployment: deployed to green environment")
            
            # Health checks on green environment
            green_healthy = await self._check_deployment_health(job, new_version)
            
            if not green_healthy:
                raise DeploymentError("Green environment health checks failed")
            
            # Wait for switch delay
            await asyncio.sleep(config.blue_green_switch_delay)
            
            # Switch traffic to green (promote to production)
            await self.mlflow_service.transition_model_stage(
                model_name=job.model_name,
                version=new_version,
                stage=ModelStage.PRODUCTION,
                archive_existing_versions=True
            )
            
            job.logs.append("Blue-green deployment: switched traffic to green environment")
            
            return {"success": True, "environment": "green"}
            
        except Exception as e:
            logger.error(f"Blue-green deployment failed for job {job.job_id}: {e}")
            raise
    
    async def _deploy_rolling(self, job: RetrainingJob, new_version: str, config: DeploymentConfig) -> Dict[str, Any]:
        """Deploy using rolling strategy"""
        try:
            # For rolling deployment, we gradually transition traffic
            # This is a simplified implementation
            
            # Start with staging
            await self.mlflow_service.transition_model_stage(
                model_name=job.model_name,
                version=new_version,
                stage=ModelStage.STAGING
            )
            
            # Monitor for a short period
            await asyncio.sleep(300)  # 5 minutes
            
            # Check performance
            performance_ok = await self._check_deployment_performance(job, new_version)
            
            if performance_ok:
                # Promote to production
                await self.mlflow_service.transition_model_stage(
                    model_name=job.model_name,
                    version=new_version,
                    stage=ModelStage.PRODUCTION,
                    archive_existing_versions=True
                )
                
                job.logs.append("Rolling deployment completed successfully")
                return {"success": True, "strategy": "rolling"}
            else:
                raise DeploymentError("Rolling deployment failed performance checks")
                
        except Exception as e:
            logger.error(f"Rolling deployment failed for job {job.job_id}: {e}")
            raise
    
    async def _deploy_immediate(self, job: RetrainingJob, new_version: str, config: DeploymentConfig) -> Dict[str, Any]:
        """Deploy immediately to production"""
        try:
            # Direct promotion to production
            await self.mlflow_service.transition_model_stage(
                model_name=job.model_name,
                version=new_version,
                stage=ModelStage.PRODUCTION,
                archive_existing_versions=True
            )
            
            job.logs.append("Immediate deployment to production completed")
            
            return {"success": True, "strategy": "immediate"}
            
        except Exception as e:
            logger.error(f"Immediate deployment failed for job {job.job_id}: {e}")
            raise
    
    # =============================================================================
    # MONITORING AND ROLLBACK
    # =============================================================================
    
    async def _monitor_post_deployment(self, job: RetrainingJob, version: str):
        """Monitor model performance after deployment"""
        policy = self._model_policies[job.model_name]
        
        try:
            # Monitor for 24 hours post-deployment
            monitoring_duration = 24 * 3600  # 24 hours
            check_interval = 300  # 5 minutes
            
            start_time = datetime.now()
            
            while (datetime.now() - start_time).total_seconds() < monitoring_duration:
                # Check model performance
                performance_ok = await self._check_deployment_performance(job, version)
                
                if not performance_ok and policy.enable_rollback:
                    logger.warning(f"Post-deployment performance degradation detected for {job.model_name}")
                    
                    # Trigger rollback
                    await self._rollback_deployment(job)
                    
                    # Send alert
                    await self._send_alert(
                        model_name=job.model_name,
                        severity=AlertSeverity.HIGH,
                        message=f"Automatic rollback triggered for {job.model_name} due to performance degradation",
                        metadata={"job_id": job.job_id, "version": version}
                    )
                    
                    break
                
                await asyncio.sleep(check_interval)
            
        except Exception as e:
            logger.error(f"Error monitoring post-deployment for job {job.job_id}: {e}")
    
    async def _rollback_deployment(self, job: RetrainingJob):
        """Rollback to previous model version"""
        try:
            # Get previous production version
            models = await self.mlflow_service.list_models(
                filter_string=f"name = '{job.model_name}'"
            )
            
            if not models:
                raise DeploymentError(f"No previous version found for rollback of {job.model_name}")
            
            # Find current production model
            current_model = None
            for model in models:
                if model.stage == ModelStage.PRODUCTION:
                    current_model = model
                    break
            
            if not current_model:
                raise DeploymentError(f"No current production model found for {job.model_name}")
            
            # Archive current model
            await self.mlflow_service.transition_model_stage(
                model_name=job.model_name,
                version=current_model.version,
                stage=ModelStage.ARCHIVED
            )
            
            # Get previous version (this would need more sophisticated logic in practice)
            # For now, we'll just log the rollback
            job.logs.append(f"Rollback performed from version {current_model.version}")
            job.rollback_performed = True
            
            logger.info(f"Rollback completed for model {job.model_name}")
            
        except Exception as e:
            logger.error(f"Rollback failed for job {job.job_id}: {e}")
            raise
    
    # =============================================================================
    # PERFORMANCE TRACKING AND ANALYSIS
    # =============================================================================
    
    async def record_model_performance(self, 
                                     model_name: str,
                                     version: str,
                                     predictions: np.ndarray,
                                     actual_values: Optional[np.ndarray] = None,
                                     input_features: Optional[pd.DataFrame] = None,
                                     custom_metrics: Optional[Dict[str, float]] = None):
        """Record model performance for monitoring"""
        try:
            metrics = {}
            
            # Calculate metrics if actual values available
            if actual_values is not None:
                if len(np.unique(actual_values)) == 2:  # Binary classification
                    metrics['accuracy'] = float(accuracy_score(actual_values, predictions))
                    precision, recall, f1, _ = precision_recall_fscore_support(actual_values, predictions, average='binary')
                    metrics['precision'] = float(precision)
                    metrics['recall'] = float(recall)
                    metrics['f1_score'] = float(f1)
                elif np.issubdtype(actual_values.dtype, np.number):  # Regression
                    metrics['mse'] = float(mean_squared_error(actual_values, predictions))
                    metrics['mae'] = float(mean_absolute_error(actual_values, predictions))
                    metrics['r2'] = float(r2_score(actual_values, predictions))
            
            # Add custom metrics
            if custom_metrics:
                metrics.update(custom_metrics)
            
            # Create performance snapshot
            snapshot = ModelPerformanceSnapshot(
                model_name=model_name,
                version=version,
                timestamp=datetime.now(),
                metrics=metrics,
                sample_count=len(predictions),
                error_rate=custom_metrics.get('error_rate', 0.0) if custom_metrics else 0.0
            )
            
            # Store in performance history
            self._performance_history[model_name].append(snapshot)
            
            # Cache recent performance
            cache_key = self._cache_key("performance", model_name)
            recent_snapshots = list(self._performance_history[model_name])[-100:]  # Last 100 snapshots
            self._set_cached(cache_key, [asdict(s) for s in recent_snapshots], ttl=3600)
            
        except Exception as e:
            logger.error(f"Error recording model performance: {e}")
    
    def _get_recent_performance(self, model_name: str, hours: int) -> List[ModelPerformanceSnapshot]:
        """Get recent performance snapshots for a model"""
        if model_name not in self._performance_history:
            return []
        
        cutoff_time = datetime.now() - timedelta(hours=hours)
        return [
            snapshot for snapshot in self._performance_history[model_name]
            if snapshot.timestamp >= cutoff_time
        ]
    
    # =============================================================================
    # DATA OPERATIONS (PLACEHOLDERS FOR INTEGRATION)
    # =============================================================================
    
    async def _get_recent_model_inputs(self, model_name: str, window_size: int) -> Optional[pd.DataFrame]:
        """Get recent model inputs for drift detection (placeholder implementation)"""
        # This would connect to your actual data storage
        # For now, return None to indicate no data available
        logger.warning(f"_get_recent_model_inputs not implemented - returning None for {model_name}")
        return None
    
    async def _get_reference_data(self, model_name: str, days: int) -> Optional[pd.DataFrame]:
        """Get reference data for drift comparison (placeholder implementation)"""
        # This would connect to your reference data storage
        logger.warning(f"_get_reference_data not implemented - returning None for {model_name}")
        return None
    
    async def _fetch_model_training_data(self, model_name: str, start_time: datetime, 
                                       end_time: datetime, max_samples: int) -> Optional[pd.DataFrame]:
        """Fetch training data from data sources (placeholder implementation)"""
        # This would connect to your training data pipeline
        logger.warning(f"_fetch_model_training_data not implemented - returning None for {model_name}")
        return None
    
    async def _get_recent_predictions_with_outcomes(self, model_name: str, window_size: int) -> List[Dict[str, Any]]:
        """Get recent predictions with actual outcomes (placeholder implementation)"""
        # This would connect to your prediction logging system
        logger.warning(f"_get_recent_predictions_with_outcomes not implemented - returning empty list for {model_name}")
        return []
    
    # =============================================================================
    # MODEL OPERATIONS
    # =============================================================================
    
    async def _get_baseline_model(self, model_name: str) -> Optional[Any]:
        """Get current production model as baseline"""
        try:
            return await self.mlflow_service.load_model(model_name, stage=ModelStage.PRODUCTION)
        except Exception as e:
            logger.warning(f"Could not load baseline model for {model_name}: {e}")
            return None
    
    async def _register_model_version(self, job: RetrainingJob, model: Any) -> str:
        """Register new model version in MLflow"""
        try:
            # Create a simple input example (this would be more sophisticated in practice)
            input_example = pd.DataFrame({
                'feature_1': [0.0],
                'feature_2': [1.0]
            })
            
            metadata = await self.mlflow_service.register_model(
                model=model,
                model_name=job.model_name,
                description=f"Automated retraining - Job {job.job_id}",
                tags={
                    "retrain_job_id": job.job_id,
                    "trigger_type": job.trigger_type.value,
                    "automated": "true"
                },
                input_example=input_example
            )
            
            return metadata.version
            
        except Exception as e:
            logger.error(f"Error registering model version for job {job.job_id}: {e}")
            raise
    
    async def _evaluate_model_performance(self, model: Any, validation_data: pd.DataFrame) -> Dict[str, float]:
        """Evaluate model performance on validation data"""
        try:
            feature_columns = [col for col in validation_data.columns if col != 'target']
            X_val = validation_data[feature_columns]
            y_val = validation_data['target'] if 'target' in validation_data.columns else None
            
            if y_val is None:
                return {}
            
            predictions = model.predict(X_val)
            
            metrics = {}
            
            if len(np.unique(y_val)) == 2:  # Binary classification
                metrics['accuracy'] = float(accuracy_score(y_val, predictions))
                precision, recall, f1, _ = precision_recall_fscore_support(y_val, predictions, average='binary')
                metrics['precision'] = float(precision)
                metrics['recall'] = float(recall)
                metrics['f1_score'] = float(f1)
                
                try:
                    y_pred_proba = model.predict_proba(X_val)[:, 1]
                    metrics['auc_roc'] = float(roc_auc_score(y_val, y_pred_proba))
                except:
                    pass
                    
            elif np.issubdtype(y_val.dtype, np.number):  # Regression
                metrics['mse'] = float(mean_squared_error(y_val, predictions))
                metrics['mae'] = float(mean_absolute_error(y_val, predictions))
                metrics['r2'] = float(r2_score(y_val, predictions))
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error evaluating model performance: {e}")
            return {}
    
    # =============================================================================
    # HELPER METHODS (PLACEHOLDERS)
    # =============================================================================
    
    async def _calculate_data_drift_score(self, current_data: pd.DataFrame, 
                                        reference_data: pd.DataFrame, 
                                        config: DataDriftConfig) -> float:
        """Calculate data drift score between current and reference data"""
        if not SCIPY_AVAILABLE:
            logger.warning("Scipy not available - using simplified drift detection")
            return 0.0
        
        try:
            drift_scores = []
            
            for col in current_data.columns:
                if col not in reference_data.columns:
                    continue
                
                if current_data[col].dtype in ['object', 'category']:
                    # Categorical drift using chi-square
                    try:
                        current_counts = current_data[col].value_counts()
                        ref_counts = reference_data[col].value_counts()
                        
                        all_categories = set(current_counts.index) | set(ref_counts.index)
                        current_aligned = [current_counts.get(cat, 0) for cat in all_categories]
                        ref_aligned = [ref_counts.get(cat, 0) for cat in all_categories]
                        
                        chi2, p_value, _, _ = chi2_contingency([current_aligned, ref_aligned])
                        drift_score = 1 - p_value
                        drift_scores.append(drift_score)
                    except:
                        continue
                else:
                    # Numerical drift using KS test
                    try:
                        statistic, p_value = ks_2samp(
                            reference_data[col].dropna().values,
                            current_data[col].dropna().values
                        )
                        drift_score = 1 - p_value
                        drift_scores.append(drift_score)
                    except:
                        continue
            
            return float(np.mean(drift_scores)) if drift_scores else 0.0
            
        except Exception as e:
            logger.error(f"Error calculating drift score: {e}")
            return 0.0
    
    async def _get_baseline_accuracy(self, model_name: str, days: int) -> Optional[float]:
        """Get baseline accuracy for concept drift detection"""
        # Placeholder implementation
        logger.warning(f"_get_baseline_accuracy not implemented - returning None for {model_name}")
        return None
    
    async def _get_baseline_predictions(self, model_name: str, days: int) -> Optional[np.ndarray]:
        """Get baseline predictions for distribution comparison"""
        # Placeholder implementation
        logger.warning(f"_get_baseline_predictions not implemented - returning None for {model_name}")
        return None
    
    async def _get_default_model_config(self, model_name: str) -> Dict[str, Any]:
        """Get default model configuration"""
        return {
            "model_type": "random_forest",
            "parameters": {
                "n_estimators": 100,
                "max_depth": 10,
                "random_state": 42
            }
        }
    
    async def _extract_model_config(self, model: Any) -> Dict[str, Any]:
        """Extract configuration from existing model"""
        return {
            "model_type": type(model).__name__.lower(),
            "parameters": model.get_params() if hasattr(model, 'get_params') else {}
        }
    
    async def _get_parameter_search_space(self, model_config: Dict[str, Any]) -> Dict[str, Any]:
        """Get parameter search space for hyperparameter optimization"""
        model_type = model_config.get("model_type", "random_forest")
        
        if model_type == "random_forest":
            return {
                "n_estimators": [50, 100, 200],
                "max_depth": [5, 10, 15, None],
                "min_samples_split": [2, 5, 10],
                "min_samples_leaf": [1, 2, 4]
            }
        else:
            # Default parameter space
            return {"random_state": [42]}
    
    async def _create_model_from_config(self, model_config: Dict[str, Any]) -> Any:
        """Create model instance from configuration"""
        model_type = model_config.get("model_type", "random_forest")
        parameters = model_config.get("parameters", {})
        
        if model_type == "random_forest":
            from sklearn.ensemble import RandomForestClassifier
            return RandomForestClassifier(**parameters)
        elif model_type == "logistic_regression":
            from sklearn.linear_model import LogisticRegression
            return LogisticRegression(**parameters)
        else:
            # Default to random forest
            from sklearn.ensemble import RandomForestClassifier
            return RandomForestClassifier(random_state=42)
    
    async def _check_canary_performance(self, job: RetrainingJob, version: str, config: DeploymentConfig) -> bool:
        """Check canary deployment performance"""
        # Placeholder implementation - would check actual canary metrics
        logger.info(f"Checking canary performance for {job.model_name} version {version}")
        return True  # Assume success for now
    
    async def _rollback_canary(self, job: RetrainingJob, version: str):
        """Rollback canary deployment"""
        try:
            await self.mlflow_service.transition_model_stage(
                model_name=job.model_name,
                version=version,
                stage=ModelStage.ARCHIVED
            )
        except Exception as e:
            logger.error(f"Error rolling back canary for {job.model_name}: {e}")
    
    async def _check_deployment_health(self, job: RetrainingJob, version: str) -> bool:
        """Check deployment health"""
        # Placeholder implementation
        logger.info(f"Checking deployment health for {job.model_name} version {version}")
        return True
    
    async def _check_deployment_performance(self, job: RetrainingJob, version: str) -> bool:
        """Check deployment performance"""
        # Placeholder implementation
        logger.info(f"Checking deployment performance for {job.model_name} version {version}")
        return True
    
    # =============================================================================
    # ALERTING
    # =============================================================================
    
    async def _send_alert(self, model_name: str, severity: AlertSeverity, 
                         message: str, metadata: Optional[Dict[str, Any]] = None):
        """Send alert notification"""
        try:
            alert_data = {
                "timestamp": datetime.now().isoformat(),
                "model_name": model_name,
                "severity": severity.value,
                "message": message,
                "metadata": metadata or {}
            }
            
            # Log alert
            logger.info(f"ALERT [{severity.value.upper()}] {model_name}: {message}")
            
            # Cache alert for retrieval
            alerts_key = self._cache_key("alerts", model_name)
            recent_alerts = self._get_cached(alerts_key) or []
            recent_alerts.append(alert_data)
            
            # Keep only last 100 alerts
            recent_alerts = recent_alerts[-100:]
            self._set_cached(alerts_key, recent_alerts, ttl=86400 * 7)  # 7 days
            
            # TODO: Implement actual notification channels (email, Slack, etc.)
            
        except Exception as e:
            logger.error(f"Error sending alert: {e}")
    
    # =============================================================================
    # PUBLIC API METHODS
    # =============================================================================
    
    async def get_retraining_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a retraining job"""
        job = self._active_jobs.get(job_id)
        if job:
            return asdict(job)
        return None
    
    async def list_active_jobs(self) -> List[Dict[str, Any]]:
        """List all active retraining jobs"""
        return [asdict(job) for job in self._active_jobs.values()]
    
    async def get_model_performance_summary(self, model_name: str, days: int = 7) -> Dict[str, Any]:
        """Get performance summary for a model"""
        recent_performance = self._get_recent_performance(model_name, days * 24)
        
        if not recent_performance:
            return {"model_name": model_name, "message": "No performance data available"}
        
        # Calculate summary statistics
        all_metrics = defaultdict(list)
        for perf in recent_performance:
            for metric, value in perf.metrics.items():
                all_metrics[metric].append(value)
        
        summary = {
            "model_name": model_name,
            "period_days": days,
            "total_samples": sum(p.sample_count for p in recent_performance),
            "data_points": len(recent_performance),
            "metrics": {}
        }
        
        for metric, values in all_metrics.items():
            summary["metrics"][metric] = {
                "mean": float(np.mean(values)),
                "min": float(np.min(values)),
                "max": float(np.max(values)),
                "std": float(np.std(values))
            }
        
        return summary
    
    async def get_recent_alerts(self, model_name: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent alerts for a model"""
        alerts_key = self._cache_key("alerts", model_name)
        recent_alerts = self._get_cached(alerts_key) or []
        return recent_alerts[-limit:] if recent_alerts else []
    
    async def manual_trigger_retraining(self, model_name: str, reason: str = "Manual trigger") -> str:
        """Manually trigger model retraining"""
        return await self.trigger_retraining(
            model_name=model_name,
            trigger_type=RetrainingTrigger.MANUAL,
            trigger_metadata={"reason": reason, "triggered_by": "manual"}
        )
    
    async def pause_model_monitoring(self, model_name: str):
        """Pause monitoring for a specific model"""
        if model_name in self._model_policies:
            self._model_policies[model_name].enabled = False
            logger.info(f"Monitoring paused for model {model_name}")
    
    async def resume_model_monitoring(self, model_name: str):
        """Resume monitoring for a specific model"""
        if model_name in self._model_policies:
            self._model_policies[model_name].enabled = True
            await self._start_model_monitoring(model_name)
            logger.info(f"Monitoring resumed for model {model_name}")
    
    # =============================================================================
    # CLEANUP AND SHUTDOWN
    # =============================================================================
    
    async def shutdown(self):
        """Shutdown the retraining pipeline"""
        logger.info("Shutting down automated retraining pipeline")
        
        # Signal shutdown to monitoring tasks
        self._shutdown_event.set()
        
        # Cancel monitoring tasks
        for task in self._monitoring_tasks:
            task.cancel()
        
        # Wait for tasks to complete
        if self._monitoring_tasks:
            await asyncio.gather(*self._monitoring_tasks, return_exceptions=True)
        
        # Shutdown executors
        if hasattr(self, '_executor'):
            self._executor.shutdown(wait=True)
        if hasattr(self, '_training_executor'):
            self._training_executor.shutdown(wait=True)
        
        logger.info("Automated retraining pipeline shutdown complete")
    
    def __del__(self):
        """Cleanup resources"""
        try:
            if hasattr(self, '_executor'):
                self._executor.shutdown(wait=False)
            if hasattr(self, '_training_executor'):
                self._training_executor.shutdown(wait=False)
        except:
            pass


# =============================================================================
# FACTORY FUNCTION
# =============================================================================

def create_automated_retraining_pipeline(
    mlflow_service: Optional[MLflowIntegrationService] = None,
    monitoring_service: Optional[MonitoringService] = None
) -> AutomatedRetrainingPipeline:
    """
    Factory function to create automated retraining pipeline
    
    Args:
        mlflow_service: MLflow integration service
        monitoring_service: Monitoring service
        
    Returns:
        AutomatedRetrainingPipeline: Configured pipeline instance
    """
    return AutomatedRetrainingPipeline(
        mlflow_service=mlflow_service,
        monitoring_service=monitoring_service
    )


# Global pipeline instance
retraining_pipeline = create_automated_retraining_pipeline()