#!/usr/bin/env python3
"""
Rust Integration Strategy and Decision Framework for Schlep Engine

This module provides the decision framework for when to use PyO3 Rust kernels
vs microservices vs staying with Python/Polars.
"""

import os
import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Any
from enum import Enum


class IntegrationApproach(Enum):
    """Available integration approaches"""
    PYTHON_ONLY = "python_only"
    POLARS_MIGRATION = "polars_migration"
    RUST_PyO3 = "rust_pyo3"
    RUST_MICROSERVICE = "rust_microservice"
    HYBRID_APPROACH = "hybrid_approach"


@dataclass
class PerformanceMetrics:
    """Performance characteristics for decision making"""
    cpu_usage_percent: float
    memory_usage_mb: float
    execution_time_ms: float
    data_size_mb: float
    concurrency_level: int
    frequency_per_day: int


@dataclass
class IntegrationRecommendation:
    """Recommendation for integration approach"""
    approach: IntegrationApproach
    confidence: float  # 0-1 scale
    rationale: str
    implementation_effort: int  # 1-10 scale
    maintenance_burden: int  # 1-10 scale
    expected_speedup: float  # multiplication factor


class RustIntegrationDecisionFramework:
    """
    Decision framework for choosing the right integration approach

    Based on the Schlep Engine audit results:
    - CSV reading: 72.8% CPU bottleneck -> 6.22x Polars speedup, 10-20x Rust speedup
    - Aggregations: 14.4% CPU bottleneck -> 5.45x Polars speedup, 6-15x Rust speedup
    - String operations: Variable bottleneck -> 10-25x Rust speedup
    """

    def __init__(self):
        # Thresholds based on audit findings
        self.POLARS_THRESHOLD_CPU = 10.0  # % CPU usage
        self.RUST_THRESHOLD_CPU = 30.0    # % CPU usage
        self.MICROSERVICE_THRESHOLD_DATA = 1000.0  # MB data size
        self.HIGH_FREQUENCY_THRESHOLD = 1000  # operations per day

        # Known bottleneck functions from audit
        self.CSV_BOTTLENECKS = [
            'pandas.read_csv',
            'csv_processing',
            'data_loading',
            'file_parsing'
        ]

        self.AGGREGATION_BOTTLENECKS = [
            'pandas.groupby',
            'pandas.agg',
            'pandas.pivot_table',
            'statistical_operations',
            'data_aggregation'
        ]

        self.STRING_BOTTLENECKS = [
            'pandas.str.*',
            'string_processing',
            'text_cleaning',
            'regex_operations'
        ]

    def analyze_function(self,
                        function_name: str,
                        metrics: PerformanceMetrics,
                        current_implementation: str = "pandas") -> IntegrationRecommendation:
        """
        Analyze a specific function and recommend integration approach

        Args:
            function_name: Name or category of the function
            metrics: Current performance metrics
            current_implementation: Current technology (pandas/polars/rust)

        Returns:
            IntegrationRecommendation with suggested approach
        """

        # Step 1: Identify bottleneck category
        bottleneck_category = self._categorize_bottleneck(function_name)

        # Step 2: Apply decision rules
        if metrics.cpu_usage_percent < self.POLARS_THRESHOLD_CPU:
            return IntegrationRecommendation(
                approach=IntegrationApproach.PYTHON_ONLY,
                confidence=0.9,
                rationale="Low CPU usage, Python performance is sufficient",
                implementation_effort=1,
                maintenance_burden=2,
                expected_speedup=1.0
            )

        # CSV processing decision tree
        if bottleneck_category == "csv":
            return self._analyze_csv_bottleneck(metrics)

        # Aggregation processing decision tree
        elif bottleneck_category == "aggregation":
            return self._analyze_aggregation_bottleneck(metrics)

        # String processing decision tree
        elif bottleneck_category == "string":
            return self._analyze_string_bottleneck(metrics)

        # General high-CPU operations
        elif metrics.cpu_usage_percent > self.RUST_THRESHOLD_CPU:
            return self._analyze_high_cpu_operation(metrics)

        # Default to Polars migration
        else:
            return IntegrationRecommendation(
                approach=IntegrationApproach.POLARS_MIGRATION,
                confidence=0.7,
                rationale="Moderate bottleneck, Polars provides good speedup with low effort",
                implementation_effort=3,
                maintenance_burden=3,
                expected_speedup=2.5
            )

    def _categorize_bottleneck(self, function_name: str) -> str:
        """Categorize the type of bottleneck"""
        function_lower = function_name.lower()

        for csv_pattern in self.CSV_BOTTLENECKS:
            if csv_pattern.replace('*', '').replace('.', '') in function_lower:
                return "csv"

        for agg_pattern in self.AGGREGATION_BOTTLENECKS:
            if agg_pattern.replace('*', '').replace('.', '') in function_lower:
                return "aggregation"

        for str_pattern in self.STRING_BOTTLENECKS:
            if str_pattern.replace('*', '').replace('.', '') in function_lower:
                return "string"

        return "general"

    def _analyze_csv_bottleneck(self, metrics: PerformanceMetrics) -> IntegrationRecommendation:
        """Analyze CSV processing bottlenecks - 72.8% of CPU time identified"""

        # Large file processing -> Rust with memory mapping
        if metrics.data_size_mb > 500:
            return IntegrationRecommendation(
                approach=IntegrationApproach.RUST_PyO3,
                confidence=0.95,
                rationale="Large CSV files (>500MB) benefit significantly from Rust memory mapping",
                implementation_effort=6,
                maintenance_burden=4,
                expected_speedup=15.0  # Based on memory mapping + parallel processing
            )

        # High frequency processing -> Rust microservice
        elif metrics.frequency_per_day > self.HIGH_FREQUENCY_THRESHOLD:
            return IntegrationRecommendation(
                approach=IntegrationApproach.RUST_MICROSERVICE,
                confidence=0.85,
                rationale="High frequency CSV processing benefits from dedicated Rust service",
                implementation_effort=8,
                maintenance_burden=6,
                expected_speedup=12.0
            )

        # Medium files -> PyO3 kernels
        elif metrics.data_size_mb > 50:
            return IntegrationRecommendation(
                approach=IntegrationApproach.RUST_PyO3,
                confidence=0.8,
                rationale="Medium CSV files see good speedup with Rust parallel processing",
                implementation_effort=5,
                maintenance_burden=4,
                expected_speedup=8.0
            )

        # Small files -> Polars is sufficient
        else:
            return IntegrationRecommendation(
                approach=IntegrationApproach.POLARS_MIGRATION,
                confidence=0.75,
                rationale="Small CSV files, Polars provides good speedup with less complexity",
                implementation_effort=2,
                maintenance_burden=2,
                expected_speedup=6.22  # From audit results
            )

    def _analyze_aggregation_bottleneck(self, metrics: PerformanceMetrics) -> IntegrationRecommendation:
        """Analyze aggregation bottlenecks - 14.4% of CPU time identified"""

        # Complex multi-column aggregations -> Rust
        if metrics.cpu_usage_percent > 40 and metrics.data_size_mb > 100:
            return IntegrationRecommendation(
                approach=IntegrationApproach.RUST_PyO3,
                confidence=0.9,
                rationale="Complex aggregations on large datasets benefit from Rust HashMap optimizations",
                implementation_effort=5,
                maintenance_burden=4,
                expected_speedup=10.0
            )

        # High frequency aggregations -> Rust
        elif metrics.frequency_per_day > 2000:
            return IntegrationRecommendation(
                approach=IntegrationApproach.RUST_PyO3,
                confidence=0.85,
                rationale="High frequency aggregations benefit from Rust single-pass algorithms",
                implementation_effort=4,
                maintenance_burden=3,
                expected_speedup=6.36  # From audit results
            )

        # Standard aggregations -> Polars
        else:
            return IntegrationRecommendation(
                approach=IntegrationApproach.POLARS_MIGRATION,
                confidence=0.8,
                rationale="Standard aggregations work well with Polars lazy evaluation",
                implementation_effort=2,
                maintenance_burden=2,
                expected_speedup=5.45  # From audit results
            )

    def _analyze_string_bottleneck(self, metrics: PerformanceMetrics) -> IntegrationRecommendation:
        """Analyze string processing bottlenecks"""

        # Regex-heavy operations -> Rust
        if metrics.cpu_usage_percent > 50:
            return IntegrationRecommendation(
                approach=IntegrationApproach.RUST_PyO3,
                confidence=0.9,
                rationale="Regex and complex string operations see massive speedups in Rust",
                implementation_effort=4,
                maintenance_burden=3,
                expected_speedup=20.0
            )

        # Large text datasets -> Rust
        elif metrics.data_size_mb > 200:
            return IntegrationRecommendation(
                approach=IntegrationApproach.RUST_PyO3,
                confidence=0.85,
                rationale="Large text processing benefits from Rust parallel string operations",
                implementation_effort=5,
                maintenance_burden=4,
                expected_speedup=15.0
            )

        # Standard string ops -> Polars
        else:
            return IntegrationRecommendation(
                approach=IntegrationApproach.POLARS_MIGRATION,
                confidence=0.7,
                rationale="Basic string operations work well with Polars",
                implementation_effort=2,
                maintenance_burden=2,
                expected_speedup=4.0
            )

    def _analyze_high_cpu_operation(self, metrics: PerformanceMetrics) -> IntegrationRecommendation:
        """Analyze general high-CPU operations"""

        if metrics.data_size_mb > self.MICROSERVICE_THRESHOLD_DATA:
            return IntegrationRecommendation(
                approach=IntegrationApproach.RUST_MICROSERVICE,
                confidence=0.75,
                rationale="Very large data processing benefits from dedicated Rust service",
                implementation_effort=9,
                maintenance_burden=7,
                expected_speedup=8.0
            )
        else:
            return IntegrationRecommendation(
                approach=IntegrationApproach.RUST_PyO3,
                confidence=0.8,
                rationale="High CPU usage suggests Rust kernels would provide significant speedup",
                implementation_effort=6,
                maintenance_burden=4,
                expected_speedup=7.0
            )

    def create_migration_plan(self,
                             function_analyses: List[Tuple[str, IntegrationRecommendation]]) -> Dict[str, Any]:
        """
        Create a comprehensive migration plan based on multiple function analyses
        """

        # Group by approach
        approach_groups = {}
        total_expected_speedup = 0
        total_effort = 0

        for func_name, recommendation in function_analyses:
            approach = recommendation.approach
            if approach not in approach_groups:
                approach_groups[approach] = []
            approach_groups[approach].append((func_name, recommendation))
            total_expected_speedup += recommendation.expected_speedup
            total_effort += recommendation.implementation_effort

        # Create prioritized plan
        plan = {
            "overview": {
                "total_functions": len(function_analyses),
                "expected_overall_speedup": total_expected_speedup / len(function_analyses),
                "total_implementation_effort": total_effort,
                "approaches_needed": list(approach_groups.keys())
            },
            "phases": [],
            "rust_integration_specifics": {
                "pyo3_functions": [],
                "microservice_functions": [],
                "polars_migrations": []
            }
        }

        # Phase 1: Quick wins with Polars
        if IntegrationApproach.POLARS_MIGRATION in approach_groups:
            polars_functions = approach_groups[IntegrationApproach.POLARS_MIGRATION]
            plan["phases"].append({
                "phase": 1,
                "name": "Polars Migration (Quick Wins)",
                "functions": [f[0] for f in polars_functions],
                "effort": sum(f[1].implementation_effort for f in polars_functions),
                "expected_speedup": sum(f[1].expected_speedup for f in polars_functions) / len(polars_functions),
                "timeline": "2-4 weeks"
            })

        # Phase 2: High-impact Rust PyO3 kernels
        if IntegrationApproach.RUST_PyO3 in approach_groups:
            rust_functions = approach_groups[IntegrationApproach.RUST_PyO3]
            rust_functions.sort(key=lambda x: x[1].expected_speedup, reverse=True)

            plan["phases"].append({
                "phase": 2,
                "name": "Rust PyO3 Kernels (High Impact)",
                "functions": [f[0] for f in rust_functions],
                "effort": sum(f[1].implementation_effort for f in rust_functions),
                "expected_speedup": sum(f[1].expected_speedup for f in rust_functions) / len(rust_functions),
                "timeline": "6-10 weeks"
            })
            plan["rust_integration_specifics"]["pyo3_functions"] = rust_functions

        # Phase 3: Microservices (if needed)
        if IntegrationApproach.RUST_MICROSERVICE in approach_groups:
            microservice_functions = approach_groups[IntegrationApproach.RUST_MICROSERVICE]
            plan["phases"].append({
                "phase": 3,
                "name": "Rust Microservices (Complex Operations)",
                "functions": [f[0] for f in microservice_functions],
                "effort": sum(f[1].implementation_effort for f in microservice_functions),
                "expected_speedup": sum(f[1].expected_speedup for f in microservice_functions) / len(microservice_functions),
                "timeline": "8-12 weeks"
            })

        return plan


