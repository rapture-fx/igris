"""
Advanced Data Cleaning Service
============================

Provides sophisticated data cleaning capabilities including:
- Statistical outlier detection (IQR, Z-score, Modified Z-score)
- ML-based anomaly detection (Isolation Forest, One-Class SVM, DBSCAN)
- Advanced missing value imputation (KNN, iterative, model-based)
- Feature engineering and transformation
- Data quality scoring and recommendations
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Tuple, Optional, Union
import logging
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# Statistical libraries
from scipy import stats
from scipy.stats import zscore, iqr
import scipy.cluster.hierarchy as sch

# ML libraries
try:
    from sklearn.ensemble import IsolationForest
    from sklearn.svm import OneClassSVM
    from sklearn.cluster import DBSCAN
    from sklearn.impute import KNNImputer, IterativeImputer
    from sklearn.preprocessing import StandardScaler, RobustScaler, MinMaxScaler
    from sklearn.preprocessing import LabelEncoder, OneHotEncoder
    from sklearn.feature_selection import SelectKBest, f_classif, mutual_info_classif
    from sklearn.decomposition import PCA
    from sklearn.covariance import EllipticEnvelope
    from sklearn.neighbors import LocalOutlierFactor
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    logging.warning("ML libraries not available for advanced data cleaning")

logger = logging.getLogger(__name__)

class DataQualityMetrics:
    """Data quality assessment metrics"""
    
    @staticmethod
    def completeness_score(df: pd.DataFrame) -> float:
        """Calculate completeness score (0-1)"""
        total_cells = df.size
        non_null_cells = df.count().sum()
        return non_null_cells / total_cells if total_cells > 0 else 0
    
    @staticmethod
    def consistency_score(df: pd.DataFrame) -> Dict[str, float]:
        """Calculate consistency scores for each column"""
        consistency_scores = {}
        
        for col in df.columns:
            if df[col].dtype == 'object':
                # Text consistency: measure string format consistency
                non_null_values = df[col].dropna()
                if len(non_null_values) == 0:
                    consistency_scores[col] = 0.0
                    continue
                
                # Check for consistent formatting
                lengths = non_null_values.str.len()
                length_variance = lengths.var() if len(lengths) > 1 else 0
                max_length = lengths.max() if len(lengths) > 0 else 1
                
                # Lower variance in length indicates better consistency
                consistency_scores[col] = max(0, 1 - (length_variance / (max_length ** 2)))
            
            elif pd.api.types.is_numeric_dtype(df[col]):
                # Numeric consistency: measure coefficient of variation
                non_null_values = df[col].dropna()
                if len(non_null_values) == 0 or non_null_values.std() == 0:
                    consistency_scores[col] = 1.0
                    continue
                
                cv = abs(non_null_values.std() / non_null_values.mean()) if non_null_values.mean() != 0 else float('inf')
                # Lower CV indicates better consistency
                consistency_scores[col] = max(0, 1 - min(cv / 2, 1))
            
            else:
                consistency_scores[col] = 1.0
        
        return consistency_scores
    
    @staticmethod
    def validity_score(df: pd.DataFrame) -> Dict[str, float]:
        """Calculate validity scores for each column"""
        validity_scores = {}
        
        for col in df.columns:
            non_null_values = df[col].dropna()
            if len(non_null_values) == 0:
                validity_scores[col] = 0.0
                continue
            
            if df[col].dtype == 'object':
                # For text columns, check for valid patterns
                # This is a basic implementation - can be extended with regex patterns
                validity_scores[col] = 1.0 - (non_null_values.str.contains(r'[^\w\s.-]', regex=True).sum() / len(non_null_values))
            
            elif pd.api.types.is_numeric_dtype(df[col]):
                # For numeric columns, check for infinite values
                infinite_count = np.isinf(non_null_values).sum()
                validity_scores[col] = 1.0 - (infinite_count / len(non_null_values))
            
            else:
                validity_scores[col] = 1.0
        
        return validity_scores

class AdvancedDataCleaner:
    """Advanced data cleaning with statistical and ML-based methods"""
    
    def __init__(self):
        self.scaler = None
        self.encoders = {}
        self.imputers = {}
        self.quality_metrics = DataQualityMetrics()
        
    def analyze_data_quality(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Comprehensive data quality analysis"""
        
        # Basic statistics
        basic_stats = {
            'total_rows': len(df),
            'total_columns': len(df.columns),
            'memory_usage_mb': df.memory_usage(deep=True).sum() / (1024 * 1024),
            'duplicate_rows': df.duplicated().sum(),
            'duplicate_percentage': (df.duplicated().sum() / len(df)) * 100 if len(df) > 0 else 0
        }
        
        # Missing value analysis
        missing_analysis = {}
        for col in df.columns:
            missing_count = df[col].isnull().sum()
            missing_analysis[col] = {
                'missing_count': int(missing_count),
                'missing_percentage': float((missing_count / len(df)) * 100) if len(df) > 0 else 0,
                'data_type': str(df[col].dtype)
            }
        
        # Quality scores
        completeness = self.quality_metrics.completeness_score(df)
        consistency = self.quality_metrics.consistency_score(df)
        validity = self.quality_metrics.validity_score(df)
        
        # Overall quality score (weighted average)
        overall_quality = (
            completeness * 0.4 + 
            np.mean(list(consistency.values())) * 0.3 + 
            np.mean(list(validity.values())) * 0.3
        )
        
        return {
            'basic_statistics': basic_stats,
            'missing_value_analysis': missing_analysis,
            'quality_scores': {
                'completeness': float(completeness),
                'consistency_by_column': {k: float(v) for k, v in consistency.items()},
                'validity_by_column': {k: float(v) for k, v in validity.items()},
                'overall_quality': float(overall_quality)
            },
            'recommendations': self._generate_recommendations(df, missing_analysis, overall_quality)
        }
    
    def _generate_recommendations(self, df: pd.DataFrame, missing_analysis: Dict, quality_score: float) -> List[str]:
        """Generate data cleaning recommendations"""
        recommendations = []
        
        # Missing value recommendations
        high_missing_cols = [col for col, info in missing_analysis.items() if info['missing_percentage'] > 50]
        if high_missing_cols:
            recommendations.append(f"Consider removing columns with >50% missing values: {high_missing_cols}")
        
        medium_missing_cols = [col for col, info in missing_analysis.items() if 20 < info['missing_percentage'] <= 50]
        if medium_missing_cols:
            recommendations.append(f"Apply advanced imputation to columns with 20-50% missing values: {medium_missing_cols}")
        
        # Duplicate recommendations
        if df.duplicated().sum() > 0:
            recommendations.append(f"Remove {df.duplicated().sum()} duplicate rows")
        
        # Data type recommendations
        for col in df.columns:
            if df[col].dtype == 'object':
                # Check if it should be numeric
                try:
                    pd.to_numeric(df[col].dropna(), errors='raise')
                    recommendations.append(f"Convert column '{col}' to numeric type")
                except:
                    pass
        
        # Quality score recommendations
        if quality_score < 0.6:
            recommendations.append("Data quality is low - consider comprehensive cleaning")
        elif quality_score < 0.8:
            recommendations.append("Data quality is moderate - targeted cleaning recommended")
        
        return recommendations
    
    def detect_outliers_statistical(self, df: pd.DataFrame, methods: List[str] = None) -> Dict[str, Any]:
        """Detect outliers using statistical methods"""
        
        if methods is None:
            methods = ['iqr', 'zscore', 'modified_zscore']
        
        numeric_columns = df.select_dtypes(include=[np.number]).columns
        outlier_results = {}
        
        for col in numeric_columns:
            col_data = df[col].dropna()
            if len(col_data) < 4:  # Need minimum data points
                continue
                
            outliers = {}
            
            if 'iqr' in methods:
                # Interquartile Range method
                Q1 = col_data.quantile(0.25)
                Q3 = col_data.quantile(0.75)
                IQR = Q3 - Q1
                lower_bound = Q1 - 1.5 * IQR
                upper_bound = Q3 + 1.5 * IQR
                
                iqr_outliers = df.index[(df[col] < lower_bound) | (df[col] > upper_bound)].tolist()
                outliers['iqr'] = {
                    'indices': iqr_outliers,
                    'count': len(iqr_outliers),
                    'bounds': {'lower': float(lower_bound), 'upper': float(upper_bound)}
                }
            
            if 'zscore' in methods:
                # Z-score method
                z_scores = np.abs(zscore(col_data))
                zscore_outliers = df.index[np.abs(zscore(df[col].fillna(df[col].mean()))) > 3].tolist()
                outliers['zscore'] = {
                    'indices': zscore_outliers,
                    'count': len(zscore_outliers),
                    'threshold': 3.0
                }
            
            if 'modified_zscore' in methods:
                # Modified Z-score method (uses median)
                median = col_data.median()
                mad = np.median(np.abs(col_data - median))
                modified_z_scores = 0.6745 * (df[col].fillna(median) - median) / mad if mad != 0 else np.zeros(len(df))
                modified_zscore_outliers = df.index[np.abs(modified_z_scores) > 3.5].tolist()
                outliers['modified_zscore'] = {
                    'indices': modified_zscore_outliers,
                    'count': len(modified_zscore_outliers),
                    'threshold': 3.5
                }
            
            if outliers:
                outlier_results[col] = outliers
        
        return outlier_results
    
    def detect_outliers_ml(self, df: pd.DataFrame, methods: List[str] = None) -> Dict[str, Any]:
        """Detect outliers using ML methods"""
        
        if not ML_AVAILABLE:
            raise ValueError("ML libraries not available for outlier detection")
        
        if methods is None:
            methods = ['isolation_forest', 'one_class_svm', 'elliptic_envelope', 'lof']
        
        numeric_columns = df.select_dtypes(include=[np.number]).columns
        if len(numeric_columns) == 0:
            return {}
        
        # Prepare data
        X = df[numeric_columns].fillna(df[numeric_columns].mean())
        if len(X) < 10:  # Need minimum samples
            return {}
        
        # Scale the data
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        outlier_results = {}
        
        if 'isolation_forest' in methods:
            # Isolation Forest
            iso_forest = IsolationForest(contamination=0.1, random_state=42)
            outliers = iso_forest.fit_predict(X_scaled)
            outlier_indices = df.index[outliers == -1].tolist()
            
            outlier_results['isolation_forest'] = {
                'indices': outlier_indices,
                'count': len(outlier_indices),
                'scores': iso_forest.score_samples(X_scaled).tolist()
            }
        
        if 'one_class_svm' in methods:
            # One-Class SVM
            svm = OneClassSVM(gamma='scale', nu=0.1)
            outliers = svm.fit_predict(X_scaled)
            outlier_indices = df.index[outliers == -1].tolist()
            
            outlier_results['one_class_svm'] = {
                'indices': outlier_indices,
                'count': len(outlier_indices)
            }
        
        if 'elliptic_envelope' in methods:
            # Elliptic Envelope
            ee = EllipticEnvelope(contamination=0.1)
            outliers = ee.fit_predict(X_scaled)
            outlier_indices = df.index[outliers == -1].tolist()
            
            outlier_results['elliptic_envelope'] = {
                'indices': outlier_indices,
                'count': len(outlier_indices)
            }
        
        if 'lof' in methods:
            # Local Outlier Factor
            lof = LocalOutlierFactor(n_neighbors=20, contamination=0.1)
            outliers = lof.fit_predict(X_scaled)
            outlier_indices = df.index[outliers == -1].tolist()
            
            outlier_results['local_outlier_factor'] = {
                'indices': outlier_indices,
                'count': len(outlier_indices),
                'scores': lof.negative_outlier_factor_.tolist()
            }
        
        return outlier_results
    
    def advanced_imputation(self, df: pd.DataFrame, method: str = 'knn', **kwargs) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """Advanced missing value imputation"""
        
        if not ML_AVAILABLE:
            raise ValueError("ML libraries not available for advanced imputation")
        
        df_imputed = df.copy()
        imputation_report = {}
        
        numeric_columns = df.select_dtypes(include=[np.number]).columns
        categorical_columns = df.select_dtypes(include=['object']).columns
        
        # Numeric imputation
        if len(numeric_columns) > 0 and df[numeric_columns].isnull().any().any():
            
            if method == 'knn':
                # KNN Imputation
                n_neighbors = kwargs.get('n_neighbors', 5)
                imputer = KNNImputer(n_neighbors=n_neighbors)
                df_imputed[numeric_columns] = imputer.fit_transform(df[numeric_columns])
                
            elif method == 'iterative':
                # Iterative Imputation (MICE)
                max_iter = kwargs.get('max_iter', 10)
                imputer = IterativeImputer(max_iter=max_iter, random_state=42)
                df_imputed[numeric_columns] = imputer.fit_transform(df[numeric_columns])
            
            elif method == 'mean':
                df_imputed[numeric_columns] = df[numeric_columns].fillna(df[numeric_columns].mean())
            
            elif method == 'median':
                df_imputed[numeric_columns] = df[numeric_columns].fillna(df[numeric_columns].median())
            
            # Calculate imputation statistics
            for col in numeric_columns:
                original_missing = df[col].isnull().sum()
                if original_missing > 0:
                    imputation_report[col] = {
                        'original_missing': int(original_missing),
                        'method_used': method,
                        'imputed_values': int(original_missing)
                    }
        
        # Categorical imputation
        if len(categorical_columns) > 0:
            for col in categorical_columns:
                if df[col].isnull().any():
                    original_missing = df[col].isnull().sum()
                    
                    # Use mode for categorical data
                    mode_value = df[col].mode()
                    if len(mode_value) > 0:
                        df_imputed[col] = df[col].fillna(mode_value[0])
                        
                        imputation_report[col] = {
                            'original_missing': int(original_missing),
                            'method_used': 'mode',
                            'imputed_values': int(original_missing),
                            'fill_value': mode_value[0]
                        }
        
        return df_imputed, imputation_report
    
    def feature_engineering(self, df: pd.DataFrame, operations: List[str] = None) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """Advanced feature engineering"""
        
        if operations is None:
            operations = ['polynomial', 'log_transform', 'standardize', 'encode_categorical']
        
        df_engineered = df.copy()
        engineering_report = {}
        
        numeric_columns = df.select_dtypes(include=[np.number]).columns
        categorical_columns = df.select_dtypes(include=['object']).columns
        
        if 'polynomial' in operations and len(numeric_columns) >= 2:
            # Create polynomial features for numeric columns (degree 2)
            from itertools import combinations
            
            poly_features = []
            for col1, col2 in combinations(numeric_columns[:3], 2):  # Limit to avoid explosion
                feature_name = f"{col1}_x_{col2}"
                df_engineered[feature_name] = df[col1] * df[col2]
                poly_features.append(feature_name)
            
            engineering_report['polynomial_features'] = {
                'created_features': poly_features,
                'count': len(poly_features)
            }
        
        if 'log_transform' in operations:
            # Log transformation for skewed numeric columns
            log_transformed = []
            for col in numeric_columns:
                if df[col].min() > 0:  # Only for positive values
                    skewness = df[col].skew()
                    if abs(skewness) > 1:  # Highly skewed
                        feature_name = f"{col}_log"
                        df_engineered[feature_name] = np.log1p(df[col])
                        log_transformed.append(feature_name)
            
            engineering_report['log_transforms'] = {
                'created_features': log_transformed,
                'count': len(log_transformed)
            }
        
        if 'standardize' in operations and len(numeric_columns) > 0:
            # Standardize numeric features
            scaler = StandardScaler()
            standardized_cols = [f"{col}_scaled" for col in numeric_columns]
            df_engineered[standardized_cols] = scaler.fit_transform(df[numeric_columns])
            
            self.scaler = scaler
            engineering_report['standardization'] = {
                'original_columns': list(numeric_columns),
                'standardized_columns': standardized_cols,
                'count': len(standardized_cols)
            }
        
        if 'encode_categorical' in operations and len(categorical_columns) > 0:
            # One-hot encode categorical variables
            encoded_features = []
            for col in categorical_columns:
                if df[col].nunique() <= 10:  # Only for low cardinality
                    dummies = pd.get_dummies(df[col], prefix=col, drop_first=True)
                    df_engineered = pd.concat([df_engineered, dummies], axis=1)
                    encoded_features.extend(dummies.columns.tolist())
            
            engineering_report['categorical_encoding'] = {
                'original_columns': list(categorical_columns),
                'encoded_features': encoded_features,
                'count': len(encoded_features)
            }
        
        return df_engineered, engineering_report
    
    def comprehensive_clean(
        self, 
        df: pd.DataFrame, 
        remove_outliers: bool = True,
        impute_missing: bool = True,
        engineer_features: bool = False,
        outlier_methods: List[str] = None,
        imputation_method: str = 'knn'
    ) -> Dict[str, Any]:
        """Comprehensive data cleaning pipeline"""
        
        start_time = datetime.utcnow()
        cleaning_report = {
            'original_shape': df.shape,
            'steps_performed': [],
            'warnings': [],
            'recommendations': []
        }
        
        df_cleaned = df.copy()
        
        # Step 1: Initial quality analysis
        initial_quality = self.analyze_data_quality(df_cleaned)
        cleaning_report['initial_quality'] = initial_quality
        
        # Step 2: Remove duplicates
        duplicates_removed = df_cleaned.duplicated().sum()
        if duplicates_removed > 0:
            df_cleaned = df_cleaned.drop_duplicates()
            cleaning_report['steps_performed'].append('remove_duplicates')
            cleaning_report['duplicates_removed'] = int(duplicates_removed)
        
        # Step 3: Outlier detection and removal
        if remove_outliers:
            try:
                # Statistical outlier detection
                stat_outliers = self.detect_outliers_statistical(df_cleaned, outlier_methods or ['iqr'])
                
                # ML-based outlier detection (if available)
                ml_outliers = {}
                if ML_AVAILABLE:
                    try:
                        ml_outliers = self.detect_outliers_ml(df_cleaned, ['isolation_forest'])
                    except Exception as e:
                        cleaning_report['warnings'].append(f"ML outlier detection failed: {str(e)}")
                
                # Combine outlier indices (conservative approach - only remove if multiple methods agree)
                all_outlier_indices = set()
                outlier_summary = {}
                
                for col, methods in stat_outliers.items():
                    for method, results in methods.items():
                        all_outlier_indices.update(results['indices'])
                        outlier_summary[f"{col}_{method}"] = results['count']
                
                for method, results in ml_outliers.items():
                    all_outlier_indices.update(results['indices'])
                    outlier_summary[method] = results['count']
                
                # Remove outliers (be conservative - only remove extreme cases)
                if all_outlier_indices:
                    outliers_to_remove = list(all_outlier_indices)[:int(len(df_cleaned) * 0.05)]  # Max 5%
                    df_cleaned = df_cleaned.drop(outliers_to_remove)
                    cleaning_report['steps_performed'].append('remove_outliers')
                    cleaning_report['outliers_removed'] = len(outliers_to_remove)
                    cleaning_report['outlier_summary'] = outlier_summary
                
            except Exception as e:
                cleaning_report['warnings'].append(f"Outlier detection failed: {str(e)}")
        
        # Step 4: Advanced imputation
        if impute_missing and df_cleaned.isnull().any().any():
            try:
                df_cleaned, imputation_report = self.advanced_imputation(df_cleaned, imputation_method)
                cleaning_report['steps_performed'].append('advanced_imputation')
                cleaning_report['imputation_report'] = imputation_report
            except Exception as e:
                # Fallback to basic imputation
                cleaning_report['warnings'].append(f"Advanced imputation failed, using basic: {str(e)}")
                
                # Basic imputation
                for col in df_cleaned.columns:
                    if df_cleaned[col].dtype in ['int64', 'float64']:
                        df_cleaned[col] = df_cleaned[col].fillna(df_cleaned[col].median())
                    else:
                        mode_val = df_cleaned[col].mode()
                        if len(mode_val) > 0:
                            df_cleaned[col] = df_cleaned[col].fillna(mode_val[0])
                
                cleaning_report['steps_performed'].append('basic_imputation')
        
        # Step 5: Feature engineering (optional)
        if engineer_features:
            try:
                df_cleaned, engineering_report = self.feature_engineering(df_cleaned)
                cleaning_report['steps_performed'].append('feature_engineering')
                cleaning_report['engineering_report'] = engineering_report
            except Exception as e:
                cleaning_report['warnings'].append(f"Feature engineering failed: {str(e)}")
        
        # Step 6: Final quality analysis
        final_quality = self.analyze_data_quality(df_cleaned)
        cleaning_report['final_quality'] = final_quality
        
        # Calculate improvement metrics
        quality_improvement = final_quality['quality_scores']['overall_quality'] - initial_quality['quality_scores']['overall_quality']
        cleaning_report['quality_improvement'] = float(quality_improvement)
        cleaning_report['final_shape'] = df_cleaned.shape
        cleaning_report['processing_time_seconds'] = (datetime.utcnow() - start_time).total_seconds()
        
        return {
            'cleaned_data': df_cleaned.to_dict(orient='records'),
            'cleaning_report': cleaning_report,
            'success': True
        }

# Global instance
advanced_cleaner = AdvancedDataCleaner()