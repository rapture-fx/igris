"""
Active Learning Engine for Human Feedback Integration

This module implements a comprehensive active learning system that efficiently learns
from minimal human feedback through intelligent sample selection and quality control.
"""

import asyncio
import logging
import numpy as np
import pandas as pd
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import (
    Any, Dict, List, Optional, Tuple, Union, Callable, Set,
    Protocol, runtime_checkable
)
import json
from collections import defaultdict, Counter
from concurrent.futures import ThreadPoolExecutor
import threading
import time
import warnings

# ML imports
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_recall_fscore_support,
    roc_auc_score, confusion_matrix
)
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.semi_supervised import LabelPropagation, LabelSpreading
from scipy import sparse
from scipy.stats import entropy, chi2_contingency
from scipy.spatial.distance import cdist


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class QueryStrategy(Enum):
    """Available query strategies for active learning"""
    UNCERTAINTY_LEAST_CONFIDENT = "uncertainty_least_confident"
    UNCERTAINTY_MARGIN = "uncertainty_margin"
    UNCERTAINTY_ENTROPY = "uncertainty_entropy"
    QUERY_BY_COMMITTEE = "query_by_committee"
    EXPECTED_ERROR_REDUCTION = "expected_error_reduction"
    EXPECTED_MODEL_CHANGE = "expected_model_change"
    DIVERSITY_BASED = "diversity_based"
    HYBRID = "hybrid"


class LearningMode(Enum):
    """Learning modes for the active learning system"""
    BATCH = "batch"
    STREAMING = "streaming"
    INTERACTIVE = "interactive"


class FeedbackQuality(Enum):
    """Quality levels for human feedback"""
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
    SUSPICIOUS = "suspicious"


@dataclass
class AnnotatorProfile:
    """Profile for tracking annotator performance and reliability"""
    annotator_id: str
    total_annotations: int = 0
    accuracy_score: float = 0.0
    consistency_score: float = 0.0
    response_time_avg: float = 0.0
    expertise_domains: List[str] = field(default_factory=list)
    reliability_score: float = 0.0
    last_active: Optional[datetime] = None
    feedback_history: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class LabelingTask:
    """Represents a single labeling task"""
    task_id: str
    sample_data: Any
    features: np.ndarray
    predicted_label: Optional[Any] = None
    confidence_score: float = 0.0
    query_strategy_used: Optional[QueryStrategy] = None
    assigned_annotator: Optional[str] = None
    human_label: Optional[Any] = None
    annotation_time: Optional[datetime] = None
    quality_score: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ActiveLearningConfig:
    """Configuration for the active learning system"""
    initial_budget: int = 100
    batch_size: int = 10
    max_iterations: int = 50
    stopping_threshold: float = 0.95
    quality_threshold: float = 0.7
    ensemble_size: int = 5
    uncertainty_threshold: float = 0.8
    diversity_weight: float = 0.3
    learning_mode: LearningMode = LearningMode.BATCH
    enable_semi_supervised: bool = True
    min_confidence_threshold: float = 0.9
    crowdsourcing_enabled: bool = False
    experiment_tracking: bool = True


@runtime_checkable
class ModelProtocol(Protocol):
    """Protocol for ML models used in active learning"""
    
    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        """Train the model"""
        ...
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Make predictions"""
        ...
    
    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Get prediction probabilities"""
        ...


