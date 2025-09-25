#!/usr/bin/env python3
"""
Schlep Engine v2.0.0 - Comprehensive Performance Benchmark
Tests CSV ingestion, API performance, memory efficiency, and scalability
"""

import sys
import time
import psutil
import pandas as pd
import polars as pl
import numpy as np
import requests
import concurrent.futures
import tempfile
import os
from pathlib import Path
from typing import Dict, List, Any, Tuple
import json
from datetime import datetime
import threading
import queue
import random
import string

class ComprehensiveBenchmark:
    """Comprehensive performance benchmarking for Schlep Engine"""

    def __init__(self):
        self.results = {}
        self.test_data_dir = Path(tempfile.mkdtemp())
        self.api_base_url = "http://localhost:8000"

    def setup_large_datasets(self):
        """Create large test datasets for comprehensive testing"""
        print("📊 Creating Large Test Datasets...")

        datasets = {}

        # Small dataset (1MB) - for quick validation
        print("   Creating 1MB dataset...")
        small_data = self._generate_csv_data(10000, "small")
        small_path = self.test_data_dir / "small_1mb.csv"
        small_data.to_csv(small_path, index=False)
        datasets['small'] = {
            'path': small_path,
            'size_mb': small_path.stat().st_size / 1024 / 1024,
            'rows': 10000
        }

        # Medium dataset (100MB)
        print("   Creating 100MB dataset...")
        medium_data = self._generate_csv_data(1000000, "medium")
        medium_path = self.test_data_dir / "medium_100mb.csv"
        medium_data.to_csv(medium_path, index=False)
        datasets['medium'] = {
            'path': medium_path,
            'size_mb': medium_path.stat().st_size / 1024 / 1024,
            'rows': 1000000
        }

        # Large dataset (1GB)
        print("   Creating 1GB dataset...")
        large_data = self._generate_csv_data(10000000, "large")
        large_path = self.test_data_dir / "large_1gb.csv"
        large_data.to_csv(large_path, index=False)
        datasets['large'] = {
            'path': large_path,
            'size_mb': large_path.stat().st_size / 1024 / 1024,
            'rows': 10000000
        }

        # XLarge dataset (5GB) - chunk-based generation for memory efficiency
        print("   Creating 5GB dataset (chunked)...")
        xlarge_path = self.test_data_dir / "xlarge_5gb.csv"
        self._generate_large_csv_chunked(xlarge_path, 50000000)  # 50M rows
        datasets['xlarge'] = {
            'path': xlarge_path,
            'size_mb': xlarge_path.stat().st_size / 1024 / 1024,
            'rows': 50000000
        }

        self.datasets = datasets

        print("✅ Datasets created:")
        for name, info in datasets.items():
            print(f"   {name}: {info['size_mb']:.1f}MB ({info['rows']:,} rows)")

    def _generate_csv_data(self, num_rows: int, category: str) -> pd.DataFrame:
        """Generate realistic CSV data"""
        np.random.seed(42)  # For reproducible benchmarks

        data = {
            'id': range(1, num_rows + 1),
            'timestamp': pd.date_range('2024-01-01', periods=num_rows, freq='1s'),
            'category': [f'{category}_cat_{i%100}' for i in range(num_rows)],
            'subcategory': [f'sub_{i%20}' for i in range(num_rows)],
            'value': np.random.uniform(0, 10000, num_rows),
            'amount': np.random.uniform(1, 1000000, num_rows),
            'score': np.random.normal(50, 15, num_rows),
            'status': np.random.choice(['active', 'inactive', 'pending', 'completed'], num_rows),
            'description': [f'Description for item {i} with detailed information and metadata' for i in range(num_rows)],
            'tags': [f'tag1,tag2,tag{i%10}' for i in range(num_rows)]
        }

        return pd.DataFrame(data)

    def _generate_large_csv_chunked(self, file_path: Path, total_rows: int, chunk_size: int = 1000000):
        """Generate very large CSV files in chunks to avoid memory issues"""
        header_written = False

        with open(file_path, 'w') as f:
            for chunk_start in range(0, total_rows, chunk_size):
                chunk_end = min(chunk_start + chunk_size, total_rows)
                chunk_rows = chunk_end - chunk_start

                chunk_data = self._generate_csv_data(chunk_rows, "xlarge")

                # Write header only for first chunk
                chunk_data.to_csv(f, index=False, header=not header_written, mode='a')
                header_written = True

                # Progress indicator
                progress = (chunk_end / total_rows) * 100
                print(f"     Progress: {progress:.1f}% ({chunk_end:,}/{total_rows:,} rows)")

    def benchmark_csv_ingestion(self):
        """Benchmark CSV ingestion performance with different engines"""
        print("\n📈 Benchmarking CSV Ingestion Performance...")

        ingestion_results = {}

        for dataset_name, dataset_info in self.datasets.items():
            print(f"\n   Testing {dataset_name} dataset ({dataset_info['size_mb']:.1f}MB):")

            dataset_results = {
                'size_mb': dataset_info['size_mb'],
                'rows': dataset_info['rows']
            }

            # Pandas ingestion
            try:
                start_time = time.time()
                initial_memory = psutil.Process().memory_info().rss / 1024 / 1024

                pandas_df = pd.read_csv(dataset_info['path'])

                end_time = time.time()
                peak_memory = psutil.Process().memory_info().rss / 1024 / 1024

                pandas_time = end_time - start_time
                memory_used = peak_memory - initial_memory
                throughput = dataset_info['size_mb'] / pandas_time

                dataset_results['pandas'] = {
                    'time_seconds': pandas_time,
                    'memory_mb': memory_used,
                    'throughput_mb_per_sec': throughput,
                    'rows_per_second': dataset_info['rows'] / pandas_time
                }

                print(f"     Pandas: {pandas_time:.2f}s, {throughput:.1f}MB/s, {memory_used:.1f}MB memory")
                del pandas_df  # Free memory

            except Exception as e:
                print(f"     Pandas failed: {e}")
                dataset_results['pandas'] = {'error': str(e)}

            # Polars ingestion (if available)
            try:
                start_time = time.time()
                initial_memory = psutil.Process().memory_info().rss / 1024 / 1024

                polars_df = pl.read_csv(dataset_info['path'])

                end_time = time.time()
                peak_memory = psutil.Process().memory_info().rss / 1024 / 1024

                polars_time = end_time - start_time
                memory_used = peak_memory - initial_memory
                throughput = dataset_info['size_mb'] / polars_time

                dataset_results['polars'] = {
                    'time_seconds': polars_time,
                    'memory_mb': memory_used,
                    'throughput_mb_per_sec': throughput,
                    'rows_per_second': dataset_info['rows'] / polars_time
                }

                print(f"     Polars: {polars_time:.2f}s, {throughput:.1f}MB/s, {memory_used:.1f}MB memory")

                # Calculate speedup
                if 'pandas' in dataset_results and 'time_seconds' in dataset_results['pandas']:
                    speedup = dataset_results['pandas']['time_seconds'] / polars_time
                    print(f"     Polars speedup: {speedup:.2f}x")

                del polars_df  # Free memory

            except Exception as e:
                print(f"     Polars failed: {e}")
                dataset_results['polars'] = {'error': str(e)}

            ingestion_results[dataset_name] = dataset_results

        self.results['csv_ingestion'] = ingestion_results

    def benchmark_aggregation_operations(self):
        """Benchmark aggregation operations on different dataset sizes"""
        print("\n📊 Benchmarking Aggregation Operations...")

        aggregation_results = {}

        for dataset_name, dataset_info in self.datasets.items():
            if dataset_info['size_mb'] > 1000:  # Skip very large datasets for aggregation
                print(f"   Skipping {dataset_name} (too large for memory)")
                continue

            print(f"\n   Testing aggregations on {dataset_name} dataset:")

            # Load data
            try:
                df = pd.read_csv(dataset_info['path'])

                dataset_agg_results = {
                    'size_mb': dataset_info['size_mb'],
                    'rows': dataset_info['rows']
                }

                # GroupBy aggregation
                start_time = time.time()
                grouped = df.groupby('category')['value'].agg(['mean', 'sum', 'count', 'std'])
                groupby_time = time.time() - start_time

                dataset_agg_results['groupby'] = {
                    'time_seconds': groupby_time,
                    'groups_count': len(grouped),
                    'rows_per_second': dataset_info['rows'] / groupby_time
                }

                print(f"     GroupBy: {groupby_time:.3f}s, {len(grouped)} groups")

                # Pivot operations
                try:
                    start_time = time.time()
                    pivot = df.pivot_table(values='value', index='category', columns='status', aggfunc='mean', fill_value=0)
                    pivot_time = time.time() - start_time

                    dataset_agg_results['pivot'] = {
                        'time_seconds': pivot_time,
                        'shape': list(pivot.shape)
                    }

                    print(f"     Pivot: {pivot_time:.3f}s, shape {pivot.shape}")

                except Exception as e:
                    print(f"     Pivot failed: {e}")

                # String operations
                start_time = time.time()
                string_ops = df['description'].str.upper().str.contains('item', case=False)
                string_time = time.time() - start_time

                dataset_agg_results['string_ops'] = {
                    'time_seconds': string_time,
                    'operations_per_second': dataset_info['rows'] / string_time
                }

                print(f"     String ops: {string_time:.3f}s")

                aggregation_results[dataset_name] = dataset_agg_results
                del df

            except Exception as e:
                print(f"   Error processing {dataset_name}: {e}")
                aggregation_results[dataset_name] = {'error': str(e)}

        self.results['aggregations'] = aggregation_results

    def benchmark_memory_efficiency(self):
        """Benchmark memory usage patterns"""
        print("\n💾 Benchmarking Memory Efficiency...")

        memory_results = {}

        # Test memory usage with different chunk sizes
        test_file = self.datasets['medium']['path']  # 100MB file

        chunk_sizes = [10000, 50000, 100000, 500000]

        for chunk_size in chunk_sizes:
            print(f"   Testing chunk size: {chunk_size:,}")

            try:
                start_memory = psutil.Process().memory_info().rss / 1024 / 1024
                peak_memory = start_memory

                total_rows = 0
                start_time = time.time()

                for chunk in pd.read_csv(test_file, chunksize=chunk_size):
                    current_memory = psutil.Process().memory_info().rss / 1024 / 1024
                    peak_memory = max(peak_memory, current_memory)
                    total_rows += len(chunk)

                end_time = time.time()

                memory_results[f'chunk_{chunk_size}'] = {
                    'time_seconds': end_time - start_time,
                    'peak_memory_mb': peak_memory - start_memory,
                    'total_rows': total_rows,
                    'chunk_size': chunk_size
                }

                print(f"     Time: {end_time - start_time:.2f}s, Memory: {peak_memory - start_memory:.1f}MB")

            except Exception as e:
                print(f"     Chunk size {chunk_size} failed: {e}")

        self.results['memory_efficiency'] = memory_results

    def stress_test_large_datasets(self):
        """Stress test with very large datasets"""
        print("\n🔥 Stress Testing Large Datasets...")

        stress_results = {}

        # Test XLarge dataset processing
        xlarge_info = self.datasets['xlarge']
        print(f"   Processing {xlarge_info['size_mb']:.1f}MB dataset ({xlarge_info['rows']:,} rows)...")

        try:
            # Chunked processing approach
            start_time = time.time()
            start_memory = psutil.Process().memory_info().rss / 1024 / 1024
            peak_memory = start_memory

            total_sum = 0
            row_count = 0
            chunk_count = 0

            # Process in 1M row chunks
            for chunk in pd.read_csv(xlarge_info['path'], chunksize=1000000):
                current_memory = psutil.Process().memory_info().rss / 1024 / 1024
                peak_memory = max(peak_memory, current_memory)

                # Perform some aggregation
                total_sum += chunk['value'].sum()
                row_count += len(chunk)
                chunk_count += 1

                if chunk_count % 10 == 0:
                    progress = (row_count / xlarge_info['rows']) * 100
                    print(f"     Progress: {progress:.1f}% ({row_count:,}/{xlarge_info['rows']:,} rows)")

            end_time = time.time()
            processing_time = end_time - start_time
            memory_used = peak_memory - start_memory

            stress_results['xlarge_processing'] = {
                'time_seconds': processing_time,
                'memory_mb': memory_used,
                'throughput_mb_per_sec': xlarge_info['size_mb'] / processing_time,
                'rows_per_second': xlarge_info['rows'] / processing_time,
                'chunks_processed': chunk_count,
                'total_sum': total_sum
            }

            print(f"✅ Processed {xlarge_info['size_mb']:.1f}MB in {processing_time:.1f}s")
            print(f"   Throughput: {xlarge_info['size_mb'] / processing_time:.1f}MB/s")
            print(f"   Memory usage: {memory_used:.1f}MB")

        except Exception as e:
            print(f"❌ Stress test failed: {e}")
            stress_results['xlarge_processing'] = {'error': str(e)}

        self.results['stress_test'] = stress_results

    def cleanup(self):
        """Clean up test data"""
        import shutil
        try:
            shutil.rmtree(self.test_data_dir)
            print(f"🗑️  Cleaned up test data: {self.test_data_dir}")
        except Exception as e:
            print(f"⚠️  Cleanup warning: {e}")

    def generate_performance_report(self):
        """Generate comprehensive performance report"""
        print("\n📋 COMPREHENSIVE PERFORMANCE REPORT")
        print("=" * 60)

        # CSV Ingestion Summary
        csv_results = self.results.get('csv_ingestion', {})
        if csv_results:
            print("📈 CSV Ingestion Performance:")
            for dataset, results in csv_results.items():
                if 'pandas' in results and 'time_seconds' in results['pandas']:
                    pandas_throughput = results['pandas']['throughput_mb_per_sec']
                    print(f"   {dataset}: {pandas_throughput:.1f}MB/s (Pandas)")

                    if 'polars' in results and 'time_seconds' in results['polars']:
                        polars_throughput = results['polars']['throughput_mb_per_sec']
                        speedup = results['pandas']['time_seconds'] / results['polars']['time_seconds']
                        print(f"   {dataset}: {polars_throughput:.1f}MB/s (Polars, {speedup:.1f}x faster)")

        # Aggregation Summary
        agg_results = self.results.get('aggregations', {})
        if agg_results:
            print("\n📊 Aggregation Performance:")
            for dataset, results in agg_results.items():
                if 'groupby' in results:
                    groupby_rps = results['groupby']['rows_per_second']
                    print(f"   {dataset}: {groupby_rps:,.0f} rows/sec (GroupBy)")

        # Memory Efficiency Summary
        memory_results = self.results.get('memory_efficiency', {})
        if memory_results:
            print("\n💾 Memory Efficiency:")
            for chunk_name, results in memory_results.items():
                chunk_size = results['chunk_size']
                memory_mb = results['peak_memory_mb']
                print(f"   Chunk {chunk_size:,}: {memory_mb:.1f}MB peak memory")

        # Stress Test Summary
        stress_results = self.results.get('stress_test', {})
        if stress_results and 'xlarge_processing' in stress_results:
            xl_results = stress_results['xlarge_processing']
            if 'throughput_mb_per_sec' in xl_results:
                throughput = xl_results['throughput_mb_per_sec']
                memory = xl_results['memory_mb']
                print(f"\n🔥 Stress Test (5GB dataset): {throughput:.1f}MB/s, {memory:.1f}MB memory")

        print("\n" + "=" * 60)

        # Save detailed results
        report_file = self.test_data_dir.parent / "performance_report.json"
        with open(report_file, 'w') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'version': '2.0.0',
                'results': self.results
            }, f, indent=2)

        print(f"📊 Detailed report saved: {report_file}")

        return self.results

def main():
    """Main benchmark function"""
    print("🚀 Schlep Engine v2.0.0 - Comprehensive Performance Benchmark")
    print("=" * 70)

    benchmark = ComprehensiveBenchmark()

    try:
        # Run all benchmarks
        benchmark.setup_large_datasets()
        benchmark.benchmark_csv_ingestion()
        benchmark.benchmark_aggregation_operations()
        benchmark.benchmark_memory_efficiency()
        benchmark.stress_test_large_datasets()

        # Generate report
        results = benchmark.generate_performance_report()

        return results

    except KeyboardInterrupt:
        print("\n⚠️  Benchmark interrupted by user")
        return None

    except Exception as e:
        print(f"❌ Benchmark failed: {e}")
        import traceback
        traceback.print_exc()
        return None

    finally:
        benchmark.cleanup()

if __name__ == "__main__":
    results = main()
    sys.exit(0 if results else 1)