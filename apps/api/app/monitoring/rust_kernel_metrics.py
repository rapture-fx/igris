"""
Rust Kernel Performance Metrics for Prometheus
Enterprise-grade observability for hybrid Python + Rust architecture
"""

import time
import logging
from typing import Dict, Any, Optional, List
from functools import wraps
from dataclasses import dataclass
from enum import Enum

try:
    from prometheus_client import Counter, Histogram, Gauge, Info, start_http_server
    from prometheus_client.core import CollectorRegistry
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False

logger = logging.getLogger(__name__)

class MetricsConfig:
    """Configuration for Rust kernel metrics"""
    METRICS_PORT = 8001
    METRICS_PATH = "/metrics"
    HISTOGRAM_BUCKETS = [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0]

class RustKernelMetrics:
    """
    Comprehensive metrics collection for Rust kernel performance
    Provides enterprise-grade observability
    """

    def __init__(self, registry: Optional[CollectorRegistry] = None):
        if not PROMETHEUS_AVAILABLE:
            logger.warning("Prometheus client not available - metrics disabled")
            self.enabled = False
            return

        self.enabled = True
        self.registry = registry or CollectorRegistry()
        self._setup_metrics()

    def _setup_metrics(self):
        """Setup all Rust kernel metrics"""

        # Request counters
        self.rust_requests_total = Counter(
            'schlep_rust_kernel_requests_total',
            'Total requests to Rust kernels by operation and status',
            ['operation', 'status', 'acceleration_type'],
            registry=self.registry
        )

        # Processing duration
        self.processing_duration = Histogram(
            'schlep_rust_kernel_processing_duration_seconds',
            'Time spent processing operations',
            ['operation', 'acceleration_type', 'data_size_bucket'],
            buckets=MetricsConfig.HISTOGRAM_BUCKETS,
            registry=self.registry
        )

        # Throughput metrics
        self.throughput_ops_per_sec = Gauge(
            'schlep_rust_kernel_throughput_ops_per_second',
            'Operations per second throughput',
            ['operation', 'acceleration_type'],
            registry=self.registry
        )

        self.throughput_rows_per_sec = Gauge(
            'schlep_rust_kernel_throughput_rows_per_second',
            'Rows processed per second',
            ['operation', 'acceleration_type'],
            registry=self.registry
        )

        # Performance gain metrics
        self.performance_gain_ratio = Gauge(
            'schlep_rust_kernel_performance_gain_ratio',
            'Performance gain ratio vs Python baseline',
            ['operation'],
            registry=self.registry
        )

        # Memory efficiency
        self.memory_efficiency_ratio = Gauge(
            'schlep_rust_kernel_memory_efficiency_ratio',
            'Memory efficiency ratio vs Python baseline',
            ['operation'],
            registry=self.registry
        )

        # Fallback metrics
        self.fallback_rate = Gauge(
            'schlep_rust_kernel_fallback_rate_percent',
            'Percentage of requests falling back to Python',
            ['operation'],
            registry=self.registry
        )

        self.fallback_reasons = Counter(
            'schlep_rust_kernel_fallback_reasons_total',
            'Count of fallback reasons',
            ['operation', 'reason'],
            registry=self.registry
        )

        # Error metrics
        self.error_rate = Gauge(
            'schlep_rust_kernel_error_rate_percent',
            'Error rate percentage for operations',
            ['operation'],
            registry=self.registry
        )

        self.errors_total = Counter(
            'schlep_rust_kernel_errors_total',
            'Total errors by operation and error type',
            ['operation', 'error_type'],
            registry=self.registry
        )

        # System health metrics
        self.kernel_availability = Gauge(
            'schlep_rust_kernel_availability',
            'Rust kernel availability (1=available, 0=unavailable)',
            registry=self.registry
        )

        self.kernel_info = Info(
            'schlep_rust_kernel_info',
            'Rust kernel build and version information',
            registry=self.registry
        )

        # Data size distribution
        self.data_size_distribution = Histogram(
            'schlep_rust_kernel_data_size_bytes',
            'Distribution of data sizes processed',
            ['operation'],
            buckets=[1024, 10240, 102400, 1048576, 10485760, 104857600, 1073741824],
            registry=self.registry
        )

        # Concurrent operations
        self.concurrent_operations = Gauge(
            'schlep_rust_kernel_concurrent_operations_current',
            'Currently running operations',
            ['operation'],
            registry=self.registry
        )

        # Initialize kernel availability
        self._update_kernel_availability()

    def _update_kernel_availability(self):
        """Update kernel availability status"""
        if not self.enabled:
            return

        try:
            import schlep_compute_kernels
            info = schlep_compute_kernels.kernel_info()
            self.kernel_availability.set(1)
            self.kernel_info.info(info)
            logger.info("Rust kernels available for metrics")
        except Exception as e:
            self.kernel_availability.set(0)
            logger.warning(f"Rust kernels unavailable: {e}")

    def record_operation(self, operation: str, acceleration_type: str,
                        processing_time: float, data_size: int,
                        rows_processed: int, success: bool = True,
                        fallback_reason: Optional[str] = None,
                        error_type: Optional[str] = None,
                        performance_gain: Optional[float] = None,
                        memory_efficiency: Optional[float] = None):
        """Record comprehensive operation metrics"""

        if not self.enabled:
            return

        # Determine status and data size bucket
        status = 'success' if success else 'error'
        if fallback_reason and acceleration_type == 'python_pandas':
            status = 'fallback'

        data_size_bucket = self._get_data_size_bucket(data_size)

        # Record basic metrics
        self.rust_requests_total.labels(
            operation=operation,
            status=status,
            acceleration_type=acceleration_type
        ).inc()

        self.processing_duration.labels(
            operation=operation,
            acceleration_type=acceleration_type,
            data_size_bucket=data_size_bucket
        ).observe(processing_time)

        # Record throughput metrics
        if processing_time > 0:
            ops_per_sec = 1.0 / processing_time
            rows_per_sec = rows_processed / processing_time

            self.throughput_ops_per_sec.labels(
                operation=operation,
                acceleration_type=acceleration_type
            ).set(ops_per_sec)

            self.throughput_rows_per_sec.labels(
                operation=operation,
                acceleration_type=acceleration_type
            ).set(rows_per_sec)

        # Record data size
        self.data_size_distribution.labels(operation=operation).observe(data_size)

        # Record performance gain
        if performance_gain:
            self.performance_gain_ratio.labels(operation=operation).set(performance_gain)

        # Record memory efficiency
        if memory_efficiency:
            self.memory_efficiency_ratio.labels(operation=operation).set(memory_efficiency)

        # Record fallback information
        if fallback_reason:
            self.fallback_reasons.labels(
                operation=operation,
                reason=self._sanitize_reason(fallback_reason)
            ).inc()

        # Record errors
        if not success and error_type:
            self.errors_total.labels(
                operation=operation,
                error_type=error_type
            ).inc()

    def _get_data_size_bucket(self, data_size: int) -> str:
        """Categorize data size into buckets"""
        if data_size < 1024:  # < 1KB
            return "tiny"
        elif data_size < 1048576:  # < 1MB
            return "small"
        elif data_size < 104857600:  # < 100MB
            return "medium"
        elif data_size < 1073741824:  # < 1GB
            return "large"
        else:
            return "enterprise"

    def _sanitize_reason(self, reason: str) -> str:
        """Sanitize fallback reason for metrics"""
        # Take first 50 chars and remove special characters
        sanitized = reason[:50].replace('"', '').replace('\n', ' ')
        return sanitized if sanitized else "unknown"

    def update_fallback_rates(self, operation_stats: Dict[str, Dict[str, int]]):
        """Update fallback rate percentages"""
        if not self.enabled:
            return

        for operation, stats in operation_stats.items():
            total = stats.get('total', 0)
            fallbacks = stats.get('fallbacks', 0)
            errors = stats.get('errors', 0)

            if total > 0:
                fallback_rate = (fallbacks / total) * 100
                error_rate = (errors / total) * 100

                self.fallback_rate.labels(operation=operation).set(fallback_rate)
                self.error_rate.labels(operation=operation).set(error_rate)

    def increment_concurrent_operations(self, operation: str):
        """Track concurrent operations"""
        if self.enabled:
            self.concurrent_operations.labels(operation=operation).inc()

    def decrement_concurrent_operations(self, operation: str):
        """Track concurrent operations"""
        if self.enabled:
            current = self.concurrent_operations.labels(operation=operation)._value._value
            if current > 0:
                self.concurrent_operations.labels(operation=operation).dec()

    def get_metrics_summary(self) -> Dict[str, Any]:
        """Get current metrics summary"""
        if not self.enabled:
            return {"metrics": "disabled"}

        # This would typically query the metrics registry
        # For now, return a status summary
        return {
            "metrics_enabled": True,
            "prometheus_available": PROMETHEUS_AVAILABLE,
            "metrics_port": MetricsConfig.METRICS_PORT,
            "metrics_collected": [
                "requests_total",
                "processing_duration",
                "throughput_metrics",
                "performance_gains",
                "fallback_rates",
                "error_rates",
                "kernel_availability"
            ]
        }

