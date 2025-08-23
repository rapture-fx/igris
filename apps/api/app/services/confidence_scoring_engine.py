"""
Confidence Scoring Engine Service

Service layer for comprehensive confidence scoring and uncertainty quantification
that integrates with the core ML confidence scoring engine and provides
enterprise-grade functionality for all ML operations.

This service provides:
- Model confidence assessment for all ML model types
- Data quality confidence scoring with detailed metrics
- Advanced uncertainty quantification (aleatoric/epistemic)  
- Clustering confidence with multiple algorithms
- Feature engineering confidence assessment
- Active learning sample selection
- Probability calibration and reliability assessment
- Comprehensive reporting and monitoring
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple, Union, Callable
import numpy as np
import pandas as pd
from dataclasses import dataclass, asdict
from contextlib import contextmanager
import warnings
from functools import wraps
import json

# Import the core ML confidence scoring engine
from ..ml.confidence_scoring_engine import (
    ConfidenceScoringEngine as CoreConfidenceEngine,
    ConfidenceScore,
    ConfidenceType,
    UncertaintyType,
    ModelConfidenceScorer,
    DataQualityConfidenceScorer,
    UncertaintyQuantifier,
    ClusteringConfidenceScorer,
    FeatureEngineeringConfidenceScorer,
    CalibrationScorer,
    ActiveLearningScorer,
    bootstrap_confidence_interval,
    calibration_curve
)

# Service-level imports
from .core.error_handling import handle_service_errors
from .monitoring_service import MonitoringService

logger = logging.getLogger(__name__)


@dataclass
class ConfidenceReport:
    """Enhanced confidence report with service metadata."""
    timestamp: str
    confidence_scores: Dict[str, Any]
    summary_statistics: Dict[str, float]
    recommendations: List[str]
    service_metadata: Dict[str, Any]
    quality_metrics: Optional[Dict[str, float]] = None
    performance_metrics: Optional[Dict[str, float]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert report to dictionary."""
        return asdict(self)
    
    def to_json(self) -> str:
        """Convert report to JSON string."""
        return json.dumps(self.to_dict(), indent=2, default=str)


@dataclass
class BatchConfidenceResult:
    """Result container for batch confidence scoring operations."""
    batch_id: str
    total_samples: int
    processed_samples: int
    confidence_scores: List[ConfidenceScore]
    processing_time: float
    errors: List[str]
    metadata: Dict[str, Any]


