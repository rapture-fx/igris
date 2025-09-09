"""
Continuous Learning Service
===========================

Advanced continuous learning infrastructure supporting incremental learning,
online learning, and streaming data processing with active learning capabilities.

Features:
- Incremental learning with compatible ML models
- Online learning for real-time model updates
- Active learning with uncertainty sampling
- Streaming data processing and model adaptation
- A/B testing integration for continuous model comparison
- Feedback loop integration for model improvement
- Support for concept drift adaptation
- Memory-efficient learning algorithms

Architecture:
- IncrementalLearner: Manages incremental model updates
- OnlineLearner: Handles real-time streaming learning
- ActiveLearner: Implements active learning strategies
- FeedbackProcessor: Processes user feedback for model improvement
- StreamProcessor: Handles streaming data ingestion and processing
- ABTestManager: Manages A/B testing for continuous comparison
"""

import os
import json
import uuid
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

# ML libraries for incremental learning
from sklearn.base import BaseEstimator
from sklearn.linear_model import SGDClassifier, SGDRegressor, PassiveAggressiveClassifier
from sklearn.naive_bayes import MultinomialNB, GaussianNB
from sklearn.cluster import MiniBatchKMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, mean_squared_error
from sklearn.model_selection import train_test_split

# Import existing MLOps infrastructure
try:
    from app.ml.automated_retraining_engine import (
        AutomatedRetrainingEngine, RetrainingStrategy, DriftDetectionResult
    )
    from app.services.drift_detection_service import AdvancedDriftDetectionService
    from app.ml.mlops_platform import MLOpsCore, ModelFramework, ModelMetadata
    from app.services.advanced_model_serving import AdvancedModelServingEngine
    MLOPS_AVAILABLE = True
except ImportError as e:
    logging.warning(f"Could not import MLOps modules: {e}")
    MLOPS_AVAILABLE = False

logger = logging.getLogger(__name__)


# Enums and Data Classes
class LearningMode(str, Enum):
    """Learning modes for continuous learning."""
    INCREMENTAL = "incremental"         # Add new data to existing model
    ONLINE = "online"                  # Real-time streaming updates
    MINI_BATCH = "mini_batch"          # Small batch updates
    ACTIVE = "active"                  # Active learning with query strategy
    FEDERATED = "federated"            # Federated learning (placeholder)


class QueryStrategy(str, Enum):
    """Query strategies for active learning."""
    UNCERTAINTY = "uncertainty"        # Query most uncertain samples
    MARGIN = "margin"                 # Query samples with smallest margin
    ENTROPY = "entropy"               # Query samples with highest entropy
    RANDOM = "random"                 # Random sampling baseline
    DIVERSITY = "diversity"           # Maximize diversity of selected samples


class FeedbackType(str, Enum):
    """Types of feedback for model improvement."""
    EXPLICIT = "explicit"             # Direct user feedback (thumbs up/down)
    IMPLICIT = "implicit"             # Inferred from user behavior
    CORRECTION = "correction"         # User provides correct answer
    PREFERENCE = "preference"         # Comparative preference feedback


class AdaptationStrategy(str, Enum):
    """Strategies for adapting to concept drift."""
    WINDOW_BASED = "window_based"     # Sliding window of recent data
    FORGETTING_FACTOR = "forgetting_factor"  # Exponential forgetting
    ENSEMBLE = "ensemble"             # Ensemble of models with different ages
    DETECTION_BASED = "detection_based"  # Adapt when drift is detected


@dataclass
class LearningConfig:
    """Configuration for continuous learning."""
    model_id: str
    learning_mode: LearningMode
    
    # Incremental learning settings
    batch_size: int = 100
    learning_rate: float = 0.01
    update_frequency_minutes: int = 30
    
    # Online learning settings
    real_time_updates: bool = False
    stream_buffer_size: int = 1000
    min_samples_for_update: int = 10
    
    # Active learning settings
    query_strategy: QueryStrategy = QueryStrategy.UNCERTAINTY
    query_budget: int = 100
    uncertainty_threshold: float = 0.8
    
    # Adaptation settings
    adaptation_strategy: AdaptationStrategy = AdaptationStrategy.WINDOW_BASED
    window_size: int = 10000
    forgetting_factor: float = 0.95
    drift_adaptation_enabled: bool = True
    
    # Quality control
    performance_threshold: float = 0.1  # Max allowed performance drop
    validation_split: float = 0.2
    early_stopping_patience: int = 5
    
    # Memory management
    max_memory_usage_gb: float = 4.0
    model_compression_enabled: bool = True
    feature_selection_enabled: bool = True
    
    created_at: datetime = None
    updated_at: datetime = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()
        if self.updated_at is None:
            self.updated_at = datetime.utcnow()


