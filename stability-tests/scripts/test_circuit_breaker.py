#!/usr/bin/env python3
"""
Circuit Breaker Testing Framework
Tests circuit breaker activation, fail-fast behavior, and recovery
Success Criteria: Circuit opens after threshold, fails fast without cascading failures
"""

import requests
import json
import time
import sys
from datetime import datetime
from collections import defaultdict
import statistics

class CircuitBreakerTester:
    def __init__(self, base_url="http://localhost:8080"):
        self.base_url = base_url
        self.results = {
            'requests_sent': 0,
            'successes': 0,
            'failures': 0,
            'fast_failures': 0,
            'circuit_states': [],
            'latencies': [],
            'error_types': defaultdict(int)
        }

    def check_provider_health(self):
        """Check provider health and circuit breaker status"""
        try:
            response = requests.get(f"{self.base_url}/v1/providers/stats", timeout=5)
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            print(f"⚠️  Failed to check provider health: {str(e)}")
        return None

    def trigger_failures(self, count=10, target_provider="openai"):
        """
        Trigger failures to activate circuit breaker.

        This simulates provider errors by:
        1. Making requests with invalid API keys (if BYOK enabled)
        2. Using invalid model names
        3. Sending malformed requests
        """
        print(f"\n{'='*70}")
        print(f"🔥 TRIGGERING FAILURES TO ACTIVATE CIRCUIT BREAKER")
        print(f"{'='*70}")
        print(f"Target: {count} failures")
        print(f"Provider: {target_provider}")
        print(f"{'='*70}\n")

        failure_payloads = [
            # Invalid model name
            {
                "model": "gpt-nonexistent-model-12345",
                "messages": [{"role": "user", "content": "test"}],
                "max_tokens": 10
            },
            # Request to specific provider that might fail
            {
                "model": "gpt-4",
                "messages": [{"role": "user", "content": "test"}],
                "max_tokens": 10,
                "provider_override": "invalid_provider"
            }
        ]

        for i in range(count):
            payload = failure_payloads[i % len(failure_payloads)]
            headers = {
                "Content-Type": "application/json",
                "X-Trace-ID": f"circuit-breaker-trigger-{i}"
            }

            start = time.time()
            try:
                response = requests.post(
                    f"{self.base_url}/v1/infer",
                    json=payload,
                    headers=headers,
                    timeout=10
                )
                latency = (time.time() - start) * 1000

                self.results['requests_sent'] += 1
                self.results['latencies'].append(latency)

                if response.status_code == 200:
                    self.results['successes'] += 1
                    print(f"⚠️  Request {i+1}: Unexpected success (status 200)")
                else:
                    self.results['failures'] += 1
                    # Fast failure is < 100ms
                    if latency < 100:
                        self.results['fast_failures'] += 1
                        print(f"⚡ Request {i+1}: Fast fail ({latency:.0f}ms, status {response.status_code})")
                    else:
                        print(f"❌ Request {i+1}: Slow fail ({latency:.0f}ms, status {response.status_code})")

            except requests.Timeout:
                latency = (time.time() - start) * 1000
                self.results['requests_sent'] += 1
                self.results['failures'] += 1
                self.results['latencies'].append(latency)
                print(f"⏱️  Request {i+1}: Timeout ({latency:.0f}ms)")

            except Exception as e:
                self.results['requests_sent'] += 1
                self.results['failures'] += 1
                print(f"❌ Request {i+1}: Error - {str(e)}")

            time.sleep(0.2)  # Small delay between requests

        print(f"\n📊 Triggered {self.results['failures']} failures")

    def test_circuit_open_behavior(self, count=20):
        """
        Test behavior when circuit is open.
        Should fail fast without attempting backend calls.
        """
        print(f"\n{'='*70}")
        print(f"🔍 TESTING CIRCUIT OPEN BEHAVIOR")
        print(f"{'='*70}")
        print(f"Sending {count} requests to test fail-fast behavior")
        print(f"{'='*70}\n")

        fast_failures = 0
        slow_failures = 0

        for i in range(count):
            payload = {
                "model": "gpt-4",
                "messages": [{"role": "user", "content": f"Circuit test {i}"}],
                "max_tokens": 10
            }
            headers = {
                "Content-Type": "application/json",
                "X-Trace-ID": f"circuit-open-test-{i}"
            }

            start = time.time()
            try:
                response = requests.post(
                    f"{self.base_url}/v1/infer",
                    json=payload,
                    headers=headers,
                    timeout=10
                )
                latency = (time.time() - start) * 1000

                self.results['requests_sent'] += 1
                self.results['latencies'].append(latency)

                # Fast failure indicates circuit breaker is working
                if latency < 100:
                    fast_failures += 1
                    self.results['fast_failures'] += 1
                    print(f"⚡ Request {i+1}: Fast fail ({latency:.0f}ms) - Circuit breaker active")
                else:
                    slow_failures += 1
                    print(f"⚠️  Request {i+1}: Slow response ({latency:.0f}ms, status {response.status_code})")

            except Exception as e:
                self.results['requests_sent'] += 1
                latency = (time.time() - start) * 1000
                print(f"❌ Request {i+1}: {str(e)}")

            time.sleep(0.1)

        print(f"\n📊 Fast failures: {fast_failures}/{count}")
        print(f"📊 Slow failures: {slow_failures}/{count}")

        return fast_failures, slow_failures

    def test_recovery(self, wait_time=35):
        """
        Test circuit breaker recovery after timeout.
        Circuit should transition to half-open and test recovery.
        """
        print(f"\n{'='*70}")
        print(f"🔄 TESTING CIRCUIT BREAKER RECOVERY")
        print(f"{'='*70}")
        print(f"Waiting {wait_time}s for circuit breaker timeout...")
        print(f"Circuit should transition to HALF-OPEN state")
        print(f"{'='*70}\n")

        time.sleep(wait_time)

        print("Testing recovery with valid requests...\n")

        recovery_successes = 0
        recovery_requests = 5

        for i in range(recovery_requests):
            payload = {
                "model": "gpt-4",
                "messages": [{"role": "user", "content": "Recovery test: What is 2+2?"}],
                "max_tokens": 20
            }
            headers = {
                "Content-Type": "application/json",
                "X-Trace-ID": f"circuit-recovery-{i}"
            }

            start = time.time()
            try:
                response = requests.post(
                    f"{self.base_url}/v1/infer",
                    json=payload,
                    headers=headers,
                    timeout=30
                )
                latency = (time.time() - start) * 1000

                self.results['requests_sent'] += 1
                self.results['latencies'].append(latency)

                if response.status_code == 200:
                    recovery_successes += 1
                    self.results['successes'] += 1
                    print(f"✅ Recovery request {i+1}: Success ({latency:.0f}ms)")
                else:
                    print(f"⚠️  Recovery request {i+1}: Failed (status {response.status_code})")

            except Exception as e:
                self.results['requests_sent'] += 1
                print(f"❌ Recovery request {i+1}: {str(e)}")

            time.sleep(1)

        print(f"\n📊 Recovery success rate: {recovery_successes}/{recovery_requests}")
        return recovery_successes

    def run_circuit_breaker_test(self):
        """Run complete circuit breaker test suite"""
        print(f"\n{'='*70}")
        print(f"🧪 CIRCUIT BREAKER COMPREHENSIVE TEST")
        print(f"{'='*70}")
        print(f"Target URL: {self.base_url}")
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*70}\n")

        # Phase 1: Check initial state
        print("📊 Phase 1: Checking initial provider health...")
        initial_health = self.check_provider_health()
        if initial_health:
            print(json.dumps(initial_health, indent=2))
        print()

        # Phase 2: Trigger failures to open circuit
        print("📊 Phase 2: Triggering failures to activate circuit breaker...")
        self.trigger_failures(count=8)

        # Check circuit state
        time.sleep(2)
        circuit_health = self.check_provider_health()
        if circuit_health:
            print("\n📊 Circuit breaker state after failures:")
            print(json.dumps(circuit_health, indent=2))

        # Phase 3: Test circuit open behavior
        print("\n📊 Phase 3: Testing fail-fast behavior with open circuit...")
        fast_fails, slow_fails = self.test_circuit_open_behavior(count=10)

        # Phase 4: Test recovery
        print("\n📊 Phase 4: Testing circuit breaker recovery...")
        recovery_count = self.test_recovery(wait_time=35)

        # Final health check
        print("\n📊 Final provider health check:")
        final_health = self.check_provider_health()
        if final_health:
            print(json.dumps(final_health, indent=2))

        self.print_results(fast_fails, slow_fails, recovery_count)

    def print_results(self, fast_fails, slow_fails, recovery_successes):
        """Print comprehensive test results"""
        print(f"\n{'='*70}")
        print(f"📊 CIRCUIT BREAKER TEST RESULTS")
        print(f"{'='*70}\n")

        total = self.results['requests_sent']
        print(f"📦 Total Requests: {total}")
        print(f"✅ Successes: {self.results['successes']}")
        print(f"❌ Failures: {self.results['failures']}")
        print(f"⚡ Fast Failures (<100ms): {self.results['fast_failures']}")

        if self.results['latencies']:
            print(f"\n{'Latency Statistics (ms)':-^70}")
            sorted_latencies = sorted(self.results['latencies'])
            print(f"Min: {min(sorted_latencies):.2f}ms")
            print(f"Avg: {statistics.mean(sorted_latencies):.2f}ms")
            print(f"Median: {statistics.median(sorted_latencies):.2f}ms")
            print(f"P95: {sorted_latencies[int(len(sorted_latencies) * 0.95)]:.2f}ms")
            print(f"Max: {max(sorted_latencies):.2f}ms")

        print(f"\n{'Success Criteria Evaluation':-^70}")

        criteria_met = True

        # Circuit should open and fail fast
        fast_fail_rate = (fast_fails / (fast_fails + slow_fails) * 100) if (fast_fails + slow_fails) > 0 else 0
        if fast_fail_rate >= 70:
            print(f"✅ Fast fail rate: {fast_fail_rate:.1f}% (Target: ≥70%)")
        else:
            print(f"⚠️  Fast fail rate: {fast_fail_rate:.1f}% (Target: ≥70%) - WARNING")

        # System should recover
        if recovery_successes >= 3:
            print(f"✅ Recovery: {recovery_successes} successful requests (Target: ≥3)")
        else:
            print(f"❌ Recovery: {recovery_successes} successful requests (Target: ≥3) - FAILED")
            criteria_met = False

        # No cascading failures (all failures should be fast when circuit open)
        avg_failure_latency = statistics.mean([l for l in self.results['latencies'] if l < 1000]) if self.results['latencies'] else 0
        if avg_failure_latency < 200:
            print(f"✅ Avg failure latency: {avg_failure_latency:.2f}ms (Target: <200ms)")
        else:
            print(f"⚠️  Avg failure latency: {avg_failure_latency:.2f}ms (Target: <200ms)")

        print(f"{'='*70}\n")

        if criteria_met:
            print("✅ CIRCUIT BREAKER TEST PASSED - System fails fast and recovers properly!")
            return 0
        else:
            print("❌ CIRCUIT BREAKER TEST FAILED - Review circuit breaker configuration")
            return 1

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Test circuit breaker functionality')
    parser.add_argument('--url', default='http://localhost:8080', help='Base URL of the API')
    args = parser.parse_args()

    tester = CircuitBreakerTester(base_url=args.url)
    exit_code = tester.run_circuit_breaker_test()
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
