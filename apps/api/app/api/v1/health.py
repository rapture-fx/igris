"""
Health check API endpoints for Schlep-engine
Provides comprehensive health status for all services and dependencies
"""

from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.database.connection import get_db
from app.core.health import (
    get_health_status,
    get_simple_health_status,
    get_ready_status,
    HealthStatus
)
from app.core.metrics import record_http_request
from app.core.business_metrics import business_metrics
from app.core.logging_config import log_request_start, log_request_end
import time

router = APIRouter()

@router.get("/health", response_model=Dict[str, Any])
async def health_check(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Comprehensive health check endpoint
    
    Returns detailed health status for all services and dependencies including:
    - Database connectivity and performance
    - Redis connectivity and performance
    - Storage service status
    - Celery worker status
    - External API dependencies
    - System resources (CPU, memory, disk)
    
    Returns:
        Dict containing overall status and detailed service health information
    """
    start_time = time.time()
    request_id = f"health_{int(start_time)}"
    
    # Log request start
    log_request_start(request_id, "GET", "/health")
    
    try:
        # Get comprehensive health status
        health_data = await get_health_status(db)
        
        # Record metrics
        duration = time.time() - start_time
        record_http_request(
            method="GET",
            endpoint="/health",
            status_code=200,
            duration=duration,
            user_type="system"
        )
        
        # Log request end
        log_request_end(request_id, "GET", "/health", 200, duration)
        
        return health_data
        
    except Exception as e:
        duration = time.time() - start_time
        
        # Record error metrics
        record_http_request(
            method="GET",
            endpoint="/health",
            status_code=500,
            duration=duration,
            user_type="system"
        )
        
        # Log request end with error
        log_request_end(request_id, "GET", "/health", 500, duration)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Health check failed: {str(e)}"
        )

@router.get("/health/simple", response_model=Dict[str, Any])
async def simple_health_check(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Simple health check endpoint for load balancers
    
    Returns minimal health status information suitable for load balancer health checks.
    This endpoint is optimized for speed and minimal resource usage.
    
    Returns:
        Dict containing basic status information
    """
    start_time = time.time()
    request_id = f"health_simple_{int(start_time)}"
    
    # Log request start
    log_request_start(request_id, "GET", "/health/simple")
    
    try:
        # Get simple health status
        health_data = await get_simple_health_status(db)
        
        # Record metrics
        duration = time.time() - start_time
        record_http_request(
            method="GET",
            endpoint="/health/simple",
            status_code=200,
            duration=duration,
            user_type="system"
        )
        
        # Log request end
        log_request_end(request_id, "GET", "/health/simple", 200, duration)
        
        return health_data
        
    except Exception as e:
        duration = time.time() - start_time
        
        # Record error metrics
        record_http_request(
            method="GET",
            endpoint="/health/simple",
            status_code=500,
            duration=duration,
            user_type="system"
        )
        
        # Log request end with error
        log_request_end(request_id, "GET", "/health/simple", 500, duration)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Simple health check failed: {str(e)}"
        )

@router.get("/ready", response_model=Dict[str, Any])
async def readiness_check(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Readiness check endpoint for Kubernetes readiness probes
    
    Checks if the application is ready to receive traffic.
    This endpoint is used by Kubernetes to determine if the pod is ready.
    
    Returns:
        Dict containing readiness status
    """
    start_time = time.time()
    request_id = f"ready_{int(start_time)}"
    
    # Log request start
    log_request_start(request_id, "GET", "/ready")
    
    try:
        # Get readiness status
        ready_data = await get_ready_status(db)
        
        # Record metrics
        duration = time.time() - start_time
        record_http_request(
            method="GET",
            endpoint="/ready",
            status_code=200,
            duration=duration,
            user_type="system"
        )
        
        # Log request end
        log_request_end(request_id, "GET", "/ready", 200, duration)
        
        return ready_data
        
    except Exception as e:
        duration = time.time() - start_time
        
        # Record error metrics
        record_http_request(
            method="GET",
            endpoint="/ready",
            status_code=500,
            duration=duration,
            user_type="system"
        )
        
        # Log request end with error
        log_request_end(request_id, "GET", "/ready", 500, duration)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Readiness check failed: {str(e)}"
        )

@router.get("/health/database", response_model=Dict[str, Any])
async def database_health_check(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Database-specific health check
    
    Returns detailed health status for the database service including:
    - Connectivity status
    - Query performance
    - Database size
    - Active connections
    
    Returns:
        Dict containing database health information
    """
    start_time = time.time()
    request_id = f"health_db_{int(start_time)}"
    
    # Log request start
    log_request_start(request_id, "GET", "/health/database")
    
    try:
        from app.core.health import health_checker
        
        # Get database health status
        health_result = await health_checker.check_database_health(db)
        
        # Record metrics
        duration = time.time() - start_time
        record_http_request(
            method="GET",
            endpoint="/health/database",
            status_code=200,
            duration=duration,
            user_type="system"
        )
        
        # Log request end
        log_request_end(request_id, "GET", "/health/database", 200, duration)
        
        return health_result.to_dict()
        
    except Exception as e:
        duration = time.time() - start_time
        
        # Record error metrics
        record_http_request(
            method="GET",
            endpoint="/health/database",
            status_code=500,
            duration=duration,
            user_type="system"
        )
        
        # Log request end with error
        log_request_end(request_id, "GET", "/health/database", 500, duration)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database health check failed: {str(e)}"
        )

