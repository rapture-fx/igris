#!/usr/bin/env python3
"""
Critical P0 Fixes Test Execution Script
======================================

Comprehensive test runner for validating critical P0 fixes.
Executes all test suites, generates reports, and provides production readiness validation.

Usage:
    python run_critical_fixes_tests.py [options]

Options:
    --smoke-only        Run only smoke tests for quick validation
    --performance-only  Run only performance and load tests
    --security-only     Run only security tests
    --integration-only  Run only integration tests
    --generate-report   Generate comprehensive test report
    --ci-mode           Run in CI/CD mode with appropriate settings
    --coverage-target   Set minimum coverage target (default: 80)
"""

import asyncio
import argparse
import sys
import os
import subprocess
import json
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional

import pytest
import psutil


class CriticalFixesTestRunner:
    """Comprehensive test runner for critical P0 fixes validation."""

    def __init__(self, args):
        self.args = args
        self.start_time = datetime.utcnow()
        self.test_results = {}
        self.coverage_results = {}
        self.performance_metrics = {}

        # Configure test paths
        self.test_dir = Path(__file__).parent
        self.project_root = self.test_dir.parent.parent.parent
        self.reports_dir = self.test_dir / "reports"
        self.reports_dir.mkdir(exist_ok=True)

    def run_all_tests(self) -> int:
        """Run all critical fixes tests and generate comprehensive report."""
        print("=" * 80)
        print("CRITICAL P0 FIXES VALIDATION TEST SUITE")
        print("=" * 80)
        print(f"Started at: {self.start_time}")
        print(f"Test directory: {self.test_dir}")
        print(f"Reports directory: {self.reports_dir}")
        print()

        try:
            # Run test suites based on arguments
            if self.args.smoke_only:
                return self._run_smoke_tests()
            elif self.args.performance_only:
                return self._run_performance_tests()
            elif self.args.security_only:
                return self._run_security_tests()
            elif self.args.integration_only:
                return self._run_integration_tests()
            else:
                return self._run_complete_test_suite()

        except KeyboardInterrupt:
            print("\nTest execution interrupted by user.")
            return 1
        except Exception as e:
            print(f"\nTest execution failed with error: {e}")
            return 1
        finally:
            if self.args.generate_report:
                self._generate_comprehensive_report()

    def _run_smoke_tests(self) -> int:
        """Run smoke tests for quick validation."""
        print("Running smoke tests for quick validation...")

        smoke_tests = [
            "test_rl_optimization_database_persistence.py::TestRLOptimizationDatabaseModels::test_rl_optimization_session_table_exists",
            "test_data_quality_api_runtime_errors.py::TestSupportedFileFormats::test_csv_file_processing_success",
            "test_security_configuration_validation.py::TestCSRFProtectionValidation::test_csrf_token_generation_and_validation"
        ]

        return self._run_pytest_with_markers(["smoke"], extra_tests=smoke_tests)

    def _run_performance_tests(self) -> int:
        """Run performance and load tests."""
        print("Running performance and load tests...")
        return self._run_pytest_with_markers(["performance", "load_test"])

    def _run_security_tests(self) -> int:
        """Run security configuration tests."""
        print("Running security configuration tests...")
        return self._run_pytest_with_markers(["security"])

    def _run_integration_tests(self) -> int:
        """Run integration tests."""
        print("Running integration tests...")
        return self._run_pytest_with_markers(["integration"])

    def _run_complete_test_suite(self) -> int:
        """Run complete test suite with all categories."""
        print("Running complete critical fixes test suite...")

        # Run tests in logical order
        test_categories = [
            ("Database Tests", ["database"]),
            ("Security Tests", ["security"]),
            ("Data Quality Tests", ["data_quality"]),
            ("RL Optimization Tests", ["rl_optimization"]),
            ("Integration Tests", ["integration"]),
            ("Performance Tests", ["performance", "load_test"])
        ]

        overall_success = True

        for category_name, markers in test_categories:
            print(f"\n{'-' * 60}")
            print(f"Running {category_name}")
            print(f"{'-' * 60}")

            result = self._run_pytest_with_markers(markers)
            self.test_results[category_name] = {
                "success": result == 0,
                "exit_code": result
            }

            if result != 0:
                overall_success = False
                if not self.args.ci_mode:
                    # In interactive mode, ask if user wants to continue
                    response = input(f"\n{category_name} failed. Continue with remaining tests? (y/n): ")
                    if response.lower() != 'y':
                        break

        return 0 if overall_success else 1

    def _run_pytest_with_markers(self, markers: List[str], extra_tests: List[str] = None) -> int:
        """Run pytest with specific markers."""
        pytest_args = [
            "--verbose",
            "--tb=short",
            f"--cov=app",
            f"--cov-report=term-missing",
            f"--cov-report=html:{self.reports_dir}/htmlcov",
            f"--cov-report=xml:{self.reports_dir}/coverage.xml",
            f"--cov-fail-under={self.args.coverage_target}",
            f"--junitxml={self.reports_dir}/test-results.xml",
            "--durations=10"
        ]

        # Add CI-specific settings
        if self.args.ci_mode:
            pytest_args.extend([
                "--quiet",
                "--no-header",
                "--tb=line"
            ])

        # Add marker filters
        if markers:
            marker_expression = " or ".join(markers)
            pytest_args.extend(["-m", marker_expression])

        # Add specific tests if provided
        if extra_tests:
            pytest_args.extend(extra_tests)
        else:
            pytest_args.append(str(self.test_dir))

        # Run pytest
        start_time = time.time()
        exit_code = pytest.main(pytest_args)
        end_time = time.time()

        # Record execution time
        execution_time = end_time - start_time
        self.performance_metrics[f"execution_time_{'_'.join(markers)}"] = execution_time

        return exit_code

    def _generate_comprehensive_report(self):
        """Generate comprehensive test report."""
        print("\n" + "=" * 80)
        print("GENERATING COMPREHENSIVE TEST REPORT")
        print("=" * 80)

        report = {
            "test_execution": {
                "start_time": self.start_time.isoformat(),
                "end_time": datetime.utcnow().isoformat(),
                "total_duration": str(datetime.utcnow() - self.start_time),
                "test_results": self.test_results,
                "performance_metrics": self.performance_metrics
            },
            "system_info": self._get_system_info(),
            "coverage_summary": self._get_coverage_summary(),
            "recommendations": self._generate_recommendations()
        }

        # Save JSON report
        report_file = self.reports_dir / f"critical_fixes_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)

        # Generate HTML report
        self._generate_html_report(report, report_file)

        print(f"Comprehensive report saved to: {report_file}")
        print(f"HTML report saved to: {report_file.with_suffix('.html')}")

    def _get_system_info(self) -> Dict[str, Any]:
        """Get system information for the report."""
        return {
            "python_version": sys.version,
            "platform": sys.platform,
            "cpu_count": psutil.cpu_count(),
            "memory_total_gb": round(psutil.virtual_memory().total / (1024**3), 2),
            "disk_total_gb": round(psutil.disk_usage('/').total / (1024**3), 2),
            "environment_variables": {
                key: os.environ.get(key, "not_set")
                for key in ["ENVIRONMENT", "DATABASE_URL", "CSRF_PROTECTION_ENABLED", "RATE_LIMITING_ENABLED"]
            }
        }

    def _get_coverage_summary(self) -> Dict[str, Any]:
        """Get test coverage summary."""
        coverage_file = self.reports_dir / "coverage.json"
        if coverage_file.exists():
            try:
                with open(coverage_file, 'r') as f:
                    coverage_data = json.load(f)
                return {
                    "total_coverage": coverage_data.get("totals", {}).get("percent_covered", 0),
                    "lines_covered": coverage_data.get("totals", {}).get("covered_lines", 0),
                    "lines_missing": coverage_data.get("totals", {}).get("missing_lines", 0),
                    "files_tested": len(coverage_data.get("files", {}))
                }
            except Exception as e:
                return {"error": f"Failed to parse coverage data: {e}"}

        return {"status": "coverage_data_not_available"}

    def _generate_recommendations(self) -> List[str]:
        """Generate recommendations based on test results."""
        recommendations = []

        # Check test results
        failed_categories = [name for name, result in self.test_results.items() if not result.get("success", True)]
        if failed_categories:
            recommendations.append(f"CRITICAL: Fix failing test categories: {', '.join(failed_categories)}")

        # Check coverage
        coverage_summary = self._get_coverage_summary()
        if "total_coverage" in coverage_summary:
            coverage = coverage_summary["total_coverage"]
            if coverage < self.args.coverage_target:
                recommendations.append(f"Improve test coverage from {coverage}% to target {self.args.coverage_target}%")

        # Check performance
        slow_tests = [metric for metric, time in self.performance_metrics.items() if time > 300]  # 5 minutes
        if slow_tests:
            recommendations.append(f"Optimize slow test categories: {', '.join(slow_tests)}")

        # Production readiness assessment
        if not failed_categories and coverage_summary.get("total_coverage", 0) >= self.args.coverage_target:
            recommendations.append("✅ PRODUCTION READY: All critical fixes validated successfully")
        else:
            recommendations.append("❌ NOT PRODUCTION READY: Critical issues found that must be resolved")

        if not recommendations:
            recommendations.append("All tests passed successfully. System appears ready for production.")

        return recommendations

    def _generate_html_report(self, report: Dict[str, Any], json_file: Path):
        """Generate HTML version of the report."""
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Critical P0 Fixes Validation Report</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .header {{ background-color: #f0f0f0; padding: 20px; border-radius: 5px; }}
        .section {{ margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }}
        .success {{ background-color: #d4edda; color: #155724; }}
        .failure {{ background-color: #f8d7da; color: #721c24; }}
        .warning {{ background-color: #fff3cd; color: #856404; }}
        .info {{ background-color: #d1ecf1; color: #0c5460; }}
        table {{ border-collapse: collapse; width: 100%; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background-color: #f2f2f2; }}
        .metric {{ font-family: monospace; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Critical P0 Fixes Validation Report</h1>
        <p><strong>Generated:</strong> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
        <p><strong>Duration:</strong> {report['test_execution']['total_duration']}</p>
    </div>

    <div class="section">
        <h2>Executive Summary</h2>
        <div class="{'success' if not any(not r.get('success', True) for r in report['test_execution']['test_results'].values()) else 'failure'}">
            <h3>Overall Status: {'PASSED' if not any(not r.get('success', True) for r in report['test_execution']['test_results'].values()) else 'FAILED'}</h3>
        </div>

        <h3>Recommendations</h3>
        <ul>
            {''.join(f'<li>{rec}</li>' for rec in report['recommendations'])}
        </ul>
    </div>

    <div class="section">
        <h2>Test Results by Category</h2>
        <table>
            <tr><th>Category</th><th>Status</th><th>Exit Code</th></tr>
            {''.join(f'''
            <tr class="{'success' if result.get('success', True) else 'failure'}">
                <td>{category}</td>
                <td>{'PASSED' if result.get('success', True) else 'FAILED'}</td>
                <td class="metric">{result.get('exit_code', 'N/A')}</td>
            </tr>
            ''' for category, result in report['test_execution']['test_results'].items())}
        </table>
    </div>

    <div class="section">
        <h2>Coverage Summary</h2>
        <table>
            <tr><th>Metric</th><th>Value</th></tr>
            {''.join(f'<tr><td>{key.replace("_", " ").title()}</td><td class="metric">{value}</td></tr>'
                    for key, value in report['coverage_summary'].items())}
        </table>
    </div>

    <div class="section">
        <h2>Performance Metrics</h2>
        <table>
            <tr><th>Test Category</th><th>Execution Time (seconds)</th></tr>
            {''.join(f'<tr><td>{metric}</td><td class="metric">{time:.2f}</td></tr>'
                    for metric, time in report['performance_metrics'].items())}
        </table>
    </div>

    <div class="section info">
        <h2>System Information</h2>
        <table>
            <tr><th>Component</th><th>Value</th></tr>
            <tr><td>Python Version</td><td class="metric">{report['system_info']['python_version']}</td></tr>
            <tr><td>Platform</td><td class="metric">{report['system_info']['platform']}</td></tr>
            <tr><td>CPU Count</td><td class="metric">{report['system_info']['cpu_count']}</td></tr>
            <tr><td>Memory Total (GB)</td><td class="metric">{report['system_info']['memory_total_gb']}</td></tr>
            <tr><td>Disk Total (GB)</td><td class="metric">{report['system_info']['disk_total_gb']}</td></tr>
        </table>

        <h3>Environment Variables</h3>
        <table>
            <tr><th>Variable</th><th>Value</th></tr>
            {''.join(f'<tr><td>{key}</td><td class="metric">{value}</td></tr>'
                    for key, value in report['system_info']['environment_variables'].items())}
        </table>
    </div>

    <div class="section">
        <h2>Detailed Reports</h2>
        <ul>
            <li><a href="htmlcov/index.html">Test Coverage Report</a></li>
            <li><a href="test-results.xml">JUnit XML Results</a></li>
            <li><a href="{json_file.name}">Raw JSON Report</a></li>
        </ul>
    </div>
</body>
</html>
"""

        html_file = json_file.with_suffix('.html')
        with open(html_file, 'w') as f:
            f.write(html_content)


def main():
    """Main entry point for the test runner."""
    parser = argparse.ArgumentParser(
        description="Critical P0 Fixes Test Execution Script",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python run_critical_fixes_tests.py                    # Run all tests
    python run_critical_fixes_tests.py --smoke-only       # Quick smoke tests
    python run_critical_fixes_tests.py --performance-only # Performance tests only
    python run_critical_fixes_tests.py --ci-mode          # CI/CD mode
    python run_critical_fixes_tests.py --generate-report  # Generate comprehensive report
        """
    )

    parser.add_argument(
        "--smoke-only",
        action="store_true",
        help="Run only smoke tests for quick validation"
    )

    parser.add_argument(
        "--performance-only",
        action="store_true",
        help="Run only performance and load tests"
    )

    parser.add_argument(
        "--security-only",
        action="store_true",
        help="Run only security tests"
    )

    parser.add_argument(
        "--integration-only",
        action="store_true",
        help="Run only integration tests"
    )

    parser.add_argument(
        "--generate-report",
        action="store_true",
        help="Generate comprehensive test report"
    )

    parser.add_argument(
        "--ci-mode",
        action="store_true",
        help="Run in CI/CD mode with appropriate settings"
    )

    parser.add_argument(
        "--coverage-target",
        type=int,
        default=80,
        help="Set minimum coverage target (default: 80)"
    )

    args = parser.parse_args()

    # Create and run test runner
    runner = CriticalFixesTestRunner(args)
    exit_code = runner.run_all_tests()

    # Print final summary
    print("\n" + "=" * 80)
    print("TEST EXECUTION COMPLETE")
    print("=" * 80)
    print(f"Exit code: {exit_code}")
    print(f"Duration: {datetime.utcnow() - runner.start_time}")

    if exit_code == 0:
        print("✅ All critical fixes validated successfully!")
        print("   System is ready for production deployment.")
    else:
        print("❌ Critical fixes validation failed!")
        print("   Review test results and fix issues before production deployment.")

    return exit_code


if __name__ == "__main__":
    sys.exit(main())