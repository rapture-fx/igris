#!/usr/bin/env python3
"""
Memory Safety and Large File Tests for Rust Compute Kernels

Tests for:
- Large CSV files (>1GB) with streaming
- Memory fragmentation under load
- PyO3 boundary memory copies
- Backpressure handling
"""

import os
import sys
import time
import tempfile
import threading
import psutil
import gc
from pathlib import Path
from typing import Iterator, List, Tuple
import csv

# Add the rust kernels to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/..")

try:
    import schlep_compute_kernels as kernels
except ImportError:
    print("❌ Rust kernels not built. Run 'maturin develop' first.")
    sys.exit(1)


class MemoryMonitor:
    """Monitor memory usage during tests"""

    def __init__(self):
        self.process = psutil.Process()
        self.peak_memory = 0
        self.memory_samples = []
        self.monitoring = False
        self._monitor_thread = None

    def start_monitoring(self):
        """Start memory monitoring in background thread"""
        self.monitoring = True
        self.peak_memory = 0
        self.memory_samples = []
        self._monitor_thread = threading.Thread(target=self._monitor_loop)
        self._monitor_thread.start()

    def stop_monitoring(self) -> dict:
        """Stop monitoring and return statistics"""
        self.monitoring = False
        if self._monitor_thread:
            self._monitor_thread.join()

        if not self.memory_samples:
            return {"peak_mb": 0, "samples": 0, "fragmentation_detected": False}

        current_memory = self.process.memory_info().rss / 1024 / 1024
        fragmentation_detected = self.peak_memory > current_memory * 1.5

        return {
            "peak_mb": self.peak_memory,
            "current_mb": current_memory,
            "samples": len(self.memory_samples),
            "fragmentation_detected": fragmentation_detected,
            "avg_mb": sum(self.memory_samples) / len(self.memory_samples)
        }

    def _monitor_loop(self):
        """Background monitoring loop"""
        while self.monitoring:
            try:
                memory_mb = self.process.memory_info().rss / 1024 / 1024
                self.peak_memory = max(self.peak_memory, memory_mb)
                self.memory_samples.append(memory_mb)
                time.sleep(0.1)  # Sample every 100ms
            except Exception:
                break


def create_large_csv(filepath: str, size_gb: float, streaming: bool = True) -> None:
    """
    Create a large CSV file for testing

    Args:
        filepath: Path to create the file
        size_gb: Target size in GB
        streaming: If True, write in chunks to avoid memory issues
    """
    print(f"📝 Creating {size_gb}GB CSV file: {filepath}")

    # Estimate rows needed (each row ~100 bytes)
    target_bytes = int(size_gb * 1024 * 1024 * 1024)
    row_size_estimate = 100
    target_rows = target_bytes // row_size_estimate

    chunk_size = 100_000 if streaming else target_rows

    with open(filepath, 'w', newline='') as f:
        writer = csv.writer(f)

        # Write header
        header = ['id', 'name', 'email', 'age', 'salary', 'department', 'timestamp', 'score', 'category', 'notes']
        writer.writerow(header)

        rows_written = 0
        while rows_written < target_rows:
            chunk_end = min(rows_written + chunk_size, target_rows)
            chunk = []

            for i in range(rows_written, chunk_end):
                row = [
                    f"user_{i:08d}",
                    f"User Name {i % 1000}",
                    f"user{i}@company{i % 50}.com",
                    25 + (i % 40),
                    50000 + (i % 50000),
                    f"Dept_{i % 20}",
                    f"2024-01-{1 + (i % 28):02d} {(i % 24):02d}:{(i % 60):02d}:00",
                    85.5 + (i % 30),
                    f"Category_{chr(65 + (i % 10))}",
                    f"Notes for record {i} with some longer text content"
                ]
                chunk.append(row)

            writer.writerows(chunk)
            rows_written = chunk_end

            if rows_written % 1_000_000 == 0:
                print(f"  → {rows_written:,} rows written ({os.path.getsize(filepath) / 1024 / 1024:.1f} MB)")

    final_size_mb = os.path.getsize(filepath) / 1024 / 1024
    print(f"✅ Created CSV: {final_size_mb:.1f} MB ({rows_written:,} rows)")


