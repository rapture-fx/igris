#!/usr/bin/env python3
"""
Test script for Rust compute kernels
"""

import schlep_compute_kernels as kernels
import tempfile
import os
import time

def test_csv_operations():
    """Test CSV reading functionality"""
    print("Testing CSV operations...")

    # Create a test CSV file
    test_data = """name,age,score,category
John,25,85.5,A
Jane,30,92.0,B
Bob,22,78.5,A
Alice,28,95.5,B
Charlie,35,88.0,A"""

    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        f.write(test_data)
        temp_path = f.name

    try:
        # Test CSV reading
        headers, data = kernels.fast_csv_read(temp_path)
        print(f"Headers: {headers}")
        print(f"Data rows: {len(data)}")
        print(f"First row: {data[0]}")

        # Test parallel CSV reading
        headers2, data2 = kernels.fast_csv_read_parallel(temp_path)
        print(f"Parallel reading - same results: {data == data2}")

    finally:
        os.unlink(temp_path)

def test_aggregations():
    """Test aggregation functionality"""
    print("\nTesting aggregation operations...")

    groups = ["A", "B", "A", "B", "A", "B"] * 1000
    values = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0] * 1000

    # Test single aggregation
    result = kernels.fast_groupby_agg(groups, values, "mean")
    print(f"Group means: {result}")

    # Test multi-aggregation
    agg_funcs = ["mean", "sum", "count", "min", "max"]
    multi_result = kernels.fast_multi_agg(groups, values, agg_funcs)
    print(f"Multi-agg results (first few): {dict(list(multi_result.items())[:5])}")

def test_string_operations():
    """Test string processing functionality"""
    print("\nTesting string operations...")

    strings = ["Hello World", "  PYTHON  ", "rust programming", "Data Science"] * 250

    # Test single operations
    lengths = kernels.fast_string_ops(strings, "length")
    print(f"String lengths (first 5): {lengths[:5]}")

    upper_strings = kernels.fast_string_ops(strings, "upper")
    print(f"Uppercase (first 2): {upper_strings[:2]}")

    contains_result = kernels.fast_string_ops(strings, "contains", "Python")
    print(f"Contains 'Python' (first 10): {contains_result[:10]}")

    # Test batch operations
    operations = ["length", "upper", "lower", "strip"]
    batch_result = kernels.fast_string_batch(strings, operations)
    print(f"Batch operations completed for {len(batch_result)} operations")

def test_data_cleaning():
    """Test data cleaning functionality"""
    print("\nTesting data cleaning operations...")

    dirty_data = [
        ["John", "25", "85.5", "A"],
        ["", "30", "null", "B"],
        ["Bob", "NA", "78.5", ""],
        ["Alice", "28", "95.5", "B"],
        ["Charlie", "", "88.0", "A"]
    ] * 100

    null_values = ["", "null", "NA", "None"]

    cleaned_data, column_types = kernels.fast_data_clean(dirty_data, null_values, True)
    print(f"Cleaned {len(cleaned_data)} rows")
    print(f"Inferred column types: {column_types}")
    print(f"Sample cleaned row: {cleaned_data[0]}")

def benchmark_performance():
    """Run performance benchmarks"""
    print("\nRunning performance benchmarks...")

    try:
        benchmarks = kernels.benchmark_kernels()
        print("Benchmark results (operations per second):")
        for operation, ops_per_sec in benchmarks.items():
            print(f"  {operation}: {ops_per_sec:,.0f}")
    except Exception as e:
        print(f"Benchmark failed: {e}")

def main():
    print("Testing Schlep Engine Rust Compute Kernels")
    print("=" * 50)

    # Get kernel info
    info = kernels.kernel_info()
    print(f"Kernel version: {info['version']}")
    print(f"Build profile: {info['build_profile']}")
    print(f"Thread count: {info['thread_count']}")
    print(f"Features: {info['features']}")
    print()

    # Run tests
    test_csv_operations()
    test_aggregations()
    test_string_operations()
    test_data_cleaning()
    benchmark_performance()

    print("\n" + "=" * 50)
    print("All tests completed successfully!")

if __name__ == "__main__":
    main()