"""
Prometheus Metrics Collection for Schlep Engine
Comprehensive monitoring for CSV ingestion, API performance, and system resources
"""

from prometheus_client import Counter, Histogram, Gauge, Info
import time
import psutil
import threading
from functools import wraps
from typing import Dict, Any, Optional, Callable
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# ===== CSV INGESTION METRICS =====
csv_ingestion_total = Counter(
    'schlep_csv_ingestion_total',
    'Total number of CSV files processed',
    ['status', 'file_size_category']
)

csv_ingestion_duration = Histogram(
    'schlep_csv_ingestion_duration_seconds',
    'Time spent processing CSV files',
    ['file_size_category'],
    buckets=[0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, float('inf')]
)

csv_ingestion_throughput = Gauge(
    'schlep_csv_ingestion_throughput_rows_per_second',
    'CSV ingestion throughput in rows per second'
)

csv_rows_processed = Counter(
    'schlep_csv_rows_processed_total',
    'Total number of CSV rows processed',
    ['processing_engine']
)

# ===== API PERFORMANCE METRICS =====
api_requests_total = Counter(
    'schlep_api_requests_total',
    'Total number of API requests',
    ['method', 'endpoint', 'status_code']
)

api_request_duration = Histogram(
    'schlep_api_request_duration_seconds',
    'API request duration',
    ['method', 'endpoint'],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, float('inf')]
)

api_active_requests = Gauge(
    'schlep_api_active_requests',
    'Number of active API requests'
)

api_errors_total = Counter(
    'schlep_api_errors_total',
    'Total number of API errors',
    ['endpoint', 'error_type']
)

# ===== SYSTEM RESOURCE METRICS =====
system_memory_usage = Gauge(
    'schlep_system_memory_usage_bytes',
    'System memory usage in bytes',
    ['type']  # available, used, percent
)

system_cpu_usage = Gauge(
    'schlep_system_cpu_usage_percent',
    'System CPU usage percentage'
)

database_connections = Gauge(
    'schlep_database_connections_active',
    'Number of active database connections'
)

redis_memory_usage = Gauge(
    'schlep_redis_memory_usage_bytes',
    'Redis memory usage in bytes'
)

# ===== DATA PROCESSING METRICS =====
data_processing_operations = Counter(
    'schlep_data_processing_operations_total',
    'Total number of data processing operations',
    ['operation_type', 'engine', 'status']
)

data_processing_duration = Histogram(
    'schlep_data_processing_duration_seconds',
    'Data processing operation duration',
    ['operation_type', 'engine'],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0, 30.0, 60.0, float('inf')]
)

polars_vs_pandas_speedup = Gauge(
    'schlep_polars_pandas_speedup_ratio',
    'Polars vs Pandas performance speedup ratio'
)

# ===== APPLICATION INFO =====
app_info = Info(
    'schlep_app_info',
    'Application information'
)

app_info.info({
    'version': '2.0.0',
    'deployment_type': 'minimal_production',
    'dependencies_count': '25',
    'python_version': '3.11+',
    'features': 'polars,prometheus,grafana'
})

class MetricsCollector:
    """
    Centralized metrics collector for all Schlep Engine operations
    """

    def __init__(self):
        self.active_operations = {}
        self._start_system_monitoring()

    def _start_system_monitoring(self):
        """Start background thread for system metrics collection"""
        def collect_system_metrics():
            while True:
                try:
                    # Memory metrics
                    memory = psutil.virtual_memory()
                    system_memory_usage.labels(type='used').set(memory.used)
                    system_memory_usage.labels(type='available').set(memory.available)
                    system_memory_usage.labels(type='percent').set(memory.percent)

                    # CPU metrics
                    cpu_percent = psutil.cpu_percent(interval=1)
                    system_cpu_usage.set(cpu_percent)

                except Exception as e:
                    logger.error(f"System metrics collection error: {e}")

                time.sleep(10)  # Collect every 10 seconds

        thread = threading.Thread(target=collect_system_metrics, daemon=True)
        thread.start()
        logger.info("System metrics collection started")

    def track_csv_ingestion(self, file_size_mb: float, rows: int, duration: float,
                           engine: str, success: bool = True):
        """Track CSV ingestion performance"""
        # Categorize file size
        if file_size_mb < 1:
            size_category = 'small'
        elif file_size_mb < 10:
            size_category = 'medium'
        elif file_size_mb < 100:
            size_category = 'large'
        else:
            size_category = 'xlarge'

        # Record metrics
        status = 'success' if success else 'error'
        csv_ingestion_total.labels(status=status, file_size_category=size_category).inc()

        if success:
            csv_ingestion_duration.labels(file_size_category=size_category).observe(duration)
            throughput = rows / duration if duration > 0 else 0
            csv_ingestion_throughput.set(throughput)
            csv_rows_processed.labels(processing_engine=engine).inc(rows)

    def track_api_request(self, method: str, endpoint: str, status_code: int,
                         duration: float, error_type: Optional[str] = None):
        """Track API request metrics"""
        api_requests_total.labels(
            method=method,
            endpoint=endpoint,
            status_code=str(status_code)
        ).inc()

        api_request_duration.labels(method=method, endpoint=endpoint).observe(duration)

        if error_type:
            api_errors_total.labels(endpoint=endpoint, error_type=error_type).inc()

    def track_data_processing(self, operation_type: str, engine: str, duration: float,
                            success: bool = True):
        """Track data processing operations"""
        status = 'success' if success else 'error'
        data_processing_operations.labels(
            operation_type=operation_type,
            engine=engine,
            status=status
        ).inc()

        if success:
            data_processing_duration.labels(
                operation_type=operation_type,
                engine=engine
            ).observe(duration)

    def set_polars_speedup(self, speedup_ratio: float):
        """Set Polars vs Pandas speedup ratio"""
        polars_vs_pandas_speedup.set(speedup_ratio)

    def update_database_connections(self, count: int):
        """Update active database connections count"""
        database_connections.set(count)

    def update_redis_memory(self, memory_bytes: int):
        """Update Redis memory usage"""
        redis_memory_usage.set(memory_bytes)

