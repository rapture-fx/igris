"""
Smart Data Profiler Service
--------------------------
Advanced ML-powered data profiling with intelligent analysis, pattern discovery,
and ML readiness evaluation. Provides comprehensive insights beyond basic statistics.
"""
from __future__ import annotations

import logging
import re
import warnings
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Union, Set
from collections import defaultdict, Counter
import hashlib

import numpy as np
import pandas as pd
from scipy import stats
from scipy.stats import entropy, normaltest, jarque_bera, anderson
from scipy.spatial.distance import pdist, squareform
from sklearn.preprocessing import LabelEncoder
from sklearn.feature_selection import mutual_info_regression, mutual_info_classif
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest

try:
    from ydata_profiling import ProfileReport
    _HAS_PROFILER = True
except ImportError:
    _HAS_PROFILER = False

logger = logging.getLogger(__name__)

# Suppress warnings for cleaner output
warnings.filterwarnings('ignore', category=RuntimeWarning)
warnings.filterwarnings('ignore', category=UserWarning)


class DataType(Enum):
    """Enhanced data types with semantic meaning."""
    NUMERIC_INTEGER = "numeric_integer"
    NUMERIC_FLOAT = "numeric_float"
    CATEGORICAL = "categorical" 
    ORDINAL = "ordinal"
    BOOLEAN = "boolean"
    DATETIME = "datetime"
    TEXT = "text"
    EMAIL = "email"
    PHONE = "phone"
    URL = "url"
    JSON = "json"
    PII_NAME = "pii_name"
    PII_ADDRESS = "pii_address"
    PII_SSN = "pii_ssn"
    PII_CREDIT_CARD = "pii_credit_card"
    IDENTIFIER = "identifier"
    CURRENCY = "currency"
    PERCENTAGE = "percentage"
    COORDINATES = "coordinates"
    IP_ADDRESS = "ip_address"
    UNKNOWN = "unknown"


class QualityDimension(Enum):
    """Data quality dimensions."""
    COMPLETENESS = "completeness"
    ACCURACY = "accuracy"
    CONSISTENCY = "consistency"
    VALIDITY = "validity"
    TIMELINESS = "timeliness"
    UNIQUENESS = "uniqueness"


@dataclass
class TypeInference:
    """Result of intelligent type inference."""
    detected_type: DataType
    confidence: float
    alternative_types: List[Tuple[DataType, float]] = field(default_factory=list)
    semantic_tags: List[str] = field(default_factory=list)
    pattern: Optional[str] = None


@dataclass
class StatisticalProfile:
    """Comprehensive statistical analysis."""
    basic_stats: Dict[str, Any] = field(default_factory=dict)
    distribution_fit: Dict[str, Any] = field(default_factory=dict)
    normality_tests: Dict[str, Any] = field(default_factory=dict)
    entropy_metrics: Dict[str, Any] = field(default_factory=dict)
    outlier_analysis: Dict[str, Any] = field(default_factory=dict)


@dataclass
class QualityAssessment:
    """Data quality scoring across multiple dimensions."""
    overall_score: float
    dimension_scores: Dict[QualityDimension, float] = field(default_factory=dict)
    issues: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)


@dataclass
class PatternDiscovery:
    """Discovered patterns in the data."""
    regex_patterns: List[str] = field(default_factory=list)
    temporal_patterns: Dict[str, Any] = field(default_factory=dict)
    structural_patterns: Dict[str, Any] = field(default_factory=dict)
    relationships: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MLReadiness:
    """ML preparation assessment."""
    readiness_score: float
    feature_quality: Dict[str, float] = field(default_factory=dict)
    preprocessing_suggestions: List[str] = field(default_factory=list)
    splitting_recommendations: Dict[str, Any] = field(default_factory=dict)
    feature_engineering: List[str] = field(default_factory=list)


@dataclass
class SmartProfile:
    """Complete intelligent data profile."""
    basic_info: Dict[str, Any] = field(default_factory=dict)
    column_profiles: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    type_inferences: Dict[str, TypeInference] = field(default_factory=dict)
    statistical_profiles: Dict[str, StatisticalProfile] = field(default_factory=dict)
    quality_assessment: QualityAssessment = field(default_factory=QualityAssessment)
    pattern_discovery: PatternDiscovery = field(default_factory=PatternDiscovery)
    ml_readiness: MLReadiness = field(default_factory=MLReadiness)
    correlations: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)


