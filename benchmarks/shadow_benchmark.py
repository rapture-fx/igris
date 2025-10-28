#!/usr/bin/env python3
"""
Schlep-Engine Shadow Benchmark
Runs 1000 inference requests across OpenAI and Anthropic providers
Collects metrics for latency, cost, provider selection, and errors
"""

import requests
import json
import time
import statistics
from datetime import datetime
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
import sys

class BenchmarkRunner:
    def __init__(self, base_url: str, num_requests: int = 1000):
        self.base_url = base_url
        self.num_requests = num_requests
        self.results = []
        self.errors = []

    def send_inference_request(self, request_id: int, model: str) -> Dict[str, Any]:
        """Send a single inference request and record metrics"""
        start_time = time.time()

        payload = {
            "model": model,
            "messages": [
                {"role": "user", "content": f"Benchmark test request #{request_id}"}
            ],
            "max_tokens": 100
        }

        try:
            response = requests.post(
                f"{self.base_url}/v1/infer",
                json=payload,
                timeout=30
            )

            end_time = time.time()
            latency_ms = (end_time - start_time) * 1000

            if response.status_code == 200:
                data = response.json()

                # Extract metadata
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
                    "tokens_used": data.get('usage', {}).get('total_tokens', 0),
                    "inference_time_ms": metadata.get('inference_time_ms', 0),
                    "queue_time_ms": metadata.get('queue_time_ms', 0),
                    "timestamp": datetime.now().isoformat()
                }

                return result
            else:
                return {
                    "request_id": request_id,
                    "model_requested": model,
                    "success": False,
                    "status_code": response.status_code,
                    "latency_ms": latency_ms,
                    "error": response.text,
                    "timestamp": datetime.now().isoformat()
                }

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
                "timestamp": datetime.now().isoformat()
            }

    def run_sequential(self):
        """Run benchmark sequentially"""
        print(f"Starting sequential benchmark with {self.num_requests} requests...")
        print(f"Target: {self.base_url}")
        print("-" * 80)

        models = ["gpt-4", "claude-3-opus-20240229"]

        for i in range(self.num_requests):
            model = models[i % len(models)]
            result = self.send_inference_request(i + 1, model)

            if result['success']:
                self.results.append(result)
            else:
                self.errors.append(result)

            # Progress indicator
            if (i + 1) % 100 == 0:
                print(f"Progress: {i + 1}/{self.num_requests} requests completed")

        print(f"\nBenchmark completed!")
        print(f"Successful requests: {len(self.results)}")
        print(f"Failed requests: {len(self.errors)}")

    def run_concurrent(self, workers: int = 10):
        """Run benchmark with concurrent requests"""
        print(f"Starting concurrent benchmark with {self.num_requests} requests...")
        print(f"Target: {self.base_url}")
        print(f"Concurrency: {workers} workers")
        print("-" * 80)

        models = ["gpt-4", "claude-3-opus-20240229"]

        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = []
            for i in range(self.num_requests):
                model = models[i % len(models)]
                future = executor.submit(self.send_inference_request, i + 1, model)
                futures.append(future)

            completed = 0
            for future in as_completed(futures):
                result = future.result()

                if result['success']:
                    self.results.append(result)
                else:
                    self.errors.append(result)

                completed += 1
                if completed % 100 == 0:
                    print(f"Progress: {completed}/{self.num_requests} requests completed")

        print(f"\nBenchmark completed!")
        print(f"Successful requests: {len(self.results)}")
        print(f"Failed requests: {len(self.errors)}")

    def calculate_metrics(self) -> Dict[str, Any]:
        """Calculate aggregate metrics from results"""
        if not self.results:
            return {"error": "No successful requests to analyze"}

        latencies = [r['latency_ms'] for r in self.results]
        costs = [r['cost_usd'] for r in self.results]
        tokens = [r['tokens_used'] for r in self.results]

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
            provider_metrics[provider] = {
                "request_count": provider_counts[provider],
                "percentage": (provider_counts[provider] / len(self.results)) * 100,
                "avg_latency_ms": statistics.mean(provider_latencies[provider]),
                "p50_latency_ms": statistics.median(provider_latencies[provider]),
                "p95_latency_ms": sorted(provider_latencies[provider])[int(0.95 * len(provider_latencies[provider]))],
                "avg_cost_usd": statistics.mean(provider_costs[provider]),
                "total_cost_usd": sum(provider_costs[provider])
            }

        metrics = {
            "summary": {
                "total_requests": self.num_requests,
                "successful_requests": len(self.results),
                "failed_requests": len(self.errors),
                "success_rate": (len(self.results) / self.num_requests) * 100
            },
            "latency": {
                "mean_ms": statistics.mean(latencies),
                "median_ms": statistics.median(latencies),
                "p50_ms": statistics.median(latencies),
                "p95_ms": sorted(latencies)[int(0.95 * len(latencies))],
                "p99_ms": sorted(latencies)[int(0.99 * len(latencies))],
                "min_ms": min(latencies),
                "max_ms": max(latencies),
                "stddev_ms": statistics.stdev(latencies) if len(latencies) > 1 else 0
            },
            "cost": {
                "total_usd": sum(costs),
                "mean_per_request_usd": statistics.mean(costs),
                "median_per_request_usd": statistics.median(costs),
                "cost_per_1k_requests_usd": (sum(costs) / len(self.results)) * 1000
            },
            "tokens": {
                "total": sum(tokens),
                "mean_per_request": statistics.mean(tokens),
                "median_per_request": statistics.median(tokens)
            },
            "providers": provider_metrics,
            "errors": {
                "count": len(self.errors),
                "rate": (len(self.errors) / self.num_requests) * 100,
                "details": self.errors[:10] if self.errors else []
            }
        }

        return metrics

    def save_results(self, output_file: str):
        """Save detailed results to JSON file"""
        data = {
            "metadata": {
                "benchmark_date": datetime.now().isoformat(),
                "base_url": self.base_url,
                "total_requests": self.num_requests,
                "successful_requests": len(self.results),
                "failed_requests": len(self.errors)
            },
            "metrics": self.calculate_metrics(),
            "results": self.results,
            "errors": self.errors
        }

        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2)

        print(f"\nResults saved to: {output_file}")

    def print_summary(self):
        """Print summary metrics to console"""
        metrics = self.calculate_metrics()

        print("\n" + "=" * 80)
        print("BENCHMARK SUMMARY")
        print("=" * 80)

        summary = metrics['summary']
        print(f"\nRequests:")
        print(f"  Total:      {summary['total_requests']}")
        print(f"  Successful: {summary['successful_requests']}")
        print(f"  Failed:     {summary['failed_requests']}")
        print(f"  Success Rate: {summary['success_rate']:.2f}%")

        latency = metrics['latency']
        print(f"\nLatency (ms):")
        print(f"  Mean:   {latency['mean_ms']:.2f}")
        print(f"  Median: {latency['median_ms']:.2f}")
        print(f"  P50:    {latency['p50_ms']:.2f}")
        print(f"  P95:    {latency['p95_ms']:.2f}")
        print(f"  P99:    {latency['p99_ms']:.2f}")
        print(f"  Min:    {latency['min_ms']:.2f}")
        print(f"  Max:    {latency['max_ms']:.2f}")

        cost = metrics['cost']
        print(f"\nCost:")
        print(f"  Total:              ${cost['total_usd']:.6f}")
        print(f"  Mean per request:   ${cost['mean_per_request_usd']:.6f}")
        print(f"  Cost per 1K reqs:   ${cost['cost_per_1k_requests_usd']:.4f}")

        tokens_data = metrics['tokens']
        print(f"\nTokens:")
        print(f"  Total:              {tokens_data['total']}")
        print(f"  Mean per request:   {tokens_data['mean_per_request']:.2f}")

        print(f"\nProvider Distribution:")
        for provider, data in metrics['providers'].items():
            print(f"  {provider}:")
            print(f"    Requests:    {data['request_count']} ({data['percentage']:.1f}%)")
            print(f"    Avg Latency: {data['avg_latency_ms']:.2f}ms")
            print(f"    P50 Latency: {data['p50_latency_ms']:.2f}ms")
            print(f"    P95 Latency: {data['p95_latency_ms']:.2f}ms")
            print(f"    Avg Cost:    ${data['avg_cost_usd']:.6f}")
            print(f"    Total Cost:  ${data['total_cost_usd']:.6f}")

        if metrics['errors']['count'] > 0:
            print(f"\nErrors:")
            print(f"  Count: {metrics['errors']['count']}")
            print(f"  Rate:  {metrics['errors']['rate']:.2f}%")

        print("=" * 80)