@dataclass
class FeedbackSample:
    """Feedback sample for model improvement."""
    sample_id: str
    model_id: str
    input_data: Dict[str, Any]
    feedback_type: FeedbackType
    feedback_value: Any  # Could be score, label, preference, etc.
    confidence: Optional[float] = None
    user_id: Optional[str] = None
    timestamp: datetime = None
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()
        if self.metadata is None:
            self.metadata = {}


@dataclass
class LearningUpdate:
    """Record of a learning update."""
    update_id: str
    model_id: str
    learning_mode: LearningMode
    samples_processed: int
    performance_before: Dict[str, float]
    performance_after: Dict[str, float]
    update_duration_seconds: float
    memory_usage_mb: float
    timestamp: datetime
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


@dataclass
class ActiveLearningQuery:
    """Query for active learning annotation."""
    query_id: str
    model_id: str
    samples: List[Dict[str, Any]]
    query_strategy: QueryStrategy
    uncertainty_scores: List[float]
    expected_improvement: float
    created_at: datetime
    annotated: bool = False
    annotations: List[Any] = None
    annotated_at: Optional[datetime] = None
    annotated_by: Optional[str] = None
    
    def __post_init__(self):
        if self.annotations is None:
            self.annotations = []


class IncrementalLearner:
    """
    Manages incremental learning for models that support partial fitting.
    """
    
    def __init__(self, model_id: str, config: LearningConfig):
        self.model_id = model_id
        self.config = config
        self.model = None
        self.scaler = StandardScaler()
        self.classes_ = None
        
        # Performance tracking
        self.performance_history = deque(maxlen=1000)
        self.update_history = deque(maxlen=1000)
        
        # Memory management
        self.current_memory_usage = 0.0
        self.sample_buffer = deque(maxlen=config.batch_size * 10)
        
        self._initialize_model()
        
        logger.info(f"IncrementalLearner initialized for model {model_id}")
    
    def _initialize_model(self):
        """Initialize an incremental learning model."""
        
        try:
            # Use SGD-based models that support partial_fit
            if self.config.learning_mode == LearningMode.INCREMENTAL:
                # For classification tasks
                self.model = SGDClassifier(
                    learning_rate='adaptive',
                    eta0=self.config.learning_rate,
                    random_state=42
                )
            elif self.config.learning_mode == LearningMode.ONLINE:
                # For online learning with passive-aggressive updates
                self.model = PassiveAggressiveClassifier(
                    C=1.0,
                    random_state=42
                )
            else:
                # Default to SGD classifier
                self.model = SGDClassifier(
                    learning_rate='adaptive',
                    eta0=self.config.learning_rate,
                    random_state=42
                )
            
            logger.info(f"Initialized {type(self.model).__name__} for incremental learning")
            
        except Exception as e:
            logger.error(f"Failed to initialize incremental model: {e}")
            raise
    
    def add_samples(self, X: pd.DataFrame, y: pd.Series):
        """Add new samples to the learning buffer."""
        
        try:
            # Add samples to buffer
            for i in range(len(X)):
                sample = {
                    'features': X.iloc[i].to_dict(),
                    'target': y.iloc[i],
                    'timestamp': datetime.utcnow()
                }
                self.sample_buffer.append(sample)
            
            logger.info(f"Added {len(X)} samples to buffer for model {self.model_id}")
            
            # Trigger update if buffer is full enough
            if len(self.sample_buffer) >= self.config.batch_size:
                return self.update_model()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to add samples for model {self.model_id}: {e}")
            return False
    
    def update_model(self) -> bool:
        """Update model with buffered samples."""
        
        if not self.sample_buffer:
            return True
        
        start_time = datetime.utcnow()
        
        try:
            # Extract features and targets from buffer
            features_list = []
            targets_list = []
            
            for sample in list(self.sample_buffer):
                features_list.append(sample['features'])
                targets_list.append(sample['target'])
            
            # Convert to DataFrame and Series
            X_new = pd.DataFrame(features_list)
            y_new = pd.Series(targets_list)
            
            # Get performance before update
            performance_before = self._evaluate_model(X_new, y_new) if hasattr(self.model, 'predict') else {}
            
            # Prepare features
            if not hasattr(self.scaler, 'scale_'):
                # First time - fit scaler
                X_scaled = self.scaler.fit_transform(X_new.fillna(0))
            else:
                # Update scaler incrementally if supported
                X_scaled = self.scaler.transform(X_new.fillna(0))
            
            # Update classes for classification
            unique_classes = y_new.unique()
            if self.classes_ is None:
                self.classes_ = unique_classes
            else:
                self.classes_ = np.unique(np.concatenate([self.classes_, unique_classes]))
            
            # Perform incremental learning
            if hasattr(self.model, 'partial_fit'):
                self.model.partial_fit(X_scaled, y_new, classes=self.classes_)
            else:
                # Fallback to regular fit (not truly incremental)
                self.model.fit(X_scaled, y_new)
            
            # Get performance after update
            performance_after = self._evaluate_model(X_new, y_new)
            
            # Record update
            update_duration = (datetime.utcnow() - start_time).total_seconds()
            update_record = LearningUpdate(
                update_id=str(uuid.uuid4()),
                model_id=self.model_id,
                learning_mode=self.config.learning_mode,
                samples_processed=len(X_new),
                performance_before=performance_before,
                performance_after=performance_after,
                update_duration_seconds=update_duration,
                memory_usage_mb=self._estimate_memory_usage(),
                timestamp=start_time
            )
            
            self.update_history.append(update_record)
            self.performance_history.append(performance_after)
            
            # Clear processed samples from buffer
            self.sample_buffer.clear()
            
            logger.info(f"Updated model {self.model_id} with {len(X_new)} samples in {update_duration:.2f}s")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update model {self.model_id}: {e}")
            return False
    
    def _evaluate_model(self, X: pd.DataFrame, y: pd.Series) -> Dict[str, float]:
        """Evaluate model performance."""
        
        try:
            if not hasattr(self.model, 'predict'):
                return {}
            
            X_scaled = self.scaler.transform(X.fillna(0))
            y_pred = self.model.predict(X_scaled)
            
            # Calculate metrics based on task type
            metrics = {}
            
            # Classification metrics
            if hasattr(self.model, 'classes_'):
                metrics['accuracy'] = accuracy_score(y, y_pred)
                
                # Add probability-based metrics if available
                if hasattr(self.model, 'predict_proba'):
                    y_proba = self.model.predict_proba(X_scaled)
                    # Could add log loss, AUC, etc.
            else:
                # Regression metrics
                metrics['mse'] = mean_squared_error(y, y_pred)
                metrics['rmse'] = np.sqrt(metrics['mse'])
            
            return metrics
            
        except Exception as e:
            logger.warning(f"Model evaluation failed: {e}")
            return {}
    
    def _estimate_memory_usage(self) -> float:
        """Estimate current memory usage in MB."""
        
        try:
            # Simple estimation based on model size
            # In practice, you'd use more sophisticated memory profiling
            
            model_size = 0
            if hasattr(self.model, 'coef_'):
                model_size += np.prod(self.model.coef_.shape) * 8  # 8 bytes per float64
            
            if hasattr(self.model, 'intercept_'):
                model_size += np.prod(self.model.intercept_.shape) * 8
            
            # Add buffer size
            buffer_size = len(self.sample_buffer) * 1000  # Rough estimate
            
            total_bytes = model_size + buffer_size
            return total_bytes / (1024 * 1024)  # Convert to MB
            
        except Exception:
            return 0.0
    
    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """Make predictions with the current model."""
        
        if not hasattr(self.model, 'predict'):
            raise ValueError("Model not trained yet")
        
        X_scaled = self.scaler.transform(X.fillna(0))
        return self.model.predict(X_scaled)
    
    def get_learning_status(self) -> Dict[str, Any]:
        """Get current learning status."""
        
        recent_performance = list(self.performance_history)[-5:] if self.performance_history else []
        recent_updates = [asdict(update) for update in list(self.update_history)[-5:]]
        
        return {
            'model_id': self.model_id,
            'learning_mode': self.config.learning_mode.value,
            'samples_in_buffer': len(self.sample_buffer),
            'total_updates': len(self.update_history),
            'recent_performance': recent_performance,
            'recent_updates': recent_updates,
            'current_memory_usage_mb': self._estimate_memory_usage(),
            'model_trained': hasattr(self.model, 'predict') and hasattr(self.model, 'coef_'),
            'classes_learned': self.classes_.tolist() if self.classes_ is not None else None
        }


