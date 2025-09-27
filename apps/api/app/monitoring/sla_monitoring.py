"""
SLA Monitoring & Alerting System
Provides comprehensive SLA tracking, Prometheus metrics, and Grafana dashboard integration.
"""

import asyncio
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, asdict
from enum import Enum
import json
from prometheus_client import Counter, Histogram, Gauge, Summary, CollectorRegistry, generate_latest
from prometheus_client.metrics import MetricWrapperBase
import aioredis
from sqlalchemy import create_engine, Column, String, DateTime, Integer, Boolean, Float, JSON, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import smtplib
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart
import aiohttp

logger = logging.getLogger(__name__)

Base = declarative_base()

class SLAStatus(str, Enum):
    """SLA status levels"""
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    BREACH = "breach"

class AlertSeverity(str, Enum):
    """Alert severity levels"""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"

class SLAMetric(Base):
    """SLA metrics tracking"""
    __tablename__ = "sla_metrics"

    id = Column(String, primary_key=True)
    customer_id = Column(String, nullable=False, index=True)
    service_name = Column(String, nullable=False)
    metric_name = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    value = Column(Float, nullable=False)
    target_value = Column(Float, nullable=False)
    status = Column(String, default=SLAStatus.HEALTHY.value)
    metadata = Column(JSON, default=dict)

class SLAAlert(Base):
    """SLA alerts and incidents"""
    __tablename__ = "sla_alerts"

    id = Column(String, primary_key=True)
    customer_id = Column(String, nullable=False, index=True)
    service_name = Column(String, nullable=False)
    alert_type = Column(String, nullable=False)
    severity = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    triggered_at = Column(DateTime, default=datetime.utcnow, index=True)
    resolved_at = Column(DateTime)
    is_resolved = Column(Boolean, default=False)
    notification_sent = Column(Boolean, default=False)
    metadata = Column(JSON, default=dict)

class ServiceStatus(Base):
    """Overall service status tracking"""
    __tablename__ = "service_status"

    id = Column(String, primary_key=True)
    customer_id = Column(String, nullable=False, index=True)
    service_name = Column(String, nullable=False)
    status = Column(String, default=SLAStatus.HEALTHY.value)
    uptime_percentage = Column(Float, default=100.0)
    response_time_p95 = Column(Float, default=0.0)
    error_rate = Column(Float, default=0.0)
    last_incident = Column(DateTime)
    last_updated = Column(DateTime, default=datetime.utcnow)

@dataclass
class SLATarget:
    """SLA target configuration"""
    service_name: str
    metric_name: str
    target_value: float
    warning_threshold: float
    critical_threshold: float
    operator: str  # 'lt', 'lte', 'gt', 'gte', 'eq'
    time_window_minutes: int
    customer_id: Optional[str] = None

@dataclass
class AlertRule:
    """Alert rule configuration"""
    name: str
    service_name: str
    metric_name: str
    condition: str
    threshold: float
    severity: AlertSeverity
    notification_channels: List[str]
    cooldown_minutes: int = 15

class PrometheusMetrics:
    """Prometheus metrics collector for SLA monitoring"""

    def __init__(self, registry: Optional[CollectorRegistry] = None):
        self.registry = registry or CollectorRegistry()

        # API Response Time Metrics
        self.api_request_duration = Histogram(
            'api_request_duration_seconds',
            'Time spent processing API requests',
            ['customer_id', 'endpoint', 'method', 'status_code'],
            registry=self.registry,
            buckets=(0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, float('inf'))
        )

        # API Request Counter
        self.api_requests_total = Counter(
            'api_requests_total',
            'Total number of API requests',
            ['customer_id', 'endpoint', 'method', 'status_code'],
            registry=self.registry
        )

        # Error Rate
        self.api_errors_total = Counter(
            'api_errors_total',
            'Total number of API errors',
            ['customer_id', 'endpoint', 'error_type'],
            registry=self.registry
        )

        # System Availability
        self.service_up = Gauge(
            'service_up',
            'Service availability indicator',
            ['customer_id', 'service_name'],
            registry=self.registry
        )

        # Database Connection Pool
        self.db_connections_active = Gauge(
            'db_connections_active',
            'Active database connections',
            ['customer_id', 'database_type'],
            registry=self.registry
        )

        # Data Processing Metrics
        self.data_processing_duration = Histogram(
            'data_processing_duration_seconds',
            'Time spent processing data',
            ['customer_id', 'operation_type'],
            registry=self.registry
        )

        # Stream Processing Metrics
        self.stream_messages_processed = Counter(
            'stream_messages_processed_total',
            'Total stream messages processed',
            ['customer_id', 'stream_name', 'status'],
            registry=self.registry
        )

        # ML Model Metrics
        self.ml_model_inference_duration = Histogram(
            'ml_model_inference_duration_seconds',
            'ML model inference time',
            ['customer_id', 'model_name', 'framework'],
            registry=self.registry
        )

        # Webhook Delivery Metrics
        self.webhook_deliveries_total = Counter(
            'webhook_deliveries_total',
            'Total webhook deliveries',
            ['customer_id', 'webhook_url', 'status'],
            registry=self.registry
        )

        # Resource Usage Metrics
        self.cpu_usage = Gauge(
            'cpu_usage_percent',
            'CPU usage percentage',
            ['customer_id', 'service_name'],
            registry=self.registry
        )

        self.memory_usage = Gauge(
            'memory_usage_bytes',
            'Memory usage in bytes',
            ['customer_id', 'service_name'],
            registry=self.registry
        )