def main():
    import argparse

    parser = argparse.ArgumentParser(description='Schlep-Engine Shadow Benchmark')
    parser.add_argument('--url', default='http://localhost:8081', help='Base URL of Schlep-Engine API')
    parser.add_argument('--requests', type=int, default=1000, help='Number of requests to send')
    parser.add_argument('--output', default='benchmarks/results/shadow_benchmark_v1.json', help='Output file for results')
    parser.add_argument('--concurrent', action='store_true', help='Run concurrent benchmark')
    parser.add_argument('--workers', type=int, default=10, help='Number of concurrent workers')

    args = parser.parse_args()

    print("=" * 80)
    print("SCHLEP-ENGINE SHADOW BENCHMARK")
    print("=" * 80)
    print(f"Configuration:")
    print(f"  Base URL:     {args.url}")
    print(f"  Requests:     {args.requests}")
    print(f"  Output:       {args.output}")
    print(f"  Mode:         {'Concurrent' if args.concurrent else 'Sequential'}")
    if args.concurrent:
        print(f"  Workers:      {args.workers}")
    print("=" * 80)

    # Check if API is accessible
    try:
        response = requests.get(f"{args.url}/v1/health", timeout=5)
        if response.status_code == 200:
            print(f"\n✅ API is accessible and healthy")
        else:
            print(f"\n⚠️  API returned status {response.status_code}")
    except Exception as e:
        print(f"\n❌ Cannot reach API: {e}")
        print("Please ensure the Schlep-Engine API is running")
        sys.exit(1)

    # Run benchmark
    benchmark = BenchmarkRunner(args.url, args.requests)

    start_time = time.time()

    if args.concurrent:
        benchmark.run_concurrent(args.workers)
    else:
        benchmark.run_sequential()

    end_time = time.time()
    duration = end_time - start_time

    print(f"\nTotal benchmark duration: {duration:.2f} seconds")
    print(f"Throughput: {args.requests / duration:.2f} requests/second")

    # Save and display results
    benchmark.save_results(args.output)
    benchmark.print_summary()


if __name__ == '__main__':
    main()
