"""
Benchmarking and Performance Comparison for Schlep Engine
"""

import time
import tempfile
import os
from typing import Dict, List, Any, Tuple, Optional
import pandas as pd
import polars as pl
from .core import read_csv_fast, aggregate_data, process_strings, clean_data, configure, PerformanceMode
from .monitoring import MemoryMonitor, OperationTimer


def create_benchmark_csv(filepath: str, num_rows: int = 100_000) -> None:
    """Create a benchmark CSV file"""
    import csv
    import random

    with open(filepath, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['id', 'name', 'category', 'value', 'timestamp', 'description'])

        categories = ['A', 'B', 'C', 'D', 'E'] * 20  # 100 categories
        for i in range(num_rows):
            writer.writerow([
                f"id_{i:08d}",
                f"Name_{i % 1000}",
                categories[i % len(categories)],
                round(random.uniform(10.0, 1000.0), 2),
                f"2024-01-{1 + (i % 28):02d}",
                f"Description for record {i} with some text content"
            ])


def benchmark_csv_reading(num_rows: int = 100_000) -> Dict[str, Any]:
    """Benchmark CSV reading performance"""
    results = {}

    with tempfile.TemporaryDirectory() as temp_dir:
        csv_path = os.path.join(temp_dir, "benchmark.csv")
        create_benchmark_csv(csv_path, num_rows)

        file_size_mb = os.path.getsize(csv_path) / 1024 / 1024

        # Test pandas
        start_time = time.time()
        with MemoryMonitor() as monitor:
            df_pandas = pd.read_csv(csv_path)
        pandas_time = time.time() - start_time
        pandas_memory = monitor.stop()

        # Test polars
        start_time = time.time()
        with MemoryMonitor() as monitor:
            df_polars = pl.read_csv(csv_path)
        polars_time = time.time() - start_time
        polars_memory = monitor.stop()

        # Test Schlep Engine (Rust)
        configure(performance_mode=PerformanceMode.RUST_PREFERRED)
        start_time = time.time()
        with MemoryMonitor() as monitor:
            df_schlep = read_csv_fast(csv_path, return_format="pandas")
        schlep_time = time.time() - start_time
        schlep_memory = monitor.stop()

        results = {
            "file_size_mb": file_size_mb,
            "num_rows": num_rows,
            "pandas": {
                "time_seconds": pandas_time,
                "memory_peak_mb": pandas_memory["peak_mb"],
                "rows_per_second": num_rows / pandas_time
            },
            "polars": {
                "time_seconds": polars_time,
                "memory_peak_mb": polars_memory["peak_mb"],
                "rows_per_second": num_rows / polars_time
            },
            "schlep_rust": {
                "time_seconds": schlep_time,
                "memory_peak_mb": schlep_memory["peak_mb"],
                "rows_per_second": num_rows / schlep_time
            }
        }

        # Calculate speedups
        results["speedup_vs_pandas"] = {
            "polars": pandas_time / polars_time,
            "schlep_rust": pandas_time / schlep_time
        }

        results["memory_efficiency"] = {
            "polars_vs_pandas": pandas_memory["peak_mb"] / polars_memory["peak_mb"],
            "schlep_vs_pandas": pandas_memory["peak_mb"] / schlep_memory["peak_mb"]
        }

    return results


def benchmark_aggregations(num_rows: int = 1_000_000) -> Dict[str, Any]:
    """Benchmark aggregation performance"""
    # Create test data
    import random
    groups = [f"group_{i % 1000}" for i in range(num_rows)]
    values = [random.uniform(1.0, 100.0) for _ in range(num_rows)]

    data = pd.DataFrame({"group": groups, "value": values})

    results = {}

    # Test pandas
    start_time = time.time()
    with MemoryMonitor() as monitor:
        pandas_result = data.groupby("group")["value"].mean()
    pandas_time = time.time() - start_time
    pandas_memory = monitor.stop()

    # Test polars
    pl_data = pl.from_pandas(data)
    start_time = time.time()
    with MemoryMonitor() as monitor:
        polars_result = pl_data.group_by("group").agg(pl.col("value").mean())
    polars_time = time.time() - start_time
    polars_memory = monitor.stop()

    # Test Schlep Engine (Rust)
    configure(performance_mode=PerformanceMode.RUST_PREFERRED)
    start_time = time.time()
    with MemoryMonitor() as monitor:
        schlep_result = aggregate_data(data, "group", "value", "mean", return_format="pandas")
    schlep_time = time.time() - start_time
    schlep_memory = monitor.stop()

    results = {
        "num_rows": num_rows,
        "num_groups": len(set(groups)),
        "pandas": {
            "time_seconds": pandas_time,
            "memory_peak_mb": pandas_memory["peak_mb"],
            "rows_per_second": num_rows / pandas_time
        },
        "polars": {
            "time_seconds": polars_time,
            "memory_peak_mb": polars_memory["peak_mb"],
            "rows_per_second": num_rows / polars_time
        },
        "schlep_rust": {
            "time_seconds": schlep_time,
            "memory_peak_mb": schlep_memory["peak_mb"],
            "rows_per_second": num_rows / schlep_time
        }
    }

    # Calculate speedups
    results["speedup_vs_pandas"] = {
        "polars": pandas_time / polars_time,
        "schlep_rust": pandas_time / schlep_time
    }

    return results


