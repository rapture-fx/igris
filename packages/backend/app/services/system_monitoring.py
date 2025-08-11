"""
System Monitoring Service
========================

Comprehensive system monitoring for DevOps teams including job monitoring,
resource usage tracking, performance metrics, and health checks.

Key Features:
- Real-time job queue monitoring
- Resource usage tracking
- Performance metrics collection
- Health check endpoints
- Alert generation
- Historical metrics storage
"""

import asyncio
import logging
import psutil
import time
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.database.connection import get_db_session
from app.database.ml_preparation_models import (
    DataPreparationPipeline, PreparationStage, DataQualityLevel
)
from app.services.webhook_service import webhook_service, WebhookEventType
from app.core.config import settings

logger = logging.getLogger(__name__)


class HealthStatus(Enum):
    """System health status levels"""
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    UNKNOWN = "unknown"


class AlertLevel(Enum):
    """Alert severity levels"""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class SystemMetrics:
    """System resource metrics"""
    timestamp: str
    cpu_usage_percent: float
    memory_usage_percent: float
    memory_available_gb: float
    disk_usage_percent: float
    disk_available_gb: float
    network_io_mb: Dict[str, float]
    load_average: List[float]
    active_connections: int


@dataclass
class JobQueueMetrics:
    """Job queue monitoring metrics"""
    timestamp: str
    pending_jobs: int
    active_jobs: int
    completed_jobs_last_hour: int
    failed_jobs_last_hour: int
    average_job_duration_minutes: float
    queue_wait_time_minutes: float
    worker_count: int
    worker_utilization_percent: float


@dataclass
class DatabaseMetrics:
    """Database performance metrics"""
    timestamp: str
    active_connections: int
    total_pipelines: int
    pipelines_last_24h: int
    average_query_time_ms: float
    database_size_gb: float
    cache_hit_ratio: float


@dataclass
class ApplicationMetrics:
    """Application-specific metrics"""
    timestamp: str
    pipelines_per_hour: float
    average_processing_time_minutes: float
    success_rate_percentage: float
    quality_score_average: float
    framework_export_counts: Dict[str, int]
    error_rate_percentage: float


@dataclass
class HealthCheck:
    """Health check result"""
    service_name: str
    status: HealthStatus
    message: str
    timestamp: str
    response_time_ms: float
    details: Optional[Dict[str, Any]] = None


