"""
Comprehensive Confidence Scoring and Uncertainty Quantification Engine

This module provides advanced confidence scoring and uncertainty quantification
capabilities for all ML operations including model predictions, data quality
assessment, clustering, feature engineering, and active learning support.

Features:
- Model confidence assessment (classification/regression)
- Data quality confidence scoring
- Uncertainty quantification (aleatoric/epistemic)
- Clustering confidence metrics
- Feature engineering confidence
- Active learning support
- Calibration and reliability assessment
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple, Union, Callable
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
import warnings

# ML Libraries
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.calibration import CalibratedClassifierCV
from sklearn.isotonic import IsotonicRegression
from sklearn.model_selection import cross_val_score
from sklearn.cluster import KMeans, DBSCAN
from sklearn.metrics import silhouette_score, silhouette_samples
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.covariance import EllipticEnvelope
from sklearn.ensemble import IsolationForest
from sklearn.feature_selection import mutual_info_classif, mutual_info_regression
from sklearn.metrics import brier_score_loss
import scipy.stats as stats
from scipy.spatial.distance import cdist

# Deep Learning (optional imports)
try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

logger = logging.getLogger(__name__)


class ConfidenceType(Enum):
    """Types of confidence scoring."""
    PREDICTION = "prediction"
    DATA_QUALITY = "data_quality"
    UNCERTAINTY = "uncertainty"
    CLUSTERING = "clustering"
    FEATURE_ENGINEERING = "feature_engineering"
    CALIBRATION = "calibration"


class UncertaintyType(Enum):
    """Types of uncertainty."""
    ALEATORIC = "aleatoric"  # Data noise
    EPISTEMIC = "epistemic"  # Model uncertainty
    TOTAL = "total"  # Combined uncertainty


@dataclass
class ConfidenceScore:
    """Container for confidence scoring results."""
    score: float
    confidence_type: ConfidenceType
    uncertainty_type: Optional[UncertaintyType] = None
    metadata: Optional[Dict[str, Any]] = None
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'score': self.score,
            'confidence_type': self.confidence_type.value,
            'uncertainty_type': self.uncertainty_type.value if self.uncertainty_type else None,
            'metadata': self.metadata or {},
            'lower_bound': self.lower_bound,
            'upper_bound': self.upper_bound
        }


class BaseConfidenceScorer(ABC):
    """Abstract base class for confidence scorers."""
    
    @abstractmethod
    def calculate_confidence(self, **kwargs) -> ConfidenceScore:
        """Calculate confidence score."""
        pass
    
    @abstractmethod
    def get_scorer_type(self) -> ConfidenceType:
        """Get the type of confidence scorer."""
        pass


class ModelConfidenceScorer(BaseConfidenceScorer):
    """Confidence scoring for model predictions."""
    
    def __init__(self, model: Any = None, calibrated: bool = False):
        self.model = model
        self.calibrated = calibrated
        self.calibrated_model = None
        
    def get_scorer_type(self) -> ConfidenceType:
        return ConfidenceType.PREDICTION
    
    def calculate_confidence(self, 
                           X: np.ndarray,
                           y_pred: Optional[np.ndarray] = None,
                           y_proba: Optional[np.ndarray] = None,
                           method: str = "probability_based") -> List[ConfidenceScore]:
        """
        Calculate prediction confidence scores.
        
        Args:
            X: Input features
            y_pred: Predicted labels/values (optional if model provided)
            y_proba: Prediction probabilities (for classification)
            method: Confidence calculation method
            
        Returns:
            List of confidence scores
        """
        if self.model and y_pred is None:
            if hasattr(self.model, 'predict_proba'):
                y_proba = self.model.predict_proba(X)
                y_pred = self.model.predict(X)
            else:
                y_pred = self.model.predict(X)
        
        if method == "probability_based" and y_proba is not None:
            return self._probability_based_confidence(y_proba)
        elif method == "margin_based" and y_proba is not None:
            return self._margin_based_confidence(y_proba)
        elif method == "ensemble_variance" and hasattr(self.model, 'estimators_'):
            return self._ensemble_variance_confidence(X)
        elif method == "prediction_interval" and y_pred is not None:
            return self._prediction_interval_confidence(X, y_pred)
        else:
            # Default to distance-based confidence
            return self._distance_based_confidence(X, y_pred)
    
    def _probability_based_confidence(self, y_proba: np.ndarray) -> List[ConfidenceScore]:
        """Calculate confidence based on prediction probabilities."""
        confidences = []
        
        for i, probs in enumerate(y_proba):
            # Maximum probability as confidence
            max_prob = np.max(probs)
            
            # Entropy-based uncertainty
            entropy = -np.sum(probs * np.log(probs + 1e-10))
            normalized_entropy = entropy / np.log(len(probs))
            uncertainty_score = 1 - normalized_entropy
            
            confidence = ConfidenceScore(
                score=max_prob,
                confidence_type=ConfidenceType.PREDICTION,
                metadata={
                    'entropy': entropy,
                    'normalized_entropy': normalized_entropy,
                    'uncertainty_score': uncertainty_score,
                    'probability_distribution': probs.tolist()
                }
            )
            confidences.append(confidence)
        
        return confidences
    
    def _margin_based_confidence(self, y_proba: np.ndarray) -> List[ConfidenceScore]:
        """Calculate confidence based on margin between top predictions."""
        confidences = []
        
        for i, probs in enumerate(y_proba):
            # Sort probabilities in descending order
            sorted_probs = np.sort(probs)[::-1]
            
            # Margin between top two predictions
            margin = sorted_probs[0] - sorted_probs[1] if len(sorted_probs) > 1 else sorted_probs[0]
            
            confidence = ConfidenceScore(
                score=margin,
                confidence_type=ConfidenceType.PREDICTION,
                metadata={
                    'top_probability': sorted_probs[0],
                    'second_probability': sorted_probs[1] if len(sorted_probs) > 1 else 0.0,
                    'margin': margin
                }
            )
            confidences.append(confidence)
        
        return confidences
    
    def _ensemble_variance_confidence(self, X: np.ndarray) -> List[ConfidenceScore]:
        """Calculate confidence based on ensemble prediction variance."""
        if not hasattr(self.model, 'estimators_'):
            raise ValueError("Model must be an ensemble for variance-based confidence")
        
        # Get predictions from all estimators
        predictions = np.array([estimator.predict(X) for estimator in self.model.estimators_])
        
        # Calculate variance across predictions
        prediction_variance = np.var(predictions, axis=0)
        
        # Convert variance to confidence (higher variance = lower confidence)
        confidence_scores = 1 / (1 + prediction_variance)
        
        confidences = []
        for i, score in enumerate(confidence_scores):
            confidence = ConfidenceScore(
                score=score,
                confidence_type=ConfidenceType.PREDICTION,
                uncertainty_type=UncertaintyType.EPISTEMIC,
                metadata={
                    'prediction_variance': prediction_variance[i],
                    'ensemble_size': len(self.model.estimators_),
                    'individual_predictions': predictions[:, i].tolist()
                }
            )
            confidences.append(confidence)
        
        return confidences
    
    def _prediction_interval_confidence(self, X: np.ndarray, y_pred: np.ndarray) -> List[ConfidenceScore]:
        """Calculate confidence intervals for regression predictions."""
        if not hasattr(self.model, 'estimators_'):
            # Use bootstrap sampling for non-ensemble models
            return self._bootstrap_prediction_intervals(X, y_pred)
        
        # For ensemble models, use estimator disagreement
        predictions = np.array([estimator.predict(X) for estimator in self.model.estimators_])
        
        confidences = []
        for i in range(len(y_pred)):
            pred_std = np.std(predictions[:, i])
            
            # Calculate 95% confidence interval
            lower_bound = y_pred[i] - 1.96 * pred_std
            upper_bound = y_pred[i] + 1.96 * pred_std
            interval_width = upper_bound - lower_bound
            
            # Confidence inversely related to interval width
            confidence_score = 1 / (1 + interval_width)
            
            confidence = ConfidenceScore(
                score=confidence_score,
                confidence_type=ConfidenceType.PREDICTION,
                lower_bound=lower_bound,
                upper_bound=upper_bound,
                metadata={
                    'prediction_std': pred_std,
                    'interval_width': interval_width,
                    'prediction': y_pred[i]
                }
            )
            confidences.append(confidence)
        
        return confidences
    
    def _bootstrap_prediction_intervals(self, X: np.ndarray, y_pred: np.ndarray, 
                                      n_bootstrap: int = 100) -> List[ConfidenceScore]:
        """Calculate prediction intervals using bootstrap sampling."""
        confidences = []
        
        for i in range(len(y_pred)):
            # Simple confidence based on local density (placeholder)
            confidence_score = 0.8  # Default confidence
            
            confidence = ConfidenceScore(
                score=confidence_score,
                confidence_type=ConfidenceType.PREDICTION,
                metadata={
                    'method': 'bootstrap_placeholder',
                    'prediction': y_pred[i]
                }
            )
            confidences.append(confidence)
        
        return confidences
    
    def _distance_based_confidence(self, X: np.ndarray, y_pred: np.ndarray) -> List[ConfidenceScore]:
        """Calculate confidence based on distance to training data."""
        # This is a simplified implementation
        # In practice, you'd need access to training data
        confidences = []
        
        for i in range(len(X)):
            # Placeholder: use feature magnitude as proxy for confidence
            feature_magnitude = np.linalg.norm(X[i])
            confidence_score = 1 / (1 + feature_magnitude)
            
            confidence = ConfidenceScore(
                score=confidence_score,
                confidence_type=ConfidenceType.PREDICTION,
                metadata={
                    'feature_magnitude': feature_magnitude,
                    'method': 'distance_based_placeholder'
                }
            )
            confidences.append(confidence)
        
        return confidences
    
    def calibrate_model(self, X_cal: np.ndarray, y_cal: np.ndarray, method: str = "sigmoid"):
        """Calibrate model probabilities using calibration data."""
        if not hasattr(self.model, 'predict_proba'):
            logger.warning("Model does not support probability prediction")
            return
        
        self.calibrated_model = CalibratedClassifierCV(
            self.model, 
            method=method, 
            cv='prefit'
        )
        self.calibrated_model.fit(X_cal, y_cal)
        self.calibrated = True
        logger.info(f"Model calibrated using {method} method")


class DataQualityConfidenceScorer(BaseConfidenceScorer):
    """Confidence scoring for data quality assessment."""
    
    def get_scorer_type(self) -> ConfidenceType:
        return ConfidenceType.DATA_QUALITY
    
    def calculate_confidence(self, data: pd.DataFrame, 
                           feature_columns: Optional[List[str]] = None) -> ConfidenceScore:
        """
        Calculate overall data quality confidence.
        
        Args:
            data: Input DataFrame
            feature_columns: Specific columns to assess
            
        Returns:
            Data quality confidence score
        """
        if feature_columns is None:
            feature_columns = list(data.columns)
        
        quality_metrics = {}
        
        # Completeness confidence
        completeness_score = self._calculate_completeness_confidence(data, feature_columns)
        quality_metrics['completeness'] = completeness_score
        
        # Schema compliance confidence
        schema_score = self._calculate_schema_confidence(data, feature_columns)
        quality_metrics['schema_compliance'] = schema_score
        
        # Outlier confidence
        outlier_score = self._calculate_outlier_confidence(data, feature_columns)
        quality_metrics['outlier_assessment'] = outlier_score
        
        # Feature reliability confidence
        reliability_score = self._calculate_feature_reliability(data, feature_columns)
        quality_metrics['feature_reliability'] = reliability_score
        
        # Combined confidence score (weighted average)
        weights = {'completeness': 0.3, 'schema_compliance': 0.2, 
                  'outlier_assessment': 0.25, 'feature_reliability': 0.25}
        
        overall_confidence = sum(quality_metrics[metric] * weights[metric] 
                               for metric in quality_metrics)
        
        return ConfidenceScore(
            score=overall_confidence,
            confidence_type=ConfidenceType.DATA_QUALITY,
            metadata={
                'individual_scores': quality_metrics,
                'weights': weights,
                'data_shape': data.shape,
                'feature_count': len(feature_columns)
            }
        )
    
    def _calculate_completeness_confidence(self, data: pd.DataFrame, 
                                         feature_columns: List[str]) -> float:
        """Calculate confidence based on data completeness."""
        total_cells = len(data) * len(feature_columns)
        missing_cells = data[feature_columns].isnull().sum().sum()
        completeness_ratio = 1 - (missing_cells / total_cells)
        
        # Apply non-linear scaling for completeness confidence
        if completeness_ratio >= 0.95:
            return 0.9 + 0.1 * (completeness_ratio - 0.95) / 0.05
        elif completeness_ratio >= 0.8:
            return 0.7 + 0.2 * (completeness_ratio - 0.8) / 0.15
        else:
            return completeness_ratio * 0.7
    
    def _calculate_schema_confidence(self, data: pd.DataFrame, 
                                   feature_columns: List[str]) -> float:
        """Calculate confidence based on schema compliance."""
        schema_issues = 0
        total_checks = 0
        
        for column in feature_columns:
            total_checks += 1
            
            # Check for mixed data types
            if data[column].dtype == 'object':
                # Try to identify if column should be numeric
                non_null_values = data[column].dropna()
                if len(non_null_values) > 0:
                    numeric_count = sum(pd.to_numeric(non_null_values, errors='coerce').notna())
                    if numeric_count / len(non_null_values) > 0.8:
                        schema_issues += 0.5  # Mixed numeric/string in object column
            
            # Check for extreme value ranges
            if pd.api.types.is_numeric_dtype(data[column]):
                q99 = data[column].quantile(0.99)
                q01 = data[column].quantile(0.01)
                if abs(q99 - q01) > 1e6:  # Very large range might indicate issues
                    schema_issues += 0.3
        
        schema_confidence = max(0, 1 - schema_issues / total_checks)
        return schema_confidence
    
    def _calculate_outlier_confidence(self, data: pd.DataFrame, 
                                    feature_columns: List[str]) -> float:
        """Calculate confidence based on outlier assessment."""
        numeric_columns = data[feature_columns].select_dtypes(include=[np.number]).columns
        
        if len(numeric_columns) == 0:
            return 0.8  # Default for non-numeric data
        
        outlier_ratios = []
        
        for column in numeric_columns:
            values = data[column].dropna()
            if len(values) < 10:
                continue
            
            # IQR method for outlier detection
            Q1 = values.quantile(0.25)
            Q3 = values.quantile(0.75)
            IQR = Q3 - Q1
            
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            
            outliers = values[(values < lower_bound) | (values > upper_bound)]
            outlier_ratio = len(outliers) / len(values)
            outlier_ratios.append(outlier_ratio)
        
        if not outlier_ratios:
            return 0.8
        
        avg_outlier_ratio = np.mean(outlier_ratios)
        
        # Convert outlier ratio to confidence (fewer outliers = higher confidence)
        if avg_outlier_ratio <= 0.05:
            return 0.9 + 0.1 * (0.05 - avg_outlier_ratio) / 0.05
        elif avg_outlier_ratio <= 0.15:
            return 0.7 + 0.2 * (0.15 - avg_outlier_ratio) / 0.1
        else:
            return max(0.1, 0.7 - (avg_outlier_ratio - 0.15) * 2)
    
    def _calculate_feature_reliability(self, data: pd.DataFrame, 
                                     feature_columns: List[str]) -> float:
        """Calculate confidence based on feature reliability."""
        reliability_scores = []
        
        for column in feature_columns:
            values = data[column].dropna()
            if len(values) == 0:
                reliability_scores.append(0.0)
                continue
            
            # Calculate various reliability metrics
            
            # 1. Consistency (for categorical) or stability (for numeric)
            if pd.api.types.is_numeric_dtype(data[column]):
                # For numeric: coefficient of variation
                if values.std() == 0:
                    consistency = 1.0  # Perfect consistency
                else:
                    cv = abs(values.std() / values.mean()) if values.mean() != 0 else float('inf')
                    consistency = 1 / (1 + cv)
            else:
                # For categorical: entropy-based consistency
                value_counts = values.value_counts(normalize=True)
                entropy = -np.sum(value_counts * np.log(value_counts + 1e-10))
                max_entropy = np.log(len(value_counts))
                consistency = 1 - (entropy / max_entropy if max_entropy > 0 else 0)
            
            # 2. Uniqueness (appropriate level of cardinality)
            uniqueness_ratio = values.nunique() / len(values)
            if pd.api.types.is_numeric_dtype(data[column]):
                # For numeric, we want high uniqueness
                uniqueness_score = min(1.0, uniqueness_ratio * 2)
            else:
                # For categorical, moderate uniqueness is better
                if uniqueness_ratio <= 0.1:
                    uniqueness_score = uniqueness_ratio * 5  # Too few categories
                elif uniqueness_ratio <= 0.8:
                    uniqueness_score = 0.8 + 0.2 * (0.8 - uniqueness_ratio) / 0.7
                else:
                    uniqueness_score = 0.8 * (1 - uniqueness_ratio) / 0.2  # Too many categories
            
            # Combined reliability score
            reliability = 0.6 * consistency + 0.4 * uniqueness_score
            reliability_scores.append(reliability)
        
        return np.mean(reliability_scores) if reliability_scores else 0.5


class UncertaintyQuantifier(BaseConfidenceScorer):
    """Advanced uncertainty quantification for ML predictions."""
    
    def get_scorer_type(self) -> ConfidenceType:
        return ConfidenceType.UNCERTAINTY
    
    def calculate_confidence(self, 
                           predictions: np.ndarray,
                           model: Any = None,
                           X: Optional[np.ndarray] = None,
                           uncertainty_type: str = "total") -> List[ConfidenceScore]:
        """
        Calculate uncertainty quantification scores.
        
        Args:
            predictions: Model predictions
            model: ML model (for epistemic uncertainty)
            X: Input features (for epistemic uncertainty)
            uncertainty_type: Type of uncertainty to calculate
            
        Returns:
            List of uncertainty confidence scores
        """
        if uncertainty_type == "aleatoric":
            return self._calculate_aleatoric_uncertainty(predictions)
        elif uncertainty_type == "epistemic" and model is not None and X is not None:
            return self._calculate_epistemic_uncertainty(model, X, predictions)
        elif uncertainty_type == "total":
            aleatoric = self._calculate_aleatoric_uncertainty(predictions)
            if model is not None and X is not None:
                epistemic = self._calculate_epistemic_uncertainty(model, X, predictions)
                return self._combine_uncertainties(aleatoric, epistemic)
            else:
                return aleatoric
        else:
            raise ValueError(f"Invalid uncertainty_type: {uncertainty_type}")
    
    def _calculate_aleatoric_uncertainty(self, predictions: np.ndarray) -> List[ConfidenceScore]:
        """Calculate aleatoric (data noise) uncertainty."""
        confidences = []
        
        # For regression: use residual-based uncertainty
        # For classification: use entropy-based uncertainty
        
        if predictions.ndim == 1:  # Regression case
            # Use local prediction variance as proxy for aleatoric uncertainty
            pred_std = np.std(predictions)
            
            for i, pred in enumerate(predictions):
                # Distance from mean as uncertainty measure
                uncertainty = abs(pred - np.mean(predictions)) / (pred_std + 1e-10)
                confidence = 1 / (1 + uncertainty)
                
                confidences.append(ConfidenceScore(
                    score=confidence,
                    confidence_type=ConfidenceType.UNCERTAINTY,
                    uncertainty_type=UncertaintyType.ALEATORIC,
                    metadata={
                        'prediction': pred,
                        'uncertainty_value': uncertainty,
                        'prediction_std': pred_std
                    }
                ))
        
        else:  # Classification case (probabilities)
            for i, prob_dist in enumerate(predictions):
                # Entropy-based aleatoric uncertainty
                entropy = -np.sum(prob_dist * np.log(prob_dist + 1e-10))
                max_entropy = np.log(len(prob_dist))
                uncertainty = entropy / max_entropy if max_entropy > 0 else 0
                confidence = 1 - uncertainty
                
                confidences.append(ConfidenceScore(
                    score=confidence,
                    confidence_type=ConfidenceType.UNCERTAINTY,
                    uncertainty_type=UncertaintyType.ALEATORIC,
                    metadata={
                        'entropy': entropy,
                        'max_entropy': max_entropy,
                        'probability_distribution': prob_dist.tolist()
                    }
                ))
        
        return confidences
    
    def _calculate_epistemic_uncertainty(self, model: Any, X: np.ndarray, 
                                       predictions: np.ndarray) -> List[ConfidenceScore]:
        """Calculate epistemic (model) uncertainty."""
        confidences = []
        
        # Method 1: Monte Carlo Dropout (for neural networks)
        if TORCH_AVAILABLE and hasattr(model, 'eval'):
            return self._monte_carlo_dropout_uncertainty(model, X)
        
        # Method 2: Ensemble disagreement
        elif hasattr(model, 'estimators_'):
            return self._ensemble_disagreement_uncertainty(model, X, predictions)
        
        # Method 3: Bootstrap uncertainty (fallback)
        else:
            return self._bootstrap_uncertainty(model, X, predictions)
    
    def _monte_carlo_dropout_uncertainty(self, model: Any, X: np.ndarray,
                                       n_samples: int = 100) -> List[ConfidenceScore]:
        """Calculate uncertainty using Monte Carlo dropout."""
        if not TORCH_AVAILABLE:
            logger.warning("PyTorch not available, using fallback uncertainty method")
            return self._bootstrap_uncertainty(model, X, np.array([]))
        
        # Enable dropout during inference
        model.train()
        
        with torch.no_grad():
            mc_predictions = []
            for _ in range(n_samples):
                if isinstance(X, np.ndarray):
                    X_tensor = torch.FloatTensor(X)
                else:
                    X_tensor = X
                
                pred = model(X_tensor)
                if hasattr(pred, 'cpu'):
                    pred = pred.cpu().numpy()
                mc_predictions.append(pred)
        
        mc_predictions = np.array(mc_predictions)
        
        confidences = []
        for i in range(X.shape[0]):
            # Calculate prediction variance across MC samples
            pred_variance = np.var(mc_predictions[:, i], axis=0)
            
            if pred_variance.ndim == 0:  # Scalar (regression)
                uncertainty = pred_variance
                confidence = 1 / (1 + uncertainty)
            else:  # Vector (classification)
                uncertainty = np.mean(pred_variance)
                confidence = 1 / (1 + uncertainty)
            
            confidences.append(ConfidenceScore(
                score=confidence,
                confidence_type=ConfidenceType.UNCERTAINTY,
                uncertainty_type=UncertaintyType.EPISTEMIC,
                metadata={
                    'prediction_variance': float(uncertainty),
                    'n_mc_samples': n_samples,
                    'method': 'monte_carlo_dropout'
                }
            ))
        
        return confidences
    
    def _ensemble_disagreement_uncertainty(self, model: Any, X: np.ndarray,
                                         predictions: np.ndarray) -> List[ConfidenceScore]:
        """Calculate uncertainty based on ensemble disagreement."""
        # Get predictions from all estimators
        ensemble_predictions = []
        for estimator in model.estimators_:
            if hasattr(estimator, 'predict_proba'):
                pred = estimator.predict_proba(X)
            else:
                pred = estimator.predict(X)
            ensemble_predictions.append(pred)
        
        ensemble_predictions = np.array(ensemble_predictions)
        
        confidences = []
        for i in range(X.shape[0]):
            # Calculate disagreement across ensemble
            if ensemble_predictions.ndim == 3:  # Classification probabilities
                pred_std = np.std(ensemble_predictions[:, i, :], axis=0)
                disagreement = np.mean(pred_std)
            else:  # Regression values
                disagreement = np.std(ensemble_predictions[:, i])
            
            confidence = 1 / (1 + disagreement)
            
            confidences.append(ConfidenceScore(
                score=confidence,
                confidence_type=ConfidenceType.UNCERTAINTY,
                uncertainty_type=UncertaintyType.EPISTEMIC,
                metadata={
                    'ensemble_disagreement': float(disagreement),
                    'ensemble_size': len(model.estimators_),
                    'method': 'ensemble_disagreement'
                }
            ))
        
        return confidences
    
    def _bootstrap_uncertainty(self, model: Any, X: np.ndarray,
                             predictions: np.ndarray) -> List[ConfidenceScore]:
        """Fallback uncertainty calculation using bootstrap-like approach."""
        confidences = []
        
        for i in range(len(X)):
            # Simple distance-based uncertainty
            # In practice, this would use bootstrap sampling
            uncertainty = 0.3  # Default moderate uncertainty
            confidence = 1 - uncertainty
            
            confidences.append(ConfidenceScore(
                score=confidence,
                confidence_type=ConfidenceType.UNCERTAINTY,
                uncertainty_type=UncertaintyType.EPISTEMIC,
                metadata={
                    'method': 'bootstrap_fallback',
                    'uncertainty_estimate': uncertainty
                }
            ))
        
        return confidences
    
    def _combine_uncertainties(self, aleatoric: List[ConfidenceScore],
                             epistemic: List[ConfidenceScore]) -> List[ConfidenceScore]:
        """Combine aleatoric and epistemic uncertainties."""
        combined_confidences = []
        
        for i, (alea, epis) in enumerate(zip(aleatoric, epistemic)):
            # Combine uncertainties (assuming independence)
            alea_unc = 1 - alea.score
            epis_unc = 1 - epis.score
            
            # Total uncertainty = sqrt(aleatoric^2 + epistemic^2)
            total_unc = np.sqrt(alea_unc**2 + epis_unc**2)
            total_confidence = 1 - total_unc
            
            combined_confidences.append(ConfidenceScore(
                score=total_confidence,
                confidence_type=ConfidenceType.UNCERTAINTY,
                uncertainty_type=UncertaintyType.TOTAL,
                metadata={
                    'aleatoric_uncertainty': alea_unc,
                    'epistemic_uncertainty': epis_unc,
                    'total_uncertainty': total_unc,
                    'aleatoric_metadata': alea.metadata,
                    'epistemic_metadata': epis.metadata
                }
            ))
        
        return combined_confidences


class ClusteringConfidenceScorer(BaseConfidenceScorer):
    """Confidence scoring for clustering operations."""
    
    def get_scorer_type(self) -> ConfidenceType:
        return ConfidenceType.CLUSTERING
    
    def calculate_confidence(self, 
                           X: np.ndarray,
                           cluster_labels: np.ndarray,
                           clustering_algorithm: str = "kmeans") -> List[ConfidenceScore]:
        """
        Calculate clustering confidence scores.
        
        Args:
            X: Input features
            cluster_labels: Cluster assignments
            clustering_algorithm: Algorithm used for clustering
            
        Returns:
            List of clustering confidence scores
        """
        if clustering_algorithm == "kmeans":
            return self._kmeans_confidence(X, cluster_labels)
        elif clustering_algorithm == "dbscan":
            return self._dbscan_confidence(X, cluster_labels)
        else:
            return self._general_clustering_confidence(X, cluster_labels)
    
    def _kmeans_confidence(self, X: np.ndarray, cluster_labels: np.ndarray) -> List[ConfidenceScore]:
        """Calculate confidence for K-means clustering."""
        confidences = []
        
        # Calculate cluster centers
        unique_labels = np.unique(cluster_labels)
        cluster_centers = []
        for label in unique_labels:
            if label != -1:  # Ignore noise points
                cluster_points = X[cluster_labels == label]
                center = np.mean(cluster_points, axis=0)
                cluster_centers.append(center)
        
        cluster_centers = np.array(cluster_centers)
        
        # Calculate silhouette scores for detailed confidence
        if len(unique_labels) > 1:
            silhouette_scores = silhouette_samples(X, cluster_labels)
        else:
            silhouette_scores = np.zeros(len(X))
        
        for i, (point, label) in enumerate(zip(X, cluster_labels)):
            if label == -1:  # Noise point
                confidence = ConfidenceScore(
                    score=0.1,  # Low confidence for noise
                    confidence_type=ConfidenceType.CLUSTERING,
                    metadata={'cluster_label': label, 'point_type': 'noise'}
                )
            else:
                # Distance to cluster center
                center = cluster_centers[label]
                dist_to_center = np.linalg.norm(point - center)
                
                # Distance to nearest other center
                if len(cluster_centers) > 1:
                    other_centers = np.delete(cluster_centers, label, axis=0)
                    dist_to_other = np.min(np.linalg.norm(point - other_centers, axis=1))
                    margin = dist_to_other - dist_to_center
                    margin_confidence = 1 / (1 + np.exp(-margin))  # Sigmoid scaling
                else:
                    margin_confidence = 0.8
                
                # Silhouette-based confidence
                silhouette_conf = (silhouette_scores[i] + 1) / 2  # Scale from [-1,1] to [0,1]
                
                # Combined confidence
                overall_confidence = 0.6 * margin_confidence + 0.4 * silhouette_conf
                
                confidence = ConfidenceScore(
                    score=overall_confidence,
                    confidence_type=ConfidenceType.CLUSTERING,
                    metadata={
                        'cluster_label': int(label),
                        'distance_to_center': dist_to_center,
                        'margin_confidence': margin_confidence,
                        'silhouette_score': silhouette_scores[i],
                        'silhouette_confidence': silhouette_conf
                    }
                )
            
            confidences.append(confidence)
        
        return confidences
    
    def _dbscan_confidence(self, X: np.ndarray, cluster_labels: np.ndarray) -> List[ConfidenceScore]:
        """Calculate confidence for DBSCAN clustering."""
        confidences = []
        
        # Calculate local density for each point
        # This is a simplified version - in practice, you'd use the actual DBSCAN parameters
        
        for i, (point, label) in enumerate(zip(X, cluster_labels)):
            if label == -1:  # Noise point
                confidence = ConfidenceScore(
                    score=0.05,  # Very low confidence for noise
                    confidence_type=ConfidenceType.CLUSTERING,
                    metadata={'cluster_label': label, 'point_type': 'noise'}
                )
            else:
                # Calculate local density
                cluster_points = X[cluster_labels == label]
                distances = np.linalg.norm(cluster_points - point, axis=1)
                distances = distances[distances > 0]  # Exclude self
                
                if len(distances) > 0:
                    avg_distance = np.mean(distances)
                    density_confidence = 1 / (1 + avg_distance)
                else:
                    density_confidence = 0.5
                
                confidence = ConfidenceScore(
                    score=density_confidence,
                    confidence_type=ConfidenceType.CLUSTERING,
                    metadata={
                        'cluster_label': int(label),
                        'local_density_score': density_confidence,
                        'avg_intra_cluster_distance': avg_distance if len(distances) > 0 else 0
                    }
                )
            
            confidences.append(confidence)
        
        return confidences
    
    def _general_clustering_confidence(self, X: np.ndarray, 
                                     cluster_labels: np.ndarray) -> List[ConfidenceScore]:
        """General clustering confidence calculation."""
        confidences = []
        
        # Use silhouette analysis as the primary confidence measure
        if len(np.unique(cluster_labels)) > 1:
            silhouette_scores = silhouette_samples(X, cluster_labels)
        else:
            silhouette_scores = np.zeros(len(X))
        
        for i, (point, label) in enumerate(zip(X, cluster_labels)):
            # Convert silhouette score to confidence
            silhouette_conf = (silhouette_scores[i] + 1) / 2  # Scale to [0,1]
            
            confidence = ConfidenceScore(
                score=silhouette_conf,
                confidence_type=ConfidenceType.CLUSTERING,
                metadata={
                    'cluster_label': int(label) if label != -1 else -1,
                    'silhouette_score': silhouette_scores[i],
                    'method': 'general_silhouette'
                }
            )
            confidences.append(confidence)
        
        return confidences
    
    def calculate_consensus_confidence(self, X: np.ndarray,
                                     multiple_clusterings: List[np.ndarray]) -> List[ConfidenceScore]:
        """Calculate confidence based on consensus across multiple clustering algorithms."""
        confidences = []
        n_algorithms = len(multiple_clusterings)
        
        for i in range(len(X)):
            # Calculate consensus score for each point
            consensus_scores = []
            
            for j, clustering in enumerate(multiple_clusterings):
                for k, other_clustering in enumerate(multiple_clusterings):
                    if j != k:
                        # Check if point i is in the same cluster as its neighbors
                        # This is a simplified consensus measure
                        same_cluster_agreement = (clustering[i] == other_clustering[i])
                        consensus_scores.append(float(same_cluster_agreement))
            
            if consensus_scores:
                consensus_confidence = np.mean(consensus_scores)
            else:
                consensus_confidence = 0.5
            
            confidence = ConfidenceScore(
                score=consensus_confidence,
                confidence_type=ConfidenceType.CLUSTERING,
                metadata={
                    'consensus_score': consensus_confidence,
                    'n_algorithms': n_algorithms,
                    'method': 'consensus'
                }
            )
            confidences.append(confidence)
        
        return confidences


class FeatureEngineeringConfidenceScorer(BaseConfidenceScorer):
    """Confidence scoring for feature engineering operations."""
    
    def get_scorer_type(self) -> ConfidenceType:
        return ConfidenceType.FEATURE_ENGINEERING
    
    def calculate_confidence(self,
                           original_features: pd.DataFrame,
                           engineered_features: pd.DataFrame,
                           target: Optional[np.ndarray] = None,
                           feature_importance_scores: Optional[Dict[str, float]] = None) -> Dict[str, ConfidenceScore]:
        """
        Calculate confidence scores for engineered features.
        
        Args:
            original_features: Original feature set
            engineered_features: Engineered feature set
            target: Target variable (for supervised scoring)
            feature_importance_scores: Pre-computed importance scores
            
        Returns:
            Dictionary mapping feature names to confidence scores
        """
        confidence_scores = {}
        
        # Get newly engineered features
        original_cols = set(original_features.columns)
        engineered_cols = set(engineered_features.columns)
        new_features = engineered_cols - original_cols
        
        for feature in new_features:
            feature_confidence = self._calculate_single_feature_confidence(
                engineered_features[feature],
                original_features,
                target,
                feature_importance_scores.get(feature) if feature_importance_scores else None
            )
            confidence_scores[feature] = feature_confidence
        
        return confidence_scores
    
    def _calculate_single_feature_confidence(self,
                                           feature_series: pd.Series,
                                           original_features: pd.DataFrame,
                                           target: Optional[np.ndarray] = None,
                                           importance_score: Optional[float] = None) -> ConfidenceScore:
        """Calculate confidence for a single engineered feature."""
        metadata = {}
        confidence_components = {}
        
        # 1. Feature quality assessment
        quality_score = self._assess_feature_quality(feature_series)
        confidence_components['quality'] = quality_score
        metadata['quality_metrics'] = self._get_feature_quality_metrics(feature_series)
        
        # 2. Information content assessment
        info_score = self._assess_information_content(feature_series, target)
        confidence_components['information_content'] = info_score
        
        # 3. Redundancy assessment
        redundancy_score = self._assess_feature_redundancy(feature_series, original_features)
        confidence_components['low_redundancy'] = redundancy_score
        
        # 4. Stability assessment
        stability_score = self._assess_feature_stability(feature_series)
        confidence_components['stability'] = stability_score
        
        # 5. Importance score (if available)
        if importance_score is not None:
            confidence_components['importance'] = min(1.0, importance_score * 2)  # Scale up
        
        # Calculate weighted confidence
        weights = {
            'quality': 0.25,
            'information_content': 0.25,
            'low_redundancy': 0.2,
            'stability': 0.15,
            'importance': 0.15
        }
        
        # Adjust weights if importance score is not available
        if importance_score is None:
            weights = {k: v * 1.176 if k != 'importance' else 0 for k, v in weights.items()}
        
        overall_confidence = sum(confidence_components[component] * weights[component]
                               for component in confidence_components if component in weights)
        
        return ConfidenceScore(
            score=overall_confidence,
            confidence_type=ConfidenceType.FEATURE_ENGINEERING,
            metadata={
                'component_scores': confidence_components,
                'weights': weights,
                'feature_metrics': metadata
            }
        )
    
    def _assess_feature_quality(self, feature_series: pd.Series) -> float:
        """Assess the quality of a feature."""
        # Check for missing values
        missing_ratio = feature_series.isnull().sum() / len(feature_series)
        
        # Check for infinite values
        if pd.api.types.is_numeric_dtype(feature_series):
            inf_ratio = np.isinf(feature_series.fillna(0)).sum() / len(feature_series)
        else:
            inf_ratio = 0
        
        # Check for constant values
        if feature_series.nunique() <= 1:
            uniqueness_score = 0
        else:
            uniqueness_score = min(1.0, feature_series.nunique() / len(feature_series) * 10)
        
        # Combine quality metrics
        quality_score = (1 - missing_ratio) * 0.4 + (1 - inf_ratio) * 0.3 + uniqueness_score * 0.3
        
        return quality_score
    
    def _get_feature_quality_metrics(self, feature_series: pd.Series) -> Dict[str, Any]:
        """Get detailed feature quality metrics."""
        return {
            'missing_ratio': feature_series.isnull().sum() / len(feature_series),
            'unique_values': feature_series.nunique(),
            'data_type': str(feature_series.dtype),
            'feature_length': len(feature_series)
        }
    
    def _assess_information_content(self, feature_series: pd.Series,
                                  target: Optional[np.ndarray] = None) -> float:
        """Assess information content of the feature."""
        if target is None:
            # Use entropy-based measure for unsupervised case
            if pd.api.types.is_numeric_dtype(feature_series):
                # For numeric features, use coefficient of variation
                values = feature_series.dropna()
                if len(values) == 0 or values.std() == 0:
                    return 0.1
                cv = values.std() / abs(values.mean()) if values.mean() != 0 else float('inf')
                return min(1.0, 1 / (1 + cv))
            else:
                # For categorical features, use normalized entropy
                value_counts = feature_series.value_counts(normalize=True)
                entropy = -np.sum(value_counts * np.log(value_counts + 1e-10))
                max_entropy = np.log(len(value_counts))
                return entropy / max_entropy if max_entropy > 0 else 0
        else:
            # Use mutual information with target
            try:
                feature_values = feature_series.fillna(feature_series.median() if pd.api.types.is_numeric_dtype(feature_series) else 'missing')
                
                if pd.api.types.is_numeric_dtype(target):
                    mi = mutual_info_regression(feature_values.values.reshape(-1, 1), target)[0]
                else:
                    mi = mutual_info_classif(feature_values.values.reshape(-1, 1), target)[0]
                
                # Normalize mutual information (approximate)
                return min(1.0, mi * 2)  # Scale up for typical MI values
            except:
                return 0.3  # Default moderate score on error
    
    def _assess_feature_redundancy(self, feature_series: pd.Series,
                                 original_features: pd.DataFrame) -> float:
        """Assess how redundant the feature is with existing features."""
        max_correlation = 0
        
        numeric_original = original_features.select_dtypes(include=[np.number])
        
        if pd.api.types.is_numeric_dtype(feature_series) and len(numeric_original.columns) > 0:
            try:
                correlations = numeric_original.corrwith(feature_series).abs()
                max_correlation = correlations.max() if not correlations.isna().all() else 0
            except:
                max_correlation = 0
        
        # Convert correlation to redundancy score (low correlation = low redundancy = high score)
        redundancy_score = 1 - max_correlation
        
        return redundancy_score
    
    def _assess_feature_stability(self, feature_series: pd.Series) -> float:
        """Assess feature stability (consistency across data)."""
        # Split feature into chunks and assess consistency
        n_chunks = min(5, len(feature_series) // 10)
        if n_chunks < 2:
            return 0.8  # Default for small datasets
        
        chunk_size = len(feature_series) // n_chunks
        chunk_stats = []
        
        for i in range(n_chunks):
            start_idx = i * chunk_size
            end_idx = (i + 1) * chunk_size if i < n_chunks - 1 else len(feature_series)
            chunk = feature_series.iloc[start_idx:end_idx]
            
            if pd.api.types.is_numeric_dtype(feature_series):
                chunk_stats.append({
                    'mean': chunk.mean(),
                    'std': chunk.std(),
                    'median': chunk.median()
                })
            else:
                # For categorical, use mode and entropy
                mode = chunk.mode()
                mode_value = mode.iloc[0] if len(mode) > 0 else None
                chunk_stats.append({'mode': mode_value})
        
        if pd.api.types.is_numeric_dtype(feature_series):
            # Calculate coefficient of variation across chunks for each statistic
            means = [stat['mean'] for stat in chunk_stats if not pd.isna(stat['mean'])]
            stds = [stat['std'] for stat in chunk_stats if not pd.isna(stat['std'])]
            
            if len(means) > 1:
                mean_cv = np.std(means) / np.mean(means) if np.mean(means) != 0 else 0
                stability_score = 1 / (1 + mean_cv)
            else:
                stability_score = 0.8
        else:
            # For categorical, check mode consistency
            modes = [stat['mode'] for stat in chunk_stats if stat['mode'] is not None]
            if len(modes) > 0:
                mode_consistency = modes.count(stats.mode(modes)[0][0]) / len(modes)
                stability_score = mode_consistency
            else:
                stability_score = 0.5
        
        return stability_score


class CalibrationScorer(BaseConfidenceScorer):
    """Calibration assessment for probability predictions."""
    
    def get_scorer_type(self) -> ConfidenceType:
        return ConfidenceType.CALIBRATION
    
    def calculate_confidence(self,
                           y_true: np.ndarray,
                           y_proba: np.ndarray,
                           y_pred: Optional[np.ndarray] = None) -> ConfidenceScore:
        """
        Calculate calibration confidence score.
        
        Args:
            y_true: True labels
            y_proba: Predicted probabilities
            y_pred: Predicted labels (optional)
            
        Returns:
            Calibration confidence score
        """
        metadata = {}
        
        # 1. Brier Score (lower is better)
        if y_proba.ndim == 2:  # Multi-class
            # For multi-class, use one-vs-all Brier score
            brier_scores = []
            for class_idx in range(y_proba.shape[1]):
                y_true_binary = (y_true == class_idx).astype(int)
                brier = brier_score_loss(y_true_binary, y_proba[:, class_idx])
                brier_scores.append(brier)
            avg_brier = np.mean(brier_scores)
        else:  # Binary
            avg_brier = brier_score_loss(y_true, y_proba)
        
        metadata['brier_score'] = avg_brier
        
        # 2. Expected Calibration Error (ECE)
        ece = self._calculate_ece(y_true, y_proba)
        metadata['expected_calibration_error'] = ece
        
        # 3. Reliability diagram metrics
        reliability_metrics = self._calculate_reliability_metrics(y_true, y_proba)
        metadata.update(reliability_metrics)
        
        # 4. Combine metrics into overall calibration confidence
        # Good calibration: low Brier score, low ECE
        brier_confidence = 1 / (1 + avg_brier * 4)  # Scale Brier score
        ece_confidence = 1 - min(1.0, ece * 5)  # ECE is typically small
        
        overall_confidence = 0.6 * brier_confidence + 0.4 * ece_confidence
        
        return ConfidenceScore(
            score=overall_confidence,
            confidence_type=ConfidenceType.CALIBRATION,
            metadata=metadata
        )
    
    def _calculate_ece(self, y_true: np.ndarray, y_proba: np.ndarray, n_bins: int = 10) -> float:
        """Calculate Expected Calibration Error."""
        if y_proba.ndim == 2:
            # For multi-class, use maximum probability
            confidences = np.max(y_proba, axis=1)
            predictions = np.argmax(y_proba, axis=1)
            accuracies = (predictions == y_true).astype(float)
        else:
            # Binary case
            confidences = y_proba
            predictions = (y_proba > 0.5).astype(int)
            accuracies = (predictions == y_true).astype(float)
        
        bin_boundaries = np.linspace(0, 1, n_bins + 1)
        bin_lowers = bin_boundaries[:-1]
        bin_uppers = bin_boundaries[1:]
        
        ece = 0
        for bin_lower, bin_upper in zip(bin_lowers, bin_uppers):
            in_bin = (confidences > bin_lower) & (confidences <= bin_upper)
            prop_in_bin = in_bin.float().mean()
            
            if prop_in_bin > 0:
                accuracy_in_bin = accuracies[in_bin].mean()
                avg_confidence_in_bin = confidences[in_bin].mean()
                ece += np.abs(avg_confidence_in_bin - accuracy_in_bin) * prop_in_bin
        
        return ece
    
    def _calculate_reliability_metrics(self, y_true: np.ndarray, y_proba: np.ndarray) -> Dict[str, Any]:
        """Calculate reliability diagram metrics."""
        if y_proba.ndim == 2:
            confidences = np.max(y_proba, axis=1)
            predictions = np.argmax(y_proba, axis=1)
            accuracies = (predictions == y_true).astype(float)
        else:
            confidences = y_proba
            predictions = (y_proba > 0.5).astype(int)
            accuracies = (predictions == y_true).astype(float)
        
        # Calculate metrics for reliability assessment
        n_bins = 10
        bin_boundaries = np.linspace(0, 1, n_bins + 1)
        
        reliability_data = []
        for i in range(n_bins):
            bin_lower = bin_boundaries[i]
            bin_upper = bin_boundaries[i + 1]
            
            in_bin = (confidences >= bin_lower) & (confidences < bin_upper)
            
            if i == n_bins - 1:  # Last bin includes upper boundary
                in_bin = (confidences >= bin_lower) & (confidences <= bin_upper)
            
            if np.sum(in_bin) > 0:
                bin_accuracy = accuracies[in_bin].mean()
                bin_confidence = confidences[in_bin].mean()
                bin_size = np.sum(in_bin)
                
                reliability_data.append({
                    'bin_lower': bin_lower,
                    'bin_upper': bin_upper,
                    'bin_accuracy': bin_accuracy,
                    'bin_confidence': bin_confidence,
                    'bin_size': int(bin_size)
                })
        
        return {'reliability_data': reliability_data}


class ActiveLearningScorer:
    """Support for active learning with confidence-based sampling."""
    
    def __init__(self, confidence_engine: 'ConfidenceScoringEngine'):
        self.confidence_engine = confidence_engine
    
    def uncertainty_sampling(self, X: np.ndarray, model: Any, 
                           n_samples: int = 10) -> Tuple[np.ndarray, List[ConfidenceScore]]:
        """
        Select samples with highest uncertainty for active learning.
        
        Args:
            X: Unlabeled data
            model: Current model
            n_samples: Number of samples to select
            
        Returns:
            Indices of selected samples and their confidence scores
        """
        # Get uncertainty scores
        uncertainty_scores = self.confidence_engine.calculate_uncertainty(
            X=X, model=model, uncertainty_type="total"
        )
        
        # Convert confidence to uncertainty (lower confidence = higher uncertainty)
        uncertainties = [(i, 1 - score.score) for i, score in enumerate(uncertainty_scores)]
        
        # Sort by uncertainty (descending)
        uncertainties.sort(key=lambda x: x[1], reverse=True)
        
        # Select top n_samples
        selected_indices = np.array([idx for idx, _ in uncertainties[:n_samples]])
        selected_scores = [uncertainty_scores[idx] for idx in selected_indices]
        
        return selected_indices, selected_scores
    
    def query_by_committee(self, X: np.ndarray, committee_models: List[Any],
                          n_samples: int = 10) -> Tuple[np.ndarray, List[float]]:
        """
        Select samples with highest disagreement among committee members.
        
        Args:
            X: Unlabeled data
            committee_models: List of trained models
            n_samples: Number of samples to select
            
        Returns:
            Indices of selected samples and disagreement scores
        """
        # Get predictions from all committee members
        committee_predictions = []
        for model in committee_models:
            if hasattr(model, 'predict_proba'):
                pred = model.predict_proba(X)
            else:
                pred = model.predict(X)
            committee_predictions.append(pred)
        
        committee_predictions = np.array(committee_predictions)
        
        # Calculate disagreement for each sample
        disagreements = []
        for i in range(X.shape[0]):
            if committee_predictions.ndim == 3:  # Classification probabilities
                # Use variance across committee predictions
                pred_var = np.var(committee_predictions[:, i, :], axis=0)
                disagreement = np.mean(pred_var)
            else:  # Regression values
                disagreement = np.var(committee_predictions[:, i])
            
            disagreements.append(disagreement)
        
        # Select samples with highest disagreement
        disagreement_indices = np.argsort(disagreements)[::-1][:n_samples]
        selected_disagreements = [disagreements[idx] for idx in disagreement_indices]
        
        return disagreement_indices, selected_disagreements


class ConfidenceScoringEngine:
    """
    Main confidence scoring engine that coordinates all confidence scoring operations.
    """
    
    def __init__(self):
        self.model_scorer = ModelConfidenceScorer()
        self.data_quality_scorer = DataQualityConfidenceScorer()
        self.uncertainty_quantifier = UncertaintyQuantifier()
        self.clustering_scorer = ClusteringConfidenceScorer()
        self.feature_engineering_scorer = FeatureEngineeringConfidenceScorer()
        self.calibration_scorer = CalibrationScorer()
        self.active_learning_scorer = ActiveLearningScorer(self)
        
        logger.info("Confidence Scoring Engine initialized")
    
    def calculate_prediction_confidence(self, X: np.ndarray, model: Any = None,
                                      y_pred: Optional[np.ndarray] = None,
                                      y_proba: Optional[np.ndarray] = None,
                                      method: str = "probability_based") -> List[ConfidenceScore]:
        """Calculate confidence scores for model predictions."""
        self.model_scorer.model = model
        return self.model_scorer.calculate_confidence(
            X=X, y_pred=y_pred, y_proba=y_proba, method=method
        )
    
    def calculate_data_quality_confidence(self, data: pd.DataFrame,
                                        feature_columns: Optional[List[str]] = None) -> ConfidenceScore:
        """Calculate confidence score for data quality."""
        return self.data_quality_scorer.calculate_confidence(
            data=data, feature_columns=feature_columns
        )
    
    def calculate_uncertainty(self, predictions: Optional[np.ndarray] = None,
                            model: Any = None, X: Optional[np.ndarray] = None,
                            uncertainty_type: str = "total") -> List[ConfidenceScore]:
        """Calculate uncertainty quantification scores."""
        if predictions is None and model is not None and X is not None:
            if hasattr(model, 'predict_proba'):
                predictions = model.predict_proba(X)
            else:
                predictions = model.predict(X)
        
        return self.uncertainty_quantifier.calculate_confidence(
            predictions=predictions, model=model, X=X, uncertainty_type=uncertainty_type
        )
    
    def calculate_clustering_confidence(self, X: np.ndarray, cluster_labels: np.ndarray,
                                      clustering_algorithm: str = "kmeans") -> List[ConfidenceScore]:
        """Calculate confidence scores for clustering results."""
        return self.clustering_scorer.calculate_confidence(
            X=X, cluster_labels=cluster_labels, clustering_algorithm=clustering_algorithm
        )
    
    def calculate_feature_engineering_confidence(self,
                                               original_features: pd.DataFrame,
                                               engineered_features: pd.DataFrame,
                                               target: Optional[np.ndarray] = None,
                                               feature_importance_scores: Optional[Dict[str, float]] = None) -> Dict[str, ConfidenceScore]:
        """Calculate confidence scores for engineered features."""
        return self.feature_engineering_scorer.calculate_confidence(
            original_features=original_features,
            engineered_features=engineered_features,
            target=target,
            feature_importance_scores=feature_importance_scores
        )
    
    def calculate_calibration_confidence(self, y_true: np.ndarray, y_proba: np.ndarray,
                                       y_pred: Optional[np.ndarray] = None) -> ConfidenceScore:
        """Calculate calibration confidence score."""
        return self.calibration_scorer.calculate_confidence(
            y_true=y_true, y_proba=y_proba, y_pred=y_pred
        )
    
    def get_active_learning_samples(self, X: np.ndarray, model: Any,
                                   strategy: str = "uncertainty",
                                   n_samples: int = 10,
                                   committee_models: Optional[List[Any]] = None) -> Tuple[np.ndarray, List]:
        """Get samples for active learning based on confidence/uncertainty."""
        if strategy == "uncertainty":
            return self.active_learning_scorer.uncertainty_sampling(X, model, n_samples)
        elif strategy == "committee" and committee_models is not None:
            return self.active_learning_scorer.query_by_committee(X, committee_models, n_samples)
        else:
            raise ValueError(f"Invalid strategy: {strategy}")
    
    def comprehensive_confidence_report(self, **kwargs) -> Dict[str, Any]:
        """Generate a comprehensive confidence report for ML operations."""
        report = {
            'timestamp': pd.Timestamp.now().isoformat(),
            'confidence_scores': {},
            'summary_statistics': {},
            'recommendations': []
        }
        
        # Collect all confidence scores based on provided data
        if 'data' in kwargs:
            data_quality = self.calculate_data_quality_confidence(kwargs['data'])
            report['confidence_scores']['data_quality'] = data_quality.to_dict()
        
        if 'X' in kwargs and 'model' in kwargs:
            pred_confidence = self.calculate_prediction_confidence(
                kwargs['X'], kwargs['model']
            )
            report['confidence_scores']['prediction'] = [c.to_dict() for c in pred_confidence]
        
        if 'y_true' in kwargs and 'y_proba' in kwargs:
            calibration = self.calculate_calibration_confidence(
                kwargs['y_true'], kwargs['y_proba']
            )
            report['confidence_scores']['calibration'] = calibration.to_dict()
        
        # Generate recommendations based on confidence scores
        report['recommendations'] = self._generate_recommendations(report['confidence_scores'])
        
        return report
    
    def _generate_recommendations(self, confidence_scores: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on confidence scores."""
        recommendations = []
        
        # Data quality recommendations
        if 'data_quality' in confidence_scores:
            dq_score = confidence_scores['data_quality']['score']
            if dq_score < 0.7:
                recommendations.append("Data quality is low - consider data cleaning and preprocessing")
            if dq_score < 0.5:
                recommendations.append("Critical data quality issues detected - review data collection process")
        
        # Prediction confidence recommendations
        if 'prediction' in confidence_scores:
            pred_scores = [p['score'] for p in confidence_scores['prediction']]
            avg_pred_confidence = np.mean(pred_scores)
            if avg_pred_confidence < 0.6:
                recommendations.append("Low prediction confidence - consider model improvement or ensemble methods")
        
        # Calibration recommendations
        if 'calibration' in confidence_scores:
            cal_score = confidence_scores['calibration']['score']
            if cal_score < 0.7:
                recommendations.append("Model probabilities are poorly calibrated - consider calibration techniques")
        
        return recommendations


