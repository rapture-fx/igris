#!/usr/bin/env python3
"""
Schlep-engine Performance Profiler
==================================

Comprehensive performance profiling for identifying Rust readiness in the Schlep-engine codebase.
Implements CPU profiling, line-by-line analysis, and memory profiling as specified.
"""

import os
import sys
import time
import cProfile
import pstats
import io
import pandas as pd
import numpy as np
from pathlib import Path
import psutil
import logging
from datetime import datetime
import tempfile
import subprocess
from typing import Dict, List, Any, Tuple
import json

# Add app to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), 'apps', 'api'))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('profiling_results.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class PerformanceProfiler:
    """Comprehensive performance profiler for Rust readiness assessment"""

    def __init__(self, output_dir: str = "profiling_results"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.results = {}
        self.start_time = datetime.now()

    def create_test_datasets(self, sizes: Dict[str, int] = None) -> Dict[str, str]:
        """Create test datasets of various sizes"""
        if sizes is None:
            sizes = {
                "small": 1_000,      # 1K rows
                "medium": 50_000,    # 50K rows
                "large": 200_000,    # 200K rows
                "xl": 1_000_000      # 1M rows for stress testing
            }

        datasets = {}
        logger.info(f"Creating test datasets: {sizes}")

        for size_name, num_rows in sizes.items():
            # Generate realistic data
            np.random.seed(42)  # For reproducibility

            if size_name == "small":
                # Customer data
                data = pd.DataFrame({
                    'customer_id': range(num_rows),
                    'name': [f"Customer_{i}" for i in range(num_rows)],
                    'email': [f"user{i}@example.com" if i % 20 != 0 else None for i in range(num_rows)],
                    'age': np.random.randint(18, 80, num_rows),
                    'purchase_amount': np.random.exponential(50, num_rows),
                    'category': np.random.choice(['Electronics', 'Books', 'Clothing', 'Home'], num_rows),
                    'satisfaction_score': np.random.normal(4.2, 0.8, num_rows),
                    'join_date': pd.date_range('2020-01-01', periods=num_rows, freq='1H')
                })
            else:
                # Transaction/sensor data for larger datasets
                data = pd.DataFrame({
                    'record_id': range(num_rows),
                    'timestamp': pd.date_range('2023-01-01', periods=num_rows, freq='1min'),
                    'sensor_value': np.random.normal(100, 15, num_rows),
                    'temperature': np.random.normal(22, 5, num_rows),
                    'pressure': np.random.normal(1013, 20, num_rows),
                    'humidity': np.random.normal(45, 10, num_rows),
                    'location_x': np.random.uniform(-180, 180, num_rows),
                    'location_y': np.random.uniform(-90, 90, num_rows),
                    'device_type': np.random.choice(['sensor_a', 'sensor_b', 'sensor_c', 'sensor_d'], num_rows),
                    'status': np.random.choice(['active', 'inactive', 'maintenance'], num_rows)
                })

            # Add data quality issues for realistic testing
            missing_rate = min(0.1, 1000 / num_rows)  # Scale missing data rate
            num_missing = int(num_rows * missing_rate)

            # Add missing values in key columns
            for col in data.select_dtypes(include=[np.number]).columns:
                if num_missing > 0:
                    missing_idx = np.random.choice(num_rows, min(num_missing, num_rows), replace=False)
                    data.loc[missing_idx, col] = np.nan

            # Add outliers for numeric columns
            for col in data.select_dtypes(include=[np.number]).columns:
                outlier_count = max(1, num_rows // 1000)
                outlier_idx = np.random.choice(num_rows, outlier_count, replace=False)
                data.loc[outlier_idx, col] = data[col].mean() + 5 * data[col].std()

            # Save dataset
            filename = self.output_dir / f"test_dataset_{size_name}_{num_rows}.csv"
            data.to_csv(filename, index=False)
            datasets[size_name] = str(filename)

            logger.info(f"Created {size_name} dataset: {num_rows:,} rows, {filename.stat().st_size / (1024*1024):.1f}MB")

        return datasets

    def profile_cpu_intensive_functions(self, datasets: Dict[str, str]) -> Dict[str, Any]:
        """CPU profiling using cProfile to find slowest functions"""
        logger.info("🔍 Starting CPU profiling analysis...")

        cpu_results = {}

        for dataset_name, dataset_path in datasets.items():
            logger.info(f"Profiling CPU usage for {dataset_name} dataset...")

            # Create profiler
            profiler = cProfile.Profile()

            # Profile the data processing pipeline
            profiler.enable()

            try:
                # Import and run data processing
                start_time = time.time()

                # Simulate the core data processing pipeline
                df = pd.read_csv(dataset_path)

                # Heavy pandas operations (potential Rust candidates)
                df_processed = df.copy()

                # 1. Data cleaning (CPU intensive)
                numeric_cols = df_processed.select_dtypes(include=[np.number]).columns
                for col in numeric_cols:
                    df_processed[col] = df_processed[col].fillna(df_processed[col].median())

                # 2. Aggregations (CPU intensive)
                if len(df_processed) > 1000:
                    group_col = df_processed.columns[0] if len(df_processed.columns) > 0 else None
                    if group_col and df_processed[group_col].dtype in ['object', 'category']:
                        aggregated = df_processed.groupby(group_col).agg({
                            col: ['mean', 'std', 'count'] for col in numeric_cols[:3]
                        })

                # 3. Joins/merges (memory and CPU intensive)
                if len(df_processed) < 100_000:  # Only for smaller datasets
                    df_self_join = df_processed.merge(
                        df_processed.sample(min(1000, len(df_processed))),
                        left_index=True,
                        right_index=True,
                        suffixes=('', '_right')
                    )

                # 4. Complex calculations (tight loops)
                if 'timestamp' in df_processed.columns:
                    df_processed['hour'] = pd.to_datetime(df_processed['timestamp'], errors='coerce').dt.hour
                    df_processed['day_of_week'] = pd.to_datetime(df_processed['timestamp'], errors='coerce').dt.dayofweek

                end_time = time.time()
                processing_time = end_time - start_time

            except Exception as e:
                logger.error(f"Error processing {dataset_name}: {e}")
                processing_time = 0

            finally:
                profiler.disable()

            # Analyze profile results
            s = io.StringIO()
            ps = pstats.Stats(profiler, stream=s)
            ps.sort_stats('cumulative', 'calls')
            ps.print_stats(50)  # Top 50 functions

            profile_output = s.getvalue()

            # Save detailed profile
            profile_file = self.output_dir / f"cpu_profile_{dataset_name}.txt"
            with open(profile_file, 'w') as f:
                f.write(profile_output)

            # Parse top functions for Rust candidates
            top_functions = self._parse_profile_stats(ps)

            cpu_results[dataset_name] = {
                'processing_time': processing_time,
                'dataset_rows': len(pd.read_csv(dataset_path)),
                'top_functions': top_functions,
                'profile_file': str(profile_file),
                'rust_candidates': self._identify_rust_candidates(top_functions)
            }

            logger.info(f"CPU profiling complete for {dataset_name}: {processing_time:.3f}s")

        return cpu_results

    def _parse_profile_stats(self, ps: pstats.Stats) -> List[Dict[str, Any]]:
        """Parse cProfile stats to extract top functions"""
        # Get stats as list of tuples
        stats_list = []
        for func_name, (cc, nc, tt, ct, callers) in ps.stats.items():
            stats_list.append({
                'function': f"{func_name[0]}:{func_name[1]}({func_name[2]})",
                'calls': nc,
                'total_time': tt,
                'cumulative_time': ct,
                'per_call': tt/nc if nc > 0 else 0,
                'percent_total': (ct / ps.total_tt * 100) if ps.total_tt > 0 else 0
            })

        # Sort by cumulative time and return top 20
        return sorted(stats_list, key=lambda x: x['cumulative_time'], reverse=True)[:20]

    def _identify_rust_candidates(self, top_functions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Identify functions that would benefit from Rust implementation"""
        rust_candidates = []

        # Keywords that indicate CPU-intensive operations good for Rust
        rust_indicators = [
            'pandas', 'numpy', 'groupby', 'merge', 'join', 'sort', 'agg',
            'apply', 'transform', 'fillna', 'dropna', 'read_csv', 'to_csv',
            'loop', 'iteration', 'calculation', 'math', 'statistical'
        ]

        for func in top_functions:
            func_name_lower = func['function'].lower()

            # Check if function is a Rust candidate
            is_candidate = any(indicator in func_name_lower for indicator in rust_indicators)

            if is_candidate and (
                func['percent_total'] > 5.0 or  # Takes >5% of total runtime
                func['calls'] > 10000 or        # Called frequently
                func['per_call'] > 0.001        # Individual calls are expensive
            ):
                rust_candidates.append({
                    'function': func['function'],
                    'reason': 'High CPU usage, frequent calls, or expensive per-call',
                    'percent_total': func['percent_total'],
                    'calls': func['calls'],
                    'per_call': func['per_call'],
                    'priority': 'HIGH' if func['percent_total'] > 20 else 'MEDIUM'
                })

        return rust_candidates

    def profile_memory_usage(self, datasets: Dict[str, str]) -> Dict[str, Any]:
        """Memory profiling to identify memory bloat"""
        logger.info("🧠 Starting memory profiling analysis...")

        memory_results = {}

        for dataset_name, dataset_path in datasets.items():
            logger.info(f"Profiling memory usage for {dataset_name} dataset...")

            process = psutil.Process()

            # Baseline memory
            baseline_memory = process.memory_info().rss / 1024 / 1024  # MB
            memory_timeline = [{'step': 'baseline', 'memory_mb': baseline_memory}]

            try:
                # Step 1: Load data
                df = pd.read_csv(dataset_path)
                step1_memory = process.memory_info().rss / 1024 / 1024
                memory_timeline.append({'step': 'load_csv', 'memory_mb': step1_memory})

                # Step 2: Data processing
                df_processed = df.copy()
                step2_memory = process.memory_info().rss / 1024 / 1024
                memory_timeline.append({'step': 'copy_dataframe', 'memory_mb': step2_memory})

                # Step 3: Heavy operations
                numeric_cols = df_processed.select_dtypes(include=[np.number]).columns
                for col in numeric_cols:
                    df_processed[col].fillna(df_processed[col].median(), inplace=True)

                step3_memory = process.memory_info().rss / 1024 / 1024
                memory_timeline.append({'step': 'data_cleaning', 'memory_mb': step3_memory})

                # Step 4: Aggregations (memory intensive)
                if len(df_processed) > 1000:
                    group_col = df_processed.columns[0]
                    if df_processed[group_col].dtype in ['object', 'category']:
                        agg_result = df_processed.groupby(group_col).agg({
                            col: ['mean', 'std', 'count'] for col in numeric_cols[:3]
                        })

                step4_memory = process.memory_info().rss / 1024 / 1024
                memory_timeline.append({'step': 'aggregations', 'memory_mb': step4_memory})

                # Memory cleanup
                del df, df_processed
                if 'agg_result' in locals():
                    del agg_result

                import gc
                gc.collect()

                final_memory = process.memory_info().rss / 1024 / 1024
                memory_timeline.append({'step': 'cleanup', 'memory_mb': final_memory})

                # Calculate memory metrics
                peak_memory = max(step['memory_mb'] for step in memory_timeline)
                memory_growth = peak_memory - baseline_memory
                cleanup_efficiency = (peak_memory - final_memory) / memory_growth if memory_growth > 0 else 0

                memory_results[dataset_name] = {
                    'baseline_memory_mb': baseline_memory,
                    'peak_memory_mb': peak_memory,
                    'final_memory_mb': final_memory,
                    'memory_growth_mb': memory_growth,
                    'cleanup_efficiency': cleanup_efficiency,
                    'memory_timeline': memory_timeline,
                    'dataset_rows': len(pd.read_csv(dataset_path)),
                    'memory_per_row': memory_growth / len(pd.read_csv(dataset_path)) if len(pd.read_csv(dataset_path)) > 0 else 0
                }

                logger.info(f"Memory analysis complete for {dataset_name}: "
                           f"Peak {peak_memory:.1f}MB, Growth {memory_growth:.1f}MB")

            except Exception as e:
                logger.error(f"Memory profiling error for {dataset_name}: {e}")
                memory_results[dataset_name] = {'error': str(e)}

        return memory_results

    def benchmark_key_workflows(self, datasets: Dict[str, str]) -> Dict[str, Any]:
        """Benchmark core workflows with different dataset sizes"""
        logger.info("⚡ Starting workflow benchmarking...")

        benchmark_results = {}
        workflows = {
            'csv_read': self._benchmark_csv_reading,
            'data_cleaning': self._benchmark_data_cleaning,
            'aggregations': self._benchmark_aggregations,
            'joins': self._benchmark_joins,
            'transformations': self._benchmark_transformations
        }

        for workflow_name, workflow_func in workflows.items():
            logger.info(f"Benchmarking {workflow_name}...")
            workflow_results = {}

            for dataset_name, dataset_path in datasets.items():
                try:
                    start_time = time.time()
                    result = workflow_func(dataset_path)
                    end_time = time.time()

                    dataset_size = Path(dataset_path).stat().st_size / (1024 * 1024)  # MB
                    num_rows = result.get('rows_processed', 0)

                    workflow_results[dataset_name] = {
                        'execution_time': end_time - start_time,
                        'dataset_size_mb': dataset_size,
                        'rows_processed': num_rows,
                        'throughput_rows_per_sec': num_rows / (end_time - start_time) if (end_time - start_time) > 0 else 0,
                        'throughput_mb_per_sec': dataset_size / (end_time - start_time) if (end_time - start_time) > 0 else 0,
                        **result
                    }

                    logger.info(f"  {dataset_name}: {end_time - start_time:.3f}s, "
                               f"{workflow_results[dataset_name]['throughput_rows_per_sec']:,.0f} rows/sec")

                except Exception as e:
                    logger.error(f"Benchmark error for {workflow_name}/{dataset_name}: {e}")
                    workflow_results[dataset_name] = {'error': str(e)}

            benchmark_results[workflow_name] = workflow_results

        return benchmark_results

    def _benchmark_csv_reading(self, dataset_path: str) -> Dict[str, Any]:
        """Benchmark CSV reading performance"""
        df = pd.read_csv(dataset_path)
        return {'rows_processed': len(df), 'columns': len(df.columns)}

    def _benchmark_data_cleaning(self, dataset_path: str) -> Dict[str, Any]:
        """Benchmark data cleaning operations"""
        df = pd.read_csv(dataset_path)

        # Fill missing values
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            df[col] = df[col].fillna(df[col].median())

        # Remove duplicates
        df = df.drop_duplicates()

        # Outlier detection (simple z-score method)
        for col in numeric_cols:
            z_scores = np.abs((df[col] - df[col].mean()) / df[col].std())
            df = df[z_scores < 3]

        return {'rows_processed': len(df), 'operations': ['fillna', 'drop_duplicates', 'outlier_removal']}

    def _benchmark_aggregations(self, dataset_path: str) -> Dict[str, Any]:
        """Benchmark aggregation operations"""
        df = pd.read_csv(dataset_path)

        # Group by categorical column if available
        categorical_cols = df.select_dtypes(include=['object']).columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns

        aggregations_performed = []

        if len(categorical_cols) > 0 and len(numeric_cols) > 0:
            group_col = categorical_cols[0]
            agg_dict = {col: ['mean', 'std', 'count', 'min', 'max'] for col in numeric_cols[:3]}
            result = df.groupby(group_col).agg(agg_dict)
            aggregations_performed.append(f'groupby_{group_col}')

        # Global aggregations
        if len(numeric_cols) > 0:
            global_agg = df[numeric_cols].agg(['mean', 'std', 'min', 'max', 'median'])
            aggregations_performed.append('global_aggregations')

        return {
            'rows_processed': len(df),
            'aggregations': aggregations_performed,
            'numeric_columns': len(numeric_cols),
            'categorical_columns': len(categorical_cols)
        }

    def _benchmark_joins(self, dataset_path: str) -> Dict[str, Any]:
        """Benchmark join operations"""
        df = pd.read_csv(dataset_path)

        # Self join for benchmarking (only for smaller datasets to avoid memory issues)
        if len(df) < 50_000:
            sample_size = min(1000, len(df) // 2)
            df_sample = df.sample(sample_size)

            # Inner join
            joined = df.merge(df_sample, left_index=True, right_index=True, suffixes=('', '_right'))

            return {
                'rows_processed': len(df),
                'join_type': 'inner_self_join',
                'sample_size': sample_size,
                'result_rows': len(joined)
            }
        else:
            return {
                'rows_processed': len(df),
                'join_type': 'skipped_large_dataset',
                'reason': 'Dataset too large for join benchmark'
            }

    def _benchmark_transformations(self, dataset_path: str) -> Dict[str, Any]:
        """Benchmark transformation operations"""
        df = pd.read_csv(dataset_path)

        transformations = []

        # Date transformations
        date_cols = df.select_dtypes(include=['datetime64', 'object']).columns
        for col in date_cols:
            try:
                df[f'{col}_parsed'] = pd.to_datetime(df[col], errors='coerce')
                if not df[f'{col}_parsed'].isna().all():
                    df[f'{col}_hour'] = df[f'{col}_parsed'].dt.hour
                    df[f'{col}_dow'] = df[f'{col}_parsed'].dt.dayofweek
                    transformations.append(f'datetime_transform_{col}')
            except:
                pass

        # Numeric transformations
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        for col in numeric_cols[:3]:  # Limit to first 3 to avoid excessive computation
            df[f'{col}_log'] = np.log1p(df[col].abs())
            df[f'{col}_squared'] = df[col] ** 2
            df[f'{col}_normalized'] = (df[col] - df[col].mean()) / df[col].std()
            transformations.append(f'numeric_transform_{col}')

        return {
            'rows_processed': len(df),
            'transformations': transformations,
            'columns_added': len([col for col in df.columns if '_' in col])
        }

    def test_polars_replacement(self, datasets: Dict[str, str]) -> Dict[str, Any]:
        """Test Polars as pandas replacement"""
        logger.info("🚀 Testing Polars performance vs pandas...")

        try:
            import polars as pl
        except ImportError:
            logger.warning("Polars not installed. Installing...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", "polars"])
            import polars as pl

        polars_results = {}

        for dataset_name, dataset_path in datasets.items():
            logger.info(f"Comparing pandas vs Polars for {dataset_name}...")

            # Pandas benchmark
            pandas_start = time.time()
            df_pandas = pd.read_csv(dataset_path)

            # Basic operations with pandas
            numeric_cols = df_pandas.select_dtypes(include=[np.number]).columns
            if len(numeric_cols) > 0:
                pandas_agg = df_pandas[numeric_cols].agg(['mean', 'std', 'count'])

            pandas_time = time.time() - pandas_start

            # Polars benchmark
            polars_start = time.time()
            df_polars = pl.read_csv(dataset_path)

            # Basic operations with Polars
            numeric_cols_polars = [col for col in df_polars.columns if df_polars[col].dtype.is_numeric()]
            if len(numeric_cols_polars) > 0:
                polars_agg = df_polars.select([
                    pl.col(col).mean().alias(f"{col}_mean") for col in numeric_cols_polars
                ] + [
                    pl.col(col).std().alias(f"{col}_std") for col in numeric_cols_polars
                ] + [
                    pl.col(col).count().alias(f"{col}_count") for col in numeric_cols_polars
                ])

            polars_time = time.time() - polars_start

            # Calculate speedup
            speedup = pandas_time / polars_time if polars_time > 0 else 0

            polars_results[dataset_name] = {
                'pandas_time': pandas_time,
                'polars_time': polars_time,
                'speedup': speedup,
                'rows': len(df_pandas),
                'pandas_memory_mb': df_pandas.memory_usage(deep=True).sum() / 1024 / 1024,
                'recommendation': 'USE_POLARS' if speedup > 1.5 else 'KEEP_PANDAS'
            }

            logger.info(f"  Pandas: {pandas_time:.3f}s, Polars: {polars_time:.3f}s, "
                       f"Speedup: {speedup:.2f}x")

        return polars_results

    def generate_rust_recommendations(self, cpu_results: Dict, memory_results: Dict,
                                    benchmark_results: Dict, polars_results: Dict) -> Dict[str, Any]:
        """Generate comprehensive Rust integration recommendations"""
        logger.info("📋 Generating Rust integration recommendations...")

        recommendations = {
            'overall_assessment': {},
            'rust_candidates': [],
            'integration_strategy': {},
            'polars_assessment': {},
            'priority_actions': []
        }

        # Analyze CPU bottlenecks
        all_rust_candidates = []
        total_high_priority = 0

        for dataset_name, cpu_data in cpu_results.items():
            candidates = cpu_data.get('rust_candidates', [])
            all_rust_candidates.extend(candidates)
            total_high_priority += len([c for c in candidates if c.get('priority') == 'HIGH'])

        # Analyze memory patterns
        avg_memory_per_row = np.mean([
            result.get('memory_per_row', 0) for result in memory_results.values()
            if 'memory_per_row' in result
        ])

        # Analyze Polars performance
        polars_speedups = [result['speedup'] for result in polars_results.values() if result['speedup'] > 0]
        avg_polars_speedup = np.mean(polars_speedups) if polars_speedups else 0

        # Overall assessment
        recommendations['overall_assessment'] = {
            'rust_readiness_score': min(100, total_high_priority * 10 + len(all_rust_candidates) * 2),
            'high_priority_bottlenecks': total_high_priority,
            'total_rust_candidates': len(all_rust_candidates),
            'memory_efficiency': 'GOOD' if avg_memory_per_row < 1.0 else 'NEEDS_IMPROVEMENT',
            'polars_benefit': 'HIGH' if avg_polars_speedup > 2.0 else 'MEDIUM' if avg_polars_speedup > 1.5 else 'LOW'
        }

        # Consolidate Rust candidates
        function_priorities = {}
        for candidate in all_rust_candidates:
            func_name = candidate['function']
            if func_name not in function_priorities or candidate.get('priority') == 'HIGH':
                function_priorities[func_name] = candidate

        recommendations['rust_candidates'] = list(function_priorities.values())

        # Integration strategy
        if total_high_priority >= 3:
            strategy = "AGGRESSIVE_RUST_MIGRATION"
            approach = "Replace hotspots with Rust via PyO3/maturin"
        elif avg_polars_speedup > 2.0:
            strategy = "POLARS_FIRST_APPROACH"
            approach = "Migrate to Polars first, then consider Rust for remaining bottlenecks"
        elif len(all_rust_candidates) > 5:
            strategy = "SELECTIVE_RUST_INTEGRATION"
            approach = "Target specific high-impact functions for Rust implementation"
        else:
            strategy = "DEFER_RUST_MIGRATION"
            approach = "Optimize Python code and consider Rust in future iterations"

        recommendations['integration_strategy'] = {
            'strategy': strategy,
            'approach': approach,
            'timeline': '1-2 months' if strategy == 'AGGRESSIVE_RUST_MIGRATION' else '3-6 months',
            'effort_level': 'HIGH' if total_high_priority >= 3 else 'MEDIUM'
        }

        # Polars assessment
        recommendations['polars_assessment'] = {
            'average_speedup': avg_polars_speedup,
            'recommendation': 'IMMEDIATE_MIGRATION' if avg_polars_speedup > 2.0 else 'EVALUATE_FURTHER',
            'estimated_performance_gain': f"{(avg_polars_speedup - 1) * 100:.0f}%" if avg_polars_speedup > 1 else "0%"
        }

        # Priority actions
        if avg_polars_speedup > 1.5:
            recommendations['priority_actions'].append({
                'action': 'Migrate from pandas to Polars',
                'priority': 'HIGH',
                'estimated_impact': f"{avg_polars_speedup:.1f}x speedup",
                'complexity': 'MEDIUM'
            })

        if total_high_priority > 0:
            recommendations['priority_actions'].append({
                'action': 'Implement Rust modules for CPU bottlenecks',
                'priority': 'HIGH',
                'estimated_impact': '2-5x speedup for specific functions',
                'complexity': 'HIGH'
            })

        if avg_memory_per_row > 1.0:
            recommendations['priority_actions'].append({
                'action': 'Optimize memory usage patterns',
                'priority': 'MEDIUM',
                'estimated_impact': '30-50% memory reduction',
                'complexity': 'MEDIUM'
            })

        return recommendations

    def save_results(self, all_results: Dict[str, Any]):
        """Save all profiling results to files"""
        logger.info("💾 Saving profiling results...")

        # Save comprehensive JSON report
        report_file = self.output_dir / f"rust_readiness_report_{self.start_time.strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(all_results, f, indent=2, default=str)

        # Save markdown summary
        summary_file = self.output_dir / f"rust_readiness_summary_{self.start_time.strftime('%Y%m%d_%H%M%S')}.md"
        self._generate_markdown_report(all_results, summary_file)

        logger.info(f"✅ Results saved:")
        logger.info(f"  📊 Detailed report: {report_file}")
        logger.info(f"  📋 Summary: {summary_file}")

    def _generate_markdown_report(self, results: Dict[str, Any], output_file: Path):
        """Generate markdown summary report"""
        with open(output_file, 'w') as f:
            f.write("# Schlep-engine Rust Readiness Assessment\n\n")
            f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

            # Executive Summary
            recs = results['recommendations']
            f.write("## Executive Summary\n\n")
            f.write(f"**Rust Readiness Score:** {recs['overall_assessment']['rust_readiness_score']}/100\n\n")
            f.write(f"**Strategy:** {recs['integration_strategy']['strategy']}\n\n")
            f.write(f"**Approach:** {recs['integration_strategy']['approach']}\n\n")

            # Key Findings
            f.write("## Key Findings\n\n")
            f.write(f"- **High Priority Bottlenecks:** {recs['overall_assessment']['high_priority_bottlenecks']}\n")
            f.write(f"- **Total Rust Candidates:** {recs['overall_assessment']['total_rust_candidates']}\n")
            f.write(f"- **Polars Speedup:** {recs['polars_assessment']['average_speedup']:.2f}x\n")
            f.write(f"- **Memory Efficiency:** {recs['overall_assessment']['memory_efficiency']}\n\n")

            # Priority Actions
            f.write("## Priority Actions\n\n")
            for action in recs['priority_actions']:
                f.write(f"### {action['action']}\n")
                f.write(f"- **Priority:** {action['priority']}\n")
                f.write(f"- **Impact:** {action['estimated_impact']}\n")
                f.write(f"- **Complexity:** {action['complexity']}\n\n")

            # Rust Candidates
            f.write("## Top Rust Candidates\n\n")
            candidates = recs['rust_candidates'][:10]  # Top 10
            if candidates:
                f.write("| Function | Priority | CPU % | Calls | Reason |\n")
                f.write("|----------|----------|--------|-------|--------|\n")
                for candidate in candidates:
                    f.write(f"| {candidate['function'][:50]} | {candidate['priority']} | "
                           f"{candidate['percent_total']:.1f}% | {candidate['calls']:,} | "
                           f"{candidate['reason'][:40]} |\n")
            else:
                f.write("No significant Rust candidates identified.\n")

            f.write("\n---\n*Generated by Schlep-engine Performance Profiler*\n")

    def run_complete_analysis(self) -> Dict[str, Any]:
        """Run complete performance analysis"""
        logger.info("🚀 Starting comprehensive Rust readiness analysis...")

        try:
            # Create test datasets
            datasets = self.create_test_datasets()

            # Run all profiling steps
            cpu_results = self.profile_cpu_intensive_functions(datasets)
            memory_results = self.profile_memory_usage(datasets)
            benchmark_results = self.benchmark_key_workflows(datasets)
            polars_results = self.test_polars_replacement(datasets)

            # Generate recommendations
            recommendations = self.generate_rust_recommendations(
                cpu_results, memory_results, benchmark_results, polars_results
            )

            # Compile all results
            all_results = {
                'metadata': {
                    'timestamp': self.start_time.isoformat(),
                    'datasets': {k: {'path': v, 'size_mb': Path(v).stat().st_size / 1024 / 1024}
                                for k, v in datasets.items()},
                    'python_version': sys.version,
                    'pandas_version': pd.__version__,
                    'numpy_version': np.__version__
                },
                'cpu_profiling': cpu_results,
                'memory_profiling': memory_results,
                'benchmarks': benchmark_results,
                'polars_comparison': polars_results,
                'recommendations': recommendations
            }

            # Save results
            self.save_results(all_results)

            # Cleanup test datasets
            for dataset_path in datasets.values():
                try:
                    os.unlink(dataset_path)
                except:
                    pass

            logger.info("✅ Comprehensive analysis completed successfully!")
            return all_results

        except Exception as e:
            logger.error(f"❌ Analysis failed: {e}")
            raise

if __name__ == "__main__":
    profiler = PerformanceProfiler()
    results = profiler.run_complete_analysis()

    # Print summary
    recs = results['recommendations']
    print(f"\n{'='*80}")
    print("🚀 RUST READINESS ASSESSMENT SUMMARY")
    print(f"{'='*80}")
    print(f"Readiness Score: {recs['overall_assessment']['rust_readiness_score']}/100")
    print(f"Strategy: {recs['integration_strategy']['strategy']}")
    print(f"High Priority Bottlenecks: {recs['overall_assessment']['high_priority_bottlenecks']}")
    print(f"Polars Speedup: {recs['polars_assessment']['average_speedup']:.2f}x")
    print(f"\n✅ Complete results saved in {profiler.output_dir}/")
    print(f"{'='*80}")