class QueryStrategyBase(ABC):
    """Base class for query strategies"""
    
    def __init__(self, config: ActiveLearningConfig):
        self.config = config
        
    @abstractmethod
    def select_samples(
        self, 
        model: ModelProtocol, 
        X_pool: np.ndarray, 
        y_pool: Optional[np.ndarray] = None,
        n_samples: int = 10
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Select samples for labeling"""
        pass


class UncertaintySampling(QueryStrategyBase):
    """Uncertainty-based sampling strategies"""
    
    def __init__(self, config: ActiveLearningConfig, method: str = "least_confident"):
        super().__init__(config)
        self.method = method
    
    def select_samples(
        self, 
        model: ModelProtocol, 
        X_pool: np.ndarray, 
        y_pool: Optional[np.ndarray] = None,
        n_samples: int = 10
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Select samples based on uncertainty"""
        try:
            probabilities = model.predict_proba(X_pool)
            
            if self.method == "least_confident":
                uncertainties = 1 - np.max(probabilities, axis=1)
            elif self.method == "margin":
                sorted_probs = np.sort(probabilities, axis=1)
                uncertainties = 1 - (sorted_probs[:, -1] - sorted_probs[:, -2])
            elif self.method == "entropy":
                uncertainties = np.array([entropy(prob) for prob in probabilities])
            else:
                raise ValueError(f"Unknown uncertainty method: {self.method}")
            
            # Select top uncertain samples
            selected_indices = np.argsort(uncertainties)[-n_samples:]
            confidence_scores = 1 - uncertainties[selected_indices]
            
            return selected_indices, confidence_scores
            
        except Exception as e:
            logger.error(f"Error in uncertainty sampling: {e}")
            # Fallback to random sampling
            selected_indices = np.random.choice(len(X_pool), n_samples, replace=False)
            confidence_scores = np.full(n_samples, 0.5)
            return selected_indices, confidence_scores


class QueryByCommittee(QueryStrategyBase):
    """Query-by-committee using ensemble disagreement"""
    
    def __init__(self, config: ActiveLearningConfig):
        super().__init__(config)
        self.ensemble_size = config.ensemble_size
    
    def select_samples(
        self, 
        model: ModelProtocol, 
        X_pool: np.ndarray, 
        y_pool: Optional[np.ndarray] = None,
        n_samples: int = 10
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Select samples based on ensemble disagreement"""
        try:
            # Create ensemble of models (simplified version)
            ensemble_predictions = []
            
            for _ in range(self.ensemble_size):
                # In practice, you'd train different models or use bootstrap sampling
                predictions = model.predict_proba(X_pool)
                ensemble_predictions.append(predictions)
            
            ensemble_predictions = np.array(ensemble_predictions)
            
            # Calculate disagreement (variance across ensemble)
            disagreements = np.var(ensemble_predictions, axis=0).mean(axis=1)
            
            # Select samples with highest disagreement
            selected_indices = np.argsort(disagreements)[-n_samples:]
            confidence_scores = 1 - disagreements[selected_indices] / np.max(disagreements)
            
            return selected_indices, confidence_scores
            
        except Exception as e:
            logger.error(f"Error in query by committee: {e}")
            # Fallback to random sampling
            selected_indices = np.random.choice(len(X_pool), n_samples, replace=False)
            confidence_scores = np.full(n_samples, 0.5)
            return selected_indices, confidence_scores


class DiversitySampling(QueryStrategyBase):
    """Diversity-based sampling for representative coverage"""
    
    def select_samples(
        self, 
        model: ModelProtocol, 
        X_pool: np.ndarray, 
        y_pool: Optional[np.ndarray] = None,
        n_samples: int = 10
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Select diverse samples using clustering"""
        try:
            # Use K-means clustering for diversity
            kmeans = KMeans(n_clusters=n_samples, random_state=42, n_init=10)
            kmeans.fit(X_pool)
            
            # Select samples closest to cluster centers
            distances = cdist(X_pool, kmeans.cluster_centers_)
            selected_indices = np.argmin(distances, axis=0)
            
            # Calculate diversity scores (distance from cluster centers)
            diversity_scores = np.min(distances, axis=1)[selected_indices]
            confidence_scores = 1 - (diversity_scores / np.max(diversity_scores))
            
            return selected_indices, confidence_scores
            
        except Exception as e:
            logger.error(f"Error in diversity sampling: {e}")
            # Fallback to random sampling
            selected_indices = np.random.choice(len(X_pool), n_samples, replace=False)
            confidence_scores = np.full(n_samples, 0.5)
            return selected_indices, confidence_scores


class HumanFeedbackIntegrator:
    """Manages human feedback integration and quality assessment"""
    
    def __init__(self, config: ActiveLearningConfig):
        self.config = config
        self.annotators: Dict[str, AnnotatorProfile] = {}
        self.feedback_history: List[LabelingTask] = []
        self.quality_metrics = defaultdict(list)
        
    def register_annotator(self, annotator_id: str, expertise_domains: List[str] = None) -> None:
        """Register a new annotator"""
        self.annotators[annotator_id] = AnnotatorProfile(
            annotator_id=annotator_id,
            expertise_domains=expertise_domains or []
        )
        logger.info(f"Registered annotator: {annotator_id}")
    
    def assign_labeling_task(
        self, 
        task: LabelingTask, 
        preferred_annotator: Optional[str] = None
    ) -> str:
        """Assign a labeling task to the best available annotator"""
        if preferred_annotator and preferred_annotator in self.annotators:
            task.assigned_annotator = preferred_annotator
            return preferred_annotator
        
        # Find the best annotator based on reliability and availability
        best_annotator = max(
            self.annotators.values(),
            key=lambda a: a.reliability_score if a.last_active is None or 
                         (datetime.now() - a.last_active).seconds < 3600 else 0
        )
        
        task.assigned_annotator = best_annotator.annotator_id
        return best_annotator.annotator_id
    
    def process_feedback(
        self, 
        task: LabelingTask, 
        human_label: Any, 
        annotation_time: datetime
    ) -> float:
        """Process human feedback and assess quality"""
        task.human_label = human_label
        task.annotation_time = annotation_time
        
        # Calculate quality score
        quality_score = self._assess_feedback_quality(task)
        task.quality_score = quality_score
        
        # Update annotator profile
        if task.assigned_annotator:
            self._update_annotator_profile(task.assigned_annotator, task)
        
        # Store feedback
        self.feedback_history.append(task)
        
        logger.info(f"Processed feedback for task {task.task_id} with quality {quality_score:.2f}")
        return quality_score
    
    def _assess_feedback_quality(self, task: LabelingTask) -> float:
        """Assess the quality of human feedback"""
        quality_score = 1.0
        
        # Check consistency with model prediction
        if task.predicted_label is not None and task.human_label is not None:
            if task.predicted_label != task.human_label:
                # Lower score for disagreement with high-confidence predictions
                quality_score *= (1 - task.confidence_score * 0.3)
        
        # Check response time (very quick or very slow responses may indicate lower quality)
        if task.assigned_annotator and task.annotation_time:
            annotator = self.annotators[task.assigned_annotator]
            if annotator.response_time_avg > 0:
                response_time = (task.annotation_time - datetime.now()).seconds
                time_ratio = response_time / annotator.response_time_avg
                if time_ratio < 0.1 or time_ratio > 5.0:  # Too fast or too slow
                    quality_score *= 0.8
        
        return max(0.0, min(1.0, quality_score))
    
    def _update_annotator_profile(self, annotator_id: str, task: LabelingTask) -> None:
        """Update annotator profile based on completed task"""
        if annotator_id not in self.annotators:
            return
        
        annotator = self.annotators[annotator_id]
        annotator.total_annotations += 1
        annotator.last_active = datetime.now()
        
        # Update reliability score (moving average)
        alpha = 0.1
        annotator.reliability_score = (
            alpha * task.quality_score + 
            (1 - alpha) * annotator.reliability_score
        )
        
        # Store feedback in history
        annotator.feedback_history.append({
            'task_id': task.task_id,
            'quality_score': task.quality_score,
            'timestamp': task.annotation_time
        })
        
        # Keep only recent history
        if len(annotator.feedback_history) > 100:
            annotator.feedback_history = annotator.feedback_history[-100:]
    
    def resolve_conflicts(self, conflicting_tasks: List[LabelingTask]) -> Any:
        """Resolve conflicts between multiple annotators"""
        if not conflicting_tasks:
            return None
        
        # Weight votes by annotator reliability
        votes = defaultdict(float)
        for task in conflicting_tasks:
            if task.assigned_annotator and task.human_label is not None:
                annotator = self.annotators.get(task.assigned_annotator)
                weight = annotator.reliability_score if annotator else 0.5
                votes[task.human_label] += weight * task.quality_score
        
        # Return label with highest weighted vote
        if votes:
            return max(votes.items(), key=lambda x: x[1])[0]
        
        return conflicting_tasks[0].human_label


class SemiSupervisedLearner:
    """Semi-supervised learning component"""
    
    def __init__(self, config: ActiveLearningConfig):
        self.config = config
        self.label_propagation = LabelPropagation(kernel='knn', n_neighbors=7)
        self.label_spreading = LabelSpreading(kernel='knn', alpha=0.8)
        
    def propagate_labels(
        self, 
        X: np.ndarray, 
        y: np.ndarray, 
        unlabeled_indices: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Propagate labels to unlabeled data"""
        try:
            # Prepare semi-supervised labels (-1 for unlabeled)
            y_semi = y.copy()
            y_semi[unlabeled_indices] = -1
            
            # Fit label propagation
            self.label_propagation.fit(X, y_semi)
            
            # Get predictions for unlabeled data
            propagated_labels = self.label_propagation.transduction_[unlabeled_indices]
            label_probabilities = self.label_propagation.label_distributions_[unlabeled_indices]
            
            # Calculate confidence scores
            confidence_scores = np.max(label_probabilities, axis=1)
            
            return propagated_labels, confidence_scores
            
        except Exception as e:
            logger.error(f"Error in label propagation: {e}")
            return np.array([]), np.array([])
    
    def self_training_step(
        self, 
        model: ModelProtocol, 
        X_labeled: np.ndarray, 
        y_labeled: np.ndarray,
        X_unlabeled: np.ndarray,
        confidence_threshold: float = 0.9
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Perform one step of self-training"""
        try:
            # Train model on labeled data
            model.fit(X_labeled, y_labeled)
            
            # Predict on unlabeled data
            predictions = model.predict(X_unlabeled)
            probabilities = model.predict_proba(X_unlabeled)
            
            # Select high-confidence predictions
            max_probs = np.max(probabilities, axis=1)
            high_confidence_mask = max_probs >= confidence_threshold
            
            if not np.any(high_confidence_mask):
                return np.array([]), np.array([]), np.array([])
            
            # Add high-confidence predictions to labeled set
            new_X = X_unlabeled[high_confidence_mask]
            new_y = predictions[high_confidence_mask]
            confidence_scores = max_probs[high_confidence_mask]
            
            logger.info(f"Self-training added {len(new_X)} pseudo-labeled samples")
            
            return new_X, new_y, confidence_scores
            
        except Exception as e:
            logger.error(f"Error in self-training: {e}")
            return np.array([]), np.array([]), np.array([])


class AdaptiveLearningController:
    """Controls adaptive learning behavior"""
    
    def __init__(self, config: ActiveLearningConfig):
        self.config = config
        self.performance_history: List[float] = []
        self.strategy_performance: Dict[QueryStrategy, List[float]] = defaultdict(list)
        self.current_strategy = QueryStrategy.UNCERTAINTY_ENTROPY
        self.plateau_counter = 0
        
    def select_query_strategy(self, current_performance: float) -> QueryStrategy:
        """Dynamically select the best query strategy"""
        self.performance_history.append(current_performance)
        self.strategy_performance[self.current_strategy].append(current_performance)
        
        # Check for performance plateau
        if len(self.performance_history) >= 5:
            recent_performance = self.performance_history[-5:]
            if max(recent_performance) - min(recent_performance) < 0.01:
                self.plateau_counter += 1
            else:
                self.plateau_counter = 0
        
        # Switch strategy if current one is not performing well
        if self.plateau_counter >= 3:
            self._switch_strategy()
            self.plateau_counter = 0
        
        return self.current_strategy
    
    def _switch_strategy(self) -> None:
        """Switch to a better performing strategy"""
        # Find the best performing strategy
        best_strategy = self.current_strategy
        best_performance = 0.0
        
        for strategy, performances in self.strategy_performance.items():
            if performances:
                avg_performance = np.mean(performances[-10:])  # Recent performance
                if avg_performance > best_performance:
                    best_performance = avg_performance
                    best_strategy = strategy
        
        # If no better strategy found, try a random different one
        if best_strategy == self.current_strategy:
            strategies = list(QueryStrategy)
            strategies.remove(self.current_strategy)
            best_strategy = np.random.choice(strategies)
        
        logger.info(f"Switching query strategy from {self.current_strategy} to {best_strategy}")
        self.current_strategy = best_strategy
    
    def should_stop(self, current_performance: float, budget_used: int) -> bool:
        """Determine if active learning should stop"""
        # Stop if performance threshold reached
        if current_performance >= self.config.stopping_threshold:
            return True
        
        # Stop if budget exhausted
        if budget_used >= self.config.initial_budget:
            return True
        
        # Stop if performance has plateaued for too long
        if self.plateau_counter >= 10:
            return True
        
        return False


class QualityController:
    """Manages quality control for annotations and learning"""
    
    def __init__(self, config: ActiveLearningConfig):
        self.config = config
        self.annotation_quality_history: List[float] = []
        self.outlier_threshold = 2.0
        
    def detect_annotation_outliers(self, tasks: List[LabelingTask]) -> List[str]:
        """Detect outlier annotations that may indicate quality issues"""
        outlier_tasks = []
        
        if len(tasks) < 10:
            return outlier_tasks
        
        # Calculate quality score statistics
        quality_scores = [task.quality_score for task in tasks if task.quality_score > 0]
        if not quality_scores:
            return outlier_tasks
        
        mean_quality = np.mean(quality_scores)
        std_quality = np.std(quality_scores)
        
        # Identify outliers
        for task in tasks:
            if task.quality_score > 0:
                z_score = abs(task.quality_score - mean_quality) / (std_quality + 1e-8)
                if z_score > self.outlier_threshold:
                    outlier_tasks.append(task.task_id)
        
        return outlier_tasks
    
    def assess_annotator_consistency(self, annotator_id: str, tasks: List[LabelingTask]) -> float:
        """Assess consistency of an annotator's work"""
        annotator_tasks = [
            task for task in tasks 
            if task.assigned_annotator == annotator_id and task.human_label is not None
        ]
        
        if len(annotator_tasks) < 5:
            return 1.0  # Not enough data
        
        # Check label distribution consistency
        label_counts = Counter([task.human_label for task in annotator_tasks])
        total_labels = sum(label_counts.values())
        
        # Calculate entropy of label distribution
        probabilities = [count / total_labels for count in label_counts.values()]
        label_entropy = entropy(probabilities)
        
        # Normalize entropy (lower entropy = higher consistency)
        max_entropy = np.log(len(label_counts))
        consistency_score = 1.0 - (label_entropy / max_entropy) if max_entropy > 0 else 1.0
        
        return consistency_score
    
    def detect_bias_patterns(self, tasks: List[LabelingTask]) -> Dict[str, Any]:
        """Detect bias patterns in labeling"""
        bias_report = {
            'annotator_bias': {},
            'temporal_bias': False,
            'feature_bias': {}
        }
        
        # Annotator bias detection
        for annotator_id in set(task.assigned_annotator for task in tasks if task.assigned_annotator):
            annotator_tasks = [
                task for task in tasks 
                if task.assigned_annotator == annotator_id and task.human_label is not None
            ]
            
            if len(annotator_tasks) >= 10:
                labels = [task.human_label for task in annotator_tasks]
                label_distribution = Counter(labels)
                
                # Check for extreme bias toward one label
                most_common_label, most_common_count = label_distribution.most_common(1)[0]
                bias_ratio = most_common_count / len(labels)
                
                if bias_ratio > 0.8:  # More than 80% of one label
                    bias_report['annotator_bias'][annotator_id] = {
                        'biased_label': most_common_label,
                        'bias_ratio': bias_ratio
                    }
        
        # Temporal bias detection
        if len(tasks) >= 20:
            # Split tasks into early and late periods
            sorted_tasks = sorted([t for t in tasks if t.annotation_time], 
                                key=lambda x: x.annotation_time)
            mid_point = len(sorted_tasks) // 2
            
            early_labels = [task.human_label for task in sorted_tasks[:mid_point]]
            late_labels = [task.human_label for task in sorted_tasks[mid_point:]]
            
            # Chi-square test for independence
            early_dist = Counter(early_labels)
            late_dist = Counter(late_labels)
            
            all_labels = set(early_labels + late_labels)
            early_counts = [early_dist.get(label, 0) for label in all_labels]
            late_counts = [late_dist.get(label, 0) for label in all_labels]
            
            if sum(early_counts) > 0 and sum(late_counts) > 0:
                try:
                    chi2, p_value = chi2_contingency([early_counts, late_counts])[:2]
                    bias_report['temporal_bias'] = p_value < 0.05  # Significant difference
                except ValueError:
                    pass
        
        return bias_report


class ActiveLearningEngine:
    """Main active learning engine coordinating all components"""
    
    def __init__(self, config: Optional[ActiveLearningConfig] = None):
        self.config = config or ActiveLearningConfig()
        
        # Initialize components
        self.feedback_integrator = HumanFeedbackIntegrator(self.config)
        self.semi_supervised_learner = SemiSupervisedLearner(self.config)
        self.adaptive_controller = AdaptiveLearningController(self.config)
        self.quality_controller = QualityController(self.config)
        
        # Initialize query strategies
        self.query_strategies = {
            QueryStrategy.UNCERTAINTY_LEAST_CONFIDENT: UncertaintySampling(self.config, "least_confident"),
            QueryStrategy.UNCERTAINTY_MARGIN: UncertaintySampling(self.config, "margin"),
            QueryStrategy.UNCERTAINTY_ENTROPY: UncertaintySampling(self.config, "entropy"),
            QueryStrategy.QUERY_BY_COMMITTEE: QueryByCommittee(self.config),
            QueryStrategy.DIVERSITY_BASED: DiversitySampling(self.config)
        }
        
        # Learning state
        self.labeled_data: List[Tuple[np.ndarray, Any]] = []
        self.unlabeled_pool: List[np.ndarray] = []
        self.current_model: Optional[ModelProtocol] = None
        self.learning_history: List[Dict[str, Any]] = []
        self.active_tasks: Dict[str, LabelingTask] = {}
        
        # Performance tracking
        self.performance_metrics = defaultdict(list)
        self.experiment_id = f"experiment_{int(time.time())}"
        
        logger.info("Active Learning Engine initialized")
    
    async def initialize_learning(
        self, 
        initial_data: np.ndarray, 
        initial_labels: np.ndarray,
        unlabeled_data: np.ndarray,
        model: ModelProtocol
    ) -> None:
        """Initialize the active learning process"""
        try:
            self.current_model = model
            
            # Store initial labeled data
            for i, (features, label) in enumerate(zip(initial_data, initial_labels)):
                self.labeled_data.append((features, label))
            
            # Store unlabeled pool
            self.unlabeled_pool = [features for features in unlabeled_data]
            
            # Train initial model
            await self._train_model()
            
            logger.info(f"Initialized learning with {len(initial_labels)} labeled and {len(unlabeled_data)} unlabeled samples")
            
        except Exception as e:
            logger.error(f"Error initializing learning: {e}")
            raise
    
    async def run_learning_loop(self) -> Dict[str, Any]:
        """Run the main active learning loop"""
        results = {
            'iterations': 0,
            'final_performance': 0.0,
            'total_labels_acquired': 0,
            'strategy_changes': 0,
            'quality_issues': []
        }
        
        try:
            budget_used = 0
            iteration = 0
            
            while iteration < self.config.max_iterations:
                logger.info(f"Starting iteration {iteration + 1}")
                
                # Evaluate current model performance
                current_performance = await self._evaluate_model()
                self.performance_metrics['accuracy'].append(current_performance)
                
                # Check stopping criteria
                if self.adaptive_controller.should_stop(current_performance, budget_used):
                    logger.info(f"Stopping criteria met at iteration {iteration + 1}")
                    break
                
                # Select query strategy
                strategy = self.adaptive_controller.select_query_strategy(current_performance)
                
                # Select samples for labeling
                selected_indices, confidence_scores = await self._select_samples_for_labeling(strategy)
                
                if len(selected_indices) == 0:
                    logger.warning("No samples selected for labeling")
                    break
                
                # Create labeling tasks
                tasks = await self._create_labeling_tasks(selected_indices, confidence_scores, strategy)
                
                # Process labeling (in real scenario, this would be asynchronous)
                labeled_tasks = await self._simulate_labeling_process(tasks)
                
                # Process feedback and update model
                quality_scores = []
                for task in labeled_tasks:
                    quality = self.feedback_integrator.process_feedback(
                        task, task.human_label, datetime.now()
                    )
                    quality_scores.append(quality)
                
                # Add high-quality labels to training set
                high_quality_tasks = [
                    task for task, quality in zip(labeled_tasks, quality_scores)
                    if quality >= self.config.quality_threshold
                ]
                
                await self._add_labeled_samples(high_quality_tasks)
                
                # Semi-supervised learning step
                if self.config.enable_semi_supervised:
                    await self._semi_supervised_step()
                
                # Retrain model
                await self._train_model()
                
                # Update results
                budget_used += len(selected_indices)
                results['total_labels_acquired'] = budget_used
                results['iterations'] = iteration + 1
                
                # Quality control checks
                outliers = self.quality_controller.detect_annotation_outliers(labeled_tasks)
                if outliers:
                    results['quality_issues'].extend(outliers)
                
                iteration += 1
            
            # Final evaluation
            results['final_performance'] = await self._evaluate_model()
            
            # Generate learning report
            await self._generate_learning_report(results)
            
            logger.info(f"Active learning completed: {results}")
            return results
            
        except Exception as e:
            logger.error(f"Error in learning loop: {e}")
            raise
    
    async def _select_samples_for_labeling(
        self, 
        strategy: QueryStrategy
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Select samples for labeling using the specified strategy"""
        try:
            if not self.unlabeled_pool or not self.current_model:
                return np.array([]), np.array([])
            
            # Convert unlabeled pool to array
            X_pool = np.array(self.unlabeled_pool)
            
            # Select samples using the strategy
            strategy_impl = self.query_strategies.get(strategy)
            if not strategy_impl:
                logger.warning(f"Strategy {strategy} not implemented, using random sampling")
                n_samples = min(self.config.batch_size, len(X_pool))
                selected_indices = np.random.choice(len(X_pool), n_samples, replace=False)
                confidence_scores = np.full(n_samples, 0.5)
                return selected_indices, confidence_scores
            
            selected_indices, confidence_scores = strategy_impl.select_samples(
                self.current_model, X_pool, n_samples=self.config.batch_size
            )
            
            return selected_indices, confidence_scores
            
        except Exception as e:
            logger.error(f"Error selecting samples: {e}")
            return np.array([]), np.array([])
    
    async def _create_labeling_tasks(
        self, 
        selected_indices: np.ndarray,
        confidence_scores: np.ndarray,
        strategy: QueryStrategy
    ) -> List[LabelingTask]:
        """Create labeling tasks for selected samples"""
        tasks = []
        
        for i, (idx, confidence) in enumerate(zip(selected_indices, confidence_scores)):
            task_id = f"{self.experiment_id}_{len(self.active_tasks)}_{i}"
            
            # Get predicted label if model exists
            predicted_label = None
            if self.current_model:
                sample_features = self.unlabeled_pool[idx].reshape(1, -1)
                predicted_label = self.current_model.predict(sample_features)[0]
            
            task = LabelingTask(
                task_id=task_id,
                sample_data=self.unlabeled_pool[idx],
                features=self.unlabeled_pool[idx],
                predicted_label=predicted_label,
                confidence_score=confidence,
                query_strategy_used=strategy
            )
            
            # Assign to annotator
            annotator_id = self.feedback_integrator.assign_labeling_task(task)
            
            tasks.append(task)
            self.active_tasks[task_id] = task
        
        return tasks
    
    async def _simulate_labeling_process(self, tasks: List[LabelingTask]) -> List[LabelingTask]:
        """Simulate the labeling process (in practice, this would be real human annotation)"""
        # This is a simulation - in practice, tasks would be sent to human annotators
        labeled_tasks = []
        
        for task in tasks:
            # Simulate human labeling with some noise
            if task.predicted_label is not None:
                # Simulate agreement with model based on confidence
                agreement_prob = 0.7 + 0.2 * task.confidence_score
                if np.random.random() < agreement_prob:
                    human_label = task.predicted_label
                else:
                    # Simulate disagreement
                    human_label = 1 - task.predicted_label if isinstance(task.predicted_label, int) and task.predicted_label in [0, 1] else task.predicted_label
            else:
                # Random label for simulation
                human_label = np.random.choice([0, 1])
            
            task.human_label = human_label
            task.annotation_time = datetime.now()
            labeled_tasks.append(task)
        
        return labeled_tasks
    
    async def _add_labeled_samples(self, labeled_tasks: List[LabelingTask]) -> None:
        """Add labeled samples to training set"""
        for task in labeled_tasks:
            if task.human_label is not None:
                self.labeled_data.append((task.features, task.human_label))
                
                # Remove from unlabeled pool
                if task.sample_data.tolist() in [sample.tolist() for sample in self.unlabeled_pool]:
                    sample_index = next(
                        i for i, sample in enumerate(self.unlabeled_pool)
                        if np.array_equal(sample, task.sample_data)
                    )
                    self.unlabeled_pool.pop(sample_index)
        
        logger.info(f"Added {len(labeled_tasks)} labeled samples to training set")
    
    async def _train_model(self) -> None:
        """Train the current model on labeled data"""
        if not self.labeled_data or not self.current_model:
            return
        
        try:
            X = np.array([sample[0] for sample in self.labeled_data])
            y = np.array([sample[1] for sample in self.labeled_data])
            
            self.current_model.fit(X, y)
            logger.info(f"Model trained on {len(X)} samples")
            
        except Exception as e:
            logger.error(f"Error training model: {e}")
    
    async def _evaluate_model(self) -> float:
        """Evaluate current model performance"""
        if not self.labeled_data or not self.current_model or len(self.labeled_data) < 5:
            return 0.0
        
        try:
            X = np.array([sample[0] for sample in self.labeled_data])
            y = np.array([sample[1] for sample in self.labeled_data])
            
            # Use cross-validation for evaluation
            scores = cross_val_score(self.current_model, X, y, cv=min(5, len(X)), scoring='accuracy')
            return np.mean(scores)
            
        except Exception as e:
            logger.error(f"Error evaluating model: {e}")
            return 0.0
    
    async def _semi_supervised_step(self) -> None:
        """Perform semi-supervised learning step"""
        if not self.labeled_data or not self.unlabeled_pool:
            return
        
        try:
            # Combine labeled and unlabeled data
            X_labeled = np.array([sample[0] for sample in self.labeled_data])
            y_labeled = np.array([sample[1] for sample in self.labeled_data])
            X_unlabeled = np.array(self.unlabeled_pool)
            
            # Self-training step
            new_X, new_y, confidence_scores = self.semi_supervised_learner.self_training_step(
                self.current_model, X_labeled, y_labeled, X_unlabeled,
                self.config.min_confidence_threshold
            )
            
            if len(new_X) > 0:
                # Add high-confidence pseudo-labels
                for features, label in zip(new_X, new_y):
                    self.labeled_data.append((features, label))
                
                # Remove from unlabeled pool
                for features in new_X:
                    for i, unlabeled_sample in enumerate(self.unlabeled_pool):
                        if np.array_equal(features, unlabeled_sample):
                            self.unlabeled_pool.pop(i)
                            break
                
                logger.info(f"Semi-supervised learning added {len(new_X)} pseudo-labeled samples")
        
        except Exception as e:
            logger.error(f"Error in semi-supervised step: {e}")
    
    async def _generate_learning_report(self, results: Dict[str, Any]) -> None:
        """Generate comprehensive learning report"""
        report = {
            'experiment_id': self.experiment_id,
            'config': {
                'initial_budget': self.config.initial_budget,
                'batch_size': self.config.batch_size,
                'learning_mode': self.config.learning_mode.value,
                'stopping_threshold': self.config.stopping_threshold
            },
            'results': results,
            'performance_history': self.performance_metrics['accuracy'],
            'strategy_performance': {
                strategy.value: performances 
                for strategy, performances in self.adaptive_controller.strategy_performance.items()
            },
            'annotator_stats': {
                annotator_id: {
                    'total_annotations': profile.total_annotations,
                    'reliability_score': profile.reliability_score,
                    'consistency_score': profile.consistency_score
                }
                for annotator_id, profile in self.feedback_integrator.annotators.items()
            },
            'quality_metrics': {
                'average_quality': np.mean([
                    task.quality_score for task in self.feedback_integrator.feedback_history
                    if task.quality_score > 0
                ]) if self.feedback_integrator.feedback_history else 0,
                'quality_distribution': Counter([
                    'excellent' if task.quality_score >= 0.9 else
                    'good' if task.quality_score >= 0.7 else
                    'fair' if task.quality_score >= 0.5 else 'poor'
                    for task in self.feedback_integrator.feedback_history
                    if task.quality_score > 0
                ])
            }
        }
        
        # Store learning history
        self.learning_history.append(report)
        
        logger.info(f"Generated learning report for experiment {self.experiment_id}")
    
    # Public API methods
    
    def register_annotator(self, annotator_id: str, expertise_domains: List[str] = None) -> None:
        """Register a new human annotator"""
        self.feedback_integrator.register_annotator(annotator_id, expertise_domains)
    
    def get_next_labeling_batch(self, batch_size: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get next batch of samples for labeling"""
        batch_size = batch_size or self.config.batch_size
        
        if not self.unlabeled_pool or not self.current_model:
            return []
        
        # Use current strategy to select samples
        current_strategy = self.adaptive_controller.current_strategy
        selected_indices, confidence_scores = asyncio.run(
            self._select_samples_for_labeling(current_strategy)
        )
        
        # Create tasks
        tasks = asyncio.run(
            self._create_labeling_tasks(selected_indices, confidence_scores, current_strategy)
        )
        
        # Return task information for external labeling
        return [
            {
                'task_id': task.task_id,
                'sample_data': task.sample_data.tolist(),
                'predicted_label': task.predicted_label,
                'confidence_score': task.confidence_score,
                'assigned_annotator': task.assigned_annotator
            }
            for task in tasks
        ]
    
    def submit_labels(self, labeled_samples: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Submit human labels for processing"""
        results = {'processed': 0, 'quality_scores': []}
        
        for sample in labeled_samples:
            task_id = sample.get('task_id')
            human_label = sample.get('human_label')
            annotator_id = sample.get('annotator_id')
            
            if task_id in self.active_tasks:
                task = self.active_tasks[task_id]
                task.assigned_annotator = annotator_id
                
                quality_score = self.feedback_integrator.process_feedback(
                    task, human_label, datetime.now()
                )
                
                results['quality_scores'].append(quality_score)
                results['processed'] += 1
                
                # Add to labeled data if quality is acceptable
                if quality_score >= self.config.quality_threshold:
                    self.labeled_data.append((task.features, human_label))
        
        # Retrain model if new labels added
        if results['processed'] > 0:
            asyncio.run(self._train_model())
        
        return results
    
    def get_learning_progress(self) -> Dict[str, Any]:
        """Get current learning progress and statistics"""
        current_performance = asyncio.run(self._evaluate_model())
        
        return {
            'current_performance': current_performance,
            'labeled_samples': len(self.labeled_data),
            'unlabeled_samples': len(self.unlabeled_pool),
            'active_tasks': len(self.active_tasks),
            'performance_history': self.performance_metrics['accuracy'][-10:],  # Last 10 scores
            'current_strategy': self.adaptive_controller.current_strategy.value,
            'annotator_count': len(self.feedback_integrator.annotators)
        }
    
    def export_learning_data(self) -> Dict[str, Any]:
        """Export all learning data and history"""
        return {
            'experiment_id': self.experiment_id,
            'config': self.config.__dict__,
            'labeled_data': [(sample[0].tolist(), sample[1]) for sample in self.labeled_data],
            'learning_history': self.learning_history,
            'annotator_profiles': {
                annotator_id: profile.__dict__
                for annotator_id, profile in self.feedback_integrator.annotators.items()
            },
            'performance_metrics': dict(self.performance_metrics)
        }


# Example usage and factory functions

def create_active_learning_engine(
    initial_budget: int = 100,
    learning_mode: LearningMode = LearningMode.BATCH,
    enable_semi_supervised: bool = True
) -> ActiveLearningEngine:
    """Factory function to create an active learning engine with common configurations"""
    config = ActiveLearningConfig(
        initial_budget=initial_budget,
        learning_mode=learning_mode,
        enable_semi_supervised=enable_semi_supervised
    )
    return ActiveLearningEngine(config)


async def run_active_learning_example():
    """Example of running the active learning system"""
    # Create synthetic data
    np.random.seed(42)
    X = np.random.randn(1000, 10)
    y = (X[:, 0] + X[:, 1] > 0).astype(int)
    
    # Split into initial labeled and unlabeled
    initial_size = 50
    X_initial = X[:initial_size]
    y_initial = y[:initial_size]
    X_unlabeled = X[initial_size:]
    
    # Create model
    model = RandomForestClassifier(n_estimators=10, random_state=42)
    
    # Initialize active learning
    engine = create_active_learning_engine(initial_budget=100)
    engine.register_annotator("annotator_1", ["classification"])
    
    # Run learning
    await engine.initialize_learning(X_initial, y_initial, X_unlabeled, model)
    results = await engine.run_learning_loop()
    
    logger.info(f"Active learning results: {results}")
    return results


if __name__ == "__main__":
    # Run example
    asyncio.run(run_active_learning_example())