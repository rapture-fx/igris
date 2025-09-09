"""
Dataset Quality Analyzer Service
===============================

Advanced data quality assessment service for the Dataset Marketplace.
Provides comprehensive quality analysis including:
- Automated data profiling and statistical analysis
- Data completeness, consistency, validity, and accuracy scoring
- Bias detection and fairness metrics
- Anomaly and outlier detection
- Schema validation and type consistency
- Distribution analysis and correlation assessment
- Quality recommendations and actionable insights

The service supports multiple data formats and integrates with ML pipelines
to ensure high-quality datasets for AI model training.
"""

import os
import json
import logging
import asyncio
import pandas as pd
import numpy as np
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple, Union
from dataclasses import dataclass, asdict
from enum import Enum
import warnings
warnings.filterwarnings('ignore')

# Statistical and ML libraries
try:
    from scipy import stats
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
    from sklearn.cluster import DBSCAN
    import seaborn as sns
    import matplotlib.pyplot as plt
    ADVANCED_STATS_AVAILABLE = True
except ImportError:
    ADVANCED_STATS_AVAILABLE = False

# Database integration
try:
    from app.models.dataset_marketplace import (
        DataQualityReport, DataQualityLevel, Dataset, DatasetVersion
    )
    from app.database.connection import get_database_session
    MODELS_AVAILABLE = True
except ImportError:
    MODELS_AVAILABLE = False

logger = logging.getLogger(__name__)


# Enums and Data Classes
class QualityDimension(str, Enum):
    """Quality dimensions for assessment."""
    COMPLETENESS = "completeness"
    CONSISTENCY = "consistency"
    VALIDITY = "validity"
    ACCURACY = "accuracy"
    UNIQUENESS = "uniqueness"
    TIMELINESS = "timeliness"


class AnomalyType(str, Enum):
    """Types of anomalies that can be detected."""
    STATISTICAL_OUTLIER = "statistical_outlier"
    MISSING_VALUE_PATTERN = "missing_value_pattern"
    DATA_TYPE_INCONSISTENCY = "data_type_inconsistency"
    CONSTRAINT_VIOLATION = "constraint_violation"
    DISTRIBUTION_ANOMALY = "distribution_anomaly"
    CORRELATION_ANOMALY = "correlation_anomaly"


class BiasType(str, Enum):
    """Types of bias that can be detected."""
    DEMOGRAPHIC_PARITY = "demographic_parity"
    EQUALIZED_ODDS = "equalized_odds"
    EQUAL_OPPORTUNITY = "equal_opportunity"
    DISPARATE_IMPACT = "disparate_impact"
    STATISTICAL_PARITY = "statistical_parity"


@dataclass
class QualityMetrics:
    """Container for quality metrics."""
    overall_score: float
    completeness_score: float
    consistency_score: float
    validity_score: float
    accuracy_score: float
    uniqueness_score: float
    timeliness_score: float
    quality_level: str
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ColumnProfile:
    """Detailed profile for a single column."""
    name: str
    data_type: str
    null_count: int
    null_percentage: float
    unique_count: int
    unique_percentage: float
    
    # Statistical measures
    mean: Optional[float] = None
    median: Optional[float] = None
    std: Optional[float] = None
    min_value: Optional[Union[str, float, int]] = None
    max_value: Optional[Union[str, float, int]] = None
    
    # Distribution info
    skewness: Optional[float] = None
    kurtosis: Optional[float] = None
    distribution_type: Optional[str] = None
    
    # Quality issues
    outlier_count: int = 0
    inconsistent_formats: int = 0
    constraint_violations: List[str] = None
    
    def __post_init__(self):
        if self.constraint_violations is None:
            self.constraint_violations = []


