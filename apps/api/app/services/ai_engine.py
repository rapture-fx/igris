"""

# Conditional ML imports

# Conditional ML imports
try:
    import torch
    import transformers
    import sklearn
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    # Use ML service client for remote processing
    from app.services.ml_service_client import ml_service


try:
    import torch
    import transformers
    import sklearn
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    # Use ML service client for remote processing
    from app.services.ml_service_client import ml_service


Core AI Data Processing Engine for Schlep-engine
Handles data quality analysis, anomaly detection, and auto-labeling
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder, RobustScaler
from sklearn.cluster import DBSCAN, KMeans
from sklearn.decomposition import PCA
from sklearn.feature_selection import mutual_info_regression, mutual_info_classif
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
from scipy import stats
from scipy.stats import normaltest, jarque_bera, kstest, chi2_contingency
from typing import Dict, List, Any, Optional, Tuple, Union
import logging
import json
import re
import warnings
from datetime import datetime, timedelta
from collections import Counter
import hashlib

warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)

class DataQualityAnalyzer:
    """Advanced data quality analysis using statistical and ML methods"""
    
    def __init__(self):
        self.scaler = StandardScaler()
        self.isolation_forest = IsolationForest(contamination=0.1, random_state=42)
    
    def analyze_schema(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Intelligent schema inference with advanced pattern recognition and confidence scoring"""
        schema_info = {}
        
        for column in df.columns:
            col_data = df[column]
            non_null_data = col_data.dropna()
            
            # Basic type info - Convert numpy types to native Python types
            dtype_info = {
                'detected_type': str(col_data.dtype),
                'non_null_count': int(col_data.count()),
                'null_count': int(col_data.isnull().sum()),
                'null_percentage': float((col_data.isnull().sum() / len(col_data)) * 100),
                'unique_count': int(col_data.nunique()),
                'unique_percentage': float((col_data.nunique() / len(col_data)) * 100)
            }
            
            # Advanced type inference with confidence scoring
            if col_data.dtype == 'object' and len(non_null_data) > 0:
                type_scores = self._calculate_type_scores(non_null_data)
                best_type = max(type_scores.items(), key=lambda x: x[1])
                
                dtype_info['inferred_type'] = best_type[0]
                dtype_info['confidence_score'] = float(best_type[1])
                dtype_info['type_scores'] = {k: float(v) for k, v in type_scores.items()}
                
                # Type-specific analysis
                if best_type[0] == 'datetime':
                    dtype_info['datetime_formats'] = self._detect_datetime_formats(non_null_data)
                elif best_type[0] == 'categorical':
                    categories = col_data.value_counts().head(20)
                    dtype_info['categories'] = {str(k): int(v) for k, v in categories.to_dict().items()}
                    dtype_info['cardinality'] = int(col_data.nunique())
                elif best_type[0] == 'numeric_string':
                    dtype_info['numeric_patterns'] = self._analyze_numeric_patterns(non_null_data)
                elif best_type[0] == 'text':
                    dtype_info.update(self._analyze_text_patterns(non_null_data))
            
            elif np.issubdtype(col_data.dtype, np.number):
                dtype_info['inferred_type'] = 'numeric'
                if len(non_null_data) > 0:
                    dtype_info.update(self._analyze_numeric_column(non_null_data))
                    
                    # Advanced numeric analysis
                    dtype_info['distribution_analysis'] = self._analyze_distribution(non_null_data)
                    
                    # Check if it could be an ID field
                    if col_data.nunique() == len(col_data.dropna()):
                        dtype_info['possible_id'] = True
                        dtype_info['id_confidence'] = 0.9 if col_data.dtype in ['int64', 'int32'] else 0.7
            
            # Pattern extraction
            if col_data.dtype == 'object' and len(non_null_data) > 0:
                dtype_info['patterns'] = self._extract_patterns(non_null_data)
            
            schema_info[column] = dtype_info
        
        return schema_info
    
    def detect_anomalies(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Advanced multi-algorithm anomaly detection with explanations"""
        anomalies = {
            'statistical_outliers': {},
            'isolation_forest_outliers': {},
            'clustering_outliers': {},
            'pattern_anomalies': {},
            'distribution_anomalies': {},
            'correlation_anomalies': {}
        }
        
        # Prepare numeric data for ML algorithms
        numeric_columns = df.select_dtypes(include=[np.number]).columns
        if len(numeric_columns) > 0:
            numeric_data = df[numeric_columns].fillna(df[numeric_columns].median())
            
            # Multiple statistical outlier detection methods
            for col in numeric_columns:
                col_data = numeric_data[col]
                
                # Z-score method
                z_scores = np.abs(stats.zscore(col_data))
                z_outliers = np.where(z_scores > 3)[0]
                
                # IQR method
                Q1 = col_data.quantile(0.25)
                Q3 = col_data.quantile(0.75)
                IQR = Q3 - Q1
                lower_bound = Q1 - 1.5 * IQR
                upper_bound = Q3 + 1.5 * IQR
                iqr_outliers = col_data[(col_data < lower_bound) | (col_data > upper_bound)].index.values
                
                # Modified Z-score (using median)
                median = np.median(col_data)
                mad = np.median(np.abs(col_data - median))
                modified_z_scores = 0.6745 * (col_data - median) / mad if mad != 0 else np.zeros_like(col_data)
                modified_z_outliers = np.where(np.abs(modified_z_scores) > 3.5)[0]
                
                anomalies['statistical_outliers'][col] = {
                    'z_score': {
                        'count': int(len(z_outliers)),
                        'percentage': float((len(z_outliers) / len(df)) * 100),
                        'indices': z_outliers.tolist()[:50],
                        'threshold': 3.0
                    },
                    'iqr': {
                        'count': int(len(iqr_outliers)),
                        'percentage': float((len(iqr_outliers) / len(df)) * 100),
                        'indices': iqr_outliers.tolist()[:50],
                        'bounds': {'lower': float(lower_bound), 'upper': float(upper_bound)}
                    },
                    'modified_z_score': {
                        'count': int(len(modified_z_outliers)),
                        'percentage': float((len(modified_z_outliers) / len(df)) * 100),
                        'indices': modified_z_outliers.tolist()[:50],
                        'threshold': 3.5
                    }
                }
            
            # Advanced multivariate anomaly detection
            if len(numeric_columns) > 1:
                # Use robust scaler to handle outliers better
                robust_scaler = RobustScaler()
                scaled_data = robust_scaler.fit_transform(numeric_data)
                
                # Isolation Forest with different contamination rates
                contamination_rates = [0.05, 0.1, 0.15]
                isolation_results = {}
                
                for rate in contamination_rates:
                    iso_forest = IsolationForest(contamination=rate, random_state=42, n_estimators=200)
                    outlier_predictions = iso_forest.fit_predict(scaled_data)
                    outlier_indices = np.where(outlier_predictions == -1)[0]
                    anomaly_scores = iso_forest.decision_function(scaled_data)
                    
                    isolation_results[f'contamination_{rate}'] = {
                        'count': int(len(outlier_indices)),
                        'percentage': float((len(outlier_indices) / len(df)) * 100),
                        'indices': outlier_indices.tolist()[:50],
                        'avg_anomaly_score': float(np.mean(anomaly_scores[outlier_indices])) if len(outlier_indices) > 0 else 0.0
                    }
                
                anomalies['isolation_forest_outliers'] = isolation_results
                
                # DBSCAN with parameter tuning
                try:
                    # Try multiple parameter combinations
                    eps_values = [0.3, 0.5, 0.8]
                    min_samples_values = [3, 5, 10]
                    
                    best_dbscan_result = None
                    best_score = -1
                    
                    for eps in eps_values:
                        for min_samples in min_samples_values:
                            dbscan = DBSCAN(eps=eps, min_samples=min_samples)
                            cluster_labels = dbscan.fit_predict(scaled_data)
                            
                            n_clusters = len(set(cluster_labels)) - (1 if -1 in cluster_labels else 0)
                            outlier_count = np.sum(cluster_labels == -1)
                            
                            if n_clusters > 0 and outlier_count < len(df) * 0.5:  # Reasonable clustering
                                score = n_clusters - (outlier_count / len(df))  # Simple scoring
                                if score > best_score:
                                    best_score = score
                                    best_dbscan_result = {
                                        'parameters': {'eps': eps, 'min_samples': min_samples},
                                        'outlier_indices': np.where(cluster_labels == -1)[0],
                                        'n_clusters': n_clusters,
                                        'cluster_labels': cluster_labels
                                    }
                    
                    if best_dbscan_result:
                        outlier_indices = best_dbscan_result['outlier_indices']
                        anomalies['clustering_outliers'] = {
                            'count': int(len(outlier_indices)),
                            'percentage': float((len(outlier_indices) / len(df)) * 100),
                            'indices': outlier_indices.tolist()[:50],
                            'n_clusters': best_dbscan_result['n_clusters'],
                            'parameters': best_dbscan_result['parameters']
                        }
                except Exception as e:
                    logger.warning(f"DBSCAN clustering failed: {e}")
                
                # Correlation-based anomalies
                try:
                    correlation_matrix = numeric_data.corr()
                    # Find highly correlated pairs that might indicate data quality issues
                    high_correlations = []
                    for i in range(len(correlation_matrix.columns)):
                        for j in range(i+1, len(correlation_matrix.columns)):
                            corr_val = correlation_matrix.iloc[i, j]
                            if abs(corr_val) > 0.95:  # Very high correlation
                                high_correlations.append({
                                    'column1': correlation_matrix.columns[i],
                                    'column2': correlation_matrix.columns[j],
                                    'correlation': float(corr_val)
                                })
                    
                    anomalies['correlation_anomalies'] = {
                        'high_correlations': high_correlations,
                        'potential_duplicates': len([c for c in high_correlations if abs(c['correlation']) > 0.99])
                    }
                except Exception as e:
                    logger.warning(f"Correlation analysis failed: {e}")
        
        # Enhanced pattern anomalies for categorical data
        categorical_columns = df.select_dtypes(include=['object']).columns
        for col in categorical_columns:
            col_data = df[col].dropna()
            if len(col_data) == 0:
                continue
                
            value_counts = col_data.value_counts()
            
            # Statistical analysis of categorical distribution
            total_values = len(col_data)
            expected_freq = total_values / len(value_counts) if len(value_counts) > 0 else 0
            
            # Chi-square test for uniform distribution
            try:
                if len(value_counts) > 1:
                    chi2_stat, chi2_p = stats.chisquare(value_counts.values)
                else:
                    chi2_stat, chi2_p = 0, 1
            except:
                chi2_stat, chi2_p = 0, 1
            
            # Identify different types of anomalous values
            singleton_values = value_counts[value_counts == 1]
            rare_values = value_counts[value_counts <= max(1, total_values * 0.001)]  # Less than 0.1% frequency
            
            anomalies['pattern_anomalies'][col] = {
                'singleton_values': {
                    'count': int(len(singleton_values)),
                    'values': singleton_values.index.tolist()[:20]
                },
                'rare_values': {
                    'count': int(len(rare_values)),
                    'values': rare_values.index.tolist()[:20]
                },
                'distribution_uniformity': {
                    'chi2_statistic': float(chi2_stat),
                    'chi2_p_value': float(chi2_p),
                    'is_uniform': bool(chi2_p > 0.05)
                },
                'mode_analysis': {
                    'mode': str(value_counts.index[0]) if len(value_counts) > 0 else None,
                    'mode_frequency': int(value_counts.iloc[0]) if len(value_counts) > 0 else 0,
                    'mode_percentage': float((value_counts.iloc[0] / total_values) * 100) if len(value_counts) > 0 else 0
                }
            }
        
        # Distribution anomalies for numeric columns
        for col in numeric_columns:
            col_data = numeric_data[col]
            if len(col_data) == 0:
                continue
                
            # Test for normality
            try:
                shapiro_stat, shapiro_p = stats.shapiro(col_data.sample(min(5000, len(col_data)))) if len(col_data) > 3 else (0, 1)
                jb_stat, jb_p = jarque_bera(col_data)
                
                anomalies['distribution_anomalies'][col] = {
                    'normality_tests': {
                        'shapiro_wilk': {'statistic': float(shapiro_stat), 'p_value': float(shapiro_p)},
                        'jarque_bera': {'statistic': float(jb_stat), 'p_value': float(jb_p)}
                    },
                    'is_normal': bool(shapiro_p > 0.05 and jb_p > 0.05),
                    'skewness': float(stats.skew(col_data)),
                    'kurtosis': float(stats.kurtosis(col_data))
                }
            except Exception as e:
                logger.warning(f"Distribution analysis failed for {col}: {e}")
        
        return anomalies
    
    def calculate_quality_score(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Calculate comprehensive data quality score"""
        
        total_cells = df.shape[0] * df.shape[1]
        null_cells = df.isnull().sum().sum()
        completeness_score = ((total_cells - null_cells) / total_cells) * 100
        
        # Uniqueness score (for potential ID columns)
        uniqueness_scores = []
        for col in df.columns:
            if df[col].dtype == 'object' or np.issubdtype(df[col].dtype, np.number):
                uniqueness = (df[col].nunique() / len(df)) * 100
                uniqueness_scores.append(min(uniqueness, 100))
        
        avg_uniqueness = np.mean(uniqueness_scores) if uniqueness_scores else 0
        
        # Consistency score (based on data types)
        consistency_score = self._calculate_consistency_score(df)
        
        # Anomaly score (inverse of anomaly percentage)
        anomalies = self.detect_anomalies(df)
        total_anomalies = 0
        anomaly_counts = []
        
        for outlier_type, outlier_data in anomalies.items():
            if isinstance(outlier_data, dict):
                if 'count' in outlier_data:
                    anomaly_counts.append(outlier_data['count'])
                else:
                    for col_data in outlier_data.values():
                        if isinstance(col_data, dict) and 'count' in col_data:
                            anomaly_counts.append(col_data['count'])
        
        total_anomalies = sum(anomaly_counts)
        anomaly_percentage = (total_anomalies / len(df)) * 100 if len(df) > 0 else 0
        validity_score = max(0, 100 - anomaly_percentage)
        
        # Overall quality score (weighted average)
        weights = {
            'completeness': 0.4,
            'uniqueness': 0.2,
            'consistency': 0.2,
            'validity': 0.2
        }
        
        overall_score = (
            completeness_score * weights['completeness'] +
            avg_uniqueness * weights['uniqueness'] +
            consistency_score * weights['consistency'] +
            validity_score * weights['validity']
        )
        
        return {
            'overall_score': round(overall_score, 2),
            'completeness_score': round(completeness_score, 2),
            'uniqueness_score': round(avg_uniqueness, 2),
            'consistency_score': round(consistency_score, 2),
            'validity_score': round(validity_score, 2),
            'total_rows': len(df),
            'total_columns': len(df.columns),
            'null_percentage': round((null_cells / total_cells) * 100, 2),
            'anomaly_percentage': round(anomaly_percentage, 2)
        }
    
    def suggest_improvements(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Generate AI-powered suggestions for data improvement"""
        suggestions = []
        
        # Analyze each column for improvement opportunities
        for column in df.columns:
            col_data = df[column]
            
            # Missing value suggestions
            null_percentage = (col_data.isnull().sum() / len(col_data)) * 100
            if null_percentage > 5:
                if null_percentage > 50:
                    suggestion = {
                        'type': 'high_missing_values',
                        'column': column,
                        'severity': 'high',
                        'message': f"Column '{column}' has {null_percentage:.1f}% missing values. Consider dropping this column or finding alternative data sources.",
                        'action': 'drop_column_or_impute'
                    }
                else:
                    suggestion = {
                        'type': 'missing_values',
                        'column': column,
                        'severity': 'medium',
                        'message': f"Column '{column}' has {null_percentage:.1f}% missing values. Recommend imputation strategy.",
                        'action': 'impute'
                    }
                    
                    # Suggest appropriate imputation method
                    if np.issubdtype(col_data.dtype, np.number):
                        suggestion['recommended_method'] = 'median_imputation'
                    else:
                        suggestion['recommended_method'] = 'mode_imputation'
                
                suggestions.append(suggestion)
            
            # Data type optimization suggestions
            if col_data.dtype == 'object':
                # Check if it's actually numeric
                if self._is_numeric_string(col_data):
                    suggestions.append({
                        'type': 'type_conversion',
                        'column': column,
                        'severity': 'low',
                        'message': f"Column '{column}' contains numeric values stored as text. Convert to numeric type for better performance.",
                        'action': 'convert_to_numeric',
                        'recommended_type': 'float64'
                    })
                
                # Check for categorical optimization
                elif col_data.nunique() / len(col_data) < 0.1:  # Less than 10% unique values
                    suggestions.append({
                        'type': 'categorical_optimization',
                        'column': column,
                        'severity': 'low',
                        'message': f"Column '{column}' has low cardinality ({col_data.nunique()} unique values). Consider converting to categorical type.",
                        'action': 'convert_to_categorical',
                        'recommended_type': 'category'
                    })
            
            # Outlier handling suggestions
            if np.issubdtype(col_data.dtype, np.number):
                z_scores = np.abs(stats.zscore(col_data.dropna()))
                outliers = len(z_scores[z_scores > 3])
                if outliers > 0:
                    outlier_percentage = (outliers / len(col_data)) * 100
                    if outlier_percentage > 1:
                        suggestions.append({
                            'type': 'outlier_detection',
                            'column': column,
                            'severity': 'medium',
                            'message': f"Column '{column}' has {outliers} outliers ({outlier_percentage:.1f}%). Review and consider treatment.",
                            'action': 'handle_outliers',
                            'outlier_count': outliers
                        })
        
        # Duplicate row suggestions
        duplicate_count = df.duplicated().sum()
        if duplicate_count > 0:
            suggestions.append({
                'type': 'duplicate_rows',
                'severity': 'medium',
                'message': f"Dataset contains {duplicate_count} duplicate rows ({(duplicate_count/len(df)*100):.1f}%). Consider removing duplicates.",
                'action': 'remove_duplicates',
                'duplicate_count': duplicate_count
            })
        
        return suggestions
    
    def _is_datetime(self, series: pd.Series) -> bool:
        """Check if a series contains datetime strings"""
        if series.dtype != 'object':
            return False
        
        sample = series.dropna().head(100)
        if len(sample) == 0:
            return False
        
        try:
            pd.to_datetime(sample, errors='raise')
            return True
        except:
            return False
    
    def _is_categorical(self, series: pd.Series) -> bool:
        """Check if a series should be treated as categorical"""
        if series.dtype != 'object':
            return False
        
        # If less than 10% unique values, likely categorical
        unique_ratio = series.nunique() / len(series)
        return unique_ratio < 0.1 and series.nunique() < 50
    
    def _is_numeric_string(self, series: pd.Series) -> bool:
        """Check if a string series contains numeric values"""
        if series.dtype != 'object':
            return False
        
        sample = series.dropna().head(100)
        if len(sample) == 0:
            return False
        
        try:
            pd.to_numeric(sample, errors='raise')
            return True
        except:
            return False
    
    def _calculate_consistency_score(self, df: pd.DataFrame) -> float:
        """Calculate data consistency score based on type uniformity"""
        consistency_scores = []
        
        for column in df.columns:
            col_data = df[column].dropna()
            if len(col_data) == 0:
                consistency_scores.append(0)
                continue
            
            if col_data.dtype == 'object':
                # For text columns, check format consistency
                if len(col_data) > 1:
                    # Simple heuristic: check length variance
                    lengths = col_data.str.len()
                    length_cv = lengths.std() / lengths.mean() if lengths.mean() > 0 else 1
                    # Lower CV = more consistent
                    consistency_score = max(0, 100 - (length_cv * 50))
                    consistency_scores.append(consistency_score)
                else:
                    consistency_scores.append(100)
            else:
                # For numeric columns, assume high consistency
                consistency_scores.append(90)
        
        return np.mean(consistency_scores) if consistency_scores else 0
    
    def _calculate_type_scores(self, series: pd.Series) -> Dict[str, float]:
        """Calculate confidence scores for different data types"""
        if len(series) == 0:
            return {'text': 0.0}
        
        scores = {
            'datetime': 0.0,
            'numeric_string': 0.0, 
            'categorical': 0.0,
            'text': 0.0
        }
        
        sample_size = min(1000, len(series))
        sample = series.sample(sample_size) if len(series) > sample_size else series
        
        # Test datetime
        try:
            pd.to_datetime(sample, errors='raise')
            scores['datetime'] = 1.0
        except:
            try:
                # Try with common formats
                datetime_success = 0
                for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%Y-%m-%d %H:%M:%S']:
                    try:
                        pd.to_datetime(sample, format=fmt, errors='raise')
                        datetime_success += 1
                        break
                    except:
                        continue
                scores['datetime'] = datetime_success / 1.0
            except:
                pass
        
        # Test numeric string
        try:
            pd.to_numeric(sample, errors='raise')
            scores['numeric_string'] = 1.0
        except:
            # Count how many can be converted
            numeric_count = 0
            for val in sample:
                try:
                    float(str(val).replace(',', '').replace('$', '').replace('%', ''))
                    numeric_count += 1
                except:
                    pass
            scores['numeric_string'] = numeric_count / len(sample)
        
        # Test categorical (low cardinality)
        unique_ratio = series.nunique() / len(series)
        if unique_ratio < 0.1 and series.nunique() < 100:
            scores['categorical'] = 1.0 - unique_ratio
        
        # Default to text
        scores['text'] = max(0.1, 1.0 - max(scores['datetime'], scores['numeric_string'], scores['categorical']))
        
        return scores
    
    def _detect_datetime_formats(self, series: pd.Series) -> List[str]:
        """Detect datetime formats in the data"""
        formats = []
        common_formats = [
            '%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%Y-%m-%d %H:%M:%S',
            '%d-%m-%Y', '%Y/%m/%d', '%d.%m.%Y', '%m-%d-%Y'
        ]
        
        sample = series.head(100)
        for fmt in common_formats:
            try:
                pd.to_datetime(sample, format=fmt, errors='raise')
                formats.append(fmt)
                break
            except:
                continue
                
        return formats
    
    def _analyze_numeric_patterns(self, series: pd.Series) -> Dict[str, Any]:
        """Analyze patterns in numeric strings"""
        patterns = {
            'decimal_places': [],
            'has_separators': False,
            'has_currency': False,
            'has_percentage': False
        }
        
        sample = series.astype(str).head(100)
        for val in sample:
            if ',' in val:
                patterns['has_separators'] = True
            if '$' in val or '€' in val or '£' in val:
                patterns['has_currency'] = True  
            if '%' in val:
                patterns['has_percentage'] = True
            
            # Count decimal places
            if '.' in val:
                try:
                    decimal_part = val.split('.')[-1]
                    if decimal_part.replace('%', '').replace(',', '').isdigit():
                        patterns['decimal_places'].append(len(decimal_part.replace('%', '').replace(',', '')))
                except:
                    pass
        
        if patterns['decimal_places']:
            patterns['avg_decimal_places'] = np.mean(patterns['decimal_places'])
            patterns['consistent_decimals'] = len(set(patterns['decimal_places'])) <= 2
        
        return patterns
    
    def _analyze_text_patterns(self, series: pd.Series) -> Dict[str, Any]:
        """Analyze patterns in text data"""
        analysis = {
            'avg_length': float(series.str.len().mean()),
            'max_length': int(series.str.len().max()),
            'min_length': int(series.str.len().min()),
            'length_std': float(series.str.len().std()),
            'common_patterns': []
        }
        
        # Extract common regex patterns
        sample = series.head(500)
        
        # Email pattern
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        if sample.str.contains(email_pattern, regex=True).any():
            analysis['common_patterns'].append('email')
        
        # Phone pattern  
        phone_pattern = r'(\+\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}'
        if sample.str.contains(phone_pattern, regex=True).any():
            analysis['common_patterns'].append('phone')
        
        # URL pattern
        url_pattern = r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+'
        if sample.str.contains(url_pattern, regex=True).any():
            analysis['common_patterns'].append('url')
        
        return analysis
    
    def _analyze_numeric_column(self, series: pd.Series) -> Dict[str, Any]:
        """Detailed analysis of numeric columns"""
        return {
            'min': float(series.min()),
            'max': float(series.max()), 
            'mean': float(series.mean()),
            'median': float(series.median()),
            'std': float(series.std()),
            'skewness': float(stats.skew(series)),
            'kurtosis': float(stats.kurtosis(series)),
            'percentiles': {
                '25': float(series.quantile(0.25)),
                '75': float(series.quantile(0.75)),
                '95': float(series.quantile(0.95)),
                '99': float(series.quantile(0.99))
            }
        }
    
    def _analyze_distribution(self, series: pd.Series) -> Dict[str, Any]:
        """Analyze the statistical distribution of numeric data"""
        try:
            # Sample for large datasets
            sample_size = min(5000, len(series))
            sample = series.sample(sample_size) if len(series) > sample_size else series
            
            # Test for normality
            shapiro_stat, shapiro_p = stats.shapiro(sample) if len(sample) > 3 else (0, 1)
            
            # Test for exponential distribution
            try:
                ks_stat, ks_p = stats.kstest(sample, 'expon')
            except:
                ks_stat, ks_p = 0, 1
            
            return {
                'normality_test': {
                    'statistic': float(shapiro_stat),
                    'p_value': float(shapiro_p),
                    'is_normal': bool(shapiro_p > 0.05)
                },
                'exponential_test': {
                    'statistic': float(ks_stat),
                    'p_value': float(ks_p),
                    'is_exponential': bool(ks_p > 0.05)
                },
                'distribution_type': self._identify_distribution_type(sample)
            }
        except Exception as e:
            logger.warning(f"Distribution analysis failed: {e}")
            return {'error': str(e)}
    
    def _identify_distribution_type(self, series: pd.Series) -> str:
        """Identify the most likely distribution type"""
        skewness = stats.skew(series)
        kurtosis = stats.kurtosis(series)
        
        if abs(skewness) < 0.5 and abs(kurtosis) < 0.5:
            return 'normal'
        elif skewness > 1:
            return 'right_skewed'
        elif skewness < -1:
            return 'left_skewed'
        elif kurtosis > 3:
            return 'heavy_tailed'
        elif kurtosis < -1:
            return 'light_tailed'
        else:
            return 'unknown'
    
    def _extract_patterns(self, series: pd.Series) -> Dict[str, Any]:
        """Extract regex patterns from text data"""
        patterns = {
            'regex_patterns': [],
            'length_patterns': {},
            'character_patterns': {}
        }
        
        sample = series.astype(str).head(200)
        
        # Analyze length patterns
        lengths = sample.str.len()
        patterns['length_patterns'] = {
            'most_common_length': int(lengths.mode()[0]) if not lengths.mode().empty else 0,
            'length_variance': float(lengths.var()),
            'fixed_length': bool(lengths.nunique() == 1)
        }
        
        # Analyze character patterns
        char_types = {
            'digits': sample.str.contains(r'\d').sum(),
            'letters': sample.str.contains(r'[a-zA-Z]').sum(),
            'special_chars': sample.str.contains(r'[^a-zA-Z0-9\s]').sum(),
            'whitespace': sample.str.contains(r'\s').sum()
        }
        
        total_samples = len(sample)
        patterns['character_patterns'] = {
            k: {'count': int(v), 'percentage': float((v / total_samples) * 100)}
            for k, v in char_types.items()
        }
        
        return patterns


class DataCleaner:
    """Intelligent data cleaning with ML-guided recommendations"""
    
    def __init__(self):
        self.label_encoders = {}
    
    def remove_duplicates(self, df: pd.DataFrame, strategy: str = 'first') -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """Remove duplicate rows with reporting"""
        initial_count = len(df)
        cleaned_df = df.drop_duplicates(keep=strategy)
        duplicates_removed = initial_count - len(cleaned_df)
        
        result = {
            'cleaned_data': cleaned_df,
            'report': {
                'initial_rows': initial_count,
                'final_rows': len(cleaned_df),
                'duplicates_removed': duplicates_removed,
                'duplicate_percentage': (duplicates_removed / initial_count) * 100
            }
        }
        
        return cleaned_df, result['report']
    
    def handle_missing_values(self, df: pd.DataFrame, strategy: Dict[str, str] = None) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """Intelligent missing value imputation"""
        if strategy is None:
            strategy = self._recommend_imputation_strategy(df)
        
        cleaned_df = df.copy()
        report = {'columns_processed': {}, 'strategy_used': strategy}
        
        for column, method in strategy.items():
            if column not in cleaned_df.columns:
                continue
                
            initial_nulls = cleaned_df[column].isnull().sum()
            
            if method == 'median':
                cleaned_df[column].fillna(cleaned_df[column].median(), inplace=True)
            elif method == 'mean':
                cleaned_df[column].fillna(cleaned_df[column].mean(), inplace=True)
            elif method == 'mode':
                mode_value = cleaned_df[column].mode()
                if len(mode_value) > 0:
                    cleaned_df[column].fillna(mode_value[0], inplace=True)
            elif method == 'forward_fill':
                cleaned_df[column].fillna(method='ffill', inplace=True)
            elif method == 'interpolate':
                cleaned_df[column].interpolate(inplace=True)
            elif method == 'drop':
                cleaned_df.dropna(subset=[column], inplace=True)
            
            final_nulls = cleaned_df[column].isnull().sum()
            
            report['columns_processed'][column] = {
                'initial_nulls': int(initial_nulls),
                'final_nulls': int(final_nulls),
                'method_used': method,
                'nulls_filled': int(initial_nulls - final_nulls)
            }
        
        return cleaned_df, report
    
    def normalize_formats(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """Normalize data formats and types"""
        cleaned_df = df.copy()
        report = {'conversions': {}, 'errors': {}}
        
        for column in cleaned_df.columns:
            col_data = cleaned_df[column]
            
            # Try to convert string numbers to numeric
            if col_data.dtype == 'object':
                # Check if it's numeric
                try:
                    # Remove common non-numeric characters
                    cleaned_values = col_data.astype(str).str.replace(',', '').str.replace('$', '').str.replace('%', '')
                    numeric_values = pd.to_numeric(cleaned_values, errors='coerce')
                    
                    # If most values convert successfully, use the conversion
                    success_rate = (numeric_values.notna().sum() / len(col_data))
                    if success_rate > 0.8:  # 80% success rate threshold
                        cleaned_df[column] = numeric_values
                        report['conversions'][column] = {
                            'from_type': 'object',
                            'to_type': 'numeric',
                            'success_rate': success_rate
                        }
                except Exception as e:
                    report['errors'][column] = str(e)
                
                # Try to convert to datetime
                try:
                    datetime_values = pd.to_datetime(col_data, errors='coerce')
                    success_rate = (datetime_values.notna().sum() / len(col_data))
                    if success_rate > 0.8 and column not in report['conversions']:
                        cleaned_df[column] = datetime_values
                        report['conversions'][column] = {
                            'from_type': 'object',
                            'to_type': 'datetime',
                            'success_rate': success_rate
                        }
                except Exception as e:
                    if column not in report['errors']:
                        report['errors'][column] = str(e)
        
        return cleaned_df, report
    
    def validate_types(self, df: pd.DataFrame, expected_schema: Dict[str, str] = None) -> Dict[str, Any]:
        """Validate data types against expected schema"""
        validation_report = {
            'schema_matches': {},
            'type_mismatches': {},
            'recommendations': []
        }
        
        if expected_schema is None:
            # Auto-detect expected schema
            analyzer = DataQualityAnalyzer()
            schema_info = analyzer.analyze_schema(df)
            expected_schema = {col: info.get('inferred_type', str(df[col].dtype)) 
                             for col, info in schema_info.items()}
        
        for column, expected_type in expected_schema.items():
            if column not in df.columns:
                validation_report['type_mismatches'][column] = {
                    'error': 'column_missing',
                    'expected': expected_type
                }
                continue
            
            actual_type = str(df[column].dtype)
            current_type_category = self._categorize_dtype(df[column].dtype)
            expected_type_category = self._categorize_expected_type(expected_type)
            
            if current_type_category == expected_type_category:
                validation_report['schema_matches'][column] = {
                    'expected': expected_type,
                    'actual': actual_type,
                    'status': 'match'
                }
            else:
                validation_report['type_mismatches'][column] = {
                    'expected': expected_type,
                    'actual': actual_type,
                    'status': 'mismatch'
                }
                
                # Add recommendation
                validation_report['recommendations'].append({
                    'column': column,
                    'suggestion': f"Convert column '{column}' from {actual_type} to {expected_type}",
                    'priority': 'medium'
                })
        
        return validation_report
    
    def _recommend_imputation_strategy(self, df: pd.DataFrame) -> Dict[str, str]:
        """Recommend imputation strategies for each column"""
        strategies = {}
        
        for column in df.columns:
            null_percentage = (df[column].isnull().sum() / len(df)) * 100
            
            if null_percentage == 0:
                continue
            elif null_percentage > 50:
                strategies[column] = 'drop'
            elif np.issubdtype(df[column].dtype, np.number):
                # For numeric data
                if df[column].skew() > 1:  # Highly skewed
                    strategies[column] = 'median'
                else:
                    strategies[column] = 'mean'
            elif df[column].dtype == 'object':
                # For categorical/text data
                strategies[column] = 'mode'
            else:
                # Default strategy
                strategies[column] = 'forward_fill'
        
        return strategies
    
    def _categorize_dtype(self, dtype) -> str:
        """Categorize pandas dtype into broad categories"""
        if np.issubdtype(dtype, np.number):
            return 'numeric'
        elif np.issubdtype(dtype, np.datetime64):
            return 'datetime'
        elif dtype == 'bool':
            return 'boolean'
        else:
            return 'text'
    
    def _categorize_expected_type(self, expected_type: str) -> str:
        """Categorize expected type string into broad categories"""
        expected_type = expected_type.lower()
        if any(t in expected_type for t in ['int', 'float', 'numeric', 'number']):
            return 'numeric'
        elif any(t in expected_type for t in ['date', 'time', 'timestamp']):
            return 'datetime'
        elif any(t in expected_type for t in ['bool', 'boolean']):
            return 'boolean'
        else:
            return 'text'


class AutoLabeler:
    """ML-powered automatic data labeling"""
    
    def __init__(self):
        self.models = {}
        self.confidence_threshold = 0.7
    
    def train_labeling_model(self, labeled_samples: pd.DataFrame, target_column: str, feature_columns: List[str]) -> Dict[str, Any]:
        """Train a model for auto-labeling based on existing labeled samples"""
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import accuracy_score, classification_report
        
        try:
            # Prepare data
            X = labeled_samples[feature_columns]
            y = labeled_samples[target_column]
            
            # Handle categorical features
            X_processed = X.copy()
            label_encoders = {}
            
            for col in X_processed.columns:
                if X_processed[col].dtype == 'object':
                    label_encoders[col] = LabelEncoder()
                    X_processed[col] = label_encoders[col].fit_transform(X_processed[col].astype(str))
            
            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X_processed, y, test_size=0.2, random_state=42, stratify=y
            )
            
            # Train model
            model = RandomForestClassifier(n_estimators=100, random_state=42)
            model.fit(X_train, y_train)
            
            # Evaluate
            y_pred = model.predict(X_test)
            accuracy = accuracy_score(y_test, y_pred)
            
            # Store model and encoders
            model_key = f"{target_column}_{hash(tuple(feature_columns))}"
            self.models[model_key] = {
                'model': model,
                'label_encoders': label_encoders,
                'feature_columns': feature_columns,
                'target_column': target_column,
                'accuracy': accuracy
            }
            
            return {
                'model_key': model_key,
                'accuracy': accuracy,
                'training_samples': len(labeled_samples),
                'feature_importance': dict(zip(feature_columns, model.feature_importances_)),
                'status': 'success'
            }
            
        except Exception as e:
            logger.error(f"Error training labeling model: {e}")
            return {
                'status': 'error',
                'error_message': str(e)
            }
    
    def predict_labels(self, data: pd.DataFrame, model_key: str) -> Dict[str, Any]:
        """Predict labels for unlabeled data"""
        if model_key not in self.models:
            return {
                'status': 'error',
                'error_message': 'Model not found'
            }
        
        try:
            model_info = self.models[model_key]
            model = model_info['model']
            label_encoders = model_info['label_encoders']
            feature_columns = model_info['feature_columns']
            
            # Prepare data
            X = data[feature_columns].copy()
            
            # Apply same preprocessing as training
            for col in X.columns:
                if col in label_encoders:
                    # Handle unseen categories
                    X[col] = X[col].astype(str)
                    unique_values = set(X[col])
                    encoder_classes = set(label_encoders[col].classes_)
                    
                    # Replace unseen values with the most common class
                    if unique_values - encoder_classes:
                        most_common = label_encoders[col].classes_[0]
                        X[col] = X[col].apply(lambda x: x if x in encoder_classes else most_common)
                    
                    X[col] = label_encoders[col].transform(X[col])
            
            # Predict with probabilities
            predictions = model.predict(X)
            probabilities = model.predict_proba(X)
            
            # Calculate confidence scores
            confidence_scores = np.max(probabilities, axis=1)
            
            # Create results
            results = []
            for i, (pred, conf) in enumerate(zip(predictions, confidence_scores)):
                results.append({
                    'index': data.index[i],
                    'predicted_label': pred,
                    'confidence': float(conf),
                    'needs_review': conf < self.confidence_threshold
                })
            
            return {
                'status': 'success',
                'predictions': results,
                'total_predictions': len(results),
                'high_confidence_count': sum(1 for r in results if not r['needs_review']),
                'avg_confidence': float(np.mean(confidence_scores))
            }
            
        except Exception as e:
            logger.error(f"Error predicting labels: {e}")
            return {
                'status': 'error',
                'error_message': str(e)
            }
    
    def calculate_confidence(self, predictions: np.ndarray) -> np.ndarray:
        """Calculate confidence scores for predictions"""
        # For probability-based predictions
        if predictions.ndim > 1:
            return np.max(predictions, axis=1)
        else:
            # For single predictions, use a simple heuristic
            return np.ones_like(predictions) * 0.8
    
    def suggest_manual_review(self, prediction_results: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Suggest samples that need manual review based on prediction uncertainty"""
        review_suggestions = []
        
        predictions = prediction_results.get('predictions', [])
        probabilities = prediction_results.get('probabilities', [])
        
        for i, (pred, prob) in enumerate(zip(predictions, probabilities)):
            confidence = np.max(prob) if isinstance(prob, np.ndarray) else prob
            
            if confidence < 0.7:  # Low confidence threshold
                review_suggestions.append({
                    'index': i,
                    'predicted_label': pred,
                    'confidence': float(confidence),
                    'reason': 'low_confidence',
                    'priority': 'high' if confidence < 0.5 else 'medium'
                })
        
        # Sort by confidence (lowest first)
        review_suggestions.sort(key=lambda x: x['confidence'])
        
        return review_suggestions
    
    def export_for_framework_training(
        self,
        data: pd.DataFrame,
        predictions: np.ndarray,
        confidence_scores: np.ndarray,
        framework: str = "pytorch"
    ) -> Dict[str, Any]:
        """
        Export labeled data for training in different ML frameworks
        """
        # Filter high-confidence predictions for training
        high_conf_mask = confidence_scores > 0.8
        training_data = data[high_conf_mask].copy()
        training_labels = predictions[high_conf_mask]
        
        if framework.lower() == "pytorch":
            return self._export_pytorch_format(training_data, training_labels)
        elif framework.lower() == "tensorflow":
            return self._export_tensorflow_format(training_data, training_labels)
        elif framework.lower() == "sklearn":
            return self._export_sklearn_format(training_data, training_labels)
        else:
            raise ValueError(f"Unsupported framework: {framework}")
    
    def _export_pytorch_format(self, data: pd.DataFrame, labels: np.ndarray) -> Dict[str, Any]:
        """Export data in PyTorch format"""
        try:
            import torch
            from torch.utils.data import TensorDataset, DataLoader
            
            # Convert data to tensors
            X = torch.FloatTensor(data.values)
            y = torch.LongTensor(labels)
            
            # Create dataset and dataloader
            dataset = TensorDataset(X, y)
            dataloader = DataLoader(dataset, batch_size=32, shuffle=True)
            
            return {
                'dataset': dataset,
                'dataloader': dataloader,
                'num_samples': len(data),
                'num_features': data.shape[1],
                'num_classes': len(np.unique(labels))
            }
        except ImportError:
            return {'error': 'PyTorch not available'}
    
    def _export_tensorflow_format(self, data: pd.DataFrame, labels: np.ndarray) -> Dict[str, Any]:
        """Export data in TensorFlow format"""
        try:
            import tensorflow as tf
            
            # Create tf.data.Dataset
            dataset = tf.data.Dataset.from_tensor_slices((
                data.values.astype(np.float32),
                labels.astype(np.int32)
            ))
            dataset = dataset.batch(32).shuffle(1000)
            
            return {
                'dataset': dataset,
                'num_samples': len(data),
                'num_features': data.shape[1],
                'num_classes': len(np.unique(labels))
            }
        except ImportError:
            return {'error': 'TensorFlow not available'}
    
    def _export_sklearn_format(self, data: pd.DataFrame, labels: np.ndarray) -> Dict[str, Any]:
        """Export data in scikit-learn format"""
        from sklearn.model_selection import train_test_split
        
        X_train, X_test, y_train, y_test = train_test_split(
            data.values, labels, test_size=0.2, random_state=42
        )
        
        return {
            'X_train': X_train,
            'X_test': X_test,
            'y_train': y_train,
            'y_test': y_test,
            'num_samples': len(data),
            'num_features': data.shape[1],
            'num_classes': len(np.unique(labels))
        }


class PatternRecognizer:
    """Advanced pattern recognition for data analysis"""
    
    def __init__(self):
        self.common_patterns = {
            'email': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            'phone_us': r'(\+1[-.\s]?)?(\([0-9]{3}\)[-.\s]?|[0-9]{3}[-.\s]?)[0-9]{3}[-.\s]?[0-9]{4}',
            'phone_intl': r'(\+\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}',
            'url': r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+',
            'ip_address': r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b',
            'credit_card': r'\b(?:\d{4}[-\s]?){3}\d{4}\b',
            'ssn': r'\b\d{3}-\d{2}-\d{4}\b',
            'date_iso': r'\b\d{4}-\d{2}-\d{2}\b',
            'date_us': r'\b\d{1,2}/\d{1,2}/\d{4}\b',
            'time': r'\b\d{1,2}:\d{2}(?::\d{2})?\s?(?:AM|PM)?\b',
            'currency': r'\$\s?\d+(?:,\d{3})*(?:\.\d{2})?',
            'percentage': r'\d+(?:\.\d+)?%',
            'zip_code': r'\b\d{5}(?:-\d{4})?\b',
            'uuid': r'\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b'
        }
    
    def extract_patterns(self, df: pd.DataFrame, sample_size: int = 1000) -> Dict[str, Any]:
        """Extract regex patterns from DataFrame columns"""
        results = {}
        
        for column in df.columns:
            if df[column].dtype == 'object':
                col_data = df[column].dropna()
                if len(col_data) == 0:
                    continue
                
                # Sample data for performance
                sample = col_data.sample(min(sample_size, len(col_data))) if len(col_data) > sample_size else col_data
                sample_str = sample.astype(str)
                
                column_patterns = {
                    'detected_patterns': [],
                    'pattern_coverage': {},
                    'custom_patterns': [],
                    'format_consistency': {}
                }
                
                # Check against known patterns
                for pattern_name, pattern_regex in self.common_patterns.items():
                    matches = sample_str.str.contains(pattern_regex, regex=True, case=False)
                    match_count = matches.sum()
                    
                    if match_count > 0:
                        coverage = (match_count / len(sample)) * 100
                        column_patterns['detected_patterns'].append(pattern_name)
                        column_patterns['pattern_coverage'][pattern_name] = {
                            'matches': int(match_count),
                            'coverage_percentage': float(coverage),
                            'examples': sample_str[matches].head(3).tolist()
                        }
                
                # Analyze format consistency
                column_patterns['format_consistency'] = self._analyze_format_consistency(sample_str)
                
                # Extract custom patterns
                column_patterns['custom_patterns'] = self._extract_custom_patterns(sample_str)
                
                results[column] = column_patterns
        
        return results
    
    def detect_seasonal_patterns(self, df: pd.DataFrame, date_column: str, value_column: str) -> Dict[str, Any]:
        """Detect seasonal and trend patterns in time series data"""
        if date_column not in df.columns or value_column not in df.columns:
            return {'error': 'Specified columns not found in DataFrame'}
        
        try:
            # Convert to datetime if not already
            df_copy = df.copy()
            df_copy[date_column] = pd.to_datetime(df_copy[date_column], errors='coerce')
            df_copy = df_copy.dropna(subset=[date_column, value_column])
            df_copy = df_copy.sort_values(date_column)
            
            if len(df_copy) < 10:
                return {'error': 'Insufficient data points for time series analysis'}
            
            # Create time-based features
            df_copy['year'] = df_copy[date_column].dt.year
            df_copy['month'] = df_copy[date_column].dt.month
            df_copy['day_of_week'] = df_copy[date_column].dt.dayofweek
            df_copy['quarter'] = df_copy[date_column].dt.quarter
            
            patterns = {}
            
            # Monthly seasonality
            monthly_stats = df_copy.groupby('month')[value_column].agg(['mean', 'std', 'count'])
            patterns['monthly_seasonality'] = {
                'statistics': monthly_stats.to_dict('index'),
                'coefficient_of_variation': float(monthly_stats['mean'].std() / monthly_stats['mean'].mean()) if monthly_stats['mean'].mean() != 0 else 0
            }
            
            # Weekly seasonality
            weekly_stats = df_copy.groupby('day_of_week')[value_column].agg(['mean', 'std', 'count'])
            patterns['weekly_seasonality'] = {
                'statistics': weekly_stats.to_dict('index'),
                'coefficient_of_variation': float(weekly_stats['mean'].std() / weekly_stats['mean'].mean()) if weekly_stats['mean'].mean() != 0 else 0
            }
            
            # Quarterly seasonality
            quarterly_stats = df_copy.groupby('quarter')[value_column].agg(['mean', 'std', 'count'])
            patterns['quarterly_seasonality'] = {
                'statistics': quarterly_stats.to_dict('index'),
                'coefficient_of_variation': float(quarterly_stats['mean'].std() / quarterly_stats['mean'].mean()) if quarterly_stats['mean'].mean() != 0 else 0
            }
            
            # Trend analysis using linear regression
            from sklearn.linear_model import LinearRegression
            
            # Convert dates to numeric for trend analysis
            date_numeric = (df_copy[date_column] - df_copy[date_column].min()).dt.total_seconds()
            X = date_numeric.values.reshape(-1, 1)
            y = df_copy[value_column].values
            
            lr_model = LinearRegression()
            lr_model.fit(X, y)
            
            patterns['trend_analysis'] = {
                'slope': float(lr_model.coef_[0]),
                'intercept': float(lr_model.intercept_),
                'r_squared': float(lr_model.score(X, y)),
                'trend_direction': 'increasing' if lr_model.coef_[0] > 0 else 'decreasing' if lr_model.coef_[0] < 0 else 'stable'
            }
            
            return patterns
            
        except Exception as e:
            logger.error(f"Error in seasonal pattern detection: {e}")
            return {'error': str(e)}
    
    def analyze_correlation_patterns(self, df: pd.DataFrame, threshold: float = 0.5) -> Dict[str, Any]:
        """Analyze correlation patterns between variables"""
        numeric_df = df.select_dtypes(include=[np.number])
        
        if len(numeric_df.columns) < 2:
            return {'error': 'Need at least 2 numeric columns for correlation analysis'}
        
        correlation_matrix = numeric_df.corr()
        
        patterns = {
            'strong_correlations': [],
            'correlation_clusters': [],
            'correlation_summary': {
                'avg_correlation': float(correlation_matrix.values[np.triu_indices_from(correlation_matrix.values, k=1)].mean()),
                'max_correlation': float(correlation_matrix.values[np.triu_indices_from(correlation_matrix.values, k=1)].max()),
                'min_correlation': float(correlation_matrix.values[np.triu_indices_from(correlation_matrix.values, k=1)].min())
            }
        }
        
        # Find strong correlations
        for i in range(len(correlation_matrix.columns)):
            for j in range(i+1, len(correlation_matrix.columns)):
                corr_val = correlation_matrix.iloc[i, j]
                if abs(corr_val) >= threshold:
                    patterns['strong_correlations'].append({
                        'variable1': correlation_matrix.columns[i],
                        'variable2': correlation_matrix.columns[j],
                        'correlation': float(corr_val),
                        'relationship': 'positive' if corr_val > 0 else 'negative',
                        'strength': 'very_strong' if abs(corr_val) > 0.8 else 'strong'
                    })
        
        # Hierarchical clustering of correlations
        try:
            from sklearn.cluster import AgglomerativeClustering
            
            # Use distance based on correlation
            distance_matrix = 1 - np.abs(correlation_matrix)
            
            clustering = AgglomerativeClustering(
                n_clusters=min(3, len(numeric_df.columns)), 
                metric='precomputed', 
                linkage='average'
            )
            cluster_labels = clustering.fit_predict(distance_matrix)
            
            # Group variables by cluster
            for cluster_id in np.unique(cluster_labels):
                cluster_vars = [numeric_df.columns[i] for i, label in enumerate(cluster_labels) if label == cluster_id]
                if len(cluster_vars) > 1:
                    patterns['correlation_clusters'].append({
                        'cluster_id': int(cluster_id),
                        'variables': cluster_vars,
                        'avg_internal_correlation': float(
                            correlation_matrix.loc[cluster_vars, cluster_vars].values[
                                np.triu_indices_from(correlation_matrix.loc[cluster_vars, cluster_vars].values, k=1)
                            ].mean()
                        )
                    })
                    
        except Exception as e:
            logger.warning(f"Correlation clustering failed: {e}")
        
        return patterns
    
    def _analyze_format_consistency(self, series: pd.Series) -> Dict[str, Any]:
        """Analyze format consistency within a text series"""
        if len(series) == 0:
            return {}
        
        # Analyze length patterns
        lengths = series.str.len()
        length_analysis = {
            'min_length': int(lengths.min()),
            'max_length': int(lengths.max()),
            'avg_length': float(lengths.mean()),
            'std_length': float(lengths.std()),
            'has_consistent_length': bool(lengths.nunique() <= 3)  # Allow for some variation
        }
        
        # Analyze character type patterns
        char_patterns = {
            'all_numeric': series.str.match(r'^\d+$').sum(),
            'all_alpha': series.str.match(r'^[a-zA-Z]+$').sum(),
            'alphanumeric': series.str.match(r'^[a-zA-Z0-9]+$').sum(),
            'contains_spaces': series.str.contains(r'\s').sum(),
            'contains_special': series.str.contains(r'[^a-zA-Z0-9\s]').sum()
        }
        
        total_count = len(series)
        char_pattern_percentages = {k: float((v / total_count) * 100) for k, v in char_patterns.items()}
        
        return {
            'length_analysis': length_analysis,
            'character_patterns': char_pattern_percentages
        }
    
    def _extract_custom_patterns(self, series: pd.Series, min_frequency: int = 5) -> List[Dict[str, Any]]:
        """Extract custom patterns from text data"""
        if len(series) < min_frequency:
            return []
        
        custom_patterns = []
        
        # Look for repeating character patterns
        sample = series.head(200)  # Limit for performance
        
        # Extract patterns like XXX-XXX-XXXX
        pattern_signatures = []
        for text in sample:
            if pd.isna(text):
                continue
            text_str = str(text)
            
            # Create signature by replacing letters with 'A' and digits with '9'
            signature = ''
            for char in text_str:
                if char.isalpha():
                    signature += 'A'
                elif char.isdigit():
                    signature += '9'
                else:
                    signature += char
            pattern_signatures.append(signature)
        
        # Count signature frequencies
        signature_counts = Counter(pattern_signatures)
        
        for signature, count in signature_counts.items():
            if count >= min_frequency:
                frequency_percentage = (count / len(pattern_signatures)) * 100
                custom_patterns.append({
                    'pattern_signature': signature,
                    'frequency': count,
                    'frequency_percentage': float(frequency_percentage),
                    'examples': [text for text, sig in zip(sample, pattern_signatures) if sig == signature][:3]
                })
        
        return sorted(custom_patterns, key=lambda x: x['frequency'], reverse=True)


class DataProfiler:
    """Intelligent data profiling with advanced statistical analysis"""
    
    def __init__(self):
        self.profile_cache = {}
    
    def generate_comprehensive_profile(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Generate comprehensive data profile with advanced insights"""
        profile_hash = self._calculate_profile_hash(df)
        
        if profile_hash in self.profile_cache:
            return self.profile_cache[profile_hash]
        
        profile = {
            'dataset_overview': self._generate_dataset_overview(df),
            'column_profiles': self._generate_column_profiles(df),
            'relationship_analysis': self._analyze_relationships(df),
            'data_quality_assessment': self._assess_data_quality(df),
            'statistical_insights': self._generate_statistical_insights(df),
            'recommendations': self._generate_recommendations(df)
        }
        
        # Cache the result
        self.profile_cache[profile_hash] = profile
        return profile
    
    def detect_data_drift(self, reference_df: pd.DataFrame, current_df: pd.DataFrame) -> Dict[str, Any]:
        """Detect data drift between reference and current datasets"""
        drift_analysis = {
            'overall_drift_score': 0.0,
            'column_drift_scores': {},
            'distribution_changes': {},
            'new_categories': {},
            'missing_categories': {},
            'statistical_changes': {}
        }
        
        # Ensure same columns exist
        common_columns = set(reference_df.columns) & set(current_df.columns)
        
        if not common_columns:
            return {'error': 'No common columns between reference and current datasets'}
        
        column_drift_scores = []
        
        for column in common_columns:
            ref_data = reference_df[column].dropna()
            cur_data = current_df[column].dropna()
            
            if len(ref_data) == 0 or len(cur_data) == 0:
                continue
            
            if np.issubdtype(ref_data.dtype, np.number) and np.issubdtype(cur_data.dtype, np.number):
                # Numeric drift detection
                drift_score = self._detect_numeric_drift(ref_data, cur_data)
                drift_analysis['column_drift_scores'][column] = drift_score
                column_drift_scores.append(drift_score['overall_score'])
                
                # Statistical changes
                drift_analysis['statistical_changes'][column] = {
                    'mean_change': float(cur_data.mean() - ref_data.mean()),
                    'std_change': float(cur_data.std() - ref_data.std()),
                    'median_change': float(cur_data.median() - ref_data.median()),
                    'range_change': float((cur_data.max() - cur_data.min()) - (ref_data.max() - ref_data.min()))
                }
                
            else:
                # Categorical drift detection
                drift_score = self._detect_categorical_drift(ref_data, cur_data)
                drift_analysis['column_drift_scores'][column] = drift_score
                column_drift_scores.append(drift_score['overall_score'])
                
                # Category changes
                ref_categories = set(ref_data.unique())
                cur_categories = set(cur_data.unique())
                
                drift_analysis['new_categories'][column] = list(cur_categories - ref_categories)
                drift_analysis['missing_categories'][column] = list(ref_categories - cur_categories)
        
        # Overall drift score
        drift_analysis['overall_drift_score'] = float(np.mean(column_drift_scores)) if column_drift_scores else 0.0
        
        return drift_analysis
    
    def _generate_dataset_overview(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Generate high-level dataset overview"""
        return {
            'shape': {'rows': int(df.shape[0]), 'columns': int(df.shape[1])},
            'memory_usage': float(df.memory_usage(deep=True).sum() / 1024 / 1024),  # MB
            'dtypes_summary': df.dtypes.value_counts().to_dict(),
            'missing_data_summary': {
                'total_missing_cells': int(df.isnull().sum().sum()),
                'missing_percentage': float((df.isnull().sum().sum() / (df.shape[0] * df.shape[1])) * 100),
                'columns_with_missing': int((df.isnull().sum() > 0).sum())
            },
            'duplicate_rows': {
                'count': int(df.duplicated().sum()),
                'percentage': float((df.duplicated().sum() / len(df)) * 100)
            }
        }
    
    def _generate_column_profiles(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Generate detailed profiles for each column"""
        profiles = {}
        
        for column in df.columns:
            col_data = df[column]
            profile = {
                'data_type': str(col_data.dtype),
                'non_null_count': int(col_data.count()),
                'null_count': int(col_data.isnull().sum()),
                'null_percentage': float((col_data.isnull().sum() / len(col_data)) * 100),
                'unique_count': int(col_data.nunique()),
                'unique_percentage': float((col_data.nunique() / len(col_data)) * 100)
            }
            
            if np.issubdtype(col_data.dtype, np.number):
                profile.update(self._profile_numeric_column(col_data))
            elif col_data.dtype == 'object':
                profile.update(self._profile_text_column(col_data))
            elif np.issubdtype(col_data.dtype, np.datetime64):
                profile.update(self._profile_datetime_column(col_data))
            
            profiles[column] = profile
        
        return profiles
    
    def _profile_numeric_column(self, series: pd.Series) -> Dict[str, Any]:
        """Profile numeric column with advanced statistics"""
        non_null_data = series.dropna()
        if len(non_null_data) == 0:
            return {'error': 'No non-null values'}
        
        profile = {
            'statistics': {
                'min': float(non_null_data.min()),
                'max': float(non_null_data.max()),
                'mean': float(non_null_data.mean()),
                'median': float(non_null_data.median()),
                'std': float(non_null_data.std()),
                'variance': float(non_null_data.var()),
                'skewness': float(stats.skew(non_null_data)),
                'kurtosis': float(stats.kurtosis(non_null_data)),
                'range': float(non_null_data.max() - non_null_data.min())
            },
            'percentiles': {
                f'p{p}': float(non_null_data.quantile(p/100))
                for p in [1, 5, 10, 25, 50, 75, 90, 95, 99]
            },
            'outlier_analysis': self._analyze_outliers(non_null_data),
            'distribution_analysis': self._analyze_distribution_advanced(non_null_data)
        }
        
        return profile
    
    def _profile_text_column(self, series: pd.Series) -> Dict[str, Any]:
        """Profile text column with advanced text analytics"""
        non_null_data = series.dropna().astype(str)
        if len(non_null_data) == 0:
            return {'error': 'No non-null values'}
        
        lengths = non_null_data.str.len()
        
        profile = {
            'text_statistics': {
                'avg_length': float(lengths.mean()),
                'min_length': int(lengths.min()),
                'max_length': int(lengths.max()),
                'std_length': float(lengths.std())
            },
            'character_analysis': self._analyze_character_types(non_null_data),
            'top_values': series.value_counts().head(10).to_dict(),
            'pattern_analysis': self._analyze_text_patterns_advanced(non_null_data)
        }
        
        return profile
    
    def _profile_datetime_column(self, series: pd.Series) -> Dict[str, Any]:
        """Profile datetime column"""
        non_null_data = series.dropna()
        if len(non_null_data) == 0:
            return {'error': 'No non-null values'}
        
        profile = {
            'datetime_range': {
                'min_date': non_null_data.min().isoformat(),
                'max_date': non_null_data.max().isoformat(),
                'range_days': (non_null_data.max() - non_null_data.min()).days
            },
            'temporal_patterns': {
                'year_distribution': non_null_data.dt.year.value_counts().to_dict(),
                'month_distribution': non_null_data.dt.month.value_counts().to_dict(),
                'day_of_week_distribution': non_null_data.dt.dayofweek.value_counts().to_dict()
            }
        }
        
        return profile
    
    def _analyze_relationships(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze relationships between columns"""
        numeric_columns = df.select_dtypes(include=[np.number]).columns
        
        relationships = {
            'correlations': {},
            'mutual_information': {},
            'dependency_analysis': {}
        }
        
        # Correlation analysis for numeric columns
        if len(numeric_columns) > 1:
            corr_matrix = df[numeric_columns].corr()
            
            # Extract significant correlations
            significant_correlations = []
            for i in range(len(numeric_columns)):
                for j in range(i+1, len(numeric_columns)):
                    corr_val = corr_matrix.iloc[i, j]
                    if abs(corr_val) > 0.3:  # Threshold for significance
                        significant_correlations.append({
                            'column1': numeric_columns[i],
                            'column2': numeric_columns[j],
                            'correlation': float(corr_val),
                            'abs_correlation': float(abs(corr_val))
                        })
            
            relationships['correlations'] = {
                'significant_pairs': sorted(significant_correlations, key=lambda x: x['abs_correlation'], reverse=True),
                'correlation_matrix': corr_matrix.to_dict()
            }
        
        # Mutual information analysis
        try:
            if len(numeric_columns) > 1:
                mi_scores = {}
                for i, col1 in enumerate(numeric_columns):
                    for j, col2 in enumerate(numeric_columns):
                        if i < j:
                            data1 = df[col1].dropna()
                            data2 = df[col2].dropna()
                            
                            # Align the data
                            common_idx = data1.index.intersection(data2.index)
                            if len(common_idx) > 10:
                                aligned_data1 = data1.loc[common_idx].values.reshape(-1, 1)
                                aligned_data2 = data2.loc[common_idx].values
                                
                                mi_score = mutual_info_regression(aligned_data1, aligned_data2)[0]
                                mi_scores[f"{col1}-{col2}"] = float(mi_score)
                
                relationships['mutual_information'] = mi_scores
                
        except Exception as e:
            logger.warning(f"Mutual information analysis failed: {e}")
        
        return relationships
    
    def _assess_data_quality(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Comprehensive data quality assessment"""
        analyzer = DataQualityAnalyzer()
        
        quality_scores = analyzer.calculate_quality_score(df)
        anomalies = analyzer.detect_anomalies(df)
        
        # Count total anomalies
        total_anomalies = 0
        for anomaly_type, anomaly_data in anomalies.items():
            if isinstance(anomaly_data, dict):
                if 'count' in anomaly_data:
                    total_anomalies += anomaly_data.get('count', 0)
                else:
                    for col_data in anomaly_data.values():
                        if isinstance(col_data, dict) and 'count' in col_data:
                            total_anomalies += col_data.get('count', 0)
        
        return {
            'quality_scores': quality_scores,
            'anomaly_summary': {
                'total_anomalies': total_anomalies,
                'anomaly_types': list(anomalies.keys()),
                'anomaly_details': anomalies
            },
            'data_completeness': {
                'complete_rows': int((df.dropna().shape[0] / df.shape[0]) * 100),
                'columns_complete': int(((df.isnull().sum() == 0).sum() / len(df.columns)) * 100)
            }
        }
    
    def _generate_statistical_insights(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Generate statistical insights about the dataset"""
        numeric_df = df.select_dtypes(include=[np.number])
        categorical_df = df.select_dtypes(include=['object'])
        
        insights = {
            'numeric_insights': {},
            'categorical_insights': {},
            'general_insights': []
        }
        
        # Numeric insights
        if len(numeric_df.columns) > 0:
            insights['numeric_insights'] = {
                'highly_skewed_columns': [
                    col for col in numeric_df.columns
                    if abs(stats.skew(numeric_df[col].dropna())) > 2
                ],
                'constant_columns': [
                    col for col in numeric_df.columns
                    if numeric_df[col].nunique() <= 1
                ],
                'potential_id_columns': [
                    col for col in numeric_df.columns
                    if numeric_df[col].nunique() == len(numeric_df[col].dropna()) and numeric_df[col].dtype in ['int64', 'int32']
                ]
            }
        
        # Categorical insights
        if len(categorical_df.columns) > 0:
            insights['categorical_insights'] = {
                'high_cardinality_columns': [
                    col for col in categorical_df.columns
                    if categorical_df[col].nunique() > len(categorical_df) * 0.8
                ],
                'low_cardinality_columns': [
                    col for col in categorical_df.columns
                    if categorical_df[col].nunique() < 10
                ],
                'potential_boolean_columns': [
                    col for col in categorical_df.columns
                    if categorical_df[col].nunique() == 2
                ]
            }
        
        return insights
    
    def _generate_recommendations(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Generate recommendations for data improvement"""
        recommendations = []
        
        # Memory optimization recommendations
        current_memory = df.memory_usage(deep=True).sum() / 1024 / 1024  # MB
        
        if current_memory > 100:  # If dataset is larger than 100MB
            recommendations.append({
                'type': 'memory_optimization',
                'priority': 'medium',
                'message': f'Dataset uses {current_memory:.1f}MB of memory. Consider optimizing data types.',
                'suggested_actions': ['Convert object columns to category where appropriate', 'Downcast numeric types']
            })
        
        # Missing data recommendations
        missing_percentage = (df.isnull().sum().sum() / (df.shape[0] * df.shape[1])) * 100
        if missing_percentage > 10:
            recommendations.append({
                'type': 'missing_data',
                'priority': 'high',
                'message': f'Dataset has {missing_percentage:.1f}% missing values.',
                'suggested_actions': ['Investigate missing data patterns', 'Consider imputation strategies', 'Drop columns with >50% missing values']
            })
        
        return recommendations
    
    def _calculate_profile_hash(self, df: pd.DataFrame) -> str:
        """Calculate hash for profile caching"""
        info_str = f"{df.shape}_{list(df.columns)}_{df.dtypes.to_dict()}"
        return hashlib.md5(info_str.encode()).hexdigest()
    
    def _detect_numeric_drift(self, reference: pd.Series, current: pd.Series) -> Dict[str, Any]:
        """Detect drift in numeric columns using statistical tests"""
        try:
            # Kolmogorov-Smirnov test
            ks_stat, ks_p = stats.ks_2samp(reference, current)
            
            # Mann-Whitney U test
            mw_stat, mw_p = stats.mannwhitneyu(reference, current, alternative='two-sided')
            
            # Effect size (Cohen's d)
            pooled_std = np.sqrt(((len(reference) - 1) * reference.var() + (len(current) - 1) * current.var()) / (len(reference) + len(current) - 2))
            cohens_d = (current.mean() - reference.mean()) / pooled_std if pooled_std > 0 else 0
            
            # Overall drift score (0-1, where 1 is maximum drift)
            overall_score = 1 - min(ks_p, mw_p)  # Lower p-value means higher drift
            
            return {
                'overall_score': float(overall_score),
                'ks_test': {'statistic': float(ks_stat), 'p_value': float(ks_p)},
                'mann_whitney_test': {'statistic': float(mw_stat), 'p_value': float(mw_p)},
                'effect_size': float(cohens_d),
                'drift_magnitude': 'high' if overall_score > 0.7 else 'medium' if overall_score > 0.3 else 'low'
            }
        except Exception as e:
            logger.warning(f"Numeric drift detection failed: {e}")
            return {'overall_score': 0.0, 'error': str(e)}
    
    def _detect_categorical_drift(self, reference: pd.Series, current: pd.Series) -> Dict[str, Any]:
        """Detect drift in categorical columns"""
        try:
            ref_counts = reference.value_counts(normalize=True)
            cur_counts = current.value_counts(normalize=True)
            
            # Align categories
            all_categories = set(ref_counts.index) | set(cur_counts.index)
            ref_aligned = pd.Series(index=all_categories, dtype=float).fillna(0)
            cur_aligned = pd.Series(index=all_categories, dtype=float).fillna(0)
            
            for cat in all_categories:
                ref_aligned[cat] = ref_counts.get(cat, 0)
                cur_aligned[cat] = cur_counts.get(cat, 0)
            
            # Chi-square test
            try:
                chi2_stat, chi2_p = stats.chisquare(cur_aligned.values, ref_aligned.values)
            except:
                chi2_stat, chi2_p = 0, 1
            
            # Jensen-Shannon divergence
            js_divergence = self._jensen_shannon_divergence(ref_aligned.values, cur_aligned.values)
            
            overall_score = max(1 - chi2_p, js_divergence)
            
            return {
                'overall_score': float(overall_score),
                'chi2_test': {'statistic': float(chi2_stat), 'p_value': float(chi2_p)},
                'js_divergence': float(js_divergence),
                'drift_magnitude': 'high' if overall_score > 0.7 else 'medium' if overall_score > 0.3 else 'low'
            }
        except Exception as e:
            logger.warning(f"Categorical drift detection failed: {e}")
            return {'overall_score': 0.0, 'error': str(e)}
    
    def _jensen_shannon_divergence(self, p: np.ndarray, q: np.ndarray) -> float:
        """Calculate Jensen-Shannon divergence between two probability distributions"""
        # Ensure non-zero probabilities
        p = p + 1e-10
        q = q + 1e-10
        
        # Normalize
        p = p / p.sum()
        q = q / q.sum()
        
        # Calculate JS divergence
        m = (p + q) / 2
        js = 0.5 * stats.entropy(p, m) + 0.5 * stats.entropy(q, m)
        
        return js
    
    def _analyze_outliers(self, series: pd.Series) -> Dict[str, Any]:
        """Advanced outlier analysis"""
        z_scores = np.abs(stats.zscore(series))
        iqr_outliers = self._detect_iqr_outliers(series)
        
        return {
            'z_score_outliers': {
                'count': int((z_scores > 3).sum()),
                'percentage': float(((z_scores > 3).sum() / len(series)) * 100)
            },
            'iqr_outliers': {
                'count': len(iqr_outliers),
                'percentage': float((len(iqr_outliers) / len(series)) * 100)
            }
        }
    
    def _detect_iqr_outliers(self, series: pd.Series) -> np.ndarray:
        """Detect outliers using IQR method"""
        Q1 = series.quantile(0.25)
        Q3 = series.quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR
        
        return series[(series < lower_bound) | (series > upper_bound)].values
    
    def _analyze_distribution_advanced(self, series: pd.Series) -> Dict[str, Any]:
        """Advanced distribution analysis"""
        try:
            # Test multiple distributions
            distributions = ['norm', 'lognorm', 'expon', 'gamma', 'beta']
            best_fit = {'distribution': 'unknown', 'p_value': 0}
            
            for dist_name in distributions:
                try:
                    dist = getattr(stats, dist_name)
                    params = dist.fit(series)
                    ks_stat, p_value = stats.kstest(series, lambda x: dist.cdf(x, *params))
                    
                    if p_value > best_fit['p_value']:
                        best_fit = {
                            'distribution': dist_name,
                            'p_value': float(p_value),
                            'parameters': [float(p) for p in params]
                        }
                except:
                    continue
            
            return {
                'best_fit_distribution': best_fit,
                'normality_test': {
                    'shapiro_wilk': dict(zip(['statistic', 'p_value'], 
                                           [float(x) for x in stats.shapiro(series.sample(min(5000, len(series))))]))
                },
                'distribution_properties': {
                    'skewness': float(stats.skew(series)),
                    'kurtosis': float(stats.kurtosis(series)),
                    'is_symmetric': bool(abs(stats.skew(series)) < 0.5)
                }
            }
        except Exception as e:
            logger.warning(f"Distribution analysis failed: {e}")
            return {'error': str(e)}
    
    def _analyze_character_types(self, series: pd.Series) -> Dict[str, Any]:
        """Analyze character types in text data"""
        total_chars = series.str.len().sum()
        
        if total_chars == 0:
            return {}
        
        char_analysis = {
            'digits': series.str.count(r'\d').sum(),
            'letters': series.str.count(r'[a-zA-Z]').sum(),
            'spaces': series.str.count(r'\s').sum(),
            'special_chars': series.str.count(r'[^a-zA-Z0-9\s]').sum(),
            'uppercase': series.str.count(r'[A-Z]').sum(),
            'lowercase': series.str.count(r'[a-z]').sum()
        }
        
        # Convert to percentages
        return {k: float((v / total_chars) * 100) for k, v in char_analysis.items()}
    
    def _analyze_text_patterns_advanced(self, series: pd.Series) -> Dict[str, Any]:
        """Advanced text pattern analysis"""
        pattern_recognizer = PatternRecognizer()
        
        # Use the pattern recognizer
        detected_patterns = []
        for pattern_name, pattern_regex in pattern_recognizer.common_patterns.items():
            matches = series.str.contains(pattern_regex, regex=True, case=False, na=False)
            if matches.any():
                detected_patterns.append({
                    'pattern': pattern_name,
                    'matches': int(matches.sum()),
                    'coverage': float((matches.sum() / len(series)) * 100)
                })
        
        return {
            'detected_patterns': detected_patterns,
            'avg_word_count': float(series.str.split().str.len().mean()) if series.str.split().str.len().notna().any() else 0,
            'unique_word_ratio': float(len(set(' '.join(series).split())) / len(' '.join(series).split())) if len(' '.join(series).split()) > 0 else 0
        }


class MLDataEngine:
    """Factory class for easy access to all ML-powered data analysis tools"""
    
    def __init__(self):
        self.quality_analyzer = DataQualityAnalyzer()
        self.data_cleaner = DataCleaner()
        self.auto_labeler = AutoLabeler()
        self.pattern_recognizer = PatternRecognizer()
        self.data_profiler = DataProfiler()
    
    def analyze_dataset(self, df: pd.DataFrame, include_patterns: bool = True, include_profiling: bool = True) -> Dict[str, Any]:
        """
        Comprehensive dataset analysis using all available ML tools
        
        Args:
            df: DataFrame to analyze
            include_patterns: Whether to include pattern recognition analysis
            include_profiling: Whether to include comprehensive profiling
        
        Returns:
            Dict containing all analysis results
        """
        try:
            logger.info(f"Starting comprehensive analysis of dataset with shape {df.shape}")
            
            analysis = {
                'metadata': {
                    'analysis_timestamp': datetime.now().isoformat(),
                    'dataset_shape': {'rows': df.shape[0], 'columns': df.shape[1]},
                    'analysis_version': '2.0.0'
                },
                'schema_analysis': self.quality_analyzer.analyze_schema(df),
                'quality_assessment': self.quality_analyzer.calculate_quality_score(df),
                'anomaly_detection': self.quality_analyzer.detect_anomalies(df),
                'improvement_suggestions': self.quality_analyzer.suggest_improvements(df)
            }
            
            if include_patterns:
                try:
                    analysis['pattern_recognition'] = self.pattern_recognizer.extract_patterns(df)
                    analysis['correlation_patterns'] = self.pattern_recognizer.analyze_correlation_patterns(df)
                except Exception as e:
                    logger.warning(f"Pattern recognition failed: {e}")
                    analysis['pattern_recognition'] = {'error': str(e)}
            
            if include_profiling:
                try:
                    analysis['comprehensive_profile'] = self.data_profiler.generate_comprehensive_profile(df)
                except Exception as e:
                    logger.warning(f"Comprehensive profiling failed: {e}")
                    analysis['comprehensive_profile'] = {'error': str(e)}
            
            logger.info("Comprehensive analysis completed successfully")
            return analysis
            
        except Exception as e:
            logger.error(f"Comprehensive analysis failed: {e}")
            return {
                'error': str(e),
                'metadata': {
                    'analysis_timestamp': datetime.now().isoformat(),
                    'analysis_version': '2.0.0'
                }
            }
    
    def clean_dataset(self, df: pd.DataFrame, auto_strategy: bool = True) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Intelligent dataset cleaning with ML-guided strategies
        
        Args:
            df: DataFrame to clean
            auto_strategy: Whether to automatically determine cleaning strategies
        
        Returns:
            Tuple of (cleaned_dataframe, cleaning_report)
        """
        try:
            logger.info(f"Starting intelligent cleaning of dataset with shape {df.shape}")
            
            cleaning_report = {
                'original_shape': df.shape,
                'cleaning_steps': [],
                'quality_improvement': {}
            }
            
            # Calculate initial quality score
            initial_quality = self.quality_analyzer.calculate_quality_score(df)
            
            cleaned_df = df.copy()
            
            # Remove duplicates
            if df.duplicated().sum() > 0:
                cleaned_df, dup_report = self.data_cleaner.remove_duplicates(cleaned_df)
                cleaning_report['cleaning_steps'].append({
                    'step': 'remove_duplicates',
                    'details': dup_report
                })
            
            # Handle missing values
            if cleaned_df.isnull().sum().sum() > 0:
                cleaned_df, missing_report = self.data_cleaner.handle_missing_values(cleaned_df)
                cleaning_report['cleaning_steps'].append({
                    'step': 'handle_missing_values', 
                    'details': missing_report
                })
            
            # Normalize formats
            cleaned_df, format_report = self.data_cleaner.normalize_formats(cleaned_df)
            if format_report['conversions']:
                cleaning_report['cleaning_steps'].append({
                    'step': 'normalize_formats',
                    'details': format_report
                })
            
            # Calculate final quality score
            final_quality = self.quality_analyzer.calculate_quality_score(cleaned_df)
            
            cleaning_report['final_shape'] = cleaned_df.shape
            cleaning_report['quality_improvement'] = {
                'initial_score': initial_quality['overall_score'],
                'final_score': final_quality['overall_score'],
                'improvement': final_quality['overall_score'] - initial_quality['overall_score']
            }
            
            logger.info(f"Dataset cleaning completed. Quality improved by {cleaning_report['quality_improvement']['improvement']:.2f} points")
            
            return cleaned_df, cleaning_report
            
        except Exception as e:
            logger.error(f"Dataset cleaning failed: {e}")
            return df, {'error': str(e)}
    
    def detect_data_drift(self, reference_df: pd.DataFrame, current_df: pd.DataFrame) -> Dict[str, Any]:
        """
        Detect data drift between two datasets
        
        Args:
            reference_df: Reference dataset (baseline)
            current_df: Current dataset to compare against reference
        
        Returns:
            Dict containing drift analysis results
        """
        try:
            logger.info("Starting data drift detection")
            return self.data_profiler.detect_data_drift(reference_df, current_df)
        except Exception as e:
            logger.error(f"Data drift detection failed: {e}")
            return {'error': str(e)}
    
    def get_ml_ready_data(self, df: pd.DataFrame, target_column: str = None) -> Dict[str, Any]:
        """
        Prepare data for machine learning with automatic feature engineering suggestions
        
        Args:
            df: DataFrame to prepare
            target_column: Optional target column name for supervised learning
        
        Returns:
            Dict containing ML-ready data and recommendations
        """
        try:
            logger.info("Preparing ML-ready dataset")
            
            # Analyze the dataset first
            analysis = self.analyze_dataset(df, include_patterns=False, include_profiling=False)
            
            ml_recommendations = {
                'preprocessing_suggestions': [],
                'feature_engineering_suggestions': [],
                'model_suggestions': []
            }
            
            # Analyze each column for ML readiness
            for column, schema_info in analysis['schema_analysis'].items():
                col_data = df[column]
                
                # Handle high cardinality categorical columns
                if (schema_info.get('inferred_type') == 'categorical' and 
                    schema_info.get('unique_count', 0) > 50):
                    ml_recommendations['preprocessing_suggestions'].append({
                        'column': column,
                        'issue': 'high_cardinality_categorical',
                        'suggestion': 'Consider target encoding, frequency encoding, or dimensionality reduction'
                    })
                
                # Handle missing values
                if schema_info.get('null_percentage', 0) > 0:
                    if schema_info.get('inferred_type') == 'numeric':
                        ml_recommendations['preprocessing_suggestions'].append({
                            'column': column,
                            'issue': 'missing_numeric_values',
                            'suggestion': 'Consider median imputation or advanced imputation techniques'
                        })
                    else:
                        ml_recommendations['preprocessing_suggestions'].append({
                            'column': column,
                            'issue': 'missing_categorical_values',
                            'suggestion': 'Consider mode imputation or missing value indicator'
                        })
                
                # Feature engineering suggestions
                if schema_info.get('inferred_type') == 'datetime':
                    ml_recommendations['feature_engineering_suggestions'].append({
                        'column': column,
                        'suggestion': 'Extract temporal features: year, month, day, weekday, hour, etc.'
                    })
                
                if (schema_info.get('inferred_type') == 'text' and 
                    column != target_column):
                    ml_recommendations['feature_engineering_suggestions'].append({
                        'column': column,
                        'suggestion': 'Consider text vectorization: TF-IDF, word embeddings, or BERT embeddings'
                    })
            
            # Model suggestions based on target column
            if target_column and target_column in df.columns:
                target_info = analysis['schema_analysis'].get(target_column, {})
                if target_info.get('inferred_type') == 'categorical':
                    if target_info.get('unique_count', 0) == 2:
                        ml_recommendations['model_suggestions'].extend([
                            'Binary Classification: Logistic Regression, Random Forest, XGBoost',
                            'Consider class imbalance if present'
                        ])
                    else:
                        ml_recommendations['model_suggestions'].extend([
                            'Multi-class Classification: Random Forest, XGBoost, Neural Networks',
                            'Consider one-vs-rest or one-vs-one strategies'
                        ])
                elif target_info.get('inferred_type') == 'numeric':
                    ml_recommendations['model_suggestions'].extend([
                        'Regression: Linear Regression, Random Forest, XGBoost, Neural Networks',
                        'Consider feature scaling for neural networks'
                    ])
            
            return {
                'ml_readiness_score': self._calculate_ml_readiness_score(analysis),
                'recommendations': ml_recommendations,
                'data_analysis': analysis
            }
            
        except Exception as e:
            logger.error(f"ML data preparation failed: {e}")
            return {'error': str(e)}
    
    def _calculate_ml_readiness_score(self, analysis: Dict[str, Any]) -> float:
        """Calculate a score (0-100) indicating how ready the data is for ML"""
        try:
            quality_score = analysis.get('quality_assessment', {}).get('overall_score', 0)
            
            # Penalize for high missing data
            missing_penalty = analysis.get('quality_assessment', {}).get('null_percentage', 0)
            
            # Penalize for too many anomalies
            anomaly_penalty = min(analysis.get('quality_assessment', {}).get('anomaly_percentage', 0), 20)
            
            # Calculate final score
            ml_readiness = quality_score - missing_penalty - anomaly_penalty
            
            return max(0, min(100, ml_readiness))
            
        except Exception as e:
            logger.warning(f"ML readiness score calculation failed: {e}")
            return 50.0  # Default middle score


# Convenience functions for easy access
def analyze_data_quality(df: pd.DataFrame) -> Dict[str, Any]:
    """Quick data quality analysis"""
    engine = MLDataEngine()
    return engine.analyze_dataset(df, include_patterns=False, include_profiling=False)

def comprehensive_data_analysis(df: pd.DataFrame) -> Dict[str, Any]:
    """Full comprehensive data analysis with all features"""
    engine = MLDataEngine()
    return engine.analyze_dataset(df)

def clean_data_intelligently(df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """Intelligent data cleaning with ML guidance"""
    engine = MLDataEngine()
    return engine.clean_dataset(df)

def prepare_for_ml(df: pd.DataFrame, target_column: str = None) -> Dict[str, Any]:
    """Prepare dataset for machine learning"""
    engine = MLDataEngine()
    return engine.get_ml_ready_data(df, target_column) 