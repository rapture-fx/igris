#!/usr/bin/env python3
"""
Test the new Pythonic API
"""

import sys
import os
sys.path.insert(0, "/Users/wira/Desktop/schlep-engine/apps/api")

import schlep_engine
import tempfile
import csv

def test_api():
    print("🧪 Testing Schlep Engine Pythonic API")
    print("=" * 50)

    # Check kernel info
    info = schlep_engine.core.get_kernel_info()
    print(f"Rust kernels available: {info['rust_kernels_available']}")
    print(f"Performance mode: {info['configuration']['performance_mode']}")

    # Create test CSV
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        writer = csv.writer(f)
        writer.writerow(['id', 'name', 'value', 'category'])
        for i in range(1000):
            writer.writerow([i, f'Name{i}', i * 1.5, f'Cat{i % 5}'])
        temp_path = f.name

    try:
        # Test CSV reading
        print("\n📁 Testing CSV reading...")
        df = schlep_engine.read_csv_fast(temp_path)
        print(f"  Loaded {len(df)} rows, {len(df.columns)} columns")

        # Test aggregation
        print("\n🔢 Testing aggregation...")
        agg_result = schlep_engine.aggregate_data(
            df, "category", "value", "mean"
        )
        print(f"  Aggregated {len(agg_result)} groups")

        # Test string processing
        print("\n🔤 Testing string processing...")
        strings = df['name'].tolist()[:100]
        lengths = schlep_engine.process_strings(strings, "length")
        print(f"  Processed {len(lengths)} strings")

        # Test monitoring
        print("\n📊 Testing monitoring...")
        metrics = schlep_engine.get_performance_metrics()
        print(f"  Tracked operations: {metrics.get('total_operations', 0)}")

        print("\n✅ API tests completed successfully!")

    finally:
        os.unlink(temp_path)

if __name__ == "__main__":
    test_api()