#!/usr/bin/env python3
"""
Python integration example for Rust module
"""

import time
import numpy as np
import pandas as pd
from typing import Dict, List, Any

try:
    # Import the Rust module (after building with maturin)
    import schlep_rust
    RUST_AVAILABLE = True
except ImportError:
    RUST_AVAILABLE = False
    print("⚠️  Rust module not available. Install with: maturin develop")

def benchmark_pandas_vs_rust(size: int = 100_000) -> Dict[str, Any]:
    """Benchmark pandas vs Rust performance"""
    print(f"🏁 Benchmarking with {size:,} rows...")

    # Create test data
    np.random.seed(42)
    data = np.random.randn(size)
    data[::1000] = np.nan  # Add some NaN values

    results = {}

    # Pandas fillna benchmark
    start_time = time.time()
    pandas_result = pd.Series(data).fillna(0.0).values
    pandas_time = time.time() - start_time
    results['pandas_fillna_seconds'] = pandas_time

    if RUST_AVAILABLE:
        # Rust fillna benchmark
        start_time = time.time()
        rust_result = schlep_rust.fast_fillna(data.tolist(), 0.0)
        rust_time = time.time() - start_time
        results['rust_fillna_seconds'] = rust_time
        results['fillna_speedup'] = pandas_time / rust_time if rust_time > 0 else 0

        print(f"  📊 fillna: Pandas {pandas_time:.4f}s, Rust {rust_time:.4f}s")
        print(f"  🚀 Speedup: {results['fillna_speedup']:.2f}x faster")
    else:
        print(f"  📊 fillna: Pandas {pandas_time:.4f}s")

    return results

def benchmark_groupby_operations(size: int = 100_000) -> Dict[str, Any]:
    """Benchmark groupby operations"""
    print(f"\n📊 Benchmarking groupby with {size:,} rows...")

    # Create test data
    np.random.seed(42)
    groups = np.random.randint(0, 100, size)
    values = np.random.randn(size)
    df = pd.DataFrame({'group': groups, 'value': values})

    results = {}

    # Pandas groupby benchmark
    start_time = time.time()
    pandas_result = df.groupby('group')['value'].mean()
    pandas_time = time.time() - start_time
    results['pandas_groupby_seconds'] = pandas_time

    if RUST_AVAILABLE:
        # Rust groupby benchmark
        start_time = time.time()
        rust_result = schlep_rust.fast_groupby_mean(groups.tolist(), values.tolist())
        rust_time = time.time() - start_time
        results['rust_groupby_seconds'] = rust_time
        results['groupby_speedup'] = pandas_time / rust_time if rust_time > 0 else 0

        print(f"  📊 groupby: Pandas {pandas_time:.4f}s, Rust {rust_time:.4f}s")
        print(f"  🚀 Speedup: {results['groupby_speedup']:.2f}x faster")
    else:
        print(f"  📊 groupby: Pandas {pandas_time:.4f}s")

    return results

def demonstrate_rust_integration():
    """Demonstrate Rust integration capabilities"""
    print("🦀 RUST INTEGRATION DEMONSTRATION")
    print("=" * 60)

    if not RUST_AVAILABLE:
        print("❌ Rust module not available.")
        print("To build and install:")
        print("1. Install Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh")
        print("2. Install maturin: pip install maturin")
        print("3. Build module: cd schlep_rust_module && maturin develop")
        return

    # Run benchmarks
    small_results = benchmark_pandas_vs_rust(10_000)
    small_groupby = benchmark_groupby_operations(10_000)

    large_results = benchmark_pandas_vs_rust(1_000_000)
    large_groupby = benchmark_groupby_operations(1_000_000)

    # Summary
    print("\n📋 PERFORMANCE SUMMARY")
    print("=" * 40)

    if 'fillna_speedup' in large_results:
        print(f"fillna (1M rows): {large_results['fillna_speedup']:.2f}x faster")
    if 'groupby_speedup' in large_groupby:
        print(f"groupby (1M rows): {large_groupby['groupby_speedup']:.2f}x faster")

    # Rust-specific benchmarks
    print("\n🚀 Running Rust internal benchmarks...")
    if RUST_AVAILABLE:
        rust_benchmarks = schlep_rust.benchmark_operations()
        print(f"Rust fillna (1M rows): {rust_benchmarks['rust_fillna_seconds']:.4f}s")
        print(f"Rust groupby (1M rows): {rust_benchmarks['rust_groupby_seconds']:.4f}s")

if __name__ == "__main__":
    demonstrate_rust_integration()