#!/usr/bin/env python3
"""
Performance Regression Detection Script

Compares current performance against historical baselines and
detects regressions in Rust kernel performance.
"""

import json
import os
import sys
import argparse
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from schlep_engine.benchmarks import run_comprehensive_benchmark, generate_benchmark_report


class PerformanceRegressor:
    """Detect and analyze performance regressions"""

    def __init__(self, baseline_dir: str = "performance_baselines"):
        self.baseline_dir = Path(baseline_dir)
        self.baseline_dir.mkdir(exist_ok=True)

        # Performance thresholds
        self.regression_thresholds = {
            "csv_reading": {
                "min_speedup": 2.0,      # Must be at least 2x faster than pandas
                "regression_ratio": 0.8   # Alert if drops below 80% of baseline
            },
            "aggregations": {
                "min_speedup": 3.0,      # Must be at least 3x faster than pandas
                "regression_ratio": 0.8
            },
            "string_processing": {
                "min_speedup": 5.0,      # Must be at least 5x faster than pandas
                "regression_ratio": 0.85  # String ops should be more stable
            }
        }

    def run_current_benchmark(self, sizes: Optional[List[int]] = None) -> Dict[str, Any]:
        """Run benchmark for current code"""
        print("🚀 Running current performance benchmark...")

        if sizes is None:
            sizes = [10_000, 50_000, 100_000]

        results = run_comprehensive_benchmark(sizes)

        # Add metadata
        results["metadata"] = {
            "timestamp": datetime.now().isoformat(),
            "python_version": sys.version,
            "platform": sys.platform
        }

        return results

    def save_baseline(self, results: Dict[str, Any], name: str = "main") -> None:
        """Save benchmark results as baseline"""
        baseline_file = self.baseline_dir / f"baseline_{name}.json"

        print(f"💾 Saving baseline to {baseline_file}")

        with open(baseline_file, "w") as f:
            json.dump(results, f, indent=2)

    def load_baseline(self, name: str = "main") -> Optional[Dict[str, Any]]:
        """Load baseline benchmark results"""
        baseline_file = self.baseline_dir / f"baseline_{name}.json"

        if not baseline_file.exists():
            return None

        with open(baseline_file) as f:
            return json.load(f)

    def compare_with_baseline(self,
                            current_results: Dict[str, Any],
                            baseline_name: str = "main") -> Dict[str, Any]:
        """Compare current results with baseline"""
        baseline = self.load_baseline(baseline_name)

        if baseline is None:
            return {
                "comparison_possible": False,
                "error": f"No baseline found: {baseline_name}",
                "recommendation": "Run with --save-baseline to create initial baseline"
            }

        print(f"📊 Comparing against baseline: {baseline_name}")

        current_speedups = current_results.get("summary", {}).get("average_speedups", {})
        baseline_speedups = baseline.get("summary", {}).get("average_speedups", {})

        comparison = {
            "comparison_possible": True,
            "baseline_timestamp": baseline.get("metadata", {}).get("timestamp"),
            "regressions": [],
            "improvements": [],
            "alerts": [],
            "overall_status": "PASS"
        }

        for operation in ["csv_reading", "aggregations", "string_processing"]:
            current_perf = current_speedups.get(operation, 0)
            baseline_perf = baseline_speedups.get(operation, 0)
            threshold = self.regression_thresholds[operation]

            if baseline_perf == 0:
                continue

            # Calculate performance ratio
            performance_ratio = current_perf / baseline_perf
            min_speedup_check = current_perf >= threshold["min_speedup"]

            result = {
                "operation": operation,
                "current_speedup": current_perf,
                "baseline_speedup": baseline_perf,
                "performance_ratio": performance_ratio,
                "meets_min_threshold": min_speedup_check
            }

            # Check for regressions
            if performance_ratio < threshold["regression_ratio"]:
                result["status"] = "REGRESSION"
                result["severity"] = "HIGH" if performance_ratio < 0.7 else "MEDIUM"
                comparison["regressions"].append(result)
                comparison["overall_status"] = "FAIL"

            elif not min_speedup_check:
                result["status"] = "BELOW_THRESHOLD"
                result["severity"] = "HIGH"
                comparison["alerts"].append(result)
                comparison["overall_status"] = "FAIL"

            elif performance_ratio > 1.1:  # 10% improvement
                result["status"] = "IMPROVEMENT"
                comparison["improvements"].append(result)

            else:
                result["status"] = "STABLE"

        return comparison

    def detect_memory_regressions(self,
                                current_results: Dict[str, Any],
                                baseline_name: str = "main") -> Dict[str, Any]:
        """Detect memory usage regressions"""
        baseline = self.load_baseline(baseline_name)

        if baseline is None:
            return {"comparison_possible": False}

        # This would need more detailed memory tracking in benchmarks
        # For now, return basic comparison structure
        return {
            "comparison_possible": True,
            "memory_regressions": [],
            "memory_improvements": [],
            "overall_memory_status": "UNKNOWN"
        }

    def generate_regression_report(self,
                                 comparison: Dict[str, Any],
                                 current_results: Dict[str, Any]) -> str:
        """Generate formatted regression report"""
        report = []
        report.append("🔍 PERFORMANCE REGRESSION REPORT")
        report.append("=" * 60)

        if not comparison["comparison_possible"]:
            report.append(f"❌ {comparison['error']}")
            report.append(f"💡 {comparison['recommendation']}")
            return "\n".join(report)

        # Overall status
        status_emoji = "✅" if comparison["overall_status"] == "PASS" else "❌"
        report.append(f"\n🎯 OVERALL STATUS: {status_emoji} {comparison['overall_status']}")

        baseline_time = comparison.get("baseline_timestamp", "Unknown")
        report.append(f"📅 Baseline: {baseline_time}")
        report.append(f"📅 Current:  {current_results.get('metadata', {}).get('timestamp', 'Unknown')}")

        # Regressions
        if comparison["regressions"]:
            report.append(f"\n❌ PERFORMANCE REGRESSIONS ({len(comparison['regressions'])})")
            for reg in comparison["regressions"]:
                severity_emoji = "🚨" if reg["severity"] == "HIGH" else "⚠️"
                report.append(f"  {severity_emoji} {reg['operation']}:")
                report.append(f"    Current:  {reg['current_speedup']:.2f}x")
                report.append(f"    Baseline: {reg['baseline_speedup']:.2f}x")
                report.append(f"    Ratio:    {reg['performance_ratio']:.2f} ({reg['performance_ratio']*100-100:+.1f}%)")

        # Alerts
        if comparison["alerts"]:
            report.append(f"\n⚠️ PERFORMANCE ALERTS ({len(comparison['alerts'])})")
            for alert in comparison["alerts"]:
                report.append(f"  🔻 {alert['operation']}:")
                report.append(f"    Current speedup: {alert['current_speedup']:.2f}x")
                report.append(f"    Required minimum: {self.regression_thresholds[alert['operation']]['min_speedup']:.2f}x")

        # Improvements
        if comparison["improvements"]:
            report.append(f"\n✅ PERFORMANCE IMPROVEMENTS ({len(comparison['improvements'])})")
            for imp in comparison["improvements"]:
                report.append(f"  🚀 {imp['operation']}: {imp['performance_ratio']:.2f}x improvement")

        # Current performance summary
        current_speedups = current_results.get("summary", {}).get("average_speedups", {})
        report.append(f"\n📊 CURRENT PERFORMANCE SUMMARY")
        for operation, speedup in current_speedups.items():
            threshold = self.regression_thresholds.get(operation, {}).get("min_speedup", 1.0)
            status = "✅" if speedup >= threshold else "❌"
            report.append(f"  {status} {operation}: {speedup:.2f}x speedup")

        # Recommendations
        report.append(f"\n💡 RECOMMENDATIONS")
        if comparison["overall_status"] == "FAIL":
            report.append("  🔧 Performance regressions detected - investigate recent changes")
            report.append("  📈 Consider profiling to identify bottlenecks")
            report.append("  🧪 Run individual operation benchmarks for detailed analysis")
        else:
            report.append("  ✨ Performance is stable - no action required")

        if comparison["improvements"]:
            report.append("  📝 Document performance improvements for release notes")

        return "\n".join(report)

    def auto_detect_regressions(self, save_baseline: bool = False) -> bool:
        """Automatically detect regressions (for CI/CD use)"""
        try:
            # Run current benchmark
            current_results = self.run_current_benchmark()

            # Compare with baseline
            comparison = self.compare_with_baseline(current_results)

            # Generate report
            report = self.generate_regression_report(comparison, current_results)
            print("\n" + report)

            # Save new baseline if requested
            if save_baseline:
                self.save_baseline(current_results)

            # Return success status
            return comparison.get("overall_status") == "PASS"

        except Exception as e:
            print(f"❌ Performance regression detection failed: {e}")
            return False


