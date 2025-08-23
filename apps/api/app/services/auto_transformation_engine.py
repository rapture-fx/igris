"""
Auto Transformation Engine
==========================
Advanced ML-driven data transformation engine with intelligent automation.

Features:
- Intelligent data cleaning with ML-based outlier detection
- Smart missing value imputation using multiple algorithms
- Automated preprocessing with feature scaling recommendations
- ML-driven transformations including PCA and feature selection
- Quality-aware processing with rollback capabilities
- Adaptive learning from user feedback
- Pipeline management with parallel processing and caching

The engine automatically detects data patterns and applies optimal transformations
while providing detailed quality assessments and recommendations.
"""

from __future__ import annotations

import logging
import pickle
import hashlib
import time
import warnings
from typing import Dict, List, Any, Optional, Tuple, Union, Callable
from dataclasses import dataclass, asdict
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import json

import numpy as np
import pandas as pd
import yaml

# ML Libraries
from sklearn.preprocessing import (
    StandardScaler, MinMaxScaler, RobustScaler, QuantileTransformer,
    LabelEncoder, OneHotEncoder, OrdinalEncoder, TargetEncoder
)
from sklearn.decomposition import PCA
from sklearn.feature_selection import (
    SelectKBest, f_classif, f_regression, mutual_info_classif, 
    mutual_info_regression, RFE, SelectFromModel
)
from sklearn.ensemble import IsolationForest, RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer, KNNImputer
from sklearn.cluster import DBSCAN
from sklearn.pipeline import Pipeline
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.model_selection import cross_val_score
from sklearn.metrics import silhouette_score

# Text processing
import re
from collections import Counter
import unicodedata

# Statistical tests
from scipy import stats
from scipy.stats import normaltest, jarque_bera, anderson

# For fuzzy matching
try:
    from fuzzywuzzy import fuzz
    FUZZY_AVAILABLE = True
except ImportError:
    FUZZY_AVAILABLE = False

warnings.filterwarnings('ignore', category=FutureWarning)

logger = logging.getLogger(__name__)


@dataclass
class TransformationMetadata:
    """Metadata for tracking transformations."""
    transformation_id: str
    timestamp: datetime
    transformation_type: str
    parameters: Dict[str, Any]
    quality_before: Dict[str, float]
    quality_after: Dict[str, float]
    execution_time: float
    status: str
    confidence_score: float


@dataclass
class QualityMetrics:
    """Data quality assessment metrics."""
    completeness: float
    consistency: float
    validity: float
    uniqueness: float
    accuracy: float
    overall_score: float
    issues: List[str]
    recommendations: List[str]


class AutoTransformationError(Exception):
    """Custom exception for transformation errors."""
    pass