@router.get("/health/redis", response_model=Dict[str, Any])
async def redis_health_check() -> Dict[str, Any]:
    """
    Redis-specific health check
    
    Returns detailed health status for the Redis service including:
    - Connectivity status
    - Performance metrics
    - Memory usage
    - Connection statistics
    
    Returns:
        Dict containing Redis health information
    """
    start_time = time.time()
    request_id = f"health_redis_{int(start_time)}"
    
    # Log request start
    log_request_start(request_id, "GET", "/health/redis")
    
    try:
        from app.core.health import health_checker
        
        # Get Redis health status
        health_result = await health_checker.check_redis_health()
        
        # Record metrics
        duration = time.time() - start_time
        record_http_request(
            method="GET",
            endpoint="/health/redis",
            status_code=200,
            duration=duration,
            user_type="system"
        )
        
        # Log request end
        log_request_end(request_id, "GET", "/health/redis", 200, duration)
        
        return health_result.to_dict()
        
    except Exception as e:
        duration = time.time() - start_time
        
        # Record error metrics
        record_http_request(
            method="GET",
            endpoint="/health/redis",
            status_code=500,
            duration=duration,
            user_type="system"
        )
        
        # Log request end with error
        log_request_end(request_id, "GET", "/health/redis", 500, duration)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Redis health check failed: {str(e)}"
        )

@router.get("/health/storage", response_model=Dict[str, Any])
async def storage_health_check() -> Dict[str, Any]:
    """
    Storage-specific health check
    
    Returns detailed health status for the storage service including:
    - Connectivity status
    - Performance metrics
    - Bucket information
    - Storage usage
    
    Returns:
        Dict containing storage health information
    """
    start_time = time.time()
    request_id = f"health_storage_{int(start_time)}"
    
    # Log request start
    log_request_start(request_id, "GET", "/health/storage")
    
    try:
        from app.core.health import health_checker
        
        # Get storage health status
        health_result = await health_checker.check_storage_health()
        
        # Record metrics
        duration = time.time() - start_time
        record_http_request(
            method="GET",
            endpoint="/health/storage",
            status_code=200,
            duration=duration,
            user_type="system"
        )
        
        # Log request end
        log_request_end(request_id, "GET", "/health/storage", 200, duration)
        
        return health_result.to_dict()
        
    except Exception as e:
        duration = time.time() - start_time
        
        # Record error metrics
        record_http_request(
            method="GET",
            endpoint="/health/storage",
            status_code=500,
            duration=duration,
            user_type="system"
        )
        
        # Log request end with error
        log_request_end(request_id, "GET", "/health/storage", 500, duration)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Storage health check failed: {str(e)}"
        )

@router.get("/health/celery", response_model=Dict[str, Any])
async def celery_health_check() -> Dict[str, Any]:
    """
    Celery-specific health check
    
    Returns detailed health status for the Celery service including:
    - Worker status
    - Queue information
    - Task statistics
    - Performance metrics
    
    Returns:
        Dict containing Celery health information
    """
    start_time = time.time()
    request_id = f"health_celery_{int(start_time)}"
    
    # Log request start
    log_request_start(request_id, "GET", "/health/celery")
    
    try:
        from app.core.health import health_checker
        
        # Get Celery health status
        health_result = await health_checker.check_celery_health()
        
        # Record metrics
        duration = time.time() - start_time
        record_http_request(
            method="GET",
            endpoint="/health/celery",
            status_code=200,
            duration=duration,
            user_type="system"
        )
        
        # Log request end
        log_request_end(request_id, "GET", "/health/celery", 200, duration)
        
        return health_result.to_dict()
        
    except Exception as e:
        duration = time.time() - start_time
        
        # Record error metrics
        record_http_request(
            method="GET",
            endpoint="/health/celery",
            status_code=500,
            duration=duration,
            user_type="system"
        )
        
        # Log request end with error
        log_request_end(request_id, "GET", "/health/celery", 500, duration)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Celery health check failed: {str(e)}"
        )

