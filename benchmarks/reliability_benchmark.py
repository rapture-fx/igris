#!/usr/bin/env python3
"""
Igris Inertial Reliability Validation Benchmark
Tests rate-limiting and fallback improvements with 1000 live API requests
"""

import requests
import json
import time
import statistics
from datetime import datetime
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
import sys
import os

class ReliabilityBenchmark:
    def __init__(self, base_url: str, num_requests: int = 1000, workers: int = 20):
        self.base_url = base_url
        self.num_requests = num_requests
        self.workers = workers
        self.results = []
        self.errors = []
        self.rate_limit_errors = []
        self.start_timestamp = None
        self.end_timestamp = None

    def send_inference_request(self, request_id: int, model: str) -> Dict[str, Any]:
        """Send a single inference request and record metrics"""
        start_time = time.time()

        # Vary the prompts to simulate realistic workload
        prompts = [
            "Explain quantum computing in simple terms.",
            "What are the benefits of renewable energy?",
            "How does machine learning work?",
            "Describe the water cycle.",
            "What is the importance of biodiversity?"
        ]

        payload = {
            "model": model,
            "messages": [
                {"role": "user", "content": prompts[request_id % len(prompts)]}
            ],
            "max_tokens": 50  # Keep tokens low to reduce cost
        }

        try:
            response = requests.post(
                f"{self.base_url}/v1/infer",
                json=payload,
                timeout=60  # Longer timeout to account for rate limiting and queueing
            )

            end_time = time.time()
            latency_ms = (end_time - start_time) * 1000

            if response.status_code == 200:
                data = response.json()
                metadata = data.get('metadata', {})

                result = {
                    "request_id": request_id,
                    "model_requested": model,
                    "success": True,
                    "status_code": response.status_code,
                    "latency_ms": latency_ms,
                    "provider": metadata.get('provider', 'unknown'),
                    "model_used": metadata.get('model_used', 'unknown'),
                    "cost_usd": metadata.get('cost_usd', 0.0),
                    "tokens_prompt": data.get('usage', {}).get('prompt_tokens', 0),
                    "tokens_completion": data.get('usage', {}).get('completion_tokens', 0),
                    "tokens_total": data.get('usage', {}).get('total_tokens', 0),
                    "fallback": metadata.get('fallback', False),
                    "timestamp": datetime.now().isoformat()
                }

                return result
            else:
                # Check if it's a rate limit error
                is_rate_limit = response.status_code == 429

                error_result = {
                    "request_id": request_id,
                    "model_requested": model,
                    "success": False,
                    "status_code": response.status_code,
                    "latency_ms": latency_ms,
                    "error": response.text[:200],  # Truncate long errors
                    "is_rate_limit": is_rate_limit,
                    "timestamp": datetime.now().isoformat()
                }

                return error_result

        except Exception as e:
            end_time = time.time()
            latency_ms = (end_time - start_time) * 1000

            return {
                "request_id": request_id,
                "model_requested": model,
                "success": False,
                "status_code": 0,
                "latency_ms": latency_ms,
                "error": str(e),
                "is_rate_limit": False,
                "timestamp": datetime.now().isoformat()
            }

    def run_concurrent(self):
        """Run benchmark with concurrent requests"""
        print(f"\n{'='*80}")
        print(f"🚀 RELIABILITY VALIDATION BENCHMARK")
        print(f"{'='*80}")
        print(f"Configuration:")
        print(f"  Target URL:       {self.base_url}")
        print(f"  Total Requests:   {self.num_requests}")
        print(f"  Concurrent Workers: {self.workers}")
        print(f"  Models:           gpt-4, claude-3-haiku-20240307")
        print(f"{'='*80}\n")

        # Alternate between models
        models = ["gpt-4", "claude-3-haiku-20240307"]

        self.start_timestamp = datetime.now()
        start_time = time.time()

        with ThreadPoolExecutor(max_workers=self.workers) as executor:
            futures = []
            for i in range(self.num_requests):
                model = models[i % len(models)]
                future = executor.submit(self.send_inference_request, i + 1, model)
                futures.append(future)

            completed = 0
            last_progress = 0

            for future in as_completed(futures):
                result = future.result()

                if result['success']:
                    self.results.append(result)
                else:
                    self.errors.append(result)
                    if result.get('is_rate_limit', False):
                        self.rate_limit_errors.append(result)

                completed += 1
                progress_pct = (completed / self.num_requests) * 100

                # Print progress every 10%
                if int(progress_pct / 10) > int(last_progress / 10):
                    elapsed = time.time() - start_time
                    rate = completed / elapsed if elapsed > 0 else 0
                    print(f"  Progress: {completed}/{self.num_requests} ({progress_pct:.1f}%) | Rate: {rate:.1f} req/s")
                last_progress = progress_pct

        self.end_timestamp = datetime.now()
        end_time = time.time()
        duration = end_time - start_time

        print(f"\n{'='*80}")
        print(f"✅ Benchmark Completed!")
        print(f"  Duration: {duration:.2f} seconds")
        print(f"  Throughput: {self.num_requests / duration:.2f} requests/second")
        print(f"  Successful: {len(self.results)}")
        print(f"  Failed: {len(self.errors)}")
        if self.rate_limit_errors:
            print(f"  Rate Limit Errors: {len(self.rate_limit_errors)}")
        print(f"{'='*80}\n")

    def calculate_metrics(self) -> Dict[str, Any]:
        """Calculate aggregate metrics from results"""
        if not self.results:
            return {"error": "No successful requests to analyze"}

        latencies = [r['latency_ms'] for r in self.results]
        costs = [r['cost_usd'] for r in self.results]
        tokens_total = [r['tokens_total'] for r in self.results]
        fallback_count = sum(1 for r in self.results if r.get('fallback', False))

        # Provider breakdown
        provider_counts = {}
        provider_latencies = {}
        provider_costs = {}

        for result in self.results:
            provider = result['provider']
            if provider not in provider_counts:
                provider_counts[provider] = 0
                provider_latencies[provider] = []
                provider_costs[provider] = []

            provider_counts[provider] += 1
            provider_latencies[provider].append(result['latency_ms'])
            provider_costs[provider].append(result['cost_usd'])

        # Calculate per-provider metrics
        provider_metrics = {}
        for provider in provider_counts:
            lats = provider_latencies[provider]
            provider_metrics[provider] = {
                "request_count": provider_counts[provider],
                "percentage": (provider_counts[provider] / len(self.results)) * 100,
                "avg_latency_ms": statistics.mean(lats),
                "p50_latency_ms": statistics.median(lats),
                "p95_latency_ms": sorted(lats)[int(0.95 * len(lats))] if len(lats) > 0 else 0,
                "p99_latency_ms": sorted(lats)[int(0.99 * len(lats))] if len(lats) > 0 else 0,
                "avg_cost_usd": statistics.mean(provider_costs[provider]),
                "total_cost_usd": sum(provider_costs[provider])
            }

        success_rate = (len(self.results) / self.num_requests) * 100
        total_cost = sum(costs)
        p95_latency = sorted(latencies)[int(0.95 * len(latencies))] if latencies else 0

        # Validation against criteria
        passes_success_rate = success_rate >= 99.0
        passes_p95_latency = p95_latency <= 3000
        passes_cost_budget = total_cost <= 5.0

        metrics = {
            "summary": {
                "total_requests": self.num_requests,
                "successful_requests": len(self.results),
                "failed_requests": len(self.errors),
                "rate_limit_errors": len(self.rate_limit_errors),
                "fallback_count": fallback_count,
                "success_rate": success_rate
            },
            "latency": {
                "mean_ms": statistics.mean(latencies),
                "median_ms": statistics.median(latencies),
                "p50_ms": statistics.median(latencies),
                "p95_ms": p95_latency,
                "p99_ms": sorted(latencies)[int(0.99 * len(latencies))] if latencies else 0,
                "min_ms": min(latencies),
                "max_ms": max(latencies),
                "stddev_ms": statistics.stdev(latencies) if len(latencies) > 1 else 0
            },
            "cost": {
                "total_usd": total_cost,
                "mean_per_request_usd": statistics.mean(costs),
                "median_per_request_usd": statistics.median(costs),
                "cost_per_1k_requests_usd": (total_cost / len(self.results)) * 1000 if self.results else 0
            },
            "tokens": {
                "total": sum(tokens_total),
                "mean_per_request": statistics.mean(tokens_total),
                "median_per_request": statistics.median(tokens_total)
            },
            "providers": provider_metrics,
            "validation": {
                "success_rate": {
                    "actual": success_rate,
                    "target": 99.0,
                    "passed": passes_success_rate
                },
                "p95_latency": {
                    "actual_ms": p95_latency,
                    "target_ms": 3000,
                    "passed": passes_p95_latency
                },
                "total_cost": {
                    "actual_usd": total_cost,
                    "budget_usd": 5.0,
                    "passed": passes_cost_budget
                },
                "all_passed": passes_success_rate and passes_p95_latency and passes_cost_budget
            },
            "errors": {
                "count": len(self.errors),
                "rate": (len(self.errors) / self.num_requests) * 100,
                "rate_limit_count": len(self.rate_limit_errors),
                "details": self.errors[:10] if self.errors else []
            }
        }

        return metrics

    def save_results(self, output_file: str):
        """Save detailed results to JSON file"""
        data = {
            "metadata": {
                "benchmark_name": "Reliability Validation Benchmark",
                "benchmark_date": self.start_timestamp.isoformat() if self.start_timestamp else datetime.now().isoformat(),
                "end_date": self.end_timestamp.isoformat() if self.end_timestamp else datetime.now().isoformat(),
                "base_url": self.base_url,
                "total_requests": self.num_requests,
                "concurrent_workers": self.workers,
                "models": ["gpt-4", "claude-3-haiku-20240307"],
                "successful_requests": len(self.results),
                "failed_requests": len(self.errors)
            },
            "metrics": self.calculate_metrics(),
            "results": self.results,
            "errors": self.errors
        }

        # Ensure directory exists
        os.makedirs(os.path.dirname(output_file), exist_ok=True)

        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2)

        print(f"📄 Results saved to: {output_file}")

    def print_summary(self):
        """Print summary metrics to console"""
        metrics = self.calculate_metrics()

        print(f"\n{'='*80}")
        print(f"📊 BENCHMARK RESULTS")
        print(f"{'='*80}")

        summary = metrics['summary']
        print(f"\n📈 Request Summary:")
        print(f"  Total Requests:    {summary['total_requests']}")
        print(f"  Successful:        {summary['successful_requests']}")
        print(f"  Failed:            {summary['failed_requests']}")
        print(f"  Rate Limit Errors: {summary['rate_limit_errors']}")
        print(f"  Fallback Used:     {summary['fallback_count']}")
        print(f"  Success Rate:      {summary['success_rate']:.2f}%")

        latency = metrics['latency']
        print(f"\n⏱️  Latency (ms):")
        print(f"  Mean:   {latency['mean_ms']:.2f}")
        print(f"  Median: {latency['median_ms']:.2f}")
        print(f"  P95:    {latency['p95_ms']:.2f}")
        print(f"  P99:    {latency['p99_ms']:.2f}")
        print(f"  Min:    {latency['min_ms']:.2f}")
        print(f"  Max:    {latency['max_ms']:.2f}")

        cost = metrics['cost']
        print(f"\n💰 Cost Analysis:")
        print(f"  Total Cost:         ${cost['total_usd']:.6f}")
        print(f"  Mean per Request:   ${cost['mean_per_request_usd']:.6f}")
        print(f"  Cost per 1K Reqs:   ${cost['cost_per_1k_requests_usd']:.4f}")

        tokens_data = metrics['tokens']
        print(f"\n🎯 Token Usage:")
        print(f"  Total Tokens:       {tokens_data['total']}")
        print(f"  Mean per Request:   {tokens_data['mean_per_request']:.2f}")

        print(f"\n🏢 Provider Distribution:")
        for provider, data in metrics['providers'].items():
            print(f"  {provider.upper()}:")
            print(f"    Requests:    {data['request_count']} ({data['percentage']:.1f}%)")
            print(f"    Avg Latency: {data['avg_latency_ms']:.2f}ms")
            print(f"    P95 Latency: {data['p95_latency_ms']:.2f}ms")
            print(f"    Avg Cost:    ${data['avg_cost_usd']:.6f}")
            print(f"    Total Cost:  ${data['total_cost_usd']:.6f}")

        validation = metrics['validation']
        print(f"\n✅ Validation Results:")

        sr = validation['success_rate']
        print(f"  Success Rate:  {sr['actual']:.2f}% (target: ≥{sr['target']}%)")
        print(f"    Status: {'✅ PASS' if sr['passed'] else '❌ FAIL'}")

        lat = validation['p95_latency']
        print(f"  P95 Latency:   {lat['actual_ms']:.2f}ms (target: ≤{lat['target_ms']}ms)")
        print(f"    Status: {'✅ PASS' if lat['passed'] else '❌ FAIL'}")

        cost_val = validation['total_cost']
        print(f"  Total Cost:    ${cost_val['actual_usd']:.6f} (budget: ≤${cost_val['budget_usd']:.2f})")
        print(f"    Status: {'✅ PASS' if cost_val['passed'] else '❌ FAIL'}")

        print(f"\n  Overall: {'✅ ALL VALIDATION CHECKS PASSED' if validation['all_passed'] else '❌ SOME CHECKS FAILED'}")

        if metrics['errors']['count'] > 0:
            print(f"\n⚠️  Errors:")
            print(f"  Count: {metrics['errors']['count']}")
            print(f"  Rate:  {metrics['errors']['rate']:.2f}%")
            if metrics['errors']['rate_limit_count'] > 0:
                print(f"  Rate Limit Errors: {metrics['errors']['rate_limit_count']}")

        print(f"{'='*80}\n")