class IntelligentDataCleaner:
    """
    ML-based data cleaning with outlier detection and smart imputation.
    """
    
    def __init__(self):
        self.outlier_methods = {
            'isolation_forest': self._isolation_forest_outliers,
            'statistical': self._statistical_outliers,
            'clustering': self._clustering_outliers
        }
        
        self.imputation_methods = {
            'mean': lambda X: SimpleImputer(strategy='mean'),
            'median': lambda X: SimpleImputer(strategy='median'),
            'mode': lambda X: SimpleImputer(strategy='most_frequent'),
            'knn': lambda X: KNNImputer(n_neighbors=min(5, max(1, len(X) // 10))),
            'interpolation': self._interpolation_imputer
        }
    
    def detect_outliers(self, data: pd.DataFrame, 
                       method: str = 'auto',
                       contamination: float = 0.1) -> Dict[str, Any]:
        """
        Detect outliers using ML-based methods.
        
        Args:
            data: Input DataFrame
            method: Detection method ('auto', 'isolation_forest', 'statistical', 'clustering')
            contamination: Expected proportion of outliers
            
        Returns:
            Dictionary with outlier detection results
        """
        numeric_data = data.select_dtypes(include=[np.number])
        
        if numeric_data.empty:
            return {
                'outliers_detected': 0,
                'outlier_indices': [],
                'method_used': 'none',
                'confidence': 0.0
            }
        
        if method == 'auto':
            method = self._select_best_outlier_method(numeric_data)
        
        outlier_func = self.outlier_methods.get(method, self._isolation_forest_outliers)
        outliers, confidence = outlier_func(numeric_data, contamination)
        
        return {
            'outliers_detected': len(outliers),
            'outlier_indices': outliers.tolist() if isinstance(outliers, np.ndarray) else outliers,
            'method_used': method,
            'confidence': confidence,
            'contamination_rate': len(outliers) / len(data) if len(outliers) > 0 else 0.0
        }
    
    def handle_outliers(self, data: pd.DataFrame, 
                       outlier_indices: List[int],
                       strategy: str = 'auto') -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Handle detected outliers using various strategies.
        
        Args:
            data: Input DataFrame
            outlier_indices: Indices of detected outliers
            strategy: Handling strategy ('remove', 'cap', 'transform', 'auto')
            
        Returns:
            Tuple of (cleaned_data, handling_report)
        """
        if not outlier_indices:
            return data.copy(), {'strategy_used': 'none', 'outliers_handled': 0}
        
        if strategy == 'auto':
            strategy = self._select_outlier_strategy(data, outlier_indices)
        
        cleaned_data = data.copy()
        handling_report = {
            'strategy_used': strategy,
            'outliers_handled': len(outlier_indices)
        }
        
        if strategy == 'remove':
            cleaned_data = cleaned_data.drop(index=outlier_indices).reset_index(drop=True)
            handling_report['data_reduction'] = len(outlier_indices) / len(data)
            
        elif strategy == 'cap':
            numeric_cols = data.select_dtypes(include=[np.number]).columns
            for col in numeric_cols:
                Q1 = data[col].quantile(0.25)
                Q3 = data[col].quantile(0.75)
                IQR = Q3 - Q1
                lower_bound = Q1 - 1.5 * IQR
                upper_bound = Q3 + 1.5 * IQR
                
                cleaned_data[col] = cleaned_data[col].clip(lower=lower_bound, upper=upper_bound)
            
        elif strategy == 'transform':
            numeric_cols = data.select_dtypes(include=[np.number]).columns
            for col in numeric_cols:
                if data[col].min() > 0:
                    cleaned_data[col] = np.log1p(data[col])
                else:
                    cleaned_data[col] = np.sign(data[col]) * np.log1p(np.abs(data[col]))
        
        return cleaned_data, handling_report
    
    def smart_imputation(self, data: pd.DataFrame, 
                        strategy: str = 'auto') -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Smart missing value imputation using multiple algorithms.
        
        Args:
            data: Input DataFrame with missing values
            strategy: Imputation strategy ('auto', 'mean', 'median', 'mode', 'knn', 'interpolation')
            
        Returns:
            Tuple of (imputed_data, imputation_report)
        """
        missing_info = data.isnull().sum()
        columns_with_missing = missing_info[missing_info > 0].index.tolist()
        
        if not columns_with_missing:
            return data.copy(), {'strategy_used': 'none', 'columns_imputed': []}
        
        imputed_data = data.copy()
        imputation_report = {
            'columns_imputed': columns_with_missing,
            'imputation_strategies': {},
            'missing_before': dict(missing_info[missing_info > 0]),
            'confidence_scores': {}
        }
        
        for col in columns_with_missing:
            if strategy == 'auto':
                col_strategy = self._select_imputation_strategy(data, col)
            else:
                col_strategy = strategy
            
            confidence = self._impute_column(imputed_data, col, col_strategy)
            
            imputation_report['imputation_strategies'][col] = col_strategy
            imputation_report['confidence_scores'][col] = confidence
        
        # Verify imputation success
        missing_after = imputed_data.isnull().sum().sum()
        imputation_report['missing_after'] = missing_after
        imputation_report['imputation_success'] = missing_after == 0
        
        return imputed_data, imputation_report
    
    def detect_duplicates(self, data: pd.DataFrame, 
                         fuzzy_threshold: float = 85) -> Dict[str, Any]:
        """
        Detect duplicates with fuzzy matching for string columns.
        
        Args:
            data: Input DataFrame
            fuzzy_threshold: Threshold for fuzzy string matching
            
        Returns:
            Dictionary with duplicate detection results
        """
        # Exact duplicates
        exact_duplicates = data.duplicated()
        exact_duplicate_indices = data[exact_duplicates].index.tolist()
        
        duplicate_report = {
            'exact_duplicates': len(exact_duplicate_indices),
            'exact_duplicate_indices': exact_duplicate_indices,
            'fuzzy_duplicates': 0,
            'fuzzy_duplicate_pairs': [],
            'duplicate_rate': len(exact_duplicate_indices) / len(data)
        }
        
        # Fuzzy duplicates for string columns
        if FUZZY_AVAILABLE:
            string_cols = data.select_dtypes(include=['object']).columns
            fuzzy_pairs = []
            
            for col in string_cols:
                if data[col].dtype == 'object':
                    unique_values = data[col].dropna().unique()
                    if len(unique_values) > 1 and len(unique_values) < 1000:  # Reasonable limit
                        pairs = self._find_fuzzy_duplicates(unique_values, fuzzy_threshold)
                        fuzzy_pairs.extend([(col, pair) for pair in pairs])
            
            duplicate_report['fuzzy_duplicates'] = len(fuzzy_pairs)
            duplicate_report['fuzzy_duplicate_pairs'] = fuzzy_pairs
        
        return duplicate_report
    
    def automatic_dtype_conversion(self, data: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Automatically convert data types with confidence scoring.
        
        Args:
            data: Input DataFrame
            
        Returns:
            Tuple of (converted_data, conversion_report)
        """
        converted_data = data.copy()
        conversion_report = {
            'conversions_made': {},
            'confidence_scores': {},
            'conversion_success': True,
            'errors': []
        }
        
        for col in data.columns:
            original_dtype = str(data[col].dtype)
            
            # Try to convert object columns to more specific types
            if data[col].dtype == 'object':
                new_dtype, confidence = self._infer_optimal_dtype(data[col])
                
                if new_dtype != 'object' and confidence > 0.8:
                    try:
                        if new_dtype == 'datetime':
                            converted_data[col] = pd.to_datetime(data[col], errors='coerce')
                        elif new_dtype == 'numeric':
                            converted_data[col] = pd.to_numeric(data[col], errors='coerce')
                        elif new_dtype == 'category':
                            converted_data[col] = data[col].astype('category')
                        
                        conversion_report['conversions_made'][col] = {
                            'from': original_dtype,
                            'to': new_dtype
                        }
                        conversion_report['confidence_scores'][col] = confidence
                        
                    except Exception as e:
                        conversion_report['errors'].append(f"Failed to convert {col}: {str(e)}")
                        conversion_report['conversion_success'] = False
        
        return converted_data, conversion_report
    
    # Helper methods
    def _isolation_forest_outliers(self, data: pd.DataFrame, 
                                  contamination: float) -> Tuple[np.ndarray, float]:
        """Detect outliers using Isolation Forest."""
        clf = IsolationForest(contamination=contamination, random_state=42)
        outlier_labels = clf.fit_predict(data.fillna(0))
        outlier_indices = np.where(outlier_labels == -1)[0]
        
        # Calculate confidence based on anomaly scores
        scores = clf.decision_function(data.fillna(0))
        confidence = np.abs(scores[outlier_indices]).mean() if len(outlier_indices) > 0 else 0.0
        
        return outlier_indices, min(confidence, 1.0)
    
    def _statistical_outliers(self, data: pd.DataFrame, 
                             contamination: float) -> Tuple[List[int], float]:
        """Detect outliers using statistical methods (Z-score and IQR)."""
        outlier_indices = set()
        
        for col in data.select_dtypes(include=[np.number]).columns:
            # Z-score method
            z_scores = np.abs(stats.zscore(data[col].fillna(data[col].mean())))
            z_outliers = np.where(z_scores > 3)[0]
            
            # IQR method
            Q1 = data[col].quantile(0.25)
            Q3 = data[col].quantile(0.75)
            IQR = Q3 - Q1
            iqr_outliers = data[(data[col] < (Q1 - 1.5 * IQR)) | 
                              (data[col] > (Q3 + 1.5 * IQR))].index.tolist()
            
            outlier_indices.update(z_outliers)
            outlier_indices.update(iqr_outliers)
        
        outlier_list = list(outlier_indices)
        confidence = min(1.0, len(outlier_list) / (len(data) * contamination * 2))
        
        return outlier_list, confidence
    
    def _clustering_outliers(self, data: pd.DataFrame, 
                           contamination: float) -> Tuple[List[int], float]:
        """Detect outliers using DBSCAN clustering."""
        try:
            scaler = StandardScaler()
            scaled_data = scaler.fit_transform(data.fillna(0))
            
            # Estimate eps parameter
            eps = np.percentile(np.sort(np.linalg.norm(scaled_data, axis=1)), 
                              (1 - contamination) * 100) * 0.1
            
            dbscan = DBSCAN(eps=eps, min_samples=max(2, len(data) // 100))
            cluster_labels = dbscan.fit_predict(scaled_data)
            
            # Points labeled as -1 are outliers
            outlier_indices = np.where(cluster_labels == -1)[0]
            
            # Calculate confidence based on silhouette score
            if len(set(cluster_labels)) > 1:
                confidence = max(0.0, silhouette_score(scaled_data, cluster_labels))
            else:
                confidence = 0.5
            
            return outlier_indices.tolist(), confidence
            
        except Exception:
            return [], 0.0
    
    def _select_best_outlier_method(self, data: pd.DataFrame) -> str:
        """Select the best outlier detection method for the data."""
        if len(data) < 100:
            return 'statistical'
        elif len(data.columns) > 10:
            return 'isolation_forest'
        else:
            return 'clustering'
    
    def _select_outlier_strategy(self, data: pd.DataFrame, 
                               outlier_indices: List[int]) -> str:
        """Select optimal outlier handling strategy."""
        outlier_rate = len(outlier_indices) / len(data)
        
        if outlier_rate > 0.1:
            return 'cap'
        elif outlier_rate > 0.05:
            return 'transform'
        else:
            return 'remove'
    
    def _select_imputation_strategy(self, data: pd.DataFrame, column: str) -> str:
        """Select optimal imputation strategy for a column."""
        col_data = data[column]
        missing_rate = col_data.isnull().sum() / len(col_data)
        
        if col_data.dtype in ['object', 'category']:
            return 'mode'
        elif missing_rate > 0.5:
            return 'median'
        elif len(data) > 100 and missing_rate < 0.3:
            return 'knn'
        else:
            return 'mean' if col_data.dtype in [np.number] else 'mode'
    
    def _impute_column(self, data: pd.DataFrame, column: str, strategy: str) -> float:
        """Impute a single column and return confidence score."""
        try:
            if strategy == 'interpolation' and data[column].dtype in [np.number]:
                data[column] = data[column].interpolate()
                confidence = 0.8
            else:
                imputer = self.imputation_methods[strategy](data[[column]])
                if hasattr(imputer, 'fit_transform'):
                    imputed_values = imputer.fit_transform(data[[column]])
                    data[column] = imputed_values.flatten()
                    confidence = 0.9
                else:
                    confidence = 0.7
            
            return confidence
            
        except Exception as e:
            logger.warning(f"Imputation failed for column {column} with strategy {strategy}: {e}")
            return 0.0
    
    def _interpolation_imputer(self, X):
        """Custom interpolation imputer."""
        return X.interpolate()
    
    def _infer_optimal_dtype(self, series: pd.Series) -> Tuple[str, float]:
        """Infer optimal data type for a series."""
        non_null_series = series.dropna()
        
        if len(non_null_series) == 0:
            return 'object', 0.0
        
        # Try numeric conversion
        try:
            pd.to_numeric(non_null_series)
            return 'numeric', 0.95
        except:
            pass
        
        # Try datetime conversion
        try:
            pd.to_datetime(non_null_series)
            return 'datetime', 0.90
        except:
            pass
        
        # Check if categorical
        unique_ratio = len(non_null_series.unique()) / len(non_null_series)
        if unique_ratio < 0.5:
            return 'category', 0.85
        
        return 'object', 0.0
    
    def _find_fuzzy_duplicates(self, values: np.ndarray, 
                              threshold: float) -> List[Tuple[str, str]]:
        """Find fuzzy duplicate pairs in string values."""
        if not FUZZY_AVAILABLE:
            return []
        
        duplicates = []
        for i, val1 in enumerate(values):
            for val2 in values[i+1:]:
                if isinstance(val1, str) and isinstance(val2, str):
                    similarity = fuzz.ratio(val1.lower(), val2.lower())
                    if similarity >= threshold:
                        duplicates.append((val1, val2))
        
        return duplicates


class AutomatedPreprocessor:
    """
    Automated preprocessing with intelligent feature scaling and encoding.
    """
    
    def __init__(self):
        self.scalers = {
            'standard': StandardScaler,
            'minmax': MinMaxScaler,
            'robust': RobustScaler,
            'quantile': QuantileTransformer
        }
        
        self.encoders = {
            'onehot': OneHotEncoder,
            'label': LabelEncoder,
            'ordinal': OrdinalEncoder,
            'target': TargetEncoder
        }
    
    def recommend_scaling(self, data: pd.DataFrame) -> Dict[str, Any]:
        """
        Recommend optimal scaling strategy based on data distribution.
        
        Args:
            data: Input DataFrame
            
        Returns:
            Dictionary with scaling recommendations
        """
        numeric_cols = data.select_dtypes(include=[np.number]).columns
        recommendations = {}
        
        for col in numeric_cols:
            col_data = data[col].dropna()
            
            if len(col_data) == 0:
                continue
            
            # Test for normality
            _, normality_p = normaltest(col_data)
            
            # Calculate skewness and kurtosis
            skewness = stats.skew(col_data)
            kurtosis = stats.kurtosis(col_data)
            
            # Check for outliers
            Q1, Q3 = col_data.quantile([0.25, 0.75])
            IQR = Q3 - Q1
            outlier_count = len(col_data[(col_data < Q1 - 1.5*IQR) | (col_data > Q3 + 1.5*IQR)])
            outlier_rate = outlier_count / len(col_data)
            
            # Recommend scaler
            if outlier_rate > 0.1:
                recommended_scaler = 'robust'
                confidence = 0.9
            elif normality_p < 0.05 or abs(skewness) > 1:
                recommended_scaler = 'quantile'
                confidence = 0.8
            elif data[col].min() >= 0 and data[col].max() <= 1:
                recommended_scaler = 'none'
                confidence = 0.95
            else:
                recommended_scaler = 'standard'
                confidence = 0.85
            
            recommendations[col] = {
                'recommended_scaler': recommended_scaler,
                'confidence': confidence,
                'reasons': {
                    'outlier_rate': outlier_rate,
                    'normality_p_value': normality_p,
                    'skewness': skewness,
                    'kurtosis': kurtosis
                }
            }
        
        return recommendations
    
    def apply_scaling(self, data: pd.DataFrame, 
                     scaling_config: Dict[str, str] = None) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Apply scaling transformations to numeric columns.
        
        Args:
            data: Input DataFrame
            scaling_config: Manual scaling configuration, if None uses recommendations
            
        Returns:
            Tuple of (scaled_data, scaling_report)
        """
        if scaling_config is None:
            recommendations = self.recommend_scaling(data)
            scaling_config = {col: rec['recommended_scaler'] 
                            for col, rec in recommendations.items()}
        
        scaled_data = data.copy()
        scaling_report = {
            'transformations_applied': {},
            'fitted_scalers': {},
            'scaling_success': True
        }
        
        for col, scaler_name in scaling_config.items():
            if col not in data.columns or scaler_name == 'none':
                continue
            
            try:
                if scaler_name in self.scalers:
                    scaler = self.scalers[scaler_name]()
                    scaled_values = scaler.fit_transform(data[[col]])
                    scaled_data[col] = scaled_values.flatten()
                    
                    scaling_report['transformations_applied'][col] = scaler_name
                    scaling_report['fitted_scalers'][col] = scaler
                
            except Exception as e:
                logger.error(f"Failed to scale column {col} with {scaler_name}: {e}")
                scaling_report['scaling_success'] = False
        
        return scaled_data, scaling_report
    
    def recommend_encoding(self, data: pd.DataFrame, 
                          target_column: str = None) -> Dict[str, Any]:
        """
        Recommend encoding strategies for categorical variables.
        
        Args:
            data: Input DataFrame
            target_column: Target column for supervised encoding methods
            
        Returns:
            Dictionary with encoding recommendations
        """
        categorical_cols = data.select_dtypes(include=['object', 'category']).columns
        recommendations = {}
        
        for col in categorical_cols:
            if col == target_column:
                continue
            
            unique_count = data[col].nunique()
            total_count = len(data)
            cardinality_ratio = unique_count / total_count
            
            # Recommend encoding based on cardinality
            if unique_count <= 2:
                recommended_encoding = 'label'
                confidence = 0.9
            elif unique_count <= 10:
                recommended_encoding = 'onehot'
                confidence = 0.85
            elif cardinality_ratio > 0.5:
                recommended_encoding = 'target' if target_column else 'label'
                confidence = 0.8
            else:
                recommended_encoding = 'target' if target_column else 'ordinal'
                confidence = 0.75
            
            recommendations[col] = {
                'recommended_encoding': recommended_encoding,
                'confidence': confidence,
                'unique_count': unique_count,
                'cardinality_ratio': cardinality_ratio
            }
        
        return recommendations
    
    def apply_encoding(self, data: pd.DataFrame,
                      encoding_config: Dict[str, str] = None,
                      target_column: str = None) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Apply encoding transformations to categorical columns.
        
        Args:
            data: Input DataFrame
            encoding_config: Manual encoding configuration
            target_column: Target column for supervised encoding
            
        Returns:
            Tuple of (encoded_data, encoding_report)
        """
        if encoding_config is None:
            recommendations = self.recommend_encoding(data, target_column)
            encoding_config = {col: rec['recommended_encoding'] 
                             for col, rec in recommendations.items()}
        
        encoded_data = data.copy()
        encoding_report = {
            'transformations_applied': {},
            'fitted_encoders': {},
            'new_columns': [],
            'encoding_success': True
        }
        
        for col, encoding_name in encoding_config.items():
            if col not in data.columns:
                continue
            
            try:
                if encoding_name == 'onehot':
                    encoder = OneHotEncoder(sparse=False, handle_unknown='ignore')
                    encoded_values = encoder.fit_transform(data[[col]])
                    
                    # Create new column names
                    feature_names = [f"{col}_{cat}" for cat in encoder.categories_[0]]
                    encoded_df = pd.DataFrame(encoded_values, columns=feature_names, index=data.index)
                    
                    # Drop original column and add encoded columns
                    encoded_data = encoded_data.drop(columns=[col])
                    encoded_data = pd.concat([encoded_data, encoded_df], axis=1)
                    
                    encoding_report['new_columns'].extend(feature_names)
                
                elif encoding_name == 'label':
                    encoder = LabelEncoder()
                    encoded_data[col] = encoder.fit_transform(data[col].astype(str))
                
                elif encoding_name == 'target' and target_column:
                    encoder = TargetEncoder()
                    encoded_data[col] = encoder.fit_transform(data[col], data[target_column])
                
                elif encoding_name == 'ordinal':
                    encoder = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
                    encoded_data[col] = encoder.fit_transform(data[[col]]).flatten()
                
                encoding_report['transformations_applied'][col] = encoding_name
                encoding_report['fitted_encoders'][col] = encoder
                
            except Exception as e:
                logger.error(f"Failed to encode column {col} with {encoding_name}: {e}")
                encoding_report['encoding_success'] = False
        
        return encoded_data, encoding_report
    
    def automated_feature_engineering(self, data: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Automated feature engineering including polynomial features and interactions.
        
        Args:
            data: Input DataFrame
            
        Returns:
            Tuple of (engineered_data, engineering_report)
        """
        engineered_data = data.copy()
        engineering_report = {
            'features_created': [],
            'engineering_methods': [],
            'original_feature_count': len(data.columns),
            'new_feature_count': 0
        }
        
        numeric_cols = data.select_dtypes(include=[np.number]).columns.tolist()
        
        if len(numeric_cols) >= 2:
            # Create interaction features for top correlated pairs
            correlations = data[numeric_cols].corr()
            
            # Find highly correlated pairs (but not perfectly correlated)
            high_corr_pairs = []
            for i in range(len(correlations.columns)):
                for j in range(i+1, len(correlations.columns)):
                    corr_value = abs(correlations.iloc[i, j])
                    if 0.3 < corr_value < 0.9:  # Moderate to high correlation
                        high_corr_pairs.append((correlations.columns[i], correlations.columns[j], corr_value))
            
            # Sort by correlation and take top 5 pairs
            high_corr_pairs.sort(key=lambda x: x[2], reverse=True)
            top_pairs = high_corr_pairs[:min(5, len(high_corr_pairs))]
            
            for col1, col2, corr in top_pairs:
                # Interaction features
                interaction_name = f"{col1}_x_{col2}"
                engineered_data[interaction_name] = data[col1] * data[col2]
                engineering_report['features_created'].append(interaction_name)
                
                # Ratio features
                if data[col2].min() != 0:
                    ratio_name = f"{col1}_div_{col2}"
                    engineered_data[ratio_name] = data[col1] / (data[col2] + 1e-8)
                    engineering_report['features_created'].append(ratio_name)
        
        # Polynomial features for highly skewed columns
        for col in numeric_cols:
            col_data = data[col].dropna()
            if len(col_data) > 0:
                skewness = abs(stats.skew(col_data))
                if skewness > 1.5:  # Highly skewed
                    # Square root transformation
                    if data[col].min() >= 0:
                        sqrt_name = f"{col}_sqrt"
                        engineered_data[sqrt_name] = np.sqrt(data[col] + 1e-8)
                        engineering_report['features_created'].append(sqrt_name)
                    
                    # Log transformation
                    if data[col].min() > 0:
                        log_name = f"{col}_log"
                        engineered_data[log_name] = np.log1p(data[col])
                        engineering_report['features_created'].append(log_name)
        
        engineering_report['new_feature_count'] = len(engineering_report['features_created'])
        engineering_report['engineering_methods'] = ['interactions', 'ratios', 'polynomial_transforms']
        
        return engineered_data, engineering_report
    
    def preprocess_text(self, data: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Automated text preprocessing pipeline.
        
        Args:
            data: Input DataFrame
            
        Returns:
            Tuple of (processed_data, text_report)
        """
        text_cols = data.select_dtypes(include=['object']).columns
        processed_data = data.copy()
        text_report = {
            'text_columns_processed': [],
            'preprocessing_steps': [],
            'text_statistics': {}
        }
        
        for col in text_cols:
            if processed_data[col].dtype == 'object':
                # Check if column contains text (not just categorical values)
                avg_length = processed_data[col].dropna().astype(str).str.len().mean()
                
                if avg_length > 10:  # Likely text column
                    # Text preprocessing
                    processed_data[col] = self._clean_text(processed_data[col])
                    
                    # Extract text features
                    text_features = self._extract_text_features(processed_data[col])
                    
                    for feature_name, feature_values in text_features.items():
                        new_col_name = f"{col}_{feature_name}"
                        processed_data[new_col_name] = feature_values
                    
                    text_report['text_columns_processed'].append(col)
                    text_report['text_statistics'][col] = {
                        'avg_length': avg_length,
                        'features_extracted': list(text_features.keys())
                    }
        
        text_report['preprocessing_steps'] = ['cleaning', 'normalization', 'feature_extraction']
        
        return processed_data, text_report
    
    def _clean_text(self, text_series: pd.Series) -> pd.Series:
        """Clean text data."""
        cleaned = text_series.copy()
        
        # Convert to string
        cleaned = cleaned.astype(str)
        
        # Remove HTML tags
        cleaned = cleaned.str.replace(r'<[^>]+>', '', regex=True)
        
        # Normalize unicode
        cleaned = cleaned.apply(lambda x: unicodedata.normalize('NFKD', x))
        
        # Remove extra whitespace
        cleaned = cleaned.str.strip().str.replace(r'\s+', ' ', regex=True)
        
        # Convert to lowercase
        cleaned = cleaned.str.lower()
        
        return cleaned
    
    def _extract_text_features(self, text_series: pd.Series) -> Dict[str, pd.Series]:
        """Extract basic text features."""
        features = {}
        
        # Length features
        features['length'] = text_series.str.len()
        features['word_count'] = text_series.str.split().str.len()
        
        # Character features
        features['digit_count'] = text_series.str.count(r'\d')
        features['punct_count'] = text_series.str.count(r'[^\w\s]')
        features['upper_count'] = text_series.str.count(r'[A-Z]')
        
        return features


class MLDrivenTransformer:
    """
    ML-driven transformations including PCA, feature selection, and binning.
    """
    
    def __init__(self):
        self.feature_selectors = {
            'k_best': SelectKBest,
            'rfe': RFE,
            'model_based': SelectFromModel
        }
    
    def apply_pca(self, data: pd.DataFrame, 
                  n_components: Union[int, float, str] = 'auto',
                  explained_variance_threshold: float = 0.95) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Apply Principal Component Analysis for dimensionality reduction.
        
        Args:
            data: Input DataFrame (numeric only)
            n_components: Number of components or 'auto'
            explained_variance_threshold: Minimum explained variance to retain
            
        Returns:
            Tuple of (transformed_data, pca_report)
        """
        numeric_data = data.select_dtypes(include=[np.number])
        
        if numeric_data.empty or numeric_data.shape[1] < 2:
            return data.copy(), {
                'pca_applied': False,
                'reason': 'Insufficient numeric features for PCA'
            }
        
        # Handle missing values
        if numeric_data.isnull().any().any():
            imputer = SimpleImputer(strategy='mean')
            numeric_data = pd.DataFrame(
                imputer.fit_transform(numeric_data),
                columns=numeric_data.columns,
                index=numeric_data.index
            )
        
        # Standardize data
        scaler = StandardScaler()
        scaled_data = scaler.fit_transform(numeric_data)
        
        # Determine number of components
        if n_components == 'auto':
            # Find optimal number of components
            pca_temp = PCA()
            pca_temp.fit(scaled_data)
            cumsum_var = np.cumsum(pca_temp.explained_variance_ratio_)
            n_components = np.argmax(cumsum_var >= explained_variance_threshold) + 1
            n_components = max(1, min(n_components, scaled_data.shape[1]))
        
        # Apply PCA
        pca = PCA(n_components=n_components)
        pca_data = pca.fit_transform(scaled_data)
        
        # Create new DataFrame with PCA components
        pca_columns = [f'PC{i+1}' for i in range(n_components)]
        pca_df = pd.DataFrame(pca_data, columns=pca_columns, index=data.index)
        
        # Combine with non-numeric columns
        non_numeric_data = data.select_dtypes(exclude=[np.number])
        if not non_numeric_data.empty:
            result_data = pd.concat([non_numeric_data, pca_df], axis=1)
        else:
            result_data = pca_df
        
        pca_report = {
            'pca_applied': True,
            'original_features': numeric_data.shape[1],
            'components_selected': n_components,
            'explained_variance_ratio': pca.explained_variance_ratio_.tolist(),
            'cumulative_explained_variance': np.cumsum(pca.explained_variance_ratio_).tolist(),
            'total_explained_variance': np.sum(pca.explained_variance_ratio_),
            'dimensionality_reduction_ratio': n_components / numeric_data.shape[1],
            'pca_components': pca_columns,
            'fitted_pca': pca,
            'fitted_scaler': scaler
        }
        
        return result_data, pca_report
    
    def feature_selection(self, data: pd.DataFrame,
                         target_column: str,
                         method: str = 'auto',
                         k: Union[int, str] = 'auto') -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Apply feature selection using various ML algorithms.
        
        Args:
            data: Input DataFrame
            target_column: Target column name
            method: Feature selection method ('auto', 'k_best', 'rfe', 'model_based')
            k: Number of features to select or 'auto'
            
        Returns:
            Tuple of (selected_data, selection_report)
        """
        if target_column not in data.columns:
            return data.copy(), {
                'selection_applied': False,
                'reason': f'Target column {target_column} not found'
            }
        
        # Separate features and target
        X = data.drop(columns=[target_column])
        y = data[target_column]
        
        # Only work with numeric features for ML-based selection
        numeric_features = X.select_dtypes(include=[np.number])
        
        if numeric_features.empty:
            return data.copy(), {
                'selection_applied': False,
                'reason': 'No numeric features available for selection'
            }
        
        # Handle missing values
        if numeric_features.isnull().any().any():
            imputer = SimpleImputer(strategy='mean')
            numeric_features = pd.DataFrame(
                imputer.fit_transform(numeric_features),
                columns=numeric_features.columns,
                index=numeric_features.index
            )
        
        # Determine selection method
        if method == 'auto':
            method = self._select_feature_selection_method(numeric_features, y)
        
        # Determine number of features to select
        if k == 'auto':
            k = max(1, min(10, len(numeric_features.columns) // 2))
        
        # Apply feature selection
        selected_features, selector, scores = self._apply_feature_selector(
            numeric_features, y, method, k
        )
        
        # Combine selected numeric features with non-numeric features and target
        non_numeric_features = X.select_dtypes(exclude=[np.number])
        result_columns = selected_features + non_numeric_features.columns.tolist() + [target_column]
        result_data = data[result_columns]
        
        selection_report = {
            'selection_applied': True,
            'method_used': method,
            'original_features': len(numeric_features.columns),
            'selected_features': len(selected_features),
            'selected_feature_names': selected_features,
            'feature_scores': dict(zip(selected_features, scores)) if scores is not None else {},
            'selection_ratio': len(selected_features) / len(numeric_features.columns),
            'fitted_selector': selector
        }
        
        return result_data, selection_report
    
    def automated_binning(self, data: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Automated binning and discretization for continuous variables.
        
        Args:
            data: Input DataFrame
            
        Returns:
            Tuple of (binned_data, binning_report)
        """
        binned_data = data.copy()
        binning_report = {
            'columns_binned': [],
            'binning_strategies': {},
            'bin_edges': {}
        }
        
        numeric_cols = data.select_dtypes(include=[np.number]).columns
        
        for col in numeric_cols:
            col_data = data[col].dropna()
            
            if len(col_data.unique()) > 20:  # Only bin high-cardinality columns
                binning_strategy = self._determine_binning_strategy(col_data)
                
                if binning_strategy != 'none':
                    binned_values, bin_edges = self._apply_binning(col_data, binning_strategy)
                    
                    # Create new binned column
                    new_col_name = f"{col}_binned"
                    binned_data[new_col_name] = pd.cut(data[col], bins=bin_edges, 
                                                     include_lowest=True, duplicates='drop')
                    
                    binning_report['columns_binned'].append(col)
                    binning_report['binning_strategies'][col] = binning_strategy
                    binning_report['bin_edges'][col] = bin_edges.tolist() if hasattr(bin_edges, 'tolist') else bin_edges
        
        return binned_data, binning_report
    
    def time_series_features(self, data: pd.DataFrame,
                           timestamp_column: str) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Extract time series features including lags and rolling statistics.
        
        Args:
            data: Input DataFrame
            timestamp_column: Name of timestamp column
            
        Returns:
            Tuple of (enhanced_data, time_series_report)
        """
        if timestamp_column not in data.columns:
            return data.copy(), {
                'time_series_features_added': False,
                'reason': f'Timestamp column {timestamp_column} not found'
            }
        
        enhanced_data = data.copy()
        
        # Convert timestamp column to datetime
        enhanced_data[timestamp_column] = pd.to_datetime(enhanced_data[timestamp_column])
        enhanced_data = enhanced_data.sort_values(timestamp_column)
        
        time_series_report = {
            'time_series_features_added': True,
            'features_created': [],
            'timestamp_column': timestamp_column
        }
        
        # Extract datetime components
        enhanced_data[f'{timestamp_column}_year'] = enhanced_data[timestamp_column].dt.year
        enhanced_data[f'{timestamp_column}_month'] = enhanced_data[timestamp_column].dt.month
        enhanced_data[f'{timestamp_column}_day'] = enhanced_data[timestamp_column].dt.day
        enhanced_data[f'{timestamp_column}_dayofweek'] = enhanced_data[timestamp_column].dt.dayofweek
        enhanced_data[f'{timestamp_column}_hour'] = enhanced_data[timestamp_column].dt.hour
        
        time_features = [f'{timestamp_column}_year', f'{timestamp_column}_month', 
                        f'{timestamp_column}_day', f'{timestamp_column}_dayofweek', 
                        f'{timestamp_column}_hour']
        time_series_report['features_created'].extend(time_features)
        
        # Create lag and rolling features for numeric columns
        numeric_cols = data.select_dtypes(include=[np.number]).columns
        
        for col in numeric_cols:
            # Lag features
            for lag in [1, 2, 3]:
                lag_col = f'{col}_lag_{lag}'
                enhanced_data[lag_col] = enhanced_data[col].shift(lag)
                time_series_report['features_created'].append(lag_col)
            
            # Rolling statistics
            for window in [3, 7]:
                roll_mean_col = f'{col}_rolling_mean_{window}'
                roll_std_col = f'{col}_rolling_std_{window}'
                
                enhanced_data[roll_mean_col] = enhanced_data[col].rolling(window=window).mean()
                enhanced_data[roll_std_col] = enhanced_data[col].rolling(window=window).std()
                
                time_series_report['features_created'].extend([roll_mean_col, roll_std_col])
        
        return enhanced_data, time_series_report
    
    # Helper methods
    def _select_feature_selection_method(self, X: pd.DataFrame, y: pd.Series) -> str:
        """Select optimal feature selection method."""
        n_features = X.shape[1]
        
        if n_features > 50:
            return 'model_based'
        elif len(y.unique()) < 10:  # Classification-like
            return 'k_best'
        else:
            return 'rfe'
    
    def _apply_feature_selector(self, X: pd.DataFrame, y: pd.Series, 
                               method: str, k: int) -> Tuple[List[str], Any, List[float]]:
        """Apply the specified feature selection method."""
        try:
            if method == 'k_best':
                # Determine scoring function
                if len(y.unique()) < 10:  # Classification
                    score_func = f_classif
                else:  # Regression
                    score_func = f_regression
                
                selector = SelectKBest(score_func=score_func, k=k)
                selector.fit(X, y)
                
                selected_mask = selector.get_support()
                selected_features = X.columns[selected_mask].tolist()
                scores = selector.scores_[selected_mask].tolist()
                
            elif method == 'rfe':
                # Use RandomForest as base estimator
                if len(y.unique()) < 10:
                    estimator = RandomForestClassifier(n_estimators=10, random_state=42)
                else:
                    estimator = RandomForestRegressor(n_estimators=10, random_state=42)
                
                selector = RFE(estimator=estimator, n_features_to_select=k)
                selector.fit(X, y)
                
                selected_mask = selector.get_support()
                selected_features = X.columns[selected_mask].tolist()
                scores = selector.ranking_[selected_mask].tolist()
                
            elif method == 'model_based':
                # Use RandomForest for feature importance
                if len(y.unique()) < 10:
                    estimator = RandomForestClassifier(n_estimators=10, random_state=42)
                else:
                    estimator = RandomForestRegressor(n_estimators=10, random_state=42)
                
                estimator.fit(X, y)
                selector = SelectFromModel(estimator, max_features=k)
                selector.fit(X, y)
                
                selected_mask = selector.get_support()
                selected_features = X.columns[selected_mask].tolist()
                scores = estimator.feature_importances_[selected_mask].tolist()
            
            return selected_features, selector, scores
            
        except Exception as e:
            logger.error(f"Feature selection failed: {e}")
            # Return top k features by variance as fallback
            feature_vars = X.var().sort_values(ascending=False)
            selected_features = feature_vars.head(k).index.tolist()
            return selected_features, None, None
    
    def _determine_binning_strategy(self, data: pd.Series) -> str:
        """Determine optimal binning strategy for a column."""
        unique_count = len(data.unique())
        data_range = data.max() - data.min()
        
        if unique_count > 100 or data_range > 1000:
            return 'quantile'
        elif data.min() >= 0 and np.all(data == data.astype(int)):
            return 'equal_width'
        else:
            return 'equal_frequency'
    
    def _apply_binning(self, data: pd.Series, strategy: str) -> Tuple[pd.Series, np.ndarray]:
        """Apply binning strategy to data."""
        n_bins = min(10, max(3, len(data.unique()) // 10))
        
        if strategy == 'quantile':
            bin_edges = np.percentile(data, np.linspace(0, 100, n_bins + 1))
        elif strategy == 'equal_width':
            bin_edges = np.linspace(data.min(), data.max(), n_bins + 1)
        elif strategy == 'equal_frequency':
            bin_edges = np.percentile(data, np.linspace(0, 100, n_bins + 1))
        else:
            bin_edges = np.linspace(data.min(), data.max(), n_bins + 1)
        
        # Ensure unique bin edges
        bin_edges = np.unique(bin_edges)
        
        binned_data = pd.cut(data, bins=bin_edges, include_lowest=True, duplicates='drop')
        
        return binned_data, bin_edges


class QualityAwareProcessor:
    """
    Quality-aware processing with assessment and rollback capabilities.
    """
    
    def __init__(self):
        self.quality_metrics = [
            'completeness', 'consistency', 'validity', 'uniqueness', 'accuracy'
        ]
    
    def assess_data_quality(self, data: pd.DataFrame) -> QualityMetrics:
        """
        Comprehensive data quality assessment.
        
        Args:
            data: Input DataFrame
            
        Returns:
            QualityMetrics object with detailed assessment
        """
        # Completeness: Ratio of non-missing values
        completeness = 1 - (data.isnull().sum().sum() / (len(data) * len(data.columns)))
        
        # Consistency: Check for data type consistency and format consistency
        consistency = self._assess_consistency(data)
        
        # Validity: Check for valid values in each column
        validity = self._assess_validity(data)
        
        # Uniqueness: Check for duplicate records
        uniqueness = 1 - (data.duplicated().sum() / len(data))
        
        # Accuracy: Statistical measures for numeric data
        accuracy = self._assess_accuracy(data)
        
        # Overall score
        overall_score = np.mean([completeness, consistency, validity, uniqueness, accuracy])
        
        # Generate issues and recommendations
        issues = []
        recommendations = []
        
        if completeness < 0.9:
            issues.append(f"Low completeness ({completeness:.2%})")
            recommendations.append("Implement missing value imputation strategy")
        
        if consistency < 0.8:
            issues.append(f"Low consistency ({consistency:.2%})")
            recommendations.append("Standardize data formats and types")
        
        if validity < 0.9:
            issues.append(f"Low validity ({validity:.2%})")
            recommendations.append("Validate and clean invalid values")
        
        if uniqueness < 0.95:
            issues.append(f"Duplicate records detected ({(1-uniqueness):.2%})")
            recommendations.append("Remove or merge duplicate records")
        
        if accuracy < 0.8:
            issues.append(f"Potential accuracy issues ({accuracy:.2%})")
            recommendations.append("Review data collection and validation processes")
        
        return QualityMetrics(
            completeness=completeness,
            consistency=consistency,
            validity=validity,
            uniqueness=uniqueness,
            accuracy=accuracy,
            overall_score=overall_score,
            issues=issues,
            recommendations=recommendations
        )
    
    def compare_quality(self, before_data: pd.DataFrame, 
                       after_data: pd.DataFrame) -> Dict[str, Any]:
        """
        Compare data quality before and after transformation.
        
        Args:
            before_data: Data before transformation
            after_data: Data after transformation
            
        Returns:
            Quality comparison report
        """
        quality_before = self.assess_data_quality(before_data)
        quality_after = self.assess_data_quality(after_data)
        
        quality_changes = {
            'completeness_change': quality_after.completeness - quality_before.completeness,
            'consistency_change': quality_after.consistency - quality_before.consistency,
            'validity_change': quality_after.validity - quality_before.validity,
            'uniqueness_change': quality_after.uniqueness - quality_before.uniqueness,
            'accuracy_change': quality_after.accuracy - quality_before.accuracy,
            'overall_change': quality_after.overall_score - quality_before.overall_score
        }
        
        improvement_summary = {
            'overall_improvement': quality_changes['overall_change'] > 0,
            'improved_metrics': [metric for metric, change in quality_changes.items() 
                               if change > 0.01],
            'degraded_metrics': [metric for metric, change in quality_changes.items() 
                               if change < -0.01],
            'quality_score_change': quality_changes['overall_change']
        }
        
        return {
            'quality_before': asdict(quality_before),
            'quality_after': asdict(quality_after),
            'quality_changes': quality_changes,
            'improvement_summary': improvement_summary
        }
    
    def rollback_transformation(self, current_data: pd.DataFrame,
                              backup_data: pd.DataFrame,
                              metadata: TransformationMetadata) -> Dict[str, Any]:
        """
        Rollback a transformation if quality degraded.
        
        Args:
            current_data: Current transformed data
            backup_data: Backup of original data
            metadata: Transformation metadata
            
        Returns:
            Rollback report
        """
        # Assess current quality
        current_quality = self.assess_data_quality(current_data)
        original_quality = self.assess_data_quality(backup_data)
        
        quality_degradation = (current_quality.overall_score < 
                              original_quality.overall_score - 0.05)
        
        rollback_report = {
            'rollback_performed': False,
            'rollback_reason': '',
            'quality_comparison': {
                'original_score': original_quality.overall_score,
                'current_score': current_quality.overall_score,
                'quality_change': current_quality.overall_score - original_quality.overall_score
            }
        }
        
        if quality_degradation:
            rollback_report.update({
                'rollback_performed': True,
                'rollback_reason': 'Quality degradation detected',
                'restored_data_shape': backup_data.shape,
                'transformation_reverted': metadata.transformation_type
            })
            
            logger.warning(f"Rolling back transformation {metadata.transformation_id} due to quality degradation")
            
            return rollback_report, backup_data
        else:
            return rollback_report, current_data
    
    def optimize_performance(self, data: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Optimize data for different processing scenarios.
        
        Args:
            data: Input DataFrame
            
        Returns:
            Tuple of (optimized_data, optimization_report)
        """
        optimized_data = data.copy()
        optimization_report = {
            'optimizations_applied': [],
            'memory_reduction': 0,
            'processing_speedup_estimate': 1.0
        }
        
        original_memory = data.memory_usage(deep=True).sum()
        
        # Optimize numeric types
        numeric_cols = data.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            if data[col].dtype == 'int64':
                if data[col].min() >= np.iinfo(np.int32).min and data[col].max() <= np.iinfo(np.int32).max:
                    optimized_data[col] = data[col].astype('int32')
                elif data[col].min() >= np.iinfo(np.int16).min and data[col].max() <= np.iinfo(np.int16).max:
                    optimized_data[col] = data[col].astype('int16')
                elif data[col].min() >= np.iinfo(np.int8).min and data[col].max() <= np.iinfo(np.int8).max:
                    optimized_data[col] = data[col].astype('int8')
            
            elif data[col].dtype == 'float64':
                if np.allclose(data[col], data[col].astype('float32'), rtol=1e-5, equal_nan=True):
                    optimized_data[col] = data[col].astype('float32')
        
        # Convert object columns to category if beneficial
        object_cols = data.select_dtypes(include=['object']).columns
        for col in object_cols:
            unique_ratio = data[col].nunique() / len(data)
            if unique_ratio < 0.5:  # Less than 50% unique values
                optimized_data[col] = data[col].astype('category')
                optimization_report['optimizations_applied'].append(f"Converted {col} to category")
        
        optimized_memory = optimized_data.memory_usage(deep=True).sum()
        memory_reduction = (original_memory - optimized_memory) / original_memory
        
        optimization_report['memory_reduction'] = memory_reduction
        optimization_report['processing_speedup_estimate'] = 1 + memory_reduction * 0.5
        
        if memory_reduction > 0.1:
            optimization_report['optimizations_applied'].append(f"Memory reduction: {memory_reduction:.1%}")
        
        return optimized_data, optimization_report
    
    # Helper methods
    def _assess_consistency(self, data: pd.DataFrame) -> float:
        """Assess data consistency."""
        consistency_scores = []
        
        # Check data type consistency
        for col in data.columns:
            if data[col].dtype == 'object':
                # Check if all non-null values can be converted to the same type
                non_null_data = data[col].dropna()
                if len(non_null_data) > 0:
                    # Try numeric conversion
                    try:
                        pd.to_numeric(non_null_data)
                        consistency_scores.append(1.0)
                        continue
                    except:
                        pass
                    
                    # Try datetime conversion
                    try:
                        pd.to_datetime(non_null_data)
                        consistency_scores.append(1.0)
                        continue
                    except:
                        pass
                    
                    # Check string consistency (similar lengths)
                    if isinstance(non_null_data.iloc[0], str):
                        lengths = non_null_data.str.len()
                        cv = lengths.std() / lengths.mean() if lengths.mean() > 0 else 1
                        consistency_scores.append(max(0, 1 - cv))
                    else:
                        consistency_scores.append(0.8)
            else:
                consistency_scores.append(1.0)
        
        return np.mean(consistency_scores) if consistency_scores else 1.0
    
    def _assess_validity(self, data: pd.DataFrame) -> float:
        """Assess data validity."""
        validity_scores = []
        
        for col in data.columns:
            non_null_data = data[col].dropna()
            if len(non_null_data) == 0:
                validity_scores.append(0.0)
                continue
            
            if data[col].dtype in [np.number]:
                # Check for infinite values
                infinite_count = np.isinf(non_null_data).sum()
                validity = 1 - (infinite_count / len(non_null_data))
                validity_scores.append(validity)
            
            elif data[col].dtype == 'object':
                # Check for obviously invalid strings (too short/long, special patterns)
                if isinstance(non_null_data.iloc[0], str):
                    # Simple validity check: not too many special characters
                    special_char_ratio = non_null_data.str.count(r'[^a-zA-Z0-9\s]').mean() / non_null_data.str.len().mean()
                    validity = max(0, 1 - special_char_ratio)
                    validity_scores.append(validity)
                else:
                    validity_scores.append(0.9)
            else:
                validity_scores.append(1.0)
        
        return np.mean(validity_scores) if validity_scores else 1.0
    
    def _assess_accuracy(self, data: pd.DataFrame) -> float:
        """Assess data accuracy using statistical measures."""
        accuracy_scores = []
        
        numeric_cols = data.select_dtypes(include=[np.number]).columns
        
        for col in numeric_cols:
            non_null_data = data[col].dropna()
            if len(non_null_data) < 10:
                accuracy_scores.append(0.5)
                continue
            
            # Check for statistical outliers
            Q1, Q3 = non_null_data.quantile([0.25, 0.75])
            IQR = Q3 - Q1
            outliers = non_null_data[(non_null_data < Q1 - 1.5*IQR) | (non_null_data > Q3 + 1.5*IQR)]
            outlier_ratio = len(outliers) / len(non_null_data)
            
            # Accuracy decreases with more outliers
            accuracy = max(0.3, 1 - outlier_ratio * 2)
            accuracy_scores.append(accuracy)
        
        return np.mean(accuracy_scores) if accuracy_scores else 0.8


class AdaptiveLearning:
    """
    Adaptive learning system that learns from user feedback and optimizes transformations.
    """
    
    def __init__(self, feedback_storage_path: str = "transformation_feedback.json"):
        self.feedback_storage = feedback_storage_path
        self.transformation_history = []
        self.user_preferences = {}
        self.performance_patterns = {}
    
    def record_transformation_feedback(self, transformation_id: str,
                                     feedback_score: float,
                                     user_comments: str = "",
                                     transformation_metadata: Dict = None) -> None:
        """
        Record user feedback for a transformation.
        
        Args:
            transformation_id: Unique identifier for the transformation
            feedback_score: Score from 0-1 indicating user satisfaction
            user_comments: Optional user comments
            transformation_metadata: Metadata about the transformation
        """
        feedback_entry = {
            'transformation_id': transformation_id,
            'timestamp': datetime.now().isoformat(),
            'feedback_score': feedback_score,
            'user_comments': user_comments,
            'transformation_metadata': transformation_metadata or {}
        }
        
        # Load existing feedback
        existing_feedback = self._load_feedback()
        existing_feedback.append(feedback_entry)
        
        # Save updated feedback
        self._save_feedback(existing_feedback)
        
        # Update learning models
        self._update_learning_models(feedback_entry)
        
        logger.info(f"Recorded feedback for transformation {transformation_id}: {feedback_score}")
    
    def suggest_optimal_transformations(self, data_characteristics: Dict) -> List[Dict[str, Any]]:
        """
        Suggest optimal transformations based on learned patterns.
        
        Args:
            data_characteristics: Characteristics of the input data
            
        Returns:
            List of suggested transformations with confidence scores
        """
        suggestions = []
        
        # Analyze historical feedback patterns
        feedback_history = self._load_feedback()
        
        if not feedback_history:
            # Return default suggestions if no history
            return self._get_default_suggestions(data_characteristics)
        
        # Find similar data patterns
        similar_cases = self._find_similar_cases(data_characteristics, feedback_history)
        
        # Generate suggestions based on successful patterns
        for case in similar_cases:
            if case['feedback_score'] > 0.7:  # High satisfaction threshold
                suggestion = {
                    'transformation_type': case['transformation_metadata'].get('transformation_type'),
                    'parameters': case['transformation_metadata'].get('parameters', {}),
                    'confidence_score': case['feedback_score'],
                    'historical_success_rate': self._calculate_success_rate(case['transformation_type'])
                }
                suggestions.append(suggestion)
        
        # Rank suggestions by confidence and success rate
        suggestions.sort(key=lambda x: x['confidence_score'] * x['historical_success_rate'], reverse=True)
        
        return suggestions[:5]  # Return top 5 suggestions
    
    def adapt_parameters(self, transformation_type: str, 
                        data_characteristics: Dict) -> Dict[str, Any]:
        """
        Adapt transformation parameters based on learned optimal values.
        
        Args:
            transformation_type: Type of transformation
            data_characteristics: Characteristics of the data
            
        Returns:
            Optimized parameters
        """
        feedback_history = self._load_feedback()
        
        # Filter feedback for this transformation type
        relevant_feedback = [
            f for f in feedback_history 
            if f['transformation_metadata'].get('transformation_type') == transformation_type
        ]
        
        if not relevant_feedback:
            return self._get_default_parameters(transformation_type)
        
        # Find parameters from high-scoring transformations
        successful_cases = [
            f for f in relevant_feedback 
            if f['feedback_score'] > 0.8
        ]
        
        if successful_cases:
            # Extract common parameter patterns
            parameter_patterns = {}
            for case in successful_cases:
                params = case['transformation_metadata'].get('parameters', {})
                for key, value in params.items():
                    if key not in parameter_patterns:
                        parameter_patterns[key] = []
                    parameter_patterns[key].append(value)
            
            # Calculate optimal parameters
            optimized_params = {}
            for key, values in parameter_patterns.items():
                if isinstance(values[0], (int, float)):
                    optimized_params[key] = np.mean(values)
                else:
                    # For categorical parameters, use most common value
                    optimized_params[key] = max(set(values), key=values.count)
            
            return optimized_params
        
        return self._get_default_parameters(transformation_type)
    
    def track_transformation_performance(self, transformation_metadata: TransformationMetadata) -> None:
        """
        Track performance metrics for transformations.
        
        Args:
            transformation_metadata: Metadata about the transformation
        """
        performance_key = transformation_metadata.transformation_type
        
        if performance_key not in self.performance_patterns:
            self.performance_patterns[performance_key] = {
                'execution_times': [],
                'quality_improvements': [],
                'success_rates': []
            }
        
        patterns = self.performance_patterns[performance_key]
        patterns['execution_times'].append(transformation_metadata.execution_time)
        
        quality_improvement = (transformation_metadata.quality_after.get('overall_score', 0) - 
                             transformation_metadata.quality_before.get('overall_score', 0))
        patterns['quality_improvements'].append(quality_improvement)
        
        success = transformation_metadata.status == 'success'
        patterns['success_rates'].append(1.0 if success else 0.0)
        
        # Keep only recent history (last 100 transformations)
        for metric_list in patterns.values():
            if len(metric_list) > 100:
                metric_list[:] = metric_list[-100:]
    
    def get_performance_insights(self) -> Dict[str, Any]:
        """
        Get insights about transformation performance patterns.
        
        Returns:
            Performance insights and recommendations
        """
        insights = {
            'transformation_performance': {},
            'recommendations': [],
            'trends': {}
        }
        
        for transformation_type, patterns in self.performance_patterns.items():
            if patterns['execution_times']:
                avg_execution_time = np.mean(patterns['execution_times'])
                avg_quality_improvement = np.mean(patterns['quality_improvements'])
                success_rate = np.mean(patterns['success_rates'])
                
                insights['transformation_performance'][transformation_type] = {
                    'avg_execution_time': avg_execution_time,
                    'avg_quality_improvement': avg_quality_improvement,
                    'success_rate': success_rate,
                    'total_executions': len(patterns['execution_times'])
                }
                
                # Generate recommendations
                if success_rate < 0.8:
                    insights['recommendations'].append(
                        f"Consider reviewing parameters for {transformation_type} (low success rate: {success_rate:.1%})"
                    )
                
                if avg_execution_time > 30:  # seconds
                    insights['recommendations'].append(
                        f"Optimize {transformation_type} for better performance (avg time: {avg_execution_time:.1f}s)"
                    )
        
        return insights
    
    # Helper methods
    def _load_feedback(self) -> List[Dict]:
        """Load feedback from storage."""
        try:
            with open(self.feedback_storage, 'r') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return []
    
    def _save_feedback(self, feedback: List[Dict]) -> None:
        """Save feedback to storage."""
        try:
            with open(self.feedback_storage, 'w') as f:
                json.dump(feedback, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save feedback: {e}")
    
    def _update_learning_models(self, feedback_entry: Dict) -> None:
        """Update internal learning models with new feedback."""
        transformation_type = feedback_entry['transformation_metadata'].get('transformation_type')
        feedback_score = feedback_entry['feedback_score']
        
        # Update user preferences
        if transformation_type not in self.user_preferences:
            self.user_preferences[transformation_type] = []
        
        self.user_preferences[transformation_type].append(feedback_score)
        
        # Keep only recent preferences
        if len(self.user_preferences[transformation_type]) > 50:
            self.user_preferences[transformation_type] = self.user_preferences[transformation_type][-50:]
    
    def _find_similar_cases(self, data_characteristics: Dict, 
                           feedback_history: List[Dict]) -> List[Dict]:
        """Find similar transformation cases in history."""
        similar_cases = []
        
        for case in feedback_history:
            metadata = case['transformation_metadata']
            
            # Simple similarity based on data size and column count
            case_data_size = metadata.get('data_shape', [0, 0])[0]
            case_column_count = metadata.get('data_shape', [0, 0])[1]
            
            current_data_size = data_characteristics.get('row_count', 0)
            current_column_count = data_characteristics.get('column_count', 0)
            
            # Calculate similarity score
            size_similarity = 1 - abs(case_data_size - current_data_size) / max(case_data_size, current_data_size, 1)
            column_similarity = 1 - abs(case_column_count - current_column_count) / max(case_column_count, current_column_count, 1)
            
            overall_similarity = (size_similarity + column_similarity) / 2
            
            if overall_similarity > 0.5:  # Similarity threshold
                similar_cases.append(case)
        
        return similar_cases
    
    def _calculate_success_rate(self, transformation_type: str) -> float:
        """Calculate historical success rate for a transformation type."""
        feedback_history = self._load_feedback()
        relevant_cases = [
            f for f in feedback_history 
            if f['transformation_metadata'].get('transformation_type') == transformation_type
        ]
        
        if not relevant_cases:
            return 0.5  # Default neutral success rate
        
        success_count = sum(1 for case in relevant_cases if case['feedback_score'] > 0.7)
        return success_count / len(relevant_cases)
    
    def _get_default_suggestions(self, data_characteristics: Dict) -> List[Dict[str, Any]]:
        """Get default transformation suggestions."""
        return [
            {
                'transformation_type': 'data_cleaning',
                'parameters': {'strategy': 'auto'},
                'confidence_score': 0.8,
                'historical_success_rate': 0.85
            },
            {
                'transformation_type': 'feature_scaling',
                'parameters': {'method': 'auto'},
                'confidence_score': 0.75,
                'historical_success_rate': 0.80
            }
        ]
    
    def _get_default_parameters(self, transformation_type: str) -> Dict[str, Any]:
        """Get default parameters for a transformation type."""
        defaults = {
            'outlier_detection': {'method': 'auto', 'contamination': 0.1},
            'imputation': {'strategy': 'auto'},
            'scaling': {'method': 'auto'},
            'encoding': {'method': 'auto'},
            'feature_selection': {'method': 'auto', 'k': 'auto'},
            'pca': {'n_components': 'auto', 'explained_variance_threshold': 0.95}
        }
        
        return defaults.get(transformation_type, {})


class PipelineManager:
    """
    Advanced pipeline management with parallel processing and caching.
    """
    
    def __init__(self, cache_enabled: bool = True, max_workers: int = 4):
        self.cache_enabled = cache_enabled
        self.max_workers = max_workers
        self.transformation_cache = {}
        self.pipeline_cache = {}
    
    def create_transformation_pipeline(self, transformations: List[Dict[str, Any]]) -> Pipeline:
        """
        Create a scikit-learn pipeline from transformation specifications.
        
        Args:
            transformations: List of transformation specifications
            
        Returns:
            Configured scikit-learn Pipeline
        """
        pipeline_steps = []
        
        for i, transform_spec in enumerate(transformations):
            transform_type = transform_spec.get('type')
            transform_params = transform_spec.get('parameters', {})
            
            # Create transformer based on type
            transformer = self._create_transformer(transform_type, transform_params)
            
            if transformer:
                step_name = f"{transform_type}_{i}"
                pipeline_steps.append((step_name, transformer))
        
        if not pipeline_steps:
            # Return identity transformer if no valid transformations
            pipeline_steps = [('identity', IdentityTransformer())]
        
        return Pipeline(pipeline_steps)
    
    def execute_pipeline_parallel(self, data: pd.DataFrame,
                                 transformations: List[Dict[str, Any]],
                                 parallel_groups: List[List[int]] = None) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Execute transformation pipeline with parallel processing for independent transformations.
        
        Args:
            data: Input DataFrame
            transformations: List of transformation specifications
            parallel_groups: Groups of transformation indices that can run in parallel
            
        Returns:
            Tuple of (transformed_data, execution_report)
        """
        if parallel_groups is None:
            # Auto-detect independent transformations
            parallel_groups = self._detect_independent_transformations(transformations)
        
        execution_report = {
            'total_transformations': len(transformations),
            'parallel_groups': len(parallel_groups),
            'execution_times': {},
            'success_count': 0,
            'failed_transformations': []
        }
        
        current_data = data.copy()
        
        for group_idx, group in enumerate(parallel_groups):
            if len(group) == 1:
                # Single transformation - execute normally
                transform_idx = group[0]
                transform_spec = transformations[transform_idx]
                
                start_time = time.time()
                try:
                    current_data = self._execute_single_transformation(current_data, transform_spec)
                    execution_report['success_count'] += 1
                except Exception as e:
                    logger.error(f"Transformation {transform_idx} failed: {e}")
                    execution_report['failed_transformations'].append({
                        'index': transform_idx,
                        'type': transform_spec.get('type'),
                        'error': str(e)
                    })
                
                execution_time = time.time() - start_time
                execution_report['execution_times'][f'transform_{transform_idx}'] = execution_time
            
            else:
                # Multiple transformations - execute in parallel
                start_time = time.time()
                
                with ThreadPoolExecutor(max_workers=min(len(group), self.max_workers)) as executor:
                    # Submit parallel tasks
                    future_to_transform = {
                        executor.submit(self._execute_single_transformation, current_data, transformations[idx]): idx
                        for idx in group
                    }
                    
                    # Collect results
                    parallel_results = {}
                    for future in as_completed(future_to_transform):
                        transform_idx = future_to_transform[future]
                        try:
                            result = future.result()
                            parallel_results[transform_idx] = result
                            execution_report['success_count'] += 1
                        except Exception as e:
                            logger.error(f"Parallel transformation {transform_idx} failed: {e}")
                            execution_report['failed_transformations'].append({
                                'index': transform_idx,
                                'type': transformations[transform_idx].get('type'),
                                'error': str(e)
                            })
                
                # Merge parallel results (this is simplified - may need custom logic)
                if parallel_results:
                    # Use the result with the most columns as the base
                    base_result = max(parallel_results.values(), key=lambda x: len(x.columns))
                    current_data = base_result
                
                execution_time = time.time() - start_time
                execution_report['execution_times'][f'parallel_group_{group_idx}'] = execution_time
        
        return current_data, execution_report
    
    def cache_transformation_results(self, cache_key: str, 
                                   data: pd.DataFrame,
                                   ttl: int = 3600) -> None:
        """
        Cache transformation results.
        
        Args:
            cache_key: Unique key for caching
            data: Data to cache
            ttl: Time to live in seconds
        """
        if not self.cache_enabled:
            return
        
        cache_entry = {
            'data': data,
            'timestamp': time.time(),
            'ttl': ttl
        }
        
        self.transformation_cache[cache_key] = cache_entry
        logger.debug(f"Cached transformation result: {cache_key}")
    
    def get_cached_transformation(self, cache_key: str) -> Optional[pd.DataFrame]:
        """
        Retrieve cached transformation results.
        
        Args:
            cache_key: Cache key to retrieve
            
        Returns:
            Cached DataFrame or None if not found/expired
        """
        if not self.cache_enabled or cache_key not in self.transformation_cache:
            return None
        
        cache_entry = self.transformation_cache[cache_key]
        
        # Check if cache entry has expired
        if time.time() - cache_entry['timestamp'] > cache_entry['ttl']:
            del self.transformation_cache[cache_key]
            return None
        
        logger.debug(f"Cache hit: {cache_key}")
        return cache_entry['data'].copy()
    
    def export_pipeline_config(self, transformations: List[Dict[str, Any]]) -> str:
        """
        Export pipeline configuration to YAML.
        
        Args:
            transformations: List of transformation specifications
            
        Returns:
            YAML string representation
        """
        pipeline_config = {
            'pipeline_version': '1.0',
            'created_timestamp': datetime.now().isoformat(),
            'transformations': transformations
        }
        
        return yaml.dump(pipeline_config, default_flow_style=False)
    
    def import_pipeline_config(self, yaml_config: str) -> List[Dict[str, Any]]:
        """
        Import pipeline configuration from YAML.
        
        Args:
            yaml_config: YAML string configuration
            
        Returns:
            List of transformation specifications
        """
        try:
            config = yaml.safe_load(yaml_config)
            return config.get('transformations', [])
        except yaml.YAMLError as e:
            raise AutoTransformationError(f"Invalid pipeline configuration: {e}")
    
    # Helper methods
    def _create_transformer(self, transform_type: str, parameters: Dict[str, Any]) -> Optional[BaseEstimator]:
        """Create a transformer instance based on type and parameters."""
        transformer_map = {
            'standard_scaler': StandardScaler,
            'minmax_scaler': MinMaxScaler,
            'robust_scaler': RobustScaler,
            'onehot_encoder': OneHotEncoder,
            'label_encoder': LabelEncoder,
            'simple_imputer': SimpleImputer,
            'knn_imputer': KNNImputer,
            'pca': PCA
        }
        
        transformer_class = transformer_map.get(transform_type)
        
        if transformer_class:
            try:
                return transformer_class(**parameters)
            except Exception as e:
                logger.error(f"Failed to create transformer {transform_type}: {e}")
                return None
        
        return None
    
    def _detect_independent_transformations(self, transformations: List[Dict[str, Any]]) -> List[List[int]]:
        """Detect which transformations can run independently in parallel."""
        # Simplified detection - assumes transformations that don't depend on each other can run in parallel
        # In a more sophisticated implementation, this would analyze dependencies
        
        groups = []
        current_group = []
        
        for i, transform in enumerate(transformations):
            transform_type = transform.get('type', '')
            
            # Group transformations that can potentially run in parallel
            if transform_type in ['outlier_detection', 'data_validation', 'quality_assessment']:
                current_group.append(i)
            else:
                if current_group:
                    groups.append(current_group)
                    current_group = []
                groups.append([i])  # Sequential transformation
        
        if current_group:
            groups.append(current_group)
        
        return groups
    
    def _execute_single_transformation(self, data: pd.DataFrame, 
                                     transform_spec: Dict[str, Any]) -> pd.DataFrame:
        """Execute a single transformation."""
        transform_type = transform_spec.get('type')
        parameters = transform_spec.get('parameters', {})
        
        # This would be expanded to handle all transformation types
        # For now, return data unchanged
        return data.copy()


class IdentityTransformer(BaseEstimator, TransformerMixin):
    """Identity transformer that returns data unchanged."""
    
    def fit(self, X, y=None):
        return self
    
    def transform(self, X):
        return X


class AutoTransformationEngine:
    """
    Main auto transformation engine that orchestrates all components.
    """
    
    def __init__(self, cache_enabled: bool = True, learning_enabled: bool = True):
        # Initialize all components
        self.data_cleaner = IntelligentDataCleaner()
        self.preprocessor = AutomatedPreprocessor()
        self.ml_transformer = MLDrivenTransformer()
        self.quality_processor = QualityAwareProcessor()
        self.adaptive_learning = AdaptiveLearning() if learning_enabled else None
        self.pipeline_manager = PipelineManager(cache_enabled=cache_enabled)
        
        # Transformation history
        self.transformation_history = []
    
    def auto_transform(self, data: pd.DataFrame, 
                      transformation_goals: List[str] = None,
                      target_column: str = None,
                      custom_config: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Automatically transform data based on intelligent analysis.
        
        Args:
            data: Input DataFrame
            transformation_goals: List of transformation goals
            target_column: Target column for supervised transformations
            custom_config: Custom configuration overrides
            
        Returns:
            Comprehensive transformation results
        """
        logger.info(f"Starting auto transformation for data shape: {data.shape}")
        start_time = datetime.now()
        
        # Generate unique transformation ID
        transformation_id = hashlib.md5(
            f"{data.shape}_{start_time.isoformat()}".encode()
        ).hexdigest()[:8]
        
        try:
            # Step 1: Initial quality assessment
            initial_quality = self.quality_processor.assess_data_quality(data)
            logger.info(f"Initial data quality score: {initial_quality.overall_score:.3f}")
            
            # Step 2: Create backup for rollback capability
            data_backup = data.copy()
            
            # Step 3: Intelligent data cleaning
            cleaning_results = self._apply_intelligent_cleaning(data, custom_config)
            current_data = cleaning_results['cleaned_data']
            
            # Step 4: Automated preprocessing
            preprocessing_results = self._apply_automated_preprocessing(
                current_data, target_column, custom_config
            )
            current_data = preprocessing_results['preprocessed_data']
            
            # Step 5: ML-driven transformations
            ml_results = self._apply_ml_transformations(
                current_data, target_column, transformation_goals, custom_config
            )
            current_data = ml_results['transformed_data']
            
            # Step 6: Final quality assessment
            final_quality = self.quality_processor.assess_data_quality(current_data)
            quality_comparison = self.quality_processor.compare_quality(data, current_data)
            
            # Step 7: Check if rollback is needed
            transformation_metadata = TransformationMetadata(
                transformation_id=transformation_id,
                timestamp=start_time,
                transformation_type='auto_transform',
                parameters=custom_config or {},
                quality_before=asdict(initial_quality),
                quality_after=asdict(final_quality),
                execution_time=(datetime.now() - start_time).total_seconds(),
                status='success',
                confidence_score=final_quality.overall_score
            )
            
            rollback_result, final_data = self.quality_processor.rollback_transformation(
                current_data, data_backup, transformation_metadata
            )
            
            # Step 8: Performance optimization
            optimized_data, optimization_report = self.quality_processor.optimize_performance(final_data)
            
            # Step 9: Generate comprehensive results
            results = {
                'success': True,
                'transformation_id': transformation_id,
                'execution_time': transformation_metadata.execution_time,
                'original_shape': data.shape,
                'final_shape': optimized_data.shape,
                'transformed_data': optimized_data,
                
                # Quality metrics
                'initial_quality': asdict(initial_quality),
                'final_quality': asdict(final_quality),
                'quality_comparison': quality_comparison,
                'rollback_performed': rollback_result['rollback_performed'],
                
                # Transformation details
                'cleaning_results': cleaning_results,
                'preprocessing_results': preprocessing_results,
                'ml_transformation_results': ml_results,
                'optimization_report': optimization_report,
                
                # Recommendations and insights
                'recommendations': self._generate_recommendations(
                    initial_quality, final_quality, cleaning_results, 
                    preprocessing_results, ml_results
                ),
                'transformation_summary': self._generate_transformation_summary(
                    cleaning_results, preprocessing_results, ml_results
                )
            }
            
            # Step 10: Record transformation for adaptive learning
            if self.adaptive_learning:
                self.adaptive_learning.track_transformation_performance(transformation_metadata)
            
            # Step 11: Cache results if beneficial
            if optimization_report['memory_reduction'] > 0.1:
                cache_key = f"auto_transform_{hashlib.md5(str(data.values.tobytes()).encode()).hexdigest()[:8]}"
                self.pipeline_manager.cache_transformation_results(cache_key, optimized_data)
            
            logger.info(f"Auto transformation completed successfully in {transformation_metadata.execution_time:.2f}s")
            return results
            
        except Exception as e:
            logger.error(f"Auto transformation failed: {e}")
            return {
                'success': False,
                'transformation_id': transformation_id,
                'error': str(e),
                'original_data': data
            }
    
    def suggest_transformations(self, data: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Suggest optimal transformations based on data analysis and learned patterns.
        
        Args:
            data: Input DataFrame
            
        Returns:
            List of transformation suggestions
        """
        data_characteristics = {
            'row_count': len(data),
            'column_count': len(data.columns),
            'numeric_columns': len(data.select_dtypes(include=[np.number]).columns),
            'categorical_columns': len(data.select_dtypes(include=['object', 'category']).columns),
            'missing_values': data.isnull().sum().sum(),
            'duplicate_rows': data.duplicated().sum()
        }
        
        suggestions = []
        
        # Get suggestions from adaptive learning if available
        if self.adaptive_learning:
            learned_suggestions = self.adaptive_learning.suggest_optimal_transformations(data_characteristics)
            suggestions.extend(learned_suggestions)
        
        # Add rule-based suggestions
        rule_based_suggestions = self._generate_rule_based_suggestions(data, data_characteristics)
        suggestions.extend(rule_based_suggestions)
        
        # Remove duplicates and rank by confidence
        unique_suggestions = []
        seen_types = set()
        
        for suggestion in sorted(suggestions, key=lambda x: x.get('confidence_score', 0), reverse=True):
            if suggestion['transformation_type'] not in seen_types:
                unique_suggestions.append(suggestion)
                seen_types.add(suggestion['transformation_type'])
        
        return unique_suggestions[:10]  # Return top 10 suggestions
    
    def apply_from_yaml(self, data: pd.DataFrame, yaml_config: str) -> Dict[str, Any]:
        """
        Apply transformations from YAML configuration.
        
        Args:
            data: Input DataFrame
            yaml_config: YAML transformation configuration
            
        Returns:
            Transformation results
        """
        try:
            transformations = self.pipeline_manager.import_pipeline_config(yaml_config)
            
            # Execute transformations
            transformed_data, execution_report = self.pipeline_manager.execute_pipeline_parallel(
                data, transformations
            )
            
            return {
                'success': True,
                'transformed_data': transformed_data,
                'execution_report': execution_report
            }
            
        except Exception as e:
            logger.error(f"YAML transformation failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'original_data': data
            }
    
    def export_pipeline(self, transformation_results: Dict[str, Any]) -> str:
        """
        Export successful transformation pipeline as YAML.
        
        Args:
            transformation_results: Results from auto_transform
            
        Returns:
            YAML configuration string
        """
        if not transformation_results.get('success', False):
            raise AutoTransformationError("Cannot export pipeline from failed transformation")
        
        # Extract transformation steps from results
        transformations = []
        
        # Add cleaning transformations
        cleaning_results = transformation_results.get('cleaning_results', {})
        if cleaning_results.get('outliers_handled', 0) > 0:
            transformations.append({
                'type': 'outlier_handling',
                'parameters': {
                    'strategy': cleaning_results.get('outlier_strategy', 'auto'),
                    'contamination': 0.1
                }
            })
        
        if cleaning_results.get('imputation_performed', False):
            transformations.append({
                'type': 'imputation',
                'parameters': {
                    'strategy': 'auto'
                }
            })
        
        # Add preprocessing transformations
        preprocessing_results = transformation_results.get('preprocessing_results', {})
        if preprocessing_results.get('scaling_applied', False):
            transformations.append({
                'type': 'scaling',
                'parameters': {
                    'method': 'auto'
                }
            })
        
        if preprocessing_results.get('encoding_applied', False):
            transformations.append({
                'type': 'encoding',
                'parameters': {
                    'method': 'auto'
                }
            })
        
        # Add ML transformations
        ml_results = transformation_results.get('ml_transformation_results', {})
        if ml_results.get('pca_applied', False):
            transformations.append({
                'type': 'pca',
                'parameters': {
                    'n_components': 'auto',
                    'explained_variance_threshold': 0.95
                }
            })
        
        if ml_results.get('feature_selection_applied', False):
            transformations.append({
                'type': 'feature_selection',
                'parameters': {
                    'method': 'auto',
                    'k': 'auto'
                }
            })
        
        return self.pipeline_manager.export_pipeline_config(transformations)
    
    def get_transformation_history(self) -> List[Dict[str, Any]]:
        """Get history of all transformations performed."""
        return self.transformation_history.copy()
    
    def provide_feedback(self, transformation_id: str, 
                        feedback_score: float,
                        comments: str = "") -> None:
        """
        Provide feedback for a transformation to improve future suggestions.
        
        Args:
            transformation_id: ID of the transformation
            feedback_score: Score from 0-1
            comments: Optional feedback comments
        """
        if self.adaptive_learning:
            # Find transformation metadata
            transformation_metadata = None
            for transform in self.transformation_history:
                if transform.get('transformation_id') == transformation_id:
                    transformation_metadata = transform
                    break
            
            self.adaptive_learning.record_transformation_feedback(
                transformation_id, feedback_score, comments, transformation_metadata
            )
            
            logger.info(f"Recorded feedback for transformation {transformation_id}: {feedback_score}")
    
    # Private methods for internal processing
    def _apply_intelligent_cleaning(self, data: pd.DataFrame, 
                                  config: Dict[str, Any] = None) -> Dict[str, Any]:
        """Apply intelligent data cleaning."""
        config = config or {}
        
        # Outlier detection and handling
        outlier_config = config.get('outlier_detection', {})
        outlier_result = self.data_cleaner.detect_outliers(
            data, 
            method=outlier_config.get('method', 'auto'),
            contamination=outlier_config.get('contamination', 0.1)
        )
        
        cleaned_data, outlier_handling = self.data_cleaner.handle_outliers(
            data,
            outlier_result['outlier_indices'],
            strategy=outlier_config.get('strategy', 'auto')
        )
        
        # Missing value imputation
        imputation_config = config.get('imputation', {})
        imputed_data, imputation_report = self.data_cleaner.smart_imputation(
            cleaned_data,
            strategy=imputation_config.get('strategy', 'auto')
        )
        
        # Duplicate detection and handling
        duplicate_result = self.data_cleaner.detect_duplicates(
            imputed_data,
            fuzzy_threshold=config.get('fuzzy_threshold', 85)
        )
        
        # Data type conversion
        converted_data, conversion_report = self.data_cleaner.automatic_dtype_conversion(imputed_data)
        
        return {
            'cleaned_data': converted_data,
            'outlier_detection': outlier_result,
            'outlier_handling': outlier_handling,
            'imputation_report': imputation_report,
            'duplicate_detection': duplicate_result,
            'dtype_conversion': conversion_report,
            'outliers_handled': len(outlier_result['outlier_indices']),
            'imputation_performed': imputation_report['imputation_success']
        }
    
    def _apply_automated_preprocessing(self, data: pd.DataFrame,
                                     target_column: str = None,
                                     config: Dict[str, Any] = None) -> Dict[str, Any]:
        """Apply automated preprocessing."""
        config = config or {}
        current_data = data.copy()
        
        # Feature scaling
        scaling_config = config.get('scaling', {})
        if scaling_config.get('enabled', True):
            scaling_recommendations = self.preprocessor.recommend_scaling(current_data)
            scaled_data, scaling_report = self.preprocessor.apply_scaling(
                current_data,
                scaling_config.get('manual_config')
            )
            current_data = scaled_data
        else:
            scaling_report = {'transformations_applied': {}}
        
        # Categorical encoding
        encoding_config = config.get('encoding', {})
        if encoding_config.get('enabled', True):
            encoding_recommendations = self.preprocessor.recommend_encoding(current_data, target_column)
            encoded_data, encoding_report = self.preprocessor.apply_encoding(
                current_data,
                encoding_config.get('manual_config'),
                target_column
            )
            current_data = encoded_data
        else:
            encoding_report = {'transformations_applied': {}}
        
        # Feature engineering
        feature_config = config.get('feature_engineering', {})
        if feature_config.get('enabled', True):
            engineered_data, engineering_report = self.preprocessor.automated_feature_engineering(current_data)
            current_data = engineered_data
        else:
            engineering_report = {'features_created': []}
        
        # Text preprocessing
        text_config = config.get('text_processing', {})
        if text_config.get('enabled', True):
            text_processed_data, text_report = self.preprocessor.preprocess_text(current_data)
            current_data = text_processed_data
        else:
            text_report = {'text_columns_processed': []}
        
        return {
            'preprocessed_data': current_data,
            'scaling_report': scaling_report,
            'encoding_report': encoding_report,
            'engineering_report': engineering_report,
            'text_processing_report': text_report,
            'scaling_applied': len(scaling_report['transformations_applied']) > 0,
            'encoding_applied': len(encoding_report['transformations_applied']) > 0,
            'features_engineered': len(engineering_report['features_created'])
        }
    
    def _apply_ml_transformations(self, data: pd.DataFrame,
                                target_column: str = None,
                                goals: List[str] = None,
                                config: Dict[str, Any] = None) -> Dict[str, Any]:
        """Apply ML-driven transformations."""
        config = config or {}
        goals = goals or ['dimensionality_reduction', 'feature_selection']
        current_data = data.copy()
        
        results = {
            'transformed_data': current_data,
            'pca_applied': False,
            'feature_selection_applied': False,
            'binning_applied': False,
            'time_series_features_added': False
        }
        
        # PCA for dimensionality reduction
        pca_config = config.get('pca', {})
        if 'dimensionality_reduction' in goals and pca_config.get('enabled', True):
            if len(current_data.select_dtypes(include=[np.number]).columns) > 5:
                pca_data, pca_report = self.ml_transformer.apply_pca(
                    current_data,
                    n_components=pca_config.get('n_components', 'auto'),
                    explained_variance_threshold=pca_config.get('threshold', 0.95)
                )
                
                if pca_report.get('pca_applied', False):
                    current_data = pca_data
                    results['pca_report'] = pca_report
                    results['pca_applied'] = True
        
        # Feature selection
        feature_selection_config = config.get('feature_selection', {})
        if ('feature_selection' in goals and 
            target_column and 
            feature_selection_config.get('enabled', True)):
            
            selected_data, selection_report = self.ml_transformer.feature_selection(
                current_data,
                target_column,
                method=feature_selection_config.get('method', 'auto'),
                k=feature_selection_config.get('k', 'auto')
            )
            
            if selection_report.get('selection_applied', False):
                current_data = selected_data
                results['feature_selection_report'] = selection_report
                results['feature_selection_applied'] = True
        
        # Automated binning
        binning_config = config.get('binning', {})
        if 'binning' in goals and binning_config.get('enabled', True):
            binned_data, binning_report = self.ml_transformer.automated_binning(current_data)
            
            if binning_report.get('columns_binned'):
                current_data = binned_data
                results['binning_report'] = binning_report
                results['binning_applied'] = True
        
        # Time series features
        time_series_config = config.get('time_series', {})
        timestamp_column = time_series_config.get('timestamp_column')
        if ('time_series' in goals and 
            timestamp_column and 
            time_series_config.get('enabled', True)):
            
            ts_data, ts_report = self.ml_transformer.time_series_features(
                current_data, timestamp_column
            )
            
            if ts_report.get('time_series_features_added', False):
                current_data = ts_data
                results['time_series_report'] = ts_report
                results['time_series_features_added'] = True
        
        results['transformed_data'] = current_data
        return results
    
    def _generate_recommendations(self, initial_quality: QualityMetrics,
                                final_quality: QualityMetrics,
                                cleaning_results: Dict,
                                preprocessing_results: Dict,
                                ml_results: Dict) -> List[str]:
        """Generate actionable recommendations."""
        recommendations = []
        
        # Quality-based recommendations
        if final_quality.overall_score > initial_quality.overall_score:
            recommendations.append(f"Transformation improved data quality by {(final_quality.overall_score - initial_quality.overall_score):.1%}")
        
        if final_quality.completeness < 0.9:
            recommendations.append("Consider additional missing value imputation strategies")
        
        if final_quality.consistency < 0.8:
            recommendations.append("Review data format standardization procedures")
        
        # Transformation-specific recommendations
        if cleaning_results.get('outliers_handled', 0) > 0:
            recommendations.append(f"Handled {cleaning_results['outliers_handled']} outliers - monitor for data quality issues")
        
        if preprocessing_results.get('features_engineered', 0) > 0:
            recommendations.append(f"Created {preprocessing_results['features_engineered']} new features - validate their predictive value")
        
        if ml_results.get('pca_applied', False):
            variance_explained = ml_results.get('pca_report', {}).get('total_explained_variance', 0)
            recommendations.append(f"PCA retained {variance_explained:.1%} of variance - consider if dimensionality reduction is appropriate")
        
        # Performance recommendations
        recommendations.append("Consider caching transformation pipeline for repeated use")
        recommendations.append("Monitor transformation performance in production environment")
        
        return recommendations
    
    def _generate_transformation_summary(self, cleaning_results: Dict,
                                       preprocessing_results: Dict,
                                       ml_results: Dict) -> Dict[str, Any]:
        """Generate a summary of all transformations applied."""
        return {
            'data_cleaning': {
                'outliers_handled': cleaning_results.get('outliers_handled', 0),
                'missing_values_imputed': cleaning_results.get('imputation_performed', False),
                'data_types_converted': len(cleaning_results.get('dtype_conversion', {}).get('conversions_made', {}))
            },
            'preprocessing': {
                'scaling_applied': preprocessing_results.get('scaling_applied', False),
                'encoding_applied': preprocessing_results.get('encoding_applied', False),
                'features_engineered': preprocessing_results.get('features_engineered', 0)
            },
            'ml_transformations': {
                'pca_applied': ml_results.get('pca_applied', False),
                'feature_selection_applied': ml_results.get('feature_selection_applied', False),
                'binning_applied': ml_results.get('binning_applied', False),
                'time_series_features_added': ml_results.get('time_series_features_added', False)
            }
        }
    
    def _generate_rule_based_suggestions(self, data: pd.DataFrame, 
                                       characteristics: Dict[str, int]) -> List[Dict[str, Any]]:
        """Generate rule-based transformation suggestions."""
        suggestions = []
        
        # Missing values suggestion
        if characteristics['missing_values'] > 0:
            suggestions.append({
                'transformation_type': 'imputation',
                'confidence_score': 0.9,
                'parameters': {'strategy': 'auto'},
                'reason': f"Dataset has {characteristics['missing_values']} missing values"
            })
        
        # Scaling suggestion for numeric data
        if characteristics['numeric_columns'] > 1:
            suggestions.append({
                'transformation_type': 'scaling',
                'confidence_score': 0.8,
                'parameters': {'method': 'auto'},
                'reason': f"Dataset has {characteristics['numeric_columns']} numeric columns that may benefit from scaling"
            })
        
        # Encoding suggestion for categorical data
        if characteristics['categorical_columns'] > 0:
            suggestions.append({
                'transformation_type': 'encoding',
                'confidence_score': 0.85,
                'parameters': {'method': 'auto'},
                'reason': f"Dataset has {characteristics['categorical_columns']} categorical columns"
            })
        
        # Dimensionality reduction for high-dimensional data
        if characteristics['column_count'] > 20:
            suggestions.append({
                'transformation_type': 'pca',
                'confidence_score': 0.75,
                'parameters': {'n_components': 'auto'},
                'reason': f"High-dimensional dataset ({characteristics['column_count']} columns) may benefit from dimensionality reduction"
            })
        
        # Duplicate removal suggestion
        if characteristics['duplicate_rows'] > 0:
            suggestions.append({
                'transformation_type': 'duplicate_removal',
                'confidence_score': 0.95,
                'parameters': {},
                'reason': f"Dataset has {characteristics['duplicate_rows']} duplicate rows"
            })
        
        return suggestions