# Utility functions for confidence scoring
def bootstrap_confidence_interval(data: np.ndarray, statistic_func: Callable,
                                n_bootstrap: int = 1000, confidence_level: float = 0.95) -> Tuple[float, float]:
    """Calculate bootstrap confidence interval for a statistic."""
    bootstrap_statistics = []
    
    for _ in range(n_bootstrap):
        bootstrap_sample = np.random.choice(data, size=len(data), replace=True)
        bootstrap_stat = statistic_func(bootstrap_sample)
        bootstrap_statistics.append(bootstrap_stat)
    
    alpha = 1 - confidence_level
    lower_percentile = (alpha / 2) * 100
    upper_percentile = (1 - alpha / 2) * 100
    
    lower_bound = np.percentile(bootstrap_statistics, lower_percentile)
    upper_bound = np.percentile(bootstrap_statistics, upper_percentile)
    
    return lower_bound, upper_bound


def calibration_curve(y_true: np.ndarray, y_proba: np.ndarray, 
                     n_bins: int = 10) -> Tuple[np.ndarray, np.ndarray]:
    """Calculate calibration curve data."""
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    bin_lowers = bin_boundaries[:-1]
    bin_uppers = bin_boundaries[1:]
    
    bin_centers = []
    bin_accuracies = []
    
    for bin_lower, bin_upper in zip(bin_lowers, bin_uppers):
        in_bin = (y_proba >= bin_lower) & (y_proba < bin_upper)
        
        if bin_lower == bin_boundaries[-2]:  # Last bin includes upper boundary
            in_bin = (y_proba >= bin_lower) & (y_proba <= bin_upper)
        
        if np.sum(in_bin) > 0:
            bin_accuracy = y_true[in_bin].mean()
            bin_confidence = y_proba[in_bin].mean()
            
            bin_centers.append(bin_confidence)
            bin_accuracies.append(bin_accuracy)
    
    return np.array(bin_centers), np.array(bin_accuracies)


# Example usage and testing
def example_usage():
    """Example usage of the confidence scoring engine."""
    
    # Initialize the engine
    engine = ConfidenceScoringEngine()
    
    # Example 1: Data Quality Confidence
    print("=== Data Quality Confidence Example ===")
    sample_data = pd.DataFrame({
        'feature1': np.random.normal(0, 1, 1000),
        'feature2': np.random.choice(['A', 'B', 'C'], 1000),
        'feature3': np.random.exponential(2, 1000),
        'target': np.random.binomial(1, 0.3, 1000)
    })
    
    # Introduce some data quality issues
    sample_data.loc[np.random.choice(1000, 50, replace=False), 'feature1'] = np.nan
    
    dq_confidence = engine.calculate_data_quality_confidence(sample_data)
    print(f"Data Quality Confidence: {dq_confidence.score:.3f}")
    print(f"Metadata: {dq_confidence.metadata}")
    
    # Example 2: Generate comprehensive report
    print("\n=== Comprehensive Confidence Report ===")
    report = engine.comprehensive_confidence_report(data=sample_data)
    print(f"Report generated at: {report['timestamp']}")
    print(f"Recommendations: {report['recommendations']}")


if __name__ == "__main__":
    example_usage()