# Global metrics collector instance
metrics_collector = MetricsCollector()

def monitor_csv_ingestion(func: Callable) -> Callable:
    """Decorator to monitor CSV ingestion operations"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()

        try:
            result = func(*args, **kwargs)
            duration = time.time() - start_time

            # Extract metrics from result if available
            if isinstance(result, dict):
                file_size_mb = result.get('file_size_mb', 0)
                rows = result.get('rows_processed', 0)
                engine = result.get('engine', 'unknown')

                metrics_collector.track_csv_ingestion(
                    file_size_mb=file_size_mb,
                    rows=rows,
                    duration=duration,
                    engine=engine,
                    success=True
                )

            return result

        except Exception as e:
            duration = time.time() - start_time
            metrics_collector.track_csv_ingestion(
                file_size_mb=0,
                rows=0,
                duration=duration,
                engine='unknown',
                success=False
            )
            raise

    return wrapper

def monitor_api_endpoint(endpoint: str):
    """Decorator to monitor API endpoints"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(request, *args, **kwargs):
            start_time = time.time()
            api_active_requests.inc()

            try:
                response = await func(request, *args, **kwargs)
                duration = time.time() - start_time

                metrics_collector.track_api_request(
                    method=request.method,
                    endpoint=endpoint,
                    status_code=response.status_code if hasattr(response, 'status_code') else 200,
                    duration=duration
                )

                return response

            except Exception as e:
                duration = time.time() - start_time

                metrics_collector.track_api_request(
                    method=request.method,
                    endpoint=endpoint,
                    status_code=500,
                    duration=duration,
                    error_type=type(e).__name__
                )
                raise

            finally:
                api_active_requests.dec()

        @wraps(func)
        def sync_wrapper(request, *args, **kwargs):
            start_time = time.time()
            api_active_requests.inc()

            try:
                response = func(request, *args, **kwargs)
                duration = time.time() - start_time

                metrics_collector.track_api_request(
                    method=request.method,
                    endpoint=endpoint,
                    status_code=response.status_code if hasattr(response, 'status_code') else 200,
                    duration=duration
                )

                return response

            except Exception as e:
                duration = time.time() - start_time

                metrics_collector.track_api_request(
                    method=request.method,
                    endpoint=endpoint,
                    status_code=500,
                    duration=duration,
                    error_type=type(e).__name__
                )
                raise

            finally:
                api_active_requests.dec()

        # Return appropriate wrapper based on function type
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator

def monitor_data_processing(operation_type: str, engine: str):
    """Decorator to monitor data processing operations"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()

            try:
                result = func(*args, **kwargs)
                duration = time.time() - start_time

                metrics_collector.track_data_processing(
                    operation_type=operation_type,
                    engine=engine,
                    duration=duration,
                    success=True
                )

                return result

            except Exception as e:
                duration = time.time() - start_time

                metrics_collector.track_data_processing(
                    operation_type=operation_type,
                    engine=engine,
                    duration=duration,
                    success=False
                )
                raise

        return wrapper

    return decorator

# Health check metrics
health_check_status = Gauge(
    'schlep_health_check_status',
    'Health check status (1=healthy, 0=unhealthy)',
    ['component']
)

def update_health_status(component: str, is_healthy: bool):
    """Update health check status for a component"""
    health_check_status.labels(component=component).set(1 if is_healthy else 0)

# Initialize health checks for key components
update_health_status('database', True)
update_health_status('redis', True)
update_health_status('file_storage', True)
update_health_status('data_processor', True)

logger.info("Prometheus metrics initialized for Schlep Engine v2.0.0")