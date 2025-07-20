"""
Comprehensive monitoring service for Schlep-engine
Coordinates health checks, metrics collection, error tracking, and alerting
"""

import asyncio
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass
from enum import Enum
import logging
import json
import psutil
from contextlib import asynccontextmanager

from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database.connection import get_db
from app.core.health import health_checker, HealthStatus
from app.core.metrics import metrics_collector, record_system_metrics
from app.core.error_tracking import error_tracker, capture_exception, ErrorSeverity, ErrorCategory
from app.core.logging_config import get_logger

logger = get_logger(__name__)

class MonitoringTaskType(str, Enum):
    """Types of monitoring tasks"""
    HEALTH_CHECK = "health_check"
    METRICS_COLLECTION = "metrics_collection"
    ERROR_ANALYSIS = "error_analysis"
    SYSTEM_MONITORING = "system_monitoring"
    ALERTING = "alerting"
    CLEANUP = "cleanup"

@dataclass
class MonitoringTask:
    """Monitoring task configuration"""
    task_type: MonitoringTaskType
    interval: int  # seconds
    enabled: bool = True
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    handler: Optional[Callable] = None

class MonitoringService:
    """Comprehensive monitoring service"""
    
    def __init__(self):
        self.tasks: Dict[str, MonitoringTask] = {}
        self.is_running = False
        self.background_task = None
        self.alert_handlers: List[Callable] = []
        
        # Initialize monitoring tasks
        self._initialize_tasks()
    
    def _initialize_tasks(self):
        """Initialize monitoring tasks"""
        self.tasks = {
            "health_check": MonitoringTask(
                task_type=MonitoringTaskType.HEALTH_CHECK,
                interval=30,  # 30 seconds
                handler=self._run_health_checks
            ),
            "metrics_collection": MonitoringTask(
                task_type=MonitoringTaskType.METRICS_COLLECTION,
                interval=60,  # 1 minute
                handler=self._collect_metrics
            ),
            "system_monitoring": MonitoringTask(
                task_type=MonitoringTaskType.SYSTEM_MONITORING,
                interval=30,  # 30 seconds
                handler=self._monitor_system
            ),
            "error_analysis": MonitoringTask(
                task_type=MonitoringTaskType.ERROR_ANALYSIS,
                interval=300,  # 5 minutes
                handler=self._analyze_errors
            ),
            "alerting": MonitoringTask(
                task_type=MonitoringTaskType.ALERTING,
                interval=60,  # 1 minute
                handler=self._check_alerts
            ),
            "cleanup": MonitoringTask(
                task_type=MonitoringTaskType.CLEANUP,
                interval=3600,  # 1 hour
                handler=self._cleanup_old_data
            )
        }
    
    async def start(self):
        """Start the monitoring service"""
        if self.is_running:
            logger.warning("Monitoring service is already running")
            return
        
        logger.info("Starting monitoring service...")
        self.is_running = True
        self.background_task = asyncio.create_task(self._monitoring_loop())
        logger.info("Monitoring service started successfully")
    
    async def stop(self):
        """Stop the monitoring service"""
        if not self.is_running:
            logger.warning("Monitoring service is not running")
            return
        
        logger.info("Stopping monitoring service...")
        self.is_running = False
        
        if self.background_task:
            self.background_task.cancel()
            try:
                await self.background_task
            except asyncio.CancelledError:
                pass
        
        logger.info("Monitoring service stopped successfully")
    
    async def _monitoring_loop(self):
        """Main monitoring loop"""
        while self.is_running:
            try:
                current_time = datetime.utcnow()
                
                # Check and run scheduled tasks
                for task_name, task in self.tasks.items():
                    if not task.enabled:
                        continue
                    
                    if task.next_run is None or current_time >= task.next_run:
                        await self._run_task(task_name, task)
                        task.last_run = current_time
                        task.next_run = current_time + timedelta(seconds=task.interval)
                
                # Sleep for a short interval
                await asyncio.sleep(10)
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                capture_exception(
                    e,
                    severity=ErrorSeverity.HIGH,
                    category=ErrorCategory.SYSTEM,
                    extra_data={"component": "monitoring_service", "loop": "main"}
                )
                await asyncio.sleep(30)  # Wait longer on error
    
    async def _run_task(self, task_name: str, task: MonitoringTask):
        """Run a monitoring task"""
        try:
            logger.debug(f"Running monitoring task: {task_name}")
            
            if task.handler:
                await task.handler()
            
            logger.debug(f"Completed monitoring task: {task_name}")
            
        except Exception as e:
            logger.error(f"Error running monitoring task {task_name}: {e}")
            capture_exception(
                e,
                severity=ErrorSeverity.MEDIUM,
                category=ErrorCategory.SYSTEM,
                extra_data={"component": "monitoring_service", "task": task_name}
            )
    
    async def _run_health_checks(self):
        """Run comprehensive health checks"""
        try:
            # Get database session
            db = next(get_db())
            
            # Run all health checks
            health_data = await health_checker.run_all_health_checks(db)
            
            # Store health check results
            await self._store_health_check_results(health_data)
            
            # Check for critical issues
            await self._check_health_alerts(health_data)
            
        except Exception as e:
            logger.error(f"Error running health checks: {e}")
            capture_exception(
                e,
                severity=ErrorSeverity.HIGH,
                category=ErrorCategory.SYSTEM,
                extra_data={"component": "monitoring_service", "task": "health_checks"}
            )
    
    async def _collect_metrics(self):
        """Collect and store metrics"""
        try:
            # Collect system metrics
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            network = psutil.net_io_counters()
            
            # Record system metrics
            record_system_metrics(
                cpu_usage=cpu_percent,
                memory_usage=memory.used,
                disk_usage=disk.used,
                network_bytes_sent=network.bytes_sent,
                network_bytes_recv=network.bytes_recv
            )
            
            # Store metrics in database
            await self._store_system_metrics({
                "cpu_usage": cpu_percent,
                "memory_usage": memory.used,
                "memory_percent": memory.percent,
                "disk_usage": disk.used,
                "disk_percent": disk.percent,
                "network_bytes_sent": network.bytes_sent,
                "network_bytes_recv": network.bytes_recv
            })
            
        except Exception as e:
            logger.error(f"Error collecting metrics: {e}")
            capture_exception(
                e,
                severity=ErrorSeverity.MEDIUM,
                category=ErrorCategory.SYSTEM,
                extra_data={"component": "monitoring_service", "task": "metrics_collection"}
            )
    
    async def _monitor_system(self):
        """Monitor system resources and performance"""
        try:
            # Check system resources
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            # Check for resource thresholds
            if cpu_percent > 90:
                await self._trigger_alert(
                    "high_cpu_usage",
                    f"CPU usage is high: {cpu_percent}%",
                    ErrorSeverity.HIGH,
                    {"cpu_percent": cpu_percent}
                )
            
            if memory.percent > 90:
                await self._trigger_alert(
                    "high_memory_usage",
                    f"Memory usage is high: {memory.percent}%",
                    ErrorSeverity.HIGH,
                    {"memory_percent": memory.percent}
                )
            
            if disk.percent > 90:
                await self._trigger_alert(
                    "high_disk_usage",
                    f"Disk usage is high: {disk.percent}%",
                    ErrorSeverity.HIGH,
                    {"disk_percent": disk.percent}
                )
            
        except Exception as e:
            logger.error(f"Error monitoring system: {e}")
            capture_exception(
                e,
                severity=ErrorSeverity.MEDIUM,
                category=ErrorCategory.SYSTEM,
                extra_data={"component": "monitoring_service", "task": "system_monitoring"}
            )
    
    async def _analyze_errors(self):
        """Analyze error patterns and trends"""
        try:
            # Get database session
            db = next(get_db())
            
            # Analyze recent errors
            recent_errors = await self._get_recent_errors(db, hours=1)
            
            # Check for error patterns
            error_counts = {}
            for error in recent_errors:
                error_type = error.get("error_type", "unknown")
                error_counts[error_type] = error_counts.get(error_type, 0) + 1
            
            # Check for high error rates
            for error_type, count in error_counts.items():
                if count > 10:  # More than 10 errors in the last hour
                    await self._trigger_alert(
                        "high_error_rate",
                        f"High error rate for {error_type}: {count} errors in the last hour",
                        ErrorSeverity.HIGH,
                        {"error_type": error_type, "count": count}
                    )
            
        except Exception as e:
            logger.error(f"Error analyzing errors: {e}")
            capture_exception(
                e,
                severity=ErrorSeverity.MEDIUM,
                category=ErrorCategory.SYSTEM,
                extra_data={"component": "monitoring_service", "task": "error_analysis"}
            )
    
    async def _check_alerts(self):
        """Check and process alerts"""
        try:
            # Get database session
            db = next(get_db())
            
            # Check for active alerts
            active_alerts = await self._get_active_alerts(db)
            
            # Process alerts
            for alert in active_alerts:
                await self._process_alert(alert)
            
        except Exception as e:
            logger.error(f"Error checking alerts: {e}")
            capture_exception(
                e,
                severity=ErrorSeverity.MEDIUM,
                category=ErrorCategory.SYSTEM,
                extra_data={"component": "monitoring_service", "task": "alerting"}
            )
    
    async def _cleanup_old_data(self):
        """Clean up old monitoring data"""
        try:
            # Get database session
            db = next(get_db())
            
            # Clean up old health check data (older than 7 days)
            cutoff_date = datetime.utcnow() - timedelta(days=7)
            
            # Delete old health check records
            db.execute(
                text("DELETE FROM health_check_history WHERE created_at < :cutoff_date"),
                {"cutoff_date": cutoff_date}
            )
            
            # Delete old metrics data (older than 30 days)
            cutoff_date = datetime.utcnow() - timedelta(days=30)
            
            db.execute(
                text("DELETE FROM metrics_history WHERE timestamp < :cutoff_date"),
                {"cutoff_date": cutoff_date}
            )
            
            # Delete old error tracking data (older than 90 days)
            cutoff_date = datetime.utcnow() - timedelta(days=90)
            
            db.execute(
                text("DELETE FROM error_tracking WHERE created_at < :cutoff_date"),
                {"cutoff_date": cutoff_date}
            )
            
            # Commit changes
            db.commit()
            
            logger.info("Cleaned up old monitoring data")
            
        except Exception as e:
            logger.error(f"Error cleaning up old data: {e}")
            capture_exception(
                e,
                severity=ErrorSeverity.MEDIUM,
                category=ErrorCategory.SYSTEM,
                extra_data={"component": "monitoring_service", "task": "cleanup"}
            )
    
    async def _store_health_check_results(self, health_data: Dict[str, Any]):
        """Store health check results in database"""
        try:
            db = next(get_db())
            
            for service_name, service_data in health_data.get("services", {}).items():
                db.execute(
                    text("""
                        INSERT INTO health_check_history 
                        (service, status, message, response_time, details, created_at)
                        VALUES (:service, :status, :message, :response_time, :details, :created_at)
                    """),
                    {
                        "service": service_name,
                        "status": service_data.get("status", "unknown"),
                        "message": service_data.get("message", ""),
                        "response_time": service_data.get("response_time"),
                        "details": json.dumps(service_data.get("details", {})),
                        "created_at": datetime.utcnow()
                    }
                )
            
            db.commit()
            
        except Exception as e:
            logger.error(f"Error storing health check results: {e}")
            db.rollback()
    
    async def _store_system_metrics(self, metrics: Dict[str, Any]):
        """Store system metrics in database"""
        try:
            db = next(get_db())
            
            db.execute(
                text("""
                    INSERT INTO system_metrics 
                    (cpu_usage, memory_usage, memory_percent, disk_usage, disk_percent, 
                     network_bytes_sent, network_bytes_recv, created_at)
                    VALUES (:cpu_usage, :memory_usage, :memory_percent, :disk_usage, :disk_percent,
                           :network_bytes_sent, :network_bytes_recv, :created_at)
                """),
                {
                    "cpu_usage": metrics["cpu_usage"],
                    "memory_usage": metrics["memory_usage"],
                    "memory_percent": metrics["memory_percent"],
                    "disk_usage": metrics["disk_usage"],
                    "disk_percent": metrics["disk_percent"],
                    "network_bytes_sent": metrics["network_bytes_sent"],
                    "network_bytes_recv": metrics["network_bytes_recv"],
                    "created_at": datetime.utcnow()
                }
            )
            
            db.commit()
            
        except Exception as e:
            logger.error(f"Error storing system metrics: {e}")
            db.rollback()
    
    async def _get_recent_errors(self, db: Session, hours: int = 1) -> List[Dict[str, Any]]:
        """Get recent errors from database"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(hours=hours)
            
            result = db.execute(
                text("""
                    SELECT error_type, message, severity, category, created_at
                    FROM error_tracking
                    WHERE created_at >= :cutoff_date
                    ORDER BY created_at DESC
                """),
                {"cutoff_date": cutoff_date}
            )
            
            return [dict(row) for row in result.fetchall()]
            
        except Exception as e:
            logger.error(f"Error getting recent errors: {e}")
            return []
    
    async def _get_active_alerts(self, db: Session) -> List[Dict[str, Any]]:
        """Get active alerts from database"""
        try:
            result = db.execute(
                text("""
                    SELECT id, alert_type, severity, message, created_at
                    FROM alerts
                    WHERE is_resolved = false
                    ORDER BY created_at DESC
                """)
            )
            
            return [dict(row) for row in result.fetchall()]
            
        except Exception as e:
            logger.error(f"Error getting active alerts: {e}")
            return []
    
    async def _trigger_alert(
        self,
        alert_type: str,
        message: str,
        severity: ErrorSeverity,
        context: Optional[Dict[str, Any]] = None
    ):
        """Trigger an alert"""
        try:
            # Store alert in database
            db = next(get_db())
            
            db.execute(
                text("""
                    INSERT INTO alerts (alert_type, severity, message, context, created_at)
                    VALUES (:alert_type, :severity, :message, :context, :created_at)
                """),
                {
                    "alert_type": alert_type,
                    "severity": severity.value,
                    "message": message,
                    "context": json.dumps(context or {}),
                    "created_at": datetime.utcnow()
                }
            )
            
            db.commit()
            
            # Call alert handlers
            for handler in self.alert_handlers:
                try:
                    await handler(alert_type, message, severity, context)
                except Exception as e:
                    logger.error(f"Error in alert handler: {e}")
            
            logger.warning(f"Alert triggered: {alert_type} - {message}")
            
        except Exception as e:
            logger.error(f"Error triggering alert: {e}")
    
    async def _process_alert(self, alert: Dict[str, Any]):
        """Process an alert"""
        try:
            # This is where you would implement alert processing logic
            # For example, sending notifications, updating dashboards, etc.
            
            logger.info(f"Processing alert: {alert['alert_type']} - {alert['message']}")
            
        except Exception as e:
            logger.error(f"Error processing alert: {e}")
    
    async def _check_health_alerts(self, health_data: Dict[str, Any]):
        """Check health data for alerting conditions"""
        try:
            overall_status = health_data.get("status", "unknown")
            
            if overall_status == "unhealthy":
                await self._trigger_alert(
                    "system_unhealthy",
                    "System is unhealthy - critical services are down",
                    ErrorSeverity.CRITICAL,
                    {"overall_status": overall_status}
                )
            elif overall_status == "degraded":
                await self._trigger_alert(
                    "system_degraded",
                    "System is degraded - some services are experiencing issues",
                    ErrorSeverity.HIGH,
                    {"overall_status": overall_status}
                )
            
            # Check individual services
            for service_name, service_data in health_data.get("services", {}).items():
                service_status = service_data.get("status", "unknown")
                
                if service_status == "unhealthy":
                    await self._trigger_alert(
                        f"{service_name}_unhealthy",
                        f"Service {service_name} is unhealthy",
                        ErrorSeverity.HIGH,
                        {"service": service_name, "status": service_status}
                    )
            
        except Exception as e:
            logger.error(f"Error checking health alerts: {e}")
    
    def add_alert_handler(self, handler: Callable):
        """Add an alert handler"""
        self.alert_handlers.append(handler)
    
    def get_service_status(self) -> Dict[str, Any]:
        """Get monitoring service status"""
        return {
            "is_running": self.is_running,
            "tasks": {
                name: {
                    "enabled": task.enabled,
                    "last_run": task.last_run.isoformat() if task.last_run else None,
                    "next_run": task.next_run.isoformat() if task.next_run else None,
                    "interval": task.interval
                }
                for name, task in self.tasks.items()
            },
            "alert_handlers_count": len(self.alert_handlers)
        }

# Global monitoring service instance
monitoring_service = MonitoringService()

# Convenience functions
async def start_monitoring():
    """Start the monitoring service"""
    await monitoring_service.start()

async def stop_monitoring():
    """Stop the monitoring service"""
    await monitoring_service.stop()

def get_monitoring_status() -> Dict[str, Any]:
    """Get monitoring service status"""
    return monitoring_service.get_service_status()

def add_alert_handler(handler: Callable):
    """Add an alert handler"""
    monitoring_service.add_alert_handler(handler)

@asynccontextmanager
async def monitoring_context():
    """Context manager for monitoring service"""
    try:
        await start_monitoring()
        yield monitoring_service
    finally:
        await stop_monitoring() 