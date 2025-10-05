#!/usr/bin/env python3
"""
End-to-End Latency Benchmark
Simulates complete pipeline: Client → Go Gateway → Rust FFI → Python ML
"""

import time
import json
import random
import string
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import List, Dict

@dataclass
class PipelineStage:
    name: str
    duration_ms: float

@dataclass
class RequestMetrics:
    total_latency_ms: float
    client_to_gateway_ms: float
    gateway_to_rust_ms: float
    rust_processing_ms: float
    gateway_to_ml_ms: float
    ml_inference_ms: float
    response_assembly_ms: float

def generate_messy_data(record_type: str) -> Dict:
    """Generate synthetic messy data"""
    if record_type == "json":
        return {
            "id": random.randint(1, 100000),
            "name": ''.join(random.choices(string.ascii_letters, k=10)),
            "value": random.uniform(0, 1000),
            "category": random.choice(["A", "B", "C", "D"]),
            "timestamp": f"2025-10-04T{random.randint(0,23):02d}:{random.randint(0,59):02d}:{random.randint(0,59):02d}Z",
            "nested": {
                "field1": random.random(),
                "field2": ''.join(random.choices(string.ascii_letters, k=20))
            }
        }
    elif record_type == "csv_like":
        return {
            "raw": f"{random.randint(1,100000)},item_{random.randint(1,1000)},{random.uniform(0,100):.2f}",
            "format": "csv"
        }
    else:  # Mixed
        return generate_messy_data(random.choice(["json", "csv_like"]))

def simulate_pipeline_processing(data: Dict) -> RequestMetrics:
    """Simulate full pipeline with realistic latencies"""

    # Stage 1: Client → Gateway (network + routing)
    start = time.time()
    time.sleep(0.001)  # 1ms network latency
    client_to_gateway = (time.time() - start) * 1000

    # Stage 2: Gateway → Rust FFI (data validation/transform)
    start = time.time()
    time.sleep(0.0026)  # 2.6μs average (from our benchmark)
    gateway_to_rust = (time.time() - start) * 1000

    # Stage 3: Rust Processing (JSON validation + transform)
    start = time.time()
    time.sleep(0.0077)  # 7.7μs average (from our benchmark)
    rust_processing = (time.time() - start) * 1000

    # Stage 4: Gateway → Python ML (gRPC call)
    start = time.time()
    time.sleep(0.002)  # 2ms gRPC overhead
    gateway_to_ml = (time.time() - start) * 1000

    # Stage 5: ML Inference (Python)
    start = time.time()
    time.sleep(0.010)  # 10ms mock inference
    ml_inference = (time.time() - start) * 1000

    # Stage 6: Response Assembly
    start = time.time()
    time.sleep(0.001)  # 1ms response building
    response_assembly = (time.time() - start) * 1000

    total = client_to_gateway + gateway_to_rust + rust_processing + gateway_to_ml + ml_inference + response_assembly

    return RequestMetrics(
        total_latency_ms=total,
        client_to_gateway_ms=client_to_gateway,
        gateway_to_rust_ms=gateway_to_rust,
        rust_processing_ms=rust_processing,
        gateway_to_ml_ms=gateway_to_ml,
        ml_inference_ms=ml_inference,
        response_assembly_ms=response_assembly
    )

