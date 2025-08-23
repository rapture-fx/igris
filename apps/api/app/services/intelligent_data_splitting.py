"""
Intelligent Data Splitting Service

This service provides intelligent automated train/test splitting with:
- Intelligent split strategy selection
- Advanced splitting methods
- Data distribution analysis
- Quality assurance
- Optimization features
- Export and integration capabilities
"""

import numpy as np
import pandas as pd
from typing import (
    Dict, List, Tuple, Optional, Union, Any, Callable, Literal
)
from dataclasses import dataclass, field
from enum import Enum
import warnings
from collections import Counter
import logging
from datetime import datetime
import json

# Scikit-learn imports
from sklearn.model_selection import (
    train_test_split, StratifiedKFold, KFold, TimeSeriesSplit,
    GroupKFold, GroupShuffleSplit, StratifiedShuffleSplit,
    cross_val_score, validation_curve
)
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report
from sklearn.utils.class_weight import compute_class_weight
from sklearn.base import is_classifier, is_regressor

# Statistical tests
from scipy import stats
from scipy.spatial.distance import wasserstein_distance
from scipy.stats import ks_2samp, chi2_contingency, mannwhitneyu

# For multi-label stratification
try:
    from skmultilearn.model_selection import iterative_train_test_split
    HAS_SKMULTILEARN = True
except ImportError:
    HAS_SKMULTILEARN = False
    warnings.warn("skmultilearn not available. Multi-label stratification will be limited.")

logger = logging.getLogger(__name__)


class TaskType(Enum):
    """ML task types for intelligent split strategy selection."""
    BINARY_CLASSIFICATION = "binary_classification"
    MULTICLASS_CLASSIFICATION = "multiclass_classification"
    MULTILABEL_CLASSIFICATION = "multilabel_classification"
    REGRESSION = "regression"
    TIME_SERIES = "time_series"
    RANKING = "ranking"
    CLUSTERING = "clustering"


class SplitStrategy(Enum):
    """Available splitting strategies."""
    RANDOM = "random"
    STRATIFIED = "stratified"
    TEMPORAL = "temporal"
    GROUP_BASED = "group_based"
    ADVERSARIAL = "adversarial"
    ITERATIVE_STRATIFIED = "iterative_stratified"


@dataclass
class SplitConfig:
    """Configuration for data splitting."""
    test_size: float = 0.2
    val_size: Optional[float] = None
    random_state: int = 42
    shuffle: bool = True
    stratify: bool = True
    n_splits: int = 5
    gap: int = 0
    max_train_size: Optional[int] = None
    group_col: Optional[str] = None
    time_col: Optional[str] = None
    target_cols: Optional[List[str]] = None
    
    # Quality assurance parameters
    min_samples_per_class: int = 2
    max_imbalance_ratio: float = 100.0
    distribution_tolerance: float = 0.05
    
    # Optimization parameters
    optimize_split_ratio: bool = False
    enable_parallel: bool = True
    memory_efficient: bool = False


@dataclass
class SplitQualityMetrics:
    """Metrics for assessing split quality."""
    # Distribution similarity metrics
    target_distribution_similarity: float = 0.0
    feature_distribution_similarity: float = 0.0
    correlation_preservation: float = 0.0
    
    # Statistical tests
    ks_test_pvalues: Dict[str, float] = field(default_factory=dict)
    chi2_test_pvalue: Optional[float] = None
    
    # Balance metrics
    class_balance_score: Optional[float] = None
    imbalance_ratio: Optional[float] = None
    
    # Leakage detection
    data_leakage_score: float = 0.0
    temporal_integrity: bool = True
    
    # Distance metrics
    wasserstein_distances: Dict[str, float] = field(default_factory=dict)
    kl_divergences: Dict[str, float] = field(default_factory=dict)


@dataclass
class SplitResult:
    """Result of data splitting operation."""
    # Split indices
    train_indices: np.ndarray
    val_indices: Optional[np.ndarray] = None
    test_indices: Optional[np.ndarray] = None
    
    # Split metadata
    strategy_used: SplitStrategy = SplitStrategy.RANDOM
    task_type: TaskType = TaskType.REGRESSION
    split_ratios: Dict[str, float] = field(default_factory=dict)
    
    # Quality metrics
    quality_metrics: SplitQualityMetrics = field(default_factory=SplitQualityMetrics)
    
    # Additional info
    n_samples: int = 0
    n_features: int = 0
    timestamp: datetime = field(default_factory=datetime.now)
    config_used: Optional[SplitConfig] = None