def benchmark_string_processing(num_strings: int = 100_000) -> Dict[str, Any]:
    """Benchmark string processing performance"""
    # Create test strings
    strings = [f"Test string {i} with some content to process" for i in range(num_strings)]

    results = {}

    # Test pandas
    series = pd.Series(strings)
    start_time = time.time()
    with MemoryMonitor() as monitor:
        pandas_lengths = series.str.len().tolist()
        pandas_upper = series.str.upper().tolist()
    pandas_time = time.time() - start_time
    pandas_memory = monitor.stop()

    # Test Schlep Engine (Rust)
    configure(performance_mode=PerformanceMode.RUST_PREFERRED)
    start_time = time.time()
    with MemoryMonitor() as monitor:
        schlep_lengths = process_strings(strings, "length")
        schlep_upper = process_strings(strings, "upper")
    schlep_time = time.time() - start_time
    schlep_memory = monitor.stop()

    results = {
        "num_strings": num_strings,
        "operations": 2,  # length + upper
        "pandas": {
            "time_seconds": pandas_time,
            "memory_peak_mb": pandas_memory["peak_mb"],
            "strings_per_second": num_strings * 2 / pandas_time
        },
        "schlep_rust": {
            "time_seconds": schlep_time,
            "memory_peak_mb": schlep_memory["peak_mb"],
            "strings_per_second": num_strings * 2 / schlep_time
        }
    }

    results["speedup_vs_pandas"] = pandas_time / schlep_time

    return results


def run_comprehensive_benchmark(sizes: Optional[List[int]] = None) -> Dict[str, Any]:
    """Run comprehensive benchmarks across different data sizes"""

    if sizes is None:
        sizes = [10_000, 50_000, 100_000, 500_000]

    results = {
        "csv_reading": {},
        "aggregations": {},
        "string_processing": {},
        "summary": {}
    }

    print("🚀 Running comprehensive benchmarks...")
    print("=" * 50)

    for size in sizes:
        print(f"\n📊 Testing with {size:,} records...")

        # CSV Reading (smaller sizes due to file I/O overhead)
        if size <= 100_000:
            print("  • CSV Reading...")
            results["csv_reading"][size] = benchmark_csv_reading(size)

        # Aggregations
        print("  • Aggregations...")
        results["aggregations"][size] = benchmark_aggregations(size)

        # String Processing (smaller sizes)
        if size <= 100_000:
            print("  • String Processing...")
            results["string_processing"][size] = benchmark_string_processing(size)

    # Calculate summary statistics
    print("\n📈 Calculating summary statistics...")

    csv_speedups = []
    agg_speedups = []
    str_speedups = []

    for size, result in results["csv_reading"].items():
        if "speedup_vs_pandas" in result and "schlep_rust" in result["speedup_vs_pandas"]:
            csv_speedups.append(result["speedup_vs_pandas"]["schlep_rust"])

    for size, result in results["aggregations"].items():
        if "speedup_vs_pandas" in result and "schlep_rust" in result["speedup_vs_pandas"]:
            agg_speedups.append(result["speedup_vs_pandas"]["schlep_rust"])

    for size, result in results["string_processing"].items():
        if "speedup_vs_pandas" in result:
            str_speedups.append(result["speedup_vs_pandas"])

    results["summary"] = {
        "average_speedups": {
            "csv_reading": sum(csv_speedups) / len(csv_speedups) if csv_speedups else 1.0,
            "aggregations": sum(agg_speedups) / len(agg_speedups) if agg_speedups else 1.0,
            "string_processing": sum(str_speedups) / len(str_speedups) if str_speedups else 1.0
        },
        "max_speedups": {
            "csv_reading": max(csv_speedups) if csv_speedups else 1.0,
            "aggregations": max(agg_speedups) if agg_speedups else 1.0,
            "string_processing": max(str_speedups) if str_speedups else 1.0
        },
        "sizes_tested": sizes
    }

    return results