class SLAMonitor:
    """
    Comprehensive SLA Monitoring and Alerting System

    Features:
    - Real-time SLA tracking
    - Prometheus metrics integration
    - Alert management with escalation
    - Customer-specific SLA targets
    - Incident tracking and resolution
    """

    def __init__(self, database_url: str, redis_url: str):
        self.db_engine = create_engine(database_url)
        Base.metadata.create_all(self.db_engine)
        self.SessionLocal = sessionmaker(bind=self.db_engine)

        # Redis for caching and alerting
        self.redis_url = redis_url
        self.redis = None

        # Prometheus metrics
        self.metrics = PrometheusMetrics()

        # SLA targets configuration
        self.sla_targets: Dict[str, List[SLATarget]] = {}

        # Alert rules
        self.alert_rules: List[AlertRule] = []

        # Alert handlers
        self.alert_handlers: Dict[str, Callable] = {}

        # Default SLA targets
        self._setup_default_sla_targets()

        # Default alert rules
        self._setup_default_alert_rules()

    async def start(self):
        """Initialize the SLA monitoring system"""
        self.redis = await aioredis.from_url(self.redis_url)
        logger.info("SLA Monitor started")

    async def stop(self):
        """Cleanup resources"""
        if self.redis:
            await self.redis.close()
        logger.info("SLA Monitor stopped")

    def _setup_default_sla_targets(self):
        """Setup default SLA targets for different tiers"""
        # Developer tier SLAs
        developer_targets = [
            SLATarget(
                service_name="api",
                metric_name="response_time_p95",
                target_value=2.0,  # 2 seconds
                warning_threshold=1.5,
                critical_threshold=1.8,
                operator="lte",
                time_window_minutes=5
            ),
            SLATarget(
                service_name="api",
                metric_name="uptime_percentage",
                target_value=99.0,  # 99%
                warning_threshold=99.5,
                critical_threshold=99.0,
                operator="gte",
                time_window_minutes=60
            ),
            SLATarget(
                service_name="api",
                metric_name="error_rate",
                target_value=5.0,  # 5%
                warning_threshold=3.0,
                critical_threshold=4.0,
                operator="lte",
                time_window_minutes=15
            )
        ]

        # Growth tier SLAs (better targets)
        growth_targets = [
            SLATarget(
                service_name="api",
                metric_name="response_time_p95",
                target_value=1.0,  # 1 second
                warning_threshold=0.8,
                critical_threshold=0.9,
                operator="lte",
                time_window_minutes=5
            ),
            SLATarget(
                service_name="api",
                metric_name="uptime_percentage",
                target_value=99.5,  # 99.5%
                warning_threshold=99.7,
                critical_threshold=99.5,
                operator="gte",
                time_window_minutes=60
            ),
            SLATarget(
                service_name="api",
                metric_name="error_rate",
                target_value=2.0,  # 2%
                warning_threshold=1.5,
                critical_threshold=1.8,
                operator="lte",
                time_window_minutes=15
            )
        ]

        # Scale tier SLAs (enterprise level)
        scale_targets = [
            SLATarget(
                service_name="api",
                metric_name="response_time_p95",
                target_value=0.5,  # 500ms
                warning_threshold=0.3,
                critical_threshold=0.4,
                operator="lte",
                time_window_minutes=5
            ),
            SLATarget(
                service_name="api",
                metric_name="uptime_percentage",
                target_value=99.9,  # 99.9%
                warning_threshold=99.95,
                critical_threshold=99.9,
                operator="gte",
                time_window_minutes=60
            ),
            SLATarget(
                service_name="api",
                metric_name="error_rate",
                target_value=0.5,  # 0.5%
                warning_threshold=0.3,
                critical_threshold=0.4,
                operator="lte",
                time_window_minutes=15
            )
        ]

        self.sla_targets = {
            "developer": developer_targets,
            "growth": growth_targets,
            "scale": scale_targets
        }

    def _setup_default_alert_rules(self):
        """Setup default alert rules"""
        self.alert_rules = [
            AlertRule(
                name="High API Response Time",
                service_name="api",
                metric_name="response_time_p95",
                condition="gt",
                threshold=2.0,
                severity=AlertSeverity.WARNING,
                notification_channels=["email", "webhook"],
                cooldown_minutes=10
            ),
            AlertRule(
                name="Service Down",
                service_name="api",
                metric_name="uptime_percentage",
                condition="lt",
                threshold=99.0,
                severity=AlertSeverity.CRITICAL,
                notification_channels=["email", "webhook", "sms"],
                cooldown_minutes=5
            ),
            AlertRule(
                name="High Error Rate",
                service_name="api",
                metric_name="error_rate",
                condition="gt",
                threshold=5.0,
                severity=AlertSeverity.WARNING,
                notification_channels=["email"],
                cooldown_minutes=15
            )
        ]

    async def record_metric(
        self,
        customer_id: str,
        service_name: str,
        metric_name: str,
        value: float,
        target_value: Optional[float] = None,
        metadata: Optional[Dict] = None
    ):
        """Record an SLA metric"""
        metric_id = f"{customer_id}_{service_name}_{metric_name}_{int(time.time() * 1000)}"

        # Determine status based on value and targets
        status = await self._calculate_metric_status(
            customer_id, service_name, metric_name, value, target_value
        )

        metric = SLAMetric(
            id=metric_id,
            customer_id=customer_id,
            service_name=service_name,
            metric_name=metric_name,
            value=value,
            target_value=target_value or 0.0,
            status=status.value,
            metadata=metadata or {}
        )

        # Store in database
        with self.SessionLocal() as session:
            session.add(metric)
            session.commit()

        # Update Prometheus metrics based on metric type
        await self._update_prometheus_metrics(customer_id, service_name, metric_name, value)

        # Check for SLA violations and trigger alerts
        await self._check_sla_violations(customer_id, service_name, metric_name, value, status)

        logger.debug(f"Recorded SLA metric: {metric_name}={value} for {customer_id}")

    async def _calculate_metric_status(
        self,
        customer_id: str,
        service_name: str,
        metric_name: str,
        value: float,
        target_value: Optional[float]
    ) -> SLAStatus:
        """Calculate the status of a metric based on SLA targets"""
        # Get customer's plan tier (would normally come from billing system)
        plan_tier = await self._get_customer_plan_tier(customer_id)
        targets = self.sla_targets.get(plan_tier, self.sla_targets["developer"])

        # Find matching target
        matching_target = None
        for target in targets:
            if target.service_name == service_name and target.metric_name == metric_name:
                matching_target = target
                break

        if not matching_target:
            return SLAStatus.HEALTHY

        # Compare value against thresholds
        if matching_target.operator == "lte":
            if value > matching_target.target_value:
                return SLAStatus.BREACH
            elif value > matching_target.critical_threshold:
                return SLAStatus.CRITICAL
            elif value > matching_target.warning_threshold:
                return SLAStatus.WARNING
        elif matching_target.operator == "gte":
            if value < matching_target.target_value:
                return SLAStatus.BREACH
            elif value < matching_target.critical_threshold:
                return SLAStatus.CRITICAL
            elif value < matching_target.warning_threshold:
                return SLAStatus.WARNING
        elif matching_target.operator == "gt":
            if value <= matching_target.target_value:
                return SLAStatus.BREACH
        elif matching_target.operator == "lt":
            if value >= matching_target.target_value:
                return SLAStatus.BREACH

        return SLAStatus.HEALTHY

    async def _update_prometheus_metrics(
        self,
        customer_id: str,
        service_name: str,
        metric_name: str,
        value: float
    ):
        """Update Prometheus metrics based on the recorded metric"""
        if metric_name == "response_time_p95":
            # This would typically be recorded by the actual API middleware
            pass
        elif metric_name == "uptime_percentage":
            uptime_value = 1.0 if value >= 99.0 else 0.0
            self.metrics.service_up.labels(
                customer_id=customer_id,
                service_name=service_name
            ).set(uptime_value)
        elif metric_name == "cpu_usage":
            self.metrics.cpu_usage.labels(
                customer_id=customer_id,
                service_name=service_name
            ).set(value)
        elif metric_name == "memory_usage":
            self.metrics.memory_usage.labels(
                customer_id=customer_id,
                service_name=service_name
            ).set(value)

    async def _check_sla_violations(
        self,
        customer_id: str,
        service_name: str,
        metric_name: str,
        value: float,
        status: SLAStatus
    ):
        """Check for SLA violations and trigger alerts"""
        if status in [SLAStatus.WARNING, SLAStatus.CRITICAL, SLAStatus.BREACH]:
            # Check if we already have an active alert for this issue
            alert_key = f"alert:{customer_id}:{service_name}:{metric_name}"
            existing_alert = await self.redis.get(alert_key)

            if not existing_alert:
                # Create new alert
                await self._create_alert(
                    customer_id=customer_id,
                    service_name=service_name,
                    alert_type=f"sla_{status.value}",
                    severity=self._map_status_to_severity(status),
                    title=f"SLA {status.value.title()} - {metric_name}",
                    description=f"Metric {metric_name} is {status.value}: {value}",
                    metadata={
                        "metric_name": metric_name,
                        "metric_value": value,
                        "status": status.value
                    }
                )

                # Set cooldown period
                await self.redis.setex(alert_key, 900, "active")  # 15 minutes

    def _map_status_to_severity(self, status: SLAStatus) -> AlertSeverity:
        """Map SLA status to alert severity"""
        mapping = {
            SLAStatus.WARNING: AlertSeverity.WARNING,
            SLAStatus.CRITICAL: AlertSeverity.CRITICAL,
            SLAStatus.BREACH: AlertSeverity.EMERGENCY
        }
        return mapping.get(status, AlertSeverity.INFO)

    async def _create_alert(
        self,
        customer_id: str,
        service_name: str,
        alert_type: str,
        severity: AlertSeverity,
        title: str,
        description: str,
        metadata: Optional[Dict] = None
    ):
        """Create and process a new alert"""
        alert_id = f"alert_{customer_id}_{int(time.time() * 1000)}"

        alert = SLAAlert(
            id=alert_id,
            customer_id=customer_id,
            service_name=service_name,
            alert_type=alert_type,
            severity=severity.value,
            title=title,
            description=description,
            metadata=metadata or {}
        )

        # Store in database
        with self.SessionLocal() as session:
            session.add(alert)
            session.commit()

        # Send notifications
        await self._send_alert_notifications(alert)

        logger.warning(f"Created alert {alert_id}: {title}")

    async def _send_alert_notifications(self, alert: SLAAlert):
        """Send alert notifications through configured channels"""
        # Find matching alert rules
        matching_rules = [
            rule for rule in self.alert_rules
            if rule.service_name == alert.service_name
            and rule.severity.value == alert.severity
        ]

        for rule in matching_rules:
            for channel in rule.notification_channels:
                try:
                    if channel == "email":
                        await self._send_email_notification(alert)
                    elif channel == "webhook":
                        await self._send_webhook_notification(alert)
                    elif channel == "sms":
                        await self._send_sms_notification(alert)
                except Exception as e:
                    logger.error(f"Failed to send {channel} notification: {e}")

    async def _send_email_notification(self, alert: SLAAlert):
        """Send email notification for alert"""
        # This would integrate with your email service
        logger.info(f"Email notification sent for alert {alert.id}")

    async def _send_webhook_notification(self, alert: SLAAlert):
        """Send webhook notification for alert"""
        webhook_url = "https://hooks.example.com/alerts"  # Configure as needed

        payload = {
            "alert_id": alert.id,
            "customer_id": alert.customer_id,
            "service_name": alert.service_name,
            "severity": alert.severity,
            "title": alert.title,
            "description": alert.description,
            "triggered_at": alert.triggered_at.isoformat(),
            "metadata": alert.metadata
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(webhook_url, json=payload) as response:
                if response.status == 200:
                    logger.info(f"Webhook notification sent for alert {alert.id}")
                else:
                    logger.error(f"Webhook notification failed: {response.status}")

    async def _send_sms_notification(self, alert: SLAAlert):
        """Send SMS notification for alert"""
        # This would integrate with your SMS service
        logger.info(f"SMS notification sent for alert {alert.id}")

    async def _get_customer_plan_tier(self, customer_id: str) -> str:
        """Get customer's plan tier (mock implementation)"""
        # This would normally query the billing system
        return "growth"  # Default for now

    async def get_sla_dashboard_data(self, customer_id: str) -> Dict[str, Any]:
        """Get SLA dashboard data for a customer"""
        # Get current service status
        with self.SessionLocal() as session:
            service_status = session.query(ServiceStatus).filter(
                ServiceStatus.customer_id == customer_id
            ).all()

            # Get recent metrics
            recent_metrics = session.query(SLAMetric).filter(
                SLAMetric.customer_id == customer_id,
                SLAMetric.timestamp >= datetime.utcnow() - timedelta(hours=24)
            ).order_by(SLAMetric.timestamp.desc()).limit(100).all()

            # Get active alerts
            active_alerts = session.query(SLAAlert).filter(
                SLAAlert.customer_id == customer_id,
                SLAAlert.is_resolved == False
            ).order_by(SLAAlert.triggered_at.desc()).all()

        # Calculate uptime for each service
        uptime_data = {}
        for service in service_status:
            uptime_data[service.service_name] = {
                "current_uptime": service.uptime_percentage,
                "response_time_p95": service.response_time_p95,
                "error_rate": service.error_rate,
                "status": service.status,
                "last_incident": service.last_incident.isoformat() if service.last_incident else None
            }

        return {
            "customer_id": customer_id,
            "overall_health": self._calculate_overall_health(service_status),
            "services": uptime_data,
            "active_alerts": [
                {
                    "id": alert.id,
                    "severity": alert.severity,
                    "title": alert.title,
                    "triggered_at": alert.triggered_at.isoformat()
                }
                for alert in active_alerts
            ],
            "recent_metrics": [
                {
                    "service": metric.service_name,
                    "metric": metric.metric_name,
                    "value": metric.value,
                    "status": metric.status,
                    "timestamp": metric.timestamp.isoformat()
                }
                for metric in recent_metrics[:20]
            ]
        }

    def _calculate_overall_health(self, service_status: List[ServiceStatus]) -> str:
        """Calculate overall health status across all services"""
        if not service_status:
            return SLAStatus.HEALTHY.value

        statuses = [s.status for s in service_status]

        if SLAStatus.BREACH.value in statuses:
            return SLAStatus.BREACH.value
        elif SLAStatus.CRITICAL.value in statuses:
            return SLAStatus.CRITICAL.value
        elif SLAStatus.WARNING.value in statuses:
            return SLAStatus.WARNING.value
        else:
            return SLAStatus.HEALTHY.value

    def get_prometheus_metrics(self) -> str:
        """Get Prometheus metrics in text format"""
        return generate_latest(self.metrics.registry).decode('utf-8')

    async def update_service_status(
        self,
        customer_id: str,
        service_name: str,
        uptime_percentage: float,
        response_time_p95: float,
        error_rate: float
    ):
        """Update overall service status"""
        status = SLAStatus.HEALTHY

        # Determine status based on multiple metrics
        if uptime_percentage < 99.0 or response_time_p95 > 2.0 or error_rate > 5.0:
            status = SLAStatus.BREACH
        elif uptime_percentage < 99.5 or response_time_p95 > 1.5 or error_rate > 3.0:
            status = SLAStatus.CRITICAL
        elif uptime_percentage < 99.9 or response_time_p95 > 1.0 or error_rate > 1.0:
            status = SLAStatus.WARNING

        with self.SessionLocal() as session:
            service_status = session.query(ServiceStatus).filter(
                ServiceStatus.customer_id == customer_id,
                ServiceStatus.service_name == service_name
            ).first()

            if not service_status:
                service_status = ServiceStatus(
                    id=f"{customer_id}_{service_name}",
                    customer_id=customer_id,
                    service_name=service_name
                )
                session.add(service_status)

            service_status.status = status.value
            service_status.uptime_percentage = uptime_percentage
            service_status.response_time_p95 = response_time_p95
            service_status.error_rate = error_rate
            service_status.last_updated = datetime.utcnow()

            # Record incident if status changed to problematic
            if status in [SLAStatus.CRITICAL, SLAStatus.BREACH]:
                service_status.last_incident = datetime.utcnow()

            session.commit()

        logger.info(f"Updated service status for {service_name}: {status.value}")

# Middleware integration for automatic SLA tracking
def track_sla_metrics(sla_monitor: SLAMonitor):
    """Decorator to automatically track SLA metrics for API endpoints"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            customer_id = kwargs.get('customer_id', 'unknown')

            try:
                result = await func(*args, **kwargs)

                # Record successful response time
                response_time = time.time() - start_time
                await sla_monitor.record_metric(
                    customer_id=customer_id,
                    service_name="api",
                    metric_name="response_time",
                    value=response_time
                )

                return result

            except Exception as e:
                # Record error
                await sla_monitor.record_metric(
                    customer_id=customer_id,
                    service_name="api",
                    metric_name="error_rate",
                    value=1.0  # Error occurred
                )
                raise

        return wrapper
    return decorator