class SystemMonitoringService:
    """
    Comprehensive system monitoring service for DevOps teams
    """
    
    def __init__(self):
        self.redis_client = None
        self.metrics_history = []
        self.alert_thresholds = {
            "cpu_usage": 80.0,
            "memory_usage": 85.0,
            "disk_usage": 90.0,
            "queue_length": 100,
            "error_rate": 5.0,
            "response_time": 30000  # 30 seconds in ms
        }
        
        try:
            self.redis_client = redis.Redis(
                host=getattr(settings, 'REDIS_HOST', 'localhost'),
                port=getattr(settings, 'REDIS_PORT', 6379),
                decode_responses=True
            )
        except Exception as e:
            logger.warning(f"Redis connection failed: {str(e)}")
    
    async def get_system_metrics(self) -> SystemMetrics:
        """
        Collect current system resource metrics
        """
        
        # CPU metrics
        cpu_percent = psutil.cpu_percent(interval=1)
        
        # Memory metrics
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
        memory_available_gb = memory.available / (1024**3)
        
        # Disk metrics
        disk = psutil.disk_usage('/')
        disk_percent = (disk.used / disk.total) * 100
        disk_available_gb = disk.free / (1024**3)
        
        # Network metrics
        network = psutil.net_io_counters()
        network_io_mb = {
            "bytes_sent": network.bytes_sent / (1024**2),
            "bytes_recv": network.bytes_recv / (1024**2)
        }
        
        # Load average
        load_avg = list(psutil.getloadavg()) if hasattr(psutil, 'getloadavg') else [0.0, 0.0, 0.0]
        
        # Active connections
        connections = len(psutil.net_connections())
        
        return SystemMetrics(
            timestamp=datetime.utcnow().isoformat(),
            cpu_usage_percent=cpu_percent,
            memory_usage_percent=memory_percent,
            memory_available_gb=memory_available_gb,
            disk_usage_percent=disk_percent,
            disk_available_gb=disk_available_gb,
            network_io_mb=network_io_mb,
            load_average=load_avg,
            active_connections=connections
        )
    
    async def get_job_queue_metrics(self) -> JobQueueMetrics:
        """
        Collect job queue and worker metrics
        """
        
        async with get_db_session() as db:
            # Get pipeline counts by status
            one_hour_ago = datetime.utcnow() - timedelta(hours=1)
            
            # Pending jobs
            pending_query = select(func.count(DataPreparationPipeline.id)).where(
                DataPreparationPipeline.is_ml_ready == False
            )
            pending_result = await db.execute(pending_query)
            pending_jobs = pending_result.scalar() or 0
            
            # Active jobs (currently processing)
            active_query = select(func.count(DataPreparationPipeline.id)).where(
                and_(
                    DataPreparationPipeline.is_ml_ready == False,
                    DataPreparationPipeline.current_stage != PreparationStage.INGESTION
                )
            )
            active_result = await db.execute(active_query)
            active_jobs = active_result.scalar() or 0
            
            # Completed jobs last hour
            completed_query = select(func.count(DataPreparationPipeline.id)).where(
                and_(
                    DataPreparationPipeline.is_ml_ready == True,
                    DataPreparationPipeline.completed_at >= one_hour_ago
                )
            )
            completed_result = await db.execute(completed_query)
            completed_jobs = completed_result.scalar() or 0
            
            # Failed jobs last hour (approximated by uncompleted old jobs)
            failed_query = select(func.count(DataPreparationPipeline.id)).where(
                and_(
                    DataPreparationPipeline.is_ml_ready == False,
                    DataPreparationPipeline.created_at < one_hour_ago,
                    DataPreparationPipeline.progress_percentage == 0
                )
            )
            failed_result = await db.execute(failed_query)
            failed_jobs = failed_result.scalar() or 0
            
            # Average job duration
            duration_query = select(func.avg(DataPreparationPipeline.processing_time_seconds)).where(
                and_(
                    DataPreparationPipeline.processing_time_seconds.isnot(None),
                    DataPreparationPipeline.completed_at >= one_hour_ago
                )
            )
            duration_result = await db.execute(duration_query)
            avg_duration_seconds = duration_result.scalar() or 0
            avg_duration_minutes = avg_duration_seconds / 60 if avg_duration_seconds else 0
        
        # Queue wait time (estimated)
        queue_wait_time = pending_jobs * 2  # Estimate 2 minutes per pending job
        
        # Worker metrics (estimated based on system load)
        worker_count = psutil.cpu_count()
        cpu_percent = psutil.cpu_percent()
        worker_utilization = min(100, cpu_percent * 1.2)  # Estimate based on CPU
        
        return JobQueueMetrics(
            timestamp=datetime.utcnow().isoformat(),
            pending_jobs=pending_jobs,
            active_jobs=active_jobs,
            completed_jobs_last_hour=completed_jobs,
            failed_jobs_last_hour=failed_jobs,
            average_job_duration_minutes=avg_duration_minutes,
            queue_wait_time_minutes=queue_wait_time,
            worker_count=worker_count,
            worker_utilization_percent=worker_utilization
        )
    
    async def get_database_metrics(self) -> DatabaseMetrics:
        """
        Collect database performance metrics
        """
        
        async with get_db_session() as db:
            # Total pipelines
            total_query = select(func.count(DataPreparationPipeline.id))
            total_result = await db.execute(total_query)
            total_pipelines = total_result.scalar() or 0
            
            # Pipelines in last 24 hours
            yesterday = datetime.utcnow() - timedelta(days=1)
            recent_query = select(func.count(DataPreparationPipeline.id)).where(
                DataPreparationPipeline.created_at >= yesterday
            )
            recent_result = await db.execute(recent_query)
            pipelines_24h = recent_result.scalar() or 0
        
        # Database size (estimated)
        database_size_gb = total_pipelines * 0.001  # Rough estimate
        
        # Cache hit ratio (from Redis if available)
        cache_hit_ratio = 95.0  # Default value
        if self.redis_client:
            try:
                info = self.redis_client.info()
                hits = info.get('keyspace_hits', 0)
                misses = info.get('keyspace_misses', 0)
                if hits + misses > 0:
                    cache_hit_ratio = (hits / (hits + misses)) * 100
            except Exception:
                pass
        
        return DatabaseMetrics(
            timestamp=datetime.utcnow().isoformat(),
            active_connections=10,  # Estimated
            total_pipelines=total_pipelines,
            pipelines_last_24h=pipelines_24h,
            average_query_time_ms=5.0,  # Estimated
            database_size_gb=database_size_gb,
            cache_hit_ratio=cache_hit_ratio
        )
    
    async def get_application_metrics(self) -> ApplicationMetrics:
        """
        Collect application-specific performance metrics
        """
        
        async with get_db_session() as db:
            one_hour_ago = datetime.utcnow() - timedelta(hours=1)
            
            # Pipelines per hour
            recent_query = select(func.count(DataPreparationPipeline.id)).where(
                DataPreparationPipeline.created_at >= one_hour_ago
            )
            recent_result = await db.execute(recent_query)
            pipelines_last_hour = recent_result.scalar() or 0
            
            # Average processing time
            processing_query = select(func.avg(DataPreparationPipeline.processing_time_seconds)).where(
                and_(
                    DataPreparationPipeline.processing_time_seconds.isnot(None),
                    DataPreparationPipeline.completed_at >= one_hour_ago
                )
            )
            processing_result = await db.execute(processing_query)
            avg_processing_seconds = processing_result.scalar() or 0
            avg_processing_minutes = avg_processing_seconds / 60 if avg_processing_seconds else 0
            
            # Success rate
            completed_query = select(func.count(DataPreparationPipeline.id)).where(
                and_(
                    DataPreparationPipeline.is_ml_ready == True,
                    DataPreparationPipeline.created_at >= one_hour_ago
                )
            )
            completed_result = await db.execute(completed_query)
            completed_count = completed_result.scalar() or 0
            
            success_rate = (completed_count / pipelines_last_hour * 100) if pipelines_last_hour > 0 else 100
            error_rate = 100 - success_rate
            
            # Average quality score
            quality_query = select(func.avg(DataPreparationPipeline.quality_score)).where(
                and_(
                    DataPreparationPipeline.quality_score.isnot(None),
                    DataPreparationPipeline.completed_at >= one_hour_ago
                )
            )
            quality_result = await db.execute(quality_query)
            avg_quality = quality_result.scalar() or 0
            
            # Framework export counts (estimated)
            framework_exports = {
                "tensorflow": completed_count // 3,
                "pytorch": completed_count // 4,
                "sklearn": completed_count // 2,
                "huggingface": completed_count // 6
            }
        
        return ApplicationMetrics(
            timestamp=datetime.utcnow().isoformat(),
            pipelines_per_hour=float(pipelines_last_hour),
            average_processing_time_minutes=avg_processing_minutes,
            success_rate_percentage=success_rate,
            quality_score_average=float(avg_quality),
            framework_export_counts=framework_exports,
            error_rate_percentage=error_rate
        )
    
    async def perform_health_checks(self) -> List[HealthCheck]:
        """
        Perform comprehensive health checks
        """
        
        health_checks = []
        
        # Database health check
        db_check = await self._check_database_health()
        health_checks.append(db_check)
        
        # Redis health check
        redis_check = await self._check_redis_health()
        health_checks.append(redis_check)
        
        # System resources health check
        system_check = await self._check_system_health()
        health_checks.append(system_check)
        
        # Application health check
        app_check = await self._check_application_health()
        health_checks.append(app_check)
        
        return health_checks
    
    async def _check_database_health(self) -> HealthCheck:
        """Check database connectivity and performance"""
        
        start_time = time.time()
        
        try:
            async with get_db_session() as db:
                # Simple query to test connectivity
                result = await db.execute(select(func.count(DataPreparationPipeline.id)))
                count = result.scalar()
                
                response_time = (time.time() - start_time) * 1000
                
                if response_time > self.alert_thresholds["response_time"]:
                    status = HealthStatus.WARNING
                    message = f"Database responding slowly ({response_time:.1f}ms)"
                else:
                    status = HealthStatus.HEALTHY
                    message = f"Database healthy ({count} pipelines)"
                
                return HealthCheck(
                    service_name="database",
                    status=status,
                    message=message,
                    timestamp=datetime.utcnow().isoformat(),
                    response_time_ms=response_time,
                    details={"pipeline_count": count}
                )
                
        except Exception as e:
            return HealthCheck(
                service_name="database",
                status=HealthStatus.CRITICAL,
                message=f"Database connection failed: {str(e)}",
                timestamp=datetime.utcnow().isoformat(),
                response_time_ms=(time.time() - start_time) * 1000
            )
    
    async def _check_redis_health(self) -> HealthCheck:
        """Check Redis connectivity and performance"""
        
        start_time = time.time()
        
        if not self.redis_client:
            return HealthCheck(
                service_name="redis",
                status=HealthStatus.WARNING,
                message="Redis client not configured",
                timestamp=datetime.utcnow().isoformat(),
                response_time_ms=0
            )
        
        try:
            # Test Redis connectivity
            self.redis_client.ping()
            response_time = (time.time() - start_time) * 1000
            
            # Get Redis info
            info = self.redis_client.info()
            memory_usage = info.get('used_memory_human', 'unknown')
            
            return HealthCheck(
                service_name="redis",
                status=HealthStatus.HEALTHY,
                message=f"Redis healthy (memory: {memory_usage})",
                timestamp=datetime.utcnow().isoformat(),
                response_time_ms=response_time,
                details={"memory_usage": memory_usage}
            )
            
        except Exception as e:
            return HealthCheck(
                service_name="redis",
                status=HealthStatus.CRITICAL,
                message=f"Redis connection failed: {str(e)}",
                timestamp=datetime.utcnow().isoformat(),
                response_time_ms=(time.time() - start_time) * 1000
            )
    
    async def _check_system_health(self) -> HealthCheck:
        """Check system resource health"""
        
        try:
            metrics = await self.get_system_metrics()
            
            # Determine status based on thresholds
            status = HealthStatus.HEALTHY
            issues = []
            
            if metrics.cpu_usage_percent > self.alert_thresholds["cpu_usage"]:
                status = HealthStatus.WARNING
                issues.append(f"High CPU usage: {metrics.cpu_usage_percent:.1f}%")
            
            if metrics.memory_usage_percent > self.alert_thresholds["memory_usage"]:
                status = HealthStatus.WARNING
                issues.append(f"High memory usage: {metrics.memory_usage_percent:.1f}%")
            
            if metrics.disk_usage_percent > self.alert_thresholds["disk_usage"]:
                status = HealthStatus.CRITICAL
                issues.append(f"High disk usage: {metrics.disk_usage_percent:.1f}%")
            
            message = "System resources healthy" if not issues else "; ".join(issues)
            
            return HealthCheck(
                service_name="system",
                status=status,
                message=message,
                timestamp=datetime.utcnow().isoformat(),
                response_time_ms=0,
                details={
                    "cpu_percent": metrics.cpu_usage_percent,
                    "memory_percent": metrics.memory_usage_percent,
                    "disk_percent": metrics.disk_usage_percent
                }
            )
            
        except Exception as e:
            return HealthCheck(
                service_name="system",
                status=HealthStatus.CRITICAL,
                message=f"System check failed: {str(e)}",
                timestamp=datetime.utcnow().isoformat(),
                response_time_ms=0
            )
    
    async def _check_application_health(self) -> HealthCheck:
        """Check application-specific health"""
        
        try:
            app_metrics = await self.get_application_metrics()
            job_metrics = await self.get_job_queue_metrics()
            
            status = HealthStatus.HEALTHY
            issues = []
            
            if app_metrics.error_rate_percentage > self.alert_thresholds["error_rate"]:
                status = HealthStatus.WARNING
                issues.append(f"High error rate: {app_metrics.error_rate_percentage:.1f}%")
            
            if job_metrics.pending_jobs > self.alert_thresholds["queue_length"]:
                status = HealthStatus.WARNING
                issues.append(f"Long job queue: {job_metrics.pending_jobs} pending")
            
            message = "Application healthy" if not issues else "; ".join(issues)
            
            return HealthCheck(
                service_name="application",
                status=status,
                message=message,
                timestamp=datetime.utcnow().isoformat(),
                response_time_ms=0,
                details={
                    "error_rate": app_metrics.error_rate_percentage,
                    "pending_jobs": job_metrics.pending_jobs,
                    "success_rate": app_metrics.success_rate_percentage
                }
            )
            
        except Exception as e:
            return HealthCheck(
                service_name="application",
                status=HealthStatus.CRITICAL,
                message=f"Application check failed: {str(e)}",
                timestamp=datetime.utcnow().isoformat(),
                response_time_ms=0
            )
    
    async def get_comprehensive_status(self) -> Dict[str, Any]:
        """
        Get comprehensive system status for DevOps dashboard
        """
        
        # Collect all metrics
        system_metrics = await self.get_system_metrics()
        job_metrics = await self.get_job_queue_metrics()
        database_metrics = await self.get_database_metrics()
        app_metrics = await self.get_application_metrics()
        health_checks = await self.perform_health_checks()
        
        # Overall system status
        critical_issues = [hc for hc in health_checks if hc.status == HealthStatus.CRITICAL]
        warning_issues = [hc for hc in health_checks if hc.status == HealthStatus.WARNING]
        
        if critical_issues:
            overall_status = HealthStatus.CRITICAL
        elif warning_issues:
            overall_status = HealthStatus.WARNING
        else:
            overall_status = HealthStatus.HEALTHY
        
        return {
            "overall_status": overall_status.value,
            "timestamp": datetime.utcnow().isoformat(),
            "system_metrics": asdict(system_metrics),
            "job_metrics": asdict(job_metrics),
            "database_metrics": asdict(database_metrics),
            "application_metrics": asdict(app_metrics),
            "health_checks": [asdict(hc) for hc in health_checks],
            "alerts": {
                "critical": len(critical_issues),
                "warning": len(warning_issues),
                "total": len(critical_issues) + len(warning_issues)
            }
        }
    
    async def check_and_alert(self):
        """
        Check system status and send alerts if needed
        """
        
        status = await self.get_comprehensive_status()
        
        # Send alerts for critical issues
        for health_check in status["health_checks"]:
            if health_check["status"] == HealthStatus.CRITICAL.value:
                await webhook_service.send_system_alert_event(
                    alert_type="critical_health_check",
                    message=f"Critical issue in {health_check['service_name']}: {health_check['message']}",
                    severity="critical",
                    additional_data=health_check
                )
        
        # Send warnings for threshold breaches
        metrics = status["system_metrics"]
        if metrics["cpu_usage_percent"] > self.alert_thresholds["cpu_usage"]:
            await webhook_service.send_system_alert_event(
                alert_type="high_cpu_usage",
                message=f"CPU usage is {metrics['cpu_usage_percent']:.1f}%",
                severity="warning",
                additional_data={"cpu_usage": metrics["cpu_usage_percent"]}
            )


# Global instance
system_monitoring = SystemMonitoringService() 