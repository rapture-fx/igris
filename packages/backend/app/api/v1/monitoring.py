"""
Advanced Real-time Monitoring Dashboard API
Provides comprehensive system metrics, performance data, and health monitoring
for Pollarbase enterprise deployment.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, func
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import asyncio
import json
import psutil
import time
import asyncpg
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.auth.dependencies import get_current_user
from app.database.models import User
from app.core.config import settings

router = APIRouter()

# Monitoring Data Models
class SystemMetrics(BaseModel):
    """System-level performance metrics"""
    timestamp: datetime
    cpu_percent: float = Field(..., description="CPU utilization percentage")
    memory_percent: float = Field(..., description="Memory utilization percentage")
    disk_percent: float = Field(..., description="Disk utilization percentage")
    load_average: List[float] = Field(..., description="System load averages (1m, 5m, 15m)")
    network_io: Dict[str, int] = Field(..., description="Network I/O statistics")
    disk_io: Dict[str, int] = Field(..., description="Disk I/O statistics")

class DatabaseMetrics(BaseModel):
    """Database performance metrics"""
    timestamp: datetime
    active_connections: int = Field(..., description="Number of active connections")
    idle_connections: int = Field(..., description="Number of idle connections")
    total_connections: int = Field(..., description="Total connections")
    query_duration_avg: float = Field(..., description="Average query duration (ms)")
    query_duration_p95: float = Field(..., description="95th percentile query duration (ms)")
    transactions_per_second: float = Field(..., description="Transactions per second")
    cache_hit_ratio: float = Field(..., description="Cache hit ratio percentage")
    table_sizes: Dict[str, int] = Field(..., description="Table sizes in bytes")

class ApplicationMetrics(BaseModel):
    """Application-level performance metrics"""
    timestamp: datetime
    active_requests: int = Field(..., description="Number of active requests")
    request_rate: float = Field(..., description="Requests per second")
    response_time_avg: float = Field(..., description="Average response time (ms)")
    response_time_p95: float = Field(..., description="95th percentile response time (ms)")
    error_rate: float = Field(..., description="Error rate percentage")
    worker_status: Dict[str, Any] = Field(..., description="Celery worker status")
    queue_lengths: Dict[str, int] = Field(..., description="Task queue lengths")

class PerformanceSnapshot(BaseModel):
    """Complete performance snapshot"""
    timestamp: datetime
    system: SystemMetrics
    database: DatabaseMetrics
    application: ApplicationMetrics
    health_score: float = Field(..., description="Overall health score (0-100)")
    alerts: List[Dict[str, Any]] = Field(default_factory=list, description="Active alerts")

class AlertRule(BaseModel):
    """Alert rule configuration"""
    metric_name: str = Field(..., description="Metric to monitor")
    threshold: float = Field(..., description="Alert threshold")
    operator: str = Field(..., description="Comparison operator (>, <, >=, <=)")
    severity: str = Field(..., description="Alert severity (low, medium, high, critical)")
    duration: int = Field(default=300, description="Duration in seconds before alerting")

# Performance Monitoring Service
class PerformanceMonitor:
    """Advanced performance monitoring service"""
    
    def __init__(self):
        self.alert_rules = [
            AlertRule(metric_name="cpu_percent", threshold=80.0, operator=">", severity="high"),
            AlertRule(metric_name="memory_percent", threshold=85.0, operator=">", severity="high"),
            AlertRule(metric_name="disk_percent", threshold=90.0, operator=">", severity="critical"),
            AlertRule(metric_name="response_time_p95", threshold=1000.0, operator=">", severity="medium"),
            AlertRule(metric_name="error_rate", threshold=5.0, operator=">", severity="high"),
            AlertRule(metric_name="database_connections", threshold=80, operator=">", severity="medium"),
        ]
        self.metrics_history = []
        self.max_history_size = 1000
    
    async def get_system_metrics(self) -> SystemMetrics:
        """Collect system-level metrics"""
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            load_avg = psutil.getloadavg() if hasattr(psutil, 'getloadavg') else [0.0, 0.0, 0.0]
            
            # Network I/O
            net_io = psutil.net_io_counters()
            network_io = {
                "bytes_sent": net_io.bytes_sent,
                "bytes_recv": net_io.bytes_recv,
                "packets_sent": net_io.packets_sent,
                "packets_recv": net_io.packets_recv
            }
            
            # Disk I/O
            disk_io_counters = psutil.disk_io_counters()
            disk_io = {
                "read_bytes": disk_io_counters.read_bytes,
                "write_bytes": disk_io_counters.write_bytes,
                "read_count": disk_io_counters.read_count,
                "write_count": disk_io_counters.write_count
            }
            
            return SystemMetrics(
                timestamp=datetime.utcnow(),
                cpu_percent=cpu_percent,
                memory_percent=memory.percent,
                disk_percent=disk.percent,
                load_average=list(load_avg),
                network_io=network_io,
                disk_io=disk_io
            )
        except Exception as e:
            # Return safe defaults if metrics collection fails
            return SystemMetrics(
                timestamp=datetime.utcnow(),
                cpu_percent=0.0,
                memory_percent=0.0,
                disk_percent=0.0,
                load_average=[0.0, 0.0, 0.0],
                network_io={"bytes_sent": 0, "bytes_recv": 0, "packets_sent": 0, "packets_recv": 0},
                disk_io={"read_bytes": 0, "write_bytes": 0, "read_count": 0, "write_count": 0}
            )
    
    async def get_database_metrics(self, db: AsyncSession) -> DatabaseMetrics:
        """Collect database performance metrics"""
        try:
            # Get connection statistics
            conn_query = text("""
                SELECT 
                    COUNT(*) FILTER (WHERE state = 'active') as active_connections,
                    COUNT(*) FILTER (WHERE state = 'idle') as idle_connections,
                    COUNT(*) as total_connections
                FROM pg_stat_activity 
                WHERE datname = current_database()
            """)
            conn_result = await db.execute(conn_query)
            conn_stats = conn_result.fetchone()
            
            # Get query performance statistics
            query_stats_query = text("""
                SELECT 
                    COALESCE(AVG(mean_exec_time), 0) as avg_duration,
                    COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY mean_exec_time), 0) as p95_duration
                FROM pg_stat_statements 
                WHERE calls > 0
            """)
            
            try:
                query_result = await db.execute(query_stats_query)
                query_stats = query_result.fetchone()
                avg_duration = float(query_stats[0]) if query_stats else 0.0
                p95_duration = float(query_stats[1]) if query_stats else 0.0
            except:
                # pg_stat_statements might not be enabled
                avg_duration = 0.0
                p95_duration = 0.0
            
            # Get transaction statistics
            db_stats_query = text("""
                SELECT 
                    xact_commit + xact_rollback as total_transactions,
                    tup_returned + tup_fetched as total_reads
                FROM pg_stat_database 
                WHERE datname = current_database()
            """)
            db_result = await db.execute(db_stats_query)
            db_stats = db_result.fetchone()
            
            # Calculate transactions per second (approximate)
            total_transactions = float(db_stats[0]) if db_stats else 0.0
            transactions_per_second = total_transactions / 3600  # Rough estimate
            
            # Get table sizes
            table_sizes_query = text("""
                SELECT 
                    schemaname||'.'||tablename as table_name,
                    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
                FROM pg_tables 
                WHERE schemaname = 'public'
                ORDER BY size_bytes DESC
                LIMIT 10
            """)
            table_result = await db.execute(table_sizes_query)
            table_sizes = {row[0]: int(row[1]) for row in table_result.fetchall()}
            
            return DatabaseMetrics(
                timestamp=datetime.utcnow(),
                active_connections=int(conn_stats[0]) if conn_stats else 0,
                idle_connections=int(conn_stats[1]) if conn_stats else 0,
                total_connections=int(conn_stats[2]) if conn_stats else 0,
                query_duration_avg=avg_duration,
                query_duration_p95=p95_duration,
                transactions_per_second=transactions_per_second,
                cache_hit_ratio=95.0,  # Default value
                table_sizes=table_sizes
            )
        except Exception as e:
            # Return safe defaults if database metrics collection fails
            return DatabaseMetrics(
                timestamp=datetime.utcnow(),
                active_connections=0,
                idle_connections=0,
                total_connections=0,
                query_duration_avg=0.0,
                query_duration_p95=0.0,
                transactions_per_second=0.0,
                cache_hit_ratio=0.0,
                table_sizes={}
            )
    
    async def get_application_metrics(self) -> ApplicationMetrics:
        """Collect application-level metrics"""
        try:
            # For now, return mock data - in production, integrate with actual metrics
            return ApplicationMetrics(
                timestamp=datetime.utcnow(),
                active_requests=5,
                request_rate=25.5,
                response_time_avg=45.2,
                response_time_p95=89.7,
                error_rate=0.1,
                worker_status={
                    "ai_processing": {"active": 2, "status": "healthy"},
                    "data_processing": {"active": 4, "status": "healthy"},
                    "monitoring": {"active": 1, "status": "healthy"}
                },
                queue_lengths={
                    "ai_processing": 3,
                    "data_processing": 8,
                    "monitoring": 0
                }
            )
        except Exception as e:
            # Return safe defaults
            return ApplicationMetrics(
                timestamp=datetime.utcnow(),
                active_requests=0,
                request_rate=0.0,
                response_time_avg=0.0,
                response_time_p95=0.0,
                error_rate=0.0,
                worker_status={},
                queue_lengths={}
            )
    
    def calculate_health_score(self, metrics: PerformanceSnapshot) -> float:
        """Calculate overall system health score"""
        try:
            scores = []
            
            # CPU health (weight: 20%)
            cpu_score = max(0, 100 - metrics.system.cpu_percent)
            scores.append(cpu_score * 0.2)
            
            # Memory health (weight: 25%)
            memory_score = max(0, 100 - metrics.system.memory_percent)
            scores.append(memory_score * 0.25)
            
            # Disk health (weight: 15%)
            disk_score = max(0, 100 - metrics.system.disk_percent)
            scores.append(disk_score * 0.15)
            
            # Response time health (weight: 25%)
            response_score = max(0, 100 - (metrics.application.response_time_p95 / 10))
            scores.append(min(100, response_score) * 0.25)
            
            # Error rate health (weight: 15%)
            error_score = max(0, 100 - (metrics.application.error_rate * 10))
            scores.append(error_score * 0.15)
            
            return sum(scores)
        except:
            return 50.0  # Default moderate health score
    
    def check_alerts(self, metrics: PerformanceSnapshot) -> List[Dict[str, Any]]:
        """Check for alert conditions"""
        alerts = []
        current_time = datetime.utcnow()
        
        try:
            # Check CPU alerts
            if metrics.system.cpu_percent > 80:
                alerts.append({
                    "id": f"cpu_high_{int(time.time())}",
                    "severity": "high",
                    "message": f"High CPU usage: {metrics.system.cpu_percent:.1f}%",
                    "metric": "cpu_percent",
                    "value": metrics.system.cpu_percent,
                    "threshold": 80.0,
                    "timestamp": current_time
                })
            
            # Check memory alerts
            if metrics.system.memory_percent > 85:
                alerts.append({
                    "id": f"memory_high_{int(time.time())}",
                    "severity": "high",
                    "message": f"High memory usage: {metrics.system.memory_percent:.1f}%",
                    "metric": "memory_percent",
                    "value": metrics.system.memory_percent,
                    "threshold": 85.0,
                    "timestamp": current_time
                })
            
            # Check response time alerts
            if metrics.application.response_time_p95 > 1000:
                alerts.append({
                    "id": f"response_time_high_{int(time.time())}",
                    "severity": "medium",
                    "message": f"High response time: {metrics.application.response_time_p95:.1f}ms",
                    "metric": "response_time_p95",
                    "value": metrics.application.response_time_p95,
                    "threshold": 1000.0,
                    "timestamp": current_time
                })
        except:
            pass  # Don't break on alert checking errors
        
        return alerts

# Global monitor instance
monitor = PerformanceMonitor()

# API Endpoints

@router.get("/metrics/snapshot", response_model=PerformanceSnapshot)
async def get_performance_snapshot(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get complete performance snapshot"""
    try:
        system_metrics = await monitor.get_system_metrics()
        database_metrics = await monitor.get_database_metrics(db)
        application_metrics = await monitor.get_application_metrics()
        
        snapshot = PerformanceSnapshot(
            timestamp=datetime.utcnow(),
            system=system_metrics,
            database=database_metrics,
            application=application_metrics,
            health_score=0.0,  # Will be calculated
            alerts=[]
        )
        
        # Calculate health score and check alerts
        snapshot.health_score = monitor.calculate_health_score(snapshot)
        snapshot.alerts = monitor.check_alerts(snapshot)
        
        # Store in history
        monitor.metrics_history.append(snapshot)
        if len(monitor.metrics_history) > monitor.max_history_size:
            monitor.metrics_history.pop(0)
        
        return snapshot
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to collect metrics: {str(e)}")

