"""
Comprehensive health check system for Schlep-engine
Provides detailed health status for all services and dependencies
"""

import asyncio
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from enum import Enum
import psutil
import redis
from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi import HTTPException, Depends
from prometheus_client import Counter, Histogram, Gauge
import httpx
import json
import logging

from app.database.connection import get_db
from app.core.config import settings
from app.services.storage_service import StorageService
from app.services.celery_service import CeleryService

logger = logging.getLogger(__name__)

# Prometheus metrics for health checks
HEALTH_CHECK_COUNTER = Counter('health_check_total', 'Total health checks performed', ['service', 'status'])
HEALTH_CHECK_DURATION = Histogram('health_check_duration_seconds', 'Health check duration', ['service'])
SERVICE_STATUS = Gauge('service_status', 'Service health status (1=healthy, 0=unhealthy)', ['service'])

class HealthStatus(str, Enum):
    """Health status enumeration"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"

class ServiceType(str, Enum):
    """Service type enumeration"""
    DATABASE = "database"
    REDIS = "redis"
    STORAGE = "storage"
    CELERY = "celery"
    EXTERNAL_API = "external_api"
    SYSTEM = "system"

class HealthCheckResult:
    """Result of a health check"""
    
    def __init__(
        self,
        service: str,
        status: HealthStatus,
        message: str = "",
        details: Optional[Dict[str, Any]] = None,
        response_time: Optional[float] = None,
        last_check: Optional[datetime] = None
    ):
        self.service = service
        self.status = status
        self.message = message
        self.details = details or {}
        self.response_time = response_time
        self.last_check = last_check or datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON response"""
        return {
            "service": self.service,
            "status": self.status.value,
            "message": self.message,
            "details": self.details,
            "response_time": self.response_time,
            "last_check": self.last_check.isoformat() if self.last_check else None
        }

