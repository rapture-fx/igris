"""
Performance Baseline Monitoring and SLA Tracking
===============================================

Provides comprehensive performance monitoring with:
- Baseline establishment and tracking
- SLA definition and monitoring
- Performance regression detection
- Resource utilization tracking
- Predictive performance analysis
"""

import asyncio
import time
import statistics
from typing import Dict, Any, List, Optional, Tuple, Union
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import logging
from collections import defaultdict, deque
import json
import threading
import psutil
import numpy as np
from scipy import stats

from app.core.config import settings
from app.core.advanced_logging import log_structured, LogLevel, LogCategory
from app.core.alerting_system import create_performance_alert, AlertSeverity


class MetricType(str, Enum):
    """Performance metric types"""
    RESPONSE_TIME = "response_time"
    THROUGHPUT = "throughput"
    ERROR_RATE = "error_rate"
    CPU_USAGE = "cpu_usage"
    MEMORY_USAGE = "memory_usage"
    DISK_USAGE = "disk_usage"
    DATABASE_QUERY_TIME = "database_query_time"
    CACHE_HIT_RATE = "cache_hit_rate"
    ML_INFERENCE_TIME = "ml_inference_time"
    RL_TRAINING_TIME = "rl_training_time"


class SLAStatus(str, Enum):
    """SLA compliance status"""
    COMPLIANT = "compliant"
    WARNING = "warning"
    BREACH = "breach"
    CRITICAL = "critical"


@dataclass
class PerformanceMetric:
    """Performance metric data point"""
    metric_type: MetricType
    value: float
    timestamp: datetime
    context: Dict[str, Any] = None
    tags: List[str] = None
    
    def __post_init__(self):
        if self.context is None:
            self.context = {}
        if self.tags is None:
            self.tags = []


@dataclass
class BaselineConfiguration:
    """Baseline configuration for a metric"""
    metric_type: MetricType
    percentile_threshold: float = 95.0  # P95 baseline
    min_samples: int = 100
    baseline_window_hours: int = 24
    regression_threshold_percent: float = 20.0  # 20% regression threshold
    auto_update: bool = True
    update_interval_hours: int = 6


@dataclass
class SLADefinition:
    """Service Level Agreement definition"""
    name: str
    metric_type: MetricType
    target_value: float
    warning_threshold: float
    breach_threshold: float
    measurement_window_minutes: int = 5
    evaluation_interval_minutes: int = 1
    breach_tolerance_percent: float = 1.0  # Allow 1% breach
    context_filters: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.context_filters is None:
            self.context_filters = {}


@dataclass
class PerformanceBaseline:
    """Performance baseline data"""
    metric_type: MetricType
    baseline_value: float
    percentile: float
    sample_size: int
    established_at: datetime
    last_updated: datetime
    confidence_interval: Tuple[float, float]
    variance: float
    trend_direction: str  # "stable", "improving", "degrading"
    
    def is_regression(self, value: float, threshold_percent: float) -> bool:
        """Check if value represents a performance regression"""
        if self.metric_type in [MetricType.RESPONSE_TIME, MetricType.ERROR_RATE, MetricType.CPU_USAGE, MetricType.MEMORY_USAGE]:
            # For these metrics, higher is worse
            regression_threshold = self.baseline_value * (1 + threshold_percent / 100)
            return value > regression_threshold
        else:
            # For metrics like throughput, cache hit rate, lower is worse
            regression_threshold = self.baseline_value * (1 - threshold_percent / 100)
            return value < regression_threshold


@dataclass
class SLAStatus:
    """SLA status information"""
    sla_name: str
    status: str
    current_value: float
    target_value: float
    compliance_percentage: float
    last_evaluation: datetime
    breach_duration_minutes: float = 0.0
    consecutive_breaches: int = 0


