"""

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


Core AI Data Processing Engine for Pollarbase
Handles data quality analysis, anomaly detection, and auto-labeling
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.cluster import DBSCAN
from sklearn.decomposition import PCA
from scipy import stats
from typing import Dict, List, Any, Optional, Tuple
import logging
import json
from datetime import datetime

logger = logging.getLogger(__name__)

class DataQualityAnalyzer:
    """Advanced data quality analysis using statistical and ML methods"""
    
    def __init__(self):
        self.scaler = StandardScaler()
        self.isolation_forest = IsolationForest(contamination=0.1, random_state=42)
    
    def analyze_schema(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Intelligent schema inference and data type detection"""
        schema_info = {}
        
        for column in df.columns:
            col_data = df[column]
            
            # Basic type info - Convert numpy types to native Python types
            dtype_info = {
                'detected_type': str(col_data.dtype),
                'non_null_count': int(col_data.count()),
                'null_count': int(col_data.isnull().sum()),
                'null_percentage': float((col_data.isnull().sum() / len(col_data)) * 100),
                'unique_count': int(col_data.nunique()),
                'unique_percentage': float((col_data.nunique() / len(col_data)) * 100)
            }
            
            # Advanced type inference
            if col_data.dtype == 'object':
                # Try to infer better types
                if self._is_datetime(col_data):
                    dtype_info['inferred_type'] = 'datetime'
                elif self._is_categorical(col_data):
                    dtype_info['inferred_type'] = 'categorical'
                    # Convert value counts to native Python types
                    categories = col_data.value_counts().head(10)
                    dtype_info['categories'] = {str(k): int(v) for k, v in categories.to_dict().items()}
                elif self._is_numeric_string(col_data):
                    dtype_info['inferred_type'] = 'numeric_string'
                else:
                    dtype_info['inferred_type'] = 'text'
                    dtype_info['avg_length'] = float(col_data.str.len().mean()) if not col_data.str.len().empty else 0.0
                    dtype_info['max_length'] = int(col_data.str.len().max()) if not col_data.str.len().empty else 0
            
            elif np.issubdtype(col_data.dtype, np.number):
                dtype_info['inferred_type'] = 'numeric'
                dtype_info['min'] = float(col_data.min()) if not col_data.empty else 0.0
                dtype_info['max'] = float(col_data.max()) if not col_data.empty else 0.0
                dtype_info['mean'] = float(col_data.mean()) if not col_data.empty else 0.0
                dtype_info['std'] = float(col_data.std()) if not col_data.empty else 0.0
                
                # Check if it could be an ID field
                if col_data.nunique() == len(col_data):
                    dtype_info['possible_id'] = True
            
            schema_info[column] = dtype_info
        
        return schema_info
    
    def detect_anomalies(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Multi-algorithm anomaly detection"""
        anomalies = {
            'statistical_outliers': {},
            'isolation_forest_outliers': [],
            'clustering_outliers': [],
            'pattern_anomalies': {}
        }
        
        # Prepare numeric data for ML algorithms
        numeric_columns = df.select_dtypes(include=[np.number]).columns
        if len(numeric_columns) > 0:
            numeric_data = df[numeric_columns].fillna(df[numeric_columns].median())
            
            # Statistical outliers (Z-score method)
            for col in numeric_columns:
                z_scores = np.abs(stats.zscore(numeric_data[col]))
                outlier_indices = np.where(z_scores > 3)[0]
                anomalies['statistical_outliers'][col] = {
                    'count': int(len(outlier_indices)),
                    'percentage': float((len(outlier_indices) / len(df)) * 100),
                    'indices': outlier_indices.tolist()[:50]  # Limit for performance
                }
            
            # Isolation Forest for multivariate anomalies
            if len(numeric_columns) > 1:
                scaled_data = self.scaler.fit_transform(numeric_data)
                outlier_predictions = self.isolation_forest.fit_predict(scaled_data)
                outlier_indices = np.where(outlier_predictions == -1)[0]
                
                anomalies['isolation_forest_outliers'] = {
                    'count': int(len(outlier_indices)),
                    'percentage': float((len(outlier_indices) / len(df)) * 100),
                    'indices': outlier_indices.tolist()[:50]
                }
                
                # DBSCAN clustering to find density-based outliers
                try:
                    dbscan = DBSCAN(eps=0.5, min_samples=5)
                    cluster_labels = dbscan.fit_predict(scaled_data)
                    outlier_indices = np.where(cluster_labels == -1)[0]
                    
                    anomalies['clustering_outliers'] = {
                        'count': int(len(outlier_indices)),
                        'percentage': float((len(outlier_indices) / len(df)) * 100),
                        'indices': outlier_indices.tolist()[:50]
                    }
                except Exception as e:
                    logger.warning(f"DBSCAN clustering failed: {e}")
        
        # Pattern anomalies for categorical data
        categorical_columns = df.select_dtypes(include=['object']).columns
        for col in categorical_columns:
            value_counts = df[col].value_counts()
            rare_values = value_counts[value_counts == 1]
            
            anomalies['pattern_anomalies'][col] = {
                'rare_values_count': int(len(rare_values)),
                'rare_values': rare_values.index.tolist()[:20],
                'mode': str(value_counts.index[0]) if len(value_counts) > 0 else None,
                'mode_frequency': int(value_counts.iloc[0]) if len(value_counts) > 0 else 0
            }
        
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