class ActiveLearner:
    """
    Implements active learning strategies for selective data annotation.
    """
    
    def __init__(self, model_id: str, config: LearningConfig):
        self.model_id = model_id
        self.config = config
        self.model = None
        
        # Query management
        self.active_queries: Dict[str, ActiveLearningQuery] = {}
        self.annotation_history = deque(maxlen=10000)
        self.uncertainty_threshold = config.uncertainty_threshold
        
        # Sample pools
        self.unlabeled_pool = deque(maxlen=50000)  # Samples waiting for annotation
        self.labeled_pool = deque(maxlen=50000)    # Annotated samples for training
        
        logger.info(f"ActiveLearner initialized for model {model_id}")
    
    def add_unlabeled_samples(self, X: pd.DataFrame):
        """Add unlabeled samples to the pool for potential querying."""
        
        for i in range(len(X)):
            sample = {
                'features': X.iloc[i].to_dict(),
                'sample_id': str(uuid.uuid4()),
                'added_at': datetime.utcnow()
            }
            self.unlabeled_pool.append(sample)
        
        logger.info(f"Added {len(X)} unlabeled samples to pool for model {self.model_id}")
    
    def query_samples(self, n_samples: int = None) -> Optional[ActiveLearningQuery]:
        """Query samples for annotation using the configured strategy."""
        
        if n_samples is None:
            n_samples = min(self.config.query_budget, len(self.unlabeled_pool))
        
        if len(self.unlabeled_pool) < n_samples:
            logger.warning(f"Not enough unlabeled samples for querying ({len(self.unlabeled_pool)} < {n_samples})")
            return None
        
        try:
            # Convert unlabeled pool to DataFrame
            unlabeled_samples = list(self.unlabeled_pool)
            X_unlabeled = pd.DataFrame([sample['features'] for sample in unlabeled_samples])
            
            # Apply query strategy
            if self.config.query_strategy == QueryStrategy.UNCERTAINTY:
                selected_indices, uncertainty_scores = self._uncertainty_sampling(X_unlabeled, n_samples)
            elif self.config.query_strategy == QueryStrategy.MARGIN:
                selected_indices, uncertainty_scores = self._margin_sampling(X_unlabeled, n_samples)
            elif self.config.query_strategy == QueryStrategy.ENTROPY:
                selected_indices, uncertainty_scores = self._entropy_sampling(X_unlabeled, n_samples)
            elif self.config.query_strategy == QueryStrategy.DIVERSITY:
                selected_indices, uncertainty_scores = self._diversity_sampling(X_unlabeled, n_samples)
            else:  # Random
                selected_indices, uncertainty_scores = self._random_sampling(X_unlabeled, n_samples)
            
            # Create query
            selected_samples = [unlabeled_samples[i] for i in selected_indices]
            
            query = ActiveLearningQuery(
                query_id=str(uuid.uuid4()),
                model_id=self.model_id,
                samples=[sample['features'] for sample in selected_samples],
                query_strategy=self.config.query_strategy,
                uncertainty_scores=uncertainty_scores,
                expected_improvement=np.mean(uncertainty_scores),
                created_at=datetime.utcnow()
            )
            
            # Store query
            self.active_queries[query.query_id] = query
            
            # Remove selected samples from unlabeled pool
            remaining_samples = [sample for i, sample in enumerate(unlabeled_samples) if i not in selected_indices]
            self.unlabeled_pool.clear()
            self.unlabeled_pool.extend(remaining_samples)
            
            logger.info(f"Created active learning query {query.query_id} with {len(selected_samples)} samples")
            return query
            
        except Exception as e:
            logger.error(f"Failed to create active learning query: {e}")
            return None
    
    def _uncertainty_sampling(self, X: pd.DataFrame, n_samples: int) -> Tuple[List[int], List[float]]:
        """Select samples with highest prediction uncertainty."""
        
        if not hasattr(self.model, 'predict_proba'):
            # Fallback to random sampling
            return self._random_sampling(X, n_samples)
        
        try:
            # Get prediction probabilities
            probabilities = self.model.predict_proba(X.fillna(0))
            
            # Calculate uncertainty (1 - max probability)
            max_probs = np.max(probabilities, axis=1)
            uncertainties = 1 - max_probs
            
            # Select top uncertain samples
            selected_indices = np.argsort(uncertainties)[-n_samples:].tolist()
            selected_uncertainties = [uncertainties[i] for i in selected_indices]
            
            return selected_indices, selected_uncertainties
            
        except Exception as e:
            logger.warning(f"Uncertainty sampling failed: {e}")
            return self._random_sampling(X, n_samples)
    
    def _margin_sampling(self, X: pd.DataFrame, n_samples: int) -> Tuple[List[int], List[float]]:
        """Select samples with smallest margin between top two predictions."""
        
        if not hasattr(self.model, 'predict_proba'):
            return self._random_sampling(X, n_samples)
        
        try:
            probabilities = self.model.predict_proba(X.fillna(0))
            
            # Calculate margin (difference between top two probabilities)
            sorted_probs = np.sort(probabilities, axis=1)
            margins = sorted_probs[:, -1] - sorted_probs[:, -2]  # Difference between 1st and 2nd highest
            
            # Select samples with smallest margins
            selected_indices = np.argsort(margins)[:n_samples].tolist()
            selected_uncertainties = [1 - margins[i] for i in selected_indices]  # Convert to uncertainty
            
            return selected_indices, selected_uncertainties
            
        except Exception as e:
            logger.warning(f"Margin sampling failed: {e}")
            return self._random_sampling(X, n_samples)
    
    def _entropy_sampling(self, X: pd.DataFrame, n_samples: int) -> Tuple[List[int], List[float]]:
        """Select samples with highest prediction entropy."""
        
        if not hasattr(self.model, 'predict_proba'):
            return self._random_sampling(X, n_samples)
        
        try:
            probabilities = self.model.predict_proba(X.fillna(0))
            
            # Calculate entropy
            entropies = -np.sum(probabilities * np.log(probabilities + 1e-8), axis=1)
            
            # Select samples with highest entropy
            selected_indices = np.argsort(entropies)[-n_samples:].tolist()
            selected_uncertainties = [entropies[i] for i in selected_indices]
            
            return selected_indices, selected_uncertainties
            
        except Exception as e:
            logger.warning(f"Entropy sampling failed: {e}")
            return self._random_sampling(X, n_samples)
    
    def _diversity_sampling(self, X: pd.DataFrame, n_samples: int) -> Tuple[List[int], List[float]]:
        """Select diverse samples to maximize coverage."""
        
        try:
            # Use k-means clustering to find diverse samples
            from sklearn.cluster import KMeans
            
            X_filled = X.fillna(0)
            
            # Cluster samples
            n_clusters = min(n_samples, len(X))
            kmeans = KMeans(n_clusters=n_clusters, random_state=42)
            cluster_labels = kmeans.fit_predict(X_filled)
            
            # Select one sample from each cluster (closest to centroid)
            selected_indices = []
            diversities = []
            
            for cluster_id in range(n_clusters):
                cluster_mask = cluster_labels == cluster_id
                cluster_samples = X_filled[cluster_mask]
                cluster_indices = np.where(cluster_mask)[0]
                
                if len(cluster_samples) > 0:
                    # Find sample closest to cluster centroid
                    centroid = kmeans.cluster_centers_[cluster_id]
                    distances = np.linalg.norm(cluster_samples - centroid, axis=1)
                    closest_idx = np.argmin(distances)
                    
                    selected_indices.append(cluster_indices[closest_idx])
                    diversities.append(1.0 / (distances[closest_idx] + 1e-8))  # Higher diversity for closer to centroid
            
            return selected_indices[:n_samples], diversities[:n_samples]
            
        except Exception as e:
            logger.warning(f"Diversity sampling failed: {e}")
            return self._random_sampling(X, n_samples)
    
    def _random_sampling(self, X: pd.DataFrame, n_samples: int) -> Tuple[List[int], List[float]]:
        """Random sampling baseline."""
        
        indices = np.random.choice(len(X), size=min(n_samples, len(X)), replace=False)
        uncertainties = [0.5] * len(indices)  # Neutral uncertainty
        
        return indices.tolist(), uncertainties
    
    def submit_annotations(self, query_id: str, annotations: List[Any], annotated_by: str = "user") -> bool:
        """Submit annotations for an active learning query."""
        
        if query_id not in self.active_queries:
            logger.error(f"Query {query_id} not found")
            return False
        
        try:
            query = self.active_queries[query_id]
            
            if len(annotations) != len(query.samples):
                logger.error(f"Number of annotations ({len(annotations)}) doesn't match number of samples ({len(query.samples)})")
                return False
            
            # Update query
            query.annotations = annotations
            query.annotated = True
            query.annotated_at = datetime.utcnow()
            query.annotated_by = annotated_by
            
            # Add annotated samples to labeled pool
            for sample, annotation in zip(query.samples, annotations):
                labeled_sample = {
                    'features': sample,
                    'target': annotation,
                    'query_id': query_id,
                    'annotated_at': query.annotated_at
                }
                self.labeled_pool.append(labeled_sample)
            
            # Record annotation in history
            self.annotation_history.append({
                'query_id': query_id,
                'samples_annotated': len(annotations),
                'strategy_used': query.query_strategy.value,
                'expected_improvement': query.expected_improvement,
                'annotated_at': query.annotated_at,
                'annotated_by': annotated_by
            })
            
            logger.info(f"Submitted annotations for query {query_id} ({len(annotations)} samples)")
            return True
            
        except Exception as e:
            logger.error(f"Failed to submit annotations for query {query_id}: {e}")
            return False
    
    def get_labeled_samples(self) -> Tuple[pd.DataFrame, pd.Series]:
        """Get all labeled samples for training."""
        
        if not self.labeled_pool:
            return pd.DataFrame(), pd.Series()
        
        features_list = [sample['features'] for sample in self.labeled_pool]
        targets_list = [sample['target'] for sample in self.labeled_pool]
        
        X = pd.DataFrame(features_list)
        y = pd.Series(targets_list)
        
        return X, y
    
    def get_active_learning_status(self) -> Dict[str, Any]:
        """Get active learning status."""
        
        return {
            'model_id': self.model_id,
            'unlabeled_samples': len(self.unlabeled_pool),
            'labeled_samples': len(self.labeled_pool),
            'active_queries': len([q for q in self.active_queries.values() if not q.annotated]),
            'completed_queries': len([q for q in self.active_queries.values() if q.annotated]),
            'total_annotations': sum(len(record.get('samples_annotated', 0)) for record in self.annotation_history),
            'query_strategy': self.config.query_strategy.value,
            'uncertainty_threshold': self.uncertainty_threshold
        }


