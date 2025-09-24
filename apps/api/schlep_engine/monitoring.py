"""
Monitoring and Performance Tracking for Schlep Engine
"""

import time
import threading
import psutil
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from collections import defaultdict, deque


@dataclass
class PerformanceMetrics:
    """Performance metrics for operations"""
    operation_name: str
    duration_ms: float
    memory_peak_mb: float
    memory_current_mb: float
    input_size: int
    output_size: int
    backend_used: str  # "rust", "pandas", "polars"
    success: bool
    error_message: Optional[str] = None


class MemoryMonitor:
    """Real-time memory monitoring utility"""

    def __init__(self, sample_interval: float = 0.1):
        self.sample_interval = sample_interval
        self.process = psutil.Process()
        self.monitoring = False
        self.peak_memory = 0
        self.samples = deque(maxlen=1000)  # Keep last 1000 samples
        self._monitor_thread: Optional[threading.Thread] = None

    def start(self) -> None:
        """Start memory monitoring"""
        if self.monitoring:
            return

        self.monitoring = True
        self.peak_memory = 0
        self.samples.clear()
        self._monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._monitor_thread.start()

    def stop(self) -> Dict[str, float]:
        """Stop monitoring and return statistics"""
        self.monitoring = False

        if self._monitor_thread and self._monitor_thread.is_alive():
            self._monitor_thread.join(timeout=1.0)

        current_memory = self.process.memory_info().rss / 1024 / 1024

        if not self.samples:
            return {
                "peak_mb": current_memory,
                "current_mb": current_memory,
                "average_mb": current_memory,
                "samples": 0
            }

        samples_list = list(self.samples)
        return {
            "peak_mb": self.peak_memory,
            "current_mb": current_memory,
            "average_mb": sum(samples_list) / len(samples_list),
            "samples": len(samples_list)
        }

    def _monitor_loop(self) -> None:
        """Background monitoring loop"""
        while self.monitoring:
            try:
                memory_mb = self.process.memory_info().rss / 1024 / 1024
                self.peak_memory = max(self.peak_memory, memory_mb)
                self.samples.append(memory_mb)
                time.sleep(self.sample_interval)
            except (psutil.Error, OSError):
                break

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        return self.stop()


