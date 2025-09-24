#!/usr/bin/env python3
"""
Quick Memory Safety Tests for Production Readiness
"""

import os
import sys
import time
import psutil
import gc

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/..")

try:
    import schlep_compute_kernels as kernels
except ImportError:
    print("❌ Rust kernels not built. Run 'maturin develop' first.")
    sys.exit(1)


def test_memory_cleanup():
    """Test that memory is properly cleaned up after operations"""
    print("🧪 Testing PyO3 memory cleanup...")

    # Get baseline memory
    process = psutil.Process()
    baseline_memory = process.memory_info().rss / 1024 / 1024

    # Create large data structures
    large_strings = [f"String {i} with content" for i in range(100_000)]
    large_values = [float(i * 1.5) for i in range(100_000)]
    large_groups = [f"group_{i % 1000}" for i in range(100_000)]

    # Run operations
    lengths = kernels.fast_string_ops(large_strings, "length")
    agg_result = kernels.fast_groupby_agg(large_groups, large_values, "mean")

    # Check peak memory
    peak_memory = process.memory_info().rss / 1024 / 1024

    # Clean up
    del large_strings, large_values, large_groups
    del lengths, agg_result
    gc.collect()

    # Check final memory
    final_memory = process.memory_info().rss / 1024 / 1024
    memory_freed = peak_memory - final_memory

    print(f"   • Baseline: {baseline_memory:.1f} MB")
    print(f"   • Peak: {peak_memory:.1f} MB")
    print(f"   • Final: {final_memory:.1f} MB")
    print(f"   • Memory freed: {memory_freed:.1f} MB")

    # Memory should be mostly freed (at least 50MB for this test)
    cleanup_effective = memory_freed > 50
    print(f"   • Cleanup effective: {'✅ Yes' if cleanup_effective else '❌ No'}")

    return cleanup_effective


def test_concurrent_safety():
    """Test thread safety under concurrent load"""
    print("🧪 Testing concurrent thread safety...")

    import concurrent.futures

    def worker_task(worker_id):
        """Worker function"""
        try:
            groups = [f"worker_{worker_id}_group_{i % 100}" for i in range(10_000)]
            values = [float(i * worker_id) for i in range(10_000)]

            result = kernels.fast_groupby_agg(groups, values, "mean")
            return {"success": True, "results": len(result), "worker_id": worker_id}
        except Exception as e:
            return {"success": False, "error": str(e), "worker_id": worker_id}

    # Run 4 workers concurrently
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(worker_task, i) for i in range(4)]
        results = [future.result() for future in futures]

    successful = sum(1 for r in results if r["success"])
    print(f"   • Successful workers: {successful}/4")

    if successful < 4:
        for r in results:
            if not r["success"]:
                print(f"     • Worker {r['worker_id']} failed: {r['error']}")

    return successful == 4


def test_large_data_handling():
    """Test handling of moderately large data"""
    print("🧪 Testing large data handling...")

    process = psutil.Process()
    start_memory = process.memory_info().rss / 1024 / 1024

    # Create 1M records (moderate size)
    start_time = time.time()

    groups = [f"group_{i % 10000}" for i in range(1_000_000)]
    values = [float(i) for i in range(1_000_000)]

    # Test aggregation
    result = kernels.fast_groupby_agg(groups, values, "mean")

    processing_time = time.time() - start_time
    peak_memory = process.memory_info().rss / 1024 / 1024
    memory_used = peak_memory - start_memory

    print(f"   • Processing time: {processing_time:.2f}s")
    print(f"   • Memory used: {memory_used:.1f} MB")
    print(f"   • Result groups: {len(result)}")

    # Should process 1M records in reasonable time and memory
    performance_ok = processing_time < 5.0 and memory_used < 500
    print(f"   • Performance acceptable: {'✅ Yes' if performance_ok else '❌ No'}")

    return performance_ok


def main():
    """Run quick memory safety tests"""
    print("🔬 QUICK MEMORY SAFETY VALIDATION")
    print("=" * 50)

    tests = [
        ("Memory Cleanup", test_memory_cleanup),
        ("Concurrent Safety", test_concurrent_safety),
        ("Large Data Handling", test_large_data_handling)
    ]

    results = {}

    for test_name, test_func in tests:
        print(f"\n{test_name}:")
        try:
            results[test_name] = test_func()
        except Exception as e:
            print(f"❌ Test failed with exception: {e}")
            results[test_name] = False

    print("\n" + "=" * 50)
    print("📋 QUICK TEST SUMMARY")
    print("=" * 50)

    all_passed = True
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name}: {status}")
        all_passed = all_passed and passed

    print(f"\n🎯 OVERALL: {'✅ PRODUCTION READY' if all_passed else '⚠️ NEEDS ATTENTION'}")

    return all_passed


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)