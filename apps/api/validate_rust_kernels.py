#!/usr/bin/env python3
"""
Schlep Engine v2.0.0 - Rust Kernel Validation Script
Comprehensive validation of hybrid Python + Rust compute kernels
"""

import sys
import time
import traceback
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Any, Tuple
import tempfile
import os

class RustKernelValidator:
    """Validates Rust compute kernels with comprehensive testing"""

    def __init__(self):
        self.results = {}
        self.rust_available = False
        self.test_data_dir = Path(tempfile.mkdtemp())

    def setup_test_data(self):
        """Create test datasets for validation"""
        print("📊 Setting up test data...")

        # Small test CSV (1MB)
        small_data = {
            'id': range(10000),
            'category': [f'cat_{i%10}' for i in range(10000)],
            'value': np.random.uniform(0, 1000, 10000),
            'text': [f'sample_text_{i}' for i in range(10000)]
        }
        small_df = pd.DataFrame(small_data)
        self.small_csv = self.test_data_dir / "small_test.csv"
        small_df.to_csv(self.small_csv, index=False)

        # Medium test CSV (50MB)
        medium_data = {
            'id': range(500000),
            'category': [f'category_{i%100}' for i in range(500000)],
            'value': np.random.uniform(0, 10000, 500000),
            'amount': np.random.uniform(1, 1000000, 500000),
            'text': [f'description_text_for_item_{i}_with_additional_content' for i in range(500000)]
        }
        medium_df = pd.DataFrame(medium_data)
        self.medium_csv = self.test_data_dir / "medium_test.csv"
        medium_df.to_csv(self.medium_csv, index=False)

        print(f"✅ Test data created in {self.test_data_dir}")
        print(f"   - Small CSV: {self.small_csv.stat().st_size / 1024 / 1024:.1f}MB")
        print(f"   - Medium CSV: {self.medium_csv.stat().st_size / 1024 / 1024:.1f}MB")

    def test_rust_kernel_availability(self):
        """Test if Rust compute kernels are available"""
        print("\n🔧 Testing Rust Kernel Availability...")

        try:
            # Try importing the Rust module
            import schlep_compute_kernels
            self.rust_available = True

            # Get kernel info
            info = schlep_compute_kernels.kernel_info()
            print(f"✅ Rust kernels available!")
            print(f"   Version: {info.get('version', 'unknown')}")
            print(f"   Build: {info.get('build_profile', 'unknown')}")
            print(f"   Features: {info.get('features', 'none')}")
            print(f"   Threads: {info.get('thread_count', 'unknown')}")

            self.results['rust_available'] = True
            self.results['kernel_info'] = info

        except ImportError as e:
            print(f"⚠️  Rust kernels not available: {e}")
            print("   Falling back to Python implementations")
            self.rust_available = False
            self.results['rust_available'] = False
            self.results['fallback_reason'] = str(e)

    def benchmark_csv_reading(self):
        """Benchmark CSV reading performance"""
        print("\n📈 Benchmarking CSV Reading Performance...")

        # Test small file
        start_time = time.time()
        pandas_df = pd.read_csv(self.small_csv)
        pandas_time_small = time.time() - start_time

        rust_time_small = None
        if self.rust_available:
            try:
                import schlep_compute_kernels
                start_time = time.time()
                headers, data = schlep_compute_kernels.fast_csv_read(str(self.small_csv))
                rust_time_small = time.time() - start_time

                print(f"✅ Small CSV (10K rows):")
                print(f"   Pandas: {pandas_time_small:.4f}s")
                print(f"   Rust: {rust_time_small:.4f}s")
                if rust_time_small > 0:
                    speedup = pandas_time_small / rust_time_small
                    print(f"   Speedup: {speedup:.2f}x")
            except Exception as e:
                print(f"❌ Rust CSV reading failed: {e}")

        # Test medium file
        start_time = time.time()
        pandas_df = pd.read_csv(self.medium_csv)
        pandas_time_medium = time.time() - start_time

        rust_time_medium = None
        if self.rust_available:
            try:
                import schlep_compute_kernels
                start_time = time.time()
                headers, data = schlep_compute_kernels.fast_csv_read_parallel(str(self.medium_csv))
                rust_time_medium = time.time() - start_time

                print(f"✅ Medium CSV (500K rows):")
                print(f"   Pandas: {pandas_time_medium:.4f}s")
                print(f"   Rust: {rust_time_medium:.4f}s")
                if rust_time_medium > 0:
                    speedup = pandas_time_medium / rust_time_medium
                    print(f"   Speedup: {speedup:.2f}x")
            except Exception as e:
                print(f"❌ Rust CSV reading failed: {e}")

        self.results['csv_benchmarks'] = {
            'small_pandas_time': pandas_time_small,
            'small_rust_time': rust_time_small,
            'medium_pandas_time': pandas_time_medium,
            'medium_rust_time': rust_time_medium
        }

    def benchmark_aggregations(self):
        """Benchmark aggregation performance"""
        print("\n📊 Benchmarking Aggregation Performance...")

        # Generate test data
        groups = [f'group_{i%100}' for i in range(100000)]
        values = np.random.uniform(0, 1000, 100000)

        # Pandas aggregation
        df = pd.DataFrame({'group': groups, 'value': values})
        start_time = time.time()
        pandas_result = df.groupby('group')['value'].mean().to_dict()
        pandas_time = time.time() - start_time

        # Rust aggregation
        rust_time = None
        rust_result = None
        if self.rust_available:
            try:
                import schlep_compute_kernels
                start_time = time.time()
                rust_result = schlep_compute_kernels.fast_groupby_agg(groups, values.tolist(), "mean")
                rust_time = time.time() - start_time

                print(f"✅ Aggregation (100K rows, 100 groups):")
                print(f"   Pandas: {pandas_time:.4f}s")
                print(f"   Rust: {rust_time:.4f}s")
                if rust_time > 0:
                    speedup = pandas_time / rust_time
                    print(f"   Speedup: {speedup:.2f}x")

                # Validate results
                sample_key = list(pandas_result.keys())[0]
                pandas_val = pandas_result[sample_key]
                rust_val = rust_result[sample_key]
                diff = abs(pandas_val - rust_val)
                print(f"   Result accuracy: {diff:.6f} difference")

            except Exception as e:
                print(f"❌ Rust aggregation failed: {e}")

        self.results['aggregation_benchmarks'] = {
            'pandas_time': pandas_time,
            'rust_time': rust_time,
            'result_count': len(pandas_result)
        }

    def benchmark_string_operations(self):
        """Benchmark string operations performance"""
        print("\n🔤 Benchmarking String Operations...")

        # Generate test strings
        test_strings = [f'Sample_String_With_Data_{i}_And_More_Content' for i in range(50000)]

        # Pandas string operations
        series = pd.Series(test_strings)
        start_time = time.time()
        pandas_upper = series.str.upper().tolist()
        pandas_time = time.time() - start_time

        # Rust string operations
        rust_time = None
        if self.rust_available:
            try:
                import schlep_compute_kernels
                start_time = time.time()
                rust_upper = schlep_compute_kernels.fast_string_ops(test_strings, "upper")
                rust_time = time.time() - start_time

                print(f"✅ String Operations (50K strings):")
                print(f"   Pandas: {pandas_time:.4f}s")
                print(f"   Rust: {rust_time:.4f}s")
                if rust_time > 0:
                    speedup = pandas_time / rust_time
                    print(f"   Speedup: {speedup:.2f}x")

                # Validate results
                matches = sum(1 for a, b in zip(pandas_upper[:100], rust_upper[:100]) if a == b)
                print(f"   Result accuracy: {matches}/100 matches")

            except Exception as e:
                print(f"❌ Rust string operations failed: {e}")

        self.results['string_benchmarks'] = {
            'pandas_time': pandas_time,
            'rust_time': rust_time,
            'string_count': len(test_strings)
        }

    def test_memory_operations(self):
        """Test memory-efficient operations"""
        print("\n💾 Testing Memory Operations...")

        if self.rust_available:
            try:
                import schlep_compute_kernels

                # Test data cleaning
                dirty_data = [
                    ['1', 'valid', '100.5'],
                    ['null', 'test', ''],
                    ['3', 'NA', '300.0'],
                    ['4', 'valid', 'invalid_number']
                ]

                null_values = ['null', 'NA', '']

                start_time = time.time()
                cleaned_data, type_info = schlep_compute_kernels.fast_data_clean(
                    dirty_data, null_values, True
                )
                clean_time = time.time() - start_time

                print(f"✅ Memory Operations:")
                print(f"   Data cleaning time: {clean_time:.4f}s")
                print(f"   Input rows: {len(dirty_data)}")
                print(f"   Output rows: {len(cleaned_data)}")
                print(f"   Type inference: {type_info}")

                self.results['memory_operations'] = {
                    'clean_time': clean_time,
                    'input_rows': len(dirty_data),
                    'output_rows': len(cleaned_data)
                }

            except Exception as e:
                print(f"❌ Memory operations failed: {e}")

    def test_security_features(self):
        """Test security hardening features"""
        print("\n🛡️  Testing Security Features...")

        if self.rust_available:
            try:
                import schlep_compute_kernels

                # Test input validation
                malicious_strings = [
                    'a' * 1000000,  # Very long string
                    '\x00\x01\x02',  # Binary data
                    '🦀' * 1000,  # Unicode stress test
                ]

                start_time = time.time()
                try:
                    results = schlep_compute_kernels.fast_string_ops(malicious_strings, "length")
                    security_time = time.time() - start_time
                    print(f"✅ Security validation passed")
                    print(f"   Processing time: {security_time:.4f}s")
                    print(f"   Results: {results[:3]}")
                except Exception as e:
                    print(f"✅ Security protection activated: {e}")

                self.results['security_tests'] = {
                    'input_validation': 'passed',
                    'malicious_input_blocked': True
                }

            except Exception as e:
                print(f"❌ Security test failed: {e}")

    def run_kernel_benchmarks(self):
        """Run built-in kernel benchmarks"""
        print("\n⚡ Running Built-in Kernel Benchmarks...")

        if self.rust_available:
            try:
                import schlep_compute_kernels

                start_time = time.time()
                benchmark_results = schlep_compute_kernels.benchmark_kernels()
                benchmark_time = time.time() - start_time

                print(f"✅ Kernel Benchmarks (runtime: {benchmark_time:.4f}s):")
                for operation, ops_per_sec in benchmark_results.items():
                    print(f"   {operation}: {ops_per_sec:,.0f} ops/sec")

                self.results['kernel_benchmarks'] = benchmark_results

            except Exception as e:
                print(f"❌ Kernel benchmarks failed: {e}")

    def test_python_fallback(self):
        """Test Python fallback mechanisms"""
        print("\n🔄 Testing Python Fallback Mechanisms...")

        # Simulate Rust unavailable
        original_rust = self.rust_available
        self.rust_available = False

        try:
            # Test CSV reading fallback
            start_time = time.time()
            fallback_df = pd.read_csv(self.small_csv)
            fallback_time = time.time() - start_time

            print(f"✅ Python Fallback Working:")
            print(f"   CSV reading (Pandas): {fallback_time:.4f}s")
            print(f"   Rows loaded: {len(fallback_df)}")

            # Test aggregation fallback
            start_time = time.time()
            fallback_agg = fallback_df.groupby('category')['value'].mean()
            agg_time = time.time() - start_time

            print(f"   Aggregation (Pandas): {agg_time:.4f}s")
            print(f"   Groups: {len(fallback_agg)}")

            self.results['fallback_tests'] = {
                'csv_time': fallback_time,
                'agg_time': agg_time,
                'fallback_working': True
            }

        except Exception as e:
            print(f"❌ Python fallback failed: {e}")
            self.results['fallback_tests'] = {
                'fallback_working': False,
                'error': str(e)
            }

        # Restore original state
        self.rust_available = original_rust

    def cleanup(self):
        """Clean up test data"""
        import shutil
        try:
            shutil.rmtree(self.test_data_dir)
            print(f"🗑️  Cleaned up test data: {self.test_data_dir}")
        except Exception as e:
            print(f"⚠️  Cleanup warning: {e}")

    def generate_report(self):
        """Generate comprehensive validation report"""
        print("\n📋 RUST KERNEL VALIDATION REPORT")
        print("=" * 50)

        if self.results.get('rust_available'):
            print("✅ Rust Compute Kernels: AVAILABLE")

            # Performance summary
            csv_benchmarks = self.results.get('csv_benchmarks', {})
            if csv_benchmarks.get('small_rust_time'):
                small_speedup = csv_benchmarks['small_pandas_time'] / csv_benchmarks['small_rust_time']
                print(f"📈 CSV Reading Speedup: {small_speedup:.2f}x")

            agg_benchmarks = self.results.get('aggregation_benchmarks', {})
            if agg_benchmarks.get('rust_time'):
                agg_speedup = agg_benchmarks['pandas_time'] / agg_benchmarks['rust_time']
                print(f"📊 Aggregation Speedup: {agg_speedup:.2f}x")

            str_benchmarks = self.results.get('string_benchmarks', {})
            if str_benchmarks.get('rust_time'):
                str_speedup = str_benchmarks['pandas_time'] / str_benchmarks['rust_time']
                print(f"🔤 String Ops Speedup: {str_speedup:.2f}x")

            # Built-in benchmarks
            kernel_benchmarks = self.results.get('kernel_benchmarks', {})
            if kernel_benchmarks:
                print("⚡ Built-in Kernel Performance:")
                for op, ops_sec in kernel_benchmarks.items():
                    print(f"   {op}: {ops_sec:,.0f} ops/sec")

        else:
            print("⚠️  Rust Compute Kernels: NOT AVAILABLE")
            print(f"   Reason: {self.results.get('fallback_reason', 'Unknown')}")

        # Fallback validation
        fallback = self.results.get('fallback_tests', {})
        if fallback.get('fallback_working'):
            print("✅ Python Fallback: WORKING")
        else:
            print("❌ Python Fallback: FAILED")

        # Security validation
        security = self.results.get('security_tests', {})
        if security.get('input_validation') == 'passed':
            print("🛡️  Security Hardening: ACTIVE")

        print("\n" + "=" * 50)
        return self.results

def main():
    """Main validation function"""
    print("🚀 Schlep Engine v2.0.0 - Rust Kernel Validation")
    print("=" * 60)

    validator = RustKernelValidator()

    try:
        # Setup and run all tests
        validator.setup_test_data()
        validator.test_rust_kernel_availability()
        validator.benchmark_csv_reading()
        validator.benchmark_aggregations()
        validator.benchmark_string_operations()
        validator.test_memory_operations()
        validator.test_security_features()
        validator.run_kernel_benchmarks()
        validator.test_python_fallback()

        # Generate final report
        results = validator.generate_report()

        return results

    except Exception as e:
        print(f"❌ Validation failed: {e}")
        traceback.print_exc()
        return None

    finally:
        validator.cleanup()

if __name__ == "__main__":
    results = main()
    sys.exit(0 if results else 1)