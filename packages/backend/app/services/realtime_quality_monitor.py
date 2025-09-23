"""
Realtime Quality Monitor - Enhanced for Training Data Quality
============================================================

Enhanced quality monitoring service for batch datasets and training data quality assessment.
Processes batch datasets (not live streams) with comprehensive quality metrics.

Key Features:
- Process batch datasets for training data quality assessment
- Missing values ratio analysis
- Class imbalance detection for ML workflows
- Simple bias/drift check for data quality
- Output: JSON + optional PDF report generation
- Endpoint to trigger quality monitoring + fetch reports
- Integration with existing data quality service
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional, Union, Tuple
from dataclasses import dataclass, field
from enum import Enum
import pandas as pd
import numpy as np
from collections import Counter, defaultdict
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats
import warnings
warnings.filterwarnings('ignore')

# PDF generation
try:
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    import matplotlib
    matplotlib.use('Agg')  # Use non-GUI backend
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False
    logger.warning("PDF generation libraries not available. PDF reports will be disabled.")

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_
from app.database.connection import get_async_session
from app.database.models import ProcessingJob, JobStatus, DatasetQualityReport, Dataset
from app.services.data_quality_service import DataQualityService

logger = logging.getLogger(__name__)

class QualityCheckType(str, Enum):
    """Types of quality checks to perform"""
    MISSING_VALUES = "missing_values"
    CLASS_IMBALANCE = "class_imbalance"
    BIAS_DRIFT = "bias_drift"
    DATA_TYPES = "data_types"
    OUTLIERS = "outliers"
    DUPLICATES = "duplicates"
    COMPLETENESS = "completeness"

class ReportFormat(str, Enum):
    """Output report formats"""
    JSON = "json"
    PDF = "pdf"
    BOTH = "both"

@dataclass
class QualityConfig:
    """Configuration for quality monitoring"""
    # Quality checks to perform
    checks_to_run: List[QualityCheckType] = field(default_factory=lambda: [
        QualityCheckType.MISSING_VALUES,
        QualityCheckType.CLASS_IMBALANCE,
        QualityCheckType.BIAS_DRIFT,
        QualityCheckType.COMPLETENESS
    ])

    # Missing values analysis
    missing_threshold_warning: float = 10.0  # Percentage
    missing_threshold_critical: float = 30.0  # Percentage

    # Class imbalance detection
    target_column: Optional[str] = None
    imbalance_ratio_threshold: float = 0.1  # Minority class ratio
    min_class_samples: int = 100

    # Bias/drift detection
    reference_dataset_path: Optional[str] = None
    drift_threshold: float = 0.1  # Statistical test p-value
    categorical_drift_method: str = "chi2"  # chi2, psi
    numerical_drift_method: str = "ks"  # ks, wasserstein

    # Report generation
    report_format: ReportFormat = ReportFormat.JSON
    include_visualizations: bool = True
    max_categories_plot: int = 20

    # Performance
    sample_size_for_analysis: Optional[int] = None  # Sample large datasets

@dataclass
class QualityMetrics:
    """Quality metrics for training data"""
    # Missing values
    missing_values_ratio: float
    missing_values_by_column: Dict[str, float]
    missing_values_severity: str  # "good", "warning", "critical"

    # Class imbalance
    class_distribution: Optional[Dict[str, int]] = None
    class_imbalance_ratio: Optional[float] = None
    imbalance_severity: Optional[str] = None

    # Bias/drift
    drift_detected: bool = False
    drift_columns: List[str] = field(default_factory=list)
    drift_scores: Dict[str, float] = field(default_factory=dict)

    # Overall quality
    overall_quality_score: float = 0.0
    quality_grade: str = "F"
    recommendations: List[str] = field(default_factory=list)

@dataclass
class QualityReport:
    """Complete quality monitoring report"""
    report_id: str
    dataset_path: str
    analysis_timestamp: datetime

    # Dataset info
    total_rows: int
    total_columns: int
    dataset_size_mb: float

    # Quality metrics
    metrics: QualityMetrics

    # Detailed analysis
    column_profiles: Dict[str, Any] = field(default_factory=dict)
    outlier_analysis: Dict[str, Any] = field(default_factory=dict)
    duplicate_analysis: Dict[str, Any] = field(default_factory=dict)

    # Report files
    json_report_path: Optional[str] = None
    pdf_report_path: Optional[str] = None

    # Processing info
    processing_time_seconds: float = 0.0
    config_used: Optional[QualityConfig] = None

class RealtimeQualityMonitor:
    """
    Enhanced quality monitor for training data assessment.

    Provides comprehensive quality analysis for batch datasets with focus on
    training data preparation and ML workflow requirements.
    """

    def __init__(self):
        self.data_quality_service = DataQualityService()
        self.reports_dir = Path("data/quality_reports")
        self.reports_dir.mkdir(parents=True, exist_ok=True)

        # Set up matplotlib for non-interactive use
        if PDF_AVAILABLE:
            plt.ioff()  # Turn off interactive mode

    async def monitor_training_data_quality(
        self,
        dataset_path: str,
        config: QualityConfig,
        job_id: Optional[str] = None,
        dataset_id: Optional[uuid.UUID] = None
    ) -> str:
        """
        Monitor training data quality with comprehensive analysis.

        Args:
            dataset_path: Path to dataset file
            config: Quality monitoring configuration
            job_id: Optional job ID for tracking
            dataset_id: Optional dataset ID for database linking

        Returns:
            Job ID for tracking progress
        """
        if job_id is None:
            job_id = str(uuid.uuid4())

        # Validate dataset file
        if not Path(dataset_path).exists():
            raise FileNotFoundError(f"Dataset file not found: {dataset_path}")

        # Create job record
        await self._create_quality_job(job_id, dataset_path, config, dataset_id)

        # Start background monitoring
        asyncio.create_task(self._monitor_quality_background(
            job_id, dataset_path, config, dataset_id
        ))

        return job_id

    async def _monitor_quality_background(
        self,
        job_id: str,
        dataset_path: str,
        config: QualityConfig,
        dataset_id: Optional[uuid.UUID]
    ):
        """Background task for quality monitoring"""
        start_time = datetime.utcnow()

        try:
            await self._update_job_status(job_id, "processing", "Loading dataset")

            # Load dataset
            df = await self._load_dataset(dataset_path, config.sample_size_for_analysis)
            logger.info(f"Loaded dataset with {len(df)} rows and {len(df.columns)} columns")

            # Perform quality analysis
            await self._update_job_status(job_id, "processing", "Analyzing data quality")
            quality_metrics = await self._analyze_training_data_quality(df, config)

            # Generate detailed column profiles
            await self._update_job_status(job_id, "processing", "Profiling columns")
            column_profiles = await self._profile_columns(df)

            # Additional analysis
            outlier_analysis = await self._analyze_outliers(df) if QualityCheckType.OUTLIERS in config.checks_to_run else {}
            duplicate_analysis = await self._analyze_duplicates(df) if QualityCheckType.DUPLICATES in config.checks_to_run else {}

            # Create quality report
            report = QualityReport(
                report_id=job_id,
                dataset_path=dataset_path,
                analysis_timestamp=datetime.utcnow(),
                total_rows=len(df),
                total_columns=len(df.columns),
                dataset_size_mb=Path(dataset_path).stat().st_size / (1024 * 1024),
                metrics=quality_metrics,
                column_profiles=column_profiles,
                outlier_analysis=outlier_analysis,
                duplicate_analysis=duplicate_analysis,
                processing_time_seconds=(datetime.utcnow() - start_time).total_seconds(),
                config_used=config
            )

            # Generate reports
            await self._update_job_status(job_id, "processing", "Generating reports")
            await self._generate_reports(report, config)

            # Store quality report in database
            if dataset_id:
                await self._store_quality_report(report, dataset_id)

            await self._complete_quality_job(job_id, report)

        except Exception as e:
            logger.error(f"Quality monitoring failed for job {job_id}: {e}")
            await self._fail_quality_job(job_id, str(e))

    async def _analyze_training_data_quality(
        self,
        df: pd.DataFrame,
        config: QualityConfig
    ) -> QualityMetrics:
        """Comprehensive training data quality analysis"""
        metrics = QualityMetrics(
            missing_values_ratio=0.0,
            missing_values_by_column={}
        )

        # Missing values analysis
        if QualityCheckType.MISSING_VALUES in config.checks_to_run:
            await self._analyze_missing_values(df, metrics, config)

        # Class imbalance analysis
        if QualityCheckType.CLASS_IMBALANCE in config.checks_to_run and config.target_column:
            await self._analyze_class_imbalance(df, metrics, config)

        # Bias/drift analysis
        if QualityCheckType.BIAS_DRIFT in config.checks_to_run and config.reference_dataset_path:
            await self._analyze_bias_drift(df, metrics, config)

        # Calculate overall quality score
        metrics.overall_quality_score = await self._calculate_overall_quality_score(metrics)
        metrics.quality_grade = await self._assign_quality_grade(metrics.overall_quality_score)
        metrics.recommendations = await self._generate_recommendations(metrics, config)

        return metrics

    async def _analyze_missing_values(
        self,
        df: pd.DataFrame,
        metrics: QualityMetrics,
        config: QualityConfig
    ):
        """Analyze missing values in the dataset"""
        total_cells = len(df) * len(df.columns)
        total_missing = df.isnull().sum().sum()

        metrics.missing_values_ratio = (total_missing / total_cells) * 100

        # Missing values by column
        for column in df.columns:
            missing_count = df[column].isnull().sum()
            missing_percentage = (missing_count / len(df)) * 100
            metrics.missing_values_by_column[column] = missing_percentage

        # Determine severity
        if metrics.missing_values_ratio <= config.missing_threshold_warning:
            metrics.missing_values_severity = "good"
        elif metrics.missing_values_ratio <= config.missing_threshold_critical:
            metrics.missing_values_severity = "warning"
        else:
            metrics.missing_values_severity = "critical"

    async def _analyze_class_imbalance(
        self,
        df: pd.DataFrame,
        metrics: QualityMetrics,
        config: QualityConfig
    ):
        """Analyze class imbalance for classification tasks"""
        if config.target_column not in df.columns:
            logger.warning(f"Target column {config.target_column} not found")
            return

        target_series = df[config.target_column].dropna()
        class_counts = target_series.value_counts()

        metrics.class_distribution = class_counts.to_dict()

        # Calculate imbalance ratio (minority class / majority class)
        if len(class_counts) > 1:
            minority_count = class_counts.min()
            majority_count = class_counts.max()
            metrics.class_imbalance_ratio = minority_count / majority_count

            # Determine severity
            if metrics.class_imbalance_ratio >= 0.5:
                metrics.imbalance_severity = "good"
            elif metrics.class_imbalance_ratio >= config.imbalance_ratio_threshold:
                metrics.imbalance_severity = "warning"
            else:
                metrics.imbalance_severity = "critical"
        else:
            metrics.imbalance_severity = "critical"  # Only one class

    async def _analyze_bias_drift(
        self,
        df: pd.DataFrame,
        metrics: QualityMetrics,
        config: QualityConfig
    ):
        """Analyze bias and drift compared to reference dataset"""
        try:
            if not Path(config.reference_dataset_path).exists():
                logger.warning(f"Reference dataset not found: {config.reference_dataset_path}")
                return

            # Load reference dataset
            ref_df = await self._load_dataset(config.reference_dataset_path)

            # Align columns
            common_columns = set(df.columns).intersection(set(ref_df.columns))

            drift_detected = False
            drift_columns = []
            drift_scores = {}

            for column in common_columns:
                if df[column].dtype in ['object', 'category']:
                    # Categorical drift detection
                    drift_score = await self._detect_categorical_drift(
                        df[column], ref_df[column], config.categorical_drift_method
                    )
                else:
                    # Numerical drift detection
                    drift_score = await self._detect_numerical_drift(
                        df[column], ref_df[column], config.numerical_drift_method
                    )

                drift_scores[column] = drift_score

                if drift_score < config.drift_threshold:  # Significant drift
                    drift_detected = True
                    drift_columns.append(column)

            metrics.drift_detected = drift_detected
            metrics.drift_columns = drift_columns
            metrics.drift_scores = drift_scores

        except Exception as e:
            logger.error(f"Drift analysis failed: {e}")

    async def _detect_categorical_drift(
        self,
        current_series: pd.Series,
        reference_series: pd.Series,
        method: str
    ) -> float:
        """Detect drift in categorical variables"""
        try:
            current_counts = current_series.value_counts(normalize=True)
            reference_counts = reference_series.value_counts(normalize=True)

            # Align categories
            all_categories = set(current_counts.index).union(set(reference_counts.index))
            current_probs = [current_counts.get(cat, 0) for cat in all_categories]
            reference_probs = [reference_counts.get(cat, 0) for cat in all_categories]

            if method == "chi2":
                # Chi-square test
                observed = [prob * len(current_series) for prob in current_probs]
                expected = [prob * len(current_series) for prob in reference_probs]

                # Add small epsilon to avoid division by zero
                expected = [max(exp, 1e-10) for exp in expected]

                chi2_stat = sum((obs - exp) ** 2 / exp for obs, exp in zip(observed, expected))
                # Convert to p-value approximation
                return 1.0 / (1.0 + chi2_stat)

            elif method == "psi":
                # Population Stability Index
                psi = sum(
                    (curr - ref) * np.log(curr / ref) if curr > 0 and ref > 0 else 0
                    for curr, ref in zip(current_probs, reference_probs)
                )
                return 1.0 / (1.0 + psi)

            return 0.5  # Default moderate drift

        except Exception as e:
            logger.warning(f"Categorical drift detection failed: {e}")
            return 0.5

    async def _detect_numerical_drift(
        self,
        current_series: pd.Series,
        reference_series: pd.Series,
        method: str
    ) -> float:
        """Detect drift in numerical variables"""
        try:
            # Remove NaN values
            current_clean = current_series.dropna()
            reference_clean = reference_series.dropna()

            if len(current_clean) == 0 or len(reference_clean) == 0:
                return 0.5

            if method == "ks":
                # Kolmogorov-Smirnov test
                ks_stat, p_value = stats.ks_2samp(current_clean, reference_clean)
                return p_value

            elif method == "wasserstein":
                # Wasserstein distance (normalized)
                distance = stats.wasserstein_distance(current_clean, reference_clean)
                # Normalize by data range
                data_range = max(current_clean.max(), reference_clean.max()) - min(current_clean.min(), reference_clean.min())
                normalized_distance = distance / data_range if data_range > 0 else 0
                return 1.0 / (1.0 + normalized_distance)

            return 0.5

        except Exception as e:
            logger.warning(f"Numerical drift detection failed: {e}")
            return 0.5

    async def _profile_columns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Generate detailed column profiles"""
        profiles = {}

        for column in df.columns:
            series = df[column]
            profile = {
                "dtype": str(series.dtype),
                "null_count": int(series.isnull().sum()),
                "null_percentage": float((series.isnull().sum() / len(series)) * 100),
                "unique_count": int(series.nunique()),
                "unique_percentage": float((series.nunique() / len(series)) * 100)
            }

            if pd.api.types.is_numeric_dtype(series):
                # Numerical statistics
                profile.update({
                    "mean": float(series.mean()) if not series.empty else None,
                    "median": float(series.median()) if not series.empty else None,
                    "std": float(series.std()) if not series.empty else None,
                    "min": float(series.min()) if not series.empty else None,
                    "max": float(series.max()) if not series.empty else None,
                    "q25": float(series.quantile(0.25)) if not series.empty else None,
                    "q75": float(series.quantile(0.75)) if not series.empty else None
                })
            else:
                # Categorical statistics
                try:
                    value_counts = series.value_counts().head(10)
                    profile.update({
                        "most_frequent": value_counts.index[0] if len(value_counts) > 0 else None,
                        "most_frequent_count": int(value_counts.iloc[0]) if len(value_counts) > 0 else 0,
                        "top_values": value_counts.to_dict()
                    })
                except:
                    pass

            profiles[column] = profile

        return profiles

    async def _analyze_outliers(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze outliers in numerical columns"""
        outlier_analysis = {}

        for column in df.select_dtypes(include=[np.number]).columns:
            series = df[column].dropna()
            if len(series) == 0:
                continue

            # IQR method
            Q1 = series.quantile(0.25)
            Q3 = series.quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR

            outliers = series[(series < lower_bound) | (series > upper_bound)]

            outlier_analysis[column] = {
                "outlier_count": len(outliers),
                "outlier_percentage": (len(outliers) / len(series)) * 100,
                "lower_bound": float(lower_bound),
                "upper_bound": float(upper_bound),
                "outlier_values": outliers.head(10).tolist()  # Sample outliers
            }

        return outlier_analysis

    async def _analyze_duplicates(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze duplicate rows"""
        duplicate_count = df.duplicated().sum()
        return {
            "duplicate_rows": int(duplicate_count),
            "duplicate_percentage": float((duplicate_count / len(df)) * 100),
            "unique_rows": len(df) - duplicate_count
        }

    async def _calculate_overall_quality_score(self, metrics: QualityMetrics) -> float:
        """Calculate overall quality score (0-100)"""
        score = 100.0

        # Deduct for missing values
        score -= metrics.missing_values_ratio

        # Deduct for class imbalance
        if metrics.class_imbalance_ratio is not None:
            if metrics.imbalance_severity == "critical":
                score -= 30
            elif metrics.imbalance_severity == "warning":
                score -= 15

        # Deduct for drift
        if metrics.drift_detected:
            score -= len(metrics.drift_columns) * 5

        return max(0.0, score)

    async def _assign_quality_grade(self, score: float) -> str:
        """Assign letter grade based on quality score"""
        if score >= 90:
            return "A"
        elif score >= 80:
            return "B"
        elif score >= 70:
            return "C"
        elif score >= 60:
            return "D"
        else:
            return "F"

    async def _generate_recommendations(
        self,
        metrics: QualityMetrics,
        config: QualityConfig
    ) -> List[str]:
        """Generate actionable recommendations"""
        recommendations = []

        if metrics.missing_values_severity == "critical":
            recommendations.append("Critical missing data detected. Consider imputation or removing affected columns.")
        elif metrics.missing_values_severity == "warning":
            recommendations.append("Significant missing data detected. Review data collection process.")

        if metrics.imbalance_severity == "critical":
            recommendations.append("Severe class imbalance detected. Consider resampling techniques (SMOTE, undersampling).")
        elif metrics.imbalance_severity == "warning":
            recommendations.append("Moderate class imbalance detected. Monitor model performance across classes.")

        if metrics.drift_detected:
            recommendations.append(f"Data drift detected in {len(metrics.drift_columns)} columns. Review data pipeline and consider retraining.")

        if metrics.overall_quality_score < 70:
            recommendations.append("Overall data quality is below acceptable threshold. Comprehensive data cleaning recommended.")

        return recommendations

    async def _generate_reports(self, report: QualityReport, config: QualityConfig):
        """Generate JSON and/or PDF reports"""
        # Generate JSON report
        if config.report_format in [ReportFormat.JSON, ReportFormat.BOTH]:
            json_path = self.reports_dir / f"{report.report_id}_quality_report.json"
            await self._generate_json_report(report, json_path)
            report.json_report_path = str(json_path)

        # Generate PDF report
        if config.report_format in [ReportFormat.PDF, ReportFormat.BOTH] and PDF_AVAILABLE:
            pdf_path = self.reports_dir / f"{report.report_id}_quality_report.pdf"
            await self._generate_pdf_report(report, pdf_path, config)
            report.pdf_report_path = str(pdf_path)

    async def _generate_json_report(self, report: QualityReport, output_path: Path):
        """Generate JSON quality report"""
        try:
            # Convert report to serializable format
            report_dict = {
                "report_id": report.report_id,
                "dataset_path": report.dataset_path,
                "analysis_timestamp": report.analysis_timestamp.isoformat(),
                "dataset_info": {
                    "total_rows": report.total_rows,
                    "total_columns": report.total_columns,
                    "dataset_size_mb": report.dataset_size_mb
                },
                "quality_metrics": {
                    "missing_values_ratio": report.metrics.missing_values_ratio,
                    "missing_values_by_column": report.metrics.missing_values_by_column,
                    "missing_values_severity": report.metrics.missing_values_severity,
                    "class_distribution": report.metrics.class_distribution,
                    "class_imbalance_ratio": report.metrics.class_imbalance_ratio,
                    "imbalance_severity": report.metrics.imbalance_severity,
                    "drift_detected": report.metrics.drift_detected,
                    "drift_columns": report.metrics.drift_columns,
                    "drift_scores": report.metrics.drift_scores,
                    "overall_quality_score": report.metrics.overall_quality_score,
                    "quality_grade": report.metrics.quality_grade,
                    "recommendations": report.metrics.recommendations
                },
                "column_profiles": report.column_profiles,
                "outlier_analysis": report.outlier_analysis,
                "duplicate_analysis": report.duplicate_analysis,
                "processing_time_seconds": report.processing_time_seconds
            }

            with open(output_path, 'w') as f:
                json.dump(report_dict, f, indent=2, default=str)

        except Exception as e:
            logger.error(f"Failed to generate JSON report: {e}")

    async def _generate_pdf_report(
        self,
        report: QualityReport,
        output_path: Path,
        config: QualityConfig
    ):
        """Generate PDF quality report with visualizations"""
        if not PDF_AVAILABLE:
            return

        try:
            doc = SimpleDocTemplate(str(output_path), pagesize=A4)
            story = []
            styles = getSampleStyleSheet()

            # Title
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=24,
                spaceAfter=30,
                alignment=1  # Center
            )
            story.append(Paragraph("Data Quality Report", title_style))
            story.append(Spacer(1, 20))

            # Executive Summary
            story.append(Paragraph("Executive Summary", styles['Heading2']))
            summary_text = f"""
            <b>Dataset:</b> {Path(report.dataset_path).name}<br/>
            <b>Analysis Date:</b> {report.analysis_timestamp.strftime('%Y-%m-%d %H:%M')}<br/>
            <b>Rows:</b> {report.total_rows:,}<br/>
            <b>Columns:</b> {report.total_columns}<br/>
            <b>Size:</b> {report.dataset_size_mb:.2f} MB<br/>
            <b>Quality Score:</b> {report.metrics.overall_quality_score:.1f}/100 ({report.metrics.quality_grade})<br/>
            """
            story.append(Paragraph(summary_text, styles['Normal']))
            story.append(Spacer(1, 20))

            # Missing Values Analysis
            story.append(Paragraph("Missing Values Analysis", styles['Heading2']))
            missing_text = f"""
            <b>Overall Missing Values:</b> {report.metrics.missing_values_ratio:.2f}%<br/>
            <b>Severity:</b> {report.metrics.missing_values_severity.title()}<br/>
            """
            story.append(Paragraph(missing_text, styles['Normal']))

            # Top columns with missing values
            missing_cols = sorted(
                [(col, pct) for col, pct in report.metrics.missing_values_by_column.items() if pct > 0],
                key=lambda x: x[1], reverse=True
            )[:10]

            if missing_cols:
                missing_data = [["Column", "Missing %"]]
                missing_data.extend([[col, f"{pct:.2f}%"] for col, pct in missing_cols])

                missing_table = Table(missing_data)
                missing_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 12),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))
                story.append(missing_table)

            story.append(Spacer(1, 20))

            # Class Imbalance Analysis
            if report.metrics.class_distribution:
                story.append(Paragraph("Class Imbalance Analysis", styles['Heading2']))
                imbalance_text = f"""
                <b>Imbalance Ratio:</b> {report.metrics.class_imbalance_ratio:.3f}<br/>
                <b>Severity:</b> {report.metrics.imbalance_severity.title()}<br/>
                """
                story.append(Paragraph(imbalance_text, styles['Normal']))

                # Class distribution table
                class_data = [["Class", "Count", "Percentage"]]
                total_samples = sum(report.metrics.class_distribution.values())
                for class_name, count in sorted(report.metrics.class_distribution.items(), key=lambda x: x[1], reverse=True):
                    percentage = (count / total_samples) * 100
                    class_data.append([str(class_name), str(count), f"{percentage:.2f}%"])

                class_table = Table(class_data)
                class_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 12),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))
                story.append(class_table)
                story.append(Spacer(1, 20))

            # Recommendations
            if report.metrics.recommendations:
                story.append(Paragraph("Recommendations", styles['Heading2']))
                for i, rec in enumerate(report.metrics.recommendations, 1):
                    story.append(Paragraph(f"{i}. {rec}", styles['Normal']))
                story.append(Spacer(1, 20))

            # Build PDF
            doc.build(story)

        except Exception as e:
            logger.error(f"Failed to generate PDF report: {e}")

    async def _load_dataset(
        self,
        dataset_path: str,
        sample_size: Optional[int] = None
    ) -> pd.DataFrame:
        """Load dataset from file"""
        file_path = Path(dataset_path)
        file_format = file_path.suffix.lower()

        try:
            if file_format == '.csv':
                df = pd.read_csv(dataset_path, nrows=sample_size)
            elif file_format == '.parquet':
                df = pd.read_parquet(dataset_path)
                if sample_size:
                    df = df.head(sample_size)
            elif file_format == '.jsonl':
                lines = []
                with open(dataset_path, 'r') as f:
                    for i, line in enumerate(f):
                        if sample_size and i >= sample_size:
                            break
                        lines.append(json.loads(line.strip()))
                df = pd.DataFrame(lines)
            else:
                raise ValueError(f"Unsupported file format: {file_format}")

            return df

        except Exception as e:
            logger.error(f"Failed to load dataset: {e}")
            raise

    async def _create_quality_job(
        self,
        job_id: str,
        dataset_path: str,
        config: QualityConfig,
        dataset_id: Optional[uuid.UUID]
    ):
        """Create database record for quality job"""
        try:
            async with get_async_session() as session:
                job = ProcessingJob(
                    id=uuid.UUID(job_id),
                    job_type="quality_monitoring",
                    config={
                        "dataset_path": dataset_path,
                        "dataset_id": str(dataset_id) if dataset_id else None,
                        "quality_config": config.__dict__
                    },
                    status=JobStatus.PENDING
                )
                session.add(job)
                await session.commit()

        except Exception as e:
            logger.error(f"Failed to create quality job: {e}")

    async def _update_job_status(self, job_id: str, status: str, operation: str = None):
        """Update job status in database"""
        try:
            async with get_async_session() as session:
                update_data = {"status": JobStatus(status)}
                if operation:
                    existing_config = await session.get(ProcessingJob, uuid.UUID(job_id))
                    if existing_config and existing_config.config:
                        existing_config.config["current_operation"] = operation
                        update_data["config"] = existing_config.config

                stmt = (
                    update(ProcessingJob)
                    .where(ProcessingJob.id == uuid.UUID(job_id))
                    .values(**update_data)
                )
                await session.execute(stmt)
                await session.commit()

        except Exception as e:
            logger.error(f"Failed to update job status: {e}")

    async def _complete_quality_job(self, job_id: str, report: QualityReport):
        """Complete quality job with results"""
        try:
            async with get_async_session() as session:
                stmt = (
                    update(ProcessingJob)
                    .where(ProcessingJob.id == uuid.UUID(job_id))
                    .values(
                        status=JobStatus.COMPLETED,
                        progress_percentage=100.0,
                        output_summary={
                            "quality_score": report.metrics.overall_quality_score,
                            "quality_grade": report.metrics.quality_grade,
                            "missing_values_ratio": report.metrics.missing_values_ratio,
                            "json_report_path": report.json_report_path,
                            "pdf_report_path": report.pdf_report_path
                        },
                        output_artifact_path=report.json_report_path,
                        completed_at=datetime.utcnow()
                    )
                )
                await session.execute(stmt)
                await session.commit()

        except Exception as e:
            logger.error(f"Failed to complete quality job: {e}")

    async def _fail_quality_job(self, job_id: str, error_message: str):
        """Mark quality job as failed"""
        try:
            async with get_async_session() as session:
                stmt = (
                    update(ProcessingJob)
                    .where(ProcessingJob.id == uuid.UUID(job_id))
                    .values(
                        status=JobStatus.FAILED,
                        error_message=error_message,
                        completed_at=datetime.utcnow()
                    )
                )
                await session.execute(stmt)
                await session.commit()

        except Exception as e:
            logger.error(f"Failed to fail quality job: {e}")

    async def _store_quality_report(self, report: QualityReport, dataset_id: uuid.UUID):
        """Store quality report in database"""
        try:
            async with get_async_session() as session:
                quality_report = DatasetQualityReport(
                    dataset_id=dataset_id,
                    quality_score=report.metrics.overall_quality_score,
                    quality_grade=report.metrics.quality_grade,
                    completeness_score=100 - report.metrics.missing_values_ratio,
                    missing_values_analysis={
                        "overall_ratio": report.metrics.missing_values_ratio,
                        "by_column": report.metrics.missing_values_by_column,
                        "severity": report.metrics.missing_values_severity
                    },
                    statistical_summary=report.column_profiles,
                    anomalies_detected=report.outlier_analysis,
                    bias_analysis={
                        "drift_detected": report.metrics.drift_detected,
                        "drift_columns": report.metrics.drift_columns,
                        "drift_scores": report.metrics.drift_scores
                    },
                    analysis_config=report.config_used.__dict__ if report.config_used else {},
                    processing_time_seconds=report.processing_time_seconds
                )

                session.add(quality_report)
                await session.commit()

        except Exception as e:
            logger.error(f"Failed to store quality report: {e}")

    async def get_quality_job_status(self, job_id: str) -> Dict[str, Any]:
        """Get status of quality monitoring job"""
        try:
            async with get_async_session() as session:
                stmt = select(ProcessingJob).where(ProcessingJob.id == uuid.UUID(job_id))
                result = await session.execute(stmt)
                job = result.scalar_one_or_none()

                if job:
                    return {
                        "job_id": job_id,
                        "status": job.status.value,
                        "progress_percentage": job.progress_percentage,
                        "output_path": job.output_artifact_path,
                        "error_message": job.error_message,
                        "created_at": job.created_at.isoformat() if job.created_at else None,
                        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                        "output_summary": job.output_summary,
                        "current_operation": job.config.get("current_operation") if job.config else None
                    }
                else:
                    return {"error": "Job not found"}

        except Exception as e:
            logger.error(f"Failed to get quality job status: {e}")
            return {"error": str(e)}

    async def get_quality_report(self, report_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve quality report by ID"""
        try:
            json_path = self.reports_dir / f"{report_id}_quality_report.json"
            if json_path.exists():
                with open(json_path, 'r') as f:
                    return json.load(f)
            return None

        except Exception as e:
            logger.error(f"Failed to get quality report: {e}")
            return None

# Global instance
realtime_quality_monitor = RealtimeQualityMonitor()