class PerformanceTracker:
    """Global performance tracking and analysis"""

    def __init__(self, max_metrics: int = 10000):
        self.max_metrics = max_metrics
        self.metrics: List[PerformanceMetrics] = []
        self.operation_stats = defaultdict(list)
        self._lock = threading.Lock()

    def record_metric(self, metric: PerformanceMetrics) -> None:
        """Record a performance metric"""
        with self._lock:
            self.metrics.append(metric)
            self.operation_stats[metric.operation_name].append(metric)

            # Keep only recent metrics
            if len(self.metrics) > self.max_metrics:
                old_metric = self.metrics.pop(0)
                self.operation_stats[old_metric.operation_name].remove(old_metric)

    def get_stats(self, operation_name: Optional[str] = None) -> Dict[str, Any]:
        """Get performance statistics"""
        with self._lock:
            if operation_name:
                metrics = self.operation_stats.get(operation_name, [])
            else:
                metrics = self.metrics

            if not metrics:
                return {"total_operations": 0}

            successful_metrics = [m for m in metrics if m.success]
            failed_metrics = [m for m in metrics if not m.success]

            if not successful_metrics:
                return {
                    "total_operations": len(metrics),
                    "success_rate": 0.0,
                    "failures": len(failed_metrics)
                }

            durations = [m.duration_ms for m in successful_metrics]
            memory_peaks = [m.memory_peak_mb for m in successful_metrics]

            # Backend usage statistics
            backend_counts = defaultdict(int)
            for m in successful_metrics:
                backend_counts[m.backend_used] += 1

            return {
                "total_operations": len(metrics),
                "successful_operations": len(successful_metrics),
                "failed_operations": len(failed_metrics),
                "success_rate": len(successful_metrics) / len(metrics),

                # Performance stats
                "duration_ms": {
                    "min": min(durations),
                    "max": max(durations),
                    "avg": sum(durations) / len(durations),
                    "median": sorted(durations)[len(durations) // 2]
                },

                "memory_peak_mb": {
                    "min": min(memory_peaks),
                    "max": max(memory_peaks),
                    "avg": sum(memory_peaks) / len(memory_peaks),
                    "median": sorted(memory_peaks)[len(memory_peaks) // 2]
                },

                # Backend usage
                "backend_usage": dict(backend_counts),

                # Error analysis
                "common_errors": self._analyze_errors(failed_metrics)
            }

    def _analyze_errors(self, failed_metrics: List[PerformanceMetrics]) -> Dict[str, int]:
        """Analyze common error patterns"""
        error_counts = defaultdict(int)
        for metric in failed_metrics[-100:]:  # Last 100 errors
            if metric.error_message:
                # Categorize error types
                error_msg = metric.error_message.lower()
                if "memory" in error_msg:
                    error_counts["memory_errors"] += 1
                elif "timeout" in error_msg:
                    error_counts["timeout_errors"] += 1
                elif "file" in error_msg:
                    error_counts["file_errors"] += 1
                else:
                    error_counts["other_errors"] += 1

        return dict(error_counts)

    def reset_stats(self) -> None:
        """Reset all performance statistics"""
        with self._lock:
            self.metrics.clear()
            self.operation_stats.clear()


# Global performance tracker
_performance_tracker = PerformanceTracker()


class OperationTimer:
    """Context manager for timing operations with memory monitoring"""

    def __init__(self, operation_name: str, backend: str = "unknown", input_size: int = 0):
        self.operation_name = operation_name
        self.backend = backend
        self.input_size = input_size
        self.output_size = 0
        self.start_time = 0
        self.memory_monitor = MemoryMonitor()
        self.success = False
        self.error_message: Optional[str] = None

    def set_output_size(self, size: int) -> None:
        """Set the output size for metrics"""
        self.output_size = size

    def __enter__(self):
        self.start_time = time.time()
        self.memory_monitor.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        duration_ms = (time.time() - self.start_time) * 1000
        memory_stats = self.memory_monitor.stop()

        self.success = exc_type is None
        if exc_type is not None:
            self.error_message = str(exc_val)

        # Record metrics
        metric = PerformanceMetrics(
            operation_name=self.operation_name,
            duration_ms=duration_ms,
            memory_peak_mb=memory_stats["peak_mb"],
            memory_current_mb=memory_stats["current_mb"],
            input_size=self.input_size,
            output_size=self.output_size,
            backend_used=self.backend,
            success=self.success,
            error_message=self.error_message
        )

        _performance_tracker.record_metric(metric)


def get_performance_metrics(operation_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Get performance metrics for operations

    Args:
        operation_name: Specific operation name, or None for all operations

    Returns:
        Dictionary with performance statistics
    """
    return _performance_tracker.get_stats(operation_name)


def reset_performance_metrics() -> None:
    """Reset all performance tracking data"""
    _performance_tracker.reset_stats()


def monitor_rust_threads() -> Dict[str, Any]:
    """
    Monitor Rust thread pool for potential issues

    Returns:
        Dictionary with thread monitoring information
    """
    try:
        import sys
        import os
        sys.path.append(os.path.join(os.path.dirname(__file__), "..", "rust_compute_kernels"))
        import schlep_compute_kernels as _rust_kernels

        # Get kernel info which includes thread count
        kernel_info = _rust_kernels.kernel_info()

        # Check system thread usage
        process = psutil.Process()
        thread_count = process.num_threads()

        # Monitor CPU usage
        cpu_percent = process.cpu_percent(interval=0.1)

        return {
            "rust_threads": int(kernel_info.get("thread_count", "0")),
            "system_threads": thread_count,
            "cpu_percent": cpu_percent,
            "status": "healthy" if cpu_percent < 80 else "high_load",
            "monitoring_active": True
        }

    except Exception as e:
        return {
            "error": str(e),
            "monitoring_active": False,
            "status": "error"
        }


def generate_performance_report() -> str:
    """
    Generate a comprehensive performance report

    Returns:
        Formatted performance report as string
    """
    stats = get_performance_metrics()

    if stats["total_operations"] == 0:
        return "No performance data available."

    report = []
    report.append("🎯 SCHLEP ENGINE PERFORMANCE REPORT")
    report.append("=" * 50)

    # Overall stats
    report.append(f"Total Operations: {stats['total_operations']:,}")
    report.append(f"Success Rate: {stats['success_rate']:.1%}")

    if stats['successful_operations'] > 0:
        # Performance metrics
        report.append("\n📊 Performance Metrics:")
        dur = stats['duration_ms']
        mem = stats['memory_peak_mb']

        report.append(f"  Duration (ms): avg={dur['avg']:.1f}, min={dur['min']:.1f}, max={dur['max']:.1f}")
        report.append(f"  Memory (MB): avg={mem['avg']:.1f}, min={mem['min']:.1f}, max={mem['max']:.1f}")

        # Backend usage
        report.append("\n🔧 Backend Usage:")
        for backend, count in stats['backend_usage'].items():
            percentage = (count / stats['successful_operations']) * 100
            report.append(f"  {backend}: {count:,} operations ({percentage:.1f}%)")

    # Errors
    if stats['failed_operations'] > 0:
        report.append(f"\n❌ Failures: {stats['failed_operations']:,}")
        if stats['common_errors']:
            report.append("  Error Types:")
            for error_type, count in stats['common_errors'].items():
                report.append(f"    {error_type}: {count}")

    # Thread monitoring
    thread_info = monitor_rust_threads()
    if thread_info.get("monitoring_active"):
        report.append("\n🧵 Thread Monitoring:")
        report.append(f"  Rust Threads: {thread_info['rust_threads']}")
        report.append(f"  System Threads: {thread_info['system_threads']}")
        report.append(f"  CPU Usage: {thread_info['cpu_percent']:.1f}%")
        report.append(f"  Status: {thread_info['status']}")

    return "\n".join(report)