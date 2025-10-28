#!/usr/bin/env python3
"""
Generate a comprehensive Markdown report from shadow benchmark results
"""

import json
import sys
from datetime import datetime
from pathlib import Path


def load_results(input_file: str) -> dict:
    """Load benchmark results from JSON file"""
    with open(input_file, 'r') as f:
        return json.load(f)


def generate_markdown_report(data: dict, output_file: str):
    """Generate a detailed Markdown report from benchmark data"""

    metadata = data.get('metadata', {})
    metrics = data.get('metrics', {})

    # Start building the report
    report = []

    # Header
    report.append("# Schlep-Engine Shadow Benchmark Report v2")
    report.append("")
    report.append(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append(f"**Benchmark Date:** {metadata.get('benchmark_date', 'N/A')}")
    report.append(f"**API Endpoint:** {metadata.get('base_url', 'N/A')}")
    report.append("")
    report.append("---")
    report.append("")

    # Executive Summary
    summary = metrics.get('summary', {})
    report.append("## Executive Summary")
    report.append("")
    report.append(f"- **Total Requests:** {summary.get('total_requests', 0):,}")
    report.append(f"- **Successful Requests:** {summary.get('successful_requests', 0):,}")
    report.append(f"- **Failed Requests:** {summary.get('failed_requests', 0):,}")
    report.append(f"- **Success Rate:** {summary.get('success_rate', 0):.2f}%")
    report.append("")

    # Latency Metrics
    latency = metrics.get('latency', {})
    report.append("## Latency Performance")
    report.append("")
    report.append("| Metric | Value (ms) |")
    report.append("|--------|------------|")
    report.append(f"| Mean | {latency.get('mean_ms', 0):.2f} |")
    report.append(f"| Median (P50) | {latency.get('median_ms', 0):.2f} |")
    report.append(f"| P95 | {latency.get('p95_ms', 0):.2f} |")
    report.append(f"| P99 | {latency.get('p99_ms', 0):.2f} |")
    report.append(f"| Min | {latency.get('min_ms', 0):.2f} |")
    report.append(f"| Max | {latency.get('max_ms', 0):.2f} |")
    report.append(f"| Std Dev | {latency.get('stddev_ms', 0):.2f} |")
    report.append("")

    # Cost Analysis
    cost = metrics.get('cost', {})
    report.append("## Cost Analysis")
    report.append("")
    report.append(f"- **Total Cost:** ${cost.get('total_usd', 0):.6f}")
    report.append(f"- **Mean Cost per Request:** ${cost.get('mean_per_request_usd', 0):.6f}")
    report.append(f"- **Median Cost per Request:** ${cost.get('median_per_request_usd', 0):.6f}")
    report.append(f"- **Projected Cost per 1K Requests:** ${cost.get('cost_per_1k_requests_usd', 0):.4f}")
    report.append("")

    # Token Usage
    tokens = metrics.get('tokens', {})
    report.append("## Token Usage")
    report.append("")
    report.append(f"- **Total Tokens:** {tokens.get('total', 0):,}")
    report.append(f"- **Mean Tokens per Request:** {tokens.get('mean_per_request', 0):.2f}")
    report.append(f"- **Median Tokens per Request:** {tokens.get('median_per_request', 0):.2f}")
    report.append("")

    # Provider Breakdown
    providers = metrics.get('providers', {})
    if providers:
        report.append("## Provider Performance Comparison")
        report.append("")
        report.append("| Provider | Requests | % | Avg Latency (ms) | P50 (ms) | P95 (ms) | Avg Cost ($) | Total Cost ($) |")
        report.append("|----------|----------|---|------------------|----------|----------|--------------|----------------|")

        for provider_name, provider_data in providers.items():
            report.append(
                f"| {provider_name} | "
                f"{provider_data.get('request_count', 0):,} | "
                f"{provider_data.get('percentage', 0):.1f}% | "
                f"{provider_data.get('avg_latency_ms', 0):.2f} | "
                f"{provider_data.get('p50_latency_ms', 0):.2f} | "
                f"{provider_data.get('p95_latency_ms', 0):.2f} | "
                f"{provider_data.get('avg_cost_usd', 0):.6f} | "
                f"{provider_data.get('total_cost_usd', 0):.6f} |"
            )
        report.append("")

    # Shadow Mode Analysis (if applicable)
    if 'shadow' in metrics:
        shadow = metrics['shadow']
        report.append("## Shadow Mode Analysis")
        report.append("")
        report.append("### Optimizer Comparison")
        report.append("")
        report.append("| Optimizer | Requests | Avg Latency (ms) | Avg Cost ($) |")
        report.append("|-----------|----------|------------------|--------------|")
        for opt_name, opt_data in shadow.get('optimizers', {}).items():
            report.append(
                f"| {opt_name} | "
                f"{opt_data.get('count', 0):,} | "
                f"{opt_data.get('avg_latency_ms', 0):.2f} | "
                f"{opt_data.get('avg_cost_usd', 0):.6f} |"
            )
        report.append("")

    # Error Analysis
    errors = metrics.get('errors', {})
    if errors.get('count', 0) > 0:
        report.append("## Error Analysis")
        report.append("")
        report.append(f"- **Total Errors:** {errors.get('count', 0):,}")
        report.append(f"- **Error Rate:** {errors.get('rate', 0):.2f}%")
        report.append("")

        error_details = errors.get('details', [])
        if error_details:
            report.append("### Sample Errors (First 10)")
            report.append("")
            for i, error in enumerate(error_details[:10], 1):
                report.append(f"{i}. **Request #{error.get('request_id', 'N/A')}** - Status {error.get('status_code', 0)}")
                report.append(f"   - Model: {error.get('model_requested', 'N/A')}")
                report.append(f"   - Error: {error.get('error', 'Unknown')[:100]}...")
                report.append("")

    # Key Insights
    report.append("## Key Insights")
    report.append("")

    # Calculate some insights
    if providers:
        fastest_provider = min(providers.items(), key=lambda x: x[1].get('avg_latency_ms', float('inf')))
        cheapest_provider = min(providers.items(), key=lambda x: x[1].get('avg_cost_usd', float('inf')))

        report.append(f"- **Fastest Provider:** {fastest_provider[0]} ({fastest_provider[1].get('avg_latency_ms', 0):.2f}ms avg)")
        report.append(f"- **Most Cost-Effective:** {cheapest_provider[0]} (${cheapest_provider[1].get('avg_cost_usd', 0):.6f} avg)")

    success_rate = summary.get('success_rate', 0)
    if success_rate >= 99.9:
        report.append(f"- **Reliability:** Excellent ({success_rate:.2f}% success rate)")
    elif success_rate >= 99.0:
        report.append(f"- **Reliability:** Good ({success_rate:.2f}% success rate)")
    else:
        report.append(f"- **Reliability:** Needs attention ({success_rate:.2f}% success rate)")

    p95_latency = latency.get('p95_ms', 0)
    if p95_latency < 1000:
        report.append(f"- **P95 Latency:** Excellent ({p95_latency:.2f}ms)")
    elif p95_latency < 2000:
        report.append(f"- **P95 Latency:** Good ({p95_latency:.2f}ms)")
    else:
        report.append(f"- **P95 Latency:** Needs optimization ({p95_latency:.2f}ms)")

    report.append("")

    # Recommendations
    report.append("## Recommendations")
    report.append("")

    if success_rate < 99.5:
        report.append("- ⚠️ **Improve Reliability:** Success rate is below 99.5%. Investigate error patterns.")

    if p95_latency > 2000:
        report.append("- ⚠️ **Optimize Latency:** P95 latency exceeds 2 seconds. Consider caching or provider optimization.")

    if providers:
        # Check if there's a significant cost difference between providers
        costs = [p.get('avg_cost_usd', 0) for p in providers.values()]
        if max(costs) > min(costs) * 2:
            report.append("- 💰 **Cost Optimization Opportunity:** Significant cost variation between providers detected.")

    report.append("- ✅ **Monitor Trends:** Continue tracking metrics over time to identify patterns.")
    report.append("")

    # Footer
    report.append("---")
    report.append("")
    report.append("*Generated by Schlep-Engine Shadow Benchmark Report Generator*")
    report.append("")

    # Write report to file
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, 'w') as f:
        f.write('\n'.join(report))

    print(f"Report generated successfully: {output_file}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python generate_report.py <input_json> [output_md]")
        print("Example: python generate_report.py benchmarks/results/shadow_benchmark_v2.json docs/reports/shadow_benchmark_v2.md")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else "docs/reports/shadow_benchmark_report.md"

    if not Path(input_file).exists():
        print(f"Error: Input file not found: {input_file}")
        sys.exit(1)

    print(f"Loading results from: {input_file}")
    data = load_results(input_file)

    print(f"Generating report...")
    generate_markdown_report(data, output_file)

    print("Done!")


if __name__ == '__main__':
    main()