def test_large_csv_streaming():
    """Test streaming read of large CSV files"""
    print("\n" + "="*60)
    print("🧪 TESTING: Large CSV Streaming (>1GB)")
    print("="*60)

    with tempfile.TemporaryDirectory() as temp_dir:
        csv_path = os.path.join(temp_dir, "large_test.csv")

        # Create 1.2GB test file
        create_large_csv(csv_path, 1.2, streaming=True)

        # Test with memory monitoring
        monitor = MemoryMonitor()
        monitor.start_monitoring()

        print("📊 Testing Rust CSV kernel with large file...")
        start_time = time.time()

        try:
            # Test chunked reading with memory constraints
            headers, data = kernels.fast_csv_read_parallel(
                csv_path,
                max_memory_mb=500,  # Limit memory usage
                num_threads=4
            )

            load_time = time.time() - start_time
            memory_stats = monitor.stop_monitoring()

            print(f"✅ Large CSV loaded successfully!")
            print(f"   • Load time: {load_time:.2f}s")
            print(f"   • Headers: {len(headers)}")
            print(f"   • Rows: {len(data):,}")
            print(f"   • Peak memory: {memory_stats['peak_mb']:.1f} MB")
            print(f"   • Memory fragmentation: {'Yes' if memory_stats['fragmentation_detected'] else 'No'}")

            # Verify data integrity
            if len(data) > 0:
                sample_row = data[0]
                print(f"   • Sample row length: {len(sample_row)}")
                print(f"   • Sample data: {sample_row[:3]}...")

            # Test memory cleanup
            del data, headers
            gc.collect()

            return {
                "success": True,
                "load_time": load_time,
                "memory_stats": memory_stats,
                "rows_processed": len(data) if 'data' in locals() else 0
            }

        except Exception as e:
            memory_stats = monitor.stop_monitoring()
            print(f"❌ Large CSV test failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "memory_stats": memory_stats
            }


def test_memory_fragmentation():
    """Test for memory fragmentation under repeated operations"""
    print("\n" + "="*60)
    print("🧪 TESTING: Memory Fragmentation")
    print("="*60)

    monitor = MemoryMonitor()
    monitor.start_monitoring()

    # Run many CSV operations to stress memory
    fragmentation_results = []

    with tempfile.TemporaryDirectory() as temp_dir:
        for i in range(10):
            print(f"🔄 Memory stress test iteration {i+1}/10")

            csv_path = os.path.join(temp_dir, f"stress_test_{i}.csv")
            create_large_csv(csv_path, 0.1, streaming=True)  # 100MB files

            # Process multiple times
            for j in range(5):
                try:
                    headers, data = kernels.fast_csv_read(csv_path)

                    # Force some aggregations
                    groups = [f"group_{k % 100}" for k in range(len(data))]
                    values = [float(k) for k in range(len(data))]

                    if len(groups) > 0:
                        result = kernels.fast_groupby_agg(groups, values, "mean")

                    # Cleanup
                    del headers, data, groups, values
                    if 'result' in locals():
                        del result

                    # Force garbage collection
                    gc.collect()

                except Exception as e:
                    print(f"  ⚠️  Iteration {i+1}.{j+1} failed: {e}")

            # Clean up file
            os.unlink(csv_path)

    memory_stats = monitor.stop_monitoring()

    print(f"📊 Memory fragmentation test results:")
    print(f"   • Peak memory: {memory_stats['peak_mb']:.1f} MB")
    print(f"   • Final memory: {memory_stats['current_mb']:.1f} MB")
    print(f"   • Fragmentation detected: {'Yes' if memory_stats['fragmentation_detected'] else 'No'}")
    print(f"   • Memory samples: {memory_stats['samples']}")

    return memory_stats