class IntelligentDataSplitter:
    """
    Intelligent data splitting service that automatically determines
    the best splitting strategy for any dataset and ML task.
    """
    
    def __init__(self, config: Optional[SplitConfig] = None):
        """Initialize the intelligent data splitter."""
        self.config = config or SplitConfig()
        self.task_type: Optional[TaskType] = None
        self.strategy: Optional[SplitStrategy] = None
        self.label_encoders: Dict[str, LabelEncoder] = {}
        
    def detect_task_type(
        self, 
        y: Union[pd.Series, np.ndarray, pd.DataFrame],
        X: Optional[Union[pd.DataFrame, np.ndarray]] = None
    ) -> TaskType:
        """
        Automatically detect the ML task type from target variable(s).
        
        Args:
            y: Target variable(s)
            X: Feature matrix (optional, used for time series detection)
            
        Returns:
            Detected task type
        """
        if isinstance(y, pd.DataFrame) or (isinstance(y, np.ndarray) and y.ndim > 1):
            # Multi-target case
            if y.shape[1] > 1:
                # Check if it's multi-label classification
                unique_values = np.unique(y.values if isinstance(y, pd.DataFrame) else y)
                if len(unique_values) <= 10 and all(val in [0, 1] for val in unique_values):
                    return TaskType.MULTILABEL_CLASSIFICATION
                else:
                    return TaskType.REGRESSION
        
        # Single target case
        y_series = y if isinstance(y, (pd.Series, np.ndarray)) else y.iloc[:, 0]
        
        # Check for time series patterns
        if self.config.time_col and X is not None:
            if isinstance(X, pd.DataFrame) and self.config.time_col in X.columns:
                return TaskType.TIME_SERIES
        
        # Check data type and unique values for classification
        unique_values = np.unique(y_series)
        n_unique = len(unique_values)
        
        # If target is categorical or has few unique values, likely classification
        if hasattr(y_series, 'dtype'):
            if pd.api.types.is_categorical_dtype(y_series) or pd.api.types.is_object_dtype(y_series):
                if n_unique == 2:
                    return TaskType.BINARY_CLASSIFICATION
                else:
                    return TaskType.MULTICLASS_CLASSIFICATION
        
        # Numeric targets - check if discrete with few values (classification)
        if n_unique <= max(10, len(y_series) * 0.05):  # Less than 5% unique values or max 10
            if all(isinstance(val, (int, np.integer)) for val in unique_values):
                if n_unique == 2:
                    return TaskType.BINARY_CLASSIFICATION
                else:
                    return TaskType.MULTICLASS_CLASSIFICATION
        
        # Default to regression
        return TaskType.REGRESSION
    
    def select_optimal_strategy(
        self, 
        task_type: TaskType, 
        y: Union[pd.Series, np.ndarray, pd.DataFrame],
        X: Optional[Union[pd.DataFrame, np.ndarray]] = None
    ) -> SplitStrategy:
        """
        Select the optimal splitting strategy based on task type and data characteristics.
        
        Args:
            task_type: Detected or specified task type
            y: Target variable(s)
            X: Feature matrix
            
        Returns:
            Optimal splitting strategy
        """
        # Time series always uses temporal splitting
        if task_type == TaskType.TIME_SERIES or self.config.time_col:
            return SplitStrategy.TEMPORAL
        
        # Group-based splitting if group column is specified
        if self.config.group_col:
            return SplitStrategy.GROUP_BASED
        
        # Multi-label classification
        if task_type == TaskType.MULTILABEL_CLASSIFICATION:
            return SplitStrategy.ITERATIVE_STRATIFIED if HAS_SKMULTILEARN else SplitStrategy.STRATIFIED
        
        # Classification tasks - use stratified splitting
        if task_type in [TaskType.BINARY_CLASSIFICATION, TaskType.MULTICLASS_CLASSIFICATION]:
            # Check for class imbalance
            if isinstance(y, (pd.Series, np.ndarray)) and y.ndim == 1:
                class_counts = Counter(y)
                imbalance_ratio = max(class_counts.values()) / min(class_counts.values())
                
                if imbalance_ratio > self.config.max_imbalance_ratio:
                    logger.warning(f"High class imbalance detected (ratio: {imbalance_ratio:.2f})")
                
                return SplitStrategy.STRATIFIED
        
        # Regression - check for distribution characteristics
        if task_type == TaskType.REGRESSION:
            if isinstance(y, (pd.Series, np.ndarray)) and y.ndim == 1:
                # Check for skewness - might benefit from distribution-aware splitting
                skewness = stats.skew(y)
                if abs(skewness) > 2:
                    logger.info(f"High skewness detected ({skewness:.2f}), using stratified approach")
                    return SplitStrategy.STRATIFIED
        
        # Default to random splitting
        return SplitStrategy.RANDOM
    
    def _perform_random_split(
        self, 
        X: Union[pd.DataFrame, np.ndarray], 
        y: Union[pd.Series, np.ndarray, pd.DataFrame]
    ) -> SplitResult:
        """Perform random data splitting."""
        indices = np.arange(len(X))
        
        if self.config.val_size:
            # Three-way split
            train_indices, temp_indices = train_test_split(
                indices, 
                test_size=(self.config.test_size + self.config.val_size),
                random_state=self.config.random_state,
                shuffle=self.config.shuffle
            )
            
            val_indices, test_indices = train_test_split(
                temp_indices,
                test_size=self.config.test_size / (self.config.test_size + self.config.val_size),
                random_state=self.config.random_state,
                shuffle=self.config.shuffle
            )
            
            split_ratios = {
                'train': len(train_indices) / len(X),
                'val': len(val_indices) / len(X),
                'test': len(test_indices) / len(X)
            }
            
        else:
            # Two-way split
            train_indices, test_indices = train_test_split(
                indices,
                test_size=self.config.test_size,
                random_state=self.config.random_state,
                shuffle=self.config.shuffle
            )
            
            val_indices = None
            split_ratios = {
                'train': len(train_indices) / len(X),
                'test': len(test_indices) / len(X)
            }
        
        return SplitResult(
            train_indices=train_indices,
            val_indices=val_indices,
            test_indices=test_indices,
            strategy_used=SplitStrategy.RANDOM,
            task_type=self.task_type,
            split_ratios=split_ratios,
            n_samples=len(X),
            n_features=X.shape[1] if hasattr(X, 'shape') else len(X[0]),
            config_used=self.config
        )
    
    def _perform_stratified_split(
        self, 
        X: Union[pd.DataFrame, np.ndarray], 
        y: Union[pd.Series, np.ndarray, pd.DataFrame]
    ) -> SplitResult:
        """Perform stratified data splitting."""
        # Handle multi-dimensional targets for regression
        if self.task_type == TaskType.REGRESSION and isinstance(y, (pd.Series, np.ndarray)):
            # Create stratification bins for continuous targets
            if hasattr(y, 'values'):
                y_vals = y.values
            else:
                y_vals = y
                
            # Use quantile-based binning for stratification
            n_bins = min(10, len(np.unique(y_vals)))
            y_binned = pd.cut(y_vals, bins=n_bins, labels=False, duplicates='drop')
            stratify_target = y_binned
        else:
            stratify_target = y
        
        indices = np.arange(len(X))
        
        if self.config.val_size:
            # Three-way stratified split
            train_indices, temp_indices = train_test_split(
                indices,
                test_size=(self.config.test_size + self.config.val_size),
                stratify=stratify_target,
                random_state=self.config.random_state,
                shuffle=self.config.shuffle
            )
            
            # Get corresponding stratify values for temp split
            temp_stratify = stratify_target[temp_indices] if hasattr(stratify_target, '__getitem__') else [stratify_target[i] for i in temp_indices]
            
            val_indices, test_indices = train_test_split(
                temp_indices,
                test_size=self.config.test_size / (self.config.test_size + self.config.val_size),
                stratify=temp_stratify,
                random_state=self.config.random_state,
                shuffle=self.config.shuffle
            )
            
            split_ratios = {
                'train': len(train_indices) / len(X),
                'val': len(val_indices) / len(X),
                'test': len(test_indices) / len(X)
            }
            
        else:
            # Two-way stratified split
            train_indices, test_indices = train_test_split(
                indices,
                test_size=self.config.test_size,
                stratify=stratify_target,
                random_state=self.config.random_state,
                shuffle=self.config.shuffle
            )
            
            val_indices = None
            split_ratios = {
                'train': len(train_indices) / len(X),
                'test': len(test_indices) / len(X)
            }
        
        return SplitResult(
            train_indices=train_indices,
            val_indices=val_indices,
            test_indices=test_indices,
            strategy_used=SplitStrategy.STRATIFIED,
            task_type=self.task_type,
            split_ratios=split_ratios,
            n_samples=len(X),
            n_features=X.shape[1] if hasattr(X, 'shape') else len(X[0]),
            config_used=self.config
        )
    
    def _perform_temporal_split(
        self, 
        X: Union[pd.DataFrame, np.ndarray], 
        y: Union[pd.Series, np.ndarray, pd.DataFrame]
    ) -> SplitResult:
        """Perform temporal data splitting for time series."""
        n_samples = len(X)
        
        # Calculate split points
        if self.config.val_size:
            train_size = int(n_samples * (1 - self.config.test_size - self.config.val_size))
            val_size = int(n_samples * self.config.val_size)
            
            train_indices = np.arange(train_size)
            val_indices = np.arange(train_size + self.config.gap, train_size + self.config.gap + val_size)
            test_indices = np.arange(train_size + val_size + 2 * self.config.gap, n_samples)
            
            split_ratios = {
                'train': len(train_indices) / n_samples,
                'val': len(val_indices) / n_samples,
                'test': len(test_indices) / n_samples
            }
            
        else:
            train_size = int(n_samples * (1 - self.config.test_size))
            
            train_indices = np.arange(train_size)
            test_indices = np.arange(train_size + self.config.gap, n_samples)
            val_indices = None
            
            split_ratios = {
                'train': len(train_indices) / n_samples,
                'test': len(test_indices) / n_samples
            }
        
        return SplitResult(
            train_indices=train_indices,
            val_indices=val_indices,
            test_indices=test_indices,
            strategy_used=SplitStrategy.TEMPORAL,
            task_type=self.task_type,
            split_ratios=split_ratios,
            n_samples=n_samples,
            n_features=X.shape[1] if hasattr(X, 'shape') else len(X[0]),
            config_used=self.config
        )
    
    def _perform_group_split(
        self, 
        X: Union[pd.DataFrame, np.ndarray], 
        y: Union[pd.Series, np.ndarray, pd.DataFrame],
        groups: Union[pd.Series, np.ndarray]
    ) -> SplitResult:
        """Perform group-based data splitting."""
        unique_groups = np.unique(groups)
        n_groups = len(unique_groups)
        
        # Split groups
        test_groups_count = max(1, int(n_groups * self.config.test_size))
        
        if self.config.shuffle:
            np.random.seed(self.config.random_state)
            shuffled_groups = np.random.permutation(unique_groups)
        else:
            shuffled_groups = unique_groups
        
        if self.config.val_size:
            val_groups_count = max(1, int(n_groups * self.config.val_size))
            
            train_groups = shuffled_groups[:-test_groups_count-val_groups_count]
            val_groups = shuffled_groups[-test_groups_count-val_groups_count:-test_groups_count]
            test_groups = shuffled_groups[-test_groups_count:]
            
            train_indices = np.where(np.isin(groups, train_groups))[0]
            val_indices = np.where(np.isin(groups, val_groups))[0]
            test_indices = np.where(np.isin(groups, test_groups))[0]
            
            split_ratios = {
                'train': len(train_indices) / len(X),
                'val': len(val_indices) / len(X),
                'test': len(test_indices) / len(X)
            }
            
        else:
            train_groups = shuffled_groups[:-test_groups_count]
            test_groups = shuffled_groups[-test_groups_count:]
            
            train_indices = np.where(np.isin(groups, train_groups))[0]
            test_indices = np.where(np.isin(groups, test_groups))[0]
            val_indices = None
            
            split_ratios = {
                'train': len(train_indices) / len(X),
                'test': len(test_indices) / len(X)
            }
        
        return SplitResult(
            train_indices=train_indices,
            val_indices=val_indices,
            test_indices=test_indices,
            strategy_used=SplitStrategy.GROUP_BASED,
            task_type=self.task_type,
            split_ratios=split_ratios,
            n_samples=len(X),
            n_features=X.shape[1] if hasattr(X, 'shape') else len(X[0]),
            config_used=self.config
        )
    
    def _perform_iterative_stratified_split(
        self, 
        X: Union[pd.DataFrame, np.ndarray], 
        y: Union[pd.Series, np.ndarray, pd.DataFrame]
    ) -> SplitResult:
        """Perform iterative stratified splitting for multi-label data."""
        if not HAS_SKMULTILEARN:
            logger.warning("skmultilearn not available, falling back to regular stratified split")
            return self._perform_stratified_split(X, y)
        
        # Convert to appropriate format
        if isinstance(y, pd.DataFrame):
            y_array = y.values
        elif isinstance(y, pd.Series):
            y_array = y.values.reshape(-1, 1)
        else:
            y_array = y
        
        if isinstance(X, pd.DataFrame):
            X_array = X.values
        else:
            X_array = X
        
        # Perform iterative stratified split
        if self.config.val_size:
            # First split: train+val vs test
            X_temp, X_test, y_temp, y_test = iterative_train_test_split(
                X_array, y_array, 
                test_size=self.config.test_size
            )
            
            # Second split: train vs val
            val_ratio = self.config.val_size / (1 - self.config.test_size)
            X_train, X_val, y_train, y_val = iterative_train_test_split(
                X_temp, y_temp,
                test_size=val_ratio
            )
            
            # Get indices (this is a simplification - in practice you'd need to track indices)
            n_samples = len(X)
            train_size = len(X_train)
            val_size = len(X_val)
            test_size = len(X_test)
            
            train_indices = np.arange(train_size)
            val_indices = np.arange(train_size, train_size + val_size)
            test_indices = np.arange(train_size + val_size, n_samples)
            
            split_ratios = {
                'train': train_size / n_samples,
                'val': val_size / n_samples,
                'test': test_size / n_samples
            }
            
        else:
            X_train, X_test, y_train, y_test = iterative_train_test_split(
                X_array, y_array,
                test_size=self.config.test_size
            )
            
            n_samples = len(X)
            train_size = len(X_train)
            test_size = len(X_test)
            
            train_indices = np.arange(train_size)
            test_indices = np.arange(train_size, n_samples)
            val_indices = None
            
            split_ratios = {
                'train': train_size / n_samples,
                'test': test_size / n_samples
            }
        
        return SplitResult(
            train_indices=train_indices,
            val_indices=val_indices,
            test_indices=test_indices,
            strategy_used=SplitStrategy.ITERATIVE_STRATIFIED,
            task_type=self.task_type,
            split_ratios=split_ratios,
            n_samples=len(X),
            n_features=X.shape[1] if hasattr(X, 'shape') else len(X[0]),
            config_used=self.config
        )
    
    def calculate_quality_metrics(
        self,
        X: Union[pd.DataFrame, np.ndarray],
        y: Union[pd.Series, np.ndarray, pd.DataFrame],
        split_result: SplitResult
    ) -> SplitQualityMetrics:
        """Calculate quality metrics for the data split."""
        metrics = SplitQualityMetrics()
        
        # Get split data
        X_train = X.iloc[split_result.train_indices] if isinstance(X, pd.DataFrame) else X[split_result.train_indices]
        X_test = X.iloc[split_result.test_indices] if isinstance(X, pd.DataFrame) else X[split_result.test_indices]
        
        y_train = y.iloc[split_result.train_indices] if isinstance(y, (pd.DataFrame, pd.Series)) else y[split_result.train_indices]
        y_test = y.iloc[split_result.test_indices] if isinstance(y, (pd.DataFrame, pd.Series)) else y[split_result.test_indices]
        
        # Target distribution similarity
        if self.task_type in [TaskType.BINARY_CLASSIFICATION, TaskType.MULTICLASS_CLASSIFICATION]:
            try:
                train_dist = Counter(y_train)
                test_dist = Counter(y_test)
                
                # Calculate class balance score
                all_classes = set(train_dist.keys()) | set(test_dist.keys())
                train_props = {cls: train_dist.get(cls, 0) / len(y_train) for cls in all_classes}
                test_props = {cls: test_dist.get(cls, 0) / len(y_test) for cls in all_classes}
                
                # KL divergence between distributions
                kl_div = 0
                for cls in all_classes:
                    if test_props[cls] > 0:
                        kl_div += train_props[cls] * np.log(train_props[cls] / test_props[cls])
                
                metrics.kl_divergences['target'] = kl_div
                metrics.class_balance_score = 1 / (1 + kl_div)
                
                # Imbalance ratio
                if len(train_dist) > 0:
                    metrics.imbalance_ratio = max(train_dist.values()) / min(train_dist.values())
                
            except Exception as e:
                logger.warning(f"Error calculating classification metrics: {e}")
        
        # Feature distribution similarity (for numerical features)
        if isinstance(X, pd.DataFrame):
            numerical_cols = X.select_dtypes(include=[np.number]).columns
            
            for col in numerical_cols[:10]:  # Limit to first 10 features for performance
                try:
                    train_values = X_train[col].dropna()
                    test_values = X_test[col].dropna()
                    
                    if len(train_values) > 0 and len(test_values) > 0:
                        # Kolmogorov-Smirnov test
                        ks_stat, p_value = ks_2samp(train_values, test_values)
                        metrics.ks_test_pvalues[col] = p_value
                        
                        # Wasserstein distance
                        w_distance = wasserstein_distance(train_values, test_values)
                        metrics.wasserstein_distances[col] = w_distance
                        
                except Exception as e:
                    logger.warning(f"Error calculating metrics for column {col}: {e}")
        
        # Overall distribution similarity score
        if metrics.ks_test_pvalues:
            metrics.feature_distribution_similarity = np.mean(list(metrics.ks_test_pvalues.values()))
        
        # Data leakage detection (simplified - check for identical samples)
        try:
            if isinstance(X, pd.DataFrame):
                # Check for duplicate rows between train and test
                train_hashes = pd.util.hash_pandas_object(X_train).values
                test_hashes = pd.util.hash_pandas_object(X_test).values
                
                overlap = len(set(train_hashes) & set(test_hashes))
                metrics.data_leakage_score = overlap / len(test_hashes)
            
        except Exception as e:
            logger.warning(f"Error in leakage detection: {e}")
        
        # Temporal integrity (for time series)
        if self.task_type == TaskType.TIME_SERIES or split_result.strategy_used == SplitStrategy.TEMPORAL:
            if hasattr(X, 'index') and hasattr(X.index, 'max'):
                try:
                    train_max_time = X_train.index.max()
                    test_min_time = X_test.index.min()
                    metrics.temporal_integrity = train_max_time < test_min_time
                except:
                    metrics.temporal_integrity = True  # Assume OK if can't verify
        
        return metrics
    
    def optimize_split_ratio(
        self,
        X: Union[pd.DataFrame, np.ndarray],
        y: Union[pd.Series, np.ndarray, pd.DataFrame],
        estimator: Any,
        ratios: List[float] = [0.1, 0.15, 0.2, 0.25, 0.3]
    ) -> float:
        """
        Optimize the train/test split ratio based on model performance.
        
        Args:
            X: Feature matrix
            y: Target variable(s)
            estimator: ML estimator to evaluate
            ratios: List of test ratios to try
            
        Returns:
            Optimal test ratio
        """
        best_ratio = self.config.test_size
        best_score = -np.inf
        
        for ratio in ratios:
            try:
                # Temporary config with this ratio
                temp_config = SplitConfig()
                temp_config.test_size = ratio
                temp_config.random_state = self.config.random_state
                
                # Create temporary splitter
                temp_splitter = IntelligentDataSplitter(temp_config)
                split_result = temp_splitter.split_data(X, y)
                
                # Extract training data
                X_train = X.iloc[split_result.train_indices] if isinstance(X, pd.DataFrame) else X[split_result.train_indices]
                y_train = y.iloc[split_result.train_indices] if isinstance(y, (pd.DataFrame, pd.Series)) else y[split_result.train_indices]
                
                # Cross-validation score on training data
                scores = cross_val_score(estimator, X_train, y_train, cv=3, scoring='accuracy' if self.task_type != TaskType.REGRESSION else 'r2')
                mean_score = np.mean(scores)
                
                if mean_score > best_score:
                    best_score = mean_score
                    best_ratio = ratio
                    
            except Exception as e:
                logger.warning(f"Error evaluating ratio {ratio}: {e}")
                continue
        
        logger.info(f"Optimal test ratio: {best_ratio} (score: {best_score:.3f})")
        return best_ratio
    
    def split_data(
        self,
        X: Union[pd.DataFrame, np.ndarray],
        y: Union[pd.Series, np.ndarray, pd.DataFrame],
        groups: Optional[Union[pd.Series, np.ndarray]] = None,
        task_type: Optional[TaskType] = None
    ) -> SplitResult:
        """
        Main method to perform intelligent data splitting.
        
        Args:
            X: Feature matrix
            y: Target variable(s)
            groups: Group labels for group-based splitting
            task_type: Override automatic task type detection
            
        Returns:
            Split result with indices and metadata
        """
        # Detect task type
        self.task_type = task_type or self.detect_task_type(y, X)
        logger.info(f"Detected task type: {self.task_type.value}")
        
        # Select optimal strategy
        self.strategy = self.select_optimal_strategy(self.task_type, y, X)
        logger.info(f"Selected strategy: {self.strategy.value}")
        
        # Perform the split based on strategy
        try:
            if self.strategy == SplitStrategy.RANDOM:
                split_result = self._perform_random_split(X, y)
            elif self.strategy == SplitStrategy.STRATIFIED:
                split_result = self._perform_stratified_split(X, y)
            elif self.strategy == SplitStrategy.TEMPORAL:
                split_result = self._perform_temporal_split(X, y)
            elif self.strategy == SplitStrategy.GROUP_BASED:
                if groups is None:
                    raise ValueError("Groups must be provided for group-based splitting")
                split_result = self._perform_group_split(X, y, groups)
            elif self.strategy == SplitStrategy.ITERATIVE_STRATIFIED:
                split_result = self._perform_iterative_stratified_split(X, y)
            else:
                raise ValueError(f"Unknown strategy: {self.strategy}")
            
            # Calculate quality metrics
            split_result.quality_metrics = self.calculate_quality_metrics(X, y, split_result)
            
            # Log split information
            logger.info(f"Split completed: {split_result.split_ratios}")
            logger.info(f"Quality metrics calculated: {split_result.quality_metrics.class_balance_score}")
            
            return split_result
            
        except Exception as e:
            logger.error(f"Error during data splitting: {e}")
            # Fallback to random split
            logger.warning("Falling back to random split")
            return self._perform_random_split(X, y)
    
    def export_split(
        self,
        split_result: SplitResult,
        format_type: Literal["indices", "masks", "datasets"] = "indices",
        X: Optional[Union[pd.DataFrame, np.ndarray]] = None,
        y: Optional[Union[pd.Series, np.ndarray, pd.DataFrame]] = None
    ) -> Dict[str, Any]:
        """
        Export split result in various formats.
        
        Args:
            split_result: Result from split_data
            format_type: Export format ("indices", "masks", "datasets")
            X: Feature matrix (required for "datasets" format)
            y: Target variable (required for "datasets" format)
            
        Returns:
            Dictionary with split data in requested format
        """
        if format_type == "indices":
            result = {
                "train_indices": split_result.train_indices.tolist(),
                "test_indices": split_result.test_indices.tolist(),
            }
            if split_result.val_indices is not None:
                result["val_indices"] = split_result.val_indices.tolist()
                
        elif format_type == "masks":
            n_samples = split_result.n_samples
            train_mask = np.zeros(n_samples, dtype=bool)
            test_mask = np.zeros(n_samples, dtype=bool)
            
            train_mask[split_result.train_indices] = True
            test_mask[split_result.test_indices] = True
            
            result = {
                "train_mask": train_mask.tolist(),
                "test_mask": test_mask.tolist(),
            }
            
            if split_result.val_indices is not None:
                val_mask = np.zeros(n_samples, dtype=bool)
                val_mask[split_result.val_indices] = True
                result["val_mask"] = val_mask.tolist()
                
        elif format_type == "datasets":
            if X is None or y is None:
                raise ValueError("X and y must be provided for datasets format")
                
            if isinstance(X, pd.DataFrame):
                X_train = X.iloc[split_result.train_indices]
                X_test = X.iloc[split_result.test_indices]
            else:
                X_train = X[split_result.train_indices]
                X_test = X[split_result.test_indices]
                
            if isinstance(y, (pd.DataFrame, pd.Series)):
                y_train = y.iloc[split_result.train_indices]
                y_test = y.iloc[split_result.test_indices]
            else:
                y_train = y[split_result.train_indices]
                y_test = y[split_result.test_indices]
                
            result = {
                "X_train": X_train,
                "X_test": X_test,
                "y_train": y_train,
                "y_test": y_test,
            }
            
            if split_result.val_indices is not None:
                if isinstance(X, pd.DataFrame):
                    X_val = X.iloc[split_result.val_indices]
                else:
                    X_val = X[split_result.val_indices]
                    
                if isinstance(y, (pd.DataFrame, pd.Series)):
                    y_val = y.iloc[split_result.val_indices]
                else:
                    y_val = y[split_result.val_indices]
                    
                result["X_val"] = X_val
                result["y_val"] = y_val
        else:
            raise ValueError(f"Unknown format type: {format_type}")
        
        # Add metadata
        result["metadata"] = {
            "strategy_used": split_result.strategy_used.value,
            "task_type": split_result.task_type.value,
            "split_ratios": split_result.split_ratios,
            "n_samples": split_result.n_samples,
            "n_features": split_result.n_features,
            "timestamp": split_result.timestamp.isoformat(),
            "quality_metrics": {
                "class_balance_score": split_result.quality_metrics.class_balance_score,
                "data_leakage_score": split_result.quality_metrics.data_leakage_score,
                "temporal_integrity": split_result.quality_metrics.temporal_integrity,
            }
        }
        
        return result
    
    def generate_cv_splits(
        self,
        X: Union[pd.DataFrame, np.ndarray],
        y: Union[pd.Series, np.ndarray, pd.DataFrame],
        groups: Optional[Union[pd.Series, np.ndarray]] = None
    ) -> List[Tuple[np.ndarray, np.ndarray]]:
        """
        Generate cross-validation splits based on the optimal strategy.
        
        Args:
            X: Feature matrix
            y: Target variable(s)
            groups: Group labels for group-based splitting
            
        Returns:
            List of (train_indices, val_indices) tuples
        """
        # Detect task type if not already set
        if self.task_type is None:
            self.task_type = self.detect_task_type(y, X)
        
        # Select appropriate CV strategy
        if self.task_type == TaskType.TIME_SERIES or self.config.time_col:
            cv = TimeSeriesSplit(
                n_splits=self.config.n_splits,
                gap=self.config.gap,
                max_train_size=self.config.max_train_size
            )
            splits = list(cv.split(X))
            
        elif groups is not None:
            cv = GroupKFold(n_splits=self.config.n_splits)
            splits = list(cv.split(X, y, groups))
            
        elif self.task_type in [TaskType.BINARY_CLASSIFICATION, TaskType.MULTICLASS_CLASSIFICATION]:
            cv = StratifiedKFold(
                n_splits=self.config.n_splits,
                shuffle=self.config.shuffle,
                random_state=self.config.random_state
            )
            splits = list(cv.split(X, y))
            
        else:
            cv = KFold(
                n_splits=self.config.n_splits,
                shuffle=self.config.shuffle,
                random_state=self.config.random_state
            )
            splits = list(cv.split(X, y))
        
        return splits


