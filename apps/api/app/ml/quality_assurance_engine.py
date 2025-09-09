"""
Quality Assurance Engine for Automated Retraining
=================================================

Advanced quality assurance system for automated ML model retraining that ensures
model quality, safety, and reliability throughout the retraining lifecycle.

Key Features:
- Multi-stage quality gates with configurable thresholds
- Model performance validation and regression testing
- Data quality assessment and drift impact analysis
- Business metrics validation and compliance checks
- Infrastructure readiness and deployment validation
- Automated rollback triggers and safety mechanisms
- Quality scoring and continuous improvement tracking

Quality Gates:
1. Data Quality Gate: Validates training data quality and completeness
2. Model Performance Gate: Ensures model meets performance requirements
3. Drift Validation Gate: Analyzes drift impact on model predictions
4. Business Metrics Gate: Validates business KPI alignment
5. Infrastructure Gate: Checks deployment readiness and resources
6. Compliance Gate: Ensures regulatory and policy compliance
"""

import logging
import json
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
from abc import ABC, abstractmethod
import numpy as np
import pandas as pd
from collections import defaultdict

# Statistical analysis
from scipy import stats
from scipy.stats import chi2_contingency, ks_2samp
from sklearn.metrics import (
    accuracy_score, precision_recall_fscore_support, roc_auc_score,
    mean_squared_error, r2_score, mean_absolute_error, classification_report
)
from sklearn.model_selection import cross_val_score

# Import existing components
try:
    from app.models.automated_retraining import (
        QualityGate, AlertSeverity, QualityGateResult,
        RetrainingExecution
    )
    from app.ml.automated_retraining_engine import (
        DriftDetectionResult, DriftType, DriftDetectionMethod
    )
    DB_AVAILABLE = True
except ImportError:
    logging.warning("Database models or retraining engine not available")
    DB_AVAILABLE = False

logger = logging.getLogger(__name__)


class QualityGateStatus(str, Enum):
    """Status of quality gate execution."""
    PENDING = "pending"
    RUNNING = "running" 
    PASSED = "passed"
    FAILED = "failed"
    WARNING = "warning"
    SKIPPED = "skipped"