def demo_decision_framework():
    """Demonstrate the decision framework with example scenarios"""

    framework = RustIntegrationDecisionFramework()

    # Example scenarios based on audit results
    scenarios = [
        {
            "name": "Large CSV Processing",
            "function": "pandas.read_csv",
            "metrics": PerformanceMetrics(
                cpu_usage_percent=65.0,
                memory_usage_mb=2048,
                execution_time_ms=15000,
                data_size_mb=800,
                concurrency_level=4,
                frequency_per_day=50
            )
        },
        {
            "name": "High-Frequency Aggregations",
            "function": "pandas.groupby.agg",
            "metrics": PerformanceMetrics(
                cpu_usage_percent=35.0,
                memory_usage_mb=512,
                execution_time_ms=5000,
                data_size_mb=150,
                concurrency_level=8,
                frequency_per_day=2500
            )
        },
        {
            "name": "Text Processing Pipeline",
            "function": "string_processing_pipeline",
            "metrics": PerformanceMetrics(
                cpu_usage_percent=55.0,
                memory_usage_mb=1024,
                execution_time_ms=8000,
                data_size_mb=300,
                concurrency_level=2,
                frequency_per_day=800
            )
        }
    ]

    print("Rust Integration Decision Framework")
    print("=" * 50)
    print("Based on Schlep Engine performance audit results")
    print("Target bottlenecks: CSV (72.8% CPU), Aggregations (14.4% CPU)")
    print()

    analyses = []
    for scenario in scenarios:
        print(f"Analyzing: {scenario['name']}")
        print("-" * 30)

        recommendation = framework.analyze_function(
            scenario["function"],
            scenario["metrics"]
        )

        analyses.append((scenario["name"], recommendation))

        print(f"→ Approach: {recommendation.approach.value.upper()}")
        print(f"→ Expected Speedup: {recommendation.expected_speedup:.1f}x")
        print(f"→ Confidence: {recommendation.confidence:.0%}")
        print(f"→ Effort: {recommendation.implementation_effort}/10")
        print(f"→ {recommendation.rationale}")
        print()

    # Generate migration plan
    print("RECOMMENDED MIGRATION PLAN")
    print("=" * 50)

    plan = framework.create_migration_plan(analyses)
    print(f"Expected Overall Speedup: {plan['overview']['expected_overall_speedup']:.1f}x")
    print(f"Total Implementation Effort: {plan['overview']['total_implementation_effort']} points")
    print()

    for phase in plan["phases"]:
        print(f"Phase {phase['phase']}: {phase['name']}")
        print(f"  • Functions: {', '.join(phase['functions'])}")
        print(f"  • Expected Speedup: {phase['expected_speedup']:.1f}x")
        print(f"  • Timeline: {phase['timeline']}")
        print()


if __name__ == "__main__":
    demo_decision_framework()