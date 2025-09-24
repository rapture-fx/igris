#!/usr/bin/env python3
"""
Comprehensive Performance Benchmark Suite for Hybrid Python + Rust Architecture
===============================================================================

Benchmarks Python (pandas) vs Polars vs Rust implementations to validate
the hybrid architecture performance claims and guide optimization decisions.

Based on audit results:
- Polars: 5.45x average speedup potential
- Rust: 10x+ targeted gains expected
"""

import time
import os
import sys
import tempfile
import json
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import psutil
import gc
from contextlib import contextmanager
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class HybridPerformanceBenchmark:
    """Comprehensive benchmark suite for hybrid Python + Rust architecture"""

    def __init__(self, output_dir: str = "benchmark_results"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)

        # Engine availability
        self.pandas_available = True
        self.polars_available = self._check_polars()
        self.rust_available = self._check_rust()

        # Benchmark configuration
        self.dataset_sizes = {
            'small': 1_000,
            'medium': 50_000,
            'large': 200_000,
            'xlarge': 1_000_000
        }

        self.results = {
            'metadata': {
                'timestamp': datetime.now().isoformat(),
                'system_info': self._get_system_info(),
                'engines_available': {
                    'pandas': self.pandas_available,
                    'polars': self.polars_available,
                    'rust': self.rust_available
                }
            },
            'benchmarks': {}
        }

    def _check_polars(self) -> bool:
        """Check if Polars is available"""
        try:
            import polars as pl
            logger.info(f"✅ Polars {pl.__version__} available")
            return True
        except ImportError:
            logger.warning("❌ Polars not available - install with: pip install polars")
            return False

    def _check_rust(self) -> bool:
        """Check if Rust kernels are available"""
        try:
            # Try to import the Rust kernels we would create
            import schlep_rust_kernels
            logger.info("✅ Rust kernels available")
            return True
        except ImportError:
            logger.info("ℹ️  Rust kernels not available (expected for initial benchmarks)")
            return False

    def _get_system_info(self) -> Dict[str, Any]:
        """Get system information for benchmark context"""
        return {
            'cpu_count': psutil.cpu_count(),
            'cpu_freq': psutil.cpu_freq()._asdict() if psutil.cpu_freq() else None,
            'memory_total_gb': round(psutil.virtual_memory().total / (1024**3), 2),
            'python_version': sys.version,
            'platform': sys.platform
        }

    @contextmanager
    def _measure_performance(self, operation_name: str):
        """Context manager to measure execution time and memory usage"""
        process = psutil.Process()

        # Initial measurements
        start_memory = process.memory_info().rss / 1024 / 1024  # MB
        start_time = time.perf_counter()

        try:
            yield
        finally:
            # Final measurements
            end_time = time.perf_counter()
            end_memory = process.memory_info().rss / 1024 / 1024  # MB

            execution_time = end_time - start_time
            memory_used = max(0, end_memory - start_memory)

            logger.info(f"   {operation_name}: {execution_time:.3f}s, {memory_used:.1f}MB")

    def create_test_datasets(self) -> Dict[str, str]:
        """Create test datasets for benchmarking"""
        logger.info("📊 Creating benchmark datasets...")

        datasets = {}

        for size_name, num_rows in self.dataset_sizes.items():
            # Generate realistic data similar to Schlep-engine use cases
            np.random.seed(42)  # Reproducible results

            if size_name == 'small':
                # Customer/user data pattern
                data = pd.DataFrame({
                    'id': range(num_rows),
                    'name': [f"User_{i}" for i in range(num_rows)],
                    'email': [f"user{i}@{'gmail' if i % 2 else 'yahoo'}.com" for i in range(num_rows)],
                    'category': np.random.choice(['A', 'B', 'C', 'D'], num_rows),
                    'value': np.random.exponential(50, num_rows),
                    'score': np.random.normal(75, 15, num_rows),
                    'created_at': pd.date_range('2023-01-01', periods=num_rows, freq='1H')
                })
            else:
                # Transaction/event data pattern (more realistic for large datasets)
                data = pd.DataFrame({
                    'transaction_id': range(num_rows),
                    'user_id': np.random.randint(1, num_rows // 100, num_rows),
                    'product_id': np.random.randint(1, 1000, num_rows),
                    'category': np.random.choice(['electronics', 'books', 'clothing', 'home', 'sports'], num_rows),
                    'subcategory': np.random.choice([f'sub_{i}' for i in range(20)], num_rows),
                    'amount': np.random.exponential(25, num_rows),
                    'quantity': np.random.randint(1, 10, num_rows),
                    'discount': np.random.uniform(0, 0.3, num_rows),
                    'timestamp': pd.date_range('2023-01-01', periods=num_rows, freq='1min'),
                    'location': np.random.choice(['US', 'EU', 'ASIA', 'OTHER'], num_rows),
                    'device': np.random.choice(['mobile', 'desktop', 'tablet'], num_rows)
                })

            # Add realistic data quality issues
            missing_rate = min(0.1, 1000 / num_rows)
            num_missing = int(num_rows * missing_rate)

            # Add missing values
            for col in ['value', 'score', 'amount'][:len([c for c in data.columns if c in ['value', 'score', 'amount']])]:
                if col in data.columns and num_missing > 0:
                    missing_idx = np.random.choice(num_rows, min(num_missing, num_rows), replace=False)
                    data.loc[missing_idx, col] = np.nan

            # Add outliers
            for col in data.select_dtypes(include=[np.number]).columns:
                outlier_count = max(1, num_rows // 1000)
                outlier_idx = np.random.choice(num_rows, outlier_count, replace=False)
                data.loc[outlier_idx, col] = data[col].mean() + 5 * data[col].std()

            # Save dataset
            temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False)
            data.to_csv(temp_file.name, index=False)
            temp_file.close()

            datasets[size_name] = temp_file.name
            file_size_mb = os.path.getsize(temp_file.name) / 1024 / 1024
            logger.info(f"   Created {size_name}: {num_rows:,} rows, {file_size_mb:.1f}MB")

        return datasets

    def benchmark_csv_reading(self, datasets: Dict[str, str]) -> Dict[str, Any]:
        """Benchmark CSV reading performance across engines"""
        logger.info("📖 Benchmarking CSV reading performance...")

        results = {}

        for dataset_name, file_path in datasets.items():
            dataset_results = {
                'dataset_size': self.dataset_sizes[dataset_name],
                'file_size_mb': os.path.getsize(file_path) / 1024 / 1024,
                'engines': {}
            }

            # Pandas baseline
            if self.pandas_available:
                with self._measure_performance(f"pandas read_csv ({dataset_name})"):
                    start_time = time.perf_counter()
                    df_pandas = pd.read_csv(file_path)
                    pandas_time = time.perf_counter() - start_time

                dataset_results['engines']['pandas'] = {
                    'time': pandas_time,
                    'rows': len(df_pandas),
                    'throughput_rows_per_sec': len(df_pandas) / pandas_time,
                    'throughput_mb_per_sec': dataset_results['file_size_mb'] / pandas_time
                }

                # Cleanup
                del df_pandas
                gc.collect()

            # Polars comparison
            if self.polars_available:
                import polars as pl

                with self._measure_performance(f"polars read_csv ({dataset_name})"):
                    start_time = time.perf_counter()
                    df_polars = pl.read_csv(file_path)
                    polars_time = time.perf_counter() - start_time

                dataset_results['engines']['polars'] = {
                    'time': polars_time,
                    'rows': len(df_polars),
                    'throughput_rows_per_sec': len(df_polars) / polars_time,
                    'throughput_mb_per_sec': dataset_results['file_size_mb'] / polars_time
                }

                # Calculate speedup vs pandas
                if 'pandas' in dataset_results['engines']:
                    speedup = dataset_results['engines']['pandas']['time'] / polars_time
                    dataset_results['engines']['polars']['speedup_vs_pandas'] = speedup

                # Cleanup
                del df_polars
                gc.collect()

            # Rust comparison (if available)
            if self.rust_available:
                import schlep_rust_kernels as rust

                with self._measure_performance(f"rust read_csv ({dataset_name})"):
                    start_time = time.perf_counter()
                    df_rust = rust.fast_csv_read(file_path)
                    rust_time = time.perf_counter() - start_time

                dataset_results['engines']['rust'] = {
                    'time': rust_time,
                    'rows': len(df_rust[0]) if df_rust else 0,
                    'throughput_rows_per_sec': len(df_rust[0]) / rust_time if df_rust and rust_time > 0 else 0,
                    'throughput_mb_per_sec': dataset_results['file_size_mb'] / rust_time if rust_time > 0 else 0
                }

                # Calculate speedup vs pandas
                if 'pandas' in dataset_results['engines']:
                    speedup = dataset_results['engines']['pandas']['time'] / rust_time
                    dataset_results['engines']['rust']['speedup_vs_pandas'] = speedup

            results[dataset_name] = dataset_results

        return results

    def benchmark_aggregations(self, datasets: Dict[str, str]) -> Dict[str, Any]:
        """Benchmark aggregation operations"""
        logger.info("🔢 Benchmarking aggregation performance...")

        results = {}

        for dataset_name, file_path in datasets.items():
            logger.info(f"   Processing {dataset_name} dataset...")

            dataset_results = {
                'dataset_size': self.dataset_sizes[dataset_name],
                'engines': {}
            }

            # Load data first (common for all engines)
            df_pandas = pd.read_csv(file_path)

            # Pandas aggregations
            if self.pandas_available:
                with self._measure_performance(f"pandas aggregations ({dataset_name})"):
                    start_time = time.perf_counter()

                    # Complex aggregation similar to real workloads
                    if 'category' in df_pandas.columns:
                        pandas_agg = df_pandas.groupby('category').agg({
                            col: ['mean', 'std', 'count', 'min', 'max']
                            for col in df_pandas.select_dtypes(include=[np.number]).columns[:3]
                        })
                    else:
                        pandas_agg = df_pandas.select_dtypes(include=[np.number]).agg(['mean', 'std', 'count'])

                    pandas_time = time.perf_counter() - start_time

                dataset_results['engines']['pandas'] = {
                    'time': pandas_time,
                    'operations_per_sec': df_pandas.shape[0] / pandas_time,
                    'aggregation_result_size': pandas_agg.shape if hasattr(pandas_agg, 'shape') else len(pandas_agg)
                }

            # Polars aggregations
            if self.polars_available:
                import polars as pl
                df_polars = pl.from_pandas(df_pandas)

                with self._measure_performance(f"polars aggregations ({dataset_name})"):
                    start_time = time.perf_counter()

                    numeric_cols = [col for col in df_polars.columns
                                  if df_polars[col].dtype in [pl.Float64, pl.Float32, pl.Int64, pl.Int32]][:3]

                    if 'category' in df_polars.columns and numeric_cols:
                        polars_agg = df_polars.group_by('category').agg([
                            pl.col(col).mean().alias(f'{col}_mean'),
                            pl.col(col).std().alias(f'{col}_std'),
                            pl.col(col).count().alias(f'{col}_count'),
                            pl.col(col).min().alias(f'{col}_min'),
                            pl.col(col).max().alias(f'{col}_max')
                            for col in numeric_cols
                        ])
                    else:
                        polars_agg = df_polars.select([
                            pl.col(col).mean().alias(f'{col}_mean')
                            for col in numeric_cols
                        ])

                    polars_time = time.perf_counter() - start_time

                dataset_results['engines']['polars'] = {
                    'time': polars_time,
                    'operations_per_sec': df_pandas.shape[0] / polars_time,
                    'aggregation_result_size': polars_agg.shape if hasattr(polars_agg, 'shape') else len(polars_agg)
                }

                # Speedup calculation
                if 'pandas' in dataset_results['engines']:
                    speedup = dataset_results['engines']['pandas']['time'] / polars_time
                    dataset_results['engines']['polars']['speedup_vs_pandas'] = speedup

            # Rust aggregations (if available)
            if self.rust_available:
                import schlep_rust_kernels as rust

                # Convert to format expected by Rust
                if 'category' in df_pandas.columns:
                    groups = df_pandas['category'].astype(str).tolist()
                    numeric_cols = df_pandas.select_dtypes(include=[np.number]).columns
                    if len(numeric_cols) > 0:
                        values = df_pandas[numeric_cols[0]].fillna(0).tolist()

                        with self._measure_performance(f"rust aggregations ({dataset_name})"):
                            start_time = time.perf_counter()
                            rust_agg = rust.fast_groupby_mean(groups, values)
                            rust_time = time.perf_counter() - start_time

                        dataset_results['engines']['rust'] = {
                            'time': rust_time,
                            'operations_per_sec': df_pandas.shape[0] / rust_time,
                            'aggregation_result_size': len(rust_agg) if rust_agg else 0
                        }

                        if 'pandas' in dataset_results['engines']:
                            speedup = dataset_results['engines']['pandas']['time'] / rust_time
                            dataset_results['engines']['rust']['speedup_vs_pandas'] = speedup

            results[dataset_name] = dataset_results

            # Cleanup
            del df_pandas
            if 'df_polars' in locals():
                del df_polars
            gc.collect()

        return results

    def benchmark_string_operations(self, datasets: Dict[str, str]) -> Dict[str, Any]:
        """Benchmark string processing operations"""
        logger.info("📝 Benchmarking string operations...")

        results = {}

        for dataset_name, file_path in datasets.items():
            # Skip largest dataset for string operations to avoid excessive runtime
            if dataset_name == 'xlarge':
                continue

            logger.info(f"   Processing {dataset_name} dataset...")

            dataset_results = {
                'dataset_size': self.dataset_sizes[dataset_name],
                'engines': {}
            }

            # Load data
            df_pandas = pd.read_csv(file_path)
            string_cols = df_pandas.select_dtypes(include=['object']).columns.tolist()[:2]  # First 2 string columns

            if not string_cols:
                continue

            # Pandas string operations
            if self.pandas_available:
                with self._measure_performance(f"pandas string ops ({dataset_name})"):
                    start_time = time.perf_counter()

                    for col in string_cols:
                        df_pandas[f'{col}_length'] = df_pandas[col].astype(str).str.len()
                        df_pandas[f'{col}_upper'] = df_pandas[col].astype(str).str.upper()
                        df_pandas[f'{col}_contains_a'] = df_pandas[col].astype(str).str.contains('a', na=False)

                    pandas_time = time.perf_counter() - start_time

                dataset_results['engines']['pandas'] = {
                    'time': pandas_time,
                    'operations_per_sec': len(df_pandas) * len(string_cols) * 3 / pandas_time,  # 3 ops per column
                    'columns_processed': len(string_cols)
                }

            # Polars string operations
            if self.polars_available:
                import polars as pl
                df_polars = pl.from_pandas(df_pandas[string_cols])  # Just string columns

                with self._measure_performance(f"polars string ops ({dataset_name})"):
                    start_time = time.perf_counter()

                    expressions = []
                    for col in string_cols:
                        expressions.extend([
                            pl.col(col).str.len().alias(f'{col}_length'),
                            pl.col(col).str.to_uppercase().alias(f'{col}_upper'),
                            pl.col(col).str.contains('a').alias(f'{col}_contains_a')
                        ])

                    df_polars_result = df_polars.with_columns(expressions)
                    polars_time = time.perf_counter() - start_time

                dataset_results['engines']['polars'] = {
                    'time': polars_time,
                    'operations_per_sec': len(df_polars) * len(string_cols) * 3 / polars_time,
                    'columns_processed': len(string_cols)
                }

                if 'pandas' in dataset_results['engines']:
                    speedup = dataset_results['engines']['pandas']['time'] / polars_time
                    dataset_results['engines']['polars']['speedup_vs_pandas'] = speedup

            # Rust string operations (if available)
            if self.rust_available:
                import schlep_rust_kernels as rust

                for col in string_cols:
                    string_data = df_pandas[col].astype(str).tolist()

                    with self._measure_performance(f"rust string ops ({dataset_name})"):
                        start_time = time.perf_counter()
                        rust_results = rust.fast_string_operations(string_data)
                        rust_time = time.perf_counter() - start_time

                    dataset_results['engines']['rust'] = {
                        'time': rust_time,
                        'operations_per_sec': len(string_data) * 3 / rust_time,  # 3 operations
                        'columns_processed': len(string_cols)
                    }

                    if 'pandas' in dataset_results['engines']:
                        speedup = dataset_results['engines']['pandas']['time'] / rust_time
                        dataset_results['engines']['rust']['speedup_vs_pandas'] = speedup

                    break  # Just test one column for Rust

            results[dataset_name] = dataset_results

            # Cleanup
            del df_pandas
            if 'df_polars' in locals():
                del df_polars
            gc.collect()

        return results

    def benchmark_memory_efficiency(self, datasets: Dict[str, str]) -> Dict[str, Any]:
        """Benchmark memory usage patterns"""
        logger.info("🧠 Benchmarking memory efficiency...")

        results = {}

        for dataset_name, file_path in datasets.items():
            logger.info(f"   Analyzing {dataset_name} dataset memory usage...")

            dataset_results = {
                'dataset_size': self.dataset_sizes[dataset_name],
                'file_size_mb': os.path.getsize(file_path) / 1024 / 1024,
                'engines': {}
            }

            process = psutil.Process()

            # Pandas memory usage
            if self.pandas_available:
                baseline_memory = process.memory_info().rss / 1024 / 1024

                df_pandas = pd.read_csv(file_path)
                peak_memory = process.memory_info().rss / 1024 / 1024

                memory_per_row = df_pandas.memory_usage(deep=True).sum() / len(df_pandas) / 1024  # KB per row

                dataset_results['engines']['pandas'] = {
                    'memory_growth_mb': peak_memory - baseline_memory,
                    'memory_per_row_kb': memory_per_row,
                    'memory_efficiency_ratio': dataset_results['file_size_mb'] / (peak_memory - baseline_memory) if peak_memory > baseline_memory else 0
                }

                del df_pandas
                gc.collect()

            # Polars memory usage
            if self.polars_available:
                import polars as pl

                baseline_memory = process.memory_info().rss / 1024 / 1024

                df_polars = pl.read_csv(file_path)
                peak_memory = process.memory_info().rss / 1024 / 1024

                # Estimate memory per row for Polars
                memory_per_row_estimate = (peak_memory - baseline_memory) * 1024 / len(df_polars)  # KB per row

                dataset_results['engines']['polars'] = {
                    'memory_growth_mb': peak_memory - baseline_memory,
                    'memory_per_row_kb': memory_per_row_estimate,
                    'memory_efficiency_ratio': dataset_results['file_size_mb'] / (peak_memory - baseline_memory) if peak_memory > baseline_memory else 0
                }

                # Compare with pandas
                if 'pandas' in dataset_results['engines']:
                    memory_improvement = dataset_results['engines']['pandas']['memory_growth_mb'] / dataset_results['engines']['polars']['memory_growth_mb']
                    dataset_results['engines']['polars']['memory_improvement_vs_pandas'] = memory_improvement

                del df_polars
                gc.collect()

            results[dataset_name] = dataset_results

        return results

    def run_comprehensive_benchmark(self) -> Dict[str, Any]:
        """Run all benchmarks and generate comprehensive report"""
        logger.info("🚀 Starting Comprehensive Hybrid Architecture Benchmark")
        logger.info("=" * 70)

        # Create test datasets
        datasets = self.create_test_datasets()

        try:
            # Run benchmark suite
            benchmark_results = {}

            # CSV reading (highest impact - 72.8% CPU time)
            benchmark_results['csv_reading'] = self.benchmark_csv_reading(datasets)

            # Aggregations (14.4% CPU time impact)
            benchmark_results['aggregations'] = self.benchmark_aggregations(datasets)

            # String operations
            benchmark_results['string_operations'] = self.benchmark_string_operations(datasets)

            # Memory efficiency
            benchmark_results['memory_usage'] = self.benchmark_memory_efficiency(datasets)

            # Store results
            self.results['benchmarks'] = benchmark_results

            # Generate analysis and recommendations
            self.results['analysis'] = self._analyze_results()
            self.results['recommendations'] = self._generate_recommendations()

            # Save detailed results
            self._save_results()

            # Print summary
            self._print_summary()

            return self.results

        finally:
            # Cleanup test datasets
            for file_path in datasets.values():
                try:
                    os.unlink(file_path)
                except:
                    pass

    def _analyze_results(self) -> Dict[str, Any]:
        """Analyze benchmark results and extract insights"""
        analysis = {
            'performance_gains': {},
            'memory_improvements': {},
            'engine_recommendations': {},
            'bottleneck_analysis': {}
        }

        benchmarks = self.results['benchmarks']

        # Analyze performance gains
        for benchmark_type, results in benchmarks.items():
            gains = {'polars': [], 'rust': []}

            for dataset_name, dataset_results in results.items():
                engines = dataset_results.get('engines', {})

                if 'polars' in engines and 'speedup_vs_pandas' in engines['polars']:
                    gains['polars'].append(engines['polars']['speedup_vs_pandas'])

                if 'rust' in engines and 'speedup_vs_pandas' in engines['rust']:
                    gains['rust'].append(engines['rust']['speedup_vs_pandas'])

            if gains['polars']:
                analysis['performance_gains'][f'{benchmark_type}_polars'] = {
                    'average_speedup': sum(gains['polars']) / len(gains['polars']),
                    'max_speedup': max(gains['polars']),
                    'min_speedup': min(gains['polars'])
                }

            if gains['rust']:
                analysis['performance_gains'][f'{benchmark_type}_rust'] = {
                    'average_speedup': sum(gains['rust']) / len(gains['rust']),
                    'max_speedup': max(gains['rust']),
                    'min_speedup': min(gains['rust'])
                }

        # Overall recommendations
        polars_gains = [v['average_speedup'] for k, v in analysis['performance_gains'].items() if 'polars' in k]
        rust_gains = [v['average_speedup'] for k, v in analysis['performance_gains'].items() if 'rust' in k]

        if polars_gains:
            avg_polars_gain = sum(polars_gains) / len(polars_gains)
            analysis['engine_recommendations']['polars'] = {
                'recommended': avg_polars_gain > 1.5,
                'average_gain': avg_polars_gain,
                'priority': 'HIGH' if avg_polars_gain > 3.0 else 'MEDIUM' if avg_polars_gain > 1.5 else 'LOW'
            }

        if rust_gains:
            avg_rust_gain = sum(rust_gains) / len(rust_gains)
            analysis['engine_recommendations']['rust'] = {
                'recommended': avg_rust_gain > 5.0,
                'average_gain': avg_rust_gain,
                'priority': 'HIGH' if avg_rust_gain > 10.0 else 'MEDIUM' if avg_rust_gain > 5.0 else 'LOW'
            }

        return analysis

    def _generate_recommendations(self) -> Dict[str, Any]:
        """Generate actionable recommendations based on benchmark results"""
        analysis = self.results['analysis']
        recommendations = {
            'immediate_actions': [],
            'implementation_priority': [],
            'architecture_decisions': {},
            'performance_targets': {}
        }

        # Polars recommendations
        polars_rec = analysis['engine_recommendations'].get('polars')
        if polars_rec and polars_rec['recommended']:
            recommendations['immediate_actions'].append({
                'action': 'Migrate to Polars',
                'priority': polars_rec['priority'],
                'expected_gain': f"{polars_rec['average_gain']:.1f}x speedup",
                'implementation_time': '2-4 weeks'
            })

        # Rust recommendations
        rust_rec = analysis['engine_recommendations'].get('rust')
        if rust_rec and rust_rec['recommended']:
            recommendations['immediate_actions'].append({
                'action': 'Implement Rust compute kernels',
                'priority': rust_rec['priority'],
                'expected_gain': f"{rust_rec['average_gain']:.1f}x additional speedup",
                'implementation_time': '4-8 weeks'
            })

        # Architecture decisions
        if polars_rec and rust_rec:
            if polars_rec['average_gain'] > 3.0 and rust_rec['average_gain'] > 10.0:
                recommendations['architecture_decisions']['strategy'] = 'HYBRID_APPROACH'
                recommendations['architecture_decisions']['rationale'] = 'Both Polars and Rust show significant gains'
            elif polars_rec['average_gain'] > 3.0:
                recommendations['architecture_decisions']['strategy'] = 'POLARS_FIRST'
                recommendations['architecture_decisions']['rationale'] = 'Polars provides substantial immediate gains'
        elif polars_rec and polars_rec['average_gain'] > 2.0:
            recommendations['architecture_decisions']['strategy'] = 'POLARS_MIGRATION'
            recommendations['architecture_decisions']['rationale'] = 'Polars shows clear performance benefits'

        return recommendations

    def _save_results(self):
        """Save benchmark results to file"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        # Save detailed JSON results
        results_file = self.output_dir / f"hybrid_benchmark_results_{timestamp}.json"
        with open(results_file, 'w') as f:
            json.dump(self.results, f, indent=2, default=str)

        # Save human-readable summary
        summary_file = self.output_dir / f"hybrid_benchmark_summary_{timestamp}.md"
        with open(summary_file, 'w') as f:
            f.write(self._generate_markdown_summary())

        logger.info(f"📄 Results saved:")
        logger.info(f"   Detailed: {results_file}")
        logger.info(f"   Summary: {summary_file}")

    def _generate_markdown_summary(self) -> str:
        """Generate markdown summary report"""
        analysis = self.results['analysis']

        summary = f"""# Hybrid Architecture Performance Benchmark Results

**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## System Information
- CPU: {self.results['metadata']['system_info']['cpu_count']} cores
- Memory: {self.results['metadata']['system_info']['memory_total_gb']} GB
- Platform: {self.results['metadata']['system_info']['platform']}

## Engines Tested
- Pandas: {'✅' if self.pandas_available else '❌'}
- Polars: {'✅' if self.polars_available else '❌'}
- Rust: {'✅' if self.rust_available else '❌'}

## Performance Gains Summary

### Polars vs Pandas
"""

        polars_gains = analysis.get('performance_gains', {})
        for benchmark, gains in polars_gains.items():
            if 'polars' in benchmark:
                summary += f"- **{benchmark.replace('_polars', '').title()}**: {gains['average_speedup']:.2f}x average speedup (max: {gains['max_speedup']:.2f}x)\n"

        if 'rust' in str(polars_gains):
            summary += "\n### Rust vs Pandas\n"
            for benchmark, gains in polars_gains.items():
                if 'rust' in benchmark:
                    summary += f"- **{benchmark.replace('_rust', '').title()}**: {gains['average_speedup']:.2f}x average speedup (max: {gains['max_speedup']:.2f}x)\n"

        # Recommendations
        recommendations = self.results.get('recommendations', {})
        if recommendations:
            summary += "\n## Recommendations\n\n"
            for action in recommendations.get('immediate_actions', []):
                summary += f"- **{action['action']}** (Priority: {action['priority']})\n"
                summary += f"  - Expected gain: {action['expected_gain']}\n"
                summary += f"  - Implementation time: {action['implementation_time']}\n\n"

        return summary

    def _print_summary(self):
        """Print benchmark summary to console"""
        logger.info("\n" + "=" * 70)
        logger.info("🎉 BENCHMARK RESULTS SUMMARY")
        logger.info("=" * 70)

        analysis = self.results['analysis']

        # Print performance gains
        polars_gains = [v['average_speedup'] for k, v in analysis.get('performance_gains', {}).items() if 'polars' in k]
        rust_gains = [v['average_speedup'] for k, v in analysis.get('performance_gains', {}).items() if 'rust' in k]

        if polars_gains:
            avg_polars = sum(polars_gains) / len(polars_gains)
            logger.info(f"📈 Polars average speedup: {avg_polars:.2f}x")

        if rust_gains:
            avg_rust = sum(rust_gains) / len(rust_gains)
            logger.info(f"🦀 Rust average speedup: {avg_rust:.2f}x")

        # Print recommendations
        recommendations = self.results.get('recommendations', {})
        strategy = recommendations.get('architecture_decisions', {}).get('strategy')
        if strategy:
            logger.info(f"🎯 Recommended strategy: {strategy}")

        logger.info(f"📁 Detailed results saved in: {self.output_dir}/")
        logger.info("=" * 70)

def main():
    """Main execution function"""
    import argparse

    parser = argparse.ArgumentParser(description='Benchmark Hybrid Python + Rust Architecture Performance')
    parser.add_argument('--output-dir', default='benchmark_results',
                        help='Directory to save results')
    parser.add_argument('--quick', action='store_true',
                        help='Run quick benchmark (smaller datasets)')

    args = parser.parse_args()

    # Create benchmark instance
    benchmark = HybridPerformanceBenchmark(args.output_dir)

    # Modify dataset sizes for quick run
    if args.quick:
        benchmark.dataset_sizes = {
            'small': 1_000,
            'medium': 10_000,
            'large': 50_000
        }
        logger.info("🚀 Running quick benchmark with smaller datasets")

    # Run comprehensive benchmark
    results = benchmark.run_comprehensive_benchmark()

    # Return summary statistics
    analysis = results.get('analysis', {})
    polars_gains = [v['average_speedup'] for k, v in analysis.get('performance_gains', {}).items() if 'polars' in k]

    return {
        'polars_speedup': sum(polars_gains) / len(polars_gains) if polars_gains else 1.0,
        'recommendation': results.get('recommendations', {}).get('architecture_decisions', {}).get('strategy', 'CONTINUE_ANALYSIS')
    }

if __name__ == "__main__":
    main()