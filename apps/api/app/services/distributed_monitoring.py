"""
Distributed Processing Monitoring and Alerting System
=====================================================

This module provides comprehensive monitoring, alerting, and health checking
for the distributed processing infrastructure.

Features:
- Real-time system metrics collection
- Performance monitoring and benchmarking
- Automated alerting and notifications
- Health checks and diagnostics
- Resource usage tracking
- Job performance analytics
"""

import asyncio
import logging
import time
import json
import threading
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from queue import Queue, PriorityQueue
import statistics
import psutil
import os
from pathlib import Path

from app.core.distributed_config import get_distributed_config, get_monitoring_config
from app.services.distributed_processor import get_distributed_manager

logger = logging.getLogger(__name__)


@dataclass
class Alert:
    """Represents a system alert"""
    id: str
    timestamp: float
    severity: str  # 'low', 'medium', 'high', 'critical'
    category: str  # 'performance', 'resource', 'error', 'capacity'
    title: str
    description: str
    metric_name: str
    current_value: float
    threshold_value: float
    source: str  # 'worker', 'scheduler', 'queue', 'system'
    resolved: bool = False
    resolved_at: Optional[float] = None
    acknowledged: bool = False
    acknowledged_by: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert alert to dictionary"""
        return asdict(self)


@dataclass
class PerformanceMetrics:
    """Performance metrics for a time period"""
    timestamp: float
    period_seconds: int
    jobs_completed: int
    jobs_failed: int
    avg_job_duration: float
    max_job_duration: float
    min_job_duration: float
    throughput_jobs_per_hour: float
    resource_efficiency: float  # 0-100%
    error_rate_percent: float


@dataclass
class SystemHealth:
    """Overall system health status"""
    timestamp: float
    overall_status: str  # 'healthy', 'degraded', 'unhealthy', 'critical'
    cluster_status: str
    active_workers: int
    queue_health: str
    resource_health: str
    error_rate: float
    performance_score: float  # 0-100
    alerts_count: Dict[str, int]  # severity -> count
    recommendations: List[str]


class PerformanceTracker:
    """Track and analyze distributed processing performance"""

    def __init__(self):
        self.job_metrics = {}
        self.performance_history = []
        self.max_history_hours = 24
        self.lock = threading.Lock()

    def record_job_start(self, job_id: str, job_type: str, file_size_gb: float):
        """Record job start"""
        with self.lock:
            self.job_metrics[job_id] = {
                'job_type': job_type,
                'file_size_gb': file_size_gb,
                'start_time': time.time(),
                'end_time': None,
                'status': 'running',
                'duration': None,
                'throughput_gb_per_second': None
            }

    def record_job_completion(self, job_id: str, status: str, error: Optional[str] = None):
        """Record job completion"""
        with self.lock:
            if job_id in self.job_metrics:
                metrics = self.job_metrics[job_id]
                metrics['end_time'] = time.time()
                metrics['status'] = status
                metrics['duration'] = metrics['end_time'] - metrics['start_time']
                metrics['error'] = error

                # Calculate throughput
                if metrics['duration'] > 0 and status == 'completed':
                    metrics['throughput_gb_per_second'] = metrics['file_size_gb'] / metrics['duration']

    def get_performance_metrics(self, period_minutes: int = 60) -> PerformanceMetrics:
        """Get performance metrics for a time period"""
        with self.lock:
            cutoff_time = time.time() - (period_minutes * 60)

            # Filter jobs in time period
            period_jobs = [
                metrics for metrics in self.job_metrics.values()
                if metrics.get('end_time') and metrics['end_time'] > cutoff_time
            ]

            if not period_jobs:
                return PerformanceMetrics(
                    timestamp=time.time(),
                    period_seconds=period_minutes * 60,
                    jobs_completed=0,
                    jobs_failed=0,
                    avg_job_duration=0,
                    max_job_duration=0,
                    min_job_duration=0,
                    throughput_jobs_per_hour=0,
                    resource_efficiency=0,
                    error_rate_percent=0
                )

            # Calculate metrics
            completed_jobs = [j for j in period_jobs if j['status'] == 'completed']
            failed_jobs = [j for j in period_jobs if j['status'] == 'failed']

            durations = [j['duration'] for j in completed_jobs if j['duration']]

            avg_duration = statistics.mean(durations) if durations else 0
            max_duration = max(durations) if durations else 0
            min_duration = min(durations) if durations else 0

            # Calculate throughput
            total_jobs = len(period_jobs)
            period_hours = period_minutes / 60
            throughput = total_jobs / period_hours if period_hours > 0 else 0

            # Calculate error rate
            error_rate = (len(failed_jobs) / total_jobs * 100) if total_jobs > 0 else 0

            # Estimate resource efficiency (simplified)
            # This could be enhanced with actual resource utilization data
            efficiency = max(0, 100 - error_rate) if total_jobs > 0 else 100

            return PerformanceMetrics(
                timestamp=time.time(),
                period_seconds=period_minutes * 60,
                jobs_completed=len(completed_jobs),
                jobs_failed=len(failed_jobs),
                avg_job_duration=avg_duration,
                max_job_duration=max_duration,
                min_job_duration=min_duration,
                throughput_jobs_per_hour=throughput,
                resource_efficiency=efficiency,
                error_rate_percent=error_rate
            )


class AlertManager:
    """Manage alerts and notifications"""

    def __init__(self):
        self.alerts = {}
        self.alert_callbacks = []
        self.config = get_monitoring_config()
        self.lock = threading.Lock()

    def add_alert_callback(self, callback: Callable[[Alert], None]):
        """Add callback for alert notifications"""
        self.alert_callbacks.append(callback)

    def create_alert(
        self,
        severity: str,
        category: str,
        title: str,
        description: str,
        metric_name: str,
        current_value: float,
        threshold_value: float,
        source: str = 'system'
    ) -> str:
        """Create a new alert"""
        alert_id = f"{category}_{metric_name}_{int(time.time())}"

        alert = Alert(
            id=alert_id,
            timestamp=time.time(),
            severity=severity,
            category=category,
            title=title,
            description=description,
            metric_name=metric_name,
            current_value=current_value,
            threshold_value=threshold_value,
            source=source
        )

        with self.lock:
            self.alerts[alert_id] = alert

        # Notify callbacks
        for callback in self.alert_callbacks:
            try:
                callback(alert)
            except Exception as e:
                logger.error(f"Alert callback failed: {e}")

        logger.warning(f"Alert created: {alert.title} - {alert.description}")
        return alert_id

    def resolve_alert(self, alert_id: str, resolved_by: Optional[str] = None) -> bool:
        """Resolve an alert"""
        with self.lock:
            if alert_id in self.alerts:
                alert = self.alerts[alert_id]
                alert.resolved = True
                alert.resolved_at = time.time()
                logger.info(f"Alert resolved: {alert.title}")
                return True
        return False

    def acknowledge_alert(self, alert_id: str, acknowledged_by: str) -> bool:
        """Acknowledge an alert"""
        with self.lock:
            if alert_id in self.alerts:
                alert = self.alerts[alert_id]
                alert.acknowledged = True
                alert.acknowledged_by = acknowledged_by
                logger.info(f"Alert acknowledged by {acknowledged_by}: {alert.title}")
                return True
        return False

    def get_active_alerts(self) -> List[Alert]:
        """Get all active (unresolved) alerts"""
        with self.lock:
            return [alert for alert in self.alerts.values() if not alert.resolved]

    def get_alerts_by_severity(self, severity: str) -> List[Alert]:
        """Get alerts by severity level"""
        with self.lock:
            return [alert for alert in self.alerts.values() if alert.severity == severity]

    def cleanup_old_alerts(self, hours: int = 24):
        """Clean up alerts older than specified hours"""
        cutoff_time = time.time() - (hours * 3600)

        with self.lock:
            old_alert_ids = [
                alert_id for alert_id, alert in self.alerts.items()
                if alert.resolved and alert.resolved_at and alert.resolved_at < cutoff_time
            ]

            for alert_id in old_alert_ids:
                del self.alerts[alert_id]

            if old_alert_ids:
                logger.info(f"Cleaned up {len(old_alert_ids)} old alerts")


class HealthChecker:
    """System health monitoring and diagnostics"""

    def __init__(self):
        self.alert_manager = AlertManager()
        self.performance_tracker = PerformanceTracker()
        self.config = get_distributed_config()
        self.monitoring_config = get_monitoring_config()

    def check_system_health(self) -> SystemHealth:
        """Perform comprehensive system health check"""
        timestamp = time.time()

        try:
            # Get distributed manager
            manager = get_distributed_manager()

            # Check cluster status
            cluster_info = manager.get_cluster_info()
            cluster_status = self._evaluate_cluster_health(cluster_info)

            # Check resource health
            resource_metrics = manager.resource_monitor.get_current_metrics()
            resource_health = self._evaluate_resource_health(resource_metrics)

            # Check queue health
            queue_stats = manager.job_queue.get_queue_stats()
            queue_health = self._evaluate_queue_health(queue_stats)

            # Get performance metrics
            perf_metrics = self.performance_tracker.get_performance_metrics(60)
            performance_score = self._calculate_performance_score(perf_metrics)

            # Count active alerts by severity
            active_alerts = self.alert_manager.get_active_alerts()
            alerts_count = {
                'critical': len([a for a in active_alerts if a.severity == 'critical']),
                'high': len([a for a in active_alerts if a.severity == 'high']),
                'medium': len([a for a in active_alerts if a.severity == 'medium']),
                'low': len([a for a in active_alerts if a.severity == 'low'])
            }

            # Determine overall status
            overall_status = self._determine_overall_status(
                cluster_status, resource_health, queue_health, alerts_count, performance_score
            )

            # Generate recommendations
            recommendations = self._generate_recommendations(
                cluster_info, resource_metrics, queue_stats, perf_metrics, active_alerts
            )

            return SystemHealth(
                timestamp=timestamp,
                overall_status=overall_status,
                cluster_status=cluster_status,
                active_workers=cluster_info.get('workers', 0),
                queue_health=queue_health,
                resource_health=resource_health,
                error_rate=perf_metrics.error_rate_percent,
                performance_score=performance_score,
                alerts_count=alerts_count,
                recommendations=recommendations
            )

        except Exception as e:
            logger.error(f"Health check failed: {e}")

            # Create critical alert for health check failure
            self.alert_manager.create_alert(
                severity='critical',
                category='error',
                title='Health Check Failed',
                description=f'System health check failed: {str(e)}',
                metric_name='health_check_status',
                current_value=0,
                threshold_value=1,
                source='health_checker'
            )

            return SystemHealth(
                timestamp=timestamp,
                overall_status='critical',
                cluster_status='unknown',
                active_workers=0,
                queue_health='unknown',
                resource_health='unknown',
                error_rate=100.0,
                performance_score=0.0,
                alerts_count={'critical': 1, 'high': 0, 'medium': 0, 'low': 0},
                recommendations=['Investigate health check failure', 'Check system logs']
            )

    def _evaluate_cluster_health(self, cluster_info: Dict[str, Any]) -> str:
        """Evaluate cluster health"""
        workers = cluster_info.get('workers', 0)
        min_workers = self.config.resources.min_workers

        if workers == 0:
            return 'critical'
        elif workers < min_workers:
            return 'degraded'
        else:
            return 'healthy'

    def _evaluate_resource_health(self, resource_metrics: Dict[str, Any]) -> str:
        """Evaluate resource health"""
        cpu_percent = resource_metrics.get('cpu_percent', 0)
        memory_percent = resource_metrics.get('memory_percent', 0)
        disk_percent = resource_metrics.get('disk_percent', 0)

        thresholds = self.monitoring_config['alert_thresholds']

        if (cpu_percent > thresholds['cpu_usage'] or
            memory_percent > thresholds['memory_usage'] or
            disk_percent > thresholds['disk_usage']):
            return 'critical'
        elif (cpu_percent > thresholds['cpu_usage'] * 0.8 or
              memory_percent > thresholds['memory_usage'] * 0.8 or
              disk_percent > thresholds['disk_usage'] * 0.8):
            return 'degraded'
        else:
            return 'healthy'

    def _evaluate_queue_health(self, queue_stats: Dict[str, Any]) -> str:
        """Evaluate queue health"""
        queued_jobs = queue_stats.get('queued_jobs', 0)
        failed_jobs = queue_stats.get('failed_jobs', 0)
        total_jobs = queue_stats.get('total_jobs', 0)

        # Check for excessive queue buildup
        if queued_jobs > 100:
            return 'degraded'

        # Check for high failure rate
        if total_jobs > 0:
            failure_rate = (failed_jobs / total_jobs) * 100
            if failure_rate > 20:
                return 'critical'
            elif failure_rate > 10:
                return 'degraded'

        return 'healthy'

    def _calculate_performance_score(self, metrics: PerformanceMetrics) -> float:
        """Calculate overall performance score (0-100)"""
        if metrics.jobs_completed == 0:
            return 100.0  # No jobs means no problems

        # Factors affecting performance score
        error_rate_penalty = metrics.error_rate_percent
        efficiency_score = metrics.resource_efficiency

        # Base score from efficiency
        score = efficiency_score

        # Penalty for high error rates
        score -= (error_rate_penalty * 2)  # 2x penalty for errors

        # Bonus for high throughput (simplified)
        if metrics.throughput_jobs_per_hour > 10:
            score += 5

        return max(0, min(100, score))

    def _determine_overall_status(
        self,
        cluster_status: str,
        resource_health: str,
        queue_health: str,
        alerts_count: Dict[str, int],
        performance_score: float
    ) -> str:
        """Determine overall system status"""
        # Critical conditions
        if (cluster_status == 'critical' or
            resource_health == 'critical' or
            queue_health == 'critical' or
            alerts_count['critical'] > 0 or
            performance_score < 20):
            return 'critical'

        # Degraded conditions
        if (cluster_status == 'degraded' or
            resource_health == 'degraded' or
            queue_health == 'degraded' or
            alerts_count['high'] > 0 or
            performance_score < 60):
            return 'degraded'

        # Unhealthy conditions
        if alerts_count['medium'] > 3 or performance_score < 80:
            return 'unhealthy'

        return 'healthy'

    def _generate_recommendations(
        self,
        cluster_info: Dict[str, Any],
        resource_metrics: Dict[str, Any],
        queue_stats: Dict[str, Any],
        perf_metrics: PerformanceMetrics,
        active_alerts: List[Alert]
    ) -> List[str]:
        """Generate actionable recommendations"""
        recommendations = []

        # Cluster recommendations
        workers = cluster_info.get('workers', 0)
        if workers < self.config.resources.min_workers:
            recommendations.append(f"Scale up cluster - only {workers} workers active")

        # Resource recommendations
        cpu_percent = resource_metrics.get('cpu_percent', 0)
        memory_percent = resource_metrics.get('memory_percent', 0)

        if cpu_percent > 90:
            recommendations.append("High CPU usage - consider adding more workers or reducing load")

        if memory_percent > 90:
            recommendations.append("High memory usage - check for memory leaks or increase worker memory")

        # Queue recommendations
        queued_jobs = queue_stats.get('queued_jobs', 0)
        if queued_jobs > 50:
            recommendations.append(f"Queue backlog of {queued_jobs} jobs - consider scaling up")

        # Performance recommendations
        if perf_metrics.error_rate_percent > 10:
            recommendations.append(f"High error rate ({perf_metrics.error_rate_percent:.1f}%) - investigate job failures")

        if perf_metrics.avg_job_duration > 3600:  # > 1 hour
            recommendations.append("Long job durations - consider optimizing processing or using larger files threshold")

        # Alert-based recommendations
        critical_alerts = [a for a in active_alerts if a.severity == 'critical']
        if critical_alerts:
            recommendations.append(f"Address {len(critical_alerts)} critical alerts immediately")

        if not recommendations:
            recommendations.append("System is operating optimally")

        return recommendations


class DistributedMonitor:
    """Main monitoring coordinator"""

    def __init__(self):
        self.health_checker = HealthChecker()
        self.monitoring_active = False
        self.monitoring_interval = 30  # seconds
        self.monitoring_thread = None

    def start_monitoring(self):
        """Start background monitoring"""
        if not self.monitoring_active:
            self.monitoring_active = True
            self.monitoring_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
            self.monitoring_thread.start()
            logger.info("Distributed processing monitoring started")

    def stop_monitoring(self):
        """Stop background monitoring"""
        self.monitoring_active = False
        if self.monitoring_thread:
            self.monitoring_thread.join(timeout=5)
        logger.info("Distributed processing monitoring stopped")

    def _monitoring_loop(self):
        """Main monitoring loop"""
        while self.monitoring_active:
            try:
                # Perform health check
                health = self.health_checker.check_system_health()

                # Log health status
                logger.info(f"System health: {health.overall_status} "
                           f"(Workers: {health.active_workers}, "
                           f"Performance: {health.performance_score:.1f}, "
                           f"Error rate: {health.error_rate:.1f}%)")

                # Clean up old alerts
                self.health_checker.alert_manager.cleanup_old_alerts()

                # Wait for next check
                time.sleep(self.monitoring_interval)

            except Exception as e:
                logger.error(f"Monitoring loop error: {e}")
                time.sleep(60)  # Wait longer on errors

    def get_monitoring_dashboard(self) -> Dict[str, Any]:
        """Get comprehensive monitoring dashboard data"""
        try:
            health = self.health_checker.check_system_health()
            active_alerts = self.health_checker.alert_manager.get_active_alerts()
            perf_metrics = self.health_checker.performance_tracker.get_performance_metrics(60)

            return {
                'timestamp': datetime.now().isoformat(),
                'system_health': asdict(health),
                'active_alerts': [alert.to_dict() for alert in active_alerts],
                'performance_metrics': asdict(perf_metrics),
                'monitoring_status': 'active' if self.monitoring_active else 'inactive'
            }

        except Exception as e:
            logger.error(f"Error generating monitoring dashboard: {e}")
            return {
                'timestamp': datetime.now().isoformat(),
                'error': str(e),
                'monitoring_status': 'error'
            }


# Global monitoring instance
distributed_monitor = DistributedMonitor()

def get_distributed_monitor() -> DistributedMonitor:
    """Get the global distributed monitor instance"""
    return distributed_monitor

def start_distributed_monitoring():
    """Start distributed processing monitoring"""
    distributed_monitor.start_monitoring()

def stop_distributed_monitoring():
    """Stop distributed processing monitoring"""
    distributed_monitor.stop_monitoring()

logger.info("Distributed monitoring system initialized")