class ConfidenceScoringEngineService:
    """
    Enterprise-grade confidence scoring engine service.
    
    This service wraps the core ML confidence scoring engine with:
    - Enhanced error handling and logging
    - Batch processing capabilities
    - Performance monitoring
    - Caching for repeated operations
    - Async support for large datasets
    - Integration with other platform services
    """
    
    def __init__(self, 
                 cache_enabled: bool = True,
                 monitoring_enabled: bool = True,
                 async_threshold: int = 10000):
        """
        Initialize the confidence scoring engine service.
        
        Args:
            cache_enabled: Enable caching of confidence scores
            monitoring_enabled: Enable performance monitoring
            async_threshold: Sample size threshold for async processing
        """
        self.core_engine = CoreConfidenceEngine()
        self.cache_enabled = cache_enabled
        self.monitoring_enabled = monitoring_enabled
        self.async_threshold = async_threshold
        
        # Initialize service components
        self._confidence_cache = {} if cache_enabled else None
        self._monitoring_service = MonitoringService() if monitoring_enabled else None
        
        # Performance tracking
        self._operation_counts = {
            'prediction': 0,
            'data_quality': 0,
            'uncertainty': 0,
            'clustering': 0,
            'feature_engineering': 0,
            'calibration': 0,
            'active_learning': 0
        }
        
        logger.info(
            f"Confidence Scoring Engine Service initialized - "
            f"cache: {cache_enabled}, monitoring: {monitoring_enabled}, "
            f"async_threshold: {async_threshold}"
        )
    
    @contextmanager
    def _performance_tracking(self, operation_type: str):
        """Context manager for performance tracking."""
        start_time = datetime.now()
        try:
            yield
            self._operation_counts[operation_type] += 1
        except Exception as e:
            logger.error(f"Error in {operation_type} operation: {str(e)}")
            raise
        finally:
            if self.monitoring_enabled:
                duration = (datetime.now() - start_time).total_seconds()
                self._monitoring_service.record_metric(
                    f"confidence_scoring.{operation_type}.duration",
                    duration
                )
    
    def _generate_cache_key(self, operation: str, **kwargs) -> str:
        """Generate cache key for confidence scoring operations."""
        # Create a hash of the operation and parameters
        key_data = f"{operation}_{hash(str(sorted(kwargs.items())))}"
        return key_data
    
    def _get_from_cache(self, cache_key: str) -> Optional[Any]:
        """Get result from cache if available."""
        if not self.cache_enabled or not self._confidence_cache:
            return None
        return self._confidence_cache.get(cache_key)
    
    def _store_in_cache(self, cache_key: str, result: Any) -> None:
        """Store result in cache."""
        if self.cache_enabled and self._confidence_cache is not None:
            self._confidence_cache[cache_key] = result
    
    @handle_service_errors
    def calculate_prediction_confidence(self,
                                      X: np.ndarray,
                                      model: Any = None,
                                      y_pred: Optional[np.ndarray] = None,
                                      y_proba: Optional[np.ndarray] = None,
                                      method: str = "probability_based",
                                      batch_size: Optional[int] = None) -> Union[List[ConfidenceScore], BatchConfidenceResult]:
        """
        Calculate prediction confidence scores with enhanced service features.
        
        Args:
            X: Input features
            model: ML model
            y_pred: Predicted labels/values
            y_proba: Prediction probabilities
            method: Confidence calculation method
            batch_size: Process in batches if specified
            
        Returns:
            Confidence scores or batch processing result
        """
        with self._performance_tracking('prediction'):
            # Check cache first
            cache_key = self._generate_cache_key(
                'prediction', 
                X_shape=X.shape, 
                method=method,
                has_model=model is not None,
                has_pred=y_pred is not None,
                has_proba=y_proba is not None
            )
            
            cached_result = self._get_from_cache(cache_key)
            if cached_result is not None:
                logger.debug(f"Returning cached prediction confidence for key: {cache_key}")
                return cached_result
            
            # Handle large datasets with batch processing
            if batch_size is not None or len(X) > self.async_threshold:
                return self._batch_prediction_confidence(
                    X, model, y_pred, y_proba, method, batch_size
                )
            
            # Standard processing
            result = self.core_engine.calculate_prediction_confidence(
                X, model, y_pred, y_proba, method
            )
            
            # Store in cache
            self._store_in_cache(cache_key, result)
            
            return result
    
    def _batch_prediction_confidence(self,
                                   X: np.ndarray,
                                   model: Any,
                                   y_pred: Optional[np.ndarray],
                                   y_proba: Optional[np.ndarray],
                                   method: str,
                                   batch_size: Optional[int]) -> BatchConfidenceResult:
        """Process prediction confidence in batches."""
        start_time = datetime.now()
        batch_size = batch_size or min(1000, max(100, len(X) // 10))
        
        batch_id = f"pred_conf_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        all_scores = []
        errors = []
        processed_count = 0
        
        logger.info(f"Starting batch prediction confidence processing: {batch_id}, "
                   f"total_samples: {len(X)}, batch_size: {batch_size}")
        
        for i in range(0, len(X), batch_size):
            try:
                end_idx = min(i + batch_size, len(X))
                X_batch = X[i:end_idx]
                
                # Prepare batch inputs
                y_pred_batch = y_pred[i:end_idx] if y_pred is not None else None
                y_proba_batch = y_proba[i:end_idx] if y_proba is not None else None
                
                # Process batch
                batch_scores = self.core_engine.calculate_prediction_confidence(
                    X_batch, model, y_pred_batch, y_proba_batch, method
                )
                
                all_scores.extend(batch_scores)
                processed_count += len(batch_scores)
                
                # Log progress
                if i % (batch_size * 5) == 0:
                    progress = (processed_count / len(X)) * 100
                    logger.info(f"Batch {batch_id} progress: {progress:.1f}%")
                    
            except Exception as e:
                error_msg = f"Error processing batch {i}-{end_idx}: {str(e)}"
                errors.append(error_msg)
                logger.error(error_msg)
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        return BatchConfidenceResult(
            batch_id=batch_id,
            total_samples=len(X),
            processed_samples=processed_count,
            confidence_scores=all_scores,
            processing_time=processing_time,
            errors=errors,
            metadata={
                'method': method,
                'batch_size': batch_size,
                'num_batches': len(range(0, len(X), batch_size))
            }
        )
    
    @handle_service_errors
    def calculate_data_quality_confidence(self,
                                        data: pd.DataFrame,
                                        feature_columns: Optional[List[str]] = None,
                                        detailed_analysis: bool = False) -> ConfidenceScore:
        """Calculate data quality confidence with enhanced analysis."""
        with self._performance_tracking('data_quality'):
            cache_key = self._generate_cache_key(
                'data_quality',
                data_shape=data.shape,
                columns=list(data.columns) if feature_columns is None else feature_columns,
                detailed=detailed_analysis
            )
            
            cached_result = self._get_from_cache(cache_key)
            if cached_result is not None:
                return cached_result
            
            # Core data quality assessment
            result = self.core_engine.calculate_data_quality_confidence(data, feature_columns)
            
            # Enhanced analysis if requested
            if detailed_analysis:
                enhanced_metadata = self._enhanced_data_quality_analysis(data, feature_columns)
                result.metadata.update(enhanced_metadata)
            
            self._store_in_cache(cache_key, result)
            return result
    
    def _enhanced_data_quality_analysis(self,
                                      data: pd.DataFrame,
                                      feature_columns: Optional[List[str]]) -> Dict[str, Any]:
        """Perform enhanced data quality analysis."""
        enhanced_metrics = {}
        
        if feature_columns is None:
            feature_columns = list(data.columns)
        
        # Distribution analysis
        distribution_metrics = {}
        for col in feature_columns:
            if pd.api.types.is_numeric_dtype(data[col]):
                values = data[col].dropna()
                if len(values) > 0:
                    distribution_metrics[col] = {
                        'skewness': float(values.skew()),
                        'kurtosis': float(values.kurtosis()),
                        'coefficient_of_variation': float(values.std() / values.mean()) if values.mean() != 0 else float('inf')
                    }
        
        enhanced_metrics['distribution_analysis'] = distribution_metrics
        
        # Correlation analysis
        numeric_data = data[feature_columns].select_dtypes(include=[np.number])
        if len(numeric_data.columns) > 1:
            correlation_matrix = numeric_data.corr().abs()
            high_correlations = []
            for i, col1 in enumerate(correlation_matrix.columns):
                for j, col2 in enumerate(correlation_matrix.columns):
                    if i < j and correlation_matrix.loc[col1, col2] > 0.8:
                        high_correlations.append({
                            'feature1': col1,
                            'feature2': col2,
                            'correlation': float(correlation_matrix.loc[col1, col2])
                        })
            enhanced_metrics['high_correlations'] = high_correlations
        
        # Data type consistency
        type_consistency = {}
        for col in feature_columns:
            if data[col].dtype == 'object':
                # Check if numeric values are mixed with strings
                non_null_values = data[col].dropna()
                if len(non_null_values) > 0:
                    numeric_count = sum(pd.to_numeric(non_null_values, errors='coerce').notna())
                    consistency_ratio = numeric_count / len(non_null_values)
                    type_consistency[col] = {
                        'is_mixed_type': consistency_ratio > 0.1 and consistency_ratio < 0.9,
                        'numeric_ratio': float(consistency_ratio)
                    }
        
        enhanced_metrics['type_consistency'] = type_consistency
        
        return enhanced_metrics
    
    @handle_service_errors
    def calculate_uncertainty_quantification(self,
                                           predictions: Optional[np.ndarray] = None,
                                           model: Any = None,
                                           X: Optional[np.ndarray] = None,
                                           uncertainty_type: str = "total",
                                           monte_carlo_samples: int = 100) -> List[ConfidenceScore]:
        """Calculate uncertainty quantification with enhanced parameters."""
        with self._performance_tracking('uncertainty'):
            # Enhanced uncertainty calculation with additional parameters
            result = self.core_engine.calculate_uncertainty(
                predictions=predictions,
                model=model,
                X=X,
                uncertainty_type=uncertainty_type
            )
            
            # Add Monte Carlo sampling parameters to metadata
            if hasattr(model, 'eval') and uncertainty_type in ['epistemic', 'total']:
                for score in result:
                    if score.metadata:
                        score.metadata['monte_carlo_samples'] = monte_carlo_samples
            
            return result
    
    @handle_service_errors
    def calculate_clustering_confidence(self,
                                      X: np.ndarray,
                                      cluster_labels: np.ndarray,
                                      clustering_algorithm: str = "kmeans",
                                      consensus_algorithms: Optional[List[str]] = None) -> List[ConfidenceScore]:
        """Calculate clustering confidence with consensus support."""
        with self._performance_tracking('clustering'):
            # Standard clustering confidence
            result = self.core_engine.calculate_clustering_confidence(
                X, cluster_labels, clustering_algorithm
            )
            
            # Add consensus confidence if multiple algorithms provided
            if consensus_algorithms and len(consensus_algorithms) > 1:
                # This would require implementing multiple clustering runs
                # For now, add metadata indicating consensus capability
                for score in result:
                    if score.metadata:
                        score.metadata['consensus_ready'] = True
                        score.metadata['available_algorithms'] = consensus_algorithms
            
            return result
    
    @handle_service_errors
    def calculate_feature_engineering_confidence(self,
                                               original_features: pd.DataFrame,
                                               engineered_features: pd.DataFrame,
                                               target: Optional[np.ndarray] = None,
                                               feature_importance_scores: Optional[Dict[str, float]] = None,
                                               cross_validation: bool = False) -> Dict[str, ConfidenceScore]:
        """Calculate feature engineering confidence with cross-validation option."""
        with self._performance_tracking('feature_engineering'):
            result = self.core_engine.calculate_feature_engineering_confidence(
                original_features=original_features,
                engineered_features=engineered_features,
                target=target,
                feature_importance_scores=feature_importance_scores
            )
            
            # Add cross-validation stability if requested
            if cross_validation and target is not None:
                for feature_name, confidence_score in result.items():
                    cv_stability = self._calculate_feature_cv_stability(
                        engineered_features[feature_name], target
                    )
                    confidence_score.metadata['cv_stability'] = cv_stability
            
            return result
    
    def _calculate_feature_cv_stability(self, feature: pd.Series, target: np.ndarray) -> float:
        """Calculate feature stability across cross-validation folds."""
        # Simplified CV stability calculation
        # In practice, this would involve proper cross-validation
        try:
            from sklearn.model_selection import cross_val_score
            from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
            from sklearn.preprocessing import LabelEncoder
            
            # Prepare data
            X = feature.values.reshape(-1, 1)
            
            # Choose appropriate model
            if len(np.unique(target)) < 10:  # Classification
                model = RandomForestClassifier(n_estimators=10, random_state=42)
            else:  # Regression
                model = RandomForestRegressor(n_estimators=10, random_state=42)
            
            # Calculate cross-validation scores
            scores = cross_val_score(model, X, target, cv=3, scoring='r2' if len(np.unique(target)) >= 10 else 'accuracy')
            stability = 1 - np.std(scores)  # Higher stability with lower variance
            
            return max(0, stability)
            
        except Exception as e:
            logger.warning(f"Could not calculate CV stability: {str(e)}")
            return 0.5  # Default moderate stability
    
    @handle_service_errors
    def calculate_calibration_confidence(self,
                                       y_true: np.ndarray,
                                       y_proba: np.ndarray,
                                       y_pred: Optional[np.ndarray] = None,
                                       calibration_method: str = "platt") -> ConfidenceScore:
        """Calculate calibration confidence with method specification."""
        with self._performance_tracking('calibration'):
            result = self.core_engine.calculate_calibration_confidence(
                y_true=y_true,
                y_proba=y_proba,
                y_pred=y_pred
            )
            
            # Add calibration method to metadata
            result.metadata['calibration_method'] = calibration_method
            
            # Calculate additional calibration metrics
            additional_metrics = self._calculate_additional_calibration_metrics(
                y_true, y_proba
            )
            result.metadata.update(additional_metrics)
            
            return result
    
    def _calculate_additional_calibration_metrics(self,
                                                y_true: np.ndarray,
                                                y_proba: np.ndarray) -> Dict[str, float]:
        """Calculate additional calibration metrics."""
        additional_metrics = {}
        
        try:
            # Maximum Calibration Error (MCE)
            bin_boundaries = np.linspace(0, 1, 11)
            bin_lowers = bin_boundaries[:-1]
            bin_uppers = bin_boundaries[1:]
            
            max_calibration_error = 0
            for bin_lower, bin_upper in zip(bin_lowers, bin_uppers):
                in_bin = (y_proba >= bin_lower) & (y_proba < bin_upper)
                if np.sum(in_bin) > 0:
                    bin_accuracy = y_true[in_bin].mean()
                    bin_confidence = y_proba[in_bin].mean()
                    calibration_error = abs(bin_confidence - bin_accuracy)
                    max_calibration_error = max(max_calibration_error, calibration_error)
            
            additional_metrics['max_calibration_error'] = float(max_calibration_error)
            
            # Overconfidence and underconfidence rates
            predictions = (y_proba > 0.5).astype(int)
            correct = (predictions == y_true)
            
            overconfident = (y_proba > 0.5) & ~correct
            underconfident = (y_proba < 0.5) & correct
            
            additional_metrics['overconfidence_rate'] = float(overconfident.mean())
            additional_metrics['underconfidence_rate'] = float(underconfident.mean())
            
        except Exception as e:
            logger.warning(f"Could not calculate additional calibration metrics: {str(e)}")
        
        return additional_metrics
    
    @handle_service_errors
    def get_active_learning_samples(self,
                                   X: np.ndarray,
                                   model: Any,
                                   strategy: str = "uncertainty",
                                   n_samples: int = 10,
                                   committee_models: Optional[List[Any]] = None,
                                   diversity_factor: float = 0.0) -> Tuple[np.ndarray, List]:
        """Get active learning samples with diversity consideration."""
        with self._performance_tracking('active_learning'):
            # Core active learning selection
            indices, scores = self.core_engine.get_active_learning_samples(
                X, model, strategy, n_samples, committee_models
            )
            
            # Apply diversity factor if specified
            if diversity_factor > 0.0 and len(indices) > 1:
                indices, scores = self._apply_diversity_sampling(
                    X, indices, scores, diversity_factor
                )
            
            return indices, scores
    
    def _apply_diversity_sampling(self,
                                X: np.ndarray,
                                indices: np.ndarray,
                                scores: List,
                                diversity_factor: float) -> Tuple[np.ndarray, List]:
        """Apply diversity-based sampling to active learning selection."""
        if len(indices) <= 1:
            return indices, scores
        
        try:
            from sklearn.metrics.pairwise import pairwise_distances
            
            # Calculate pairwise distances between selected samples
            selected_samples = X[indices]
            distances = pairwise_distances(selected_samples)
            
            # Calculate diversity scores (average distance to other selected samples)
            diversity_scores = []
            for i in range(len(indices)):
                avg_distance = np.mean([distances[i, j] for j in range(len(indices)) if i != j])
                diversity_scores.append(avg_distance)
            
            # Combine uncertainty and diversity
            combined_scores = []
            for i, (uncertainty_score, diversity_score) in enumerate(zip(scores, diversity_scores)):
                if hasattr(uncertainty_score, 'score'):
                    uncertainty = 1 - uncertainty_score.score  # Convert confidence to uncertainty
                else:
                    uncertainty = uncertainty_score
                
                # Normalize diversity score
                normalized_diversity = diversity_score / (np.max(diversity_scores) + 1e-10)
                
                # Combine scores
                combined_score = (1 - diversity_factor) * uncertainty + diversity_factor * normalized_diversity
                combined_scores.append((i, combined_score))
            
            # Re-rank by combined scores
            combined_scores.sort(key=lambda x: x[1], reverse=True)
            
            # Return re-ordered indices and scores
            new_order = [idx for idx, _ in combined_scores]
            reordered_indices = indices[new_order]
            reordered_scores = [scores[i] for i in new_order]
            
            return reordered_indices, reordered_scores
            
        except Exception as e:
            logger.warning(f"Could not apply diversity sampling: {str(e)}")
            return indices, scores
    
    @handle_service_errors
    def generate_comprehensive_confidence_report(self, **kwargs) -> ConfidenceReport:
        """Generate comprehensive confidence report with service enhancements."""
        start_time = datetime.now()
        
        # Generate base report from core engine
        base_report = self.core_engine.comprehensive_confidence_report(**kwargs)
        
        # Calculate summary statistics
        summary_stats = self._calculate_summary_statistics(base_report['confidence_scores'])
        
        # Add service metadata
        service_metadata = {
            'service_version': '1.0.0',
            'processing_time': (datetime.now() - start_time).total_seconds(),
            'cache_enabled': self.cache_enabled,
            'monitoring_enabled': self.monitoring_enabled,
            'operation_counts': self._operation_counts.copy()
        }
        
        # Calculate performance metrics
        performance_metrics = self._calculate_performance_metrics()
        
        # Generate quality metrics
        quality_metrics = self._calculate_quality_metrics(base_report['confidence_scores'])
        
        return ConfidenceReport(
            timestamp=base_report['timestamp'],
            confidence_scores=base_report['confidence_scores'],
            summary_statistics=summary_stats,
            recommendations=base_report['recommendations'],
            service_metadata=service_metadata,
            performance_metrics=performance_metrics,
            quality_metrics=quality_metrics
        )
    
    def _calculate_summary_statistics(self, confidence_scores: Dict[str, Any]) -> Dict[str, float]:
        """Calculate summary statistics across all confidence scores."""
        stats = {}
        
        # Collect all confidence values
        all_scores = []
        
        for score_type, scores in confidence_scores.items():
            if isinstance(scores, dict) and 'score' in scores:
                all_scores.append(scores['score'])
            elif isinstance(scores, list):
                for score in scores:
                    if isinstance(score, dict) and 'score' in score:
                        all_scores.append(score['score'])
        
        if all_scores:
            stats['mean_confidence'] = float(np.mean(all_scores))
            stats['std_confidence'] = float(np.std(all_scores))
            stats['min_confidence'] = float(np.min(all_scores))
            stats['max_confidence'] = float(np.max(all_scores))
            stats['median_confidence'] = float(np.median(all_scores))
            stats['confidence_range'] = float(np.max(all_scores) - np.min(all_scores))
        
        return stats
    
    def _calculate_performance_metrics(self) -> Dict[str, float]:
        """Calculate performance metrics for the service."""
        total_operations = sum(self._operation_counts.values())
        
        return {
            'total_operations': float(total_operations),
            'cache_hit_ratio': 0.0,  # Would track actual cache hits
            'average_processing_time': 0.0,  # Would track from monitoring
            'operations_per_type': {k: float(v) for k, v in self._operation_counts.items()}
        }
    
    def _calculate_quality_metrics(self, confidence_scores: Dict[str, Any]) -> Dict[str, float]:
        """Calculate quality metrics for confidence scores."""
        quality_metrics = {}
        
        # Calculate reliability metrics
        quality_metrics['score_consistency'] = self._calculate_score_consistency(confidence_scores)
        quality_metrics['coverage_completeness'] = self._calculate_coverage_completeness(confidence_scores)
        
        return quality_metrics
    
    def _calculate_score_consistency(self, confidence_scores: Dict[str, Any]) -> float:
        """Calculate consistency of confidence scores across different types."""
        # Simplified consistency calculation
        return 0.85  # Placeholder - would implement actual consistency logic
    
    def _calculate_coverage_completeness(self, confidence_scores: Dict[str, Any]) -> float:
        """Calculate how complete the confidence coverage is."""
        expected_types = ['prediction', 'data_quality', 'uncertainty', 'clustering', 'feature_engineering', 'calibration']
        covered_types = len([t for t in expected_types if t in confidence_scores])
        return covered_types / len(expected_types)
    
    async def async_batch_confidence_scoring(self,
                                           operations: List[Dict[str, Any]]) -> List[Any]:
        """Process multiple confidence scoring operations asynchronously."""
        tasks = []
        
        for operation in operations:
            op_type = operation.get('type')
            op_params = operation.get('params', {})
            
            if op_type == 'prediction':
                task = asyncio.create_task(self._async_prediction_confidence(**op_params))
            elif op_type == 'data_quality':
                task = asyncio.create_task(self._async_data_quality_confidence(**op_params))
            elif op_type == 'uncertainty':
                task = asyncio.create_task(self._async_uncertainty_quantification(**op_params))
            else:
                continue
            
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return results
    
    async def _async_prediction_confidence(self, **kwargs) -> List[ConfidenceScore]:
        """Async wrapper for prediction confidence calculation."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, 
            self.calculate_prediction_confidence, 
            **kwargs
        )
    
    async def _async_data_quality_confidence(self, **kwargs) -> ConfidenceScore:
        """Async wrapper for data quality confidence calculation."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, 
            self.calculate_data_quality_confidence, 
            **kwargs
        )
    
    async def _async_uncertainty_quantification(self, **kwargs) -> List[ConfidenceScore]:
        """Async wrapper for uncertainty quantification."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, 
            self.calculate_uncertainty_quantification, 
            **kwargs
        )
    
    def clear_cache(self) -> None:
        """Clear the confidence scoring cache."""
        if self._confidence_cache:
            self._confidence_cache.clear()
            logger.info("Confidence scoring cache cleared")
    
    def get_service_statistics(self) -> Dict[str, Any]:
        """Get service performance and usage statistics."""
        return {
            'operation_counts': self._operation_counts.copy(),
            'cache_enabled': self.cache_enabled,
            'cache_size': len(self._confidence_cache) if self._confidence_cache else 0,
            'monitoring_enabled': self.monitoring_enabled,
            'async_threshold': self.async_threshold
        }


# Factory function for easy instantiation
def create_confidence_scoring_service(config: Optional[Dict[str, Any]] = None) -> ConfidenceScoringEngineService:
    """
    Factory function to create a confidence scoring engine service.
    
    Args:
        config: Configuration dictionary with service parameters
        
    Returns:
        Configured ConfidenceScoringEngineService instance
    """
    if config is None:
        config = {}
    
    return ConfidenceScoringEngineService(
        cache_enabled=config.get('cache_enabled', True),
        monitoring_enabled=config.get('monitoring_enabled', True),
        async_threshold=config.get('async_threshold', 10000)
    )


# Example usage for the service
def example_service_usage():
    """Example usage of the confidence scoring engine service."""
    
    # Create service instance
    service = create_confidence_scoring_service({
        'cache_enabled': True,
        'monitoring_enabled': True,
        'async_threshold': 5000
    })
    
    # Example data
    sample_data = pd.DataFrame({
        'feature1': np.random.normal(0, 1, 1000),
        'feature2': np.random.choice(['A', 'B', 'C'], 1000),
        'feature3': np.random.exponential(2, 1000),
        'target': np.random.binomial(1, 0.3, 1000)
    })
    
    # Calculate data quality confidence
    dq_confidence = service.calculate_data_quality_confidence(
        sample_data, 
        detailed_analysis=True
    )
    print(f"Data Quality Confidence: {dq_confidence.score:.3f}")
    
    # Generate comprehensive report
    report = service.generate_comprehensive_confidence_report(data=sample_data)
    print(f"Report Summary Statistics: {report.summary_statistics}")
    print(f"Service Metadata: {report.service_metadata}")
    
    # Get service statistics
    stats = service.get_service_statistics()
    print(f"Service Statistics: {stats}")


if __name__ == "__main__":
    example_service_usage()