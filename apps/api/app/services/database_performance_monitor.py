"""
Database Performance Monitoring Service
======================================

Real-time database performance monitoring, alerting, and optimization
recommendations for the Schlep-engine application.

Features:
- Real-time performance metrics collection
- Automated performance alerts
- Query optimization recommendations
- Index usage analysis
- Connection pool monitoring
- Cache performance tracking
"""

import asyncio
import time
import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import json
import statistics

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, func
import psutil

from app.core.enhanced_database_config import get_database_manager
from app.core.redis_client import get_redis_client
from app.core.logging_config import get_logger

logger = get_logger(__name__)


class AlertSeverity(Enum):
    """Alert severity levels"""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class MetricType(Enum):
    """Types of database metrics"""
    CONNECTION = "connection"
    QUERY_PERFORMANCE = "query_performance"
    INDEX_USAGE = "index_usage"
    CACHE_PERFORMANCE = "cache_performance"
    LOCK_CONTENTION = "lock_contention"
    RESOURCE_USAGE = "resource_usage"


@dataclass
class PerformanceAlert:
    """Performance alert data structure"""
    alert_id: str
    severity: AlertSeverity
    metric_type: MetricType
    message: str
    value: float
    threshold: float
    timestamp: datetime
    details: Dict[str, Any] = field(default_factory=dict)
    resolved: bool = False


@dataclass
class QueryPerformanceMetric:
    """Query performance metric"""
    query_hash: str
    query_text: str
    calls: int
    total_time: float
    mean_time: float
    max_time: float
    hit_ratio: float
    timestamp: datetime


@dataclass
class IndexUsageMetric:
    """Index usage metric"""
    schema_name: str
    table_name: str
    index_name: str
    scans: int
    tuples_read: int
    tuples_fetched: int
    usage_level: str  # unused, low, active
    recommendation: Optional[str] = None


@dataclass
class ConnectionMetric:
    """Connection pool metric"""
    active_connections: int
    idle_connections: int
    total_connections: int
    max_connections: int
    usage_percentage: float
    waiting_connections: int = 0


@dataclass
class CacheMetric:
    """Cache performance metric"""
    level: str  # L1, L2, DB
    hit_ratio: float
    total_requests: int
    hits: int
    misses: int
    size: int
    max_size: int
    evictions: int = 0


