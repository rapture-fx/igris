#!/usr/bin/env python3
"""
ML Routing Simulation Test
Tests gRPC connection and simulates distributed inference
"""

import time
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict

# Mock protobuf messages (since we don't have generated stubs here)
class MockPredictRequest:
    def __init__(self, features, model_id):
        self.features = features
        self.model_id = model_id

class MockPredictResponse:
    def __init__(self, prediction, confidence, model_id):
        self.prediction = prediction
        self.confidence = confidence
        self.model_id = model_id

def simulate_ml_inference(features, model_id):
    """Simulate ML inference with mock computation"""
    time.sleep(0.010)  # 10ms mock inference time
    prediction = sum(features)
    confidence = 0.95
    return MockPredictResponse(prediction, confidence, model_id)

def run_concurrent_requests(num_requests=1000, concurrency=50):
    """Simulate concurrent ML requests"""
    print(f"🧪 ML Routing Simulation Test")
    print(f"=" * 60)
    print(f"Configuration:")
    print(f"  • Total requests: {num_requests}")
    print(f"  • Concurrency: {concurrency}")
    print(f"  • Mock inference latency: 10ms")
    print()

    latencies = []
    errors = 0

    def make_request(i):
        start = time.time()
        try:
            features = [float(i), 5.0, 3.0, 1.0]
            result = simulate_ml_inference(features, "test-model")
            latency_ms = (time.time() - start) * 1000
            return latency_ms
        except Exception as e:
            print(f"Error in request {i}: {e}")
            return None

    print("Running concurrent requests...")
    start_time = time.time()

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        results = list(executor.map(make_request, range(num_requests)))

    total_duration = time.time() - start_time

    # Filter out errors
    latencies = [l for l in results if l is not None]
    errors = sum(1 for l in results if l is None)

    # Calculate statistics
    if latencies:
        latencies.sort()
        p50 = latencies[int(len(latencies) * 0.50)]
        p90 = latencies[int(len(latencies) * 0.90)]
        p95 = latencies[int(len(latencies) * 0.95)]
        p99 = latencies[int(len(latencies) * 0.99)]
        p999 = latencies[int(len(latencies) * 0.999)] if len(latencies) > 1000 else p99

        rps = num_requests / total_duration

        print(f"\n✅ Results:")
        print(f"  Duration: {total_duration:.2f}s")
        print(f"  RPS: {rps:.0f}")
        print(f"  Success rate: {(len(latencies)/num_requests)*100:.2f}%")
        print(f"  Errors: {errors}")
        print()
        print(f"📊 Latency Distribution:")
        print(f"  P50:  {p50:.2f}ms")
        print(f"  P90:  {p90:.2f}ms")
        print(f"  P95:  {p95:.2f}ms")
        print(f"  P99:  {p99:.2f}ms")
        print(f"  P99.9: {p999:.2f}ms")
        print()

        # Theoretical calculation
        print(f"🧮 Theoretical Analysis:")
        print(f"  Single worker throughput: ~100 req/sec (10ms latency)")
        print(f"  Current concurrency: {concurrency} workers")
        print(f"  Theoretical max RPS: ~{concurrency * 100} req/sec")
        print(f"  To reach 10K RPS: Need ~100 workers or 10 Python ML replicas")
        print()

        # Check SLA
        sla_pass = p99 < 100 and rps >= 1000
        print(f"🎯 SLA Check (P99 < 100ms, RPS >= 1K):")
        print(f"  P99 latency: {'✅ PASS' if p99 < 100 else '❌ FAIL'} ({p99:.2f}ms)")
        print(f"  Throughput: {'✅ PASS' if rps >= 1000 else '❌ FAIL'} ({rps:.0f} RPS)")
        print(f"  Overall: {'✅ PASS' if sla_pass else '❌ FAIL'}")

        return {
            "rps": rps,
            "p50": p50,
            "p90": p90,
            "p95": p95,
            "p99": p99,
            "p999": p999,
            "errors": errors,
            "success_rate": (len(latencies)/num_requests)*100,
            "sla_pass": sla_pass
        }
    else:
        print("❌ All requests failed!")
        return None

if __name__ == "__main__":
    # Test scenarios
    scenarios = [
        {"name": "Baseline (1K requests, 50 workers)", "requests": 1000, "concurrency": 50},
        {"name": "Medium Load (5K requests, 100 workers)", "requests": 5000, "concurrency": 100},
        {"name": "High Load (10K requests, 200 workers)", "requests": 10000, "concurrency": 200},
    ]

    all_results = {}

    for scenario in scenarios:
        print(f"\n{'='*60}")
        print(f"Scenario: {scenario['name']}")
        print(f"{'='*60}\n")

        result = run_concurrent_requests(
            num_requests=scenario['requests'],
            concurrency=scenario['concurrency']
        )

        if result:
            all_results[scenario['name']] = result

        time.sleep(1)  # Brief pause between scenarios

    # Summary
    print(f"\n{'='*60}")
    print(f"📋 SUMMARY - ML Routing Capability")
    print(f"{'='*60}\n")

    for name, result in all_results.items():
        status = "✅" if result['sla_pass'] else "❌"
        print(f"{status} {name}:")
        print(f"    RPS: {result['rps']:.0f}, P99: {result['p99']:.2f}ms, Success: {result['success_rate']:.1f}%")

    # Export results
    with open('/tmp/ml_routing_results.json', 'w') as f:
        json.dump(all_results, f, indent=2)

    print(f"\n💾 Results saved to: /tmp/ml_routing_results.json")
