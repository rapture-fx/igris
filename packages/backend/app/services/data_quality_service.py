"""
Data Quality Assessment Service
===============================

Comprehensive data quality assessment service for analyzing data integrity,
completeness, consistency, and accuracy across various data formats.

Features:
- Multi-dimensional quality assessment
- Statistical analysis and profiling
- Anomaly and outlier detection
- Data consistency checks
- Missing value analysis
- Data type validation
- Schema compliance checking
- Quality scoring and recommendations
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Union, Tuple, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from collections import Counter, defaultdict
import logging
import re
from scipy import stats
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)


@dataclass
class QualityMetric:
    """Individual quality metric result"""
    name: str
    value: float
    status: str  # 'good', 'warning', 'critical'
    description: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ColumnProfile:
    """Profile information for a single column"""
    column_name: str
    data_type: str
    null_count: int
    null_percentage: float
    unique_count: int
    unique_percentage: float
    most_frequent: Any = None
    least_frequent: Any = None
    
    # Numeric statistics
    mean: Optional[float] = None
    median: Optional[float] = None
    std_dev: Optional[float] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    quartiles: Optional[Dict[str, float]] = None
    
    # String statistics
    avg_length: Optional[float] = None
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    
    # Quality issues
    issues: List[str] = field(default_factory=list)
    outliers: List[Any] = field(default_factory=list)
    inconsistent_formats: List[str] = field(default_factory=list)


@dataclass
class DataIssue:
    """Represents a data quality issue"""
    issue_type: str
    severity: str  # 'low', 'medium', 'high', 'critical'
    column: Optional[str] = None
    row_indices: Optional[List[int]] = None
    description: str = ""
    affected_count: int = 0
    recommendation: str = ""


@dataclass
class QualityReport:
    """Complete data quality assessment report"""
    overall_score: float
    total_rows: int
    total_columns: int
    assessment_date: datetime
    
    # Quality dimensions
    completeness_score: float
    validity_score: float
    consistency_score: float
    accuracy_score: float
    uniqueness_score: float
    
    # Detailed metrics
    quality_metrics: List[QualityMetric] = field(default_factory=list)
    column_profiles: List[ColumnProfile] = field(default_factory=list)
    data_issues: List[DataIssue] = field(default_factory=list)
    
    # Recommendations
    recommendations: List[str] = field(default_factory=list)
    
    # Processing metadata
    processing_time: float = 0.0
    data_sample_size: int = 0


class DataQualityAssessor:
    """
    Comprehensive data quality assessment service
    """
    
    def __init__(self,
                 sample_size: int = 100000,
                 outlier_method: str = 'iqr',
                 outlier_threshold: float = 1.5):
        """
        Initialize data quality assessor
        
        Args:
            sample_size: Maximum number of rows to analyze for large datasets
            outlier_method: Method for outlier detection ('iqr', 'zscore', 'isolation')
            outlier_threshold: Threshold for outlier detection
        """
        self.sample_size = sample_size
        self.outlier_method = outlier_method
        self.outlier_threshold = outlier_threshold
        
        # Quality thresholds
        self.quality_thresholds = {
            'excellent': 0.95,
            'good': 0.85,
            'fair': 0.70,
            'poor': 0.50
        }
        
        # Issue severity mappings
        self.severity_weights = {
            'low': 0.1,
            'medium': 0.3,
            'high': 0.6,
            'critical': 1.0
        }
    
    async def assess_data_quality(self, 
                                data: Union[pd.DataFrame, str, Dict[str, Any]],
                                schema: Optional[Dict[str, Any]] = None,
                                custom_rules: Optional[List[Callable]] = None) -> QualityReport:
        """
        Perform comprehensive data quality assessment
        
        Args:
            data: Data to assess (DataFrame, file path, or dict)
            schema: Expected schema for validation
            custom_rules: List of custom validation functions
            
        Returns:
            QualityReport with detailed assessment results
        """
        start_time = datetime.utcnow()
        
        try:
            # Load and prepare data
            df = self._prepare_data(data)
            
            # Sample data if too large
            original_size = len(df)
            if len(df) > self.sample_size:
                df = df.sample(n=self.sample_size, random_state=42)
                logger.info(f"Sampling {self.sample_size} rows from {original_size} total rows")
            
            # Initialize report
            report = QualityReport(
                overall_score=0.0,
                total_rows=original_size,
                total_columns=len(df.columns),
                assessment_date=start_time,
                completeness_score=0.0,
                validity_score=0.0,
                consistency_score=0.0,
                accuracy_score=0.0,
                uniqueness_score=0.0,
                data_sample_size=len(df)
            )
            
            # Perform quality assessments
            await self._assess_completeness(df, report)
            await self._assess_validity(df, report, schema)
            await self._assess_consistency(df, report)
            await self._assess_accuracy(df, report)
            await self._assess_uniqueness(df, report)
            await self._profile_columns(df, report)
            
            # Apply custom rules if provided
            if custom_rules:
                await self._apply_custom_rules(df, report, custom_rules)
            
            # Calculate overall score
            self._calculate_overall_score(report)
            
            # Generate recommendations
            self._generate_recommendations(report)
            
            # Calculate processing time
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            report.processing_time = processing_time
            
            logger.info(f"Data quality assessment completed: {report.overall_score:.2f} score ({processing_time:.2f}s)")
            return report
            
        except Exception as e:
            logger.error(f"Data quality assessment failed: {str(e)}")
            raise
    
    def _prepare_data(self, data: Union[pd.DataFrame, str, Dict[str, Any]]) -> pd.DataFrame:
        """Prepare data for assessment"""
        if isinstance(data, pd.DataFrame):
            return data.copy()
        elif isinstance(data, str):
            # Assume file path
            if data.endswith('.csv'):
                return pd.read_csv(data)
            elif data.endswith('.json'):
                return pd.read_json(data)
            elif data.endswith('.xlsx'):
                return pd.read_excel(data)
            else:
                raise ValueError(f"Unsupported file format: {data}")
        elif isinstance(data, dict):
            return pd.DataFrame(data)
        else:
            raise ValueError(f"Unsupported data type: {type(data)}")
    
    async def _assess_completeness(self, df: pd.DataFrame, report: QualityReport):
        """Assess data completeness"""
        total_cells = df.size
        missing_cells = df.isnull().sum().sum()
        missing_percentage = (missing_cells / total_cells) * 100
        
        # Calculate completeness score
        completeness_score = max(0.0, 1.0 - (missing_cells / total_cells))
        report.completeness_score = completeness_score
        
        # Add completeness metric
        status = self._get_quality_status(completeness_score)
        report.quality_metrics.append(QualityMetric(
            name="Data Completeness",
            value=completeness_score,
            status=status,
            description=f"Percentage of non-missing values: {(completeness_score * 100):.1f}%",
            details={
                "total_cells": total_cells,
                "missing_cells": missing_cells,
                "missing_percentage": missing_percentage
            }
        ))
        
        # Identify columns with high missing percentages
        missing_by_column = df.isnull().sum() / len(df)
        for column, missing_pct in missing_by_column.items():
            if missing_pct > 0.5:  # More than 50% missing
                report.data_issues.append(DataIssue(
                    issue_type="high_missing_values",
                    severity="critical",
                    column=column,
                    description=f"Column '{column}' has {missing_pct*100:.1f}% missing values",
                    affected_count=int(missing_pct * len(df)),
                    recommendation=f"Consider dropping column '{column}' or implementing imputation strategy"
                ))
            elif missing_pct > 0.2:  # More than 20% missing
                report.data_issues.append(DataIssue(
                    issue_type="moderate_missing_values",
                    severity="medium",
                    column=column,
                    description=f"Column '{column}' has {missing_pct*100:.1f}% missing values",
                    affected_count=int(missing_pct * len(df)),
                    recommendation=f"Consider imputation strategies for column '{column}'"
                ))
    
    async def _assess_validity(self, df: pd.DataFrame, report: QualityReport, schema: Optional[Dict[str, Any]] = None):
        """Assess data validity"""
        validity_issues = 0
        total_values = 0
        
        for column in df.columns:
            col_data = df[column].dropna()
            if len(col_data) == 0:
                continue
                
            total_values += len(col_data)
            
            # Data type consistency check
            inferred_type = col_data.dtype
            inconsistent_types = self._check_type_consistency(col_data)
            validity_issues += len(inconsistent_types)
            
            if inconsistent_types:
                report.data_issues.append(DataIssue(
                    issue_type="inconsistent_data_types",
                    severity="high",
                    column=column,
                    description=f"Column '{column}' contains values inconsistent with inferred type {inferred_type}",
                    affected_count=len(inconsistent_types),
                    recommendation=f"Standardize data types in column '{column}'"
                ))
            
            # Format validation for common patterns
            if col_data.dtype == 'object':
                format_issues = self._check_format_consistency(col_data, column)
                validity_issues += len(format_issues)
                
                if format_issues:
                    report.data_issues.append(DataIssue(
                        issue_type="inconsistent_formats",
                        severity="medium",
                        column=column,
                        description=f"Column '{column}' contains inconsistent formats",
                        affected_count=len(format_issues),
                        recommendation=f"Standardize format patterns in column '{column}'"
                    ))
        
        # Calculate validity score
        validity_score = max(0.0, 1.0 - (validity_issues / max(total_values, 1)))
        report.validity_score = validity_score
        
        status = self._get_quality_status(validity_score)
        report.quality_metrics.append(QualityMetric(
            name="Data Validity",
            value=validity_score,
            status=status,
            description=f"Percentage of valid values: {(validity_score * 100):.1f}%",
            details={
                "validity_issues": validity_issues,
                "total_values": total_values
            }
        ))
    
    async def _assess_consistency(self, df: pd.DataFrame, report: QualityReport):
        """Assess data consistency"""
        consistency_issues = 0
        total_checks = 0
        
        # Check for duplicate rows
        duplicate_rows = df.duplicated().sum()
        total_checks += len(df)
        if duplicate_rows > 0:
            consistency_issues += duplicate_rows
            report.data_issues.append(DataIssue(
                issue_type="duplicate_rows",
                severity="medium",
                description=f"Found {duplicate_rows} duplicate rows",
                affected_count=duplicate_rows,
                recommendation="Remove or investigate duplicate rows"
            ))
        
        # Check for inconsistent categorical values
        for column in df.select_dtypes(include=['object']).columns:
            col_data = df[column].dropna()
            if len(col_data) == 0:
                continue
                
            # Check for case inconsistencies
            if col_data.dtype == 'object':
                case_issues = self._check_case_consistency(col_data)
                if case_issues > 0:
                    consistency_issues += case_issues
                    report.data_issues.append(DataIssue(
                        issue_type="inconsistent_case",
                        severity="low",
                        column=column,
                        description=f"Column '{column}' has inconsistent case formatting",
                        affected_count=case_issues,
                        recommendation=f"Standardize case formatting in column '{column}'"
                    ))
                
                # Check for whitespace inconsistencies
                whitespace_issues = self._check_whitespace_consistency(col_data)
                if whitespace_issues > 0:
                    consistency_issues += whitespace_issues
                    report.data_issues.append(DataIssue(
                        issue_type="inconsistent_whitespace",
                        severity="low",
                        column=column,
                        description=f"Column '{column}' has inconsistent whitespace",
                        affected_count=whitespace_issues,
                        recommendation=f"Trim and standardize whitespace in column '{column}'"
                    ))
        
        # Calculate consistency score
        consistency_score = max(0.0, 1.0 - (consistency_issues / max(total_checks, 1)))
        report.consistency_score = consistency_score
        
        status = self._get_quality_status(consistency_score)
        report.quality_metrics.append(QualityMetric(
            name="Data Consistency",
            value=consistency_score,
            status=status,
            description=f"Consistency score: {(consistency_score * 100):.1f}%",
            details={
                "consistency_issues": consistency_issues,
                "total_checks": total_checks,
                "duplicate_rows": duplicate_rows
            }
        ))
    
    async def _assess_accuracy(self, df: pd.DataFrame, report: QualityReport):
        """Assess data accuracy through statistical analysis"""
        accuracy_issues = 0
        total_values = 0
        
        # Outlier detection for numeric columns
        for column in df.select_dtypes(include=[np.number]).columns:
            col_data = df[column].dropna()
            if len(col_data) < 10:  # Need sufficient data for outlier detection
                continue
                
            total_values += len(col_data)
            outliers = self._detect_outliers(col_data)
            
            if len(outliers) > 0:
                outlier_percentage = len(outliers) / len(col_data)
                accuracy_issues += len(outliers)
                
                severity = "critical" if outlier_percentage > 0.1 else "medium" if outlier_percentage > 0.05 else "low"
                
                report.data_issues.append(DataIssue(
                    issue_type="outliers",
                    severity=severity,
                    column=column,
                    row_indices=outliers.tolist(),
                    description=f"Column '{column}' contains {len(outliers)} potential outliers ({outlier_percentage*100:.1f}%)",
                    affected_count=len(outliers),
                    recommendation=f"Investigate outliers in column '{column}' - they may indicate data entry errors"
                ))
        
        # Range validation for numeric columns
        for column in df.select_dtypes(include=[np.number]).columns:
            col_data = df[column].dropna()
            if len(col_data) == 0:
                continue
                
            # Check for impossible values (e.g., negative ages, percentages > 100)
            range_issues = self._validate_ranges(col_data, column)
            if range_issues > 0:
                accuracy_issues += range_issues
                report.data_issues.append(DataIssue(
                    issue_type="invalid_ranges",
                    severity="high",
                    column=column,
                    description=f"Column '{column}' contains {range_issues} values outside expected ranges",
                    affected_count=range_issues,
                    recommendation=f"Validate and correct range violations in column '{column}'"
                ))
        
        # Calculate accuracy score
        accuracy_score = max(0.0, 1.0 - (accuracy_issues / max(total_values, 1)))
        report.accuracy_score = accuracy_score
        
        status = self._get_quality_status(accuracy_score)
        report.quality_metrics.append(QualityMetric(
            name="Data Accuracy",
            value=accuracy_score,
            status=status,
            description=f"Estimated accuracy: {(accuracy_score * 100):.1f}%",
            details={
                "accuracy_issues": accuracy_issues,
                "total_values": total_values
            }
        ))
    
    async def _assess_uniqueness(self, df: pd.DataFrame, report: QualityReport):
        """Assess data uniqueness"""
        uniqueness_issues = 0
        total_checks = 0
        
        # Check for unexpected duplicates in columns that should be unique
        for column in df.columns:
            col_data = df[column].dropna()
            if len(col_data) == 0:
                continue
            
            total_checks += len(col_data)
            duplicate_count = len(col_data) - col_data.nunique()
            
            # Heuristic: if column has many duplicates and isn't clearly categorical
            if duplicate_count > 0:
                duplicate_percentage = duplicate_count / len(col_data)
                
                # Consider it an issue if > 80% duplicates (might indicate a constant column)
                if duplicate_percentage > 0.8:
                    uniqueness_issues += duplicate_count
                    report.data_issues.append(DataIssue(
                        issue_type="low_uniqueness",
                        severity="medium",
                        column=column,
                        description=f"Column '{column}' has very low uniqueness ({(1-duplicate_percentage)*100:.1f}% unique)",
                        affected_count=duplicate_count,
                        recommendation=f"Consider if column '{column}' adds value or should be dropped"
                    ))
        
        # Calculate uniqueness score
        uniqueness_score = max(0.0, 1.0 - (uniqueness_issues / max(total_checks, 1)))
        report.uniqueness_score = uniqueness_score
        
        status = self._get_quality_status(uniqueness_score)
        report.quality_metrics.append(QualityMetric(
            name="Data Uniqueness",
            value=uniqueness_score,
            status=status,
            description=f"Uniqueness score: {(uniqueness_score * 100):.1f}%",
            details={
                "uniqueness_issues": uniqueness_issues,
                "total_checks": total_checks
            }
        ))
    
    async def _profile_columns(self, df: pd.DataFrame, report: QualityReport):
        """Create detailed profiles for each column"""
        for column in df.columns:
            col_data = df[column]
            profile = ColumnProfile(
                column_name=column,
                data_type=str(col_data.dtype),
                null_count=col_data.isnull().sum(),
                null_percentage=(col_data.isnull().sum() / len(col_data)) * 100,
                unique_count=col_data.nunique(),
                unique_percentage=(col_data.nunique() / len(col_data)) * 100 if len(col_data) > 0 else 0
            )
            
            # Get most/least frequent values
            if not col_data.empty:
                value_counts = col_data.value_counts()
                if not value_counts.empty:
                    profile.most_frequent = value_counts.index[0]
                    profile.least_frequent = value_counts.index[-1] if len(value_counts) > 1 else value_counts.index[0]
            
            # Numeric statistics
            if pd.api.types.is_numeric_dtype(col_data):
                numeric_data = col_data.dropna()
                if not numeric_data.empty:
                    profile.mean = float(numeric_data.mean())
                    profile.median = float(numeric_data.median())
                    profile.std_dev = float(numeric_data.std())
                    profile.min_value = float(numeric_data.min())
                    profile.max_value = float(numeric_data.max())
                    
                    quartiles = numeric_data.quantile([0.25, 0.5, 0.75])
                    profile.quartiles = {
                        "q1": float(quartiles.iloc[0]),
                        "q2": float(quartiles.iloc[1]),
                        "q3": float(quartiles.iloc[2])
                    }
                    
                    # Detect outliers for this column
                    outliers = self._detect_outliers(numeric_data)
                    if len(outliers) > 0:
                        profile.outliers = numeric_data.iloc[outliers].tolist()[:10]  # Limit to first 10
                        profile.issues.append(f"{len(outliers)} potential outliers detected")
            
            # String statistics
            if col_data.dtype == 'object':
                string_data = col_data.dropna().astype(str)
                if not string_data.empty:
                    lengths = string_data.str.len()
                    profile.avg_length = float(lengths.mean())
                    profile.min_length = int(lengths.min())
                    profile.max_length = int(lengths.max())
                    
                    # Check for format inconsistencies
                    format_issues = self._check_format_consistency(string_data, column)
                    if format_issues:
                        profile.inconsistent_formats = format_issues[:10]  # Limit to first 10
                        profile.issues.append(f"{len(format_issues)} format inconsistencies")
            
            report.column_profiles.append(profile)
    
    async def _apply_custom_rules(self, df: pd.DataFrame, report: QualityReport, custom_rules: List[Callable]):
        """Apply custom validation rules"""
        for rule in custom_rules:
            try:
                issues = await asyncio.get_event_loop().run_in_executor(None, rule, df)
                if issues:
                    report.data_issues.extend(issues)
            except Exception as e:
                logger.warning(f"Custom rule failed: {str(e)}")
    
    def _calculate_overall_score(self, report: QualityReport):
        """Calculate overall quality score"""
        # Weighted average of dimension scores
        weights = {
            'completeness': 0.25,
            'validity': 0.25,
            'consistency': 0.20,
            'accuracy': 0.20,
            'uniqueness': 0.10
        }
        
        overall_score = (
            report.completeness_score * weights['completeness'] +
            report.validity_score * weights['validity'] +
            report.consistency_score * weights['consistency'] +
            report.accuracy_score * weights['accuracy'] +
            report.uniqueness_score * weights['uniqueness']
        )
        
        # Penalize based on critical issues
        critical_issues = sum(1 for issue in report.data_issues if issue.severity == 'critical')
        penalty = min(0.3, critical_issues * 0.1)  # Max 30% penalty
        
        report.overall_score = max(0.0, overall_score - penalty)
    
    def _generate_recommendations(self, report: QualityReport):
        """Generate actionable recommendations"""
        recommendations = []
        
        # Overall quality recommendations
        if report.overall_score < 0.5:
            recommendations.append("⚠️ Data quality is critically low - extensive cleanup required before analysis")
        elif report.overall_score < 0.7:
            recommendations.append("⚠️ Data quality is below acceptable levels - recommend addressing major issues")
        elif report.overall_score < 0.85:
            recommendations.append("✓ Data quality is fair - minor improvements would enhance reliability")
        else:
            recommendations.append("✅ Data quality is good - suitable for analysis with minimal preprocessing")
        
        # Dimension-specific recommendations
        if report.completeness_score < 0.8:
            recommendations.append("🔍 Address missing values through imputation or collection of additional data")
        
        if report.validity_score < 0.8:
            recommendations.append("🔧 Implement data validation rules to prevent invalid data entry")
        
        if report.consistency_score < 0.8:
            recommendations.append("📝 Standardize data formats and establish consistent naming conventions")
        
        if report.accuracy_score < 0.8:
            recommendations.append("🎯 Investigate and correct potential outliers and range violations")
        
        # Issue-specific recommendations
        critical_issues = [issue for issue in report.data_issues if issue.severity == 'critical']
        if critical_issues:
            recommendations.append(f"🚨 Immediately address {len(critical_issues)} critical data quality issues")
        
        high_issues = [issue for issue in report.data_issues if issue.severity == 'high']
        if high_issues:
            recommendations.append(f"⚡ Prioritize resolution of {len(high_issues)} high-severity issues")
        
        # Column-specific recommendations
        high_missing_columns = [p for p in report.column_profiles if p.null_percentage > 50]
        if high_missing_columns:
            col_names = [p.column_name for p in high_missing_columns[:3]]
            recommendations.append(f"🗑️ Consider dropping columns with >50% missing data: {', '.join(col_names)}")
        
        # Low uniqueness columns
        low_unique_columns = [p for p in report.column_profiles if p.unique_percentage < 5 and p.unique_count > 1]
        if low_unique_columns:
            col_names = [p.column_name for p in low_unique_columns[:3]]
            recommendations.append(f"🔄 Review low-uniqueness columns for potential categorization: {', '.join(col_names)}")
        
        report.recommendations = recommendations
    
    def _get_quality_status(self, score: float) -> str:
        """Get quality status from score"""
        if score >= self.quality_thresholds['excellent']:
            return 'good'
        elif score >= self.quality_thresholds['good']:
            return 'good'
        elif score >= self.quality_thresholds['fair']:
            return 'warning'
        else:
            return 'critical'
    
    def _check_type_consistency(self, series: pd.Series) -> List[int]:
        """Check for data type inconsistencies"""
        inconsistent_indices = []
        
        if series.dtype == 'object':
            # Check if numeric columns are stored as strings
            numeric_pattern = re.compile(r'^-?\d+\.?\d*$')
            for idx, value in series.items():
                if pd.isna(value):
                    continue
                if isinstance(value, str) and not numeric_pattern.match(value.strip()):
                    # Check if it looks like it should be numeric but isn't
                    if any(char.isdigit() for char in value):
                        inconsistent_indices.append(idx)
        
        return inconsistent_indices
    
    def _check_format_consistency(self, series: pd.Series, column_name: str) -> List[str]:
        """Check for format inconsistencies in string data"""
        inconsistencies = []
        
        # Common format patterns
        patterns = {
            'email': r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
            'phone': r'^[\+]?[1-9]?[\d\s\-\(\)]{7,15}$',
            'date': r'^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$|^\d{4}[/-]\d{1,2}[/-]\d{1,2}$',
            'url': r'^https?:\/\/.*$'
        }
        
        # Detect likely format based on column name or sample values
        likely_format = None
        col_lower = column_name.lower()
        
        if 'email' in col_lower:
            likely_format = 'email'
        elif 'phone' in col_lower or 'tel' in col_lower:
            likely_format = 'phone'
        elif 'date' in col_lower or 'time' in col_lower:
            likely_format = 'date'
        elif 'url' in col_lower or 'link' in col_lower:
            likely_format = 'url'
        
        if likely_format and likely_format in patterns:
            pattern = patterns[likely_format]
            for value in series.sample(min(100, len(series))):  # Sample for efficiency
                if pd.isna(value):
                    continue
                if not re.match(pattern, str(value)):
                    inconsistencies.append(str(value)[:50])  # Truncate long values
        
        return inconsistencies
    
    def _check_case_consistency(self, series: pd.Series) -> int:
        """Check for case inconsistencies"""
        if series.empty:
            return 0
        
        string_values = series.astype(str)
        unique_lower = string_values.str.lower().unique()
        unique_original = string_values.unique()
        
        # If lowercased version has fewer unique values, there are case inconsistencies
        return len(unique_original) - len(unique_lower)
    
    def _check_whitespace_consistency(self, series: pd.Series) -> int:
        """Check for whitespace inconsistencies"""
        if series.empty:
            return 0
        
        string_values = series.astype(str)
        trimmed_values = string_values.str.strip()
        
        # Count values that have leading/trailing whitespace
        whitespace_issues = (string_values != trimmed_values).sum()
        return whitespace_issues
    
    def _detect_outliers(self, series: pd.Series) -> np.ndarray:
        """Detect outliers using specified method"""
        if len(series) < 4:
            return np.array([])
        
        if self.outlier_method == 'iqr':
            Q1 = series.quantile(0.25)
            Q3 = series.quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - self.outlier_threshold * IQR
            upper_bound = Q3 + self.outlier_threshold * IQR
            outliers = series[(series < lower_bound) | (series > upper_bound)]
            return outliers.index.values
        
        elif self.outlier_method == 'zscore':
            z_scores = np.abs(stats.zscore(series))
            outliers = series[z_scores > self.outlier_threshold]
            return outliers.index.values
        
        elif self.outlier_method == 'isolation':
            try:
                from sklearn.ensemble import IsolationForest
                iso_forest = IsolationForest(contamination=0.1, random_state=42)
                outlier_labels = iso_forest.fit_predict(series.values.reshape(-1, 1))
                outlier_indices = np.where(outlier_labels == -1)[0]
                return series.iloc[outlier_indices].index.values
            except ImportError:
                logger.warning("scikit-learn not available, falling back to IQR method")
                return self._detect_outliers_iqr(series)
        
        return np.array([])
    
    def _validate_ranges(self, series: pd.Series, column_name: str) -> int:
        """Validate ranges for common column types"""
        col_lower = column_name.lower()
        violations = 0
        
        # Age validation
        if 'age' in col_lower:
            violations += ((series < 0) | (series > 150)).sum()
        
        # Percentage validation
        elif 'percent' in col_lower or 'pct' in col_lower or '%' in column_name:
            violations += ((series < 0) | (series > 100)).sum()
        
        # Score validation (assuming 0-100 or 0-1)
        elif 'score' in col_lower:
            if series.max() <= 1.0:  # 0-1 scale
                violations += ((series < 0) | (series > 1)).sum()
            else:  # 0-100 scale
                violations += ((series < 0) | (series > 100)).sum()
        
        # Rating validation (assuming 1-5 or 1-10)
        elif 'rating' in col_lower:
            max_rating = series.max()
            if max_rating <= 5:
                violations += ((series < 1) | (series > 5)).sum()
            elif max_rating <= 10:
                violations += ((series < 1) | (series > 10)).sum()
        
        return violations


# Global data quality assessor instance
data_quality_assessor = DataQualityAssessor()


# Utility functions
async def assess_dataframe_quality(df: pd.DataFrame,
                                 schema: Optional[Dict[str, Any]] = None) -> QualityReport:
    """
    Utility function to assess quality of a pandas DataFrame
    """
    return await data_quality_assessor.assess_data_quality(df, schema)


async def quick_quality_check(data: Union[pd.DataFrame, str]) -> Dict[str, Any]:
    """
    Perform a quick quality check and return summary metrics
    """
    report = await data_quality_assessor.assess_data_quality(data)
    
    return {
        "overall_score": report.overall_score,
        "quality_level": "excellent" if report.overall_score >= 0.95 else
                        "good" if report.overall_score >= 0.85 else
                        "fair" if report.overall_score >= 0.70 else "poor",
        "total_issues": len(report.data_issues),
        "critical_issues": len([i for i in report.data_issues if i.severity == "critical"]),
        "completeness": report.completeness_score,
        "validity": report.validity_score,
        "consistency": report.consistency_score,
        "top_recommendations": report.recommendations[:3]
    }


def create_quality_rule(name: str, 
                       validation_func: Callable[[pd.DataFrame], bool],
                       severity: str = "medium",
                       description: str = "") -> Callable:
    """
    Create a custom quality validation rule
    
    Args:
        name: Rule name
        validation_func: Function that takes DataFrame and returns boolean
        severity: Issue severity level
        description: Rule description
        
    Returns:
        Validation rule function
    """
    def rule(df: pd.DataFrame) -> List[DataIssue]:
        issues = []
        try:
            if not validation_func(df):
                issues.append(DataIssue(
                    issue_type="custom_rule_violation",
                    severity=severity,
                    description=description or f"Custom rule '{name}' failed",
                    affected_count=1,
                    recommendation=f"Address custom rule violation: {name}"
                ))
        except Exception as e:
            logger.warning(f"Custom rule '{name}' failed to execute: {str(e)}")
        
        return issues
    
    return rule