def create_performance_decorator(metrics: RustKernelMetrics, operation: str):
    """
    Decorator to automatically collect metrics for functions
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if not metrics.enabled:
                return func(*args, **kwargs)

            metrics.increment_concurrent_operations(operation)
            start_time = time.time()

            try:
                result = func(*args, **kwargs)
                processing_time = time.time() - start_time

                # Extract performance info from result if available
                if isinstance(result, tuple) and len(result) > 1:
                    data, perf_info = result
                    if isinstance(perf_info, dict):
                        metrics.record_operation(
                            operation=operation,
                            acceleration_type=perf_info.get('acceleration_type', 'unknown'),
                            processing_time=processing_time,
                            data_size=perf_info.get('data_size', 0),
                            rows_processed=perf_info.get('rows_processed', 0),
                            success=True,
                            fallback_reason=perf_info.get('fallback_reason'),
                            performance_gain=perf_info.get('performance_gain'),
                            memory_efficiency=perf_info.get('memory_efficiency')
                        )
                else:
                    # Basic metrics without detailed performance info
                    metrics.record_operation(
                        operation=operation,
                        acceleration_type='unknown',
                        processing_time=processing_time,
                        data_size=0,
                        rows_processed=0,
                        success=True
                    )

                return result

            except Exception as e:
                processing_time = time.time() - start_time
                metrics.record_operation(
                    operation=operation,
                    acceleration_type='failed',
                    processing_time=processing_time,
                    data_size=0,
                    rows_processed=0,
                    success=False,
                    error_type=type(e).__name__
                )
                raise

            finally:
                metrics.decrement_concurrent_operations(operation)

        return wrapper
    return decorator

# Global metrics instance
rust_kernel_metrics = RustKernelMetrics()

# Decorator instances for common operations
csv_read_metrics = create_performance_decorator(rust_kernel_metrics, 'csv_read')
groupby_metrics = create_performance_decorator(rust_kernel_metrics, 'groupby_agg')
string_ops_metrics = create_performance_decorator(rust_kernel_metrics, 'string_ops')

def start_metrics_server(port: int = MetricsConfig.METRICS_PORT):
    """Start Prometheus metrics server"""
    if not PROMETHEUS_AVAILABLE:
        logger.warning("Cannot start metrics server - Prometheus client not available")
        return False

    try:
        start_http_server(port, registry=rust_kernel_metrics.registry)
        logger.info(f"Rust kernel metrics server started on port {port}")
        return True
    except Exception as e:
        logger.error(f"Failed to start metrics server: {e}")
        return False

def get_metrics_health() -> Dict[str, Any]:
    """Get metrics system health status"""
    return {
        "metrics_enabled": rust_kernel_metrics.enabled,
        "prometheus_available": PROMETHEUS_AVAILABLE,
        "kernel_availability": "checking...",  # Would query actual metric
        "metrics_collected": rust_kernel_metrics.enabled
    }