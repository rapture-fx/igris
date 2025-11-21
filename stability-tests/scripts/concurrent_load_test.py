#!/usr/bin/env python3
"""
Concurrent Load Test with Siege-like behavior
Tests performance under realistic concurrent load
Success Criteria: P95 < 2000ms, availability > 99.9%, no memory leaks
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

class ConcurrentLoadTester:
    def __init__(self, base_url="http://localhost:8080", concurrency=100, duration=300):
        self.base_url = base_url
        self.concurrency = concurrency
        self.duration = duration
        self.results = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'response_codes': defaultdict(int),
            'latencies': [],
            'throughput_samples': [],
            'memory_samples': [],
            'cpu_samples': []
        }
        self.start_time = None
        self.running = True

    def get_diverse_payload(self, request_id):
        """Generate diverse realistic payloads"""
        payloads = [
            # Short query
            {
                "model": "gpt-3.5-turbo",
                "messages": [{"role": "user", "content": f"Quick answer {request_id}: What is Python?"}],
                "max_tokens": 50,
                "temperature": 0.7
            },
            # Medium query
            {
                "model": "gpt-4",
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": f"Request {request_id}: Explain REST API design principles."}
                ],
                "max_tokens": 150,
                "temperature": 0.8
            },
            # Long query
            {
                "model": "claude-3-sonnet",
                "messages": [{"role": "user", "content": f"Detailed request {request_id}: Write a detailed explanation of microservices architecture, including pros and cons."}],
                "max_tokens": 300,
                "temperature": 0.7
            },
            # Streaming request
            {
                "model": "gpt-4",
                "messages": [{"role": "user", "content": f"Stream test {request_id}: Explain cloud computing."}],
                "max_tokens": 100,
                "stream": False  # Set to True if streaming is supported
            }
        ]
        return payloads[request_id % len(payloads)]

    async def make_request(self, session, request_id):
        """Make a single concurrent request"""
        url = f"{self.base_url}/v1/infer"
        payload = self.get_diverse_payload(request_id)
        headers = {
            "Content-Type": "application/json",
            "X-Trace-ID": f"concurrent-load-{request_id}-{int(time.time())}"
        }

        start = time.time()
        try:
            async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=60)) as response:
                latency = (time.time() - start) * 1000
                body = await response.text()

                self.results['total_requests'] += 1
                self.results['response_codes'][response.status] += 1
                self.results['latencies'].append(latency)

                if 200 <= response.status < 300:
                    self.results['successful_requests'] += 1
                    return True, latency, response.status
                else:
                    self.results['failed_requests'] += 1
                    if response.status >= 500:
                        print(f"🚨 5xx error: {response.status} - {body[:100]}")
                    return False, latency, response.status

        except asyncio.TimeoutError:
            latency = (time.time() - start) * 1000
            self.results['total_requests'] += 1
            self.results['failed_requests'] += 1
            self.results['response_codes']['timeout'] += 1
            self.results['latencies'].append(latency)
            return False, latency, 'timeout'

        except Exception as e:
            latency = (time.time() - start) * 1000
            self.results['total_requests'] += 1
            self.results['failed_requests'] += 1
            self.results['response_codes']['error'] += 1
            return False, latency, 'error'

    async def worker(self, session, worker_id):
        """Worker coroutine that continuously sends requests"""
        request_count = 0
        while self.running:
            elapsed = time.time() - self.start_time
            if elapsed >= self.duration:
                self.running = False
                break

            request_id = worker_id * 1000000 + request_count
            await self.make_request(session, request_id)
            request_count += 1

            # Small random delay to simulate realistic traffic patterns
            await asyncio.sleep(0.01 + (request_id % 10) * 0.01)

    async def monitor_resources(self):
        """Monitor system resources during the test"""
        process = psutil.Process()

        while self.running:
            try:
                # Memory usage
                mem_info = process.memory_info()
                mem_mb = mem_info.rss / 1024 / 1024
                self.results['memory_samples'].append(mem_mb)

                # CPU usage
                cpu_percent = process.cpu_percent(interval=0.1)
                self.results['cpu_samples'].append(cpu_percent)

                # Throughput
                elapsed = time.time() - self.start_time
                if elapsed > 0:
                    throughput = self.results['total_requests'] / elapsed
                    self.results['throughput_samples'].append(throughput)

            except Exception as e:
                print(f"⚠️  Resource monitoring error: {str(e)}")

            await asyncio.sleep(5)

    async def progress_reporter(self):
        """Report progress during the test"""
        last_total = 0
        report_interval = 10  # seconds

        while self.running:
            await asyncio.sleep(report_interval)

            elapsed = time.time() - self.start_time
            if elapsed >= self.duration:
                break

            current_total = self.results['total_requests']
            requests_in_interval = current_total - last_total
            throughput = requests_in_interval / report_interval

            success_rate = (self.results['successful_requests'] / current_total * 100) if current_total > 0 else 0

            if self.results['latencies']:
                recent_latencies = sorted(self.results['latencies'][-100:])
                p95 = recent_latencies[int(len(recent_latencies) * 0.95)] if len(recent_latencies) > 0 else 0
            else:
                p95 = 0

            print(f"⏱️  {elapsed:.0f}s | "
                  f"Requests: {current_total} | "
                  f"Throughput: {throughput:.1f} req/s | "
                  f"Success: {success_rate:.1f}% | "
                  f"P95: {p95:.0f}ms")

            last_total = current_total

    async def run_load_test(self):
        """Run the concurrent load test"""
        print(f"\n{'='*70}")
        print(f"🚀 CONCURRENT LOAD TEST")
        print(f"{'='*70}")
        print(f"Target URL: {self.base_url}")
        print(f"Concurrency: {self.concurrency} workers")
        print(f"Duration: {self.duration}s")
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*70}\n")

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
        """Print comprehensive load test results"""
        duration = time.time() - self.start_time
        total = self.results['total_requests']

        print(f"\n{'='*70}")
        print(f"📊 CONCURRENT LOAD TEST RESULTS")
        print(f"{'='*70}\n")

        print(f"⏱️  Total Duration: {duration:.2f}s")
        print(f"📦 Total Requests: {total}")
        print(f"✅ Successful: {self.results['successful_requests']} ({self.results['successful_requests']/total*100:.2f}%)")
        print(f"❌ Failed: {self.results['failed_requests']} ({self.results['failed_requests']/total*100:.2f}%)")
        print(f"📈 Average Throughput: {total/duration:.2f} req/s")

        if self.results['latencies']:
            sorted_latencies = sorted(self.results['latencies'])
            print(f"\n{'Latency Distribution (ms)':-^70}")
            print(f"Min:    {min(sorted_latencies):>8.2f}ms")
            print(f"P25:    {sorted_latencies[int(len(sorted_latencies)*0.25)]:>8.2f}ms")
            print(f"P50:    {sorted_latencies[int(len(sorted_latencies)*0.50)]:>8.2f}ms")
            print(f"P75:    {sorted_latencies[int(len(sorted_latencies)*0.75)]:>8.2f}ms")
            print(f"P95:    {sorted_latencies[int(len(sorted_latencies)*0.95)]:>8.2f}ms")
            print(f"P99:    {sorted_latencies[int(len(sorted_latencies)*0.99)]:>8.2f}ms")
            print(f"Max:    {max(sorted_latencies):>8.2f}ms")
            print(f"Avg:    {statistics.mean(sorted_latencies):>8.2f}ms")
            print(f"StdDev: {statistics.stdev(sorted_latencies):>8.2f}ms" if len(sorted_latencies) > 1 else "")

        print(f"\n{'Response Code Distribution':-^70}")
        for code, count in sorted(self.results['response_codes'].items()):
            percentage = (count / total * 100) if total > 0 else 0
            print(f"{str(code):>15}: {count:>6} ({percentage:>5.2f}%)")

        if self.results['memory_samples']:
            print(f"\n{'Resource Usage':-^70}")
            print(f"Memory (RSS):")
            print(f"  Initial: {self.results['memory_samples'][0]:.2f} MB")
            print(f"  Final:   {self.results['memory_samples'][-1]:.2f} MB")
            print(f"  Peak:    {max(self.results['memory_samples']):.2f} MB")
            print(f"  Growth:  {self.results['memory_samples'][-1] - self.results['memory_samples'][0]:.2f} MB")

            growth_percentage = ((self.results['memory_samples'][-1] - self.results['memory_samples'][0]) /
                               self.results['memory_samples'][0] * 100) if self.results['memory_samples'][0] > 0 else 0
            print(f"  Growth%: {growth_percentage:.2f}%")

        if self.results['throughput_samples']:
            print(f"\nThroughput:")
            print(f"  Average: {statistics.mean(self.results['throughput_samples']):.2f} req/s")
            print(f"  Peak:    {max(self.results['throughput_samples']):.2f} req/s")

        # Success criteria evaluation
        print(f"\n{'Success Criteria Evaluation':-^70}")

        criteria_met = True

        # P95 latency < 2000ms
        if self.results['latencies']:
            p95 = sorted(self.results['latencies'])[int(len(self.results['latencies']) * 0.95)]
            if p95 < 2000:
                print(f"✅ P95 latency: {p95:.2f}ms (Target: <2000ms)")
            else:
                print(f"❌ P95 latency: {p95:.2f}ms (Target: <2000ms) - FAILED")
                criteria_met = False

        # Availability > 99.9%
        availability = (self.results['successful_requests'] / total * 100) if total > 0 else 0
        if availability >= 99.9:
            print(f"✅ Availability: {availability:.3f}% (Target: ≥99.9%)")
        else:
            print(f"❌ Availability: {availability:.3f}% (Target: ≥99.9%) - FAILED")
            criteria_met = False

        # Memory growth < 10%
        if self.results['memory_samples'] and len(self.results['memory_samples']) > 1:
            growth_percentage = ((self.results['memory_samples'][-1] - self.results['memory_samples'][0]) /
                               self.results['memory_samples'][0] * 100)
            if growth_percentage < 10:
                print(f"✅ Memory growth: {growth_percentage:.2f}% (Target: <10%)")
            else:
                print(f"⚠️  Memory growth: {growth_percentage:.2f}% (Target: <10%) - WARNING")

        # No 5xx errors
        server_errors = sum(count for code, count in self.results['response_codes'].items()
                          if isinstance(code, int) and 500 <= code < 600)
        if server_errors == 0:
            print(f"✅ Server errors (5xx): 0 (Target: 0)")
        else:
            print(f"❌ Server errors (5xx): {server_errors} (Target: 0) - FAILED")
            criteria_met = False

        print(f"{'='*70}\n")

        if criteria_met:
            print("✅ CONCURRENT LOAD TEST PASSED - System performs well under load!")
            return 0
        else:
            print("❌ CONCURRENT LOAD TEST FAILED - Performance issues detected")
            return 1

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Run concurrent load test')
    parser.add_argument('--url', default='http://localhost:8080', help='Base URL of the API')
    parser.add_argument('--concurrency', type=int, default=100, help='Number of concurrent workers')
    parser.add_argument('--duration', type=int, default=300, help='Test duration in seconds')
    args = parser.parse_args()

    tester = ConcurrentLoadTester(
        base_url=args.url,
        concurrency=args.concurrency,
        duration=args.duration
    )

    exit_code = asyncio.run(tester.run_load_test())
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
