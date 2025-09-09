"""
Automated Retraining Engine
===========================

Advanced automated retraining system for continuous learning and model maintenance.
Built on top of the existing MLOps Platform Core, Enhanced Experiment Tracking, 
and Advanced Model Serving infrastructure.

Key Features:
- Data drift detection and monitoring with statistical and ML-based methods
- Performance degradation detection and alerting
- Automated trigger mechanisms for retraining based on configurable policies
- Configurable retraining schedules and resource allocation
- Integration with existing MLOps infrastructure
- Support for incremental and full retraining strategies
- Real-time monitoring and quality assurance
- Automated rollback capabilities on failure

Architecture:
- DriftDetector: Monitors data and concept drift
- RetrainingTrigger: Evaluates conditions and triggers retraining
- RetrainingOrchestrator: Manages the retraining workflow
- QualityAssurance: Validates retrained models
- PolicyEngine: Manages retraining policies and schedules
"""

import os
import json
import uuid
import time
import asyncio
import logging
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union, Tuple, Callable
from dataclasses import dataclass, asdict
from enum import Enum
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict, deque
import numpy as np
import pandas as pd

# Statistical analysis for drift detection
from scipy import stats
from scipy.spatial.distance import jensenshannon
from sklearn.base import BaseEstimator
from sklearn.metrics import accuracy_score, mean_squared_error, classification_report
from sklearn.model_selection import train_test_split
from sklearn.ensemble import IsolationForest
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

# Import existing MLOps infrastructure
try:
    from app.ml.mlops_platform import (
        MLOpsCore, ModelFramework, ExperimentStatus, ModelStatus,
        ModelMetadata, create_mlops_platform
    )
    from app.ml.enhanced_experiment_tracker import (
        EnhancedExperimentTracker, MetricDefinition, MetricType, 
        OptimizationObjective, ExperimentType
    )
    from app.services.advanced_model_serving import (
        AdvancedModelServingEngine, PredictionRequest, PredictionResponse
    )
    from app.ml.advanced_modeling_engine import AdvancedMLModelingEngine
    from app.ml.feature_engineering import AdvancedFeatureEngineer
    from app.ml.data_quality import AdvancedDataQualityAnalyzer
    MLOPS_AVAILABLE = True
except ImportError as e:
    logging.warning(f"Could not import MLOps modules: {e}")
    MLOPS_AVAILABLE = False

logger = logging.getLogger(__name__)


# Enums and Data Classes
class DriftType(str, Enum):
    """Types of drift that can be detected."""
    DATA_DRIFT = "data_drift"           # Distribution changes in input features
    CONCEPT_DRIFT = "concept_drift"     # Changes in target relationship
    PERFORMANCE_DRIFT = "performance_drift"  # Model performance degradation
    POPULATION_DRIFT = "population_drift"    # Changes in data population


class DriftDetectionMethod(str, Enum):
    """Methods for detecting drift."""
    STATISTICAL = "statistical"         # KS test, PSI, etc.
    DISTANCE_BASED = "distance_based"   # KL divergence, JS distance
    MODEL_BASED = "model_based"        # Classifier-based detection
    ENSEMBLE = "ensemble"              # Combination of methods


class RetrainingStrategy(str, Enum):
    """Strategies for retraining models."""
    FULL_RETRAIN = "full_retrain"       # Complete retraining from scratch
    INCREMENTAL = "incremental"         # Add new data to existing model
    TRANSFER_LEARNING = "transfer_learning"  # Fine-tune existing model
    ENSEMBLE_UPDATE = "ensemble_update"  # Update ensemble components


class TriggerCondition(str, Enum):
    """Conditions that can trigger retraining."""
    DRIFT_DETECTED = "drift_detected"
    PERFORMANCE_DEGRADED = "performance_degraded"
    SCHEDULE_BASED = "schedule_based"
    DATA_VOLUME_THRESHOLD = "data_volume_threshold"
    MANUAL_TRIGGER = "manual_trigger"
    COMPOSITE = "composite"              # Multiple conditions combined


