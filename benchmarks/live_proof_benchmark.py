#!/usr/bin/env python3
"""
Live Proof Sprint Benchmark
Uses correct models: GPT-4 (OpenAI) and Claude-3-Haiku (Anthropic)
"""

import requests
import json
import time
import statistics
from datetime import datetime
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
import sys

class LiveProofBenchmark:
    def __init__(self, base_url: str, num_requests: int, workers: int):
        self.base_url = base_url
        self.num_requests = num_requests
        self.workers = workers
        self.results = []
        self.errors = []

        # Use correct models
        self.models = ["gpt-4", "claude-3-haiku-20240307"]

    def send_request(self, request_id: int) -> Dict[str, Any]:
        """Send single inference request"""
        # Alternate between models
        model = self.models[request_id % len(self.models)]

        start_time = time.time()

        payload = {
            "model": model,
            "messages": [
                {"role": "user", "content": f"Test request {request_id}"}
            ],
            "max_tokens": 50
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
                metadata = data.get('metadata', {})

                return {
                    "request_id": request_id,
                    "model_requested": model,
                    "success": True,
                    "status_code": 200,
                    "latency_ms": latency_ms,
                    "provider": metadata.get('provider', 'unknown'),
                    "model_used": metadata.get('model_used', 'unknown'),
                    "cost_usd": metadata.get('cost_usd', 0.0),
                    "tokens_used": data.get('usage', {}).get('total_tokens', 0),
                    "timestamp": datetime.now().isoformat()
                }
            else:
                return {
                    "request_id": request_id,
                    "model_requested": model,
                    "success": False,
                    "status_code": response.status_code,
                    "latency_ms": latency_ms,
                    "error": response.text[:200],
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

    def run(self):
        """Execute benchmark with concurrent workers"""
        print("=" * 80)
        print("LIVE PROOF SPRINT BENCHMARK")
        print("=" * 80)
        print(f"Target: {self.base_url}")
        print(f"Total Requests: {self.num_requests}")
        print(f"Workers: {self.workers}")
        print(f"Models: {', '.join(self.models)}")
        print("=" * 80)
        print()

        start_time = time.time()

        with ThreadPoolExecutor(max_workers=self.workers) as executor:
            futures = [executor.submit(self.send_request, i) for i in range(self.num_requests)]

            completed = 0
            for future in as_completed(futures):
                result = future.result()
                self.results.append(result)

                completed += 1
                if completed % 100 == 0:
                    print(f"Progress: {completed}/{self.num_requests} requests completed")

        end_time = time.time()
        duration = end_time - start_time

        print(f"\nBenchmark completed in {duration:.2f} seconds")
        print(f"Throughput: {self.num_requests / duration:.2f} req/s")

        return self.analyze_results(duration)

    def analyze_results(self, duration: float) -> Dict[str, Any]:
        """Analyze benchmark results"""
        successful = [r for r in self.results if r['success']]
        failed = [r for r in self.results if not r['success']]

        if not successful:
            print("\n❌ No successful requests!")
            return {}

        # Calculate metrics
        latencies = [r['latency_ms'] for r in successful]
        costs = [r.get('cost_usd', 0) for r in successful]
        tokens = [r.get('tokens_used', 0) for r in successful]

        # Provider distribution
        providers = {}
        for r in successful:
            provider = r.get('provider', 'unknown')
            if provider not in providers:
                providers[provider] = {
                    'count': 0,
                    'latencies': [],
                    'costs': []
                }
            providers[provider]['count'] += 1
            providers[provider]['latencies'].append(r['latency_ms'])
            providers[provider]['costs'].append(r.get('cost_usd', 0))

        provider_stats = {}
        for provider, data in providers.items():
            provider_stats[provider] = {
                'request_count': data['count'],
                'percentage': (data['count'] / len(successful)) * 100,
                'avg_latency_ms': statistics.mean(data['latencies']),
                'p50_latency_ms': statistics.median(data['latencies']),
                'p95_latency_ms': statistics.quantiles(data['latencies'], n=20)[18] if len(data['latencies']) > 1 else data['latencies'][0],
                'total_cost_usd': sum(data['costs']),
                'avg_cost_usd': statistics.mean(data['costs'])
            }

        results = {
            'metadata': {
                'benchmark_date': datetime.now().isoformat(),
                'base_url': self.base_url,
                'total_requests': self.num_requests,
                'successful_requests': len(successful),
                'failed_requests': len(failed),
                'duration_seconds': duration
            },
            'metrics': {
                'summary': {
                    'total_requests': self.num_requests,
                    'successful_requests': len(successful),
                    'failed_requests': len(failed),
                    'success_rate': (len(successful) / self.num_requests) * 100
                },
                'performance': {
                    'duration_seconds': duration,
                    'throughput_rps': self.num_requests / duration
                },
                'latency': {
                    'mean_ms': statistics.mean(latencies),
                    'median_ms': statistics.median(latencies),
                    'p50_ms': statistics.median(latencies),
                    'p95_ms': statistics.quantiles(latencies, n=20)[18] if len(latencies) > 1 else latencies[0],
                    'p99_ms': statistics.quantiles(latencies, n=100)[98] if len(latencies) > 1 else latencies[0],
                    'min_ms': min(latencies),
                    'max_ms': max(latencies)
                },
                'cost': {
                    'total_usd': sum(costs),
                    'mean_per_request_usd': statistics.mean(costs),
                    'median_per_request_usd': statistics.median(costs)
                },
                'tokens': {
                    'total': sum(tokens),
                    'mean_per_request': statistics.mean(tokens)
                },
                'providers': provider_stats
            },
            'raw_results': self.results
        }

        self.print_summary(results)
        return results

    def print_summary(self, results: Dict[str, Any]):
        """Print benchmark summary"""
        m = results['metrics']

        print("\n" + "=" * 80)
        print("BENCHMARK SUMMARY")
        print("=" * 80)
        print()
        print(f"Requests:")
        print(f"  Total:      {m['summary']['total_requests']}")
        print(f"  Successful: {m['summary']['successful_requests']}")
        print(f"  Failed:     {m['summary']['failed_requests']}")
        print(f"  Success Rate: {m['summary']['success_rate']:.2f}%")
        print()
        print(f"Performance:")
        print(f"  Duration:   {m['performance']['duration_seconds']:.2f}s")
        print(f"  Throughput: {m['performance']['throughput_rps']:.2f} req/s")
        print()
        print(f"Latency (ms):")
        print(f"  Mean:   {m['latency']['mean_ms']:.2f}")
        print(f"  Median: {m['latency']['median_ms']:.2f}")
        print(f"  P95:    {m['latency']['p95_ms']:.2f}")
        print(f"  P99:    {m['latency']['p99_ms']:.2f}")
        print()
        print(f"Cost:")
        print(f"  Total:              ${m['cost']['total_usd']:.6f}")
        print(f"  Mean per request:   ${m['cost']['mean_per_request_usd']:.6f}")
        print()
        print(f"Providers:")
        for provider, stats in m['providers'].items():
            print(f"  {provider}:")
            print(f"    Requests:    {stats['request_count']} ({stats['percentage']:.1f}%)")
            print(f"    Avg Latency: {stats['avg_latency_ms']:.2f}ms")
            print(f"    P95 Latency: {stats['p95_latency_ms']:.2f}ms")
            print(f"    Total Cost:  ${stats['total_cost_usd']:.6f}")
        print("=" * 80)

if __name__ == "__main__":
    benchmark = LiveProofBenchmark(
        base_url="http://localhost:8080",
        num_requests=1500,
        workers=20
    )

    results = benchmark.run()

    # Save results
    output_file = "benchmarks/results/live_proof_sprint.json"
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)

    print(f"\nResults saved to: {output_file}")