class SmartDataProfiler:
    """
    Advanced ML-powered data profiler with intelligent analysis capabilities.
    
    Features:
    - ML-based type inference with confidence scoring
    - Advanced statistical analysis and distribution fitting
    - Comprehensive data quality assessment
    - Automated pattern discovery and relationship mapping
    - ML readiness evaluation with preprocessing suggestions
    - Performance-optimized with streaming and parallel processing
    """
    
    # Regex patterns for semantic type detection
    PATTERNS = {
        DataType.EMAIL: r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
        DataType.PHONE: r'^[\+]?[1-9]?[0-9]{7,15}$',
        DataType.URL: r'^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$',
        DataType.PII_SSN: r'^\d{3}-\d{2}-\d{4}$',
        DataType.PII_CREDIT_CARD: r'^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$',
        DataType.IP_ADDRESS: r'^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$',
        DataType.CURRENCY: r'^\$?\d{1,3}(,\d{3})*(\.\d{2})?$',
        DataType.PERCENTAGE: r'^\d{1,3}(\.\d+)?%$',
        DataType.COORDINATES: r'^-?\d{1,3}\.\d+,-?\d{1,3}\.\d+$'
    }
    
    # Common PII name patterns
    PII_NAME_PATTERNS = [
        r'\b[A-Z][a-z]+ [A-Z][a-z]+\b',  # First Last
        r'\b[A-Z][a-z]+, [A-Z][a-z]+\b',  # Last, First
        r'\b[A-Z]\. [A-Z][a-z]+\b'       # F. Last
    ]
    
    def __init__(self, 
                 sample_size: Optional[int] = 100_000,
                 enable_parallel: bool = True,
                 confidence_threshold: float = 0.7,
                 max_workers: int = 4):
        """
        Initialize the Smart Data Profiler.
        
        Args:
            sample_size: Maximum rows to analyze for performance
            enable_parallel: Enable parallel processing
            confidence_threshold: Minimum confidence for type inference
            max_workers: Maximum worker threads for parallel processing
        """
        self.sample_size = sample_size
        self.enable_parallel = enable_parallel
        self.confidence_threshold = confidence_threshold
        self.max_workers = max_workers
        
        # Pre-compile regex patterns for performance
        self.compiled_patterns = {
            dtype: re.compile(pattern, re.IGNORECASE)
            for dtype, pattern in self.PATTERNS.items()
        }
        
        self.compiled_pii_patterns = [
            re.compile(pattern) for pattern in self.PII_NAME_PATTERNS
        ]
    
    def profile(self, df: pd.DataFrame, target_column: Optional[str] = None) -> SmartProfile:
        """
        Generate comprehensive smart profile for the dataset.
        
        Args:
            df: Input DataFrame
            target_column: Optional target column for ML-specific analysis
            
        Returns:
            SmartProfile with complete analysis results
        """
        logger.info("Starting smart profiling (rows=%d, cols=%d)", len(df), df.shape[1])
        
        # Smart sampling for large datasets
        sampled_df = self._smart_sample(df)
        
        # Initialize profile
        profile = SmartProfile()
        
        # Basic information
        profile.basic_info = self._get_basic_info(df, sampled_df)
        
        # Column-level analysis
        if self.enable_parallel:
            profile = self._parallel_column_analysis(sampled_df, profile, target_column)
        else:
            profile = self._sequential_column_analysis(sampled_df, profile, target_column)
        
        # Dataset-level analysis
        profile.correlations = self._analyze_correlations(sampled_df)
        profile.quality_assessment = self._assess_overall_quality(sampled_df, profile)
        profile.pattern_discovery = self._discover_dataset_patterns(sampled_df)
        profile.ml_readiness = self._evaluate_ml_readiness(sampled_df, profile, target_column)
        
        # Metadata
        profile.metadata = {
            'profiling_timestamp': datetime.now().isoformat(),
            'sample_ratio': len(sampled_df) / len(df),
            'profiler_version': '2.0.0',
            'processing_mode': 'parallel' if self.enable_parallel else 'sequential'
        }
        
        logger.info("Smart profiling completed successfully")
        return profile
    
    def _smart_sample(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Intelligent sampling strategy preserving data characteristics.
        
        Args:
            df: Input DataFrame
            
        Returns:
            Sampled DataFrame
        """
        if self.sample_size is None or len(df) <= self.sample_size:
            return df
            
        # Stratified sampling if possible
        try:
            # Try to maintain distribution across all columns
            sample_fraction = min(self.sample_size / len(df), 1.0)
            return df.sample(frac=sample_fraction, random_state=42)
        except Exception:
            # Fallback to simple random sampling
            return df.sample(n=min(len(df), self.sample_size), random_state=42)
    
    def _get_basic_info(self, original_df: pd.DataFrame, sampled_df: pd.DataFrame) -> Dict[str, Any]:
        """Get basic dataset information."""
        memory_usage = original_df.memory_usage(deep=True).sum()
        
        return {
            'shape': original_df.shape,
            'sampled_shape': sampled_df.shape,
            'memory_usage_mb': memory_usage / (1024 * 1024),
            'dtypes': original_df.dtypes.value_counts().to_dict(),
            'missing_cells': int(sampled_df.isna().sum().sum()),
            'missing_percentage': float(sampled_df.isna().sum().sum() / sampled_df.size * 100),
            'duplicate_rows': int(sampled_df.duplicated().sum()),
            'unique_rows': int(len(sampled_df) - sampled_df.duplicated().sum())
        }
    
    def _parallel_column_analysis(self, df: pd.DataFrame, profile: SmartProfile, 
                                target_column: Optional[str]) -> SmartProfile:
        """Perform parallel column analysis."""
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {
                executor.submit(self._analyze_column, df[col], col, target_column): col
                for col in df.columns
            }
            
            for future in as_completed(futures):
                col = futures[future]
                try:
                    col_analysis = future.result()
                    profile.column_profiles[col] = col_analysis['basic']
                    profile.type_inferences[col] = col_analysis['type_inference']
                    profile.statistical_profiles[col] = col_analysis['statistical']
                except Exception as e:
                    logger.error("Error analyzing column %s: %s", col, str(e))
                    # Fallback to basic analysis
                    profile.column_profiles[col] = self._basic_column_analysis(df[col])
        
        return profile
    
    def _sequential_column_analysis(self, df: pd.DataFrame, profile: SmartProfile,
                                  target_column: Optional[str]) -> SmartProfile:
        """Perform sequential column analysis."""
        for col in df.columns:
            try:
                col_analysis = self._analyze_column(df[col], col, target_column)
                profile.column_profiles[col] = col_analysis['basic']
                profile.type_inferences[col] = col_analysis['type_inference']
                profile.statistical_profiles[col] = col_analysis['statistical']
            except Exception as e:
                logger.error("Error analyzing column %s: %s", col, str(e))
                profile.column_profiles[col] = self._basic_column_analysis(df[col])
        
        return profile
    
    def _analyze_column(self, series: pd.Series, col_name: str, 
                       target_column: Optional[str]) -> Dict[str, Any]:
        """
        Comprehensive column analysis.
        
        Args:
            series: Column data
            col_name: Column name
            target_column: Optional target column for correlation analysis
            
        Returns:
            Dictionary with analysis results
        """
        # Remove missing values for analysis
        clean_series = series.dropna()
        
        return {
            'basic': self._basic_column_analysis(series),
            'type_inference': self._infer_intelligent_type(clean_series, col_name),
            'statistical': self._statistical_analysis(clean_series, col_name)
        }
    
    def _basic_column_analysis(self, series: pd.Series) -> Dict[str, Any]:
        """Basic column statistics."""
        analysis = {
            'dtype': str(series.dtype),
            'count': int(series.count()),
            'missing_count': int(series.isna().sum()),
            'missing_percentage': float(series.isna().sum() / len(series) * 100),
            'unique_count': int(series.nunique()),
            'unique_percentage': float(series.nunique() / series.count() * 100) if series.count() > 0 else 0
        }
        
        if pd.api.types.is_numeric_dtype(series):
            analysis.update({
                'min': float(series.min()) if not series.empty else None,
                'max': float(series.max()) if not series.empty else None,
                'mean': float(series.mean()) if not series.empty else None,
                'median': float(series.median()) if not series.empty else None,
                'std': float(series.std()) if not series.empty else None,
                'var': float(series.var()) if not series.empty else None,
                'skewness': float(series.skew()) if not series.empty else None,
                'kurtosis': float(series.kurtosis()) if not series.empty else None,
                'q25': float(series.quantile(0.25)) if not series.empty else None,
                'q75': float(series.quantile(0.75)) if not series.empty else None
            })
        
        elif pd.api.types.is_datetime64_any_dtype(series):
            if not series.empty:
                analysis.update({
                    'min_date': str(series.min()),
                    'max_date': str(series.max()),
                    'date_range_days': (series.max() - series.min()).days
                })
        
        else:
            # Categorical/text analysis
            if not series.empty:
                value_counts = series.value_counts()
                analysis.update({
                    'most_frequent': str(value_counts.index[0]) if len(value_counts) > 0 else None,
                    'most_frequent_count': int(value_counts.iloc[0]) if len(value_counts) > 0 else 0,
                    'least_frequent': str(value_counts.index[-1]) if len(value_counts) > 0 else None,
                    'least_frequent_count': int(value_counts.iloc[-1]) if len(value_counts) > 0 else 0
                })
        
        return analysis
    
    def _infer_intelligent_type(self, series: pd.Series, col_name: str) -> TypeInference:
        """
        ML-powered intelligent type inference with confidence scoring.
        
        Args:
            series: Clean series (no NaN values)
            col_name: Column name for context
            
        Returns:
            TypeInference object with detected type and confidence
        """
        if series.empty:
            return TypeInference(DataType.UNKNOWN, 0.0)
        
        # Initialize type scores
        type_scores = defaultdict(float)
        semantic_tags = []
        detected_pattern = None
        
        # Convert to string for pattern matching
        str_series = series.astype(str)
        sample_values = str_series.head(min(1000, len(str_series))).tolist()
        
        # 1. Pandas dtype-based scoring
        if pd.api.types.is_bool_dtype(series):
            type_scores[DataType.BOOLEAN] += 0.9
        elif pd.api.types.is_integer_dtype(series):
            type_scores[DataType.NUMERIC_INTEGER] += 0.8
        elif pd.api.types.is_float_dtype(series):
            type_scores[DataType.NUMERIC_FLOAT] += 0.8
        elif pd.api.types.is_datetime64_any_dtype(series):
            type_scores[DataType.DATETIME] += 0.9
        
        # 2. Pattern-based detection
        for data_type, pattern in self.compiled_patterns.items():
            matches = sum(1 for val in sample_values if pattern.match(val))
            match_ratio = matches / len(sample_values)
            
            if match_ratio > 0.8:
                type_scores[data_type] += 0.9 * match_ratio
                detected_pattern = self.PATTERNS[data_type]
            elif match_ratio > 0.5:
                type_scores[data_type] += 0.6 * match_ratio
        
        # 3. PII name detection
        if any(pattern.search(' '.join(sample_values[:100])) for pattern in self.compiled_pii_patterns):
            type_scores[DataType.PII_NAME] += 0.7
            semantic_tags.append('PII')
        
        # 4. Semantic analysis based on column name
        col_lower = col_name.lower()
        if any(keyword in col_lower for keyword in ['id', 'key', 'uuid', 'identifier']):
            type_scores[DataType.IDENTIFIER] += 0.6
            semantic_tags.append('identifier')
        
        if any(keyword in col_lower for keyword in ['name', 'title', 'label']):
            type_scores[DataType.TEXT] += 0.5
        
        if any(keyword in col_lower for keyword in ['email', 'mail']):
            type_scores[DataType.EMAIL] += 0.7
        
        if any(keyword in col_lower for keyword in ['phone', 'tel', 'mobile']):
            type_scores[DataType.PHONE] += 0.7
        
        # 5. Statistical analysis for categorical vs ordinal
        unique_ratio = series.nunique() / len(series)
        if unique_ratio < 0.05:  # Low cardinality
            type_scores[DataType.CATEGORICAL] += 0.6
        elif unique_ratio < 0.5 and pd.api.types.is_numeric_dtype(series):
            type_scores[DataType.ORDINAL] += 0.5
        
        # 6. JSON detection
        try:
            if sample_values and all(val.startswith(('{', '[')) for val in sample_values[:10]):
                import json
                valid_json = sum(1 for val in sample_values[:50] 
                               if self._is_valid_json(val))
                if valid_json > len(sample_values[:50]) * 0.8:
                    type_scores[DataType.JSON] += 0.8
        except Exception:
            pass
        
        # 7. Fallback to text for non-numeric, non-datetime
        if (not pd.api.types.is_numeric_dtype(series) and 
            not pd.api.types.is_datetime64_any_dtype(series) and
            not pd.api.types.is_bool_dtype(series)):
            type_scores[DataType.TEXT] += 0.3
        
        # Determine best type and confidence
        if type_scores:
            sorted_types = sorted(type_scores.items(), key=lambda x: x[1], reverse=True)
            best_type, confidence = sorted_types[0]
            
            # Alternative types (top 3)
            alternatives = [(dtype, score) for dtype, score in sorted_types[1:4]]
        else:
            best_type, confidence = DataType.UNKNOWN, 0.0
            alternatives = []
        
        return TypeInference(
            detected_type=best_type,
            confidence=min(confidence, 1.0),
            alternative_types=alternatives,
            semantic_tags=semantic_tags,
            pattern=detected_pattern
        )
    
    def _is_valid_json(self, value: str) -> bool:
        """Check if string is valid JSON."""
        try:
            import json
            json.loads(value)
            return True
        except (json.JSONDecodeError, TypeError):
            return False
    
    def _statistical_analysis(self, series: pd.Series, col_name: str) -> StatisticalProfile:
        """
        Advanced statistical analysis including distribution fitting and tests.
        
        Args:
            series: Clean series data
            col_name: Column name
            
        Returns:
            StatisticalProfile with comprehensive statistics
        """
        profile = StatisticalProfile()
        
        if series.empty:
            return profile
        
        # Basic statistics
        profile.basic_stats = {
            'count': len(series),
            'unique_count': series.nunique(),
            'mode': series.mode().iloc[0] if not series.mode().empty else None
        }
        
        # Numeric analysis
        if pd.api.types.is_numeric_dtype(series):
            profile.basic_stats.update({
                'min': float(series.min()),
                'max': float(series.max()),
                'range': float(series.max() - series.min()),
                'mean': float(series.mean()),
                'median': float(series.median()),
                'std': float(series.std()),
                'var': float(series.var()),
                'cv': float(series.std() / series.mean()) if series.mean() != 0 else float('inf'),
                'iqr': float(series.quantile(0.75) - series.quantile(0.25)),
                'mad': float(series.mad()),
                'skewness': float(series.skew()),
                'kurtosis': float(series.kurtosis())
            })
            
            # Distribution fitting
            profile.distribution_fit = self._fit_distributions(series)
            
            # Normality tests
            profile.normality_tests = self._normality_tests(series)
            
            # Outlier analysis
            profile.outlier_analysis = self._outlier_analysis(series)
        
        # Entropy and information metrics
        profile.entropy_metrics = self._entropy_analysis(series)
        
        return profile
    
    def _fit_distributions(self, series: pd.Series) -> Dict[str, Any]:
        """
        Fit multiple probability distributions and find best fit.
        
        Args:
            series: Numeric series
            
        Returns:
            Dictionary with distribution fitting results
        """
        distributions = {
            'normal': stats.norm,
            'exponential': stats.expon,
            'uniform': stats.uniform,
            'gamma': stats.gamma,
            'beta': stats.beta,
            'lognormal': stats.lognorm
        }
        
        results = {}
        best_dist = None
        best_ks_stat = float('inf')
        
        for dist_name, dist in distributions.items():
            try:
                # Fit distribution
                params = dist.fit(series)
                
                # Kolmogorov-Smirnov test
                ks_stat, ks_p_value = stats.kstest(series, lambda x: dist.cdf(x, *params))
                
                results[dist_name] = {
                    'parameters': params,
                    'ks_statistic': ks_stat,
                    'ks_p_value': ks_p_value,
                    'aic': -2 * np.sum(dist.logpdf(series, *params)) + 2 * len(params)
                }
                
                if ks_stat < best_ks_stat:
                    best_ks_stat = ks_stat
                    best_dist = dist_name
                    
            except Exception as e:
                logger.debug("Failed to fit %s distribution: %s", dist_name, str(e))
                results[dist_name] = {'error': str(e)}
        
        results['best_fit'] = best_dist
        return results
    
    def _normality_tests(self, series: pd.Series) -> Dict[str, Any]:
        """
        Perform multiple normality tests.
        
        Args:
            series: Numeric series
            
        Returns:
            Dictionary with normality test results
        """
        results = {}
        
        try:
            # Shapiro-Wilk test (best for small samples)
            if len(series) <= 5000:
                shapiro_stat, shapiro_p = stats.shapiro(series)
                results['shapiro'] = {
                    'statistic': shapiro_stat,
                    'p_value': shapiro_p,
                    'is_normal': shapiro_p > 0.05
                }
        except Exception as e:
            logger.debug("Shapiro test failed: %s", str(e))
        
        try:
            # D'Agostino and Pearson's test
            k2_stat, k2_p = normaltest(series)
            results['dagostino'] = {
                'statistic': k2_stat,
                'p_value': k2_p,
                'is_normal': k2_p > 0.05
            }
        except Exception as e:
            logger.debug("D'Agostino test failed: %s", str(e))
        
        try:
            # Jarque-Bera test
            jb_stat, jb_p = jarque_bera(series)
            results['jarque_bera'] = {
                'statistic': jb_stat,
                'p_value': jb_p,
                'is_normal': jb_p > 0.05
            }
        except Exception as e:
            logger.debug("Jarque-Bera test failed: %s", str(e))
        
        try:
            # Anderson-Darling test
            ad_stat, ad_critical, ad_significance = anderson(series)
            results['anderson'] = {
                'statistic': ad_stat,
                'critical_values': ad_critical.tolist(),
                'significance_levels': ad_significance.tolist(),
                'is_normal': ad_stat < ad_critical[2]  # 5% significance level
            }
        except Exception as e:
            logger.debug("Anderson-Darling test failed: %s", str(e))
        
        return results
    
    def _outlier_analysis(self, series: pd.Series) -> Dict[str, Any]:
        """
        Comprehensive outlier detection using multiple methods.
        
        Args:
            series: Numeric series
            
        Returns:
            Dictionary with outlier analysis results
        """
        results = {}
        
        # IQR method
        q1, q3 = series.quantile([0.25, 0.75])
        iqr = q3 - q1
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        
        iqr_outliers = series[(series < lower_bound) | (series > upper_bound)]
        results['iqr_method'] = {
            'lower_bound': lower_bound,
            'upper_bound': upper_bound,
            'outlier_count': len(iqr_outliers),
            'outlier_percentage': len(iqr_outliers) / len(series) * 100
        }
        
        # Z-score method
        z_scores = np.abs(stats.zscore(series))
        z_outliers = series[z_scores > 3]
        results['zscore_method'] = {
            'threshold': 3,
            'outlier_count': len(z_outliers),
            'outlier_percentage': len(z_outliers) / len(series) * 100
        }
        
        # Modified Z-score method (using median)
        median = series.median()
        mad = np.median(np.abs(series - median))
        modified_z_scores = 0.6745 * (series - median) / mad if mad != 0 else np.zeros_like(series)
        modified_z_outliers = series[np.abs(modified_z_scores) > 3.5]
        results['modified_zscore'] = {
            'threshold': 3.5,
            'outlier_count': len(modified_z_outliers),
            'outlier_percentage': len(modified_z_outliers) / len(series) * 100
        }
        
        # Isolation Forest (ML-based)
        try:
            if len(series) > 10:
                iso_forest = IsolationForest(contamination=0.1, random_state=42)
                outlier_labels = iso_forest.fit_predict(series.values.reshape(-1, 1))
                iso_outliers = series[outlier_labels == -1]
                results['isolation_forest'] = {
                    'outlier_count': len(iso_outliers),
                    'outlier_percentage': len(iso_outliers) / len(series) * 100
                }
        except Exception as e:
            logger.debug("Isolation Forest failed: %s", str(e))
        
        return results
    
    def _entropy_analysis(self, series: pd.Series) -> Dict[str, Any]:
        """
        Information theory metrics including entropy.
        
        Args:
            series: Input series
            
        Returns:
            Dictionary with entropy metrics
        """
        results = {}
        
        # Value counts for probability distribution
        value_counts = series.value_counts()
        probabilities = value_counts / len(series)
        
        # Shannon entropy
        results['shannon_entropy'] = entropy(probabilities, base=2)
        
        # Normalized entropy (0 to 1)
        max_entropy = np.log2(len(probabilities)) if len(probabilities) > 1 else 1
        results['normalized_entropy'] = results['shannon_entropy'] / max_entropy if max_entropy > 0 else 0
        
        # Gini coefficient for inequality measurement
        if pd.api.types.is_numeric_dtype(series) and len(series) > 1:
            sorted_values = np.sort(series.dropna())
            n = len(sorted_values)
            cumsum = np.cumsum(sorted_values)
            results['gini_coefficient'] = (n + 1 - 2 * np.sum(cumsum) / cumsum[-1]) / n if cumsum[-1] != 0 else 0
        
        return results
    
    def _analyze_correlations(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Comprehensive correlation and dependency analysis.
        
        Args:
            df: Input DataFrame
            
        Returns:
            Dictionary with correlation analysis
        """
        results = {}
        
        # Numeric correlations
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) > 1:
            # Pearson correlation
            pearson_corr = df[numeric_cols].corr(method='pearson')
            results['pearson'] = pearson_corr.to_dict()
            
            # Spearman correlation (rank-based)
            spearman_corr = df[numeric_cols].corr(method='spearman')
            results['spearman'] = spearman_corr.to_dict()
            
            # Kendall correlation
            kendall_corr = df[numeric_cols].corr(method='kendall')
            results['kendall'] = kendall_corr.to_dict()
            
            # High correlation pairs
            high_corr_pairs = []
            for i in range(len(pearson_corr.columns)):
                for j in range(i + 1, len(pearson_corr.columns)):
                    corr_val = pearson_corr.iloc[i, j]
                    if abs(corr_val) > 0.7:
                        high_corr_pairs.append({
                            'column1': pearson_corr.columns[i],
                            'column2': pearson_corr.columns[j],
                            'correlation': corr_val,
                            'strength': 'strong' if abs(corr_val) > 0.8 else 'moderate'
                        })
            
            results['high_correlations'] = high_corr_pairs
        
        # Mutual information for non-linear dependencies
        try:
            if len(numeric_cols) > 1:
                mutual_info_matrix = np.zeros((len(numeric_cols), len(numeric_cols)))
                for i, col1 in enumerate(numeric_cols):
                    for j, col2 in enumerate(numeric_cols):
                        if i != j:
                            mi = mutual_info_regression(
                                df[[col1]].fillna(0), 
                                df[col2].fillna(0),
                                random_state=42
                            )[0]
                            mutual_info_matrix[i, j] = mi
                
                results['mutual_information'] = {
                    'matrix': mutual_info_matrix.tolist(),
                    'columns': numeric_cols.tolist()
                }
        except Exception as e:
            logger.debug("Mutual information calculation failed: %s", str(e))
        
        return results
    
    def _assess_overall_quality(self, df: pd.DataFrame, profile: SmartProfile) -> QualityAssessment:
        """
        Comprehensive data quality assessment across multiple dimensions.
        
        Args:
            df: Input DataFrame
            profile: Current profile with column analyses
            
        Returns:
            QualityAssessment with scores and recommendations
        """
        assessment = QualityAssessment()
        dimension_scores = {}
        issues = []
        recommendations = []
        
        # 1. Completeness Assessment
        total_cells = df.size
        missing_cells = df.isna().sum().sum()
        completeness_score = max(0, (total_cells - missing_cells) / total_cells)
        dimension_scores[QualityDimension.COMPLETENESS] = completeness_score
        
        if completeness_score < 0.9:
            issues.append(f"Dataset has {missing_cells} missing values ({missing_cells/total_cells*100:.1f}%)")
            recommendations.append("Consider imputation strategies or removing columns/rows with excessive missing values")
        
        # 2. Uniqueness Assessment
        duplicate_rows = df.duplicated().sum()
        uniqueness_score = max(0, (len(df) - duplicate_rows) / len(df)) if len(df) > 0 else 1.0
        dimension_scores[QualityDimension.UNIQUENESS] = uniqueness_score
        
        if uniqueness_score < 0.95:
            issues.append(f"Dataset has {duplicate_rows} duplicate rows ({duplicate_rows/len(df)*100:.1f}%)")
            recommendations.append("Remove duplicate rows or investigate why duplicates exist")
        
        # 3. Consistency Assessment
        consistency_issues = 0
        total_checks = 0
        
        for col_name, type_inference in profile.type_inferences.items():
            total_checks += 1
            if type_inference.confidence < self.confidence_threshold:
                consistency_issues += 1
        
        consistency_score = max(0, (total_checks - consistency_issues) / total_checks) if total_checks > 0 else 1.0
        dimension_scores[QualityDimension.CONSISTENCY] = consistency_score
        
        if consistency_score < 0.8:
            issues.append("Some columns have inconsistent data types or formats")
            recommendations.append("Standardize data formats and resolve type inconsistencies")
        
        # 4. Validity Assessment  
        validity_score = 1.0
        invalid_patterns = 0
        
        for col_name, type_inference in profile.type_inferences.items():
            if type_inference.detected_type in [DataType.EMAIL, DataType.PHONE, DataType.URL]:
                # Check pattern validity
                series = df[col_name].dropna().astype(str)
                pattern = self.compiled_patterns.get(type_inference.detected_type)
                if pattern:
                    valid_count = sum(1 for val in series if pattern.match(val))
                    if valid_count / len(series) < 0.9:
                        invalid_patterns += 1
        
        if invalid_patterns > 0:
            validity_score = max(0, 1 - (invalid_patterns / len(profile.type_inferences)))
            issues.append(f"Found {invalid_patterns} columns with invalid data patterns")
            recommendations.append("Validate and clean data according to expected patterns")
        
        dimension_scores[QualityDimension.VALIDITY] = validity_score
        
        # 5. Accuracy Assessment (basic checks)
        accuracy_score = 1.0
        outlier_columns = 0
        
        for col_name, stat_profile in profile.statistical_profiles.items():
            if stat_profile.outlier_analysis and 'iqr_method' in stat_profile.outlier_analysis:
                outlier_pct = stat_profile.outlier_analysis['iqr_method']['outlier_percentage']
                if outlier_pct > 5:  # More than 5% outliers
                    outlier_columns += 1
        
        if outlier_columns > 0:
            accuracy_score = max(0, 1 - (outlier_columns / len(profile.statistical_profiles)))
            issues.append(f"Found {outlier_columns} columns with high outlier percentages")
            recommendations.append("Investigate and handle outliers appropriately")
        
        dimension_scores[QualityDimension.ACCURACY] = accuracy_score
        
        # 6. Timeliness Assessment (if datetime columns exist)
        timeliness_score = 1.0
        datetime_cols = df.select_dtypes(include=['datetime64']).columns
        
        if len(datetime_cols) > 0:
            for col in datetime_cols:
                max_date = df[col].max()
                if pd.notna(max_date):
                    days_old = (pd.Timestamp.now() - max_date).days
                    if days_old > 365:  # Data older than 1 year
                        timeliness_score = max(0, timeliness_score - 0.2)
                        issues.append(f"Column '{col}' has data older than 1 year")
                        recommendations.append("Consider data freshness requirements for your use case")
        
        dimension_scores[QualityDimension.TIMELINESS] = timeliness_score
        
        # Overall score (weighted average)
        weights = {
            QualityDimension.COMPLETENESS: 0.25,
            QualityDimension.UNIQUENESS: 0.15,
            QualityDimension.CONSISTENCY: 0.20,
            QualityDimension.VALIDITY: 0.20,
            QualityDimension.ACCURACY: 0.15,
            QualityDimension.TIMELINESS: 0.05
        }
        
        overall_score = sum(dimension_scores[dim] * weights[dim] for dim in weights.keys())
        
        assessment.overall_score = overall_score
        assessment.dimension_scores = dimension_scores
        assessment.issues = issues
        assessment.recommendations = recommendations
        
        return assessment
    
    def _discover_dataset_patterns(self, df: pd.DataFrame) -> PatternDiscovery:
        """
        Discover patterns across the dataset.
        
        Args:
            df: Input DataFrame
            
        Returns:
            PatternDiscovery with found patterns
        """
        discovery = PatternDiscovery()
        
        # Regex pattern extraction for text columns
        text_cols = df.select_dtypes(include=['object']).columns
        for col in text_cols:
            series = df[col].dropna().astype(str)
            if len(series) > 0:
                # Extract common patterns
                patterns = self._extract_common_patterns(series)
                if patterns:
                    discovery.regex_patterns.extend(patterns)
        
        # Temporal patterns
        datetime_cols = df.select_dtypes(include=['datetime64']).columns
        if len(datetime_cols) > 0:
            discovery.temporal_patterns = self._analyze_temporal_patterns(df[datetime_cols])
        
        # Structural patterns (relationships between columns)
        discovery.structural_patterns = self._analyze_structural_patterns(df)
        
        # Cross-column relationships
        discovery.relationships = self._analyze_relationships(df)
        
        return discovery
    
    def _extract_common_patterns(self, series: pd.Series, min_support: float = 0.1) -> List[str]:
        """Extract common regex patterns from text data."""
        patterns = []
        
        # Sample for performance
        sample = series.head(min(1000, len(series)))
        
        # Common pattern templates
        pattern_templates = [
            r'\d+',  # Numbers
            r'[A-Z]{2,}',  # Uppercase sequences
            r'[a-z]+@[a-z]+\.[a-z]+',  # Email-like
            r'\d{4}-\d{2}-\d{2}',  # Date-like
            r'\(\d{3}\) \d{3}-\d{4}',  # Phone-like
        ]
        
        for template in pattern_templates:
            matches = sample.str.contains(template, na=False, regex=True)
            if matches.sum() / len(sample) >= min_support:
                patterns.append(template)
        
        return patterns
    
    def _analyze_temporal_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze temporal patterns in datetime columns."""
        patterns = {}
        
        for col in df.columns:
            series = df[col].dropna()
            if len(series) > 0:
                patterns[col] = {
                    'seasonality': self._detect_seasonality(series),
                    'trends': self._detect_trends(series),
                    'frequency': self._analyze_frequency(series)
                }
        
        return patterns
    
    def _detect_seasonality(self, series: pd.Series) -> Dict[str, Any]:
        """Detect seasonal patterns in datetime series."""
        # Simple seasonality detection
        df_temp = pd.DataFrame({'date': series})
        df_temp['month'] = df_temp['date'].dt.month
        df_temp['day_of_week'] = df_temp['date'].dt.dayofweek
        df_temp['hour'] = df_temp['date'].dt.hour
        
        return {
            'monthly_distribution': df_temp['month'].value_counts().to_dict(),
            'weekly_distribution': df_temp['day_of_week'].value_counts().to_dict(),
            'hourly_distribution': df_temp['hour'].value_counts().to_dict() if df_temp['hour'].nunique() > 1 else {}
        }
    
    def _detect_trends(self, series: pd.Series) -> Dict[str, Any]:
        """Detect trends in datetime series."""
        # Simple trend detection using time gaps
        if len(series) < 2:
            return {}
        
        sorted_series = series.sort_values()
        gaps = sorted_series.diff().dropna()
        
        return {
            'median_gap': str(gaps.median()),
            'mean_gap': str(gaps.mean()),
            'regularity_score': 1.0 - (gaps.std() / gaps.mean()).total_seconds() / 86400 if gaps.mean().total_seconds() > 0 else 0
        }
    
    def _analyze_frequency(self, series: pd.Series) -> Dict[str, Any]:
        """Analyze frequency patterns in datetime series."""
        if len(series) < 2:
            return {}
        
        # Infer frequency
        try:
            freq = pd.infer_freq(series.sort_values())
            return {'inferred_frequency': freq}
        except Exception:
            return {'inferred_frequency': None}
    
    def _analyze_structural_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze structural patterns in the dataset."""
        patterns = {}
        
        # Column naming patterns
        col_names = df.columns.tolist()
        patterns['naming_patterns'] = {
            'snake_case': sum(1 for col in col_names if '_' in col and col.islower()),
            'camel_case': sum(1 for col in col_names if any(c.isupper() for c in col) and '_' not in col),
            'contains_numbers': sum(1 for col in col_names if any(c.isdigit() for c in col)),
            'all_caps': sum(1 for col in col_names if col.isupper()),
            'average_length': np.mean([len(col) for col in col_names])
        }
        
        # Data type patterns
        dtype_counts = df.dtypes.value_counts()
        patterns['dtype_distribution'] = dtype_counts.to_dict()
        
        # Missing data patterns
        missing_pattern = df.isnull()
        patterns['missing_patterns'] = {
            'columns_with_missing': missing_pattern.any().sum(),
            'rows_with_missing': missing_pattern.any(axis=1).sum(),
            'completely_missing_rows': missing_pattern.all(axis=1).sum(),
            'missing_correlation': missing_pattern.corr().abs().mean().mean()
        }
        
        return patterns
    
    def _analyze_relationships(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze relationships between columns."""
        relationships = {}
        
        # Functional dependencies (simplified)
        relationships['potential_keys'] = []
        relationships['functional_dependencies'] = []
        
        for col in df.columns:
            # Check if column could be a primary key
            if df[col].nunique() == len(df.dropna(subset=[col])):
                relationships['potential_keys'].append(col)
            
            # Check for potential functional dependencies
            for other_col in df.columns:
                if col != other_col:
                    # Simple check: if grouped by col, other_col has only one unique value
                    grouped = df.groupby(col)[other_col].nunique()
                    if (grouped == 1).all() and df[col].nunique() > 1:
                        relationships['functional_dependencies'].append({
                            'determinant': col,
                            'dependent': other_col,
                            'confidence': 1.0
                        })
        
        return relationships
    
    def _evaluate_ml_readiness(self, df: pd.DataFrame, profile: SmartProfile, 
                             target_column: Optional[str]) -> MLReadiness:
        """
        Evaluate dataset readiness for machine learning.
        
        Args:
            df: Input DataFrame
            profile: Current profile
            target_column: Optional target column
            
        Returns:
            MLReadiness assessment
        """
        readiness = MLReadiness()
        
        # Feature quality scoring
        feature_scores = {}
        preprocessing_suggestions = []
        feature_engineering = []
        
        for col_name, col_profile in profile.column_profiles.items():
            score = 1.0
            
            # Penalize high missing percentage
            missing_pct = col_profile['missing_percentage']
            if missing_pct > 50:
                score *= 0.3
                preprocessing_suggestions.append(f"Handle high missing percentage in '{col_name}' ({missing_pct:.1f}%)")
            elif missing_pct > 20:
                score *= 0.7
                preprocessing_suggestions.append(f"Consider imputation for '{col_name}' ({missing_pct:.1f}% missing)")
            
            # Penalize low uniqueness in non-categorical columns
            unique_pct = col_profile['unique_percentage']
            type_inference = profile.type_inferences.get(col_name)
            
            if type_inference and type_inference.detected_type not in [DataType.CATEGORICAL, DataType.BOOLEAN]:
                if unique_pct < 1:
                    score *= 0.5
                    feature_engineering.append(f"Consider one-hot encoding for '{col_name}' (low uniqueness)")
            
            # Boost score for well-detected types
            if type_inference and type_inference.confidence > 0.8:
                score *= 1.2
            
            # Penalize high cardinality categorical
            if (type_inference and type_inference.detected_type == DataType.CATEGORICAL and 
                col_profile['unique_count'] > 50):
                score *= 0.8
                preprocessing_suggestions.append(f"High cardinality categorical '{col_name}' may need grouping or encoding")
            
            feature_scores[col_name] = min(score, 1.0)
        
        # Overall readiness score
        base_score = np.mean(list(feature_scores.values())) if feature_scores else 0.0
        
        # Data quality impact
        quality_impact = profile.quality_assessment.overall_score
        
        # Missing data impact
        missing_impact = max(0, 1 - (profile.basic_info['missing_percentage'] / 100))
        
        # Final score
        readiness_score = (base_score * 0.5 + quality_impact * 0.3 + missing_impact * 0.2)
        
        # Splitting recommendations
        splitting_recommendations = {
            'recommended_train_ratio': 0.8,
            'recommended_validation_ratio': 0.1,
            'recommended_test_ratio': 0.1,
            'stratification_recommended': False
        }
        
        if target_column and target_column in df.columns:
            target_type = profile.type_inferences.get(target_column)
            if target_type and target_type.detected_type == DataType.CATEGORICAL:
                target_balance = df[target_column].value_counts()
                min_class_ratio = target_balance.min() / target_balance.sum()
                
                if min_class_ratio < 0.1:
                    splitting_recommendations['stratification_recommended'] = True
                    preprocessing_suggestions.append("Use stratified sampling due to class imbalance")
        
        # Additional feature engineering suggestions
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) > 1:
            feature_engineering.append("Consider feature scaling/normalization for numeric columns")
        
        categorical_cols = [col for col, inf in profile.type_inferences.items() 
                          if inf.detected_type == DataType.CATEGORICAL]
        if categorical_cols:
            feature_engineering.append("Consider encoding categorical variables (one-hot, label, or target encoding)")
        
        datetime_cols = df.select_dtypes(include=['datetime64']).columns
        if len(datetime_cols) > 0:
            feature_engineering.append("Extract datetime features (year, month, day, etc.) for temporal analysis")
        
        readiness.readiness_score = readiness_score
        readiness.feature_quality = feature_scores
        readiness.preprocessing_suggestions = preprocessing_suggestions
        readiness.splitting_recommendations = splitting_recommendations
        readiness.feature_engineering = feature_engineering
        
        return readiness
    
    def to_dict(self, profile: SmartProfile) -> Dict[str, Any]:
        """
        Convert SmartProfile to JSON-serializable dictionary.
        
        Args:
            profile: SmartProfile object
            
        Returns:
            Dictionary representation
        """
        def convert_dataclass(obj):
            """Convert dataclass to dictionary."""
            if hasattr(obj, '__dataclass_fields__'):
                result = {}
                for field_name, field_value in obj.__dict__.items():
                    if isinstance(field_value, dict):
                        result[field_name] = {k: convert_dataclass(v) for k, v in field_value.items()}
                    elif isinstance(field_value, list):
                        result[field_name] = [convert_dataclass(item) for item in field_value]
                    elif hasattr(field_value, '__dataclass_fields__'):
                        result[field_name] = convert_dataclass(field_value)
                    elif isinstance(field_value, Enum):
                        result[field_name] = field_value.value
                    else:
                        result[field_name] = field_value
                return result
            elif isinstance(obj, Enum):
                return obj.value
            else:
                return obj
        
        return convert_dataclass(profile)
    
    def generate_report(self, profile: SmartProfile) -> str:
        """
        Generate a human-readable report from the profile.
        
        Args:
            profile: SmartProfile object
            
        Returns:
            Formatted report string
        """
        report = []
        report.append("=" * 80)
        report.append("SMART DATA PROFILE REPORT")
        report.append("=" * 80)
        
        # Basic Information
        basic = profile.basic_info
        report.append(f"\nDATASET OVERVIEW:")
        report.append(f"  Shape: {basic['shape'][0]:,} rows × {basic['shape'][1]} columns")
        report.append(f"  Memory Usage: {basic['memory_usage_mb']:.2f} MB")
        report.append(f"  Missing Data: {basic['missing_percentage']:.2f}%")
        report.append(f"  Duplicate Rows: {basic['duplicate_rows']:,}")
        
        # Data Quality
        quality = profile.quality_assessment
        report.append(f"\nDATA QUALITY ASSESSMENT:")
        report.append(f"  Overall Score: {quality.overall_score:.2f}/1.0")
        
        for dimension, score in quality.dimension_scores.items():
            report.append(f"  {dimension.value.title()}: {score:.2f}")
        
        if quality.issues:
            report.append(f"\n  Issues Found:")
            for issue in quality.issues[:5]:  # Top 5 issues
                report.append(f"    - {issue}")
        
        # Column Analysis Summary
        report.append(f"\nCOLUMN ANALYSIS:")
        for col_name, type_inf in profile.type_inferences.items():
            col_profile = profile.column_profiles[col_name]
            report.append(f"  {col_name}:")
            report.append(f"    Type: {type_inf.detected_type.value} (confidence: {type_inf.confidence:.2f})")
            report.append(f"    Missing: {col_profile['missing_percentage']:.1f}%")
            report.append(f"    Unique: {col_profile['unique_percentage']:.1f}%")
        
        # ML Readiness
        ml_ready = profile.ml_readiness
        report.append(f"\nML READINESS ASSESSMENT:")
        report.append(f"  Readiness Score: {ml_ready.readiness_score:.2f}/1.0")
        
        if ml_ready.preprocessing_suggestions:
            report.append(f"  Preprocessing Recommendations:")
            for suggestion in ml_ready.preprocessing_suggestions[:3]:
                report.append(f"    - {suggestion}")
        
        if ml_ready.feature_engineering:
            report.append(f"  Feature Engineering Suggestions:")
            for suggestion in ml_ready.feature_engineering[:3]:
                report.append(f"    - {suggestion}")
        
        # High Correlations
        if 'high_correlations' in profile.correlations and profile.correlations['high_correlations']:
            report.append(f"\nHIGH CORRELATIONS:")
            for corr in profile.correlations['high_correlations'][:5]:
                report.append(f"  {corr['column1']} ↔ {corr['column2']}: {corr['correlation']:.3f}")
        
        report.append("\n" + "=" * 80)
        report.append(f"Report generated: {profile.metadata.get('profiling_timestamp', 'Unknown')}")
        report.append("=" * 80)
        
        return "\n".join(report)


# Convenience function for quick profiling
def quick_profile(df: pd.DataFrame, 
                 target_column: Optional[str] = None,
                 sample_size: int = 50_000) -> SmartProfile:
    """
    Quick smart profiling with default settings.
    
    Args:
        df: Input DataFrame
        target_column: Optional target column for ML analysis
        sample_size: Maximum rows to analyze
        
    Returns:
        SmartProfile object
    """
    profiler = SmartDataProfiler(sample_size=sample_size)
    return profiler.profile(df, target_column)