def main():
    """Main CLI interface"""
    parser = argparse.ArgumentParser(description="Detect performance regressions in Rust kernels")

    parser.add_argument("--save-baseline", action="store_true",
                       help="Save current performance as baseline")
    parser.add_argument("--baseline-name", default="main",
                       help="Baseline name to compare against (default: main)")
    parser.add_argument("--sizes", nargs="+", type=int,
                       help="Benchmark data sizes (default: 10000 50000 100000)")
    parser.add_argument("--baseline-dir", default="performance_baselines",
                       help="Directory to store baselines")
    parser.add_argument("--ci-mode", action="store_true",
                       help="Run in CI mode (exit with error on regression)")

    args = parser.parse_args()

    # Initialize regressor
    regressor = PerformanceRegressor(args.baseline_dir)

    try:
        # Run benchmark
        current_results = regressor.run_current_benchmark(args.sizes)

        # Save baseline if requested
        if args.save_baseline:
            regressor.save_baseline(current_results, args.baseline_name)
            print(f"✅ Baseline '{args.baseline_name}' saved successfully")
            return

        # Compare with baseline
        comparison = regressor.compare_with_baseline(current_results, args.baseline_name)

        # Generate and display report
        report = regressor.generate_regression_report(comparison, current_results)
        print("\n" + report)

        # Handle CI mode
        if args.ci_mode:
            success = comparison.get("overall_status") == "PASS"
            sys.exit(0 if success else 1)

    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()