class DatabasePerformanceMonitor:
    """Comprehensive database performance monitoring service"""
    
    def __init__(self):
        self.is_running = False
        self.monitoring_task = None
        self.alerts: List[PerformanceAlert] = []
        self.metrics_history: Dict[MetricType, List[Dict[str, Any]]] = {
            metric_type: [] for metric_type in MetricType
        }
        self.max_history_size = 288  # 24 hours of 5-minute intervals
        
        # Alert thresholds
        self.thresholds = {
            'connection_usage': 0.8,
            'query_duration_p95': 1000.0,  # ms
            'cache_hit_ratio': 0.9,
            'index_scan_ratio': 0.1,  # seq_scan / total_scan
            'lock_wait_time': 5000.0,  # ms
            'memory_usage': 0.85,
            'disk_usage': 0.9
        }
    
    async def start_monitoring(self, interval: int = 300):  # 5 minutes
        """Start the monitoring service"""
        if self.is_running:
            logger.warning("Database performance monitoring is already running")
            return
        
        self.is_running = True
        self.monitoring_task = asyncio.create_task(
            self._monitoring_loop(interval)
        )
        logger.info("Database performance monitoring started")
    
    async def stop_monitoring(self):
        """Stop the monitoring service"""
        if not self.is_running:
            return
        
        self.is_running = False
        if self.monitoring_task:
            self.monitoring_task.cancel()
            try:
                await self.monitoring_task
            except asyncio.CancelledError:
                pass
        
        logger.info("Database performance monitoring stopped")
    
    async def _monitoring_loop(self, interval: int):
        """Main monitoring loop"""
        while self.is_running:
            try:
                await self._collect_all_metrics()
                await self._check_alerts()
                await self._cleanup_old_data()
                await asyncio.sleep(interval)
            except Exception as e:
                logger.error(f"Monitoring loop error: {e}")
                await asyncio.sleep(60)  # Wait 1 minute before retrying
    
    async def _collect_all_metrics(self):
        """Collect all performance metrics"""
        db_manager = await get_database_manager()
        
        # Collect different types of metrics concurrently
        tasks = [
            self._collect_connection_metrics(db_manager),
            self._collect_query_performance_metrics(db_manager),
            self._collect_index_usage_metrics(db_manager),
            self._collect_cache_metrics(db_manager),
            self._collect_lock_metrics(db_manager),
            self._collect_resource_metrics()
        ]
        
        await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _collect_connection_metrics(self, db_manager):
        """Collect database connection metrics"""
        try:
            async with db_manager.get_session() as session:
                # Get connection statistics
                query = text("""
                    SELECT 
                        count(*) as total_connections,
                        count(*) FILTER (WHERE state = 'active') as active_connections,
                        count(*) FILTER (WHERE state = 'idle') as idle_connections,
                        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
                    FROM pg_stat_activity
                """)
                
                result = await session.execute(query)
                row = result.first()
                
                if row:
                    usage_percentage = row.total_connections / row.max_connections
                    
                    metric = ConnectionMetric(
                        active_connections=row.active_connections,
                        idle_connections=row.idle_connections,
                        total_connections=row.total_connections,
                        max_connections=row.max_connections,
                        usage_percentage=usage_percentage
                    )
                    
                    self._add_metric(MetricType.CONNECTION, metric.__dict__)
                    
                    # Check for alerts
                    if usage_percentage > self.thresholds['connection_usage']:
                        await self._create_alert(
                            AlertSeverity.WARNING,
                            MetricType.CONNECTION,
                            f"High connection usage: {usage_percentage:.1%}",
                            usage_percentage,
                            self.thresholds['connection_usage']
                        )
        
        except Exception as e:
            logger.error(f"Error collecting connection metrics: {e}")
    
    async def _collect_query_performance_metrics(self, db_manager):
        """Collect query performance metrics"""
        try:
            async with db_manager.get_session() as session:
                # Get slow queries from pg_stat_statements
                query = text("""
                    SELECT 
                        queryid,
                        left(query, 100) as query_text,
                        calls,
                        total_exec_time,
                        mean_exec_time,
                        max_exec_time,
                        100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) as hit_ratio
                    FROM pg_stat_statements 
                    WHERE query NOT LIKE '%pg_stat_statements%'
                      AND calls > 10
                    ORDER BY total_exec_time DESC 
                    LIMIT 20
                """)
                
                result = await session.execute(query)
                
                slow_queries = []
                for row in result:
                    metric = QueryPerformanceMetric(
                        query_hash=str(row.queryid),
                        query_text=row.query_text,
                        calls=row.calls,
                        total_time=row.total_exec_time,
                        mean_time=row.mean_exec_time,
                        max_time=row.max_exec_time,
                        hit_ratio=row.hit_ratio or 0,
                        timestamp=datetime.now()
                    )
                    slow_queries.append(metric.__dict__)
                    
                    # Alert on very slow queries
                    if row.mean_exec_time > self.thresholds['query_duration_p95']:
                        await self._create_alert(
                            AlertSeverity.WARNING,
                            MetricType.QUERY_PERFORMANCE,
                            f"Slow query detected: {row.mean_exec_time:.1f}ms avg",
                            row.mean_exec_time,
                            self.thresholds['query_duration_p95'],
                            {'query': row.query_text}
                        )
                
                self._add_metric(MetricType.QUERY_PERFORMANCE, {
                    'slow_queries': slow_queries,
                    'count': len(slow_queries)
                })
        
        except Exception as e:
            logger.error(f"Error collecting query performance metrics: {e}")
    
    async def _collect_index_usage_metrics(self, db_manager):
        """Collect index usage statistics"""
        try:
            async with db_manager.get_session() as session:
                # Get index usage statistics
                query = text("""
                    SELECT 
                        schemaname,
                        tablename,
                        indexname,
                        idx_scan,
                        idx_tup_read,
                        idx_tup_fetch,
                        CASE 
                            WHEN idx_scan = 0 THEN 'unused'
                            WHEN idx_scan < 10 THEN 'low'
                            ELSE 'active'
                        END as usage_level
                    FROM pg_stat_user_indexes
                    ORDER BY idx_scan ASC
                """)
                
                result = await session.execute(query)
                
                index_metrics = []
                unused_indexes = []
                
                for row in result:
                    metric = IndexUsageMetric(
                        schema_name=row.schemaname,
                        table_name=row.tablename,
                        index_name=row.indexname,
                        scans=row.idx_scan,
                        tuples_read=row.idx_tup_read,
                        tuples_fetched=row.idx_tup_fetch,
                        usage_level=row.usage_level
                    )
                    
                    # Add recommendations for unused indexes
                    if row.usage_level == 'unused':
                        metric.recommendation = f"Consider dropping unused index {row.indexname}"
                        unused_indexes.append(metric.__dict__)
                    
                    index_metrics.append(metric.__dict__)
                
                self._add_metric(MetricType.INDEX_USAGE, {
                    'indexes': index_metrics,
                    'unused_count': len(unused_indexes),
                    'unused_indexes': unused_indexes
                })
                
                # Alert on too many unused indexes
                if len(unused_indexes) > 5:
                    await self._create_alert(
                        AlertSeverity.INFO,
                        MetricType.INDEX_USAGE,
                        f"Found {len(unused_indexes)} unused indexes",
                        len(unused_indexes),
                        5,
                        {'unused_indexes': [idx['index_name'] for idx in unused_indexes[:5]]}
                    )
        
        except Exception as e:
            logger.error(f"Error collecting index usage metrics: {e}")
    
    async def _collect_cache_metrics(self, db_manager):
        """Collect cache performance metrics"""
        try:
            cache_metrics = []
            
            # Database cache hit ratio
            async with db_manager.get_session() as session:
                query = text("""
                    SELECT 
                        sum(blks_hit) as hits,
                        sum(blks_read) as reads,
                        sum(blks_hit) / nullif(sum(blks_hit) + sum(blks_read), 0) as hit_ratio
                    FROM pg_stat_database
                """)
                
                result = await session.execute(query)
                row = result.first()
                
                if row and row.hit_ratio is not None:
                    db_cache = CacheMetric(
                        level="DB",
                        hit_ratio=row.hit_ratio,
                        total_requests=row.hits + row.reads,
                        hits=row.hits,
                        misses=row.reads,
                        size=0,  # Not directly available
                        max_size=0
                    )
                    cache_metrics.append(db_cache.__dict__)
                    
                    # Alert on low cache hit ratio
                    if row.hit_ratio < self.thresholds['cache_hit_ratio']:
                        await self._create_alert(
                            AlertSeverity.WARNING,
                            MetricType.CACHE_PERFORMANCE,
                            f"Low database cache hit ratio: {row.hit_ratio:.1%}",
                            row.hit_ratio,
                            self.thresholds['cache_hit_ratio']
                        )
            
            # Redis cache metrics
            redis_client = await get_redis_client()
            if redis_client:
                try:
                    info = await redis_client.info()
                    keyspace_hits = info.get('keyspace_hits', 0)
                    keyspace_misses = info.get('keyspace_misses', 0)
                    total_requests = keyspace_hits + keyspace_misses
                    
                    if total_requests > 0:
                        redis_cache = CacheMetric(
                            level="L2_Redis",
                            hit_ratio=keyspace_hits / total_requests,
                            total_requests=total_requests,
                            hits=keyspace_hits,
                            misses=keyspace_misses,
                            size=info.get('used_memory', 0),
                            max_size=info.get('maxmemory', 0),
                            evictions=info.get('evicted_keys', 0)
                        )
                        cache_metrics.append(redis_cache.__dict__)
                except Exception as e:
                    logger.warning(f"Error getting Redis cache metrics: {e}")
            
            # Application cache metrics (from database manager)
            db_stats = await db_manager.get_stats()
            if 'cache' in db_stats and 'l1_stats' in db_stats['cache']:
                l1_stats = db_stats['cache']['l1_stats']
                if l1_stats:
                    l1_cache = CacheMetric(
                        level="L1_App",
                        hit_ratio=l1_stats.get('hit_ratio', 0),
                        total_requests=l1_stats.get('requests', 0),
                        hits=int(l1_stats.get('requests', 0) * l1_stats.get('hit_ratio', 0)),
                        misses=int(l1_stats.get('requests', 0) * (1 - l1_stats.get('hit_ratio', 0))),
                        size=l1_stats.get('size', 0),
                        max_size=l1_stats.get('max_size', 0)
                    )
                    cache_metrics.append(l1_cache.__dict__)
            
            self._add_metric(MetricType.CACHE_PERFORMANCE, {
                'cache_levels': cache_metrics,
                'overall_performance': {
                    'avg_hit_ratio': statistics.mean([c['hit_ratio'] for c in cache_metrics if c['hit_ratio'] > 0])
                } if cache_metrics else {}
            })
        
        except Exception as e:
            logger.error(f"Error collecting cache metrics: {e}")
    
    async def _collect_lock_metrics(self, db_manager):
        """Collect database lock contention metrics"""
        try:
            async with db_manager.get_session() as session:
                query = text("""
                    SELECT 
                        mode,
                        granted,
                        COUNT(*) as lock_count
                    FROM pg_locks 
                    GROUP BY mode, granted
                    ORDER BY lock_count DESC
                """)
                
                result = await session.execute(query)
                
                locks = []
                waiting_locks = 0
                
                for row in result:
                    lock_info = {
                        'mode': row.mode,
                        'granted': row.granted,
                        'count': row.lock_count
                    }
                    locks.append(lock_info)
                    
                    if not row.granted:
                        waiting_locks += row.lock_count
                
                self._add_metric(MetricType.LOCK_CONTENTION, {
                    'locks': locks,
                    'waiting_locks': waiting_locks,
                    'total_locks': sum(lock['count'] for lock in locks)
                })
                
                # Alert on lock contention
                if waiting_locks > 10:
                    await self._create_alert(
                        AlertSeverity.WARNING,
                        MetricType.LOCK_CONTENTION,
                        f"High lock contention: {waiting_locks} waiting locks",
                        waiting_locks,
                        10
                    )
        
        except Exception as e:
            logger.error(f"Error collecting lock metrics: {e}")
    
    async def _collect_resource_metrics(self):
        """Collect system resource metrics"""
        try:
            # CPU and Memory usage
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            resource_metrics = {
                'cpu_percent': cpu_percent,
                'memory_percent': memory.percent,
                'memory_used': memory.used,
                'memory_total': memory.total,
                'disk_percent': disk.percent,
                'disk_used': disk.used,
                'disk_total': disk.total
            }
            
            self._add_metric(MetricType.RESOURCE_USAGE, resource_metrics)
            
            # Check for resource alerts
            if memory.percent / 100 > self.thresholds['memory_usage']:
                await self._create_alert(
                    AlertSeverity.CRITICAL,
                    MetricType.RESOURCE_USAGE,
                    f"High memory usage: {memory.percent:.1f}%",
                    memory.percent / 100,
                    self.thresholds['memory_usage']
                )
            
            if disk.percent / 100 > self.thresholds['disk_usage']:
                await self._create_alert(
                    AlertSeverity.CRITICAL,
                    MetricType.RESOURCE_USAGE,
                    f"High disk usage: {disk.percent:.1f}%",
                    disk.percent / 100,
                    self.thresholds['disk_usage']
                )
        
        except Exception as e:
            logger.error(f"Error collecting resource metrics: {e}")
    
    def _add_metric(self, metric_type: MetricType, data: Dict[str, Any]):
        """Add metric to history"""
        metric_data = {
            'timestamp': datetime.now(),
            'data': data
        }
        
        self.metrics_history[metric_type].append(metric_data)
        
        # Keep only recent metrics
        if len(self.metrics_history[metric_type]) > self.max_history_size:
            self.metrics_history[metric_type].pop(0)
    
    async def _create_alert(
        self, 
        severity: AlertSeverity,
        metric_type: MetricType,
        message: str,
        value: float,
        threshold: float,
        details: Dict[str, Any] = None
    ):
        """Create performance alert"""
        alert_id = f"{metric_type.value}_{int(time.time())}"
        
        alert = PerformanceAlert(
            alert_id=alert_id,
            severity=severity,
            metric_type=metric_type,
            message=message,
            value=value,
            threshold=threshold,
            timestamp=datetime.now(),
            details=details or {}
        )
        
        self.alerts.append(alert)
        
        # Log alert
        log_level = {
            AlertSeverity.INFO: logging.INFO,
            AlertSeverity.WARNING: logging.WARNING,
            AlertSeverity.CRITICAL: logging.CRITICAL
        }[severity]
        
        logger.log(log_level, f"Performance Alert [{severity.value.upper()}]: {message}")
        
        # Send to external alerting system if configured
        await self._send_external_alert(alert)
    
    async def _send_external_alert(self, alert: PerformanceAlert):
        """Send alert to external systems (webhook, Slack, etc.)"""
        try:
            # This would integrate with your alerting system
            # For now, we'll just store in Redis for the API to consume
            redis_client = await get_redis_client()
            if redis_client:
                alert_data = {
                    'alert_id': alert.alert_id,
                    'severity': alert.severity.value,
                    'metric_type': alert.metric_type.value,
                    'message': alert.message,
                    'value': alert.value,
                    'threshold': alert.threshold,
                    'timestamp': alert.timestamp.isoformat(),
                    'details': alert.details
                }
                
                await redis_client.lpush(
                    "performance_alerts", 
                    json.dumps(alert_data)
                )
                await redis_client.ltrim("performance_alerts", 0, 99)  # Keep last 100 alerts
        
        except Exception as e:
            logger.error(f"Error sending external alert: {e}")
    
    async def _check_alerts(self):
        """Check for alert resolution"""
        # Implementation would check if alert conditions are still present
        # and mark alerts as resolved if they are not
        pass
    
    async def _cleanup_old_data(self):
        """Clean up old metrics and alerts"""
        cutoff_time = datetime.now() - timedelta(hours=24)
        
        # Clean up old alerts
        self.alerts = [
            alert for alert in self.alerts 
            if alert.timestamp > cutoff_time
        ]
    
    def get_current_metrics(self) -> Dict[str, Any]:
        """Get current performance metrics"""
        current_metrics = {}
        
        for metric_type, history in self.metrics_history.items():
            if history:
                current_metrics[metric_type.value] = history[-1]['data']
        
        return current_metrics
    
    def get_active_alerts(self) -> List[Dict[str, Any]]:
        """Get active performance alerts"""
        return [
            {
                'alert_id': alert.alert_id,
                'severity': alert.severity.value,
                'metric_type': alert.metric_type.value,
                'message': alert.message,
                'value': alert.value,
                'threshold': alert.threshold,
                'timestamp': alert.timestamp.isoformat(),
                'details': alert.details,
                'resolved': alert.resolved
            }
            for alert in self.alerts 
            if not alert.resolved
        ]
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Get performance summary for the last hour"""
        one_hour_ago = datetime.now() - timedelta(hours=1)
        
        summary = {
            'timestamp': datetime.now().isoformat(),
            'alerts_count': len([a for a in self.alerts if a.timestamp > one_hour_ago]),
            'critical_alerts': len([a for a in self.alerts if a.timestamp > one_hour_ago and a.severity == AlertSeverity.CRITICAL]),
            'metrics_collected': sum(len(history) for history in self.metrics_history.values()),
            'health_score': self._calculate_health_score()
        }
        
        return summary
    
    def _calculate_health_score(self) -> float:
        """Calculate overall database health score (0-100)"""
        score = 100.0
        
        # Deduct points for active alerts
        critical_alerts = len([a for a in self.alerts if not a.resolved and a.severity == AlertSeverity.CRITICAL])
        warning_alerts = len([a for a in self.alerts if not a.resolved and a.severity == AlertSeverity.WARNING])
        
        score -= (critical_alerts * 25)  # -25 per critical alert
        score -= (warning_alerts * 10)   # -10 per warning alert
        
        return max(0.0, score)


# Global monitor instance
_performance_monitor: Optional[DatabasePerformanceMonitor] = None


async def get_performance_monitor() -> DatabasePerformanceMonitor:
    """Get or create global performance monitor"""
    global _performance_monitor
    
    if _performance_monitor is None:
        _performance_monitor = DatabasePerformanceMonitor()
        await _performance_monitor.start_monitoring()
    
    return _performance_monitor


async def get_performance_metrics() -> Dict[str, Any]:
    """Get current performance metrics"""
    monitor = await get_performance_monitor()
    return monitor.get_current_metrics()


async def get_performance_alerts() -> List[Dict[str, Any]]:
    """Get active performance alerts"""
    monitor = await get_performance_monitor()
    return monitor.get_active_alerts()


async def get_performance_summary() -> Dict[str, Any]:
    """Get performance summary"""
    monitor = await get_performance_monitor()
    return monitor.get_performance_summary()