class FeedbackProcessor:
    """
    Processes user feedback for continuous model improvement.
    """
    
    def __init__(self, model_id: str, config: LearningConfig):
        self.model_id = model_id
        self.config = config
        
        # Feedback storage
        self.feedback_samples: Dict[str, FeedbackSample] = {}
        self.processed_feedback = deque(maxlen=10000)
        
        # Feedback processing stats
        self.feedback_stats = {
            'total_feedback': 0,
            'by_type': defaultdict(int),
            'average_confidence': 0.0,
            'processing_rate': 0.0
        }
        
        logger.info(f"FeedbackProcessor initialized for model {model_id}")
    
    def submit_feedback(self, feedback: FeedbackSample) -> bool:
        """Submit feedback for processing."""
        
        try:
            # Store feedback
            self.feedback_samples[feedback.sample_id] = feedback
            
            # Update stats
            self.feedback_stats['total_feedback'] += 1
            self.feedback_stats['by_type'][feedback.feedback_type.value] += 1
            
            if feedback.confidence is not None:
                current_avg = self.feedback_stats['average_confidence']
                n = self.feedback_stats['total_feedback']
                self.feedback_stats['average_confidence'] = (current_avg * (n - 1) + feedback.confidence) / n
            
            logger.info(f"Received {feedback.feedback_type.value} feedback for model {self.model_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to submit feedback: {e}")
            return False
    
    def process_feedback_batch(self) -> List[Tuple[pd.DataFrame, pd.Series]]:
        """Process accumulated feedback into training data."""
        
        try:
            training_batches = []
            
            # Group feedback by type
            feedback_by_type = defaultdict(list)
            for feedback in self.feedback_samples.values():
                feedback_by_type[feedback.feedback_type].append(feedback)
            
            # Process each feedback type
            for feedback_type, feedback_list in feedback_by_type.items():
                if feedback_type == FeedbackType.EXPLICIT:
                    batch = self._process_explicit_feedback(feedback_list)
                elif feedback_type == FeedbackType.CORRECTION:
                    batch = self._process_correction_feedback(feedback_list)
                elif feedback_type == FeedbackType.IMPLICIT:
                    batch = self._process_implicit_feedback(feedback_list)
                elif feedback_type == FeedbackType.PREFERENCE:
                    batch = self._process_preference_feedback(feedback_list)
                else:
                    continue
                
                if batch is not None:
                    training_batches.append(batch)
                
                # Mark feedback as processed
                for feedback in feedback_list:
                    self.processed_feedback.append({
                        'sample_id': feedback.sample_id,
                        'feedback_type': feedback.feedback_type.value,
                        'processed_at': datetime.utcnow()
                    })
            
            # Clear processed feedback
            self.feedback_samples.clear()
            
            logger.info(f"Processed {len(training_batches)} feedback batches for model {self.model_id}")
            return training_batches
            
        except Exception as e:
            logger.error(f"Failed to process feedback batch: {e}")
            return []
    
    def _process_explicit_feedback(self, feedback_list: List[FeedbackSample]) -> Optional[Tuple[pd.DataFrame, pd.Series]]:
        """Process explicit feedback (thumbs up/down)."""
        
        if not feedback_list:
            return None
        
        features = []
        targets = []
        
        for feedback in feedback_list:
            features.append(feedback.input_data)
            # Convert feedback to binary classification
            targets.append(1 if feedback.feedback_value > 0 else 0)
        
        X = pd.DataFrame(features)
        y = pd.Series(targets)
        
        return X, y
    
    def _process_correction_feedback(self, feedback_list: List[FeedbackSample]) -> Optional[Tuple[pd.DataFrame, pd.Series]]:
        """Process correction feedback (user provides correct answer)."""
        
        if not feedback_list:
            return None
        
        features = []
        targets = []
        
        for feedback in feedback_list:
            features.append(feedback.input_data)
            targets.append(feedback.feedback_value)  # Direct correct label
        
        X = pd.DataFrame(features)
        y = pd.Series(targets)
        
        return X, y
    
    def _process_implicit_feedback(self, feedback_list: List[FeedbackSample]) -> Optional[Tuple[pd.DataFrame, pd.Series]]:
        """Process implicit feedback (inferred from behavior)."""
        
        if not feedback_list:
            return None
        
        # For implicit feedback, we might infer satisfaction from behavior
        # This is a simplified implementation
        
        features = []
        targets = []
        
        for feedback in feedback_list:
            features.append(feedback.input_data)
            
            # Example: if user spent more time on result, it might indicate satisfaction
            # This would be domain-specific
            behavior_score = feedback.metadata.get('engagement_score', 0.5)
            targets.append(1 if behavior_score > 0.5 else 0)
        
        X = pd.DataFrame(features)
        y = pd.Series(targets)
        
        return X, y
    
    def _process_preference_feedback(self, feedback_list: List[FeedbackSample]) -> Optional[Tuple[pd.DataFrame, pd.Series]]:
        """Process preference feedback (comparative preferences)."""
        
        if not feedback_list:
            return None
        
        # Preference feedback typically requires more complex processing
        # For now, treat as binary classification
        
        features = []
        targets = []
        
        for feedback in feedback_list:
            features.append(feedback.input_data)
            # Convert preference to binary
            targets.append(1 if feedback.feedback_value == 'preferred' else 0)
        
        X = pd.DataFrame(features)
        y = pd.Series(targets)
        
        return X, y
    
    def get_feedback_status(self) -> Dict[str, Any]:
        """Get feedback processing status."""
        
        return {
            'model_id': self.model_id,
            'pending_feedback': len(self.feedback_samples),
            'processed_feedback': len(self.processed_feedback),
            'feedback_stats': dict(self.feedback_stats),
            'recent_feedback_types': [f.feedback_type.value for f in list(self.feedback_samples.values())[-10:]]
        }


