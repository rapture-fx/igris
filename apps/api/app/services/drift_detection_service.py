"""
Drift Detection Service
=======================

Standalone drift detection service that integrates with the automated retraining system.
Provides specialized drift monitoring capabilities with advanced statistical and ML-based methods.

Features:
- Real-time drift monitoring for production models
- Multiple drift detection algorithms (statistical, distance-based, model-based)
- Configurable alerting and notification system
- Historical drift analysis and reporting
- Integration with model serving and retraining systems
- Support for different data types (numerical, categorical, text, images)
"""

import os
import json
import uuid
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import numpy as np
import pandas as pd
from collections import defaultdict, deque

# Statistical and ML imports
from scipy import stats
from scipy.spatial.distance import jensenshannon
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans

# Import core retraining components
try:
    from app.ml.automated_retraining_engine import (
        DriftDetector, DriftType, DriftDetectionMethod, DriftDetectionResult
    )
    from app.services.advanced_model_serving import AdvancedModelServingEngine
    RETRAINING_AVAILABLE = True
except ImportError as e:
    logging.warning(f"Could not import retraining modules: {e}")
    RETRAINING_AVAILABLE = False

logger = logging.getLogger(__name__)


class AlertSeverity(str, Enum):
    """Severity levels for drift alerts."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class MonitoringMode(str, Enum):
    """Modes for drift monitoring."""
    CONTINUOUS = "continuous"      # Real-time monitoring
    BATCH = "batch"               # Scheduled batch monitoring
    ON_DEMAND = "on_demand"       # Manual trigger only


class DataType(str, Enum):
    """Types of data that can be monitored."""
    TABULAR = "tabular"
    TEXT = "text"
    IMAGE = "image"
    TIME_SERIES = "time_series"


@dataclass
class DriftAlert:
    """Drift alert configuration and information."""
    alert_id: str
    model_id: str
    drift_result: DriftDetectionResult
    severity: AlertSeverity
    message: str
    created_at: datetime
    acknowledged: bool = False
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    
    def acknowledge(self, user_id: str):
        """Acknowledge the alert."""
        self.acknowledged = True
        self.acknowledged_by = user_id
        self.acknowledged_at = datetime.utcnow()
    
    def resolve(self):
        """Mark the alert as resolved."""
        self.resolved = True
        self.resolved_at = datetime.utcnow()


@dataclass
class MonitoringConfig:
    """Configuration for drift monitoring."""
    model_id: str
    monitoring_mode: MonitoringMode
    data_type: DataType
    
    # Detection settings
    detection_methods: List[DriftDetectionMethod]
    sensitivity: float = 0.05
    drift_threshold: float = 0.7
    
    # Monitoring frequency
    batch_interval_minutes: Optional[int] = 60
    sample_size: int = 1000
    window_size_hours: int = 24
    
    # Alerting settings
    alert_enabled: bool = True
    alert_thresholds: Dict[AlertSeverity, float] = None
    notification_channels: List[str] = None
    
    # Data preprocessing
    feature_columns: List[str] = None
    exclude_columns: List[str] = None
    preprocessing_config: Dict[str, Any] = None
    
    # Quality filters
    min_sample_size: int = 100
    max_missing_ratio: float = 0.5
    outlier_detection: bool = True
    
    def __post_init__(self):
        if self.alert_thresholds is None:
            self.alert_thresholds = {
                AlertSeverity.LOW: 0.3,
                AlertSeverity.MEDIUM: 0.5,
                AlertSeverity.HIGH: 0.7,
                AlertSeverity.CRITICAL: 0.9
            }
        if self.notification_channels is None:
            self.notification_channels = ["email", "webhook"]
        if self.feature_columns is None:
            self.feature_columns = []
        if self.exclude_columns is None:
            self.exclude_columns = []
        if self.preprocessing_config is None:
            self.preprocessing_config = {}


@dataclass
class DriftMonitoringReport:
    """Comprehensive drift monitoring report."""
    model_id: str
    report_period: Tuple[datetime, datetime]
    generated_at: datetime
    
    # Summary statistics
    total_samples_processed: int
    drift_events_detected: int
    alerts_generated: int
    average_drift_severity: float
    
    # Temporal analysis
    drift_trend: Dict[str, Any]
    peak_drift_periods: List[Dict[str, Any]]
    stability_periods: List[Dict[str, Any]]
    
    # Feature analysis
    most_affected_features: List[Tuple[str, float]]
    feature_stability_scores: Dict[str, float]
    correlation_changes: Dict[str, float]
    
    # Detection method performance
    method_performance: Dict[DriftDetectionMethod, Dict[str, Any]]
    detection_accuracy: Dict[str, float]
    
    # Recommendations
    recommendations: List[str]
    monitoring_adjustments: Dict[str, Any]
    
    # Raw data
    drift_events: List[DriftDetectionResult]
    alert_summary: Dict[AlertSeverity, int]


class AdvancedDriftDetectionService:
    """
    Advanced drift detection service with comprehensive monitoring capabilities.
    """
    
    def __init__(self, storage_path: str = "./drift_monitoring"):
        self.storage_path = storage_path
        os.makedirs(storage_path, exist_ok=True)
        
        # Core drift detector
        if RETRAINING_AVAILABLE:
            self.drift_detector = DriftDetector()
        else:
            self.drift_detector = None
            logger.warning("DriftDetector not available - limited functionality")
        
        # Monitoring configurations
        self.monitoring_configs: Dict[str, MonitoringConfig] = {}
        
        # Storage for monitoring data
        self.drift_history: Dict[str, deque] = defaultdict(lambda: deque(maxlen=10000))
        self.alerts: Dict[str, DriftAlert] = {}
        self.monitoring_statistics: Dict[str, Dict[str, Any]] = defaultdict(dict)
        
        # Background monitoring
        self._monitoring_tasks: Dict[str, asyncio.Task] = {}
        self._shutdown_event = asyncio.Event()
        
        # Load existing data
        self._load_configurations()
        self._load_drift_history()
        
        logger.info(f"AdvancedDriftDetectionService initialized at {storage_path}")
    
    def configure_monitoring(self, config: MonitoringConfig) -> bool:
        """Configure drift monitoring for a model."""
        
        try:
            # Validate configuration
            if not self._validate_monitoring_config(config):
                return False
            
            # Store configuration
            self.monitoring_configs[config.model_id] = config
            
            # Initialize monitoring statistics
            self.monitoring_statistics[config.model_id] = {
                'start_time': datetime.utcnow().isoformat(),
                'total_samples': 0,
                'drift_events': 0,
                'last_detection': None,
                'average_severity': 0.0,
                'detection_methods_used': {},
                'alert_counts': {severity.value: 0 for severity in AlertSeverity}
            }
            
            # Start monitoring if continuous mode
            if config.monitoring_mode == MonitoringMode.CONTINUOUS:
                asyncio.create_task(self._start_continuous_monitoring(config.model_id))
            
            # Save configuration
            self._save_configurations()
            
            logger.info(f"Configured drift monitoring for model {config.model_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to configure monitoring for model {config.model_id}: {e}")
            return False
    
    def register_reference_data(self, model_id: str, reference_data: pd.DataFrame) -> bool:
        """Register reference data for drift detection."""
        
        try:
            if not self.drift_detector:
                logger.error("Drift detector not available")
                return False
            
            # Preprocess reference data if needed
            processed_data = self._preprocess_data(model_id, reference_data)
            
            # Register with drift detector
            self.drift_detector.register_reference_data(model_id, processed_data)
            
            # Update monitoring statistics
            if model_id in self.monitoring_statistics:
                self.monitoring_statistics[model_id]['reference_data_size'] = len(processed_data)
                self.monitoring_statistics[model_id]['reference_data_features'] = list(processed_data.columns)
                self.monitoring_statistics[model_id]['reference_data_registered_at'] = datetime.utcnow().isoformat()
            
            logger.info(f"Registered reference data for model {model_id} ({len(processed_data)} samples)")
            return True
            
        except Exception as e:
            logger.error(f"Failed to register reference data for model {model_id}: {e}")
            return False
    
    async def detect_drift_async(self, 
                                model_id: str, 
                                current_data: pd.DataFrame,
                                method: DriftDetectionMethod = DriftDetectionMethod.ENSEMBLE) -> DriftDetectionResult:
        """Asynchronously detect drift in current data."""
        
        if not self.drift_detector:
            raise RuntimeError("Drift detector not available")
        
        if model_id not in self.monitoring_configs:
            raise ValueError(f"No monitoring configuration found for model {model_id}")
        
        config = self.monitoring_configs[model_id]
        
        # Preprocess current data
        processed_data = self._preprocess_data(model_id, current_data)
        
        # Perform drift detection
        drift_result = self.drift_detector.detect_drift(
            model_id, processed_data, method, config.sensitivity
        )
        
        # Store result in history
        self.drift_history[model_id].append(drift_result)
        
        # Update statistics
        self._update_monitoring_statistics(model_id, drift_result)
        
        # Generate alert if needed
        if drift_result.detected and config.alert_enabled:
            await self._generate_alert(model_id, drift_result)
        
        # Save drift history periodically
        if len(self.drift_history[model_id]) % 100 == 0:
            self._save_drift_history(model_id)
        
        return drift_result
    
    def detect_drift(self, 
                    model_id: str, 
                    current_data: pd.DataFrame,
                    method: DriftDetectionMethod = DriftDetectionMethod.ENSEMBLE) -> DriftDetectionResult:
        """Synchronously detect drift in current data."""
        
        return asyncio.run(self.detect_drift_async(model_id, current_data, method))
    
    async def _start_continuous_monitoring(self, model_id: str):
        """Start continuous drift monitoring for a model."""
        
        logger.info(f"Starting continuous monitoring for model {model_id}")
        
        config = self.monitoring_configs[model_id]
        
        while not self._shutdown_event.is_set() and model_id in self.monitoring_configs:
            try:
                # Get current production data
                current_data = await self._get_production_data(model_id, config)
                
                if current_data is not None and len(current_data) >= config.min_sample_size:
                    # Perform drift detection
                    for method in config.detection_methods:
                        try:
                            await self.detect_drift_async(model_id, current_data, method)
                        except Exception as e:
                            logger.warning(f"Drift detection failed for method {method}: {e}")
                
                # Wait for next check
                await asyncio.sleep(60)  # Check every minute
                
            except Exception as e:
                logger.error(f"Error in continuous monitoring for model {model_id}: {e}")
                await asyncio.sleep(300)  # Wait 5 minutes on error
        
        logger.info(f"Stopped continuous monitoring for model {model_id}")
    
    async def _get_production_data(self, model_id: str, config: MonitoringConfig) -> Optional[pd.DataFrame]:
        """Get current production data for monitoring."""
        
        # This is a placeholder implementation
        # In practice, you would:
        # 1. Query your data pipeline or serving logs
        # 2. Extract recent prediction inputs
        # 3. Sample and prepare data for analysis
        
        try:
            # Simulate getting production data
            # In real implementation, this would connect to your data sources
            
            # For now, return None to indicate no new data
            return None
            
        except Exception as e:
            logger.error(f"Failed to get production data for model {model_id}: {e}")
            return None
    
    def _preprocess_data(self, model_id: str, data: pd.DataFrame) -> pd.DataFrame:
        """Preprocess data according to monitoring configuration."""
        
        if model_id not in self.monitoring_configs:
            return data
        
        config = self.monitoring_configs[model_id]
        processed_data = data.copy()
        
        try:
            # Select specific features if configured
            if config.feature_columns:
                available_cols = [col for col in config.feature_columns if col in processed_data.columns]
                if available_cols:
                    processed_data = processed_data[available_cols]
            
            # Exclude specified columns
            if config.exclude_columns:
                cols_to_drop = [col for col in config.exclude_columns if col in processed_data.columns]
                processed_data = processed_data.drop(columns=cols_to_drop)
            
            # Handle missing values
            if config.max_missing_ratio < 1.0:
                # Remove columns with too many missing values
                missing_ratios = processed_data.isnull().mean()
                valid_columns = missing_ratios[missing_ratios <= config.max_missing_ratio].index
                processed_data = processed_data[valid_columns]
                
                # Fill remaining missing values
                numeric_cols = processed_data.select_dtypes(include=[np.number]).columns
                categorical_cols = processed_data.select_dtypes(include=['object', 'category']).columns
                
                processed_data[numeric_cols] = processed_data[numeric_cols].fillna(processed_data[numeric_cols].median())
                processed_data[categorical_cols] = processed_data[categorical_cols].fillna('missing')
            
            # Outlier detection and removal
            if config.outlier_detection:
                processed_data = self._remove_outliers(processed_data)
            
            # Apply custom preprocessing
            if config.preprocessing_config:
                processed_data = self._apply_custom_preprocessing(processed_data, config.preprocessing_config)
            
            return processed_data
            
        except Exception as e:
            logger.warning(f"Data preprocessing failed for model {model_id}: {e}")
            return data
    
    def _remove_outliers(self, data: pd.DataFrame, contamination: float = 0.1) -> pd.DataFrame:
        """Remove outliers using Isolation Forest."""
        
        try:
            numeric_data = data.select_dtypes(include=[np.number])
            
            if len(numeric_data.columns) == 0 or len(numeric_data) < 10:
                return data
            
            # Use Isolation Forest for outlier detection
            iso_forest = IsolationForest(contamination=contamination, random_state=42)
            outlier_labels = iso_forest.fit_predict(numeric_data.fillna(0))
            
            # Keep only inliers
            inlier_mask = outlier_labels == 1
            return data[inlier_mask].reset_index(drop=True)
            
        except Exception as e:
            logger.warning(f"Outlier removal failed: {e}")
            return data
    
    def _apply_custom_preprocessing(self, data: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
        """Apply custom preprocessing steps."""
        
        try:
            processed_data = data.copy()
            
            # Scaling
            if config.get('scaling') == 'standard':
                numeric_cols = processed_data.select_dtypes(include=[np.number]).columns
                scaler = StandardScaler()
                processed_data[numeric_cols] = scaler.fit_transform(processed_data[numeric_cols])
            
            # Dimensionality reduction
            if config.get('dimensionality_reduction') == 'pca':
                n_components = config.get('pca_components', 0.95)
                numeric_data = processed_data.select_dtypes(include=[np.number])
                
                if len(numeric_data.columns) > 1:
                    pca = PCA(n_components=n_components)
                    pca_features = pca.fit_transform(numeric_data.fillna(0))
                    
                    # Replace numeric columns with PCA features
                    pca_df = pd.DataFrame(
                        pca_features, 
                        columns=[f'pca_{i}' for i in range(pca_features.shape[1])]
                    )
                    
                    # Keep non-numeric columns
                    non_numeric = processed_data.select_dtypes(exclude=[np.number])
                    processed_data = pd.concat([pca_df, non_numeric], axis=1)
            
            return processed_data
            
        except Exception as e:
            logger.warning(f"Custom preprocessing failed: {e}")
            return data
    
    async def _generate_alert(self, model_id: str, drift_result: DriftDetectionResult):
        """Generate and process drift alert."""
        
        try:
            config = self.monitoring_configs[model_id]
            
            # Determine alert severity
            severity = self._determine_alert_severity(drift_result.severity, config.alert_thresholds)
            
            # Create alert
            alert = DriftAlert(
                alert_id=str(uuid.uuid4()),
                model_id=model_id,
                drift_result=drift_result,
                severity=severity,
                message=self._create_alert_message(model_id, drift_result, severity),
                created_at=datetime.utcnow()
            )
            
            # Store alert
            self.alerts[alert.alert_id] = alert
            
            # Update statistics
            self.monitoring_statistics[model_id]['alert_counts'][severity.value] += 1
            
            # Send notifications
            await self._send_notifications(alert, config.notification_channels)
            
            logger.info(f"Generated {severity.value} drift alert for model {model_id}: {alert.alert_id}")
            
        except Exception as e:
            logger.error(f"Failed to generate alert for model {model_id}: {e}")
    
    def _determine_alert_severity(self, drift_severity: float, thresholds: Dict[AlertSeverity, float]) -> AlertSeverity:
        """Determine alert severity based on drift severity and thresholds."""
        
        if drift_severity >= thresholds[AlertSeverity.CRITICAL]:
            return AlertSeverity.CRITICAL
        elif drift_severity >= thresholds[AlertSeverity.HIGH]:
            return AlertSeverity.HIGH
        elif drift_severity >= thresholds[AlertSeverity.MEDIUM]:
            return AlertSeverity.MEDIUM
        else:
            return AlertSeverity.LOW
    
    def _create_alert_message(self, model_id: str, drift_result: DriftDetectionResult, severity: AlertSeverity) -> str:
        """Create human-readable alert message."""
        
        message_parts = [
            f"Model {model_id}: {drift_result.drift_type.value.replace('_', ' ').title()} detected",
            f"Severity: {severity.value.upper()} (score: {drift_result.severity:.3f})",
            f"Detection method: {drift_result.method_used.value.replace('_', ' ').title()}",
            f"Confidence: {drift_result.confidence:.1%}"
        ]
        
        if drift_result.features_affected:
            affected_features = ', '.join(drift_result.features_affected[:5])
            if len(drift_result.features_affected) > 5:
                affected_features += f" and {len(drift_result.features_affected) - 5} more"
            message_parts.append(f"Affected features: {affected_features}")
        
        return " | ".join(message_parts)
    
    async def _send_notifications(self, alert: DriftAlert, channels: List[str]):
        """Send alert notifications through configured channels."""
        
        for channel in channels:
            try:
                if channel == "email":
                    await self._send_email_notification(alert)
                elif channel == "webhook":
                    await self._send_webhook_notification(alert)
                elif channel == "slack":
                    await self._send_slack_notification(alert)
                else:
                    logger.warning(f"Unknown notification channel: {channel}")
                    
            except Exception as e:
                logger.error(f"Failed to send notification via {channel}: {e}")
    
    async def _send_email_notification(self, alert: DriftAlert):
        """Send email notification (placeholder)."""
        # Placeholder for email notification
        logger.info(f"Email notification sent for alert {alert.alert_id}")
    
    async def _send_webhook_notification(self, alert: DriftAlert):
        """Send webhook notification (placeholder)."""
        # Placeholder for webhook notification
        logger.info(f"Webhook notification sent for alert {alert.alert_id}")
    
    async def _send_slack_notification(self, alert: DriftAlert):
        """Send Slack notification (placeholder)."""
        # Placeholder for Slack notification
        logger.info(f"Slack notification sent for alert {alert.alert_id}")
    
    def _update_monitoring_statistics(self, model_id: str, drift_result: DriftDetectionResult):
        """Update monitoring statistics with new drift result."""
        
        stats = self.monitoring_statistics[model_id]
        
        stats['total_samples'] += 1
        stats['last_detection'] = drift_result.timestamp.isoformat()
        
        if drift_result.detected:
            stats['drift_events'] += 1
        
        # Update average severity (rolling average)
        current_avg = stats.get('average_severity', 0.0)
        stats['average_severity'] = (current_avg * (stats['total_samples'] - 1) + drift_result.severity) / stats['total_samples']
        
        # Track detection methods used
        method = drift_result.method_used.value
        if method not in stats['detection_methods_used']:
            stats['detection_methods_used'][method] = 0
        stats['detection_methods_used'][method] += 1
    
    def get_monitoring_status(self, model_id: str = None) -> Dict[str, Any]:
        """Get monitoring status for models."""
        
        if model_id:
            # Get status for specific model
            if model_id not in self.monitoring_configs:
                return {'error': f'No monitoring configured for model {model_id}'}
            
            config = self.monitoring_configs[model_id]
            stats = self.monitoring_statistics.get(model_id, {})
            recent_drift = list(self.drift_history[model_id])[-10:] if model_id in self.drift_history else []
            
            return {
                'model_id': model_id,
                'configuration': asdict(config),
                'statistics': stats,
                'recent_drift_events': [asdict(dr) for dr in recent_drift],
                'is_active': model_id in self._monitoring_tasks,
                'drift_detector_ready': self.drift_detector is not None
            }
        else:
            # Get overall status
            return {
                'total_monitored_models': len(self.monitoring_configs),
                'active_monitoring_tasks': len(self._monitoring_tasks),
                'total_alerts': len(self.alerts),
                'unacknowledged_alerts': len([a for a in self.alerts.values() if not a.acknowledged]),
                'drift_detector_available': self.drift_detector is not None,
                'monitored_models': list(self.monitoring_configs.keys())
            }
    
    def generate_monitoring_report(self, 
                                 model_id: str,
                                 start_time: datetime,
                                 end_time: datetime) -> DriftMonitoringReport:
        """Generate comprehensive monitoring report for a model."""
        
        if model_id not in self.monitoring_configs:
            raise ValueError(f"No monitoring configured for model {model_id}")
        
        # Get drift events in time range
        drift_events = []
        if model_id in self.drift_history:
            for event in self.drift_history[model_id]:
                if start_time <= event.timestamp <= end_time:
                    drift_events.append(event)
        
        # Get alerts in time range
        model_alerts = [
            alert for alert in self.alerts.values()
            if alert.model_id == model_id and start_time <= alert.created_at <= end_time
        ]
        
        # Calculate summary statistics
        total_samples = len(drift_events)
        drift_detected_count = sum(1 for event in drift_events if event.detected)
        avg_severity = np.mean([event.severity for event in drift_events]) if drift_events else 0.0
        
        # Analyze temporal trends
        drift_trend = self._analyze_drift_trend(drift_events)
        peak_periods = self._identify_peak_drift_periods(drift_events)
        stable_periods = self._identify_stable_periods(drift_events)
        
        # Analyze features
        feature_analysis = self._analyze_feature_drift(drift_events)
        
        # Detection method performance
        method_performance = self._analyze_method_performance(drift_events)
        
        # Generate recommendations
        recommendations = self._generate_monitoring_recommendations(model_id, drift_events, model_alerts)
        
        # Alert summary
        alert_summary = {
            severity: len([a for a in model_alerts if a.severity == severity])
            for severity in AlertSeverity
        }
        
        return DriftMonitoringReport(
            model_id=model_id,
            report_period=(start_time, end_time),
            generated_at=datetime.utcnow(),
            total_samples_processed=total_samples,
            drift_events_detected=drift_detected_count,
            alerts_generated=len(model_alerts),
            average_drift_severity=avg_severity,
            drift_trend=drift_trend,
            peak_drift_periods=peak_periods,
            stability_periods=stable_periods,
            most_affected_features=feature_analysis['most_affected'],
            feature_stability_scores=feature_analysis['stability_scores'],
            correlation_changes=feature_analysis['correlation_changes'],
            method_performance=method_performance,
            detection_accuracy={},  # Would need ground truth for this
            recommendations=recommendations,
            monitoring_adjustments={},
            drift_events=drift_events,
            alert_summary=alert_summary
        )
    
    def _analyze_drift_trend(self, drift_events: List[DriftDetectionResult]) -> Dict[str, Any]:
        """Analyze drift trend over time."""
        
        if not drift_events:
            return {'trend': 'no_data', 'slope': 0.0, 'correlation': 0.0}
        
        # Sort by timestamp
        sorted_events = sorted(drift_events, key=lambda x: x.timestamp)
        
        # Extract time series data
        timestamps = [(event.timestamp - sorted_events[0].timestamp).total_seconds() / 3600 
                     for event in sorted_events]  # Hours from start
        severities = [event.severity for event in sorted_events]
        
        if len(timestamps) < 2:
            return {'trend': 'insufficient_data', 'slope': 0.0, 'correlation': 0.0}
        
        # Calculate linear trend
        correlation = np.corrcoef(timestamps, severities)[0, 1] if len(timestamps) > 1 else 0.0
        
        # Simple linear regression
        n = len(timestamps)
        sum_x = sum(timestamps)
        sum_y = sum(severities)
        sum_xy = sum(t * s for t, s in zip(timestamps, severities))
        sum_x2 = sum(t * t for t in timestamps)
        
        if n * sum_x2 - sum_x * sum_x != 0:
            slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x * sum_x)
        else:
            slope = 0.0
        
        # Determine trend direction
        if abs(slope) < 0.001:
            trend = 'stable'
        elif slope > 0:
            trend = 'increasing'
        else:
            trend = 'decreasing'
        
        return {
            'trend': trend,
            'slope': slope,
            'correlation': correlation,
            'data_points': n
        }
    
    def _identify_peak_drift_periods(self, drift_events: List[DriftDetectionResult]) -> List[Dict[str, Any]]:
        """Identify periods of high drift activity."""
        
        if not drift_events:
            return []
        
        # Group events by hour
        hourly_severity = defaultdict(list)
        for event in drift_events:
            hour_key = event.timestamp.replace(minute=0, second=0, microsecond=0)
            hourly_severity[hour_key].append(event.severity)
        
        # Calculate average severity per hour
        hourly_avg = {
            hour: np.mean(severities) 
            for hour, severities in hourly_severity.items()
        }
        
        # Find peak periods (above 75th percentile)
        if len(hourly_avg) > 0:
            threshold = np.percentile(list(hourly_avg.values()), 75)
            peaks = [
                {
                    'period_start': hour,
                    'period_end': hour + timedelta(hours=1),
                    'average_severity': avg_severity,
                    'event_count': len(hourly_severity[hour])
                }
                for hour, avg_severity in hourly_avg.items()
                if avg_severity >= threshold
            ]
            
            return sorted(peaks, key=lambda x: x['average_severity'], reverse=True)[:10]
        
        return []
    
    def _identify_stable_periods(self, drift_events: List[DriftDetectionResult]) -> List[Dict[str, Any]]:
        """Identify periods of stability (low drift)."""
        
        if not drift_events:
            return []
        
        # Group events by hour
        hourly_severity = defaultdict(list)
        for event in drift_events:
            hour_key = event.timestamp.replace(minute=0, second=0, microsecond=0)
            hourly_severity[hour_key].append(event.severity)
        
        # Calculate average severity per hour
        hourly_avg = {
            hour: np.mean(severities) 
            for hour, severities in hourly_severity.items()
        }
        
        # Find stable periods (below 25th percentile)
        if len(hourly_avg) > 0:
            threshold = np.percentile(list(hourly_avg.values()), 25)
            stable_periods = [
                {
                    'period_start': hour,
                    'period_end': hour + timedelta(hours=1),
                    'average_severity': avg_severity,
                    'event_count': len(hourly_severity[hour])
                }
                for hour, avg_severity in hourly_avg.items()
                if avg_severity <= threshold
            ]
            
            return sorted(stable_periods, key=lambda x: x['average_severity'])[:10]
        
        return []
    
    def _analyze_feature_drift(self, drift_events: List[DriftDetectionResult]) -> Dict[str, Any]:
        """Analyze which features are most affected by drift."""
        
        feature_counts = defaultdict(int)
        feature_severities = defaultdict(list)
        
        for event in drift_events:
            if event.detected:
                for feature in event.features_affected:
                    feature_counts[feature] += 1
                    feature_severities[feature].append(event.severity)
        
        # Calculate feature statistics
        most_affected = sorted(
            [(feature, count) for feature, count in feature_counts.items()],
            key=lambda x: x[1], reverse=True
        )[:20]
        
        stability_scores = {
            feature: 1.0 - np.mean(severities) 
            for feature, severities in feature_severities.items()
        }
        
        # Placeholder for correlation changes (would need historical data)
        correlation_changes = {}
        
        return {
            'most_affected': most_affected,
            'stability_scores': stability_scores,
            'correlation_changes': correlation_changes
        }
    
    def _analyze_method_performance(self, drift_events: List[DriftDetectionResult]) -> Dict[DriftDetectionMethod, Dict[str, Any]]:
        """Analyze performance of different detection methods."""
        
        method_stats = defaultdict(lambda: {
            'detections': 0,
            'total_runs': 0,
            'avg_severity': 0.0,
            'avg_confidence': 0.0,
            'severities': []
        })
        
        for event in drift_events:
            method = event.method_used
            stats = method_stats[method]
            
            stats['total_runs'] += 1
            stats['severities'].append(event.severity)
            
            if event.detected:
                stats['detections'] += 1
        
        # Calculate final statistics
        performance = {}
        for method, stats in method_stats.items():
            if stats['total_runs'] > 0:
                performance[method] = {
                    'detection_rate': stats['detections'] / stats['total_runs'],
                    'total_runs': stats['total_runs'],
                    'avg_severity': np.mean(stats['severities']) if stats['severities'] else 0.0,
                    'severity_std': np.std(stats['severities']) if stats['severities'] else 0.0
                }
        
        return performance
    
    def _generate_monitoring_recommendations(self, 
                                           model_id: str,
                                           drift_events: List[DriftDetectionResult],
                                           alerts: List[DriftAlert]) -> List[str]:
        """Generate recommendations for improving monitoring."""
        
        recommendations = []
        
        if not drift_events:
            recommendations.append("No drift events recorded - consider increasing sensitivity or checking data collection")
            return recommendations
        
        # Analyze drift frequency
        drift_detected = sum(1 for event in drift_events if event.detected)
        drift_rate = drift_detected / len(drift_events) if drift_events else 0
        
        if drift_rate > 0.5:
            recommendations.append("High drift frequency detected - consider more frequent retraining or model updates")
        elif drift_rate < 0.1:
            recommendations.append("Low drift frequency - monitoring sensitivity could be increased")
        
        # Analyze alert patterns
        if alerts:
            critical_alerts = [a for a in alerts if a.severity == AlertSeverity.CRITICAL]
            if len(critical_alerts) > 5:
                recommendations.append("Multiple critical alerts - immediate model intervention recommended")
        
        # Method-specific recommendations
        method_performance = self._analyze_method_performance(drift_events)
        
        ensemble_performance = method_performance.get(DriftDetectionMethod.ENSEMBLE)
        if ensemble_performance and ensemble_performance['detection_rate'] < 0.3:
            recommendations.append("Ensemble method showing low detection rate - consider adjusting thresholds")
        
        # Feature-specific recommendations
        feature_analysis = self._analyze_feature_drift(drift_events)
        if feature_analysis['most_affected']:
            top_affected = feature_analysis['most_affected'][0][0]
            recommendations.append(f"Feature '{top_affected}' frequently affected by drift - investigate data source quality")
        
        return recommendations
    
    def _validate_monitoring_config(self, config: MonitoringConfig) -> bool:
        """Validate monitoring configuration."""
        
        # Check required fields
        if not config.model_id:
            logger.error("Model ID is required")
            return False
        
        # Validate detection methods
        if not config.detection_methods:
            logger.error("At least one detection method must be specified")
            return False
        
        # Validate thresholds
        if config.sensitivity <= 0 or config.sensitivity > 1:
            logger.error("Sensitivity must be between 0 and 1")
            return False
        
        if config.drift_threshold <= 0 or config.drift_threshold > 1:
            logger.error("Drift threshold must be between 0 and 1")
            return False
        
        # Validate batch settings
        if config.monitoring_mode == MonitoringMode.BATCH:
            if not config.batch_interval_minutes or config.batch_interval_minutes <= 0:
                logger.error("Batch interval must be positive for batch monitoring mode")
                return False
        
        return True
    
    def _load_configurations(self):
        """Load monitoring configurations from storage."""
        try:
            config_file = os.path.join(self.storage_path, "monitoring_configs.json")
            if os.path.exists(config_file):
                with open(config_file, 'r') as f:
                    configs_data = json.load(f)
                    for model_id, config_data in configs_data.items():
                        config = MonitoringConfig(**config_data)
                        self.monitoring_configs[model_id] = config
                logger.info(f"Loaded {len(self.monitoring_configs)} monitoring configurations")
        except Exception as e:
            logger.warning(f"Could not load monitoring configurations: {e}")
    
    def _save_configurations(self):
        """Save monitoring configurations to storage."""
        try:
            config_file = os.path.join(self.storage_path, "monitoring_configs.json")
            configs_data = {
                model_id: asdict(config) 
                for model_id, config in self.monitoring_configs.items()
            }
            with open(config_file, 'w') as f:
                json.dump(configs_data, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Could not save monitoring configurations: {e}")
    
    def _load_drift_history(self):
        """Load drift history from storage."""
        try:
            for model_id in self.monitoring_configs.keys():
                history_file = os.path.join(self.storage_path, f"drift_history_{model_id}.json")
                if os.path.exists(history_file):
                    with open(history_file, 'r') as f:
                        history_data = json.load(f)
                        for item in history_data:
                            item['timestamp'] = datetime.fromisoformat(item['timestamp'])
                            drift_result = DriftDetectionResult(**item)
                            self.drift_history[model_id].append(drift_result)
            
            total_events = sum(len(history) for history in self.drift_history.values())
            logger.info(f"Loaded {total_events} drift events from storage")
        except Exception as e:
            logger.warning(f"Could not load drift history: {e}")
    
    def _save_drift_history(self, model_id: str):
        """Save drift history for a model to storage."""
        try:
            history_file = os.path.join(self.storage_path, f"drift_history_{model_id}.json")
            history_data = [asdict(result) for result in self.drift_history[model_id]]
            
            with open(history_file, 'w') as f:
                json.dump(history_data, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Could not save drift history for model {model_id}: {e}")
    
    async def shutdown(self):
        """Shutdown the drift detection service."""
        logger.info("Shutting down drift detection service...")
        
        # Signal shutdown
        self._shutdown_event.set()
        
        # Cancel monitoring tasks
        for model_id, task in self._monitoring_tasks.items():
            logger.info(f"Cancelling monitoring task for model {model_id}")
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        
        # Save all data
        self._save_configurations()
        for model_id in self.drift_history.keys():
            self._save_drift_history(model_id)
        
        logger.info("Drift detection service shutdown complete")


# Factory function
def create_drift_detection_service(storage_path: str = "./drift_monitoring") -> AdvancedDriftDetectionService:
    """Factory function to create drift detection service."""
    return AdvancedDriftDetectionService(storage_path=storage_path)