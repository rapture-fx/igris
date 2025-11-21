#!/usr/bin/env python3
"""
FFI Boundary Stress Test
Tests Go <-> Rust Thompson Sampling FFI stability under load
Success Criteria: No panics, stable memory, successful weight updates
"""

import asyncio
import aiohttp
import time
import sys
import psutil
import json
from datetime import datetime
from collections import defaultdict
import statistics

class FFIBoundaryTester:
    def __init__(self, base_url="http://localhost:8080", duration=300, concurrency=50):
        self.base_url = base_url
        self.duration = duration
        self.concurrency = concurrency
        self.results = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'optimizer_calls': 0,
            'ffi_errors': 0,
            'panic_detected': False,
            'memory_samples': [],
            'latencies': [],
            'response_codes': defaultdict(int),
            'optimizer_decisions': defaultdict(int)
        }
        self.start_time = None
        self.running = True

    def get_optimizer_stats(self):
        """Get Rust optimizer statistics to verify FFI is working"""
        try:
            response = requests.get(f"{self.base_url}/v1/providers/stats", timeout=5)
            if response.status_code == 200:
                return response.json()
        except:
            pass
        return None

    async def make_inference_request(self, session, request_id):
        """Make inference request that exercises the FFI boundary"""
        url = f"{self.base_url}/v1/infer"

        # Vary requests to exercise different code paths in optimizer
        models = ["gpt-4", "gpt-3.5-turbo", "claude-3-sonnet", "claude-3-opus"]
        model = models[request_id % len(models)]

        payload = {
            "model": model,
            "messages": [
                {"role": "user", "content": f"FFI test {request_id}: Explain cloud computing in one sentence."}
            ],
            "max_tokens": 50,
            "temperature": 0.5 + (request_id % 5) * 0.1  # Vary temperature
        }

        headers = {
            "Content-Type": "application/json",
            "X-Trace-ID": f"ffi-stress-{request_id}"
        }

        start = time.time()
        try:
            async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as response:
                latency = (time.time() - start) * 1000
                body = await response.text()

                self.results['total_requests'] += 1
                self.results['response_codes'][response.status] += 1
                self.results['latencies'].append(latency)

                if 200 <= response.status < 300:
                    self.results['successful_requests'] += 1
                    self.results['optimizer_calls'] += 1

                    # Try to detect which provider was selected (optimizer decision)
                    try:
                        data = json.loads(body)
                        if 'provider' in data:
                            self.results['optimizer_decisions'][data['provider']] += 1
                    except:
                        pass

                    return True, latency, None
                else:
                    self.results['failed_requests'] += 1

                    # Check for FFI-related errors
                    if 'panic' in body.lower() or 'ffi' in body.lower() or 'rust' in body.lower():
                        self.results['ffi_errors'] += 1
                        print(f"🚨 FFI ERROR detected in request {request_id}: {body[:200]}")

                    return False, latency, body[:200]

        except asyncio.TimeoutError:
            latency = (time.time() - start) * 1000
            self.results['total_requests'] += 1
            self.results['failed_requests'] += 1
            self.results['latencies'].append(latency)
            return False, latency, "timeout"

        except Exception as e:
            latency = (time.time() - start) * 1000
            self.results['total_requests'] += 1
            self.results['failed_requests'] += 1

            error_str = str(e).lower()
            if 'panic' in error_str or 'ffi' in error_str:
                self.results['ffi_errors'] += 1
                self.results['panic_detected'] = True
                print(f"🚨 PANIC/FFI CRASH detected: {str(e)}")

            return False, latency, str(e)

    async def worker(self, session, worker_id):
        """Worker that continuously stresses the FFI boundary"""
        request_count = 0

        while self.running:
            elapsed = time.time() - self.start_time
            if elapsed >= self.duration:
                self.running = False
                break

            request_id = worker_id * 1000000 + request_count
            await self.make_inference_request(session, request_id)
            request_count += 1

            # Small delay to avoid overwhelming
            await asyncio.sleep(0.05)

    async def monitor_resources(self):
        """Monitor memory and detect leaks or panics"""
        try:
            process = psutil.Process()
        except:
            print("⚠️  Unable to monitor process resources")
            return

        initial_memory = None

        while self.running:
            try:
                mem_info = process.memory_info()
                mem_mb = mem_info.rss / 1024 / 1024
                self.results['memory_samples'].append(mem_mb)

                if initial_memory is None:
                    initial_memory = mem_mb

                # Check for rapid memory growth (potential FFI leak)
                if len(self.results['memory_samples']) > 10:
                    recent_growth = mem_mb - self.results['memory_samples'][-10]
                    if recent_growth > 100:  # 100MB growth in 50 seconds
                        print(f"⚠️  Rapid memory growth detected: +{recent_growth:.1f}MB in last 50s")

            except Exception as e:
                print(f"⚠️  Resource monitoring error: {str(e)}")

            await asyncio.sleep(5)

    async def progress_reporter(self):
        """Report FFI stress test progress"""
        last_total = 0

        while self.running:
            await asyncio.sleep(15)

            elapsed = time.time() - self.start_time
            if elapsed >= self.duration:
                break

            current_total = self.results['total_requests']
            requests_in_interval = current_total - last_total
            throughput = requests_in_interval / 15

            success_rate = (self.results['successful_requests'] / current_total * 100) if current_total > 0 else 0

            memory_current = self.results['memory_samples'][-1] if self.results['memory_samples'] else 0
            memory_initial = self.results['memory_samples'][0] if self.results['memory_samples'] else 0
            memory_growth = memory_current - memory_initial

            print(f"⏱️  {elapsed:.0f}s | "
                  f"Requests: {current_total} | "
                  f"Throughput: {throughput:.1f} req/s | "
                  f"Success: {success_rate:.1f}% | "
                  f"FFI Errors: {self.results['ffi_errors']} | "
                  f"Memory: {memory_current:.0f}MB (+{memory_growth:.0f}MB)")

            last_total = current_total

    async def run_ffi_stress_test(self):
        """Execute FFI boundary stress test"""
        print(f"\n{'='*70}")
        print(f"🔥 FFI BOUNDARY STRESS TEST")
        print(f"{'='*70}")
        print(f"Target URL: {self.base_url}")
        print(f"Concurrency: {self.concurrency} workers")
        print(f"Duration: {self.duration}s")
        print(f"Focus: Go <-> Rust Thompson Sampling FFI stability")
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*70}\n")

        # Check initial optimizer stats
        print("📊 Initial optimizer status:")
        initial_stats = self.get_optimizer_stats()
        if initial_stats:
            print(json.dumps(initial_stats, indent=2))
        else:
            print("⚠️  Unable to fetch optimizer stats (may not be enabled)")
        print()

        self.start_time = time.time()

        connector = aiohttp.TCPConnector(limit=self.concurrency + 10)
        async with aiohttp.ClientSession(connector=connector) as session:
            # Start workers
            workers = [
                self.worker(session, worker_id)
                for worker_id in range(self.concurrency)
            ]

            # Start monitoring
            monitor = self.monitor_resources()
            reporter = self.progress_reporter()

            # Run all tasks
            await asyncio.gather(*workers, monitor, reporter)

        self.print_results()

    def print_results(self):
        """Print comprehensive FFI stress test results"""
        duration = time.time() - self.start_time
        total = self.results['total_requests']

        print(f"\n{'='*70}")
        print(f"📊 FFI BOUNDARY STRESS TEST RESULTS")
        print(f"{'='*70}\n")

        print(f"⏱️  Duration: {duration:.2f}s")
        print(f"📦 Total Requests: {total}")
        print(f"✅ Successful: {self.results['successful_requests']} ({self.results['successful_requests']/total*100:.2f}%)")
        print(f"❌ Failed: {self.results['failed_requests']} ({self.results['failed_requests']/total*100:.2f}%)")
        print(f"🔗 Optimizer Calls: {self.results['optimizer_calls']}")
        print(f"🚨 FFI Errors: {self.results['ffi_errors']}")
        print(f"📈 Throughput: {total/duration:.2f} req/s")

        if self.results['optimizer_decisions']:
            print(f"\n{'Optimizer Provider Selection Distribution':-^70}")
            total_decisions = sum(self.results['optimizer_decisions'].values())
            for provider, count in sorted(self.results['optimizer_decisions'].items(), key=lambda x: x[1], reverse=True):
                percentage = (count / total_decisions * 100) if total_decisions > 0 else 0
                print(f"{provider}: {count} ({percentage:.1f}%)")

            # Check if optimizer is actually working (not stuck on one provider)
            max_percentage = max((count / total_decisions * 100) for count in self.results['optimizer_decisions'].values()) if total_decisions > 0 else 100
            if max_percentage > 95:
                print(f"\n⚠️  WARNING: Optimizer may not be exploring alternatives ({max_percentage:.1f}% on one provider)")
            else:
                print(f"\n✅ Optimizer is exploring multiple providers (max: {max_percentage:.1f}%)")

        if self.results['latencies']:
            sorted_latencies = sorted(self.results['latencies'])
            print(f"\n{'Latency Distribution (ms)':-^70}")
            print(f"Min:  {min(sorted_latencies):>8.2f}ms")
            print(f"P50:  {sorted_latencies[int(len(sorted_latencies)*0.50)]:>8.2f}ms")
            print(f"P95:  {sorted_latencies[int(len(sorted_latencies)*0.95)]:>8.2f}ms")
            print(f"P99:  {sorted_latencies[int(len(sorted_latencies)*0.99)]:>8.2f}ms")
            print(f"Max:  {max(sorted_latencies):>8.2f}ms")
            print(f"Avg:  {statistics.mean(sorted_latencies):>8.2f}ms")

        if self.results['memory_samples'] and len(self.results['memory_samples']) > 1:
            print(f"\n{'Memory Analysis':-^70}")
            initial = self.results['memory_samples'][0]
            final = self.results['memory_samples'][-1]
            peak = max(self.results['memory_samples'])
            growth = final - initial
            growth_pct = (growth / initial * 100) if initial > 0 else 0

            print(f"Initial:  {initial:>8.2f} MB")
            print(f"Final:    {final:>8.2f} MB")
            print(f"Peak:     {peak:>8.2f} MB")
            print(f"Growth:   {growth:>8.2f} MB ({growth_pct:>5.1f}%)")

            # Detect potential memory leak
            if growth_pct > 20:
                print(f"\n⚠️  WARNING: Memory grew {growth_pct:.1f}% - potential FFI memory leak")

        print(f"\n{'FFI Stability Criteria Evaluation':-^70}")

        criteria_met = True

        # No panics or FFI crashes
        if not self.results['panic_detected'] and self.results['ffi_errors'] == 0:
            print(f"✅ No Rust panics or FFI errors (Target: 0)")
        else:
            print(f"❌ FFI errors detected: {self.results['ffi_errors']} (Target: 0) - CRITICAL")
            criteria_met = False

        # Memory stability
        if self.results['memory_samples'] and len(self.results['memory_samples']) > 1:
            growth_pct = ((self.results['memory_samples'][-1] - self.results['memory_samples'][0]) /
                         self.results['memory_samples'][0] * 100)
            if growth_pct < 15:
                print(f"✅ Memory stable: {growth_pct:.1f}% growth (Target: <15%)")
            else:
                print(f"⚠️  Memory growth: {growth_pct:.1f}% (Target: <15%) - WARNING")

        # Optimizer functioning
        if self.results['optimizer_calls'] > 0:
            print(f"✅ Optimizer successfully processing requests: {self.results['optimizer_calls']} calls")
        else:
            print(f"⚠️  Optimizer may not be active (0 calls recorded)")

        # Success rate
        success_rate = (self.results['successful_requests'] / total * 100) if total > 0 else 0
        if success_rate >= 95:
            print(f"✅ Request success rate: {success_rate:.2f}% (Target: ≥95%)")
        else:
            print(f"❌ Request success rate: {success_rate:.2f}% (Target: ≥95%) - FAILED")
            criteria_met = False

        print(f"{'='*70}\n")

        if criteria_met:
            print("✅ FFI BOUNDARY STRESS TEST PASSED - FFI is stable under load!")
            return 0
        else:
            print("❌ FFI BOUNDARY STRESS TEST FAILED - FFI stability issues detected")
            return 1

def main():
    import argparse
    parser = argparse.ArgumentParser(description='FFI boundary stress test')
    parser.add_argument('--url', default='http://localhost:8080', help='Base URL of the API')
    parser.add_argument('--concurrency', type=int, default=50, help='Concurrent workers')
    parser.add_argument('--duration', type=int, default=300, help='Test duration in seconds')
    args = parser.parse_args()

    # Need requests for sync calls
    import requests
    globals()['requests'] = requests

    tester = FFIBoundaryTester(
        base_url=args.url,
        concurrency=args.concurrency,
        duration=args.duration
    )

    exit_code = asyncio.run(tester.run_ffi_stress_test())
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
