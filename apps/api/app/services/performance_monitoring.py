"""
Performance Monitoring Service for Schlep Engine

This service provides comprehensive monitoring of:
- Database performance
- Redis cache performance  
- Data processing performance
- System resource usage
- Query optimization recommendations
"""

import asyncio
import time
import logging
import psutil
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from app.core.redis_client import get_enhanced_redis_client, get_cache_health
from app.database.connection import (
    check_database_health, 
    get_query_performance_metrics,
    reset_query_performance_metrics
)

logger = logging.getLogger(__name__)

@dataclass
class PerformanceSnapshot:
    """Performance snapshot at a point in time"""
    timestamp: datetime
    cpu_percent: float
    memory_percent: float
    memory_used_gb: float
    disk_io_read_mb: float
    disk_io_write_mb: float
    network_sent_mb: float
    network_recv_mb: float
    active_connections: int
    query_count: int
    slow_queries: int
    cache_hit_rate: float
    processing_jobs_active: int

class PerformanceMonitor:
    """Comprehensive performance monitoring system"""
    
    def __init__(self, retention_hours: int = 24):
        self.retention_hours = retention_hours
        self.snapshots: List[PerformanceSnapshot] = []
        self.alert_thresholds = {
            'cpu_warning': 75.0,
            'cpu_critical': 90.0,
            'memory_warning': 80.0,
            'memory_critical': 95.0,
            'disk_warning': 85.0,
            'disk_critical': 95.0,
            'slow_query_warning': 10,
            'cache_hit_rate_warning': 0.7
        }
        self.alerts_sent = set()  # Track sent alerts to avoid spam
        logger.info("Performance monitor initialized")
    
    async def take_snapshot(self) -> PerformanceSnapshot:
        """Take a performance snapshot"""
        try:
            # System metrics
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk_io = psutil.disk_io_counters()
            network_io = psutil.net_io_counters()
            
            # Database metrics
            db_health = await check_database_health()
            query_metrics = get_query_performance_metrics()
            
            # Cache metrics
            cache_health = await get_cache_health()
            cache_hit_rate = 0.0
            if cache_health.get('status') == 'healthy':
                cache_stats = cache_health.get('cache_stats', {})
                if cache_stats:
                    cache_hit_rate = cache_stats.get('hit_rate', 0.0)
            
            # Active connections
            connections = 0
            if db_health.get('status') == 'healthy':
                pool_info = db_health.get('connection_pool', {})
                connections = pool_info.get('checked_out', 0)
            
            snapshot = PerformanceSnapshot(
                timestamp=datetime.utcnow(),
                cpu_percent=cpu_percent,
                memory_percent=memory.percent,
                memory_used_gb=memory.used / (1024**3),
                disk_io_read_mb=(disk_io.read_bytes / (1024**2)) if disk_io else 0,
                disk_io_write_mb=(disk_io.write_bytes / (1024**2)) if disk_io else 0,
                network_sent_mb=(network_io.bytes_sent / (1024**2)) if network_io else 0,
                network_recv_mb=(network_io.bytes_recv / (1024**2)) if network_io else 0,
                active_connections=connections,
                query_count=query_metrics.get('total_queries', 0),
                slow_queries=query_metrics.get('slow_queries', 0),
                cache_hit_rate=cache_hit_rate,
                processing_jobs_active=await self._count_active_processing_jobs()
            )
            
            # Store snapshot
            self.snapshots.append(snapshot)
            self._cleanup_old_snapshots()
            
            # Check for alerts
            await self._check_alerts(snapshot)
            
            return snapshot
            
        except Exception as e:
            logger.error(f"Failed to take performance snapshot: {str(e)}")
            raise
    
    def _cleanup_old_snapshots(self):
        """Remove snapshots older than retention period"""
        cutoff_time = datetime.utcnow() - timedelta(hours=self.retention_hours)
        self.snapshots = [s for s in self.snapshots if s.timestamp > cutoff_time]
    
    async def _count_active_processing_jobs(self) -> int:
        """Count active processing jobs from Redis or database"""
        try:
            redis_client = await get_enhanced_redis_client()
            if redis_client:
                # Check Redis for active job count
                active_jobs = await redis_client.get('active_processing_jobs_count')
                return active_jobs if active_jobs is not None else 0
            return 0
        except Exception:
            return 0
    
    async def _check_alerts(self, snapshot: PerformanceSnapshot):
        """Check for performance alerts"""
        alerts = []
        
        # CPU alerts
        if snapshot.cpu_percent > self.alert_thresholds['cpu_critical']:
            alerts.append(f"CRITICAL: CPU usage at {snapshot.cpu_percent:.1f}%")
        elif snapshot.cpu_percent > self.alert_thresholds['cpu_warning']:
            alerts.append(f"WARNING: CPU usage at {snapshot.cpu_percent:.1f}%")
        
        # Memory alerts
        if snapshot.memory_percent > self.alert_thresholds['memory_critical']:
            alerts.append(f"CRITICAL: Memory usage at {snapshot.memory_percent:.1f}%")
        elif snapshot.memory_percent > self.alert_thresholds['memory_warning']:
            alerts.append(f"WARNING: Memory usage at {snapshot.memory_percent:.1f}%")
        
        # Slow query alerts
        if snapshot.slow_queries > self.alert_thresholds['slow_query_warning']:
            alerts.append(f"WARNING: {snapshot.slow_queries} slow queries detected")
        
        # Cache hit rate alerts
        if snapshot.cache_hit_rate < self.alert_thresholds['cache_hit_rate_warning']:
            alerts.append(f"WARNING: Low cache hit rate {snapshot.cache_hit_rate:.1%}")
        
        # Send new alerts
        for alert in alerts:
            alert_key = f"{alert}_{snapshot.timestamp.hour}"  # Limit to once per hour
            if alert_key not in self.alerts_sent:
                logger.warning(f"PERFORMANCE ALERT: {alert}")
                self.alerts_sent.add(alert_key)
        
        # Clean up old alert keys
        self._cleanup_alert_keys()
    
    def _cleanup_alert_keys(self):
        """Clean up old alert tracking keys"""
        current_hour = datetime.utcnow().hour
        # Keep only alerts from current and previous hour
        valid_hours = {current_hour, (current_hour - 1) % 24}
        self.alerts_sent = {
            key for key in self.alerts_sent 
            if any(f"_{hour}" in key for hour in valid_hours)
        }
    
    def get_current_metrics(self) -> Dict[str, Any]:
        """Get current performance metrics"""
        if not self.snapshots:
            return {"error": "No snapshots available"}
        
        latest = self.snapshots[-1]
        return {
            "timestamp": latest.timestamp.isoformat(),
            "system": {
                "cpu_percent": latest.cpu_percent,
                "memory_percent": latest.memory_percent,
                "memory_used_gb": round(latest.memory_used_gb, 2),
                "disk_io_read_mb": round(latest.disk_io_read_mb, 2),
                "disk_io_write_mb": round(latest.disk_io_write_mb, 2),
                "network_sent_mb": round(latest.network_sent_mb, 2),
                "network_recv_mb": round(latest.network_recv_mb, 2)
            },
            "database": {
                "active_connections": latest.active_connections,
                "query_count": latest.query_count,
                "slow_queries": latest.slow_queries
            },
            "cache": {
                "hit_rate": latest.cache_hit_rate
            },
            "processing": {
                "active_jobs": latest.processing_jobs_active
            }
        }
    
    def get_historical_metrics(self, hours: int = 1) -> Dict[str, Any]:
        """Get historical performance metrics"""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        recent_snapshots = [s for s in self.snapshots if s.timestamp > cutoff_time]
        
        if not recent_snapshots:
            return {"error": "No data available for specified time range"}
        
        # Calculate averages and trends
        cpu_values = [s.cpu_percent for s in recent_snapshots]
        memory_values = [s.memory_percent for s in recent_snapshots]
        query_counts = [s.query_count for s in recent_snapshots]
        
        return {
            "time_range_hours": hours,
            "snapshot_count": len(recent_snapshots),
            "cpu": {
                "average": round(sum(cpu_values) / len(cpu_values), 2),
                "max": max(cpu_values),
                "min": min(cpu_values)
            },
            "memory": {
                "average": round(sum(memory_values) / len(memory_values), 2),
                "max": max(memory_values),
                "min": min(memory_values)
            },
            "queries": {
                "total": sum(query_counts),
                "average_per_snapshot": round(sum(query_counts) / len(query_counts), 2)
            },
            "trends": self._calculate_trends(recent_snapshots)
        }
    
    def _calculate_trends(self, snapshots: List[PerformanceSnapshot]) -> Dict[str, str]:
        """Calculate performance trends"""
        if len(snapshots) < 2:
            return {"error": "Insufficient data for trend analysis"}
        
        # Simple trend calculation (comparing first half vs second half)
        mid_point = len(snapshots) // 2
        first_half = snapshots[:mid_point]
        second_half = snapshots[mid_point:]
        
        def avg_cpu(subset): return sum(s.cpu_percent for s in subset) / len(subset)
        def avg_memory(subset): return sum(s.memory_percent for s in subset) / len(subset)
        
        cpu_trend = "increasing" if avg_cpu(second_half) > avg_cpu(first_half) else "decreasing"
        memory_trend = "increasing" if avg_memory(second_half) > avg_memory(first_half) else "decreasing"
        
        return {
            "cpu": cpu_trend,
            "memory": memory_trend
        }
    
    async def get_optimization_recommendations(self) -> List[str]:
        """Generate optimization recommendations based on metrics"""
        if not self.snapshots:
            return ["No data available for recommendations"]
        
        recommendations = []
        latest = self.snapshots[-1]
        
        # Recent performance analysis (last hour)
        recent_metrics = self.get_historical_metrics(hours=1)
        
        # CPU recommendations
        if latest.cpu_percent > 80:
            recommendations.append("High CPU usage detected - consider scaling horizontally or optimizing algorithms")
        
        # Memory recommendations
        if latest.memory_percent > 85:
            recommendations.append("High memory usage - consider implementing streaming for large datasets")
        
        # Database recommendations
        if latest.slow_queries > 5:
            recommendations.append("Multiple slow queries detected - review query performance and add indexes")
        
        # Cache recommendations
        if latest.cache_hit_rate < 0.7:
            recommendations.append("Low cache hit rate - consider increasing cache TTL or cache size")
        
        # Connection pool recommendations
        if latest.active_connections > 20:
            recommendations.append("High database connection usage - consider connection pooling optimization")
        
        # Trend-based recommendations
        if 'trends' in recent_metrics:
            trends = recent_metrics['trends']
            if trends.get('cpu') == 'increasing':
                recommendations.append("CPU usage trending upward - monitor for potential scaling needs")
            if trends.get('memory') == 'increasing':
                recommendations.append("Memory usage trending upward - check for memory leaks")
        
        if not recommendations:
            recommendations.append("System performance appears optimal")
        
        return recommendations
    
    async def generate_performance_report(self) -> Dict[str, Any]:
        """Generate comprehensive performance report"""
        return {
            "generated_at": datetime.utcnow().isoformat(),
            "current_metrics": self.get_current_metrics(),
            "last_hour_metrics": self.get_historical_metrics(hours=1),
            "last_24_hours_metrics": self.get_historical_metrics(hours=24),
            "recommendations": await self.get_optimization_recommendations(),
            "alert_thresholds": self.alert_thresholds,
            "system_info": {
                "cpu_count": psutil.cpu_count(),
                "total_memory_gb": round(psutil.virtual_memory().total / (1024**3), 2),
                "python_process_pid": psutil.Process().pid
            }
        }