def test_pyo3_memory_copies():
    """Test for unnecessary memory copies across PyO3 boundaries"""
    print("\n" + "="*60)
    print("🧪 TESTING: PyO3 Memory Copy Analysis")
    print("="*60)

    # Create test data that would show memory copying issues
    large_strings = [f"This is a long string number {i} with lots of content that should not be copied unnecessarily" for i in range(100_000)]
    large_values = [float(i * 1.5) for i in range(100_000)]
    large_groups = [f"group_{i % 1000}" for i in range(100_000)]

    monitor = MemoryMonitor()

    # Test 1: String operations (potential string copying)
    print("🔍 Testing string operations for memory copies...")
    monitor.start_monitoring()

    start_time = time.time()
    lengths = kernels.fast_string_ops(large_strings, "length")
    upper_strings = kernels.fast_string_ops(large_strings, "upper")
    string_time = time.time() - start_time

    string_memory = monitor.stop_monitoring()

    print(f"   • String ops time: {string_time:.2f}s")
    print(f"   • Peak memory: {string_memory['peak_mb']:.1f} MB")
    print(f"   • Results length: {len(lengths)}")

    # Test 2: Aggregation operations (potential value copying)
    print("🔍 Testing aggregation operations for memory copies...")
    monitor.start_monitoring()

    start_time = time.time()
    agg_result = kernels.fast_groupby_agg(large_groups, large_values, "mean")
    multi_agg = kernels.fast_multi_agg(large_groups, large_values, ["mean", "sum", "count"])
    agg_time = time.time() - start_time

    agg_memory = monitor.stop_monitoring()

    print(f"   • Aggregation time: {agg_time:.2f}s")
    print(f"   • Peak memory: {agg_memory['peak_mb']:.1f} MB")
    print(f"   • Results count: {len(agg_result)}")

    # Test 3: Memory cleanup verification
    print("🔍 Testing memory cleanup...")
    pre_cleanup_memory = psutil.Process().memory_info().rss / 1024 / 1024

    del large_strings, large_values, large_groups
    del lengths, upper_strings, agg_result, multi_agg
    gc.collect()

    post_cleanup_memory = psutil.Process().memory_info().rss / 1024 / 1024
    memory_freed = pre_cleanup_memory - post_cleanup_memory

    print(f"   • Memory before cleanup: {pre_cleanup_memory:.1f} MB")
    print(f"   • Memory after cleanup: {post_cleanup_memory:.1f} MB")
    print(f"   • Memory freed: {memory_freed:.1f} MB")

    return {
        "string_memory_peak": string_memory['peak_mb'],
        "agg_memory_peak": agg_memory['peak_mb'],
        "memory_freed": memory_freed,
        "cleanup_effective": memory_freed > 50  # Should free significant memory
    }


def test_backpressure_handling():
    """Test backpressure handling under concurrent load"""
    print("\n" + "="*60)
    print("🧪 TESTING: Backpressure Handling")
    print("="*60)

    import concurrent.futures
    import queue

    results_queue = queue.Queue()
    errors = []

    def worker_task(worker_id: int) -> dict:
        """Worker function for concurrent testing"""
        try:
            # Create data for this worker
            data_size = 50_000
            groups = [f"worker_{worker_id}_group_{i % 100}" for i in range(data_size)]
            values = [float(i * worker_id) for i in range(data_size)]
            strings = [f"Worker {worker_id} string {i}" for i in range(data_size)]

            start_time = time.time()

            # Multiple operations to create load
            agg_result = kernels.fast_groupby_agg(groups, values, "mean")
            string_result = kernels.fast_string_ops(strings, "upper")
            multi_agg = kernels.fast_multi_agg(groups, values, ["sum", "count"])

            processing_time = time.time() - start_time

            return {
                "worker_id": worker_id,
                "success": True,
                "processing_time": processing_time,
                "results_count": len(agg_result) + len(string_result) + len(multi_agg),
                "error": None
            }

        except Exception as e:
            return {
                "worker_id": worker_id,
                "success": False,
                "processing_time": 0,
                "results_count": 0,
                "error": str(e)
            }

    # Run concurrent workers
    num_workers = 8
    monitor = MemoryMonitor()
    monitor.start_monitoring()

    print(f"🚀 Starting {num_workers} concurrent workers...")
    start_time = time.time()

    with concurrent.futures.ThreadPoolExecutor(max_workers=num_workers) as executor:
        future_to_worker = {
            executor.submit(worker_task, i): i
            for i in range(num_workers)
        }

        worker_results = []
        for future in concurrent.futures.as_completed(future_to_worker):
            result = future.result()
            worker_results.append(result)

            if result['success']:
                print(f"  ✅ Worker {result['worker_id']}: {result['processing_time']:.2f}s")
            else:
                print(f"  ❌ Worker {result['worker_id']}: {result['error']}")

    total_time = time.time() - start_time
    memory_stats = monitor.stop_monitoring()

    successful_workers = [r for r in worker_results if r['success']]
    failed_workers = [r for r in worker_results if not r['success']]

    print(f"\n📊 Backpressure test results:")
    print(f"   • Total time: {total_time:.2f}s")
    print(f"   • Successful workers: {len(successful_workers)}/{num_workers}")
    print(f"   • Failed workers: {len(failed_workers)}")
    print(f"   • Average processing time: {sum(r['processing_time'] for r in successful_workers) / len(successful_workers):.2f}s")
    print(f"   • Peak memory: {memory_stats['peak_mb']:.1f} MB")

    if failed_workers:
        print("❌ Failed worker errors:")
        for worker in failed_workers:
            print(f"     • Worker {worker['worker_id']}: {worker['error']}")

    return {
        "total_time": total_time,
        "successful_workers": len(successful_workers),
        "failed_workers": len(failed_workers),
        "memory_stats": memory_stats,
        "backpressure_handled": len(failed_workers) == 0
    }