def main():
    import argparse

    parser = argparse.ArgumentParser(description='Igris Inertial Reliability Validation Benchmark')
    parser.add_argument('--url', default='http://localhost:8081', help='Base URL of Igris Inertial API')
    parser.add_argument('--requests', type=int, default=1000, help='Number of requests to send')
    parser.add_argument('--workers', type=int, default=20, help='Number of concurrent workers')
    parser.add_argument('--output', default='benchmarks/results/reliability_benchmark.json', help='Output file for results')

    args = parser.parse_args()

    # Check if API is accessible
    try:
        response = requests.get(f"{args.url}/v1/health", timeout=5)
        if response.status_code == 200:
            print(f"✅ API is accessible and healthy")
        else:
            print(f"⚠️  API returned status {response.status_code}")
    except Exception as e:
        print(f"❌ Cannot reach API: {e}")
        print("Please ensure the Igris Inertial API is running")
        sys.exit(1)

    # Run benchmark
    benchmark = ReliabilityBenchmark(args.url, args.requests, args.workers)
    benchmark.run_concurrent()

    # Save and display results
    benchmark.save_results(args.output)
    benchmark.print_summary()

    # Return exit code based on validation
    metrics = benchmark.calculate_metrics()
    if metrics['validation']['all_passed']:
        print("🎉 Benchmark PASSED all validation criteria!")
        sys.exit(0)
    else:
        print("⚠️  Benchmark did not meet all validation criteria")
        sys.exit(1)


if __name__ == '__main__':
    main()
