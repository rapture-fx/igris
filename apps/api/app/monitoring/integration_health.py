"""
Integration Health Monitoring System
Monitors health and reliability of all external integrations and data connectors.
"""

import asyncio
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, asdict
from enum import Enum
import json
import aiohttp
import aioredis
from sqlalchemy import create_engine, Column, String, DateTime, Integer, Boolean, Float, JSON, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from prometheus_client import Gauge, Counter, Histogram

from app.services.data_connectors import DatabaseConnector, CloudStorageConnector, APIConnector, RealtimeStreamer

logger = logging.getLogger(__name__)

Base = declarative_base()

class IntegrationStatus(str, Enum):
    """Integration health status"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    DOWN = "down"
    UNKNOWN = "unknown"

class IntegrationType(str, Enum):
    """Types of integrations"""
    DATABASE = "database"
    CLOUD_STORAGE = "cloud_storage"
    API = "api"
    STREAMING = "streaming"
    WEBHOOK = "webhook"
    ML_SERVICE = "ml_service"

class HealthCheck(Base):
    """Health check results"""
    __tablename__ = "health_checks"

    id = Column(String, primary_key=True)
    integration_name = Column(String, nullable=False, index=True)
    integration_type = Column(String, nullable=False)
    customer_id = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False)
    response_time_ms = Column(Float, default=0.0)
    error_message = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    metadata = Column(JSON, default=dict)

class IntegrationIncident(Base):
    """Integration incidents and outages"""
    __tablename__ = "integration_incidents"

    id = Column(String, primary_key=True)
    integration_name = Column(String, nullable=False)
    customer_id = Column(String, nullable=False, index=True)
    incident_type = Column(String, nullable=False)  # outage, degradation, error_spike
    severity = Column(String, nullable=False)  # low, medium, high, critical
    started_at = Column(DateTime, default=datetime.utcnow, index=True)
    resolved_at = Column(DateTime)
    duration_minutes = Column(Integer)
    affected_operations = Column(JSON, default=list)
    root_cause = Column(Text)
    resolution_notes = Column(Text)
    is_resolved = Column(Boolean, default=False)

class IntegrationMetrics(Base):
    """Aggregated integration metrics"""
    __tablename__ = "integration_metrics"

    id = Column(String, primary_key=True)
    integration_name = Column(String, nullable=False, index=True)
    customer_id = Column(String, nullable=False, index=True)
    date = Column(DateTime, nullable=False, index=True)
    total_requests = Column(Integer, default=0)
    successful_requests = Column(Integer, default=0)
    failed_requests = Column(Integer, default=0)
    avg_response_time_ms = Column(Float, default=0.0)
    p95_response_time_ms = Column(Float, default=0.0)
    uptime_percentage = Column(Float, default=100.0)
    error_rate = Column(Float, default=0.0)
    bytes_transferred = Column(Integer, default=0)

@dataclass
class HealthCheckConfig:
    """Health check configuration"""
    integration_name: str
    integration_type: IntegrationType
    check_interval_seconds: int
    timeout_seconds: int
    failure_threshold: int  # Number of consecutive failures before marking unhealthy
    degraded_threshold_ms: float  # Response time threshold for degraded status
    unhealthy_threshold_ms: float  # Response time threshold for unhealthy status
    custom_check_function: Optional[Callable] = None

@dataclass
class HealthCheckResult:
    """Health check result"""
    integration_name: str
    status: IntegrationStatus
    response_time_ms: float
    error_message: Optional[str] = None
    metadata: Optional[Dict] = None

class IntegrationHealthMonitor:
    """
    Comprehensive Integration Health Monitoring System

    Features:
    - Automated health checks for all integrations
    - Real-time status monitoring
    - Incident detection and tracking
    - Performance metrics and SLA tracking
    - Automated alerting and escalation
    """

    def __init__(self, database_url: str, redis_url: str):
        self.db_engine = create_engine(database_url)
        Base.metadata.create_all(self.db_engine)
        self.SessionLocal = sessionmaker(bind=self.db_engine)

        # Redis for real-time status and caching
        self.redis_url = redis_url
        self.redis = None

        # Health check configurations
        self.health_configs: Dict[str, HealthCheckConfig] = {}

        # Running health check tasks
        self.health_check_tasks: Dict[str, asyncio.Task] = {}

        # Integration connectors
        self.db_connector = DatabaseConnector()
        self.cloud_connector = CloudStorageConnector()
        self.api_connector = APIConnector()
        self.realtime_streamer = RealtimeStreamer()

        # Prometheus metrics
        self.setup_prometheus_metrics()

        # Current integration statuses
        self.integration_statuses: Dict[str, IntegrationStatus] = {}

        # Failure counters for each integration
        self.failure_counters: Dict[str, int] = {}

    def setup_prometheus_metrics(self):
        """Setup Prometheus metrics for integration monitoring"""
        self.integration_status_gauge = Gauge(
            'integration_status',
            'Integration status (1=healthy, 0.5=degraded, 0=unhealthy)',
            ['integration_name', 'customer_id', 'integration_type']
        )

        self.integration_response_time = Histogram(
            'integration_response_time_seconds',
            'Integration response time',
            ['integration_name', 'customer_id', 'integration_type'],
            buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, float('inf'))
        )

        self.integration_errors_total = Counter(
            'integration_errors_total',
            'Total integration errors',
            ['integration_name', 'customer_id', 'integration_type', 'error_type']
        )

        self.integration_requests_total = Counter(
            'integration_requests_total',
            'Total integration requests',
            ['integration_name', 'customer_id', 'integration_type', 'status']
        )

    async def start(self):
        """Initialize the health monitoring system"""
        self.redis = await aioredis.from_url(self.redis_url)

        # Setup default health checks
        await self._setup_default_health_checks()

        # Start health check tasks
        await self._start_health_check_tasks()

        logger.info("Integration Health Monitor started")

    async def stop(self):
        """Cleanup resources"""
        # Stop all health check tasks
        for task in self.health_check_tasks.values():
            task.cancel()

        # Wait for tasks to complete
        if self.health_check_tasks:
            await asyncio.gather(*self.health_check_tasks.values(), return_exceptions=True)

        if self.redis:
            await self.redis.close()

        logger.info("Integration Health Monitor stopped")

    async def _setup_default_health_checks(self):
        """Setup default health checks for core integrations"""
        default_configs = [
            HealthCheckConfig(
                integration_name="postgresql",
                integration_type=IntegrationType.DATABASE,
                check_interval_seconds=30,
                timeout_seconds=5,
                failure_threshold=3,
                degraded_threshold_ms=500,
                unhealthy_threshold_ms=2000
            ),
            HealthCheckConfig(
                integration_name="redis",
                integration_type=IntegrationType.DATABASE,
                check_interval_seconds=30,
                timeout_seconds=5,
                failure_threshold=3,
                degraded_threshold_ms=100,
                unhealthy_threshold_ms=1000
            ),
            HealthCheckConfig(
                integration_name="aws_s3",
                integration_type=IntegrationType.CLOUD_STORAGE,
                check_interval_seconds=60,
                timeout_seconds=10,
                failure_threshold=2,
                degraded_threshold_ms=1000,
                unhealthy_threshold_ms=5000
            ),
            HealthCheckConfig(
                integration_name="google_cloud_storage",
                integration_type=IntegrationType.CLOUD_STORAGE,
                check_interval_seconds=60,
                timeout_seconds=10,
                failure_threshold=2,
                degraded_threshold_ms=1000,
                unhealthy_threshold_ms=5000
            ),
            HealthCheckConfig(
                integration_name="azure_blob",
                integration_type=IntegrationType.CLOUD_STORAGE,
                check_interval_seconds=60,
                timeout_seconds=10,
                failure_threshold=2,
                degraded_threshold_ms=1000,
                unhealthy_threshold_ms=5000
            )
        ]

        for config in default_configs:
            self.health_configs[config.integration_name] = config

    async def _start_health_check_tasks(self):
        """Start health check tasks for all configured integrations"""
        for integration_name, config in self.health_configs.items():
            task = asyncio.create_task(
                self._health_check_loop(integration_name, config)
            )
            self.health_check_tasks[integration_name] = task

    async def _health_check_loop(self, integration_name: str, config: HealthCheckConfig):
        """Health check loop for a specific integration"""
        while True:
            try:
                # Perform health check
                result = await self._perform_health_check(integration_name, config)

                # Store result
                await self._store_health_check_result(result)

                # Update metrics
                await self._update_prometheus_metrics(result, config)

                # Check for status changes and incidents
                await self._check_for_incidents(result, config)

                # Wait for next check
                await asyncio.sleep(config.check_interval_seconds)

            except asyncio.CancelledError:
                logger.info(f"Health check task cancelled for {integration_name}")
                break
            except Exception as e:
                logger.error(f"Health check error for {integration_name}: {e}")
                await asyncio.sleep(config.check_interval_seconds)

    async def _perform_health_check(self, integration_name: str, config: HealthCheckConfig) -> HealthCheckResult:
        """Perform health check for a specific integration"""
        start_time = time.time()

        try:
            if config.custom_check_function:
                # Use custom check function if provided
                success, error_msg, metadata = await config.custom_check_function()
            else:
                # Use built-in health check based on integration type
                success, error_msg, metadata = await self._builtin_health_check(integration_name, config)

            response_time_ms = (time.time() - start_time) * 1000

            if not success:
                status = IntegrationStatus.DOWN
            elif response_time_ms > config.unhealthy_threshold_ms:
                status = IntegrationStatus.UNHEALTHY
            elif response_time_ms > config.degraded_threshold_ms:
                status = IntegrationStatus.DEGRADED
            else:
                status = IntegrationStatus.HEALTHY

            return HealthCheckResult(
                integration_name=integration_name,
                status=status,
                response_time_ms=response_time_ms,
                error_message=error_msg,
                metadata=metadata
            )

        except asyncio.TimeoutError:
            response_time_ms = (time.time() - start_time) * 1000
            return HealthCheckResult(
                integration_name=integration_name,
                status=IntegrationStatus.DOWN,
                response_time_ms=response_time_ms,
                error_message="Health check timeout"
            )
        except Exception as e:
            response_time_ms = (time.time() - start_time) * 1000
            return HealthCheckResult(
                integration_name=integration_name,
                status=IntegrationStatus.DOWN,
                response_time_ms=response_time_ms,
                error_message=str(e)
            )

    async def _builtin_health_check(self, integration_name: str, config: HealthCheckConfig) -> tuple[bool, Optional[str], Optional[Dict]]:
        """Built-in health checks for common integrations"""
        try:
            if config.integration_type == IntegrationType.DATABASE:
                if integration_name == "postgresql":
                    # Test PostgreSQL connection
                    return await self._check_postgresql()
                elif integration_name == "redis":
                    # Test Redis connection
                    return await self._check_redis()

            elif config.integration_type == IntegrationType.CLOUD_STORAGE:
                if integration_name == "aws_s3":
                    return await self._check_aws_s3()
                elif integration_name == "google_cloud_storage":
                    return await self._check_gcs()
                elif integration_name == "azure_blob":
                    return await self._check_azure_blob()

            return False, f"No health check implementation for {integration_name}", None

        except Exception as e:
            return False, str(e), None

    async def _check_postgresql(self) -> tuple[bool, Optional[str], Optional[Dict]]:
        """Health check for PostgreSQL"""
        try:
            # This would use a test connection from the connection pool
            # For now, return a mock successful check
            return True, None, {"connection_pool_size": 10, "active_connections": 3}
        except Exception as e:
            return False, str(e), None

    async def _check_redis(self) -> tuple[bool, Optional[str], Optional[Dict]]:
        """Health check for Redis"""
        try:
            if self.redis:
                # Test Redis with a simple ping
                result = await self.redis.ping()
                if result:
                    info = await self.redis.info()
                    return True, None, {
                        "used_memory": info.get("used_memory", 0),
                        "connected_clients": info.get("connected_clients", 0)
                    }
            return False, "Redis not connected", None
        except Exception as e:
            return False, str(e), None

    async def _check_aws_s3(self) -> tuple[bool, Optional[str], Optional[Dict]]:
        """Health check for AWS S3"""
        try:
            # Test S3 connection with a simple operation
            success = await self.cloud_connector.connect_aws_s3(
                connection_name="health_check",
                access_key_id="test",
                secret_access_key="test",
                region_name="us-east-1"
            )
            return success, None if success else "S3 connection failed", None
        except Exception as e:
            return False, str(e), None

    async def _check_gcs(self) -> tuple[bool, Optional[str], Optional[Dict]]:
        """Health check for Google Cloud Storage"""
        try:
            success = await self.cloud_connector.connect_gcs(
                connection_name="health_check",
                credentials_path="/nonexistent/path.json",
                project_id="test-project"
            )
            return success, None if success else "GCS connection failed", None
        except Exception as e:
            return False, str(e), None

    async def _check_azure_blob(self) -> tuple[bool, Optional[str], Optional[Dict]]:
        """Health check for Azure Blob Storage"""
        try:
            success = await self.cloud_connector.connect_azure_blob(
                connection_name="health_check",
                account_name="testaccount",
                account_key="dGVzdGtleQ=="
            )
            return success, None if success else "Azure Blob connection failed", None
        except Exception as e:
            return False, str(e), None

    async def _store_health_check_result(self, result: HealthCheckResult):
        """Store health check result in database"""
        check_id = f"{result.integration_name}_{int(time.time() * 1000)}"

        health_check = HealthCheck(
            id=check_id,
            integration_name=result.integration_name,
            integration_type=self.health_configs[result.integration_name].integration_type.value,
            customer_id="system",  # System-level health check
            status=result.status.value,
            response_time_ms=result.response_time_ms,
            error_message=result.error_message,
            metadata=result.metadata or {}
        )

        with self.SessionLocal() as session:
            session.add(health_check)
            session.commit()

        # Store in Redis for real-time access
        await self.redis.setex(
            f"integration_status:{result.integration_name}",
            300,  # 5 minutes TTL
            json.dumps(asdict(result))
        )

    async def _update_prometheus_metrics(self, result: HealthCheckResult, config: HealthCheckConfig):
        """Update Prometheus metrics"""
        # Status gauge (1=healthy, 0.5=degraded, 0=unhealthy/down)
        status_value = {
            IntegrationStatus.HEALTHY: 1.0,
            IntegrationStatus.DEGRADED: 0.5,
            IntegrationStatus.UNHEALTHY: 0.25,
            IntegrationStatus.DOWN: 0.0,
            IntegrationStatus.UNKNOWN: 0.0
        }.get(result.status, 0.0)

        self.integration_status_gauge.labels(
            integration_name=result.integration_name,
            customer_id="system",
            integration_type=config.integration_type.value
        ).set(status_value)

        # Response time histogram
        self.integration_response_time.labels(
            integration_name=result.integration_name,
            customer_id="system",
            integration_type=config.integration_type.value
        ).observe(result.response_time_ms / 1000.0)

        # Request counter
        status_label = "success" if result.status in [IntegrationStatus.HEALTHY, IntegrationStatus.DEGRADED] else "failure"
        self.integration_requests_total.labels(
            integration_name=result.integration_name,
            customer_id="system",
            integration_type=config.integration_type.value,
            status=status_label
        ).inc()

        # Error counter
        if result.error_message:
            self.integration_errors_total.labels(
                integration_name=result.integration_name,
                customer_id="system",
                integration_type=config.integration_type.value,
                error_type="health_check_failure"
            ).inc()

    async def _check_for_incidents(self, result: HealthCheckResult, config: HealthCheckConfig):
        """Check for incidents and status changes"""
        previous_status = self.integration_statuses.get(result.integration_name, IntegrationStatus.UNKNOWN)
        current_status = result.status

        # Update failure counter
        if result.status in [IntegrationStatus.UNHEALTHY, IntegrationStatus.DOWN]:
            self.failure_counters[result.integration_name] = self.failure_counters.get(result.integration_name, 0) + 1
        else:
            self.failure_counters[result.integration_name] = 0

        # Check if we should declare an incident
        failure_count = self.failure_counters.get(result.integration_name, 0)

        if failure_count >= config.failure_threshold and previous_status != IntegrationStatus.DOWN:
            await self._create_incident(result, config, "outage")
        elif current_status == IntegrationStatus.DEGRADED and previous_status == IntegrationStatus.HEALTHY:
            await self._create_incident(result, config, "degradation")

        # Check for recovery
        if current_status == IntegrationStatus.HEALTHY and previous_status in [IntegrationStatus.DOWN, IntegrationStatus.UNHEALTHY]:
            await self._resolve_incidents(result.integration_name)

        # Update current status
        self.integration_statuses[result.integration_name] = current_status

    async def _create_incident(self, result: HealthCheckResult, config: HealthCheckConfig, incident_type: str):
        """Create a new incident"""
        incident_id = f"incident_{result.integration_name}_{int(time.time() * 1000)}"

        severity = "critical" if result.status == IntegrationStatus.DOWN else "medium"

        incident = IntegrationIncident(
            id=incident_id,
            integration_name=result.integration_name,
            customer_id="system",
            incident_type=incident_type,
            severity=severity,
            affected_operations=[config.integration_type.value],
            root_cause=result.error_message or "Unknown"
        )

        with self.SessionLocal() as session:
            session.add(incident)
            session.commit()

        logger.warning(f"Created incident {incident_id} for {result.integration_name}: {incident_type}")

    async def _resolve_incidents(self, integration_name: str):
        """Resolve active incidents for an integration"""
        with self.SessionLocal() as session:
            active_incidents = session.query(IntegrationIncident).filter(
                IntegrationIncident.integration_name == integration_name,
                IntegrationIncident.is_resolved == False
            ).all()

            for incident in active_incidents:
                incident.resolved_at = datetime.utcnow()
                incident.is_resolved = True
                incident.duration_minutes = int((incident.resolved_at - incident.started_at).total_seconds() / 60)
                incident.resolution_notes = "Integration recovered"

            session.commit()

        if active_incidents:
            logger.info(f"Resolved {len(active_incidents)} incidents for {integration_name}")

    async def get_integration_status(self, integration_name: str) -> Optional[Dict[str, Any]]:
        """Get current status of a specific integration"""
        # Try Redis first for real-time data
        cached_status = await self.redis.get(f"integration_status:{integration_name}")
        if cached_status:
            return json.loads(cached_status)

        # Fall back to database
        with self.SessionLocal() as session:
            latest_check = session.query(HealthCheck).filter(
                HealthCheck.integration_name == integration_name
            ).order_by(HealthCheck.timestamp.desc()).first()

            if latest_check:
                return {
                    "integration_name": latest_check.integration_name,
                    "status": latest_check.status,
                    "response_time_ms": latest_check.response_time_ms,
                    "error_message": latest_check.error_message,
                    "timestamp": latest_check.timestamp.isoformat(),
                    "metadata": latest_check.metadata
                }

        return None

    async def get_all_integrations_status(self) -> Dict[str, Any]:
        """Get status of all integrations"""
        statuses = {}

        for integration_name in self.health_configs.keys():
            status = await self.get_integration_status(integration_name)
            if status:
                statuses[integration_name] = status

        # Calculate overall health
        healthy_count = sum(1 for s in statuses.values() if s["status"] == "healthy")
        total_count = len(statuses)
        overall_health = "healthy" if healthy_count == total_count else "degraded" if healthy_count > total_count // 2 else "unhealthy"

        return {
            "overall_health": overall_health,
            "integrations": statuses,
            "summary": {
                "total": total_count,
                "healthy": healthy_count,
                "degraded": sum(1 for s in statuses.values() if s["status"] == "degraded"),
                "unhealthy": sum(1 for s in statuses.values() if s["status"] in ["unhealthy", "down"])
            }
        }

    async def get_integration_metrics(self, integration_name: str, days: int = 7) -> Dict[str, Any]:
        """Get metrics for a specific integration over time"""
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        with self.SessionLocal() as session:
            # Get health checks
            health_checks = session.query(HealthCheck).filter(
                HealthCheck.integration_name == integration_name,
                HealthCheck.timestamp >= start_date
            ).order_by(HealthCheck.timestamp).all()

            # Get incidents
            incidents = session.query(IntegrationIncident).filter(
                IntegrationIncident.integration_name == integration_name,
                IntegrationIncident.started_at >= start_date
            ).all()

            # Calculate metrics
            total_checks = len(health_checks)
            successful_checks = len([c for c in health_checks if c.status == "healthy"])
            uptime_percentage = (successful_checks / total_checks * 100) if total_checks > 0 else 0

            response_times = [c.response_time_ms for c in health_checks if c.response_time_ms > 0]
            avg_response_time = sum(response_times) / len(response_times) if response_times else 0
            p95_response_time = sorted(response_times)[int(len(response_times) * 0.95)] if response_times else 0

            return {
                "integration_name": integration_name,
                "period": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat(),
                    "days": days
                },
                "metrics": {
                    "uptime_percentage": uptime_percentage,
                    "total_checks": total_checks,
                    "successful_checks": successful_checks,
                    "failed_checks": total_checks - successful_checks,
                    "avg_response_time_ms": avg_response_time,
                    "p95_response_time_ms": p95_response_time
                },
                "incidents": [
                    {
                        "id": inc.id,
                        "type": inc.incident_type,
                        "severity": inc.severity,
                        "started_at": inc.started_at.isoformat(),
                        "resolved_at": inc.resolved_at.isoformat() if inc.resolved_at else None,
                        "duration_minutes": inc.duration_minutes
                    }
                    for inc in incidents
                ]
            }

    def add_custom_health_check(self, config: HealthCheckConfig):
        """Add a custom health check configuration"""
        self.health_configs[config.integration_name] = config

        # Start health check task if monitor is running
        if self.redis:  # Check if monitor is started
            task = asyncio.create_task(
                self._health_check_loop(config.integration_name, config)
            )
            self.health_check_tasks[config.integration_name] = task

        logger.info(f"Added custom health check for {config.integration_name}")

# Integration with existing services
async def get_customer_integration_health(customer_id: str, integration_monitor: IntegrationHealthMonitor) -> Dict[str, Any]:
    """Get integration health status for a specific customer"""
    # This would filter integrations based on customer's active connections
    # For now, return system-wide status
    return await integration_monitor.get_all_integrations_status()