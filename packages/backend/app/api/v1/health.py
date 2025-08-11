"""
Health check API endpoints for Schlep-engine
Provides comprehensive health status for all services and dependencies
"""

from fastapi import APIRouter, Depends, HTTPException, status
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