class HealthChecker:
    """Comprehensive health checker for all services"""
    
    def __init__(self):
        self.cache: Dict[str, HealthCheckResult] = {}
        self.cache_ttl = 30  # Cache results for 30 seconds
        
    async def check_database_health(self, db: Session) -> HealthCheckResult:
        """Check database connectivity and performance"""
        start_time = time.time()
        
        try:
            # Test basic connectivity
            result = db.execute(text("SELECT 1"))
            result.fetchone()
            
            # Test performance with a simple query
            start_perf = time.time()
            db.execute(text("SELECT COUNT(*) FROM information_schema.tables"))
            perf_time = time.time() - start_perf
            
            # Check database size
            size_result = db.execute(text("""
                SELECT pg_size_pretty(pg_database_size(current_database())) as size
            """))
            db_size = size_result.fetchone()[0]
            
            # Check active connections
            conn_result = db.execute(text("""
                SELECT count(*) FROM pg_stat_activity WHERE state = 'active'
            """))
            active_connections = conn_result.fetchone()[0]
            
            response_time = time.time() - start_time
            
            details = {
                "database_name": "schlep_engine",
                "size": db_size,
                "active_connections": active_connections,
                "query_performance_ms": round(perf_time * 1000, 2)
            }
            
            status = HealthStatus.HEALTHY
            message = "Database is healthy"
            
            if perf_time > 1.0:  # Query takes more than 1 second
                status = HealthStatus.DEGRADED
                message = "Database performance is degraded"
            
        except Exception as e:
            response_time = time.time() - start_time
            status = HealthStatus.UNHEALTHY
            message = f"Database health check failed: {str(e)}"
            details = {"error": str(e)}
        
        result = HealthCheckResult(
            service=ServiceType.DATABASE,
            status=status,
            message=message,
            details=details,
            response_time=response_time
        )
        
        # Update Prometheus metrics
        HEALTH_CHECK_COUNTER.labels(service=ServiceType.DATABASE, status=status.value).inc()
        HEALTH_CHECK_DURATION.labels(service=ServiceType.DATABASE).observe(response_time)
        SERVICE_STATUS.labels(service=ServiceType.DATABASE).set(1 if status == HealthStatus.HEALTHY else 0)
        
        return result
    
    async def check_redis_health(self) -> HealthCheckResult:
        """Check Redis connectivity and performance"""
        start_time = time.time()
        
        try:
            # Connect to Redis
            redis_client = redis.from_url(settings.REDIS_URL)
            
            # Test basic connectivity
            redis_client.ping()
            
            # Test performance
            start_perf = time.time()
            redis_client.set("health_check_test", "test_value", ex=60)
            redis_client.get("health_check_test")
            perf_time = time.time() - start_perf
            
            # Get Redis info
            info = redis_client.info()
            
            response_time = time.time() - start_time
            
            details = {
                "redis_version": info.get("redis_version"),
                "connected_clients": info.get("connected_clients"),
                "used_memory_human": info.get("used_memory_human"),
                "keyspace_hits": info.get("keyspace_hits"),
                "keyspace_misses": info.get("keyspace_misses"),
                "query_performance_ms": round(perf_time * 1000, 2)
            }
            
            status = HealthStatus.HEALTHY
            message = "Redis is healthy"
            
            if perf_time > 0.1:  # Operation takes more than 100ms
                status = HealthStatus.DEGRADED
                message = "Redis performance is degraded"
            
        except Exception as e:
            response_time = time.time() - start_time
            status = HealthStatus.UNHEALTHY
            message = f"Redis health check failed: {str(e)}"
            details = {"error": str(e)}
        
        result = HealthCheckResult(
            service=ServiceType.REDIS,
            status=status,
            message=message,
            details=details,
            response_time=response_time
        )
        
        # Update Prometheus metrics
        HEALTH_CHECK_COUNTER.labels(service=ServiceType.REDIS, status=status.value).inc()
        HEALTH_CHECK_DURATION.labels(service=ServiceType.REDIS).observe(response_time)
        SERVICE_STATUS.labels(service=ServiceType.REDIS).set(1 if status == HealthStatus.HEALTHY else 0)
        
        return result
    
    async def check_storage_health(self) -> HealthCheckResult:
        """Check cloud storage connectivity and performance"""
        start_time = time.time()
        
        try:
            storage_service = StorageService()
            
            # Test storage connectivity
            start_perf = time.time()
            bucket_info = await storage_service.get_bucket_info()
            perf_time = time.time() - start_perf
            
            response_time = time.time() - start_time
            
            details = {
                "provider": storage_service.provider,
                "bucket_name": storage_service.bucket_name,
                "bucket_size": bucket_info.get("size", "unknown"),
                "object_count": bucket_info.get("object_count", "unknown"),
                "query_performance_ms": round(perf_time * 1000, 2)
            }
            
            status = HealthStatus.HEALTHY
            message = "Storage service is healthy"
            
            if perf_time > 2.0:  # Operation takes more than 2 seconds
                status = HealthStatus.DEGRADED
                message = "Storage service performance is degraded"
            
        except Exception as e:
            response_time = time.time() - start_time
            status = HealthStatus.UNHEALTHY
            message = f"Storage health check failed: {str(e)}"
            details = {"error": str(e)}
        
        result = HealthCheckResult(
            service=ServiceType.STORAGE,
            status=status,
            message=message,
            details=details,
            response_time=response_time
        )
        
        # Update Prometheus metrics
        HEALTH_CHECK_COUNTER.labels(service=ServiceType.STORAGE, status=status.value).inc()
        HEALTH_CHECK_DURATION.labels(service=ServiceType.STORAGE).observe(response_time)
        SERVICE_STATUS.labels(service=ServiceType.STORAGE).set(1 if status == HealthStatus.HEALTHY else 0)
        
        return result
    
    async def check_celery_health(self) -> HealthCheckResult:
        """Check Celery worker health and queue status"""
        start_time = time.time()
        
        try:
            celery_service = CeleryService()
            
            # Check worker status
            start_perf = time.time()
            worker_stats = await celery_service.get_worker_stats()
            perf_time = time.time() - start_perf
            
            # Check queue status
            queue_stats = await celery_service.get_queue_stats()
            
            response_time = time.time() - start_time
            
            active_workers = len([w for w in worker_stats if w.get("status") == "active"])
            total_workers = len(worker_stats)
            
            details = {
                "active_workers": active_workers,
                "total_workers": total_workers,
                "queue_length": queue_stats.get("total_tasks", 0),
                "failed_tasks": queue_stats.get("failed_tasks", 0),
                "query_performance_ms": round(perf_time * 1000, 2)
            }
            
            status = HealthStatus.HEALTHY
            message = "Celery is healthy"
            
            if active_workers == 0:
                status = HealthStatus.UNHEALTHY
                message = "No active Celery workers"
            elif active_workers < total_workers:
                status = HealthStatus.DEGRADED
                message = f"Only {active_workers}/{total_workers} workers are active"
            
        except Exception as e:
            response_time = time.time() - start_time
            status = HealthStatus.UNHEALTHY
            message = f"Celery health check failed: {str(e)}"
            details = {"error": str(e)}
        
        result = HealthCheckResult(
            service=ServiceType.CELERY,
            status=status,
            message=message,
            details=details,
            response_time=response_time
        )
        
        # Update Prometheus metrics
        HEALTH_CHECK_COUNTER.labels(service=ServiceType.CELERY, status=status.value).inc()
        HEALTH_CHECK_DURATION.labels(service=ServiceType.CELERY).observe(response_time)
        SERVICE_STATUS.labels(service=ServiceType.CELERY).set(1 if status == HealthStatus.HEALTHY else 0)
        
        return result
    
    async def check_external_api_health(self) -> HealthCheckResult:
        """Check external API dependencies"""
        start_time = time.time()
        
        try:
            # Check external APIs (example: ML model service, data processing APIs)
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Check ML model service if configured
                if hasattr(settings, 'ML_SERVICE_URL') and settings.ML_SERVICE_URL:
                    start_perf = time.time()
                    response = await client.get(f"{settings.ML_SERVICE_URL}/health")
                    perf_time = time.time() - start_perf
                    
                    if response.status_code == 200:
                        status = HealthStatus.HEALTHY
                        message = "External APIs are healthy"
                    else:
                        status = HealthStatus.DEGRADED
                        message = f"External API returned status {response.status_code}"
                else:
                    status = HealthStatus.HEALTHY
                    message = "No external APIs configured"
                    perf_time = 0
            
            response_time = time.time() - start_time
            
            details = {
                "ml_service_url": getattr(settings, 'ML_SERVICE_URL', 'not_configured'),
                "query_performance_ms": round(perf_time * 1000, 2) if perf_time > 0 else 0
            }
            
        except Exception as e:
            response_time = time.time() - start_time
            status = HealthStatus.UNHEALTHY
            message = f"External API health check failed: {str(e)}"
            details = {"error": str(e)}
        
        result = HealthCheckResult(
            service=ServiceType.EXTERNAL_API,
            status=status,
            message=message,
            details=details,
            response_time=response_time
        )
        
        # Update Prometheus metrics
        HEALTH_CHECK_COUNTER.labels(service=ServiceType.EXTERNAL_API, status=status.value).inc()
        HEALTH_CHECK_DURATION.labels(service=ServiceType.EXTERNAL_API).observe(response_time)
        SERVICE_STATUS.labels(service=ServiceType.EXTERNAL_API).set(1 if status == HealthStatus.HEALTHY else 0)
        
        return result
    
    async def check_system_health(self) -> HealthCheckResult:
        """Check system resources and performance"""
        start_time = time.time()
        
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            
            # Memory usage
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            
            # Disk usage
            disk = psutil.disk_usage('/')
            disk_percent = disk.percent
            
            # Network I/O
            network = psutil.net_io_counters()
            
            response_time = time.time() - start_time
            
            details = {
                "cpu_usage_percent": round(cpu_percent, 2),
                "memory_usage_percent": round(memory_percent, 2),
                "memory_available_gb": round(memory.available / (1024**3), 2),
                "disk_usage_percent": round(disk_percent, 2),
                "disk_free_gb": round(disk.free / (1024**3), 2),
                "network_bytes_sent": network.bytes_sent,
                "network_bytes_recv": network.bytes_recv
            }
            
            status = HealthStatus.HEALTHY
            message = "System is healthy"
            
            # Check thresholds
            if cpu_percent > 90:
                status = HealthStatus.DEGRADED
                message = "High CPU usage detected"
            elif memory_percent > 90:
                status = HealthStatus.DEGRADED
                message = "High memory usage detected"
            elif disk_percent > 90:
                status = HealthStatus.DEGRADED
                message = "High disk usage detected"
            
        except Exception as e:
            response_time = time.time() - start_time
            status = HealthStatus.UNHEALTHY
            message = f"System health check failed: {str(e)}"
            details = {"error": str(e)}
        
        result = HealthCheckResult(
            service=ServiceType.SYSTEM,
            status=status,
            message=message,
            details=details,
            response_time=response_time
        )
        
        # Update Prometheus metrics
        HEALTH_CHECK_COUNTER.labels(service=ServiceType.SYSTEM, status=status.value).inc()
        HEALTH_CHECK_DURATION.labels(service=ServiceType.SYSTEM).observe(response_time)
        SERVICE_STATUS.labels(service=ServiceType.SYSTEM).set(1 if status == HealthStatus.HEALTHY else 0)
        
        return result
    
    async def run_all_health_checks(self, db: Session) -> Dict[str, Any]:
        """Run all health checks and return comprehensive status"""
        start_time = time.time()
        
        # Run all health checks concurrently
        tasks = [
            self.check_database_health(db),
            self.check_redis_health(),
            self.check_storage_health(),
            self.check_celery_health(),
            self.check_external_api_health(),
            self.check_system_health()
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        health_results = {}
        overall_status = HealthStatus.HEALTHY
        failed_services = []
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                service_name = list(ServiceType)[i].value
                health_results[service_name] = HealthCheckResult(
                    service=service_name,
                    status=HealthStatus.UNHEALTHY,
                    message=f"Health check failed with exception: {str(result)}",
                    details={"error": str(result)}
                )
                failed_services.append(service_name)
            else:
                health_results[result.service.value] = result
                if result.status == HealthStatus.UNHEALTHY:
                    failed_services.append(result.service.value)
        
        # Determine overall status
        if any(r.status == HealthStatus.UNHEALTHY for r in health_results.values()):
            overall_status = HealthStatus.UNHEALTHY
        elif any(r.status == HealthStatus.DEGRADED for r in health_results.values()):
            overall_status = HealthStatus.DEGRADED
        
        total_time = time.time() - start_time
        
        return {
            "status": overall_status.value,
            "timestamp": datetime.utcnow().isoformat(),
            "version": getattr(settings, 'APP_VERSION', '1.0.0'),
            "environment": getattr(settings, 'ENVIRONMENT', 'development'),
            "total_check_time": round(total_time, 3),
            "services": {k: v.to_dict() for k, v in health_results.items()},
            "failed_services": failed_services,
            "summary": {
                "total_services": len(health_results),
                "healthy_services": len([r for r in health_results.values() if r.status == HealthStatus.HEALTHY]),
                "degraded_services": len([r for r in health_results.values() if r.status == HealthStatus.DEGRADED]),
                "unhealthy_services": len([r for r in health_results.values() if r.status == HealthStatus.UNHEALTHY])
            }
        }

# Global health checker instance
health_checker = HealthChecker()

async def get_health_status(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get comprehensive health status for all services"""
    return await health_checker.run_all_health_checks(db)

async def get_simple_health_status(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get simple health status for load balancers"""
    health_data = await health_checker.run_all_health_checks(db)
    
    # Return simple status for load balancers
    return {
        "status": health_data["status"],
        "timestamp": health_data["timestamp"],
        "version": health_data["version"]
    }

async def get_ready_status(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get readiness status for Kubernetes readiness probes"""
    # Check only critical services for readiness
    critical_services = [
        health_checker.check_database_health(db),
        health_checker.check_redis_health()
    ]
    
    results = await asyncio.gather(*critical_services, return_exceptions=True)
    
    # Check if all critical services are healthy
    all_healthy = all(
        not isinstance(result, Exception) and result.status == HealthStatus.HEALTHY
        for result in results
    )
    
    return {
        "ready": all_healthy,
        "timestamp": datetime.utcnow().isoformat()
    } 