class PerformanceTracker:
    """Track performance metrics and maintain baselines"""
    
    def __init__(self, max_data_points: int = 10000):
        self.max_data_points = max_data_points
        self.metrics_data: Dict[MetricType, deque] = defaultdict(lambda: deque(maxlen=max_data_points))
        self.baselines: Dict[MetricType, PerformanceBaseline] = {}
        self.baseline_configs: Dict[MetricType, BaselineConfiguration] = {}
        self.lock = threading.Lock()
        
        # Setup default baseline configurations
        self._setup_default_baseline_configs()
    
    def _setup_default_baseline_configs(self):
        """Setup default baseline configurations"""
        
        # Response time baseline
        self.baseline_configs[MetricType.RESPONSE_TIME] = BaselineConfiguration(
            metric_type=MetricType.RESPONSE_TIME,
            percentile_threshold=95.0,
            min_samples=200,
            baseline_window_hours=24,
            regression_threshold_percent=30.0
        )
        
        # Throughput baseline
        self.baseline_configs[MetricType.THROUGHPUT] = BaselineConfiguration(
            metric_type=MetricType.THROUGHPUT,
            percentile_threshold=50.0,  # Use median for throughput
            min_samples=100,
            baseline_window_hours=24,
            regression_threshold_percent=20.0
        )
        
        # Error rate baseline
        self.baseline_configs[MetricType.ERROR_RATE] = BaselineConfiguration(
            metric_type=MetricType.ERROR_RATE,
            percentile_threshold=95.0,
            min_samples=50,
            baseline_window_hours=48,
            regression_threshold_percent=50.0
        )
        
        # Database query time
        self.baseline_configs[MetricType.DATABASE_QUERY_TIME] = BaselineConfiguration(
            metric_type=MetricType.DATABASE_QUERY_TIME,
            percentile_threshold=90.0,
            min_samples=150,
            baseline_window_hours=12,
            regression_threshold_percent=40.0
        )
        
        # ML inference time
        self.baseline_configs[MetricType.ML_INFERENCE_TIME] = BaselineConfiguration(
            metric_type=MetricType.ML_INFERENCE_TIME,
            percentile_threshold=95.0,
            min_samples=100,
            baseline_window_hours=6,
            regression_threshold_percent=25.0
        )
    
    def record_metric(self, metric: PerformanceMetric):
        """Record a performance metric"""
        with self.lock:
            self.metrics_data[metric.metric_type].append(metric)
        
        # Check for baseline establishment/update
        if metric.metric_type in self.baseline_configs:
            asyncio.create_task(self._check_baseline_update(metric.metric_type))
    
    async def _check_baseline_update(self, metric_type: MetricType):
        """Check if baseline needs to be established or updated"""
        config = self.baseline_configs.get(metric_type)
        if not config:
            return
        
        with self.lock:
            data_points = list(self.metrics_data[metric_type])
        
        # Check if we have enough data to establish/update baseline
        if len(data_points) < config.min_samples:
            return
        
        # Get recent data within baseline window
        cutoff_time = datetime.utcnow() - timedelta(hours=config.baseline_window_hours)
        recent_data = [dp for dp in data_points if dp.timestamp >= cutoff_time]
        
        if len(recent_data) < config.min_samples:
            return
        
        # Check if we need to update existing baseline
        current_baseline = self.baselines.get(metric_type)
        if current_baseline:
            time_since_update = datetime.utcnow() - current_baseline.last_updated
            if not config.auto_update or time_since_update.total_seconds() < (config.update_interval_hours * 3600):
                return
        
        # Calculate new baseline
        await self._calculate_baseline(metric_type, recent_data, config)
    
    async def _calculate_baseline(self, metric_type: MetricType, data_points: List[PerformanceMetric], config: BaselineConfiguration):
        """Calculate baseline for metric type"""
        try:
            values = [dp.value for dp in data_points]
            
            # Calculate statistics
            baseline_value = np.percentile(values, config.percentile_threshold)
            mean_value = statistics.mean(values)
            variance = statistics.variance(values) if len(values) > 1 else 0.0
            
            # Calculate confidence interval
            if len(values) > 30:
                confidence_interval = stats.t.interval(
                    0.95, len(values)-1, loc=mean_value, 
                    scale=stats.sem(values)
                )
            else:
                confidence_interval = (baseline_value * 0.9, baseline_value * 1.1)
            
            # Determine trend
            trend_direction = self._calculate_trend(values)
            
            # Create or update baseline
            baseline = PerformanceBaseline(
                metric_type=metric_type,
                baseline_value=baseline_value,
                percentile=config.percentile_threshold,
                sample_size=len(data_points),
                established_at=self.baselines.get(metric_type, {}).get('established_at', datetime.utcnow()) or datetime.utcnow(),
                last_updated=datetime.utcnow(),
                confidence_interval=confidence_interval,
                variance=variance,
                trend_direction=trend_direction
            )
            
            with self.lock:
                old_baseline = self.baselines.get(metric_type)
                self.baselines[metric_type] = baseline
            
            # Log baseline update
            log_structured(
                LogLevel.INFO,
                f"Performance baseline updated for {metric_type}",
                category=LogCategory.PERFORMANCE,
                metric_type=metric_type.value,
                baseline_value=baseline_value,
                sample_size=len(data_points),
                trend=trend_direction,
                previous_baseline=old_baseline.baseline_value if old_baseline else None
            )
            
            # Check for significant baseline changes
            if old_baseline:
                change_percent = abs(baseline_value - old_baseline.baseline_value) / old_baseline.baseline_value * 100
                if change_percent > 15.0:  # 15% change threshold
                    await create_performance_alert(
                        title=f"Significant Baseline Change Detected",
                        description=f"Performance baseline for {metric_type.value} changed by {change_percent:.1f}%. "
                                  f"Previous: {old_baseline.baseline_value:.2f}, New: {baseline_value:.2f}",
                        severity=AlertSeverity.MEDIUM if change_percent < 30 else AlertSeverity.HIGH,
                        metadata={
                            "metric_type": metric_type.value,
                            "change_percent": change_percent,
                            "old_baseline": old_baseline.baseline_value,
                            "new_baseline": baseline_value,
                            "trend": trend_direction
                        }
                    )
        
        except Exception as e:
            log_structured(
                LogLevel.ERROR,
                f"Failed to calculate baseline for {metric_type}: {str(e)}",
                category=LogCategory.PERFORMANCE,
                metric_type=metric_type.value,
                error_type="baseline_calculation_failed"
            )
    
    def _calculate_trend(self, values: List[float]) -> str:
        """Calculate trend direction for values"""
        if len(values) < 10:
            return "stable"
        
        # Use linear regression to determine trend
        x = np.arange(len(values))
        slope, _, r_value, p_value, _ = stats.linregress(x, values)
        
        # Consider trend significant if r_value > 0.3 and p_value < 0.05
        if abs(r_value) > 0.3 and p_value < 0.05:
            return "improving" if slope < 0 else "degrading"  # Assuming lower values are better
        
        return "stable"
    
    def check_regression(self, metric_type: MetricType, value: float) -> Optional[Dict[str, Any]]:
        """Check if value represents a performance regression"""
        baseline = self.baselines.get(metric_type)
        config = self.baseline_configs.get(metric_type)
        
        if not baseline or not config:
            return None
        
        if baseline.is_regression(value, config.regression_threshold_percent):
            return {
                "is_regression": True,
                "current_value": value,
                "baseline_value": baseline.baseline_value,
                "regression_percent": abs(value - baseline.baseline_value) / baseline.baseline_value * 100,
                "threshold_percent": config.regression_threshold_percent
            }
        
        return {"is_regression": False}
    
    def get_baseline(self, metric_type: MetricType) -> Optional[PerformanceBaseline]:
        """Get baseline for metric type"""
        return self.baselines.get(metric_type)
    
    def get_recent_metrics(self, metric_type: MetricType, minutes: int = 60) -> List[PerformanceMetric]:
        """Get recent metrics for a type"""
        cutoff_time = datetime.utcnow() - timedelta(minutes=minutes)
        with self.lock:
            data_points = list(self.metrics_data[metric_type])
        
        return [dp for dp in data_points if dp.timestamp >= cutoff_time]
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Get performance summary"""
        summary = {
            "baselines_established": len(self.baselines),
            "total_metrics": sum(len(data) for data in self.metrics_data.values()),
            "metric_types": list(self.metrics_data.keys()),
            "baseline_details": {}
        }
        
        for metric_type, baseline in self.baselines.items():
            summary["baseline_details"][metric_type.value] = {
                "baseline_value": baseline.baseline_value,
                "sample_size": baseline.sample_size,
                "last_updated": baseline.last_updated.isoformat(),
                "trend": baseline.trend_direction,
                "confidence_interval": baseline.confidence_interval
            }
        
        return summary


class SLAMonitor:
    """Monitor Service Level Agreements"""
    
    def __init__(self, performance_tracker: PerformanceTracker):
        self.performance_tracker = performance_tracker
        self.sla_definitions: Dict[str, SLADefinition] = {}
        self.sla_statuses: Dict[str, SLAStatus] = {}
        self.breach_history: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        self.lock = threading.Lock()
        
        # Setup default SLAs
        self._setup_default_slas()
        
        # Start SLA monitoring
        self._start_monitoring()
    
    def _setup_default_slas(self):
        """Setup default SLA definitions"""
        
        # API Response Time SLA
        self.sla_definitions["api_response_time"] = SLADefinition(
            name="API Response Time",
            metric_type=MetricType.RESPONSE_TIME,
            target_value=200.0,  # 200ms target
            warning_threshold=500.0,  # 500ms warning
            breach_threshold=1000.0,  # 1s breach
            measurement_window_minutes=5,
            breach_tolerance_percent=5.0  # Allow 5% breach
        )
        
        # API Error Rate SLA
        self.sla_definitions["api_error_rate"] = SLADefinition(
            name="API Error Rate",
            metric_type=MetricType.ERROR_RATE,
            target_value=1.0,  # 1% target
            warning_threshold=2.5,  # 2.5% warning
            breach_threshold=5.0,  # 5% breach
            measurement_window_minutes=10,
            breach_tolerance_percent=0.0  # No tolerance for error rate
        )
        
        # Database Query Time SLA
        self.sla_definitions["database_query_time"] = SLADefinition(
            name="Database Query Time",
            metric_type=MetricType.DATABASE_QUERY_TIME,
            target_value=50.0,  # 50ms target
            warning_threshold=100.0,  # 100ms warning
            breach_threshold=200.0,  # 200ms breach
            measurement_window_minutes=5
        )
        
        # ML Inference Time SLA
        self.sla_definitions["ml_inference_time"] = SLADefinition(
            name="ML Inference Time",
            metric_type=MetricType.ML_INFERENCE_TIME,
            target_value=500.0,  # 500ms target
            warning_threshold=1000.0,  # 1s warning
            breach_threshold=2000.0,  # 2s breach
            measurement_window_minutes=3
        )
        
        # System CPU Usage SLA
        self.sla_definitions["cpu_usage"] = SLADefinition(
            name="System CPU Usage",
            metric_type=MetricType.CPU_USAGE,
            target_value=70.0,  # 70% target
            warning_threshold=85.0,  # 85% warning
            breach_threshold=95.0,  # 95% breach
            measurement_window_minutes=5
        )
        
        # System Memory Usage SLA
        self.sla_definitions["memory_usage"] = SLADefinition(
            name="System Memory Usage",
            metric_type=MetricType.MEMORY_USAGE,
            target_value=80.0,  # 80% target
            warning_threshold=90.0,  # 90% warning
            breach_threshold=95.0,  # 95% breach
            measurement_window_minutes=5
        )
    
    def _start_monitoring(self):
        """Start SLA monitoring task"""
        asyncio.create_task(self._monitoring_loop())
    
    async def _monitoring_loop(self):
        """Main SLA monitoring loop"""
        while True:
            try:
                await self._evaluate_slas()
                await asyncio.sleep(60)  # Check every minute
            except Exception as e:
                log_structured(
                    LogLevel.ERROR,
                    f"Error in SLA monitoring loop: {str(e)}",
                    category=LogCategory.PERFORMANCE,
                    error_type="sla_monitoring_error"
                )
                await asyncio.sleep(60)
    
    async def _evaluate_slas(self):
        """Evaluate all SLA definitions"""
        for sla_name, sla_def in self.sla_definitions.items():
            await self._evaluate_single_sla(sla_name, sla_def)
    
    async def _evaluate_single_sla(self, sla_name: str, sla_def: SLADefinition):
        """Evaluate a single SLA"""
        try:
            # Get recent metrics
            recent_metrics = self.performance_tracker.get_recent_metrics(
                sla_def.metric_type, 
                sla_def.measurement_window_minutes
            )
            
            if not recent_metrics:
                return
            
            # Calculate current value (use appropriate aggregation)
            values = [m.value for m in recent_metrics]
            
            if sla_def.metric_type in [MetricType.RESPONSE_TIME, MetricType.DATABASE_QUERY_TIME, MetricType.ML_INFERENCE_TIME]:
                # Use P95 for response times
                current_value = np.percentile(values, 95) if values else 0
            elif sla_def.metric_type == MetricType.ERROR_RATE:
                # Use average for error rate
                current_value = statistics.mean(values) if values else 0
            else:
                # Use average for other metrics
                current_value = statistics.mean(values) if values else 0
            
            # Determine SLA status
            if current_value <= sla_def.target_value:
                status = "compliant"
                compliance_percentage = 100.0
            elif current_value <= sla_def.warning_threshold:
                status = "warning"
                compliance_percentage = max(0, (sla_def.warning_threshold - current_value) / (sla_def.warning_threshold - sla_def.target_value) * 100)
            elif current_value <= sla_def.breach_threshold:
                status = "breach"
                compliance_percentage = max(0, (sla_def.breach_threshold - current_value) / (sla_def.breach_threshold - sla_def.warning_threshold) * 50)
            else:
                status = "critical"
                compliance_percentage = 0.0
            
            # Update SLA status
            with self.lock:
                old_status = self.sla_statuses.get(sla_name)
                
                self.sla_statuses[sla_name] = SLAStatus(
                    sla_name=sla_name,
                    status=status,
                    current_value=current_value,
                    target_value=sla_def.target_value,
                    compliance_percentage=compliance_percentage,
                    last_evaluation=datetime.utcnow(),
                    breach_duration_minutes=self._calculate_breach_duration(sla_name, status),
                    consecutive_breaches=self._calculate_consecutive_breaches(sla_name, status)
                )
            
            # Handle status changes and alerts
            await self._handle_sla_status_change(sla_name, sla_def, old_status, self.sla_statuses[sla_name])
        
        except Exception as e:
            log_structured(
                LogLevel.ERROR,
                f"Failed to evaluate SLA {sla_name}: {str(e)}",
                category=LogCategory.PERFORMANCE,
                sla_name=sla_name,
                error_type="sla_evaluation_failed"
            )
    
    def _calculate_breach_duration(self, sla_name: str, current_status: str) -> float:
        """Calculate breach duration in minutes"""
        if current_status in ["compliant", "warning"]:
            return 0.0
        
        # Look through breach history to find start of current breach period
        breach_start = None
        now = datetime.utcnow()
        
        for breach_record in reversed(self.breach_history.get(sla_name, [])):
            if breach_record["status"] in ["breach", "critical"]:
                breach_start = datetime.fromisoformat(breach_record["timestamp"])
            else:
                break
        
        if breach_start:
            return (now - breach_start).total_seconds() / 60
        
        return 0.0
    
    def _calculate_consecutive_breaches(self, sla_name: str, current_status: str) -> int:
        """Calculate consecutive breaches"""
        if current_status in ["compliant", "warning"]:
            return 0
        
        count = 1  # Current breach
        for breach_record in reversed(self.breach_history.get(sla_name, [])):
            if breach_record["status"] in ["breach", "critical"]:
                count += 1
            else:
                break
        
        return count
    
    async def _handle_sla_status_change(self, sla_name: str, sla_def: SLADefinition, old_status: Optional[SLAStatus], new_status: SLAStatus):
        """Handle SLA status changes and send alerts"""
        
        # Record status change in history
        with self.lock:
            self.breach_history[sla_name].append({
                "timestamp": new_status.last_evaluation.isoformat(),
                "status": new_status.status,
                "current_value": new_status.current_value,
                "target_value": new_status.target_value,
                "compliance_percentage": new_status.compliance_percentage
            })
            
            # Keep only last 1000 records
            if len(self.breach_history[sla_name]) > 1000:
                self.breach_history[sla_name] = self.breach_history[sla_name][-1000:]
        
        # Check for status transitions that require alerts
        old_status_value = old_status.status if old_status else "unknown"
        
        # Alert on status degradation
        if old_status_value != new_status.status:
            
            if new_status.status == "breach":
                await create_performance_alert(
                    title=f"SLA Breach: {sla_def.name}",
                    description=f"SLA breach detected for {sla_def.name}. "
                              f"Current: {new_status.current_value:.2f}, "
                              f"Threshold: {sla_def.breach_threshold:.2f}",
                    severity=AlertSeverity.HIGH,
                    metadata={
                        "sla_name": sla_name,
                        "current_value": new_status.current_value,
                        "target_value": sla_def.target_value,
                        "breach_threshold": sla_def.breach_threshold,
                        "metric_type": sla_def.metric_type.value
                    }
                )
            
            elif new_status.status == "critical":
                await create_performance_alert(
                    title=f"Critical SLA Violation: {sla_def.name}",
                    description=f"Critical SLA violation for {sla_def.name}. "
                              f"Current: {new_status.current_value:.2f}, "
                              f"Critical Threshold: {sla_def.breach_threshold:.2f}",
                    severity=AlertSeverity.CRITICAL,
                    metadata={
                        "sla_name": sla_name,
                        "current_value": new_status.current_value,
                        "target_value": sla_def.target_value,
                        "breach_threshold": sla_def.breach_threshold,
                        "metric_type": sla_def.metric_type.value,
                        "breach_duration_minutes": new_status.breach_duration_minutes
                    }
                )
            
            elif new_status.status == "warning" and old_status_value == "compliant":
                await create_performance_alert(
                    title=f"SLA Warning: {sla_def.name}",
                    description=f"SLA warning for {sla_def.name}. "
                              f"Current: {new_status.current_value:.2f}, "
                              f"Warning Threshold: {sla_def.warning_threshold:.2f}",
                    severity=AlertSeverity.MEDIUM,
                    metadata={
                        "sla_name": sla_name,
                        "current_value": new_status.current_value,
                        "target_value": sla_def.target_value,
                        "warning_threshold": sla_def.warning_threshold,
                        "metric_type": sla_def.metric_type.value
                    }
                )
        
        # Alert on prolonged breaches
        if new_status.status in ["breach", "critical"] and new_status.breach_duration_minutes > 15:
            await create_performance_alert(
                title=f"Prolonged SLA Breach: {sla_def.name}",
                description=f"SLA breach for {sla_def.name} has lasted {new_status.breach_duration_minutes:.1f} minutes. "
                          f"Current: {new_status.current_value:.2f}",
                severity=AlertSeverity.CRITICAL,
                metadata={
                    "sla_name": sla_name,
                    "current_value": new_status.current_value,
                    "breach_duration_minutes": new_status.breach_duration_minutes,
                    "consecutive_breaches": new_status.consecutive_breaches,
                    "metric_type": sla_def.metric_type.value
                }
            )
        
        # Log status change
        log_structured(
            LogLevel.INFO if new_status.status in ["compliant", "warning"] else LogLevel.ERROR,
            f"SLA status update: {sla_name} - {new_status.status}",
            category=LogCategory.PERFORMANCE,
            sla_name=sla_name,
            old_status=old_status_value,
            new_status=new_status.status,
            current_value=new_status.current_value,
            compliance_percentage=new_status.compliance_percentage
        )
    
    def get_sla_status(self, sla_name: str) -> Optional[SLAStatus]:
        """Get SLA status"""
        return self.sla_statuses.get(sla_name)
    
    def get_all_sla_statuses(self) -> Dict[str, SLAStatus]:
        """Get all SLA statuses"""
        return dict(self.sla_statuses)
    
    def get_sla_summary(self) -> Dict[str, Any]:
        """Get SLA summary for monitoring dashboard"""
        with self.lock:
            statuses = dict(self.sla_statuses)
        
        summary = {
            "total_slas": len(self.sla_definitions),
            "compliant_slas": len([s for s in statuses.values() if s.status == "compliant"]),
            "warning_slas": len([s for s in statuses.values() if s.status == "warning"]),
            "breach_slas": len([s for s in statuses.values() if s.status == "breach"]),
            "critical_slas": len([s for s in statuses.values() if s.status == "critical"]),
            "overall_compliance_percentage": statistics.mean([s.compliance_percentage for s in statuses.values()]) if statuses else 100.0,
            "active_breaches": [
                {
                    "name": s.sla_name,
                    "status": s.status,
                    "current_value": s.current_value,
                    "target_value": s.target_value,
                    "breach_duration_minutes": s.breach_duration_minutes
                }
                for s in statuses.values()
                if s.status in ["breach", "critical"]
            ]
        }
        
        return summary


# Global instances
performance_tracker = PerformanceTracker()
sla_monitor = SLAMonitor(performance_tracker)

# Convenience functions
def record_response_time(value: float, endpoint: str = None, method: str = None):
    """Record API response time"""
    performance_tracker.record_metric(PerformanceMetric(
        metric_type=MetricType.RESPONSE_TIME,
        value=value,
        timestamp=datetime.utcnow(),
        context={"endpoint": endpoint, "method": method} if endpoint else {}
    ))

def record_database_query_time(value: float, table: str = None, operation: str = None):
    """Record database query time"""
    performance_tracker.record_metric(PerformanceMetric(
        metric_type=MetricType.DATABASE_QUERY_TIME,
        value=value,
        timestamp=datetime.utcnow(),
        context={"table": table, "operation": operation} if table else {}
    ))

def record_ml_inference_time(value: float, model_name: str = None):
    """Record ML inference time"""
    performance_tracker.record_metric(PerformanceMetric(
        metric_type=MetricType.ML_INFERENCE_TIME,
        value=value,
        timestamp=datetime.utcnow(),
        context={"model_name": model_name} if model_name else {}
    ))

def record_error_rate(value: float, endpoint: str = None):
    """Record error rate"""
    performance_tracker.record_metric(PerformanceMetric(
        metric_type=MetricType.ERROR_RATE,
        value=value,
        timestamp=datetime.utcnow(),
        context={"endpoint": endpoint} if endpoint else {}
    ))

def record_system_metrics():
    """Record current system metrics"""
    try:
        # CPU usage
        cpu_usage = psutil.cpu_percent(interval=1)
        performance_tracker.record_metric(PerformanceMetric(
            metric_type=MetricType.CPU_USAGE,
            value=cpu_usage,
            timestamp=datetime.utcnow()
        ))
        
        # Memory usage
        memory = psutil.virtual_memory()
        performance_tracker.record_metric(PerformanceMetric(
            metric_type=MetricType.MEMORY_USAGE,
            value=memory.percent,
            timestamp=datetime.utcnow()
        ))
        
        # Disk usage
        disk = psutil.disk_usage('/')
        performance_tracker.record_metric(PerformanceMetric(
            metric_type=MetricType.DISK_USAGE,
            value=disk.percent,
            timestamp=datetime.utcnow()
        ))
        
    except Exception as e:
        log_structured(
            LogLevel.ERROR,
            f"Failed to record system metrics: {str(e)}",
            category=LogCategory.PERFORMANCE,
            error_type="system_metrics_failed"
        )

def get_performance_summary() -> Dict[str, Any]:
    """Get comprehensive performance summary"""
    return {
        "performance_baselines": performance_tracker.get_performance_summary(),
        "sla_status": sla_monitor.get_sla_summary()
    }

def get_baseline(metric_type: MetricType) -> Optional[PerformanceBaseline]:
    """Get baseline for metric type"""
    return performance_tracker.get_baseline(metric_type)

def check_performance_regression(metric_type: MetricType, value: float) -> Optional[Dict[str, Any]]:
    """Check for performance regression"""
    return performance_tracker.check_regression(metric_type, value)