# Global performance monitor instance
_performance_monitor = None

def get_performance_monitor() -> PerformanceMonitor:
    """Get global performance monitor instance"""
    global _performance_monitor
    if _performance_monitor is None:
        _performance_monitor = PerformanceMonitor()
    return _performance_monitor

async def start_performance_monitoring(interval_seconds: int = 60):
    """Start continuous performance monitoring"""
    monitor = get_performance_monitor()
    logger.info(f"Starting performance monitoring with {interval_seconds}s interval")
    
    while True:
        try:
            await monitor.take_snapshot()
            await asyncio.sleep(interval_seconds)
        except Exception as e:
            logger.error(f"Performance monitoring error: {str(e)}")
            await asyncio.sleep(interval_seconds)  # Continue monitoring even on errors

# Decorator for monitoring function performance
def monitor_performance(operation_name: str):
    """Decorator to monitor function performance"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time
                
                # Log slow operations
                if duration > 5.0:
                    logger.warning(f"Slow operation detected: {operation_name} took {duration:.2f}s")
                
                # Store operation metrics in Redis for analysis
                redis_client = await get_enhanced_redis_client()
                if redis_client:
                    await redis_client.push_to_list(
                        f"operation_metrics:{operation_name}",
                        {
                            "timestamp": datetime.utcnow().isoformat(),
                            "duration": duration,
                            "success": True
                        },
                        ttl=86400,  # 24 hours
                        max_length=1000
                    )
                
                return result
            except Exception as e:
                duration = time.time() - start_time
                logger.error(f"Operation failed: {operation_name} failed after {duration:.2f}s: {str(e)}")
                
                # Store failure metrics
                redis_client = await get_enhanced_redis_client()
                if redis_client:
                    await redis_client.push_to_list(
                        f"operation_metrics:{operation_name}",
                        {
                            "timestamp": datetime.utcnow().isoformat(),
                            "duration": duration,
                            "success": False,
                            "error": str(e)
                        },
                        ttl=86400,
                        max_length=1000
                    )
                raise
        return wrapper
    return decorator