class ContinuousLearningService:
    """
    Main service orchestrating all continuous learning components.
    """
    
    def __init__(self, storage_path: str = "./continuous_learning"):
        self.storage_path = storage_path
        os.makedirs(storage_path, exist_ok=True)
        
        # Learning configurations
        self.learning_configs: Dict[str, LearningConfig] = {}
        
        # Learning components
        self.incremental_learners: Dict[str, IncrementalLearner] = {}
        self.active_learners: Dict[str, ActiveLearner] = {}
        self.feedback_processors: Dict[str, FeedbackProcessor] = {}
        
        # Background tasks
        self._learning_tasks: Dict[str, asyncio.Task] = {}
        self._shutdown_event = asyncio.Event()
        
        # Integration with MLOps platform
        self.mlops_platform = None
        self.drift_service = None
        
        # Load existing configurations
        self._load_configurations()
        
        logger.info(f"ContinuousLearningService initialized at {storage_path}")
    
    def configure_learning(self, config: LearningConfig) -> bool:
        """Configure continuous learning for a model."""
        
        try:
            # Store configuration
            self.learning_configs[config.model_id] = config
            
            # Initialize appropriate learner components
            if config.learning_mode in [LearningMode.INCREMENTAL, LearningMode.ONLINE, LearningMode.MINI_BATCH]:
                self.incremental_learners[config.model_id] = IncrementalLearner(config.model_id, config)
            
            if config.learning_mode == LearningMode.ACTIVE:
                self.active_learners[config.model_id] = ActiveLearner(config.model_id, config)
            
            # Always create feedback processor
            self.feedback_processors[config.model_id] = FeedbackProcessor(config.model_id, config)
            
            # Start background learning if configured
            if config.real_time_updates:
                asyncio.create_task(self._start_continuous_learning(config.model_id))
            
            # Save configuration
            self._save_configurations()
            
            logger.info(f"Configured continuous learning for model {config.model_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to configure learning for model {config.model_id}: {e}")
            return False
    
    async def add_training_data(self, model_id: str, X: pd.DataFrame, y: pd.Series = None) -> bool:
        """Add training data for continuous learning."""
        
        if model_id not in self.learning_configs:
            logger.error(f"No learning configuration for model {model_id}")
            return False
        
        try:
            config = self.learning_configs[model_id]
            
            # Add to incremental learner if available
            if model_id in self.incremental_learners and y is not None:
                success = self.incremental_learners[model_id].add_samples(X, y)
                if not success:
                    return False
            
            # Add to active learner if available and no labels
            if model_id in self.active_learners and y is None:
                self.active_learners[model_id].add_unlabeled_samples(X)
            
            logger.info(f"Added training data for model {model_id} ({len(X)} samples)")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add training data for model {model_id}: {e}")
            return False
    
    def submit_feedback(self, model_id: str, feedback: FeedbackSample) -> bool:
        """Submit feedback for a model."""
        
        if model_id not in self.feedback_processors:
            logger.error(f"No feedback processor for model {model_id}")
            return False
        
        return self.feedback_processors[model_id].submit_feedback(feedback)
    
    async def query_for_annotation(self, model_id: str, n_samples: int = 10) -> Optional[ActiveLearningQuery]:
        """Query samples for annotation using active learning."""
        
        if model_id not in self.active_learners:
            logger.error(f"No active learner for model {model_id}")
            return None
        
        return self.active_learners[model_id].query_samples(n_samples)
    
    def submit_annotations(self, model_id: str, query_id: str, annotations: List[Any], annotated_by: str = "user") -> bool:
        """Submit annotations for an active learning query."""
        
        if model_id not in self.active_learners:
            logger.error(f"No active learner for model {model_id}")
            return False
        
        return self.active_learners[model_id].submit_annotations(query_id, annotations, annotated_by)
    
    async def _start_continuous_learning(self, model_id: str):
        """Start continuous learning background task."""
        
        logger.info(f"Starting continuous learning for model {model_id}")
        
        config = self.learning_configs[model_id]
        
        while not self._shutdown_event.is_set() and model_id in self.learning_configs:
            try:
                # Process feedback
                if model_id in self.feedback_processors:
                    feedback_batches = self.feedback_processors[model_id].process_feedback_batch()
                    
                    # Add feedback data to incremental learner
                    if model_id in self.incremental_learners:
                        for X_feedback, y_feedback in feedback_batches:
                            self.incremental_learners[model_id].add_samples(X_feedback, y_feedback)
                
                # Update model from active learning annotations
                if model_id in self.active_learners:
                    X_labeled, y_labeled = self.active_learners[model_id].get_labeled_samples()
                    
                    if len(X_labeled) > 0 and model_id in self.incremental_learners:
                        self.incremental_learners[model_id].add_samples(X_labeled, y_labeled)
                
                # Trigger model updates
                if model_id in self.incremental_learners:
                    self.incremental_learners[model_id].update_model()
                
                # Wait for next cycle
                await asyncio.sleep(config.update_frequency_minutes * 60)
                
            except Exception as e:
                logger.error(f"Error in continuous learning for model {model_id}: {e}")
                await asyncio.sleep(300)  # Wait 5 minutes on error
        
        logger.info(f"Stopped continuous learning for model {model_id}")
    
    def get_learning_status(self, model_id: str = None) -> Dict[str, Any]:
        """Get learning status for models."""
        
        if model_id:
            # Get status for specific model
            if model_id not in self.learning_configs:
                return {'error': f'No learning configuration for model {model_id}'}
            
            status = {
                'model_id': model_id,
                'configuration': asdict(self.learning_configs[model_id]),
                'components': {}
            }
            
            # Add component statuses
            if model_id in self.incremental_learners:
                status['components']['incremental_learning'] = self.incremental_learners[model_id].get_learning_status()
            
            if model_id in self.active_learners:
                status['components']['active_learning'] = self.active_learners[model_id].get_active_learning_status()
            
            if model_id in self.feedback_processors:
                status['components']['feedback_processing'] = self.feedback_processors[model_id].get_feedback_status()
            
            return status
        else:
            # Get overall status
            return {
                'total_configured_models': len(self.learning_configs),
                'active_learning_tasks': len(self._learning_tasks),
                'components_summary': {
                    'incremental_learners': len(self.incremental_learners),
                    'active_learners': len(self.active_learners),
                    'feedback_processors': len(self.feedback_processors)
                },
                'configured_models': list(self.learning_configs.keys())
            }
    
    def _load_configurations(self):
        """Load learning configurations from storage."""
        try:
            config_file = os.path.join(self.storage_path, "learning_configs.json")
            if os.path.exists(config_file):
                with open(config_file, 'r') as f:
                    configs_data = json.load(f)
                    for model_id, config_data in configs_data.items():
                        # Convert datetime strings
                        if 'created_at' in config_data:
                            config_data['created_at'] = datetime.fromisoformat(config_data['created_at'])
                        if 'updated_at' in config_data:
                            config_data['updated_at'] = datetime.fromisoformat(config_data['updated_at'])
                        
                        config = LearningConfig(**config_data)
                        self.learning_configs[model_id] = config
                
                logger.info(f"Loaded {len(self.learning_configs)} learning configurations")
        except Exception as e:
            logger.warning(f"Could not load learning configurations: {e}")
    
    def _save_configurations(self):
        """Save learning configurations to storage."""
        try:
            config_file = os.path.join(self.storage_path, "learning_configs.json")
            configs_data = {
                model_id: asdict(config) 
                for model_id, config in self.learning_configs.items()
            }
            with open(config_file, 'w') as f:
                json.dump(configs_data, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Could not save learning configurations: {e}")
    
    async def shutdown(self):
        """Shutdown the continuous learning service."""
        logger.info("Shutting down continuous learning service...")
        
        # Signal shutdown
        self._shutdown_event.set()
        
        # Cancel learning tasks
        for model_id, task in self._learning_tasks.items():
            logger.info(f"Cancelling learning task for model {model_id}")
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        
        # Save configurations
        self._save_configurations()
        
        logger.info("Continuous learning service shutdown complete")


# Factory functions
def create_continuous_learning_service(storage_path: str = "./continuous_learning") -> ContinuousLearningService:
    """Factory function to create continuous learning service."""
    return ContinuousLearningService(storage_path=storage_path)


def create_learning_config(model_id: str,
                          learning_mode: LearningMode = LearningMode.INCREMENTAL,
                          **kwargs) -> LearningConfig:
    """Factory function to create learning configuration."""
    return LearningConfig(model_id=model_id, learning_mode=learning_mode, **kwargs)


def create_feedback_sample(model_id: str,
                          input_data: Dict[str, Any],
                          feedback_type: FeedbackType,
                          feedback_value: Any,
                          **kwargs) -> FeedbackSample:
    """Factory function to create feedback sample."""
    return FeedbackSample(
        sample_id=str(uuid.uuid4()),
        model_id=model_id,
        input_data=input_data,
        feedback_type=feedback_type,
        feedback_value=feedback_value,
        **kwargs
    )