@router.get("/metrics/history")
async def get_metrics_history(
    hours: int = 24,
    current_user: User = Depends(get_current_user)
):
    """Get historical metrics data"""
    cutoff_time = datetime.utcnow() - timedelta(hours=hours)
    
    # Filter history by time range
    filtered_history = [
        metric for metric in monitor.metrics_history
        if metric.timestamp >= cutoff_time
    ]
    
    return {
        "timerange_hours": hours,
        "data_points": len(filtered_history),
        "metrics": filtered_history[-100:]  # Return last 100 data points max
    }

@router.get("/metrics/stream")
async def stream_metrics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Stream real-time metrics via Server-Sent Events"""
    
    async def generate_metrics():
        while True:
            try:
                snapshot = await get_performance_snapshot(db, current_user)
                yield f"data: {json.dumps(snapshot.dict(), default=str)}\n\n"
                await asyncio.sleep(5)  # Update every 5 seconds
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                await asyncio.sleep(10)  # Wait longer on error
    
    return StreamingResponse(
        generate_metrics(),
        media_type="text/plain",
        headers={"Cache-Control": "no-cache"}
    )

@router.get("/health/detailed")
async def get_detailed_health(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get detailed health assessment"""
    snapshot = await get_performance_snapshot(db, current_user)
    
    health_details = {
        "overall_score": snapshot.health_score,
        "status": "healthy" if snapshot.health_score > 80 else "degraded" if snapshot.health_score > 60 else "critical",
        "components": {
            "system": {
                "cpu": {"value": snapshot.system.cpu_percent, "status": "ok" if snapshot.system.cpu_percent < 80 else "warning"},
                "memory": {"value": snapshot.system.memory_percent, "status": "ok" if snapshot.system.memory_percent < 85 else "warning"},
                "disk": {"value": snapshot.system.disk_percent, "status": "ok" if snapshot.system.disk_percent < 90 else "critical"}
            },
            "database": {
                "connections": {"value": snapshot.database.total_connections, "status": "ok" if snapshot.database.total_connections < 80 else "warning"},
                "performance": {"avg_query_time": snapshot.database.query_duration_avg, "status": "ok" if snapshot.database.query_duration_avg < 100 else "warning"}
            },
            "application": {
                "response_time": {"value": snapshot.application.response_time_p95, "status": "ok" if snapshot.application.response_time_p95 < 500 else "warning"},
                "error_rate": {"value": snapshot.application.error_rate, "status": "ok" if snapshot.application.error_rate < 1 else "warning"}
            }
        },
        "active_alerts": snapshot.alerts,
        "recommendations": []
    }
    
    # Add recommendations based on metrics
    if snapshot.system.cpu_percent > 80:
        health_details["recommendations"].append("Consider scaling CPU resources or optimizing CPU-intensive operations")
    
    if snapshot.system.memory_percent > 85:
        health_details["recommendations"].append("Memory usage is high - consider scaling memory or optimizing memory usage")
    
    if snapshot.application.response_time_p95 > 500:
        health_details["recommendations"].append("API response times are elevated - review database queries and caching")
    
    return health_details

@router.get("/metrics/export")
async def export_metrics(
    format: str = "json",
    hours: int = 24,
    current_user: User = Depends(get_current_user)
):
    """Export metrics data for external analysis"""
    history = await get_metrics_history(hours, current_user)
    
    if format.lower() == "csv":
        # Convert to CSV format
        import io
        import csv
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            "timestamp", "cpu_percent", "memory_percent", "disk_percent",
            "response_time_avg", "response_time_p95", "error_rate",
            "active_connections", "health_score"
        ])
        
        # Write data
        for metric in history["metrics"]:
            writer.writerow([
                metric.timestamp,
                metric.system.cpu_percent,
                metric.system.memory_percent,
                metric.system.disk_percent,
                metric.application.response_time_avg,
                metric.application.response_time_p95,
                metric.application.error_rate,
                metric.database.active_connections,
                metric.health_score
            ])
        
        output.seek(0)
        return StreamingResponse(
            io.StringIO(output.getvalue()),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=pollarbase_metrics.csv"}
        )
    
    return history 