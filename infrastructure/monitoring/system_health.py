"""
System Health Monitoring Module
==============================

Comprehensive system health monitoring and alerting for production deployment.
Addresses monitoring gaps identified in system analysis.

Features:
- Database connection health
- Redis connection health
- API endpoint health checks
- System resource monitoring
- Custom business metrics
- Alert generation and notification
"""

import asyncio
import psutil
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum
import asyncpg
import redis
import httpx
from prometheus_client import Counter, Gauge, Histogram, generate_latest
import smtplib
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart

logger = logging.getLogger(__name__)

class HealthStatus(Enum):
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    DOWN = "down"

@dataclass
class HealthMetric:
    """Individual health metric"""
    name: str
    status: HealthStatus
    value: float
    threshold_warning: float
    threshold_critical: float
    message: str
    timestamp: datetime
    details: Dict[str, Any] = None

@dataclass
class SystemHealth:
    """Overall system health status"""
    overall_status: HealthStatus
    metrics: List[HealthMetric]
    timestamp: datetime
    uptime_seconds: float

class SystemHealthMonitor:
    """
    Comprehensive system health monitoring
    """
    
    def __init__(self, 
                 database_url: str,
                 redis_url: str,
                 api_base_url: str = "http://localhost:8000",
                 alert_email: Optional[str] = None,
                 smtp_config: Optional[Dict] = None):
        """
        Initialize health monitor
        
        Args:
            database_url: PostgreSQL connection URL
            redis_url: Redis connection URL
            api_base_url: Base URL for API health checks
            alert_email: Email for alerts
            smtp_config: SMTP configuration for alerts
        """
        self.database_url = database_url
        self.redis_url = redis_url
        self.api_base_url = api_base_url
        self.alert_email = alert_email
        self.smtp_config = smtp_config or {}
        
        self.start_time = time.time()
        self.last_alert_time = {}
        
        # Prometheus metrics
        self.health_status_gauge = Gauge('system_health_status', 'System health status', ['component'])
        self.api_response_time = Histogram('api_response_time_seconds', 'API response time')
        self.database_connections = Gauge('database_connections_active', 'Active database connections')
        self.memory_usage = Gauge('system_memory_usage_percent', 'System memory usage percentage')
        self.disk_usage = Gauge('system_disk_usage_percent', 'System disk usage percentage')
        self.cpu_usage = Gauge('system_cpu_usage_percent', 'System CPU usage percentage')
        
    async def check_database_health(self) -> HealthMetric:
        """Check PostgreSQL database health"""
        try:
            start_time = time.time()
            
            # Test connection and simple query
            conn = await asyncpg.connect(self.database_url)
            
            # Check connection count
            result = await conn.fetchval("""
                SELECT count(*) FROM pg_stat_activity 
                WHERE state = 'active'
            """)
            
            active_connections = result or 0
            response_time = (time.time() - start_time) * 1000  # ms
            
            await conn.close()
            
            self.database_connections.set(active_connections)
            
            # Determine health status
            if response_time > 1000:  # 1 second
                status = HealthStatus.CRITICAL
                message = f"Database response time too high: {response_time:.2f}ms"
            elif response_time > 500:  # 500ms
                status = HealthStatus.WARNING
                message = f"Database response time elevated: {response_time:.2f}ms"
            elif active_connections > 80:
                status = HealthStatus.WARNING
                message = f"High connection count: {active_connections}"
            else:
                status = HealthStatus.HEALTHY
                message = f"Database healthy - {response_time:.2f}ms response"
            
            self.health_status_gauge.labels(component='database').set(1 if status == HealthStatus.HEALTHY else 0)
            
            return HealthMetric(
                name="database",
                status=status,
                value=response_time,
                threshold_warning=500,
                threshold_critical=1000,
                message=message,
                timestamp=datetime.utcnow(),
                details={
                    "active_connections": active_connections,
                    "response_time_ms": response_time
                }
            )
            
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            self.health_status_gauge.labels(component='database').set(0)
            
            return HealthMetric(
                name="database",
                status=HealthStatus.DOWN,
                value=0,
                threshold_warning=500,
                threshold_critical=1000,
                message=f"Database connection failed: {str(e)}",
                timestamp=datetime.utcnow(),
                details={"error": str(e)}
            )
    
    async def check_redis_health(self) -> HealthMetric:
        """Check Redis health"""
        try:
            start_time = time.time()
            
            # Parse Redis URL
            if self.redis_url.startswith('redis://'):
                redis_client = redis.from_url(self.redis_url)
            else:
                redis_client = redis.Redis.from_url(self.redis_url)
            
            # Test connection
            await asyncio.get_event_loop().run_in_executor(
                None, redis_client.ping
            )
            
            # Get Redis info
            info = await asyncio.get_event_loop().run_in_executor(
                None, redis_client.info
            )
            
            response_time = (time.time() - start_time) * 1000  # ms
            memory_usage = info.get('used_memory', 0)
            connected_clients = info.get('connected_clients', 0)
            
            redis_client.close()
            
            # Determine health status
            if response_time > 100:
                status = HealthStatus.WARNING
                message = f"Redis response time elevated: {response_time:.2f}ms"
            elif connected_clients > 100:
                status = HealthStatus.WARNING
                message = f"High Redis client count: {connected_clients}"
            else:
                status = HealthStatus.HEALTHY
                message = f"Redis healthy - {response_time:.2f}ms response"
            
            self.health_status_gauge.labels(component='redis').set(1 if status == HealthStatus.HEALTHY else 0)
            
            return HealthMetric(
                name="redis",
                status=status,
                value=response_time,
                threshold_warning=50,
                threshold_critical=100,
                message=message,
                timestamp=datetime.utcnow(),
                details={
                    "connected_clients": connected_clients,
                    "memory_usage_bytes": memory_usage,
                    "response_time_ms": response_time
                }
            )
            
        except Exception as e:
            logger.error(f"Redis health check failed: {e}")
            self.health_status_gauge.labels(component='redis').set(0)
            
            return HealthMetric(
                name="redis",
                status=HealthStatus.DOWN,
                value=0,
                threshold_warning=50,
                threshold_critical=100,
                message=f"Redis connection failed: {str(e)}",
                timestamp=datetime.utcnow(),
                details={"error": str(e)}
            )
    
    async def check_api_health(self) -> HealthMetric:
        """Check API endpoint health"""
        try:
            start_time = time.time()
            
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.api_base_url}/health", timeout=10.0)
                
            response_time = (time.time() - start_time) * 1000  # ms
            self.api_response_time.observe(response_time / 1000)
            
            if response.status_code != 200:
                status = HealthStatus.CRITICAL
                message = f"API health check failed: HTTP {response.status_code}"
            elif response_time > 2000:  # 2 seconds
                status = HealthStatus.CRITICAL
                message = f"API response time too high: {response_time:.2f}ms"
            elif response_time > 1000:  # 1 second
                status = HealthStatus.WARNING
                message = f"API response time elevated: {response_time:.2f}ms"
            else:
                status = HealthStatus.HEALTHY
                message = f"API healthy - {response_time:.2f}ms response"
            
            self.health_status_gauge.labels(component='api').set(1 if status == HealthStatus.HEALTHY else 0)
            
            return HealthMetric(
                name="api",
                status=status,
                value=response_time,
                threshold_warning=1000,
                threshold_critical=2000,
                message=message,
                timestamp=datetime.utcnow(),
                details={
                    "status_code": response.status_code,
                    "response_time_ms": response_time
                }
            )
            
        except Exception as e:
            logger.error(f"API health check failed: {e}")
            self.health_status_gauge.labels(component='api').set(0)
            
            return HealthMetric(
                name="api",
                status=HealthStatus.DOWN,
                value=0,
                threshold_warning=1000,
                threshold_critical=2000,
                message=f"API health check failed: {str(e)}",
                timestamp=datetime.utcnow(),
                details={"error": str(e)}
            )
    
    def check_system_resources(self) -> List[HealthMetric]:
        """Check system resource usage"""
        metrics = []
        
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            self.cpu_usage.set(cpu_percent)
            
            cpu_status = HealthStatus.HEALTHY
            if cpu_percent > 90:
                cpu_status = HealthStatus.CRITICAL
            elif cpu_percent > 70:
                cpu_status = HealthStatus.WARNING
            
            metrics.append(HealthMetric(
                name="cpu_usage",
                status=cpu_status,
                value=cpu_percent,
                threshold_warning=70,
                threshold_critical=90,
                message=f"CPU usage: {cpu_percent:.1f}%",
                timestamp=datetime.utcnow()
            ))
            
            # Memory usage
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            self.memory_usage.set(memory_percent)
            
            memory_status = HealthStatus.HEALTHY
            if memory_percent > 90:
                memory_status = HealthStatus.CRITICAL
            elif memory_percent > 80:
                memory_status = HealthStatus.WARNING
            
            metrics.append(HealthMetric(
                name="memory_usage",
                status=memory_status,
                value=memory_percent,
                threshold_warning=80,
                threshold_critical=90,
                message=f"Memory usage: {memory_percent:.1f}%",
                timestamp=datetime.utcnow(),
                details={
                    "total_bytes": memory.total,
                    "available_bytes": memory.available,
                    "used_bytes": memory.used
                }
            ))
            
            # Disk usage
            disk = psutil.disk_usage('/')
            disk_percent = (disk.used / disk.total) * 100
            self.disk_usage.set(disk_percent)
            
            disk_status = HealthStatus.HEALTHY
            if disk_percent > 90:
                disk_status = HealthStatus.CRITICAL
            elif disk_percent > 80:
                disk_status = HealthStatus.WARNING
            
            metrics.append(HealthMetric(
                name="disk_usage",
                status=disk_status,
                value=disk_percent,
                threshold_warning=80,
                threshold_critical=90,
                message=f"Disk usage: {disk_percent:.1f}%",
                timestamp=datetime.utcnow(),
                details={
                    "total_bytes": disk.total,
                    "free_bytes": disk.free,
                    "used_bytes": disk.used
                }
            ))
            
        except Exception as e:
            logger.error(f"System resource check failed: {e}")
            
        return metrics
    
    async def get_comprehensive_health(self) -> SystemHealth:
        """Get comprehensive system health status"""
        metrics = []
        
        # Check all components
        db_health = await self.check_database_health()
        metrics.append(db_health)
        
        redis_health = await self.check_redis_health()
        metrics.append(redis_health)
        
        api_health = await self.check_api_health()
        metrics.append(api_health)
        
        # Add system resource metrics
        system_metrics = self.check_system_resources()
        metrics.extend(system_metrics)
        
        # Determine overall health
        critical_count = sum(1 for m in metrics if m.status == HealthStatus.CRITICAL)
        down_count = sum(1 for m in metrics if m.status == HealthStatus.DOWN)
        warning_count = sum(1 for m in metrics if m.status == HealthStatus.WARNING)
        
        if down_count > 0 or critical_count > 0:
            overall_status = HealthStatus.CRITICAL
        elif warning_count > 0:
            overall_status = HealthStatus.WARNING
        else:
            overall_status = HealthStatus.HEALTHY
        
        uptime = time.time() - self.start_time
        
        return SystemHealth(
            overall_status=overall_status,
            metrics=metrics,
            timestamp=datetime.utcnow(),
            uptime_seconds=uptime
        )
    
    async def send_alert(self, health: SystemHealth):
        """Send alert if system health is degraded"""
        if not self.alert_email or not self.smtp_config:
            return
        
        # Only alert on critical or down status
        if health.overall_status not in [HealthStatus.CRITICAL, HealthStatus.DOWN]:
            return
        
        # Rate limit alerts (max 1 per 15 minutes per component)
        alert_key = f"system_health_{health.overall_status.value}"
        current_time = time.time()
        
        if (alert_key in self.last_alert_time and 
            current_time - self.last_alert_time[alert_key] < 900):  # 15 minutes
            return
        
        self.last_alert_time[alert_key] = current_time
        
        try:
            # Create alert email
            msg = MimeMultipart()
            msg['From'] = self.smtp_config.get('from_email', 'noreply@pollarbase.ai')
            msg['To'] = self.alert_email
            msg['Subject'] = f" Pollarbase System Health Alert - {health.overall_status.value.upper()}"
            
            # Create alert body
            body = f"""
System Health Alert - {health.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}

Overall Status: {health.overall_status.value.upper()}
System Uptime: {health.uptime_seconds / 3600:.1f} hours

Component Status:
"""
            
            for metric in health.metrics:
                status_icon = {
                    HealthStatus.HEALTHY: "",
                    HealthStatus.WARNING: "",
                    HealthStatus.CRITICAL: "",
                    HealthStatus.DOWN: "DOWN"
                                  }.get(metric.status, "UNKNOWN")
                
                body += f"{status_icon} {metric.name}: {metric.message}\n"
                
                if metric.details:
                    for key, value in metric.details.items():
                        body += f"   - {key}: {value}\n"
                body += "\n"
            
            body += "\nPlease investigate immediately.\n\nPollarbase Monitoring System"
            
            msg.attach(MimeText(body, 'plain'))
            
            # Send email
            with smtplib.SMTP(self.smtp_config['host'], self.smtp_config.get('port', 587)) as server:
                if self.smtp_config.get('use_tls', True):
                    server.starttls()
                if 'username' in self.smtp_config:
                    server.login(self.smtp_config['username'], self.smtp_config['password'])
                server.send_message(msg)
            
            logger.info(f"Health alert sent for {health.overall_status.value} status")
            
        except Exception as e:
            logger.error(f"Failed to send health alert: {e}")
    
    def get_metrics_endpoint(self) -> str:
        """Get Prometheus metrics for scraping"""
        return generate_latest().decode('utf-8')
    
    async def start_monitoring(self, interval_seconds: int = 60):
        """Start continuous monitoring loop"""
        logger.info(f"Starting system health monitoring (interval: {interval_seconds}s)")
        
        while True:
            try:
                health = await self.get_comprehensive_health()
                
                logger.info(f"System health check: {health.overall_status.value}")
                
                # Send alerts if needed
                await self.send_alert(health)
                
                # Log unhealthy components
                for metric in health.metrics:
                    if metric.status != HealthStatus.HEALTHY:
                        logger.warning(f"Component {metric.name}: {metric.message}")
                
            except Exception as e:
                logger.error(f"Health monitoring error: {e}")
            
            await asyncio.sleep(interval_seconds)

# Example usage for FastAPI integration
async def create_health_monitor():
    """Factory function to create health monitor"""
    import os
    
    monitor = SystemHealthMonitor(
        database_url=os.getenv("DATABASE_URL", "postgresql://user:pass@localhost/db"),
        redis_url=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
        api_base_url=os.getenv("API_BASE_URL", "http://localhost:8000"),
        alert_email=os.getenv("ALERT_EMAIL"),
        smtp_config={
            "host": os.getenv("SMTP_HOST", "smtp.gmail.com"),
            "port": int(os.getenv("SMTP_PORT", "587")),
            "username": os.getenv("SMTP_USERNAME"),
            "password": os.getenv("SMTP_PASSWORD"),
            "use_tls": True,
            "from_email": os.getenv("FROM_EMAIL", "alerts@pollarbase.ai")
        } if os.getenv("SMTP_HOST") else None
    )
    
    return monitor 