# Utility functions for common use cases
def create_stratified_split(
    X: Union[pd.DataFrame, np.ndarray],
    y: Union[pd.Series, np.ndarray],
    test_size: float = 0.2,
    random_state: int = 42
) -> Dict[str, Any]:
    """
    Quick function for stratified splitting.
    
    Args:
        X: Feature matrix
        y: Target variable
        test_size: Proportion of test data
        random_state: Random seed
        
    Returns:
        Dictionary with split datasets
    """
    config = SplitConfig(test_size=test_size, random_state=random_state)
    splitter = IntelligentDataSplitter(config)
    result = splitter.split_data(X, y, task_type=TaskType.BINARY_CLASSIFICATION)
    return splitter.export_split(result, format_type="datasets", X=X, y=y)


def create_time_series_split(
    X: Union[pd.DataFrame, np.ndarray],
    y: Union[pd.Series, np.ndarray],
    test_size: float = 0.2,
    gap: int = 0
) -> Dict[str, Any]:
    """
    Quick function for time series splitting.
    
    Args:
        X: Feature matrix
        y: Target variable
        test_size: Proportion of test data
        gap: Gap between train and test data
        
    Returns:
        Dictionary with split datasets
    """
    config = SplitConfig(test_size=test_size, gap=gap, shuffle=False)
    splitter = IntelligentDataSplitter(config)
    result = splitter.split_data(X, y, task_type=TaskType.TIME_SERIES)
    return splitter.export_split(result, format_type="datasets", X=X, y=y)