def run_e2e_benchmark(num_requests: int = 10000, concurrency: int = 100):
    """Run end-to-end benchmark with 10k synthetic inputs"""

    print(f"🚀 End-to-End Latency Benchmark")
    print(f"=" * 70)
    print(f"Configuration:")
    print(f"  • Total requests: {num_requests:,}")
    print(f"  • Concurrency: {concurrency}")
    print(f"  • Input mix: 50% JSON, 50% CSV-like")
    print()

    # Generate synthetic inputs
    print("Generating synthetic messy data...")
    inputs = [generate_messy_data("mixed") for _ in range(num_requests)]
    print(f"✓ Generated {len(inputs):,} records")
    print()

    # Run benchmark
    print("Running pipeline benchmark...")
    all_metrics: List[RequestMetrics] = []

    def process_request(data):
        return simulate_pipeline_processing(data)

    start_time = time.time()

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        all_metrics = list(executor.map(process_request, inputs))

    total_duration = time.time() - start_time

    # Calculate statistics
    total_latencies = [m.total_latency_ms for m in all_metrics]
    total_latencies.sort()

    p50 = total_latencies[int(len(total_latencies) * 0.50)]
    p90 = total_latencies[int(len(total_latencies) * 0.90)]
    p95 = total_latencies[int(len(total_latencies) * 0.95)]
    p99 = total_latencies[int(len(total_latencies) * 0.99)]
    p999 = total_latencies[int(len(total_latencies) * 0.999)]

    rps = num_requests / total_duration

    # Stage breakdown
    avg_client_gateway = sum(m.client_to_gateway_ms for m in all_metrics) / len(all_metrics)
    avg_gateway_rust = sum(m.gateway_to_rust_ms for m in all_metrics) / len(all_metrics)
    avg_rust_proc = sum(m.rust_processing_ms for m in all_metrics) / len(all_metrics)
    avg_gateway_ml = sum(m.gateway_to_ml_ms for m in all_metrics) / len(all_metrics)
    avg_ml_infer = sum(m.ml_inference_ms for m in all_metrics) / len(all_metrics)
    avg_response = sum(m.response_assembly_ms for m in all_metrics) / len(all_metrics)

    print(f"\n✅ Overall Results:")
    print(f"  Duration: {total_duration:.2f}s")
    print(f"  Throughput: {rps:.0f} RPS")
    print(f"  Total processed: {num_requests:,} requests")
    print()

    print(f"📊 Latency Distribution (End-to-End):")
    print(f"  P50:   {p50:.2f}ms")
    print(f"  P90:   {p90:.2f}ms")
    print(f"  P95:   {p95:.2f}ms")
    print(f"  P99:   {p99:.2f}ms")
    print(f"  P99.9: {p999:.2f}ms")
    print()

    print(f"🔍 Pipeline Stage Breakdown (Average Latencies):")
    print(f"  1. Client → Gateway:     {avg_client_gateway:.3f}ms  ({avg_client_gateway/p50*100:.1f}% of P50)")
    print(f"  2. Gateway → Rust FFI:   {avg_gateway_rust:.3f}ms  ({avg_gateway_rust/p50*100:.1f}% of P50)")
    print(f"  3. Rust Processing:      {avg_rust_proc:.3f}ms  ({avg_rust_proc/p50*100:.1f}% of P50)")
    print(f"  4. Gateway → Python ML:  {avg_gateway_ml:.3f}ms  ({avg_gateway_ml/p50*100:.1f}% of P50)")
    print(f"  5. ML Inference:         {avg_ml_infer:.3f}ms  ({avg_ml_infer/p50*100:.1f}% of P50)")
    print(f"  6. Response Assembly:    {avg_response:.3f}ms  ({avg_response/p50*100:.1f}% of P50)")
    print(f"  ────────────────────────────────────────────")
    print(f"  Total (avg):             {p50:.3f}ms")
    print()

    # Bottleneck analysis
    stages = [
        ("Client → Gateway", avg_client_gateway),
        ("Gateway → Rust FFI", avg_gateway_rust),
        ("Rust Processing", avg_rust_proc),
        ("Gateway → Python ML", avg_gateway_ml),
        ("ML Inference", avg_ml_infer),
        ("Response Assembly", avg_response)
    ]
    stages.sort(key=lambda x: x[1], reverse=True)

    print(f"🔥 Top-3 Bottlenecks:")
    for i, (name, latency) in enumerate(stages[:3], 1):
        percentage = (latency / p50) * 100
        print(f"  {i}. {name}: {latency:.3f}ms ({percentage:.1f}% of total)")
    print()

    # CPU/Memory estimate (mock)
    print(f"💻 Resource Usage Estimates:")
    print(f"  Go Gateway CPU:    ~15% (routing + FFI calls)")
    print(f"  Rust Kernel CPU:   ~5% (data transforms)")
    print(f"  Python ML CPU:     ~60% (inference dominant)")
    print(f"  Go Gateway Memory: ~128MB")
    print(f"  Rust Kernel Memory: ~24MB")
    print(f"  Python ML Memory:  ~512MB (per instance)")
    print()

    # SLA Check
    sla_pass = p99 < 100 and rps >= 10000
    print(f"🎯 SLA Target Check (10K RPS @ P99 <100ms):")
    print(f"  P99 latency: {'✅ PASS' if p99 < 100 else '❌ FAIL'} ({p99:.2f}ms target: <100ms)")
    print(f"  Throughput:  {'✅ PASS' if rps >= 10000 else '❌ FAIL'} ({rps:.0f} RPS target: >=10K)")
    print(f"  Overall:     {'✅ PASS' if sla_pass else '❌ FAIL'}")
    print()

    # Recommendations
    if not sla_pass:
        print(f"⚠️  Recommendations to Meet SLA:")
        if p99 >= 100:
            print(f"  • P99 latency too high ({p99:.2f}ms):")
            print(f"    - Optimize ML inference (currently {avg_ml_infer:.2f}ms avg)")
            print(f"    - Consider model quantization or TensorRT optimization")
            print(f"    - Add Redis caching for repeated predictions")
        if rps < 10000:
            print(f"  • Throughput too low ({rps:.0f} RPS):")
            print(f"    - Scale Python ML to ~10 replicas")
            print(f"    - Add gRPC load balancing")
            print(f"    - Consider async processing with NATS queue")

    # Export results
    results = {
        "throughput_rps": rps,
        "latency_p50_ms": p50,
        "latency_p90_ms": p90,
        "latency_p95_ms": p95,
        "latency_p99_ms": p99,
        "latency_p999_ms": p999,
        "stage_breakdown": {
            "client_gateway_ms": avg_client_gateway,
            "gateway_rust_ms": avg_gateway_rust,
            "rust_processing_ms": avg_rust_proc,
            "gateway_ml_ms": avg_gateway_ml,
            "ml_inference_ms": avg_ml_infer,
            "response_assembly_ms": avg_response
        },
        "bottlenecks": [{"stage": s[0], "latency_ms": s[1]} for s in stages[:3]],
        "sla_check": {
            "p99_pass": p99 < 100,
            "rps_pass": rps >= 10000,
            "overall_pass": sla_pass
        }
    }

    with open('/tmp/e2e_benchmark_results.json', 'w') as f:
        json.dump(results, f, indent=2)

    print(f"💾 Results saved to: /tmp/e2e_benchmark_results.json")

    return results

if __name__ == "__main__":
    results = run_e2e_benchmark(num_requests=10000, concurrency=100)
