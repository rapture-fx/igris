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
# TODO: Re-enable when services are implemented
# from app.services.storage_service import StorageService
# from app.services.celery_service import CeleryService

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
    ML_SERVICE = "ml_service"
    RL_SERVICE = "rl_service"

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
        self.cache_ttl = settings.HEALTH_CHECK_CACHE_TTL
        self.dependency_graph: Dict[str, List[str]] = {
            "api": ["database", "redis", "ml_service", "rl_service"],
            "ml_service": ["database", "redis", "storage"],
            "rl_service": ["database", "redis", "ml_service"],
            "storage": ["database"],
            "auth": ["database", "redis"],
            "notifications": ["database", "redis", "external_api"]
        }
        
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
            # Use the shared async Redis client
            from app.core.redis_client import get_redis_client
            redis_client = await get_redis_client()
            
            if not redis_client:
                raise Exception("Redis client is not available")
            
            # Test basic connectivity
            await redis_client.ping()
            
            # Test performance
            start_perf = time.time()
            await redis_client.setex("health_check_test", 60, "test_value")
            await redis_client.get("health_check_test")
            perf_time = time.time() - start_perf
            
            # Get Redis info
            info = await redis_client.info()
            
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
            # TODO: Implement storage service health check when StorageService is available
            # For now, return a healthy status with placeholder details
            response_time = time.time() - start_time
            
            details = {
                "provider": settings.STORAGE_PROVIDER,
                "bucket_name": settings.STORAGE_BUCKET,
                "status": "not_implemented",
                "query_performance_ms": 0.0
            }
            
            status = HealthStatus.HEALTHY
            message = "Storage service check not implemented"
            
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
            # TODO: Implement Celery health check when CeleryService is available
            # For now, return a healthy status with placeholder details
            response_time = time.time() - start_time
            
            details = {
                "broker_url": settings.CELERY_BROKER_URL,
                "result_backend": settings.CELERY_RESULT_BACKEND,
                "status": "not_implemented",
                "query_performance_ms": 0.0
            }
            
            status = HealthStatus.HEALTHY
            message = "Celery health check not implemented"
            
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
    
    async def check_ml_service_health(self) -> HealthCheckResult:
        """Check ML service health and model status"""
        start_time = time.time()
        
        try:
            # Import ML services
            try:
                from app.services.ml_service import MLService
                from app.models.ml.ml_status import get_ml_model_status
                ml_service = MLService()
            except ImportError:
                # ML service not available
                response_time = time.time() - start_time
                status = HealthStatus.DEGRADED
                message = "ML service not available in this configuration"
                details = {"error": "ML service not imported"}
                
                result = HealthCheckResult(
                    service=ServiceType.ML_SERVICE,
                    status=status,
                    message=message,
                    details=details,
                    response_time=response_time
                )
                
                # Update Prometheus metrics
                HEALTH_CHECK_COUNTER.labels(service=ServiceType.ML_SERVICE, status=status.value).inc()
                HEALTH_CHECK_DURATION.labels(service=ServiceType.ML_SERVICE).observe(response_time)
                SERVICE_STATUS.labels(service=ServiceType.ML_SERVICE).set(0)
                
                return result
            
            # Test ML model loading and prediction
            start_perf = time.time()
            model_status = await get_ml_model_status()
            perf_time = time.time() - start_perf
            
            # Check model availability
            available_models = model_status.get("available_models", [])
            active_models = model_status.get("active_models", [])
            
            # Test a simple prediction if models are available
            if available_models:
                try:
                    # Test prediction with dummy data
                    test_result = await ml_service.test_prediction()
                    prediction_successful = test_result.get("success", False)
                except Exception as pred_error:
                    prediction_successful = False
            else:
                prediction_successful = False
            
            response_time = time.time() - start_time
            
            details = {
                "available_models": len(available_models),
                "active_models": len(active_models),
                "model_list": available_models[:5],  # Show first 5 models
                "prediction_test": prediction_successful,
                "query_performance_ms": round(perf_time * 1000, 2),
                "gpu_available": model_status.get("gpu_available", False),
                "memory_usage_mb": model_status.get("memory_usage_mb", 0)
            }
            
            # Determine health status
            if len(available_models) == 0:
                status = HealthStatus.UNHEALTHY
                message = "No ML models available"
            elif not prediction_successful:
                status = HealthStatus.DEGRADED
                message = "ML models available but prediction test failed"
            elif perf_time > 5.0:  # Model loading takes more than 5 seconds
                status = HealthStatus.DEGRADED
                message = "ML service performance degraded"
            else:
                status = HealthStatus.HEALTHY
                message = f"ML service healthy with {len(available_models)} models"
            
        except Exception as e:
            response_time = time.time() - start_time
            status = HealthStatus.UNHEALTHY
            message = f"ML service health check failed: {str(e)}"
            details = {"error": str(e)}
        
        result = HealthCheckResult(
            service=ServiceType.ML_SERVICE,
            status=status,
            message=message,
            details=details,
            response_time=response_time
        )
        
        # Update Prometheus metrics
        HEALTH_CHECK_COUNTER.labels(service=ServiceType.ML_SERVICE, status=status.value).inc()
        HEALTH_CHECK_DURATION.labels(service=ServiceType.ML_SERVICE).observe(response_time)
        SERVICE_STATUS.labels(service=ServiceType.ML_SERVICE).set(1 if status == HealthStatus.HEALTHY else 0)
        
        return result
    
    async def check_rl_service_health(self) -> HealthCheckResult:
        """Check RL service health and training status"""
        start_time = time.time()
        
        try:
            # Import RL services
            try:
                from app.services.rl.rl_service import RLService
                from app.services.rl.rl_training_service import RLTrainingService
                rl_service = RLService()
                rl_training = RLTrainingService()
            except ImportError:
                # RL service not available
                response_time = time.time() - start_time
                status = HealthStatus.DEGRADED
                message = "RL service not available in this configuration"
                details = {"error": "RL service not imported"}
                
                result = HealthCheckResult(
                    service=ServiceType.RL_SERVICE,
                    status=status,
                    message=message,
                    details=details,
                    response_time=response_time
                )
                
                # Update Prometheus metrics
                HEALTH_CHECK_COUNTER.labels(service=ServiceType.RL_SERVICE, status=status.value).inc()
                HEALTH_CHECK_DURATION.labels(service=ServiceType.RL_SERVICE).observe(response_time)
                SERVICE_STATUS.labels(service=ServiceType.RL_SERVICE).set(0)
                
                return result
            
            # Test RL service components
            start_perf = time.time()
            
            # Check RL environment status
            env_status = await rl_service.get_environment_status()
            
            # Check training status
            training_status = await rl_training.get_training_status()
            
            # Check agent status
            agent_status = await rl_service.get_agent_status()
            
            perf_time = time.time() - start_perf
            response_time = time.time() - start_time
            
            details = {
                "environment_status": env_status.get("status", "unknown"),
                "active_environments": env_status.get("active_environments", 0),
                "training_jobs_active": training_status.get("active_jobs", 0),
                "training_jobs_queued": training_status.get("queued_jobs", 0),
                "agent_models_loaded": agent_status.get("loaded_models", 0),
                "query_performance_ms": round(perf_time * 1000, 2),
                "memory_usage_mb": env_status.get("memory_usage_mb", 0),
                "gpu_utilization": env_status.get("gpu_utilization", 0)
            }
            
            # Determine health status
            if env_status.get("status") == "error":
                status = HealthStatus.UNHEALTHY
                message = "RL environment in error state"
            elif agent_status.get("loaded_models", 0) == 0:
                status = HealthStatus.DEGRADED
                message = "RL service running but no agent models loaded"
            elif perf_time > 3.0:  # Status check takes more than 3 seconds
                status = HealthStatus.DEGRADED
                message = "RL service performance degraded"
            else:
                status = HealthStatus.HEALTHY
                message = f"RL service healthy with {agent_status.get('loaded_models', 0)} agents"
            
        except Exception as e:
            response_time = time.time() - start_time
            status = HealthStatus.UNHEALTHY
            message = f"RL service health check failed: {str(e)}"
            details = {"error": str(e)}
        
        result = HealthCheckResult(
            service=ServiceType.RL_SERVICE,
            status=status,
            message=message,
            details=details,
            response_time=response_time
        )
        
        # Update Prometheus metrics
        HEALTH_CHECK_COUNTER.labels(service=ServiceType.RL_SERVICE, status=status.value).inc()
        HEALTH_CHECK_DURATION.labels(service=ServiceType.RL_SERVICE).observe(response_time)
        SERVICE_STATUS.labels(service=ServiceType.RL_SERVICE).set(1 if status == HealthStatus.HEALTHY else 0)
        
        return result
    
    def _is_cached_result_valid(self, service: str) -> bool:
        """Check if cached health check result is still valid"""
        if service not in self.cache:
            return False
        
        result = self.cache[service]
        if not result.last_check:
            return False
        
        age = (datetime.utcnow() - result.last_check).total_seconds()
        return age < self.cache_ttl
    
    async def _get_cached_or_fresh_result(
        self, 
        service: str, 
        check_func: Callable[..., HealthCheckResult],
        *args,
        **kwargs
    ) -> HealthCheckResult:
        """Get cached result or run fresh health check"""
        if self._is_cached_result_valid(service):
            return self.cache[service]
        
        result = await check_func(*args, **kwargs)
        self.cache[service] = result
        return result
    
    async def check_dependency_health(self, service: str, dependencies: List[str]) -> Dict[str, Any]:
        """Check health of service dependencies"""
        dependency_results = {}
        
        for dependency in dependencies:
            if dependency == "database":
                # Skip DB dependency check to avoid circular dependency
                dependency_results[dependency] = {
                    "status": "healthy",
                    "message": "Database dependency check skipped",
                    "response_time": 0.0
                }
            elif dependency == "redis":
                try:
                    result = await asyncio.wait_for(
                        self.check_redis_health(),
                        timeout=settings.HEALTH_CHECK_DEPENDENCY_TIMEOUT
                    )
                    dependency_results[dependency] = result.to_dict()
                except asyncio.TimeoutError:
                    dependency_results[dependency] = {
                        "status": "timeout",
                        "message": "Dependency health check timed out",
                        "response_time": settings.HEALTH_CHECK_DEPENDENCY_TIMEOUT
                    }
                except Exception as e:
                    dependency_results[dependency] = {
                        "status": "unhealthy",
                        "message": f"Dependency check failed: {str(e)}",
                        "response_time": 0.0,
                        "error": str(e)
                    }
            elif dependency == "external_api":
                try:
                    result = await asyncio.wait_for(
                        self.check_external_api_health(),
                        timeout=settings.HEALTH_CHECK_DEPENDENCY_TIMEOUT
                    )
                    dependency_results[dependency] = result.to_dict()
                except Exception as e:
                    dependency_results[dependency] = {
                        "status": "unhealthy",
                        "message": f"External API dependency failed: {str(e)}",
                        "response_time": 0.0,
                        "error": str(e)
                    }
            elif dependency == "ml_service":
                try:
                    result = await asyncio.wait_for(
                        self.check_ml_service_health(),
                        timeout=settings.HEALTH_CHECK_DEPENDENCY_TIMEOUT
                    )
                    dependency_results[dependency] = result.to_dict()
                except Exception as e:
                    dependency_results[dependency] = {
                        "status": "unhealthy",
                        "message": f"ML service dependency failed: {str(e)}",
                        "response_time": 0.0,
                        "error": str(e)
                    }
            elif dependency == "rl_service":
                try:
                    result = await asyncio.wait_for(
                        self.check_rl_service_health(),
                        timeout=settings.HEALTH_CHECK_DEPENDENCY_TIMEOUT
                    )
                    dependency_results[dependency] = result.to_dict()
                except Exception as e:
                    dependency_results[dependency] = {
                        "status": "unhealthy",
                        "message": f"RL service dependency failed: {str(e)}",
                        "response_time": 0.0,
                        "error": str(e)
                    }
        
        # Calculate dependency health score
        healthy_deps = sum(1 for r in dependency_results.values() if r["status"] == "healthy")
        total_deps = len(dependency_results)
        dependency_health_score = (healthy_deps / total_deps) * 100 if total_deps > 0 else 100
        
        return {
            "dependencies": dependency_results,
            "dependency_health_score": round(dependency_health_score, 2),
            "critical_dependencies_healthy": all(
                r["status"] == "healthy" 
                for dep, r in dependency_results.items() 
                if dep in settings.HEALTH_CHECK_CRITICAL_SERVICES
            )
        }
    
    async def run_all_health_checks(self, db: Session) -> Dict[str, Any]:
        """Run all health checks and return comprehensive status"""
        start_time = time.time()
        
        # Run all health checks concurrently with caching
        health_check_tasks = [
            ("database", self._get_cached_or_fresh_result("database", self.check_database_health, db)),
            ("redis", self._get_cached_or_fresh_result("redis", self.check_redis_health)),
            ("storage", self._get_cached_or_fresh_result("storage", self.check_storage_health)),
            ("celery", self._get_cached_or_fresh_result("celery", self.check_celery_health)),
            ("external_api", self._get_cached_or_fresh_result("external_api", self.check_external_api_health)),
            ("ml_service", self._get_cached_or_fresh_result("ml_service", self.check_ml_service_health)),
            ("rl_service", self._get_cached_or_fresh_result("rl_service", self.check_rl_service_health)),
            ("system", self._get_cached_or_fresh_result("system", self.check_system_health))
        ]
        
        # Execute all health checks
        health_results = {}
        failed_services = []
        
        for service_name, task in health_check_tasks:
            try:
                result = await task
                health_results[service_name] = result
                if result.status == HealthStatus.UNHEALTHY:
                    failed_services.append(service_name)
            except Exception as e:
                logger.error(f"Health check failed for {service_name}: {e}")
                health_results[service_name] = HealthCheckResult(
                    service=service_name,
                    status=HealthStatus.UNHEALTHY,
                    message=f"Health check failed with exception: {str(e)}",
                    details={"error": str(e)}
                )
                failed_services.append(service_name)
        
        # Check dependency health for critical services
        dependency_checks = {}
        for service, dependencies in self.dependency_graph.items():
            try:
                dependency_health = await self.check_dependency_health(service, dependencies)
                dependency_checks[service] = dependency_health
            except Exception as e:
                logger.error(f"Dependency health check failed for {service}: {e}")
                dependency_checks[service] = {
                    "dependencies": {},
                    "dependency_health_score": 0.0,
                    "critical_dependencies_healthy": False,
                    "error": str(e)
                }
        
        # Determine overall status with dependency consideration
        overall_status = self._calculate_overall_status(health_results, dependency_checks)
        
        total_time = time.time() - start_time
        
        # Calculate system health metrics
        system_metrics = self._calculate_system_metrics(health_results, dependency_checks)
        
        return {
            "status": overall_status.value,
            "timestamp": datetime.utcnow().isoformat(),
            "version": getattr(settings, 'APP_VERSION', '1.0.0'),
            "environment": getattr(settings, 'ENVIRONMENT', 'development'),
            "total_check_time": round(total_time, 3),
            "services": {k: v.to_dict() for k, v in health_results.items()},
            "dependencies": dependency_checks,
            "failed_services": failed_services,
            "system_metrics": system_metrics,
            "summary": {
                "total_services": len(health_results),
                "healthy_services": len([r for r in health_results.values() if r.status == HealthStatus.HEALTHY]),
                "degraded_services": len([r for r in health_results.values() if r.status == HealthStatus.DEGRADED]),
                "unhealthy_services": len([r for r in health_results.values() if r.status == HealthStatus.UNHEALTHY]),
                "overall_health_score": system_metrics["overall_health_score"],
                "critical_services_healthy": system_metrics["critical_services_healthy"]
            }
        }
    
    def _calculate_overall_status(
        self, 
        health_results: Dict[str, HealthCheckResult],
        dependency_checks: Dict[str, Dict[str, Any]]
    ) -> HealthStatus:
        """Calculate overall system status considering dependencies"""
        
        # Check critical services first
        critical_services_status = []
        for service_name in settings.HEALTH_CHECK_CRITICAL_SERVICES:
            if service_name in health_results:
                critical_services_status.append(health_results[service_name].status)
        
        # If any critical service is unhealthy, system is unhealthy
        if any(status == HealthStatus.UNHEALTHY for status in critical_services_status):
            return HealthStatus.UNHEALTHY
        
        # Check if critical dependencies are healthy
        critical_deps_unhealthy = any(
            not dep_check.get("critical_dependencies_healthy", True)
            for dep_check in dependency_checks.values()
        )
        
        if critical_deps_unhealthy:
            return HealthStatus.DEGRADED
        
        # Check overall service health
        if any(r.status == HealthStatus.UNHEALTHY for r in health_results.values()):
            return HealthStatus.DEGRADED
        elif any(r.status == HealthStatus.DEGRADED for r in health_results.values()):
            return HealthStatus.DEGRADED
        
        return HealthStatus.HEALTHY
    
    def _calculate_system_metrics(
        self,
        health_results: Dict[str, HealthCheckResult],
        dependency_checks: Dict[str, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Calculate comprehensive system health metrics"""
        
        # Service health metrics
        healthy_services = sum(1 for r in health_results.values() if r.status == HealthStatus.HEALTHY)
        total_services = len(health_results)
        service_health_score = (healthy_services / total_services) * 100 if total_services > 0 else 0
        
        # Dependency health metrics
        dependency_scores = [
            dep_check.get("dependency_health_score", 0)
            for dep_check in dependency_checks.values()
        ]
        avg_dependency_score = sum(dependency_scores) / len(dependency_scores) if dependency_scores else 0
        
        # Critical services health
        critical_services_healthy = all(
            health_results.get(service, HealthCheckResult("", HealthStatus.UNHEALTHY, "")).status == HealthStatus.HEALTHY
            for service in settings.HEALTH_CHECK_CRITICAL_SERVICES
            if service in health_results
        )
        
        # Response time metrics
        response_times = [
            r.response_time for r in health_results.values() 
            if r.response_time is not None
        ]
        avg_response_time = sum(response_times) / len(response_times) if response_times else 0
        max_response_time = max(response_times) if response_times else 0
        
        # Overall health score (weighted)
        overall_health_score = (
            service_health_score * 0.6 +  # Service health: 60%
            avg_dependency_score * 0.3 +   # Dependency health: 30%
            (100 if critical_services_healthy else 0) * 0.1  # Critical services: 10%
        )
        
        return {
            "service_health_score": round(service_health_score, 2),
            "dependency_health_score": round(avg_dependency_score, 2),
            "overall_health_score": round(overall_health_score, 2),
            "critical_services_healthy": critical_services_healthy,
            "average_response_time": round(avg_response_time, 3),
            "max_response_time": round(max_response_time, 3),
            "cache_hit_rate": self._calculate_cache_hit_rate()
        }
    
    def _calculate_cache_hit_rate(self) -> float:
        """Calculate health check cache hit rate"""
        if not hasattr(self, '_cache_hits'):
            self._cache_hits = 0
        if not hasattr(self, '_cache_attempts'):
            self._cache_attempts = 0
        
        return (self._cache_hits / self._cache_attempts) * 100 if self._cache_attempts > 0 else 0

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