"""
Schlep Engine - High-Performance Data Processing

A hybrid Python + Rust system for fast data processing operations.
Provides Pythonic APIs over high-performance Rust kernels.
"""

from .core import (
    read_csv_fast,
    process_strings,
    aggregate_data,
    clean_data,
    SchlepConfig,
    PerformanceMode
)

from .benchmarks import benchmark_performance, compare_with_pandas
from .monitoring import get_performance_metrics, MemoryMonitor

__version__ = "0.1.0"
__author__ = "Schlep Engine Team"

__all__ = [
    # Core data processing functions
    "read_csv_fast",
    "process_strings",
    "aggregate_data",
    "clean_data",

    # Configuration
    "SchlepConfig",
    "PerformanceMode",

    # Benchmarking
    "benchmark_performance",
    "compare_with_pandas",

    # Monitoring
    "get_performance_metrics",
    "MemoryMonitor",
]