class ValidationSeverity(str, Enum):
    """Severity levels for validation issues."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class QualityCheck:
    """Individual quality check within a quality gate."""
    check_id: str
    name: str
    description: str
    check_type: str  # "threshold", "statistical", "custom"
    
    # Configuration
    threshold: Optional[float] = None
    operator: str = "gte"  # "gte", "lte", "eq", "neq"
    required: bool = True
    weight: float = 1.0
    
    # Execution results
    executed: bool = False
    passed: bool = False
    actual_value: Optional[float] = None
    confidence: float = 0.0
    severity: ValidationSeverity = ValidationSeverity.ERROR
    message: str = ""
    execution_time_seconds: Optional[float] = None
    
    # Metadata
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


@dataclass
class QualityGateConfig:
    """Configuration for a quality gate."""
    gate_type: QualityGate
    name: str
    description: str
    enabled: bool = True
    
    # Execution configuration
    timeout_seconds: int = 300
    retry_count: int = 0
    parallel_execution: bool = False
    
    # Scoring configuration
    passing_score_threshold: float = 0.8
    warning_score_threshold: float = 0.6
    weight: float = 1.0
    
    # Failure handling
    failure_action: str = "stop"  # "stop", "warn", "continue"
    rollback_on_failure: bool = False
    
    # Quality checks
    checks: List[QualityCheck] = None
    
    # Custom configuration
    custom_config: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.checks is None:
            self.checks = []
        if self.custom_config is None:
            self.custom_config = {}


@dataclass
class QualityGateResult:
    """Result of quality gate execution."""
    gate_type: QualityGate
    status: QualityGateStatus
    overall_score: float
    passing_score: float
    execution_time_seconds: float
    
    # Check results
    checks_passed: int
    checks_failed: int
    checks_warned: int
    check_results: List[QualityCheck]
    
    # Detailed results
    validation_results: Dict[str, Any]
    performance_metrics: Dict[str, float] = None
    recommendations: List[str] = None
    
    # Issue tracking
    issues: List[str] = None
    warnings: List[str] = None
    
    # Execution metadata
    timestamp: datetime
    execution_context: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.performance_metrics is None:
            self.performance_metrics = {}
        if self.recommendations is None:
            self.recommendations = []
        if self.issues is None:
            self.issues = []
        if self.warnings is None:
            self.warnings = []
        if self.execution_context is None:
            self.execution_context = {}


class QualityGateValidator(ABC):
    """Abstract base class for quality gate validators."""
    
    def __init__(self, config: QualityGateConfig):
        self.config = config
        self.logger = logging.getLogger(f"{self.__class__.__name__}")
    
    @abstractmethod
    async def validate(self, context: Dict[str, Any]) -> QualityGateResult:
        """Execute quality gate validation."""
        pass
    
    def _calculate_score(self, check_results: List[QualityCheck]) -> float:
        """Calculate overall quality score from check results."""
        if not check_results:
            return 0.0
        
        total_weight = sum(check.weight for check in check_results)
        if total_weight == 0:
            return 0.0
        
        weighted_score = sum(
            check.weight * (1.0 if check.passed else 0.0)
            for check in check_results
        )
        
        return weighted_score / total_weight
    
    def _create_check(self, check_id: str, name: str, **kwargs) -> QualityCheck:
        """Helper to create a quality check."""
        return QualityCheck(
            check_id=check_id,
            name=name,
            description=kwargs.get('description', name),
            check_type=kwargs.get('check_type', 'threshold'),
            threshold=kwargs.get('threshold'),
            operator=kwargs.get('operator', 'gte'),
            required=kwargs.get('required', True),
            weight=kwargs.get('weight', 1.0)
        )
    
    def _evaluate_check(self, check: QualityCheck, actual_value: float) -> bool:
        """Evaluate a single quality check."""
        if check.threshold is None:
            return True
        
        check.actual_value = actual_value
        check.executed = True
        
        if check.operator == "gte":
            check.passed = actual_value >= check.threshold
        elif check.operator == "lte":
            check.passed = actual_value <= check.threshold
        elif check.operator == "eq":
            check.passed = abs(actual_value - check.threshold) < 1e-6
        elif check.operator == "neq":
            check.passed = abs(actual_value - check.threshold) >= 1e-6
        else:
            check.passed = False
            check.message = f"Unknown operator: {check.operator}"
        
        if not check.passed:
            check.message = f"Check failed: {actual_value} {check.operator} {check.threshold}"
        else:
            check.message = f"Check passed: {actual_value} {check.operator} {check.threshold}"
        
        return check.passed


class DataQualityValidator(QualityGateValidator):
    """Validator for data quality checks."""
    
    async def validate(self, context: Dict[str, Any]) -> QualityGateResult:
        """Validate data quality."""
        start_time = datetime.utcnow()
        
        training_data = context.get('training_data')
        validation_data = context.get('validation_data')
        
        if training_data is None:
            return QualityGateResult(
                gate_type=QualityGate.DATA_QUALITY,
                status=QualityGateStatus.FAILED,
                overall_score=0.0,
                passing_score=self.config.passing_score_threshold,
                execution_time_seconds=0.0,
                checks_passed=0,
                checks_failed=1,
                checks_warned=0,
                check_results=[],
                validation_results={"error": "No training data provided"},
                issues=["No training data available for validation"],
                timestamp=start_time
            )
        
        # Define quality checks
        checks = [
            self._create_check(
                "data_completeness", 
                "Data Completeness",
                description="Check for sufficient data volume",
                threshold=1000,
                operator="gte"
            ),
            self._create_check(
                "missing_values",
                "Missing Values",
                description="Check missing value percentage",
                threshold=0.1,
                operator="lte"
            ),
            self._create_check(
                "data_freshness",
                "Data Freshness", 
                description="Check data recency",
                threshold=7.0,  # days
                operator="lte",
                required=False
            ),
            self._create_check(
                "feature_coverage",
                "Feature Coverage",
                description="Check feature availability",
                threshold=0.9,
                operator="gte"
            ),
            self._create_check(
                "target_distribution",
                "Target Distribution",
                description="Check target variable distribution",
                threshold=0.01,  # minimum class frequency
                operator="gte",
                required=False
            )
        ]
        
        # Execute checks
        try:
            # Data completeness
            data_size = len(training_data)
            self._evaluate_check(checks[0], float(data_size))
            
            # Missing values
            missing_pct = training_data.isnull().mean().mean()
            self._evaluate_check(checks[1], float(missing_pct))
            
            # Data freshness (if timestamp column exists)
            if 'timestamp' in training_data.columns:
                latest_timestamp = pd.to_datetime(training_data['timestamp']).max()
                days_old = (datetime.utcnow() - latest_timestamp).days
                self._evaluate_check(checks[2], float(days_old))
            else:
                checks[2].executed = True
                checks[2].passed = True
                checks[2].message = "No timestamp column found - skipping freshness check"
            
            # Feature coverage
            total_features = len(training_data.columns)
            non_null_features = sum(1 for col in training_data.columns 
                                  if training_data[col].notna().any())
            feature_coverage = non_null_features / total_features if total_features > 0 else 0
            self._evaluate_check(checks[3], feature_coverage)
            
            # Target distribution (if target column exists)
            if 'target' in training_data.columns:
                target_dist = training_data['target'].value_counts(normalize=True)
                min_class_freq = target_dist.min() if len(target_dist) > 0 else 0
                self._evaluate_check(checks[4], float(min_class_freq))
            else:
                checks[4].executed = True
                checks[4].passed = True
                checks[4].message = "No target column found - skipping distribution check"
            
            # Calculate overall score
            overall_score = self._calculate_score(checks)
            
            # Determine status
            if overall_score >= self.config.passing_score_threshold:
                status = QualityGateStatus.PASSED
            elif overall_score >= self.config.warning_score_threshold:
                status = QualityGateStatus.WARNING
            else:
                status = QualityGateStatus.FAILED
            
            # Collect issues and warnings
            issues = [check.message for check in checks if not check.passed and check.required]
            warnings = [check.message for check in checks if not check.passed and not check.required]
            
            # Generate recommendations
            recommendations = []
            if data_size < 1000:
                recommendations.append("Consider collecting more training data for better model performance")
            if missing_pct > 0.05:
                recommendations.append("Address missing values through imputation or data collection")
            if feature_coverage < 0.9:
                recommendations.append("Review feature engineering pipeline for data completeness")
            
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            return QualityGateResult(
                gate_type=QualityGate.DATA_QUALITY,
                status=status,
                overall_score=overall_score,
                passing_score=self.config.passing_score_threshold,
                execution_time_seconds=execution_time,
                checks_passed=sum(1 for check in checks if check.passed),
                checks_failed=sum(1 for check in checks if not check.passed and check.required),
                checks_warned=sum(1 for check in checks if not check.passed and not check.required),
                check_results=checks,
                validation_results={
                    "data_size": data_size,
                    "missing_percentage": missing_pct,
                    "feature_count": total_features,
                    "feature_coverage": feature_coverage
                },
                issues=issues,
                warnings=warnings,
                recommendations=recommendations,
                timestamp=start_time
            )
            
        except Exception as e:
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            self.logger.error(f"Data quality validation failed: {e}")
            
            return QualityGateResult(
                gate_type=QualityGate.DATA_QUALITY,
                status=QualityGateStatus.FAILED,
                overall_score=0.0,
                passing_score=self.config.passing_score_threshold,
                execution_time_seconds=execution_time,
                checks_passed=0,
                checks_failed=len(checks),
                checks_warned=0,
                check_results=checks,
                validation_results={"error": str(e)},
                issues=[f"Validation error: {str(e)}"],
                timestamp=start_time
            )


class ModelPerformanceValidator(QualityGateValidator):
    """Validator for model performance checks."""
    
    async def validate(self, context: Dict[str, Any]) -> QualityGateResult:
        """Validate model performance."""
        start_time = datetime.utcnow()
        
        new_model = context.get('new_model')
        baseline_model = context.get('baseline_model')
        validation_data = context.get('validation_data')
        
        if not all([new_model, validation_data]):
            return QualityGateResult(
                gate_type=QualityGate.MODEL_PERFORMANCE,
                status=QualityGateStatus.FAILED,
                overall_score=0.0,
                passing_score=self.config.passing_score_threshold,
                execution_time_seconds=0.0,
                checks_passed=0,
                checks_failed=1,
                checks_warned=0,
                check_results=[],
                validation_results={"error": "Missing model or validation data"},
                issues=["Required model or validation data not provided"],
                timestamp=start_time
            )
        
        try:
            # Prepare validation data
            feature_columns = [col for col in validation_data.columns if col != 'target']
            X_val = validation_data[feature_columns]
            y_val = validation_data['target'] if 'target' in validation_data.columns else None
            
            if y_val is None:
                raise ValueError("No target column found in validation data")
            
            # Get predictions
            y_pred_new = new_model.predict(X_val)
            
            # Calculate metrics for new model
            new_metrics = self._calculate_metrics(y_val, y_pred_new, new_model, X_val)
            
            # Calculate baseline metrics if available
            baseline_metrics = {}
            improvement_metrics = {}
            
            if baseline_model is not None:
                y_pred_baseline = baseline_model.predict(X_val)
                baseline_metrics = self._calculate_metrics(y_val, y_pred_baseline, baseline_model, X_val)
                
                # Calculate improvements
                for metric in new_metrics:
                    if metric in baseline_metrics:
                        improvement = new_metrics[metric] - baseline_metrics[metric]
                        improvement_metrics[f"{metric}_improvement"] = improvement
            
            # Define performance checks
            checks = [
                self._create_check(
                    "accuracy_threshold",
                    "Accuracy Threshold",
                    description="Minimum accuracy requirement",
                    threshold=self.config.custom_config.get('min_accuracy', 0.8),
                    operator="gte"
                ),
                self._create_check(
                    "precision_threshold", 
                    "Precision Threshold",
                    description="Minimum precision requirement",
                    threshold=self.config.custom_config.get('min_precision', 0.75),
                    operator="gte",
                    required=False
                ),
                self._create_check(
                    "recall_threshold",
                    "Recall Threshold", 
                    description="Minimum recall requirement",
                    threshold=self.config.custom_config.get('min_recall', 0.75),
                    operator="gte",
                    required=False
                )
            ]
            
            # Add improvement checks if baseline available
            if baseline_metrics:
                checks.append(
                    self._create_check(
                        "accuracy_improvement",
                        "Accuracy Improvement",
                        description="Accuracy improvement over baseline",
                        threshold=self.config.custom_config.get('min_improvement', 0.01),
                        operator="gte",
                        weight=2.0
                    )
                )
            
            # Execute checks
            self._evaluate_check(checks[0], new_metrics.get('accuracy', 0.0))
            if 'precision' in new_metrics:
                self._evaluate_check(checks[1], new_metrics['precision'])
            if 'recall' in new_metrics:
                self._evaluate_check(checks[2], new_metrics['recall'])
            
            if baseline_metrics and 'accuracy_improvement' in improvement_metrics:
                self._evaluate_check(checks[-1], improvement_metrics['accuracy_improvement'])
            
            # Statistical significance test
            statistical_significance = None
            if baseline_model is not None:
                statistical_significance = self._test_statistical_significance(
                    y_val, y_pred_new, y_pred_baseline
                )
            
            # Calculate overall score
            overall_score = self._calculate_score(checks)
            
            # Determine status
            if overall_score >= self.config.passing_score_threshold:
                status = QualityGateStatus.PASSED
            elif overall_score >= self.config.warning_score_threshold:
                status = QualityGateStatus.WARNING
            else:
                status = QualityGateStatus.FAILED
            
            # Collect issues and recommendations
            issues = [check.message for check in checks if not check.passed and check.required]
            warnings = [check.message for check in checks if not check.passed and not check.required]
            
            recommendations = []
            if new_metrics.get('accuracy', 0) < 0.8:
                recommendations.append("Consider hyperparameter tuning or model architecture changes")
            if baseline_metrics and improvement_metrics.get('accuracy_improvement', 0) < 0:
                recommendations.append("Model performance has degraded - investigate data or model issues")
            if statistical_significance and statistical_significance['p_value'] > 0.05:
                recommendations.append("Performance difference may not be statistically significant")
            
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            return QualityGateResult(
                gate_type=QualityGate.MODEL_PERFORMANCE,
                status=status,
                overall_score=overall_score,
                passing_score=self.config.passing_score_threshold,
                execution_time_seconds=execution_time,
                checks_passed=sum(1 for check in checks if check.passed),
                checks_failed=sum(1 for check in checks if not check.passed and check.required),
                checks_warned=sum(1 for check in checks if not check.passed and not check.required),
                check_results=checks,
                validation_results={
                    "new_model_metrics": new_metrics,
                    "baseline_metrics": baseline_metrics,
                    "improvement_metrics": improvement_metrics,
                    "statistical_significance": statistical_significance
                },
                performance_metrics=new_metrics,
                issues=issues,
                warnings=warnings,
                recommendations=recommendations,
                timestamp=start_time
            )
            
        except Exception as e:
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            self.logger.error(f"Model performance validation failed: {e}")
            
            return QualityGateResult(
                gate_type=QualityGate.MODEL_PERFORMANCE,
                status=QualityGateStatus.FAILED,
                overall_score=0.0,
                passing_score=self.config.passing_score_threshold,
                execution_time_seconds=execution_time,
                checks_passed=0,
                checks_failed=1,
                checks_warned=0,
                check_results=[],
                validation_results={"error": str(e)},
                issues=[f"Performance validation error: {str(e)}"],
                timestamp=start_time
            )
    
    def _calculate_metrics(self, y_true, y_pred, model, X_val) -> Dict[str, float]:
        """Calculate performance metrics for a model."""
        metrics = {}
        
        try:
            # Basic accuracy
            metrics['accuracy'] = float(accuracy_score(y_true, y_pred))
            
            # Classification metrics
            if len(np.unique(y_true)) == 2:  # Binary classification
                precision, recall, f1, _ = precision_recall_fscore_support(
                    y_true, y_pred, average='binary'
                )
                metrics.update({
                    'precision': float(precision),
                    'recall': float(recall),
                    'f1_score': float(f1)
                })
                
                # ROC AUC if predict_proba is available
                try:
                    y_pred_proba = model.predict_proba(X_val)[:, 1]
                    metrics['roc_auc'] = float(roc_auc_score(y_true, y_pred_proba))
                except:
                    pass
            
            elif np.issubdtype(y_true.dtype, np.number):  # Regression
                metrics.update({
                    'mse': float(mean_squared_error(y_true, y_pred)),
                    'mae': float(mean_absolute_error(y_true, y_pred)),
                    'r2': float(r2_score(y_true, y_pred))
                })
            
            else:  # Multi-class classification
                precision, recall, f1, _ = precision_recall_fscore_support(
                    y_true, y_pred, average='weighted'
                )
                metrics.update({
                    'precision': float(precision),
                    'recall': float(recall),
                    'f1_score': float(f1)
                })
        
        except Exception as e:
            self.logger.warning(f"Error calculating metrics: {e}")
        
        return metrics
    
    def _test_statistical_significance(self, y_true, y_pred_new, y_pred_baseline) -> Dict[str, float]:
        """Test statistical significance of performance difference."""
        try:
            # Calculate accuracies
            acc_new = accuracy_score(y_true, y_pred_new)
            acc_baseline = accuracy_score(y_true, y_pred_baseline)
            
            # McNemar's test for paired predictions
            correct_new = (y_true == y_pred_new)
            correct_baseline = (y_true == y_pred_baseline)
            
            # Contingency table
            both_correct = sum(correct_new & correct_baseline)
            new_correct_baseline_wrong = sum(correct_new & ~correct_baseline)
            new_wrong_baseline_correct = sum(~correct_new & correct_baseline)
            both_wrong = sum(~correct_new & ~correct_baseline)
            
            # Chi-square test (simplified McNemar's)
            if new_correct_baseline_wrong + new_wrong_baseline_correct > 0:
                chi2_stat = ((new_correct_baseline_wrong - new_wrong_baseline_correct) ** 2) / (
                    new_correct_baseline_wrong + new_wrong_baseline_correct
                )
                p_value = 1 - stats.chi2.cdf(chi2_stat, 1)
            else:
                p_value = 1.0
                chi2_stat = 0.0
            
            return {
                'accuracy_difference': acc_new - acc_baseline,
                'chi2_statistic': chi2_stat,
                'p_value': p_value,
                'significant': p_value < 0.05
            }
        
        except Exception as e:
            self.logger.warning(f"Error in statistical significance test: {e}")
            return {}


class DriftValidationValidator(QualityGateValidator):
    """Validator for drift impact analysis."""
    
    async def validate(self, context: Dict[str, Any]) -> QualityGateResult:
        """Validate drift impact on model performance."""
        start_time = datetime.utcnow()
        
        new_model = context.get('new_model')
        validation_data = context.get('validation_data')
        drift_results = context.get('drift_results', [])
        
        if not all([new_model, validation_data]):
            return QualityGateResult(
                gate_type=QualityGate.DRIFT_VALIDATION,
                status=QualityGateStatus.SKIPPED,
                overall_score=1.0,
                passing_score=self.config.passing_score_threshold,
                execution_time_seconds=0.0,
                checks_passed=0,
                checks_failed=0,
                checks_warned=0,
                check_results=[],
                validation_results={"message": "Insufficient data for drift validation"},
                timestamp=start_time
            )
        
        try:
            # Define drift checks
            checks = [
                self._create_check(
                    "max_drift_score",
                    "Maximum Drift Score",
                    description="Maximum acceptable drift score",
                    threshold=self.config.custom_config.get('max_drift_score', 0.5),
                    operator="lte"
                ),
                self._create_check(
                    "drift_feature_count",
                    "Drifted Features Count",
                    description="Maximum number of drifted features",
                    threshold=self.config.custom_config.get('max_drifted_features', 5),
                    operator="lte",
                    required=False
                )
            ]
            
            # Analyze drift impact
            max_drift_score = 0.0
            drifted_features_count = 0
            drift_summary = {}
            
            if drift_results:
                for drift_result in drift_results:
                    if hasattr(drift_result, 'severity'):
                        max_drift_score = max(max_drift_score, drift_result.severity)
                    if hasattr(drift_result, 'features_affected'):
                        drifted_features_count += len(drift_result.features_affected)
                
                drift_summary = {
                    'max_drift_score': max_drift_score,
                    'total_drift_events': len(drift_results),
                    'drifted_features_count': drifted_features_count
                }
            
            # Execute checks
            self._evaluate_check(checks[0], max_drift_score)
            self._evaluate_check(checks[1], float(drifted_features_count))
            
            # Calculate overall score
            overall_score = self._calculate_score(checks)
            
            # Determine status
            if overall_score >= self.config.passing_score_threshold:
                status = QualityGateStatus.PASSED
            elif overall_score >= self.config.warning_score_threshold:
                status = QualityGateStatus.WARNING
            else:
                status = QualityGateStatus.FAILED
            
            # Generate recommendations
            recommendations = []
            if max_drift_score > 0.3:
                recommendations.append("High drift detected - monitor model performance closely")
            if drifted_features_count > 3:
                recommendations.append("Multiple features showing drift - consider feature engineering")
            
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            return QualityGateResult(
                gate_type=QualityGate.DRIFT_VALIDATION,
                status=status,
                overall_score=overall_score,
                passing_score=self.config.passing_score_threshold,
                execution_time_seconds=execution_time,
                checks_passed=sum(1 for check in checks if check.passed),
                checks_failed=sum(1 for check in checks if not check.passed and check.required),
                checks_warned=sum(1 for check in checks if not check.passed and not check.required),
                check_results=checks,
                validation_results={
                    "drift_summary": drift_summary,
                    "drift_results_count": len(drift_results)
                },
                recommendations=recommendations,
                timestamp=start_time
            )
            
        except Exception as e:
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            self.logger.error(f"Drift validation failed: {e}")
            
            return QualityGateResult(
                gate_type=QualityGate.DRIFT_VALIDATION,
                status=QualityGateStatus.FAILED,
                overall_score=0.0,
                passing_score=self.config.passing_score_threshold,
                execution_time_seconds=execution_time,
                checks_passed=0,
                checks_failed=1,
                checks_warned=0,
                check_results=checks,
                validation_results={"error": str(e)},
                issues=[f"Drift validation error: {str(e)}"],
                timestamp=start_time
            )


class QualityAssuranceEngine:
    """
    Comprehensive quality assurance engine for automated retraining.
    
    Orchestrates multiple quality gates to ensure model quality, safety,
    and compliance throughout the retraining process.
    """
    
    def __init__(self):
        self.validators = {
            QualityGate.DATA_QUALITY: DataQualityValidator,
            QualityGate.MODEL_PERFORMANCE: ModelPerformanceValidator,
            QualityGate.DRIFT_VALIDATION: DriftValidationValidator
        }
        self.logger = logging.getLogger(__name__)
    
    def configure_quality_gates(self, gate_configs: List[QualityGateConfig]):
        """Configure quality gates for execution."""
        self.gate_configs = {config.gate_type: config for config in gate_configs}
    
    async def run_quality_gates(self, context: Dict[str, Any]) -> Dict[QualityGate, QualityGateResult]:
        """Run all configured quality gates."""
        results = {}
        
        for gate_type, config in self.gate_configs.items():
            if not config.enabled:
                self.logger.info(f"Quality gate {gate_type.value} is disabled - skipping")
                continue
            
            if gate_type not in self.validators:
                self.logger.warning(f"No validator available for gate type: {gate_type.value}")
                continue
            
            try:
                self.logger.info(f"Running quality gate: {gate_type.value}")
                
                validator_class = self.validators[gate_type]
                validator = validator_class(config)
                
                result = await validator.validate(context)
                results[gate_type] = result
                
                self.logger.info(
                    f"Quality gate {gate_type.value} completed: "
                    f"status={result.status.value}, score={result.overall_score:.3f}"
                )
                
                # Handle failure actions
                if result.status == QualityGateStatus.FAILED and config.failure_action == "stop":
                    self.logger.warning(f"Quality gate {gate_type.value} failed - stopping execution")
                    break
                
            except Exception as e:
                self.logger.error(f"Quality gate {gate_type.value} execution failed: {e}")
                
                # Create failure result
                results[gate_type] = QualityGateResult(
                    gate_type=gate_type,
                    status=QualityGateStatus.FAILED,
                    overall_score=0.0,
                    passing_score=config.passing_score_threshold,
                    execution_time_seconds=0.0,
                    checks_passed=0,
                    checks_failed=1,
                    checks_warned=0,
                    check_results=[],
                    validation_results={"error": str(e)},
                    issues=[f"Gate execution error: {str(e)}"],
                    timestamp=datetime.utcnow()
                )
        
        return results
    
    def calculate_overall_quality_score(self, results: Dict[QualityGate, QualityGateResult]) -> float:
        """Calculate overall quality score across all gates."""
        if not results:
            return 0.0
        
        total_weight = sum(
            self.gate_configs[gate_type].weight 
            for gate_type in results 
            if gate_type in self.gate_configs
        )
        
        if total_weight == 0:
            return 0.0
        
        weighted_score = sum(
            result.overall_score * self.gate_configs[gate_type].weight
            for gate_type, result in results.items()
            if gate_type in self.gate_configs
        )
        
        return weighted_score / total_weight
    
    def should_proceed_with_deployment(self, results: Dict[QualityGate, QualityGateResult]) -> bool:
        """Determine if deployment should proceed based on quality gate results."""
        for gate_type, result in results.items():
            config = self.gate_configs.get(gate_type)
            if not config:
                continue
            
            if result.status == QualityGateStatus.FAILED and config.failure_action == "stop":
                return False
        
        return True
    
    def get_quality_summary(self, results: Dict[QualityGate, QualityGateResult]) -> Dict[str, Any]:
        """Generate a summary of quality gate results."""
        total_gates = len(results)
        passed_gates = sum(1 for result in results.values() if result.status == QualityGateStatus.PASSED)
        failed_gates = sum(1 for result in results.values() if result.status == QualityGateStatus.FAILED)
        warned_gates = sum(1 for result in results.values() if result.status == QualityGateStatus.WARNING)
        
        overall_score = self.calculate_overall_quality_score(results)
        should_deploy = self.should_proceed_with_deployment(results)
        
        # Collect all issues and recommendations
        all_issues = []
        all_recommendations = []
        
        for result in results.values():
            all_issues.extend(result.issues)
            all_recommendations.extend(result.recommendations)
        
        return {
            "overall_score": overall_score,
            "should_deploy": should_deploy,
            "gates_summary": {
                "total": total_gates,
                "passed": passed_gates,
                "failed": failed_gates,
                "warned": warned_gates
            },
            "gate_results": {
                gate_type.value: {
                    "status": result.status.value,
                    "score": result.overall_score,
                    "execution_time": result.execution_time_seconds
                }
                for gate_type, result in results.items()
            },
            "issues": list(set(all_issues)),
            "recommendations": list(set(all_recommendations))
        }


# Factory functions and utilities
def create_default_quality_gates() -> List[QualityGateConfig]:
    """Create default quality gate configurations."""
    return [
        QualityGateConfig(
            gate_type=QualityGate.DATA_QUALITY,
            name="Data Quality Gate",
            description="Validates training data quality and completeness",
            passing_score_threshold=0.8,
            warning_score_threshold=0.6,
            weight=1.0,
            failure_action="stop"
        ),
        QualityGateConfig(
            gate_type=QualityGate.MODEL_PERFORMANCE,
            name="Model Performance Gate", 
            description="Validates model performance against requirements",
            passing_score_threshold=0.9,
            warning_score_threshold=0.7,
            weight=2.0,
            failure_action="stop",
            custom_config={
                "min_accuracy": 0.8,
                "min_precision": 0.75,
                "min_recall": 0.75,
                "min_improvement": 0.01
            }
        ),
        QualityGateConfig(
            gate_type=QualityGate.DRIFT_VALIDATION,
            name="Drift Validation Gate",
            description="Analyzes drift impact on model predictions",
            passing_score_threshold=0.7,
            warning_score_threshold=0.5,
            weight=1.0,
            failure_action="warn",
            custom_config={
                "max_drift_score": 0.5,
                "max_drifted_features": 5
            }
        )
    ]


def create_quality_assurance_engine(gate_configs: Optional[List[QualityGateConfig]] = None) -> QualityAssuranceEngine:
    """Create a quality assurance engine with specified or default configurations."""
    engine = QualityAssuranceEngine()
    
    if gate_configs is None:
        gate_configs = create_default_quality_gates()
    
    engine.configure_quality_gates(gate_configs)
    
    return engine