@dataclass
class BiasAssessment:
    """Bias assessment results."""
    overall_bias_score: float
    demographic_parity_score: float
    equalized_odds_score: float
    equal_opportunity_score: float
    disparate_impact_ratio: float
    
    # Detailed analysis
    protected_attributes: List[str]
    bias_findings: List[Dict[str, Any]]
    fairness_recommendations: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class AnomalyDetectionResult:
    """Results from anomaly detection."""
    total_anomalies: int
    anomaly_percentage: float
    anomaly_types: Dict[str, int]
    severity: str  # low, medium, high, critical
    
    # Detailed anomalies
    anomalies: List[Dict[str, Any]]
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class DatasetQualityAnalyzer:
    """
    Comprehensive dataset quality analyzer providing automated assessment
    of data quality dimensions, bias detection, and actionable insights.
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.quality_thresholds = self.config.get('quality_thresholds', {
            'excellent': 90.0,
            'good': 70.0,
            'fair': 50.0,
            'poor': 0.0
        })
        
        # Statistical configuration
        self.outlier_threshold = self.config.get('outlier_threshold', 3.0)  # Z-score threshold
        self.bias_threshold = self.config.get('bias_threshold', 0.1)  # 10% bias threshold
        self.correlation_threshold = self.config.get('correlation_threshold', 0.8)
        
        # Sampling configuration for large datasets
        self.max_sample_size = self.config.get('max_sample_size', 100000)
        self.sample_strategy = self.config.get('sample_strategy', 'random')
        
        logger.info("Dataset Quality Analyzer initialized")
    
    async def analyze_dataset_quality(self, 
                                    data: pd.DataFrame,
                                    dataset_id: str = None,
                                    version_id: str = None,
                                    save_to_db: bool = True,
                                    config: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Perform comprehensive quality analysis of a dataset.
        
        Args:
            data: The dataset to analyze
            dataset_id: Optional dataset ID for database integration
            version_id: Optional version ID for database integration
            save_to_db: Whether to save results to database
            config: Analysis configuration overrides
            
        Returns:
            Comprehensive quality analysis results
        """
        start_time = datetime.utcnow()
        
        try:
            # Prepare data sample if needed
            sample_data, is_sampled = self._prepare_data_sample(data)
            
            logger.info(f"Starting quality analysis for dataset with {len(data)} rows, {len(data.columns)} columns")
            if is_sampled:
                logger.info(f"Using sample of {len(sample_data)} rows for analysis")
            
            # Perform comprehensive analysis
            results = {
                'dataset_id': dataset_id,
                'version_id': version_id,
                'analysis_timestamp': start_time.isoformat(),
                'is_sampled': is_sampled,
                'sample_size': len(sample_data) if is_sampled else len(data),
                'original_size': len(data),
                'column_count': len(data.columns)
            }
            
            # 1. Basic profiling and statistics
            basic_profile = await self._analyze_basic_profile(sample_data)
            results['basic_profile'] = basic_profile
            
            # 2. Quality dimensions assessment
            quality_metrics = await self._assess_quality_dimensions(sample_data)
            results['quality_metrics'] = quality_metrics.to_dict()
            
            # 3. Column-level profiling
            column_profiles = await self._analyze_column_profiles(sample_data)
            results['column_profiles'] = [asdict(profile) for profile in column_profiles]
            
            # 4. Schema validation
            schema_validation = await self._validate_schema(sample_data, config)
            results['schema_validation'] = schema_validation
            
            # 5. Distribution analysis
            distribution_analysis = await self._analyze_distributions(sample_data)
            results['distribution_analysis'] = distribution_analysis
            
            # 6. Correlation analysis
            correlation_analysis = await self._analyze_correlations(sample_data)
            results['correlation_analysis'] = correlation_analysis
            
            # 7. Anomaly detection
            anomaly_results = await self._detect_anomalies(sample_data)
            results['anomaly_detection'] = anomaly_results.to_dict()
            
            # 8. Bias assessment (if applicable)
            bias_assessment = await self._assess_bias(sample_data, config)
            if bias_assessment:
                results['bias_assessment'] = bias_assessment.to_dict()
            
            # 9. Generate recommendations
            recommendations = await self._generate_recommendations(results)
            results['recommendations'] = recommendations
            
            # 10. Calculate final metrics
            final_metrics = await self._calculate_final_metrics(results)
            results.update(final_metrics)
            
            # Calculate processing time
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            results['processing_time_seconds'] = processing_time
            
            # Save to database if requested
            if save_to_db and MODELS_AVAILABLE and dataset_id:
                await self._save_to_database(results, dataset_id, version_id)
            
            logger.info(f"Quality analysis completed in {processing_time:.2f} seconds")
            logger.info(f"Overall quality score: {results.get('overall_quality_score', 'N/A')}")
            
            return results
            
        except Exception as e:
            logger.error(f"Quality analysis failed: {str(e)}")
            raise Exception(f"Dataset quality analysis failed: {str(e)}")
    
    async def _analyze_basic_profile(self, data: pd.DataFrame) -> Dict[str, Any]:
        """Generate basic dataset profile."""
        
        profile = {
            'row_count': len(data),
            'column_count': len(data.columns),
            'data_types': data.dtypes.astype(str).to_dict(),
            'memory_usage_mb': data.memory_usage(deep=True).sum() / 1024 / 1024,
            'column_names': list(data.columns),
        }
        
        # Basic statistics
        profile['total_cells'] = len(data) * len(data.columns)
        profile['non_null_cells'] = data.count().sum()
        profile['null_cells'] = profile['total_cells'] - profile['non_null_cells']
        profile['null_percentage'] = (profile['null_cells'] / profile['total_cells']) * 100
        
        # Data type distribution
        dtype_counts = data.dtypes.value_counts().to_dict()
        profile['dtype_distribution'] = {str(k): int(v) for k, v in dtype_counts.items()}
        
        # Basic duplicates check
        profile['duplicate_rows'] = data.duplicated().sum()
        profile['duplicate_percentage'] = (profile['duplicate_rows'] / len(data)) * 100
        
        return profile
    
    async def _assess_quality_dimensions(self, data: pd.DataFrame) -> QualityMetrics:
        """Assess data quality across multiple dimensions."""
        
        # 1. Completeness: Percentage of non-null values
        total_cells = len(data) * len(data.columns)
        non_null_cells = data.count().sum()
        completeness_score = (non_null_cells / total_cells) * 100
        
        # 2. Consistency: Data format and type consistency
        consistency_issues = 0
        total_checks = 0
        
        for col in data.columns:
            total_checks += 1
            if data[col].dtype == 'object':
                # Check for mixed types in object columns
                try:
                    pd.to_numeric(data[col], errors='raise')
                except:
                    # Check if it's consistently string
                    non_null_values = data[col].dropna()
                    if len(non_null_values) > 0:
                        string_count = sum(isinstance(x, str) for x in non_null_values)
                        if string_count / len(non_null_values) < 0.9:
                            consistency_issues += 1
        
        consistency_score = max(0, (1 - consistency_issues / max(total_checks, 1)) * 100)
        
        # 3. Validity: Values within expected ranges/formats
        validity_issues = 0
        total_validity_checks = 0
        
        for col in data.columns:
            col_data = data[col].dropna()
            if len(col_data) == 0:
                continue
                
            total_validity_checks += 1
            
            if data[col].dtype in ['int64', 'float64']:
                # Check for extreme outliers (beyond 4 standard deviations)
                if col_data.std() > 0:
                    z_scores = np.abs((col_data - col_data.mean()) / col_data.std())
                    extreme_outliers = (z_scores > 4).sum()
                    if extreme_outliers / len(col_data) > 0.01:  # More than 1% extreme outliers
                        validity_issues += 1
            
        validity_score = max(0, (1 - validity_issues / max(total_validity_checks, 1)) * 100)
        
        # 4. Accuracy: Estimated based on data reasonableness (basic heuristics)
        # This is a simplified accuracy assessment - in practice would need ground truth
        accuracy_score = min(completeness_score, validity_score)  # Conservative estimate
        
        # 5. Uniqueness: Absence of unexpected duplicates
        duplicate_percentage = (data.duplicated().sum() / len(data)) * 100
        uniqueness_score = max(0, 100 - duplicate_percentage)
        
        # 6. Timeliness: Based on data freshness (if timestamp columns exist)
        timeliness_score = 100.0  # Default assuming current data
        
        # Look for timestamp columns
        timestamp_cols = []
        for col in data.columns:
            if 'date' in col.lower() or 'time' in col.lower() or data[col].dtype == 'datetime64[ns]':
                timestamp_cols.append(col)
        
        if timestamp_cols:
            # Calculate timeliness based on most recent timestamp
            try:
                latest_timestamp = pd.to_datetime(data[timestamp_cols[0]], errors='coerce').max()
                if pd.notna(latest_timestamp):
                    days_old = (datetime.now() - latest_timestamp).days
                    timeliness_score = max(0, 100 - (days_old / 365) * 10)  # Decay over years
            except:
                pass
        
        # Calculate overall score
        dimension_scores = [
            completeness_score, consistency_score, validity_score,
            accuracy_score, uniqueness_score, timeliness_score
        ]
        overall_score = np.mean(dimension_scores)
        
        # Determine quality level
        if overall_score >= self.quality_thresholds['excellent']:
            quality_level = 'excellent'
        elif overall_score >= self.quality_thresholds['good']:
            quality_level = 'good'
        elif overall_score >= self.quality_thresholds['fair']:
            quality_level = 'fair'
        else:
            quality_level = 'poor'
        
        return QualityMetrics(
            overall_score=overall_score,
            completeness_score=completeness_score,
            consistency_score=consistency_score,
            validity_score=validity_score,
            accuracy_score=accuracy_score,
            uniqueness_score=uniqueness_score,
            timeliness_score=timeliness_score,
            quality_level=quality_level
        )
    
    async def _analyze_column_profiles(self, data: pd.DataFrame) -> List[ColumnProfile]:
        """Create detailed profiles for each column."""
        
        profiles = []
        
        for col_name in data.columns:
            col_data = data[col_name]
            
            # Basic statistics
            null_count = col_data.isnull().sum()
            null_percentage = (null_count / len(col_data)) * 100
            unique_count = col_data.nunique()
            unique_percentage = (unique_count / len(col_data)) * 100
            
            profile = ColumnProfile(
                name=col_name,
                data_type=str(col_data.dtype),
                null_count=null_count,
                null_percentage=null_percentage,
                unique_count=unique_count,
                unique_percentage=unique_percentage
            )
            
            # Statistical measures for numeric columns
            if col_data.dtype in ['int64', 'float64']:
                non_null_data = col_data.dropna()
                if len(non_null_data) > 0:
                    profile.mean = float(non_null_data.mean())
                    profile.median = float(non_null_data.median())
                    profile.std = float(non_null_data.std())
                    profile.min_value = float(non_null_data.min())
                    profile.max_value = float(non_null_data.max())
                    
                    # Distribution characteristics
                    if len(non_null_data) > 10:
                        profile.skewness = float(non_null_data.skew())
                        profile.kurtosis = float(non_null_data.kurtosis())
                    
                    # Outlier detection
                    if profile.std and profile.std > 0:
                        z_scores = np.abs((non_null_data - profile.mean) / profile.std)
                        profile.outlier_count = int((z_scores > self.outlier_threshold).sum())
            
            # For categorical/object columns
            elif col_data.dtype == 'object':
                non_null_data = col_data.dropna()
                if len(non_null_data) > 0:
                    profile.min_value = str(non_null_data.min()) if len(str(non_null_data.min())) < 100 else str(non_null_data.min())[:100] + "..."
                    profile.max_value = str(non_null_data.max()) if len(str(non_null_data.max())) < 100 else str(non_null_data.max())[:100] + "..."
                    
                    # Check for format inconsistencies
                    # This is a simplified check - could be more sophisticated
                    value_lengths = non_null_data.astype(str).str.len()
                    if value_lengths.std() > value_lengths.mean():
                        profile.inconsistent_formats = int(len(non_null_data) * 0.1)  # Estimate
            
            profiles.append(profile)
        
        return profiles
    
    async def _validate_schema(self, data: pd.DataFrame, config: Dict[str, Any] = None) -> Dict[str, Any]:
        """Validate dataset schema against expectations."""
        
        validation_results = {
            'schema_valid': True,
            'issues': [],
            'expected_columns': [],
            'missing_columns': [],
            'extra_columns': [],
            'type_mismatches': []
        }
        
        # If schema config is provided, validate against it
        schema_config = (config or {}).get('expected_schema', {})
        
        if schema_config:
            expected_columns = set(schema_config.get('columns', []))
            actual_columns = set(data.columns)
            
            validation_results['expected_columns'] = list(expected_columns)
            validation_results['missing_columns'] = list(expected_columns - actual_columns)
            validation_results['extra_columns'] = list(actual_columns - expected_columns)
            
            # Check data types
            expected_types = schema_config.get('data_types', {})
            for col, expected_type in expected_types.items():
                if col in data.columns:
                    actual_type = str(data[col].dtype)
                    if actual_type != expected_type:
                        validation_results['type_mismatches'].append({
                            'column': col,
                            'expected': expected_type,
                            'actual': actual_type
                        })
            
            # Update overall validity
            has_issues = any([
                validation_results['missing_columns'],
                validation_results['extra_columns'],
                validation_results['type_mismatches']
            ])
            validation_results['schema_valid'] = not has_issues
        
        else:
            # Basic schema validation without expected schema
            issues = []
            
            # Check for unnamed columns
            unnamed_cols = [col for col in data.columns if str(col).startswith('Unnamed:')]
            if unnamed_cols:
                issues.append(f"Found {len(unnamed_cols)} unnamed columns")
            
            # Check for duplicate column names
            duplicate_cols = data.columns[data.columns.duplicated()].tolist()
            if duplicate_cols:
                issues.append(f"Found duplicate column names: {duplicate_cols}")
            
            validation_results['issues'] = issues
            validation_results['schema_valid'] = len(issues) == 0
        
        return validation_results
    
    async def _analyze_distributions(self, data: pd.DataFrame) -> Dict[str, Any]:
        """Analyze data distributions for numeric columns."""
        
        distribution_analysis = {
            'numeric_columns': [],
            'distribution_tests': {},
            'normality_tests': {},
            'distribution_summaries': {}
        }
        
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        distribution_analysis['numeric_columns'] = list(numeric_columns)
        
        for col in numeric_columns:
            col_data = data[col].dropna()
            if len(col_data) < 10:
                continue
            
            # Basic distribution summary
            distribution_analysis['distribution_summaries'][col] = {
                'mean': float(col_data.mean()),
                'std': float(col_data.std()),
                'skewness': float(col_data.skew()),
                'kurtosis': float(col_data.kurtosis()),
                'quartiles': {
                    'q25': float(col_data.quantile(0.25)),
                    'q50': float(col_data.quantile(0.50)),
                    'q75': float(col_data.quantile(0.75))
                }
            }
            
            # Normality test
            if ADVANCED_STATS_AVAILABLE and len(col_data) > 20:
                try:
                    # Shapiro-Wilk test for normality (for smaller samples)
                    if len(col_data) <= 5000:
                        stat, p_value = stats.shapiro(col_data)
                        distribution_analysis['normality_tests'][col] = {
                            'test': 'shapiro_wilk',
                            'statistic': float(stat),
                            'p_value': float(p_value),
                            'is_normal': p_value > 0.05
                        }
                    else:
                        # Kolmogorov-Smirnov test for larger samples
                        stat, p_value = stats.kstest(col_data, 'norm')
                        distribution_analysis['normality_tests'][col] = {
                            'test': 'kolmogorov_smirnov',
                            'statistic': float(stat),
                            'p_value': float(p_value),
                            'is_normal': p_value > 0.05
                        }
                except:
                    pass
        
        return distribution_analysis
    
    async def _analyze_correlations(self, data: pd.DataFrame) -> Dict[str, Any]:
        """Analyze correlations between numeric columns."""
        
        correlation_analysis = {
            'correlation_matrix': {},
            'high_correlations': [],
            'correlation_insights': []
        }
        
        numeric_data = data.select_dtypes(include=[np.number])
        if len(numeric_data.columns) < 2:
            return correlation_analysis
        
        # Calculate correlation matrix
        corr_matrix = numeric_data.corr()
        correlation_analysis['correlation_matrix'] = corr_matrix.to_dict()
        
        # Find high correlations
        high_corrs = []
        for i, col1 in enumerate(corr_matrix.columns):
            for j, col2 in enumerate(corr_matrix.columns):
                if i < j:  # Avoid duplicates and self-correlation
                    corr_val = corr_matrix.iloc[i, j]
                    if not np.isnan(corr_val) and abs(corr_val) > self.correlation_threshold:
                        high_corrs.append({
                            'column1': col1,
                            'column2': col2,
                            'correlation': float(corr_val),
                            'strength': 'strong' if abs(corr_val) > 0.9 else 'moderate'
                        })
        
        correlation_analysis['high_correlations'] = high_corrs
        
        # Generate insights
        insights = []
        if len(high_corrs) > 0:
            insights.append(f"Found {len(high_corrs)} pairs of highly correlated variables")
            strong_corrs = [c for c in high_corrs if c['strength'] == 'strong']
            if strong_corrs:
                insights.append(f"{len(strong_corrs)} pairs show very strong correlation (>0.9)")
        
        correlation_analysis['correlation_insights'] = insights
        
        return correlation_analysis
    
    async def _detect_anomalies(self, data: pd.DataFrame) -> AnomalyDetectionResult:
        """Detect various types of anomalies in the dataset."""
        
        anomalies = []
        anomaly_types = {
            'statistical_outlier': 0,
            'missing_value_pattern': 0,
            'data_type_inconsistency': 0,
            'constraint_violation': 0
        }
        
        # 1. Statistical outliers in numeric columns
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        for col in numeric_columns:
            col_data = data[col].dropna()
            if len(col_data) > 10 and col_data.std() > 0:
                z_scores = np.abs((col_data - col_data.mean()) / col_data.std())
                outliers = col_data[z_scores > self.outlier_threshold]
                
                if len(outliers) > 0:
                    anomaly_types['statistical_outlier'] += len(outliers)
                    anomalies.append({
                        'type': 'statistical_outlier',
                        'column': col,
                        'count': len(outliers),
                        'percentage': (len(outliers) / len(col_data)) * 100,
                        'description': f"Found {len(outliers)} statistical outliers in {col}",
                        'severity': 'high' if len(outliers) / len(col_data) > 0.05 else 'medium'
                    })
        
        # 2. Missing value patterns
        for col in data.columns:
            missing_pct = (data[col].isnull().sum() / len(data)) * 100
            if missing_pct > 20:  # More than 20% missing
                anomaly_types['missing_value_pattern'] += 1
                anomalies.append({
                    'type': 'missing_value_pattern',
                    'column': col,
                    'percentage': missing_pct,
                    'description': f"Column {col} has {missing_pct:.1f}% missing values",
                    'severity': 'critical' if missing_pct > 50 else 'high'
                })
        
        # 3. Data type inconsistencies
        for col in data.columns:
            if data[col].dtype == 'object':
                non_null_values = data[col].dropna()
                if len(non_null_values) > 0:
                    # Check for mixed numeric and string values
                    try:
                        numeric_count = 0
                        string_count = 0
                        for val in non_null_values:
                            try:
                                float(val)
                                numeric_count += 1
                            except:
                                string_count += 1
                        
                        if numeric_count > 0 and string_count > 0:
                            mix_ratio = min(numeric_count, string_count) / len(non_null_values)
                            if mix_ratio > 0.1:  # More than 10% mixed types
                                anomaly_types['data_type_inconsistency'] += 1
                                anomalies.append({
                                    'type': 'data_type_inconsistency',
                                    'column': col,
                                    'description': f"Column {col} has mixed numeric and string values",
                                    'numeric_count': numeric_count,
                                    'string_count': string_count,
                                    'severity': 'medium'
                                })
                    except:
                        pass
        
        # Calculate overall anomaly metrics
        total_anomalies = sum(anomaly_types.values())
        total_cells = len(data) * len(data.columns)
        anomaly_percentage = (total_anomalies / total_cells) * 100
        
        # Determine severity
        if anomaly_percentage > 10:
            severity = 'critical'
        elif anomaly_percentage > 5:
            severity = 'high'
        elif anomaly_percentage > 1:
            severity = 'medium'
        else:
            severity = 'low'
        
        return AnomalyDetectionResult(
            total_anomalies=total_anomalies,
            anomaly_percentage=anomaly_percentage,
            anomaly_types=anomaly_types,
            severity=severity,
            anomalies=anomalies
        )
    
    async def _assess_bias(self, data: pd.DataFrame, config: Dict[str, Any] = None) -> Optional[BiasAssessment]:
        """Assess dataset for various types of bias."""
        
        if not config:
            return None
        
        protected_attributes = config.get('protected_attributes', [])
        target_column = config.get('target_column')
        
        if not protected_attributes or not target_column or target_column not in data.columns:
            return None
        
        try:
            bias_findings = []
            
            # Calculate basic fairness metrics
            demographic_parity_score = 100.0  # Default
            equalized_odds_score = 100.0
            equal_opportunity_score = 100.0
            disparate_impact_ratio = 1.0
            
            for attr in protected_attributes:
                if attr not in data.columns:
                    continue
                
                # Calculate demographic parity
                try:
                    grouped = data.groupby(attr)[target_column].mean()
                    if len(grouped) > 1:
                        parity_ratio = grouped.max() / grouped.min()
                        if parity_ratio > 1.2 or parity_ratio < 0.8:  # 20% threshold
                            bias_findings.append({
                                'type': 'demographic_parity',
                                'attribute': attr,
                                'ratio': float(parity_ratio),
                                'description': f"Demographic parity violation for {attr}"
                            })
                            demographic_parity_score = min(demographic_parity_score, 100 - (abs(1 - parity_ratio) * 100))
                except:
                    pass
            
            # Calculate overall bias score
            overall_bias_score = np.mean([
                demographic_parity_score,
                equalized_odds_score,
                equal_opportunity_score
            ])
            
            # Generate recommendations
            recommendations = []
            if overall_bias_score < 80:
                recommendations.append("Consider rebalancing dataset across protected attributes")
                recommendations.append("Apply bias mitigation techniques during preprocessing")
                recommendations.append("Monitor model fairness during training and deployment")
            
            return BiasAssessment(
                overall_bias_score=overall_bias_score,
                demographic_parity_score=demographic_parity_score,
                equalized_odds_score=equalized_odds_score,
                equal_opportunity_score=equal_opportunity_score,
                disparate_impact_ratio=disparate_impact_ratio,
                protected_attributes=protected_attributes,
                bias_findings=bias_findings,
                fairness_recommendations=recommendations
            )
        
        except Exception as e:
            logger.warning(f"Bias assessment failed: {str(e)}")
            return None
    
    async def _generate_recommendations(self, analysis_results: Dict[str, Any]) -> List[str]:
        """Generate actionable recommendations based on analysis results."""
        
        recommendations = []
        
        # Quality-based recommendations
        quality_metrics = analysis_results.get('quality_metrics', {})
        overall_score = quality_metrics.get('overall_score', 0)
        
        if overall_score < 70:
            recommendations.append("Consider data cleaning and preprocessing to improve overall quality")
        
        if quality_metrics.get('completeness_score', 100) < 80:
            recommendations.append("Address missing values through imputation or data collection")
        
        if quality_metrics.get('consistency_score', 100) < 80:
            recommendations.append("Standardize data formats and fix inconsistent values")
        
        if quality_metrics.get('uniqueness_score', 100) < 90:
            recommendations.append("Remove or investigate duplicate records")
        
        # Anomaly-based recommendations
        anomaly_results = analysis_results.get('anomaly_detection', {})
        if anomaly_results.get('severity') in ['high', 'critical']:
            recommendations.append("Review and address detected anomalies before using for training")
        
        # Column-specific recommendations
        column_profiles = analysis_results.get('column_profiles', [])
        high_missing_cols = [cp for cp in column_profiles if cp.get('null_percentage', 0) > 30]
        if high_missing_cols:
            col_names = [cp['name'] for cp in high_missing_cols]
            recommendations.append(f"Consider removing or imputing columns with high missing rates: {', '.join(col_names)}")
        
        # Distribution-based recommendations
        correlation_analysis = analysis_results.get('correlation_analysis', {})
        high_corrs = correlation_analysis.get('high_correlations', [])
        if high_corrs:
            recommendations.append("Consider feature selection to remove highly correlated variables")
        
        # Bias-related recommendations
        bias_assessment = analysis_results.get('bias_assessment', {})
        if bias_assessment and bias_assessment.get('overall_bias_score', 100) < 80:
            recommendations.extend(bias_assessment.get('fairness_recommendations', []))
        
        if not recommendations:
            recommendations.append("Dataset appears to be of good quality - ready for ML applications")
        
        return recommendations
    
    async def _calculate_final_metrics(self, analysis_results: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate final quality metrics and scores."""
        
        quality_metrics = analysis_results.get('quality_metrics', {})
        
        # Map quality level to enum value
        quality_level_mapping = {
            'excellent': 'excellent',
            'good': 'good', 
            'fair': 'fair',
            'poor': 'poor'
        }
        
        final_metrics = {
            'overall_quality_score': quality_metrics.get('overall_score', 0),
            'quality_level': quality_level_mapping.get(quality_metrics.get('quality_level', 'poor'), 'poor'),
            'completeness_score': quality_metrics.get('completeness_score', 0),
            'consistency_score': quality_metrics.get('consistency_score', 0),
            'validity_score': quality_metrics.get('validity_score', 0),
            'accuracy_score': quality_metrics.get('accuracy_score', 0),
            'anomalies_detected': analysis_results.get('anomaly_detection', {}).get('total_anomalies', 0),
            'anomaly_severity': analysis_results.get('anomaly_detection', {}).get('severity', 'low')
        }
        
        # Add bias metrics if available
        bias_assessment = analysis_results.get('bias_assessment', {})
        if bias_assessment:
            final_metrics.update({
                'bias_assessment_score': bias_assessment.get('overall_bias_score'),
                'demographic_parity_score': bias_assessment.get('demographic_parity_score'),
                'equalized_odds_score': bias_assessment.get('equalized_odds_score')
            })
        
        return final_metrics
    
    def _prepare_data_sample(self, data: pd.DataFrame) -> Tuple[pd.DataFrame, bool]:
        """Prepare data sample for analysis if dataset is too large."""
        
        if len(data) <= self.max_sample_size:
            return data, False
        
        if self.sample_strategy == 'random':
            sample = data.sample(n=self.max_sample_size, random_state=42)
        elif self.sample_strategy == 'stratified':
            # Try to maintain distribution if there's a clear categorical column
            sample = data.sample(n=self.max_sample_size, random_state=42)
        else:
            # Head sampling
            sample = data.head(self.max_sample_size)
        
        return sample, True
    
    async def _save_to_database(self, results: Dict[str, Any], dataset_id: str, version_id: str = None):
        """Save analysis results to database."""
        
        try:
            # This would integrate with your database session
            # For now, just log the save operation
            logger.info(f"Saving quality analysis results for dataset {dataset_id}")
            
            # In practice, you would:
            # 1. Create DataQualityReport instance
            # 2. Save to database
            # 3. Update dataset quality scores
            
        except Exception as e:
            logger.error(f"Failed to save quality analysis to database: {str(e)}")
    
    async def compare_dataset_quality(self, 
                                    dataset1: pd.DataFrame, 
                                    dataset2: pd.DataFrame) -> Dict[str, Any]:
        """Compare quality metrics between two datasets."""
        
        logger.info("Starting dataset quality comparison")
        
        # Analyze both datasets
        results1 = await self.analyze_dataset_quality(dataset1, save_to_db=False)
        results2 = await self.analyze_dataset_quality(dataset2, save_to_db=False)
        
        comparison = {
            'dataset1_metrics': results1.get('quality_metrics', {}),
            'dataset2_metrics': results2.get('quality_metrics', {}),
            'quality_differences': {},
            'recommendation': '',
            'better_dataset': None
        }
        
        # Compare quality dimensions
        metrics1 = results1.get('quality_metrics', {})
        metrics2 = results2.get('quality_metrics', {})
        
        quality_dimensions = [
            'overall_score', 'completeness_score', 'consistency_score',
            'validity_score', 'accuracy_score', 'uniqueness_score'
        ]
        
        for dimension in quality_dimensions:
            score1 = metrics1.get(dimension, 0)
            score2 = metrics2.get(dimension, 0)
            comparison['quality_differences'][dimension] = {
                'dataset1': score1,
                'dataset2': score2,
                'difference': score2 - score1,
                'percentage_change': ((score2 - score1) / max(score1, 1)) * 100
            }
        
        # Determine better dataset
        overall1 = metrics1.get('overall_score', 0)
        overall2 = metrics2.get('overall_score', 0)
        
        if overall2 > overall1 + 5:  # 5 point threshold
            comparison['better_dataset'] = 'dataset2'
            comparison['recommendation'] = f"Dataset 2 has significantly better quality (score: {overall2:.1f} vs {overall1:.1f})"
        elif overall1 > overall2 + 5:
            comparison['better_dataset'] = 'dataset1'
            comparison['recommendation'] = f"Dataset 1 has significantly better quality (score: {overall1:.1f} vs {overall2:.1f})"
        else:
            comparison['better_dataset'] = 'similar'
            comparison['recommendation'] = "Both datasets have similar quality levels"
        
        return comparison


# Utility functions for quality assessment
async def assess_dataset_quality_from_file(file_path: str, 
                                         file_format: str = None,
                                         config: Dict[str, Any] = None) -> Dict[str, Any]:
    """Assess data quality directly from a file."""
    
    analyzer = DatasetQualityAnalyzer(config)
    
    # Load data based on format
    if file_format == 'csv' or file_path.endswith('.csv'):
        data = pd.read_csv(file_path)
    elif file_format == 'json' or file_path.endswith('.json'):
        data = pd.read_json(file_path)
    elif file_format == 'parquet' or file_path.endswith('.parquet'):
        data = pd.read_parquet(file_path)
    elif file_format == 'xlsx' or file_path.endswith('.xlsx'):
        data = pd.read_excel(file_path)
    else:
        # Try to infer format
        if file_path.endswith('.csv'):
            data = pd.read_csv(file_path)
        elif file_path.endswith('.json'):
            data = pd.read_json(file_path)
        else:
            raise ValueError(f"Unsupported file format for {file_path}")
    
    return await analyzer.analyze_dataset_quality(data, save_to_db=False, config=config)


def create_quality_analyzer(config: Dict[str, Any] = None) -> DatasetQualityAnalyzer:
    """Factory function to create a quality analyzer."""
    return DatasetQualityAnalyzer(config)