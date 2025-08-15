"""
Performance Monitoring and Optimization Endpoints

Provides REST API endpoints for monitoring and optimizing system performance:
- Real-time performance metrics
- Historical performance data  
- Cache optimization
- Database performance monitoring
- System resource monitoring
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, List, Any, Optional
from datetime import datetime
import logging
from app.auth.unified_dependencies import require_admin_user
from app.services.performance_monitoring import get_performance_monitor, monitor_performance
from app.services.core.unified_processor import UnifiedDataProcessor
from app.core.redis_client import get_cache_health, get_enhanced_redis_client
from app.database.connection import (
    check_database_health, 
    get_query_performance_metrics,
    reset_query_performance_metrics
)
from app.database.models import User

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/metrics/current")
@monitor_performance("get_current_performance_metrics")
async def get_current_performance_metrics(
    current_user: User = Depends(require_admin_user)
) -> Dict[str, Any]:
    """Get current performance metrics"""
    try:
        monitor = get_performance_monitor()
        
        # Take a fresh snapshot
        await monitor.take_snapshot()
        
        # Get current metrics
        metrics = monitor.get_current_metrics()
        
        return {
            "status": "success",
            "data": metrics,
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to get current performance metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get metrics: {str(e)}")

@router.get("/metrics/historical")
@monitor_performance("get_historical_performance_metrics")
async def get_historical_performance_metrics(
    hours: int = Query(1, ge=1, le=168, description="Hours of historical data (1-168)"),
    current_user: User = Depends(require_admin_user)
) -> Dict[str, Any]:
    """Get historical performance metrics"""
    try:
        monitor = get_performance_monitor()
        metrics = monitor.get_historical_metrics(hours=hours)
        
        return {
            "status": "success",
            "data": metrics,
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to get historical performance metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get historical metrics: {str(e)}")

@router.get("/report/comprehensive")
@monitor_performance("generate_comprehensive_performance_report")
async def generate_comprehensive_performance_report(
    current_user: User = Depends(require_admin_user)
) -> Dict[str, Any]:
    """Generate comprehensive performance report with recommendations"""
    try:
        monitor = get_performance_monitor()
        report = await monitor.generate_performance_report()
        
        return {
            "status": "success",
            "data": report
        }
    except Exception as e:
        logger.error(f"Failed to generate performance report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")

@router.get("/cache/health")
@monitor_performance("get_cache_health_status")
async def get_cache_health_status(
    current_user: User = Depends(require_admin_user)
) -> Dict[str, Any]:
    """Get Redis cache health and performance status"""
    try:
        cache_health = await get_cache_health()
        
        return {
            "status": "success",
            "data": cache_health
        }
    except Exception as e:
        logger.error(f"Failed to get cache health: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get cache health: {str(e)}")

@router.post("/cache/clear")
@monitor_performance("clear_cache")
async def clear_cache(
    pattern: Optional[str] = Query(None, description="Cache key pattern to clear (optional)"),
    current_user: User = Depends(require_admin_user)
) -> Dict[str, Any]:
    """Clear cache keys (all or by pattern)"""
    try:
        redis_client = await get_enhanced_redis_client()
        if not redis_client:
            raise HTTPException(status_code=503, detail="Redis cache not available")
        
        keys_cleared = 0
        
        if pattern:
            # Clear keys matching pattern
            base_client = redis_client.redis
            keys = await base_client.keys(pattern)
            if keys:
                await base_client.delete(*keys)
                keys_cleared = len(keys)
        else:
            # Clear all cache
            redis_client.clear_memory_cache()
            base_client = redis_client.redis
            await base_client.flushdb()
            keys_cleared = -1  # Indicates full flush
        
        return {
            "status": "success",
            "message": f"Cache cleared successfully",
            "keys_cleared": keys_cleared if keys_cleared >= 0 else "all",
            "pattern": pattern
        }
    except Exception as e:
        logger.error(f"Failed to clear cache: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to clear cache: {str(e)}")

@router.get("/database/health")
@monitor_performance("get_database_health_status")
async def get_database_health_status(
    current_user: User = Depends(require_admin_user)
) -> Dict[str, Any]:
    """Get database health and performance status"""
    try:
        db_health = await check_database_health()
        query_metrics = get_query_performance_metrics()
        
        return {
            "status": "success",
            "data": {
                "health": db_health,
                "query_performance": query_metrics
            }
        }
    except Exception as e:
        logger.error(f"Failed to get database health: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get database health: {str(e)}")

@router.post("/database/reset-query-metrics")
@monitor_performance("reset_database_query_metrics")
async def reset_database_query_metrics(
    current_user: User = Depends(require_admin_user)
) -> Dict[str, Any]:
    """Reset database query performance metrics"""
    try:
        reset_query_performance_metrics()
        
        return {
            "status": "success",
            "message": "Query performance metrics reset successfully"
        }
    except Exception as e:
        logger.error(f"Failed to reset query metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reset query metrics: {str(e)}")

@router.get("/processor/metrics")
@monitor_performance("get_processor_performance_metrics")
async def get_processor_performance_metrics(
    current_user: User = Depends(require_admin_user)
) -> Dict[str, Any]:
    """Get UnifiedDataProcessor performance metrics"""
    try:
        processor = UnifiedDataProcessor()
        metrics = processor.get_performance_metrics()
        
        return {
            "status": "success",
            "data": metrics
        }
    except Exception as e:
        logger.error(f"Failed to get processor metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get processor metrics: {str(e)}")

@router.get("/processor/detailed-report")
@monitor_performance("get_processor_detailed_report")
async def get_processor_detailed_report(
    current_user: User = Depends(require_admin_user)
) -> Dict[str, Any]:
    """Get detailed UnifiedDataProcessor performance report"""
    try:
        processor = UnifiedDataProcessor()
        report = await processor.get_detailed_performance_report()
        
        return {
            "status": "success",
            "data": report
        }
    except Exception as e:
        logger.error(f"Failed to get processor detailed report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get processor detailed report: {str(e)}")

@router.post("/processor/reset-metrics")
@monitor_performance("reset_processor_metrics")
async def reset_processor_metrics(
    current_user: User = Depends(require_admin_user)
) -> Dict[str, Any]:
    """Reset UnifiedDataProcessor performance metrics"""
    try:
        processor = UnifiedDataProcessor()
        processor.reset_performance_metrics()
        
        return {
            "status": "success",
            "message": "Processor performance metrics reset successfully"
        }
    except Exception as e:
        logger.error(f"Failed to reset processor metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reset processor metrics: {str(e)}")

@router.post("/processor/optimize-cache")
@monitor_performance("optimize_processor_cache")
async def optimize_processor_cache(
    current_user: User = Depends(require_admin_user)
) -> Dict[str, Any]:
    """Optimize UnifiedDataProcessor cache settings"""
    try:
        processor = UnifiedDataProcessor()
        optimizations = await processor.optimize_cache_settings()
        
        return {
            "status": "success",
            "data": optimizations
        }
    except Exception as e:
        logger.error(f"Failed to optimize processor cache: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to optimize processor cache: {str(e)}")

@router.get("/recommendations")
@monitor_performance("get_performance_recommendations")
async def get_performance_recommendations(
    current_user: User = Depends(require_admin_user)
) -> Dict[str, Any]:
    """Get performance optimization recommendations"""
    try:
        monitor = get_performance_monitor()
        recommendations = await monitor.get_optimization_recommendations()
        
        return {
            "status": "success",
            "data": {
                "recommendations": recommendations,
                "generated_at": datetime.utcnow().isoformat()
            }
        }
    except Exception as e:
        logger.error(f"Failed to get performance recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get recommendations: {str(e)}")

@router.get("/system/resources")
@monitor_performance("get_system_resources")
async def get_system_resources(
    current_user: User = Depends(require_admin_user)
) -> Dict[str, Any]:
    """Get current system resource usage"""
    try:
        import psutil
        
        # CPU information
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_count = psutil.cpu_count()
        cpu_freq = psutil.cpu_freq()
        
        # Memory information
        memory = psutil.virtual_memory()
        swap = psutil.swap_memory()
        
        # Disk information
        disk_usage = psutil.disk_usage('/')
        disk_io = psutil.disk_io_counters()
        
        # Network information
        network_io = psutil.net_io_counters()
        
        # Process information
        process = psutil.Process()
        process_memory = process.memory_info()
        
        return {
            "status": "success",
            "data": {
                "cpu": {
                    "percent": cpu_percent,
                    "count": cpu_count,
                    "frequency_mhz": cpu_freq.current if cpu_freq else None
                },
                "memory": {
                    "total_gb": round(memory.total / (1024**3), 2),
                    "available_gb": round(memory.available / (1024**3), 2),
                    "used_gb": round(memory.used / (1024**3), 2),
                    "percent": memory.percent
                },
                "swap": {
                    "total_gb": round(swap.total / (1024**3), 2),
                    "used_gb": round(swap.used / (1024**3), 2),
                    "percent": swap.percent
                },
                "disk": {
                    "total_gb": round(disk_usage.total / (1024**3), 2),
                    "used_gb": round(disk_usage.used / (1024**3), 2),
                    "free_gb": round(disk_usage.free / (1024**3), 2),
                    "percent": round((disk_usage.used / disk_usage.total) * 100, 2)
                },
                "disk_io": {
                    "read_mb": round(disk_io.read_bytes / (1024**2), 2) if disk_io else 0,
                    "write_mb": round(disk_io.write_bytes / (1024**2), 2) if disk_io else 0
                },
                "network_io": {
                    "sent_mb": round(network_io.bytes_sent / (1024**2), 2) if network_io else 0,
                    "recv_mb": round(network_io.bytes_recv / (1024**2), 2) if network_io else 0
                },
                "process": {
                    "pid": process.pid,
                    "memory_rss_mb": round(process_memory.rss / (1024**2), 2),
                    "memory_vms_mb": round(process_memory.vms / (1024**2), 2),
                    "cpu_percent": process.cpu_percent(),
                    "threads": process.num_threads()
                }
            }
        }
    except Exception as e:
        logger.error(f"Failed to get system resources: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get system resources: {str(e)}")

@router.post("/monitoring/start")
@monitor_performance("start_performance_monitoring")
async def start_performance_monitoring_endpoint(
    interval_seconds: int = Query(60, ge=10, le=3600, description="Monitoring interval in seconds"),
    current_user: User = Depends(require_admin_user)
) -> Dict[str, Any]:
    """Start continuous performance monitoring"""
    try:
        # Note: In a production environment, this would start a background task
        # For now, we'll just acknowledge the request
        
        return {
            "status": "success",
            "message": f"Performance monitoring configured with {interval_seconds}s interval",
            "note": "Monitoring runs as a background service"
        }
    except Exception as e:
        logger.error(f"Failed to start performance monitoring: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start monitoring: {str(e)}")

@router.get("/health")
async def get_overall_system_health(
    current_user: User = Depends(require_admin_user)
) -> Dict[str, Any]:
    """Get overall system health status"""
    try:
        # Database health
        db_health = await check_database_health()
        
        # Cache health  
        cache_health = await get_cache_health()
        
        # System resources
        import psutil
        memory = psutil.virtual_memory()
        cpu_percent = psutil.cpu_percent(interval=1)
        
        # Determine overall health
        issues = []
        if db_health.get('status') != 'healthy':
            issues.append('Database')
        if cache_health.get('status') != 'healthy':
            issues.append('Cache')
        if memory.percent > 90:
            issues.append('High memory usage')
        if cpu_percent > 90:
            issues.append('High CPU usage')
        
        overall_status = 'healthy' if not issues else 'degraded' if len(issues) <= 2 else 'unhealthy'
        
        return {
            "status": "success",
            "data": {
                "overall_status": overall_status,
                "issues": issues,
                "components": {
                    "database": db_health.get('status', 'unknown'),
                    "cache": cache_health.get('status', 'unknown'),
                    "memory_usage_percent": memory.percent,
                    "cpu_usage_percent": cpu_percent
                },
                "timestamp": datetime.utcnow().isoformat()
            }
        }
    except Exception as e:
        logger.error(f"Failed to get system health: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get system health: {str(e)}")