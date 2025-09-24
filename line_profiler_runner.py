#!/usr/bin/env python3
"""
Line-by-Line Performance Profiler for Schlep-engine
==================================================

Uses line_profiler to identify exact lines causing performance bottlenecks.
This complements the overall cProfile analysis with granular line-level insights.
"""

import os
import sys
import subprocess
import tempfile
import pandas as pd
import numpy as np
from pathlib import Path
import logging
from datetime import datetime
import json
import time

# Add app to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), 'apps', 'api'))

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class LineProfilerRunner:
    """Line-by-line profiler for identifying performance hotspots"""

    def __init__(self, output_dir: str = "line_profiling_results"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.results = {}

    def install_line_profiler(self):
        """Install line_profiler if not available"""
        try:
            import line_profiler
            logger.info("✅ line_profiler already installed")
            return True
        except ImportError:
            logger.info("📦 Installing line_profiler...")
            try:
                subprocess.check_call([sys.executable, "-m", "pip", "install", "line_profiler"])
                logger.info("✅ line_profiler installed successfully")
                return True
            except subprocess.CalledProcessError as e:
                logger.error(f"❌ Failed to install line_profiler: {e}")
                return False

    def create_profile_target_script(self) -> str:
        """Create a target script with @profile decorators for line profiling"""
        script_content = '''#!/usr/bin/env python3
"""
Target script for line-by-line profiling of data processing functions
"""

import pandas as pd
import numpy as np
import time
import sys
from pathlib import Path

@profile
def profile_csv_reading(file_path: str):
    """Profile CSV reading performance"""
    # Different reading methods
    df1 = pd.read_csv(file_path)
    return len(df1)

@profile
def profile_data_cleaning(file_path: str):
    """Profile data cleaning operations line by line"""
    df = pd.read_csv(file_path)

    # Get numeric columns
    numeric_cols = df.select_dtypes(include=[np.number]).columns

    # Fill missing values - line by line analysis
    for col in numeric_cols:
        median_val = df[col].median()
        df[col] = df[col].fillna(median_val)

    # Remove duplicates
    initial_rows = len(df)
    df = df.drop_duplicates()
    final_rows = len(df)

    # Outlier detection
    for col in numeric_cols:
        mean_val = df[col].mean()
        std_val = df[col].std()
        z_scores = np.abs((df[col] - mean_val) / std_val)
        outlier_mask = z_scores < 3
        df = df[outlier_mask]

    return {
        'initial_rows': initial_rows,
        'after_dedup': final_rows,
        'final_rows': len(df)
    }

@profile
def profile_aggregations(file_path: str):
    """Profile aggregation operations line by line"""
    df = pd.read_csv(file_path)

    # Get column types
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    categorical_cols = df.select_dtypes(include=['object']).columns

    results = {}

    # Global aggregations
    if len(numeric_cols) > 0:
        means = df[numeric_cols].mean()
        stds = df[numeric_cols].std()
        medians = df[numeric_cols].median()
        mins = df[numeric_cols].min()
        maxs = df[numeric_cols].max()

        results['global_stats'] = {
            'means': means.to_dict(),
            'stds': stds.to_dict()
        }

    # Group by aggregations if categorical columns exist
    if len(categorical_cols) > 0 and len(numeric_cols) > 0:
        group_col = categorical_cols[0]

        # Multiple aggregation functions
        agg_dict = {}
        for col in numeric_cols[:3]:  # Limit to first 3 numeric columns
            agg_dict[col] = ['mean', 'std', 'count']

        grouped = df.groupby(group_col)
        aggregated = grouped.agg(agg_dict)

        results['grouped_stats'] = len(aggregated)

    return results

@profile
def profile_transformations(file_path: str):
    """Profile transformation operations line by line"""
    df = pd.read_csv(file_path)

    # Get numeric columns
    numeric_cols = df.select_dtypes(include=[np.number]).columns

    # Apply transformations
    for col in numeric_cols[:3]:  # Limit to avoid excessive computation
        # Log transformation
        df[f'{col}_log'] = np.log1p(df[col].abs())

        # Squared transformation
        df[f'{col}_squared'] = df[col] ** 2

        # Normalization (z-score)
        col_mean = df[col].mean()
        col_std = df[col].std()
        df[f'{col}_normalized'] = (df[col] - col_mean) / col_std

        # Min-max scaling
        col_min = df[col].min()
        col_max = df[col].max()
        df[f'{col}_minmax'] = (df[col] - col_min) / (col_max - col_min)

    return len(df)

@profile
def profile_joins_merges(file_path: str):
    """Profile join/merge operations line by line"""
    df = pd.read_csv(file_path)

    # Only perform joins on smaller datasets to avoid memory issues
    if len(df) > 10000:
        return {'skipped': 'Dataset too large for join profiling'}

    # Create a sample for joining
    sample_size = min(1000, len(df) // 2)
    df_sample = df.sample(sample_size, random_state=42)

    # Inner join
    inner_joined = df.merge(df_sample, left_index=True, right_index=True, suffixes=('', '_right'))

    # Left join
    left_joined = df.merge(df_sample, left_index=True, right_index=True, how='left', suffixes=('', '_left'))

    return {
        'original_rows': len(df),
        'sample_rows': len(df_sample),
        'inner_join_rows': len(inner_joined),
        'left_join_rows': len(left_joined)
    }

@profile
def profile_string_operations(file_path: str):
    """Profile string operations line by line"""
    df = pd.read_csv(file_path)

    # Get string columns
    string_cols = df.select_dtypes(include=['object']).columns

    for col in string_cols[:2]:  # Limit to first 2 string columns
        # String length
        df[f'{col}_length'] = df[col].astype(str).str.len()

        # Uppercase
        df[f'{col}_upper'] = df[col].astype(str).str.upper()

        # Extract patterns (if applicable)
        if 'email' in col.lower():
            df[f'{col}_domain'] = df[col].astype(str).str.extract(r'@([^.]+\\.)')

        # String contains
        df[f'{col}_has_underscore'] = df[col].astype(str).str.contains('_')

    return len(df)

def run_profiling_suite(dataset_path: str):
    """Run the complete profiling suite on a dataset"""
    results = {}

    print(f"Starting line profiling for: {dataset_path}")

    # Profile each function
    functions_to_profile = [
        ('csv_reading', profile_csv_reading),
        ('data_cleaning', profile_data_cleaning),
        ('aggregations', profile_aggregations),
        ('transformations', profile_transformations),
        ('joins_merges', profile_joins_merges),
        ('string_operations', profile_string_operations)
    ]

    for func_name, func in functions_to_profile:
        print(f"Profiling {func_name}...")
        try:
            start_time = time.time()
            result = func(dataset_path)
            end_time = time.time()

            results[func_name] = {
                'execution_time': end_time - start_time,
                'result': result
            }
            print(f"  ✅ {func_name}: {end_time - start_time:.3f}s")
        except Exception as e:
            print(f"  ❌ {func_name} failed: {e}")
            results[func_name] = {'error': str(e)}

    return results

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        dataset_path = sys.argv[1]
        results = run_profiling_suite(dataset_path)
        print("Profiling completed!")
    else:
        print("Usage: python script.py <dataset_path>")
'''

        # Write the target script
        target_script = self.output_dir / "profile_target.py"
        with open(target_script, 'w') as f:
            f.write(script_content)

        return str(target_script)

    def run_line_profiling(self, datasets: dict) -> dict:
        """Run line profiling on target functions"""
        logger.info("🔍 Starting line-by-line profiling...")

        if not self.install_line_profiler():
            return {'error': 'Failed to install line_profiler'}

        # Create target script
        target_script = self.create_profile_target_script()
        results = {}

        for dataset_name, dataset_path in datasets.items():
            logger.info(f"Line profiling {dataset_name} dataset...")

            try:
                # Run kernprof on the target script
                output_file = self.output_dir / f"line_profile_{dataset_name}.txt"

                cmd = [
                    'kernprof',
                    '-l',  # Line-by-line profiling
                    '-v',  # Verbose output
                    target_script,
                    dataset_path
                ]

                # Execute kernprof
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=300  # 5 minute timeout
                )

                if result.returncode == 0:
                    # Save the profiling output
                    with open(output_file, 'w') as f:
                        f.write(result.stdout)
                        f.write("\n\nSTDERR:\n")
                        f.write(result.stderr)

                    # Parse the profiling results
                    parsed_results = self._parse_line_profile_output(result.stdout)

                    results[dataset_name] = {
                        'status': 'success',
                        'output_file': str(output_file),
                        'parsed_results': parsed_results,
                        'raw_output': result.stdout[:2000]  # First 2000 chars
                    }

                    logger.info(f"  ✅ Line profiling completed for {dataset_name}")

                else:
                    error_msg = f"kernprof failed: {result.stderr}"
                    logger.error(f"  ❌ {error_msg}")
                    results[dataset_name] = {
                        'status': 'error',
                        'error': error_msg,
                        'stdout': result.stdout,
                        'stderr': result.stderr
                    }

            except subprocess.TimeoutExpired:
                logger.error(f"  ⏰ Line profiling timeout for {dataset_name}")
                results[dataset_name] = {
                    'status': 'timeout',
                    'error': 'Profiling timed out after 5 minutes'
                }

            except Exception as e:
                logger.error(f"  ❌ Line profiling error for {dataset_name}: {e}")
                results[dataset_name] = {
                    'status': 'error',
                    'error': str(e)
                }

        return results

    def _parse_line_profile_output(self, output: str) -> dict:
        """Parse line_profiler output to extract performance insights"""
        parsed = {
            'functions': [],
            'hottest_lines': [],
            'total_time': 0
        }

        lines = output.split('\n')
        current_function = None

        for i, line in enumerate(lines):
            # Look for function headers
            if line.startswith('Line #'):
                # Found a function profile table header
                if i > 0 and lines[i-1].strip():
                    current_function = lines[i-1].strip()
                continue

            # Parse profile lines
            if line.strip() and current_function:
                parts = line.split()
                if len(parts) >= 6 and parts[0].isdigit():
                    try:
                        line_num = int(parts[0])
                        hits = int(parts[1]) if parts[1] != '' else 0
                        time_per_hit = float(parts[2]) if parts[2] != '' else 0.0
                        percent_time = float(parts[3].rstrip('%')) if parts[3] != '' and parts[3] != '%' else 0.0
                        total_time = float(parts[4]) if parts[4] != '' else 0.0

                        # Extract the actual code line
                        code_line = ' '.join(parts[5:]) if len(parts) > 5 else ''

                        line_info = {
                            'function': current_function,
                            'line_number': line_num,
                            'hits': hits,
                            'time_per_hit': time_per_hit,
                            'percent_time': percent_time,
                            'total_time': total_time,
                            'code': code_line.strip()
                        }

                        # Add to hottest lines if significant
                        if percent_time > 1.0 or total_time > 0.01:  # > 1% of time or > 0.01 seconds
                            parsed['hottest_lines'].append(line_info)

                        parsed['total_time'] += total_time

                    except (ValueError, IndexError):
                        continue  # Skip lines that don't parse correctly

        # Sort hottest lines by percent time
        parsed['hottest_lines'] = sorted(
            parsed['hottest_lines'],
            key=lambda x: x['percent_time'],
            reverse=True
        )[:20]  # Top 20 hottest lines

        return parsed

    def generate_line_profile_report(self, results: dict) -> dict:
        """Generate report from line profiling results"""
        logger.info("📊 Generating line profiling report...")

        report = {
            'summary': {
                'datasets_profiled': len(results),
                'successful_profiles': len([r for r in results.values() if r.get('status') == 'success']),
                'total_functions_analyzed': 0,
                'total_hot_lines': 0
            },
            'rust_candidate_lines': [],
            'optimization_opportunities': []
        }

        all_hot_lines = []

        for dataset_name, result in results.items():
            if result.get('status') == 'success' and 'parsed_results' in result:
                parsed = result['parsed_results']
                hot_lines = parsed.get('hottest_lines', [])

                # Add dataset context to hot lines
                for line in hot_lines:
                    line['dataset'] = dataset_name
                    all_hot_lines.append(line)

                report['summary']['total_hot_lines'] += len(hot_lines)

        # Sort all hot lines by percent time
        all_hot_lines = sorted(all_hot_lines, key=lambda x: x['percent_time'], reverse=True)

        # Identify Rust candidates
        rust_indicators = [
            'pandas', 'numpy', 'for ', 'while ', '.iterrows()', '.apply(',
            'groupby', 'merge', 'join', 'fillna', 'mean()', 'std()',
            'mathematical operations', 'loop', 'iteration'
        ]

        for line in all_hot_lines[:50]:  # Top 50 hot lines
            code_lower = line['code'].lower()

            # Check if line is a Rust candidate
            is_rust_candidate = (
                any(indicator in code_lower for indicator in rust_indicators) or
                line['percent_time'] > 5.0 or  # Takes > 5% of total time
                line['hits'] > 10000  # Called frequently
            )

            if is_rust_candidate:
                report['rust_candidate_lines'].append({
                    'code': line['code'],
                    'function': line['function'],
                    'dataset': line['dataset'],
                    'percent_time': line['percent_time'],
                    'hits': line['hits'],
                    'time_per_hit': line['time_per_hit'],
                    'optimization_type': 'RUST_CANDIDATE',
                    'reason': f"High impact line: {line['percent_time']:.1f}% of execution time"
                })

        # Identify general optimization opportunities
        for line in all_hot_lines[:30]:  # Top 30
            if line['hits'] > 1000 and line['time_per_hit'] > 0.0001:
                report['optimization_opportunities'].append({
                    'code': line['code'],
                    'function': line['function'],
                    'dataset': line['dataset'],
                    'issue': 'Expensive operation in loop',
                    'suggestion': 'Consider vectorization or caching',
                    'impact': line['percent_time']
                })

        report['summary']['total_functions_analyzed'] = len(set(line['function'] for line in all_hot_lines))

        return report

    def create_test_dataset(self, size: int = 10000) -> str:
        """Create a test dataset for profiling"""
        np.random.seed(42)

        data = pd.DataFrame({
            'id': range(size),
            'name': [f"User_{i}" for i in range(size)],
            'email': [f"user{i}@{'gmail' if i % 2 else 'yahoo'}.com" for i in range(size)],
            'age': np.random.randint(18, 80, size),
            'salary': np.random.exponential(50000, size),
            'department': np.random.choice(['IT', 'Sales', 'Marketing', 'HR'], size),
            'score': np.random.normal(75, 15, size),
            'join_date': pd.date_range('2020-01-01', periods=size, freq='1D')
        })

        # Add missing values for realistic testing
        data.loc[np.random.choice(size, size//20), 'salary'] = np.nan
        data.loc[np.random.choice(size, size//50), 'email'] = None

        # Save to temp file
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False)
        data.to_csv(temp_file.name, index=False)
        temp_file.close()

        logger.info(f"Created test dataset: {size:,} rows, {Path(temp_file.name).stat().st_size / 1024:.1f}KB")
        return temp_file.name

    def run_complete_line_profiling(self) -> dict:
        """Run complete line profiling analysis"""
        logger.info("🚀 Starting complete line-by-line profiling...")

        try:
            # Create test datasets of different sizes
            datasets = {}
            sizes = [1000, 10000, 50000]  # Different sizes for profiling

            for size in sizes:
                dataset_path = self.create_test_dataset(size)
                datasets[f"{size}_rows"] = dataset_path

            # Run line profiling
            profiling_results = self.run_line_profiling(datasets)

            # Generate report
            report = self.generate_line_profile_report(profiling_results)

            # Combine results
            complete_results = {
                'metadata': {
                    'timestamp': datetime.now().isoformat(),
                    'datasets': {k: {'path': v, 'size': Path(v).stat().st_size}
                               for k, v in datasets.items()},
                    'profiling_method': 'kernprof line_profiler'
                },
                'profiling_results': profiling_results,
                'analysis_report': report
            }

            # Save results
            output_file = self.output_dir / f"line_profiling_complete_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(output_file, 'w') as f:
                json.dump(complete_results, f, indent=2, default=str)

            # Create summary
            self._create_line_profiling_summary(complete_results, output_file.with_suffix('.md'))

            # Cleanup temp files
            for dataset_path in datasets.values():
                try:
                    os.unlink(dataset_path)
                except:
                    pass

            logger.info(f"✅ Line profiling completed! Results saved to {output_file}")
            return complete_results

        except Exception as e:
            logger.error(f"❌ Line profiling failed: {e}")
            raise

    def _create_line_profiling_summary(self, results: dict, output_file: Path):
        """Create markdown summary of line profiling results"""
        with open(output_file, 'w') as f:
            f.write("# Line-by-Line Profiling Results\n\n")
            f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

            report = results['analysis_report']
            summary = report['summary']

            f.write("## Summary\n\n")
            f.write(f"- **Datasets Profiled:** {summary['datasets_profiled']}\n")
            f.write(f"- **Successful Profiles:** {summary['successful_profiles']}\n")
            f.write(f"- **Functions Analyzed:** {summary['total_functions_analyzed']}\n")
            f.write(f"- **Hot Lines Identified:** {summary['total_hot_lines']}\n\n")

            # Rust candidates
            f.write("## Top Rust Candidate Lines\n\n")
            candidates = report['rust_candidate_lines'][:10]
            if candidates:
                f.write("| Code | Function | Time % | Hits | Reason |\n")
                f.write("|------|----------|--------|------|--------|\n")
                for candidate in candidates:
                    code = candidate['code'][:50] + "..." if len(candidate['code']) > 50 else candidate['code']
                    f.write(f"| `{code}` | {candidate['function']} | "
                           f"{candidate['percent_time']:.1f}% | {candidate['hits']:,} | "
                           f"{candidate['reason'][:40]}... |\n")
            else:
                f.write("No significant Rust candidate lines identified.\n")

            f.write("\n## Optimization Opportunities\n\n")
            opps = report['optimization_opportunities'][:5]
            for i, opp in enumerate(opps, 1):
                f.write(f"### {i}. {opp['function']}\n")
                f.write(f"**Code:** `{opp['code'][:80]}...`\n\n")
                f.write(f"**Issue:** {opp['issue']}\n\n")
                f.write(f"**Suggestion:** {opp['suggestion']}\n\n")
                f.write(f"**Impact:** {opp['impact']:.1f}% of execution time\n\n")

if __name__ == "__main__":
    profiler = LineProfilerRunner()
    results = profiler.run_complete_line_profiling()

    print(f"\n{'='*80}")
    print("🔍 LINE PROFILING RESULTS")
    print(f"{'='*80}")

    report = results['analysis_report']
    summary = report['summary']

    print(f"Datasets Profiled: {summary['datasets_profiled']}")
    print(f"Functions Analyzed: {summary['total_functions_analyzed']}")
    print(f"Hot Lines Found: {summary['total_hot_lines']}")
    print(f"Rust Candidates: {len(report['rust_candidate_lines'])}")
    print(f"\nResults saved in: {profiler.output_dir}/")
    print(f"{'='*80}")