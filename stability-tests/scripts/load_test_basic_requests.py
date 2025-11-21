#!/usr/bin/env python3
"""
Load Test: Basic API Request Reliability
Tests core API to ensure it never returns 5xx errors under normal load
Success Criteria: 0% 5xx errors, <1% 4xx errors, P95 latency < 2000ms
"""

import asyncio
import aiohttp
import time
import json
import sys
from collections import defaultdict
from datetime import datetime
import statistics

class LoadTestRunner:
    def __init__(self, base_url="http://localhost:8080", total_requests=1000, concurrency=50):
        self.base_url = base_url
        self.total_requests = total_requests
        self.concurrency = concurrency
        self.results = {
            'success': 0,
            '4xx': 0,
            '5xx': 0,
            'network_errors': 0,
            'latencies': [],
            'errors': defaultdict(int),
            'response_codes': defaultdict(int)
        }
        self.start_time = None
        self.end_time = None

    def get_test_payload(self, request_id):
        """Generate diverse test payloads"""
        payloads = [
            {
                "model": "gpt-4",
                "messages": [{"role": "user", "content": f"Test request {request_id}: What is 2+2?"}],
                "max_tokens": 50,
                "temperature": 0.7
            },
            {
                "model": "claude-3-sonnet",
                "messages": [{"role": "user", "content": f"Request {request_id}: Explain API design."}],
                "max_tokens": 100
            },
            {
                "model": "gpt-3.5-turbo",
                "messages": [{"role": "user", "content": f"Quick test {request_id}"}],
                "max_tokens": 30
            }
        ]
        return payloads[request_id % len(payloads)]

    async def make_request(self, session, request_id):
        """Make a single API request and track metrics"""
        url = f"{self.base_url}/v1/infer"
        payload = self.get_test_payload(request_id)
        headers = {
            "Content-Type": "application/json",
            "X-Trace-ID": f"load-test-{request_id}-{int(time.time())}"
        }

        start = time.time()
        try:
            async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as response:
                latency = (time.time() - start) * 1000  # ms
                self.results['latencies'].append(latency)
                self.results['response_codes'][response.status] += 1

                body = await response.text()

                if 200 <= response.status < 300:
                    self.results['success'] += 1
                    # Validate response structure
                    try:
                        data = json.loads(body)
                        if 'choices' not in data and 'content' not in data:
                            print(f"⚠️  Invalid response structure in request {request_id}")
                    except json.JSONDecodeError:
                        print(f"⚠️  Invalid JSON response in request {request_id}")

                elif 400 <= response.status < 500:
                    self.results['4xx'] += 1
                    self.results['errors'][f"4xx_{response.status}"] += 1
                    print(f"⚠️  4xx error in request {request_id}: {response.status} - {body[:200]}")

                elif 500 <= response.status < 600:
                    self.results['5xx'] += 1
                    self.results['errors'][f"5xx_{response.status}"] += 1
                    print(f"🚨 CRITICAL: 5xx error in request {request_id}: {response.status} - {body[:200]}")

                return response.status, latency

        except asyncio.TimeoutError:
            latency = (time.time() - start) * 1000
            self.results['network_errors'] += 1
            self.results['errors']['timeout'] += 1
            self.results['latencies'].append(latency)
            print(f"⚠️  Timeout in request {request_id} after {latency:.0f}ms")
            return None, latency

        except Exception as e:
            latency = (time.time() - start) * 1000
            self.results['network_errors'] += 1
            self.results['errors'][type(e).__name__] += 1
            print(f"🚨 Network error in request {request_id}: {str(e)}")
            return None, latency

    async def run_batch(self, session, start_idx, batch_size):
        """Run a batch of concurrent requests"""
        tasks = [
            self.make_request(session, start_idx + i)
            for i in range(batch_size)
        ]
        return await asyncio.gather(*tasks)

    async def run_load_test(self):
        """Execute the full load test"""
        print(f"\n{'='*70}")
        print(f"🔥 SCHLEP-ENGINE LOAD TEST - Basic API Reliability")
        print(f"{'='*70}")
        print(f"Target URL: {self.base_url}")
        print(f"Total Requests: {self.total_requests}")
        print(f"Concurrency: {self.concurrency}")
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*70}\n")

        self.start_time = time.time()

        async with aiohttp.ClientSession() as session:
            # Warm-up request
            print("🔄 Warming up...")
            await self.make_request(session, 0)

            print(f"🚀 Starting load test with {self.concurrency} concurrent requests...\n")

            # Run batches
            for batch_start in range(0, self.total_requests, self.concurrency):
                batch_size = min(self.concurrency, self.total_requests - batch_start)
                await self.run_batch(session, batch_start, batch_size)

                # Progress update every 10 batches
                if (batch_start // self.concurrency) % 10 == 0:
                    progress = ((batch_start + batch_size) / self.total_requests) * 100
                    print(f"📊 Progress: {progress:.1f}% ({batch_start + batch_size}/{self.total_requests} requests)")

        self.end_time = time.time()
        self.print_results()

    def print_results(self):
        """Print comprehensive test results"""
        duration = self.end_time - self.start_time
        total_requests = self.results['success'] + self.results['4xx'] + self.results['5xx'] + self.results['network_errors']

        print(f"\n{'='*70}")
        print(f"📊 LOAD TEST RESULTS")
        print(f"{'='*70}\n")

        print(f"⏱️  Duration: {duration:.2f}s")
        print(f"📈 Throughput: {total_requests / duration:.2f} req/s")
        print(f"📦 Total Requests: {total_requests}")

        print(f"\n{'Status Distribution':-^70}")
        success_rate = (self.results['success'] / total_requests * 100) if total_requests > 0 else 0
        error_4xx_rate = (self.results['4xx'] / total_requests * 100) if total_requests > 0 else 0
        error_5xx_rate = (self.results['5xx'] / total_requests * 100) if total_requests > 0 else 0
        network_error_rate = (self.results['network_errors'] / total_requests * 100) if total_requests > 0 else 0

        print(f"✅ Success (2xx): {self.results['success']} ({success_rate:.2f}%)")
        print(f"⚠️  Client Errors (4xx): {self.results['4xx']} ({error_4xx_rate:.2f}%)")
        print(f"🚨 Server Errors (5xx): {self.results['5xx']} ({error_5xx_rate:.2f}%)")
        print(f"🌐 Network Errors: {self.results['network_errors']} ({network_error_rate:.2f}%)")

        if self.results['latencies']:
            print(f"\n{'Latency Statistics (ms)':-^70}")
            sorted_latencies = sorted(self.results['latencies'])
            print(f"Min: {min(sorted_latencies):.2f}ms")
            print(f"Avg: {statistics.mean(sorted_latencies):.2f}ms")
            print(f"Median (P50): {statistics.median(sorted_latencies):.2f}ms")
            print(f"P95: {sorted_latencies[int(len(sorted_latencies) * 0.95)]:.2f}ms")
            print(f"P99: {sorted_latencies[int(len(sorted_latencies) * 0.99)]:.2f}ms")
            print(f"Max: {max(sorted_latencies):.2f}ms")

        if self.results['response_codes']:
            print(f"\n{'Response Code Breakdown':-^70}")
            for code, count in sorted(self.results['response_codes'].items()):
                print(f"HTTP {code}: {count} ({count/total_requests*100:.2f}%)")

        if self.results['errors']:
            print(f"\n{'Error Details':-^70}")
            for error_type, count in sorted(self.results['errors'].items(), key=lambda x: x[1], reverse=True):
                print(f"{error_type}: {count}")

        # Success criteria evaluation
        print(f"\n{'Success Criteria Evaluation':-^70}")
        p95_latency = sorted(self.results['latencies'])[int(len(self.results['latencies']) * 0.95)] if self.results['latencies'] else float('inf')

        criteria_met = True

        if error_5xx_rate == 0:
            print(f"✅ 5xx error rate: {error_5xx_rate:.2f}% (Target: 0%)")
        else:
            print(f"❌ 5xx error rate: {error_5xx_rate:.2f}% (Target: 0%) - FAILED")
            criteria_met = False

        if error_4xx_rate < 1.0:
            print(f"✅ 4xx error rate: {error_4xx_rate:.2f}% (Target: <1%)")
        else:
            print(f"⚠️  4xx error rate: {error_4xx_rate:.2f}% (Target: <1%) - WARNING")

        if p95_latency < 2000:
            print(f"✅ P95 latency: {p95_latency:.2f}ms (Target: <2000ms)")
        else:
            print(f"❌ P95 latency: {p95_latency:.2f}ms (Target: <2000ms) - FAILED")
            criteria_met = False

        availability = success_rate + error_4xx_rate  # 4xx are "available" (client errors)
        if availability >= 99.9:
            print(f"✅ Availability: {availability:.2f}% (Target: ≥99.9%)")
        else:
            print(f"❌ Availability: {availability:.2f}% (Target: ≥99.9%) - FAILED")
            criteria_met = False

        print(f"{'='*70}\n")

        if criteria_met:
            print("✅ ALL SUCCESS CRITERIA MET - API is production-ready!")
            return 0
        else:
            print("❌ SOME CRITERIA FAILED - Review and fix before production deployment")
            return 1

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Load test Schlep-engine API')
    parser.add_argument('--url', default='http://localhost:8080', help='Base URL of the API')
    parser.add_argument('--requests', type=int, default=1000, help='Total number of requests')
    parser.add_argument('--concurrency', type=int, default=50, help='Concurrent requests')
    args = parser.parse_args()

    runner = LoadTestRunner(
        base_url=args.url,
        total_requests=args.requests,
        concurrency=args.concurrency
    )

    exit_code = asyncio.run(runner.run_load_test())
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