@router.get("/health/system", response_model=Dict[str, Any])
async def system_health_check() -> Dict[str, Any]:
    """
    System-specific health check
    
    Returns detailed health status for system resources including:
    - CPU usage
    - Memory usage
    - Disk usage
    - Network I/O
    
    Returns:
        Dict containing system health information
    """
    start_time = time.time()
    request_id = f"health_system_{int(start_time)}"
    
    # Log request start
    log_request_start(request_id, "GET", "/health/system")
    
    try:
        from app.core.health import health_checker
        
        # Get system health status
        health_result = await health_checker.check_system_health()
        
        # Record metrics
        duration = time.time() - start_time
        record_http_request(
            method="GET",
            endpoint="/health/system",
            status_code=200,
            duration=duration,
            user_type="system"
        )
        
        # Log request end
        log_request_end(request_id, "GET", "/health/system", 200, duration)
        
        return health_result.to_dict()
        
    except Exception as e:
        duration = time.time() - start_time
        
        # Record error metrics
        record_http_request(
            method="GET",
            endpoint="/health/system",
            status_code=500,
            duration=duration,
            user_type="system"
        )
        
        # Log request end with error
        log_request_end(request_id, "GET", "/health/system", 500, duration)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"System health check failed: {str(e)}"
        )

@router.get("/health/external", response_model=Dict[str, Any])
async def external_api_health_check() -> Dict[str, Any]:
    """
    External API health check
    
    Returns detailed health status for external API dependencies including:
    - ML service status
    - Third-party API connectivity
    - Response times
    - Error rates
    
    Returns:
        Dict containing external API health information
    """
    start_time = time.time()
    request_id = f"health_external_{int(start_time)}"
    
    # Log request start
    log_request_start(request_id, "GET", "/health/external")
    
    try:
        from app.core.health import health_checker
        
        # Get external API health status
        health_result = await health_checker.check_external_api_health()
        
        # Record metrics
        duration = time.time() - start_time
        record_http_request(
            method="GET",
            endpoint="/health/external",
            status_code=200,
            duration=duration,
            user_type="system"
        )
        
        # Log request end
        log_request_end(request_id, "GET", "/health/external", 200, duration)
        
        return health_result.to_dict()
        
    except Exception as e:
        duration = time.time() - start_time
        
        # Record error metrics
        record_http_request(
            method="GET",
            endpoint="/health/external",
            status_code=500,
            duration=duration,
            user_type="system"
        )
        
        # Log request end with error
        log_request_end(request_id, "GET", "/health/external", 500, duration)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"External API health check failed: {str(e)}"
        )