def benchmark_performance() -> Dict[str, Any]:
    """
    Run standard performance benchmarks

    Returns:
        Dictionary with benchmark results
    """
    return run_comprehensive_benchmark()


def compare_with_pandas(operation: str, data_size: int = 100_000) -> Dict[str, Any]:
    """
    Compare specific operation performance with pandas

    Args:
        operation: "csv", "aggregation", or "string"
        data_size: Size of test data

    Returns:
        Comparison results
    """

    if operation == "csv":
        return benchmark_csv_reading(data_size)
    elif operation == "aggregation":
        return benchmark_aggregations(data_size)
    elif operation == "string":
        return benchmark_string_processing(data_size)
    else:
        raise ValueError(f"Unknown operation: {operation}. Choose 'csv', 'aggregation', or 'string'")


def generate_benchmark_report(results: Dict[str, Any]) -> str:
    """Generate a formatted benchmark report"""

    if not results or "summary" not in results:
        return "No benchmark results available."

    report = []
    report.append("🎯 SCHLEP ENGINE BENCHMARK REPORT")
    report.append("=" * 60)

    summary = results["summary"]
    avg_speedups = summary["average_speedups"]
    max_speedups = summary["max_speedups"]

    # Summary
    report.append("\n📊 PERFORMANCE SUMMARY")
    report.append("-" * 30)
    report.append(f"CSV Reading:      {avg_speedups['csv_reading']:.2f}x avg, {max_speedups['csv_reading']:.2f}x max")
    report.append(f"Aggregations:     {avg_speedups['aggregations']:.2f}x avg, {max_speedups['aggregations']:.2f}x max")
    report.append(f"String Processing: {avg_speedups['string_processing']:.2f}x avg, {max_speedups['string_processing']:.2f}x max")

    # Detailed results
    if "csv_reading" in results and results["csv_reading"]:
        report.append("\n📁 CSV READING PERFORMANCE")
        report.append("-" * 30)
        for size, result in results["csv_reading"].items():
            speedup = result["speedup_vs_pandas"]["schlep_rust"]
            memory_eff = result["memory_efficiency"]["schlep_vs_pandas"]
            report.append(f"{size:,} rows: {speedup:.2f}x faster, {memory_eff:.2f}x less memory")

    if "aggregations" in results and results["aggregations"]:
        report.append("\n🔢 AGGREGATION PERFORMANCE")
        report.append("-" * 30)
        for size, result in results["aggregations"].items():
            speedup = result["speedup_vs_pandas"]["schlep_rust"]
            throughput = result["schlep_rust"]["rows_per_second"]
            report.append(f"{size:,} rows: {speedup:.2f}x faster ({throughput:,.0f} rows/sec)")

    if "string_processing" in results and results["string_processing"]:
        report.append("\n🔤 STRING PROCESSING PERFORMANCE")
        report.append("-" * 30)
        for size, result in results["string_processing"].items():
            speedup = result["speedup_vs_pandas"]
            throughput = result["schlep_rust"]["strings_per_second"]
            report.append(f"{size:,} strings: {speedup:.2f}x faster ({throughput:,.0f} ops/sec)")

    # Recommendations
    report.append("\n💡 RECOMMENDATIONS")
    report.append("-" * 30)

    if avg_speedups['csv_reading'] > 2.0:
        report.append("✅ CSV reading shows excellent performance - use for files >50MB")

    if avg_speedups['aggregations'] > 3.0:
        report.append("✅ Aggregations highly optimized - use for large groupby operations")

    if avg_speedups['string_processing'] > 5.0:
        report.append("✅ String processing very fast - use for text-heavy workloads")

    overall_avg = sum(avg_speedups.values()) / len(avg_speedups)
    if overall_avg > 3.0:
        report.append("\n🎯 OVERALL: Rust kernels provide significant performance benefits!")
    elif overall_avg > 1.5:
        report.append("\n🎯 OVERALL: Rust kernels show good performance improvements.")
    else:
        report.append("\n🎯 OVERALL: Consider Polars migration as primary optimization.")

    return "\n".join(report)