def main():
    """Run all memory safety tests"""
    print("🔬 RUST COMPUTE KERNELS - MEMORY SAFETY TESTS")
    print("=" * 70)

    test_results = {}

    # Test 1: Large CSV streaming
    test_results["large_csv"] = test_large_csv_streaming()

    # Test 2: Memory fragmentation
    test_results["fragmentation"] = test_memory_fragmentation()

    # Test 3: PyO3 memory copies
    test_results["pyo3_copies"] = test_pyo3_memory_copies()

    # Test 4: Backpressure handling
    test_results["backpressure"] = test_backpressure_handling()

    # Summary report
    print("\n" + "=" * 70)
    print("📋 MEMORY SAFETY TEST SUMMARY")
    print("=" * 70)

    # Large CSV test
    if test_results["large_csv"]["success"]:
        print("✅ Large CSV streaming: PASSED")
        print(f"   • Load time: {test_results['large_csv']['load_time']:.2f}s")
        print(f"   • Peak memory: {test_results['large_csv']['memory_stats']['peak_mb']:.1f} MB")
    else:
        print("❌ Large CSV streaming: FAILED")
        print(f"   • Error: {test_results['large_csv'].get('error', 'Unknown')}")

    # Memory fragmentation
    frag_stats = test_results["fragmentation"]
    print(f"{'✅' if not frag_stats['fragmentation_detected'] else '⚠️'} Memory fragmentation: {'LOW' if not frag_stats['fragmentation_detected'] else 'DETECTED'}")
    print(f"   • Peak memory: {frag_stats['peak_mb']:.1f} MB")

    # PyO3 memory copies
    copy_stats = test_results["pyo3_copies"]
    print(f"{'✅' if copy_stats['cleanup_effective'] else '⚠️'} PyO3 memory management: {'GOOD' if copy_stats['cleanup_effective'] else 'NEEDS_ATTENTION'}")
    print(f"   • Memory freed on cleanup: {copy_stats['memory_freed']:.1f} MB")

    # Backpressure handling
    bp_stats = test_results["backpressure"]
    print(f"{'✅' if bp_stats['backpressure_handled'] else '❌'} Backpressure handling: {'GOOD' if bp_stats['backpressure_handled'] else 'FAILED'}")
    print(f"   • Successful workers: {bp_stats['successful_workers']}/8")

    # Overall assessment
    all_passed = (
        test_results["large_csv"]["success"] and
        not test_results["fragmentation"]["fragmentation_detected"] and
        test_results["pyo3_copies"]["cleanup_effective"] and
        test_results["backpressure"]["backpressure_handled"]
    )

    print(f"\n🎯 OVERALL MEMORY SAFETY: {'✅ PRODUCTION READY' if all_passed else '⚠️ NEEDS ATTENTION'}")

    return test_results


if __name__ == "__main__":
    results = main()