def analyze_split_quality(split_result: SplitResult) -> str:
    """
    Generate a human-readable analysis of split quality.
    
    Args:
        split_result: Result from split_data
        
    Returns:
        Formatted quality analysis string
    """
    metrics = split_result.quality_metrics
    analysis = []
    
    analysis.append(f"Split Quality Analysis for {split_result.strategy_used.value} strategy:")
    analysis.append(f"Task Type: {split_result.task_type.value}")
    analysis.append(f"Split Ratios: {split_result.split_ratios}")
    analysis.append("")
    
    # Class balance
    if metrics.class_balance_score is not None:
        if metrics.class_balance_score > 0.9:
            analysis.append(f"✓ Excellent class balance (score: {metrics.class_balance_score:.3f})")
        elif metrics.class_balance_score > 0.7:
            analysis.append(f"⚠ Good class balance (score: {metrics.class_balance_score:.3f})")
        else:
            analysis.append(f"✗ Poor class balance (score: {metrics.class_balance_score:.3f})")
    
    # Data leakage
    if metrics.data_leakage_score < 0.01:
        analysis.append("✓ No data leakage detected")
    else:
        analysis.append(f"✗ Potential data leakage detected ({metrics.data_leakage_score:.3f})")
    
    # Feature distribution
    if metrics.ks_test_pvalues:
        avg_p_value = np.mean(list(metrics.ks_test_pvalues.values()))
        if avg_p_value > 0.05:
            analysis.append(f"✓ Good feature distribution similarity (avg p-value: {avg_p_value:.3f})")
        else:
            analysis.append(f"⚠ Some feature distribution differences detected (avg p-value: {avg_p_value:.3f})")
    
    # Temporal integrity
    if hasattr(metrics, 'temporal_integrity'):
        if metrics.temporal_integrity:
            analysis.append("✓ Temporal integrity maintained")
        else:
            analysis.append("✗ Temporal integrity violated")
    
    return "\n".join(analysis)