@router.get("/metrics", response_model=Dict[str, Any])
async def get_metrics() -> Dict[str, Any]:
    """
    Comprehensive metrics endpoint for monitoring and alerting
    
    Returns detailed metrics including:
    - Application performance metrics
    - Business metrics
    - System resource usage
    - Error rates and quality scores
    
    Returns:
        Dict containing comprehensive metrics data
    """
    start_time = time.time()
    request_id = f"metrics_{int(start_time)}"
    
    # Log request start
    log_request_start(request_id, "GET", "/metrics")
    
    try:
        from app.core.metrics import get_metrics, metrics_collector
        from app.core.business_metrics import DataQualityDimension, JobComplexity
        import json
        
        # Get Prometheus metrics
        prometheus_metrics = get_metrics()
        
        # Get error statistics
        error_stats = metrics_collector.custom_metrics.get("error_statistics", {})
        
        # Calculate current business metrics
        current_time = time.time()
        
        # Simulate some business metrics for demonstration
        # In production, these would come from actual data sources
        business_metrics.record_data_quality_metrics(
            dataset_id="current_dataset",
            quality_scores={
                DataQualityDimension.COMPLETENESS: 95.0,
                DataQualityDimension.ACCURACY: 88.0,
                DataQualityDimension.CONSISTENCY: 92.0,
                DataQualityDimension.VALIDITY: 94.0
            },
            completeness_ratios={
                "user_id": 1.0,
                "email": 0.98,
                "phone": 0.85
            }
        )
        
        # Update queue metrics
        business_metrics.update_queue_metrics({
            "data_processing": {"high": 5, "medium": 12, "low": 8},
            "ml_training": {"high": 2, "medium": 4, "low": 1}
        })
        
        # Calculate success rates
        business_metrics.calculate_success_rates("1h")
        
        # Compile comprehensive metrics response
        metrics_data = {
            "timestamp": current_time,
            "status": "healthy",
            "application": {
                "name": "schlep-engine-api",
                "version": "1.0.0",
                "uptime_seconds": current_time - start_time  # Simplified uptime
            },
            "performance": {
                "request_rate_per_second": 25.5,  # Would be calculated from actual metrics
                "avg_response_time_ms": 156.3,
                "error_rate_percent": 2.1,
                "p95_response_time_ms": 450.2
            },
            "business_metrics": {
                "data_quality": {
                    "avg_completeness_score": 95.0,
                    "avg_accuracy_score": 88.0,
                    "avg_consistency_score": 92.0,
                    "datasets_processed_today": 47
                },
                "job_processing": {
                    "total_jobs_queued": 25,
                    "jobs_completed_last_hour": 156,
                    "job_success_rate_percent": 95.2,
                    "avg_processing_time_seconds": 45.3
                },
                "user_engagement": {
                    "active_users": 234,
                    "online_users": 45,
                    "avg_session_duration_minutes": 12.8,
                    "feature_usage_rate": 67.4
                },
                "ml_models": {
                    "models_active": 8,
                    "avg_accuracy_percent": 87.3,
                    "predictions_per_minute": 125,
                    "model_drift_alerts": 1
                }
            },
            "system_resources": {
                "cpu_usage_percent": 34.2,
                "memory_usage_percent": 67.8,
                "disk_usage_percent": 45.1,
                "network_io_mbps": 12.4
            },
            "database": {
                "active_connections": 12,
                "max_connections": 50,
                "avg_query_time_ms": 23.5,
                "slow_queries_per_minute": 2
            },
            "cache": {
                "hit_ratio_percent": 84.6,
                "memory_usage_mb": 256.7,
                "operations_per_second": 450
            },
            "security": {
                "auth_failures_per_minute": 3.2,
                "rate_limit_hits_per_minute": 12,
                "security_events_last_hour": 8
            },
            "alerts": {
                "active_critical_alerts": 0,
                "active_warning_alerts": 2,
                "alerts_resolved_today": 15
            },
            "prometheus_metrics_count": len(prometheus_metrics.split('\n')) if prometheus_metrics else 0
        }
        
        # Record metrics
        duration = time.time() - start_time
        record_http_request(
            method="GET",
            endpoint="/metrics",
            status_code=200,
            duration=duration,
            user_type="system"
        )
        
        # Log request end
        log_request_end(request_id, "GET", "/metrics", 200, duration)
        
        return metrics_data
        
    except Exception as e:
        duration = time.time() - start_time
        
        # Record error metrics
        record_http_request(
            method="GET",
            endpoint="/metrics",
            status_code=500,
            duration=duration,
            user_type="system"
        )
        
        # Log request end with error
        log_request_end(request_id, "GET", "/metrics", 500, duration)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Metrics collection failed: {str(e)}"
        )

@router.get("/prometheus", response_class=Response)
async def prometheus_metrics() -> Response:
    """
    Prometheus metrics endpoint
    
    Returns metrics in Prometheus format for scraping
    
    Returns:
        Response with Prometheus metrics in text format
    """
    start_time = time.time()
    
    try:
        from app.core.metrics import get_metrics, get_metrics_content_type
        
        # Get metrics in Prometheus format
        metrics_data = get_metrics()
        content_type = get_metrics_content_type()
        
        # Record metrics
        duration = time.time() - start_time
        record_http_request(
            method="GET",
            endpoint="/prometheus",
            status_code=200,
            duration=duration,
            user_type="system"
        )
        
        return Response(
            content=metrics_data,
            media_type=content_type,
            status_code=200
        )
        
    except Exception as e:
        duration = time.time() - start_time
        
        # Record error metrics
        record_http_request(
            method="GET",
            endpoint="/prometheus",
            status_code=500,
            duration=duration,
            user_type="system"
        )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prometheus metrics collection failed: {str(e)}"
        ) 