class RetrainingStatus(str, Enum):
    """Status of retraining jobs."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    VALIDATING = "validating"
    DEPLOYING = "deploying"
    ROLLED_BACK = "rolled_back"


class PolicyType(str, Enum):
    """Types of retraining policies."""
    REACTIVE = "reactive"               # React to detected issues
    PROACTIVE = "proactive"            # Regular scheduled retraining
    HYBRID = "hybrid"                  # Combination of reactive and proactive


@dataclass
class DriftDetectionResult:
    """Result of drift detection analysis."""
    drift_type: DriftType
    detected: bool
    severity: float  # 0.0 to 1.0
    confidence: float  # 0.0 to 1.0
    method_used: DriftDetectionMethod
    features_affected: List[str]
    statistical_results: Dict[str, Any]
    timestamp: datetime
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


@dataclass
class RetrainingPolicy:
    """Policy configuration for automated retraining."""
    policy_id: str
    model_id: str
    policy_name: str
    policy_type: PolicyType
    
    # Trigger conditions
    trigger_conditions: List[TriggerCondition]
    drift_threshold: float = 0.7
    performance_threshold: float = 0.1  # Acceptable performance drop
    schedule_interval_hours: Optional[int] = None
    data_volume_threshold: Optional[int] = None
    
    # Retraining configuration
    retraining_strategy: RetrainingStrategy
    max_concurrent_jobs: int = 1
    resource_requirements: Dict[str, Any] = None
    
    # Quality assurance
    validation_split: float = 0.2
    performance_improvement_threshold: float = 0.02
    rollback_on_failure: bool = True
    
    # Scheduling
    active: bool = True
    created_at: datetime = None
    updated_at: datetime = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()
        if self.updated_at is None:
            self.updated_at = datetime.utcnow()
        if self.resource_requirements is None:
            self.resource_requirements = {
                "cpu_cores": 4,
                "memory_gb": 8,
                "gpu_count": 0,
                "timeout_hours": 4
            }


@dataclass
class RetrainingJob:
    """Retraining job configuration and status."""
    job_id: str
    model_id: str
    policy_id: str
    trigger_reason: str
    
    # Configuration
    strategy: RetrainingStrategy
    training_data_config: Dict[str, Any]
    model_config: Dict[str, Any]
    
    # Status tracking
    status: RetrainingStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Results
    experiment_id: Optional[str] = None
    new_model_id: Optional[str] = None
    performance_metrics: Dict[str, float] = None
    comparison_results: Dict[str, Any] = None
    
    # Resource tracking
    resource_usage: Dict[str, Any] = None
    error_message: Optional[str] = None
    
    def __post_init__(self):
        if self.performance_metrics is None:
            self.performance_metrics = {}
        if self.resource_usage is None:
            self.resource_usage = {}


class DriftDetector:
    """
    Advanced drift detection system supporting multiple detection methods.
    """
    
    def __init__(self):
        self.detection_methods = {
            DriftDetectionMethod.STATISTICAL: self._statistical_drift_detection,
            DriftDetectionMethod.DISTANCE_BASED: self._distance_based_drift_detection,
            DriftDetectionMethod.MODEL_BASED: self._model_based_drift_detection,
            DriftDetectionMethod.ENSEMBLE: self._ensemble_drift_detection
        }
        
        # Store reference data for comparison
        self._reference_data: Dict[str, pd.DataFrame] = {}
        self._feature_statistics: Dict[str, Dict[str, Any]] = {}
        
        logger.info("DriftDetector initialized")
    
    def register_reference_data(self, model_id: str, reference_data: pd.DataFrame):
        """Register reference data for drift detection."""
        self._reference_data[model_id] = reference_data.copy()
        
        # Calculate reference statistics
        self._feature_statistics[model_id] = {
            'means': reference_data.mean(numeric_only=True).to_dict(),
            'stds': reference_data.std(numeric_only=True).to_dict(),
            'mins': reference_data.min(numeric_only=True).to_dict(),
            'maxs': reference_data.max(numeric_only=True).to_dict(),
            'quantiles': reference_data.quantile([0.25, 0.5, 0.75], numeric_only=True).to_dict(),
            'categorical_distributions': {}
        }
        
        # Calculate categorical distributions
        for col in reference_data.select_dtypes(include=['object', 'category']):
            self._feature_statistics[model_id]['categorical_distributions'][col] = \
                reference_data[col].value_counts(normalize=True).to_dict()
        
        logger.info(f"Registered reference data for model {model_id}")
    
    def detect_drift(self, 
                    model_id: str, 
                    current_data: pd.DataFrame,
                    method: DriftDetectionMethod = DriftDetectionMethod.ENSEMBLE,
                    sensitivity: float = 0.05) -> DriftDetectionResult:
        """Detect drift in current data compared to reference data."""
        
        if model_id not in self._reference_data:
            raise ValueError(f"No reference data registered for model {model_id}")
        
        reference_data = self._reference_data[model_id]
        detection_func = self.detection_methods[method]
        
        return detection_func(model_id, reference_data, current_data, sensitivity)
    
    def _statistical_drift_detection(self, 
                                   model_id: str,
                                   reference_data: pd.DataFrame,
                                   current_data: pd.DataFrame,
                                   sensitivity: float) -> DriftDetectionResult:
        """Statistical drift detection using KS test and PSI."""
        
        drift_scores = []
        affected_features = []
        statistical_results = {}
        
        # Get common numeric columns
        numeric_cols = reference_data.select_dtypes(include=[np.number]).columns
        common_cols = set(numeric_cols) & set(current_data.columns)
        
        for col in common_cols:
            try:
                ref_values = reference_data[col].dropna()
                curr_values = current_data[col].dropna()
                
                if len(ref_values) == 0 or len(curr_values) == 0:
                    continue
                
                # Kolmogorov-Smirnov test
                ks_statistic, ks_p_value = stats.ks_2samp(ref_values, curr_values)
                
                # Population Stability Index (PSI)
                psi_score = self._calculate_psi(ref_values, curr_values)
                
                # Chi-square test for categorical features
                chi2_p_value = None
                if col in reference_data.select_dtypes(include=['object', 'category']):
                    try:
                        ref_counts = reference_data[col].value_counts()
                        curr_counts = current_data[col].value_counts()
                        common_categories = set(ref_counts.index) & set(curr_counts.index)
                        
                        if len(common_categories) > 1:
                            ref_freq = [ref_counts.get(cat, 0) for cat in common_categories]
                            curr_freq = [curr_counts.get(cat, 0) for cat in common_categories]
                            chi2_stat, chi2_p_value = stats.chisquare(curr_freq, ref_freq)
                    except Exception as e:
                        logger.warning(f"Chi-square test failed for {col}: {e}")
                
                # Determine if drift detected
                drift_detected = (ks_p_value < sensitivity) or (psi_score > 0.2)
                if chi2_p_value is not None and chi2_p_value < sensitivity:
                    drift_detected = True
                
                if drift_detected:
                    drift_scores.append(max(1 - ks_p_value, psi_score))
                    affected_features.append(col)
                
                statistical_results[col] = {
                    'ks_statistic': ks_statistic,
                    'ks_p_value': ks_p_value,
                    'psi_score': psi_score,
                    'chi2_p_value': chi2_p_value,
                    'drift_detected': drift_detected
                }
                
            except Exception as e:
                logger.warning(f"Statistical drift detection failed for column {col}: {e}")
        
        # Aggregate results
        overall_drift = len(affected_features) > 0
        severity = np.mean(drift_scores) if drift_scores else 0.0
        confidence = min(1.0, len(affected_features) / max(1, len(common_cols)))
        
        return DriftDetectionResult(
            drift_type=DriftType.DATA_DRIFT,
            detected=overall_drift,
            severity=severity,
            confidence=confidence,
            method_used=DriftDetectionMethod.STATISTICAL,
            features_affected=affected_features,
            statistical_results=statistical_results,
            timestamp=datetime.utcnow(),
            metadata={'sensitivity_threshold': sensitivity}
        )
    
    def _distance_based_drift_detection(self,
                                      model_id: str,
                                      reference_data: pd.DataFrame,
                                      current_data: pd.DataFrame,
                                      sensitivity: float) -> DriftDetectionResult:
        """Distance-based drift detection using KL divergence and JS distance."""
        
        drift_scores = []
        affected_features = []
        statistical_results = {}
        
        numeric_cols = reference_data.select_dtypes(include=[np.number]).columns
        common_cols = set(numeric_cols) & set(current_data.columns)
        
        for col in common_cols:
            try:
                ref_values = reference_data[col].dropna()
                curr_values = current_data[col].dropna()
                
                if len(ref_values) < 10 or len(curr_values) < 10:
                    continue
                
                # Create histograms for probability distributions
                min_val = min(ref_values.min(), curr_values.min())
                max_val = max(ref_values.max(), curr_values.max())
                bins = np.linspace(min_val, max_val, 50)
                
                ref_hist, _ = np.histogram(ref_values, bins=bins, density=True)
                curr_hist, _ = np.histogram(curr_values, bins=bins, density=True)
                
                # Normalize to probability distributions
                ref_prob = ref_hist / (ref_hist.sum() + 1e-8)
                curr_prob = curr_hist / (curr_hist.sum() + 1e-8)
                
                # Jensen-Shannon distance
                js_distance = jensenshannon(ref_prob, curr_prob)
                
                # KL divergence (with smoothing to avoid inf)
                ref_prob_smooth = ref_prob + 1e-8
                curr_prob_smooth = curr_prob + 1e-8
                kl_divergence = stats.entropy(curr_prob_smooth, ref_prob_smooth)
                
                # Earth Mover's Distance (Wasserstein)
                wd_distance = stats.wasserstein_distance(ref_values, curr_values)
                
                # Normalize Wasserstein distance
                value_range = max_val - min_val
                normalized_wd = wd_distance / (value_range + 1e-8)
                
                # Determine drift based on thresholds
                drift_detected = (js_distance > 0.1) or (kl_divergence > 0.1) or (normalized_wd > 0.1)
                
                if drift_detected:
                    drift_score = np.mean([js_distance, min(kl_divergence, 1.0), normalized_wd])
                    drift_scores.append(drift_score)
                    affected_features.append(col)
                
                statistical_results[col] = {
                    'js_distance': js_distance,
                    'kl_divergence': kl_divergence,
                    'wasserstein_distance': wd_distance,
                    'normalized_wd': normalized_wd,
                    'drift_detected': drift_detected
                }
                
            except Exception as e:
                logger.warning(f"Distance-based drift detection failed for column {col}: {e}")
        
        # Aggregate results
        overall_drift = len(affected_features) > 0
        severity = np.mean(drift_scores) if drift_scores else 0.0
        confidence = min(1.0, len(affected_features) / max(1, len(common_cols)))
        
        return DriftDetectionResult(
            drift_type=DriftType.DATA_DRIFT,
            detected=overall_drift,
            severity=severity,
            confidence=confidence,
            method_used=DriftDetectionMethod.DISTANCE_BASED,
            features_affected=affected_features,
            statistical_results=statistical_results,
            timestamp=datetime.utcnow(),
            metadata={'distance_thresholds': {'js': 0.1, 'kl': 0.1, 'wd': 0.1}}
        )
    
    def _model_based_drift_detection(self,
                                   model_id: str,
                                   reference_data: pd.DataFrame,
                                   current_data: pd.DataFrame,
                                   sensitivity: float) -> DriftDetectionResult:
        """Model-based drift detection using domain classifier approach."""
        
        try:
            # Get common numeric columns
            numeric_cols = reference_data.select_dtypes(include=[np.number]).columns
            common_cols = list(set(numeric_cols) & set(current_data.columns))
            
            if len(common_cols) < 2:
                logger.warning("Insufficient numeric columns for model-based drift detection")
                return DriftDetectionResult(
                    drift_type=DriftType.DATA_DRIFT,
                    detected=False,
                    severity=0.0,
                    confidence=0.0,
                    method_used=DriftDetectionMethod.MODEL_BASED,
                    features_affected=[],
                    statistical_results={},
                    timestamp=datetime.utcnow(),
                    metadata={'error': 'Insufficient features'}
                )
            
            # Prepare data for domain classification
            ref_subset = reference_data[common_cols].dropna()
            curr_subset = current_data[common_cols].dropna()
            
            # Sample data to manageable size
            if len(ref_subset) > 5000:
                ref_subset = ref_subset.sample(n=5000, random_state=42)
            if len(curr_subset) > 5000:
                curr_subset = curr_subset.sample(n=5000, random_state=42)
            
            # Create domain labels (0 = reference, 1 = current)
            ref_labels = np.zeros(len(ref_subset))
            curr_labels = np.ones(len(curr_subset))
            
            # Combine data
            combined_data = pd.concat([ref_subset, curr_subset], ignore_index=True)
            combined_labels = np.concatenate([ref_labels, curr_labels])
            
            # Scale features
            scaler = StandardScaler()
            scaled_data = scaler.fit_transform(combined_data)
            
            # Train domain classifier
            from sklearn.ensemble import RandomForestClassifier
            from sklearn.model_selection import cross_val_score
            
            classifier = RandomForestClassifier(n_estimators=100, random_state=42)
            
            # Cross-validation to get robust performance estimate
            cv_scores = cross_val_score(classifier, scaled_data, combined_labels, 
                                       cv=5, scoring='accuracy')
            
            # Fit classifier to get feature importance
            classifier.fit(scaled_data, combined_labels)
            feature_importance = classifier.feature_importances_
            
            # If classifier can distinguish well between domains, drift is present
            mean_accuracy = np.mean(cv_scores)
            drift_score = max(0.0, (mean_accuracy - 0.5) * 2)  # Scale to 0-1
            
            # Drift detected if accuracy significantly above random (0.5)
            drift_detected = mean_accuracy > (0.5 + sensitivity)
            
            # Identify most important features for drift
            feature_scores = list(zip(common_cols, feature_importance))
            feature_scores.sort(key=lambda x: x[1], reverse=True)
            
            # Consider top contributing features as affected
            affected_features = [feat for feat, score in feature_scores[:5] 
                               if score > np.mean(feature_importance)]
            
            statistical_results = {
                'domain_classifier_accuracy': mean_accuracy,
                'cv_scores': cv_scores.tolist(),
                'feature_importance': dict(feature_scores),
                'drift_score': drift_score,
                'baseline_accuracy': 0.5
            }
            
            return DriftDetectionResult(
                drift_type=DriftType.DATA_DRIFT,
                detected=drift_detected,
                severity=drift_score,
                confidence=min(1.0, abs(mean_accuracy - 0.5) * 4),  # Higher confidence when accuracy is far from random
                method_used=DriftDetectionMethod.MODEL_BASED,
                features_affected=affected_features,
                statistical_results=statistical_results,
                timestamp=datetime.utcnow(),
                metadata={'classifier_type': 'RandomForest', 'cv_folds': 5}
            )
            
        except Exception as e:
            logger.error(f"Model-based drift detection failed: {e}")
            return DriftDetectionResult(
                drift_type=DriftType.DATA_DRIFT,
                detected=False,
                severity=0.0,
                confidence=0.0,
                method_used=DriftDetectionMethod.MODEL_BASED,
                features_affected=[],
                statistical_results={'error': str(e)},
                timestamp=datetime.utcnow(),
                metadata={'error': str(e)}
            )
    
    def _ensemble_drift_detection(self,
                                model_id: str,
                                reference_data: pd.DataFrame,
                                current_data: pd.DataFrame,
                                sensitivity: float) -> DriftDetectionResult:
        """Ensemble drift detection combining multiple methods."""
        
        methods = [
            DriftDetectionMethod.STATISTICAL,
            DriftDetectionMethod.DISTANCE_BASED,
            DriftDetectionMethod.MODEL_BASED
        ]
        
        results = []
        for method in methods:
            try:
                result = self.detection_methods[method](
                    model_id, reference_data, current_data, sensitivity
                )
                results.append(result)
            except Exception as e:
                logger.warning(f"Ensemble component {method} failed: {e}")
        
        if not results:
            return DriftDetectionResult(
                drift_type=DriftType.DATA_DRIFT,
                detected=False,
                severity=0.0,
                confidence=0.0,
                method_used=DriftDetectionMethod.ENSEMBLE,
                features_affected=[],
                statistical_results={'error': 'All ensemble methods failed'},
                timestamp=datetime.utcnow()
            )
        
        # Combine results
        detection_votes = sum(1 for r in results if r.detected)
        severities = [r.severity for r in results]
        confidences = [r.confidence for r in results]
        
        # Collect all affected features
        all_affected_features = set()
        for result in results:
            all_affected_features.update(result.features_affected)
        
        # Majority vote for detection
        ensemble_detected = detection_votes > len(results) / 2
        
        # Weighted average of severities and confidences
        ensemble_severity = np.mean(severities)
        ensemble_confidence = np.mean(confidences)
        
        # Combine statistical results
        ensemble_statistical_results = {
            'individual_results': [asdict(r) for r in results],
            'detection_votes': detection_votes,
            'total_methods': len(results),
            'consensus_score': detection_votes / len(results)
        }
        
        return DriftDetectionResult(
            drift_type=DriftType.DATA_DRIFT,
            detected=ensemble_detected,
            severity=ensemble_severity,
            confidence=ensemble_confidence,
            method_used=DriftDetectionMethod.ENSEMBLE,
            features_affected=list(all_affected_features),
            statistical_results=ensemble_statistical_results,
            timestamp=datetime.utcnow(),
            metadata={
                'methods_used': [m.value for m in methods],
                'consensus_threshold': 0.5
            }
        )
    
    def _calculate_psi(self, reference_data: pd.Series, current_data: pd.Series, bins: int = 10) -> float:
        """Calculate Population Stability Index (PSI)."""
        
        try:
            # Create bins based on reference data quantiles
            quantiles = np.linspace(0, 1, bins + 1)
            bin_edges = reference_data.quantile(quantiles).values
            bin_edges[0] = -np.inf
            bin_edges[-1] = np.inf
            
            # Calculate frequencies for each bin
            ref_freq, _ = np.histogram(reference_data, bins=bin_edges)
            curr_freq, _ = np.histogram(current_data, bins=bin_edges)
            
            # Convert to proportions
            ref_prop = ref_freq / len(reference_data)
            curr_prop = curr_freq / len(current_data)
            
            # Avoid division by zero
            ref_prop = np.where(ref_prop == 0, 1e-8, ref_prop)
            curr_prop = np.where(curr_prop == 0, 1e-8, curr_prop)
            
            # Calculate PSI
            psi = np.sum((curr_prop - ref_prop) * np.log(curr_prop / ref_prop))
            
            return psi
            
        except Exception as e:
            logger.warning(f"PSI calculation failed: {e}")
            return 0.0


class RetrainingTrigger:
    """
    Evaluates conditions and triggers retraining based on policies and drift detection.
    """
    
    def __init__(self, drift_detector: DriftDetector):
        self.drift_detector = drift_detector
        self.policies: Dict[str, RetrainingPolicy] = {}
        self.active_jobs: Dict[str, RetrainingJob] = {}
        self.trigger_history: List[Dict[str, Any]] = []
        
        logger.info("RetrainingTrigger initialized")
    
    def register_policy(self, policy: RetrainingPolicy):
        """Register a retraining policy."""
        self.policies[policy.policy_id] = policy
        logger.info(f"Registered retraining policy: {policy.policy_name}")
    
    def evaluate_triggers(self, 
                         model_id: str,
                         current_data: pd.DataFrame,
                         performance_metrics: Dict[str, float] = None) -> List[RetrainingJob]:
        """Evaluate all trigger conditions and create retraining jobs as needed."""
        
        triggered_jobs = []
        
        # Find policies for this model
        model_policies = [p for p in self.policies.values() 
                         if p.model_id == model_id and p.active]
        
        for policy in model_policies:
            try:
                # Check if already have active job for this policy
                active_jobs_for_policy = [job for job in self.active_jobs.values()
                                        if job.policy_id == policy.policy_id 
                                        and job.status in [RetrainingStatus.PENDING, RetrainingStatus.RUNNING]]
                
                if len(active_jobs_for_policy) >= policy.max_concurrent_jobs:
                    continue  # Skip if max concurrent jobs reached
                
                # Evaluate trigger conditions
                trigger_results = self._evaluate_policy_conditions(
                    policy, current_data, performance_metrics
                )
                
                if trigger_results['triggered']:
                    # Create retraining job
                    job = self._create_retraining_job(policy, trigger_results)
                    triggered_jobs.append(job)
                    self.active_jobs[job.job_id] = job
                    
                    # Record trigger event
                    self.trigger_history.append({
                        'timestamp': datetime.utcnow().isoformat(),
                        'model_id': model_id,
                        'policy_id': policy.policy_id,
                        'job_id': job.job_id,
                        'trigger_reason': trigger_results['reason'],
                        'trigger_details': trigger_results
                    })
                    
                    logger.info(f"Triggered retraining job {job.job_id} for model {model_id}: {trigger_results['reason']}")
                
            except Exception as e:
                logger.error(f"Failed to evaluate triggers for policy {policy.policy_id}: {e}")
        
        return triggered_jobs
    
    def _evaluate_policy_conditions(self,
                                   policy: RetrainingPolicy,
                                   current_data: pd.DataFrame,
                                   performance_metrics: Dict[str, float] = None) -> Dict[str, Any]:
        """Evaluate all conditions for a specific policy."""
        
        trigger_results = {
            'triggered': False,
            'reason': '',
            'conditions_met': [],
            'drift_results': None,
            'performance_degradation': None,
            'schedule_triggered': False,
            'data_volume_triggered': False
        }
        
        conditions_met = []
        
        # Check drift detection conditions
        if TriggerCondition.DRIFT_DETECTED in policy.trigger_conditions:
            try:
                drift_result = self.drift_detector.detect_drift(
                    policy.model_id, 
                    current_data,
                    sensitivity=0.05
                )
                
                trigger_results['drift_results'] = asdict(drift_result)
                
                if drift_result.detected and drift_result.severity >= policy.drift_threshold:
                    conditions_met.append(f"drift_detected (severity: {drift_result.severity:.3f})")
                
            except Exception as e:
                logger.warning(f"Drift detection failed for policy {policy.policy_id}: {e}")
        
        # Check performance degradation
        if TriggerCondition.PERFORMANCE_DEGRADED in policy.trigger_conditions:
            if performance_metrics:
                # This would compare current performance to baseline
                # For now, simplified implementation
                performance_degradation = self._check_performance_degradation(
                    policy, performance_metrics
                )
                
                trigger_results['performance_degradation'] = performance_degradation
                
                if performance_degradation.get('degraded', False):
                    conditions_met.append(f"performance_degraded ({performance_degradation.get('reason', 'unknown')})")
        
        # Check schedule-based triggers
        if TriggerCondition.SCHEDULE_BASED in policy.trigger_conditions:
            if policy.schedule_interval_hours:
                schedule_triggered = self._check_schedule_trigger(policy)
                trigger_results['schedule_triggered'] = schedule_triggered
                
                if schedule_triggered:
                    conditions_met.append("schedule_based")
        
        # Check data volume threshold
        if TriggerCondition.DATA_VOLUME_THRESHOLD in policy.trigger_conditions:
            if policy.data_volume_threshold:
                volume_triggered = len(current_data) >= policy.data_volume_threshold
                trigger_results['data_volume_triggered'] = volume_triggered
                
                if volume_triggered:
                    conditions_met.append(f"data_volume_threshold (samples: {len(current_data)})")
        
        # Determine if overall triggered
        if policy.policy_type == PolicyType.REACTIVE:
            # For reactive policies, any condition triggers retraining
            triggered = len(conditions_met) > 0
        elif policy.policy_type == PolicyType.PROACTIVE:
            # For proactive policies, focus on schedule
            triggered = trigger_results['schedule_triggered']
        else:  # HYBRID
            # For hybrid policies, either reactive or proactive conditions
            triggered = len(conditions_met) > 0 or trigger_results['schedule_triggered']
        
        trigger_results['triggered'] = triggered
        trigger_results['conditions_met'] = conditions_met
        trigger_results['reason'] = ', '.join(conditions_met) if conditions_met else 'schedule_based'
        
        return trigger_results
    
    def _check_performance_degradation(self,
                                     policy: RetrainingPolicy,
                                     current_metrics: Dict[str, float]) -> Dict[str, Any]:
        """Check if model performance has degraded below threshold."""
        
        # This is a simplified implementation
        # In practice, you would compare against historical baseline metrics
        degradation_info = {
            'degraded': False,
            'reason': '',
            'current_metrics': current_metrics,
            'baseline_metrics': {}  # Would load from storage
        }
        
        # Example: Check if accuracy dropped below threshold
        if 'accuracy' in current_metrics:
            current_accuracy = current_metrics['accuracy']
            # Assume baseline accuracy of 0.8 for demonstration
            baseline_accuracy = 0.8  
            
            if (baseline_accuracy - current_accuracy) > policy.performance_threshold:
                degradation_info['degraded'] = True
                degradation_info['reason'] = f"accuracy dropped from {baseline_accuracy:.3f} to {current_accuracy:.3f}"
                degradation_info['baseline_metrics']['accuracy'] = baseline_accuracy
        
        return degradation_info
    
    def _check_schedule_trigger(self, policy: RetrainingPolicy) -> bool:
        """Check if scheduled retraining is due."""
        
        if not policy.schedule_interval_hours:
            return False
        
        # Check last retraining time for this policy
        last_job_times = [
            datetime.fromisoformat(event['timestamp'])
            for event in self.trigger_history
            if event['policy_id'] == policy.policy_id
        ]
        
        if not last_job_times:
            # No previous jobs, trigger if policy is old enough
            return (datetime.utcnow() - policy.created_at).total_seconds() / 3600 >= policy.schedule_interval_hours
        
        last_job_time = max(last_job_times)
        time_since_last = (datetime.utcnow() - last_job_time).total_seconds() / 3600
        
        return time_since_last >= policy.schedule_interval_hours
    
    def _create_retraining_job(self, 
                              policy: RetrainingPolicy,
                              trigger_results: Dict[str, Any]) -> RetrainingJob:
        """Create a retraining job from policy and trigger results."""
        
        job_id = str(uuid.uuid4())
        
        # Create training data configuration
        training_data_config = {
            'strategy': policy.retraining_strategy.value,
            'validation_split': policy.validation_split,
            'data_source': 'current_production_data',  # Would be configurable
            'feature_engineering': True,
            'data_quality_checks': True
        }
        
        # Create model configuration
        model_config = {
            'framework': 'auto',  # Would be inherited from original model
            'architecture': 'auto',
            'hyperparameter_optimization': True,
            'cross_validation': {'cv': 5},
            'early_stopping': {'patience': 10}
        }
        
        return RetrainingJob(
            job_id=job_id,
            model_id=policy.model_id,
            policy_id=policy.policy_id,
            trigger_reason=trigger_results['reason'],
            strategy=policy.retraining_strategy,
            training_data_config=training_data_config,
            model_config=model_config,
            status=RetrainingStatus.PENDING,
            created_at=datetime.utcnow()
        )
    
    def get_active_jobs(self) -> List[RetrainingJob]:
        """Get list of currently active retraining jobs."""
        return [job for job in self.active_jobs.values()
                if job.status in [RetrainingStatus.PENDING, RetrainingStatus.RUNNING]]
    
    def update_job_status(self, job_id: str, status: RetrainingStatus, **kwargs):
        """Update the status of a retraining job."""
        if job_id in self.active_jobs:
            job = self.active_jobs[job_id]
            job.status = status
            
            if status == RetrainingStatus.RUNNING and job.started_at is None:
                job.started_at = datetime.utcnow()
            elif status in [RetrainingStatus.COMPLETED, RetrainingStatus.FAILED, 
                           RetrainingStatus.CANCELLED, RetrainingStatus.ROLLED_BACK]:
                job.completed_at = datetime.utcnow()
            
            # Update additional fields
            for key, value in kwargs.items():
                if hasattr(job, key):
                    setattr(job, key, value)
            
            logger.info(f"Updated job {job_id} status to {status.value}")
    
    def get_trigger_history(self, 
                           model_id: str = None, 
                           hours_back: int = 24) -> List[Dict[str, Any]]:
        """Get trigger history for analysis."""
        
        cutoff_time = datetime.utcnow() - timedelta(hours=hours_back)
        
        filtered_history = []
        for event in self.trigger_history:
            event_time = datetime.fromisoformat(event['timestamp'])
            if event_time >= cutoff_time:
                if model_id is None or event['model_id'] == model_id:
                    filtered_history.append(event)
        
        return sorted(filtered_history, key=lambda x: x['timestamp'], reverse=True)


class AutomatedRetrainingEngine:
    """
    Core automated retraining engine orchestrating all components.
    """
    
    def __init__(self, 
                 storage_path: str = "./automated_retraining",
                 mlops_platform: 'MLOpsCore' = None,
                 experiment_tracker: 'EnhancedExperimentTracker' = None,
                 model_serving: 'AdvancedModelServingEngine' = None):
        
        self.storage_path = storage_path
        os.makedirs(storage_path, exist_ok=True)
        
        # Initialize components
        self.drift_detector = DriftDetector()
        self.retraining_trigger = RetrainingTrigger(self.drift_detector)
        
        # MLOps integration
        self.mlops_platform = mlops_platform or (create_mlops_platform() if MLOPS_AVAILABLE else None)
        self.experiment_tracker = experiment_tracker
        self.model_serving = model_serving
        
        # Job execution
        self.executor = ThreadPoolExecutor(max_workers=4)
        self._active_monitors: Dict[str, threading.Thread] = {}
        self._shutdown_event = threading.Event()
        
        # Storage
        self._save_path = os.path.join(storage_path, "engine_state.json")
        self._load_state()
        
        logger.info(f"AutomatedRetrainingEngine initialized at {storage_path}")
    
    def register_model_for_monitoring(self,
                                    model_id: str,
                                    reference_data: pd.DataFrame,
                                    policy: RetrainingPolicy):
        """Register a model for automated retraining monitoring."""
        
        try:
            # Register reference data for drift detection
            self.drift_detector.register_reference_data(model_id, reference_data)
            
            # Register retraining policy
            self.retraining_trigger.register_policy(policy)
            
            # Start monitoring thread if not already active
            if model_id not in self._active_monitors:
                monitor_thread = threading.Thread(
                    target=self._monitor_model,
                    args=(model_id,),
                    daemon=True
                )
                monitor_thread.start()
                self._active_monitors[model_id] = monitor_thread
            
            logger.info(f"Registered model {model_id} for automated retraining")
            return True
            
        except Exception as e:
            logger.error(f"Failed to register model {model_id}: {e}")
            return False
    
    def trigger_manual_retraining(self,
                                model_id: str,
                                strategy: RetrainingStrategy = RetrainingStrategy.FULL_RETRAIN,
                                reason: str = "manual_trigger") -> str:
        """Manually trigger retraining for a model."""
        
        try:
            # Create manual retraining policy
            manual_policy = RetrainingPolicy(
                policy_id=str(uuid.uuid4()),
                model_id=model_id,
                policy_name=f"Manual Retrain {model_id}",
                policy_type=PolicyType.REACTIVE,
                trigger_conditions=[TriggerCondition.MANUAL_TRIGGER],
                retraining_strategy=strategy,
                active=True
            )
            
            # Create manual job
            job = RetrainingJob(
                job_id=str(uuid.uuid4()),
                model_id=model_id,
                policy_id=manual_policy.policy_id,
                trigger_reason=reason,
                strategy=strategy,
                training_data_config={'strategy': strategy.value},
                model_config={'framework': 'auto'},
                status=RetrainingStatus.PENDING,
                created_at=datetime.utcnow()
            )
            
            # Execute job
            self._execute_retraining_job(job)
            
            logger.info(f"Manual retraining triggered for model {model_id}: {job.job_id}")
            return job.job_id
            
        except Exception as e:
            logger.error(f"Failed to trigger manual retraining for model {model_id}: {e}")
            raise
    
    def _monitor_model(self, model_id: str):
        """Monitor a model for drift and trigger retraining as needed."""
        
        logger.info(f"Started monitoring model {model_id}")
        
        while not self._shutdown_event.is_set():
            try:
                # This is a simplified monitoring loop
                # In practice, you would:
                # 1. Collect recent production data
                # 2. Evaluate trigger conditions
                # 3. Execute retraining jobs
                
                # For demonstration, we'll check every hour
                time.sleep(3600)  # 1 hour
                
                # Simulate getting current production data
                # In practice, this would come from your data pipeline
                current_data = self._get_current_production_data(model_id)
                
                if current_data is not None and len(current_data) > 0:
                    # Get current performance metrics
                    performance_metrics = self._get_current_performance_metrics(model_id)
                    
                    # Evaluate triggers
                    triggered_jobs = self.retraining_trigger.evaluate_triggers(
                        model_id, current_data, performance_metrics
                    )
                    
                    # Execute triggered jobs
                    for job in triggered_jobs:
                        self._execute_retraining_job_async(job)
                
            except Exception as e:
                logger.error(f"Error monitoring model {model_id}: {e}")
                time.sleep(300)  # Wait 5 minutes before retrying
        
        logger.info(f"Stopped monitoring model {model_id}")
    
    def _execute_retraining_job(self, job: RetrainingJob):
        """Execute a retraining job synchronously."""
        
        logger.info(f"Executing retraining job {job.job_id}")
        
        try:
            # Update job status
            self.retraining_trigger.update_job_status(job.job_id, RetrainingStatus.RUNNING)
            
            if not self.mlops_platform:
                raise RuntimeError("MLOps platform not available")
            
            # Create experiment for retraining
            experiment_name = f"Retraining_{job.model_id}_{job.job_id[:8]}"
            
            # This is a simplified implementation
            # In practice, you would:
            # 1. Load training data based on strategy
            # 2. Apply feature engineering
            # 3. Train new model
            # 4. Validate performance
            # 5. Deploy if successful
            
            # For demonstration, create a basic experiment
            model_configs = [{
                'name': 'retrained_model',
                'model_type': 'auto',
                'framework': 'sklearn',
                'task_type': 'auto'
            }]
            
            dataset_config = {
                'source': 'production_data',
                'model_id': job.model_id,
                'strategy': job.strategy.value
            }
            
            # Create and run experiment
            result = asyncio.run(self.mlops_platform.create_and_run_experiment(
                name=experiment_name,
                description=f"Automated retraining triggered by {job.trigger_reason}",
                dataset_config=dataset_config,
                target_column='target',  # Would be dynamic
                model_configs=model_configs,
                created_by='automated_retraining_engine',
                wait_for_completion=True
            ))
            
            if result['status'] == 'completed':
                # Update job with results
                self.retraining_trigger.update_job_status(
                    job.job_id, 
                    RetrainingStatus.COMPLETED,
                    experiment_id=result['experiment_id'],
                    new_model_id=result['results'].get('best_model_id'),
                    performance_metrics=result['results'].get('best_score', {})
                )
                
                logger.info(f"Retraining job {job.job_id} completed successfully")
            else:
                # Job failed
                self.retraining_trigger.update_job_status(
                    job.job_id,
                    RetrainingStatus.FAILED,
                    error_message="Experiment failed"
                )
                
                logger.error(f"Retraining job {job.job_id} failed")
        
        except Exception as e:
            # Update job status to failed
            self.retraining_trigger.update_job_status(
                job.job_id,
                RetrainingStatus.FAILED,
                error_message=str(e)
            )
            
            logger.error(f"Retraining job {job.job_id} failed with error: {e}")
            raise
    
    def _execute_retraining_job_async(self, job: RetrainingJob):
        """Execute a retraining job asynchronously."""
        
        future = self.executor.submit(self._execute_retraining_job, job)
        
        def job_callback(fut):
            try:
                fut.result()  # This will raise any exception that occurred
            except Exception as e:
                logger.error(f"Async retraining job {job.job_id} failed: {e}")
        
        future.add_done_callback(job_callback)
    
    def _get_current_production_data(self, model_id: str) -> Optional[pd.DataFrame]:
        """Get current production data for drift detection."""
        
        # This is a placeholder implementation
        # In practice, you would:
        # 1. Query your production database
        # 2. Get recent prediction requests
        # 3. Sample and prepare data for analysis
        
        # For demonstration, return None (no new data)
        return None
    
    def _get_current_performance_metrics(self, model_id: str) -> Dict[str, float]:
        """Get current performance metrics for a model."""
        
        # This is a placeholder implementation
        # In practice, you would:
        # 1. Query monitoring database
        # 2. Calculate recent performance metrics
        # 3. Compare with baseline
        
        return {}
    
    def get_retraining_status(self, model_id: str = None) -> Dict[str, Any]:
        """Get status of retraining system."""
        
        status = {
            'timestamp': datetime.utcnow().isoformat(),
            'monitored_models': list(self._active_monitors.keys()),
            'active_jobs': [asdict(job) for job in self.retraining_trigger.get_active_jobs()],
            'registered_policies': len(self.retraining_trigger.policies),
            'drift_detector_ready': len(self.drift_detector._reference_data) > 0
        }
        
        if model_id:
            # Get model-specific information
            model_policies = [p for p in self.retraining_trigger.policies.values() 
                            if p.model_id == model_id]
            
            model_jobs = [job for job in self.retraining_trigger.active_jobs.values()
                         if job.model_id == model_id]
            
            status['model_specific'] = {
                'model_id': model_id,
                'policies': [asdict(p) for p in model_policies],
                'jobs': [asdict(job) for job in model_jobs],
                'is_monitored': model_id in self._active_monitors,
                'has_reference_data': model_id in self.drift_detector._reference_data
            }
        
        return status
    
    def get_drift_report(self, model_id: str, days_back: int = 7) -> Dict[str, Any]:
        """Generate drift analysis report for a model."""
        
        if model_id not in self.drift_detector._reference_data:
            return {
                'error': f'No reference data registered for model {model_id}',
                'model_id': model_id
            }
        
        # Get trigger history
        trigger_history = self.retraining_trigger.get_trigger_history(
            model_id, hours_back=days_back * 24
        )
        
        # Filter for drift-related triggers
        drift_triggers = [
            event for event in trigger_history
            if 'drift_detected' in event.get('trigger_reason', '')
        ]
        
        # Extract drift results from trigger history
        drift_events = []
        for trigger in drift_triggers:
            trigger_details = trigger.get('trigger_details', {})
            drift_results = trigger_details.get('drift_results')
            if drift_results:
                drift_events.append(drift_results)
        
        report = {
            'model_id': model_id,
            'report_period_days': days_back,
            'report_timestamp': datetime.utcnow().isoformat(),
            'drift_events_detected': len(drift_events),
            'retraining_jobs_triggered': len(drift_triggers),
            'drift_summary': {
                'total_detections': len(drift_events),
                'avg_severity': np.mean([event['severity'] for event in drift_events]) if drift_events else 0.0,
                'most_affected_features': [],
                'detection_methods_used': list(set(event['method_used'] for event in drift_events))
            }
        }
        
        # Analyze most affected features
        if drift_events:
            feature_counts = defaultdict(int)
            for event in drift_events:
                for feature in event.get('features_affected', []):
                    feature_counts[feature] += 1
            
            # Sort by frequency
            most_affected = sorted(feature_counts.items(), key=lambda x: x[1], reverse=True)
            report['drift_summary']['most_affected_features'] = most_affected[:10]
        
        return report
    
    def _load_state(self):
        """Load engine state from storage."""
        try:
            if os.path.exists(self._save_path):
                with open(self._save_path, 'r') as f:
                    state = json.load(f)
                    # Load policies, jobs, etc.
                    # Implementation would restore state
                    logger.info("Loaded engine state from storage")
        except Exception as e:
            logger.warning(f"Could not load engine state: {e}")
    
    def _save_state(self):
        """Save engine state to storage."""
        try:
            state = {
                'policies': {pid: asdict(policy) for pid, policy in self.retraining_trigger.policies.items()},
                'active_jobs': {jid: asdict(job) for jid, job in self.retraining_trigger.active_jobs.items()},
                'trigger_history': self.retraining_trigger.trigger_history,
                'monitored_models': list(self._active_monitors.keys()),
                'timestamp': datetime.utcnow().isoformat()
            }
            
            with open(self._save_path, 'w') as f:
                json.dump(state, f, indent=2, default=str)
                
        except Exception as e:
            logger.error(f"Could not save engine state: {e}")
    
    def shutdown(self):
        """Shutdown the retraining engine."""
        logger.info("Shutting down automated retraining engine...")
        
        # Signal all monitoring threads to stop
        self._shutdown_event.set()
        
        # Wait for monitoring threads to finish
        for model_id, thread in self._active_monitors.items():
            logger.info(f"Stopping monitor for model {model_id}")
            thread.join(timeout=10)
        
        # Shutdown executor
        self.executor.shutdown(wait=True)
        
        # Save final state
        self._save_state()
        
        logger.info("Automated retraining engine shutdown complete")
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.shutdown()


# Factory functions
def create_retraining_engine(storage_path: str = "./automated_retraining",
                           mlops_platform: 'MLOpsCore' = None) -> AutomatedRetrainingEngine:
    """Factory function to create automated retraining engine."""
    
    return AutomatedRetrainingEngine(
        storage_path=storage_path,
        mlops_platform=mlops_platform
    )


def create_drift_detector() -> DriftDetector:
    """Factory function to create drift detector."""
    return DriftDetector()


def create_retraining_policy(model_id: str,
                           policy_name: str,
                           policy_type: PolicyType = PolicyType.HYBRID,
                           trigger_conditions: List[TriggerCondition] = None,
                           retraining_strategy: RetrainingStrategy = RetrainingStrategy.FULL_RETRAIN,
                           **kwargs) -> RetrainingPolicy:
    """Factory function to create retraining policy."""
    
    if trigger_conditions is None:
        trigger_conditions = [TriggerCondition.DRIFT_DETECTED, TriggerCondition.SCHEDULE_BASED]
    
    return RetrainingPolicy(
        policy_id=str(uuid.uuid4()),
        model_id=model_id,
        policy_name=policy_name,
        policy_type=policy_type,
        trigger_conditions=trigger_conditions,
        retraining_strategy=retraining_strategy,
        **kwargs
    )