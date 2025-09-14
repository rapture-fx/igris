"""
ML Model Performance Monitoring System

Real-time monitoring of ML model performance, drift detection, and automated alerting.
Provides comprehensive insights into model health, data quality, and performance degradation.
"""

import uuid
import json
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Union, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import numpy as np
import pandas as pd
from collections import deque, defaultdict
import hashlib

from app.core.config import settings
from app.core.error_tracking import capture_exception, ErrorSeverity, ErrorCategory
from app.core.metrics import metrics_collector
from app.database.connection import get_async_session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func

logger = logging.getLogger(__name__)

class AlertSeverity(str, Enum):
    """Alert severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class DriftType(str, Enum):
    """Types of drift detection"""
    DATA_DRIFT = "data_drift"
    CONCEPT_DRIFT = "concept_drift"
    PREDICTION_DRIFT = "prediction_drift"
    TARGET_DRIFT = "target_drift"

class ModelStatus(str, Enum):
    """Model status states"""
    HEALTHY = "healthy"
    WARNING = "warning"
    DEGRADED = "degraded"
    CRITICAL = "critical"
    OFFLINE = "offline"

@dataclass
class PerformanceMetrics:
    """ML model performance metrics"""
    model_id: str
    timestamp: datetime
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1_score: Optional[float] = None
    auc_score: Optional[float] = None
    mae: Optional[float] = None
    mse: Optional[float] = None
    rmse: Optional[float] = None
    r2_score: Optional[float] = None
    prediction_latency: Optional[float] = None
    throughput: Optional[float] = None
    error_rate: Optional[float] = None
    confidence_score: Optional[float] = None

@dataclass
class DriftAlert:
    """Drift detection alert"""
    alert_id: str
    model_id: str
    drift_type: DriftType
    severity: AlertSeverity
    drift_score: float
    threshold: float
    affected_features: List[str]
    timestamp: datetime
    message: str
    recommendations: List[str]
    metadata: Dict[str, Any]

@dataclass
class ModelHealthSummary:
    """Overall model health summary"""
    model_id: str
    status: ModelStatus
    overall_score: float
    performance_score: float
    drift_score: float
    data_quality_score: float
    last_updated: datetime
    active_alerts: List[DriftAlert]
    trends: Dict[str, Any]
    recommendations: List[str]

class MLPerformanceMonitor:
    """
    Comprehensive ML model performance monitoring system

    Features:
    - Real-time performance tracking
    - Statistical drift detection
    - Automated alerting and notifications
    - Performance trend analysis
    - Data quality monitoring
    - Model health scoring
    - A/B testing support
    """

    def __init__(self):
        self.metrics_buffer = defaultdict(lambda: deque(maxlen=1000))
        self.drift_detectors = {}
        self.baseline_stats = {}
        self.alert_thresholds = self._load_default_thresholds()
        self.monitoring_active = True

    def _load_default_thresholds(self) -> Dict[str, float]:
        """Load default alert thresholds"""
        return {
            "accuracy_drop": 0.05,           # 5% accuracy drop
            "data_drift_threshold": 0.1,     # PSI threshold
            "concept_drift_threshold": 0.15, # Performance degradation
            "prediction_drift_threshold": 0.1, # Prediction distribution change
            "error_rate_threshold": 0.05,    # 5% error rate
            "latency_threshold": 2.0,        # 2x baseline latency
            "confidence_drop": 0.1           # 10% confidence drop
        }

    async def track_model_prediction(
        self,
        model_id: str,
        prediction_data: Dict[str, Any],
        actual_value: Optional[Union[float, str]] = None,
        confidence: Optional[float] = None,
        processing_time: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Track individual model prediction for monitoring

        Args:
            model_id: Unique model identifier
            prediction_data: Input features and prediction
            actual_value: True target value (if available)
            confidence: Model confidence score
            processing_time: Prediction processing time
            metadata: Additional metadata

        Returns:
            Tracking ID for this prediction
        """

        tracking_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc)

        try:
            # Store prediction data for monitoring
            prediction_record = {
                "tracking_id": tracking_id,
                "model_id": model_id,
                "timestamp": timestamp,
                "features": prediction_data.get("features", {}),
                "prediction": prediction_data.get("prediction"),
                "actual_value": actual_value,
                "confidence": confidence,
                "processing_time": processing_time,
                "metadata": metadata or {}
            }

            # Add to buffer for real-time monitoring
            self.metrics_buffer[model_id].append(prediction_record)

            # Store in database for persistence
            await self._store_prediction_record(prediction_record)

            # Check for drift if we have sufficient data
            if len(self.metrics_buffer[model_id]) >= 50:
                await self._check_for_drift(model_id)

            # Update real-time metrics
            await self._update_realtime_metrics(model_id, prediction_record)

            return tracking_id

        except Exception as e:
            logger.error(f"Failed to track prediction for model {model_id}: {e}")
            capture_exception(
                e,
                severity=ErrorSeverity.MEDIUM,
                category=ErrorCategory.DATA_TRACKING,
                extra_data={"model_id": model_id}
            )
            return tracking_id

    async def update_model_performance(
        self,
        model_id: str,
        performance_metrics: PerformanceMetrics,
        batch_size: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Update model performance metrics

        Args:
            model_id: Model identifier
            performance_metrics: Performance metrics
            batch_size: Size of evaluation batch

        Returns:
            Update result with alerts
        """

        try:
            timestamp = datetime.now(timezone.utc)

            # Store performance metrics
            await self._store_performance_metrics(performance_metrics)

            # Check for performance degradation
            alerts = await self._check_performance_degradation(model_id, performance_metrics)

            # Update model health status
            health_summary = await self._update_model_health(model_id)

            # Send metrics to monitoring system
            await self._send_metrics_to_monitoring(model_id, performance_metrics)

            logger.info(f"Updated performance metrics for model {model_id}")

            return {
                "success": True,
                "model_id": model_id,
                "timestamp": timestamp.isoformat(),
                "alerts_triggered": len(alerts),
                "alerts": [asdict(alert) for alert in alerts],
                "health_status": health_summary.status.value if health_summary else "unknown",
                "batch_size": batch_size
            }

        except Exception as e:
            logger.error(f"Failed to update performance metrics for model {model_id}: {e}")
            capture_exception(
                e,
                severity=ErrorSeverity.HIGH,
                category=ErrorCategory.MONITORING,
                extra_data={"model_id": model_id}
            )
            return {"success": False, "error": str(e)}

    async def detect_data_drift(
        self,
        model_id: str,
        new_data: pd.DataFrame,
        reference_data: Optional[pd.DataFrame] = None
    ) -> Dict[str, Any]:
        """
        Detect data drift using statistical methods

        Args:
            model_id: Model identifier
            new_data: New data to check for drift
            reference_data: Reference baseline data

        Returns:
            Drift detection results
        """

        try:
            # Get reference data if not provided
            if reference_data is None:
                reference_data = await self._get_baseline_data(model_id)

            if reference_data is None or len(reference_data) == 0:
                return {"error": "No reference data available for drift detection"}

            # Calculate drift metrics
            drift_results = {}
            drift_alerts = []

            # Population Stability Index (PSI) for numerical features
            numerical_cols = new_data.select_dtypes(include=[np.number]).columns
            for col in numerical_cols:
                if col in reference_data.columns:
                    psi_score = self._calculate_psi(
                        reference_data[col].values,
                        new_data[col].values
                    )

                    drift_results[col] = {
                        "psi_score": psi_score,
                        "drift_detected": psi_score > self.alert_thresholds["data_drift_threshold"]
                    }

                    # Create alert if drift detected
                    if psi_score > self.alert_thresholds["data_drift_threshold"]:
                        alert = DriftAlert(
                            alert_id=str(uuid.uuid4()),
                            model_id=model_id,
                            drift_type=DriftType.DATA_DRIFT,
                            severity=self._calculate_drift_severity(psi_score),
                            drift_score=psi_score,
                            threshold=self.alert_thresholds["data_drift_threshold"],
                            affected_features=[col],
                            timestamp=datetime.now(timezone.utc),
                            message=f"Data drift detected in feature '{col}' (PSI: {psi_score:.4f})",
                            recommendations=[
                                f"Investigate changes in feature '{col}' distribution",
                                "Consider retraining the model with recent data",
                                "Update feature preprocessing if data source changed"
                            ],
                            metadata={"psi_score": psi_score, "feature": col}
                        )
                        drift_alerts.append(alert)

            # Categorical drift detection using Chi-square test
            categorical_cols = new_data.select_dtypes(include=['object', 'category']).columns
            for col in categorical_cols:
                if col in reference_data.columns:
                    chi2_stat, chi2_p_value = self._calculate_categorical_drift(
                        reference_data[col].values,
                        new_data[col].values
                    )

                    drift_results[col] = {
                        "chi2_statistic": chi2_stat,
                        "p_value": chi2_p_value,
                        "drift_detected": chi2_p_value < 0.05
                    }

                    if chi2_p_value < 0.05:
                        alert = DriftAlert(
                            alert_id=str(uuid.uuid4()),
                            model_id=model_id,
                            drift_type=DriftType.DATA_DRIFT,
                            severity=AlertSeverity.MEDIUM,
                            drift_score=1 - chi2_p_value,
                            threshold=0.05,
                            affected_features=[col],
                            timestamp=datetime.now(timezone.utc),
                            message=f"Categorical drift detected in feature '{col}' (p-value: {chi2_p_value:.4f})",
                            recommendations=[
                                f"Review category distribution changes in '{col}'",
                                "Check for new categories not seen during training",
                                "Update categorical encoding if needed"
                            ],
                            metadata={"chi2_stat": chi2_stat, "p_value": chi2_p_value}
                        )
                        drift_alerts.append(alert)

            # Store alerts
            for alert in drift_alerts:
                await self._store_drift_alert(alert)

            # Calculate overall drift score
            overall_drift_score = np.mean([
                result.get("psi_score", 0) if "psi_score" in result
                else (1 - result.get("p_value", 1))
                for result in drift_results.values()
            ])

            return {
                "model_id": model_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "overall_drift_score": overall_drift_score,
                "drift_detected": len(drift_alerts) > 0,
                "alerts_count": len(drift_alerts),
                "feature_drift_results": drift_results,
                "alerts": [asdict(alert) for alert in drift_alerts],
                "recommendations": self._generate_drift_recommendations(drift_results, drift_alerts)
            }

        except Exception as e:
            logger.error(f"Failed to detect data drift for model {model_id}: {e}")
            capture_exception(
                e,
                severity=ErrorSeverity.HIGH,
                category=ErrorCategory.MONITORING,
                extra_data={"model_id": model_id}
            )
            return {"error": str(e)}

    def _calculate_psi(self, reference: np.ndarray, current: np.ndarray, bins: int = 10) -> float:
        """Calculate Population Stability Index (PSI)"""

        try:
            # Remove NaN values
            reference = reference[~np.isnan(reference)]
            current = current[~np.isnan(current)]

            # Create bins based on reference data
            _, bin_edges = np.histogram(reference, bins=bins)

            # Calculate expected (reference) and actual (current) percentages
            expected_counts, _ = np.histogram(reference, bins=bin_edges)
            actual_counts, _ = np.histogram(current, bins=bin_edges)

            # Convert to percentages
            expected_pct = expected_counts / len(reference)
            actual_pct = actual_counts / len(current)

            # Avoid division by zero
            expected_pct = np.where(expected_pct == 0, 0.0001, expected_pct)
            actual_pct = np.where(actual_pct == 0, 0.0001, actual_pct)

            # Calculate PSI
            psi = np.sum((actual_pct - expected_pct) * np.log(actual_pct / expected_pct))

            return float(psi)

        except Exception as e:
            logger.error(f"Error calculating PSI: {e}")
            return 0.0

    def _calculate_categorical_drift(
        self,
        reference: np.ndarray,
        current: np.ndarray
    ) -> Tuple[float, float]:
        """Calculate categorical drift using Chi-square test"""

        try:
            from scipy.stats import chi2_contingency

            # Get unique categories from both datasets
            ref_categories = pd.Series(reference).value_counts()
            curr_categories = pd.Series(current).value_counts()

            # Align categories
            all_categories = set(ref_categories.index) | set(curr_categories.index)

            ref_counts = []
            curr_counts = []

            for category in all_categories:
                ref_counts.append(ref_categories.get(category, 0))
                curr_counts.append(curr_categories.get(category, 0))

            # Perform Chi-square test
            contingency_table = np.array([ref_counts, curr_counts])
            chi2_stat, p_value, _, _ = chi2_contingency(contingency_table)

            return float(chi2_stat), float(p_value)

        except Exception as e:
            logger.error(f"Error calculating categorical drift: {e}")
            return 0.0, 1.0

    def _calculate_drift_severity(self, psi_score: float) -> AlertSeverity:
        """Calculate drift severity based on PSI score"""

        if psi_score < 0.1:
            return AlertSeverity.LOW
        elif psi_score < 0.2:
            return AlertSeverity.MEDIUM
        elif psi_score < 0.3:
            return AlertSeverity.HIGH
        else:
            return AlertSeverity.CRITICAL

    async def get_model_health_summary(self, model_id: str) -> Optional[ModelHealthSummary]:
        """Get comprehensive model health summary"""

        try:
            # Get recent performance metrics
            recent_metrics = await self._get_recent_performance_metrics(model_id)

            # Get active alerts
            active_alerts = await self._get_active_alerts(model_id)

            # Calculate health scores
            performance_score = self._calculate_performance_score(recent_metrics)
            drift_score = await self._calculate_drift_score(model_id)
            data_quality_score = await self._calculate_data_quality_score(model_id)

            # Overall health score (weighted average)
            overall_score = (
                performance_score * 0.4 +
                drift_score * 0.3 +
                data_quality_score * 0.3
            )

            # Determine status
            status = self._determine_model_status(overall_score, active_alerts)

            # Generate trends
            trends = await self._calculate_performance_trends(model_id)

            # Generate recommendations
            recommendations = self._generate_health_recommendations(
                performance_score, drift_score, data_quality_score, active_alerts
            )

            return ModelHealthSummary(
                model_id=model_id,
                status=status,
                overall_score=overall_score,
                performance_score=performance_score,
                drift_score=drift_score,
                data_quality_score=data_quality_score,
                last_updated=datetime.now(timezone.utc),
                active_alerts=active_alerts,
                trends=trends,
                recommendations=recommendations
            )

        except Exception as e:
            logger.error(f"Failed to get health summary for model {model_id}: {e}")
            return None

    async def create_performance_dashboard_data(
        self,
        model_ids: Optional[List[str]] = None,
        time_range: str = "24h"
    ) -> Dict[str, Any]:
        """
        Create dashboard data for ML performance monitoring

        Args:
            model_ids: List of model IDs to include (all if None)
            time_range: Time range for data (1h, 6h, 24h, 7d, 30d)

        Returns:
            Dashboard data with metrics, alerts, and trends
        """

        try:
            # Parse time range
            time_delta = self._parse_time_range(time_range)
            start_time = datetime.now(timezone.utc) - time_delta

            # Get model list
            if model_ids is None:
                model_ids = await self._get_active_model_ids()

            dashboard_data = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "time_range": time_range,
                "models_count": len(model_ids),
                "models": [],
                "system_overview": {
                    "total_models": len(model_ids),
                    "healthy_models": 0,
                    "models_with_alerts": 0,
                    "total_predictions": 0,
                    "average_latency": 0.0
                },
                "alerts": {
                    "active_alerts": 0,
                    "critical_alerts": 0,
                    "recent_alerts": []
                },
                "performance_trends": {}
            }

            total_predictions = 0
            total_latency = 0
            healthy_models = 0
            models_with_alerts = 0

            # Process each model
            for model_id in model_ids:
                model_data = await self._get_model_dashboard_data(model_id, start_time)
                dashboard_data["models"].append(model_data)

                # Update system overview
                if model_data["status"] == "healthy":
                    healthy_models += 1

                if model_data["active_alerts"] > 0:
                    models_with_alerts += 1

                total_predictions += model_data.get("predictions_count", 0)
                if model_data.get("average_latency", 0) > 0:
                    total_latency += model_data["average_latency"]

            # Update system overview
            dashboard_data["system_overview"].update({
                "healthy_models": healthy_models,
                "models_with_alerts": models_with_alerts,
                "total_predictions": total_predictions,
                "average_latency": total_latency / max(len(model_ids), 1)
            })

            # Get system-wide alerts
            system_alerts = await self._get_recent_alerts(start_time)
            dashboard_data["alerts"].update({
                "active_alerts": len([a for a in system_alerts if a.severity in [AlertSeverity.HIGH, AlertSeverity.CRITICAL]]),
                "critical_alerts": len([a for a in system_alerts if a.severity == AlertSeverity.CRITICAL]),
                "recent_alerts": [asdict(alert) for alert in system_alerts[:20]]  # Last 20 alerts
            })

            return dashboard_data

        except Exception as e:
            logger.error(f"Failed to create dashboard data: {e}")
            return {"error": str(e)}

    def _parse_time_range(self, time_range: str) -> timedelta:
        """Parse time range string to timedelta"""

        time_map = {
            "1h": timedelta(hours=1),
            "6h": timedelta(hours=6),
            "24h": timedelta(hours=24),
            "7d": timedelta(days=7),
            "30d": timedelta(days=30)
        }

        return time_map.get(time_range, timedelta(hours=24))

    def _determine_model_status(self, overall_score: float, active_alerts: List[DriftAlert]) -> ModelStatus:
        """Determine model status based on score and alerts"""

        critical_alerts = [a for a in active_alerts if a.severity == AlertSeverity.CRITICAL]
        high_alerts = [a for a in active_alerts if a.severity == AlertSeverity.HIGH]

        if critical_alerts or overall_score < 0.3:
            return ModelStatus.CRITICAL
        elif high_alerts or overall_score < 0.5:
            return ModelStatus.DEGRADED
        elif active_alerts or overall_score < 0.7:
            return ModelStatus.WARNING
        else:
            return ModelStatus.HEALTHY

    async def _store_prediction_record(self, record: Dict[str, Any]):
        """Store prediction record in database"""
        # Implementation would store in database
        pass

    async def _store_performance_metrics(self, metrics: PerformanceMetrics):
        """Store performance metrics in database"""
        # Implementation would store in database
        pass

    async def _store_drift_alert(self, alert: DriftAlert):
        """Store drift alert in database"""
        # Implementation would store in database
        pass

    async def _check_for_drift(self, model_id: str):
        """Check for drift in buffered data"""
        # Implementation would check for drift
        pass

    async def _update_realtime_metrics(self, model_id: str, record: Dict[str, Any]):
        """Update real-time metrics"""
        # Send metrics to monitoring system
        metrics_collector.record_ml_prediction(
            model_id=model_id,
            prediction_latency=record.get("processing_time", 0),
            confidence=record.get("confidence", 0),
            error_occurred=False
        )

    async def _send_metrics_to_monitoring(self, model_id: str, metrics: PerformanceMetrics):
        """Send metrics to external monitoring system"""
        # Implementation would send to Prometheus/Grafana
        pass

    def _generate_health_recommendations(
        self,
        performance_score: float,
        drift_score: float,
        data_quality_score: float,
        active_alerts: List[DriftAlert]
    ) -> List[str]:
        """Generate health recommendations"""

        recommendations = []

        if performance_score < 0.7:
            recommendations.append("Model performance is below acceptable threshold. Consider retraining.")

        if drift_score < 0.7:
            recommendations.append("Data drift detected. Investigate input data sources.")

        if data_quality_score < 0.7:
            recommendations.append("Data quality issues detected. Review data pipeline.")

        if len(active_alerts) > 5:
            recommendations.append("Multiple alerts active. Review model monitoring configuration.")

        return recommendations

    # Additional helper methods would be implemented here...

# Global instance
ml_performance_monitor = MLPerformanceMonitor()